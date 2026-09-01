package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Como en internal/db, internal/rastro e internal/usuarios, estas pruebas
// necesitan un Postgres real y se saltan solas si no hay. Ver el comentario de
// migrate_test.go.
func sesionesDePrueba(t *testing.T, duracion time.Duration) (*Sesiones, *db.Pool, string) {
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
	// El borrado de usuarios arrastra sus sesiones por la cascada. Lo demas se
	// borra a mano y **en este orden**, que lo fija una cadena de ON DELETE
	// RESTRICT: `pedidos_estados` -> `pedidos` -> `usuarios`. Cada eslabon hace
	// fallar el borrado del siguiente si queda algo vivo, y que el orden importe
	// es la prueba de que los RESTRICT estan puestos.
	//
	// Este paquete corre antes que `pedidos` en el orden alfabetico de
	// `go test ./...`, de modo que sin esto algo que quedo dando vueltas pone en
	// rojo a un paquete que no tiene nada que ver.
	if _, err := pool.Exec(ctx, `DELETE FROM pedidos_estados`); err != nil {
		t.Fatalf("limpiando el historial de estados: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM pedidos`); err != nil {
		t.Fatalf("limpiando pedidos: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM usuarios`); err != nil {
		t.Fatalf("limpiando usuarios: %v", err)
	}

	u, err := usuarios.Nuevo(pool).BuscarOCrear(ctx, "sesiones@example.com")
	if err != nil {
		t.Fatalf("creando el usuario de prueba: %v", err)
	}

	return NuevasSesiones(pool, duracion), pool, u.ID
}

// SC-007, el caso central de FR-018: cerrar sesion invalida la credencial **de
// inmediato**, y tambien para quien la haya copiado.
//
// Es la propiedad que justifica toda la decision D1 —token opaco contra JWT—,
// asi que si esta prueba desaparece, la decision perdio su respaldo.
func TestUnaSesionRevocadaDejaDeServirDeInmediato(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(ctx, token); err != nil {
		t.Fatalf("la sesion recien creada no sirve: %v", err)
	}

	// Alguien copio el token antes de que se cerrara la sesion.
	copiado := token

	if err := ses.Revocar(ctx, token); err != nil {
		t.Fatalf("revocando: %v", err)
	}

	// Sin esperar nada: ni un vencimiento, ni un ciclo de limpieza.
	if _, err := ses.Resolver(ctx, copiado); !errors.Is(err, ErrSesionInvalida) {
		t.Errorf("el token copiado sigue sirviendo despues de cerrar sesion: %v", err)
	}
}

// Revocar dos veces no es un error: el cliente que toca "salir" dos veces
// porque la primera no parecio responder no puede recibir un fallo.
func TestRevocarDosVecesNoFalla(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if err := ses.Revocar(ctx, token); err != nil {
		t.Fatalf("primera revocacion: %v", err)
	}
	if err := ses.Revocar(ctx, token); err != nil {
		t.Errorf("la segunda revocacion fallo: %v", err)
	}
}

// FR-017: una sesion vencida no sirve, aunque nadie la haya revocado y aunque
// la fila siga en la tabla.
func TestUnaSesionVencidaNoSirve(t *testing.T) {
	// Duracion negativa: nace vencida. Es la forma de probar el vencimiento sin
	// que la prueba tenga que esperar cuatro semanas ni manipular el reloj.
	ses, _, usuarioID := sesionesDePrueba(t, -time.Minute)
	ctx := context.Background()

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(ctx, token); !errors.Is(err, ErrSesionInvalida) {
		t.Errorf("una sesion vencida sirvio: %v", err)
	}
}

// SC-007, la otra mitad: cerrar sesion en un dispositivo no cierra los otros.
//
// Es lo que espera cualquiera, y es la razon por la que la tabla tiene varias
// filas por usuario en vez de una columna en `usuarios`.
func TestCerrarEnUnDispositivoNoCierraLosOtros(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	_, telefono, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("sesion del telefono: %v", err)
	}
	_, computadora, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("sesion de la computadora: %v", err)
	}

	if telefono == computadora {
		t.Fatal("dos sesiones distintas recibieron el mismo token")
	}

	if err := ses.Revocar(ctx, telefono); err != nil {
		t.Fatalf("revocando la del telefono: %v", err)
	}

	if _, err := ses.Resolver(ctx, telefono); !errors.Is(err, ErrSesionInvalida) {
		t.Errorf("la sesion cerrada sigue sirviendo: %v", err)
	}
	if _, err := ses.Resolver(ctx, computadora); err != nil {
		t.Errorf("cerrar en el telefono cerro tambien la computadora: %v", err)
	}
}

