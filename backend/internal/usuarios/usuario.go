// Package usuarios guarda quien puede pedir.
//
// La identidad es la direccion de mail verificada, y nada mas (FR-007a). Por
// donde entro —Google o codigo— no se guarda aca: es la forma de probar que la
// direccion es suya, no quien es. Eso vive en el rastro.
//
// Dos reglas gobiernan el paquete, y las dos existen para que un cliente no
// pierda su perfil sin entender por que:
//
//   - **El mail se normaliza a minusculas siempre**, en un solo lugar. Si la
//     normalizacion se hiciera en cada llamada, alcanza que una la olvide para
//     que "Diego@x.com" y "diego@x.com" sean dos usuarios distintos.
//   - **Un alta a medias se retoma, no se choca** (FR-021b). Quien verifica su
//     identidad y cierra el navegador antes de cargar nombre y telefono deja una
//     fila con perfil_completo en false. Al volver cae en esa misma fila.
//
// No hay contrasena y no debe aparecer nunca (FR-005). No hay columna de
// administrador: eso se decide comparando el mail contra el entorno (FR-022).
package usuarios

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// ErrNoExiste lo devuelve quien busca por identificador y no encuentra.
//
// Existe para que el llamador distinga "no hay tal usuario" de "la base fallo".
// Los dos son un error; solo uno es culpa de quien pregunta.
var ErrNoExiste = errors.New("usuario inexistente")

// Usuario es quien puede crear pedidos.
//
// Nombre y telefono son punteros y no cadenas: la diferencia entre "todavia no
// lo cargo" y "lo cargo vacio" es exactamente lo que distingue un alta en curso
// de una terminada, y una cadena vacia borraria esa distincion.
type Usuario struct {
	ID       string
	Email    string
	Nombre   *string
	Telefono *string

	// PerfilCompleto es false entre el primer ingreso y la carga de nombre y
	// telefono (FR-021b). Una fila en false es un alta EN CURSO, no un usuario
	// creado a medias: es un estado esperado, no una anomalia.
	PerfilCompleto bool

	// Direccion de retiro guardada. Los cuatro van juntos o no van: una
	// direccion a medias no precarga nada. US4 (T054 en adelante) es quien los
	// escribe; aca se leen para no tener que releer la fila despues.
	//
	// Es un dato de CONVENIENCIA, no de cobro (FR-019b).
	RetiroCalle   *string
	RetiroEsquina *string
	RetiroNumero  *string
	RetiroPunto   *Punto

	CreadoEn      time.Time
	ActualizadoEn time.Time
}

// Punto es la ubicacion de retiro guardada, en lat/lng.
type Punto struct {
	Lat float64
	Lng float64
}

// NormalizarEmail deja la direccion en la unica forma en que se guarda.
//
// Es exportada porque el rastro y los limites de frecuencia tienen que agrupar
// por la MISMA clave con la que se guardan los usuarios. Dos normalizaciones
// distintas conviviendo es como un limite por direccion se puede esquivar
// escribiendo el mail con una mayuscula.
func NormalizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Repositorio lee y escribe usuarios.
type Repositorio struct {
	pool *db.Pool
}

func Nuevo(pool *db.Pool) *Repositorio {
	return &Repositorio{pool: pool}
}

// columnas es la lista unica con la que se leen usuarios.
//
// Esta en una constante y no repetida en cada consulta porque el orden tiene
// que coincidir con escanear(); separarlos es como se agrega una columna y se
// rompen tres consultas que nadie volvio a mirar.
const columnas = `
	id, email, nombre, telefono, perfil_completo,
	retiro_calle, retiro_esquina, retiro_numero,
	ST_Y(retiro_punto::geometry), ST_X(retiro_punto::geometry),
	creado_en, actualizado_en`

// escanear arma un Usuario desde una fila con el orden de columnas.
func escanear(fila pgx.Row) (*Usuario, error) {
	var u Usuario
	// El punto se lee como dos nulables y se rearma despues: PostGIS puede
	// devolver NULL en las dos coordenadas y no hay geografia que construir.
	var lat, lng *float64

	err := fila.Scan(
		&u.ID, &u.Email, &u.Nombre, &u.Telefono, &u.PerfilCompleto,
		&u.RetiroCalle, &u.RetiroEsquina, &u.RetiroNumero,
		&lat, &lng,
		&u.CreadoEn, &u.ActualizadoEn,
	)
	if err != nil {
		return nil, err
	}

	if lat != nil && lng != nil {
		u.RetiroPunto = &Punto{Lat: *lat, Lng: *lng}
	}

	return &u, nil
}

