package auth

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Como el resto de las pruebas contra Postgres, se saltan solas si no hay base.
// Ver el comentario de migrate_test.go.
func codigosDePrueba(t *testing.T) (*Codigos, *db.Pool, context.Context) {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("sin TEST_DATABASE_URL: se salta la prueba contra Postgres")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancelar)

	pool, err := db.Abrir(ctx, url)
	if err != nil {
		t.Fatalf("abriendo la base de prueba: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := db.Migrar(ctx, pool); err != nil {
		t.Fatalf("migrando: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM codigos_acceso`); err != nil {
		t.Fatalf("limpiando codigos: %v", err)
	}

	return NuevosCodigos(pool), pool, ctx
}

// TestUnCodigoRecienEmitidoVerifica es el **control positivo**, y sin el las
// otras pruebas de este archivo no valdrian nada.
//
// Todas las demas afirman que algo NO pasa —vencido, usado y agotado son
// rechazados—, y una implementacion que rechazara absolutamente todo las
// pasaria las tres con nota perfecta. Esta es la unica que demuestra que el
// verificador sabe decir que si.
func TestUnCodigoRecienEmitidoVerifica(t *testing.T) {
	codigos, _, ctx := codigosDePrueba(t)

	codigo, err := codigos.Emitir(ctx, "alguien@example.com", "203.0.113.1")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}
	if len(codigo) != digitosDelCodigo {
		t.Fatalf("el codigo tiene %d digitos, se esperaban %d: %q", len(codigo), digitosDelCodigo, codigo)
	}

	if err := codigos.Verificar(ctx, "alguien@example.com", codigo); err != nil {
		t.Fatalf("un codigo recien emitido tendria que verificar, y dio: %v", err)
	}
}

// TestElEmailNoDistingueMayusculas cubre el caso que crearia cuentas paralelas.
func TestElEmailNoDistingueMayusculas(t *testing.T) {
	codigos, _, ctx := codigosDePrueba(t)

	codigo, err := codigos.Emitir(ctx, "  Mayuscula@Example.COM ", "")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}
	if err := codigos.Verificar(ctx, "mayuscula@example.com", codigo); err != nil {
		t.Fatalf("la misma direccion escrita distinto tendria que verificar, y dio: %v", err)
	}
}

func TestUnCodigoVencidoNoSirve(t *testing.T) {
	codigos, pool, ctx := codigosDePrueba(t)

	codigo, err := codigos.Emitir(ctx, "vencido@example.com", "")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}

	// Se envejece la fila en vez de esperar diez minutos: la prueba tiene que
	// correr en milisegundos y el reloj del sistema no es de nadie.
	if _, err := pool.Exec(ctx, `UPDATE codigos_acceso SET expira_en = now() - interval '1 second' WHERE email = $1`, "vencido@example.com"); err != nil {
		t.Fatalf("envejeciendo el codigo: %v", err)
	}

	err = codigos.Verificar(ctx, "vencido@example.com", codigo)
	if !errors.Is(err, ErrCodigoVencido) {
		t.Fatalf("un codigo vencido tendria que dar ErrCodigoVencido, y dio: %v", err)
	}
}

func TestUnCodigoYaUsadoNoSirveDeNuevo(t *testing.T) {
	codigos, _, ctx := codigosDePrueba(t)

	codigo, err := codigos.Emitir(ctx, "usado@example.com", "")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}
	if err := codigos.Verificar(ctx, "usado@example.com", codigo); err != nil {
		t.Fatalf("el primer uso tendria que andar, y dio: %v", err)
	}

	// El mismo codigo, correcto, por segunda vez (FR-011).
	err = codigos.Verificar(ctx, "usado@example.com", codigo)
	if !errors.Is(err, ErrCodigoAgotado) {
		t.Fatalf("un codigo ya usado tendria que dar ErrCodigoAgotado, y dio: %v", err)
	}
}

// TestElQuintoFalloMataElCodigo es la prueba de FR-010, y el punto fino es el
// **sexto intento con el valor correcto**.
//
// Sin esa ultima parte, la prueba solo demostraria que se cuentan los intentos.
// Lo que hay que demostrar es que despues del quinto fallo el codigo esta
// muerto **aunque quien intente ya sepa cual era**: si no, cinco intentos no son
// un limite, son una molestia.
func TestElQuintoFalloMataElCodigo(t *testing.T) {
	codigos, _, ctx := codigosDePrueba(t)

	const email = "fuerzabruta@example.com"
	codigo, err := codigos.Emitir(ctx, email, "")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}

	incorrecto := "000000"
	if codigo == incorrecto {
		incorrecto = "111111"
	}

	for i := 1; i <= maxIntentos; i++ {
		err := codigos.Verificar(ctx, email, incorrecto)
		if !errors.Is(err, ErrCodigoInvalido) {
			t.Fatalf("intento %d: se esperaba ErrCodigoInvalido y dio: %v", i, err)
		}
	}

	// El sexto, CON el valor correcto.
	err = codigos.Verificar(ctx, email, codigo)
	if !errors.Is(err, ErrCodigoAgotado) {
		t.Fatalf("tras %d fallos, el codigo correcto tendria que estar muerto y dar ErrCodigoAgotado; dio: %v", maxIntentos, err)
	}
}

