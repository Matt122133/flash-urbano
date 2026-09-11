package tablero

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/pedidos"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Como en internal/pedidos, estas pruebas necesitan un Postgres real —con
// PostGIS— y **se saltan solas si no hay**. Que se salten solas es la trampa de
// este repo: "todo verde" no dice nada sobre la base salvo que alguien haya
// contado los SKIP. Ver backend/README.md.
//
// **Este archivo SI importa `internal/pedidos`, y puede**: crea pedidos de
// verdad por el mismo camino que el servicio, en vez de un INSERT a mano que se
// desactualiza con cada migracion. La guarda de `sin_plata_test.go` mira solo
// las fuentes que corren en produccion.

type entorno struct {
	repo    *Repositorio
	pedidos *pedidos.Repositorio
	cuentas *usuarios.Repositorio
	pool    *db.Pool
}

func entornoDePrueba(t *testing.T) *entorno {
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
	// En el orden que imponen los ON DELETE RESTRICT: el historial antes que los
	// pedidos, los pedidos antes que las cuentas. Mismo orden que
	// internal/pedidos/pedido_test.go.
	for _, sql := range []string{
		`DELETE FROM pedidos_estados`,
		`DELETE FROM pedidos`,
		`DELETE FROM usuarios`,
	} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatalf("limpiando (%s): %v", sql, err)
		}
	}

	return &entorno{
		repo:    NuevoRepositorio(pool),
		pedidos: pedidos.NuevoRepositorio(pool),
		cuentas: usuarios.Nuevo(pool),
		pool:    pool,
	}
}

// unaCuenta crea una cuenta. Con nombre vacio **no completa el alta**: es la
// cuenta de quien entro y nunca cargo nombre ni telefono, que en la base queda
// con `nombre` en NULL.
func (e *entorno) unaCuenta(t *testing.T, email, nombre string) string {
	t.Helper()
	ctx := context.Background()

	u, err := e.cuentas.BuscarOCrear(ctx, email)
	if err != nil {
		t.Fatalf("creando la cuenta %s: %v", email, err)
	}
	if nombre != "" {
		if _, err := e.cuentas.CompletarAlta(ctx, u.ID, nombre, "099111222"); err != nil {
			t.Fatalf("completando el alta de %s: %v", email, err)
		}
	}
	return u.ID
}

// unPedido crea un pedido de la cuenta con `cantidad` paquetes, cargado en
// `instante` (RFC 3339). Devuelve su id.
//
// `creado_en` lo pone la base con `now()`, asi que se fija despues con un
// UPDATE: es lo unico que la prueba necesita controlar.
func (e *entorno) unPedido(t *testing.T, usuarioID, clave string, cantidad int, instante string) string {
	t.Helper()
	ctx := context.Background()

	punto := &pedidos.Punto{Lat: -34.872, Lng: -56.16}
	numero := "1234"
	p, _, err := e.pedidos.Crear(ctx, pedidos.Nuevo{
		UsuarioID:            usuarioID,
		ClaveIdempotencia:    clave,
		RemitenteNombre:      "Ana Perez",
		RemitenteTelefono:    "099111222",
		Retiro:               pedidos.Direccion{Calle: "Rivera", Esquina: "Comercio", Numero: &numero, Punto: punto},
		Entrega:              pedidos.Direccion{Calle: "Rivera", Esquina: "Comercio", Numero: &numero, Punto: punto},
		PaqueteTamano:        pedidos.TamanoChico,
		Cantidad:             cantidad,
		RetiroFecha:          "2026-09-20",
		RetiroHora:           "16:00",
		DestinatarioNombre:   "Juan Gomez",
		DestinatarioTelefono: "098765432",
		Precio:               150,
		ZonaID:               1,
	})
	if err != nil {
		t.Fatalf("creando el pedido %s: %v", clave, err)
	}

	cuando, err := time.Parse(time.RFC3339, instante)
	if err != nil {
		t.Fatalf("instante mal escrito en la prueba (%s): %v", instante, err)
	}
	if _, err := e.pool.Exec(ctx, `UPDATE pedidos SET creado_en = $2 WHERE id = $1`, p.ID, cuando); err != nil {
		t.Fatalf("fijando la fecha de carga de %s: %v", clave, err)
	}
	return p.ID
}

