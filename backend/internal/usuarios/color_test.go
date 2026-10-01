package usuarios

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/colores"
	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// El color de cada cuenta, asignado al registrarse (030, FR-002 a FR-006).

func colorDe(t *testing.T, pool *db.Pool, id string) *string {
	t.Helper()
	var c *string
	if err := pool.QueryRow(context.Background(),
		`SELECT color FROM usuarios WHERE id = $1`, id).Scan(&c); err != nil {
		t.Fatalf("leyendo el color de %s: %v", id, err)
	}
	return c
}

// registrar es lo que hace una persona nueva: entra, y completa el perfil.
func registrar(t *testing.T, repo *Repositorio, email string) string {
	t.Helper()
	ctx := context.Background()
	u, err := repo.BuscarOCrear(ctx, email)
	if err != nil {
		t.Fatalf("ingreso de %s: %v", email, err)
	}
	if _, err := repo.GuardarPerfil(ctx, u.ID, "Nombre", "099000000", nil); err != nil {
		t.Fatalf("alta de %s: %v", email, err)
	}
	return u.ID
}

func TestRegistrarseDaElSiguienteColorDeLaLista(t *testing.T) {
	repo, pool := repositorioDePrueba(t)

	primera := registrar(t, repo, "primera@example.com")
	segunda := registrar(t, repo, "segunda@example.com")

	if c := colorDe(t, pool, primera); c == nil || *c != colores.Lista[0] {
		t.Fatalf("la primera cuenta tiene %v, quiero %s", c, colores.Lista[0])
	}
	if c := colorDe(t, pool, segunda); c == nil || *c != colores.Lista[1] {
		t.Fatalf("la segunda cuenta tiene %v, quiero %s", c, colores.Lista[1])
	}
}

// Solo el ingreso, sin completar el perfil, no es registrarse y no gasta color.
func TestEntrarSinCompletarElPerfilNoDaColor(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	u, err := repo.BuscarOCrear(context.Background(), "amedias@example.com")
	if err != nil {
		t.Fatalf("ingreso: %v", err)
	}
	if c := colorDe(t, pool, u.ID); c != nil {
		t.Fatalf("una cuenta que no completo el perfil tiene color %s", *c)
	}
}

// FR-005: editar el perfil no cambia el color.
func TestEditarElPerfilNoCambiaElColor(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	id := registrar(t, repo, "cliente@example.com")
	antes := colorDe(t, pool, id)

	if _, err := repo.GuardarPerfil(context.Background(), id, "Otro nombre", "098111222", nil); err != nil {
		t.Fatalf("editando el perfil: %v", err)
	}
	despues := colorDe(t, pool, id)
	if antes == nil || despues == nil || *antes != *despues {
		t.Fatalf("el color cambio al editar el perfil: %v -> %v", antes, despues)
	}
}

// FR-006: una cuenta que ya tenia el perfil completo al desplegar `030` —las
// cuentas de prueba de hoy— no recibe color por editarlo. Es el caso que la
// regla ingenua ("si no tiene color, darle uno") hacia mal.
//
// `CompletarAlta` arma justo esa fila: perfil completo, sin color, como las
// que existian antes de la migracion.
func TestUnaCuentaViejaQueEditaSuPerfilSigueSinColor(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	ctx := context.Background()
	u, err := repo.BuscarOCrear(ctx, "deprueba@example.com")
	if err != nil {
		t.Fatalf("ingreso: %v", err)
	}
	if _, err := repo.CompletarAlta(ctx, u.ID, "Cuenta de prueba", "099333444"); err != nil {
		t.Fatalf("armando la cuenta vieja: %v", err)
	}

	if _, err := repo.GuardarPerfil(ctx, u.ID, "Cuenta de prueba editada", "099333444", nil); err != nil {
		t.Fatalf("editando: %v", err)
	}
	if c := colorDe(t, pool, u.ID); c != nil {
		t.Fatalf("una cuenta vieja recibio color %s al editar su perfil", *c)
	}
}

