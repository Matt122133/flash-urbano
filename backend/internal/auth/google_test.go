package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"

	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
)

// Estas pruebas verifican la firma **de verdad**: firman tokens con una clave
// RSA propia y sirven su JWKS desde un servidor local, que es para lo que
// existe el constructor con la URL de claves parametrizada.
//
// La alternativa —un doble que devuelva reclamos ya decodificados— habria
// probado los `if` de google.go y nada mas. No habria notado que la firma no se
// mira, que es justamente el modo de falla que convierte este endpoint en "el
// que diga el navegador".

const (
	clienteDeEsteSitio = "123456789-flashurbano.apps.googleusercontent.com"
	kidDePrueba        = "clave-de-prueba"
)

// claveDePrueba se genera una sola vez: generar RSA de 2048 bits por cada caso
// domina el tiempo de todo el paquete sin probar nada extra.
var (
	claveBuena  = generarClave()
	claveAjena  = generarClave()
	reclamosOK  = map[string]any{"email": "Diego@Ejemplo.Com", "email_verified": true, "name": "Diego"}
	horaDeAhora = time.Now
)

func generarClave() *rsa.PrivateKey {
	clave, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	return clave
}

// servidorDeClaves publica el JWKS de la clave buena, como hace Google.
func servidorDeClaves(t *testing.T) string {
	t.Helper()

	jwks := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key:       claveBuena.Public(),
		KeyID:     kidDePrueba,
		Algorithm: string(jose.RS256),
		Use:       "sig",
	}}}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(jwks); err != nil {
			t.Errorf("no se pudo servir el JWKS: %v", err)
		}
	}))
	t.Cleanup(srv.Close)

	return srv.URL
}

// firmar arma un token de identidad como el que entrega Google.
//
// La clave con la que firma es un parametro porque uno de los casos es
// justamente que la firma NO sea de Google. Y el `kid` es el mismo para las dos
// claves a proposito: asi el verificador encuentra una clave con esa etiqueta y
// falla al comprobar la firma, en vez de fallar antes por no encontrar ninguna.
// El caso que interesa es el segundo, no el primero.
func firmar(t *testing.T, clave *rsa.PrivateKey, reclamos map[string]any) string {
	t.Helper()

	firmante, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: clave, KeyID: kidDePrueba}},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		t.Fatalf("no se pudo armar el firmante: %v", err)
	}

	cuerpo, err := json.Marshal(reclamos)
	if err != nil {
		t.Fatalf("no se pudieron serializar los reclamos: %v", err)
	}

	objeto, err := firmante.Sign(cuerpo)
	if err != nil {
		t.Fatalf("no se pudo firmar: %v", err)
	}

	crudo, err := objeto.CompactSerialize()
	if err != nil {
		t.Fatalf("no se pudo serializar el token: %v", err)
	}
	return crudo
}

// reclamosCon parte de un token valido y le cambia lo que el caso necesite.
//
// Se arma asi y no caso por caso para que cada prueba muestre **una sola**
// diferencia contra el token que si sirve. Si un caso falla, lo que lo hace
// fallar esta en su propia linea.
func reclamosCon(cambios map[string]any) map[string]any {
	ahora := horaDeAhora()
	base := map[string]any{
		"iss":            "https://accounts.google.com",
		"aud":            clienteDeEsteSitio,
		"sub":            "1029384756",
		"iat":            ahora.Add(-time.Minute).Unix(),
		"exp":            ahora.Add(time.Hour).Unix(),
		"email":          reclamosOK["email"],
		"email_verified": reclamosOK["email_verified"],
		"name":           reclamosOK["name"],
	}
	for clave, valor := range cambios {
		if valor == nil {
			delete(base, clave)
			continue
		}
		base[clave] = valor
	}
	return base
}

func verificadorDePrueba(t *testing.T) *VerificadorGoogle {
	t.Helper()
	return nuevoVerificadorGoogle(context.Background(), clienteDeEsteSitio, servidorDeClaves(t))
}

// TestGoogleAceptaUnTokenLegitimo es el control positivo de todo el archivo.
//
// Sin el, un verificador que rechazara absolutamente todo pasaria las seis
// pruebas de rechazo de abajo con nota perfecta. Esta es la que dice que las
// otras significan algo.
func TestGoogleAceptaUnTokenLegitimo(t *testing.T) {
	v := verificadorDePrueba(t)

	identidad, err := v.Verificar(context.Background(), firmar(t, claveBuena, reclamosCon(nil)))
	if err != nil {
		t.Fatalf("un token legitimo tiene que pasar, y dio: %v", err)
	}

	// La direccion sale normalizada: es la clave con la que se busca y se crea
	// el usuario, y dos formas distintas de la misma direccion serian dos
	// usuarios (FR-007a).
	if identidad.Email != "diego@ejemplo.com" {
		t.Errorf("email = %q, se esperaba normalizado a minusculas", identidad.Email)
	}
	if identidad.Nombre != "Diego" {
		t.Errorf("nombre = %q, se esperaba el de Google para precargar el alta", identidad.Nombre)
	}
	if r := ResultadoDeGoogle(nil); r != rastro.Exito {
		t.Errorf("resultado de rastro = %q, se esperaba %q", r, rastro.Exito)
	}
}

