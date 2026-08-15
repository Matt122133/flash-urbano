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

// monta un servidor con las tres rutas y el middleware de sesion, resolviendo
// credenciales contra un mapa.
//
// Se montan las tres juntas y con el mismo `conSesion` que usa main.go: si
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

// La entrega NO lleva punto (FR-007a de `003`). Mandarlo es 400, no un dato que
// se descarta callado.
func TestLaEntregaNoAceptaPunto(t *testing.T) {
	srv, _, _ := escenario(t, relojFijo)

	conPunto := cuerpoValido(func(c map[string]any) {
		e := c["entrega"].(map[string]any)
		e["punto"] = map[string]any{"lat": -34.9, "lng": -56.2}
	})
	if estado, _ := pedir(t, srv, "POST", "/pedidos", "tok-ana", "k1", conPunto); estado != http.StatusBadRequest {
		t.Errorf("quiero 400, dio %d", estado)
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
		{"sin punto de retiro", func(c map[string]any) {
			delete(c["retiro"].(map[string]any), "punto")
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
