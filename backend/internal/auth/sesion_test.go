package auth

import (
	"context"
	"errors"
	"os"
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
	// El borrado de usuarios arrastra sus sesiones por la cascada.
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
