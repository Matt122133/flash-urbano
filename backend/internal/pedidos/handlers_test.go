package pedidos

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// monta un servidor con las cuatro rutas y el middleware de sesion,
// resolviendo credenciales contra un mapa.
//
// Se montan las cuatro juntas y con el mismo `conSesion` que usa main.go: si
// alguna quedara abierta, se veria aca igual que se ve alla.
func monta(t *testing.T, h *Handlers, credenciales map[string]*usuarios.Usuario) *httptest.Server {
	t.Helper()

	resolver := func(_ context.Context, token string) (*usuarios.Usuario, error) {
		u, hay := credenciales[token]
		if !hay {
			// httpx.ErrSesionInvalida y no un error cualquiera: `ConSesion`
			// distingue "esta credencial no sirve" (401) de "la base fallo"
			// (500), y con razon — decirle a alguien que reingrese cuando lo que
			// fallo fue la base no arregla nada, porque reingresar toca la misma
			// base. Un doble que devuelva un error generico prueba el camino
			// equivocado.
			return nil, httpx.ErrSesionInvalida
		}
		return u, nil
	}
	conSesion := func(f http.HandlerFunc) http.Handler {
		return httpx.ConSesion(resolver, f)
	}

	mux := http.NewServeMux()
	mux.Handle("POST /pedidos", conSesion(h.Crear))
	mux.Handle("GET /pedidos", conSesion(h.Mios))
	mux.Handle("GET /admin/pedidos", conSesion(h.Todos))
	mux.Handle("PATCH /admin/pedidos/{id}/estado", conSesion(h.CambiarEstado))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

// pedir hace una llamada y devuelve estado y cuerpo crudo.
func pedir(t *testing.T, srv *httptest.Server, metodo, ruta, token, clave, cuerpo string) (int, []byte) {
	t.Helper()

	req, err := http.NewRequest(metodo, srv.URL+ruta, strings.NewReader(cuerpo))
	if err != nil {
		t.Fatalf("armando el pedido: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if clave != "" {
		req.Header.Set(CabeceraIdempotencia, clave)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("haciendo el pedido: %v", err)
	}
	defer res.Body.Close()

	crudo, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("leyendo la respuesta: %v", err)
	}
	return res.StatusCode, crudo
}

// cuerpoValido es una peticion de creacion completa y correcta. Cada prueba
// cambia solo lo que le importa, que es lo que hace que se lea que prueba.
func cuerpoValido(cambios ...func(map[string]any)) string {
	c := map[string]any{
		"remitente": map[string]any{"nombre": "Ana Perez", "telefono": "099111222"},
		"retiro": map[string]any{
			"calle": "Doctor Martin Berinduague", "esquina": "Vicente Yanez Pinzon",
			"numero": "1234", "apto": "301", "cooperativa": false,
			"punto": map[string]any{"lat": -34.872, "lng": -56.16},
		},
		"entrega": map[string]any{
			"calle": "Rivera", "esquina": "Comercio",
			"numero": "4567", "apto": "", "cooperativa": false,
			// Desde 011 la entrega SI lleva punto, y es el que cobra.
			"punto": map[string]any{"lat": -34.872, "lng": -56.16},
		},
		"paquete":      map[string]any{"tamano": "chico", "cantidad": 1},
		"retiroCuando": map[string]any{"fecha": "2026-08-13", "hora": "10:30"},
		"destinatario": map[string]any{"nombre": "Juan Gomez", "telefono": "098765432"},
		"cobro":        map[string]any{"zonaId": 1, "precio": 200},
	}
	for _, f := range cambios {
		f(c)
	}
	b, _ := json.Marshal(c)
	return string(b)
}

// unMomento devuelve una funcion de reloj fija, para poder probar el borde de
// la medianoche sin esperar a que sean las 23:59.
func unMomento(iso string) func() time.Time {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		panic(err)
	}
	return func() time.Time { return t }
}

