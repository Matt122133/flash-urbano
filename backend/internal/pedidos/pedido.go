// Package pedidos guarda lo que un cliente identificado le encarga a Flash
// Urbano.
//
// Es la mitad que `006` dejo abierta a proposito: alli se construyo la
// identidad y no se guardo un solo pedido, porque la puerta y el pedido que se
// guarda de verdad tienen que salir juntos.
//
// Tres reglas gobiernan el paquete:
//
//   - **El pedido COPIA, no referencia** (FR-013). La direccion y el telefono
//     que se guardan son los del momento de pedir. Quien se muda no reescribe
//     adonde fue Diego hace seis meses.
//   - **Un intento de envio se identifica con una clave, no con su contenido**
//     (FR-016). Dos pedidos iguales el mismo dia a la misma direccion son un
//     caso normal del negocio —dos paquetes— y descartar el segundo produce un
//     paquete que nadie pasa a buscar.
//   - **El servicio NO resuelve zonas.** Guarda el punto y el precio declarado.
//     La decision esta en specs/007-pedido-identificado/research.md D6, con su
//     riesgo residual escrito: lo que la hace aceptable es que el punto queda
//     guardado, o sea que el precio es recalculable en cualquier momento.
package pedidos

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// ErrNoExiste lo devuelve quien busca un pedido y no lo encuentra.
//
// Existe para que el llamador distinga "no hay tal pedido" de "la base fallo".
// Los dos son un error; solo uno es culpa de quien pregunta.
var ErrNoExiste = errors.New("pedido inexistente")

// ErrEstadoInvalido lo devuelve quien pide mover un pedido a un estado que no
// existe.
//
// Separado de ErrNoExiste porque el llamador los traduce distinto: uno es 400
// —lo que pediste no es un estado— y el otro 404 —el pedido no esta—. Ver
// specs/012-app-repartidor/contracts/servicio-y-pantallas.md seccion 1.
var ErrEstadoInvalido = errors.New("estado inexistente")

// Estados del ciclo de vida. Son la respuesta del cliente del 2026-08-06, que
// ademas descarto un cuarto ("confirmacion") que traia el relevamiento
// original.
//
// `007` solo escribia EstadoCreacion y dejo dicho que los otros dos los moveria
// la app Android. **Desde `012` los mueve**, por CambiarEstado, a pedido de
// PATCH /admin/pedidos/{id}/estado.
const (
	EstadoCreacion   = "creacion"
	EstadoAceptacion = "aceptacion"
	EstadoEntrega    = "entrega"
)

// Tamanos de paquete. Los mismos desde `001`.
const (
	TamanoChico   = "chico"
	TamanoMediano = "mediano"
	TamanoGrande  = "grande"
)

// Punto es una ubicacion en lat/lng.
type Punto struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// Direccion es una direccion tal como se guardo con el pedido.
//
// El punto solo lo tiene el retiro. La entrega quedo como texto en `003`
// (FR-007a de aquel feature): no incide en el precio y la ubica la app Android.
type Direccion struct {
	Calle       string  `json:"calle"`
	Esquina     string  `json:"esquina"`
	Numero      *string `json:"numero"`
	Apto        *string `json:"apto"`
	Cooperativa bool    `json:"cooperativa"`
	Punto       *Punto  `json:"punto,omitempty"`
}