// El token en claro no se guarda (D1). La prueba mira la BASE y no el codigo:
// el dia que alguien agregue una columna "por comodidad", esto lo agarra.
func TestElTokenEnClaroNoQuedaEnLaBase(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	// Se busca el token como texto en todas las columnas de texto de la tabla.
	var apariciones int
	err = pool.QueryRow(ctx, `
		SELECT count(*) FROM sesiones
		WHERE CAST(sesiones.* AS text) LIKE '%' || $1 || '%'
	`, token).Scan(&apariciones)
	if err != nil {
		t.Fatalf("buscando el token en la tabla: %v", err)
	}
	if apariciones != 0 {
		t.Errorf("el token en claro aparece en %d filas de sesiones", apariciones)
	}
}

// Un token inventado no resuelve, y tampoco uno vacio. El segundo caso importa
// porque es lo que llega cuando el header viene sin valor: si eso resolviera a
// alguna sesion, cualquiera entraria sin credencial.
func TestUnTokenQueNoExisteNoResuelve(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	if _, _, err := ses.Crear(ctx, usuarioID); err != nil {
		t.Fatalf("creando una sesion valida: %v", err)
	}

	for _, caso := range []struct{ nombre, token string }{
		{"vacio", ""},
		{"inventado", "no-es-un-token"},
		{"parecido a base64", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},
	} {
		t.Run(caso.nombre, func(t *testing.T) {
			if _, err := ses.Resolver(ctx, caso.token); !errors.Is(err, ErrSesionInvalida) {
				t.Errorf("resolvio un token que no existe: %v", err)
			}
		})
	}
}

// Dos sesiones creadas seguidas no comparten token. Es lo minimo que hay que
// comprobar de un generador aleatorio: uno roto suele devolver siempre lo mismo.
func TestCadaSesionRecibeUnTokenDistinto(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	vistos := make(map[string]bool)
	for range 20 {
		_, token, err := ses.Crear(ctx, usuarioID)
		if err != nil {
			t.Fatalf("creando: %v", err)
		}
		if vistos[token] {
			t.Fatalf("token repetido: %s", token)
		}
		vistos[token] = true
	}
}

// La purga limpia lo que ya no autoriza nada y **no toca lo que si**. El
// segundo lado es el que importa: una purga demasiado ansiosa echa a clientes
// identificados, y eso se descubre por reclamo, no por una prueba en rojo.
func TestLaPurgaBorraLasVencidasYRespetaLasVivas(t *testing.T) {
	viva, pool, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	_, tokenVivo, err := viva.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la viva: %v", err)
	}

	vencida := NuevasSesiones(pool, -48*time.Hour)
	if _, _, err := vencida.Crear(ctx, usuarioID); err != nil {
		t.Fatalf("creando la vencida: %v", err)
	}

	borradas, err := viva.PurgarVencidas(ctx, 24*time.Hour)
	if err != nil {
		t.Fatalf("purgando: %v", err)
	}
	if borradas != 1 {
		t.Errorf("se borraron %d sesiones, se esperaba 1", borradas)
	}

	if _, err := viva.Resolver(ctx, tokenVivo); err != nil {
		t.Errorf("la purga se llevo puesta una sesion viva: %v", err)
	}
}

// El puente con el middleware: una credencial que no sirve tiene que ser
// reconocible como httpx.ErrSesionInvalida, porque es lo que separa un 401 —que
// invita a reingresar— de un 500 —que no le dice nada util a nadie—.
//
// Se comprueba con errors.Is y no con ==, que es como lo comprueba el
// middleware: si algun dia el error se envuelve con contexto, esta prueba
// sigue valiendo y la comparacion directa habria dejado de detectarlo.
func TestUnaCredencialInvalidaEsReconocibleParaElMiddleware(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	resolver := ses.ResolverUsuario(usuarios.Nuevo(pool))

	if _, err := resolver(ctx, "no-existe"); !errors.Is(err, httpx.ErrSesionInvalida) {
		t.Errorf("un token inventado no se reconoce como sesion invalida: %v", err)
	}

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	if err := ses.Revocar(ctx, token); err != nil {
		t.Fatalf("revocando: %v", err)
	}
	if _, err := resolver(ctx, token); !errors.Is(err, httpx.ErrSesionInvalida) {
		t.Errorf("una sesion revocada no se reconoce como sesion invalida: %v", err)
	}
}

