package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Reglas del codigo de acceso (FR-008 a FR-012).
const (
	// digitosDelCodigo son seis: es lo que una persona puede leer de un mail y
	// escribir en el telefono sin equivocarse. La defensa contra fuerza bruta
	// NO la da el largo —un millon de valores no es mucho— sino el limite de
	// cinco intentos y los diez minutos de vida.
	digitosDelCodigo = 6

	// vidaDelCodigo: diez minutos. Suficiente para ir al mail y volver, corto
	// para que un codigo que quedo en una bandeja ajena no sirva mañana.
	vidaDelCodigo = 10 * time.Minute

	// maxIntentos: al quinto fallo el codigo muere, **aunque el sexto intento
	// traiga el valor correcto** (FR-010).
	maxIntentos = 5

	// costoBcrypt es el costo del hashing lento.
	//
	// Con un codigo de seis digitos el hash es lo unico que separa a alguien que
	// se lleve la tabla de tener todos los codigos vivos: con SHA-256, calcular
	// el millon de digests y darlos vuelta lleva segundos (research D2). Con
	// bcrypt en costo 12, ese millon pasa a ser dias de computo por codigo.
	//
	// 12 y no mas: cada verificacion lo paga, y la verificacion ocurre mientras
	// alguien mira la pantalla.
	costoBcrypt = 12
)

// Errores del camino por codigo.
//
// **Hacia afuera son todos lo mismo** (FR-014): quien llama los convierte en
// una unica respuesta. Se distinguen aca adentro para que el rastro pueda decir
// que paso de verdad (FR-022d), que es lo unico que permite reconstruir un
// reclamo.
var (
	// ErrCodigoInvalido es el que sale cuando el codigo no coincide.
	ErrCodigoInvalido = errors.New("el codigo no es valido")
	// ErrCodigoVencido: existio, pero se paso de los diez minutos.
	ErrCodigoVencido = errors.New("el codigo vencio")
	// ErrCodigoAgotado: se acabaron los cinco intentos, o ya se uso.
	ErrCodigoAgotado = errors.New("el codigo ya no sirve")
)

// Codigos emite y verifica codigos de acceso de un solo uso.
type Codigos struct {
	pool *db.Pool
}

func NuevosCodigos(pool *db.Pool) *Codigos {
	return &Codigos{pool: pool}
}

// generarCodigo devuelve seis digitos de fuente criptograficamente segura.
//
// `crypto/rand` y no `math/rand`: con el generador comun, quien vea unos pocos
// codigos puede predecir los siguientes, y eso convierte el ingreso por mail en
// una puerta abierta.
//
// Se arma digito por digito sobre un alfabeto de diez para que **todos los
// valores sean igual de probables**, incluidos los que empiezan en cero.
// Sacarlo de un entero y rellenar con ceros a la izquierda funciona igual, pero
// invita a que alguien "arregle" el relleno mas adelante y recorte el espacio a
// la novena parte sin que nada falle.
func generarCodigo() (string, error) {
	var sb strings.Builder
	sb.Grow(digitosDelCodigo)
	for i := 0; i < digitosDelCodigo; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			// Solo falla si el sistema se quedo sin entropia. Emitir un codigo
			// adivinable seria peor que no emitir ninguno.
			return "", fmt.Errorf("no se pudo generar el codigo de acceso: %w", err)
		}
		sb.WriteByte(byte('0' + n.Int64()))
	}
	return sb.String(), nil
}

