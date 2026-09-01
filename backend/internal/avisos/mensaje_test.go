package avisos_test

import (
	"strings"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
)

// unPedidoCompleto es un pedido de verdad, con todo lo que un pedido trae.
//
// Los datos que **no** pueden aparecer en el aviso se declaran aca aunque
// `PedidoNuevo` no los tenga, porque son contra lo que se compara abajo: son
// exactamente los que estarian a mano si alguien le pasara el pedido entero al
// armador.
const (
	codigo   = "FU-0142"
	calle    = "Av. Brasil"
	numero   = "2314"
	esquina  = "Bulevar Espana"
	nombre   = "Fernanda Rodriguez"
	telefono = "099123456"
	precio   = "480"
)

func armado() avisos.Mensaje {
	return avisos.Armar(avisos.PedidoNuevo{Codigo: codigo, EntregaCalle: calle})
}

// TestElAvisoDiceCodigoYCalle es FR-005 por el lado de lo que **si** tiene que
// estar.
//
// El criterio no es "poco texto": es lo justo para decidir si le queda de paso
// sin desbloquear el telefono. El codigo solo no dice donde.
func TestElAvisoDiceCodigoYCalle(t *testing.T) {
	m := armado()

	if m.Titulo != "Pedido nuevo FU-0142" {
		t.Errorf("el titulo es %q, queria \"Pedido nuevo FU-0142\"", m.Titulo)
	}
	if m.Cuerpo != "Entrega en Av. Brasil" {
		t.Errorf("el cuerpo es %q, queria \"Entrega en Av. Brasil\"", m.Cuerpo)
	}

	// El codigo viaja aparte del texto: es lo que hace que tocar el aviso abra
	// la lista en ese pedido, sin que la app tenga que parsear el titulo.
	if m.Codigo != codigo {
		t.Errorf("el codigo del bloque de datos es %q, queria %q", m.Codigo, codigo)
	}
}

// TestElAvisoNoFiltraNadaDeLoProhibido es FR-005 por el lado que importa, y el
// Principio V.
//
// **El control positivo de esta prueba es una recompilacion, no un dato de
// entrada**: la unica forma de hacerla fallar es agregarle a `PedidoNuevo` un
// campo prohibido y meterlo en el texto. Eso es lo que la hace fuerte — lo que
// no entra a la estructura no puede salir en el aviso, y el compilador sostiene
// la regla mejor que cualquier assert.
//
// Se comprobo en rojo el 2026-09-01 agregandole `EntregaNumero` a `PedidoNuevo`
// y concatenandolo al cuerpo.
func TestElAvisoNoFiltraNadaDeLoProhibido(t *testing.T) {
	m := armado()
	texto := m.Titulo + " " + m.Cuerpo

	prohibido := map[string]string{
		"el numero de puerta":       numero,
		"la esquina":                esquina,
		"el nombre de una persona":  nombre,
		"el telefono de una persona": telefono,
		"un importe":                precio,
	}

	for que, valor := range prohibido {
		if strings.Contains(texto, valor) {
			t.Errorf("el aviso muestra %s (%q) en: %q", que, valor, texto)
		}
	}

	// Y el signo de peso, que es la forma en que un importe se colaria aunque el
	// numero fuera otro. El producto no habla de plata en ninguna superficie.
	if strings.ContainsAny(texto, "$") {
		t.Errorf("el aviso trae un signo de peso: %q", texto)
	}
}

// TestUnaCalleConNumeroNoSeMutila es la prueba que **impide un arreglo
// equivocado**, y por eso esta escrita.
//
// La tentacion, leyendo "sin numero", es sacarle los digitos a la calle. En
// Montevideo eso es un desastre: **18 de Julio**, 8 de Octubre y 26 de Marzo
// son calles principales y su nombre ES un numero. Un filtro de digitos las
// convertiria en "de Julio".
//
// FR-005 se cumple por **que campos se leen** —la calle si, el numero y la
// esquina no, y viven en columnas aparte—, no por censurar el texto de uno.
func TestUnaCalleConNumeroNoSeMutila(t *testing.T) {
	casos := []string{"18 de Julio", "8 de Octubre", "26 de Marzo"}

	for _, calle := range casos {
		m := avisos.Armar(avisos.PedidoNuevo{Codigo: codigo, EntregaCalle: calle})
		if m.Cuerpo != "Entrega en "+calle {
			t.Errorf("la calle %q llego al aviso como %q", calle, m.Cuerpo)
		}
	}
}

// TestElArmadoLimpiaLoQueEscribioUnaPersona: el texto lo tipea alguien en un
// telefono, asi que llega con lo que llegue.
func TestElArmadoLimpiaLoQueEscribioUnaPersona(t *testing.T) {
	m := avisos.Armar(avisos.PedidoNuevo{
		Codigo:       "  FU-0142 ",
		EntregaCalle: "  Av.   Brasil\n",
	})

	if m.Titulo != "Pedido nuevo FU-0142" {
		t.Errorf("el titulo es %q", m.Titulo)
	}
	if m.Cuerpo != "Entrega en Av. Brasil" {
		t.Errorf("el cuerpo es %q", m.Cuerpo)
	}
	if m.Codigo != "FU-0142" {
		t.Errorf("el codigo del bloque de datos es %q", m.Codigo)
	}
}

// TestSinCalleElAvisoNoQuedaColgado cubre lo que no deberia pasar nunca.
//
// El validador de `POST /pedidos` exige la calle de entrega, asi que esto solo
// llega por un defecto. Cuando llegue, un "Entrega en " colgando es peor que un
// titulo solo: parece que el aviso se corto, y manda a Diego a abrir la app
// para descubrir que no falta nada.
func TestSinCalleElAvisoNoQuedaColgado(t *testing.T) {
	m := avisos.Armar(avisos.PedidoNuevo{Codigo: codigo})

	if m.Titulo != "Pedido nuevo FU-0142" {
		t.Errorf("el titulo es %q", m.Titulo)
	}
	if m.Cuerpo != "" {
		t.Errorf("sin calle el cuerpo quedo en %q, tenia que quedar vacio", m.Cuerpo)
	}
}