// Una sesion viva devuelve al usuario dueño de la credencial, y no a otro.
func TestElResolvedorDevuelveAlDuenoDeLaCredencial(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	repo := usuarios.Nuevo(pool)
	otro, err := repo.BuscarOCrear(ctx, "otro@example.com")
	if err != nil {
		t.Fatalf("creando al otro usuario: %v", err)
	}

	_, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	u, err := ses.ResolverUsuario(repo)(ctx, token)
	if err != nil {
		t.Fatalf("resolviendo: %v", err)
	}
	if u.ID != usuarioID {
		t.Errorf("la credencial resolvio al usuario %s, se esperaba %s", u.ID, usuarioID)
	}
	if u.ID == otro.ID {
		t.Error("la credencial resolvio a un usuario ajeno")
	}
}

// ---------------------------------------------------------------------------
// Renovacion deslizante — research D7 de `012`, US3.
// ---------------------------------------------------------------------------

// Una sesion a la que le queda menos de la mitad de vida MUEVE su vencimiento
// al usarse. Es lo que hace que Diego no vea nunca una pantalla de ingreso.
func TestUnaSesionGastadaMueveSuVencimientoAlUsarse(t *testing.T) {
	// Se emite con diez minutos y se resuelve con un emisor de una hora: al
	// resolver le quedan diez de sesenta, o sea menos de la mitad. Es la forma
	// de probar el umbral sin manipular el reloj ni esperar dos semanas.
	corta, pool, usuarioID := sesionesDePrueba(t, 10*time.Minute)
	ctx := context.Background()

	creada, token, err := corta.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	larga := NuevasSesiones(pool, time.Hour)
	resuelta, err := larga.Resolver(ctx, token)
	if err != nil {
		t.Fatalf("resolviendo: %v", err)
	}

	if !resuelta.ExpiraEn.After(creada.ExpiraEn) {
		t.Errorf("el vencimiento no se movio: era %s y sigue en %s",
			creada.ExpiraEn, resuelta.ExpiraEn)
	}

	// Y quedo guardado, no solo devuelto. Sin esto pasaria una implementacion
	// que mueve el campo en memoria y no escribe una fila.
	var enLaBase time.Time
	if err := pool.QueryRow(ctx,
		`SELECT expira_en FROM sesiones WHERE id = $1`, creada.ID).Scan(&enLaBase); err != nil {
		t.Fatalf("releyendo el vencimiento: %v", err)
	}
	if !enLaBase.After(creada.ExpiraEn) {
		t.Errorf("la base sigue diciendo %s, se esperaba algo posterior a %s",
			enLaBase, creada.ExpiraEn)
	}
}

// **El control positivo del umbral.** Una sesion recien creada NO mueve su
// vencimiento.
//
// Sin esta prueba, una implementacion que renueva en CADA peticion —o sea la
// que el umbral existe para evitar, un UPDATE por request sobre la tabla mas
// caliente— pasaria la prueba de arriba sin problema.
func TestUnaSesionRecienCreadaNoMueveSuVencimiento(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)
	ctx := context.Background()

	creada, token, err := ses.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	// Le queda una hora entera de una hora: muy por encima de la mitad.
	resuelta, err := ses.Resolver(ctx, token)
	if err != nil {
		t.Fatalf("resolviendo: %v", err)
	}
	if !resuelta.ExpiraEn.Equal(creada.ExpiraEn) {
		t.Errorf("una sesion nueva movio su vencimiento de %s a %s",
			creada.ExpiraEn, resuelta.ExpiraEn)
	}

	var enLaBase time.Time
	if err := pool.QueryRow(ctx,
		`SELECT expira_en FROM sesiones WHERE id = $1`, creada.ID).Scan(&enLaBase); err != nil {
		t.Fatalf("releyendo el vencimiento: %v", err)
	}
	if !enLaBase.Equal(creada.ExpiraEn) {
		t.Errorf("se escribio una fila que no hacia falta: %s, se esperaba %s",
			enLaBase, creada.ExpiraEn)
	}
}

