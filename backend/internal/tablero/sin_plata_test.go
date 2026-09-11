package tablero

import (
	"encoding/json"
	"go/parser"
	"go/scanner"
	"go/token"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Las guardas de FR-014 de `025`: una prueba que falle si el tablero empieza a
// leer la plata de un pedido. Ver specs/025-dashboard-de-diego/research.md D9.
//
// **No dependen de la base**: corren en cada `go test`, con o sin
// TEST_DATABASE_URL. Una guarda que se saltara sola seria justo la que nadie
// mira el dia que importa.
//
// Cada una trae su control positivo —un fuente sintetico donde la guarda TIENE
// que encontrar lo prohibido—, porque en este repo ya paso que una guarda
// negativa pasara en verde con la implementacion rota (`023`). Sin el control,
// una funcion que no encuentra nunca nada pasa todas las pruebas reales.

// plata es lo que ninguna fuente de este paquete puede nombrar.
var plata = regexp.MustCompile(`(?i)precio|monto|importe|costo`)

// nombresDePlata devuelve los identificadores y los strings del fuente que
// nombran plata.
//
// **Mira identificadores Y strings**: el nombre de una columna vive adentro de un
// string de SQL, y el de un campo es un identificador. Cualquiera de los dos
// alcanza para leer el dato.
//
// **Los comentarios quedan afuera, a proposito** —`scanner.Scanner` con modo 0
// no los devuelve—. Explicar por que la plata no esta es informacion util, y
// prohibirlo empujaria a borrar la explicacion junto con el codigo. Es el mismo
// criterio que la guarda de `013` en la web.
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

// importaPedidos dice si el fuente importa `internal/pedidos`, que es donde vive
// el tipo con el campo de la plata (research D2).
func importaPedidos(t *testing.T, fuente []byte) bool {
	t.Helper()

	f, err := parser.ParseFile(token.NewFileSet(), "fuente.go", fuente, parser.ImportsOnly)
	if err != nil {
		t.Fatalf("leyendo los imports: %v", err)
	}
	for _, imp := range f.Imports {
		ruta, err := strconv.Unquote(imp.Path.Value)
		if err != nil {
			t.Fatalf("import mal formado %s: %v", imp.Path.Value, err)
		}
		if strings.HasSuffix(ruta, "/internal/pedidos") {
			return true
		}
	}
	return false
}

// fuentesDelPaquete devuelve el contenido de cada `.go` de este paquete que NO
// es de prueba, por nombre.
//
// **Las de prueba quedan afuera, y esta misma es la razon**: una prueba tiene que
// poder nombrar lo prohibido para buscarlo, y `tablero_test.go` importa
// `pedidos` para crear pedidos de verdad. Lo que no puede nombrarlo es el codigo
// que corre en produccion.
//
// `go test` corre con el directorio del paquete como directorio de trabajo, asi
// que "." es este paquete y no otro.
func fuentesDelPaquete(t *testing.T) map[string][]byte {
	t.Helper()

	entradas, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("leyendo el directorio del paquete: %v", err)
	}

	fuentes := map[string][]byte{}
	for _, e := range entradas {
		nombre := e.Name()
		if e.IsDir() || !strings.HasSuffix(nombre, ".go") || strings.HasSuffix(nombre, "_test.go") {
			continue
		}
		contenido, err := os.ReadFile(nombre)
		if err != nil {
			t.Fatalf("leyendo %s: %v", nombre, err)
		}
		fuentes[nombre] = contenido
	}

	// **Guarda contra el falso verde.** Si el recorrido no encuentra nada —un
	// directorio de trabajo distinto, un filtro mal escrito— las dos pruebas de
	// abajo pasarian sin haber mirado un solo archivo.
	if len(fuentes) == 0 {
		t.Fatal("no se encontro ningun .go de produccion en el paquete: la guarda no esta mirando nada")
	}
	return fuentes
}

// --- Controles positivos: la guarda sabe ver lo que busca ---------------------

func TestLaGuardaDePlataVeUnaColumnaYUnCampo(t *testing.T) {
	fuente := []byte(`package x

const q = "SELECT creado_en, precio FROM pedidos"

type fila struct {
	Precio int
}
`)
	hallados := nombresDePlata(fuente)
	if len(hallados) != 2 {
		t.Fatalf("tenia que encontrar la columna en el SQL y el campo, y encontro %d: %q", len(hallados), hallados)
	}
}