// escenario deja todo listo: repositorio, dos usuarios, un admin y el servidor.
func escenario(t *testing.T, reloj func() time.Time) (*httptest.Server, *Repositorio, map[string]string) {
	t.Helper()

	repo, repoU, _ := repositorioDePrueba(t)
	ana := unUsuario(t, repoU, "ana@example.com")
	beto := unUsuario(t, repoU, "beto@example.com")
	diego := unUsuario(t, repoU, "diego@example.com")

	ctx := context.Background()
	traer := func(id string) *usuarios.Usuario {
		u, err := repoU.PorID(ctx, id)
		if err != nil {
			t.Fatalf("leyendo usuario %s: %v", id, err)
		}
		return u
	}

	h := NuevosHandlers(repo, laConfigurada("diego@example.com"))
	if reloj != nil {
		h.ahora = reloj
	}

	srv := monta(t, h, map[string]*usuarios.Usuario{
		"tok-ana":   traer(ana),
		"tok-beto":  traer(beto),
		"tok-diego": traer(diego),
	})

	return srv, repo, map[string]string{"ana": ana, "beto": beto, "diego": diego}
}

func laConfigurada(direcciones ...string) func(string) bool {
	return func(email string) bool {
		for _, d := range direcciones {
			if strings.EqualFold(strings.TrimSpace(email), d) {
				return true
			}
		}
		return false
	}
}

// El reloj por defecto de las pruebas: un dia antes del retiro del cuerpo
// valido, para que la fecha nunca este vencida por el paso del tiempo real.
var relojFijo = unMomento("2026-08-12T15:00:00-03:00")

// ---------------------------------------------------------------------------

// FR-016 y FR-016a: la misma clave dos veces deja UN pedido, y la segunda
// responde 200 con el mismo — no 409, no uno nuevo.
//
// La diferencia entre 201 y 200 es lo que hace OBSERVABLE que la deduplicacion
// actuo. Sin ella no se puede probar de afuera.
func TestLaMismaClaveDaDoscientosYElMismoPedido(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	estado1, cuerpo1 := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", cuerpoValido())
	if estado1 != http.StatusCreated {
		t.Fatalf("primer intento: quiero 201, dio %d — %s", estado1, cuerpo1)
	}
	estado2, cuerpo2 := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", cuerpoValido())
	if estado2 != http.StatusOK {
		t.Fatalf("reintento: quiero 200, dio %d — %s", estado2, cuerpo2)
	}

	var r1, r2 respuestaCrear
	json.Unmarshal(cuerpo1, &r1)
	json.Unmarshal(cuerpo2, &r2)
	if r1.Pedido.ID != r2.Pedido.ID {
		t.Errorf("el reintento devolvio otro pedido: %s vs %s", r1.Pedido.ID, r2.Pedido.ID)
	}
	if r1.Pedido.Codigo != r2.Pedido.Codigo {
		t.Errorf("el reintento devolvio otro codigo: %s vs %s", r1.Pedido.Codigo, r2.Pedido.Codigo)
	}
}

// SC-005a — el control positivo. Dos pedidos identicos con claves distintas
// quedan LOS DOS. Sin este caso, "deja un solo pedido" lo satisface una
// implementacion que descarta pedidos buenos, y el falso positivo es un paquete
// que nadie pasa a buscar.
func TestDosIdenticosConClavesDistintasSeCreanLosDos(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)

	if e, c := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", cuerpoValido()); e != http.StatusCreated {
		t.Fatalf("primer paquete: %d — %s", e, c)
	}
	if e, c := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k2", cuerpoValido()); e != http.StatusCreated {
		t.Fatalf("segundo paquete: quiero 201, dio %d — %s. La deduplicacion se comio un pedido legitimo", e, c)
	}

	lista, err := repo.PorUsuario(context.Background(), ids["ana"])
	if err != nil {
		t.Fatalf("leyendo: %v", err)
	}
	if len(lista) != 2 {
		t.Errorf("quedaron %d pedidos, quiero 2", len(lista))
	}
}

// FR-016: sin la cabecera es 400, no un pedido creado en silencio.
func TestSinClaveDeIdempotenciaEs400(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)

	estado, cuerpo := pedir(t, srv, "POST", "/pedidos", "tok-ana", "", cuerpoValido())
	if estado != http.StatusBadRequest {
		t.Fatalf("quiero 400, dio %d — %s", estado, cuerpo)
	}

	lista, _ := repo.PorUsuario(context.Background(), ids["ana"])
	if len(lista) != 0 {
		t.Errorf("se creo un pedido sin clave: %d filas", len(lista))
	}
}

