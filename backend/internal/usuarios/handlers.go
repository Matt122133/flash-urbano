package usuarios

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
)

// Limites de longitud de lo que el cliente escribe.
//
// No son validacion de forma: que el telefono parezca un telefono uruguayo es
// asunto del formulario, que puede decirlo mientras se escribe y en el idioma
// del cliente. Aca solo se rechaza lo absurdo, que es lo que el formulario no
// puede impedir porque el API se puede llamar sin el.
const (
	maxNombre         = 120
	maxTelefono       = 40
	maxCampoDireccion = 120
)

// Vista es como viaja un usuario al sitio.
//
// Es **una sola** forma para los tres endpoints que devuelven un usuario
// —`POST /auth/google`, `POST /auth/codigo/verificar` y `GET /yo`— porque el
// contrato dice que los dos primeros devuelven lo mismo que el tercero. Dos
// estructuras que se escriben parecido es como esa promesa se rompe sin que
// nada falle: alguien agrega un campo en una y no en la otra, y el sitio ve un
// usuario distinto segun por donde entro.
//
// **No lleva el email por casualidad**: es el identificador y el sitio lo
// muestra en el perfil. Lo que no lleva es nada del rastro ni de las sesiones.
type Vista struct {
	ID             string `json:"id"`
	Email          string `json:"email"`
	Nombre         string `json:"nombre"`
	Telefono       string `json:"telefono"`
	PerfilCompleto bool   `json:"perfilCompleto"`

	// Direccion de retiro guardada, o null si nunca se cargo.
	//
	// Va como objeto anidado y no como cuatro campos sueltos porque los cuatro
	// van juntos (FR-019a): un `null` unico dice "no hay direccion" sin que el
	// sitio tenga que mirar cuatro campos para deducirlo.
	//
	// **Se devuelve sin darla por valida** (FR-019b). Que el punto caiga dentro
	// de la cuadra se verifica al cobrar, y eso es 007.
	Retiro *VistaRetiro `json:"retiro"`

	// EsAdmin sale de la CONFIGURACION del entorno, no de una columna (FR-022).
	// No hay forma de volverse administrador desde el sitio porque no hay dónde
	// escribirlo: la base no lo guarda.
	//
	// Es un **puntero con omitempty**, y no un bool, por un motivo concreto: lo
	// contesta `GET /yo` y **no** la respuesta del ingreso, porque `auth` no
	// conoce la configuracion a proposito. Con un bool, el login serializaria
	// `"esAdmin": false` para todo el mundo —incluido un administrador— y el
	// sitio leeria un dato presente y equivocado. Ausente es la verdad: "esta
	// respuesta no contesta eso".
	EsAdmin *bool `json:"esAdmin,omitempty"`
}

type VistaRetiro struct {
	Calle   string      `json:"calle"`
	Esquina string      `json:"esquina"`
	Numero  string      `json:"numero"`
	Punto   *VistaPunto `json:"punto"`

	// Apto y cooperativa se sumaron el 2026-08-11. Viajan como **nulables**, no
	// como "" y false: el sitio tiene que poder distinguir "no tiene apto" de
	// "nunca lo dijo", y mostrar el selector de cooperativa sin ninguna opcion
	// marcada cuando la persona todavia no eligio.
	Apto        *string `json:"apto"`
	Cooperativa *bool   `json:"cooperativa"`
}

