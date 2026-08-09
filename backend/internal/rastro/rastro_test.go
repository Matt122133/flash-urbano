package rastro

import (
	"context"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Como en internal/db, estas pruebas necesitan un Postgres real y se saltan
// solas si no hay. Ver el comentario de migrate_test.go.
func registroDePrueba(t *testing.T) (*Registro, *db.Pool) {
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
	if _, err := pool.Exec(ctx, `DELETE FROM rastro_ingresos`); err != nil {
		t.Fatalf("limpiando el rastro: %v", err)
	}

	return Nuevo(pool), pool
}

// SC-012: dado un intento concreto, se puede reconstruir desde el rastro que
// paso y por que fallo.
func TestSePuedeReconstruirUnIntentoFallido(t *testing.T) {
	reg, pool := registroDePrueba(t)
	ctx := context.Background()

	reg.Anotar(ctx, Entrada{
		Email:     "Cliente@Example.com",
		Camino:    CaminoCodigo,
		Resultado: CodigoVencido,
		Origen:    "203.0.113.9",
	})

	var email, camino, resultado, origen string
	var ocurridoEn time.Time
	err := pool.QueryRow(ctx, `
		SELECT email, camino, resultado, origen, ocurrido_en
		FROM rastro_ingresos ORDER BY ocurrido_en DESC LIMIT 1
	`).Scan(&email, &camino, &resultado, &origen, &ocurridoEn)
	if err != nil {
		t.Fatalf("leyendo el rastro: %v", err)
	}

	// La direccion se normaliza igual que en usuarios: si no, buscar el rastro
	// de alguien dependeria de como escribio su mail ese dia.
	if email != "cliente@example.com" {
		t.Errorf("email: quiero normalizado, dio %q", email)
	}
	if camino != string(CaminoCodigo) || resultado != string(CodigoVencido) {
		t.Errorf("camino/resultado: dio %q/%q", camino, resultado)
	}
	if origen != "203.0.113.9" {
		t.Errorf("origen: dio %q", origen)
	}
	if ocurridoEn.IsZero() {
		t.Error("falta el momento del intento")
	}
}

// FR-022d: un bloqueo por limite y un codigo equivocado son problemas
// distintos. Si el rastro no los separa, no sirve para lo que se creo.
func TestDistingueLimiteDeCodigoEquivocado(t *testing.T) {
	reg, pool := registroDePrueba(t)
	ctx := context.Background()

	reg.Anotar(ctx, Entrada{Email: "a@example.com", Camino: CaminoCodigo, Resultado: CodigoIncorrecto})
	reg.Anotar(ctx, Entrada{Email: "b@example.com", Camino: CaminoCodigo, Resultado: LimiteExcedido})

	var conLimite int
	err := pool.QueryRow(ctx,
		`SELECT count(*) FROM rastro_ingresos WHERE resultado = $1`, LimiteExcedido).Scan(&conLimite)
	if err != nil {
		t.Fatalf("contando: %v", err)
	}
	if conLimite != 1 {
		t.Errorf("quiero 1 intento bloqueado por limite, hay %d", conLimite)
	}
}

// La base tambien tiene que rechazar un resultado que no esta en la lista: el
// CHECK es lo que impide que un typo en el codigo Go meta un valor que despues
// nadie pueda buscar.
func TestLaBaseRechazaUnResultadoDesconocido(t *testing.T) {
	_, pool := registroDePrueba(t)
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		INSERT INTO rastro_ingresos (email, camino, resultado)
		VALUES ('x@example.com', 'codigo', 'inventado')`)
	if err == nil {
		t.Error("un resultado fuera de la lista tendria que ser rechazado por el CHECK")
	}
}

// FR-022c: el rastro no se guarda indefinidamente.
func TestPurgarBorraSoloLoViejo(t *testing.T) {
	reg, pool := registroDePrueba(t)
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		INSERT INTO rastro_ingresos (email, camino, resultado, ocurrido_en) VALUES
			('viejo@example.com',  'codigo', 'exito', now() - interval '100 days'),
			('reciente@example.com','codigo', 'exito', now() - interval '10 days')`)
	if err != nil {
		t.Fatalf("sembrando: %v", err)
	}

	borradas, err := reg.Purgar(ctx, 90*24*time.Hour)
	if err != nil {
		t.Fatalf("purgando: %v", err)
	}
	if borradas != 1 {
		t.Errorf("quiero 1 fila borrada, borro %d", borradas)
	}

	var quedan int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM rastro_ingresos`).Scan(&quedan); err != nil {
		t.Fatalf("contando: %v", err)
	}
	if quedan != 1 {
		t.Errorf("tendria que quedar la fila reciente, quedan %d", quedan)
	}
}

// Una retencion de cero borraria todo el rastro en la primera pasada del
// janitor. Mejor que falle a que se lleve puesta la tabla entera.
func TestPurgarRechazaRetencionInvalida(t *testing.T) {
	reg, _ := registroDePrueba(t)

	for _, r := range []time.Duration{0, -time.Hour} {
		if _, err := reg.Purgar(context.Background(), r); err == nil {
			t.Errorf("retencion %s tendria que ser un error", r)
		}
	}
}

// FR-022b: el codigo de acceso y la credencial de sesion no se registran nunca.
//
// La garantia es de forma, no de disciplina: Entrada no tiene ningun campo
// donde pudieran entrar. Esta prueba falla si alguien agrega uno, que es
// exactamente el descuido que hay que atrapar en la revision y no en produccion.
func TestEntradaNoTieneDondeGuardarUnSecreto(t *testing.T) {
	permitidos := map[string]bool{
		"Email": true, "Camino": true, "Resultado": true, "Origen": true,
	}

	tipo := reflect.TypeOf(Entrada{})
	for i := range tipo.NumField() {
		nombre := tipo.Field(i).Name
		if !permitidos[nombre] {
			t.Errorf("Entrada tiene un campo nuevo (%q). FR-022b prohibe registrar "+
				"el codigo y la credencial: si el campo es legitimo, agregalo a la "+
				"lista; si no, sacalo", nombre)
		}
		if s := strings.ToLower(nombre); strings.Contains(s, "codigo") ||
			strings.Contains(s, "token") || strings.Contains(s, "credencial") {
			t.Errorf("Entrada.%s no puede existir: FR-022b", nombre)
		}
	}
}
