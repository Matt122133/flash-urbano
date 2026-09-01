package avisos

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// baseDeFCM es el host de la API HTTP v1 del proveedor.
const baseDeFCM = "https://fcm.googleapis.com"

// permiso es el unico alcance que se le pide a la credencial.
//
// **Uno solo, y el mas chico que existe para esto.** La credencial de service
// account puede firmar tokens para cualquier API de Google del proyecto; pedir
// solo este alcance es lo que hace que, si el secreto se filtra, lo que se
// pueda hacer con el sea mandar avisos y nada mas.
const permiso = "https://www.googleapis.com/auth/firebase.messaging"

// tiempoLimite acota cuanto se espera al proveedor.
//
// **Nadie esta mirando la pantalla**: esto corre despues de haberle respondido
// al cliente (research D3), asi que el limite no protege una espera humana sino
// que evita una goroutine colgada por siempre contra un proveedor que no
// contesta.
const tiempoLimite = 15 * time.Second

// ErrTokenMuerto dice que ESE destinatario ya no existe.
//
// Se distingue de cualquier otro fallo porque es el unico que justifica borrar
// el token (FR-013). Un error de red, un 500 del proveedor o un limite de tasa
// **no** lo son: el telefono sigue estando ahi.
var ErrTokenMuerto = errors.New("el proveedor declaro muerto el token")

// ClienteFCM manda un mensaje a un telefono, y nada mas que eso.
//
// Es la unica pieza de este paquete que toca la red, y esta separada del armado
// del mensaje y de la busqueda de destinatarios a proposito: asi las otras dos
// se prueban de verdad y esta se prueba contra un servidor de mentira.
//
// **No se usa el SDK de Firebase para Go** (research D2): son 76 modulos
// —Firestore, Storage, translate, gRPC— contra los 2 de este camino, en un
// servicio que tiene tres dependencias directas. Lo que el SDK haria por
// nosotros aca es exactamente este archivo.
type ClienteFCM struct {
	proyecto string
	fuente   oauth2.TokenSource
	cliente  *http.Client

	// base se cambia en las pruebas para apuntar a un servidor de mentira. No se
	// expone: quien lo use de verdad no tiene por que elegir el endpoint.
	base string
}

// NuevoClienteFCM arma el cliente a partir de la credencial de service account.
//
// La credencial llega **en base64** y no como JSON crudo, y no es capricho:
// `backend/dev.sh` carga el `.env` con `. ./.env`, o sea que lo interpreta el
// shell. Un JSON de service account tiene llaves, comillas, saltos de linea y
// `$` adentro de la clave privada; pegado crudo ahi no rompe el arranque, rompe
// el archivo. En base64 es un renglon sin nada que el shell quiera interpretar.
//
// **El identificador del proyecto sale de la propia credencial**, no de una
// variable aparte. Son el mismo dato, y tenerlo en dos lugares es la forma de
// que algun dia no coincidan y los avisos se manden a un proyecto que no es.
func NuevoClienteFCM(ctx context.Context, credencialBase64 string) (*ClienteFCM, error) {
	crudo, err := base64.StdEncoding.DecodeString(strings.TrimSpace(credencialBase64))
	if err != nil {
		// **El error no lleva el valor.** Es un secreto: si esto se registra con
		// lo que vino, la credencial termina escrita en los registros de Railway.
		return nil, fmt.Errorf("la credencial de avisos no es base64 valido: %w", err)
	}

	credenciales, err := google.CredentialsFromJSON(ctx, crudo, permiso)
	if err != nil {
		return nil, fmt.Errorf("la credencial de avisos no se pudo leer: %w", err)
	}
	if credenciales.ProjectID == "" {
		return nil, errors.New("la credencial de avisos no dice a que proyecto pertenece")
	}

	return &ClienteFCM{
		proyecto: credenciales.ProjectID,
		fuente:   credenciales.TokenSource,
		cliente:  &http.Client{Timeout: tiempoLimite},
		base:     baseDeFCM,
	}, nil
}

