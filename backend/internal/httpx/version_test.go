package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
)

func TestVersionValida(t *testing.T) {
	casos := []struct {
		nombre  string
		crudo   string
		quiero  string
	}{
		// Las cuatro formas que la app puede producir. Que las cuatro pasen es
		// lo que hace cierto FR-006: un binario de trabajo llega identificado
		// como tal, y no como "no declarada".
		{"el tag exacto", "0.2.0", "0.2.0"},
		{"con tag y HEAD adelante", "0.2.0+3-gc3eb8fe", "0.2.0+3-gc3eb8fe"},
		{"sin tag alcanzable", "0.0.0-c3eb8fe", "0.0.0-c3eb8fe"},
		{"sin git", "0.0.0-desconocido", "0.0.0-desconocido"},

		{"ausente", "", ""},
		{"solo espacios", "   ", ""},
		{"con espacios alrededor", "  0.2.0  ", "0.2.0"},

		// Lo que no tiene forma de version se descarta. Vacio significa "no
		// declarada", que aguas abajo deja intacto lo que ya habia.
		{"texto cualquiera", "la ultima", ""},
		{"a medio formar", "0.2", ""},
		{"con letras adentro", "0.2.x", ""},
		{"un intento de inyeccion", "0.2.0'; DROP TABLE sesiones;--", ""},
		{"un salto de linea", "0.2.0\nX-Otra: si", ""},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if hay := httpx.VersionValida(c.crudo); hay != c.quiero {
				t.Errorf("VersionValida(%q) = %q, queria %q", c.crudo, hay, c.quiero)
			}
		})
	}
}

// TestVersionLarguisimaSeDescartaEntera comprueba que **no se recorta**.
//
// Recortar dejaria en la base un valor que parece una version y no lo es. Es la
// guarda que el quickstart pide romper a proposito (Q2): sin el tope, esta
// prueba tiene que ponerse en rojo.
func TestVersionLarguisimaSeDescartaEntera(t *testing.T) {
	larga := "0.2.0+1-g" + strings.Repeat("a", httpx.LargoMaximoVersion)

	if hay := httpx.VersionValida(larga); hay != "" {
		t.Errorf("una version de %d caracteres se acepto como %q; tenia que descartarse entera",
			len(larga), hay)
	}
}

// TestVersionMalaNoRompeLaPeticion es la propiedad que mas importa de todo esto.
//
// Este dato existe para diagnosticar. Que un defecto en el pudiera cambiar la
// respuesta —o peor, cortarla— seria invertir la relacion entre el problema y su
// instrumento: Diego sin poder trabajar por la cabecera que existe para saber
// por que no puede trabajar.
func TestVersionMalaNoRompeLaPeticion(t *testing.T) {
	crudos := []string{
		"",
		"cualquier cosa",
		strings.Repeat("x", 5000),
		"0.2.0'; DROP TABLE sesiones;--",
	}

	for _, crudo := range crudos {
		llego := false
		manejador := httpx.ConVersion(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			llego = true
			// Lo que no valida llega como "no declarada", nunca como basura.
			if v := httpx.VersionDeclarada(r.Context()); v != "" {
				t.Errorf("con la cabecera %.20q llego la version %q; queria vacio", crudo, v)
			}
			w.WriteHeader(http.StatusOK)
		}))

		peticion := httptest.NewRequest(http.MethodGet, "/pedidos", nil)
		peticion.Header.Set(httpx.CabeceraVersion, crudo)
		grabadora := httptest.NewRecorder()

		manejador.ServeHTTP(grabadora, peticion)

		if !llego {
			t.Fatalf("con la cabecera %.20q la peticion no llego al handler", crudo)
		}
		if grabadora.Code != http.StatusOK {
			t.Errorf("con la cabecera %.20q el codigo fue %d, queria 200", crudo, grabadora.Code)
		}
	}
}

// TestVersionBuenaLlegaAlContexto es el control positivo de la prueba de arriba.
//
// Sin esto, TestVersionMalaNoRompeLaPeticion pasaria igual con un middleware
// que no hiciera absolutamente nada.
func TestVersionBuenaLlegaAlContexto(t *testing.T) {
	var visto string
	manejador := httpx.ConVersion(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		visto = httpx.VersionDeclarada(r.Context())
	}))

	peticion := httptest.NewRequest(http.MethodGet, "/pedidos", nil)
	peticion.Header.Set(httpx.CabeceraVersion, "0.2.0")
	manejador.ServeHTTP(httptest.NewRecorder(), peticion)

	if visto != "0.2.0" {
		t.Errorf("al handler le llego %q, queria 0.2.0", visto)
	}
}

// TestSinCabeceraNoHayVersion cubre al sitio web, que nunca la manda.
func TestSinCabeceraNoHayVersion(t *testing.T) {
	var visto = "algo"
	manejador := httpx.ConVersion(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		visto = httpx.VersionDeclarada(r.Context())
	}))

	manejador.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/pedidos", nil))

	if visto != "" {
		t.Errorf("sin cabecera llego %q, queria vacio", visto)
	}
}
