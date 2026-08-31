# Data model — `016` Quién recibió el paquete

## La migración `0006`, entera

Dos columnas **nullable** en `pedidos_estados`:

| Columna | Tipo | Nullable | Qué guarda |
|---|---|---|---|
| `receptor_nombre` | `text` | sí | Quién recibió el paquete, tal como Diego lo declara |
| `receptor_documento` | `text` | sí | Su cédula, **tal como Diego la escribe** (research D5) |

**Nullable no es una comodidad, es la corrección del error del 2026-08-12.** Esa
vez una migración entró `entrega_punto` como `NOT NULL` sobre una tabla que se
creía vacía, producción tenía filas, y el servicio **no arrancó**. Una columna
nullable no le exige nada a las filas que ya están — y `pedidos_estados` tiene
filas reales desde que Diego usa la app.

**Solo tienen sentido en las filas de `entrega`.** No se agrega un `CHECK` que lo
imponga, y es deliberado: la restricción sería `estado <> 'entrega' → columnas
nulas`, que suena prolija y convierte cualquier error de escritura futuro en un
fallo de la transacción entera en vez de un dato raro visible. En una tabla que
existe para **no perder el registro**, fallar es peor que guardar de más.

## Lo que NO cambia, y hay que poder verificarlo

- **La tabla `pedidos`.** Ni una columna. Es la que tiene los datos reales y la
  que ya tumbó producción una vez.
- **El `CHECK` de `estado`**, en las dos tablas. No entra ningún estado nuevo.
- **El índice `pedidos_estados_pedido_idx`** sobre `(pedido_id, ocurrido_en)`,
  que `012` creó para leer "todo lo que le pasó a este pedido, en orden". Este
  feature lo usa para leer el **último** cambio a `entrega` de cada pedido
  (research D3), que es exactamente la forma que ese índice sirve. **No hace
  falta un índice nuevo.**
- **`precio`, `zona_id`, `paquete_tamano` y `retiro_hora`** siguen guardando lo
  que guardan, incluido el relleno que `013` y `014` les dejaron. Nada de este
  feature los lee.

## Las dos formas de la respuesta

Es el punto donde este feature se rompe si alguien se distrae, así que va acá
además de en `contracts/`.

| Quién pregunta | Qué recibe |
|---|---|
| El cliente (`GET /pedidos`) | quién recibió: **el nombre** |
| Diego (`GET /admin/pedidos`) | quién recibió: **el nombre y el documento** |

**Hoy los dos devuelven la misma estructura**, así que esto no es "agregar un
campo": es partir un tipo en dos. El del cliente es el default y el del admin es
el que hay que nombrar a propósito — research D1 explica por qué en ese orden y
no al revés.

## Lo que se guarda cuando recibe quien tenía que recibir

**El nombre del destinatario, copiado**, no una marca de "el mismo" (research
D4). Dentro de seis meses, leer el historial tiene que contestar *quién recibió*
sin ir a buscar cómo se llamaba el destinatario del pedido en ese momento — que
además pudo haber cambiado desde entonces.

## Los pedidos que ya existen

Los entregados antes de este feature **no tienen receptor**, y sus filas de
`pedidos_estados` quedan con las dos columnas en nulo. Eso no es un dato
faltante que haya que rellenar: es la verdad —no se registró— y las pantallas lo
tratan como tal, no mostrando nada en vez de mostrando un hueco (FR-011).
