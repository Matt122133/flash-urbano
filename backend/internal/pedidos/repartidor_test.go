package pedidos

// Lo que `031` le agrega a la app: un segundo repartidor.
//
// Las tres propiedades que se rompen en silencio, y por eso estan aca:
//
//   - **la tabla del contrato §3**, fila por fila, incluida "entregado → 409";
//   - **el alcance del repartidor**: no ve ni mueve lo ajeno, y la respuesta a
//     lo ajeno es la misma que a un id inventado (FR-015);
//   - **el aviso**: solo al asignar A un repartidor, y solo si cambio de manos.
//
// Como el resto del paquete, necesitan Postgres y se saltean sin
// `TEST_DATABASE_URL`.

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

const (
	mailRita = "rita@example.com"
	mailRaul = "raul@example.com"
)

// escenarioConRepartidores es escenarioConAvisos con dos repartidores
// configurados: Rita, que entro alguna vez, y Raul, que tambien. Diego es el
// administrador; Ana, una clienta.
func escenarioConRepartidores(t *testing.T) (*httptest.Server, *Repositorio, *avisadorFalso) {
	t.Helper()

	repo, repoU, _ := repositorioDePrueba(t)
	ctx := context.Background()
	traer := func(email string) *usuarios.Usuario {
		u, err := repoU.PorID(ctx, unUsuario(t, repoU, email))
		if err != nil {
			t.Fatalf("leyendo usuario %s: %v", email, err)
		}
		return u
	}

	espia := &avisadorFalso{}
	h := NuevosHandlers(repo, laConfigurada("diego@example.com"), espia).
		ConRepartidores(laConfigurada(mailRita, mailRaul), func() []string {
			return []string{mailRita, mailRaul}
		})
	h.enSegundoPlano = func(f func()) { f() }
	h.ahora = relojFijo

	srv := monta(t, h, map[string]*usuarios.Usuario{
		"tok-ana":   traer("ana@example.com"),
		"tok-diego": traer("diego@example.com"),
		"tok-rita":  traer(mailRita),
		"tok-raul":  traer(mailRaul),
	})
	return srv, repo, espia
}

func asignar(t *testing.T, srv *httptest.Server, token, id, cuerpo string) (int, []byte) {
	t.Helper()
	return pedir(t, srv, "PUT", "/admin/pedidos/"+id+"/repartidor", token, "", cuerpo)
}

// guardadoDe lee la columna tal cual, sin pasar por `Responsable`.
func guardadoDe(t *testing.T, repo *Repositorio, id string) *string {
	t.Helper()
	var r *string
	if err := repo.pool.QueryRow(context.Background(),
		`SELECT repartidor_email FROM pedidos WHERE id = $1`, id).Scan(&r); err != nil {
		t.Fatalf("leyendo el repartidor guardado: %v", err)
	}
	return r
}

func listaDeLaApp(t *testing.T, srv *httptest.Server, token string) respuestaListaAdmin {
	t.Helper()
	estado, cuerpo := pedir(t, srv, "GET", "/admin/pedidos", token, "", "")
	if estado != http.StatusOK {
		t.Fatalf("GET /admin/pedidos con %s: %d — %s", token, estado, cuerpo)
	}
	var l respuestaListaAdmin
	if err := json.Unmarshal(cuerpo, &l); err != nil {
		t.Fatalf("leyendo la lista: %v", err)
	}
	return l
}

func error_(t *testing.T, cuerpo []byte) string {
	t.Helper()
	var e struct {
		Error string `json:"error"`
	}
	json.Unmarshal(cuerpo, &e)
	return e.Error
}

// --- contrato §3, fila por fila ---------------------------------------------

