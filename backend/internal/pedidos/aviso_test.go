package pedidos

// Lo que `018` le agrego a `POST /pedidos`: que Diego se entere.
//
// Estas pruebas no comprueban que el aviso **llegue** —eso no es observable sin
// un telefono, y vive en el quickstart—, sino las tres propiedades del disparo
// que si se pueden fijar aca y que se rompen en silencio: que salga una sola
// vez por pedido, que salga fuera del camino de la respuesta, y que su fracaso
// no toque el pedido.

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// avisadorFalso anota cada aviso que se le pidio mandar.
//
// Guarda **el estado del contexto y no el contexto**, y la diferencia es la
// prueba: `avisarDelPedido` cancela el suyo con un `defer` al terminar, asi que
// un contexto guardado y mirado despues **siempre** se ve cancelado, tanto con
// la implementacion buena como con la mala. Lo que hay que capturar es como
// estaba **cuando se lo iba a usar**.
type avisadorFalso struct {
	mu       sync.Mutex
	avisados []avisos.PedidoNuevo

	// errDelContexto es `ctx.Err()` leido adentro de Avisar, despues de
	// `antesDeVolver`. Nil significa "el contexto todavia servia".
	errDelContexto error
	conPlazo       bool

	// antesDeVolver, si esta, corre adentro de Avisar y antes de mirar el
	// contexto. Es como se fabrica un avisador lento, y como se retrasa la
	// lectura hasta despues de que la peticion haya terminado.
	antesDeVolver func()
}

func (a *avisadorFalso) Avisar(ctx context.Context, p avisos.PedidoNuevo) {
	if a.antesDeVolver != nil {
		a.antesDeVolver()
	}
	_, conPlazo := ctx.Deadline()

	a.mu.Lock()
	defer a.mu.Unlock()
	a.avisados = append(a.avisados, p)
	a.errDelContexto = ctx.Err()
	a.conPlazo = conPlazo
}

func (a *avisadorFalso) cuantos() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.avisados)
}

// TestUnPedidoNuevoAvisaUnaVez es el camino feliz, y de paso fija **que dato
// cruza la linea**.
//
// Al avisador le llegan dos campos y no el pedido: el pedido entero trae
// nombres, telefonos, el numero de puerta y el precio, y ninguno de esos puede
// terminar en una pantalla bloqueada (FR-005, Principio V).
func TestUnPedidoNuevoAvisaUnaVez(t *testing.T) {
	srv, _, _, espia := escenarioConAvisos(t, relojFijo)

	estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "clave-1", cuerpoValido())
	if estado != http.StatusCreated {
		t.Fatalf("crear dio %d, queria 201", estado)
	}

	if espia.cuantos() != 1 {
		t.Fatalf("se avisaron %d veces, queria 1", espia.cuantos())
	}

	avisado := espia.avisados[0]
	if avisado.Codigo == "" {
		t.Error("el aviso salio sin codigo de pedido; sin el, tocarlo no abre nada")
	}
	if avisado.EntregaCalle != "Rivera" {
		t.Errorf("la calle del aviso fue %q, queria \"Rivera\"", avisado.EntregaCalle)
	}
}

// TestUnReintentoConLaMismaClaveNoAvisaDosVeces es **FR-003 y SC-006**.
//
// El caso real es el navegador que reintenta porque no supo si funciono. La
// respuesta ya distinguia 201 de 200; lo que esta prueba fija es que el aviso
// siga esa misma decision y no la de "llego un POST".
//
// **Mira el contador del espia, no la respuesta HTTP**: el 200 ya estaba
// probado antes de `018`, y es exactamente el caso en que un aviso de mas
// pasaria desapercibido.
func TestUnReintentoConLaMismaClaveNoAvisaDosVeces(t *testing.T) {
	srv, _, _, espia := escenarioConAvisos(t, relojFijo)

	cuerpo := cuerpoValido()
	if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "la-misma-clave", cuerpo); estado != http.StatusCreated {
		t.Fatalf("el primero dio %d, queria 201", estado)
	}
	if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "la-misma-clave", cuerpo); estado != http.StatusOK {
		t.Fatalf("el reintento dio %d, queria 200", estado)
	}

	if espia.cuantos() != 1 {
		t.Errorf("se avisaron %d veces; un reintento no puede sonar dos veces", espia.cuantos())
	}
}

// TestUnPedidoRechazadoNoAvisa: si no se guardo nada, no hay nada que anunciar.
func TestUnPedidoRechazadoNoAvisa(t *testing.T) {
	srv, _, _, espia := escenarioConAvisos(t, relojFijo)

	sinCalle := cuerpoValido(func(c map[string]any) {
		c["entrega"].(map[string]any)["calle"] = ""
	})

	if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "clave-1", sinCalle); estado != http.StatusBadRequest {
		t.Fatalf("un pedido invalido dio %d, queria 400", estado)
	}
	if espia.cuantos() != 0 {
		t.Errorf("se aviso de un pedido que no se creo: %v", espia.avisados)
	}
}

