// El reporte del mes (`029`): los envios de UNA cuenta en un periodo, para que
// Diego sepa que cobrarle.
//
// **Por que es un paquete aparte y no un parametro del tablero** (research D1):
// `internal/tablero` existe para CONTAR, y para eso le alcanza con tres campos
// por pedido. El reporte necesita la direccion de entrega de cada envio. Si eso
// viajara por la misma ruta, **cada visita al tablero** moveria el domicilio de
// entrega de todos los pedidos, para un archivo que se baja una vez por mes.
// Son dos caminos de lectura con costos distintos, y por eso son dos rutas.
//
// **Aca no hay plata, y no puede haberla.** El reporte lleva la ZONA; Diego
// aplica su lista de precios afuera del producto (constitucion 6.2.0, Principio
// V). No hay campo de importe, no se lee la columna `precio`, y
// `sin_plata_test.go` lo afirma sobre el fuente de este paquete: la guarda de
// `internal/tablero` escanea el suyo y no sabe de este.
//
// **El servicio devuelve hechos; la web formatea.** La zona sale del punto en el
// navegador, con los mismos poligonos que el formulario y la etiqueta; las
// fechas se pasan a calendario de Montevideo alla. Es el mismo reparto que
// eligio `025`, y esta bueno por el mismo motivo: en `web/lib/` hay pruebas que
// corren sin base.
package reporte

