package pedidos

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// CabeceraIdempotencia identifica un intento de envio.
//
// Va en una cabecera y no en el cuerpo a proposito: identifica el INTENTO, no
// el paquete. En el cuerpo invitaria a guardarla como si fuera un atributo del
// pedido.
const CabeceraIdempotencia = "Idempotency-Key"

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
}

func NuevosHandlers(repo *Repositorio, esAdmin func(string) bool) *Handlers {
	return &Handlers{repo: repo, esAdmin: esAdmin, ahora: time.Now}
}

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
	Entrega      direccionSinPunto `json:"entrega"`
	Paquete      paquete           `json:"paquete"`
	RetiroCuando cuando            `json:"retiroCuando"`
	Destinatario persona           `json:"destinatario"`
	Cobro        cobro             `json:"cobro"`
}

type persona struct {
	Nombre   string `json:"nombre"`
	Telefono string `json:"telefono"`
}

type direccionConPunto struct {
	Calle       string `json:"calle"`
	Esquina     string `json:"esquina"`
	Numero      string `json:"numero"`
	Apto        string `json:"apto"`
	Cooperativa bool   `json:"cooperativa"`
	Punto       *Punto `json:"punto"`
}

// direccionSinPunto es la entrega. **No tiene campo de punto**, y por
// DisallowUnknownFields mandarlo es un 400 en vez de un dato que se descarta
// callado. La entrega quedo como texto en `003`: no incide en el precio y la
// ubica la app Android.
type direccionSinPunto struct {
	Calle       string `json:"calle"`
	Esquina     string `json:"esquina"`
	Numero      string `json:"numero"`
	Apto        string `json:"apto"`
	Cooperativa bool   `json:"cooperativa"`
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

	if p.Retiro.Punto == nil {
		return nil, "falta el punto de retiro"
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
		},
		PaqueteTamano:        p.Paquete.Tamano,
		Cantidad:             p.Paquete.Cantidad,
		RetiroFecha:          fecha,
		RetiroHora:           limpio(p.RetiroCuando.Hora),
		DestinatarioNombre:   limpio(p.Destinatario.Nombre),
		DestinatarioTelefono: limpio(p.Destinatario.Telefono),
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

// Todos devuelve todos los pedidos. Solo para una direccion administradora.
//
// Responde **403 y no 404** a quien no lo es, y aca si se distingue: en el
// ingreso no se revela si una direccion existe porque eso ayuda a quien prueba
// credenciales, pero que exista una ruta de administracion no es secreto, y un
// 404 mandaria a quien depura a buscar un error de tipeo en la URL.
func (h *Handlers) Todos(w http.ResponseWriter, r *http.Request) {
	u, hay := usuarios.DeContexto(r.Context())
	if !hay {
		httpx.ErrorInterno(w, "GET /admin/pedidos sin middleware de sesion",
			errors.New("no hay usuario en el contexto"))
		return
	}

	if !h.esAdmin(u.Email) {
		httpx.Error(w, http.StatusForbidden, "no autorizado")
		return
	}

	lista, err := h.repo.Todos(r.Context())
	if err != nil {
		httpx.ErrorInterno(w, "leyendo todos los pedidos", err)
		return
	}
	httpx.JSON(w, http.StatusOK, respuestaLista{Pedidos: lista})
}