// Una sesion REVOCADA no mueve su vencimiento.
//
// **Llama a renovarSiHaceFalta directamente, y no via Resolver, a proposito.**
// Por Resolver esta prueba pasaria sola: el SELECT ya filtra `revocada_en IS
// NULL` y corta con ErrSesionInvalida antes de llegar a la renovacion. O sea
// que probandola por arriba, el `revocada_en IS NULL` del UPDATE se puede
// borrar entero y nada se pone en rojo — se comprobo, y quedaba en verde.
//
// Lo que la guarda protege es el dia que alguien reordene Resolver, o que otro
// camino llame a la renovacion. Sin ella, un UPDATE le correria el vencimiento
// a una credencial cerrada: no la volveria valida, pero la dejaria caminando
// hacia adelante para siempre y le sacaria el trabajo a la purga.
func TestLaRenovacionNoTocaUnaSesionRevocada(t *testing.T) {
	corta, pool, usuarioID := sesionesDePrueba(t, 10*time.Minute)
	ctx := context.Background()

	creada, token, err := corta.Crear(ctx, usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}
	if err := corta.Revocar(ctx, token); err != nil {
		t.Fatalf("revocando: %v", err)
	}

	// Por arriba sigue sin resolver, que es lo que le importa a quien la usa.
	larga := NuevasSesiones(pool, time.Hour)
	if _, err := larga.Resolver(ctx, token); !errors.Is(err, ErrSesionInvalida) {
		t.Fatalf("una sesion revocada resolvio: %v", err)
	}

	// Y por abajo, con la renovacion llamada a mano sobre la fila revocada.
	copia := *creada
	larga.renovarSiHaceFalta(ctx, &copia)
	if !copia.ExpiraEn.Equal(creada.ExpiraEn) {
		t.Errorf("la renovacion movio en memoria el vencimiento de una revocada: %s -> %s",
			creada.ExpiraEn, copia.ExpiraEn)
	}

	var enLaBase time.Time
	if err := pool.QueryRow(ctx,
		`SELECT expira_en FROM sesiones WHERE id = $1`, creada.ID).Scan(&enLaBase); err != nil {
		t.Fatalf("releyendo el vencimiento: %v", err)
	}
	if !enLaBase.Equal(creada.ExpiraEn) {
		t.Errorf("la revocada movio su vencimiento de %s a %s", creada.ExpiraEn, enLaBase)
	}
}

// ---------------------------------------------------------------------------
// 017 — que version de la app declara cada sesion
// ---------------------------------------------------------------------------

// conVersion arma el contexto como lo deja el middleware de httpx.
func conVersion(version string) context.Context {
	peticion := httptest.NewRequest(http.MethodGet, "/admin/pedidos", nil)
	peticion.Header.Set(httpx.CabeceraVersion, version)

	var ctx context.Context
	httpx.ConVersion(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		ctx = r.Context()
	})).ServeHTTP(httptest.NewRecorder(), peticion)
	return ctx
}

// versionGuardada lee lo que quedo anotado en la fila de la sesion.
func versionGuardada(t *testing.T, pool *db.Pool, token string) (string, *time.Time) {
	t.Helper()

	var version *string
	var vistaEn *time.Time
	err := pool.QueryRow(context.Background(),
		`SELECT version_app, version_vista_en FROM sesiones WHERE token_hash = $1`,
		hashDelToken(token)).Scan(&version, &vistaEn)
	if err != nil {
		t.Fatalf("leyendo la version guardada: %v", err)
	}
	if version == nil {
		return "", vistaEn
	}
	return *version, vistaEn
}