// Pedido es un encargo ya guardado.
type Pedido struct {
	ID        string `json:"id"`
	UsuarioID string `json:"usuarioId"`

	// Codigo lo genera la BASE por DEFAULT, no el servicio: dos instancias no
	// pueden emitir el mismo y no hay que reintentar ante colision.
	Codigo string `json:"codigo"`
	Estado string `json:"estado"`

	RemitenteNombre   string `json:"remitenteNombre"`
	RemitenteTelefono string `json:"remitenteTelefono"`

	Retiro  Direccion `json:"retiro"`
	Entrega Direccion `json:"entrega"`

	PaqueteTamano string `json:"paqueteTamano"`
	Cantidad      int    `json:"cantidad"`

	// Fecha y hora sueltas, no un instante. El retiro ocurre en Montevideo
	// siempre, y convertir a UTC y volver es la receta conocida del error de un
	// dia. Se guardan y se devuelven como los escribio la persona.
	RetiroFecha string `json:"retiroFecha"` // YYYY-MM-DD
	RetiroHora  string `json:"retiroHora"`  // HH:MM

	DestinatarioNombre   string `json:"destinatarioNombre"`
	DestinatarioTelefono string `json:"destinatarioTelefono"`

	// Precio en pesos enteros, congelado al crear. Un cambio de precios
	// posterior no reescribe pedidos viejos.
	Precio int `json:"precio"`
	ZonaID int `json:"zonaId"`

	// Quien recibio el paquete, del ultimo cambio a `entrega` (016).
	//
	// **`omitempty` no es cosmetico**: un pedido que no esta entregado, o uno
	// anterior a `016`, no trae el campo en vez de traerlo vacio. La pantalla
	// distingue "no se registro" de "se registro en blanco" sin tener que
	// preguntar.
	//
	// **El DOCUMENTO no esta aca, y esa ausencia es el feature.** Ver el tipo
	// `ParaAdmin`, abajo.
	RecibioNombre string `json:"recibioNombre,omitempty"`

	// La cedula de quien recibio.
	//
	// **Va en minuscula a proposito, y es la mitad mas fuerte de la guarda de
	// FR-009.** `encoding/json` no serializa campos no exportados: este dato
	// puede viajar en memoria con el pedido y **no hay forma de que salga en la
	// respuesta del cliente por descuido**, ni agregandole una etiqueta, ni
	// olvidandose de blanquearlo, ni renombrando algo.
	//
	// La unica forma de exponerlo es `ParaAdmin()`, que hay que llamar a
	// proposito. El compilador sostiene la regla; la prueba de
	// `respuesta_cliente_test.go` sostiene que la regla siga siendo esta.
	recibioDocumento string

	CreadoEn      time.Time `json:"creadoEn"`
	ActualizadoEn time.Time `json:"actualizadoEn"`
}

// ParaAdmin es un pedido con lo que solo Diego puede ver.
//
// ## Por que existe un tipo aparte en vez de un campo mas
//
// Hasta `016`, `GET /pedidos` y `GET /admin/pedidos` devolvian **exactamente la
// misma estructura**: los dos handlers terminan en el mismo `respuestaLista`
// sobre el mismo `[]*Pedido`. O sea que agregarle la cedula a `Pedido` **se la
// agregaba a los dos**, en el mismo commit, sin que nadie lo escribiera ni lo
// notara.
//
// Se descartaron las dos alternativas:
//
//   - **Blanquear al salir** —un campo en `Pedido` que `Mios` vacia antes de
//     escribir— deja lo seguro como excepcion: el proximo dato sensible se
//     filtra por defecto, porque el default pasa a ser exponer.
//   - **`MarshalJSON` con una bandera de contexto** funciona y es opaco: la
//     respuesta deja de leerse en el tipo y pasa a depender de quien llamo.
//
// **Con dos tipos, lo seguro es el default.** `Pedido` es lo que ve el cliente;
// exponer la cedula obliga a nombrar `ParaAdmin` a proposito. Si manana alguien
// suma otro dato sensible, cae del lado del cliente **solo si lo escribe ahi
// queriendo**.
//
// La regla la sostiene una prueba, no esta explicacion: ver
// `respuesta_cliente_test.go`.
type ParaAdmin struct {
	*Pedido

	// La cedula de quien recibio. **No sale de aca a ningun lado mas.**
	//
	// Es un dato personal de un tercero que ademas nunca interactuo con el
	// sistema: se la dio a Diego en la puerta, no a nosotros. Se guarda como
	// respaldo de entrega y se muestra solo en la app de Diego.
	RecibioDocumento string `json:"recibioDocumento,omitempty"`
}