func TestLaGuardaDePlataNoMiraLosComentarios(t *testing.T) {
	fuente := []byte(`package x

// el precio no se lee, y este comentario puede decirlo
/* tampoco el monto */
var cantidad = 1
`)
	if hallados := nombresDePlata(fuente); len(hallados) != 0 {
		t.Fatalf("un comentario no es codigo, y la guarda lo conto: %q", hallados)
	}
}

func TestLaGuardaDeImportsVeElDePedidos(t *testing.T) {
	con := []byte(`package x

import _ "github.com/Matt122133/flash-urbano/backend/internal/pedidos"
`)
	if !importaPedidos(t, con) {
		t.Fatal("un fuente que importa internal/pedidos no fue detectado")
	}

	sin := []byte(`package x

import _ "github.com/Matt122133/flash-urbano/backend/internal/usuarios"
`)
	if importaPedidos(t, sin) {
		t.Fatal("un import de otro paquete se tomo por el de pedidos")
	}
}

// clavesDe devuelve todas las claves de un JSON, a cualquier profundidad.
func clavesDe(t *testing.T, crudo []byte) []string {
	t.Helper()

	var valor any
	if err := json.Unmarshal(crudo, &valor); err != nil {
		t.Fatalf("no es JSON: %v (%s)", err, crudo)
	}

	var claves []string
	var recorrer func(v any)
	recorrer = func(v any) {
		switch x := v.(type) {
		case map[string]any:
			for k, hijo := range x {
				claves = append(claves, k)
				recorrer(hijo)
			}
		case []any:
			for _, hijo := range x {
				recorrer(hijo)
			}
		}
	}
	recorrer(valor)
	return claves
}

func TestLaGuardaDeClavesVeUnCampoDePlata(t *testing.T) {
	claves := clavesDe(t, []byte(`{"pedidos":[{"cantidad":1,"precio":150}]}`))
	hallada := false
	for _, k := range claves {
		if plata.MatchString(k) {
			hallada = true
		}
	}
	if !hallada {
		t.Fatalf("una clave de plata anidada en una lista no fue detectada: %q", claves)
	}
}

// --- Las guardas reales -------------------------------------------------------

// TestLaRespuestaNoTieneDondeLlevarPlata es la guarda sobre lo que VIAJA (D9):
// la respuesta, serializada con datos de verdad, no tiene ninguna clave que
// nombre plata. Hoy el tipo no tiene el campo; esta prueba es la afirmacion de
// que sigue sin tenerlo.
func TestLaRespuestaNoTieneDondeLlevarPlata(t *testing.T) {
	nombre := "Ana Perez"
	crudo, err := json.Marshal(respuesta{
		Pedidos: []Carga{{
			CreadoEn:  time.Date(2026, 9, 11, 1, 30, 0, 0, time.UTC),
			Cantidad:  2,
			ClienteID: "00000000-0000-4000-8000-000000000001",
		}},
		Clientes: []Cliente{{ID: "00000000-0000-4000-8000-000000000001", Nombre: &nombre, Email: "ana@example.com"}},
	})
	if err != nil {
		t.Fatalf("serializando: %v", err)
	}

	claves := clavesDe(t, crudo)
	if len(claves) == 0 {
		t.Fatal("la respuesta no tiene ninguna clave: la guarda no esta mirando nada")
	}
	for _, k := range claves {
		if plata.MatchString(k) {
			t.Errorf("la respuesta del tablero tiene una clave de plata, %q: %s", k, crudo)
		}
	}
}

// TestElTableroNoNombraLaPlata es FR-013 y FR-014 sobre la consulta: ningun
// identificador ni string de este paquete nombra la plata.
func TestElTableroNoNombraLaPlata(t *testing.T) {
	for nombre, fuente := range fuentesDelPaquete(t) {
		if hallados := nombresDePlata(fuente); len(hallados) > 0 {
			t.Errorf("%s nombra la plata de un pedido: %q.\n"+
				"El tablero cuenta; no lee la columna `precio` ni el campo que la trae "+
				"(Principio V, FR-013 de 025). Si hace falta mostrar plata, eso es una "+
				"enmienda MAYOR a la constitucion, no un cambio aca.", nombre, hallados)
		}
	}
}

// TestElTableroNoImportaPedidos es la otra mitad: sin el import, no hay tipo que
// traiga el campo de la plata (research D2).
func TestElTableroNoImportaPedidos(t *testing.T) {
	for nombre, fuente := range fuentesDelPaquete(t) {
		if importaPedidos(t, fuente) {
			t.Errorf("%s importa internal/pedidos. El tablero lee la tabla con su propia "+
				"consulta a proposito: alla vive el campo con la plata de cada pedido. "+
				"Ver el comentario del paquete y research D2 de 025.", nombre)
		}
	}
}
