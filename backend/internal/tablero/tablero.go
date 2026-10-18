// Package tablero cuenta pedidos para mirar: cuantos hay registrados, y cuantos
// pedidos y paquetes entraron en cada dia, semana o mes. Es de SOLO LECTURA —no
// hay un camino que escriba— y lo ve unicamente una direccion administradora
// (`025`, specs/025-dashboard-de-diego/).
//
// **Devuelve hechos, no numeros.** Una fila minima por pedido —cuando se cargo,
// cuantos paquetes lleva, de que cuenta es— y la lista de cuentas. Agrupar por
// periodo, filtrar por cliente y sumar lo hace la web, en `web/lib/tablero.ts`,
// que es donde la zona horaria de Montevideo y el inicio de la semana tienen una
// prueba que corre siempre. Aca solo la veria una prueba contra Postgres, y esas
// se saltan solas sin TEST_DATABASE_URL (research D1).
//
// **Este paquete NO importa `internal/pedidos`, y no es un descuido.** Alla vive
// el campo con la plata de cada pedido, y la columna que la guarda: la
// constitucion prohibe leerla para un tablero (Principio V), porque registra lo
// que la regla del dia habria cobrado y no lo que Diego cobra. La forma fuerte de
// cumplir eso es que el codigo de aca **no pueda nombrarla**: sin el import, no
// hay tipo que la traiga, y la consulta propia no la lista. `sin_plata_test.go`
// lo sostiene escaneando las fuentes de este paquete; ver research D2 y D9.
//
// Si alguna vez parece mas corto reusar las columnas o el tipo de `pedidos` para
// "no repetir", la guarda se va a poner en rojo, y tiene razon.
package tablero

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Carga es un pedido reducido a lo que el tablero cuenta: cuando entro, cuantos
// paquetes lleva y de que cuenta es.
//
// **Sin id ni codigo del pedido**: el tablero cuenta, no identifica pedidos. Y
// sin ningun dato personal —remitente, destinatario, direcciones, quien
// recibio—: nada de eso cambia un conteo, asi que nada de eso viaja.
type Carga struct {
	// El instante en que el cliente confirmo el pedido, tal como lo guarda
	// `creado_en` (UTC). **La conversion a Montevideo NO se hace aca**: la hace la
	// web, donde tiene una prueba que corre siempre (research D3).
	//
	// Es la fecha con que se corta (FR-005a), elegida sobre la de retiro —el
	// cliente la puede editar mientras el pedido esta pendiente— y la de entrega
	// —solo existe para los entregados—. Esta nunca cambia: `022` edita el
	// pedido, no esta columna.
	CreadoEn time.Time `json:"creadoEn"`

	// La columna *paquetes* del corte (FR-008). Un pedido lleva al menos uno.
	Cantidad int `json:"cantidad"`

	// La CUENTA que creo el pedido, no el nombre de remitente escrito en el:
	// ese es texto libre y agruparia mal en silencio (FR-009).
	ClienteID string `json:"clienteId"`

	// Los dos de `031`, para la seccion Repartidores. **Los dos solo en un
	// pedido que sigue entregado**, y ausentes en cualquier otro: un pedido en
	// curso no se le cuenta a nadie, y la carga queda con las tres claves de
	// siempre.
	//
	// Repartidor es el mail al que quedo fija la entrega (FR-010b); ausente si
	// la entrego un administrador.
	Repartidor *string `json:"repartidor,omitempty"`

	// EntregadoEn es la ultima marca de entrega, en UTC. **Es la fecha con que
	// se corta la seccion Repartidores**, y no `CreadoEn`: al repartidor se le
	// paga por paquete entregado (research D8). La conversion a Montevideo la
	// hace la web, como la de `CreadoEn`.
	EntregadoEn *time.Time `json:"entregadoEn,omitempty"`
}

// Repartidor es una persona para el selector de la seccion Repartidores (031).
type Repartidor struct {
	Email string `json:"email"`

	// Ausente si nunca entro a la app: entonces se lo muestra por su mail.
	Nombre string `json:"nombre,omitempty"`
}