// ParaAdmin expone el pedido con lo que solo Diego puede ver.
//
// **Es el unico camino por el que la cedula sale del proceso**, y por eso es
// una llamada explicita y no una etiqueta en un campo: se lee en el sitio donde
// se usa, no hay que ir a buscarla a la definicion del tipo.
func (p *Pedido) ParaAdmin() *ParaAdmin {
	return &ParaAdmin{Pedido: p, RecibioDocumento: p.recibioDocumento}
}

// ParaAdminTodos es lo mismo, para una lista.
func ParaAdminTodos(pedidos []*Pedido) []*ParaAdmin {
	fuera := make([]*ParaAdmin, 0, len(pedidos))
	for _, p := range pedidos {
		fuera = append(fuera, p.ParaAdmin())
	}
	return fuera
}

// Nuevo es lo que hace falta para crear un pedido.
//
// No lleva ID, codigo ni estado: los tres los pone la base. Que no se puedan
// pasar desde afuera es deliberado — un codigo elegido por el cliente seria un
// codigo repetible.
type Nuevo struct {
	UsuarioID         string
	ClaveIdempotencia string

	RemitenteNombre   string
	RemitenteTelefono string

	Retiro  Direccion
	Entrega Direccion

	PaqueteTamano string
	Cantidad      int

	RetiroFecha string
	RetiroHora  string

	DestinatarioNombre   string
	DestinatarioTelefono string

	Precio int
	ZonaID int
}

// Repositorio lee y escribe pedidos.
type Repositorio struct {
	pool *db.Pool
}

func NuevoRepositorio(pool *db.Pool) *Repositorio {
	return &Repositorio{pool: pool}
}

// columnas es la lista unica con la que se leen pedidos.
//
// Esta en una constante y no repetida en cada consulta porque el orden tiene
// que coincidir con escanear(); separarlos es como se agrega una columna y se
// rompen tres consultas que nadie volvio a mirar.
//
// La fecha y la hora salen como TEXTO con formato explicito, no como time.Time.
// Es a proposito: `date` y `time` no tienen zona horaria, y dejar que el driver
// los convierta a un instante los ata a la zona del proceso —UTC en Railway— y
// reintroduce por la puerta de atras el error de un dia que el esquema evito.
const columnas = `
	id, usuario_id, codigo, estado,
	remitente_nombre, remitente_telefono,
	retiro_calle, retiro_esquina, retiro_numero, retiro_apto, retiro_cooperativa,
	ST_Y(retiro_punto::geometry), ST_X(retiro_punto::geometry),
	entrega_calle, entrega_esquina, entrega_numero, entrega_apto, entrega_cooperativa,
	ST_Y(entrega_punto::geometry), ST_X(entrega_punto::geometry),
	paquete_tamano, cantidad,
	to_char(retiro_fecha, 'YYYY-MM-DD'), to_char(retiro_hora, 'HH24:MI'),
	destinatario_nombre, destinatario_telefono,
	precio, zona_id,
	creado_en, actualizado_en,
	e.receptor_nombre, e.receptor_documento`