// Emitir crea un codigo para una direccion y devuelve el valor en claro.
//
// **Es la unica vez que el codigo existe fuera del mail de la persona.** Se
// devuelve para mandarlo y se olvida: la base guarda su hash y no hay forma de
// recuperarlo (FR-012).
//
// El email se normaliza a minusculas porque la columna lo exige y porque
// `Mateo@` y `mateo@` son la misma persona: sin esto, pedir el codigo con una
// mayuscula de mas crearia una cuenta paralela.
func (c *Codigos) Emitir(ctx context.Context, email, origen string) (string, error) {
	email = normalizarEmail(email)

	codigo, err := generarCodigo()
	if err != nil {
		return "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(codigo), costoBcrypt)
	if err != nil {
		return "", fmt.Errorf("hashear el codigo: %w", err)
	}

	const sql = `
		INSERT INTO codigos_acceso (email, codigo_hash, origen, expira_en)
		VALUES ($1, $2, $3, now() + $4::interval)`

	if _, err := c.pool.Exec(ctx, sql, email, hash, nuloSiVacio(origen), vidaDelCodigo); err != nil {
		return "", fmt.Errorf("guardar el codigo: %w", err)
	}
	return codigo, nil
}

// Verificar consume un codigo. Devuelve nil solo si era correcto y estaba vivo.
//
// El orden de los pasos es la parte que importa, y no es intercambiable:
//
//  1. Se toma el codigo **mas reciente** de esa direccion. Pedir uno nuevo
//     invalida en la practica al anterior, que es lo que espera cualquiera que
//     haya tocado "reenviar".
//  2. Se descarta si ya se uso o si se quedo sin intentos, **antes** de
//     comparar. Esto es lo que hace cierto a FR-010: el quinto fallo mata el
//     codigo aunque el sexto intento traiga el valor correcto.
//  3. Se **incrementa el contador antes** de comparar, en la misma sentencia
//     que lo lee. Si se incrementara despues, dos intentos simultaneos leerian
//     el mismo contador y gastarian un solo intento entre los dos: seis, ocho o
//     veinte pruebas por el precio de cinco.
func (c *Codigos) Verificar(ctx context.Context, email, codigo string) error {
	email = normalizarEmail(email)

	// Un solo viaje: selecciona el ultimo codigo de esa direccion, lo bloquea,
	// le suma un intento y devuelve el estado ANTERIOR al incremento. El
	// `FOR UPDATE` sobre la subconsulta es lo que serializa dos intentos que
	// lleguen juntos.
	const sql = `
		UPDATE codigos_acceso
		SET intentos = intentos + 1
		WHERE id = (
			SELECT id FROM codigos_acceso
			WHERE email = $1
			ORDER BY creado_en DESC
			LIMIT 1
			FOR UPDATE
		)
		RETURNING codigo_hash, intentos - 1, usado_en IS NOT NULL, expira_en < now()`

	var hash []byte
	var intentosPrevios int
	var yaUsado, vencido bool

	err := c.pool.QueryRow(ctx, sql, email).Scan(&hash, &intentosPrevios, &yaUsado, &vencido)
	if errors.Is(err, pgx.ErrNoRows) {
		// Nunca se pidio un codigo para esa direccion. Hacia afuera es
		// indistinguible de uno incorrecto.
		return ErrCodigoInvalido
	}
	if err != nil {
		return fmt.Errorf("leer el codigo: %w", err)
	}

	if yaUsado || intentosPrevios >= maxIntentos {
		return ErrCodigoAgotado
	}
	if vencido {
		return ErrCodigoVencido
	}

	// bcrypt compara en tiempo constante respecto del contenido: no hay filtracion
	// por cuanto tarda.
	if err := bcrypt.CompareHashAndPassword(hash, []byte(codigo)); err != nil {
		return ErrCodigoInvalido
	}

	// Correcto: se marca usado. La condicion `usado_en IS NULL` es la que hace
	// cierto el uso unico incluso si dos verificaciones correctas llegan juntas
	// —solo una encuentra la fila sin marcar—.
	const marcar = `UPDATE codigos_acceso SET usado_en = now() WHERE email = $1 AND usado_en IS NULL AND expira_en > now()`
	etiqueta, err := c.pool.Exec(ctx, marcar, email)
	if err != nil {
		return fmt.Errorf("marcar el codigo como usado: %w", err)
	}
	if etiqueta.RowsAffected() == 0 {
		// Otro lo consumio en el medio.
		return ErrCodigoAgotado
	}
	return nil
}

// PurgarVencidos borra los codigos que ya no sirven.
//
// Se engancha al janitor de T018, igual que las sesiones y el rastro. Un codigo
// vencido no abre nada, asi que conservarlo solo acumula direcciones de mail sin
// ninguna razon — y [data-model.md](../../../specs/006-backend-auth/data-model.md)
// lo pide explicitamente.
func (c *Codigos) PurgarVencidos(ctx context.Context, margen time.Duration) (int64, error) {
	const sql = `DELETE FROM codigos_acceso WHERE expira_en < now() - $1::interval`

	etiqueta, err := c.pool.Exec(ctx, sql, margen)
	if err != nil {
		return 0, fmt.Errorf("purgar codigos: %w", err)
	}
	return etiqueta.RowsAffected(), nil
}

func normalizarEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// nuloSiVacio evita guardar cadenas vacias donde la columna admite NULL.
//
// "sin origen conocido" y "el origen es la cadena vacia" son cosas distintas, y
// mezclarlas haria que los limites por origen agrupen a todos los desconocidos
// en un mismo cubo.
func nuloSiVacio(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}
