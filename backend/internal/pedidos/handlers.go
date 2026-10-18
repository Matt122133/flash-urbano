package pedidos

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// CabeceraIdempotencia identifica un intento de envio.
//
// Va en una cabecera y no en el cuerpo a proposito: identifica el INTENTO, no
// el paquete. En el cuerpo invitaria a guardarla como si fuera un atributo del
// pedido.
const CabeceraIdempotencia = "Idempotency-Key"

// plazoDelAviso acota cuanto puede tardar el aviso de un pedido nuevo.
//
// **Nadie lo espera**: el cliente ya recibio su respuesta. El plazo no protege
// una espera humana, evita que una goroutine quede colgada para siempre contra
// un proveedor que no contesta.
const plazoDelAviso = 30 * time.Second

// Avisador es lo que hace sonar el telefono cuando entra un pedido.
//
// **La interfaz se declara aca, del lado que la consume**, y tiene un solo
// metodo que no devuelve nada. Eso ultimo es deliberado: si devolviera un
// error, tarde o temprano alguien lo propagaria a la respuesta del cliente, y
// FR-009 dice que el cliente no espera por el aviso ni ve ningun error suyo.
// Sin valor de retorno, ese camino no existe.
type Avisador interface {
	Avisar(ctx context.Context, p avisos.PedidoNuevo)
	// Los dos de `022`. **Un metodo por motivo, cada uno con su propio tipo de
	// entrada**, en vez de uno que reciba un mensaje ya armado: es lo que
	// mantiene la garantia de que lo prohibido no pueda salir en un aviso —el
	// tipo no tiene esos campos, asi que un descuido no compila.
	AvisarEdicion(ctx context.Context, p avisos.PedidoEditado)
	AvisarBaja(ctx context.Context, p avisos.PedidoDadoDeBaja)
	// El de `031`: a un repartidor, que un pedido es suyo.
	AvisarAsignacion(ctx context.Context, p avisos.PedidoAsignado)
}

// zonaHorariaUruguay es DONDE ocurre el retiro, y por eso donde se decide si su
// fecha ya paso.
//
// No es un detalle: en Railway el proceso corre en UTC. Comparar contra la hora
// del proceso hace que entre las 21:00 y la medianoche de Montevideo el
// servicio crea que ya es manana y **rechace retiros validos de hoy**. Un bug
// que solo aparece de noche y solo en produccion.
const zonaHorariaUruguay = "America/Montevideo"

// Handlers sirve los endpoints de pedidos.
type Handlers struct {
	repo *Repositorio

	// esAdmin sale de la configuracion del entorno (FR-022 de `006`). Se recibe
	// como funcion y no se consulta una columna: no hay columna, y no debe
	// haberla — una invitaria a que alguien la ponga en true a mano.
	esAdmin func(email string) bool

	// ahora se inyecta para poder probar el borde de la medianoche sin esperar
	// a que sean las 23:59. Sin esto, la prueba de zona horaria no se puede
	// escribir, y es justo la que cubre el bug que nadie ve de dia.
	ahora func() time.Time

	// avisador hace sonar el telefono de Diego. Nunca es nil: sin credencial se
	// cablea `avisos.Mudo`, que es un tipo y no un nulo justamente para que
	// nadie tenga que acordarse de comprobarlo aca.
	avisador Avisador

	// enSegundoPlano lanza el aviso fuera del camino de la respuesta.
	//
	// **Se inyecta porque si no, esto no se puede probar.** Con un `go` pelado,
	// una prueba que comprueba cuantos avisos salieron compite contra el
	// planificador y se pone intermitente; en las pruebas se reemplaza por una
	// que corre en el acto. Lo que NO cambia es el contexto: ese es propio en
	// los dos casos.
	enSegundoPlano func(func())

	// esRepartidor y repartidores salen de `REPARTIDOR_EMAILS` (031), por el
	// mismo motivo que esAdmin: no hay columna de rol. **Nil en los dos es el
	// default, y es "no hay repartidores"**: el servicio se comporta igual que
	// antes de 031. Los cablea ConRepartidores.
	esRepartidor func(email string) bool
	repartidores func() []string
}

func NuevosHandlers(repo *Repositorio, esAdmin func(string) bool, avisador Avisador) *Handlers {
	return &Handlers{
		repo:           repo,
		esAdmin:        esAdmin,
		ahora:          time.Now,
		avisador:       avisador,
		enSegundoPlano: func(f func()) { go f() },
	}
}

// ConRepartidores suma el rol de repartidor (031).
//
// `repartidores` es la lista que se ofrece al asignar: los configurados que no
// son administradores.
func (h *Handlers) ConRepartidores(esRepartidor func(string) bool, repartidores func() []string) *Handlers {
	h.esRepartidor = esRepartidor
	h.repartidores = repartidores
	return h
}

// esRep es esRepartidor sin tener que comprobar el nil en cada uso.
func (h *Handlers) esRep(email string) bool {
	return h.esRepartidor != nil && h.esRepartidor(email)
}

