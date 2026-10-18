package tablero

import (
	"errors"
	"net/http"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Handlers sirve el tablero.
type Handlers struct {
	repo *Repositorio

	// esAdmin sale de la configuracion del entorno (FR-022 de `006`), igual que
	// en `pedidos` y `usuarios`. Se recibe como funcion y no se consulta una
	// columna: no hay columna de administrador, y no debe haberla.
	esAdmin func(email string) bool

	// repartidores son los configurados en `REPARTIDOR_EMAILS` (031). Nil es
	// "no hay": la seccion solo muestra a quien tenga entregas fijas.
	repartidores func() []string
}

func NuevosHandlers(repo *Repositorio, esAdmin func(string) bool) *Handlers {
	if esAdmin == nil {
		// Sin predicado, nadie es administrador. Es el default seguro: el modo de
		// falla contrario —que todos lo sean— es el que no se perdona. Mismo
		// criterio que `usuarios.NuevosHandlers`.
		esAdmin = func(string) bool { return false }
	}
	return &Handlers{repo: repo, esAdmin: esAdmin}
}

// ConRepartidores suma la lista de repartidores configurados (031).
func (h *Handlers) ConRepartidores(repartidores func() []string) *Handlers {
	h.repartidores = repartidores
	return h
}

// respuesta es el cuerpo de GET /admin/tablero. Ver
// specs/025-dashboard-de-diego/contracts/tablero.md §1.
//
// **Dos listas y ningun numero.** El servicio no suma ni agrupa: devuelve los
// hechos y la web cuenta (research D1). Y **no tiene donde llevar plata**: ni un
// campo, ni un total. `sin_plata_test.go` afirma que sigue sin tenerlo.
//
// La clave se llama `pedidos` aunque cada elemento sea una `Carga`: para quien
// lee el JSON son los pedidos, reducidos a lo que se cuenta.
type respuesta struct {
	Pedidos  []Carga   `json:"pedidos"`
	Clientes []Cliente `json:"clientes"`

	// La tercera lista, de `031`: para el selector de la seccion Repartidores.
	Repartidores []Repartidor `json:"repartidores"`
}

// Ver responde el tablero. Solo para una direccion administradora.
//
// Sin parametros: ni `?corte=` ni `?cliente=`. Agrupar y filtrar es de la web
// (research D1), y uno desconocido se ignora.
func (h *Handlers) Ver(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		// Solo se llega aca si alguien monto la ruta sin el middleware. Es un
		// error de cableado, no del cliente, y responder 401 lo esconderia.
		httpx.ErrorInterno(w, "GET /admin/tablero sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	// **403 y no 404**, como `pedidos.Todos`: que exista una ruta de
	// administracion no es secreto (FR-003). Y **antes de tocar la base**: el 403
	// no puede llevar un solo dato, ni un conteo ni un mail (SC-004).
	if !h.esAdmin(u.Email) {
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	}

	cargas, err := h.repo.Cargas(r.Context())
	if err != nil {
		httpx.ErrorInterno(w, "leyendo las cargas del tablero", err)
		return
	}
	var configurados []string
	if h.repartidores != nil {
		configurados = h.repartidores()
	}
	clientes, err := h.repo.Clientes(r.Context(), configurados)
	if err != nil {
		httpx.ErrorInterno(w, "leyendo las cuentas del tablero", err)
		return
	}

	repartidores, err := h.repo.Repartidores(r.Context(), configurados, h.esAdmin)
	if err != nil {
		httpx.ErrorInterno(w, "leyendo los repartidores del tablero", err)
		return
	}

	httpx.JSON(w, http.StatusOK, respuesta{Pedidos: cargas, Clientes: clientes, Repartidores: repartidores})
}