func TestLaTablaDeAsignar(t *testing.T) {
	srv, repo, _ := escenarioConRepartidores(t)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")
	const inventado = "6f1b0f1e-0000-4000-8000-000000000000"

	// Admin, mail de repartidor, con mayusculas y espacios: se normaliza.
	if estado, cuerpo := asignar(t, srv, "tok-diego", id, `{"repartidor":"  RITA@example.com "}`); estado != http.StatusOK {
		t.Fatalf("admin asigna a Rita: %d — %s", estado, cuerpo)
	}
	if g := guardadoDe(t, repo, id); g == nil || *g != mailRita {
		t.Fatalf("quedo guardado %v, queria %q", g, mailRita)
	}

	// Admin, mail que no es de repartidor: 400, y no se toca nada.
	estado, cuerpo := asignar(t, srv, "tok-diego", id, `{"repartidor":"ana@example.com"}`)
	if estado != http.StatusBadRequest || error_(t, cuerpo) != mensajeNoEsRepartidor {
		t.Errorf("asignar a una clienta: %d %q", estado, cuerpo)
	}
	// Admin asignandose a si mismo por mail: tampoco es un repartidor.
	if estado, _ := asignar(t, srv, "tok-diego", id, `{"repartidor":"diego@example.com"}`); estado != http.StatusBadRequest {
		t.Errorf("asignar a un admin: %d, queria 400", estado)
	}
	if g := guardadoDe(t, repo, id); g == nil || *g != mailRita {
		t.Fatalf("un 400 cambio el repartidor a %v", g)
	}

	// Rep, con mail: no es una accion suya.
	if estado, _ := asignar(t, srv, "tok-rita", id, `{"repartidor":"raul@example.com"}`); estado != http.StatusForbidden {
		t.Errorf("Rita reasignando: %d, queria 403", estado)
	}
	// Rep, null, ajeno: 404, el mismo texto que un id inventado.
	estado, cuerpo = asignar(t, srv, "tok-raul", id, `{"repartidor":null}`)
	if estado != http.StatusNotFound || error_(t, cuerpo) != "no hay tal pedido" {
		t.Errorf("Raul devolviendo lo de Rita: %d %q", estado, cuerpo)
	}
	estado, cuerpo = asignar(t, srv, "tok-raul", inventado, `{"repartidor":null}`)
	if estado != http.StatusNotFound || error_(t, cuerpo) != "no hay tal pedido" {
		t.Errorf("Raul devolviendo un id inventado: %d %q", estado, cuerpo)
	}
	// Rep, null, suyo: 200, vuelve a los administradores.
	if estado, cuerpo := asignar(t, srv, "tok-rita", id, `{"repartidor":null}`); estado != http.StatusOK {
		t.Fatalf("Rita devuelve lo suyo: %d — %s", estado, cuerpo)
	}
	if g := guardadoDe(t, repo, id); g != nil {
		t.Fatalf("despues de devolver quedo %q, queria nulo", *g)
	}

	// Admin, null, sobre uno ya de los administradores: 200 sin escribir.
	if estado, _ := asignar(t, srv, "tok-diego", id, `{"repartidor":null}`); estado != http.StatusOK {
		t.Errorf("admin desasigna lo suyo: %d, queria 200", estado)
	}
	// Admin, inexistente: 404.
	if estado, _ := asignar(t, srv, "tok-diego", inventado, `{"repartidor":"rita@example.com"}`); estado != http.StatusNotFound {
		t.Errorf("admin sobre un id inventado: %d, queria 404", estado)
	}
	// Otro: 403.
	if estado, _ := asignar(t, srv, "tok-ana", id, `{"repartidor":null}`); estado != http.StatusForbidden {
		t.Errorf("una clienta: %d, queria 403", estado)
	}
}

// FR-010b: al entregarse, el repartidor queda fijo, para el admin y para el
// repartidor sobre lo suyo.
func TestUnPedidoEntregadoNoCambiaDeRepartidor(t *testing.T) {
	srv, repo, _ := escenarioConRepartidores(t)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")

	asignar(t, srv, "tok-diego", id, `{"repartidor":"rita@example.com"}`)
	if estado, cuerpo := mover(t, srv, "tok-rita", id, EstadoEntrega); estado != http.StatusOK {
		t.Fatalf("Rita entrega lo suyo: %d — %s", estado, cuerpo)
	}

	estado, cuerpo := asignar(t, srv, "tok-diego", id, `{"repartidor":"raul@example.com"}`)
	if estado != http.StatusConflict || error_(t, cuerpo) != mensajeYaEntregado {
		t.Errorf("admin reasignando un entregado: %d %q", estado, cuerpo)
	}
	if estado, _ := asignar(t, srv, "tok-diego", id, `{"repartidor":null}`); estado != http.StatusConflict {
		t.Errorf("admin desasignando un entregado: %d, queria 409", estado)
	}
	if estado, _ := asignar(t, srv, "tok-rita", id, `{"repartidor":null}`); estado != http.StatusConflict {
		t.Errorf("Rita devolviendo lo suyo entregado: %d, queria 409", estado)
	}
	// Y a Raul, que no es suyo, no se le cuenta que esta entregado.
	if estado, _ := asignar(t, srv, "tok-raul", id, `{"repartidor":null}`); estado != http.StatusNotFound {
		t.Errorf("Raul sobre un entregado ajeno: %d, queria 404", estado)
	}

	if g := guardadoDe(t, repo, id); g == nil || *g != mailRita {
		t.Fatalf("el entregado quedo a nombre de %v, queria %q", g, mailRita)
	}
}