// FR-010 y SC-004: sin credencial valida no hay pedido, con independencia de lo
// que haga el sitio. Se prueba **saltandose el sitio**, que es el punto.
func TestSinCredencialNoSeCreaNada(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)

	for _, tok := range []string{"", "tok-inventado"} {
		estado, _ := pedir(t, srv, "POST", "/pedidos", tok, "k1", cuerpoValido())
		if estado != http.StatusUnauthorized {
			t.Errorf("con token %q: quiero 401, dio %d", tok, estado)
		}
	}

	for _, id := range []string{ids["ana"], ids["beto"]} {
		lista, _ := repo.PorUsuario(context.Background(), id)
		if len(lista) != 0 {
			t.Errorf("se creo un pedido sin credencial")
		}
	}
}

// El usuario sale de la CREDENCIAL y de ningun otro lado. Mandarlo en el cuerpo
// da 400 por DisallowUnknownFields, no un pedido a nombre de otro.
func TestNoSePuedeCrearAppNombreDeOtroDesdeElCuerpo(t *testing.T) {
	srv, repo, ids := escenario(t, relojFijo)

	conUsuarioAjeno := cuerpoValido(func(c map[string]any) {
		c["usuarioId"] = ids["beto"]
	})
	estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", conUsuarioAjeno)
	if estado != http.StatusBadRequest {
		t.Errorf("quiero 400 por campo desconocido, dio %d", estado)
	}

	lista, _ := repo.PorUsuario(context.Background(), ids["beto"])
	if len(lista) != 0 {
		t.Error("se creo un pedido a nombre de Beto desde el cuerpo")
	}
}

// Los tres casos del contrato de 011: que punto se exige y cual no.
//
// **El del medio es el que importa y el que se puede romper sin querer.** Hasta
// `010` el servicio rechazaba un pedido sin punto de retiro; desde `011` eso es
// VALIDO —una calle que no resuelve o una homonima se guardan como texto, sin
// coordenadas y sin avisar (FR-014, FR-015)— y un 400 ahi seria rechazar lo que
// el feature decidio aceptar.
func TestQuePuntoSeExigeYCualNo(t *testing.T) {
	casos := []struct {
		nombre string
		ajuste func(map[string]any)
		estado int
		porQue string
	}{
		{
			nombre: "con los dos puntos",
			ajuste: func(c map[string]any) {},
			estado: http.StatusCreated,
			porQue: "el caso comun",
		},
		{
			nombre: "sin punto de retiro",
			ajuste: func(c map[string]any) {
				delete(c["retiro"].(map[string]any), "punto")
			},
			estado: http.StatusCreated,
			porQue: "FR-015: el retiro que no resuelve se guarda igual",
		},
		{
			nombre: "sin punto de entrega",
			ajuste: func(c map[string]any) {
				delete(c["entrega"].(map[string]any), "punto")
			},
			estado: http.StatusBadRequest,
			porQue: "de ese punto sale el precio: sin el no hay pedido",
		},
	}

	for i, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			srv, repo, ids := escenario(t, relojFijo)
			clave := fmt.Sprintf("clave-%d", i)

			estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", clave, cuerpoValido(caso.ajuste))
			if estado != caso.estado {
				t.Errorf("quiero %d, dio %d (%s)", caso.estado, estado, caso.porQue)
			}

			// Control positivo del caso del medio: no alcanza con que conteste
			// 201, la fila tiene que estar y con el punto de retiro en nulo.
			if caso.nombre == "sin punto de retiro" {
				lista, err := repo.PorUsuario(context.Background(), ids["ana"])
				if err != nil {
					t.Fatalf("releyendo: %v", err)
				}
				if len(lista) != 1 {
					t.Fatalf("quiero 1 pedido guardado, hay %d", len(lista))
				}
				if lista[0].Retiro.Punto != nil {
					t.Error("el retiro volvio con punto, y se mando sin ninguno")
				}
				if lista[0].Entrega.Punto == nil {
					t.Error("la entrega volvio sin punto, y es el que cobra")
				}
			}
		})
	}
}

