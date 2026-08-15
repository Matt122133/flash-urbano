package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const (
	origenPermitido = "https://matt122133.github.io"
	origenNuevo     = "https://flashurbano.uy"
	origenAjeno     = "https://sitio-de-otro.example"
)

// llego dice si el pedido atraveso el middleware.
func conCORS(origenes []string) (http.Handler, *bool) {
	llego := new(bool)
	interior := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*llego = true
		w.WriteHeader(http.StatusOK)
	})
	return CORS(origenes, interior), llego
}

// SC-008: un pedido al servicio desde un origen no autorizado es rechazado.
//
// Y rechazado DEL LADO DEL SERVIDOR, no solo omitiendo encabezados: confiar en
// que el navegador corte deja pasar a cualquier cliente que no sea un navegador.
func TestOrigenNoAutorizadoEsRechazado(t *testing.T) {
	h, llego := conCORS([]string{origenPermitido})

	req := httptest.NewRequest(http.MethodGet, "/salud", nil)
	req.Header.Set("Origin", origenAjeno)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("quiero 403, dio %d", rec.Code)
	}
	if *llego {
		t.Error("el pedido no tendria que haber llegado al handler")
	}
	if v := rec.Header().Get("Access-Control-Allow-Origin"); v != "" {
		t.Errorf("no tendria que autorizar el origen, mando %q", v)
	}
}

func TestOrigenPermitidoPasa(t *testing.T) {
	h, llego := conCORS([]string{origenPermitido})

	req := httptest.NewRequest(http.MethodGet, "/salud", nil)
	req.Header.Set("Origin", origenPermitido)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("quiero 200, dio %d", rec.Code)
	}
	if !*llego {
		t.Error("el pedido tendria que haber llegado al handler")
	}
	if v := rec.Header().Get("Access-Control-Allow-Origin"); v != origenPermitido {
		t.Errorf("Allow-Origin: quiero %q, dio %q", origenPermitido, v)
	}
}

// SC-009: cambiar el dominio del sitio se resuelve cambiando configuracion, sin
// editar codigo del servicio. Esta prueba es la que dice que eso es cierto.
func TestAgregarUnOrigenEsConfiguracion(t *testing.T) {
	// Antes de la mudanza: el dominio propio todavia no esta autorizado.
	h, _ := conCORS([]string{origenPermitido})
	req := httptest.NewRequest(http.MethodGet, "/salud", nil)
	req.Header.Set("Origin", origenNuevo)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("antes de agregarlo tendria que rechazar, dio %d", rec.Code)
	}

	// Despues: la MISMA funcion con otra lista. No cambio una linea de codigo.
	h, _ = conCORS([]string{origenPermitido, origenNuevo})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/salud", nil)
	req.Header.Set("Origin", origenNuevo)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("con el origen en la configuracion tendria que pasar, dio %d", rec.Code)
	}
}

// El preflight es lo que el navegador manda antes de una request con cabeceras
// que no son simples. Si no las autoriza, la request real NO SE MANDA — que es
// exactamente el modo de falla que el ADR predice, y el que rompio los pedidos
// hasta el 2026-08-14.
//
// La version anterior de esta prueba preguntaba solo por `authorization` y
// afirmaba que la respuesta no estaba vacia. Con eso, agregar una cabecera nueva
// al sitio y olvidarse de autorizarla la dejaba en verde: la lista seguia sin
// estar vacia. Ahora se pregunta por las cabeceras de verdad y se exige cada
// una, asi que la prueba falla cuando falta la que falto.
func TestPreflightAutorizaLasCabecerasQueElSitioManda(t *testing.T) {
	// Lo que el navegador pregunta, en minusculas porque asi las manda.
	exigidas := []string{"authorization", "content-type", "idempotency-key"}

	h, llego := conCORS([]string{origenPermitido})

	req := httptest.NewRequest(http.MethodOptions, "/pedidos", nil)
	req.Header.Set("Origin", origenPermitido)
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", strings.Join(exigidas, ", "))
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("preflight: quiero 204, dio %d", rec.Code)
	}
	if *llego {
		t.Error("el preflight no tendria que llegar al handler")
	}

	// La comparacion va en minusculas: los nombres de cabecera no distinguen
	// mayusculas y el navegador no compara el texto tal cual.
	autorizadas := strings.ToLower(rec.Header().Get("Access-Control-Allow-Headers"))
	for _, cabecera := range exigidas {
		if !strings.Contains(autorizadas, cabecera) {
			t.Errorf("el preflight no autoriza %q; autoriza %q", cabecera, autorizadas)
		}
	}
}

