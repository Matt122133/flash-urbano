// Package colores decide el color de cada cuenta de cliente (030).
//
// La app del repartidor dibuja ese color como una franja en la tarjeta del
// pedido, para que dos clientes distintos no se vean iguales de reojo. El
// nombre del remitente sigue siendo lo que resuelve la duda: el color ayuda a
// separar, no identifica por si solo.
//
// Este paquete es **puro**: no conoce la base. Quien asigna (`usuarios`) le
// pasa los colores ya tomados y guarda lo que devuelve.
//
// ## Por que una lista Y un generador
//
// Con hexadecimal se escriben millones de colores, pero el ojo separa pocos.
// Sortear un hex da colores que no se distinguen o que chocan con los que la
// app ya usa con significado. Por eso primero se reparte una **lista elegida a
// mano**, y recien cuando se agota se **genera** el color mas lejano de todos
// los asignados. **Ninguno se repite nunca** (FR-004b), y el costo quedo dicho
// en el spec: pasados unos dieciseis clientes, los generados se parecen a
// alguno anterior (research D3).
//
// ## Las distancias son en OKLab
//
// OKLab es un espacio de color donde la distancia entre dos puntos se parece a
// la diferencia que ve una persona. En RGB no: dos azules pueden estar lejos en
// numeros y verse iguales. Son veinte lineas de aritmetica publicada (Bjorn
// Ottosson, 2020), y no justifican una dependencia.
package colores

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"sync"
)

// Lista son los colores que se reparten primero, **en este orden**.
//
// El orden importa: las primeras cuentas reciben los mas separados entre si.
// Fucsia, cian y lima son los tres tonos mas distintos del conjunto, y van a
// las tres cuentas reales (research D6).
//
// **Agregar un color es agregar una linea.** La prueba del paquete rechaza el
// que no cumpla las reglas de `Valido`, asi que no hace falta acordarse de
// ellas: si el color nuevo es naranja, gris o no se ve sobre blanco, el build
// lo dice. Agregarlo no cambia ningun color ya asignado.
//
// Son siete y no diez porque con diez la pareja mas cercana quedaba a 0.056 en
// OKLab (dos cianes que no se distinguen). Con estos siete, la mas cercana
// —lima y oliva— queda a 0.120 (research D2).
var Lista = []string{
	"#c026d3", // fucsia
	"#0891b2", // cian
	"#65a30d", // lima
	"#7c3aed", // violeta
	"#db2777", // rosa
	"#8a7a00", // oliva
	"#86198f", // ciruela
}

// reservados son los colores de la app que ya significan algo.
//
// Copiados de `android/.../ui/tema/Paleta.kt`, que es la fuente: si alli
// cambia uno, aca tiene que cambiar tambien. Un color de cliente demasiado
// cerca de alguno de estos se leeria como ese significado y no como un
// cliente.
var reservados = map[string]string{
	"#1d4ed8": "azul (entrega, tarjeta destacada)",
	"#1e3a8a": "azul oscuro",
	"#f97316": "naranja (retiro)",
	"#15803d": "verde (entregado)",
	"#b91c1c": "rojo (error)",
}

// ventanas son los tonos OKLCH, en grados, que un color de cliente no puede
// tener. Rojo y naranja van juntos, e incluyen el marron, que es naranja
// oscuro.
var ventanas = [][2]float64{
	{10, 75},   // rojo, naranja, marron
	{135, 165}, // verde
	{250, 280}, // azul
}

const (
	// El minimo de WCAG para elementos graficos que no son texto: la franja
	// tiene que verse contra el blanco de la tarjeta.
	contrasteMinimo = 3.0

	// Por debajo, el color es un gris y se leeria como "deshabilitado".
	cromaMinimo = 0.08

	// Distancia OKLab minima a cada color reservado.
	distanciaAReservado = 0.12
)

var formato = regexp.MustCompile(`^#[0-9a-f]{6}$`)

// Valido dice si un hex puede ser el color de un cliente, y si no, por que.
//
// Exige el formato que guarda la base: `#` y seis digitos en minuscula.
func Valido(hex string) error {
	if !formato.MatchString(hex) {
		return fmt.Errorf("%q no es un color #rrggbb en minuscula", hex)
	}
	c := deHex(hex)
	if k := contraste(c, rgb{1, 1, 1}); k < contrasteMinimo {
		return fmt.Errorf("%s contrasta %.2f:1 contra blanco, y el minimo es %.1f:1", hex, k, contrasteMinimo)
	}
	lab := c.oklab()
	_, croma, tono := lab.lch()
	if croma < cromaMinimo {
		return fmt.Errorf("%s es casi gris (croma %.3f)", hex, croma)
	}
	for _, v := range ventanas {
		if tono >= v[0] && tono <= v[1] {
			return fmt.Errorf("%s tiene tono %.0f, reservado (%v)", hex, tono, v)
		}
	}
	for r, significado := range reservados {
		if d := lab.distancia(deHex(r).oklab()); d < distanciaAReservado {
			return fmt.Errorf("%s esta a %.3f de %s", hex, d, significado)
		}
	}
	return nil
}

