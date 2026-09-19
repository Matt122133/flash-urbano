package reporte

import (
	"go/scanner"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// La guarda de FR-009, FR-010 y FR-011 de `029`: una prueba que falle si este
// paquete empieza a nombrar la plata de un pedido.
//
// **Por que hace falta una guarda NUEVA y no alcanza la que ya hay.**
// `internal/tablero/sin_plata_test.go` escanea **su propio paquete** y no sabe
// que este existe; y del lado de la web, `sin-precio-a-la-vista.test.ts` mira
// `app/` y `components/` y **deja `lib/` afuera a proposito**, porque ahi el
// precio tiene que seguir viviendo. O sea que todo modulo nuevo, de los dos
// lados, **nace sin ninguna proteccion**. Es la tercera vez que este repo lo
// descubre: si pasa una cuarta, la pregunta deja de ser "agreguemos la guarda" y
// pasa a ser "por que cada modulo nuevo tiene que acordarse".
//
// **No depende de la base**: corre en cada `go test`, con o sin
// TEST_DATABASE_URL. Una guarda que se salteara sola seria justo la que nadie
// mira el dia que importa.
//
// Y trae su **control positivo**: un fuente sintetico donde la guarda TIENE que
// encontrar lo prohibido. Sin eso, una funcion que no encuentra nunca nada pasa
// todas las pruebas reales.

// plata es lo que ninguna fuente de este paquete puede nombrar.
var plata = regexp.MustCompile(`(?i)precio|monto|importe|costo`)

// nombresDePlata devuelve los identificadores y los strings del fuente que
// nombran plata.
//
// **Mira identificadores Y strings**: el nombre de una columna vive adentro de
// un string de SQL y el de un campo es un identificador; cualquiera de los dos
// alcanza para leer el dato.
//
// **Los comentarios quedan afuera, a proposito** —`scanner.Scanner` con modo 0
// no los devuelve—. Explicar por que la plata no esta es informacion util, y
// prohibirlo empujaria a borrar la explicacion junto con el codigo. Este archivo
// es la prueba: dice "precio" varias veces y no se acusa a si mismo.
func nombresDePlata(fuente []byte) []string {
	conjunto := token.NewFileSet()
	archivo := conjunto.AddFile("fuente.go", conjunto.Base(), len(fuente))

	var s scanner.Scanner
	s.Init(archivo, fuente, nil, 0)

	var hallados []string
	for {
		_, tok, literal := s.Scan()
		if tok == token.EOF {
			return hallados
		}
		if (tok == token.IDENT || tok == token.STRING) && plata.MatchString(literal) {
			hallados = append(hallados, literal)
		}
	}
}

// fuentesDelPaquete devuelve cada `.go` de este paquete que NO es de prueba.
//
// **Las de prueba quedan afuera, y este archivo es la razon**: una prueba tiene
// que poder nombrar lo prohibido para buscarlo. Lo que no puede nombrarlo es el
// codigo que corre en produccion.
func fuentesDelPaquete(t *testing.T) map[string][]byte {
	t.Helper()

	entradas, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("leyendo el paquete: %v", err)
	}

	fuentes := map[string][]byte{}
	for _, e := range entradas {
		nombre := e.Name()
		if e.IsDir() || !strings.HasSuffix(nombre, ".go") || strings.HasSuffix(nombre, "_test.go") {
			continue
		}
		contenido, err := os.ReadFile(filepath.Clean(nombre))
		if err != nil {
			t.Fatalf("leyendo %s: %v", nombre, err)
		}
		fuentes[nombre] = contenido
	}
	return fuentes
}

func TestElReporteNoNombraLaPlata(t *testing.T) {
	fuentes := fuentesDelPaquete(t)

	// Guarda contra el falso verde. Si el recorrido deja de encontrar archivos
	// —un renombre, un subdirectorio— el caso de abajo pasaria sin mirar nada.
	if len(fuentes) == 0 {
		t.Fatal("no se encontro ningun fuente del paquete: la guarda no esta mirando nada")
	}

	for nombre, fuente := range fuentes {
		if hallados := nombresDePlata(fuente); len(hallados) > 0 {
			t.Errorf("%s nombra la plata de un pedido: %v", nombre, hallados)
		}
	}
}

func TestElDetectorEncuentraLaPlataCuandoEsta(t *testing.T) {
	// EL CONTROL POSITIVO. Cuatro formas de traer el dato, y las cuatro tienen
	// que marcarse: un campo, una columna adentro de un string de SQL, una
	// variable, y una funcion de formateo —que es como `025` descubrio que una
	// guarda que solo mirara `.precio` se puede esquivar—.
	casos := map[string]string{
		"un campo":        "package x\ntype T struct{ Precio int }\n",
		"una columna SQL": "package x\nconst q = `SELECT precio FROM pedidos`\n",
		"una variable":    "package x\nvar importe = 1\n",
		"un formateador":  "package x\nfunc formatearMonto(n int) string { return \"\" }\n",
	}

	for nombre, fuente := range casos {
		t.Run(nombre, func(t *testing.T) {
			if hallados := nombresDePlata([]byte(fuente)); len(hallados) == 0 {
				t.Error("el detector no vio la plata; la guarda de arriba no guarda nada")
			}
		})
	}
}

func TestElDetectorNoCuentaUnComentario(t *testing.T) {
	// La otra mitad del control: si los comentarios contaran, la salida facil
	// seria borrar la explicacion de por que la plata no esta.
	fuente := "package x\n// aca no se lee el precio de un pedido\nvar x = 1\n"
	if hallados := nombresDePlata([]byte(fuente)); len(hallados) > 0 {
		t.Errorf("un comentario se conto como codigo: %v", hallados)
	}
}
