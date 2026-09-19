package tablero

import (
	"encoding/json"
	"net/http"
	"sort"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// **Lo unico que `029` agrega a este paquete, y es una prueba, no codigo.**
//
// FR-017 del reporte del mes dice que traer el reporte **no puede encarecer la
// pantalla de conteos**. La solucion fue una ruta aparte —`GET /admin/reporte`—
// en vez de engordar esta. Pero "no lo engordamos" es una promesa que nadie
// comprueba: la forma perezosa de construir el reporte es agregarle la
// direccion de entrega a cada `Carga`, y **eso no pondria en rojo ni una sola
// prueba existente**. El tablero seguiria funcionando; solo empezaria a mover el
// domicilio de todos los envios en cada visita, para un archivo que se baja una
// vez por mes.
//
// Esta prueba es la diferencia entre "no lo toco" y "puedo demostrar que no lo
// toque". Lo encontro el `/speckit-analyze` del 2026-09-19: SC-010 no tenia
// donde caer, porque **no hay forma de probar que algo no cambio sin escribir la
// prueba al lado de lo que no cambio**.
//
// Si alguna vez hay que agregarle un campo a esta respuesta a proposito, esta
// prueba se actualiza **y la conversacion ocurre**, que es el punto.

func claves(t *testing.T, crudo json.RawMessage) []string {
	t.Helper()
	var m map[string]json.RawMessage
	if err := json.Unmarshal(crudo, &m); err != nil {
		t.Fatalf("no es un objeto JSON: %v", err)
	}
	var ks []string
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)
	return ks
}

func TestLaFormaDeLaRespuestaDelTableroNoCambio(t *testing.T) {
	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test", "Cliente")
	e.unPedido(t, cuenta, "k1", 2, "2026-09-10T12:00:00Z")

	srv := monta(t, NuevosHandlers(e.repo, soloDiego), map[string]*usuarios.Usuario{
		"tok": {ID: "u-admin", Email: correoAdmin},
	})

	estado, cuerpo := pedirTablero(t, srv, "tok")
	if estado != http.StatusOK {
		t.Fatalf("respondio %d: %s", estado, cuerpo)
	}

	var raiz map[string]json.RawMessage
	if err := json.Unmarshal(cuerpo, &raiz); err != nil {
		t.Fatalf("el cuerpo no es JSON: %v", err)
	}
	if got := claves(t, cuerpo); len(got) != 2 || got[0] != "clientes" || got[1] != "pedidos" {
		t.Errorf("la respuesta tiene las claves %v, queria [clientes pedidos]", got)
	}

	var cargas []json.RawMessage
	if err := json.Unmarshal(raiz["pedidos"], &cargas); err != nil {
		t.Fatalf("`pedidos` no es una lista: %v", err)
	}
	// Contra el falso verde: sin cargas no hay donde aparecer un campo de mas.
	if len(cargas) == 0 {
		t.Fatal("no vino ninguna carga: la guarda no esta mirando nada")
	}

	// **Las tres de siempre, y ni una mas.** Si aparece `entrega`, `direccion` o
	// cualquier cosa del reporte, el tablero se encarecio.
	got := claves(t, cargas[0])
	quiero := []string{"cantidad", "clienteId", "creadoEn"}
	if len(got) != len(quiero) {
		t.Fatalf("una carga tiene los campos %v, queria %v", got, quiero)
	}
	for i := range got {
		if got[i] != quiero[i] {
			t.Fatalf("una carga tiene los campos %v, queria %v", got, quiero)
		}
	}
}

func TestElDetectorDeCamposDeMasFunciona(t *testing.T) {
	// EL CONTROL POSITIVO: si `claves` no supiera leer un objeto, la prueba de
	// arriba pasaria sin mirar nada.
	got := claves(t, json.RawMessage(`{"creadoEn":"x","cantidad":1,"clienteId":"c","entrega":{}}`))
	if len(got) != 4 {
		t.Errorf("el detector vio %v; tenia que ver los cuatro campos", got)
	}
}