// BuscarOCrear devuelve el usuario de esa direccion, creandolo si es la primera
// vez que aparece.
//
// Es la operacion que implementa FR-007a: los dos caminos de ingreso —Google y
// codigo— terminan aca, y sobre la misma direccion caen en la misma fila. El
// camino por el que se entro no cambia nada de lo que se guarda.
//
// Se resuelve en UNA sentencia y no en "buscar, y si no esta insertar" a
// proposito. Dos ingresos simultaneos de la misma direccion —el mismo cliente
// tocando dos veces porque la primera parecio no responder— corren la carrera
// entre el SELECT y el INSERT, y el perdedor se lleva un error de unicidad en
// la cara. `ON CONFLICT` la cierra dentro de la base, que es el unico lugar
// donde se puede cerrar de verdad.
//
// El usuario nuevo nace con perfil_completo en false: FR-021b. Completarlo es
// PUT /yo, no esta funcion.
func (r *Repositorio) BuscarOCrear(ctx context.Context, email string) (*Usuario, error) {
	email = NormalizarEmail(email)
	if email == "" {
		return nil, errors.New("email vacio")
	}

	// El DO UPDATE es un no-op deliberado y no un descuido: ON CONFLICT DO
	// NOTHING no devuelve fila cuando el usuario ya existia, y entonces habria
	// que consultarlo de nuevo. Tocar email con su propio valor hace que
	// RETURNING devuelva siempre la fila, exista o no de antes.
	const sql = `
		INSERT INTO usuarios (email)
		VALUES ($1)
		ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
		RETURNING ` + columnas

	u, err := escanear(r.pool.QueryRow(ctx, sql, email))
	if err != nil {
		return nil, fmt.Errorf("buscar o crear usuario: %w", err)
	}
	return u, nil
}

// PorID devuelve el usuario de una credencial ya resuelta.
//
// Lo usa el middleware de sesion en cada request autenticada.
func (r *Repositorio) PorID(ctx context.Context, id string) (*Usuario, error) {
	const sql = `SELECT ` + columnas + ` FROM usuarios WHERE id = $1`

	u, err := escanear(r.pool.QueryRow(ctx, sql, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoExiste
	}
	if err != nil {
		return nil, fmt.Errorf("buscar usuario por id: %w", err)
	}
	return u, nil
}

// PorEmail devuelve el usuario de una direccion, si existe.
func (r *Repositorio) PorEmail(ctx context.Context, email string) (*Usuario, error) {
	const sql = `SELECT ` + columnas + ` FROM usuarios WHERE email = $1`

	u, err := escanear(r.pool.QueryRow(ctx, sql, NormalizarEmail(email)))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoExiste
	}
	if err != nil {
		return nil, fmt.Errorf("buscar usuario por email: %w", err)
	}
	return u, nil
}

// CompletarAlta guarda nombre y telefono, y da el perfil por completo.
//
// Es lo que cierra el alta por los dos caminos (FR-021a), y por eso pone
// perfil_completo en true en la MISMA sentencia que escribe los dos campos. Que
// sean dos escrituras separadas es como se llega a una fila declarada completa
// sin nombre — el `CHECK` de la migracion lo rechazaria, pero la forma correcta
// de no chocar contra una restriccion es no poder violarla.
//
// Se puede volver a llamar: editar el nombre despues del alta es el mismo
// camino, no uno nuevo.
func (r *Repositorio) CompletarAlta(ctx context.Context, id, nombre, telefono string) (*Usuario, error) {
	nombre = strings.TrimSpace(nombre)
	telefono = strings.TrimSpace(telefono)
	if nombre == "" || telefono == "" {
		return nil, errors.New("nombre y telefono son obligatorios")
	}

	const sql = `
		UPDATE usuarios
		SET nombre = $2, telefono = $3, perfil_completo = true, actualizado_en = now()
		WHERE id = $1
		RETURNING ` + columnas

	u, err := escanear(r.pool.QueryRow(ctx, sql, id, nombre, telefono))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoExiste
	}
	if err != nil {
		return nil, fmt.Errorf("completar alta: %w", err)
	}
	return u, nil
}
