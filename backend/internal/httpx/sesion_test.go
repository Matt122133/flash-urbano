package httpx

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// El usuario de estas pruebas es un tipo cualquiera: lo que se verifica es el
// middleware, no quien viaja adentro.
type usuarioFalso struct{ ID string }

// resolvedor arma un resolvedor que responde siempre lo mismo, y cuenta si lo
// llamaron. Que NO lo llamen es parte de lo que se prueba: un pedido sin header
// no tiene por que llegar a tocar la base.
func resolvedor(u *usuarioFalso, err error, llamadas *int) func(context.Context, string) (*usuarioFalso, error) {
	return func(context.Context, string) (*usuarioFalso, error) {
		*llamadas++
		return u, err
	}
}

// siguienteQueMarca devuelve un handler que anota si lo ejecutaron y con que
// usuario en el contexto.
func siguienteQueMarca(ejecutado *bool, visto **usuarioFalso) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*ejecutado = true
		if u, hay := UsuarioDe[*usuarioFalso](r.Context()); hay {
			*visto = u
		}
		w.WriteHeader(http.StatusOK)
	})
}

func TestSinCredencialNoSePasaYNoSeConsultaLaBase(t *testing.T) {
	casos := []struct {
		nombre string
		header string
	}{
		{"sin header", ""},
		{"header vacio con esquema", "Bearer"},
		{"token vacio", "Bearer "},
		{"otro esquema", "Basic dXN1YXJpbzpjbGF2ZQ=="},
		{"token pelado sin esquema", "abc123"},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			llamadas := 0
			ejecutado := false
			var visto *usuarioFalso

			h := ConSesion(
				resolvedor(&usuarioFalso{ID: "no-deberia-usarse"}, nil, &llamadas),
				siguienteQueMarca(&ejecutado, &visto),
			)

			req := httptest.NewRequest(http.MethodGet, "/yo", nil)
			if caso.header != "" {
				req.Header.Set("Authorization", caso.header)
			}
			res := httptest.NewRecorder()
			h.ServeHTTP(res, req)

			if res.Code != http.StatusUnauthorized {
				t.Errorf("estado %d, se esperaba 401", res.Code)
			}
			if ejecutado {
				t.Error("el handler protegido se ejecuto sin credencial")
			}
			// Sin token no hay nada que resolver: consultar la base seria
			// trabajo regalado a cualquiera que mande pedidos sin header.
			if llamadas != 0 {
				t.Errorf("se consulto la base %d veces sin credencial", llamadas)
			}
		})
	}
}

// El esquema es insensible a mayusculas por RFC 7235, y algun cliente manda
// "bearer". Rechazarlo seria un fallo de interoperabilidad que se manifiesta
// como "no puedo entrar" y cuesta horas de encontrar.
func TestElEsquemaNoDistingueMayusculas(t *testing.T) {
	for _, header := range []string{"Bearer t0ken", "bearer t0ken", "BEARER t0ken"} {
		llamadas := 0
		ejecutado := false
		var visto *usuarioFalso

		h := ConSesion(
			resolvedor(&usuarioFalso{ID: "u1"}, nil, &llamadas),
			siguienteQueMarca(&ejecutado, &visto),
		)

		req := httptest.NewRequest(http.MethodGet, "/yo", nil)
		req.Header.Set("Authorization", header)
		res := httptest.NewRecorder()
		h.ServeHTTP(res, req)

		if res.Code != http.StatusOK {
			t.Errorf("%q: estado %d, se esperaba 200", header, res.Code)
		}
		if !ejecutado {
			t.Errorf("%q: no se ejecuto el handler protegido", header)
		}
	}
}

// Una credencial que no sirve es 401, y el handler no corre.
func TestUnaCredencialInvalidaEs401(t *testing.T) {
	llamadas := 0
	ejecutado := false
	var visto *usuarioFalso

	h := ConSesion(
		resolvedor(nil, ErrSesionInvalida, &llamadas),
		siguienteQueMarca(&ejecutado, &visto),
	)

	req := httptest.NewRequest(http.MethodGet, "/yo", nil)
	req.Header.Set("Authorization", "Bearer vencido-o-revocado")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Errorf("estado %d, se esperaba 401", res.Code)
	}
	if ejecutado {
		t.Error("el handler protegido se ejecuto con una credencial invalida")
	}
}