// --- el alcance del repartidor (FR-013, FR-015) -----------------------------

// TestElRepartidorNoVeNiMueveLoAjeno es T025.
//
// **El control positivo esta adentro**: el mismo repartidor SI ve y mueve lo
// suyo, asi que el 404 de lo ajeno no puede ser un repartidor que no ve nada.
// La version fuerte se hizo el 2026-10-18: quitando el filtro del SELECT de
// CambiarEstadoCon la prueba se pone en rojo en "Rita moviendo uno de Raul", y
// quitando el WHERE de PorRepartidor en "Rita ve 3 pedidos".
func TestElRepartidorNoVeNiMueveLoAjeno(t *testing.T) {
	srv, _, _ := escenarioConRepartidores(t)
	deRita, _ := unPedidoCreado(t, srv, "tok-ana", "a1")
	deRaul, _ := unPedidoCreado(t, srv, "tok-ana", "a2")
	deDiego, _ := unPedidoCreado(t, srv, "tok-ana", "a3")
	asignar(t, srv, "tok-diego", deRita, `{"repartidor":"rita@example.com"}`)
	asignar(t, srv, "tok-diego", deRaul, `{"repartidor":"raul@example.com"}`)

	// Lo que ve.
	l := listaDeLaApp(t, srv, "tok-rita")
	if l.Rol != RolRepartidor {
		t.Errorf("rol %q, queria %q", l.Rol, RolRepartidor)
	}
	if l.Repartidores != nil {
		t.Errorf("al repartidor le viajo la lista de repartidores: %v", l.Repartidores)
	}
	if len(l.Pedidos) != 1 || l.Pedidos[0].ID != deRita {
		t.Fatalf("Rita ve %d pedidos, queria solo el suyo", len(l.Pedidos))
	}

	// Lo que mueve: lo suyo si (control positivo)...
	if estado, cuerpo := mover(t, srv, "tok-rita", deRita, EstadoAceptacion); estado != http.StatusOK {
		t.Fatalf("Rita no pudo mover lo suyo: %d — %s", estado, cuerpo)
	}
	// ...lo de otro repartidor y lo de Diego no, con el texto de un id inventado.
	for nombre, id := range map[string]string{"de Raul": deRaul, "de Diego": deDiego} {
		estado, cuerpo := mover(t, srv, "tok-rita", id, EstadoAceptacion)
		if estado != http.StatusNotFound || error_(t, cuerpo) != "no hay tal pedido" {
			t.Errorf("Rita moviendo uno %s: %d %q", nombre, estado, cuerpo)
		}
	}

	// Y el admin sigue viendo todo, con el responsable de cada uno.
	admin := listaDeLaApp(t, srv, "tok-diego")
	if admin.Rol != RolAdmin || len(admin.Repartidores) != 2 {
		t.Errorf("admin: rol %q, %d repartidores", admin.Rol, len(admin.Repartidores))
	}
	responsables := map[string]string{}
	for _, p := range admin.Pedidos {
		if p.Responsable != nil {
			responsables[p.ID] = *p.Responsable
		}
	}
	if responsables[deRita] != mailRita || responsables[deRaul] != mailRaul || responsables[deDiego] != "" {
		t.Errorf("responsables vistos por el admin: %v", responsables)
	}
}

