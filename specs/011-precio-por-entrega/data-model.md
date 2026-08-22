# Data Model: El precio sale de la entrega

**Feature**: `011-precio-por-entrega` | **Fecha**: 2026-08-22

Lo que cambia de forma, y lo que sólo cambia de significado. La segunda lista es
la peligrosa: son campos que siguen llamándose igual y ya no quieren decir lo
mismo.

---

## 1. `pedidos` — la tabla

### Columnas que cambian

| Columna | Antes | Después | Por qué |
|---|---|---|---|
| `entrega_punto` | **no existe** | `geography(Point,4326)` **`NOT NULL`** | De acá sale la zona y el precio (FR-001, FR-007) |
| `retiro_punto` | `geography(Point,4326)` **`NOT NULL`** | `geography(Point,4326)` **nullable** | Deja de decidir plata y puede faltar (FR-012, FR-015) |

**El comentario del esquema sobre `retiro_punto` deja de ser cierto** y se
reemplaza en la misma migración. Hoy dice, textual: *"sin punto no hay zona, sin
zona no hay precio, y sin precio no hay pedido"*. Después de `011` la frase
describe a `entrega_punto`, y dejarla donde está es peor que no tener comentario:
un lector la va a creer.

### Columnas que NO cambian de forma pero SÍ de significado

| Columna | Sigue siendo | Ahora quiere decir |
|---|---|---|
| `zona_id` | `smallint NOT NULL` | La zona de la **entrega**. Antes era la del retiro. |
| `precio` | `integer NOT NULL` | El precio de esa zona. El monto congelado no cambia de naturaleza, sí de origen. |

**Los pedidos anteriores a `011` no se corrigen** y quedan con `zona_id` y
`precio` calculados sobre el retiro. Son ocho filas locales de prueba y se
recrean; en producción no hay ninguna. **Si alguna vez hubiera datos reales
previos, esta tabla se vuelve ambigua sin una columna que diga qué regla se
aplicó** — no es el caso hoy, y por eso no se construye.

### Índices

Ninguno nuevo. `entrega_punto` no se consulta espacialmente: el servicio **no
resuelve zonas** (FR-010), sólo guarda el punto. Un índice GiST acá sería
infraestructura para una consulta que nadie hace (Principio III).

---

## 2. `usuarios` — la tabla

**No cambia.** `usuarios.retiro_punto` ya es nullable, y por FR-016 *Mi cuenta*
conserva su mapa y sigue guardando el punto que la persona confirma a mano.

Lo que sí cambia es **cuánto vale ese dato**: pasa de ser una comodidad de
precarga a ser **la única fuente de coordenadas de retiro confirmadas por una
persona**. Todo lo demás se resuelve en silencio o falta.

---

## 3. El cuerpo de `POST /pedidos`

**No cambia de forma** (research D3). `Direccion` es un solo tipo compartido por
las dos direcciones y ya lleva `Punto *Punto` con `omitempty`.

| Campo | Antes | Después |
|---|---|---|
| `retiro.punto` | obligatorio | **opcional** |
| `entrega.punto` | nunca se mandaba | **obligatorio** |

Las dos guardas que hoy exigen `retiro.punto` —`handlers.go:209` y
`pedido.go:212`— se mudan a `entrega.punto` (research D4).

---

## 4. `PedidoGuardado` en el navegador

`web/lib/api.ts` documenta hoy: *"El punto solo lo tiene el retiro. La entrega
quedo como texto en `003`"*. Esa frase se invierte, y el tipo pasa a llevar punto
opcional en las dos direcciones: la entrega lo tiene siempre de acá en adelante,
el retiro puede no tenerlo, y **los pedidos viejos tienen exactamente lo
contrario**. Un tipo que admita ambos es lo único que describe la realidad de la
tabla.

---

## 5. Las dos formas del formulario

| Estado | Antes | Después |
|---|---|---|
| `retiro.direccion.punto` | Lo que se cobra | Se guarda si se resuelve solo; no decide nada |
| `entrega.direccion.punto` | Siempre `null` | Lo que se cobra |
| `retiro.esquina` | Cruce resuelto, obligatorio | Cruce resuelto **si no hay ambigüedad**, opcional |
| `entrega.esquina` | Siempre `null` | Cruce resuelto, obligatorio |
| `retiro.candidatos` | Se muestran para elegir | **No se muestran**: ambiguo = sin punto (research D2) |
| `entrega.candidatos` | Vacío | Se muestran para elegir |

---

## 6. Lo que se rompe si esto se implementa a medias

Tres estados imposibles que el diseño tiene que impedir, y que valen como
criterio de revisión:

1. **Un pedido con precio y sin `entrega_punto`.** Sería un precio que nadie
   puede recalcular ni auditar. La columna `NOT NULL` lo impide en la base; la
   guarda del handler lo impide antes, con un mensaje legible.
2. **Un pedido cuyo `precio` no corresponde a la zona de su `entrega_punto`.** El
   servicio no recalcula (FR-010), así que **la base no lo puede impedir**: lo
   impide que el navegador tenga una sola fuente de precio, que es
   `resolverZona(entrega.punto)`. Cualquier segunda vía de cálculo reintroduce la
   posibilidad.
3. **Un punto de retiro tratado como si cobrara.** Es el residuo de `007`
   (research D6). Si sobrevive una guarda que descarta el punto de retiro por
   "no cobrar sobre un punto viejo", el formulario va a rechazar direcciones
   válidas por una razón que dejó de existir.