import (
	"context"
	"fmt"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Punto es una coordenada guardada. Nulo en pedidos anteriores a `011`, que no
// tienen punto de entrega — y entonces **no tienen zona**.
type Punto struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// Direccion son las partes tal como se guardaron. **No se componen aca**: la web
// las junta con la misma funcion que usan la pantalla y la etiqueta impresa,
// para que los tres no puedan divergir.
type Direccion struct {
	Calle       string  `json:"calle"`
	Esquina     string  `json:"esquina"`
	Numero      *string `json:"numero,omitempty"`
	Apto        *string `json:"apto,omitempty"`
	Cooperativa bool    `json:"cooperativa"`

	// Ausente cuando el pedido no tiene punto. **Ausente y no `null`**, por el
	// mismo criterio que `016` y `026`: deja distinguir "no hay" de "hay y no se
	// pudo leer" sin que el formateo tenga que adivinar.
	Punto *Punto `json:"punto,omitempty"`
}

// Fila es un envio, reducido a lo que hace falta para cobrar.
//
// **Una por pedido, nunca una por paquete**: la cantidad va como dato.
type Fila struct {
	Codigo string `json:"codigo"`

	// La fecha con la que se corta el periodo. `pedidos.retiro_fecha` es una
	// columna `date`, o sea una fecha de calendario: **no tiene trampa de zona
	// horaria** y viaja como `YYYY-MM-DD`.
	RetiroFecha string `json:"retiroFecha"`

	Entrega Direccion `json:"entrega"`

	// Cuando Diego marco el pedido como entregado en la app, **si lo marco**.
	//
	// **Ausente cuando no hay, y el reporte lo lista igual.** Es la mitad
	// importante del feature: si el periodo se cortara por esta fecha, cada
	// olvido suyo seria un envio facturado de menos y nada se lo avisaria.
	//
	// Es un instante en UTC; la fecha de calendario de Montevideo la calcula la
	// web, donde ya vive esa conversion desde `025`.
	EntregadoEn *time.Time `json:"entregadoEn,omitempty"`

	Cantidad int `json:"cantidad"`
}

// ---------------------------------------------------------------------------
// De donde salen
// ---------------------------------------------------------------------------

// Repositorio lee los envios de una cuenta. **Solo lee.**
type Repositorio struct {
	pool *db.Pool
}

func NuevoRepositorio(pool *db.Pool) *Repositorio {
	return &Repositorio{pool: pool}
}

// Envios devuelve los pedidos de UNA cuenta cuya fecha de retiro cae en el
// periodo, inclusive en los dos extremos, del mas viejo al mas nuevo.
//
// **El WHERE por cuenta no es un filtro de comodidad: es FR-006.** El archivo se
// le pasa al cliente, y si el servicio no sabe contestar "todas las cuentas",
// entonces no hay apuro ni request armada a mano que le muestre a un cliente las
// direcciones de otro. Quien llama no puede pedir "todos" — no hay forma.
//
// **Se corta por `retiro_fecha` y no por la fecha de entrega**, y eso es plata:
// la fecha de entrega solo existe si Diego marco el pedido en la app, asi que
// cortar por ella dejaria afuera, en silencio, cada pedido que se le olvido
// marcar. `retiro_fecha` existe siempre.
//
// La fecha sale con `to_char` y no como `time.Time` **por la misma razon que en
// `internal/pedidos`**: `retiro_fecha` es una fecha de calendario, y dejar que
// el driver la convierta en un instante la ata a la zona del proceso —UTC en
// Railway— y reintroduce por la puerta de atras el error de un dia que el
// esquema evito.
func (r *Repositorio) Envios(ctx context.Context, cuenta, desde, hasta string) ([]Fila, error) {
	filas, err := r.pool.Query(ctx, `
		SELECT
			p.codigo,
			to_char(p.retiro_fecha, 'YYYY-MM-DD'),
			p.entrega_calle, p.entrega_esquina, p.entrega_numero,
			p.entrega_apto, p.entrega_cooperativa,
			ST_Y(p.entrega_punto::geometry), ST_X(p.entrega_punto::geometry),
			entregado.ocurrido_en,
			p.cantidad
		FROM pedidos p
		LEFT JOIN LATERAL (
			SELECT pe.ocurrido_en
			FROM pedidos_estados pe
			WHERE pe.pedido_id = p.id AND pe.estado = 'entrega'
			ORDER BY pe.ocurrido_en DESC, pe.id DESC
			LIMIT 1
		) entregado ON true
		WHERE p.usuario_id = $1
		  AND p.retiro_fecha >= $2::date
		  AND p.retiro_fecha <= $3::date
		ORDER BY p.retiro_fecha ASC, p.id ASC`, cuenta, desde, hasta)
	if err != nil {
		return nil, fmt.Errorf("no se pudieron leer los envios: %w", err)
	}
	defer filas.Close()

	// Vacia y no nil: sin envios la respuesta dice `[]` y no `null`. Mismo
	// criterio que el resto del servicio.
	envios := []Fila{}
	for filas.Next() {
		var f Fila
		// **Punteros, y cada uno por su motivo.** El punto es nulo en los pedidos
		// anteriores a `011` —eso ya tumbo produccion una vez, el 2026-08-23— y
		// el instante de entrega es nulo en todo pedido que Diego no marco, que
		// es el caso que este feature existe para no perder.
		var lat, lng *float64
		var entregadoEn *time.Time

		if err := filas.Scan(
			&f.Codigo,
			&f.RetiroFecha,
			&f.Entrega.Calle, &f.Entrega.Esquina, &f.Entrega.Numero,
			&f.Entrega.Apto, &f.Entrega.Cooperativa,
			&lat, &lng,
			&entregadoEn,
			&f.Cantidad,
		); err != nil {
			return nil, fmt.Errorf("no se pudo leer un envio: %w", err)
		}

		if lat != nil && lng != nil {
			f.Entrega.Punto = &Punto{Lat: *lat, Lng: *lng}
		}
		if entregadoEn != nil {
			// **En UTC, explicito**, igual que el tablero: el driver lo devuelve
			// en la zona del PROCESO, asi que la misma base contesta `-03:00` en
			// una maquina de desarrollo y `Z` en Railway. La web lo pasa a fecha
			// de Montevideo; lo que viaja no puede depender de donde corre el
			// servicio.
			enUTC := entregadoEn.UTC()
			f.EntregadoEn = &enUTC
		}

		envios = append(envios, f)
	}
	return envios, filas.Err()
}
