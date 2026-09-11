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
func (r *Repositorio) Cargas(ctx context.Context) ([]Carga, error) {
	filas, err := r.pool.Query(ctx, `
		SELECT creado_en, cantidad, usuario_id
		FROM pedidos
		ORDER BY creado_en ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer las cargas: %w", err)
	}
	defer filas.Close()

	// Vacia y no nil: sin pedidos, la respuesta tiene que decir `[]` y no
	// `null`. Es el mismo criterio que `pedidos.consultar`.
	cargas := []Carga{}
	for filas.Next() {
		var c Carga
		if err := filas.Scan(&c.CreadoEn, &c.Cantidad, &c.ClienteID); err != nil {
			return nil, fmt.Errorf("no se pudo leer una carga: %w", err)
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
func (r *Repositorio) Clientes(ctx context.Context) ([]Cliente, error) {
	filas, err := r.pool.Query(ctx, `
		SELECT id, nombre, email
		FROM usuarios
		ORDER BY nombre IS NULL, lower(nombre), email`)
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