// Los campos obligatorios, el tamano y el cobro. Un pedido sin telefono de quien
// recibe es un pedido que Diego no puede trabajar.
func TestLasValidacionesRechazanLoQueTienenQueRechazar(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	casos := []struct {
		nombre string
		cambio func(map[string]any)
	}{
		{"sin telefono de quien recibe", func(c map[string]any) {
			c["destinatario"].(map[string]any)["telefono"] = ""
		}},
		{"sin nombre de quien envia", func(c map[string]any) {
			c["remitente"].(map[string]any)["nombre"] = "  "
		}},
		{"sin punto de entrega", func(c map[string]any) {
			delete(c["entrega"].(map[string]any), "punto")
		}},
		{"tamano invalido", func(c map[string]any) {
			c["paquete"].(map[string]any)["tamano"] = "enorme"
		}},
		{"cantidad cero", func(c map[string]any) {
			c["paquete"].(map[string]any)["cantidad"] = 0
		}},
		{"precio cero", func(c map[string]any) {
			c["cobro"].(map[string]any)["precio"] = 0
		}},
		{"zona fuera de rango", func(c map[string]any) {
			c["cobro"].(map[string]any)["zonaId"] = 9
		}},
		{"hora invalida", func(c map[string]any) {
			c["retiroCuando"].(map[string]any)["hora"] = "25:99"
		}},
	}

	for i, caso := range casos {
		clave := fmt.Sprintf("k%d", i)
		estado, cuerpo := pedir(t, srv, "POST", "/pedidos", "tok-ana", clave, cuerpoValido(caso.cambio))
		if estado != http.StatusBadRequest {
			t.Errorf("%s: quiero 400, dio %d — %s", caso.nombre, estado, cuerpo)
		}
	}
}

// La fecha de retiro que ya paso se rechaza.
func TestLaFechaDeRetiroVencidaSeRechaza(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo) // "hoy" es el 12 de agosto

	ayer := cuerpoValido(func(c map[string]any) {
		c["retiroCuando"].(map[string]any)["fecha"] = "2026-08-11"
	})
	if estado, cuerpo := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", ayer); estado != http.StatusBadRequest {
		t.Errorf("una fecha de ayer: quiero 400, dio %d — %s", estado, cuerpo)
	}

	// El control positivo: HOY se acepta. Sin este caso, un validador que
	// rechazara todo pasaria la mitad de arriba con nota perfecta.
	hoy := cuerpoValido(func(c map[string]any) {
		c["retiroCuando"].(map[string]any)["fecha"] = "2026-08-12"
	})
	if estado, cuerpo := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k2", hoy); estado != http.StatusCreated {
		t.Errorf("una fecha de hoy: quiero 201, dio %d — %s", estado, cuerpo)
	}
}

// LA PRUEBA DE LA ZONA HORARIA, y la que cubre un bug que solo aparece de noche.
//
// A las 22:00 del 13 de agosto en Montevideo (UTC-3) son las 01:00 del 14 en
// UTC. En Railway el proceso corre en UTC, asi que un validador que compare
// contra la hora del proceso cree que ya es 14 y **rechaza un retiro valido para
// hoy 13**.
//
// El cliente ve "la fecha de retiro ya paso" sobre una fecha que no paso, entre
// las 21:00 y la medianoche, y nada mas. Sin esta prueba el defecto llega a
// produccion y se manifiesta solo en las horas en las que nadie lo esta mirando.
func TestALas22DeMontevideoElDiaDeHoySigueSiendoHoy(t *testing.T) {
	// 2026-08-13 22:00 en Montevideo == 2026-08-14 01:00 UTC.
	srv, _, _ := escenario(t, unMomento("2026-08-13T22:00:00-03:00"))

	hoyAlla := cuerpoValido(func(c map[string]any) {
		c["retiroCuando"].(map[string]any)["fecha"] = "2026-08-13"
		c["retiroCuando"].(map[string]any)["hora"] = "23:30"
	})
	estado, cuerpo := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", hoyAlla)
	if estado != http.StatusCreated {
		t.Fatalf("un retiro para hoy 13 pedido a las 22:00 de Montevideo fue rechazado: "+
			"quiero 201, dio %d — %s. La validacion esta usando la zona del proceso (UTC) "+
			"y no America/Montevideo", estado, cuerpo)
	}

	// Y el control: el 12 sigue estando vencido a esa misma hora.
	ayerAlla := cuerpoValido(func(c map[string]any) {
		c["retiroCuando"].(map[string]any)["fecha"] = "2026-08-12"
	})
	if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k2", ayerAlla); estado != http.StatusBadRequest {
		t.Errorf("el 12 a las 22:00 del 13: quiero 400, dio %d", estado)
	}
}

