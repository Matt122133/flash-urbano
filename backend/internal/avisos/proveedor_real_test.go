package avisos

// La unica prueba de este repo que habla con el proveedor DE VERDAD.
//
// Se saltea sola sin `FCM_CREDENCIAL_BASE64`, igual que las de Postgres se
// saltean sin `TEST_DATABASE_URL`, y por el mismo motivo: no puede exigirle un
// secreto a quien clone el repo. **Y como aquellas, un `go test ./...` en verde
// sin esa variable no dice absolutamente nada de lo que se prueba aca.**

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

// TestLaCredencialDeVerdadAutorizaContraElProveedor comprueba, de una sola vez,
// las cuatro cosas que **ninguna otra prueba puede tocar** y que son la
// diferencia entre "el codigo esta bien" y "los avisos salen":
//
//  1. que la credencial decodifique de base64 y se lea como service account;
//  2. que Google **emita un token de acceso** con ella — o sea que la cuenta
//     exista, no este deshabilitada y tenga el permiso de mandar avisos;
//  3. que el identificador de proyecto que sale de la credencial sea un
//     proyecto de Firebase con Messaging habilitado;
//  4. que el JSON que arma este paquete sea el que la API HTTP v1 espera.
//
// ## Por que se manda a un token invalido a proposito
//
// Porque un token muerto es la **unica** respuesta que separa las cuatro cosas
// de arriba de todo lo demas. Si el proveedor contesta "ese destinatario no
// existe", ya autentico, ya acepto el proyecto y ya leyo el mensaje: lo unico
// malo era el destinatario, que es justo lo que pusimos mal.
//
// Cualquier otra respuesta apunta a un problema distinto y por eso el error se
// imprime entero:
//
//   - `401`/`UNAUTHENTICATED` — la credencial no sirve o esta revocada.
//   - `403`/`PERMISSION_DENIED` sin `SENDER_ID_MISMATCH` — a la cuenta de
//     servicio le falta el permiso, o la API de Messaging no esta habilitada.
//   - `404` sobre el **proyecto** — el proyecto de la credencial no es el de
//     Firebase.
//
// **No manda un aviso a ningun telefono**, asi que se puede correr cuantas
// veces haga falta sin hacerle sonar nada a nadie.
func TestLaCredencialDeVerdadAutorizaContraElProveedor(t *testing.T) {
	credencial := os.Getenv("FCM_CREDENCIAL_BASE64")
	if credencial == "" {
		t.Skip("sin FCM_CREDENCIAL_BASE64: se salta la prueba contra el proveedor")
	}

	ctx, cancelar := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancelar)

	cliente, err := NuevoClienteFCM(ctx, credencial)
	if err != nil {
		t.Fatalf("la credencial no se pudo leer: %v", err)
	}
	t.Logf("proyecto de la credencial: %s", cliente.proyecto)

	// Tiene forma de token del proveedor y no lo es. Ese es el punto.
	const inventado = "noEsUnTokenReal:APA91b" +
		"EstaCadenaTieneLaFormaDeUnTokenDeFCMPeroNoCorrespondeANingunTelefono" +
		"_0123456789abcdefghijklmnopqrstuvwxyz"

	err = cliente.Mandar(ctx, inventado, Mensaje{
		Titulo: "Pedido nuevo FU-0000",
		Cuerpo: "Entrega en Av. Brasil",
		Codigo: "FU-0000",
	})

	switch {
	case err == nil:
		t.Fatal("el proveedor acepto un token inventado; algo no esta comprobando el destinatario")

	case errors.Is(err, ErrTokenMuerto):
		// **No alcanza con que sea "token muerto".** `esTokenMuerto` trata
		// cualquier 404 como destinatario inexistente, y un 404 tambien es lo
		// que devolveria un proyecto que no existe — con lo cual una credencial
		// apuntando a la nada haria pasar esta prueba.
		//
		// Lo que separa los dos casos es el codigo que manda el proveedor:
		// `UNREGISTERED` habla del destinatario, y para haberlo evaluado tuvo
		// que aceptar antes la credencial, el proyecto y el mensaje.
		if !strings.Contains(err.Error(), "UNREGISTERED") {
			t.Fatalf("el proveedor devolvio un fallo de destinatario que no dice "+
				"UNREGISTERED, asi que puede ser el PROYECTO y no el token: %v", err)
		}

	default:
		t.Fatalf("el proveedor contesto algo que NO es un token muerto, asi que el "+
			"problema no es el destinatario: %v", err)
	}
}

// TestElProyectoDeLaCredencialEsElDeLaApp ata las dos mitades del feature.
//
// **Es el error que compila, pasa todas las pruebas y no entrega un solo
// aviso**: si la credencial del servicio pertenece a un proyecto de Firebase y
// el `google-services.json` de la app a otro, el servicio manda mensajes
// perfectos a un proyecto donde el token de Diego no existe. El sintoma es
// silencio, y el registro dice `UNREGISTERED`, que manda a mirar el telefono —
// el lugar equivocado.
//
// El numero de proyecto del lado de la app esta en `mobilesdk_app_id`, con la
// forma `1:<numero>:android:<hash>`; del lado del servicio sale de la
// credencial como `project_id`. **No son el mismo string**, asi que lo que se
// compara es el que si es comparable: el `project_id` del `google-services.json`.
func TestElProyectoDeLaCredencialEsElDeLaApp(t *testing.T) {
	credencial := os.Getenv("FCM_CREDENCIAL_BASE64")
	if credencial == "" {
		t.Skip("sin FCM_CREDENCIAL_BASE64: se salta la prueba contra el proveedor")
	}

	cliente, err := NuevoClienteFCM(context.Background(), credencial)
	if err != nil {
		t.Fatalf("la credencial no se pudo leer: %v", err)
	}

	// El archivo de la app vive fuera del modulo de Go, y esta ruta relativa es
	// la unica atadura entre las dos superficies. Si alguien lo mueve, esta
	// prueba se saltea con un mensaje que dice cual es el archivo.
	const rutaDeLaApp = "../../../android/app/google-services.json"
	crudo, err := os.ReadFile(rutaDeLaApp)
	if err != nil {
		t.Skipf("no se encontro %s: %v", rutaDeLaApp, err)
	}

	// Se busca el campo a mano en vez de modelar el archivo entero: lo unico que
	// interesa es un string, y una estructura completa habria que mantenerla
	// cada vez que Firebase agregue una clave.
	const marca = `"project_id":`
	i := strings.Index(string(crudo), marca)
	if i < 0 {
		t.Fatalf("%s no declara project_id", rutaDeLaApp)
	}
	resto := string(crudo)[i+len(marca):]
	desde := strings.Index(resto, `"`)
	hasta := strings.Index(resto[desde+1:], `"`)
	deLaApp := resto[desde+1 : desde+1+hasta]

	if deLaApp != cliente.proyecto {
		t.Fatalf("la app apunta al proyecto %q y la credencial del servicio al %q; "+
			"los avisos se mandarian a un proyecto donde el telefono de Diego no existe",
			deLaApp, cliente.proyecto)
	}
}
