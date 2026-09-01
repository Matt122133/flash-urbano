package avisos_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/auth"
	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Las direcciones administradoras de la prueba.
//
// **Son dos y no una a proposito**: es la forma real del problema desde el dia
// uno (FR-018). El telefono de Diego trabaja y el de Mateo verifica, y una
// implementacion que devolviera solo el primero pasaria cualquier prueba escrita
// con un solo administrador.
var admins = []string{"diego@example.com", "mateo@example.com"}

// baseDePrueba deja la base limpia y devuelve con que hablarle.
//
// Como en internal/auth, internal/db e internal/usuarios, **se saltea sola sin
// TEST_DATABASE_URL**. Un `go test ./...` en verde sin esa variable no dice nada
// de este archivo: lo que se prueba aca es una consulta.
func baseDePrueba(t *testing.T) (*db.Pool, *auth.Sesiones) {
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

	// Mismo orden que en internal/auth, y lo fija la cadena de ON DELETE
	// RESTRICT: pedidos_estados -> pedidos -> usuarios. Las sesiones se van por
	// la cascada de usuarios.
	for _, tabla := range []string{"pedidos_estados", "pedidos", "usuarios"} {
		if _, err := pool.Exec(ctx, "DELETE FROM "+tabla); err != nil {
			t.Fatalf("limpiando %s: %v", tabla, err)
		}
	}

	return pool, auth.NuevasSesiones(pool, time.Hour)
}

// unTelefonoConSesion crea un usuario, le abre una sesion, y le hace declarar un
// token como lo haria la app: **por la cabecera**, no escribiendo la columna a
// mano.
//
// Que pase por `Resolver` es lo que hace que esta prueba cubra el camino real y
// no una version idealizada de el.
func unTelefonoConSesion(t *testing.T, pool *db.Pool, ses *auth.Sesiones, email, push string) string {
	t.Helper()
	ctx := context.Background()

	u, err := usuarios.Nuevo(pool).BuscarOCrear(ctx, email)
	if err != nil {
		t.Fatalf("creando el usuario %s: %v", email, err)
	}

	_, credencial, err := ses.Crear(ctx, u.ID)
	if err != nil {
		t.Fatalf("creando la sesion de %s: %v", email, err)
	}

	if _, err := ses.Resolver(conPushToken(push), credencial); err != nil {
		t.Fatalf("declarando el push token de %s: %v", email, err)
	}
	return credencial
}

// conPushToken arma el contexto **pasando por el middleware de verdad**, y no
// metiendo el valor en el contexto a mano.
//
// La diferencia importa: asi la prueba cubre tambien que el token sobreviva la
// validacion, que es el camino que recorre el token real de la app.
func conPushToken(push string) context.Context {
	peticion := httptest.NewRequest(http.MethodGet, "/admin/pedidos", nil)
	if push != "" {
		peticion.Header.Set(httpx.CabeceraPushToken, push)
	}

	var ctx context.Context
	httpx.ConPushToken(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		ctx = r.Context()
	})).ServeHTTP(httptest.NewRecorder(), peticion)
	return ctx
}

func ordenados(xs []string) []string {
	copia := append([]string(nil), xs...)
	sort.Strings(copia)
	return copia
}

// TestLosDosTelefonosSonDestinatarios es FR-018 medido donde se decide.
//
// **El caso normal es dos, no uno.** Una implementacion que devolviera un solo
// token —un QueryRow en vez de un Query— pasaria una prueba escrita con un
// telefono solo y fallaria en produccion el dia que el de prueba deja de ser el
// que avisa.
func TestLosDosTelefonosSonDestinatarios(t *testing.T) {
	pool, ses := baseDePrueba(t)

	unTelefonoConSesion(t, pool, ses, "diego@example.com", "token-de-diego")
	unTelefonoConSesion(t, pool, ses, "mateo@example.com", "token-de-mateo")

	tokens, err := avisos.NuevosDestinatarios(pool, admins).Tokens(context.Background())
	if err != nil {
		t.Fatalf("buscando destinatarios: %v", err)
	}

	quiero := []string{"token-de-diego", "token-de-mateo"}
	hay := ordenados(tokens)
	if len(hay) != 2 || hay[0] != quiero[0] || hay[1] != quiero[1] {
		t.Errorf("los destinatarios son %v, queria %v", hay, quiero)
	}
}

// TestRevocarLaSesionSacaAlTelefonoDelConjunto es **FR-007 y SC-008**, y la
// razon por la que el token vive en `sesiones` y no en una tabla de
// dispositivos.
//
// El procedimiento de telefono perdido que ya existe —revocar la sesion a mano
// en la base— tiene que apagarle los avisos **sin codigo escrito para eso**.
// Esta prueba fija que siga siendo cierto: sale gratis del WHERE, y lo que sale
// gratis se pierde en silencio cuando alguien reescribe la consulta.
func TestRevocarLaSesionSacaAlTelefonoDelConjunto(t *testing.T) {
	pool, ses := baseDePrueba(t)
	ctx := context.Background()

	perdido := unTelefonoConSesion(t, pool, ses, "diego@example.com", "token-del-perdido")
	unTelefonoConSesion(t, pool, ses, "mateo@example.com", "token-de-mateo")

	dest := avisos.NuevosDestinatarios(pool, admins)

	if tokens, err := dest.Tokens(ctx); err != nil || len(tokens) != 2 {
		t.Fatalf("antes de revocar habia %v (err %v), queria dos", tokens, err)
	}

	if err := ses.Revocar(ctx, perdido); err != nil {
		t.Fatalf("revocando: %v", err)
	}

	tokens, err := dest.Tokens(ctx)
	if err != nil {
		t.Fatalf("buscando destinatarios: %v", err)
	}
	if len(tokens) != 1 || tokens[0] != "token-de-mateo" {
		t.Errorf("despues de revocar quedaron %v, queria solo el de mateo", tokens)
	}
}