// Roles de quien usa la app (031). Viajan en la lista para que la app sepa que
// dibujar: el filtro y "Asignar" son del administrador, "Devolver a Diego" del
// repartidor.
const (
	RolAdmin      = "admin"
	RolRepartidor = "repartidor"
)

// peticionCrear es el cuerpo de POST /pedidos.
//
// **No tiene campo de usuario, ni de codigo, ni de estado**, y no es un olvido:
// httpx.LeerJSON rechaza campos desconocidos, asi que un cliente que mande
// "usuarioId" intentando crear un pedido a nombre de otro recibe un error en
// vez de que el campo se ignore en silencio. Quien pide sale de la credencial y
// de ningun otro lado.
type peticionCrear struct {
	Remitente    persona           `json:"remitente"`
	Retiro       direccionConPunto `json:"retiro"`
	Entrega      direccionConPunto `json:"entrega"`
	Paquete      paquete           `json:"paquete"`
	RetiroCuando cuando            `json:"retiroCuando"`
	Destinatario persona           `json:"destinatario"`
	Cobro        cobro             `json:"cobro"`

	// La indicacion para el repartidor (026). Opcional: la clave puede no
	// venir, y un cuerpo identico al de antes de este feature sigue siendo
	// valido.
	Comentario string `json:"comentario"`
}

// ComentarioLargoMaximo es el tope del comentario, en CARACTERES.
//
// **Tiene que coincidir con el CHECK de la migracion `0009`**, que usa
// `char_length`. Si aca se contaran bytes con `len()`, una indicacion con enes
// y tildes se rechazaria antes de llegar al tope real, y el navegador —que
// cuenta caracteres— mostraria un numero distinto del que el servicio aplica.
const ComentarioLargoMaximo = 280

type persona struct {
	Nombre   string `json:"nombre"`
	Telefono string `json:"telefono"`
}

// direccionConPunto la usan LAS DOS direcciones desde 011, y el punto es
// opcional en el tipo aunque no lo sea en la regla.
//
// Hasta 010 habia dos tipos: este para el retiro y un `direccionSinPunto` para
// la entrega, que **no tenia campo de punto** — con DisallowUnknownFields,
// mandar `entrega.punto` era un 400. Eso implementaba la decision de `003` de
// dejar la entrega como texto, cuando el precio salia del retiro.
//
// Al invertirse (ver docs/decisions/pricing-from-delivery-zone.md) ese tipo
// perdio su razon de ser: la entrega **necesita** mandar el punto, porque de el
// sale el precio. Quien exige cada cosa es la validacion, no la forma:
// `entrega.punto` es obligatorio y `retiro.punto` puede faltar (FR-014, FR-015).
type direccionConPunto struct {
	Calle       string `json:"calle"`
	Esquina     string `json:"esquina"`
	Numero      string `json:"numero"`
	Apto        string `json:"apto"`
	Cooperativa bool   `json:"cooperativa"`
	Punto       *Punto `json:"punto"`
}

type paquete struct {
	Tamano   string `json:"tamano"`
	Cantidad int    `json:"cantidad"`
}

type cuando struct {
	Fecha string `json:"fecha"` // YYYY-MM-DD
	Hora  string `json:"hora"`  // HH:MM
}

type cobro struct {
	ZonaID int `json:"zonaId"`
	Precio int `json:"precio"`
}

// respuestaCrear es lo que ve el cliente al confirmar.
//
// Devuelve el pedido entero y no solo el codigo: el sitio muestra la
// confirmacion con lo que el servicio guardo, no con lo que el navegador creia
// haber mandado. Si los dos difieren, conviene que se vea.
type respuestaCrear struct {
	Pedido *Pedido `json:"pedido"`
}

type respuestaLista struct {
	Pedidos []*Pedido `json:"pedidos"`
}

// La lista de la app. Tipo aparte y no un campo mas: ver `ParaAdmin`.
//
// `rol` y `repartidores` son de 031 y **solo suman claves**: la app instalada
// antes ignora lo que no conoce, y por eso el servicio nuevo puede desplegarse
// antes que la app (research D5).
type respuestaListaAdmin struct {
	Rol string `json:"rol"`

	// Solo para el administrador: a quienes puede asignar. Al repartidor la
	// clave no le viaja.
	Repartidores []Repartidor `json:"repartidores,omitempty"`

	Pedidos []*ParaAdmin `json:"pedidos"`
}

// Repartidor es como se lo ofrece al asignar: por nombre si tiene perfil, y si
// no por su mail (FR-009).
type Repartidor struct {
	Email  string `json:"email"`
	Nombre string `json:"nombre,omitempty"`
}