// Cliente es una cuenta, para el filtro.
type Cliente struct {
	ID string `json:"id"`

	// **Sin omitempty, a proposito**: una cuenta con el alta a medias no tiene
	// nombre, y tiene que viajar `null` —"no lo sabemos"— y no desaparecer ni
	// llegar como "" (research D6). La web muestra solo el mail en ese caso.
	Nombre *string `json:"nombre"`

	// Lo que distingue a dos clientes con el mismo nombre (US3-4): es unico en
	// la tabla y es la identidad con la que la persona entro.
	Email string `json:"email"`
}

// Repositorio lee lo que el tablero necesita. Solo lee.
type Repositorio struct {
	pool *db.Pool
}

func NuevoRepositorio(pool *db.Pool) *Repositorio {
	return &Repositorio{pool: pool}
}

// Cargas devuelve una carga por cada pedido de la base, **todos**, del mas viejo
// al mas nuevo.
//
// **Sin WHERE, y es la decision, no un olvido** (FR-004b, § Clarifications del
// 2026-09-11): ni por estado —un pedido cargado y no entregado cuenta igual—, ni
// por cuenta —tampoco se excluyen las administradoras: el dia que Diego cargue
// un pedido por un cliente de WhatsApp, ese pedido tiene que contar—. Los
// pedidos de prueba se limpian en la base, no se filtran aca.
//
// El desempate por `id` es el mismo que el de la lista de la app (`021`): un
// orden total, para que dos llamadas no devuelvan secuencias distintas.
//
// **El repartidor y la fecha de entrega salen solo de un pedido entregado**
// (031): con un `CASE` y no con un WHERE, porque el resto del tablero sigue
// contando todos. La fecha es la ULTIMA marca de entrega, la misma que usa el
// reporte: un pedido entregado, deshecho y vuelto a entregar se cuenta el dia
// de la segunda.
func (r *Repositorio) Cargas(ctx context.Context) ([]Carga, error) {
	filas, err := r.pool.Query(ctx, `
		SELECT p.creado_en, p.cantidad, p.usuario_id,
		       CASE WHEN p.estado = 'entrega' THEN p.repartidor_email END,
		       CASE WHEN p.estado = 'entrega' THEN entregado.ocurrido_en END
		FROM pedidos p
		LEFT JOIN LATERAL (
			SELECT pe.ocurrido_en
			FROM pedidos_estados pe
			WHERE pe.pedido_id = p.id AND pe.estado = 'entrega'
			ORDER BY pe.ocurrido_en DESC, pe.id DESC
			LIMIT 1
		) entregado ON true
		ORDER BY p.creado_en ASC, p.id ASC`)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer las cargas: %w", err)
	}
	defer filas.Close()

	// Vacia y no nil: sin pedidos, la respuesta tiene que decir `[]` y no
	// `null`. Es el mismo criterio que `pedidos.consultar`.
	cargas := []Carga{}
	for filas.Next() {
		var c Carga
		if err := filas.Scan(&c.CreadoEn, &c.Cantidad, &c.ClienteID, &c.Repartidor, &c.EntregadoEn); err != nil {
			return nil, fmt.Errorf("no se pudo leer una carga: %w", err)
		}
		// **En UTC, explicito.** El driver devuelve el instante en la zona del
		// PROCESO —Montevideo en una maquina de desarrollo, UTC en Railway—, y la
		// misma base respondia `-03:00` en un lado y `Z` en el otro. La web lo
		// leia bien igual, porque es el mismo instante, pero una respuesta que
		// cambia segun donde corre el servicio es una trampa para quien la mire.
		c.CreadoEn = c.CreadoEn.UTC()
		if c.EntregadoEn != nil {
			enUTC := c.EntregadoEn.UTC()
			c.EntregadoEn = &enUTC
		}
		cargas = append(cargas, c)
	}
	return cargas, filas.Err()
}