// Un fallo de base **no** es 401, y la distincion no es cosmetica: el sitio
// borra la credencial cuando recibe 401. Si un Postgres caido se reportara como
// 401, cada cliente identificado perderia su sesion en el peor momento posible,
// y reingresar no lo arreglaria porque el ingreso toca la misma base.
func TestUnFalloDeBaseNoEchaAlUsuario(t *testing.T) {
	llamadas := 0
	ejecutado := false
	var visto *usuarioFalso

	h := ConSesion(
		resolvedor(nil, errors.New("la base no responde"), &llamadas),
		siguienteQueMarca(&ejecutado, &visto),
	)

	req := httptest.NewRequest(http.MethodGet, "/yo", nil)
	req.Header.Set("Authorization", "Bearer un-token-que-podria-servir")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusInternalServerError {
		t.Errorf("estado %d, se esperaba 500: un fallo de base no puede leerse como credencial invalida", res.Code)
	}
	if ejecutado {
		t.Error("el handler protegido se ejecuto con la base caida")
	}
}

// El camino feliz: el usuario llega al handler, con su tipo, desde el contexto.
func TestElUsuarioLlegaAlHandlerDesdeElContexto(t *testing.T) {
	llamadas := 0
	ejecutado := false
	var visto *usuarioFalso
	esperado := &usuarioFalso{ID: "el-de-la-credencial"}

	h := ConSesion(
		resolvedor(esperado, nil, &llamadas),
		siguienteQueMarca(&ejecutado, &visto),
	)

	req := httptest.NewRequest(http.MethodGet, "/yo", nil)
	req.Header.Set("Authorization", "Bearer token-valido")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("estado %d, se esperaba 200", res.Code)
	}
	if !ejecutado {
		t.Fatal("no se ejecuto el handler protegido")
	}
	if visto == nil || visto.ID != esperado.ID {
		t.Errorf("el handler vio %v, se esperaba %v", visto, esperado)
	}
	if llamadas != 1 {
		t.Errorf("se resolvio la credencial %d veces, se esperaba 1", llamadas)
	}
}

// Sin middleware no hay usuario en el contexto, y UsuarioDe lo dice en vez de
// devolver algo que parezca valido.
func TestSinMiddlewareNoHayUsuarioEnElContexto(t *testing.T) {
	if u, hay := UsuarioDe[*usuarioFalso](context.Background()); hay {
		t.Errorf("aparecio un usuario donde no habia sesion: %v", u)
	}
}

// Un ErrSesionInvalida **envuelto** sigue siendo 401, y con la misma respuesta
// que el desnudo.
//
// Importa porque el paquete auth va a envolver su error con contexto —"sesion
// invalida: token vencido"— y la comprobacion es `errors.Is`, no `==`. Si
// alguien la cambiara por una comparacion directa, cada credencial vencida
// pasaria a devolver 500: el cliente vería "no pudimos procesar el pedido" en
// vez de que se le ofrezca reingresar, y el sitio no descartaria la credencial
// muerta. Y las dos respuestas tienen que ser identicas byte a byte, porque
// distinguirlas le diria a quien prueba credenciales cual intento estuvo cerca.
func TestUnErrorEnvueltoSigueSiendo401(t *testing.T) {
	respuestas := make([]*httptest.ResponseRecorder, 0, 2)

	for _, err := range []error{
		ErrSesionInvalida,
		fmt.Errorf("resolviendo la credencial: %w", ErrSesionInvalida),
	} {
		llamadas := 0
		ejecutado := false
		var visto *usuarioFalso

		h := ConSesion(
			resolvedor(nil, err, &llamadas),
			siguienteQueMarca(&ejecutado, &visto),
		)

		req := httptest.NewRequest(http.MethodGet, "/yo", nil)
		req.Header.Set("Authorization", "Bearer x")
		res := httptest.NewRecorder()
		h.ServeHTTP(res, req)

		if res.Code != http.StatusUnauthorized {
			t.Errorf("con %v: estado %d, se esperaba 401", err, res.Code)
		}
		if ejecutado {
			t.Errorf("con %v: se ejecuto el handler protegido", err)
		}
		respuestas = append(respuestas, res)
	}

	if respuestas[0].Body.String() != respuestas[1].Body.String() {
		t.Errorf("las respuestas difieren: %q vs %q",
			respuestas[0].Body.String(), respuestas[1].Body.String())
	}
	if respuestas[0].Body.String() == "" {
		t.Error("el 401 no trajo cuerpo")
	}
}
