package httpx

import (
	"context"
	"net/http"
	"regexp"
	"strings"
)

// CabeceraVersion es donde la app dice que version corre.
//
// Es lo unico que declara de si misma. Ni modelo, ni fabricante, ni version de
// Android, ni identificador de dispositivo: para contestar "que version corre
// el telefono de Diego" el resto sobra, y un dato que no hace falta no se
// guarda.
const CabeceraVersion = "X-App-Version"

// LargoMaximoVersion es el tope de lo que se acepta guardar.
//
// Lo que llega es texto de un cliente y termina en la base. Sin tope, cualquiera
// escribe lo que quiera ahi. El valor mas largo que la app puede producir es de
// la forma `0.0.0+123-gabcdef01`, muy por debajo de esto.
const LargoMaximoVersion = 64

var claveVersion = claveContexto{"version-app"}

// formaDeVersion son las cuatro formas que la app puede producir.
//
// De `android/app/build.gradle.kts`, y hay que aceptar **las cuatro**:
//
//	0.2.0                  el tag exacto
//	0.2.0+3-gc3eb8fe       hay tag, HEAD mas adelante
//	0.0.0-c3eb8fe          sin tag alcanzable
//	0.0.0-desconocido      sin git
//
// **Que un binario de trabajo se distinga de uno publicado es el objetivo, no
// un caso raro.** Un validador que solo aceptara `X.Y.Z` haria que los binarios
// de trabajo llegaran como "no declarada", y se perderia justo la distincion
// que hace cierto FR-006.
var formaDeVersion = regexp.MustCompile(`^\d+\.\d+\.\d+(\+\d+-g[0-9a-f]+|-[0-9a-z]+)?$`)

// VersionDeclarada saca del contexto la version que el cliente declaro.
//
// Devuelve vacio cuando no declaro ninguna, cuando lo que declaro no paso el
// validador, o cuando quien llama no paso por ConVersion — el sitio web, por
// ejemplo, que no tiene version que declarar.
func VersionDeclarada(ctx context.Context) string {
	v, _ := ctx.Value(claveVersion).(string)
	return v
}

// ConVersion deja la version declarada en el contexto, ya validada.
//
// **Va en el contexto y no en un parametro.** Quien necesita este dato es
// `auth.Sesiones.Resolver`, que recibe `(ctx, token)` y no ve el
// `*http.Request`. Cambiar esa firma arrastraria a ConSesion, que es generico a
// proposito para que httpx no importe internal/usuarios e invierta las capas.
// El contexto existe para exactamente esto.
//
// **Nunca falla la peticion.** Una cabecera mal formada no cambia el codigo de
// respuesta ni impide resolver la sesion: este dato existe para diagnosticar, y
// que un defecto en el pudiera dejar a Diego sin trabajar seria invertir por
// completo la relacion entre el problema y su instrumento.
func ConVersion(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		v := VersionValida(r.Header.Get(CabeceraVersion))
		if v != "" {
			r = r.WithContext(context.WithValue(r.Context(), claveVersion, v))
		}
		siguiente.ServeHTTP(w, r)
	})
}

// VersionValida devuelve la version si sirve, o vacio si no.
//
// Vacio significa siempre lo mismo aguas abajo: **no declarada**, que deja
// intacto lo que la sesion ya tuviera anotado.
//
// Lo que pasa el tope de largo **se descarta entero y no se recorta**. Un valor
// a medias es peor que ninguno: parece un dato, y alguien lo va a leer como si
// lo fuera.
func VersionValida(crudo string) string {
	v := strings.TrimSpace(crudo)
	if v == "" || len(v) > LargoMaximoVersion {
		return ""
	}
	if !formaDeVersion.MatchString(v) {
		return ""
	}
	return v
}
