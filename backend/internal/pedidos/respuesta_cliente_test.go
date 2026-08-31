package pedidos

import (
	"encoding/json"
	"strings"
	"testing"
)

// FR-009 y FR-010: **la cedula de quien recibio no sale del lado de Diego.**
//
// Esta es la unica regla de `016` que se rompe en silencio, y por eso tiene una
// prueba propia en vez de una linea en otra.
//
// ## Por que se rompe en silencio
//
// Hasta este feature, `GET /pedidos` y `GET /admin/pedidos` devolvian
// **exactamente la misma estructura**: los dos handlers terminan escribiendo el
// mismo `[]*Pedido`. Agregarle un campo a `Pedido` se lo agrega a los dos.
//
// O sea que el modo de falla no es alguien decidiendo exponer una cedula: es
// alguien agregando un campo de buena fe, seis meses despues, sin saber que
// habia un corte. **Una regla de exposicion sin guarda automatica dura lo que
// dura la memoria de quien la escribio.**
//
// ## Que prueba, y como
//
// Se serializa lo que se le manda al CLIENTE con una cedula conocida metida en
// el dato, y se afirma que **esa cadena no aparece en ningun lado del JSON**. No
// se mira un campo por nombre: se mira el texto completo, porque un campo que
// alguien renombre seguiria filtrando el valor.
//
// Y con su **control positivo**: la respuesta del admin **si** tiene que
// contenerla. Sin eso, esta prueba pasaria igual el dia que la serializacion
// devuelva un objeto vacio — verde para siempre, protegiendo nada.
const cedulaDePrueba = "1.234.567-8"

func pedidoEntregado() *Pedido {
	return &Pedido{
		ID:                 "8f3a",
		Codigo:             "FU-0007",
		Estado:             "entrega",
		RemitenteNombre:    "Marcela",
		DestinatarioNombre: "Beto Sosa",
		RecibioNombre:      "Susana Pérez",
	}
}

func TestLaRespuestaDelClienteNoLlevaLaCedula(t *testing.T) {
	// El pedido del cliente NO tiene donde poner la cedula — ese es el punto
	// del diseno. Pero se serializa igual y se busca la cadena, porque lo que
	// se esta comprobando es que no exista ningun camino, no que este tipo no
	// tenga el campo hoy.
	crudo, err := json.Marshal(respuestaLista{Pedidos: []*Pedido{pedidoEntregado()}})
	if err != nil {
		t.Fatalf("no se pudo serializar la respuesta del cliente: %v", err)
	}

	if strings.Contains(string(crudo), cedulaDePrueba) {
		t.Fatalf(
			"la cedula de quien recibio salio en la respuesta del CLIENTE.\n"+
				"Es un dato personal de un tercero que le dio su documento a "+
				"Diego en la puerta, no al remitente.\n"+
				"Si hace falta un dato nuevo del lado de Diego, va en `ParaAdmin`, "+
				"no en `Pedido`.\nRespuesta: %s", crudo)
	}

	// Y que el nombre SI este: sin esto, la prueba pasaria con una respuesta
	// que no dice nada de quien recibio, que es otro defecto.
	if !strings.Contains(string(crudo), "Susana") {
		t.Fatalf("el cliente tiene que ver QUIEN recibio su paquete: %s", crudo)
	}
}

// EL CONTROL POSITIVO. Sin esto, el caso de arriba pasa el dia que la
// serializacion devuelva vacio, y la guarda queda verde protegiendo nada.
func TestLaRespuestaDelAdminSiLlevaLaCedula(t *testing.T) {
	admin := &ParaAdmin{
		Pedido:           pedidoEntregado(),
		RecibioDocumento: cedulaDePrueba,
	}

	crudo, err := json.Marshal(respuestaListaAdmin{Pedidos: []*ParaAdmin{admin}})
	if err != nil {
		t.Fatalf("no se pudo serializar la respuesta del admin: %v", err)
	}

	if !strings.Contains(string(crudo), cedulaDePrueba) {
		t.Fatalf(
			"la cedula NO salio en la respuesta del admin, y tiene que salir.\n"+
				"Si esto falla, el caso de arriba no esta probando nada: estaria "+
				"pasando porque no encuentra la cadena en ninguna parte.\n"+
				"Respuesta: %s", crudo)
	}
}

// Un pedido sin receptor no trae el campo, en vez de traerlo vacio (FR-011).
//
// Es lo que le permite a la pantalla distinguir "no se registro" de "se
// registro en blanco" sin preguntar.
func TestUnPedidoSinReceptorNoTraeElCampo(t *testing.T) {
	p := pedidoEntregado()
	p.RecibioNombre = ""

	crudo, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("no se pudo serializar: %v", err)
	}

	if strings.Contains(string(crudo), "recibioNombre") {
		t.Fatalf("un pedido sin receptor no puede traer el campo: %s", crudo)
	}
}

// El tipo del admin **embebe** al del cliente, y eso hay que sostenerlo: si
// alguien lo separa en dos structs paralelos, el dia que se agregue un campo al
// pedido la lista de Diego deja de traerlo y nadie se entera.
func TestElAdminVeTodoLoQueVeElCliente(t *testing.T) {
	admin := &ParaAdmin{Pedido: pedidoEntregado(), RecibioDocumento: cedulaDePrueba}

	crudo, err := json.Marshal(admin)
	if err != nil {
		t.Fatalf("no se pudo serializar: %v", err)
	}

	for _, esperado := range []string{"FU-0007", "Susana", "Beto Sosa", "Marcela"} {
		if !strings.Contains(string(crudo), esperado) {
			t.Fatalf("la respuesta del admin perdio %q: %s", esperado, crudo)
		}
	}
}