// TestLaVersionDeclaradaQuedaEnLaSesion es SC-006 en una prueba: se puede saber
// que version corre sin preguntarle nada a Diego.
func TestLaVersionDeclaradaQuedaEnLaSesion(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	// Recien creada, todavia no declaro nada. NULL es la verdad, no un hueco.
	if v, vistaEn := versionGuardada(t, pool, token); v != "" || vistaEn != nil {
		t.Fatalf("una sesion recien creada ya tenia version %q / %v", v, vistaEn)
	}

	if _, err := ses.Resolver(conVersion("0.2.0"), token); err != nil {
		t.Fatalf("resolviendo con version: %v", err)
	}

	v, vistaEn := versionGuardada(t, pool, token)
	if v != "0.2.0" {
		t.Errorf("quedo guardada la version %q, queria 0.2.0", v)
	}
	if vistaEn == nil {
		t.Error("quedo la version pero no cuando se la vio; sin eso no se distingue una version vieja de un telefono que dejo de usarse")
	}
}

// TestUnPedidoSinCabeceraNoBorraLaVersion es **la guarda del COALESCE**, y la
// mas facil de romper de todo `017`.
//
// El sitio web usa esta misma consulta y no manda version. Sin el COALESCE,
// cada vez que Diego mirara sus pedidos desde el navegador se borraria lo que
// la app habia anotado, y la unica senal seria una columna que a veces esta
// vacia sin motivo aparente.
func TestUnPedidoSinCabeceraNoBorraLaVersion(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(conVersion("0.2.0"), token); err != nil {
		t.Fatalf("resolviendo con version: %v", err)
	}
	_, antes := versionGuardada(t, pool, token)

	// Ahora la misma sesion desde el sitio: sin cabecera ninguna.
	if _, err := ses.Resolver(context.Background(), token); err != nil {
		t.Fatalf("resolviendo sin version: %v", err)
	}

	v, despues := versionGuardada(t, pool, token)
	if v != "0.2.0" {
		t.Errorf("un pedido sin cabecera dejo la version en %q; tenia que quedar 0.2.0", v)
	}
	if antes == nil || despues == nil || !antes.Equal(*despues) {
		t.Errorf("un pedido sin cabecera movio la marca de tiempo: %v -> %v", antes, despues)
	}
}

// TestUnaCabeceraBasuraNoEnsuciaLaSesion cierra el otro extremo: lo que no pasa
// el validador se trata igual que "no declarada", y no llega crudo a la base.
func TestUnaCabeceraBasuraNoEnsuciaLaSesion(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(conVersion("0.2.0"), token); err != nil {
		t.Fatalf("resolviendo con version: %v", err)
	}

	for _, basura := range []string{"la ultima", strings.Repeat("x", 5000), "0.2.0'; DROP TABLE sesiones;--"} {
		if _, err := ses.Resolver(conVersion(basura), token); err != nil {
			t.Fatalf("resolviendo con la cabecera %.20q: %v", basura, err)
		}
		if v, _ := versionGuardada(t, pool, token); v != "0.2.0" {
			t.Fatalf("la cabecera %.20q dejo la version en %q; tenia que quedar 0.2.0", basura, v)
		}
	}
}

// TestLaVersionNoResucitaUnaSesionRevocada es la comprobacion de que el UPDATE
// conserva el WHERE del SELECT que reemplazo.
//
// Es la propiedad que el comentario de `Resolver` defiende, y la que se podria
// perder sin que nada mas fallara al pasar de leer a escribir: un UPDATE que se
// olvidara de `revocada_en` no solo devolveria la sesion cortada, ademas le
// escribiria encima.
func TestLaVersionNoResucitaUnaSesionRevocada(t *testing.T) {
	ses, _, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}
	if err := ses.Revocar(context.Background(), token); err != nil {
		t.Fatalf("revocando: %v", err)
	}

	if _, err := ses.Resolver(conVersion("0.2.0"), token); !errors.Is(err, ErrSesionInvalida) {
		t.Errorf("una sesion revocada se resolvio al declarar version: %v", err)
	}
}

// ---------------------------------------------------------------------------
// 018 - a donde se le manda el aviso a cada telefono
// ---------------------------------------------------------------------------

