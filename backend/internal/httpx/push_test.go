package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
)

// unTokenDeProveedor tiene la forma real de lo que manda el proveedor de
// avisos: una parte corta, dos puntos, y una larga de base64 con guiones y
// guiones bajos. Ronda los 160 caracteres, como los de verdad.
const unTokenDeProveedor = "cXyZ01_ab-Q:APA91bH" +
	"kR2t7QmVzZXJ0LWRlLXBydWViYS1xdWUtbm8tZXMtdW4tdG9rZW4tcmVhbA" +
	"_wdE3xN0pQr-sTuVwXyZ0123456789abcdefghijklmnop"

func TestPushTokenValido(t *testing.T) {
	casos := []struct {
		nombre string
		crudo  string
		quiero string
	}{
		{"un token del proveedor", unTokenDeProveedor, unTokenDeProveedor},
		{"con espacios alrededor", "  " + unTokenDeProveedor + "  ", unTokenDeProveedor},

		// **Ausente y vacia son validas**, y significan lo mismo: "no tengo nada
		// nuevo que declarar". Es el caso del sitio web en cada peticion, y el de
		// una app a la que le negaron el permiso de avisos.
		{"ausente", "", ""},
		{"solo espacios", "   ", ""},

		// Lo que no puede ser una direccion de entrega se descarta. Vacio
		// significa aguas abajo "no declarado", que deja intacto lo que ya habia.
		{"con un espacio adentro", "token con espacios", ""},
		{"con un salto de linea", "token\nX-Otra: si", ""},
		{"con un tab", "token\tmas", ""},
		{"con un caracter de control", "token\x00nulo", ""},
		{"fuera de ASCII", "token-con-acento-\u00f1", ""},
		{"un intento de inyeccion", "token'; DROP TABLE sesiones;--", ""},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			if hay := httpx.PushTokenValido(c.crudo); hay != c.quiero {
				t.Errorf("PushTokenValido(%q) = %q, queria %q", c.crudo, hay, c.quiero)
			}
		})
	}
}

// TestUnPushTokenLarguisimoSeDescartaEntero comprueba que **no se recorta**.
//
// Medio token no es una direccion mas corta: es una direccion equivocada que
// ademas parece un dato. Recortarlo dejaria en la base algo que se lee como un
// destinatario valido y al que el proveedor no va a entregar nada nunca.
func TestUnPushTokenLarguisimoSeDescartaEntero(t *testing.T) {
	largo := strings.Repeat("a", httpx.LargoMaximoPushToken+1)

	if hay := httpx.PushTokenValido(largo); hay != "" {
		t.Errorf("un token de %d caracteres se acepto como %q; tenia que descartarse entero",
			len(largo), hay)
	}

	// Y el borde de arriba si pasa: el tope es un tope, no un margen difuso.
	justo := strings.Repeat("a", httpx.LargoMaximoPushToken)
	if hay := httpx.PushTokenValido(justo); hay != justo {
		t.Errorf("un token de exactamente %d caracteres se descarto", httpx.LargoMaximoPushToken)
	}
}

// TestConPushTokenNuncaFallaLaPeticion es la regla del contrato que mas importa
// de este archivo, y la unica que no se puede leer del validador.
//
// Un token mal formado **no** devuelve 400 y **no** corta la cadena. La razon
// no es de estilo: este dato existe para que Diego se entere de un pedido, y
// que un defecto en el pudiera dejarlo sin poder trabajar seria invertir por
// completo la relacion entre el problema y su instrumento.
func TestConPushTokenNuncaFallaLaPeticion(t *testing.T) {
	cabeceras := []string{
		unTokenDeProveedor,
		"",
		"token con espacios",
		strings.Repeat("x", httpx.LargoMaximoPushToken+1),
		"token'; DROP TABLE sesiones;--",
	}

	for _, cabecera := range cabeceras {
		llegue := false
		siguiente := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			llegue = true
			w.WriteHeader(http.StatusOK)
		})

		peticion := httptest.NewRequest(http.MethodGet, "/admin/pedidos", nil)
		if cabecera != "" {
			peticion.Header.Set(httpx.CabeceraPushToken, cabecera)
		}
		grabadora := httptest.NewRecorder()

		httpx.ConPushToken(siguiente).ServeHTTP(grabadora, peticion)

		if !llegue {
			t.Errorf("la cabecera %.20q corto la cadena antes del handler", cabecera)
		}
		if grabadora.Code != http.StatusOK {
			t.Errorf("la cabecera %.20q devolvio %d, tenia que devolver 200", cabecera, grabadora.Code)
		}
	}
}

// TestElTokenValidoLlegaAlContextoYElInvalidoNo cierra el circuito: lo que el
// middleware deja en el contexto es exactamente lo que el validador aprobo.
//
// Sin esta prueba, ConPushToken podria estar dejando pasar la cabecera cruda
// —sin validar— y las dos pruebas de arriba seguirian en verde.
func TestElTokenValidoLlegaAlContextoYElInvalidoNo(t *testing.T) {
	casos := []struct {
		nombre   string
		cabecera string
		quiero   string
	}{
		{"valido", unTokenDeProveedor, unTokenDeProveedor},
		{"invalido", "token con espacios", ""},
		{"sin cabecera", "", ""},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			var visto string
			siguiente := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				visto = httpx.PushTokenDeclarado(r.Context())
			})

			peticion := httptest.NewRequest(http.MethodGet, "/admin/pedidos", nil)
			if c.cabecera != "" {
				peticion.Header.Set(httpx.CabeceraPushToken, c.cabecera)
			}

			httpx.ConPushToken(siguiente).ServeHTTP(httptest.NewRecorder(), peticion)

			if visto != c.quiero {
				t.Errorf("al handler le llego %q, queria %q", visto, c.quiero)
			}
		})
	}
}
