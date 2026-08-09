// Package db abre la conexion a Postgres y aplica las migraciones.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool es el pool de conexiones del servicio.
type Pool = pgxpool.Pool

// Abrir crea el pool y comprueba que la base conteste antes de devolverlo.
//
// El ping no es ceremonia: sin el, un DATABASE_URL mal escrito no se descubre
// al arrancar sino en la primera request de un cliente. Vale lo mismo que la
// validacion de config — que el servicio no levante es mejor senal que un
// servicio vivo que falla.
func Abrir(ctx context.Context, url string) (*Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL invalida: %w", err)
	}

	// Railway corre una sola instancia con trafico bajo —el ADR estimo del
	// orden de un request cada tres minutos—, asi que un pool chico alcanza y
	// deja margen en el limite de conexiones del plan.
	cfg.MaxConns = 8
	cfg.MinConns = 1
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.MaxConnLifetime = time.Hour

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("no se pudo crear el pool: %w", err)
	}

	pingCtx, cancelar := context.WithTimeout(ctx, 10*time.Second)
	defer cancelar()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("la base no responde: %w", err)
	}

	return pool, nil
}
