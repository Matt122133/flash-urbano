package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"

	"github.com/Matt122133/flash-urbano/backend/internal/rastro"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// jwksDeGoogle es donde Google publica las claves publicas con las que firma.
//
// Las rota sin avisar, asi que no se pueden fijar en el codigo ni en una
// variable de entorno: hay que ir a buscarlas. Eso es lo que hace el keySet
// remoto de abajo, que ademas las cachea y las vuelve a pedir cuando aparece un
// `kid` que no conoce.
const jwksDeGoogle = "https://www.googleapis.com/oauth2/v3/certs"

// emisoresDeGoogle son las dos formas del campo `iss` que Google considera
// validas para un token de identidad, segun su propia documentacion.
//
// Es una trampa real y no una precaucion teorica: casi todos los tokens traen
// la forma con esquema, pero la otra tambien es legitima. Aceptar una sola deja
// un rechazo intermitente e inexplicable, del tipo que aparece en produccion y
// no en las pruebas.
var emisoresDeGoogle = []string{"https://accounts.google.com", "accounts.google.com"}

// ErrGoogleRechazado es todo lo que hace que un token no pruebe nada: firma que
// no verifica, destinatario ajeno, emisor ajeno, vencido, mal formado o sin
// direccion de mail.
//
// **Una sola causa hacia afuera**, por el mismo motivo que ErrSesionInvalida:
// el detalle de por que un token no sirve no le sirve a quien lo presenta, y le
// serviria a quien esta probando. La distincion existe en el log y en el rastro.
var ErrGoogleRechazado = errors.New("el token de Google no es valido")

// ErrEmailNoVerificado es el token que verifica bien pero cuya direccion Google
// no da por verificada (FR-007).
//
// Se separa de ErrGoogleRechazado porque **no es lo mismo**, y confundirlos es
// el agujero: sin este chequeo, cualquiera que consiga crear una cuenta de
// Google sobre una direccion ajena entra como el dueno de esa direccion. Hacia
// afuera se responde igual; lo que cambia es que en el rastro queda con su
// propio resultado, y por eso se puede ver si esta pasando.
var ErrEmailNoVerificado = errors.New("Google no da esa direccion por verificada")

// IdentidadGoogle es lo unico que el token prueba y lo unico que se toma de el.
//
// El nombre viene para precargar el alta (FR-021) y es editable del lado del
// sitio: es lo que Google dice que se llama, no una afirmacion que este
// servicio necesite creer. Nada mas de las decenas de reclamos que un token de
// Google puede traer se lee, y es deliberado — lo que no se lee no se guarda.
type IdentidadGoogle struct {
	Email  string
	Nombre string
}

// reclamosDeGoogle son los campos del token que se leen.
//
// `email_verified` es bool y no string a proposito: si algun dia llegara como
// texto, el decodificado falla y el token se rechaza. Fallar cerrado es la
// unica lectura aceptable de un campo del que depende la identidad.
type reclamosDeGoogle struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Nombre        string `json:"name"`
}

// VerificadorGoogle comprueba que un token de identidad lo emitio Google para
// este sitio.
//
// Se construye una sola vez al arrancar y se comparte: adentro tiene el cache
// de las claves publicas, y uno nuevo por request las pediria de nuevo cada vez.
type VerificadorGoogle struct {
	verificador *oidc.IDTokenVerifier
}

// NuevoVerificadorGoogle arma el verificador contra Google.
//
// El clientID sale de la configuracion (FR-024, mismo motivo): rotar el cliente
// OAuth o mudar el sitio a flashurbano.uy tiene que ser cambiar una variable.
func NuevoVerificadorGoogle(ctx context.Context, clientID string) *VerificadorGoogle {
	return nuevoVerificadorGoogle(ctx, clientID, jwksDeGoogle)
}