// Lo que devuelve un cambio de estado. Tambien es de Diego, y por eso tambien
// es `ParaAdmin` (030, research D7).
//
// Hasta `030` devolvia `respuestaCrear`, o sea el `Pedido` del cliente, y
// nadie lo noto porque la app reemplaza la tarjeta con esta respuesta y el
// `Pedido` traia todo lo que la tarjeta dibujaba. Con el color ya no: la
// franja **desaparecia al tocar "Lo tengo"** hasta el proximo refresco.
//
// Trae tambien la cedula de quien recibio. No abre nada: la ruta es solo para
// administradores, igual que `GET /admin/pedidos`, que ya la trae.
type respuestaEstado struct {
	Pedido *ParaAdmin `json:"pedido"`
}

// peticionEstado es el cuerpo de PATCH /admin/pedidos/{id}/estado.
//
// Un solo campo, y es el estado DESTINO. No se manda una transicion: ver
// specs/012-app-repartidor/contracts/servicio-y-pantallas.md seccion 1.
type peticionEstado struct {
	Estado string `json:"estado"`

	// Quien recibio el paquete (016). **Opcional en el cuerpo y solo se
	// interpreta cuando el estado es `entrega`.**
	//
	// Mandarlo con otro estado NO es un error: se ignora. Rechazarlo obligaria
	// a la app a saber en que transicion esta para armar el cuerpo, y ese
	// conocimiento ya lo tiene el servicio.
	Receptor *peticionReceptor `json:"receptor"`
}

type peticionReceptor struct {
	Nombre string `json:"nombre"`

	// **Opcional, y puede venir vacio.** Si quien recibe no da la cedula, la
	// entrega se registra igual (FR-006): no darla no puede trabar una entrega
	// que ya ocurrio, con la persona en la puerta.
	//
	// Se guarda tal como llega, sin validar ni normalizar (research D5).
	Documento string `json:"documento"`
}

