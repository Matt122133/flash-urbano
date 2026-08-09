// Package httpx tiene las piezas HTTP compartidas: CORS por entorno, la forma
// de los errores, y el middleware de sesion.
package httpx

import (
	"encoding/json"
	"log"
	"net/http"
)

// respuestaError es la unica forma que tiene un error hacia afuera.
//
// Un solo campo, y a proposito. La regla del contrato es que los errores NO
// filtran: nunca dicen si una direccion de mail esta registrada, y no
// distinguen "codigo incorrecto" de "codigo vencido" (FR-014). Un campo de
// codigo de error invitaria a poner ahi justo esas distinciones.
//
// La distincion existe, pero vive en el rastro, que solo se lee del lado del
// servidor (FR-022d).
type respuestaError struct {
	Error string `json:"error"`
}

// Mensajes genericos. Se comparten a proposito entre casos que por dentro son
// distintos: es lo que hace que la respuesta no revele cual ocurrio.
const (
	MsgNoAutorizado   = "no autorizado"
	MsgDatosInvalidos = "los datos enviados no son validos"
	MsgErrorInterno   = "no pudimos procesar el pedido"

	// MsgCodigoRechazado cubre incorrecto, vencido, ya usado y agotado. Los
	// cuatro dan la misma respuesta (FR-014).
	MsgCodigoRechazado = "el codigo no es valido o vencio"
)

// JSON escribe una respuesta exitosa.
func JSON(w http.ResponseWriter, estado int, cuerpo any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(estado)
	if cuerpo == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(cuerpo); err != nil {
		// El estado ya se escribio: no se puede corregir la respuesta. Queda
		// el registro para que no desaparezca en silencio.
		log.Printf("httpx: no se pudo escribir la respuesta: %v", err)
	}
}

// Error responde con un mensaje generico.
//
// El mensaje que se le da al cliente y el que se registra son distintos a
// proposito: adentro queremos saber que paso, afuera no lo contamos.
func Error(w http.ResponseWriter, estado int, mensaje string) {
	JSON(w, estado, respuestaError{Error: mensaje})
}

// ErrorInterno registra la causa real y responde algo que no dice nada.
//
// La causa NUNCA viaja al cliente: un error de base suele traer nombres de
// tablas, y a veces fragmentos del dato que fallo.
func ErrorInterno(w http.ResponseWriter, contexto string, err error) {
	log.Printf("httpx: %s: %v", contexto, err)
	Error(w, http.StatusInternalServerError, MsgErrorInterno)
}

// LeerJSON decodifica el cuerpo de un pedido.
//
// Con limite de tamano: sin el, cualquiera puede mandar un cuerpo de gigabytes
// y hacer que el servicio se quede sin memoria. Y rechazando campos
// desconocidos, para que un cliente que manda "usuario_id" en el cuerpo de
// PUT /yo —intentando tocar el perfil de otro— reciba un error en vez de que el
// campo se ignore en silencio.
func LeerJSON(w http.ResponseWriter, r *http.Request, destino any) error {
	const maxCuerpo = 64 << 10 // 64 KiB: mas que suficiente para estos endpoints

	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxCuerpo))
	dec.DisallowUnknownFields()
	return dec.Decode(destino)
}