// De donde salen los pedidos, con quien recibio pegado.
//
// **Un LEFT JOIN LATERAL y no una consulta por pedido** (research D3): la lista
// de Diego ya esta anotada como sin paginar, y convertirla en 1+N seria
// empeorar a proposito lo que ya duele.
//
// `LEFT` y no `INNER`: un pedido que no se entrego —o uno anterior a `016`— no
// tiene fila de receptor y **tiene que seguir apareciendo igual**.
//
// El `ORDER BY ocurrido_en DESC LIMIT 1` toma el ULTIMO cambio a `entrega`, que
// es el que vale cuando un pedido se entrego, se deshizo y se volvio a
// entregar. Se apoya en el indice `(pedido_id, ocurrido_en)` que creo `012`
// para leer el historial en orden: no hace falta ninguno nuevo.
const desdePedidos = `
	FROM pedidos
	LEFT JOIN LATERAL (
		SELECT receptor_nombre, receptor_documento
		FROM pedidos_estados
		WHERE pedido_id = pedidos.id
		  AND estado = 'entrega'
		  -- **Solo si el pedido SIGUE entregado.**
		  --
		  -- Sin esta linea, deshacer una entrega dejaba el receptor a la vista:
		  -- el pedido volvia a Pendientes y la tarjeta seguia diciendo "lo
		  -- recibio Susana". Lo encontro Mateo probando en produccion.
		  --
		  -- **La fila del historial NO se borra**, y no puede borrarse: que esa
		  -- persona recibio el paquete es un hecho que ocurrio, y esta tabla
		  -- existe para no perderlo. Lo que se corrige es mostrarlo cuando ya no
		  -- corresponde.
		  --
		  -- Con esto, entregar → deshacer → volver a entregar muestra al
		  -- SEGUNDO receptor, y las dos filas quedan guardadas.
		  AND pedidos.estado = 'entrega'
		ORDER BY ocurrido_en DESC
		LIMIT 1
	) e ON true`

// escanear arma un Pedido desde una fila con el orden de columnas.
func escanear(fila pgx.Row) (*Pedido, error) {
	var p Pedido
	// **Las dos direcciones salen en punteros, y las dos por un motivo distinto.**
	//
	//   - `retiro_punto` es nullable porque un retiro que no resuelve se guarda
	//     igual (FR-015): son filas que el propio feature crea a proposito.
	//   - `entrega_punto` es nullable porque **los pedidos anteriores a `011` no
	//     lo tienen**. Entro `NOT NULL` en la primera version de la migracion y
	//     eso tumbo produccion el 2026-08-23; al volverla nullable, escanear en
	//     un float64 pelado habria roto la lectura de esos mismos pedidos.
	//
	// Un pedido NUEVO no puede llegar sin punto de entrega —lo impiden las dos
	// guardas del servicio—, pero **leer no es crear**, y esta funcion lee todo
	// lo que hay en la tabla, incluido lo de antes.
	var retiroLat, retiroLng *float64
	var entregaLat, entregaLng *float64

	// Punteros porque **son nulos en todo pedido que no se entrego**, y en todo
	// pedido anterior a `016`. Escanear en un string pelado romperia la lectura
	// de casi toda la tabla — el mismo error que `entrega_punto` costo caro.
	var recibioNombre, recibioDocumento *string

	err := fila.Scan(
		&p.ID, &p.UsuarioID, &p.Codigo, &p.Estado,
		&p.RemitenteNombre, &p.RemitenteTelefono,
		&p.Retiro.Calle, &p.Retiro.Esquina, &p.Retiro.Numero, &p.Retiro.Apto, &p.Retiro.Cooperativa,
		&retiroLat, &retiroLng,
		&p.Entrega.Calle, &p.Entrega.Esquina, &p.Entrega.Numero, &p.Entrega.Apto, &p.Entrega.Cooperativa,
		&entregaLat, &entregaLng,
		&p.PaqueteTamano, &p.Cantidad,
		&p.RetiroFecha, &p.RetiroHora,
		&p.DestinatarioNombre, &p.DestinatarioTelefono,
		&p.Precio, &p.ZonaID,
		&p.CreadoEn, &p.ActualizadoEn,
		&recibioNombre, &recibioDocumento,
	)
	if err != nil {
		return nil, err
	}

	// Nil en cualquiera de las dos **no es un error**: en el retiro es una
	// direccion que no se pudo ubicar (FR-014, FR-015), y en la entrega es un
	// pedido anterior a `011`, que `crear-pedido.tsx` sabe precargar sin precio
	// (FR-013).
	// Nil es lo normal, no un error: son nulos en todo pedido que no se entrego.
	if recibioNombre != nil {
		p.RecibioNombre = *recibioNombre
	}
	if recibioDocumento != nil {
		p.recibioDocumento = *recibioDocumento
	}

	if retiroLat != nil && retiroLng != nil {
		p.Retiro.Punto = &Punto{Lat: *retiroLat, Lng: *retiroLng}
	}
	if entregaLat != nil && entregaLng != nil {
		p.Entrega.Punto = &Punto{Lat: *entregaLat, Lng: *entregaLng}
	}
	return &p, nil
}

