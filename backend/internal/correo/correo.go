// Package correo manda mail. Una sola operacion, a proposito.
//
// Existe como interfaz y no como llamada directa al proveedor por dos motivos,
// y el segundo es el que de verdad importa (research D8):
//
//  1. Cambiar de proveedor no toca la logica de auth. Resend y Brevo son
//     intercambiables para este uso; el criterio no fue el precio, porque el
//     volumen esperado esta uno o dos ordenes por debajo del nivel gratuito de
//     cualquiera de los dos.
//
//  2. **Hace automatizables las pruebas del codigo de acceso.** El vencimiento,
//     los cinco intentos y los limites de frecuencia se prueban contra el doble
//     de `falso.go`, sin mandar un solo mail y sin depender de que un servicio
//     de afuera este arriba. Sin esta interfaz, esas pruebas serian manuales, y
//     lo manual no corre en cada cambio.
package correo

import (
	"context"
	"errors"
)

// ErrNoSePudoEnviar es lo unico que sale de un envio fallido.
//
// Quien llama no tiene nada distinto que hacer segun la causa —una clave
// vencida, el proveedor caido y una direccion rechazada llevan todas al mismo
// mensaje en pantalla— asi que el detalle se registra y no se propaga.
var ErrNoSePudoEnviar = errors.New("no se pudo enviar el correo")

// Enviador manda un codigo de acceso a una direccion.
//
// **Una sola operacion, y con el codigo ya armado.** No recibe una plantilla ni
// un asunto: quien decide como se ve el mail es esta capa, no auth. Y no
// devuelve identificador de mensaje ni estado de entrega — saber si el mail
// llego a la bandeja no es algo que un proveedor pueda contestar en el momento,
// asi que prometerlo en la firma seria mentir.
type Enviador interface {
	EnviarCodigo(ctx context.Context, destino, codigo string) error
}
