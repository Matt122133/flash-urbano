// Comando api es el servicio HTTP de Flash Urbano.
//
// Arranca en este orden, y el orden importa: configuracion, base, migraciones,
// rutas, servidor. Si algo de lo primero falla, el proceso termina en vez de
// levantar a medias — es preferible que Railway muestre un servicio caido a que
// muestre uno sano que falla contra el primer cliente real.
//
// Lo que este servicio NO hace: guardar pedidos (eso es 007) y calcular
// precios (eso vive en el navegador y no puede depender de que esto responda,
// FR-001 y FR-002).
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/config"
	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
)

func main() {
	if err := correr(); err != nil {
		log.Fatalf("el servicio no pudo arrancar: %v", err)
	}
}

// correr existe aparte de main para que los defer se ejecuten: log.Fatal llama
// a os.Exit, que los saltea.
func correr() error {
	cfg, err := config.Cargar()
	if err != nil {
		return err
	}

	// El contexto se cancela con SIGINT/SIGTERM. Railway manda SIGTERM al
	// desplegar; a partir de ahi hay que dejar de aceptar y terminar lo que
	// esta en curso.
	ctx, detener := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer detener()

	pool, err := db.Abrir(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// Migrar al arrancar hace que desplegar y migrar sean el mismo acto
	// (research D7). Es lo que vuelve cierto a SC-011 tambien en Railway,
	// donde no hay nadie para correr un comando aparte.
	if err := db.Migrar(ctx, pool); err != nil {
		return err
	}

	registro := rastro.Nuevo(pool)

	// Las purgas necesitan quien las dispare. Una funcion de limpieza que no
	// llama nadie deja crecer la tabla para siempre, y es un fallo que no
	// avisa.
	go db.ArrancarJanitor(ctx, db.Tarea{
		Nombre: "purga del rastro",
		Correr: func(ctx context.Context) (int64, error) {
			return registro.Purgar(ctx, cfg.RastroRetencion)
		},
	})

	srv := &http.Server{
		Addr:    ":" + cfg.Puerto,
		Handler: httpx.CORS(cfg.OrigenesPermitidos, rutas(pool)),

		// Sin estos plazos una conexion que nunca termina de mandar su pedido
		// ocupa una goroutine para siempre. El default de net/http es no tener
		// limite, y a la intemperie eso es un problema.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errServidor := make(chan error, 1)
	go func() {
		log.Printf("api escuchando en %s | origenes permitidos: %v",
			srv.Addr, cfg.OrigenesPermitidos)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errServidor <- err
		}
	}()

	select {
	case err := <-errServidor:
		return err
	case <-ctx.Done():
		log.Print("apagando")
	}

	// Contexto propio: el de arriba ya esta cancelado, y usarlo aca cortaria
	// las requests en curso en vez de darles tiempo a terminar.
	ctxApagado, cancelar := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelar()
	return srv.Shutdown(ctxApagado)
}

// rutas arma el enrutador.
//
// ServeMux de la biblioteca estandar, con los patrones por metodo que Go trae
// desde 1.22. Son siete endpoints: un framework agregaria una dependencia, una
// convencion propia y una version que mantener a cambio de nada medible a esta
// escala (research D5).
func rutas(pool *db.Pool) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /salud", salud(pool))
	return mux
}

// salud dice si el servicio esta vivo y si la base contesta.
//
// Las dos cosas, no solo la primera: un servicio que responde 200 sin poder
// hablar con la base le miente al chequeo de salud de Railway, que lo dejaria
// recibiendo trafico que no puede atender.
//
// Es lo primero que se construye y lo que se usa para probar el cruce de
// origenes antes de que exista un login al que culpar.
func salud(pool *db.Pool) http.HandlerFunc {
	type respuesta struct {
		Estado string `json:"estado"`
		Base   string `json:"base"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancelar := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancelar()

		if err := pool.Ping(ctx); err != nil {
			log.Printf("salud: la base no responde: %v", err)
			httpx.JSON(w, http.StatusServiceUnavailable,
				respuesta{Estado: "degradado", Base: "sin conexion"})
			return
		}

		httpx.JSON(w, http.StatusOK, respuesta{Estado: "ok", Base: "ok"})
	}
}