// Crear guarda un pedido, o devuelve el que ya se creo con la misma clave.
//
// El segundo valor dice si la fila es NUEVA. Quien llama lo usa para responder
// 201 o 200, y esa diferencia es lo que hace OBSERVABLE que la deduplicacion
// actuo — sin ella, "deja un solo pedido" no se puede probar de afuera.
//
// El ON CONFLICT no lleva DO UPDATE a proposito: reintentar no puede modificar
// el pedido que ya existe. Si el segundo intento trajera datos distintos con la
// misma clave, gana el primero — es un reintento, no una edicion.
func (r *Repositorio) Crear(ctx context.Context, n Nuevo) (*Pedido, bool, error) {
	if n.Entrega.Punto == nil {
		// No deberia llegar aca: el handler valida antes. Se comprueba igual
		// porque un punto nil produciria un NOT NULL violation con un mensaje
		// que no menciona el punto.
		//
		// **Es el punto de ENTREGA desde 011**, no el de retiro: es el que
		// decide la zona y el precio, y el unico que la tabla exige. Un pedido
		// sin punto de retiro es valido y no se rechaza.
		return nil, false, fmt.Errorf("el pedido no trae punto de entrega")
	}

	// El retiro viaja en punteros para que un punto ausente llegue como NULL:
	// ST_MakePoint con argumentos NULL devuelve NULL, y la columna lo acepta.
	var retiroLat, retiroLng *float64
	if n.Retiro.Punto != nil {
		retiroLat = &n.Retiro.Punto.Lat
		retiroLng = &n.Retiro.Punto.Lng
	}

	// ST_MakePoint recibe (X, Y), o sea **longitud primero**. Invertirlo no da
	// error: da un punto en otro continente.
	const sql = `
		INSERT INTO pedidos (
			usuario_id, clave_idempotencia,
			remitente_nombre, remitente_telefono,
			retiro_calle, retiro_esquina, retiro_numero, retiro_apto, retiro_cooperativa,
			retiro_punto,
			entrega_calle, entrega_esquina, entrega_numero, entrega_apto, entrega_cooperativa,
			entrega_punto,
			paquete_tamano, cantidad,
			retiro_fecha, retiro_hora,
			destinatario_nombre, destinatario_telefono,
			precio, zona_id
		) VALUES (
			$1, $2,
			$3, $4,
			$5, $6, $7, $8, $9,
			ST_SetSRID(ST_MakePoint($11::float8, $10::float8), 4326)::geography,
			$12, $13, $14, $15, $16,
			ST_SetSRID(ST_MakePoint($26::float8, $25::float8), 4326)::geography,
			$17, $18,
			$19::date, $20::time,
			$21, $22,
			$23, $24
		)
		ON CONFLICT (usuario_id, clave_idempotencia) DO NOTHING
		RETURNING id`

	// **Devuelve el id y se relee, en vez de `RETURNING columnas`.**
	//
	// Desde `016` las columnas de un pedido incluyen a quien recibio, que sale
	// de un LATERAL sobre `pedidos_estados` — y un `RETURNING` no puede
	// referirse a una tabla que no esta en la sentencia. Un pedido recien
	// creado ademas **no puede tener receptor**: nace en `creacion`.
	//
	// Se eligio esto antes que una segunda lista de columnas y un segundo
	// escaner: dos formas de leer un pedido son dos formas de que una se olvide
	// de un campo. Cuesta un viaje mas en el unico camino donde no importa.
	fila := r.pool.QueryRow(ctx, sql,
		n.UsuarioID, n.ClaveIdempotencia,
		n.RemitenteNombre, n.RemitenteTelefono,
		n.Retiro.Calle, n.Retiro.Esquina, n.Retiro.Numero, n.Retiro.Apto, n.Retiro.Cooperativa,
		retiroLat, retiroLng,
		n.Entrega.Calle, n.Entrega.Esquina, n.Entrega.Numero, n.Entrega.Apto, n.Entrega.Cooperativa,
		n.PaqueteTamano, n.Cantidad,
		n.RetiroFecha, n.RetiroHora,
		n.DestinatarioNombre, n.DestinatarioTelefono,
		n.Precio, n.ZonaID,
		n.Entrega.Punto.Lat, n.Entrega.Punto.Lng,
	)

	var nuevoID string
	err := fila.Scan(&nuevoID)
	if err == nil {
		p, err := r.porID(ctx, nuevoID)
		if err != nil {
			return nil, false, fmt.Errorf("no se pudo releer el pedido creado: %w", err)
		}
		return p, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("no se pudo crear el pedido: %w", err)
	}

	// Sin filas devueltas significa que el ON CONFLICT actuo: ya hay un pedido
	// con esa clave. Se relee y se devuelve, con nuevo=false.
	existente, err := r.PorClave(ctx, n.UsuarioID, n.ClaveIdempotencia)
	if err != nil {
		return nil, false, err
	}
	return existente, false, nil
}

