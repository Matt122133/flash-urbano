// Package auth prueba que una direccion de mail es de quien dice serlo, y
// emite la credencial con la que despues se la reconoce.
//
// Aca viven los dos caminos de ingreso —Google y codigo por mail— y las
// sesiones que los dos producen. El camino por el que se entro no cambia la
// sesion resultante: es la misma credencial y el mismo usuario.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
	"github.com/Matt122133/flash-urbano/backend/internal/httpx"
	"github.com/Matt122133/flash-urbano/backend/internal/usuarios"
)

// ErrSesionInvalida es lo unico que se devuelve cuando una credencial no sirve.
//
// **Una sola causa hacia afuera**, a proposito: vencida, revocada, inventada o
// de un usuario borrado dan todas lo mismo. Distinguirlas le diria a quien
// prueba credenciales cual de sus intentos estuvo cerca.
//
// Es literalmente el mismo valor que httpx.ErrSesionInvalida, y no una copia con
// el mismo texto. El middleware decide entre 401 y 500 comparando contra el
// suyo: dos errores distintos que se leen igual harian que toda credencial
// vencida saliera como 500 —"no pudimos procesar el pedido"— en vez de invitar a
// reingresar, y nada en las pruebas de este paquete lo notaria.
var ErrSesionInvalida = httpx.ErrSesionInvalida

// bytesDelToken es el tamano del valor aleatorio, antes de codificar.
//
// 32 bytes son 256 bits de entropia. Es lo que sostiene la decision de D1 de
// hashear el token con un digest rapido en vez de uno lento: contra este
// espacio la fuerza bruta no es un camino, asi que no hace falta encarecer cada
// verificacion —que ocurre en CADA request— para defenderse de algo que no pasa.
const bytesDelToken = 32

// Sesion es una credencial viva de un usuario.
//
// No tiene el token: el token existe una sola vez, cuando se crea, y de ahi en
// mas solo se guarda su hash. Un campo aca seria un lugar donde volver a
// filtrarlo sin querer.
type Sesion struct {
	ID        string
	UsuarioID string
	CreadaEn  time.Time
	ExpiraEn  time.Time
}

// Sesiones emite, resuelve y revoca credenciales.
type Sesiones struct {
	pool     *db.Pool
	duracion time.Duration
}

func NuevasSesiones(pool *db.Pool, duracion time.Duration) *Sesiones {
	return &Sesiones{pool: pool, duracion: duracion}
}

// hashDelToken es la unica forma de convertir un token en lo que se guarda.
//
// SHA-256 crudo y sin sal, deliberadamente: la sal defiende contra tablas
// precomputadas, que solo sirven cuando el valor de entrada es adivinable. Un
// token de 256 bits no lo es. Y sin sal el hash es determinista, que es lo que
// permite buscar la sesion por indice en vez de recorrer toda la tabla
// comparando de a una.
func hashDelToken(token string) []byte {
	suma := sha256.Sum256([]byte(token))
	return suma[:]
}

