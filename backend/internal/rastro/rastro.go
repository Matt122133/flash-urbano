// Package rastro registra los intentos de ingreso, exitosos y fallidos.
//
// Es la unica parte del feature que, si falla en silencio, no se detecta nunca:
// nadie mira el rastro hasta que hace falta reconstruir que le paso a alguien
// que reclama, y para entonces ya es tarde para descubrir que no se escribia.
//
// Lo que este paquete NO puede hacer, por construccion: guardar el codigo de
// acceso o la credencial de sesion (FR-022b). No hay campo donde ponerlos, y es
// deliberado — una API que no acepta el dato no lo puede filtrar por descuido.
package rastro

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Camino es por donde intento entrar.
type Camino string

const (
	CaminoGoogle Camino = "google"
	CaminoCodigo Camino = "codigo"
)

// Resultado es que paso en el intento.
//
// La lista distingue un bloqueo por limite de un codigo simplemente equivocado
// (FR-022d), porque son problemas distintos y se resuelven distinto: el primero
// puede ser alguien atacando, el segundo es alguien que se equivoco tipeando.
// Si el rastro no los separa, no sirve para lo que se creo.
//
// Hacia afuera varios de estos dan la MISMA respuesta (FR-014). La distincion
// existe solo de este lado.
type Resultado string

const (
	Exito             Resultado = "exito"
	CodigoIncorrecto  Resultado = "codigo_incorrecto"
	CodigoVencido     Resultado = "codigo_vencido"
	CodigoAgotado     Resultado = "codigo_agotado"
	LimiteExcedido    Resultado = "limite_excedido"
	GoogleRechazado   Resultado = "google_rechazado"
	EmailNoVerificado Resultado = "email_no_verificado"
)

// Entrada es un intento de ingreso.
//
// Los campos son exactamente los de FR-022a: cuando, que direccion, que camino,
// que resultado, desde que origen. Nada mas. Son datos personales de clientes
// reales y nada se guarda "por las dudas".
type Entrada struct {
	Email     string
	Camino    Camino
	Resultado Resultado
	Origen    string
}

// Registro escribe el rastro.
type Registro struct {
	pool *db.Pool
}

func Nuevo(pool *db.Pool) *Registro {
	return &Registro{pool: pool}
}

// Anotar guarda un intento.
//
// No devuelve error a proposito, y la decision merece explicacion: si la
// escritura del rastro falla, el ingreso NO se bloquea. Dejar a un cliente
// legitimo afuera porque no se pudo escribir una fila de auditoria es peor
// negocio que perder esa fila.
//
// Lo que si hace es dejar el fallo en el log del servicio, bien visible. La
// alternativa —tragarse el error— es exactamente el "fallar en silencio" que
// este paquete existe para evitar.
func (r *Registro) Anotar(ctx context.Context, e Entrada) {
	const sql = `
		INSERT INTO rastro_ingresos (email, camino, resultado, origen)
		VALUES ($1, $2, $3, $4)`

	email := strings.ToLower(strings.TrimSpace(e.Email))

	// El contexto del pedido puede estar por cancelarse justo cuando se
	// responde. Un contexto propio y corto evita perder la anotacion por eso.
	ctxEscritura, cancelar := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancelar()

	_, err := r.pool.Exec(ctxEscritura, sql, nuloSiVacio(email), e.Camino, e.Resultado, nuloSiVacio(e.Origen))
	if err != nil {
		// Se registra el resultado, nunca el codigo: no hay codigo en Entrada.
		log.Printf("rastro: NO SE PUDO ANOTAR el intento (%s/%s): %v",
			e.Camino, e.Resultado, err)
	}
}

// nuloSiVacio guarda NULL en vez de cadena vacia.
//
// Distinguir "no sabemos el origen" de "el origen es la cadena vacia" importa
// cuando alguien tiene que reconstruir un intento seis meses despues.
func nuloSiVacio(s string) any {
	if s == "" {
		return nil
	}
	return s
}
