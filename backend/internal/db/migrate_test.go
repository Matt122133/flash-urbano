package db

import (
	"context"
	"os"
	"testing"
	"time"
)

// Estas pruebas necesitan un Postgres real con PostGIS disponible, porque lo
// que verifican —que las migraciones corran desde vacio (SC-011)— no se puede
// simular: un doble de prueba diria que si a cualquier SQL, incluido el que
// esta mal escrito.
//
// Se saltan solas si no hay base, para que `go test ./...` siga verde en una
// maquina sin Postgres. La contrapartida hay que decirla en voz alta: cuando se
// saltan, SC-011 NO queda verificado por el verify: del plan. Queda verificado
// por el arranque real del servicio en Railway, que aplica estas mismas
// migraciones (T019).
//
// Para correrlas:
//
//	TEST_DATABASE_URL='postgres://...' go test ./internal/db/
//
// La base tiene que ser DESECHABLE: el test borra las tablas del feature antes
// de empezar, que es lo que hace que "desde vacio" signifique algo.
func baseDePrueba(t *testing.T) *Pool {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("sin TEST_DATABASE_URL: se salta la prueba contra Postgres")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancelar)

	pool, err := Abrir(ctx, url)
	if err != nil {
		t.Fatalf("no se pudo abrir la base de prueba: %v", err)
	}
	t.Cleanup(pool.Close)

	vaciar(t, ctx, pool)
	return pool
}

// vaciar deja la base como si nunca se hubiera migrado.
//
// OJO: la lista es ESTATICA, y por lo tanto hay que agregarle cada tabla nueva
// que introduzca una migracion. Olvidarse no da un error que se lea como lo que
// es: la tabla sobrevive al vaciado y la migracion siguiente choca contra si
// misma con `already exists`, apuntando al objeto equivocado —en 0003, a la
// secuencia del codigo y no a la tabla que la creo—.
//
// Y el CASCADE no salva: se lleva las claves foraneas que APUNTAN a las tablas
// listadas, no las tablas que las contienen. `pedidos` referencia a `usuarios`,
// asi que al dropear `usuarios CASCADE` se cae la FK y `pedidos` queda.
//
// Que esto sea estatico esta anotado como deuda en docs/tech-debt-tracker.md.
func vaciar(t *testing.T, ctx context.Context, pool *Pool) {
	t.Helper()
	const sql = `
		DROP TABLE IF EXISTS pedidos, rastro_ingresos, codigos_acceso, sesiones,
			usuarios, migraciones_aplicadas CASCADE`
	if _, err := pool.Exec(ctx, sql); err != nil {
		t.Fatalf("no se pudo vaciar la base de prueba: %v", err)
	}
}

// SC-011: la base se levanta desde vacia aplicando las migraciones del repo,
// sin pasos manuales.
func TestMigrarDesdeVacio(t *testing.T) {
	pool := baseDePrueba(t)
	ctx := context.Background()

	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("migrar desde vacio fallo: %v", err)
	}

	for _, tabla := range []string{"usuarios", "sesiones", "codigos_acceso", "rastro_ingresos"} {
		var existe bool
		err := pool.QueryRow(ctx,
			`SELECT to_regclass($1) IS NOT NULL`, "public."+tabla).Scan(&existe)
		if err != nil {
			t.Fatalf("consultando %s: %v", tabla, err)
		}
		if !existe {
			t.Errorf("la tabla %s no quedo creada", tabla)
		}
	}
}

// Aplicar las migraciones al arrancar (research D7) significa que corren en
// CADA arranque. Si no fueran idempotentes, el segundo despliegue del dia
// tumbaria el servicio.
func TestMigrarDosVecesNoRompe(t *testing.T) {
	pool := baseDePrueba(t)
	ctx := context.Background()

	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("primera pasada: %v", err)
	}
	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("segunda pasada tendria que ser un no-op, dio: %v", err)
	}

	var aplicadas int
	if err := pool.QueryRow(ctx,
		`SELECT count(*) FROM migraciones_aplicadas`).Scan(&aplicadas); err != nil {
		t.Fatalf("contando migraciones: %v", err)
	}
	archivos, err := listarMigraciones()
	if err != nil {
		t.Fatalf("listando migraciones: %v", err)
	}
	if aplicadas != len(archivos) {
		t.Errorf("cada migracion se registra una sola vez: hay %d archivos y %d filas",
			len(archivos), aplicadas)
	}
}

// PostGIS se habilita en 0001 aunque este feature no consulte geometria. Si la
// extension no quedara instalada, el fallo apareceria recien en 007, cuando ya
// haya datos reales que migrar.
func TestPostgisQuedaHabilitado(t *testing.T) {
	pool := baseDePrueba(t)
	ctx := context.Background()

	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("migrar: %v", err)
	}

	var tipo string
	err := pool.QueryRow(ctx, `
		SELECT format_type(a.atttypid, a.atttypmod)
		FROM pg_attribute a
		WHERE a.attrelid = 'usuarios'::regclass AND a.attname = 'retiro_punto'
	`).Scan(&tipo)
	if err != nil {
		t.Fatalf("leyendo el tipo de retiro_punto: %v", err)
	}
	if tipo == "" {
		t.Error("retiro_punto tendria que ser una geografia de PostGIS")
	}
}

// La resolucion de la contradiccion entre FR-021a y FR-021b, hecha restriccion:
// el esquema deja crear la fila a medias del primer ingreso, pero no deja
// declararla completa sin nombre y telefono.
func TestPerfilCompletoExigeNombreYTelefono(t *testing.T) {
	pool := baseDePrueba(t)
	ctx := context.Background()

	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("migrar: %v", err)
	}

	// El alta en curso de FR-021b: existe, incompleta, y se puede escribir.
	_, err := pool.Exec(ctx,
		`INSERT INTO usuarios (email) VALUES ('a-medias@example.com')`)
	if err != nil {
		t.Fatalf("una fila sin nombre ni telefono tiene que poder existir (FR-021b): %v", err)
	}

	// Lo que el esquema si tiene que impedir.
	_, err = pool.Exec(ctx,
		`INSERT INTO usuarios (email, perfil_completo) VALUES ('mentira@example.com', true)`)
	if err == nil {
		t.Error("un perfil declarado completo sin nombre ni telefono tendria que ser rechazado")
	}
}

// FR-007a: una direccion, un usuario, sea cual sea el camino de ingreso.
func TestEmailEsUnicoYEnMinusculas(t *testing.T) {
	pool := baseDePrueba(t)
	ctx := context.Background()

	if err := Migrar(ctx, pool); err != nil {
		t.Fatalf("migrar: %v", err)
	}

	if _, err := pool.Exec(ctx,
		`INSERT INTO usuarios (email) VALUES ('cliente@example.com')`); err != nil {
		t.Fatalf("primer alta: %v", err)
	}

	if _, err := pool.Exec(ctx,
		`INSERT INTO usuarios (email) VALUES ('cliente@example.com')`); err == nil {
		t.Error("la misma direccion no puede dar dos usuarios (FR-007a)")
	}

	// Sin este CHECK, "Cliente@..." seria una segunda fila y el cliente veria
	// desaparecer su perfil sin entender por que.
	if _, err := pool.Exec(ctx,
		`INSERT INTO usuarios (email) VALUES ('Cliente@example.com')`); err == nil {
		t.Error("una direccion sin normalizar tendria que ser rechazada")
	}
}
