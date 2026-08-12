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

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// ErrNoExiste lo devuelve quien busca un pedido y no lo encuentra.
//
// Existe para que el llamador distinga "no hay tal pedido" de "la base fallo".
// Los dos son un error; solo uno es culpa de quien pregunta.
var ErrNoExiste = errors.New("pedido inexistente")

// Estados del ciclo de vida. Son la respuesta del cliente del 2026-08-06, que
// ademas descarto un cuarto ("confirmacion") que traia el relevamiento
// original.
//
// **Este feature solo escribe EstadoCreacion.** Los otros dos los mueve la app
// Android, y no hay endpoint que los escriba: construir el camino sin quien lo
// use deja codigo sin ejercitar que envejece mal.
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

	CreadoEn      time.Time `json:"creadoEn"`
	ActualizadoEn time.Time `json:"actualizadoEn"`
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
	paquete_tamano, cantidad,
	to_char(retiro_fecha, 'YYYY-MM-DD'), to_char(retiro_hora, 'HH24:MI'),
	destinatario_nombre, destinatario_telefono,
	precio, zona_id,
	creado_en, actualizado_en`

// escanear arma un Pedido desde una fila con el orden de columnas.
func escanear(fila pgx.Row) (*Pedido, error) {
	var p Pedido
	var lat, lng float64

	err := fila.Scan(
		&p.ID, &p.UsuarioID, &p.Codigo, &p.Estado,
		&p.RemitenteNombre, &p.RemitenteTelefono,
		&p.Retiro.Calle, &p.Retiro.Esquina, &p.Retiro.Numero, &p.Retiro.Apto, &p.Retiro.Cooperativa,
		&lat, &lng,
		&p.Entrega.Calle, &p.Entrega.Esquina, &p.Entrega.Numero, &p.Entrega.Apto, &p.Entrega.Cooperativa,
		&p.PaqueteTamano, &p.Cantidad,
		&p.RetiroFecha, &p.RetiroHora,
		&p.DestinatarioNombre, &p.DestinatarioTelefono,
		&p.Precio, &p.ZonaID,
		&p.CreadoEn, &p.ActualizadoEn,
	)
	if err != nil {
		return nil, err
	}

	// El punto del retiro es NOT NULL en el esquema, asi que siempre hay algo
	// que rearmar. La entrega no lleva punto y queda en nil.
	p.Retiro.Punto = &Punto{Lat: lat, Lng: lng}
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
	if n.Retiro.Punto == nil {
		// No deberia llegar aca: el handler valida antes. Se comprueba igual
		// porque un punto nil produciria un NOT NULL violation con un mensaje
		// que no menciona el punto.
		return nil, false, fmt.Errorf("el pedido no trae punto de retiro")
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
			$17, $18,
			$19::date, $20::time,
			$21, $22,
			$23, $24
		)
		ON CONFLICT (usuario_id, clave_idempotencia) DO NOTHING
		RETURNING ` + columnas

	fila := r.pool.QueryRow(ctx, sql,
		n.UsuarioID, n.ClaveIdempotencia,
		n.RemitenteNombre, n.RemitenteTelefono,
		n.Retiro.Calle, n.Retiro.Esquina, n.Retiro.Numero, n.Retiro.Apto, n.Retiro.Cooperativa,
		n.Retiro.Punto.Lat, n.Retiro.Punto.Lng,
		n.Entrega.Calle, n.Entrega.Esquina, n.Entrega.Numero, n.Entrega.Apto, n.Entrega.Cooperativa,
		n.PaqueteTamano, n.Cantidad,
		n.RetiroFecha, n.RetiroHora,
		n.DestinatarioNombre, n.DestinatarioTelefono,
		n.Precio, n.ZonaID,
	)

	p, err := escanear(fila)
	if err == nil {
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

// PorClave devuelve el pedido creado con una clave de idempotencia.
//
// Toma el usuario ademas de la clave porque la unicidad es POR USUARIO: buscar
// solo por clave podria devolver el pedido de otra persona.
func (r *Repositorio) PorClave(ctx context.Context, usuarioID, clave string) (*Pedido, error) {
	const sql = `SELECT ` + columnas + `
		FROM pedidos WHERE usuario_id = $1 AND clave_idempotencia = $2`

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
	const sql = `SELECT ` + columnas + `
		FROM pedidos WHERE usuario_id = $1 ORDER BY creado_en DESC`
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
	const sql = `SELECT ` + columnas + `
		FROM pedidos ORDER BY retiro_fecha DESC, retiro_hora DESC`
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