// nuevoVerificadorGoogle es la version con el origen de las claves parametrizado.
//
// Existe para que las pruebas puedan firmar tokens con una clave propia y
// servir su JWKS desde un servidor local, **verificando la firma de verdad** en
// vez de saltearla con un doble. La diferencia importa: un doble que devuelve
// reclamos ya decodificados prueba las reglas de este archivo pero no prueba
// que una firma ajena sea rechazada, que es la mitad del trabajo.
func nuevoVerificadorGoogle(ctx context.Context, clientID, jwksURL string) *VerificadorGoogle {
	claves := oidc.NewRemoteKeySet(ctx, jwksURL)

	cfg := &oidc.Config{
		ClientID: clientID,
		// El emisor se comprueba abajo, a mano, contra las DOS formas que Google
		// usa. go-oidc compara contra un unico string exacto, asi que dejarselo
		// a el significaria rechazar la forma sin esquema.
		SkipIssuerCheck: true,
	}

	// El emisor que se le pasa a NewVerifier queda sin usar por SkipIssuerCheck.
	// Se pasa igual el canonico para que, si alguien saca esa opcion mas
	// adelante, el verificador quede comprobando el valor correcto y no vacio.
	return &VerificadorGoogle{verificador: oidc.NewVerifier(emisoresDeGoogle[0], claves, cfg)}
}

// Verificar devuelve la identidad que el token prueba.
//
// El orden de los chequeos no es casual: primero firma, destinatario y
// vencimiento —que es lo que hace que los reclamos signifiquen algo— y recien
// despues se los mira. Leer `email` antes de verificar la firma seria leer lo
// que el cliente quiso escribir.
func (v *VerificadorGoogle) Verificar(ctx context.Context, tokenCrudo string) (IdentidadGoogle, error) {
	if strings.TrimSpace(tokenCrudo) == "" {
		return IdentidadGoogle{}, fmt.Errorf("%w: llego vacio", ErrGoogleRechazado)
	}

	// Verifica firma contra las claves publicas de Google, destinatario
	// (`aud` == clientID) y vencimiento. El emisor no, por SkipIssuerCheck.
	token, err := v.verificador.Verify(ctx, tokenCrudo)
	if err != nil {
		return IdentidadGoogle{}, fmt.Errorf("%w: %v", ErrGoogleRechazado, err)
	}

	if !esEmisorDeGoogle(token.Issuer) {
		return IdentidadGoogle{}, fmt.Errorf("%w: emisor %q", ErrGoogleRechazado, token.Issuer)
	}

	var reclamos reclamosDeGoogle
	if err := token.Claims(&reclamos); err != nil {
		return IdentidadGoogle{}, fmt.Errorf("%w: no se pudieron leer los reclamos: %v", ErrGoogleRechazado, err)
	}

	email := usuarios.NormalizarEmail(reclamos.Email)
	if email == "" {
		// Un token de Google sin `email` es legitimo cuando el cliente OAuth no
		// pidio ese alcance. Acá no sirve para nada: la direccion **es** la
		// identidad en este sistema (FR-007a).
		return IdentidadGoogle{}, fmt.Errorf("%w: no trae direccion de mail", ErrGoogleRechazado)
	}

	// Ultimo y aparte: llegado aca el token es autentico, y lo que falla es la
	// direccion, no el token. Por eso es otro error y otro resultado de rastro.
	if !reclamos.EmailVerified {
		return IdentidadGoogle{}, ErrEmailNoVerificado
	}

	return IdentidadGoogle{Email: email, Nombre: strings.TrimSpace(reclamos.Nombre)}, nil
}

func esEmisorDeGoogle(iss string) bool {
	for _, valido := range emisoresDeGoogle {
		if iss == valido {
			return true
		}
	}
	return false
}

// ResultadoDeGoogle traduce lo que devolvio Verificar al resultado que va al
// rastro (FR-022d).
//
// Vive aca y no en el handler para que la traduccion se pueda probar sin
// levantar un servidor ni una base. Es la unica forma de que el requisito
// —"ambos casos quedan en el rastro con su resultado propio"— tenga una prueba
// automatica en vez de depender de que alguien lea el handler y verifique el
// `switch` con la vista.
func ResultadoDeGoogle(err error) rastro.Resultado {
	switch {
	case err == nil:
		return rastro.Exito
	case errors.Is(err, ErrEmailNoVerificado):
		return rastro.EmailNoVerificado
	default:
		return rastro.GoogleRechazado
	}
}
