package rastro

import (
	"context"
	"fmt"
	"time"
)

// Purgar borra el rastro mas viejo que la retencion configurada.
//
// FR-022c: el rastro se guarda por un plazo acotado y conocido, no
// indefinidamente. Son datos personales de clientes reales, es la tabla que mas
// rapido crece, y es la que menos falta hace conservar.
//
// Es la unica entidad del feature que se borra sola. La excepcion esta escrita
// en las Assumptions del spec: el borrado de cuenta a pedido del usuario NO
// esta en este feature y quedo declarado como deuda.
//
// Devuelve cuantas filas borro, para que el janitor lo pueda registrar.
func (r *Registro) Purgar(ctx context.Context, retencion time.Duration) (int64, error) {
	if retencion <= 0 {
		return 0, fmt.Errorf("la retencion tiene que ser mayor a cero, es %s", retencion)
	}

	const sql = `DELETE FROM rastro_ingresos WHERE ocurrido_en < now() - $1::interval`

	// La duracion va como intervalo de Postgres para que el corte lo decida el
	// reloj de la base y no el del proceso. Es la misma razon por la que la
	// validez del codigo se decide del lado del servidor y no del dispositivo.
	etiqueta, err := r.pool.Exec(ctx, sql, retencion.String())
	if err != nil {
		return 0, fmt.Errorf("purgando el rastro: %w", err)
	}
	return etiqueta.RowsAffected(), nil
}
