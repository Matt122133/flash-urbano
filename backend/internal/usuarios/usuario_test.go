package usuarios

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Como en internal/db y en internal/rastro, estas pruebas necesitan un Postgres
// real y se saltan solas si no hay. Ver el comentario de migrate_test.go.
func repositorioDePrueba(t *testing.T) (*Repositorio, *db.Pool) {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("sin TEST_DATABASE_URL: se salta la prueba contra Postgres")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancelar)

	pool, err := db.Abrir(ctx, url)
	if err != nil {
		t.Fatalf("abriendo la base de prueba: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := db.Migrar(ctx, pool); err != nil {
		t.Fatalf("migrando: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM usuarios`); err != nil {
		t.Fatalf("limpiando usuarios: %v", err)
	}

	return Nuevo(pool), pool
}

// SC-010a: los dos caminos de ingreso sobre la misma direccion son la misma
// persona. Es FR-007a, y es la prueba que sostiene que el camino de ingreso no
// sea identidad.
//
// Se prueba con mayusculas distintas a proposito: la forma mas facil de romper
// esto no es olvidar el UNIQUE, es olvidar el lower() en una de las dos ramas.
func TestLosDosCaminosCaenEnElMismoUsuario(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	// Primer ingreso, digamos que por Google.
	porGoogle, err := repo.BuscarOCrear(ctx, "Cliente@Example.com")
	if err != nil {
		t.Fatalf("primer ingreso: %v", err)
	}

	if _, err := repo.CompletarAlta(ctx, porGoogle.ID, "Diego Perez", "099111222"); err != nil {
		t.Fatalf("completando el alta: %v", err)
	}

	// Mas tarde, la misma persona entra por codigo y escribe su mail distinto.
	porCodigo, err := repo.BuscarOCrear(ctx, "  cliente@example.com  ")
	if err != nil {
		t.Fatalf("segundo ingreso: %v", err)
	}

	if porCodigo.ID != porGoogle.ID {
		t.Fatalf("dos usuarios para la misma direccion: %s y %s", porGoogle.ID, porCodigo.ID)
	}
	if porCodigo.Email != "cliente@example.com" {
		t.Errorf("el email no quedo normalizado: %q", porCodigo.Email)
	}

	// Y se encuentra con su perfil, no con una fila en blanco: si el segundo
	// ingreso pisara la fila, el cliente perderia nombre y telefono sin
	// entender por que.
	if !porCodigo.PerfilCompleto {
		t.Error("el segundo ingreso perdio el perfil completo")
	}
	if porCodigo.Nombre == nil || *porCodigo.Nombre != "Diego Perez" {
		t.Errorf("el segundo ingreso perdio el nombre: %v", porCodigo.Nombre)
	}
	if porCodigo.Telefono == nil || *porCodigo.Telefono != "099111222" {
		t.Errorf("el segundo ingreso perdio el telefono: %v", porCodigo.Telefono)
	}
}

// FR-021b: un alta interrumpida se retoma al volver.
//
// El caso real es alguien que verifica su identidad y cierra el navegador antes
// de escribir su nombre. La fila queda en false, y volver tiene que llevarlo a
// donde estaba en vez de chocar contra una fila que no puede completar.
func TestUnAltaInterrumpidaSeRetoma(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	primero, err := repo.BuscarOCrear(ctx, "amedias@example.com")
	if err != nil {
		t.Fatalf("primer ingreso: %v", err)
	}
	if primero.PerfilCompleto {
		t.Fatal("un usuario recien creado no puede nacer con el perfil completo (FR-021b)")
	}
	if primero.Nombre != nil || primero.Telefono != nil {
		t.Fatalf("nace con datos que nadie cargo: %v / %v", primero.Nombre, primero.Telefono)
	}

	// Cierra el navegador. Vuelve.
	devuelta, err := repo.BuscarOCrear(ctx, "amedias@example.com")
	if err != nil {
		t.Fatalf("volviendo: %v", err)
	}
	if devuelta.ID != primero.ID {
		t.Fatalf("volver creo un usuario nuevo: %s vs %s", devuelta.ID, primero.ID)
	}
	if devuelta.PerfilCompleto {
		t.Error("el alta figura completa sin que nadie cargara nombre ni telefono")
	}

	// Y ahora si lo termina.
	completo, err := repo.CompletarAlta(ctx, devuelta.ID, "Ana", "091000111")
	if err != nil {
		t.Fatalf("completando: %v", err)
	}
	if !completo.PerfilCompleto {
		t.Error("el alta terminada no quedo marcada como completa")
	}
}

// SC-013, leido como lo define data-model.md: una fila en false es un alta EN
// CURSO, no un usuario creado. Lo que no puede existir es lo contrario — un
// alta terminada que quedo en false, o una fila declarada completa sin los
// datos que la hacen completa.
func TestNingunAltaTerminadaQuedaIncompleta(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	ctx := context.Background()

	// Las dos vias que terminan un alta, una por cada camino de ingreso.
	for _, email := range []string{"porgoogle@example.com", "porcodigo@example.com"} {
		u, err := repo.BuscarOCrear(ctx, email)
		if err != nil {
			t.Fatalf("creando %s: %v", email, err)
		}
		if _, err := repo.CompletarAlta(ctx, u.ID, "Nombre", "099000000"); err != nil {
			t.Fatalf("completando %s: %v", email, err)
		}
	}

	// La comprobacion se hace contra la BASE y no contra lo que devolvio el
	// repositorio: lo que importa es lo que quedo guardado, no lo que la
	// funcion dijo que guardaba.
	var incoherentes int
	err := pool.QueryRow(ctx, `
		SELECT count(*) FROM usuarios
		WHERE (perfil_completo AND (nombre IS NULL OR telefono IS NULL))
		   OR (NOT perfil_completo AND nombre IS NOT NULL AND telefono IS NOT NULL)
	`).Scan(&incoherentes)
	if err != nil {
		t.Fatalf("contando filas incoherentes: %v", err)
	}
	if incoherentes != 0 {
		t.Errorf("%d filas con perfil_completo que no coincide con sus datos", incoherentes)
	}
}

// FR-005: no hay contrasena, y no puede aparecer nunca. La prueba mira el
// esquema y no el codigo Go, porque el dia que alguien agregue la columna lo va
// a hacer en una migracion.
func TestNoHayColumnaDeContrasena(t *testing.T) {
	_, pool := repositorioDePrueba(t)
	ctx := context.Background()

	var columnas []string
	filas, err := pool.Query(ctx, `
		SELECT column_name FROM information_schema.columns
		WHERE table_name = 'usuarios'
		  AND (column_name ILIKE '%pass%' OR column_name ILIKE '%contrasen%'
		       OR column_name ILIKE '%clave%' OR column_name ILIKE '%hash%'
		       OR column_name ILIKE '%admin%')
	`)
	if err != nil {
		t.Fatalf("leyendo el esquema: %v", err)
	}
	defer filas.Close()

	for filas.Next() {
		var c string
		if err := filas.Scan(&c); err != nil {
			t.Fatalf("escaneando: %v", err)
		}
		columnas = append(columnas, c)
	}

	if len(columnas) > 0 {
		t.Errorf("usuarios tiene columnas que no deberia tener (FR-005, FR-022): %v", columnas)
	}
}

// El caso de carrera que ON CONFLICT existe para cerrar: la misma direccion
// entrando dos veces a la vez, que es el cliente que toca dos veces porque la
// primera parecio no responder.
func TestDosIngresosSimultaneosNoChocan(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	const cuantos = 8
	ids := make(chan string, cuantos)
	errs := make(chan error, cuantos)

	for range cuantos {
		go func() {
			u, err := repo.BuscarOCrear(ctx, "simultaneo@example.com")
			if err != nil {
				errs <- err
				return
			}
			ids <- u.ID
		}()
	}

	visto := ""
	for range cuantos {
		select {
		case err := <-errs:
			t.Fatalf("un ingreso simultaneo fallo: %v", err)
		case id := <-ids:
			if visto == "" {
				visto = id
			} else if id != visto {
				t.Fatalf("la carrera creo dos usuarios: %s y %s", visto, id)
			}
		}
	}
}