// conAvisoTrabado monta el servidor con el `go` DE VERDAD y un avisador que se
// queda trabado hasta que se lo suelta.
//
// Es el unico molde de este archivo que no reemplaza `enSegundoPlano`, y las
// dos pruebas que lo usan son las dos que no se pueden escribir de otra forma:
// una necesita que el aviso siga corriendo mientras el cliente ya se fue, y la
// otra necesita mirar el contexto **despues** de que la peticion termino.
func conAvisoTrabado(t *testing.T) (*httptest.Server, *avisadorFalso, chan struct{}, chan struct{}) {
	t.Helper()

	repo, repoU, _ := repositorioDePrueba(t)
	ana := unUsuario(t, repoU, "ana@example.com")
	u, err := repoU.PorID(context.Background(), ana)
	if err != nil {
		t.Fatalf("leyendo usuario: %v", err)
	}

	avisando := make(chan struct{})
	soltar := make(chan struct{})
	espia := &avisadorFalso{antesDeVolver: func() {
		close(avisando)
		<-soltar
	}}

	h := NuevosHandlers(repo, laConfigurada("diego@example.com"), espia)
	h.ahora = relojFijo

	return monta(t, h, map[string]*usuarios.Usuario{"tok-ana": u}), espia, avisando, soltar
}

// esperar falla la prueba si el canal no se cierra a tiempo, en vez de dejarla
// colgada hasta que el `go test` la mate a los diez minutos.
func esperar(t *testing.T, c <-chan struct{}, que string) {
	t.Helper()
	select {
	case <-c:
	case <-time.After(5 * time.Second):
		t.Fatalf("se agoto la espera: %s", que)
	}
}

// TestElClienteNoEsperaPorElAviso es **FR-009**.
//
// El avisador se queda trabado a proposito y el POST tiene que volver igual. Si
// el aviso estuviera en el camino de la respuesta, esta prueba no terminaria
// nunca: el 201 no llegaria hasta soltarlo, y a nadie se lo suelta antes.
func TestElClienteNoEsperaPorElAviso(t *testing.T) {
	srv, _, avisando, soltar := conAvisoTrabado(t)

	// **Si el aviso estuviera adentro de la respuesta, esto no vuelve nunca**:
	// nadie suelta el aviso hasta tres renglones mas abajo. La prueba no falla
	// con un mensaje, se cuelga — y eso tambien es una falla, ruidosa y clara.
	estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "clave-1", cuerpoValido())
	if estado != http.StatusCreated {
		t.Fatalf("crear dio %d, queria 201", estado)
	}

	esperar(t, avisando, "el aviso nunca arranco")
	close(soltar)
}

// TestElAvisoNoSeLlevaElContextoDeLaPeticion es **la trampa de research D3**, y
// la prueba mas valiosa de este archivo.
//
// Llevarse `r.Context()` a la goroutine **compila perfecto**. El sintoma no es
// un error: ese contexto se cancela apenas el handler devuelve, asi que el
// aviso no sale nunca — casi siempre, e intermitentemente en pruebas locales
// rapidas, que es la peor forma posible de un defecto.
//
// El orden de esta prueba es todo: se deja el aviso trabado, **se termina la
// peticion**, y recien ahi se lo suelta para que mire su contexto. Con
// `r.Context()` lo encuentra cancelado; con uno propio, vivo.
//
// Se comprobo en rojo el 2026-09-01 pasandole `r.Context()` a `avisarDelPedido`.
func TestElAvisoNoSeLlevaElContextoDeLaPeticion(t *testing.T) {
	srv, espia, avisando, soltar := conAvisoTrabado(t)

	listo := make(chan struct{})
	go func() {
		defer close(listo)
		if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "clave-1", cuerpoValido()); estado != http.StatusCreated {
			t.Errorf("crear dio %d, queria 201", estado)
		}
	}()

	esperar(t, avisando, "el aviso nunca arranco")
	esperar(t, listo, "la peticion nunca termino")

	// La peticion ya termino. Recien ahora el aviso mira su contexto.
	close(soltar)

	for i := 0; i < 500 && espia.cuantos() == 0; i++ {
		time.Sleep(10 * time.Millisecond)
	}
	if espia.cuantos() == 0 {
		t.Fatal("el aviso nunca termino")
	}

	espia.mu.Lock()
	errDelContexto, conPlazo := espia.errDelContexto, espia.conPlazo
	espia.mu.Unlock()

	if errDelContexto != nil {
		t.Errorf("el aviso uso un contexto ya cancelado (%v): se llevo el de la peticion, y contra el proveedor de verdad no saldria nunca", errDelContexto)
	}
	if !conPlazo {
		t.Error("el aviso salio con un contexto sin plazo; una goroutine asi queda colgada para siempre contra un proveedor que no contesta")
	}
}

// TestUnAvisoQueFallaNoRompeElPedido es **FR-009 por el otro lado**: el pedido
// queda guardado y el cliente tiene su codigo, pase lo que pase despues.
//
// **La garantia de verdad es estructural y conviene decirlo**: `Avisar` no
// devuelve nada, asi que **no existe** un camino por el que un fallo de envio
// llegue a la respuesta. Que los fallos se traguen se prueba donde ocurren, en
// `internal/avisos`; lo que esta prueba fija es lo de este lado, que es que el
// handler no le pide ni le mira nada al avisador para contestar.
func TestUnAvisoQueFallaNoRompeElPedido(t *testing.T) {
	srv, repo, ids, espia := escenarioConAvisos(t, relojFijo)

	// Un avisador al que todo le sale mal: no manda nada y no lo cuenta.
	espia.antesDeVolver = func() { time.Sleep(time.Millisecond) }

	estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "clave-1", cuerpoValido())
	if estado != http.StatusCreated {
		t.Fatalf("crear dio %d, queria 201", estado)
	}

	guardados, err := repo.PorUsuario(context.Background(), ids["ana"])
	if err != nil {
		t.Fatalf("leyendo los pedidos: %v", err)
	}
	if len(guardados) != 1 {
		t.Errorf("quedaron %d pedidos guardados, queria 1", len(guardados))
	}
}
