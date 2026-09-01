package avisos

// Prueba INTERNA a proposito: `ClienteFCM` no expone ni el endpoint ni la
// fuente del token de acceso, y no tiene por que. Quien lo usa de verdad no
// elige a que servidor le habla.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golang.org/x/oauth2"
)

// clienteContra arma un cliente apuntado a un servidor de mentira.
//
// El token de acceso es estatico: lo que se prueba aca es el mensaje y la
// lectura de la respuesta, no el intercambio OAuth, que es justamente la parte
// que se delego a `x/oauth2` para no escribirla (research D2).
func clienteContra(t *testing.T, manejar http.HandlerFunc) *ClienteFCM {
	t.Helper()

	servidor := httptest.NewServer(manejar)
	t.Cleanup(servidor.Close)

	return &ClienteFCM{
		proyecto: "flash-urbano-de-prueba",
		fuente:   oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "acceso-de-mentira"}),
		cliente:  servidor.Client(),
		base:     servidor.URL,
	}
}

var mensajeDePrueba = Mensaje{
	Titulo: "Pedido nuevo FU-0142",
	Cuerpo: "Entrega en Av. Brasil",
	Codigo: "FU-0142",
}

// TestElMensajeSaleComoDiceElContrato compara contra
// `contracts/mensaje-de-aviso.md` campo por campo.
//
// **Los tres parametros que no son texto son el feature**, y ninguno se ve en
// la pantalla: sin `HIGH` no llega con el telefono en reposo, sin el `ttl` un
// aviso de anteayer aparece como nuevo, y **con el canal mal escrito Android lo
// entrega con importancia por defecto** — no suena, no aparece encima, y no
// falla nada. Los tres se rompen en silencio, por eso se fijan aca.
func TestElMensajeSaleComoDiceElContrato(t *testing.T) {
	var visto sobre
	var ruta, autorizacion string

	cliente := clienteContra(t, func(w http.ResponseWriter, r *http.Request) {
		ruta = r.URL.Path
		autorizacion = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&visto); err != nil {
			t.Errorf("el cuerpo no era JSON: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	})

	if err := cliente.Mandar(context.Background(), "token-de-diego", mensajeDePrueba); err != nil {
		t.Fatalf("mandando: %v", err)
	}

	if quiero := "/v1/projects/flash-urbano-de-prueba/messages:send"; ruta != quiero {
		t.Errorf("le pego a %q, queria %q", ruta, quiero)
	}
	if quiero := "Bearer acceso-de-mentira"; autorizacion != quiero {
		t.Errorf("la autorizacion fue %q, queria %q", autorizacion, quiero)
	}

	m := visto.Mensaje
	if m.Token != "token-de-diego" {
		t.Errorf("el destinatario fue %q", m.Token)
	}
	if m.Notificacion.Titulo != mensajeDePrueba.Titulo || m.Notificacion.Cuerpo != mensajeDePrueba.Cuerpo {
		t.Errorf("el texto visible fue %q / %q", m.Notificacion.Titulo, m.Notificacion.Cuerpo)
	}
	if m.Datos["pedido"] != "FU-0142" {
		t.Errorf("data.pedido fue %q; sin el, tocar el aviso no abre la lista en ese pedido", m.Datos["pedido"])
	}
	if m.Android.Prioridad != "HIGH" {
		t.Errorf("la prioridad fue %q; sin HIGH no llega con el telefono en reposo", m.Android.Prioridad)
	}
	if m.Android.TTL != "86400s" {
		t.Errorf("el ttl fue %q, queria 86400s (FR-017)", m.Android.TTL)
	}
	if m.Android.Notificacion.Canal != CanalDePedidosNuevos {
		t.Errorf("el canal fue %q; si no coincide con el que registro la app, el aviso no suena y nada falla",
			m.Android.Notificacion.Canal)
	}
}

// TestUnAvisoSinCuerpoNoMandaElCampoVacio: el pedido sin calle de entrega no
// deberia existir, pero si existe, mandar `"body": ""` es distinto de no
// mandarlo. El `omitempty` esta puesto para eso.
func TestUnAvisoSinCuerpoNoMandaElCampoVacio(t *testing.T) {
	var crudo map[string]any

	cliente := clienteContra(t, func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&crudo)
		w.WriteHeader(http.StatusOK)
	})

	sinCuerpo := Mensaje{Titulo: "Pedido nuevo FU-0142", Codigo: "FU-0142"}
	if err := cliente.Mandar(context.Background(), "token", sinCuerpo); err != nil {
		t.Fatalf("mandando: %v", err)
	}

	mensaje := crudo["message"].(map[string]any)
	notificacion := mensaje["notification"].(map[string]any)
	if _, hay := notificacion["body"]; hay {
		t.Error("se mando un body vacio en vez de omitirlo")
	}
}

// TestQueRespuestasBorranElTokenYCualesNo es **la prueba mas importante de este
// archivo**, y la asimetria que fija es la razon de que exista.
//
// Borrar de menos deja un token muerto en una fila y no cuesta nada: el
// telefono ya no recibia avisos. **Borrar de mas deja a Diego mudo hasta que
// reinstale la app**, sin que nada avise.
//
// El caso peligroso no es hipotetico: `INVALID_ARGUMENT` es tambien lo que
// contesta el proveedor ante un **mensaje** mal armado, o sea ante un defecto
// nuestro. Un despliegue con el JSON torcido borraria los tokens de los dos
// telefonos en el primer pedido.
func TestQueRespuestasBorranElTokenYCualesNo(t *testing.T) {
	casos := []struct {
		nombre string
		estado int
		cuerpo string
		muerto bool
	}{
		{
			"la app se desinstalo",
			http.StatusNotFound,
			`{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}`,
			true,
		},
		{
			"el token es de otro proyecto",
			http.StatusForbidden,
			`{"error":{"status":"PERMISSION_DENIED","details":[{"errorCode":"SENDER_ID_MISMATCH"}]}}`,
			true,
		},
		{
			"el token esta mal formado y el proveedor lo nombra",
			http.StatusBadRequest,
			`{"error":{"status":"INVALID_ARGUMENT","details":[` +
				`{"errorCode":"INVALID_ARGUMENT"},` +
				`{"fieldViolations":[{"field":"message.token"}]}]}}`,
			true,
		},
		{
			// **El caso que protege a Diego de un defecto nuestro.**
			"el MENSAJE esta mal armado y el token no tiene la culpa",
			http.StatusBadRequest,
			`{"error":{"status":"INVALID_ARGUMENT","details":[` +
				`{"errorCode":"INVALID_ARGUMENT"},` +
				`{"fieldViolations":[{"field":"message.android.ttl"}]}]}}`,
			false,
		},
		{
			"el proveedor se cayo",
			http.StatusServiceUnavailable,
			`{"error":{"status":"UNAVAILABLE"}}`,
			false,
		},
		{
			"nos pasamos de cuota",
			http.StatusTooManyRequests,
			`{"error":{"status":"RESOURCE_EXHAUSTED"}}`,
			false,
		},
		{
			"la credencial no autoriza",
			http.StatusUnauthorized,
			`{"error":{"status":"UNAUTHENTICATED"}}`,
			false,
		},
		{
			"el proveedor contesto cualquier cosa",
			http.StatusBadRequest,
			`no soy json`,
			false,
		},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			cliente := clienteContra(t, func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(c.estado)
				_, _ = w.Write([]byte(c.cuerpo))
			})

			err := cliente.Mandar(context.Background(), "token", mensajeDePrueba)
			if err == nil {
				t.Fatal("una respuesta de error se leyo como exito")
			}

			siMuerto := errors.Is(err, ErrTokenMuerto)
			if siMuerto != c.muerto {
				t.Errorf("se leyo como token muerto = %v, queria %v (err: %v)", siMuerto, c.muerto, err)
			}
		})
	}
}

