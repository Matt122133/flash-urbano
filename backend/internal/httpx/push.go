package httpx

import (
	"context"
	"net/http"
	"strings"
)

// CabeceraPushToken es donde la app dice a donde mandarle los avisos.
//
// Va al lado de CabeceraVersion, en la misma peticion y escrita en la misma
// fila, pero **el dato que viaja es distinto en naturaleza**: la version
// describe al software, el token direcciona a un telefono. Por eso vive en su
// propio archivo y con su propio validador, aunque la mecanica sea la misma.
//
// Igual que la version, es lo unico que la app declara del aparato. Ni modelo,
// ni fabricante, ni version de Android, ni identificador de dispositivo
// (FR-012): para entregarle un aviso a un telefono alcanza con saber a donde.
const CabeceraPushToken = "X-App-Push-Token"

// LargoMaximoPushToken es el tope de lo que se acepta guardar.
//
// Un token real del proveedor ronda los 160-180 caracteres. El margen hasta 512
// cubre que el proveedor alargue el formato sin que haya que tocar esto, y sigue
// siendo un tope: lo que llega es texto de un cliente y termina en la base.
const LargoMaximoPushToken = 512

var clavePushToken = claveContexto{"push-token"}

// PushTokenDeclarado saca del contexto el token que el cliente declaro.
//
// Devuelve vacio cuando no declaro ninguno, cuando lo que declaro no paso el
// validador, o cuando quien llama no paso por ConPushToken — el sitio web, por
// ejemplo, que no es un telefono y no tiene a donde recibir un aviso.
//
// **Vacio significa siempre "no declarado", nunca "borralo".** Aguas abajo esa
// equivalencia es lo que hace que una visita de Diego al sitio desde el
// navegador no le apague los avisos al telefono.
func PushTokenDeclarado(ctx context.Context) string {
	v, _ := ctx.Value(clavePushToken).(string)
	return v
}

// ConPushToken deja el token declarado en el contexto, ya validado.
//
// **Va en el contexto y no en un parametro**, por lo mismo que la version:
// quien lo necesita es `auth.Sesiones.Resolver`, que recibe `(ctx, token)` y no
// ve el `*http.Request`.
//
// **Nunca falla la peticion.** Un token mal formado no cambia el codigo de
// respuesta ni impide resolver la sesion. Es la regla del contrato y no un
// detalle: este dato existe para que Diego se entere de un pedido, y que un
// defecto en el pudiera dejarlo sin poder trabajar seria invertir por completo
// la relacion entre el problema y su instrumento.
func ConPushToken(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		v := PushTokenValido(r.Header.Get(CabeceraPushToken))
		if v != "" {
			r = r.WithContext(context.WithValue(r.Context(), clavePushToken, v))
		}
		siguiente.ServeHTTP(w, r)
	})
}

// PushTokenValido devuelve el token si sirve, o vacio si no.
//
// **La forma se valida a proposito de manera laxa, y conviene decir por que.**
// Los dos errores posibles no cuestan lo mismo:
//
//   - Un validador demasiado estricto rechaza un token bueno el dia que el
//     proveedor cambie el formato. Eso apaga los avisos **en silencio**: nada
//     falla, nada se registra, y el sintoma es "hace una semana que no me llega
//     nada".
//   - Un validador demasiado laxo deja entrar basura a una columna que solo se
//     usa como direccion opaca. El proveedor la rechaza, y FR-013 la borra.
//
// El segundo error se arregla solo; el primero no se descubre. Asi que se acepta
// lo que el contrato dice —texto imprimible ASCII, sin espacios, acotado en
// largo— y se descarta lo demas.
//
// Lo que pasa el tope **se descarta entero y no se recorta**: medio token no es
// una direccion mas corta, es una direccion equivocada que ademas parece un dato.
func PushTokenValido(crudo string) string {
	v := strings.TrimSpace(crudo)
	if v == "" || len(v) > LargoMaximoPushToken {
		return ""
	}
	for _, r := range v {
		// Imprimible ASCII sin el espacio: de '!' (0x21) a '~' (0x7E). Deja
		// afuera los de control, el espacio interno y cualquier cosa fuera de
		// ASCII, que es lo unico que un token del proveedor no puede traer.
		if r < '!' || r > '~' {
			return ""
		}
	}
	return v
}