// El ADR eligio credencial en header y no cookie, justamente para no depender
// del manejo de cookies entre origenes. Mandar Allow-Credentials seria arrastrar
// el problema que la decision evita.
func TestNoAnunciaCredenciales(t *testing.T) {
	h, _ := conCORS([]string{origenPermitido})

	req := httptest.NewRequest(http.MethodGet, "/salud", nil)
	req.Header.Set("Origin", origenPermitido)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if v := rec.Header().Get("Access-Control-Allow-Credentials"); v != "" {
		t.Errorf("no tendria que mandar Allow-Credentials, mando %q", v)
	}
}

// Sin Vary: Origin, un cache intermedio puede servirle a un origen la respuesta
// calculada para otro, y los permisos dejan de significar nada.
func TestSiempreVariaPorOrigen(t *testing.T) {
	h, _ := conCORS([]string{origenPermitido})

	for _, origen := range []string{origenPermitido, origenAjeno, ""} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/salud", nil)
		if origen != "" {
			req.Header.Set("Origin", origen)
		}
		h.ServeHTTP(rec, req)

		if rec.Header().Get("Vary") != "Origin" {
			t.Errorf("origen %q: falta Vary: Origin", origen)
		}
	}
}

// El chequeo de salud de Railway y cualquier curl llegan sin Origin. No son
// pedidos cruzados y no hay nada que autorizar.
func TestSinOrigenPasa(t *testing.T) {
	h, llego := conCORS([]string{origenPermitido})

	req := httptest.NewRequest(http.MethodGet, "/salud", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || !*llego {
		t.Errorf("un pedido sin Origin tendria que pasar, dio %d", rec.Code)
	}
}

// El origen de la conexion es lo que hace que el limite de frecuencia por
// origen signifique algo. Detras del proxy de Railway, leerlo mal lo convierte
// en un limite global.
func TestOrigenDeLaConexion(t *testing.T) {
	casos := []struct {
		nombre     string
		forwarded  string
		remoteAddr string
		quiero     string
	}{
		{
			nombre:     "sin proxy usa RemoteAddr sin el puerto",
			remoteAddr: "203.0.113.9:51514",
			quiero:     "203.0.113.9",
		},
		{
			nombre:     "con un proxy toma lo que el proxy agrego",
			forwarded:  "203.0.113.9",
			remoteAddr: "10.0.0.1:51514",
			quiero:     "203.0.113.9",
		},
		{
			// El cliente manda su propio X-Forwarded-For para hacerse pasar por
			// otra IP y saltear el limite. Su valor queda a la IZQUIERDA; la
			// derecha es lo que agrego el proxy y no puede falsificar.
			nombre:     "un encabezado inventado por el cliente no gana",
			forwarded:  "1.2.3.4, 203.0.113.9",
			remoteAddr: "10.0.0.1:51514",
			quiero:     "203.0.113.9",
		},
		{
			nombre:     "ipv6 sin corchetes ni puerto",
			remoteAddr: "[2001:db8::1]:51514",
			quiero:     "2001:db8::1",
		},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/auth/codigo", nil)
			req.RemoteAddr = c.remoteAddr
			if c.forwarded != "" {
				req.Header.Set("X-Forwarded-For", c.forwarded)
			}

			if dio := OrigenDeLaConexion(req); dio != c.quiero {
				t.Errorf("quiero %q, dio %q", c.quiero, dio)
			}
		})
	}
}