// Crear guarda un pedido. Es el endpoint del feature.
//
// Responde 201 con un pedido nuevo y **200 con el que ya existia** cuando la
// clave de idempotencia se repite. No 409: quien reintenta porque no supo si
// funciono tiene que llegar al mismo lugar que si hubiera funcionado a la
// primera. La diferencia entre 200 y 201 es lo que hace observable —y por lo
// tanto probable— que la deduplicacion actuo.
func (h *Handlers) Crear(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		// Solo se llega aca si alguien monto la ruta sin el middleware. Es un
		// error de cableado, no del cliente, y responder 401 lo esconderia.
		httpx.ErrorInterno(w, "POST /pedidos sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	// **Una cuenta de reparto no carga pedidos** (031, FR-025, Mateo al probar
	// en staging). Es la cuenta de trabajo: si esa persona quiere mandar un
	// paquete propio, entra con otro mail. Asi el tablero puede sacar a los
	// repartidores de la lista de clientes sin que ningun pedido quede sin
	// cliente que lo muestre. Antes de leer el cuerpo: no hay nada que validar.
	if h.esRep(u.Email) {
		httpx.Error(w, http.StatusForbidden, mensajeCuentaDeReparto)
		return
	}

	clave := strings.TrimSpace(r.Header.Get(CabeceraIdempotencia))
	if clave == "" {
		// Obligatoria, no opcional-con-default. Un cliente que no la manda es un
		// cliente que puede duplicar pedidos, y aceptarlo en silencio deja
		// abierto justo el modo de falla que FR-016 cierra.
		httpx.Error(w, http.StatusBadRequest,
			"falta la cabecera "+CabeceraIdempotencia)
		return
	}

	var p peticionCrear
	if err := httpx.LeerJSON(w, r, &p); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	nuevo, motivo := h.aNuevo(u.ID, clave, p)
	if motivo != "" {
		httpx.Error(w, http.StatusBadRequest, motivo)
		return
	}

	pedido, esNuevo, err := h.repo.Crear(r.Context(), *nuevo)
	if err != nil {
		httpx.ErrorInterno(w, "creando pedido", err)
		return
	}

	estado := http.StatusOK
	if esNuevo {
		estado = http.StatusCreated
	}
	httpx.JSON(w, estado, respuestaCrear{Pedido: pedido})

	// **Solo si el pedido es nuevo de verdad** (FR-003). La idempotencia que ya
	// existia es la que hace cierto "un aviso, no dos" sin construir nada: un
	// reintento del navegador reusa la clave, `esNuevo` es false, y no hay
	// segundo aviso. Va aca abajo y no arriba porque el cliente ya se fue.
	if esNuevo {
		h.avisarDelPedido(pedido)
	}
}

// avisarDelPedido saca el aviso del camino de la respuesta.
//
// **La trampa que este metodo existe para no pisar** (research D3): llevarse
// `r.Context()` a la goroutine compila perfecto y hace que el aviso **no salga
// nunca**, porque ese contexto se cancela apenas el handler devuelve. El
// sintoma no es un error: es silencio, casi siempre, e intermitente en pruebas
// locales rapidas. Por eso el contexto se arma de cero.
//
// **Lo que se le pasa al avisador son dos campos y no el pedido**: el pedido
// entero trae nombres, telefonos, el numero de puerta y el precio, y ninguno
// de esos puede terminar en una pantalla bloqueada (FR-005, Principio V). Lo
// que no cruza esta linea no puede salir en el aviso.
func (h *Handlers) avisarDelPedido(p *Pedido) {
	h.enSegundoPlano(func() {
		ctx, cancelar := context.WithTimeout(context.Background(), plazoDelAviso)
		defer cancelar()

		h.avisador.Avisar(ctx, avisos.PedidoNuevo{
			Codigo:       p.Codigo,
			EntregaCalle: p.Entrega.Calle,
		})
	})
}

// aNuevo valida la peticion y la convierte. Devuelve el motivo del rechazo, o
// cadena vacia si esta bien.
//
// Los mensajes son especificos a proposito, al reves que en el ingreso: aca no
// hay nada que ocultar —quien pide ya esta identificado— y un error generico
// deja a la persona sin saber que corregir en un formulario de quince campos.
func (h *Handlers) aNuevo(usuarioID, clave string, p peticionCrear) (*Nuevo, string) {
	limpio := func(s string) string { return strings.TrimSpace(s) }
	// Los opcionales viajan como cadena y se guardan como puntero: "" y "no lo
	// declaro" son la misma cosa para estos campos, a diferencia de lo que pasa
	// en el perfil.
	opcional := func(s string) *string {
		s = limpio(s)
		if s == "" {
			return nil
		}
		return &s
	}

	obligatorios := []struct {
		valor  string
		motivo string
	}{
		{p.Remitente.Nombre, "falta el nombre de quien envia"},
		{p.Remitente.Telefono, "falta el telefono de quien envia"},
		{p.Retiro.Calle, "falta la calle de retiro"},
		{p.Retiro.Esquina, "falta la esquina de retiro"},
		{p.Entrega.Calle, "falta la calle de entrega"},
		{p.Entrega.Esquina, "falta la esquina de entrega"},
		{p.Destinatario.Nombre, "falta el nombre de quien recibe"},
		{p.Destinatario.Telefono, "falta el telefono de quien recibe"},
	}
	for _, o := range obligatorios {
		if limpio(o.valor) == "" {
			return nil, o.motivo
		}
	}

	// El comentario se recorta en los extremos y, si no queda nada, es nil:
	// "sin comentario" y "comentario en blanco" son el mismo estado (FR-004).
	// `opcional` ya hace exactamente eso, asi que no se escribe de nuevo.
	//
	// **El recorte vive SOLO aca.** Si el navegador tambien recortara, serian
	// dos implementaciones de la misma regla separandose de a poco; y si
	// recortara solo el navegador, un pedido cargado por otro camino entraria
	// con espacios. Este es el unico punto por el que pasan todas las
	// escrituras: `Editar` tambien llama a esta funcion.
	comentario := opcional(p.Comentario)
	if comentario != nil && utf8.RuneCountInString(*comentario) > ComentarioLargoMaximo {
		return nil, "el comentario es demasiado largo"
	}

	// **El punto que se exige es el de ENTREGA, no el de retiro** (011): de el
	// sale la zona y el precio. Un pedido sin punto de retiro es valido y se
	// guarda igual — es el caso de una direccion que no resolvio (FR-015) o de
	// una calle homonima (FR-014), y rechazarlo seria rechazar lo valido.
	if p.Entrega.Punto == nil {
		return nil, "falta el punto de entrega"
	}

	switch p.Paquete.Tamano {
	case TamanoChico, TamanoMediano, TamanoGrande:
	default:
		return nil, "el tamano del paquete no es valido"
	}
	if p.Paquete.Cantidad < 1 {
		return nil, "la cantidad tiene que ser al menos 1"
	}

	// El servicio NO resuelve la zona (research D6): no se duplica la geometria
	// que decide la plata. Lo unico que comprueba es que lo declarado tenga
	// forma de precio y de zona. El riesgo residual —quien arma la peticion a
	// mano puede declarar cualquier monto, y tambien un punto fuera de
	// cobertura— esta declarado en FR-020a y FR-021a.
	if p.Cobro.Precio <= 0 {
		return nil, "el precio no es valido"
	}
	if p.Cobro.ZonaID < 1 || p.Cobro.ZonaID > 5 {
		return nil, "la zona no es valida"
	}

	fecha, motivo := h.validarRetiro(p.RetiroCuando)
	if motivo != "" {
		return nil, motivo
	}

	return &Nuevo{
		UsuarioID:         usuarioID,
		ClaveIdempotencia: clave,
		RemitenteNombre:   limpio(p.Remitente.Nombre),
		RemitenteTelefono: limpio(p.Remitente.Telefono),
		Retiro: Direccion{
			Calle:       limpio(p.Retiro.Calle),
			Esquina:     limpio(p.Retiro.Esquina),
			Numero:      opcional(p.Retiro.Numero),
			Apto:        opcional(p.Retiro.Apto),
			Cooperativa: p.Retiro.Cooperativa,
			Punto:       p.Retiro.Punto,
		},
		Entrega: Direccion{
			Calle:       limpio(p.Entrega.Calle),
			Esquina:     limpio(p.Entrega.Esquina),
			Numero:      opcional(p.Entrega.Numero),
			Apto:        opcional(p.Entrega.Apto),
			Cooperativa: p.Entrega.Cooperativa,
			Punto:       p.Entrega.Punto,
		},
		PaqueteTamano:        p.Paquete.Tamano,
		Cantidad:             p.Paquete.Cantidad,
		RetiroFecha:          fecha,
		RetiroHora:           limpio(p.RetiroCuando.Hora),
		DestinatarioNombre:   limpio(p.Destinatario.Nombre),
		DestinatarioTelefono: limpio(p.Destinatario.Telefono),
		Comentario:           comentario,
		Precio:               p.Cobro.Precio,
		ZonaID:               p.Cobro.ZonaID,
	}, ""
}

// validarRetiro comprueba fecha y hora, y que la fecha no haya pasado.
//
// **La comparacion es contra HOY EN MONTEVIDEO**, explicitamente, no contra la
// zona del proceso. Ver el comentario de zonaHorariaUruguay.
//
// No se valida la hora dentro del dia de hoy: alguien que a las 10:05 pide un
// retiro "hoy 10:00" esta pidiendo lo antes posible, y la logistica es manual —
// Diego lo llama. Rechazarlo seria el sistema opinando sobre algo que no
// gestiona.
func (h *Handlers) validarRetiro(c cuando) (string, string) {
	fechaTxt := strings.TrimSpace(c.Fecha)
	horaTxt := strings.TrimSpace(c.Hora)

	fecha, err := time.Parse("2006-01-02", fechaTxt)
	if err != nil {
		return "", "la fecha de retiro no es valida"
	}
	if _, err := time.Parse("15:04", horaTxt); err != nil {
		return "", "la hora de retiro no es valida"
	}

	lugar, err := time.LoadLocation(zonaHorariaUruguay)
	if err != nil {
		// Sin base de datos de zonas horarias no se puede decidir cual es "hoy".
		// Se prefiere aceptar antes que rechazar un pedido valido por un
		// problema nuestro: un pedido de mas lo resuelve Diego por telefono, uno
		// perdido no.
		return fechaTxt, ""
	}

	// Las dos se reducen a dia calendario antes de comparar. `fecha` ya viene en
	// UTC a medianoche porque time.Parse sin zona asume UTC; `hoy` se pasa a
	// Montevideo PRIMERO y recien despues se le saca el dia, que es donde vive
	// toda la gracia: a las 22:00 del 13 en Montevideo son las 01:00 del 14 en
	// UTC, y sin el cambio de zona el servicio creeria que el 13 ya paso.
	hoyAlla := h.ahora().In(lugar)
	if soloElDia(fecha).Before(soloElDia(hoyAlla)) {
		return "", "la fecha de retiro ya paso"
	}

	return fechaTxt, ""
}

// soloElDia deja ano, mes y dia en UTC, para comparar dos fechas de calendario
// sin que la hora ni la zona metan ruido.
func soloElDia(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// Mios devuelve los pedidos de quien pide.
//
// **No acepta ningun parametro que permita pedir los de otro**: no hay
// ?usuarioId= y no debe haberlo. Quien es sale de la credencial.
func (h *Handlers) Mios(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "GET /pedidos sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	lista, err := h.repo.PorUsuario(r.Context(), u.ID)
	if err != nil {
		httpx.ErrorInterno(w, "leyendo mis pedidos", err)
		return
	}
	httpx.JSON(w, http.StatusOK, respuestaLista{Pedidos: lista})
}

// Todos devuelve la lista de la app: **todos** los pedidos a un administrador, y
// **solo los suyos** a un repartidor (031, FR-012, FR-013).
//
// Responde **403 y no 404** a quien no es ninguno de los dos, y aca si se
// distingue: en el ingreso no se revela si una direccion existe porque eso
// ayuda a quien prueba credenciales, pero que exista una ruta de administracion
// no es secreto, y un 404 mandaria a quien depura a buscar un error de tipeo en
// la URL.
//
// **El repartidor usa esta misma ruta, acotada** (research D5): una ruta aparte
// duplicaria el handler y obligaria a la app a elegir cual llamar.
func (h *Handlers) Todos(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "GET /admin/pedidos sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	if h.esAdmin(u.Email) {
		lista, err := h.repo.Todos(r.Context())
		if err != nil {
			httpx.ErrorInterno(w, "leyendo todos los pedidos", err)
			return
		}
		repartidores, err := h.listaDeRepartidores(r.Context())
		if err != nil {
			httpx.ErrorInterno(w, "leyendo los repartidores", err)
			return
		}
		// **`ParaAdminTodos` y no `respuestaLista`**: es la unica linea del
		// servicio que expone la cedula de quien recibio, y tiene que leerse como
		// una decision. Ver el tipo `ParaAdmin`.
		httpx.JSON(w, http.StatusOK, respuestaListaAdmin{
			Rol:          RolAdmin,
			Repartidores: repartidores,
			Pedidos:      ParaAdminTodos(lista, h.esRepartidor),
		})
		return
	}

	if h.esRep(u.Email) {
		lista, err := h.repo.PorRepartidor(r.Context(), usuarios.NormalizarEmail(u.Email))
		if err != nil {
			httpx.ErrorInterno(w, "leyendo los pedidos del repartidor", err)
			return
		}
		httpx.JSON(w, http.StatusOK, respuestaListaAdmin{
			Rol:     RolRepartidor,
			Pedidos: ParaAdminTodos(lista, h.esRepartidor),
		})
		return
	}

	httpx.Error(w, http.StatusForbidden, "no autorizado")
}

// listaDeRepartidores arma a quienes se puede asignar, con nombre si lo hay.
func (h *Handlers) listaDeRepartidores(ctx context.Context) ([]Repartidor, error) {
	if h.repartidores == nil {
		return nil, nil
	}
	emails := h.repartidores()
	nombres, err := h.repo.NombresPorEmail(ctx, emails)
	if err != nil {
		return nil, err
	}
	lista := make([]Repartidor, 0, len(emails))
	for _, e := range emails {
		lista = append(lista, Repartidor{Email: e, Nombre: nombres[e]})
	}
	return lista, nil
}

// CambiarEstado mueve un pedido de estado. Para un administrador, cualquiera;
// para un repartidor, **solo uno suyo** (031, FR-014, FR-015).
//
// Uno ajeno le responde 404 con el mismo texto que un id inventado: un 403
// confirmaria que el pedido existe.
//
// Es el camino que `012` agrega, y lo que arregla es concreto: hasta hoy **todo
// pedido decia "Pendiente" para siempre** porque el ciclo de vida existia en la
// base y no habia una linea que lo moviera.
//
// La autorizacion es **la misma que GET /admin/pedidos**, y tiene que serlo: el
// pedido que devuelve trae el nombre, la direccion y el telefono de quien recibe.
// Montarlo sin esta guarda publicaria esos datos de todos los destinatarios y
// dejaria que cualquiera moviera pedidos ajenos.
func (h *Handlers) CambiarEstado(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "PATCH /admin/pedidos/{id}/estado sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	// 403 y no 404, por lo mismo que Todos: que exista una ruta de
	// administracion no es secreto.
	alcance := Alcance{EsRepartidor: h.esRepartidor}
	switch {
	case h.esAdmin(u.Email):
	case h.esRep(u.Email):
		yo := usuarios.NormalizarEmail(u.Email)
		alcance.SoloDe = &yo
	default:
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	}

	var p peticionEstado
	if err := httpx.LeerJSON(w, r, &p); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	estado := strings.TrimSpace(p.Estado)
	if !EstadoValido(estado) {
		// El mensaje NOMBRA los tres estados. Quien lo lee es quien escribe la
		// app, y "ese estado no existe" a secas obliga a ir a buscar cuales si.
		httpx.Error(w, http.StatusBadRequest,
			"ese estado no existe: los estados son "+
				EstadoCreacion+", "+EstadoAceptacion+" y "+EstadoEntrega)
		return
	}

	// **El nombre es obligatorio al entregar** (FR-007). La app siempre lo
	// tiene: o lo escribio Diego, o es el destinatario del pedido, que copia al
	// aceptar la propuesta de un toque.
	//
	// Se valida ACA y no en el repositorio porque es una regla del contrato
	// HTTP, no de la base: la base acepta nulos a proposito, para no convertir
	// un error de escritura en el fallo de una transaccion entera.
	var receptor *Receptor
	if estado == EstadoEntrega {
		nombre := ""
		documento := ""
		if p.Receptor != nil {
			nombre = strings.TrimSpace(p.Receptor.Nombre)
			documento = strings.TrimSpace(p.Receptor.Documento)
		}
		if nombre == "" {
			httpx.Error(w, http.StatusBadRequest,
				"al entregar hay que decir quien recibio el paquete")
			return
		}
		receptor = &Receptor{Nombre: nombre, Documento: documento}
	}

	pedido, err := h.repo.CambiarEstadoCon(r.Context(), r.PathValue("id"), estado, receptor, alcance)
	switch {
	case errors.Is(err, ErrNoExiste):
		httpx.Error(w, http.StatusNotFound, "no hay tal pedido")
		return
	case errors.Is(err, ErrEstadoInvalido):
		// Inalcanzable: EstadoValido ya filtro arriba. Se contempla igual para
		// que agregar un camino que llame al repositorio sin validar no se
		// convierta en un 500.
		httpx.Error(w, http.StatusBadRequest, "ese estado no existe")
		return
	case err != nil:
		httpx.ErrorInterno(w, "cambiando el estado de un pedido", err)
		return
	}

	httpx.JSON(w, http.StatusOK, respuestaEstado{Pedido: pedido.ParaAdmin(h.esRepartidor)})
}

// peticionAsignar es el cuerpo de PUT /admin/pedidos/{id}/repartidor (031).
//
// Un mail le da el pedido a ese repartidor; `null` se lo devuelve a los
// administradores.
type peticionAsignar struct {
	Repartidor *string `json:"repartidor"`
}

// mensajeCuentaDeReparto es el rechazo de crear un pedido desde una cuenta de
// reparto (FR-025). El formulario de la web muestra el texto del servicio tal
// cual, asi que esta escrito para la persona.
const mensajeCuentaDeReparto = "Esta cuenta es de reparto. Para mandar un paquete, ingresá con otro mail."

// Textos de Asignar. Son los del contrato §3, y la app los muestra tal cual.
const (
	mensajeNoEsRepartidor = "ese mail no es de un repartidor"
	mensajeYaEntregado    = "un pedido entregado no cambia de repartidor"
)

// Asignar le da un pedido a un repartidor o se lo devuelve a los
// administradores (031, contrato §3).
//
//   - Un **administrador** asigna cualquier pedido no entregado a un repartidor
//     configurado, o lo desasigna (FR-008, FR-010a).
//   - Un **repartidor** solo puede devolver uno suyo (FR-010). Asignar a otro le
//     da 403: no es que el pedido no exista, es que esa accion no es suya.
//   - Un pedido entregado no cambia (FR-010b): 409.
//
// Asignarlo a quien ya lo tiene responde 200 sin escribir ni avisar.
func (h *Handlers) Asignar(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "PUT /admin/pedidos/{id}/repartidor sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	esAdmin := h.esAdmin(u.Email)
	if !esAdmin && !h.esRep(u.Email) {
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	}

	var p peticionAsignar
	if err := httpx.LeerJSON(w, r, &p); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	var a, soloSiEsDe *string
	switch {
	case esAdmin && p.Repartidor != nil:
		destino := usuarios.NormalizarEmail(*p.Repartidor)
		if !h.esRep(destino) {
			httpx.Error(w, http.StatusBadRequest, mensajeNoEsRepartidor)
			return
		}
		a = &destino
	case esAdmin:
		// Devolver a los administradores: a queda nil.
	case p.Repartidor != nil:
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	default:
		yo := usuarios.NormalizarEmail(u.Email)
		soloSiEsDe = &yo
	}

	pedido, cambio, err := h.repo.Asignar(r.Context(), r.PathValue("id"), a, soloSiEsDe)
	switch {
	case errors.Is(err, ErrNoExiste):
		httpx.Error(w, http.StatusNotFound, "no hay tal pedido")
		return
	case errors.Is(err, ErrEntregado):
		httpx.Error(w, http.StatusConflict, mensajeYaEntregado)
		return
	case err != nil:
		httpx.ErrorInterno(w, "asignando un pedido", err)
		return
	}

	httpx.JSON(w, http.StatusOK, respuestaEstado{Pedido: pedido.ParaAdmin(h.esRepartidor)})

	// **Solo si cambio de manos y fue A un repartidor** (FR-017, FR-017a):
	// desasignar no avisa, y repetir una asignacion tampoco.
	if cambio && a != nil {
		h.avisarDeLaAsignacion(pedido, *a)
	}
}

// mensajeFueraDeVentana es lo que se le dice a quien intento editar o dar de
// baja algo que no podia.
//
// **El repositorio no distingue los tres motivos** —no existe, no es tuyo, ya lo
// tomaron— y eso es deliberado (FR-004): distinguirlos le confirmaria a un
// desconocido que el pedido existe. Pero el texto si puede ser util, porque
// quien llega por su propia pantalla sabe que el pedido es suyo: el unico motivo
// que le puede tocar es que Diego ya lo haya tomado.
//
// **Es tambien el texto que Diego lee en la app** cuando toca un pedido que
// dejo de existir (FR-014): la app mapea cualquier error del servicio a
// `DEL_SERVICIO` y muestra este mensaje tal cual.
const mensajeFueraDeVentana = "Ese pedido ya no se puede modificar: puede que Diego ya lo haya tomado."

// Editar reemplaza un pedido propio que todavia esta pendiente (`022`).
//
// **Reemplazo total y no parcial** (FR-005a): reusa `aNuevo`, o sea **las mismas
// validaciones que crear**. Sin eso, editar seria una puerta de atras para
// guardar un pedido que el camino de creacion habria rechazado.
//
// No lleva clave de idempotencia: editar dos veces con los mismos datos deja el
// mismo resultado, asi que no hay nada que deduplicar.
func (h *Handlers) Editar(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "PATCH /pedidos/{id} sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	id := r.PathValue("id")
	if strings.TrimSpace(id) == "" {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	var p peticionCrear
	if err := httpx.LeerJSON(w, r, &p); err != nil {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	// La clave de idempotencia no se usa al editar; se pasa vacia porque `aNuevo`
	// la pide para construir un `Nuevo`, y el UPDATE no toca esa columna.
	nuevo, motivo := h.aNuevo(u.ID, "", p)
	if motivo != "" {
		httpx.Error(w, http.StatusBadRequest, motivo)
		return
	}

	pedido, err := h.repo.Editar(r.Context(), id, u.ID, *nuevo)
	switch {
	case errors.Is(err, ErrFueraDeVentana):
		// **404 y no 403.** Un 403 confirmaria que el pedido existe.
		httpx.Error(w, http.StatusNotFound, mensajeFueraDeVentana)
		return
	case err != nil:
		httpx.ErrorInterno(w, "editando pedido", err)
		return
	}

	httpx.JSON(w, http.StatusOK, respuestaCrear{Pedido: pedido})

	// Despues de responder, como el aviso de creacion: el cliente no espera por
	// el push ni ve ningun error suyo.
	h.avisarDeLaEdicion(pedido)
}

// Eliminar da de baja un pedido propio que todavia esta pendiente (`022`).
func (h *Handlers) Eliminar(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "DELETE /pedidos/{id} sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	id := r.PathValue("id")
	if strings.TrimSpace(id) == "" {
		httpx.Error(w, http.StatusBadRequest, httpx.MsgDatosInvalidos)
		return
	}

	// **Se lee el pedido ANTES de borrarlo, y solo para el aviso.** Despues del
	// DELETE no hay de donde sacar el codigo, y el aviso sin codigo no sirve
	// para nada. Que la lectura no este acotada al usuario no abre nada: si el
	// pedido no es suyo, el DELETE de abajo no borra y no se avisa.
	var codigo, repartidor string
	if antes, err := h.repo.porID(r.Context(), id); err == nil {
		codigo = antes.Codigo
		repartidor = h.repartidorDe(antes)
	}

	switch err := h.repo.Eliminar(r.Context(), id, u.ID); {
	case errors.Is(err, ErrFueraDeVentana):
		httpx.Error(w, http.StatusNotFound, mensajeFueraDeVentana)
		return
	case err != nil:
		httpx.ErrorInterno(w, "eliminando pedido", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)

	if codigo != "" {
		h.avisarDeLaBaja(codigo, repartidor)
	}
}

// avisarDeLaEdicion y avisarDeLaBaja: mismo patron que avisarDelPedido, y por
// los mismos dos motivos. El contexto se arma de cero —llevarse el del handler
// hace que el aviso no salga nunca, porque se cancela al devolver— y **lo que
// cruza estas lineas son campos sueltos y no el pedido**, que trae nombres,
// telefonos, el numero de puerta y el precio.
//
// **El repartidor viaja ya resuelto** (031, FR-019a): es el responsable
// efectivo, el mismo que la app muestra. A alguien que salio de
// `REPARTIDOR_EMAILS` no le suena un pedido que ya no es suyo.
func (h *Handlers) avisarDeLaEdicion(p *Pedido) {
	repartidor := h.repartidorDe(p)
	h.enSegundoPlano(func() {
		ctx, cancelar := context.WithTimeout(context.Background(), plazoDelAviso)
		defer cancelar()

		h.avisador.AvisarEdicion(ctx, avisos.PedidoEditado{
			Codigo:       p.Codigo,
			EntregaCalle: p.Entrega.Calle,
			Repartidor:   repartidor,
		})
	})
}

func (h *Handlers) avisarDeLaBaja(codigo, repartidor string) {
	h.enSegundoPlano(func() {
		ctx, cancelar := context.WithTimeout(context.Background(), plazoDelAviso)
		defer cancelar()

		h.avisador.AvisarBaja(ctx, avisos.PedidoDadoDeBaja{Codigo: codigo, Repartidor: repartidor})
	})
}

// avisarDeLaAsignacion le avisa al repartidor que un pedido es suyo (031,
// FR-017). Mismo patron que los de arriba: contexto propio, campos sueltos, y
// una falla no deshace la asignacion (FR-018).
func (h *Handlers) avisarDeLaAsignacion(p *Pedido, repartidor string) {
	h.enSegundoPlano(func() {
		ctx, cancelar := context.WithTimeout(context.Background(), plazoDelAviso)
		defer cancelar()

		h.avisador.AvisarAsignacion(ctx, avisos.PedidoAsignado{
			Codigo:       p.Codigo,
			EntregaCalle: p.Entrega.Calle,
			Repartidor:   repartidor,
		})
	})
}

// repartidorDe es el responsable efectivo como texto: vacio si es de los
// administradores.
func (h *Handlers) repartidorDe(p *Pedido) string {
	if r := Responsable(p.repartidorEmail, p.Estado, h.esRepartidor); r != nil {
		return *r
	}
	return ""
}
