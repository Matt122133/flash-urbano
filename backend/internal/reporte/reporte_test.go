package reporte

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/pedidos"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// Estas pruebas necesitan un Postgres real —con PostGIS— y **se saltan solas si
// no hay**. Que se salten solas es la trampa de este repo: "todo verde" no dice
// nada sobre la base salvo que alguien haya contado los SKIP. Ver
// backend/README.md.
//
// **Este archivo SI importa `internal/pedidos`, y puede**: crea pedidos por el
// mismo camino que el servicio, en vez de un INSERT a mano que se desactualiza
// con cada migracion. La guarda de `sin_plata_test.go` mira solo las fuentes que
// corren en produccion, y por eso el `Precio: 150` de abajo no la pone en rojo:
// es un dato que **crear** un pedido exige, y que este paquete nunca lee.

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
	// En el orden que imponen los ON DELETE RESTRICT.
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

func (e *entorno) unaCuenta(t *testing.T, email string) string {
	t.Helper()
	u, err := e.cuentas.BuscarOCrear(context.Background(), email)
	if err != nil {
		t.Fatalf("creando la cuenta %s: %v", email, err)
	}
	return u.ID
}

// unPedido crea un pedido de la cuenta, con la fecha de retiro dada.
//
// `conPunto` decide si lleva punto de entrega: **un pedido anterior a `011` no
// lo tiene**, y ese es el caso que hace que la zona salga vacia en el reporte.
func (e *entorno) unPedido(t *testing.T, usuarioID, clave, retiroFecha string, cantidad int, conPunto bool) string {
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
		RetiroFecha:          retiroFecha,
		RetiroHora:           "16:00",
		DestinatarioNombre:   "Juan Gomez",
		DestinatarioTelefono: "098765432",
		Precio:               150,
		ZonaID:               1,
	})
	if err != nil {
		t.Fatalf("creando el pedido %s: %v", clave, err)
	}

	if !conPunto {
		// Se simula un pedido anterior a `011`: la columna es nullable justo
		// por ellos.
		if _, err := e.pool.Exec(ctx, `UPDATE pedidos SET entrega_punto = NULL WHERE id = $1`, p.ID); err != nil {
			t.Fatalf("sacando el punto de %s: %v", clave, err)
		}
	}
	return p.ID
}

// seEntrego graba una marca de entrega, como la que escribe la app de Diego.
func (e *entorno) seEntrego(t *testing.T, pedidoID, instante string) {
	t.Helper()
	cuando, err := time.Parse(time.RFC3339, instante)
	if err != nil {
		t.Fatalf("instante mal escrito en la prueba (%s): %v", instante, err)
	}
	_, err = e.pool.Exec(context.Background(),
		`INSERT INTO pedidos_estados (pedido_id, estado, ocurrido_en) VALUES ($1, 'entrega', $2)`,
		pedidoID, cuando)
	if err != nil {
		t.Fatalf("marcando la entrega de %s: %v", pedidoID, err)
	}
}

// **La prueba mas importante del archivo, y es de plata.**
//
// La unica fecha de entrega que existe se graba cuando Diego marca el pedido en
// la app. Si la consulta usara un `INNER JOIN`, cada pedido que se le olvido
// marcar **desapareceria del reporte en silencio** y lo facturaria de menos, sin
// que nada se lo avisara: lo que falta no se ve.
//
// Por eso el caso no es "la fecha sale bien" sino "el pedido SIN fecha SIGUE
// ESTANDO".
func TestUnPedidoSinMarcaDeEntregaAparecIgual(t *testing.T) {
	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test")

	marcado := e.unPedido(t, cuenta, "k1", "2026-09-10", 1, true)
	e.seEntrego(t, marcado, "2026-09-11T14:00:00Z")
	e.unPedido(t, cuenta, "k2", "2026-09-12", 3, true) // sin marcar

	envios, err := e.repo.Envios(context.Background(), cuenta, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios: %v", err)
	}

	if len(envios) != 2 {
		t.Fatalf("vinieron %d envios, queria 2 — el pedido sin marcar se perdio", len(envios))
	}
	if envios[0].EntregadoEn == nil {
		t.Error("el pedido marcado vino sin fecha de entrega")
	}
	if envios[1].EntregadoEn != nil {
		t.Error("el pedido NO marcado vino con fecha de entrega")
	}
}

