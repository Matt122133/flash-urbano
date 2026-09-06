package avisos

import (
	"context"
	"errors"
	"log"
)

// mandador es lo que hace falta para entregarle un mensaje a un telefono.
//
// **La interfaz la declara quien la consume**, no quien la implementa: asi las
// pruebas de este archivo corren contra un doble sin levantar un servidor, y
// `ClienteFCM` no tiene que saber que existe un Avisador.
type mandador interface {
	Mandar(ctx context.Context, token string, m Mensaje) error
}

// libreta es de donde salen los destinatarios y donde se tacha uno muerto.
//
// Existe por la misma razon que `mandador`, y con un beneficio concreto: sin
// ella, comprobar que **dos** telefonos reciben **dos** mensajes (FR-018)
// exigiria un Postgres, y esa prueba se saltearia sola en cualquier `verify:`
// sin `TEST_DATABASE_URL` — que es exactamente el agujero que el tracker viene
// anotando desde `010`. Asi corre siempre.
//
// La implementacion de verdad es `*Destinatarios`, y su consulta se prueba
// aparte, contra una base real.
type libreta interface {
	Tokens(ctx context.Context) ([]string, error)
	Olvidar(ctx context.Context, token string) error
}

// Avisador es el feature completo visto desde afuera: entro un pedido, que
// suenen los telefonos.
//
// Junta las tres piezas —a quien, que dice, como sale— y **se traga los
// fallos**. Es deliberado y es la forma del contrato: esto corre despues de
// haberle respondido al cliente, asi que no hay a quien devolverle un error.
// Lo unico que queda es el registro (FR-014).
type Avisador struct {
	dest libreta
	fcm  mandador
}

func NuevoAvisador(dest libreta, fcm mandador) *Avisador {
	return &Avisador{dest: dest, fcm: fcm}
}

// Avisar le manda el pedido a todos los telefonos administradores vivos.
//
// **No devuelve error a proposito.** Quien llama es un `Crear` que ya
// respondio: no tiene nada que hacer con un error, y darle uno invita a que
// alguien algun dia lo propague al cliente, que es exactamente lo que FR-009
// prohibe. Lo que si hace es dejar todo escrito.
//
// **Recorre el conjunto entero** (FR-018). Hay dos telefonos con sesion
// administradora y la API manda un mensaje por token, asi que esto es un ciclo
// y no una llamada. **Un destinatario que falla no corta el recorrido**: el
// telefono de Mateo sin bateria no puede dejar a Diego sin enterarse.
func (a *Avisador) Avisar(ctx context.Context, p PedidoNuevo) {
	a.repartir(ctx, p.Codigo, Armar(p))
}

// AvisarEdicion avisa que un pedido pendiente cambio (`022`).
//
// Mismo contrato que Avisar: no devuelve error, recorre todos los telefonos, y
// **lo que puede decir lo limita el tipo de entrada**, no este cuerpo.
func (a *Avisador) AvisarEdicion(ctx context.Context, p PedidoEditado) {
	a.repartir(ctx, p.Codigo, ArmarEdicion(p))
}

// AvisarBaja avisa que un pedido pendiente se dio de baja (`022`).
func (a *Avisador) AvisarBaja(ctx context.Context, p PedidoDadoDeBaja) {
	a.repartir(ctx, p.Codigo, ArmarBaja(p))
}

// repartir manda un mensaje ya armado a todos los telefonos con sesion
// administradora.
//
// **Se extrajo en `022`, cuando aparecieron el segundo y el tercer motivo de
// aviso.** Todo lo que hay aca abajo —buscar los tokens, no cortar el recorrido
// ante un fallo, borrar un token que el proveedor declaro muerto, y dejar
// escrito el codigo en cada renglon— vale igual para los tres, y duplicarlo tres
// veces es como uno de los tres se queda sin la limpieza de tokens muertos.
//
// Recibe el `codigo` aparte del mensaje **solo para el registro**: los renglones
// tienen que traerlo o no sirven para comprobar un "no me llego", y sacarlo del
// titulo seria parsear texto visible.
func (a *Avisador) repartir(ctx context.Context, codigo string, mensaje Mensaje) {
	tokens, err := a.dest.Tokens(ctx)
	if err != nil {
		log.Printf("avisos: no se pudo buscar a quien avisarle del pedido %s: %v", codigo, err)
		return
	}
	if len(tokens) == 0 {
		// **No es un error y no se registra como tal.** Nadie con la app
		// instalada, el permiso negado, o la unica sesion revocada dan todos lo
		// mismo. Se anota igual, porque es la unica pista de un "no me llego"
		// cuya causa esta en el telefono y no en el servicio.
		log.Printf("avisos: el pedido %s no tiene a quien avisarle (ningun telefono declaro token)", codigo)
		return
	}

	for _, token := range tokens {
		err := a.fcm.Mandar(ctx, token, mensaje)
		switch {
		case err == nil:
			// Nada. Un aviso entregado no escribe en la base ni en el registro:
			// con este volumen seria una linea por pedido por telefono para no
			// contestar ninguna pregunta.

		case errors.Is(err, ErrTokenMuerto):
			// FR-013: es el unico momento en que se sabe de verdad que una
			// direccion ya no sirve, asi que es el unico momento en que se
			// limpia. **No se toca la sesion**: que el token se haya muerto no
			// dice nada sobre si la credencial sirve.
			log.Printf("avisos: el proveedor declaro muerto un token al avisar del pedido %s; se borra", codigo)
			if err := a.dest.Olvidar(ctx, token); err != nil {
				log.Printf("avisos: no se pudo borrar el token muerto: %v", err)
			}

		default:
			// **FR-014, y es lo unico que queda.** Como el error ya no puede
			// viajar en la respuesta, este renglon es la unica forma de
			// comprobar un "no me llego": tiene que traer el codigo del pedido o
			// no sirve para nada.
			log.Printf("avisos: no se pudo avisar del pedido %s a un telefono: %v", codigo, err)
		}
	}
}

// Mudo es el avisador que no avisa.
//
// Es lo que se cablea cuando **no hay credencial configurada** (FR-010): el
// servicio arranca igual y se queda sin avisos. Un servicio que se niega a
// levantar por una funcion accesoria ya nos tumbo produccion una vez.
//
// **Es un tipo y no un nil.** Un `*Avisador` nulo obligaria a que cada lugar
// que avisa se acuerde de comprobarlo, y el dia que alguien se olvide el
// sintoma es un panic en el camino de crear un pedido — o sea, la funcion
// accesoria tumbando la principal por segunda vez, ahora peor.
type Mudo struct{}

func (Mudo) Avisar(_ context.Context, _ PedidoNuevo)          {}
func (Mudo) AvisarEdicion(_ context.Context, _ PedidoEditado) {}
func (Mudo) AvisarBaja(_ context.Context, _ PedidoDadoDeBaja) {}
