# Data Model: Que Diego se entere del pedido cuando entra

Este feature agrega **una columna**. No hay tabla nueva, no hay entidad nueva y
no hay registro de dispositivos: hay una dirección de entrega para un mensaje.

## Migración `0008_aviso_de_pedido_nuevo.sql`

```sql
ALTER TABLE sesiones
    ADD COLUMN push_token text;
```

Nullable y sin `DEFAULT`, por el mismo argumento que escribió `0007` para la
versión: **la mayoría de las filas de `sesiones` nunca van a tener token**. Las
sesiones del sitio web no lo tienen y no lo van a tener nunca, y una sesión
recién creada no puede afirmar un token antes de que la app haya hablado.

### Por qué en `sesiones` y no en una tabla de dispositivos

Porque lo que hay que contestar es **"¿a quién le mando este aviso?"**, y la
respuesta es *"a las sesiones vivas de un administrador"*. Eso es una consulta
sobre `sesiones`, sin `JOIN` con nada nuevo.

Una tabla `dispositivos` agregaría identidad propia a un teléfono —cuándo se vio
por primera vez, qué modelo, qué historial— que es exactamente lo que FR-012
prohíbe, y crecería para responder algo que hoy tiene **una sola** respuesta.

### Qué pasa cuando la sesión se revoca

**Deja de recibir avisos, sin código que lo implemente.** Es la consecuencia más
valiosa de guardar el token acá:

- `Resolver` sólo escribe sobre filas con `revocada_en IS NULL AND expira_en >
  now()`.
- La consulta de destinatarios filtra por lo mismo.

Así que el procedimiento de teléfono perdido que ya existe en
`docs/processes/app-repartidor.md` —revocar la sesión a mano en la base— corta
los avisos como efecto colateral. FR-007 y SC-008 salen de ahí.

## Campos

| Campo | Tipo | Nulo | Qué es |
|---|---|---|---|
| `push_token` | `text` | sí | La dirección a la que el proveedor entrega el aviso. Cambia cuando la app se reinstala, cuando el proveedor la renueva, o cuando Diego cambia de teléfono. |

**No se agrega `push_token_visto_en`.** La versión sí llevaba su marca de tiempo
porque la pregunta era *"¿ya actualizó?"*, que necesita saber **cuándo** se vio.
Acá la pregunta es *"¿a dónde mando?"*, y una dirección vieja no se detecta
mirando una fecha: se detecta porque **el proveedor la rechaza**, que es lo que
FR-013 usa para limpiarla.

### Validación antes de escribir

Igual que la cabecera de versión: largo acotado y forma esperada **antes** de
tocar la base, en `internal/httpx`. Un token con basura no puede convertirse en
el fallo de la consulta que resuelve la sesión — o sea, en Diego sin poder
trabajar por un defecto en el instrumento que existe para avisarle.

**Sin `CHECK` en la base**, por lo mismo que argumentó `0007`.

## La escritura, y la trampa que la rodea

El token se escribe **dentro del `UPDATE ... RETURNING` que ya corre** en
`Resolver`, con la misma forma que la versión:

```sql
SET push_token = COALESCE(NULLIF($3, ''), push_token)
```

**El `COALESCE` no es opcional.** El sitio web resuelve sesiones con esta misma
consulta y **no manda la cabecera**: sin él, cada vez que Diego entrara al sitio
desde el navegador le borraría el token a su propio teléfono, y los avisos
dejarían de llegar sin que nada fallara ni se registrara. Es el defecto más
barato de introducir de todo el feature y el más caro de diagnosticar; la prueba
que lo fija está nombrada en el plan y en el quickstart (Q7 de `017` es el
molde).

## La consulta que este modelo existe para permitir

```sql
SELECT s.push_token
  FROM sesiones s
  JOIN usuarios u ON u.id = s.usuario_id
 WHERE s.push_token IS NOT NULL
   AND s.revocada_en IS NULL
   AND s.expira_en > now()
   AND lower(u.email) = ANY($1)   -- las direcciones administradoras
```

**Devuelve varias filas, no una** (FR-018), y ese es el caso normal desde el día
uno: hay dos teléfonos con sesión administradora. Quien consuma esto recorre el
conjunto; asumir un único token es un defecto que empieza a doler el día que el
teléfono de prueba deja de ser el que avisa.

Las direcciones administradoras salen de `ADMIN_EMAILS`, **no de una columna**:
no hay columna de admin en esta base, a propósito, y `config.EsAdmin` es quien
sabe compararlas con la normalización correcta.

Una sesión puede tener un token que ya no sirve. Eso **no se limpia
preventivamente**: se limpia cuando el proveedor lo rechaza por vencido
(FR-013), que es el único momento en que se sabe de verdad.

## Lo que NO cambia

- **`pedidos` no gana ninguna columna.** El pedido gana un efecto al ser creado,
  no un campo. No hay `avisado_en`: quién fue avisado y cuándo es una pregunta
  del registro, no del modelo (FR-014), y agregar la columna obligaría a
  escribirla en el camino de la respuesta, que es justo lo que D3 saca de ahí.
- **`usuarios` no cambia.**
- **No hay tabla de avisos enviados.** Con este volumen sería un histórico que
  crece por pedido para responder algo que se responde con el registro.