// FR-006c: dos marcas son una correccion, no dos envios.
func TestConDosMarcasDeEntregaVieneLaMasReciente(t *testing.T) {
	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test")

	p := e.unPedido(t, cuenta, "k1", "2026-09-10", 1, true)
	e.seEntrego(t, p, "2026-09-11T14:00:00Z")
	e.seEntrego(t, p, "2026-09-12T09:30:00Z")

	envios, err := e.repo.Envios(context.Background(), cuenta, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios: %v", err)
	}

	// **Una fila por pedido** (FR-002), no una por marca.
	if len(envios) != 1 {
		t.Fatalf("vinieron %d filas para un pedido, queria 1", len(envios))
	}
	quiero := time.Date(2026, 9, 12, 9, 30, 0, 0, time.UTC)
	if !envios[0].EntregadoEn.Equal(quiero) {
		t.Errorf("la fecha de entrega fue %v, queria la mas reciente %v", envios[0].EntregadoEn, quiero)
	}
}

// **FR-006: la garantia de privacidad, sobre la base.**
func TestNoTraeNiUnEnvioDeOtraCuenta(t *testing.T) {
	e := entornoDePrueba(t)
	mia := e.unaCuenta(t, "mia@ejemplo.test")
	ajena := e.unaCuenta(t, "ajena@ejemplo.test")

	e.unPedido(t, mia, "k1", "2026-09-10", 1, true)
	e.unPedido(t, ajena, "k2", "2026-09-11", 1, true)

	envios, err := e.repo.Envios(context.Background(), mia, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios: %v", err)
	}
	if len(envios) != 1 {
		t.Fatalf("vinieron %d envios, queria 1: se filtro un pedido de otra cuenta", len(envios))
	}

	// EL CONTROL POSITIVO: la otra cuenta SI tiene su pedido. Sin esto, la
	// afirmacion de arriba pasaria igual con una consulta que no devuelve nada.
	otros, err := e.repo.Envios(context.Background(), ajena, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios de la otra cuenta: %v", err)
	}
	if len(otros) != 1 {
		t.Fatalf("la otra cuenta trajo %d envios, queria 1: la prueba de arriba no probaba nada", len(otros))
	}
}

// El periodo es inclusive en los dos extremos: un envio del primer dia y otro
// del ultimo tienen que entrar los dos.
func TestElPeriodoIncluyeLosDosExtremos(t *testing.T) {
	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test")

	e.unPedido(t, cuenta, "k0", "2026-08-31", 1, true) // el dia anterior
	e.unPedido(t, cuenta, "k1", "2026-09-01", 1, true) // el primero
	e.unPedido(t, cuenta, "k2", "2026-09-30", 1, true) // el ultimo
	e.unPedido(t, cuenta, "k3", "2026-10-01", 1, true) // el dia siguiente

	envios, err := e.repo.Envios(context.Background(), cuenta, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios: %v", err)
	}
	if len(envios) != 2 {
		t.Fatalf("vinieron %d envios, queria 2 (los dos extremos, y nada de afuera)", len(envios))
	}
	if envios[0].RetiroFecha != "2026-09-01" || envios[1].RetiroFecha != "2026-09-30" {
		t.Errorf("las fechas fueron %q y %q", envios[0].RetiroFecha, envios[1].RetiroFecha)
	}
}

// Un pedido anterior a `011` no tiene punto, y entonces **no tiene zona**. La
// consulta tiene que traerlo igual, con el punto ausente.
func TestUnPedidoSinPuntoDeEntregaVieneIgual(t *testing.T) {
	e := entornoDePrueba(t)
	cuenta := e.unaCuenta(t, "cliente@ejemplo.test")

	e.unPedido(t, cuenta, "k1", "2026-09-10", 2, false)

	envios, err := e.repo.Envios(context.Background(), cuenta, "2026-09-01", "2026-09-30")
	if err != nil {
		t.Fatalf("leyendo los envios: %v", err)
	}
	if len(envios) != 1 {
		t.Fatalf("vinieron %d envios, queria 1: el pedido sin punto se perdio", len(envios))
	}
	if envios[0].Entrega.Punto != nil {
		t.Error("vino un punto donde no habia")
	}
	// **Una fila por pedido, no por paquete** (FR-002).
	if envios[0].Cantidad != 2 {
		t.Errorf("la cantidad fue %d, queria 2", envios[0].Cantidad)
	}
}