// FR-017 y SC-010: cada uno ve los suyos, y solo los suyos.
func TestCadaUnoVeSoloSusPedidos(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	pedir(t, srv, "POST", "/pedidos", "tok-ana", "a1", cuerpoValido())
	pedir(t, srv, "POST", "/pedidos", "tok-ana", "a2", cuerpoValido())
	pedir(t, srv, "POST", "/pedidos", "tok-beto", "b1", cuerpoValido())

	var deAna, deBeto respuestaLista
	_, cuerpoAna := pedir(t, srv, "GET", "/pedidos", "tok-ana", "", "")
	_, cuerpoBeto := pedir(t, srv, "GET", "/pedidos", "tok-beto", "", "")
	json.Unmarshal(cuerpoAna, &deAna)
	json.Unmarshal(cuerpoBeto, &deBeto)

	if len(deAna.Pedidos) != 2 {
		t.Errorf("Ana ve %d pedidos, quiero 2", len(deAna.Pedidos))
	}
	// El control positivo: que Beto vea el suyo demuestra que la consulta de
	// Ana filtro, y no que simplemente no habia mas pedidos.
	if len(deBeto.Pedidos) != 1 {
		t.Errorf("Beto ve %d pedidos, quiero 1", len(deBeto.Pedidos))
	}
	for _, p := range deBeto.Pedidos {
		for _, q := range deAna.Pedidos {
			if p.ID == q.ID {
				t.Errorf("el pedido %s aparece en las dos listas", p.ID)
			}
		}
	}
}

// FR-032: no hay parametro que permita pedir los de otro. No hay ?usuarioId= y
// no debe haberlo.
func TestNoHayParametroParaVerLosDeOtro(t *testing.T) {
	srv, _, ids := escenario(t, relojFijo)

	pedir(t, srv, "POST", "/pedidos", "tok-beto", "b1", cuerpoValido())

	for _, ruta := range []string{
		"/pedidos?usuarioId=" + ids["beto"],
		"/pedidos?usuario_id=" + ids["beto"],
		"/pedidos?id=" + ids["beto"],
	} {
		_, cuerpo := pedir(t, srv, "GET", ruta, "tok-ana", "", "")
		var lista respuestaLista
		json.Unmarshal(cuerpo, &lista)
		if len(lista.Pedidos) != 0 {
			t.Errorf("con %q Ana vio %d pedidos ajenos", ruta, len(lista.Pedidos))
		}
	}
}

// Una lista vacia es 200 con [], no 404 y no null.
func TestSinPedidosEs200ConListaVacia(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	estado, cuerpo := pedir(t, srv, "GET", "/pedidos", "tok-ana", "", "")
	if estado != http.StatusOK {
		t.Fatalf("quiero 200, dio %d", estado)
	}
	if !strings.Contains(string(cuerpo), `"pedidos":[]`) {
		t.Errorf("quiero una lista vacia, dio %s", cuerpo)
	}
}

// FR-031 y FR-032: la vista de administracion existe, y solo para quien la
// configuracion del entorno dice.
func TestSoloLaDireccionConfiguradaVeTodos(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	pedir(t, srv, "POST", "/pedidos", "tok-ana", "a1", cuerpoValido())
	pedir(t, srv, "POST", "/pedidos", "tok-beto", "b1", cuerpoValido())

	// Un cliente cualquiera: 403, y **403 y no 404** a proposito. Que exista una
	// ruta de administracion no es secreto, y un 404 mandaria a quien depura a
	// buscar un error de tipeo en la URL.
	if estado, _ := pedir(t, srv, "GET", "/admin/pedidos", "tok-ana", "", ""); estado != http.StatusForbidden {
		t.Errorf("un cliente cualquiera: quiero 403, dio %d", estado)
	}

	// La direccion configurada: 200 y ve los dos.
	estado, cuerpo := pedir(t, srv, "GET", "/admin/pedidos", "tok-diego", "", "")
	if estado != http.StatusOK {
		t.Fatalf("el administrador: quiero 200, dio %d — %s", estado, cuerpo)
	}
	var todos respuestaLista
	json.Unmarshal(cuerpo, &todos)
	if len(todos.Pedidos) != 2 {
		t.Errorf("el administrador ve %d pedidos, quiero 2", len(todos.Pedidos))
	}
}

