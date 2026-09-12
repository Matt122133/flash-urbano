package tablero

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

const correoAdmin = "diego@example.com"

// soloDiego es el predicado de administrador de estas pruebas: una sola
// direccion, como ADMIN_EMAILS con un solo mail.
func soloDiego(email string) bool { return email == correoAdmin }

// monta sirve los handlers como main.go: detras de httpx.ConSesion, resolviendo
// credenciales contra un mapa.
//
// El token desconocido devuelve httpx.ErrSesionInvalida y no un error
// cualquiera: `ConSesion` distingue "esta credencial no sirve" (401) de "la
// base fallo" (500), y un doble que devuelva otro error prueba el camino
// equivocado. Mismo criterio que internal/pedidos/handlers_test.go.
func monta(t *testing.T, h *Handlers, credenciales map[string]*usuarios.Usuario) *httptest.Server {
	t.Helper()

	resolver := func(_ context.Context, token string) (*usuarios.Usuario, error) {
		u, hay := credenciales[token]
		if !hay {
			return nil, httpx.ErrSesionInvalida
		}
		return u, nil
	}

	mux := http.NewServeMux()
	mux.Handle("GET /admin/tablero", httpx.ConSesion(resolver, http.HandlerFunc(h.Ver)))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func pedirTablero(t *testing.T, srv *httptest.Server, token string) (int, []byte) {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, srv.URL+"/admin/tablero", nil)
	if err != nil {
		t.Fatalf("armando el pedido: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("haciendo el pedido: %v", err)
	}
	defer res.Body.Close()

	crudo, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("leyendo la respuesta: %v", err)
	}
	return res.StatusCode, crudo
}

// credencialesDePrueba: la de Diego y la de una cuenta comun. Las cuentas no
// necesitan existir en la base para que el middleware las resuelva: el resolver
// es un mapa.
func credencialesDePrueba() map[string]*usuarios.Usuario {
	return map[string]*usuarios.Usuario{
		"admin": {ID: "00000000-0000-4000-8000-000000000001", Email: correoAdmin},
		"comun": {ID: "00000000-0000-4000-8000-000000000002", Email: "ana@example.com"},
	}
}

// --- Sin base: corren siempre --------------------------------------------------

func TestSinCredencialEs401(t *testing.T) {
	srv := monta(t, NuevosHandlers(nil, soloDiego), credencialesDePrueba())

	if estado, cuerpo := pedirTablero(t, srv, ""); estado != http.StatusUnauthorized {
		t.Fatalf("sin credencial tenia que ser 401, y fue %d: %s", estado, cuerpo)
	}
	if estado, cuerpo := pedirTablero(t, srv, "una-que-no-existe"); estado != http.StatusUnauthorized {
		t.Fatalf("con una credencial que no sirve tenia que ser 401, y fue %d: %s", estado, cuerpo)
	}
}

// TestEl403NoTocaLaBase: **el repositorio es nil a proposito**. Si el handler
// leyera la base antes de negar —y con eso pudiera filtrar algo en la
// respuesta—, esta prueba entraria en panico en vez de pasar. Es la forma
// barata de afirmar el "antes de tocar la base" del handler (SC-004).
func TestEl403NoTocaLaBase(t *testing.T) {
	srv := monta(t, NuevosHandlers(nil, soloDiego), credencialesDePrueba())

	estado, cuerpo := pedirTablero(t, srv, "comun")
	if estado != http.StatusForbidden {
		t.Fatalf("una cuenta comun tenia que recibir 403, y recibio %d: %s", estado, cuerpo)
	}
}

// TestSinPredicadoNadieEsAdministrador: el default de NuevosHandlers con nil es
// el seguro. El contrario —que todos lo sean— es el que no se perdona.
func TestSinPredicadoNadieEsAdministrador(t *testing.T) {
	srv := monta(t, NuevosHandlers(nil, nil), credencialesDePrueba())

	if estado, cuerpo := pedirTablero(t, srv, "admin"); estado != http.StatusForbidden {
		t.Fatalf("sin predicado de administrador, nadie tenia que pasar; paso con %d: %s", estado, cuerpo)
	}
}

// --- Contra Postgres ---------------------------------------------------------

// TestUnaCuentaComunNoObtieneNingunDato es SC-004 con la base llena: el 403 es
// exactamente el cuerpo de error, sin un conteo, sin un mail, sin las listas.
//
// **Con su control positivo en la misma prueba**: con la misma base, la cuenta
// administradora SI recibe esos datos. Sin eso, un handler que no devolviera
// nada a nadie pasaria la mitad negativa en verde.
func TestUnaCuentaComunNoObtieneNingunDato(t *testing.T) {
	e := entornoDePrueba(t)

	ana := e.unaCuenta(t, "ana@example.com", "Ana Perez")
	e.unaCuenta(t, "beto@example.com", "Beto Rodriguez")
	e.unPedido(t, ana, "a1", 2, "2026-09-10T12:00:00Z")

	srv := monta(t, NuevosHandlers(e.repo, soloDiego), credencialesDePrueba())

	estado, cuerpo := pedirTablero(t, srv, "comun")
	if estado != http.StatusForbidden {
		t.Fatalf("una cuenta comun tenia que recibir 403, y recibio %d: %s", estado, cuerpo)
	}
	var errorCuerpo map[string]any
	if err := json.Unmarshal(cuerpo, &errorCuerpo); err != nil {
		t.Fatalf("el 403 no es JSON: %v (%s)", err, cuerpo)
	}
	if len(errorCuerpo) != 1 || errorCuerpo["error"] != "no autorizado" {
		t.Fatalf(`el 403 tenia que ser exactamente {"error":"no autorizado"}, y fue %s`, cuerpo)
	}
	for _, prohibido := range []string{"beto@example.com", "ana@example.com", `"pedidos"`, `"clientes"`} {
		if strings.Contains(string(cuerpo), prohibido) {
			t.Errorf("el 403 filtro %s: %s", prohibido, cuerpo)
		}
	}

	// El control positivo.
	estado, cuerpo = pedirTablero(t, srv, "admin")
	if estado != http.StatusOK {
		t.Fatalf("la cuenta administradora tenia que recibir 200, y recibio %d: %s", estado, cuerpo)
	}
	for _, esperado := range []string{"beto@example.com", "ana@example.com", `"pedidos"`, `"clientes"`, `"cantidad":2`} {
		if !strings.Contains(string(cuerpo), esperado) {
			t.Errorf("la respuesta del administrador no trajo %s: %s", esperado, cuerpo)
		}
	}
}

// TestConLaBaseVaciaLasListasSonVacias: se afirma sobre el JSON CRUDO y no sobre
// el struct, porque lo que importa es lo que lee la web: `[]`, nunca `null`
// (contrato §1).
func TestConLaBaseVaciaLasListasSonVacias(t *testing.T) {
	e := entornoDePrueba(t)
	srv := monta(t, NuevosHandlers(e.repo, soloDiego), credencialesDePrueba())

	estado, cuerpo := pedirTablero(t, srv, "admin")
	if estado != http.StatusOK {
		t.Fatalf("tenia que ser 200, y fue %d: %s", estado, cuerpo)
	}

	var crudo map[string]json.RawMessage
	if err := json.Unmarshal(cuerpo, &crudo); err != nil {
		t.Fatalf("la respuesta no es JSON: %v (%s)", err, cuerpo)
	}
	for _, clave := range []string{"pedidos", "clientes"} {
		if got := strings.TrimSpace(string(crudo[clave])); got != "[]" {
			t.Errorf("con la base vacia %q tenia que ser [], y fue %s", clave, got)
		}
	}
}