// TestCargasTraeTodosLosPedidosSinFiltrar es FR-004b y FR-005a sobre la base: un
// pedido por carga, **en cualquier estado y de cualquier cuenta**, en orden de
// carga, con la cantidad y la cuenta de cada uno.
//
// El pedido entregado es el que importa: una consulta que filtrara "los que
// estan en curso" pasaria con los otros dos y lo perderia a el.
func TestCargasTraeTodosLosPedidosSinFiltrar(t *testing.T) {
	e := entornoDePrueba(t)
	ctx := context.Background()

	ana := e.unaCuenta(t, "ana@example.com", "Ana Perez")
	beto := e.unaCuenta(t, "beto@example.com", "Beto Rodriguez")

	// Creados fuera de orden a proposito: el orden tiene que salir de la fecha
	// de carga, no del orden en que se insertaron.
	e.unPedido(t, ana, "a2", 1, "2026-09-10T12:00:00Z")
	e.unPedido(t, ana, "a1", 3, "2026-09-01T12:00:00Z")
	entregado := e.unPedido(t, beto, "b1", 2, "2026-09-05T12:00:00Z")

	if _, err := e.pedidos.CambiarEstado(ctx, entregado, pedidos.EstadoEntrega,
		&pedidos.Receptor{Nombre: "Juan Gomez"}); err != nil {
		t.Fatalf("entregando el pedido: %v", err)
	}

	cargas, err := e.repo.Cargas(ctx)
	if err != nil {
		t.Fatalf("leyendo las cargas: %v", err)
	}

	esperado := []struct {
		instante string
		cantidad int
		cliente  string
	}{
		{"2026-09-01T12:00:00Z", 3, ana},
		{"2026-09-05T12:00:00Z", 2, beto},
		{"2026-09-10T12:00:00Z", 1, ana},
	}
	if len(cargas) != len(esperado) {
		t.Fatalf("tenian que ser %d cargas —todas, tambien la entregada— y fueron %d: %+v",
			len(esperado), len(cargas), cargas)
	}
	for i, esp := range esperado {
		cuando, _ := time.Parse(time.RFC3339, esp.instante)
		c := cargas[i]
		// El contrato dice UTC, y el driver devuelve el instante en la zona del
		// PROCESO: en esta maquina, Montevideo; en Railway, UTC. Sin normalizar,
		// la misma base respondia `-03:00` en un lado y `Z` en el otro. Lo
		// encontro correr el servicio local el 2026-09-11.
		if c.CreadoEn.Location() != time.UTC {
			t.Errorf("carga %d: el instante tenia que viajar en UTC, y vino en %s", i, c.CreadoEn.Location())
		}
		if !c.CreadoEn.Equal(cuando) || c.Cantidad != esp.cantidad || c.ClienteID != esp.cliente {
			t.Errorf("carga %d: tenia que ser %s / %d paquetes / %s, y fue %s / %d / %s",
				i, esp.instante, esp.cantidad, esp.cliente, c.CreadoEn.UTC().Format(time.RFC3339), c.Cantidad, c.ClienteID)
		}
	}
}

// TestClientesTraeTodasLasCuentas: tambien las que no tienen pedidos (US3-3,
// FR-011) y la del alta a medias, con el nombre en `nil` y no en "" (D6).
func TestClientesTraeTodasLasCuentas(t *testing.T) {
	e := entornoDePrueba(t)
	ctx := context.Background()

	beto := e.unaCuenta(t, "beto@example.com", "Beto Rodriguez")
	// Minuscula a proposito: el orden es por nombre sin importar mayusculas.
	ana := e.unaCuenta(t, "ana@example.com", "ana Perez")
	sinNombre := e.unaCuenta(t, "a.medias@example.com", "")
	e.unPedido(t, beto, "b1", 1, "2026-09-05T12:00:00Z")

	clientes, err := e.repo.Clientes(ctx)
	if err != nil {
		t.Fatalf("leyendo las cuentas: %v", err)
	}

	if len(clientes) != 3 {
		t.Fatalf("tenian que ser las 3 cuentas —con y sin pedidos— y fueron %d: %+v", len(clientes), clientes)
	}
	ids := []string{clientes[0].ID, clientes[1].ID, clientes[2].ID}
	if ids[0] != ana || ids[1] != beto || ids[2] != sinNombre {
		t.Fatalf("orden inesperado: tenia que ser ana, beto y la sin nombre al final; fue %v", ids)
	}
	if clientes[2].Nombre != nil {
		t.Errorf("la cuenta con el alta a medias tenia que traer el nombre en nil, y trajo %q", *clientes[2].Nombre)
	}
	if clientes[2].Email != "a.medias@example.com" {
		t.Errorf("sin nombre, el mail es lo unico que la identifica, y vino %q", clientes[2].Email)
	}
	if clientes[0].Nombre == nil || *clientes[0].Nombre != "ana Perez" {
		t.Errorf("el nombre de una cuenta completa no llego tal cual: %v", clientes[0].Nombre)
	}
}

// TestSinNadaLasListasSonVaciasYNoNil: una base vacia es un caso real —el
// primer dia, o una base recien recreada— y la respuesta tiene que decir `[]`,
// no `null` (contrato §1).
func TestSinNadaLasListasSonVaciasYNoNil(t *testing.T) {
	e := entornoDePrueba(t)
	ctx := context.Background()

	cargas, err := e.repo.Cargas(ctx)
	if err != nil {
		t.Fatalf("leyendo las cargas: %v", err)
	}
	if cargas == nil || len(cargas) != 0 {
		t.Errorf("sin pedidos, Cargas tenia que ser un slice vacio y no nil; fue %#v", cargas)
	}

	clientes, err := e.repo.Clientes(ctx)
	if err != nil {
		t.Fatalf("leyendo las cuentas: %v", err)
	}
	if clientes == nil || len(clientes) != 0 {
		t.Errorf("sin cuentas, Clientes tenia que ser un slice vacio y no nil; fue %#v", clientes)
	}
}
