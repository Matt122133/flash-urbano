package pedidos

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// El color del cliente, de punta a punta contra la base (030).
//
// Las guardas de `respuesta_cliente_test.go` prueban los tipos. Esta prueba
// que el dato **llega**: que el LATERAL lo trae de `usuarios`, que cada pedido
// lleva el color de SU cuenta y no el de otra, y que el cambio de estado lo
// devuelve (research D7).
func TestElColorDeLaCuentaLlegaALaListaDeDiego(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)

	// Ana con color, puesto a mano como se hara con las tres cuentas reales.
	// Beto sin color, como toda cuenta anterior a `030`.
	if _, err := repo.pool.Exec(context.Background(),
		`UPDATE usuarios SET color = $2 WHERE id = $1`, ids["ana"], colorDePrueba); err != nil {
		t.Fatalf("poniendo el color de ana: %v", err)
	}
	deAna, _ := unPedidoCreado(t, srv, "tok-ana", "a1")
	deBeto, _ := unPedidoCreado(t, srv, "tok-beto", "b1")

	estado, cuerpo := pedir(t, srv, "GET", "/admin/pedidos", "tok-diego", "", "")
	if estado != http.StatusOK {
		t.Fatalf("GET /admin/pedidos: quiero 200, dio %d — %s", estado, cuerpo)
	}
	var lista struct {
		Pedidos []map[string]any `json:"pedidos"`
	}
	if err := json.Unmarshal(cuerpo, &lista); err != nil {
		t.Fatalf("leyendo la lista: %v", err)
	}
	vistos := 0
	for _, p := range lista.Pedidos {
		color, hay := p["colorCliente"]
		switch p["id"] {
		case deAna:
			vistos++
			if color != colorDePrueba {
				t.Errorf("el pedido de ana trae color %v, quiero %s", color, colorDePrueba)
			}
		case deBeto:
			vistos++
			if hay {
				t.Errorf("el pedido de beto, cuenta sin color, trae la clave: %v", color)
			}
		}
	}
	if vistos != 2 {
		t.Fatalf("la lista no trajo los dos pedidos: %s", cuerpo)
	}

	// "Lo tengo": la respuesta tiene que traer el color, o la tarjeta lo
	// pierde al reemplazarse con ella.
	estado, cuerpo = mover(t, srv, "tok-diego", deAna, EstadoAceptacion)
	if estado != http.StatusOK {
		t.Fatalf("moviendo el pedido de ana: quiero 200, dio %d — %s", estado, cuerpo)
	}
	if !strings.Contains(string(cuerpo), `"colorCliente":"`+colorDePrueba+`"`) {
		t.Fatalf("el cambio de estado no devolvio el color: %s", cuerpo)
	}
}

// FR-014 contra la base: la cuenta TIENE color y su propia lista no lo trae.
// Y de paso, que el LATERAL no rompio las consultas del cliente.
func TestElClienteNoRecibeElColorPorSuEndpoint(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)
	if _, err := repo.pool.Exec(context.Background(),
		`UPDATE usuarios SET color = $2 WHERE id = $1`, ids["ana"], colorDePrueba); err != nil {
		t.Fatalf("poniendo el color de ana: %v", err)
	}
	unPedidoCreado(t, srv, "tok-ana", "a1")

	estado, cuerpo := pedir(t, srv, "GET", "/pedidos", "tok-ana", "", "")
	if estado != http.StatusOK {
		t.Fatalf("GET /pedidos: quiero 200, dio %d — %s", estado, cuerpo)
	}
	if !strings.Contains(string(cuerpo), `"codigo"`) {
		t.Fatalf("la lista del cliente vino vacia, y la prueba no probaria nada: %s", cuerpo)
	}
	if strings.Contains(string(cuerpo), colorDePrueba) || strings.Contains(string(cuerpo), "colorCliente") {
		t.Fatalf("el cliente recibio el color por GET /pedidos: %s", cuerpo)
	}
}