// La forma del mensaje que espera la API HTTP v1. Ver
// `specs/018-aviso-de-pedido-nuevo/contracts/mensaje-de-aviso.md`.
type sobre struct {
	Mensaje cuerpoDelMensaje `json:"message"`
}

type cuerpoDelMensaje struct {
	Token        string            `json:"token"`
	Notificacion notificacion      `json:"notification"`
	Datos        map[string]string `json:"data"`
	Android      opcionesAndroid   `json:"android"`
}

type notificacion struct {
	Titulo string `json:"title"`
	Cuerpo string `json:"body,omitempty"`
}

type opcionesAndroid struct {
	// Prioridad alta es lo que hace que llegue con el telefono en reposo, que
	// es el caso principal: Diego no esta mirando la app.
	Prioridad string `json:"priority"`

	// TTL de 24 horas (FR-017). Es el horizonte que el negocio ya se puso, asi
	// que un aviso mas viejo que eso no informa: confunde, porque anuncia como
	// nuevo algo que ya no lo es. Lo que vence no se pierde, esta en la lista.
	TTL string `json:"ttl"`

	Notificacion notificacionAndroid `json:"notification"`
}

type notificacionAndroid struct {
	// El canal lo crea la app. Si el nombre no coincide con el que ella
	// registro, Android lo entrega **con la importancia por defecto**: no suena
	// y no aparece encima, que es el feature entero perdido en silencio.
	Canal string `json:"channel_id"`
}

// CanalDePedidosNuevos es el unico canal de avisos de la app.
//
// **Vive aca y se usa alla**: es el contrato entre el servicio y la app, y la
// unica forma de que no se desincronicen es que el nombre este escrito en un
// solo lugar de cada lado y que los dos apunten a este contrato.
const CanalDePedidosNuevos = "pedidos-nuevos"

// Mandar entrega un mensaje a UN telefono.
//
// Devuelve `ErrTokenMuerto` cuando el proveedor dice que ese destinatario ya no
// existe, y un error comun para todo lo demas. Quien llama usa la diferencia
// para decidir si borra el token o simplemente lo anota (FR-013).
func (c *ClienteFCM) Mandar(ctx context.Context, token string, m Mensaje) error {
	cuerpo, err := json.Marshal(sobre{Mensaje: cuerpoDelMensaje{
		Token: token,
		Notificacion: notificacion{
			Titulo: m.Titulo,
			Cuerpo: m.Cuerpo,
		},
		// `data` es lo que hace que tocar el aviso abra la lista en ESE pedido
		// (FR-004), y lo que la app lee cuando esta en primer plano.
		Datos: map[string]string{"pedido": m.Codigo},
		Android: opcionesAndroid{
			Prioridad:    "HIGH",
			TTL:          "86400s",
			Notificacion: notificacionAndroid{Canal: CanalDePedidosNuevos},
		},
	}})
	if err != nil {
		return fmt.Errorf("armando el aviso: %w", err)
	}

	acceso, err := c.fuente.Token()
	if err != nil {
		return fmt.Errorf("pidiendo el token de acceso al proveedor: %w", err)
	}

	url := fmt.Sprintf("%s/v1/projects/%s/messages:send", c.base, c.proyecto)
	pedido, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(cuerpo))
	if err != nil {
		return fmt.Errorf("armando el pedido al proveedor: %w", err)
	}
	pedido.Header.Set("Authorization", "Bearer "+acceso.AccessToken)
	pedido.Header.Set("Content-Type", "application/json")

	respuesta, err := c.cliente.Do(pedido)
	if err != nil {
		// Sin red o el proveedor caido. **No es un token muerto**: el telefono
		// sigue estando ahi, y borrarle el token por esto lo dejaria mudo hasta
		// que reinstale la app.
		return fmt.Errorf("hablando con el proveedor de avisos: %w", err)
	}
	defer respuesta.Body.Close()

	if respuesta.StatusCode >= 200 && respuesta.StatusCode < 300 {
		return nil
	}

	// Se leen unos pocos KB para poder diagnosticar. Sin esto, un canal mal
	// escrito se ve igual que una credencial vencida.
	detalle, _ := io.ReadAll(io.LimitReader(respuesta.Body, 4096))

	if esTokenMuerto(respuesta.StatusCode, detalle) {
		return fmt.Errorf("%w: el proveedor respondio %d", ErrTokenMuerto, respuesta.StatusCode)
	}
	return fmt.Errorf("el proveedor de avisos respondio %d: %s",
		respuesta.StatusCode, strings.TrimSpace(string(detalle)))
}

