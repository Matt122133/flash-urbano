package httpx

import (
	"net/http"
	"strings"
)

// CORS deja pasar solo los origenes autorizados (FR-023, FR-025).
//
// La lista sale de la configuracion del entorno, nunca del codigo: mudar el
// sitio de github.io a flashurbano.uy tiene que ser agregar un valor a una
// variable, no editar un archivo y desplegar (SC-009).
//
// Es el middleware mas exterior de todos. Un pedido de un origen ajeno no llega
// a ejecutar nada: se responde el preflight sin permisos y se corta.
func CORS(origenesPermitidos []string, siguiente http.Handler) http.Handler {
	permitidos := make(map[string]bool, len(origenesPermitidos))
	for _, o := range origenesPermitidos {
		permitidos[strings.TrimSpace(o)] = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origen := r.Header.Get("Origin")

		// Vary es obligatorio en cuanto la respuesta depende del Origin: sin
		// el, un cache intermedio puede servirle a un origen la respuesta que
		// se calculo para otro, y los permisos dejan de significar nada.
		w.Header().Add("Vary", "Origin")

		if origen != "" && permitidos[origen] {
			w.Header().Set("Access-Control-Allow-Origin", origen)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")

			// Authorization es el header por el que viaja la credencial
			// (FR-016). Sin permitirlo explicitamente, el navegador bloquea
			// toda request autenticada cruzando origenes.
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "600")

			// NO se manda Access-Control-Allow-Credentials, y es deliberado:
			// ese header es para cookies, y este servicio no usa cookies. Es
			// justamente la decision del ADR que esquiva el bloqueo de cookies
			// entre origenes en Safari.
		}

		// El preflight se contesta aca y no sigue. Si el origen no estaba
		// permitido, la respuesta va sin los encabezados de arriba y el
		// navegador corta el pedido real por su cuenta.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Un origen presente pero no autorizado se rechaza tambien del lado del
		// servidor (FR-025). Confiar solo en que el navegador respete la falta
		// de encabezados deja pasar cualquier cliente que no sea un navegador.
		if origen != "" && !permitidos[origen] {
			Error(w, http.StatusForbidden, "origen no autorizado")
			return
		}

		// Un pedido SIN Origin no es un pedido cruzado: es curl, un chequeo de
		// salud de Railway, o el propio navegador pidiendo en el mismo origen.
		// No hay nada que autorizar.
		siguiente.ServeHTTP(w, r)
	})
}

// OrigenDeLaConexion devuelve la direccion desde la que llego el pedido.
//
// Sale de X-Forwarded-For y NO de RemoteAddr: Railway pone un proxy adelante
// del servicio, asi que RemoteAddr es la direccion del proxy y es la misma para
// todo el mundo. Contar limites de frecuencia por ahi convierte un limite por
// origen en un limite global — el primero que pida diez codigos deja a todos
// los demas afuera (research D6, FR-013).
//
// Se toma la ULTIMA entrada del encabezado, no la primera: el cliente puede
// mandar su propio X-Forwarded-For y esas entradas quedan a la izquierda. La
// ultima es la que agrego el proxy de confianza, y es la unica que no puede
// falsificar quien hace el pedido.
func OrigenDeLaConexion(r *http.Request) string {
	reenviado := r.Header.Get("X-Forwarded-For")
	if reenviado != "" {
		partes := strings.Split(reenviado, ",")
		ultima := strings.TrimSpace(partes[len(partes)-1])
		if ultima != "" {
			return ultima
		}
	}

	// Sin proxy adelante —en local, o si Railway cambiara de forma— RemoteAddr
	// es la respuesta correcta. Se le saca el puerto, que cambia en cada
	// conexion y arruinaria cualquier conteo.
	direccion := r.RemoteAddr
	if i := strings.LastIndex(direccion, ":"); i != -1 {
		direccion = direccion[:i]
	}
	return strings.Trim(direccion, "[]")
}