// FR-004b: dos registros al mismo tiempo no terminan con el mismo color, y
// ninguno falla por eso.
func TestRegistrosSimultaneosDanColoresDistintos(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	ctx := context.Background()

	const cuantos = 8
	ids := make([]string, cuantos)
	for i := range cuantos {
		u, err := repo.BuscarOCrear(ctx, "simultaneo"+string(rune('a'+i))+"@example.com")
		if err != nil {
			t.Fatalf("ingreso %d: %v", i, err)
		}
		ids[i] = u.ID
	}

	// La barrera hace que los ocho guardados salgan juntos: sin ella, las
	// goroutines arrancan escalonadas y la carrera casi nunca ocurre, y la
	// prueba pasaria sin estar probando nada (ver T014).
	var largada, fin sync.WaitGroup
	largada.Add(1)
	errs := make(chan error, cuantos)
	for _, id := range ids {
		fin.Add(1)
		go func() {
			defer fin.Done()
			largada.Wait()
			if _, err := repo.GuardarPerfil(ctx, id, "Simultaneo", "099000000", nil); err != nil {
				errs <- err
			}
		}()
	}
	largada.Done()
	fin.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("un registro simultaneo fallo: %v", err)
	}

	vistos := map[string]bool{}
	for _, id := range ids {
		c := colorDe(t, pool, id)
		if c == nil {
			t.Fatalf("la cuenta %s quedo sin color", id)
		}
		if vistos[*c] {
			t.Fatalf("dos cuentas con el mismo color: %s", *c)
		}
		vistos[*c] = true
	}
}

// La base sostiene FR-004b aunque el codigo no lo haga: un color repetido
// escrito a mano choca contra el indice unico. Y el CHECK rechaza mayusculas,
// que el indice veria como otro color.
func TestLaBaseRechazaUnColorRepetidoOMalEscrito(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	ctx := context.Background()
	id := registrar(t, repo, "uno@example.com")
	otro, err := repo.BuscarOCrear(ctx, "otro@example.com")
	if err != nil {
		t.Fatalf("ingreso: %v", err)
	}

	tomado := colorDe(t, pool, id)
	if _, err := pool.Exec(ctx, `UPDATE usuarios SET color = $2 WHERE id = $1`, otro.ID, *tomado); err == nil {
		t.Fatalf("la base acepto %s repetido", *tomado)
	}
	if _, err := pool.Exec(ctx, `UPDATE usuarios SET color = '#C026D3' WHERE id = $1`, otro.ID); err == nil {
		t.Fatal("la base acepto un color en mayusculas")
	}
}

// FR-014: el color no viaja a GET /yo. Hoy lo garantiza que `Usuario` no tiene
// el campo; esta prueba es para el dia que alguien lo agregue a `columnas`.
func TestGETYoNoTraeElColor(t *testing.T) {
	repo, pool := repositorioDePrueba(t)
	id := registrar(t, repo, "yo@example.com")
	if colorDe(t, pool, id) == nil {
		t.Fatal("la cuenta no recibio color: la prueba no probaria nada")
	}
	u, err := repo.PorID(context.Background(), id)
	if err != nil {
		t.Fatalf("leyendo la cuenta: %v", err)
	}
	srv := monta(t, NuevosHandlers(repo, nil), map[string]*Usuario{"tok": u})

	req, _ := http.NewRequest("GET", srv.URL+"/yo", nil)
	req.Header.Set("Authorization", "Bearer tok")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /yo: %v", err)
	}
	defer res.Body.Close()
	cuerpo, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /yo: %d — %s", res.StatusCode, cuerpo)
	}
	if strings.Contains(string(cuerpo), colores.Lista[0]) || strings.Contains(strings.ToLower(string(cuerpo)), "color") {
		t.Fatalf("GET /yo trae el color: %s", cuerpo)
	}
}
