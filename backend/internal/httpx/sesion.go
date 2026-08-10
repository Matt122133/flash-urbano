package httpx

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

// claveContexto es un tipo propio para no chocar con otras claves del contexto.
//
// Usar un string pelado como clave es como dos paquetes distintos terminan
// escribiendo en la misma entrada sin saberlo.
type claveContexto struct{ nombre string }

var claveUsuario = claveContexto{"usuario"}

// ErrSesionInvalida es lo que el resolvedor devuelve cuando la credencial no
// sirve, por el motivo que sea.
//
// Se declara aca —y no se importa de internal/auth— para que este paquete no
// dependa de aquel: httpx es la capa de transporte y no tiene por que saber
// como se guardan las sesiones. El paquete auth envuelve este error.
var ErrSesionInvalida = errors.New("sesion invalida")

// TokenDeLaCredencial saca el token de `Authorization: Bearer <token>`.
//
// Devuelve vacio ante cualquier forma que no sea exactamente esa. El esquema se
// compara sin distinguir mayusculas porque el RFC 7235 lo declara insensible, y
// algun cliente manda "bearer".
//
// Es exportada porque POST /auth/salir necesita el token en si —revoca por
// token, no por usuario (FR-018)— y tiene que leerlo **igual** que el
// middleware. Si cada uno tuviera su propio lector, una diferencia entre los dos
// daria un "cerraste sesion" que en realidad no revoco nada: el peor modo de
// falla posible para este endpoint, porque el cliente ve exito.
func TokenDeLaCredencial(r *http.Request) string {
	cabecera := r.Header.Get("Authorization")
	if cabecera == "" {
		return ""
	}

	esquema, valor, hay := strings.Cut(cabecera, " ")
	if !hay || !strings.EqualFold(esquema, "Bearer") {
		return ""
	}
	return strings.TrimSpace(valor)
}

// ConSesion exige credencial valida y deja al usuario en el contexto.
//
// Es generico sobre el tipo del usuario a proposito. httpx es transporte y no
// puede importar internal/usuarios sin invertir las capas, pero guardar un
// `any` en el contexto tiraria los tipos justo donde mas importan: cada handler
// tendria que asertar a mano, y una asercion equivocada es un panic en
// produccion. Con el parametro de tipo, quien monta el middleware y quien lee
// el usuario hablan del mismo tipo y el compilador lo comprueba.
//
// Responde **401 y no 403** cuando la credencial falta, vencio o fue revocada.
// La distincion importa del lado del sitio: 401 es "reingresa", 403 es "esto no
// es para vos". El caso de la sesion que vence mientras el cliente esta usando
// el sitio —declarado como caso de borde del spec— llega aca como 401, y es lo
// que le permite al proveedor de sesion del navegador descartar la credencial y
// ofrecer volver a entrar en vez de romper la pantalla.
//
// Los motivos por los que una credencial puede no servir dan **la misma
// respuesta**. Distinguirlos le diria a quien prueba credenciales cual de sus
// intentos estuvo cerca.
func ConSesion[T any](
	resolver func(ctx context.Context, token string) (T, error),
	siguiente http.Handler,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := TokenDeLaCredencial(r)
		if token == "" {
			Error(w, http.StatusUnauthorized, MsgNoAutorizado)
			return
		}

		usuario, err := resolver(r.Context(), token)
		if err != nil {
			if !errors.Is(err, ErrSesionInvalida) {
				// Un fallo de base no es una credencial invalida, y decirle al
				// cliente que reingrese no lo va a arreglar: reingresar toca la
				// misma base que acaba de fallar. Se responde 500 para que el
				// sitio no borre una credencial que probablemente sirva.
				ErrorInterno(w, "resolviendo la sesion", err)
				return
			}
			Error(w, http.StatusUnauthorized, MsgNoAutorizado)
			return
		}

		ctx := context.WithValue(r.Context(), claveUsuario, usuario)
		siguiente.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UsuarioDe devuelve quien hizo el pedido.
//
// Solo tiene valor bajo ConSesion, y con el mismo tipo con el que aquel se
// monto. El segundo resultado dice si habia alguien: un handler que lo ignore y
// asuma que siempre hay usuario es un panic esperando a que alguien monte la
// ruta sin el middleware.
//
// **El identificador del usuario sale de aca y nunca del cuerpo del pedido**
// (FR-020). Es la unica fuente: el cuerpo lo escribe el cliente y puede decir
// cualquier cosa.
func UsuarioDe[T any](ctx context.Context) (T, bool) {
	usuario, hay := ctx.Value(claveUsuario).(T)
	return usuario, hay
}