// Ser administrador sale del ENTORNO, no de la base ni del cuerpo. Cambiar la
// configuracion cambia el resultado sin tocar una fila.
func TestSerAdministradorSaleDelEntorno(t *testing.T) {
	repo, repoU, _ := repositorioDePrueba(t)
	ana := unUsuario(t, repoU, "ana@example.com")
	u, err := repoU.PorID(context.Background(), ana)
	if err != nil {
		t.Fatalf("leyendo usuario: %v", err)
	}
	credenciales := map[string]*usuarios.Usuario{"tok-ana": u}

	sin := monta(t, NuevosHandlers(repo, laConfigurada("otro@example.com")), credenciales)
	if estado, _ := pedir(t, sin, "GET", "/admin/pedidos", "tok-ana", "", ""); estado != http.StatusForbidden {
		t.Errorf("sin estar configurada: quiero 403, dio %d", estado)
	}

	con := monta(t, NuevosHandlers(repo, laConfigurada("ana@example.com")), credenciales)
	if estado, _ := pedir(t, con, "GET", "/admin/pedidos", "tok-ana", "", ""); estado != http.StatusOK {
		t.Errorf("con la configuracion cambiada: quiero 200, dio %d", estado)
	}
}

// Exigir una cabecera que el CORS no autoriza es exigir algo que el navegador
// nunca va a poder mandar.
//
// Esta prueba existe porque eso paso de verdad: `CabeceraIdempotencia` se
// introdujo aca, `httpx.CabecerasPermitidas` quedo con la lista de `006`, y
// entre las dos ninguna prueba miraba a la otra. El resultado fue que **ningun
// navegador podia crear un pedido** —el preflight se rechazaba y el POST no
// salia— con el `verify:` entero en verde. Lo encontro una prueba manual.
//
// Es el unico lugar del repo que puede verificarlo: `httpx` no puede importar
// `pedidos` sin cerrar un ciclo, asi que la union se comprueba desde este lado.
// Renombrar la cabecera sin tocar el CORS pone esto en rojo.
func TestLaCabeceraDeIdempotenciaEstaAutorizadaPorElCORS(t *testing.T) {
	autorizadas := strings.ToLower(httpx.CabecerasPermitidas)
	if !strings.Contains(autorizadas, strings.ToLower(CabeceraIdempotencia)) {
		t.Errorf(
			"el endpoint exige %q y el CORS autoriza %q: el navegador no puede mandarla",
			CabeceraIdempotencia, httpx.CabecerasPermitidas,
		)
	}
}

// ---------------------------------------------------------------------------
// PATCH /admin/pedidos/{id}/estado — la tabla del contrato, seccion 1.
//
// specs/012-app-repartidor/contracts/servicio-y-pantallas.md. Hasta `012` todo
// pedido decia "Pendiente" para siempre: el ciclo de vida existia en la base y
// no habia una linea que lo moviera.
// ---------------------------------------------------------------------------

// unPedidoCreado crea un pedido por HTTP y devuelve su id y su estado inicial.
//
// El nombre lleva sufijo porque `unPedido` ya existe en pedido_test.go, del
// mismo paquete, y arma un `Nuevo` para el repositorio en vez de llamar al
// endpoint.
func unPedidoCreado(t *testing.T, srv *httptest.Server, token, clave string) (string, string) {
	t.Helper()
	estado, cuerpo := pedir(t, srv, "POST", "/pedidos", token, clave, cuerpoValido())
	if estado != http.StatusCreated {
		t.Fatalf("creando el pedido: quiero 201, dio %d — %s", estado, cuerpo)
	}
	var r respuestaCrear
	if err := json.Unmarshal(cuerpo, &r); err != nil {
		t.Fatalf("leyendo el pedido creado: %v", err)
	}
	return r.Pedido.ID, r.Pedido.Estado
}