// TestGoogleAceptaLosDosEmisores cubre la trampa del campo `iss`.
//
// Google documenta las dos formas como validas. La de abajo es la que casi
// nunca llega, y por eso es la que se rompe en produccion y no en desarrollo.
func TestGoogleAceptaLosDosEmisores(t *testing.T) {
	v := verificadorDePrueba(t)

	for _, emisor := range []string{"https://accounts.google.com", "accounts.google.com"} {
		token := firmar(t, claveBuena, reclamosCon(map[string]any{"iss": emisor}))
		if _, err := v.Verificar(context.Background(), token); err != nil {
			t.Errorf("iss %q es valido para Google y fue rechazado: %v", emisor, err)
		}
	}
}

// TestGoogleRechaza junta los casos en que el token no prueba lo que dice.
//
// Cada uno nombra el resultado de rastro que le corresponde, porque el
// requisito no es solo rechazar: es que despues se pueda reconstruir por que
// (FR-022a, FR-022d).
func TestGoogleRechaza(t *testing.T) {
	v := verificadorDePrueba(t)

	casos := []struct {
		nombre     string
		clave      *rsa.PrivateKey
		cambios    map[string]any
		esperado   error
		enRastro   rastro.Resultado
		porQuePasa string
	}{
		{
			nombre:   "direccion que Google no da por verificada",
			clave:    claveBuena,
			cambios:  map[string]any{"email_verified": false},
			esperado: ErrEmailNoVerificado,
			enRastro: rastro.EmailNoVerificado,
			porQuePasa: "sin esto, quien cree una cuenta de Google sobre una direccion " +
				"ajena entra como el dueno de esa direccion (FR-007)",
		},
		{
			nombre:     "destinatario de otro sitio",
			clave:      claveBuena,
			cambios:    map[string]any{"aud": "otro-cliente.apps.googleusercontent.com"},
			esperado:   ErrGoogleRechazado,
			enRastro:   rastro.GoogleRechazado,
			porQuePasa: "un token legitimo de Google emitido para OTRA aplicacion no autoriza nada aca",
		},
		{
			nombre:     "firmado con una clave que no es de Google",
			clave:      claveAjena,
			cambios:    nil,
			esperado:   ErrGoogleRechazado,
			enRastro:   rastro.GoogleRechazado,
			porQuePasa: "es el caso que distingue verificar la firma de creerle al navegador",
		},
		{
			nombre:     "vencido",
			clave:      claveBuena,
			cambios:    map[string]any{"exp": horaDeAhora().Add(-time.Minute).Unix()},
			esperado:   ErrGoogleRechazado,
			enRastro:   rastro.GoogleRechazado,
			porQuePasa: "un token viejo copiado de algun lado sigue estando bien firmado",
		},
		{
			nombre:     "emisor ajeno",
			clave:      claveBuena,
			cambios:    map[string]any{"iss": "https://accounts.example.com"},
			esperado:   ErrGoogleRechazado,
			enRastro:   rastro.GoogleRechazado,
			porQuePasa: "el emisor se comprueba a mano por SkipIssuerCheck: si nadie lo mira, no lo mira nadie",
		},
		{
			nombre:     "sin direccion de mail",
			clave:      claveBuena,
			cambios:    map[string]any{"email": nil, "email_verified": nil},
			esperado:   ErrGoogleRechazado,
			enRastro:   rastro.GoogleRechazado,
			porQuePasa: "la direccion ES la identidad en este sistema; sin ella no hay a quien identificar",
		},
	}

	for _, caso := range casos {
		t.Run(caso.nombre, func(t *testing.T) {
			_, err := v.Verificar(context.Background(), firmar(t, caso.clave, reclamosCon(caso.cambios)))

			if !errors.Is(err, caso.esperado) {
				t.Fatalf("err = %v, se esperaba %v — %s", err, caso.esperado, caso.porQuePasa)
			}
			if r := ResultadoDeGoogle(err); r != caso.enRastro {
				t.Errorf("resultado de rastro = %q, se esperaba %q", r, caso.enRastro)
			}
		})
	}
}

// TestGoogleRechazaUnTokenVacio cubre el cuerpo vacio o con espacios, que no
// llega a ser un token y no tiene por que gastar una consulta al JWKS.
func TestGoogleRechazaUnTokenVacio(t *testing.T) {
	v := verificadorDePrueba(t)

	for _, crudo := range []string{"", "   "} {
		if _, err := v.Verificar(context.Background(), crudo); !errors.Is(err, ErrGoogleRechazado) {
			t.Errorf("token %q: err = %v, se esperaba ErrGoogleRechazado", crudo, err)
		}
	}
}

// TestResultadoDeGoogleNoInventaExito es la guarda contra el error mas caro que
// puede tener la traduccion al rastro: que un error desconocido —uno que agregue
// alguien mas adelante— caiga en `exito` y deje un ingreso fallido anotado como
// bueno. El `default` tiene que ser rechazo.
func TestResultadoDeGoogleNoInventaExito(t *testing.T) {
	if r := ResultadoDeGoogle(errors.New("algo que todavia no existe")); r != rastro.GoogleRechazado {
		t.Errorf("resultado = %q, un error desconocido tiene que caer en %q", r, rastro.GoogleRechazado)
	}
}
