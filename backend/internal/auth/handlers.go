package auth

import (
	"net/http"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Handlers son los endpoints de ingreso y salida.
//
// Junta las cuatro piezas que un ingreso necesita —verificar quien es, buscar o
// crear su fila, emitir la credencial, dejar el rastro— y ninguna mas. En
// particular **no conoce la configuracion**: si alguien es administrador se
// decide en GET /yo (FR-022), no al entrar.
type Handlers struct {
	google   *VerificadorGoogle
	usuarios *usuarios.Repositorio
	sesiones *Sesiones
	registro *rastro.Registro
}

func NuevosHandlers(
	google *VerificadorGoogle,
	repo *usuarios.Repositorio,
	sesiones *Sesiones,
	registro *rastro.Registro,
) *Handlers {
	return &Handlers{google: google, usuarios: repo, sesiones: sesiones, registro: registro}
}

// respuestaSesion es lo que devuelven los dos caminos de ingreso.
//
// Es la misma estructura para Google y para el codigo por mail a proposito: el
// camino por el que se entro no cambia la sesion que sale (FR-007a), y el sitio
// no deberia poder notar la diferencia. Si algun dia hicieran falta dos formas
// distintas, seria la senal de que se filtro una diferencia que no deberia
// existir.
type respuestaSesion struct {
	Credencial string         `json:"credencial"`
	ExpiraEn   time.Time      `json:"expiraEn"`
	Usuario    usuarios.Vista `json:"usuario"`
}

type pedidoGoogle struct {
	Token string `json:"token"`
}

// Google es POST /auth/google.
//
// El orden de los pasos es el que sostiene FR-007: **primero se verifica el
// token y recien despues se toca la base**. Al reves —buscar el usuario por la
// direccion que venga en el cuerpo y validar despues— cualquiera podria crear
// filas con direcciones ajenas mandando tokens invalidos.
func (h *Handlers) Google(w http.ResponseWriter, r *http.Request) {
	var pedido pedidoGoogle
	if err := httpx.LeerJSON(w, r, &pedido); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	origen := httpx.OrigenDeLaConexion(r)

	identidad, err := h.google.Verificar(r.Context(), pedido.Token)
	if err != nil {
		// La direccion viene vacia salvo cuando el token era autentico y lo que
		// fallo fue `email_verified`. Ese es justamente el caso en el que
		// interesa saber a quien se le rechazo el ingreso (FR-022a).
		h.anotar(r, identidad.Email, ResultadoDeGoogle(err), origen)

		// **Un solo mensaje hacia afuera** para todas las causas posibles. En
		// particular, "Google no da tu direccion por verificada" seria un dato
		// util para quien esta probando direcciones ajenas. El detalle queda en
		// el rastro y en el log, que solo se leen de este lado.
		httpx.Error(w, http.StatusUnauthorized, httpx.MsgNoAutorizado)
		return
	}

	usuario, err := h.usuarios.BuscarOCrear(r.Context(), identidad.Email)
	if err != nil {
		// No se anota en el rastro: esto no es un intento rechazado sino un
		// fallo nuestro, y meterlo entre los rechazos ensuciaria justo la tabla
		// que existe para reconstruir intentos. Queda en el log via ErrorInterno.
		httpx.ErrorInterno(w, "buscando o creando el usuario de Google", err)
		return
	}

	sesion, credencial, err := h.sesiones.Crear(r.Context(), usuario.ID)
	if err != nil {
		httpx.ErrorInterno(w, "emitiendo la sesion", err)
		return
	}

	// El exito se anota **despues** de que la sesion exista. Anotarlo antes
	// dejaria "exito" en el rastro para un ingreso que termino en 500 y del que
	// el cliente nunca recibio credencial.
	h.anotar(r, usuario.Email, rastro.Exito, origen)

	// El nombre de Google se usa **solo para precargar** el alta (FR-021), y por
	// eso no se escribe en la base: escribirlo aca pisaria en cada ingreso el
	// nombre que el cliente eligio en su perfil. Viaja en la respuesta para que
	// el formulario de alta lo muestre ya escrito y editable.
	vista := usuarios.VistaDe(usuario)
	if vista.Nombre == "" {
		vista.Nombre = identidad.Nombre
	}

	httpx.JSON(w, http.StatusOK, respuestaSesion{
		Credencial: credencial,
		ExpiraEn:   sesion.ExpiraEn,
		Usuario:    vista,
	})
}

// Salir es POST /auth/salir.
//
// Revoca la credencial con la que llego el pedido, y solo esa (FR-018). No
// necesita saber de quien es: revoca por el token, asi que no hay forma de
// cerrarle la sesion a otro ni siquiera por error.
//
// Va detras del middleware de sesion, que ya rechazo las credenciales que no
// sirven. El token se saca con la MISMA funcion que usa el middleware: dos
// lectores distintos del header podrian discrepar, y el resultado seria un
// "cerraste sesion" que no revoco nada.
func (h *Handlers) Salir(w http.ResponseWriter, r *http.Request) {
	token := httpx.TokenDeLaCredencial(r)
	if token == "" {
		httpx.Error(w, http.StatusUnauthorized, httpx.MsgNoAutorizado)
		return
	}

	if err := h.sesiones.Revocar(r.Context(), token); err != nil {
		// Importa responder el error y no un 204 optimista: si el sitio borra la
		// credencial del navegador creyendo que se revoco y no se revoco, queda
		// una credencial viva que ya nadie puede revocar porque nadie la tiene.
		// Es exactamente lo contrario de lo que promete SC-007.
		httpx.ErrorInterno(w, "revocando la sesion", err)
		return
	}

	httpx.JSON(w, http.StatusNoContent, nil)
}

// anotar deja el intento en el rastro por el camino de Google.
//
// El camino esta fijo y no es parametro: este archivo solo atiende Google. El
// handler del codigo por mail (US3) anota con CaminoCodigo, y tenerlo como
// parametro invitaria a pasarlo mal desde uno de los dos.
func (h *Handlers) anotar(r *http.Request, email string, resultado rastro.Resultado, origen string) {
	h.registro.Anotar(r.Context(), rastro.Entrada{
		Email:     email,
		Camino:    rastro.CaminoGoogle,
		Resultado: resultado,
		Origen:    origen,
	})
}
