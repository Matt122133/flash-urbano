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

	"github.com/Matt122133/flash-urbano/backend/internal/auth"
	"github.com/Matt122133/flash-urbano/backend/internal/config"
	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
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
	repoUsuarios := usuarios.Nuevo(pool)
	sesiones := auth.NuevasSesiones(pool, cfg.SesionDuracion)

	// El verificador se construye una sola vez y se comparte: adentro cachea las
	// claves publicas de Google. Uno nuevo por request las pediria de nuevo cada
	// vez, y ademas ataria cada ingreso a que Google responda en ese instante.
	//
	// El contexto que recibe gobierna ese cache, y por eso es el del proceso y
	// no el de un pedido: con el de un pedido, el cache moriria al responderlo.
	verificadorGoogle := auth.NuevoVerificadorGoogle(ctx, cfg.GoogleClientID)

	// Las purgas necesitan quien las dispare. Una funcion de limpieza que no
	// llama nadie deja crecer la tabla para siempre, y es un fallo que no
	// avisa.
	go db.ArrancarJanitor(ctx,
		db.Tarea{
			Nombre: "purga del rastro",
			Correr: func(ctx context.Context) (int64, error) {
				return registro.Purgar(ctx, cfg.RastroRetencion)
			},
		},
		db.Tarea{
			Nombre: "purga de sesiones vencidas",
			Correr: func(ctx context.Context) (int64, error) {
				// El margen es un dia: una sesion recien vencida todavia explica
				// el "tu sesion vencio" que el cliente puede estar mirando.
				return sesiones.PurgarVencidas(ctx, 24*time.Hour)
			},
		},
	)

	srv := &http.Server{
		Addr: ":" + cfg.Puerto,
		Handler: httpx.CORS(cfg.OrigenesPermitidos, rutas(pool, dependencias{
			auth:     auth.NuevosHandlers(verificadorGoogle, repoUsuarios, sesiones, registro),
			usuarios: usuarios.NuevosHandlers(repoUsuarios),
			resolver: sesiones.ResolverUsuario(repoUsuarios),
		})),

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

// dependencias es lo que las rutas necesitan para existir.
//
// Se agrupan en una estructura y no en cinco parametros sueltos porque la lista
// va a seguir creciendo con 007, y una firma de ocho parametros del mismo tipo
// es como se termina pasando dos en el orden equivocado sin que el compilador
// diga nada.
type dependencias struct {
	auth     *auth.Handlers
	usuarios *usuarios.Handlers

	// resolver convierte una credencial en un usuario. Lo consume el middleware.
	resolver func(context.Context, string) (*usuarios.Usuario, error)
}

// rutas arma el enrutador.
//
// ServeMux de la biblioteca estandar, con los patrones por metodo que Go trae
// desde 1.22. Son siete endpoints: un framework agregaria una dependencia, una
// convencion propia y una version que mantener a cambio de nada medible a esta
// escala (research D5).
//
// **Que endpoint pide credencial se ve leyendo esta funcion y nada mas.** Es a
// proposito: si la decision estuviera repartida dentro de cada handler, olvidar
// una es dejar un endpoint abierto sin que nada lo delate. Aca la ausencia de
// `conSesion` alrededor de una ruta salta a la vista.
func rutas(pool *db.Pool, dep dependencias) http.Handler {
	mux := http.NewServeMux()

	conSesion := func(h http.HandlerFunc) http.Handler {
		return httpx.ConSesion(dep.resolver, h)
	}

	// Abiertos: son las puertas. Pedirles credencial seria pedir estar adentro
	// para poder entrar.
	mux.HandleFunc("GET /salud", salud(pool))
	mux.HandleFunc("POST /auth/google", dep.auth.Google)

	// Con credencial.
	mux.Handle("POST /auth/salir", conSesion(dep.auth.Salir))
	mux.Handle("GET /yo", conSesion(dep.usuarios.Yo))
	mux.Handle("PUT /yo", conSesion(dep.usuarios.ActualizarYo))

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