// TestPedirOtroCodigoInvalidaElAnterior cubre lo que hace cualquiera que toque
// "reenviar": si el viejo siguiera sirviendo, habria dos codigos vivos por
// direccion y el limite de intentos se duplicaria sin que nadie lo note.
func TestPedirOtroCodigoInvalidaElAnterior(t *testing.T) {
	codigos, _, ctx := codigosDePrueba(t)

	const email = "reenvio@example.com"
	viejo, err := codigos.Emitir(ctx, email, "")
	if err != nil {
		t.Fatalf("emitiendo el primero: %v", err)
	}
	nuevo, err := codigos.Emitir(ctx, email, "")
	if err != nil {
		t.Fatalf("emitiendo el segundo: %v", err)
	}
	if viejo == nuevo {
		t.Fatal("dos codigos seguidos salieron iguales: la fuente aleatoria no lo es")
	}

	if err := codigos.Verificar(ctx, email, viejo); !errors.Is(err, ErrCodigoInvalido) {
		t.Fatalf("el codigo viejo tendria que dejar de servir, y dio: %v", err)
	}
	// Control positivo del mismo caso: el nuevo si anda. Sin esto, un
	// verificador roto que rechazara todo pasaria la afirmacion de arriba.
	//
	// Ojo con el orden: la linea anterior ya gasto un intento del codigo nuevo
	// —Verificar siempre incrementa— asi que esto tambien comprueba que un
	// intento fallido no invalida al codigo entero.
	if err := codigos.Verificar(ctx, email, nuevo); err != nil {
		t.Fatalf("el codigo nuevo tendria que andar, y dio: %v", err)
	}
}

// TestElCodigoEnClaroNoQuedaEnLaBase es FR-012.
func TestElCodigoEnClaroNoQuedaEnLaBase(t *testing.T) {
	codigos, pool, ctx := codigosDePrueba(t)

	const email = "enclaro@example.com"
	codigo, err := codigos.Emitir(ctx, email, "")
	if err != nil {
		t.Fatalf("emitiendo: %v", err)
	}

	var guardado []byte
	if err := pool.QueryRow(ctx, `SELECT codigo_hash FROM codigos_acceso WHERE email = $1`, email).Scan(&guardado); err != nil {
		t.Fatalf("leyendo el hash: %v", err)
	}
	if string(guardado) == codigo {
		t.Fatal("el codigo esta guardado en claro")
	}
	// Y que sea bcrypt, no un digest rapido (research D2): con SHA-256, el
	// millon de valores posibles se revierte en segundos y el hash no protege
	// nada. El prefijo lo delata.
	if len(guardado) < 4 || string(guardado[:4]) != "$2a$" {
		t.Fatalf("el hash no parece bcrypt, empieza con %q", string(guardado[:min(4, len(guardado))]))
	}
}

func TestPurgarVencidosBorraSoloLosVencidos(t *testing.T) {
	codigos, pool, ctx := codigosDePrueba(t)

	if _, err := codigos.Emitir(ctx, "vivo@example.com", ""); err != nil {
		t.Fatalf("emitiendo el vivo: %v", err)
	}
	if _, err := codigos.Emitir(ctx, "muerto@example.com", ""); err != nil {
		t.Fatalf("emitiendo el muerto: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE codigos_acceso SET expira_en = now() - interval '2 days' WHERE email = $1`, "muerto@example.com"); err != nil {
		t.Fatalf("envejeciendo: %v", err)
	}

	borradas, err := codigos.PurgarVencidos(ctx, time.Hour)
	if err != nil {
		t.Fatalf("purgando: %v", err)
	}
	if borradas != 1 {
		t.Fatalf("se esperaba borrar 1 fila, se borraron %d", borradas)
	}

	// Control positivo: el vivo sigue ahi. Una purga que borrara todo daria
	// tambien un numero, y sin esto la prueba no lo notaria.
	var quedan int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM codigos_acceso WHERE email = $1`, "vivo@example.com").Scan(&quedan); err != nil {
		t.Fatalf("contando: %v", err)
	}
	if quedan != 1 {
		t.Fatalf("la purga se llevo el codigo vivo: quedan %d", quedan)
	}
}
