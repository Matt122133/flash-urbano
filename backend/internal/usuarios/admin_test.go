package usuarios

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// muestra imprime un *bool de forma legible.
//
// Sin esto, un fallo dice `0x26808d24390` en vez de `false` o `ausente`, que es
// exactamente el momento en que el mensaje tiene que servir. Se descubrio al
// romper la implementacion a proposito para comprobar que las pruebas detectan.
func muestra(b *bool) string {
	if b == nil {
		return "ausente"
	}
	if *b {
		return "true"
	}
	return "false"
}

// laConfigurada arma el predicado que en produccion sale de ADMIN_EMAILS.
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

// TestLaDireccionConfiguradaEsAdministradora, con su contrario en la misma
// prueba: sin el "cualquier otra no", un predicado que devolviera true a todo
// pasaria la primera mitad con nota perfecta.
func TestLaDireccionConfiguradaEsAdministradora(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	diego, err := repo.BuscarOCrear(ctx, "diego@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	cliente, err := repo.BuscarOCrear(ctx, "cliente@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	h := NuevosHandlers(repo, laConfigurada("diego@example.com"))
	srv := monta(t, h, map[string]*Usuario{"admin": diego, "comun": cliente})

	_, vistaAdmin := pedirComo(t, srv, "GET", "/yo", "admin", "")
	if vistaAdmin.EsAdmin == nil || !*vistaAdmin.EsAdmin {
		t.Fatalf("la direccion configurada no salio como administradora: %s", muestra(vistaAdmin.EsAdmin))
	}

	_, vistaComun := pedirComo(t, srv, "GET", "/yo", "comun", "")
	if vistaComun.EsAdmin == nil || *vistaComun.EsAdmin {
		t.Fatalf("una direccion cualquiera salio como administradora: %s", muestra(vistaComun.EsAdmin))
	}
}

// TestCambiarLaConfiguracionCambiaElResultadoSinTocarLaBase es el corazon de
// FR-022: **la respuesta sale de la configuracion, no de un dato guardado**.
//
// La misma fila de la base, sin ninguna escritura en el medio, contesta distinto
// segun con que predicado se monte el handler. Si esto fallara, significaria que
// la condicion de administrador se esta leyendo de algun lado que persiste — y
// entonces existiria un lugar donde escribirla.
func TestCambiarLaConfiguracionCambiaElResultadoSinTocarLaBase(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	u, err := repo.BuscarOCrear(ctx, "cambia@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}

	// Primero, con la direccion fuera de la lista.
	srvSin := monta(t, NuevosHandlers(repo, laConfigurada("otro@example.com")), map[string]*Usuario{"t": u})
	_, antes := pedirComo(t, srvSin, "GET", "/yo", "t", "")
	if antes.EsAdmin == nil || *antes.EsAdmin {
		t.Fatalf("antes de configurarla ya era administradora: %s", muestra(antes.EsAdmin))
	}

	// Ahora dentro. **Ni una escritura en la base entre las dos lecturas.**
	srvCon := monta(t, NuevosHandlers(repo, laConfigurada("cambia@example.com")), map[string]*Usuario{"t": u})
	_, despues := pedirComo(t, srvCon, "GET", "/yo", "t", "")
	if despues.EsAdmin == nil || !*despues.EsAdmin {
		t.Fatalf("cambiar la configuracion no cambio el resultado: %s", muestra(despues.EsAdmin))
	}
}

// TestNoHayCaminoDesdeElApiParaVolverseAdministrador es la mitad de FR-022 que
// dice **MUST NOT**.
//
// Se intenta por las dos vias que existen: mandando el campo en el cuerpo del
// PUT, y mandandolo adentro de la direccion de retiro. Las dos tienen que
// rebotar o ignorarse, y la respuesta tiene que seguir diciendo que no.
func TestNoHayCaminoDesdeElApiParaVolverseAdministrador(t *testing.T) {
	repo, _ := repositorioDePrueba(t)
	ctx := context.Background()

	u, err := repo.BuscarOCrear(ctx, "aspirante@example.com")
	if err != nil {
		t.Fatalf("creando: %v", err)
	}
	// Nadie es administrador en esta configuracion.
	srv := monta(t, NuevosHandlers(repo, laConfigurada()), map[string]*Usuario{"t": u})

	intentos := []string{
		`{"nombre":"Ana","telefono":"099111222","esAdmin":true}`,
		`{"nombre":"Ana","telefono":"099111222","admin":true}`,
		`{"nombre":"Ana","telefono":"099111222","es_admin":true}`,
	}

	for _, cuerpo := range intentos {
		estado, vista := pedirComo(t, srv, "PUT", "/yo", "t", cuerpo)

		// `httpx.LeerJSON` rechaza campos desconocidos, asi que lo esperable es
		// un 400. Lo que NO se acepta es un 200 con esAdmin en true.
		if estado == http.StatusOK && vista.EsAdmin != nil && *vista.EsAdmin {
			t.Fatalf("se pudo volver administrador con el cuerpo %s", cuerpo)
		}
	}

	// Y despues de todos los intentos, sigue sin serlo.
	_, final := pedirComo(t, srv, "GET", "/yo", "t", "")
	if final.EsAdmin == nil || *final.EsAdmin {
		t.Fatalf("quedo como administrador despues de intentarlo: %s", muestra(final.EsAdmin))
	}

	// La comprobacion de fondo: **la base no tiene donde guardarlo**. Si esta
	// consulta encontrara una columna, existiria un lugar donde escribirla y
	// todo lo de arriba seria una defensa de superficie.
	var columnas int
	err = repo.pool.QueryRow(ctx, `
		SELECT count(*) FROM information_schema.columns
		WHERE table_name = 'usuarios' AND column_name ILIKE '%admin%'`).Scan(&columnas)
	if err != nil {
		t.Fatalf("consultando el esquema: %v", err)
	}
	if columnas != 0 {
		t.Fatalf("la tabla usuarios tiene %d columna(s) de administrador: FR-022 dice que no debe existir", columnas)
	}
}

// TestElIngresoNoContestaSiEsAdministrador documenta —y fija— la decision de que
// `auth` no conoce la configuracion.
//
// `VistaDe` es la que usa el camino de ingreso, y **tiene que dejar el campo
// ausente**. Si algun dia devolviera `false`, el sitio leeria un dato presente y
// equivocado para un administrador que acaba de entrar, que es peor que no
// tener el dato.
func TestElIngresoNoContestaSiEsAdministrador(t *testing.T) {
	v := VistaDe(&Usuario{ID: "x", Email: "diego@example.com"})
	if v.EsAdmin != nil {
		t.Fatalf("VistaDe contesto si es administrador (%v), y no puede: no conoce la configuracion", *v.EsAdmin)
	}

	crudo, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("serializando: %v", err)
	}
	if strings.Contains(string(crudo), "esAdmin") {
		t.Fatalf("el campo viaja en la respuesta del ingreso: %s", crudo)
	}
}