// conCabeceras arma el contexto como lo dejan los dos middlewares de httpx,
// encadenados en el mismo orden en que los encadena ConSesion.
//
// Cualquiera de las dos puede ir vacia, y eso **no** es un caso raro: el sitio
// web no manda ninguna de las dos, y una app con el permiso de avisos negado
// declara version y no declara token.
func conCabeceras(version, push string) context.Context {
	peticion := httptest.NewRequest(http.MethodGet, "/admin/pedidos", nil)
	if version != "" {
		peticion.Header.Set(httpx.CabeceraVersion, version)
	}
	if push != "" {
		peticion.Header.Set(httpx.CabeceraPushToken, push)
	}

	var ctx context.Context
	httpx.ConVersion(httpx.ConPushToken(http.HandlerFunc(
		func(_ http.ResponseWriter, r *http.Request) {
			ctx = r.Context()
		}))).ServeHTTP(httptest.NewRecorder(), peticion)
	return ctx
}

// conPushToken es conCabeceras con la version vacia: el caso de la app cuando
// lo unico que cambio es el token.
func conPushToken(push string) context.Context { return conCabeceras("", push) }

// pushGuardado lee el token que quedo anotado en la fila de la sesion.
//
// Devuelve vacio cuando la columna esta en NULL, que es lo que corresponde a
// una sesion que nunca declaro ninguno - todas las del sitio web, para siempre.
func pushGuardado(t *testing.T, pool *db.Pool, token string) string {
	t.Helper()

	var push *string
	err := pool.QueryRow(context.Background(),
		`SELECT push_token FROM sesiones WHERE token_hash = $1`,
		hashDelToken(token)).Scan(&push)
	if err != nil {
		t.Fatalf("leyendo el push_token guardado: %v", err)
	}
	if push == nil {
		return ""
	}
	return *push
}

// unTokenDeProveedor tiene la forma real de lo que manda el proveedor: una parte
// corta, dos puntos, y una larga de base64 con guiones y guiones bajos.
const unTokenDeProveedor = "cXyZ01_ab-Q:APA91bH" +
	"kR2t7QmVzZXJ0LWRlLXBydWViYS1xdWUtbm8tZXMtdW4tdG9rZW4tcmVhbA" +
	"_wdE3xN0pQr-sTuVwXyZ0123456789abcdefghijklmnop"

// TestElPushTokenDeclaradoQuedaEnLaSesion es la mitad fundacional del feature:
// sin un destinatario guardado no hay a quien mandarle nada.
func TestElPushTokenDeclaradoQuedaEnLaSesion(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	// Recien creada no puede afirmar un token que la app todavia no declaro.
	if p := pushGuardado(t, pool, token); p != "" {
		t.Fatalf("una sesion recien creada ya tenia push_token %q", p)
	}

	if _, err := ses.Resolver(conPushToken(unTokenDeProveedor), token); err != nil {
		t.Fatalf("resolviendo con push token: %v", err)
	}

	if p := pushGuardado(t, pool, token); p != unTokenDeProveedor {
		t.Errorf("quedo guardado %q, queria el token declarado", p)
	}
}

// TestUnaLlamadaSinCabeceraNoBorraElPushToken es **la guarda del COALESCE**, y
// la prueba mas importante de `018`.
//
// El sitio web resuelve sesiones con esta misma consulta y no manda la cabecera
// nunca. Sin el COALESCE, cada visita de Diego al sitio desde el navegador le
// borraria el token a su propio telefono: los avisos dejarian de llegar sin que
// nada falle, nada se registre y nada aparezca en rojo. Es el defecto mas
// barato de introducir de todo el feature y el mas caro de diagnosticar.
//
// **Se comprobo en rojo** sacando el COALESCE del UPDATE de Resolver, que es lo
// unico que convierte a una guarda negativa en una prueba (quickstart Q2).
func TestUnaLlamadaSinCabeceraNoBorraElPushToken(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(conPushToken(unTokenDeProveedor), token); err != nil {
		t.Fatalf("resolviendo con push token: %v", err)
	}

	// La misma sesion desde el navegador: sin ninguna de las dos cabeceras.
	if _, err := ses.Resolver(context.Background(), token); err != nil {
		t.Fatalf("resolviendo sin cabeceras: %v", err)
	}

	if p := pushGuardado(t, pool, token); p != unTokenDeProveedor {
		t.Errorf("una llamada sin cabecera dejo el push_token en %q; tenia que quedar el declarado", p)
	}
}