// TestUnaSesionVencidaNoRecibeAvisos es el otro filtro del WHERE.
//
// Una credencial vencida no autoriza nada, y mandarle un aviso a su telefono
// seria avisarle a alguien que ya no puede entrar a ver el pedido.
func TestUnaSesionVencidaNoRecibeAvisos(t *testing.T) {
	pool, ses := baseDePrueba(t)
	ctx := context.Background()

	unTelefonoConSesion(t, pool, ses, "diego@example.com", "token-de-diego")

	// Se la vence a mano en la base: es la unica forma de fabricar el paso del
	// tiempo sin esperarlo, y el vencimiento se decide con el now() de la base.
	if _, err := pool.Exec(ctx,
		`UPDATE sesiones SET expira_en = now() - interval '1 minute'`); err != nil {
		t.Fatalf("venciendo la sesion: %v", err)
	}

	tokens, err := avisos.NuevosDestinatarios(pool, admins).Tokens(ctx)
	if err != nil {
		t.Fatalf("buscando destinatarios: %v", err)
	}
	if len(tokens) != 0 {
		t.Errorf("una sesion vencida quedo como destinataria: %v", tokens)
	}
}

// TestUnClienteNoRecibeAvisos es la guarda de privacidad de la consulta.
//
// Cualquier cliente identificado tiene sesion en esta misma tabla. Lo unico que
// los separa de Diego es la lista de direcciones administradoras, asi que un
// WHERE que se olvidara del JOIN le mandaria el aviso de un pedido —con su
// codigo y su calle de entrega— a cualquiera que hubiera entrado al sitio.
//
// Hoy ningun cliente puede tener `push_token` porque el sitio no manda la
// cabecera. Esta prueba lo declara igual: la separacion tiene que estar en el
// WHERE y no en el hecho accidental de que el navegador no habla.
func TestUnClienteNoRecibeAvisos(t *testing.T) {
	pool, ses := baseDePrueba(t)

	unTelefonoConSesion(t, pool, ses, "diego@example.com", "token-de-diego")
	unTelefonoConSesion(t, pool, ses, "cliente@example.com", "token-de-un-cliente")

	tokens, err := avisos.NuevosDestinatarios(pool, admins).Tokens(context.Background())
	if err != nil {
		t.Fatalf("buscando destinatarios: %v", err)
	}
	if len(tokens) != 1 || tokens[0] != "token-de-diego" {
		t.Errorf("los destinatarios son %v, queria solo el de diego", tokens)
	}
}

// TestSinTelefonosNoEsUnError fija que el conjunto vacio es un resultado y no un
// fallo.
//
// Nadie con la app instalada, el permiso de avisos negado, o el unico telefono
// con la sesion revocada dan todos lo mismo: no hay a quien avisarle. Que eso
// devolviera error haria que un pedido perfectamente guardado dejara una linea
// de error en el registro cada vez.
func TestSinTelefonosNoEsUnError(t *testing.T) {
	pool, ses := baseDePrueba(t)

	// Una sesion administradora viva que **nunca declaro token**: es el estado
	// exacto de la app antes de que Diego conceda el permiso.
	unTelefonoConSesion(t, pool, ses, "diego@example.com", "")

	tokens, err := avisos.NuevosDestinatarios(pool, admins).Tokens(context.Background())
	if err != nil {
		t.Fatalf("sin destinatarios devolvio error: %v", err)
	}
	if len(tokens) != 0 {
		t.Errorf("aparecieron destinatarios donde no habia ninguno: %v", tokens)
	}
}

// TestOlvidarBorraSoloElTokenMuerto es FR-013.
//
// **Y no toca la sesion**, que es la mitad que importa: que el proveedor rechace
// un token no dice nada sobre si la credencial sirve. Revocar la sesion aca
// dejaria a Diego afuera de la app por haber reinstalado la app.
func TestOlvidarBorraSoloElTokenMuerto(t *testing.T) {
	pool, ses := baseDePrueba(t)
	ctx := context.Background()

	credencial := unTelefonoConSesion(t, pool, ses, "diego@example.com", "token-muerto")
	unTelefonoConSesion(t, pool, ses, "mateo@example.com", "token-vivo")

	dest := avisos.NuevosDestinatarios(pool, admins)
	if err := dest.Olvidar(ctx, "token-muerto"); err != nil {
		t.Fatalf("olvidando: %v", err)
	}

	tokens, err := dest.Tokens(ctx)
	if err != nil {
		t.Fatalf("buscando destinatarios: %v", err)
	}
	if len(tokens) != 1 || tokens[0] != "token-vivo" {
		t.Errorf("despues de olvidar quedaron %v, queria solo el vivo", tokens)
	}

	// La sesion sigue sirviendo: el telefono no recibe avisos, pero Diego entra.
	if _, err := ses.Resolver(ctx, credencial); err != nil {
		t.Errorf("olvidar el token dejo la sesion sin servir: %v", err)
	}
}
