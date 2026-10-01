package colores

import (
	"strings"
	"testing"
)

// La lista es lo que alguien va a editar a mano. Esta prueba es la que hace
// que "agregar un color es agregar una linea" sea seguro: si el color nuevo no
// cumple las reglas, el build lo dice con el motivo.
func TestLaListaCumpleLasReglas(t *testing.T) {
	vistos := map[string]bool{}
	for _, c := range Lista {
		if err := Valido(c); err != nil {
			t.Errorf("color de la lista invalido: %v", err)
		}
		if vistos[c] {
			t.Errorf("%s esta dos veces en la lista", c)
		}
		vistos[c] = true
	}
}

// Control positivo de `Valido`: si no rechazara nada, la prueba de arriba
// pasaria sin probar nada.
func TestValidoRechazaLoQueNoEsUnColorDeCliente(t *testing.T) {
	casos := map[string]string{
		"#f97316":  "el naranja de retiro",
		"#1d4ed8":  "el azul de marca",
		"#15803d":  "el verde de entregado",
		"#b91c1c":  "el rojo de error",
		"#475569":  "un gris",
		"#facc15":  "un amarillo que no llega a 3:1 sobre blanco",
		"#C026D3":  "mayusculas: la base no las acepta",
		"c026d3":   "sin #",
		"#c026d":   "cinco digitos",
		"#zzzzzz":  "no es hex",
		"":         "vacio",
		"#c026d3 ": "espacio al final",
	}
	for hex, que := range casos {
		if Valido(hex) == nil {
			t.Errorf("Valido(%q) acepto %s", hex, que)
		}
	}
}

func TestElegirDaElPrimeroLibreDeLaLista(t *testing.T) {
	if c, ok := Elegir(nil); !ok || c != Lista[0] {
		t.Fatalf("sin asignados: %q, %v; queria %q", c, ok, Lista[0])
	}

	// Desordenados y en mayuscula: se comparan igual.
	asignados := []string{strings.ToUpper(Lista[2]), Lista[0], " " + Lista[1] + " "}
	if c, _ := Elegir(asignados); c != Lista[3] {
		t.Fatalf("con los tres primeros tomados: %q; queria %q", c, Lista[3])
	}

	// Un hueco en el medio se llena antes que seguir de largo.
	if c, _ := Elegir([]string{Lista[0], Lista[2]}); c != Lista[1] {
		t.Fatalf("con el segundo libre: %q; queria %q", c, Lista[1])
	}
}

func TestElegirGeneraCuandoLaListaSeAgota(t *testing.T) {
	asignados := append([]string(nil), Lista...)
	c, ok := Elegir(asignados)
	if !ok {
		t.Fatal("con la lista agotada no genero nada")
	}
	if err := Valido(c); err != nil {
		t.Fatalf("genero un color invalido: %v", err)
	}
	for _, a := range asignados {
		if a == c {
			t.Fatalf("genero %s, que ya estaba asignado", c)
		}
	}
}

// FR-004b, sin base: treinta cuentas seguidas, treinta colores distintos y
// todos validos. Las primeras siete salen de la lista, en orden.
func TestTreintaCuentasSinRepetir(t *testing.T) {
	var asignados []string
	vistos := map[string]bool{}
	for i := 0; i < 30; i++ {
		c, ok := Elegir(asignados)
		if !ok {
			t.Fatalf("cuenta %d: no hubo color", i+1)
		}
		if vistos[c] {
			t.Fatalf("cuenta %d: %s repetido", i+1, c)
		}
		if err := Valido(c); err != nil {
			t.Fatalf("cuenta %d: %v", i+1, err)
		}
		if i < len(Lista) && c != Lista[i] {
			t.Fatalf("cuenta %d: %s; la lista decia %s", i+1, c, Lista[i])
		}
		vistos[c] = true
		asignados = append(asignados, c)
	}
}

func TestElegirEsDeterminista(t *testing.T) {
	asignados := append(append([]string(nil), Lista...), "#123456")
	a, _ := Elegir(asignados)
	b, _ := Elegir(asignados)
	if a != b {
		t.Fatalf("misma entrada, dos salidas: %s y %s", a, b)
	}
}

// Un color puesto a mano que no es hex no rompe la eleccion: se ignora para la
// distancia y el resultado sigue siendo valido.
func TestUnAsignadoMalFormadoNoRompeNada(t *testing.T) {
	asignados := append(append([]string(nil), Lista...), "cualquier cosa")
	c, ok := Elegir(asignados)
	if !ok || Valido(c) != nil {
		t.Fatalf("con un asignado mal formado: %q, %v", c, ok)
	}
}
