package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
	"github.com/Matt122133/flash-urbano/backend/internal/config"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
)

// TestSinCredencialElAvisadorEsMudoYElServicioSigue es **FR-010** en el unico
// lugar donde se decide de verdad: el cableado.
//
// Que `config.Cargar` no exija la variable no alcanza. Lo que tumba un servicio
// es que la construccion de una dependencia devuelva un error y alguien lo
// propague hasta `main`. **Los dos caminos de fallo tienen que dar un avisador
// mudo, no un error**, y el segundo es el que importa: la variable ausente es
// el caso obvio, pero una credencial vencida, pegada a medias o de otro
// proyecto es el caso que va a pasar de verdad, y meses despues, cuando nadie
// se acuerde de que este archivo decide si el sitio sigue tomando pedidos.
//
// El `pool` va en nil a proposito: los dos caminos vuelven antes de tocarlo, y
// que esto no explote lo demuestra.
func TestSinCredencialElAvisadorEsMudoYElServicioSigue(t *testing.T) {
	casos := []struct {
		nombre     string
		credencial string
	}{
		{"la variable no esta", ""},
		{"solo espacios", "   "},
		{"no es base64", "esto-no-es-base64-{}"},
		{"es base64 pero adentro no hay una credencial", "bm8tc295LXVuYS1jcmVkZW5jaWFs"},
		{"es un JSON valido que no es una credencial", "eyJob2xhIjoiY2hhdSJ9"},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			cfg := &config.Config{
				AdminEmails:         []string{"diego@example.com"},
				FCMCredencialBase64: c.credencial,
			}

			avisador := construirAvisador(context.Background(), cfg, nil)
			if _, mudo := avisador.(avisos.Mudo); !mudo {
				t.Fatalf("con %q se cablo un avisador de verdad; una credencial rota tiene que degradar, no romper", c.credencial)
			}

			// Y usarlo no puede explotar: es lo que va a correr en cada pedido.
			avisador.Avisar(context.Background(), avisos.PedidoNuevo{Codigo: "FU-0142"})
		})
	}
}

// TestElPreflightAutorizaTodosLosMetodosQueSirveElEnrutador ata las dos puntas
// que nadie mas ata: **lo que el enrutador sirve** y **lo que el preflight
// autoriza**.
//
// Es el unico control automatico de una clase de defecto que ya paso dos veces
// y que las pruebas de Go no pueden ver: llaman a los handlers directo, sin
// navegador, asi que un metodo o una cabecera que falta en el CORS las deja a
// todas en verde mientras el sitio no puede ni mandar el pedido. La primera vez
// fue `Idempotency-Key`, y mientras falto no se pudo crear un pedido desde
// ningun navegador; la segunda fueron PATCH y DELETE, los dos metodos de `022`.
//
// **Como lee la verdad del enrutador y no una lista repetida**: ServeMux
// responde 405 con la cabecera `Allow` cuando el camino existe y el metodo no,
// asi que un metodo inventado devuelve exactamente los metodos registrados para
// ese camino. Lo que no se puede enumerar son los CAMINOS —ServeMux no lo
// permite—, y por eso la lista de abajo se mantiene a mano: **al registrar una
// ruta sobre un camino nuevo hay que agregarlo aca**. Que un camino de la lista
// deje de existir tambien falla, en vez de pasar en silencio.
//
// Las dependencias van en cero: `rutas` solo toma los metodos como valores, no
// los llama, y que esto no explote lo demuestra.
func TestElPreflightAutorizaTodosLosMetodosQueSirveElEnrutador(t *testing.T) {
	mux := rutas(nil, dependencias{})

	permitidos := map[string]bool{}
	for _, m := range strings.Split(httpx.MetodosPermitidos, ",") {
		permitidos[strings.TrimSpace(m)] = true
	}

	caminos := []string{
		"/salud",
		"/auth/google",
		"/auth/codigo",
		"/auth/codigo/verificar",
		"/auth/salir",
		"/yo",
		"/pedidos",
		"/pedidos/6f1b0f1e-0000-4000-8000-000000000000",
		"/admin/pedidos",
		"/admin/pedidos/6f1b0f1e-0000-4000-8000-000000000000/estado",
		"/admin/tablero",
	}

	for _, camino := range caminos {
		t.Run(camino, func(t *testing.T) {
			r := httptest.NewRequest("METODOINVENTADO", camino, nil)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)

			allow := w.Header().Get("Allow")
			if allow == "" {
				t.Fatalf("%s no tiene ninguna ruta registrada: la lista de caminos de esta prueba quedo vieja", camino)
			}

			for _, m := range strings.Split(allow, ",") {
				m = strings.TrimSpace(m)
				if m == "" {
					continue
				}
				if !permitidos[m] {
					t.Errorf("el enrutador sirve %s %s pero el preflight no autoriza %s (httpx.MetodosPermitidos = %q):"+
						" ningun navegador va a poder llamarla", m, camino, m, httpx.MetodosPermitidos)
				}
			}
		})
	}
}

