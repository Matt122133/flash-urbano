package auth

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"

	"github.com/Matt122133/flash-urbano/backend/internal/correo"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// HandlersCodigo son los dos endpoints del ingreso por mail.
//
// Estan aparte de `handlers.go` —que atiende Google— porque necesitan tres
// piezas que aquel no conoce: los codigos, los limites y el enviador. Juntarlos
// haria que el camino de Google cargara con dependencias que no usa.
type HandlersCodigo struct {
	codigos  *Codigos
	limites  *Limites
	enviador correo.Enviador
	usuarios *usuarios.Repositorio
	sesiones *Sesiones
	registro *rastro.Registro
}

func NuevosHandlersCodigo(
	codigos *Codigos,
	limites *Limites,
	enviador correo.Enviador,
	repo *usuarios.Repositorio,
	sesiones *Sesiones,
	registro *rastro.Registro,
) *HandlersCodigo {
	return &HandlersCodigo{
		codigos:  codigos,
		limites:  limites,
		enviador: enviador,
		usuarios: repo,
		sesiones: sesiones,
		registro: registro,
	}
}

type pedidoCodigo struct {
	Email string `json:"email"`
}

type pedidoVerificar struct {
	Email  string `json:"email"`
	Codigo string `json:"codigo"`
}

// Pedir es POST /auth/codigo.
//
// **Responde exactamente lo mismo pase lo que pase**: exista el usuario o no,
// este el limite excedido o no, falle el proveedor de mail o no (FR-014). Un
// 204 sin cuerpo, siempre.
//
// Eso no es prolijidad: si la respuesta cambiara segun si la direccion esta
// registrada, este endpoint seria un verificador de cuentas — cualquiera podria
// averiguar quien es cliente de Diego probando direcciones. Y si cambiara al
// exceder el limite, diria cuando conviene volver a intentar.
//
// El precio es que un fallo del proveedor tampoco se ve desde afuera. Por eso
// queda en el log y en el rastro, que son de este lado.
func (h *HandlersCodigo) Pedir(w http.ResponseWriter, r *http.Request) {
	var pedido pedidoCodigo
	if err := httpx.LeerJSON(w, r, &pedido); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	email := normalizarEmail(pedido.Email)
	origen := httpx.OrigenDeLaConexion(r)

	// Una direccion con forma invalida SI se rechaza con 400. No revela nada
	// —que "hola" no es un mail no depende de quien este registrado— y evita
	// llenar la tabla de codigos con basura que despues cuenta para los limites.
	if !pareceEmail(email) {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	// Desde aca hacia abajo, **todos los caminos terminan en 204**.
	if err := h.limites.Permite(r.Context(), email, origen); err != nil {
		if errors.Is(err, ErrLimiteExcedido) {
			h.anotar(r, email, rastro.LimiteExcedido, origen)
		} else {
			log.Printf("auth: fallo el conteo de limites para %q: %v", email, err)
		}
		httpx.JSON(w, http.StatusNoContent, nil)
		return
	}

	codigo, err := h.codigos.Emitir(r.Context(), email, origen)
	if err != nil {
		log.Printf("auth: no se pudo emitir el codigo: %v", err)
		httpx.JSON(w, http.StatusNoContent, nil)
		return
	}

	if err := h.enviador.EnviarCodigo(r.Context(), email, codigo); err != nil {
		// El codigo quedo emitido y el mail no salio. Se registra porque es el
		// unico rastro que va a quedar de un cliente que espera un mail que
		// nunca llega — incluido el caso de una direccion que el proveedor
		// tiene suprimida por un rebote previo, que desde afuera se ve
		// identico a "todo bien".
		log.Printf("auth: no se pudo enviar el codigo a %q: %v", email, err)
	}

	httpx.JSON(w, http.StatusNoContent, nil)
}

// Verificar es POST /auth/codigo/verificar.
//
// En exito hace lo mismo que Google: marca el codigo usado, crea el usuario si
// no existe y emite **la misma sesion larga** (FR-007a). El camino por el que se
// entro no cambia la credencial que sale.
//
// El usuario se crea **despues** de validar el codigo y nunca antes: al reves,
// cualquiera podria fabricar filas con direcciones ajenas mandando codigos
// inventados.
func (h *HandlersCodigo) Verificar(w http.ResponseWriter, r *http.Request) {
	var pedido pedidoVerificar
	if err := httpx.LeerJSON(w, r, &pedido); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	email := normalizarEmail(pedido.Email)
	codigo := strings.TrimSpace(pedido.Codigo)
	origen := httpx.OrigenDeLaConexion(r)

	if err := h.codigos.Verificar(r.Context(), email, codigo); err != nil {
		h.anotar(r, email, resultadoDelCodigo(err), origen)

		// **Un solo mensaje para las cuatro causas.** Incorrecto, vencido,
		// agotado y "nunca se pidio" salen iguales: distinguirlos le diria a
		// quien prueba codigos cual de sus intentos estuvo cerca, y le
		// confirmaria que esa direccion pidio uno.
		httpx.Error(w, http.StatusUnauthorized, httpx.MsgNoAutorizado)
		return
	}

	usuario, err := h.usuarios.BuscarOCrear(r.Context(), email)
	if err != nil {
		httpx.ErrorInterno(w, "buscando o creando el usuario por codigo", err)
		return
	}

	sesion, credencial, err := h.sesiones.Crear(r.Context(), usuario.ID)
	if err != nil {
		httpx.ErrorInterno(w, "emitiendo la sesion", err)
		return
	}

	// Igual que en Google: el exito se anota despues de que la sesion exista.
	h.anotar(r, usuario.Email, rastro.Exito, origen)

	// **Sin precargar nombre**: quien entra por codigo llega sin nombre
	// (FR-021a), porque el codigo solo prueba que la direccion es suya. El alta
	// se lo va a pedir.
	httpx.JSON(w, http.StatusOK, respuestaSesion{
		Credencial: credencial,
		ExpiraEn:   sesion.ExpiraEn,
		Usuario:    usuarios.VistaDe(usuario),
	})
}

// resultadoDelCodigo traduce el error a lo que se guarda en el rastro.
//
// Es la contracara del mensaje unico de afuera: hacia el cliente los cuatro
// casos son indistinguibles, y hacia adentro se distinguen todos (FR-022d). Sin
// esto no habria forma de reconstruir por que alguien no pudo entrar.
func resultadoDelCodigo(err error) rastro.Resultado {
	switch {
	case errors.Is(err, ErrCodigoVencido):
		return rastro.CodigoVencido
	case errors.Is(err, ErrCodigoAgotado):
		return rastro.CodigoAgotado
	default:
		return rastro.CodigoIncorrecto
	}
}

// anotar deja el intento en el rastro por el camino del codigo.
//
// El camino esta fijo, igual que en el handler de Google y por el mismo motivo:
// tenerlo como parametro invitaria a pasarlo mal desde uno de los dos.
func (h *HandlersCodigo) anotar(r *http.Request, email string, resultado rastro.Resultado, origen string) {
	h.registro.Anotar(r.Context(), rastro.Entrada{
		Email:     email,
		Camino:    rastro.CaminoCodigo,
		Resultado: resultado,
		Origen:    origen,
	})
}

// pareceEmail comprueba la forma, no la existencia.
//
// `mail.ParseAddress` acepta cosas raras pero validas —comillas, comentarios—
// asi que ademas se exige un arroba con algo de cada lado y un punto en el
// dominio. No se pretende validar de verdad una direccion: **eso lo hace el
// codigo que se manda**, que es justamente el punto de este camino.
func pareceEmail(email string) bool {
	if email == "" || len(email) > 254 {
		return false
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return false
	}
	arroba := strings.LastIndex(email, "@")
	if arroba <= 0 || arroba == len(email)-1 {
		return false
	}
	return strings.Contains(email[arroba+1:], ".")
}