// mover pide el cambio de estado y devuelve el codigo y el cuerpo.
func mover(t *testing.T, srv *httptest.Server, token, id, estado string) (int, []byte) {
	t.Helper()
	return pedir(t, srv, "PATCH", "/admin/pedidos/"+id+"/estado", token, "",
		`{"estado":"`+estado+`"}`)
}

// contarHistorial cuenta las filas de `pedidos_estados` de un pedido.
//
// Va contra la tabla y no contra un endpoint porque **no hay endpoint**: el
// historial se escribe y se guarda, no se muestra (FR-014). Se llega al pool
// por `repo.pool` — la prueba vive en el mismo paquete.
func contarHistorial(t *testing.T, repo *Repositorio, id string) int {
	t.Helper()
	var n int
	if err := repo.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM pedidos_estados WHERE pedido_id = $1`, id).Scan(&n); err != nil {
		t.Fatalf("contando el historial: %v", err)
	}
	return n
}

// El estado se mueve en las DOS direcciones (FR-004), y cada movimiento deja su
// fila.
//
// **Es tambien el control positivo de TestElMismoEstadoDosVecesNoAgregaHistorial**:
// aquella prueba afirma que el contador NO crece, y sin esta no habria nada que
// demuestre que sabria notarlo si creciera.
func TestElEstadoSeMueveEnLasDosDireccionesYDejaHistorial(t *testing.T) {
	srv, repo, _ := escenario(t, relojFijo)
	id, inicial := unPedidoCreado(t, srv, "tok-ana", "a1")

	if inicial != EstadoCreacion {
		t.Fatalf("un pedido nuevo nace en %q, quiero %q", inicial, EstadoCreacion)
	}
	if n := contarHistorial(t, repo, id); n != 0 {
		t.Fatalf("un pedido recien creado tiene %d filas de historial, quiero 0 — el historial empieza cuando empieza, no se rellena hacia atras", n)
	}

	// Hacia adelante, y de vuelta hacia atras. La reversion es un requisito
	// (FR-004): quien marca "entregado" de mas tiene que poder corregirlo desde
	// la calle, no llamando a alguien.
	pasos := []struct {
		estado string
		filas  int
	}{
		{EstadoAceptacion, 1},
		{EstadoEntrega, 2},
		{EstadoAceptacion, 3},
		{EstadoCreacion, 4},
	}
	for _, paso := range pasos {
		estado, cuerpo := mover(t, srv, "tok-diego", id, paso.estado)
		if estado != http.StatusOK {
			t.Fatalf("moviendo a %q: quiero 200, dio %d — %s", paso.estado, estado, cuerpo)
		}
		var r respuestaCrear
		if err := json.Unmarshal(cuerpo, &r); err != nil {
			t.Fatalf("leyendo la respuesta: %v", err)
		}
		if r.Pedido.Estado != paso.estado {
			t.Errorf("el pedido devuelto dice %q, quiero %q", r.Pedido.Estado, paso.estado)
		}
		if n := contarHistorial(t, repo, id); n != paso.filas {
			t.Errorf("tras mover a %q el historial tiene %d filas, quiero %d", paso.estado, n, paso.filas)
		}
	}
}

// FR-009: pedir el estado que el pedido YA tiene contesta 200 y **no agrega una
// fila**. Es lo que hace que tocar dos veces con guantes no ensucie el registro.
func TestElMismoEstadoDosVecesNoAgregaHistorial(t *testing.T) {
	srv, repo, _ := escenario(t, relojFijo)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")

	if estado, cuerpo := mover(t, srv, "tok-diego", id, EstadoAceptacion); estado != http.StatusOK {
		t.Fatalf("el primer movimiento: quiero 200, dio %d — %s", estado, cuerpo)
	}
	antes := contarHistorial(t, repo, id)
	if antes != 1 {
		t.Fatalf("tras el primer movimiento hay %d filas, quiero 1", antes)
	}

	// El segundo toque, identico. 200 igual: no es un error, es el caso normal.
	estado, cuerpo := mover(t, srv, "tok-diego", id, EstadoAceptacion)
	if estado != http.StatusOK {
		t.Fatalf("el segundo toque: quiero 200, dio %d — %s", estado, cuerpo)
	}
	if n := contarHistorial(t, repo, id); n != antes {
		t.Errorf("el segundo toque dejo el historial en %d filas, quiero %d — repetir un estado no es un cambio", n, antes)
	}
}

// Un valor que no es uno de los tres se rechaza con 400 y un mensaje legible.
// El CHECK de la base tambien lo pararia, pero su mensaje no se le puede
// mostrar a nadie.
func TestUnEstadoQueNoExisteEs400(t *testing.T) {
	srv, repo, _ := escenario(t, relojFijo)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")

	for _, invalido := range []string{"entregado", "confirmacion", "", "ENTREGA", "creacion; DROP TABLE pedidos"} {
		estado, cuerpo := mover(t, srv, "tok-diego", id, invalido)
		if estado != http.StatusBadRequest {
			t.Errorf("estado %q: quiero 400, dio %d — %s", invalido, estado, cuerpo)
		}
	}
	if n := contarHistorial(t, repo, id); n != 0 {
		t.Errorf("un rechazo dejo %d filas de historial, quiero 0", n)
	}
}

// Un id que no nombra ningun pedido es 404 — y **un id que ni siquiera es un
// uuid tambien**. Ese es 404 y no 500: una URL mal escrita no es una falla del
// servicio.
func TestUnPedidoQueNoExisteEs404(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	for _, id := range []string{
		"3f2504e0-4f89-11d3-9a0c-0305e82c3301", // uuid bien formado, inexistente
		"no-soy-un-uuid",
	} {
		estado, cuerpo := mover(t, srv, "tok-diego", id, EstadoAceptacion)
		if estado != http.StatusNotFound {
			t.Errorf("id %q: quiero 404, dio %d — %s", id, estado, cuerpo)
		}
	}
}

// SC-006: **sin credencial no se mueve nada, y con una credencial que no es
// administradora tampoco.**
//
// Es la prueba que importa de todo el archivo: el pedido que este camino
// devuelve trae el nombre, la direccion y el telefono de quien recibe.
func TestSinCredencialAdministradoraNoSeMueveNada(t *testing.T) {
	srv, repo, _ := escenario(t, relojFijo)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")

	// Sin credencial: 401, y lo contesta el middleware antes de tocar la base.
	if estado, cuerpo := mover(t, srv, "", id, EstadoEntrega); estado != http.StatusUnauthorized {
		t.Errorf("sin credencial: quiero 401, dio %d — %s", estado, cuerpo)
	}
	// Con una credencial inventada: 401 tambien.
	if estado, cuerpo := mover(t, srv, "tok-inventado", id, EstadoEntrega); estado != http.StatusUnauthorized {
		t.Errorf("con una credencial inventada: quiero 401, dio %d — %s", estado, cuerpo)
	}
	// Identificada pero NO administradora: 403. Es el caso peligroso — una
	// clienta cualquiera moviendo el pedido de otra.
	if estado, cuerpo := mover(t, srv, "tok-ana", id, EstadoEntrega); estado != http.StatusForbidden {
		t.Errorf("una clienta cualquiera: quiero 403, dio %d — %s", estado, cuerpo)
	}

	// Y el pedido no se movio ni una vez.
	if n := contarHistorial(t, repo, id); n != 0 {
		t.Errorf("el historial tiene %d filas tras tres rechazos, quiero 0", n)
	}
	estado, cuerpo := pedir(t, srv, "GET", "/pedidos", "tok-ana", "", "")
	if estado != http.StatusOK {
		t.Fatalf("releyendo: %d — %s", estado, cuerpo)
	}
	var lista respuestaLista
	json.Unmarshal(cuerpo, &lista)
	if len(lista.Pedidos) != 1 || lista.Pedidos[0].Estado != EstadoCreacion {
		t.Errorf("el pedido quedo en %v, quiero uno solo en %q", lista.Pedidos, EstadoCreacion)
	}
}
