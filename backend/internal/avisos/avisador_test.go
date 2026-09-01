package avisos

// Prueba INTERNA porque los dobles implementan interfaces no exportadas.
//
// **Ninguna de estas pruebas toca Postgres, y es deliberado.** Lo que se
// comprueba aca —que a dos telefonos les llegan dos mensajes, que uno que falla
// no corta el recorrido— es la logica del recorrido, no la consulta. Si
// dependiera de una base, se saltearia sola en cualquier `verify:` sin
// `TEST_DATABASE_URL`, que es el agujero que el tracker viene anotando desde
// `010`. La consulta de verdad se prueba en `destinatarios_test.go`, contra un
// Postgres real.

import (
	"context"
	"errors"
	"fmt"
	"testing"
)

// libretaFalsa devuelve los tokens que se le pongan y anota a quien se tacho.
type libretaFalsa struct {
	tokens    []string
	olvidados []string
	falla     error
}

func (l *libretaFalsa) Tokens(context.Context) ([]string, error) {
	if l.falla != nil {
		return nil, l.falla
	}
	return l.tokens, nil
}

func (l *libretaFalsa) Olvidar(_ context.Context, token string) error {
	l.olvidados = append(l.olvidados, token)
	return nil
}

// mandadorFalso anota a quien se le mando y puede fallarle a quien se le diga.
type mandadorFalso struct {
	mandados []string
	mensajes []Mensaje
	fallas   map[string]error
}

func (m *mandadorFalso) Mandar(_ context.Context, token string, mensaje Mensaje) error {
	m.mandados = append(m.mandados, token)
	m.mensajes = append(m.mensajes, mensaje)
	return m.fallas[token]
}

var unPedido = PedidoNuevo{Codigo: "FU-0142", EntregaCalle: "Av. Brasil"}

// TestLosDosTelefonosRecibenElAviso es **FR-018**, y el caso normal desde el
// dia uno.
//
// Hay dos telefonos con sesion administradora —el de Diego, que trabaja, y el
// de Mateo, que verifica—, y la API del proveedor manda **un mensaje por
// token**. Una implementacion que mandara solo al primero pasaria cualquier
// prueba escrita con un telefono solo.
func TestLosDosTelefonosRecibenElAviso(t *testing.T) {
	libreta := &libretaFalsa{tokens: []string{"token-de-diego", "token-de-mateo"}}
	mandador := &mandadorFalso{}

	NuevoAvisador(libreta, mandador).Avisar(context.Background(), unPedido)

	if len(mandador.mandados) != 2 {
		t.Fatalf("se mandaron %d mensajes (%v), queria 2", len(mandador.mandados), mandador.mandados)
	}
	// Y los dos dicen lo mismo: es el mismo pedido.
	for i, m := range mandador.mensajes {
		if m.Titulo != "Pedido nuevo FU-0142" || m.Cuerpo != "Entrega en Av. Brasil" {
			t.Errorf("el mensaje %d fue %q / %q", i, m.Titulo, m.Cuerpo)
		}
	}
}

// TestUnTelefonoQueFallaNoCortaElRecorrido es **SC-010**, y la mitad de FR-018
// que se rompe sola si alguien escribe un `return` donde va un `continue`.
//
// El caso real: el telefono de Mateo se quedo sin bateria, o su token murio. Eso
// **no puede** dejar a Diego sin enterarse de un pedido — y con el orden que
// devuelva la base, "el que falla" puede ser el primero.
func TestUnTelefonoQueFallaNoCortaElRecorrido(t *testing.T) {
	libreta := &libretaFalsa{tokens: []string{"token-que-falla", "token-de-diego"}}
	mandador := &mandadorFalso{fallas: map[string]error{
		"token-que-falla": errors.New("el proveedor no contesto"),
	}}

	NuevoAvisador(libreta, mandador).Avisar(context.Background(), unPedido)

	if len(mandador.mandados) != 2 {
		t.Fatalf("se intentaron %d envios (%v); el primero fallo y corto el recorrido",
			len(mandador.mandados), mandador.mandados)
	}
	if mandador.mandados[1] != "token-de-diego" {
		t.Errorf("el segundo envio fue a %q", mandador.mandados[1])
	}

	// Y un fallo comun **no** borra el token: el telefono sigue estando ahi.
	if len(libreta.olvidados) != 0 {
		t.Errorf("un fallo transitorio borro tokens: %v", libreta.olvidados)
	}
}

// TestSoloElTokenMuertoSeBorra es **FR-013**, y su mitad negativa.
//
// Que se borre el muerto es lo obvio. Que **no se borre el de al lado** es lo
// que evita que un telefono desinstalado se lleve puesto al otro.
func TestSoloElTokenMuertoSeBorra(t *testing.T) {
	libreta := &libretaFalsa{tokens: []string{"token-muerto", "token-vivo"}}
	mandador := &mandadorFalso{fallas: map[string]error{
		"token-muerto": fmt.Errorf("%w: el proveedor respondio 404", ErrTokenMuerto),
	}}

	NuevoAvisador(libreta, mandador).Avisar(context.Background(), unPedido)

	if len(libreta.olvidados) != 1 || libreta.olvidados[0] != "token-muerto" {
		t.Errorf("se olvidaron %v, queria solo el muerto", libreta.olvidados)
	}
	if len(mandador.mandados) != 2 {
		t.Errorf("un token muerto corto el recorrido: %v", mandador.mandados)
	}
}

// TestSinDestinatariosNoSeIntentaNada: nadie declaro token todavia —la app
// recien instalada, o el permiso negado— y eso no es un error ni un envio.
func TestSinDestinatariosNoSeIntentaNada(t *testing.T) {
	mandador := &mandadorFalso{}

	NuevoAvisador(&libretaFalsa{}, mandador).Avisar(context.Background(), unPedido)

	if len(mandador.mandados) != 0 {
		t.Errorf("se intento mandar sin destinatarios: %v", mandador.mandados)
	}
}

// TestUnFalloDeBaseNoIntentaMandarNada: si no se pudo averiguar a quien, no se
// le manda a nadie. Suena obvio; el defecto que evita es recorrer un `nil` que
// vino junto a un error y quedarse tranquilo porque "no fallo".
func TestUnFalloDeBaseNoIntentaMandarNada(t *testing.T) {
	libreta := &libretaFalsa{
		tokens: []string{"token-de-diego"},
		falla:  errors.New("la base no contesto"),
	}
	mandador := &mandadorFalso{}

	NuevoAvisador(libreta, mandador).Avisar(context.Background(), unPedido)

	if len(mandador.mandados) != 0 {
		t.Errorf("se mando pese a no poder leer los destinatarios: %v", mandador.mandados)
	}
}

// TestElAvisadorMudoNoHaceNada es **FR-010** del lado del cableado.
//
// Es lo que se conecta cuando no hay credencial configurada. La prueba parece
// trivial y no lo es: lo que fija es que `Mudo` **exista como tipo** y no sea un
// `*Avisador` nulo. Con el nulo, cada lugar que avisa tendria que acordarse de
// comprobarlo, y el dia que alguien se olvide el sintoma es un panic en el
// camino de crear un pedido — la funcion accesoria tumbando la principal, que
// es justo lo que FR-010 existe para impedir.
func TestElAvisadorMudoNoHaceNada(t *testing.T) {
	var mudo Mudo
	mudo.Avisar(context.Background(), unPedido)
}
