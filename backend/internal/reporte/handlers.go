package reporte

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Handlers sirve el reporte.
type Handlers struct {
	repo *Repositorio

	// esAdmin sale de la configuracion del entorno, igual que en `tablero`,
	// `pedidos` y `usuarios`. Se recibe como funcion y no se consulta una
	// columna: no hay columna de administrador, y no debe haberla.
	esAdmin func(email string) bool
}

func NuevosHandlers(repo *Repositorio, esAdmin func(string) bool) *Handlers {
	if esAdmin == nil {
		// Sin predicado, nadie es administrador. Es el default seguro: el modo
		// de falla contrario —que todos lo sean— es el que no se perdona.
		esAdmin = func(string) bool { return false }
	}
	return &Handlers{repo: repo, esAdmin: esAdmin}
}

// respuesta es el cuerpo de GET /admin/reporte.
//
// **Una lista y ningun numero.** El servicio no suma, no agrupa y no formatea:
// devuelve los hechos y la web arma el archivo. Y **no tiene donde llevar
// plata**: ni un campo, ni un total. `sin_plata_test.go` afirma que sigue sin
// tenerlo.
type respuesta struct {
	Pedidos []Fila `json:"pedidos"`
}

// Una fecha de calendario, `YYYY-MM-DD`. Se valida la forma antes de mandarla a
// la base: un `::date` con basura adentro devuelve un error de Postgres, y eso
// se leeria como un 500 del servicio en vez de como lo que es, un pedido mal
// armado.
var fecha = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// Ver responde los envios de UNA cuenta en un periodo. Solo para una direccion
// administradora.
//
// **`cliente` es obligatorio, y eso es el feature y no una validacion.** Si
// faltara y el handler contestara "todos", existiria una forma de obtener un
// archivo con los envios de varias cuentas mezcladas —el que Diego le pasa a un
// cliente—, y alcanzaria con armar la request a mano. Un boton que no se
// muestra es una precaucion; **un endpoint que no sabe contestar "todos" es una
// garantia**.
func (h *Handlers) Ver(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		// Solo se llega aca si alguien monto la ruta sin el middleware. Es un
		// error de cableado, no del cliente, y responder 401 lo esconderia.
		httpx.ErrorInterno(w, "GET /admin/reporte sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	// **403 y no 404**, igual que el tablero: que exista una ruta de
	// administracion no es secreto. Y **antes de mirar los parametros y antes de
	// tocar la base**: el 403 no puede llevar un solo dato.
	if !h.esAdmin(u.Email) {
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	}

	cliente := r.URL.Query().Get("cliente")
	desde := r.URL.Query().Get("desde")
	hasta := r.URL.Query().Get("hasta")

	if cliente == "" {
		httpx.Error(w, http.StatusBadRequest, "falta la cuenta: el reporte es siempre de un cliente")
		return
	}
	if !fecha.MatchString(desde) || !fecha.MatchString(hasta) {
		httpx.Error(w, http.StatusBadRequest, "falta el periodo, o las fechas no son YYYY-MM-DD")
		return
	}
	if desde > hasta {
		// Comparacion de texto, y alcanza: `YYYY-MM-DD` ordena igual que el
		// tiempo. Sin esto el periodo invertido devuelve una lista vacia, que se
		// lee como "este cliente no tuvo envios" — un cero falso es peor que un
		// error visible.
		httpx.Error(w, http.StatusBadRequest, "el periodo empieza despues de terminar")
		return
	}

	envios, err := h.repo.Envios(r.Context(), cliente, desde, hasta)
	if err != nil {
		httpx.ErrorInterno(w, "leyendo los envios del reporte", err)
		return
	}

	httpx.JSON(w, http.StatusOK, respuesta{Pedidos: envios})
}