// respuestaDeError es lo que el proveedor devuelve cuando algo sale mal.
type respuestaDeError struct {
	Error struct {
		Estado   string `json:"status"`
		Detalles []struct {
			Tipo    string `json:"@type"`
			Codigo  string `json:"errorCode"`
			Campos  []struct {
				Campo string `json:"field"`
			} `json:"fieldViolations"`
		} `json:"details"`
	} `json:"error"`
}

// esTokenMuerto decide si este fallo justifica **borrar** el token.
//
// ## La decision que este pedazo de codigo protege
//
// Borrar de mas es mucho peor que borrar de menos, y no es simetrico:
//
//   - **Borrar de menos** deja un token muerto en una fila. El proximo pedido
//     falla igual, se registra igual, y no se pierde nada: el telefono ya no
//     recibia avisos de todos modos.
//   - **Borrar de mas** deja a Diego mudo **hasta que reinstale la app**, sin
//     que nada avise. Y el caso peligroso no es hipotetico: `INVALID_ARGUMENT`
//     es tambien lo que contesta el proveedor cuando el **mensaje** esta mal
//     armado, o sea ante un defecto nuestro. Un despliegue con el JSON torcido
//     borraria **todos** los tokens en el primer pedido, y el sintoma seria
//     "hace dias que no me llega nada" mucho despues de haber arreglado el
//     defecto que lo causo.
//
// Por eso `INVALID_ARGUMENT` **solo** cuenta como token muerto cuando el
// proveedor nombra al token como el campo en falta. Si no lo nombra, se asume
// que el equivocado es el mensaje —o sea nosotros— y no se borra nada.
func esTokenMuerto(estado int, detalle []byte) bool {
	// 404 es "ese destinatario no existe" y no tiene otra lectura.
	if estado == http.StatusNotFound {
		return true
	}
	if estado != http.StatusBadRequest && estado != http.StatusForbidden {
		return false
	}

	var r respuestaDeError
	if err := json.Unmarshal(detalle, &r); err != nil {
		return false
	}

	for _, d := range r.Error.Detalles {
		switch d.Codigo {
		case "UNREGISTERED":
			// La app se desinstalo, o el proveedor renovo el token. Es el caso
			// normal de FR-013.
			return true
		case "SENDER_ID_MISMATCH":
			// El token es de otro proyecto de Firebase. Nunca va a servir para
			// este, asi que reintentarlo es reintentar para siempre.
			return true
		case "INVALID_ARGUMENT":
			if nombraAlToken(r) {
				return true
			}
		}
	}
	return false
}

// nombraAlToken dice si el proveedor senalo al token como el campo invalido.
//
// Es la diferencia entre "tu destinatario esta mal" y "tu mensaje esta mal", y
// de ella depende que un defecto nuestro no borre los tokens de los dos
// telefonos.
func nombraAlToken(r respuestaDeError) bool {
	for _, d := range r.Error.Detalles {
		for _, c := range d.Campos {
			if strings.Contains(strings.ToLower(c.Campo), "token") {
				return true
			}
		}
	}
	return false
}