// porID relee un pedido entero, con quien recibio pegado.
//
// **Es la unica forma de leer un pedido en este repositorio**, y por eso la usan
// tanto crear como mover: dos caminos de lectura son dos oportunidades de que
// uno se olvide de un campo.
func (r *Repositorio) porID(ctx context.Context, id string) (*Pedido, error) {
	return escanear(r.pool.QueryRow(ctx,
		`SELECT `+columnas+desdePedidos+` WHERE pedidos.id = $1`, id))
}

// PorClave devuelve el pedido creado con una clave de idempotencia.
//
// Toma el usuario ademas de la clave porque la unicidad es POR USUARIO: buscar
// solo por clave podria devolver el pedido de otra persona.
func (r *Repositorio) PorClave(ctx context.Context, usuarioID, clave string) (*Pedido, error) {
	const sql = `SELECT ` + columnas + desdePedidos + `
		WHERE usuario_id = $1 AND clave_idempotencia = $2`

	p, err := escanear(r.pool.QueryRow(ctx, sql, usuarioID, clave))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoExiste
	}
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer el pedido por clave: %w", err)
	}
	return p, nil
}

// PorUsuario devuelve los pedidos de una persona, del mas reciente al mas viejo.
//
// **Toma el usuario por parametro y no admite filtro alguno que lo esquive.**
// Es lo que implementa FR-017 en la capa que toca la base, en vez de confiar en
// que todos los handlers se acuerden.
func (r *Repositorio) PorUsuario(ctx context.Context, usuarioID string) ([]*Pedido, error) {
	const sql = `SELECT ` + columnas + desdePedidos + `
		WHERE usuario_id = $1 ORDER BY creado_en DESC`
	return r.consultar(ctx, sql, usuarioID)
}

// Todos devuelve todos los pedidos, por fecha y hora de retiro.
//
// Se ordena por CUANDO SE RETIRA y no por cuando se cargo: es el dia de trabajo
// de quien administra, no un registro cronologico de altas.
//
// Quien puede llamar a esto lo decide el handler contra la configuracion del
// entorno (FR-022 de `006`). El repositorio no conoce el concepto de
// administrador y no debe conocerlo.
func (r *Repositorio) Todos(ctx context.Context) ([]*Pedido, error) {
	const sql = `SELECT ` + columnas + desdePedidos + `
		ORDER BY retiro_fecha DESC, retiro_hora DESC`
	return r.consultar(ctx, sql)
}

