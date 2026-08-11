package correo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// urlDeResend es el unico endpoint que se usa.
const urlDeResend = "https://api.resend.com/emails"

// tiempoLimite acota cuanto se espera al proveedor.
//
// Quien pidio el codigo esta mirando la pantalla: si Resend no contesta en diez
// segundos, es mejor decirle que reintente que dejarlo esperando. El pedido ya
// quedo registrado igual, asi que un reintento no duplica nada que importe.
const tiempoLimite = 10 * time.Second

// Resend manda por la API de Resend (research D8).
type Resend struct {
	apiKey    string
	remitente string
	cliente   *http.Client
	// url se puede cambiar en las pruebas para apuntar a un servidor de mentira.
	// No se expone: quien lo use de verdad no tiene por que elegir el endpoint.
	url string
}

// NuevoResend arma el enviador real.
//
// El remitente tiene que estar en un dominio verificado en Resend, o cada envio
// se rechaza. Hoy es `info@send.flashurbano.uy`: se firma desde un subdominio y
// no desde el apex, para que un envio que ensucie la reputacion ensucie
// `send.` y no el dominio con el que se le escribe a los clientes.
func NuevoResend(apiKey, remitente string) *Resend {
	return &Resend{
		apiKey:    apiKey,
		remitente: remitente,
		cliente:   &http.Client{Timeout: tiempoLimite},
		url:       urlDeResend,
	}
}

type pedidoResend struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
	HTML    string   `json:"html"`
}

// EnviarCodigo implementa Enviador.
func (r *Resend) EnviarCodigo(ctx context.Context, destino, codigo string) error {
	cuerpo, err := json.Marshal(pedidoResend{
		From:    r.remitente,
		To:      []string{destino},
		Subject: fmt.Sprintf("%s es tu código para entrar a Flash Urbano", codigo),
		Text:    textoDelCodigo(codigo),
		HTML:    htmlDelCodigo(codigo),
	})
	if err != nil {
		return fmt.Errorf("%w: armando el cuerpo: %v", ErrNoSePudoEnviar, err)
	}

	pedido, err := http.NewRequestWithContext(ctx, http.MethodPost, r.url, bytes.NewReader(cuerpo))
	if err != nil {
		return fmt.Errorf("%w: armando el pedido: %v", ErrNoSePudoEnviar, err)
	}
	pedido.Header.Set("Authorization", "Bearer "+r.apiKey)
	pedido.Header.Set("Content-Type", "application/json")

	respuesta, err := r.cliente.Do(pedido)
	if err != nil {
		// El detalle se registra y NO se propaga: quien llama no tiene nada
		// distinto que hacer con "sin red" que con "clave vencida".
		log.Printf("correo: fallo el envio a Resend: %v", err)
		return ErrNoSePudoEnviar
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode < 200 || respuesta.StatusCode >= 300 {
		// Se leen unos pocos KB del cuerpo para el registro. Sin esto, un 422
		// por dominio no verificado se ve igual que un 500 del proveedor, y
		// diagnosticarlo obliga a reproducirlo a mano.
		detalle, _ := io.ReadAll(io.LimitReader(respuesta.Body, 2048))
		log.Printf("correo: Resend respondio %d: %s", respuesta.StatusCode, strings.TrimSpace(string(detalle)))
		return ErrNoSePudoEnviar
	}

	return nil
}

// textoDelCodigo es la version en texto plano.
//
// Va siempre, no solo el HTML: un mail sin parte de texto puntua peor en los
// filtros de spam, y este mail no puede permitirse caer ahi — es la unica forma
// de entrar por este camino.
func textoDelCodigo(codigo string) string {
	return fmt.Sprintf(`Tu código para entrar a Flash Urbano es:

%s

Vence en 10 minutos y se puede usar una sola vez.

Si no pediste entrar, podés ignorar este mensaje: sin el código nadie puede
usar tu dirección para acceder.

Flash Urbano — Paquetería y logística
https://flashurbano.uy
`, codigo)
}

// htmlDelCodigo es la version con formato.
//
// Deliberadamente sobrio y sin imagenes: un mail transaccional con menos
// adornos llega mejor, y el codigo tiene que leerse de un vistazo en un
// telefono. Los estilos van en linea porque los clientes de correo descartan
// las hojas de estilo.
func htmlDelCodigo(codigo string) string {
	return fmt.Sprintf(`<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <p style="margin:0 0 16px;font-size:15px">Tu código para entrar a Flash Urbano es:</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">%s</p>
  <p style="margin:0 0 16px;font-size:14px;color:#475569">Vence en 10 minutos y se puede usar una sola vez.</p>
  <p style="margin:0 0 24px;font-size:14px;color:#475569">Si no pediste entrar, podés ignorar este mensaje: sin el código nadie puede usar tu dirección para acceder.</p>
  <p style="margin:0;font-size:12px;color:#94a3b8">Flash Urbano — Paquetería y logística<br><a href="https://flashurbano.uy" style="color:#94a3b8">flashurbano.uy</a></p>
</div>`, codigo)
}