type VistaPunto struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// VistaDe arma la representacion publica de un usuario.
//
// Los punteros nulos salen como cadena vacia, y es deliberado: adentro la
// distincion entre "no cargado" y "vacio" decide si el alta esta en curso
// (FR-021b), pero hacia afuera esa pregunta ya la responde `perfilCompleto`.
// Mandar `null` obligaria a cada pantalla a contemplar los dos casos para
// mostrar lo mismo.
func VistaDe(u *Usuario) Vista {
	v := Vista{
		ID:             u.ID,
		Email:          u.Email,
		Nombre:         deref(u.Nombre),
		Telefono:       deref(u.Telefono),
		PerfilCompleto: u.PerfilCompleto,
	}

	// La direccion se devuelve solo si esta ENTERA. Una fila con calle y sin
	// punto —que la base admite— no sirve para precargar nada, y mandarla a
	// medias haria que el sitio muestre un formulario a medio llenar que el
	// cliente no sabe si tiene que completar o corregir.
	if u.RetiroCalle != nil && u.RetiroEsquina != nil && u.RetiroNumero != nil && u.RetiroPunto != nil {
		v.Retiro = &VistaRetiro{
			Apto:        u.RetiroApto,
			Cooperativa: u.RetiroCooperativa,
			Calle:       *u.RetiroCalle,
			Esquina:     *u.RetiroEsquina,
			Numero:      *u.RetiroNumero,
			Punto:       &VistaPunto{Lat: u.RetiroPunto.Lat, Lng: u.RetiroPunto.Lng},
		}
	}

	return v
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// Handlers son los endpoints del usuario identificado.
//
// Todos van detras de httpx.ConSesion: no hay ninguno que se pueda llamar sin
// credencial, y por eso ninguno recibe un identificador de usuario.
type Handlers struct {
	repo *Repositorio
	// esAdmin decide, a partir de la configuracion del entorno, si una
	// direccion es administradora. Nunca sale de la base (FR-022).
	esAdmin func(string) bool
}

// NuevosHandlers recibe un **predicado**, no la configuracion entera.
//
// Asi este paquete no depende de `config`, y sobre todo: cambiar quien es
// administrador es cambiar la funcion que se pasa, sin tocar la base ni este
// codigo. Es lo que hace comprobable a FR-022 en una prueba.
func NuevosHandlers(repo *Repositorio, esAdmin func(string) bool) *Handlers {
	if esAdmin == nil {
		// Sin predicado, nadie es administrador. Es el default seguro: el modo
		// de falla contrario —que todos lo sean— es el que no se perdona.
		esAdmin = func(string) bool { return false }
	}
	return &Handlers{repo: repo, esAdmin: esAdmin}
}

// vista arma la representacion publica **contestando quien es administrador**.
//
// Existe para que los dos handlers de este paquete pasen por el mismo lugar: si
// cada uno llamara a VistaDe por su cuenta, agregar un endpoint nuevo seria
// olvidarse del campo sin que nada avise.
func (h *Handlers) vista(u *Usuario) Vista {
	v := VistaDe(u)
	admin := h.esAdmin(u.Email)
	v.EsAdmin = &admin
	return v
}

// Yo responde quien es el que pregunta.
//
// No consulta la base: el middleware ya resolvio la credencial y dejo la fila
// en el contexto. Volver a leerla seria una segunda consulta por request para
// obtener exactamente lo mismo.
func (h *Handlers) Yo(w http.ResponseWriter, r *http.Request) {
	u, hay := DeContexto(r.Context())
	if !hay {
		// Solo se llega aca si alguien monto la ruta sin el middleware. Es un
		// error de cableado, no del cliente, y responder 401 lo escondería.
		httpx.ErrorInterno(w, "GET /yo sin middleware de sesion", errors.New("no hay usuario en el contexto"))
		return
	}

	httpx.JSON(w, http.StatusOK, h.vista(u))
}

// pedidoActualizarYo es el cuerpo de PUT /yo.
//
// **No tiene campo de identificador**, y no es un olvido: httpx.LeerJSON
// rechaza campos desconocidos, asi que un cliente que mande "id" o "usuarioId"
// intentando tocar el perfil de otro recibe un error en vez de que el campo se
// ignore en silencio. Quien es sale de la credencial y de ningun otro lado
// (FR-020).
type pedidoActualizarYo struct {
	Nombre   string        `json:"nombre"`
	Telefono string        `json:"telefono"`
	Retiro   *pedidoRetiro `json:"retiro"`
}

// pedidoRetiro es la direccion de retiro con la forma del formulario.
//
// Es un puntero en el pedido: **ausente conserva la guardada**, y es lo que
// permite que la pantalla de alta —que solo manda nombre y telefono— no le pise
// la direccion a quien ya la tenia.
type pedidoRetiro struct {
	Calle   string       `json:"calle"`
	Esquina string       `json:"esquina"`
	Numero  string       `json:"numero"`
	Punto   *pedidoPunto `json:"punto"`

	// **No entran en el "va entera o no va"**: hay domicilios sin apto, y no
	// declarar si es cooperativa no invalida una direccion. Punteros para que
	// mandar `null` y no mandar el campo signifiquen lo mismo —conservar— y
	// mandar `""` signifique borrar el apto.
	Apto        *string `json:"apto"`
	Cooperativa *bool   `json:"cooperativa"`
}

type pedidoPunto struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// ActualizarYo guarda nombre y telefono.
//
// Es tambien lo que **completa el alta** (FR-021a): el sitio lo llama con estos
// dos datos cuando `perfilCompleto` viene en false. No hace falta un endpoint
// aparte porque es el mismo dato, y tener dos caminos para escribir lo mismo es
// como uno de los dos se olvida de poner `perfil_completo` en true.
//
// US4 extiende este mismo endpoint con la direccion de retiro. No se duplica.
func (h *Handlers) ActualizarYo(w http.ResponseWriter, r *http.Request) {
	u, hay := DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "PUT /yo sin middleware de sesion", errors.New("no hay usuario en el contexto"))
		return
	}

	var pedido pedidoActualizarYo
	if err := httpx.LeerJSON(w, r, &pedido); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	nombre := strings.TrimSpace(pedido.Nombre)
	telefono := strings.TrimSpace(pedido.Telefono)
	if nombre == "" || telefono == "" {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}
	// Se cuenta en runes y no en bytes: un nombre con tildes o ñ ocupa mas
	// bytes que letras, y cortar por bytes lo rechazaria antes de tiempo.
	if utf8.RuneCountInString(nombre) > maxNombre || utf8.RuneCountInString(telefono) > maxTelefono {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	// La direccion, si viene, va entera o no va (FR-019a). Se rechaza a medias
	// en vez de guardar lo que llego: media direccion en la base es peor que
	// ninguna, porque el sitio la precarga y el cliente no sabe si tiene que
	// completarla o corregirla.
	var retiro *Retiro
	if pedido.Retiro != nil {
		p := pedido.Retiro
		calle, esquina, numero := strings.TrimSpace(p.Calle), strings.TrimSpace(p.Esquina), strings.TrimSpace(p.Numero)
		if calle == "" || esquina == "" || numero == "" || p.Punto == nil {
			httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
			return
		}
		// Rango del mundo. No comprueba que el punto caiga en la cuadra —eso es
		// 007 (FR-019b)— pero si que sea una coordenada y no basura: una
		// latitud de 900 no la escribe nadie sin querer.
		if p.Punto.Lat < -90 || p.Punto.Lat > 90 || p.Punto.Lng < -180 || p.Punto.Lng > 180 {
			httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
			return
		}
		if utf8.RuneCountInString(calle) > maxCampoDireccion ||
			utf8.RuneCountInString(esquina) > maxCampoDireccion ||
			utf8.RuneCountInString(numero) > maxCampoDireccion {
			httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
			return
		}
		// El apto se recorta pero NO se exige: vacio es una respuesta valida
		// —no todos los domicilios tienen apto— y se guarda como vacio, que es
		// distinto de nulo.
		var apto *string
		if p.Apto != nil {
			recortado := strings.TrimSpace(*p.Apto)
			if utf8.RuneCountInString(recortado) > maxCampoDireccion {
				httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
				return
			}
			apto = &recortado
		}

		retiro = &Retiro{
			Calle:       calle,
			Esquina:     esquina,
			Numero:      numero,
			Punto:       Punto{Lat: p.Punto.Lat, Lng: p.Punto.Lng},
			Apto:        apto,
			Cooperativa: p.Cooperativa,
		}
	}

	// El identificador sale del contexto, NUNCA del cuerpo (FR-020). Es la
	// linea que hace imposible tocar el perfil de otro, y es lo que prueba
	// SC-010 con una sesion ajena.
	actualizado, err := h.repo.GuardarPerfil(r.Context(), u.ID, nombre, telefono, retiro)
	if errors.Is(err, ErrNoExiste) {
		// La credencial resolvio hace un instante y la fila ya no esta: solo
		// pasa si el usuario se borro en el medio. Reingresar tampoco lo va a
		// arreglar, pero es lo unico honesto que se puede decir.
		httpx.Error(w, http.StatusUnauthorized, httpx.MsgNoAutorizado)
		return
	}
	if err != nil {
		httpx.ErrorInterno(w, "actualizando el perfil", err)
		return
	}

	httpx.JSON(w, http.StatusOK, h.vista(actualizado))
}