func (r *Repositorio) consultar(ctx context.Context, sql string, args ...any) ([]*Pedido, error) {
	filas, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer los pedidos: %w", err)
	}
	defer filas.Close()

	// Se inicializa vacia y no nil: una lista sin pedidos tiene que serializarse
	// como [] y no como null. Un null obliga a cada consumidor a defenderse.
	pedidos := []*Pedido{}
	for filas.Next() {
		p, err := escanear(filas)
		if err != nil {
			return nil, fmt.Errorf("no se pudo leer un pedido: %w", err)
		}
		pedidos = append(pedidos, p)
	}
	return pedidos, filas.Err()
}

// EstadoValido dice si un texto es uno de los tres estados del ciclo de vida.
//
// Existe como funcion y no como comparacion suelta porque la comprueban dos
// capas: el handler, para contestar 400 con un mensaje legible, y el
// repositorio, para no confiar en que lo hicieron. El CHECK de la base es la
// tercera, y es la unica que no se puede saltear — pero su mensaje de error no
// se le puede mostrar a nadie.
func EstadoValido(estado string) bool {
	switch estado {
	case EstadoCreacion, EstadoAceptacion, EstadoEntrega:
		return true
	default:
		return false
	}
}

// CambiarEstado mueve un pedido a un estado y deja la fila de historial.
//
// **Recibe el estado DESTINO, no una transicion** (contrato seccion 1). Es lo
// que hace la operacion idempotente sin llevar la cuenta de donde venia: tocar
// "entregado" dos veces —cosa que pasa con guantes y sol de frente— deja el
// mismo resultado que tocarlo una.
//
// **Acepta cualquiera de los tres estados en cualquier direccion** (FR-004).
// No hay maquina de estados que impida volver atras: deshacer es un requisito,
// no un accidente, porque quien marca "entregado" de mas necesita corregirlo
// desde la calle y no llamando a alguien.
//
// **Las dos escrituras van en la MISMA transaccion** (FR-014). Si el historial
// se escribiera aparte, un fallo entre las dos dejaria un pedido movido sin
// rastro, que es exactamente lo que el historial existe para impedir.
// Receptor es quien recibio el paquete, en el evento de entrega.
//
// Se pasa junto con el estado y no aparte porque **es parte del mismo hecho**:
// escribir el cambio a `entrega` sin decir quien recibio dejaria el registro a
// medias, y las dos escrituras ya comparten transaccion.
type Receptor struct {
	Nombre    string
	Documento string
}

