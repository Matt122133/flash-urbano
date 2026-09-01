package main

import (
	"context"
	"testing"

	"github.com/Matt122133/flash-urbano/backend/internal/avisos"
	"github.com/Matt122133/flash-urbano/backend/internal/config"
)

// TestSinCredencialElAvisadorEsMudoYElServicioSigue es **FR-010** en el unico
// lugar donde se decide de verdad: el cableado.
//
// Que `config.Cargar` no exija la variable no alcanza. Lo que tumba un servicio
// es que la construccion de una dependencia devuelva un error y alguien lo
// propague hasta `main`. **Los dos caminos de fallo tienen que dar un avisador
// mudo, no un error**, y el segundo es el que importa: la variable ausente es
// el caso obvio, pero una credencial vencida, pegada a medias o de otro
// proyecto es el caso que va a pasar de verdad, y meses despues, cuando nadie
// se acuerde de que este archivo decide si el sitio sigue tomando pedidos.
//
// El `pool` va en nil a proposito: los dos caminos vuelven antes de tocarlo, y
// que esto no explote lo demuestra.
func TestSinCredencialElAvisadorEsMudoYElServicioSigue(t *testing.T) {
	casos := []struct {
		nombre     string
		credencial string
	}{
		{"la variable no esta", ""},
		{"solo espacios", "   "},
		{"no es base64", "esto-no-es-base64-{}"},
		{"es base64 pero adentro no hay una credencial", "bm8tc295LXVuYS1jcmVkZW5jaWFs"},
		{"es un JSON valido que no es una credencial", "eyJob2xhIjoiY2hhdSJ9"},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			cfg := &config.Config{
				AdminEmails:         []string{"diego@example.com"},
				FCMCredencialBase64: c.credencial,
			}

			avisador := construirAvisador(context.Background(), cfg, nil)
			if _, mudo := avisador.(avisos.Mudo); !mudo {
				t.Fatalf("con %q se cablo un avisador de verdad; una credencial rota tiene que degradar, no romper", c.credencial)
			}

			// Y usarlo no puede explotar: es lo que va a correr en cada pedido.
			avisador.Avisar(context.Background(), avisos.PedidoNuevo{Codigo: "FU-0142"})
		})
	}
}
