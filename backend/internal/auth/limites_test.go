package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

func limitesDePrueba(t *testing.T) (*Limites, *Codigos, *db.Pool, context.Context) {
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

	return NuevosLimites(pool), NuevosCodigos(pool), pool, ctx
}

// TestElLimitePorEmailFrena, con su control positivo adentro: los primeros
// pedidos **pasan**. Sin eso, un limitador que rechazara todo desde el primero
// pasaria la afirmacion "el cuarto se frena" sin cumplir nada.
func TestElLimitePorEmailFrena(t *testing.T) {
	limites, codigos, _, ctx := limitesDePrueba(t)

	const email = "tope@example.com"
	for i := 1; i <= maxPorEmail; i++ {
		if err := limites.Permite(ctx, email, ""); err != nil {
			t.Fatalf("el pedido %d tendria que pasar, y dio: %v", i, err)
		}
		if _, err := codigos.Emitir(ctx, email, ""); err != nil {
			t.Fatalf("emitiendo el %d: %v", i, err)
		}
	}

	if err := limites.Permite(ctx, email, ""); !errors.Is(err, ErrLimiteExcedido) {
		t.Fatalf("el pedido %d tendria que dar ErrLimiteExcedido, y dio: %v", maxPorEmail+1, err)
	}
}

// TestElLimiteSeLiberaAlPasarLaVentana: el limite es una ventana, no una condena.
func TestElLimiteSeLiberaAlPasarLaVentana(t *testing.T) {
	limites, codigos, pool, ctx := limitesDePrueba(t)

	const email = "ventana@example.com"
	for i := 0; i < maxPorEmail; i++ {
		if _, err := codigos.Emitir(ctx, email, ""); err != nil {
			t.Fatalf("emitiendo: %v", err)
		}
	}
	if err := limites.Permite(ctx, email, ""); !errors.Is(err, ErrLimiteExcedido) {
		t.Fatalf("tendria que estar frenado, y dio: %v", err)
	}

	// Se envejecen los pedidos en vez de esperar quince minutos.
	if _, err := pool.Exec(ctx, `UPDATE codigos_acceso SET creado_en = now() - interval '20 minutes' WHERE email = $1`, email); err != nil {
		t.Fatalf("envejeciendo: %v", err)
	}

	if err := limites.Permite(ctx, email, ""); err != nil {
		t.Fatalf("pasada la ventana tendria que dejar pedir, y dio: %v", err)
	}
}

// TestOtraDireccionNoQuedaFrenada: el limite por mail es por mail.
//
// Si frenara a todos, el primero que pidiera tres codigos dejaria al resto
// afuera — que es exactamente el modo de falla global que research D6 describe
// para el origen, aplicado a la direccion.
func TestOtraDireccionNoQuedaFrenada(t *testing.T) {
	limites, codigos, _, ctx := limitesDePrueba(t)

	for i := 0; i < maxPorEmail; i++ {
		if _, err := codigos.Emitir(ctx, "uno@example.com", ""); err != nil {
			t.Fatalf("emitiendo: %v", err)
		}
	}
	if err := limites.Permite(ctx, "uno@example.com", ""); !errors.Is(err, ErrLimiteExcedido) {
		t.Fatalf("el primero tendria que estar frenado, y dio: %v", err)
	}
	if err := limites.Permite(ctx, "otro@example.com", ""); err != nil {
		t.Fatalf("otra direccion no tendria que estar frenada, y dio: %v", err)
	}
}

func TestElLimitePorOrigenFrena(t *testing.T) {
	limites, codigos, _, ctx := limitesDePrueba(t)

	const origen = "203.0.113.7"
	// Direcciones distintas a proposito: lo que tiene que frenar acá es el
	// origen, no el mail. Con la misma direccion frenaria el otro limite y la
	// prueba pasaria sin ejercitar lo que dice ejercitar.
	for i := 0; i < maxPorOrigen; i++ {
		email := fmt.Sprintf("origen%02d@example.com", i)
		if err := limites.Permite(ctx, email, origen); err != nil {
			t.Fatalf("el pedido %d tendria que pasar, y dio: %v", i+1, err)
		}
		if _, err := codigos.Emitir(ctx, email, origen); err != nil {
			t.Fatalf("emitiendo: %v", err)
		}
	}

	if err := limites.Permite(ctx, "elqueviene@example.com", origen); !errors.Is(err, ErrLimiteExcedido) {
		t.Fatalf("pasado el tope por origen tendria que frenar, y dio: %v", err)
	}
	// Control positivo: desde otro origen se puede.
	if err := limites.Permite(ctx, "elqueviene@example.com", "198.51.100.4"); err != nil {
		t.Fatalf("otro origen no tendria que estar frenado, y dio: %v", err)
	}
}

// TestUnXForwardedForInventadoNoSalteaElLimite es la prueba que justifica todo
// el comentario de OrigenDelPedido.
//
// El cliente puede mandar el encabezado que quiera. Si se tomara la **primera**
// entrada, cambiar esa cadena en cada pedido daria un origen distinto cada vez y
// el limite por origen no existiria. Se toma la ultima —la que agrego el proxy
// de confianza— y por eso las tres variantes de abajo tienen que resolver al
// **mismo** origen.
func TestUnXForwardedForInventadoNoSalteaElLimite(t *testing.T) {
	const real = "203.0.113.9"

	casos := []struct {
		nombre     string
		encabezado string
	}{
		{"solo el del proxy", real},
		{"el cliente invento uno adelante", "1.2.3.4, " + real},
		{"el cliente invento varios", "9.9.9.9, 8.8.8.8, " + real},
		{"con espacios de mas", "  1.2.3.4 ,   " + real + "   "},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/auth/codigo", nil)
			r.Header.Set("X-Forwarded-For", c.encabezado)
			r.RemoteAddr = "10.0.0.1:54321" // el proxy, igual para todos

			if got := OrigenDelPedido(r); got != real {
				t.Fatalf("se esperaba el origen del proxy %q y salio %q: el limite por origen se saltea cambiando una cadena", real, got)
			}
		})
	}
}

// TestSinEncabezadoCaeARemoteAddr cubre el caso local, donde no hay proxy.
//
// Es el control positivo del anterior: sin este, una implementacion que
// devolviera siempre la ultima entrada de una lista vacia —o cadena vacia—
// pasaria el test de arriba solo cuando el encabezado viene.
func TestSinEncabezadoCaeARemoteAddr(t *testing.T) {
	r := httptest.NewRequest("POST", "/auth/codigo", nil)
	r.RemoteAddr = "192.0.2.33:41234"

	if got := OrigenDelPedido(r); got != "192.0.2.33" {
		t.Fatalf("sin X-Forwarded-For tendria que salir el host de RemoteAddr sin puerto, y salio %q", got)
	}
}