func (r *Repositorio) CambiarEstado(
	ctx context.Context, id, estado string, receptor *Receptor,
) (*Pedido, error) {
	if !EstadoValido(estado) {
		return nil, ErrEstadoInvalido
	}

	var p *Pedido
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		// FOR UPDATE, y no un SELECT pelado. Entre leer el estado actual y
		// escribir el nuevo hay una ventana; sin el bloqueo, dos toques
		// simultaneos pueden leer los dos "creacion" y escribir los dos su fila
		// de historial, que es justo el duplicado que FR-009 evita.
		//
		// Hoy hay un solo repartidor y la carrera es improbable. Cuesta una
		// palabra y deja de depender de que siga habiendo uno solo.
		var actual string
		err := tx.QueryRow(ctx,
			`SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE`, id).Scan(&actual)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return ErrNoExiste
		case esIDMalFormado(err):
			// Un id que no es un uuid no puede nombrar ningun pedido, asi que
			// "no existe" es la respuesta verdadera y 404 el codigo correcto.
			// Dejarlo escapar daria 500, o sea le echaria la culpa al servicio
			// por una URL mal escrita.
			return ErrNoExiste
		case err != nil:
			return fmt.Errorf("no se pudo leer el estado actual: %w", err)
		}

		if actual == estado {
			// **FR-009: el mismo estado NO agrega una fila al historial.** Se
			// relee y se devuelve el pedido tal cual, sin tocar
			// `actualizado_en`: no paso nada, y registrar que no paso nada
			// ensucia el unico registro que este feature agrega.
			p, err = escanear(tx.QueryRow(ctx,
				`SELECT `+columnas+desdePedidos+` WHERE pedidos.id = $1`, id))
			if err != nil {
				return fmt.Errorf("no se pudo releer el pedido: %w", err)
			}
			return nil
		}

		// **El UPDATE ya no puede devolver el pedido con RETURNING.** Desde
		// `016` las columnas incluyen a quien recibio, que sale de un LATERAL
		// sobre `pedidos_estados` — y esa fila todavia no existe cuando el
		// UPDATE corre. Se mueve el estado, se escribe el historial, y recien
		// entonces se relee: es el unico orden en el que el pedido devuelto
		// puede traer al receptor que se acaba de registrar.
		if _, err := tx.Exec(ctx,
			`UPDATE pedidos SET estado = $2, actualizado_en = now() WHERE id = $1`,
			id, estado); err != nil {
			return fmt.Errorf("no se pudo mover el estado: %w", err)
		}

		// `ocurrido_en` lo pone la base con su now(), que dentro de una
		// transaccion es el instante en que la transaccion empezo. No se manda
		// desde Go a proposito: la hora del proceso y la de la base pueden
		// diferir, y el orden del historial tiene que ser el de una sola de las
		// dos.
		//
		// **El receptor se guarda solo en el evento de entrega.** En cualquier
		// otro cambio va nulo, aunque el llamador lo mande: quien recibio no
		// tiene sentido en un pedido que se acaba de tomar, y guardarlo ahi
		// ensuciaria el registro que este dato existe para conservar.
		var nombre, documento *string
		if receptor != nil && estado == EstadoEntrega {
			nombre = &receptor.Nombre
			if receptor.Documento != "" {
				documento = &receptor.Documento
			}
		}

		if _, err := tx.Exec(ctx,
			`INSERT INTO pedidos_estados (pedido_id, estado, receptor_nombre, receptor_documento)
			 VALUES ($1, $2, $3, $4)`,
			id, estado, nombre, documento); err != nil {
			return fmt.Errorf("no se pudo escribir el historial: %w", err)
		}

		// **Deshacer una entrega BORRA quien recibio, y no es por la pantalla.**
		//
		// Que no se muestre ya lo resuelve la consulta de lectura. Esto es otra
		// cosa: si la entrega se deshizo, **guardar la cedula de esa persona
		// dejo de tener proposito**. Es el documento de un tercero que no tiene
		// nada que ver con un pedido que volvio a estar pendiente, y
		// `SECURITY.md` dice que somos responsables de el mientras lo tengamos.
		// Lo pidio Mateo el 2026-08-31, y pidio lo correcto: **la columna, no la
		// fila**.
		//
		// **La fila se queda.** El historial sigue contando que hubo una entrega
		// y que despues se revirtio, que es justo lo que esa tabla existe para
		// conservar. Lo que se va es el dato personal, no el hecho.
		//
		// Se limpian TODAS las filas de entrega del pedido y no solo la ultima:
		// si alguna quedo con datos de una vuelta anterior, tampoco tiene
		// proposito ahora.
		if estado != EstadoEntrega {
			if _, err := tx.Exec(ctx,
				`UPDATE pedidos_estados
				 SET receptor_nombre = NULL, receptor_documento = NULL
				 WHERE pedido_id = $1 AND estado = $2`,
				id, EstadoEntrega); err != nil {
				return fmt.Errorf("no se pudo limpiar el receptor al deshacer: %w", err)
			}
		}

		p, err = escanear(tx.QueryRow(ctx,
			`SELECT `+columnas+desdePedidos+` WHERE pedidos.id = $1`, id))
		if err != nil {
			return fmt.Errorf("no se pudo releer el pedido movido: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return p, nil
}

// esIDMalFormado reconoce el error de Postgres para un texto que no es un uuid.
//
// 22P02 es `invalid_text_representation`. Se mira el SQLSTATE y no el texto del
// mensaje porque el texto cambia con la version y con el idioma del servidor.
func esIDMalFormado(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}