// metodosServidos devuelve los metodos que el enrutador real sirve para un
// camino, leidos de la cabecera `Allow` de un 405 — la misma tecnica que la
// prueba de arriba.
func metodosServidos(t *testing.T, camino string) []string {
	t.Helper()

	r := httptest.NewRequest("METODOINVENTADO", camino, nil)
	w := httptest.NewRecorder()
	rutas(nil, dependencias{}).ServeHTTP(w, r)

	var metodos []string
	for _, m := range strings.Split(w.Header().Get("Allow"), ",") {
		if m = strings.TrimSpace(m); m != "" {
			metodos = append(metodos, m)
		}
	}
	if len(metodos) == 0 {
		t.Fatalf("%s no tiene ninguna ruta registrada", camino)
	}
	return metodos
}

// TestElTableroEsDeSoloLectura es FR-017 de `025` sobre el enrutador REAL: el
// camino del tablero no sirve nada fuera de GET (y el HEAD que el ServeMux suma
// solo por el patron GET).
//
// **La prueba del preflight de arriba NO cubre esto**: solo exige que lo servido
// este autorizado por el CORS, y PATCH y DELETE ya lo estan. Montar un metodo de
// escritura sobre /admin/tablero la dejaria en verde.
//
// Con su control positivo: la misma lectura sobre el camino de un pedido SI
// encuentra PATCH y DELETE, asi que la tecnica sabe ver un metodo de escritura
// cuando existe.
func TestElTableroEsDeSoloLectura(t *testing.T) {
	lectura := map[string]bool{"GET": true, "HEAD": true}

	for _, m := range metodosServidos(t, "/admin/tablero") {
		if !lectura[m] {
			t.Errorf("/admin/tablero sirve %s: el tablero mira, no escribe (FR-017 de 025)", m)
		}
	}

	escritura := map[string]bool{}
	for _, m := range metodosServidos(t, "/pedidos/6f1b0f1e-0000-4000-8000-000000000000") {
		if !lectura[m] {
			escritura[m] = true
		}
	}
	if !escritura["PATCH"] || !escritura["DELETE"] {
		t.Fatalf("el control positivo fallo: /pedidos/{id} tenia que servir PATCH y DELETE, y se leyo %v", escritura)
	}
}

// 027, FR-021: /salud nombra el ambiente **en las dos respuestas**.
//
// La degradada es la que importa y la que se olvida: saber a cual de los dos
// servicios identicos se le esta pegando importa **especialmente** cuando algo
// anda mal, que es justo cuando uno mira /salud.
//
// Prueba `armarSalud` y no el handler a proposito. El handler necesita una base
// viva para llegar al camino sano, asi que una prueba que pasara por el se
// saltearia sola sin `TEST_DATABASE_URL` — y el campo habria quedado sin cubrir
// en silencio. El 2026-09-13 la linea de base tenia **136 pruebas salteadas**
// por eso mismo; esta no suma una mas.
func TestSaludNombraElAmbienteEnLasDosRespuestas(t *testing.T) {
	casos := []struct {
		nombre       string
		baseOK       bool
		quieroEstado int
		quieroBase   string
	}{
		{"base viva", true, 200, "ok"},
		{"base caida", false, 503, "sin conexion"},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			estado, cuerpo := armarSalud(caso.baseOK, "staging")

			if estado != caso.quieroEstado {
				t.Errorf("estado: quiero %d, dio %d", caso.quieroEstado, estado)
			}
			if cuerpo.Base != caso.quieroBase {
				t.Errorf("base: quiero %q, dio %q", caso.quieroBase, cuerpo.Base)
			}
			if cuerpo.Ambiente != "staging" {
				t.Errorf("ambiente: quiero %q, dio %q", "staging", cuerpo.Ambiente)
			}
		})
	}
}

// El campo viaja con la llave que el contrato promete (contracts/salud.md).
//
// Sin esto, renombrar la etiqueta de JSON pasaria en verde: las pruebas de
// arriba leen el campo de Go, no lo que sale por el cable.
func TestElCuerpoDeSaludSerializaLaLlaveAmbiente(t *testing.T) {
	_, cuerpo := armarSalud(true, config.AmbienteDesconocido)

	crudo, err := json.Marshal(cuerpo)
	if err != nil {
		t.Fatalf("no se pudo serializar: %v", err)
	}

	texto := string(crudo)
	for _, quiero := range []string{`"estado":"ok"`, `"base":"ok"`, `"ambiente":"desconocido"`} {
		if !strings.Contains(texto, quiero) {
			t.Errorf("falta %s en %s", quiero, texto)
		}
	}
}