// FR-011: sacar a alguien de la configuracion le devuelve a Diego lo no
// entregado sin escribir nada; y si se entrega asi, queda de los
// administradores, no de quien ya no reparte.
func TestQuienSaleDeLaConfiguracionDejaDeTenerLoNoEntregado(t *testing.T) {
	srv, repo, _ := escenarioConRepartidores(t)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")
	asignar(t, srv, "tok-diego", id, `{"repartidor":"rita@example.com"}`)

	// Mismo repositorio, configuracion sin Rita.
	h := NuevosHandlers(repo, laConfigurada("diego@example.com"), &avisadorFalso{}).
		ConRepartidores(laConfigurada(mailRaul), func() []string { return []string{mailRaul} })
	h.enSegundoPlano = func(f func()) { f() }
	h.ahora = relojFijo
	repoU := usuarios.Nuevo(repo.pool)
	diego, err := repoU.PorID(context.Background(), unUsuario(t, repoU, "diego@example.com"))
	if err != nil {
		t.Fatal(err)
	}
	sinRita := monta(t, h, map[string]*usuarios.Usuario{"tok-diego": diego})

	for _, p := range listaDeLaApp(t, sinRita, "tok-diego").Pedidos {
		if p.ID == id && p.Responsable != nil {
			t.Fatalf("sin Rita configurada, el pedido sigue a nombre de %q", *p.Responsable)
		}
	}
	if g := guardadoDe(t, repo, id); g == nil || *g != mailRita {
		t.Fatalf("leer no puede escribir: la columna quedo en %v", g)
	}

	if estado, cuerpo := mover(t, sinRita, "tok-diego", id, EstadoEntrega); estado != http.StatusOK {
		t.Fatalf("Diego entrega: %d — %s", estado, cuerpo)
	}
	if g := guardadoDe(t, repo, id); g != nil {
		t.Errorf("entregado sin Rita configurada quedo a su nombre (%q): se le contaria a quien ya no reparte", *g)
	}
}

// --- el aviso (FR-017, FR-017a, FR-019a) ------------------------------------

func TestSoloAsignarAUnRepartidorAvisa(t *testing.T) {
	srv, _, espia := escenarioConRepartidores(t)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")

	asignar(t, srv, "tok-diego", id, `{"repartidor":"rita@example.com"}`)
	if espia.cuantosAsignados() != 1 {
		t.Fatalf("asignar dio %d avisos, queria 1", espia.cuantosAsignados())
	}
	if a := espia.asignados[0]; a.Repartidor != mailRita || a.Codigo == "" || a.EntregaCalle != "Rivera" {
		t.Errorf("el aviso fue %+v", a)
	}

	// Repetir no suena.
	asignar(t, srv, "tok-diego", id, `{"repartidor":"rita@example.com"}`)
	// Desasignar no suena.
	asignar(t, srv, "tok-rita", id, `{"repartidor":null}`)
	if espia.cuantosAsignados() != 1 {
		t.Errorf("repetir o desasignar avisaron: %d avisos", espia.cuantosAsignados())
	}

	// Pasarlo a otro si suena, y al nuevo.
	asignar(t, srv, "tok-diego", id, `{"repartidor":"raul@example.com"}`)
	if espia.cuantosAsignados() != 2 || espia.asignados[1].Repartidor != mailRaul {
		t.Errorf("reasignar: %+v", espia.asignados)
	}
}

func TestLaEdicionYLaBajaLlevanAlRepartidor(t *testing.T) {
	srv, _, espia := escenarioConRepartidores(t)
	id, _ := unPedidoCreado(t, srv, "tok-ana", "a1")
	asignar(t, srv, "tok-diego", id, `{"repartidor":"rita@example.com"}`)

	if estado, cuerpo := pedir(t, srv, "PATCH", "/pedidos/"+id, "tok-ana", "", cuerpoValido()); estado != http.StatusOK {
		t.Fatalf("editando: %d — %s", estado, cuerpo)
	}
	if espia.cuantosEditados() != 1 || espia.editados[0].Repartidor != mailRita {
		t.Errorf("la edicion aviso %+v, queria con Rita", espia.editados)
	}

	if estado, cuerpo := pedir(t, srv, "DELETE", "/pedidos/"+id, "tok-ana", "", ""); estado != http.StatusNoContent {
		t.Fatalf("dando de baja: %d — %s", estado, cuerpo)
	}
	if espia.cuantasBajas() != 1 || espia.dadosDeBaja[0].Repartidor != mailRita {
		t.Errorf("la baja aviso %+v, queria con Rita", espia.dadosDeBaja)
	}
}
