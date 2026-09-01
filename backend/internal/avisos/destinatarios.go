// Package avisos le hace llegar a Diego un pedido nuevo mientras hace otra cosa.
//
// Existe porque hasta `018` el pedido se guardaba y ahi se quedaba: el retraso
// entre que un cliente confirma y que Diego se entera era lo que el tardara en
// acordarse de abrir la app. **Un solo aviso, por un solo canal** — la decision
// de no tener correo como segundo camino esta escrita y argumentada en
// `docs/decisions/push-as-the-only-alert.md`.
//
// El paquete tiene tres piezas y se separan a proposito:
//
//   - **A quien** — este archivo. Una consulta, sin red.
//   - **Que dice** — el armado del mensaje, puro y sin red.
//   - **Como sale** — el cliente del proveedor, que es lo unico que toca la red.
//
// Las dos primeras se prueban de verdad; la tercera se prueba contra un servidor
// de mentira. Juntarlas haria que nada de esto fuera comprobable sin internet.
package avisos

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/Matt122133/flash-urbano/backend/internal/db"
)

// Destinatarios contesta la unica pregunta que hay que hacerle a la base antes
// de mandar un aviso: **a que telefonos**.
//
// No hay tabla de dispositivos y no la va a haber (FR-012): la respuesta sale de
// las sesiones vivas, que es donde la app anota su token al presentar la
// credencial.
type Destinatarios struct {
	pool *db.Pool

	// admins son las direcciones administradoras, ya normalizadas a minusculas.
	//
	// **Vienen de la configuracion y no de una columna**, porque no hay columna
	// de admin en esta base y es deliberado (FR-022 de `007`). Se recibe la lista
	// ya armada en vez del `*config.Config` entero para no invertir las capas:
	// este paquete no tiene por que saber leer variables de entorno.
	admins []string
}

func NuevosDestinatarios(pool *db.Pool, admins []string) *Destinatarios {
	return &Destinatarios{pool: pool, admins: admins}
}

// Tokens devuelve los destinatarios vivos de un aviso.
//
// **Devuelve un conjunto, no una fila** (FR-018), y ese es el caso normal desde
// el dia uno: hay dos telefonos con sesion administradora —el de Diego, que
// trabaja, y el de Mateo, que verifica— y los dos tienen que sonar. Asumir un
// unico token es un defecto que compila, pasa las pruebas de un telefono solo, y
// empieza a doler el dia que el telefono de prueba deja de ser el que avisa.
//
// **Vacio no es un error.** Nadie con la app instalada, el permiso negado, o el
// unico telefono con la sesion revocada dan todos lo mismo: no hay a quien
// avisarle. Quien llama registra y sigue; el pedido ya esta guardado.
//
// Los tres filtros del WHERE son el feature entero:
//
//   - `push_token IS NOT NULL` — nunca declaro a donde entregar. Todas las
//     sesiones del sitio web, para siempre: un navegador no es un telefono.
//   - `revocada_en IS NULL` — **esto es FR-007 y SC-008**, y no hay codigo que
//     los implemente aparte. El procedimiento de telefono perdido que ya existe
//     en `docs/processes/app-repartidor.md` —revocar la sesion a mano en la
//     base— le apaga los avisos como efecto colateral.
//   - `expira_en > now()` — con el `now()` **de la base**, no el del proceso.
//     En Railway no son la misma maquina, y meter la diferencia entre dos
//     relojes en esta decision es como se le manda un aviso a una sesion muerta.
func (d *Destinatarios) Tokens(ctx context.Context) ([]string, error) {
	if len(d.admins) == 0 {
		// Sin administradores configurados no hay a quien avisarle, y la consulta
		// con un arreglo vacio no devolveria nada igual. Se corta antes para no
		// pagar el viaje a la base en cada pedido.
		return nil, nil
	}

	// `lower(u.email)` es redundante hoy —`usuarios.email` tiene
	// `CHECK (email = lower(email))` desde `0001`— y se deja igual: la tabla
	// tiene una fila por cliente identificado, asi que no cuesta nada, y si algun
	// dia ese CHECK se aflojara, lo que se romperia en silencio seria justamente
	// que Diego deje de recibir avisos.
	const sql = `
		SELECT s.push_token
		  FROM sesiones s
		  JOIN usuarios u ON u.id = s.usuario_id
		 WHERE s.push_token IS NOT NULL
		   AND s.revocada_en IS NULL
		   AND s.expira_en > now()
		   AND lower(u.email) = ANY($1)`

	filas, err := d.pool.Query(ctx, sql, d.admins)
	if err != nil {
		return nil, fmt.Errorf("buscando destinatarios del aviso: %w", err)
	}
	defer filas.Close()

	tokens, err := pgx.CollectRows(filas, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("leyendo destinatarios del aviso: %w", err)
	}
	return tokens, nil
}

// Olvidar borra un token que el proveedor declaro muerto (FR-013).
//
// **Se limpia aca y en ningun otro momento.** Una direccion vieja no se detecta
// mirando una fecha —por eso no hay `push_token_visto_en`—: se detecta porque el
// proveedor la rechaza, que es el unico instante en que se sabe de verdad.
//
// Borra el token y **no toca la sesion**: que el telefono ya no reciba avisos no
// dice nada sobre si la credencial sirve. Revocar la sesion aca dejaria a Diego
// afuera de la app por haber reinstalado la app, que es exactamente al reves.
func (d *Destinatarios) Olvidar(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}

	const sql = `UPDATE sesiones SET push_token = NULL WHERE push_token = $1`

	if _, err := d.pool.Exec(ctx, sql, token); err != nil {
		return fmt.Errorf("olvidando un push token muerto: %w", err)
	}
	return nil
}