// Clientes devuelve **todas** las cuentas, tengan pedidos o no, ordenadas por
// nombre y con las que no tienen nombre al final, por mail.
//
// Incluir las que no tienen pedidos es lo que hace alcanzable US3-3 y FR-011
// —"un cliente sin pedidos muestra ceros"—: listar solo las que tienen haria que
// ese caso no pudiera pasar, que no es lo mismo que resolverlo (research D6).
//
// **Solo id, nombre y mail.** Ni telefono ni direccion guardada: el filtro no
// los necesita, asi que no salen del servicio.
//
// **Sin los repartidores** (031, FR-026, Mateo al probar en staging): tienen
// cuenta porque entran a la app, pero no son clientes. La base no lo sabe —el
// rol vive en `REPARTIDOR_EMAILS`—, asi que la lista llega por parametro.
//
// **Sin excepcion**, y lo que lo permite es FR-025: una cuenta de reparto no
// puede cargar pedidos, asi que no hay pedido que quede sin cliente que lo
// muestre. Un pedido de antes de esa regla sigue contando en el total.
func (r *Repositorio) Clientes(ctx context.Context, repartidores []string) ([]Cliente, error) {
	if repartidores == nil {
		// `= ANY(NULL)` no es falso sino nulo, y `NOT nulo` se lleva la fila.
		repartidores = []string{}
	}
	filas, err := r.pool.Query(ctx, `
		SELECT id, nombre, email
		FROM usuarios u
		WHERE NOT lower(u.email) = ANY($1)
		ORDER BY nombre IS NULL, lower(nombre), email`, repartidores)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer las cuentas: %w", err)
	}
	defer filas.Close()

	clientes := []Cliente{}
	for filas.Next() {
		var c Cliente
		if err := filas.Scan(&c.ID, &c.Nombre, &c.Email); err != nil {
			return nil, fmt.Errorf("no se pudo leer una cuenta: %w", err)
		}
		clientes = append(clientes, c)
	}
	return clientes, filas.Err()
}

// Repartidores devuelve a quienes se puede elegir en la seccion Repartidores
// (031, FR-020): **los configurados, mas cualquier mail con entregas fijas**.
//
// Lo segundo es lo que importa: alguien que dejo de repartir a mitad de mes
// sale de `REPARTIDOR_EMAILS`, pero sus entregas de ese mes siguen siendo suyas
// y Diego tiene que poder bajarle el reporte. Los administradores no aparecen,
// aunque alguna vez hayan estado en las dos listas.
//
// Orden: los configurados como estan en la configuracion, y despues los demas
// por mail.
func (r *Repositorio) Repartidores(
	ctx context.Context, configurados []string, esAdmin func(string) bool,
) ([]Repartidor, error) {
	filas, err := r.pool.Query(ctx, `
		SELECT DISTINCT repartidor_email
		FROM pedidos
		WHERE estado = 'entrega' AND repartidor_email IS NOT NULL
		ORDER BY repartidor_email`)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer los repartidores con entregas: %w", err)
	}
	conEntregas, err := pgx.CollectRows(filas, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer un repartidor con entregas: %w", err)
	}

	vistos := map[string]bool{}
	emails := []string{}
	for _, e := range append(append([]string{}, configurados...), conEntregas...) {
		if vistos[e] || (esAdmin != nil && esAdmin(e)) {
			continue
		}
		vistos[e] = true
		emails = append(emails, e)
	}

	nombres := map[string]string{}
	if len(emails) > 0 {
		filas, err := r.pool.Query(ctx,
			`SELECT email, nombre FROM usuarios WHERE email = ANY($1) AND nombre IS NOT NULL`, emails)
		if err != nil {
			return nil, fmt.Errorf("no se pudieron leer los nombres de los repartidores: %w", err)
		}
		defer filas.Close()
		for filas.Next() {
			var email, nombre string
			if err := filas.Scan(&email, &nombre); err != nil {
				return nil, fmt.Errorf("no se pudo leer un nombre: %w", err)
			}
			nombres[email] = nombre
		}
		if err := filas.Err(); err != nil {
			return nil, err
		}
	}

	// Vacia y no nil, como las otras dos listas.
	lista := []Repartidor{}
	for _, e := range emails {
		lista = append(lista, Repartidor{Email: e, Nombre: nombres[e]})
	}
	return lista, nil
}
