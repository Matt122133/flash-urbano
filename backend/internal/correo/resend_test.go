package correo

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestElRemitenteLlevaNombreParaMostrar cubre lo que se vio en una bandeja real
// el 2026-08-11: sin nombre, Gmail muestra "info" —el trozo anterior al arroba—
// que no le dice nada a quien lo recibe.
func TestElRemitenteLlevaNombreParaMostrar(t *testing.T) {
	casos := []struct {
		nombre      string
		configurado string
		quiero      string
	}{
		{
			nombre:      "direccion pelada: se le agrega la marca",
			configurado: "info@send.flashurbano.uy",
			quiero:      "Flash Urbano <info@send.flashurbano.uy>",
		},
		{
			nombre:      "con espacios de mas",
			configurado: "  info@send.flashurbano.uy  ",
			quiero:      "Flash Urbano <info@send.flashurbano.uy>",
		},
		{
			// Quien se tomo el trabajo de escribirlo en el entorno gana:
			// sobrescribirlo seria pisar una decision deliberada.
			nombre:      "ya trae nombre: se respeta tal cual",
			configurado: "Otra Cosa <hola@send.flashurbano.uy>",
			quiero:      "Otra Cosa <hola@send.flashurbano.uy>",
		},
		{
			nombre:      "vacio: no se inventa nada",
			configurado: "",
			quiero:      "",
		},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if dio := remitenteConNombre(c.configurado); dio != c.quiero {
				t.Fatalf("remitenteConNombre(%q) = %q, se esperaba %q", c.configurado, dio, c.quiero)
			}
		})
	}
}

// TestElEnvioMandaLoQueTieneQueMandar mira el cuerpo que sale de verdad, contra
// un servidor de mentira.
//
// Es el control positivo de la prueba de arriba: aquella verifica una funcion
// suelta, y esta comprueba que el valor **llega al pedido**. Una implementacion
// que armara bien el remitente y despues mandara otro pasaria la primera.
func TestElEnvioMandaLoQueTieneQueMandar(t *testing.T) {
	var recibido pedidoResend
	var autorizacion string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		autorizacion = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&recibido)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"fake"}`))
	}))
	defer srv.Close()

	enviador := NuevoResend("re_lo_que_sea", "info@send.flashurbano.uy")
	enviador.url = srv.URL

	if err := enviador.EnviarCodigo(context.Background(), "cliente@example.com", "123456"); err != nil {
		t.Fatalf("enviando: %v", err)
	}

	if recibido.From != "Flash Urbano <info@send.flashurbano.uy>" {
		t.Errorf("from = %q", recibido.From)
	}
	if len(recibido.To) != 1 || recibido.To[0] != "cliente@example.com" {
		t.Errorf("to = %v", recibido.To)
	}
	// El codigo va primero en el asunto: en un telefono se lee entero desde la
	// notificacion, sin abrir el mail.
	if !strings.HasPrefix(recibido.Subject, "123456") {
		t.Errorf("el asunto no empieza con el codigo: %q", recibido.Subject)
	}
	if !strings.Contains(recibido.Subject, "verificación") {
		t.Errorf("el asunto no dice de que es el codigo: %q", recibido.Subject)
	}
	// Las dos partes, siempre: un mail sin texto plano puntua peor en los
	// filtros de spam, y este no puede permitirse caer ahi.
	if recibido.Text == "" || recibido.HTML == "" {
		t.Error("falta una de las dos partes del mail")
	}
	if !strings.Contains(recibido.Text, "123456") || !strings.Contains(recibido.HTML, "123456") {
		t.Error("el codigo no esta en alguna de las dos partes")
	}
	if autorizacion != "Bearer re_lo_que_sea" {
		t.Errorf("authorization = %q", autorizacion)
	}
}

// TestUnRechazoDelProveedorNoSeTraga: un 4xx tiene que llegar como error.
func TestUnRechazoDelProveedorNoSeTraga(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"message":"domain is not verified"}`))
	}))
	defer srv.Close()

	enviador := NuevoResend("re_x", "info@send.flashurbano.uy")
	enviador.url = srv.URL

	err := enviador.EnviarCodigo(context.Background(), "cliente@example.com", "123456")
	if err == nil {
		t.Fatal("un 422 del proveedor se trago sin error: el envio fallido pasaria por exitoso")
	}
}