// TestLaVersionYElPushTokenSonIndependientes fija lo que el contrato promete:
// viajan juntas y no se pisan.
//
// El caso de la segunda mitad **existe hoy**: una app a la que Diego le nego el
// permiso de avisos declara version y no declara token. Si escribir la version
// borrara el token, el unico sintoma seria que los avisos se apagan cuando
// alguien revisa que version corre.
func TestLaVersionYElPushTokenSonIndependientes(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(conCabeceras("0.2.0", unTokenDeProveedor), token); err != nil {
		t.Fatalf("resolviendo con las dos cabeceras: %v", err)
	}

	// Solo version: el token tiene que sobrevivir.
	if _, err := ses.Resolver(conCabeceras("0.3.0", ""), token); err != nil {
		t.Fatalf("resolviendo solo con version: %v", err)
	}
	if p := pushGuardado(t, pool, token); p != unTokenDeProveedor {
		t.Errorf("declarar solo la version dejo el push_token en %q", p)
	}

	// Solo token: la version tiene que sobrevivir, y el token actualizarse.
	if _, err := ses.Resolver(conCabeceras("", "otro-token-de-proveedor"), token); err != nil {
		t.Fatalf("resolviendo solo con push token: %v", err)
	}
	if v, _ := versionGuardada(t, pool, token); v != "0.3.0" {
		t.Errorf("declarar solo el push token dejo la version en %q", v)
	}
	if p := pushGuardado(t, pool, token); p != "otro-token-de-proveedor" {
		t.Errorf("el push token no se actualizo, quedo en %q", p)
	}
}

// TestUnPushTokenBasuraNoEnsuciaLaSesion cierra el otro extremo: lo que no pasa
// el validador se trata igual que "no declarado" y no llega crudo a la base.
//
// **Ninguno de estos casos puede devolver un error**, y esa es la mitad
// importante de la prueba: un token raro no puede dejar a Diego sin poder
// trabajar. La peticion sigue, y lo que se descarta es el dato.
func TestUnPushTokenBasuraNoEnsuciaLaSesion(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}

	if _, err := ses.Resolver(conPushToken(unTokenDeProveedor), token); err != nil {
		t.Fatalf("resolviendo con push token: %v", err)
	}

	basuras := []string{
		strings.Repeat("x", httpx.LargoMaximoPushToken+1), // pasa el tope: se descarta entero
		"un token con espacios",
		"token\ncon\nsaltos",
		"token'; DROP TABLE sesiones;--",
		"token-con-acento-\u00f1",
	}
	for _, basura := range basuras {
		if _, err := ses.Resolver(conPushToken(basura), token); err != nil {
			t.Fatalf("resolviendo con la cabecera %.20q: %v", basura, err)
		}
		if p := pushGuardado(t, pool, token); p != unTokenDeProveedor {
			t.Fatalf("la cabecera %.20q dejo el push_token en %q; tenia que quedar el bueno", basura, p)
		}
	}
}

// TestElPushTokenNoResucitaUnaSesionRevocada es FR-007 y SC-008 medidos donde
// se deciden: **en el WHERE**.
//
// Es la propiedad por la que el token vive en `sesiones` y no en una tabla de
// dispositivos. Revocar la sesion de un telefono perdido tiene que apagarle los
// avisos, y lo que lo garantiza es que el UPDATE que refresca el token no
// alcance esa fila. Uno que se olvidara de `revocada_en` le seguiria anotando
// el token a un telefono al que ya se le corto el acceso.
func TestElPushTokenNoResucitaUnaSesionRevocada(t *testing.T) {
	ses, pool, usuarioID := sesionesDePrueba(t, time.Hour)

	_, token, err := ses.Crear(context.Background(), usuarioID)
	if err != nil {
		t.Fatalf("creando la sesion: %v", err)
	}
	if _, err := ses.Resolver(conPushToken(unTokenDeProveedor), token); err != nil {
		t.Fatalf("resolviendo con push token: %v", err)
	}
	if err := ses.Revocar(context.Background(), token); err != nil {
		t.Fatalf("revocando: %v", err)
	}

	if _, err := ses.Resolver(conPushToken("token-nuevo-despues-de-revocar"), token); !errors.Is(err, ErrSesionInvalida) {
		t.Errorf("una sesion revocada se resolvio al declarar push token: %v", err)
	}
	if p := pushGuardado(t, pool, token); p != unTokenDeProveedor {
		t.Errorf("una sesion revocada acepto un push_token nuevo: quedo %q", p)
	}
}
