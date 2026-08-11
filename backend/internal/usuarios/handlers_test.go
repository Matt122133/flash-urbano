package usuarios

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
)

// SC-010 y FR-020: un usuario no puede leer ni escribir el perfil de otro.
//
// La prueba **usa una sesion valida ajena al dato pedido**, que es el caso real:
// no es alguien sin credencial —eso lo frena el middleware y no prueba nada de
// este archivo— sino alguien identificado que intenta llegar a datos de otro.
//
// Se monta el handler detras del mismo middleware que en produccion. Probar el
// handler suelto, inyectando el usuario a mano en el contexto, dejaria sin
// verificar justo la parte que decide de quien son los datos.

/** monta arma un servidor con la ruta y un resolvedor de credenciales falso. */
func monta(t *testing.T, h *Handlers, credenciales map[string]*Usuario) *httptest.Server {
	t.Helper()

	resolver := func(_ context.Context, token string) (*Usuario, error) {
		u, hay := credenciales[token]
		if !hay {
			return nil, httpx.ErrSesionInvalida
		}
		return u, nil
	}

	mux := http.NewServeMux()
	mux.Handle("GET /yo", httpx.ConSesion(resolver, http.HandlerFunc(h.Yo)))
	mux.Handle("PUT /yo", httpx.ConSesion(resolver, http.HandlerFunc(h.ActualizarYo)))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func pedirComo(t *testing.T, srv *httptest.Server, metodo, ruta, token, cuerpo string) (int, Vista) {
	t.Helper()

	var lector *strings.Reader
	if cuerpo == "" {
		lector = strings.NewReader("")
	} else {
		lector = strings.NewReader(cuerpo)
	}

	req, err := http.NewRequest(metodo, srv.URL+ruta, lector)
	if err != nil {
		t.Fatalf("armando el pedido: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("haciendo el pedido: %v", err)
	}
	defer res.Body.Close()

	var vista Vista
	_ = json.NewDecoder(res.Body).Decode(&vista)
	return res.StatusCode, vista
}

// TestCadaUnoVeLoSuyo es el control positivo del archivo.
//
// Sin el, un handler que devolviera 500 a todo el mundo pasaria las pruebas de
// aislamiento de abajo con nota perfecta.
func TestCadaUnoVeLoSuyo(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	ana, err := repo.BuscarOCrear(ctx, "ana@example.com")
	if err != nil {
		t.Fatalf("creando a ana: %v", err)
	}
	beto, err := repo.BuscarOCrear(ctx, "beto@example.com")
	if err != nil {
		t.Fatalf("creando a beto: %v", err)
	}

	srv := monta(t, NuevosHandlers(repo), map[string]*Usuario{
		"token-de-ana":  ana,
		"token-de-beto": beto,
	})

	estado, vista := pedirComo(t, srv, "GET", "/yo", "token-de-ana", "")
	if estado != http.StatusOK {
		t.Fatalf("GET /yo de ana: estado %d, se esperaba 200", estado)
	}
	if vista.Email != "ana@example.com" {
		t.Errorf("email = %q, se esperaba el de ana", vista.Email)
	}

	estado, vista = pedirComo(t, srv, "GET", "/yo", "token-de-beto", "")
	if estado != http.StatusOK {
		t.Fatalf("GET /yo de beto: estado %d, se esperaba 200", estado)
	}
	if vista.Email != "beto@example.com" {
		t.Errorf("email = %q, se esperaba el de beto", vista.Email)
	}
}

// TestUnIdentificadorAjenoEnElCuerpoNoCambiaNada es SC-010 en su forma mas
// concreta: el intento real de tocar el perfil de otro.
//
// Se prueba de dos maneras porque son dos defensas distintas y conviene que las
// dos existan: el campo desconocido lo rechaza `LeerJSON` con
// DisallowUnknownFields, y aunque pasara, el identificador sale del contexto.
func TestUnIdentificadorAjenoEnElCuerpoNoCambiaNada(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	ana, err := repo.BuscarOCrear(ctx, "ana@example.com")
	if err != nil {
		t.Fatalf("creando a ana: %v", err)
	}
	beto, err := repo.BuscarOCrear(ctx, "beto@example.com")
	if err != nil {
		t.Fatalf("creando a beto: %v", err)
	}

	srv := monta(t, NuevosHandlers(repo), map[string]*Usuario{"token-de-ana": ana})

	// Ana, identificada, manda el id de Beto en el cuerpo.
	cuerpo := `{"id":"` + beto.ID + `","nombre":"Intrusa","telefono":"099000000"}`
	estado, _ := pedirComo(t, srv, "PUT", "/yo", "token-de-ana", cuerpo)
	if estado != http.StatusBadRequest {
		t.Errorf("estado = %d, se esperaba 400: un campo desconocido no puede ignorarse en silencio", estado)
	}

	// Y lo que importa de verdad: Beto quedo intacto.
	betoAhora, err := repo.PorID(ctx, beto.ID)
	if err != nil {
		t.Fatalf("releyendo a beto: %v", err)
	}
	if betoAhora.Nombre != nil {
		t.Errorf("el nombre de beto es %q, tenia que seguir sin cargar", *betoAhora.Nombre)
	}
	if betoAhora.PerfilCompleto {
		t.Error("el perfil de beto quedo completo: alguien lo escribio desde otra sesion")
	}
}

// TestEscribirConLaPropiaSesionSoloTocaLoPropio cierra el flanco que queda: aun
// sin mandar identificadores ajenos, escribir con la credencial de uno **no
// puede** modificar la fila del otro.
func TestEscribirConLaPropiaSesionSoloTocaLoPropio(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	ana, err := repo.BuscarOCrear(ctx, "ana@example.com")
	if err != nil {
		t.Fatalf("creando a ana: %v", err)
	}
	beto, err := repo.BuscarOCrear(ctx, "beto@example.com")
	if err != nil {
		t.Fatalf("creando a beto: %v", err)
	}

	srv := monta(t, NuevosHandlers(repo), map[string]*Usuario{"token-de-ana": ana})

	cuerpo := `{"nombre":"Ana","telefono":"099111222",
	            "retiro":{"calle":"Rivera","esquina":"Soca","numero":"1234",
	                      "punto":{"lat":-34.9011,"lng":-56.1645}}}`
	estado, vista := pedirComo(t, srv, "PUT", "/yo", "token-de-ana", cuerpo)
	if estado != http.StatusOK {
		t.Fatalf("PUT /yo de ana: estado %d, se esperaba 200", estado)
	}
	if vista.Retiro == nil || vista.Retiro.Calle != "Rivera" {
		t.Fatalf("la direccion no volvio en la respuesta: %+v", vista.Retiro)
	}
	// FR-019a: el punto se guarda tal cual se dejo, no reducido a la esquina.
	if vista.Retiro.Punto == nil || vista.Retiro.Punto.Lat != -34.9011 {
		t.Errorf("punto = %+v, se esperaba el que se mando", vista.Retiro.Punto)
	}

	betoAhora, err := repo.PorID(ctx, beto.ID)
	if err != nil {
		t.Fatalf("releyendo a beto: %v", err)
	}
	if betoAhora.RetiroCalle != nil || betoAhora.Nombre != nil {
		t.Error("beto cambio cuando escribio ana")
	}
}

// TestElAltaNoPisaLaDireccionGuardada cubre el caso que rompe el COALESCE si
// alguien lo saca: quien ya cargo su direccion y despues edita solo nombre y
// telefono no puede perderla.
func TestElAltaNoPisaLaDireccionGuardada(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	u, err := repo.BuscarOCrear(ctx, "ana@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	srv := monta(t, NuevosHandlers(repo), map[string]*Usuario{"tok": u})

	conDireccion := `{"nombre":"Ana","telefono":"099111222",
	                  "retiro":{"calle":"Rivera","esquina":"Soca","numero":"1234",
	                            "punto":{"lat":-34.9011,"lng":-56.1645}}}`
	if estado, _ := pedirComo(t, srv, "PUT", "/yo", "tok", conDireccion); estado != http.StatusOK {
		t.Fatalf("guardando la direccion: estado %d", estado)
	}

	// Ahora solo nombre y telefono, como manda la pantalla de alta.
	sinDireccion := `{"nombre":"Ana Maria","telefono":"099333444"}`
	estado, vista := pedirComo(t, srv, "PUT", "/yo", "tok", sinDireccion)
	if estado != http.StatusOK {
		t.Fatalf("actualizando sin direccion: estado %d", estado)
	}
	if vista.Nombre != "Ana Maria" {
		t.Errorf("nombre = %q, se esperaba el nuevo", vista.Nombre)
	}
	if vista.Retiro == nil {
		t.Fatal("la direccion guardada desaparecio al editar nombre y telefono")
	}
	if vista.Retiro.Calle != "Rivera" {
		t.Errorf("calle = %q, se esperaba la que ya estaba", vista.Retiro.Calle)
	}
}

// TestUnaDireccionAMediasSeRechaza: FR-019a, los cuatro campos van juntos.
//
// Guardar lo que llego seria peor que rechazar: el sitio precarga la direccion,
// y una a medias deja al cliente sin saber si tiene que completarla o
// corregirla.
func TestUnaDireccionAMediasSeRechaza(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	u, err := repo.BuscarOCrear(ctx, "ana@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	srv := monta(t, NuevosHandlers(repo), map[string]*Usuario{"tok": u})

	casos := map[string]string{
		"sin punto":   `{"nombre":"A","telefono":"099","retiro":{"calle":"Rivera","esquina":"Soca","numero":"1"}}`,
		"sin calle":   `{"nombre":"A","telefono":"099","retiro":{"esquina":"Soca","numero":"1","punto":{"lat":-34.9,"lng":-56.1}}}`,
		"sin esquina": `{"nombre":"A","telefono":"099","retiro":{"calle":"Rivera","numero":"1","punto":{"lat":-34.9,"lng":-56.1}}}`,
		"sin numero":  `{"nombre":"A","telefono":"099","retiro":{"calle":"Rivera","esquina":"Soca","punto":{"lat":-34.9,"lng":-56.1}}}`,
		"punto fuera del mundo": `{"nombre":"A","telefono":"099","retiro":{"calle":"Rivera","esquina":"Soca","numero":"1",
		                            "punto":{"lat":900,"lng":-56.1}}}`,
	}

	for nombre, cuerpo := range casos {
		t.Run(nombre, func(t *testing.T) {
			estado, _ := pedirComo(t, srv, "PUT", "/yo", "tok", cuerpo)
			if estado != http.StatusBadRequest {
				t.Errorf("estado = %d, se esperaba 400", estado)
			}
		})
	}

	// Control positivo: la misma direccion completa SI entra. Sin esto, un
	// handler que rechazara todo pasaria los cinco casos de arriba.
	completa := `{"nombre":"A","telefono":"099","retiro":{"calle":"Rivera","esquina":"Soca","numero":"1",
	              "punto":{"lat":-34.9,"lng":-56.1}}}`
	if estado, _ := pedirComo(t, srv, "PUT", "/yo", "tok", completa); estado != http.StatusOK {
		t.Errorf("la direccion completa dio %d, tenia que entrar", estado)
	}
}