// generarToken devuelve un valor opaco, imposible de adivinar.
//
// Codificado en base64 sin relleno y seguro para URL: viaja en un header y se
// guarda en el navegador, asi que no puede traer caracteres que alguien tenga
// que escapar.
func generarToken() (string, error) {
	crudo := make([]byte, bytesDelToken)
	if _, err := rand.Read(crudo); err != nil {
		// rand.Read solo falla si el sistema se quedo sin entropia, y en ese
		// caso emitir una credencial adivinable seria peor que no emitirla.
		return "", fmt.Errorf("no se pudo generar el token de sesion: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(crudo), nil
}

// Crear emite una sesion nueva y devuelve el token en claro.
//
// **Es la unica vez que el token existe fuera del navegador del cliente.** Se
// devuelve, se manda en la respuesta y se olvida: la base guarda su hash, y no
// hay forma de recuperarlo despues. Si el cliente lo pierde, ingresa de nuevo.
func (s *Sesiones) Crear(ctx context.Context, usuarioID string) (*Sesion, string, error) {
	token, err := generarToken()
	if err != nil {
		return nil, "", err
	}

	const sql = `
		INSERT INTO sesiones (usuario_id, token_hash, expira_en)
		VALUES ($1, $2, $3)
		RETURNING id, usuario_id, creada_en, expira_en`

	var ses Sesion
	err = s.pool.QueryRow(ctx, sql, usuarioID, hashDelToken(token), time.Now().Add(s.duracion)).
		Scan(&ses.ID, &ses.UsuarioID, &ses.CreadaEn, &ses.ExpiraEn)
	if err != nil {
		return nil, "", fmt.Errorf("crear sesion: %w", err)
	}

	return &ses, token, nil
}

// Resolver devuelve la sesion de un token, si sirve.
//
// "Sirve" es no vencida y no revocada, y las dos condiciones se comprueban **en
// la consulta**, no en Go. La diferencia importa: filtrar despues de traer la
// fila deja abierta la puerta a que alguien agregue un camino que se olvide de
// mirar `revocada_en`, y ese descuido es FR-018 roto sin que nada falle.
func (s *Sesiones) Resolver(ctx context.Context, token string) (*Sesion, error) {
	if token == "" {
		return nil, ErrSesionInvalida
	}

	const sql = `
		SELECT id, usuario_id, creada_en, expira_en, token_hash
		FROM sesiones
		WHERE token_hash = $1
		  AND revocada_en IS NULL
		  AND expira_en > now()`

	var ses Sesion
	var guardado []byte
	esperado := hashDelToken(token)

	err := s.pool.QueryRow(ctx, sql, esperado).
		Scan(&ses.ID, &ses.UsuarioID, &ses.CreadaEn, &ses.ExpiraEn, &guardado)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSesionInvalida
	}
	if err != nil {
		return nil, fmt.Errorf("resolver sesion: %w", err)
	}

	// Comparacion en tiempo constante sobre lo que devolvio la base. La
	// busqueda ya fue por igualdad, asi que esto no cambia que fila sale; lo
	// que evita es que una comparacion posterior con `bytes.Equal` se vuelva un
	// canal lateral el dia que alguien la agregue. Es barato y cierra la puerta.
	if subtle.ConstantTimeCompare(guardado, esperado) != 1 {
		return nil, ErrSesionInvalida
	}

	return &ses, nil
}

// Revocar cierra UNA sesion, la del token que se presenta (FR-018).
//
// No cierra las demas del mismo usuario: alguien identificado en el telefono y
// en la computadora que cierra sesion en uno sigue adentro en el otro. Es lo
// que espera cualquiera y lo que pide SC-007.
//
// Es idempotente: revocar dos veces no es un error. El caso real es el cliente
// que toca "salir" dos veces porque la primera no pareció responder.
func (s *Sesiones) Revocar(ctx context.Context, token string) error {
	const sql = `
		UPDATE sesiones
		SET revocada_en = now()
		WHERE token_hash = $1 AND revocada_en IS NULL`

	if _, err := s.pool.Exec(ctx, sql, hashDelToken(token)); err != nil {
		return fmt.Errorf("revocar sesion: %w", err)
	}
	return nil
}

// PurgarVencidas borra las sesiones que ya no sirven.
//
// Se engancha al janitor de T018, igual que la purga del rastro. Una sesion
// vencida o revocada no autoriza nada, asi que conservarla solo acumula datos
// personales —de quien entro y cuando— sin ninguna razon.
//
// El margen existe para no borrar una sesion en el instante en que vence:
// alguien puede estar mirando su ultimo error de "tu sesion vencio" mientras
// esto corre, y la fila todavia explica por que.
func (s *Sesiones) PurgarVencidas(ctx context.Context, margen time.Duration) (int64, error) {
	const sql = `
		DELETE FROM sesiones
		WHERE expira_en < now() - $1::interval
		   OR revocada_en < now() - $1::interval`

	etiqueta, err := s.pool.Exec(ctx, sql, margen)
	if err != nil {
		return 0, fmt.Errorf("purgar sesiones: %w", err)
	}
	return etiqueta.RowsAffected(), nil
}

// ResolverUsuario arma el resolvedor que consume el middleware de httpx.
//
// Junta las dos mitades —credencial a sesion, sesion a usuario— en una sola
// funcion, para que el middleware no tenga que conocer ninguna de las dos.
//
// Un usuario que ya no existe se trata como credencial invalida y no como
// error: la sesion apunta a una fila borrada, y lo unico sensato que puede
// hacer quien la presenta es volver a entrar.
func (s *Sesiones) ResolverUsuario(repo *usuarios.Repositorio) func(context.Context, string) (*usuarios.Usuario, error) {
	return func(ctx context.Context, token string) (*usuarios.Usuario, error) {
		ses, err := s.Resolver(ctx, token)
		if err != nil {
			return nil, err
		}

		u, err := repo.PorID(ctx, ses.UsuarioID)
		if errors.Is(err, usuarios.ErrNoExiste) {
			return nil, ErrSesionInvalida
		}
		if err != nil {
			return nil, err
		}
		return u, nil
	}
}
