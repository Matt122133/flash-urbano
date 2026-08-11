package correo

import (
	"context"
	"sync"
)

// Falso captura los envios en memoria en vez de mandarlos.
//
// Es lo que hace automatizables las pruebas del codigo de acceso: el
// vencimiento, los cinco intentos y los limites de frecuencia se verifican
// **sin mandar un solo mail** y sin depender de que un servicio de afuera
// conteste (research D8).
//
// Vive en el paquete y no en un `_test.go` porque lo usan las pruebas de
// `internal/auth`, y un archivo de prueba no se puede importar desde otro
// paquete.
type Falso struct {
	mu       sync.Mutex
	enviados []Envio
	// Fallar hace que el proximo envio devuelva ErrNoSePudoEnviar. Sirve para
	// probar que un proveedor caido no deja al usuario sin respuesta.
	Fallar bool
}

// Envio es un mail que se habria mandado.
type Envio struct {
	Destino string
	Codigo  string
}

// EnviarCodigo implementa Enviador guardando el envio.
func (f *Falso) EnviarCodigo(_ context.Context, destino, codigo string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Fallar {
		return ErrNoSePudoEnviar
	}
	f.enviados = append(f.enviados, Envio{Destino: destino, Codigo: codigo})
	return nil
}

// Enviados devuelve una copia de lo capturado.
//
// Copia y no el slice interno: quien prueba no deberia poder alterar el
// registro que esta inspeccionando, y devolver el original lo permitiria.
func (f *Falso) Enviados() []Envio {
	f.mu.Lock()
	defer f.mu.Unlock()
	copia := make([]Envio, len(f.enviados))
	copy(copia, f.enviados)
	return copia
}

// Ultimo devuelve el ultimo envio, y si hubo alguno.
//
// Es lo que usa la prueba que necesita el codigo en claro: la unica forma de
// verificar un codigo correcto es leerlo de aca, porque en la base solo esta su
// hash y en ningun lado queda el original (FR-012).
func (f *Falso) Ultimo() (Envio, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.enviados) == 0 {
		return Envio{}, false
	}
	return f.enviados[len(f.enviados)-1], true
}

// Olvidar vacia lo capturado, para que una prueba no arrastre la anterior.
func (f *Falso) Olvidar() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.enviados = nil
}