// TestUnFalloDeRedNoEsUnTokenMuerto cierra el caso que ni siquiera llega a
// tener respuesta.
//
// Sin red o con el proveedor caido, el telefono **sigue estando ahi**. Borrarle
// el token por esto lo dejaria mudo hasta reinstalar la app, por un corte de
// dos minutos.
func TestUnFalloDeRedNoEsUnTokenMuerto(t *testing.T) {
	servidor := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	cliente := &ClienteFCM{
		proyecto: "flash-urbano-de-prueba",
		fuente:   oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "acceso-de-mentira"}),
		cliente:  servidor.Client(),
		base:     servidor.URL,
	}
	servidor.Close() // nadie del otro lado

	err := cliente.Mandar(context.Background(), "token", mensajeDePrueba)
	if err == nil {
		t.Fatal("hablar con un servidor cerrado no dio error")
	}
	if errors.Is(err, ErrTokenMuerto) {
		t.Errorf("un fallo de red se leyo como token muerto: %v", err)
	}
}

// TestUnaCredencialQueNoEsBase64NoArrancaYNoSeFiltra.
//
// Las dos mitades importan. Que falle es lo obvio; que **el error no traiga el
// valor** es lo que evita que una credencial de service account termine escrita
// en los registros de Railway el dia que alguien la pegue mal.
func TestUnaCredencialQueNoEsBase64NoArrancaYNoSeFiltra(t *testing.T) {
	secreto := "esto-no-es-base64-valido-{}"

	_, err := NuevoClienteFCM(context.Background(), secreto)
	if err == nil {
		t.Fatal("una credencial invalida se acepto")
	}
	if strings.Contains(err.Error(), secreto) {
		t.Errorf("el error filtro la credencial: %v", err)
	}
}
