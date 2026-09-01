package avisos

import "strings"

// PedidoNuevo es lo unico que el aviso necesita saber de un pedido.
//
// **Son dos campos y no un `*pedidos.Pedido`**, por dos razones que apuntan al
// mismo lado.
//
// La primera es de dependencias: `internal/pedidos` importa este paquete para
// disparar el aviso, asi que si este importara aquel habria un ciclo y no
// compilaria. La direccion correcta es pedidos -> avisos.
//
// La segunda es FR-005, y es la que importa. Un pedido entero trae el nombre y
// el telefono de las dos puntas, el numero de puerta, la esquina y **el
// precio** — que la constitucion prohibe leer para nada (Principio V). Con el
// pedido entero adentro, que ninguno de esos datos termine en la pantalla
// bloqueada de un telefono apoyado en un mostrador depende de que quien escriba
// el mensaje se acuerde. Asi, **no puede pasar**: lo que no entra a esta
// estructura no puede salir en el aviso, y el compilador lo sostiene.
type PedidoNuevo struct {
	// Codigo es el `FU-0142` que ya genera la base.
	Codigo string

	// EntregaCalle es la calle sola, **sin el numero y sin la esquina**, que
	// viven en campos aparte del pedido y se quedan ahi.
	EntregaCalle string
}

// Mensaje es lo que se va a ver y lo que la app va a leer.
//
// Se arma sin tocar la red a proposito: es la parte del feature que se puede
// comprobar de verdad en una prueba, y donde vive lo que FR-005 prohibe.
type Mensaje struct {
	// Titulo y Cuerpo son lo que dibuja el sistema en la pantalla bloqueada.
	Titulo string
	Cuerpo string

	// Codigo viaja en el bloque `data` y es lo que hace que tocar el aviso abra
	// la lista **en ese pedido** (FR-004). Es el mismo que va en el titulo: el
	// titulo es para leerlo y este es para navegar, y la app no tiene por que
	// parsear el texto visible para saber a donde ir.
	Codigo string
}

// Armar decide que dice el aviso.
//
// El criterio de FR-005 no es "poco texto": es **lo justo para que Diego decida
// si le queda de paso sin desbloquear el telefono**. El codigo solo no alcanza
// —no dice donde—, y la direccion exacta deja la casa de un cliente legible
// para cualquiera que mire el telefono apoyado en un mostrador.
//
// **Lo que esta prohibido que aparezca**: el numero de puerta, la esquina, el
// nombre y el telefono de cualquiera de las dos puntas, y cualquier importe.
// La garantia no es este cuerpo de funcion: es que `PedidoNuevo` no tiene esos
// campos. Un descuido aca no compila.
//
// **Por que la esquina queda afuera aunque no sea un dato personal**: en este
// producto el punto de entrega **se resuelve del cruce**, asi que calle mas
// esquina no es "casi la direccion", es la direccion con otro nombre.
func Armar(p PedidoNuevo) Mensaje {
	codigo := limpiar(p.Codigo)
	calle := limpiar(p.EntregaCalle)

	mensaje := Mensaje{
		Titulo: strings.TrimSpace("Pedido nuevo " + codigo),
		Codigo: codigo,
	}

	// **Sin calle no se inventa un cuerpo.** El validador de `POST /pedidos`
	// exige la calle de entrega, asi que esto no deberia pasar nunca; si pasara,
	// un "Entrega en " colgando es peor que un aviso con titulo solo, y una
	// frase de relleno seria copy que nadie escribio. El titulo ya alcanza para
	// que Diego abra la app.
	if calle != "" {
		mensaje.Cuerpo = "Entrega en " + calle
	}

	return mensaje
}

// limpiar deja el texto como se va a ver: sin espacios en las puntas y sin
// dobles espacios adentro.
//
// Lo escribe una persona en un formulario desde el telefono, asi que llega con
// lo que llegue. `strings.Fields` parte por cualquier espacio en blanco —tabs y
// saltos de linea incluidos— y `Join` los repone de a uno.
func limpiar(s string) string {
	return strings.Join(strings.Fields(s), " ")
}
