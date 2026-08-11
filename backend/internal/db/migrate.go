package db

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/Matt122133/flash-urbano/backend/migrations"
)

// claveDeMigracion identifica el cerrojo global de migraciones.
//
// Es un numero arbitrario y fijo: los cerrojos de aviso de Postgres son un
// espacio de enteros sin nombres, asi que lo unico que importa es que nadie mas
// en esta base use el mismo. Cambiarlo tiene el efecto de quitar el cerrojo.
const claveDeMigracion int64 = 6_006_2026

// Migrar aplica las migraciones que falten, en orden de nombre.
//
// Solo hacia adelante. Cada una corre dentro de su propia transaccion junto con
// el registro de que se aplico: si el SQL falla a la mitad, no queda ni el
// cambio ni la marca, y el proximo arranque vuelve a intentarla desde un estado
// conocido. Aplicar el cambio y marcarlo por separado es como una base termina
// diciendo que esta en una version en la que no esta.
//
// **Un solo proceso migra a la vez**, garantizado por un cerrojo de aviso de
// Postgres tomado sobre la conexion que hace todo el trabajo. Sin el, dos
// arranques simultaneos contra la misma base chocan de formas que no se leen
// como lo que son: `CREATE TABLE IF NOT EXISTS` no es atomico contra si mismo y
// falla con `duplicate key ... pg_type_typname_nsp_index`, un error del
// catalogo interno que no menciona ninguna tabla nuestra.
//
// Se descubrio corriendo `go test ./...` contra un Postgres real —Go corre los
// paquetes en paralelo y cada uno migra al arrancar—, pero no es un problema de
// las pruebas: es el mismo choque que tendrian dos instancias del servicio
// levantando juntas. Hoy Railway corre una sola replica, asi que en produccion
// estaba latente y no activo. El cerrojo lo cierra en los dos lados.
//
// El que llega segundo espera —no falla— y al entrar encuentra las migraciones
// ya aplicadas, con lo que no hace nada. Es exactamente el comportamiento que se
// quiere: arrancar tarde es aceptable, arrancar sobre un esquema a medias no.
func Migrar(ctx context.Context, pool *Pool) error {
	// Todo el trabajo va sobre UNA conexion tomada del pool, porque el cerrojo
	// es de la sesion: si las consultas siguientes salieran por otra conexion,
	// el cerrojo no las estaria protegiendo.
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("no se pudo tomar una conexion para migrar: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, claveDeMigracion); err != nil {
		return fmt.Errorf("no se pudo tomar el cerrojo de migraciones: %w", err)
	}
	// Se libera explicitamente y no solo al soltar la conexion: una conexion que
	// vuelve al pool con el cerrojo tomado lo deja tomado hasta que muera.
	defer func() {
		if _, err := conn.Exec(context.WithoutCancel(ctx),
			`SELECT pg_advisory_unlock($1)`, claveDeMigracion); err != nil {
			log.Printf("migraciones: no se pudo liberar el cerrojo: %v", err)
		}
	}()

	if err := crearTablaDeControl(ctx, pool); err != nil {
		return err
	}

	aplicadas, err := yaAplicadas(ctx, pool)
	if err != nil {
		return err
	}

	archivos, err := listarMigraciones()
	if err != nil {
		return err
	}

	for _, nombre := range archivos {
		if aplicadas[nombre] {
			continue
		}
		if err := aplicar(ctx, pool, nombre); err != nil {
			return fmt.Errorf("migracion %s: %w", nombre, err)
		}
		log.Printf("migracion aplicada: %s", nombre)
	}

	return nil
}

func crearTablaDeControl(ctx context.Context, pool *Pool) error {
	const sql = `
		CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
			nombre      text PRIMARY KEY,
			aplicada_en timestamptz NOT NULL DEFAULT now()
		)`
	if _, err := pool.Exec(ctx, sql); err != nil {
		return fmt.Errorf("no se pudo crear la tabla de control: %w", err)
	}
	return nil
}

func yaAplicadas(ctx context.Context, pool *Pool) (map[string]bool, error) {
	filas, err := pool.Query(ctx, `SELECT nombre FROM migraciones_aplicadas`)
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer la tabla de control: %w", err)
	}
	defer filas.Close()

	aplicadas := map[string]bool{}
	for filas.Next() {
		var nombre string
		if err := filas.Scan(&nombre); err != nil {
			return nil, err
		}
		aplicadas[nombre] = true
	}
	return aplicadas, filas.Err()
}

// listarMigraciones devuelve los .sql ordenados por nombre.
//
// El orden lexicografico es el orden de aplicacion, y por eso los archivos se
// numeran con ancho fijo (0001, 0002...). Con numeros sin rellenar, "10" vendria
// antes que "2".
func listarMigraciones() ([]string, error) {
	entradas, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("no se pudieron listar las migraciones: %w", err)
	}

	var nombres []string
	for _, e := range entradas {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			nombres = append(nombres, e.Name())
		}
	}
	sort.Strings(nombres)
	return nombres, nil
}

func aplicar(ctx context.Context, pool *Pool, nombre string) error {
	cuerpo, err := migrations.FS.ReadFile(nombre)
	if err != nil {
		return err
	}

	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, string(cuerpo)); err != nil {
			return err
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)`, nombre)
		return err
	})
}