// Elegir devuelve el color para una cuenta nueva, dados los ya asignados.
//
//  1. El primero de `Lista` que nadie tenga.
//  2. Si estan todos, el candidato de la grilla que **maximiza la distancia
//     minima** a los asignados y a los reservados.
//
// Nunca devuelve un color de `asignados`. Los asignados se comparan en
// minuscula, y los que no son un hex valido se ignoran para la distancia —pero
// no pueden coincidir con un candidato, que siempre es valido—.
//
// Es determinista: la misma entrada da la misma salida, y los empates se
// resuelven por el orden de la grilla.
//
// Devuelve false solo si no queda ningun candidato libre, que con la grilla
// actual pasa despues de varios cientos de cuentas. En ese caso la cuenta queda
// sin color: repetir uno violaria FR-004b, y sin color la tarjeta se ve como
// antes, que es un estado que el producto ya contempla.
func Elegir(asignados []string) (string, bool) {
	tomados := make(map[string]bool, len(asignados))
	var puntos []lab
	for _, a := range asignados {
		a = strings.ToLower(strings.TrimSpace(a))
		tomados[a] = true
		if formato.MatchString(a) {
			puntos = append(puntos, deHex(a).oklab())
		}
	}

	for _, c := range Lista {
		if !tomados[c] {
			return c, true
		}
	}

	for r := range reservados {
		puntos = append(puntos, deHex(r).oklab())
	}

	mejor, mejorDistancia := "", -1.0
	for _, cand := range candidatos() {
		if tomados[cand.hex] {
			continue
		}
		minima := math.Inf(1)
		for _, p := range puntos {
			if d := cand.lab.distancia(p); d < minima {
				minima = d
			}
		}
		// Estricto: ante un empate gana el que vino antes en la grilla.
		if minima > mejorDistancia {
			mejor, mejorDistancia = cand.hex, minima
		}
	}
	return mejor, mejor != ""
}

type candidato struct {
	hex string
	lab lab
}

var (
	grillaUnaVez sync.Once
	grilla       []candidato
)

// candidatos es la grilla fija de colores que el generador puede proponer.
//
// L de 0.45 a 0.65 (ni tan oscuro que parezca negro ni tan claro que no se vea
// sobre blanco), croma de 0.10 a 0.22 y tono cada 5 grados. Se descartan los
// que caen fuera de sRGB y los que no pasan `Valido`. Se calcula una vez.
func candidatos() []candidato {
	grillaUnaVez.Do(func() {
		vistos := map[string]bool{}
		for _, l := range []float64{0.45, 0.50, 0.55, 0.60, 0.65} {
			for _, c := range []float64{0.10, 0.14, 0.18, 0.22} {
				for h := 0; h < 360; h += 5 {
					hex, ok := desdeOKLCH(l, c, float64(h))
					if !ok || vistos[hex] || Valido(hex) != nil {
						continue
					}
					vistos[hex] = true
					grilla = append(grilla, candidato{hex: hex, lab: deHex(hex).oklab()})
				}
			}
		}
	})
	return grilla
}

// --- aritmetica de color ---------------------------------------------------

// rgb es un color sRGB con cada canal entre 0 y 1, sin linealizar.
type rgb struct{ r, g, b float64 }

type lab struct{ l, a, b float64 }

func deHex(hex string) rgb {
	var r, g, b uint8
	fmt.Sscanf(hex, "#%02x%02x%02x", &r, &g, &b)
	return rgb{float64(r) / 255, float64(g) / 255, float64(b) / 255}
}

func lineal(c float64) float64 {
	if c <= 0.04045 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

func gamma(c float64) float64 {
	if c <= 0.0031308 {
		return 12.92 * c
	}
	return 1.055*math.Pow(c, 1/2.4) - 0.055
}

// luminancia relativa de WCAG.
func (c rgb) luminancia() float64 {
	return 0.2126*lineal(c.r) + 0.7152*lineal(c.g) + 0.0722*lineal(c.b)
}

func contraste(x, y rgb) float64 {
	a, b := x.luminancia(), y.luminancia()
	if a < b {
		a, b = b, a
	}
	return (a + 0.05) / (b + 0.05)
}

func (c rgb) oklab() lab {
	r, g, b := lineal(c.r), lineal(c.g), lineal(c.b)
	l := math.Cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b)
	m := math.Cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b)
	s := math.Cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b)
	return lab{
		l: 0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
		a: 1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
		b: 0.0259040371*l + 0.7827717662*m - 0.8086757660*s,
	}
}

// lch devuelve luminosidad, croma y tono en grados [0, 360).
func (x lab) lch() (float64, float64, float64) {
	h := math.Atan2(x.b, x.a) * 180 / math.Pi
	if h < 0 {
		h += 360
	}
	return x.l, math.Hypot(x.a, x.b), h
}

func (x lab) distancia(y lab) float64 {
	return math.Sqrt((x.l-y.l)*(x.l-y.l) + (x.a-y.a)*(x.a-y.a) + (x.b-y.b)*(x.b-y.b))
}

// desdeOKLCH convierte a hex, o devuelve false si el color no existe en sRGB.
func desdeOKLCH(l, c, h float64) (string, bool) {
	a := c * math.Cos(h*math.Pi/180)
	b := c * math.Sin(h*math.Pi/180)
	l3 := math.Pow(l+0.3963377774*a+0.2158037573*b, 3)
	m3 := math.Pow(l-0.1055613458*a-0.0638541728*b, 3)
	s3 := math.Pow(l-0.0894841775*a-1.2914855480*b, 3)
	canales := [3]float64{
		4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3,
		-1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3,
		-0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3,
	}
	var bytes [3]int
	for i, v := range canales {
		if v < -1e-4 || v > 1+1e-4 {
			return "", false
		}
		v = math.Min(math.Max(v, 0), 1)
		bytes[i] = int(math.Round(gamma(v) * 255))
	}
	return fmt.Sprintf("#%02x%02x%02x", bytes[0], bytes[1], bytes[2]), true
}
