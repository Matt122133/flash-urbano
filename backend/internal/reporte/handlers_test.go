package reporte

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

const correoAdmin = "diego@example.com"

func soloDiego(email string) bool { return email == correoAdmin }

// monta sirve el handler como main.go: detras de httpx.ConSesion, resolviendo
// credenciales contra un mapa. Mismo molde que internal/tablero.
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
	mux.Handle("GET /admin/reporte", httpx.ConSesion(resolver, http.HandlerFunc(h.Ver)))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func pedirReporte(t *testing.T, srv *httptest.Server, token string, params map[string]string) (int, []byte) {
	t.Helper()

	q := url.Values{}
	for k, v := range params {
		q.Set(k, v)
	}
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/admin/reporte?"+q.Encode(), nil)
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

// entornoHTTP arma el servidor con la base de verdad detras y una cuenta con
// envios, para poder afirmar que un 403 **no lleva ni un dato**.
func entornoHTTP(t *testing.T) (*httptest.Server, string, map[string]*usuarios.Usuario) {
	t.Helper()

	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test")
	e.unPedido(t, cuenta, "k1", "2026-09-10", 2, true)

	credenciales := map[string]*usuarios.Usuario{
		"tok-admin": {ID: "u-admin", Email: correoAdmin},
		"tok-otro":  {ID: "u-otro", Email: "alguien@example.com"},
	}
	return monta(t, NuevosHandlers(e.repo, soloDiego), credenciales), cuenta, credenciales
}

// **FR-018 y SC-009.** Lo encontro el analyze: el handler decia que responde 403
// y no habia una sola prueba que lo comprobara, en el feature que expone
// direcciones de clientes.
func TestSoloUnAdministradorObtieneElReporte(t *testing.T) {
	srv, cuenta, _ := entornoHTTP(t)
	params := map[string]string{"cliente": cuenta, "desde": "2026-09-01", "hasta": "2026-09-30"}

	estado, cuerpo := pedirReporte(t, srv, "tok-otro", params)
	if estado != http.StatusForbidden {
		t.Errorf("una cuenta que no es administradora recibio %d, queria 403", estado)
	}
	// El 403 no puede llevar un solo dato: ni un codigo, ni una direccion.
	if strings.Contains(string(cuerpo), "Rivera") || strings.Contains(string(cuerpo), "FU-") {
		t.Errorf("el 403 se llevo datos puestos: %s", cuerpo)
	}

	// EL CONTROL POSITIVO, y no es opcional: sin esto la prueba de arriba
	// pasaria igual con un handler que le responde 403 a todo el mundo, y nadie
	// se enteraria hasta que Diego no pudiera bajar su reporte.
	estado, cuerpo = pedirReporte(t, srv, "tok-admin", params)
	if estado != http.StatusOK {
		t.Fatalf("el administrador recibio %d, queria 200: %s", estado, cuerpo)
	}
	if !strings.Contains(string(cuerpo), "Rivera") {
		t.Errorf("el administrador no recibio los envios: %s", cuerpo)
	}
}

// **FR-006, en el borde del servicio.** Sin `cliente` no hay "todos": no existe
// request que produzca un archivo con dos cuentas mezcladas.
func TestSinClienteNoDevuelveNadaDeNadie(t *testing.T) {
	srv, cuenta, _ := entornoHTTP(t)

	estado, cuerpo := pedirReporte(t, srv, "tok-admin",
		map[string]string{"desde": "2026-09-01", "hasta": "2026-09-30"})

	if estado != http.StatusBadRequest {
		t.Errorf("sin cliente el endpoint respondio %d, queria 400 — nunca 'todos'", estado)
	}
	if strings.Contains(string(cuerpo), "Rivera") {
		t.Errorf("sin cliente se filtraron envios: %s", cuerpo)
	}

	// EL CONTROL POSITIVO: con cliente si hay envios. Sin esto, un handler que
	// devolviera 400 siempre pasaria la afirmacion de arriba.
	estado, cuerpo = pedirReporte(t, srv, "tok-admin",
		map[string]string{"cliente": cuenta, "desde": "2026-09-01", "hasta": "2026-09-30"})
	if estado != http.StatusOK || !strings.Contains(string(cuerpo), "Rivera") {
		t.Fatalf("con cliente respondio %d: %s — la prueba de arriba no probaba nada", estado, cuerpo)
	}
}

func TestUnPeriodoMalArmadoEsUnError(t *testing.T) {
	srv, cuenta, _ := entornoHTTP(t)

	casos := map[string]map[string]string{
		"sin fechas":       {"cliente": cuenta},
		"fecha con basura": {"cliente": cuenta, "desde": "ayer", "hasta": "2026-09-30"},
		"invertido":        {"cliente": cuenta, "desde": "2026-09-30", "hasta": "2026-09-01"},
	}
	for nombre, params := range casos {
		t.Run(nombre, func(t *testing.T) {
			// El invertido importa mas de lo que parece: sin la guarda devuelve
			// una lista vacia, que se lee como "este cliente no tuvo envios".
			// Un cero falso es peor que un error visible.
			if estado, cuerpo := pedirReporte(t, srv, "tok-admin", params); estado != http.StatusBadRequest {
				t.Errorf("respondio %d, queria 400: %s", estado, cuerpo)
			}
		})
	}
}

// **FR-009 sobre lo que VIAJA, no sobre el struct.** Un campo con `json:"-"`
// existiria en Go y no en el JSON; lo que hay que mirar es el cuerpo.
func TestElJsonDelReporteNoLlevaPlata(t *testing.T) {
	srv, cuenta, _ := entornoHTTP(t)

	estado, cuerpo := pedirReporte(t, srv, "tok-admin",
		map[string]string{"cliente": cuenta, "desde": "2026-09-01", "hasta": "2026-09-30"})
	if estado != http.StatusOK {
		t.Fatalf("respondio %d: %s", estado, cuerpo)
	}

	// Guarda contra el falso verde: si no vino ningun envio, no hay donde
	// aparecer un importe y la afirmacion no vale nada.
	var cuerpoLeido respuesta
	if err := json.Unmarshal(cuerpo, &cuerpoLeido); err != nil {
		t.Fatalf("el cuerpo no es JSON: %v", err)
	}
	if len(cuerpoLeido.Pedidos) == 0 {
		t.Fatal("no vino ningun envio: la guarda no esta mirando nada")
	}

	if plata.Match(cuerpo) {
		t.Errorf("el JSON del reporte nombra la plata: %s", cuerpo)
	}

	// EL CONTROL POSITIVO del detector sobre un cuerpo, no sobre un fuente.
	if !plata.Match([]byte(`{"pedidos":[{"codigo":"FU-1","precio":350}]}`)) {
		t.Error("el detector no ve un importe en un cuerpo; la guarda de arriba no guarda nada")
	}
	// Y que no se cuele por una grafia distinta.
	if !regexp.MustCompile(`(?i)total`).Match([]byte(`{"total":1}`)) {
		t.Error("control del control")
	}
}
