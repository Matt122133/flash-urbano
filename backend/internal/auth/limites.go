package auth

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// ErrLimiteExcedido es lo que sale cuando se pidieron demasiados codigos.
//
// Hacia afuera **no se distingue** de un pedido aceptado (FR-014): quien llama
// responde lo mismo en los dos casos. Se distingue aca adentro para que el
// rastro registre `limite_excedido` y no `codigo_incorrecto` (FR-022d), que es
// lo unico que despues permite explicar por que alguien no pudo entrar.
var ErrLimiteExcedido = errors.New("se pidieron demasiados codigos")

// Los limites. FR-013 exige que existan por direccion y por origen, pero no
// fija los numeros: se eligen aca y se argumentan, porque un limite sin motivo
// escrito es un numero que nadie se anima a tocar despues.
const (
	// Por direccion de mail: tres cada quince minutos. Quien no recibe el mail
	// toca "reenviar" una o dos veces; tres cubre eso con margen. Es el limite
	// preciso, el que de verdad frena el abuso contra una cuenta concreta.
	maxPorEmail     = 3
	ventanaPorEmail = 15 * time.Minute

	// Por origen de conexion: veinte por hora. **Deliberadamente flojo**, y el
	// motivo importa: en Uruguay los operadores moviles usan CGNAT, asi que
	// cientos de personas comparten una misma direccion de salida. Un limite
	// por origen apretado no frena a un atacante —que rota direcciones— y en
	// cambio deja afuera a clientes reales de Antel que nunca van a entender
	// por que. Es un tope contra un script tonto, no el control principal.
	maxPorOrigen     = 20
	ventanaPorOrigen = time.Hour
)

// Limites cuenta pedidos recientes contra la tabla de codigos.
//
// No hay tabla de contadores ni Redis (research D6): la fila de
// `codigos_acceso` **ya existe una vez por pedido**, asi que contarlas cubre los
// dos limites sin sumar infraestructura que haya que desplegar, mantener y
// pagar para contar unos pocos pedidos por hora.
type Limites struct {
	pool *db.Pool
}

func NuevosLimites(pool *db.Pool) *Limites {
	return &Limites{pool: pool}
}

// Permite dice si se puede emitir un codigo mas para esa direccion y origen.
//
// Devuelve ErrLimiteExcedido si alguno de los dos topes esta alcanzado. Se
// comprueban los dos, no el primero que falle: da igual cual freno, pero el
// rastro registra el mismo resultado y no hace falta distinguirlos.
func (l *Limites) Permite(ctx context.Context, email, origen string) error {
	email = normalizarEmail(email)

	const porEmail = `
		SELECT count(*) FROM codigos_acceso
		WHERE email = $1 AND creado_en > now() - $2::interval`

	var cuantos int
	if err := l.pool.QueryRow(ctx, porEmail, email, ventanaPorEmail).Scan(&cuantos); err != nil {
		return fmt.Errorf("contar codigos por email: %w", err)
	}
	if cuantos >= maxPorEmail {
		return ErrLimiteExcedido
	}

	// Sin origen conocido no se cuenta por origen: agrupar a todos los
	// desconocidos en un mismo cubo convertiria el limite en global, que es
	// justo el modo de falla que research D6 quiere evitar.
	if strings.TrimSpace(origen) == "" {
		return nil
	}

	const porOrigen = `
		SELECT count(*) FROM codigos_acceso
		WHERE origen = $1 AND creado_en > now() - $2::interval`

	if err := l.pool.QueryRow(ctx, porOrigen, origen, ventanaPorOrigen).Scan(&cuantos); err != nil {
		return fmt.Errorf("contar codigos por origen: %w", err)
	}
	if cuantos >= maxPorOrigen {
		return ErrLimiteExcedido
	}
	return nil
}

// OrigenDelPedido devuelve la direccion de quien hizo el pedido.
//
// **Sale de `X-Forwarded-For`, no de `RemoteAddr`** (research D6). Railway pone
// un proxy adelante, asi que `RemoteAddr` es la direccion del proxy y es **la
// misma para todo el mundo**: contar por ahi convierte el limite por origen en
// uno global, y el primero que pida veinte codigos deja a todos afuera. Es un
// modo de falla que **no se ve en local** —sin proxy, `RemoteAddr` es correcto—
// y que aparece recien en produccion, contra clientes reales.
//
// Se toma la **ultima** entrada del encabezado, no la primera. El cliente puede
// mandar su propio `X-Forwarded-For` y esas entradas inventadas quedan a la
// izquierda; el proxy de confianza agrega la que vio, al final. Confiar en la
// primera es dejar que cualquiera se saltee el limite cambiando una cadena de
// texto — hay una prueba que lo vigila.
func OrigenDelPedido(r *http.Request) string {
	adelantado := r.Header.Get("X-Forwarded-For")
	if adelantado != "" {
		partes := strings.Split(adelantado, ",")
		ultima := strings.TrimSpace(partes[len(partes)-1])
		if ultima != "" {
			return ultima
		}
	}

	// Sin proxy adelante —en local, o si el encabezado no vino— vale
	// RemoteAddr, que trae puerto y hay que sacarselo.
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return host
}
