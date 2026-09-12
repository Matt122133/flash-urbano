# Data Model: El tablero de Diego

**No hay migración.** El feature no agrega tablas, columnas ni índices: lee dos
columnas de `pedidos` y tres de `usuarios` que existen desde `0001` y `0003`.

## Lo que se lee de la base

| Tabla | Columna | Para qué | Nota |
|---|---|---|---|
| `pedidos` | `creado_en` | La fecha con que se corta (FR-005a) | `timestamptz`, `NOT NULL`. Nunca cambia: `022` edita el pedido pero no esta columna. |
| `pedidos` | `cantidad` | La columna *paquetes* (FR-008) | `integer`, `CHECK (cantidad > 0)`. |
| `pedidos` | `usuario_id` | A qué cuenta pertenece (FR-009) | `NOT NULL`, FK a `usuarios`. |
| `usuarios` | `id` | Identidad del cliente | |
| `usuarios` | `nombre` | Rótulo del selector | **Nulable**: un alta a medias no tiene nombre (D6). |
| `usuarios` | `email` | Distingue homónimos (US3-4) | `NOT NULL UNIQUE`. |

**Lo que NO se lee, y está prohibido**: `pedidos.precio` (FR-013, Principio V),
`pedidos.zona_id` (no hace falta, y es la mitad de la ficción de `precio`), y
cualquier dato personal de los pedidos: remitente, destinatario, direcciones,
receptor. Tampoco `pedidos.retiro_fecha`: el corte **no** es por retiro
(§ Clarifications, 2026-09-11).

**Ningún filtro por estado ni por cuenta** (FR-004b, FR-005a): se leen todas las
filas de `pedidos`.

## Lo que viaja: dos listas

Ver el contrato completo en [contracts/tablero.md](contracts/tablero.md).

### Carga (una por pedido)

| Campo | Tipo | Origen |
|---|---|---|
| `creadoEn` | instante RFC 3339 | `pedidos.creado_en` |
| `cantidad` | entero ≥ 1 | `pedidos.cantidad` |
| `clienteId` | UUID | `pedidos.usuario_id` |

Sin `id` ni `codigo` del pedido: el tablero cuenta, no identifica pedidos.

### Cliente (una por cuenta)

| Campo | Tipo | Origen |
|---|---|---|
| `id` | UUID | `usuarios.id` |
| `nombre` | texto o `null` | `usuarios.nombre` |
| `email` | texto | `usuarios.email` |

## Lo que se calcula en el navegador (`web/lib/tablero.ts`)

No es dato guardado; es cómo se mira (spec, *Key Entities*: **Período**).

- **Corte**: `"dia" | "semana" | "mes"`. Por defecto `"mes"` (D11).
- **Período**: una clave y un rótulo, en fecha de Montevideo (D3, D4).
  - día → `2026-09-10` / *jue 10 sep 2026*
  - semana → el lunes, `2026-09-07` / *lun 7 sep – dom 13 sep 2026*
  - mes → `2026-09` / *septiembre 2026*
- **Fila**: `{ periodo, pedidos, paquetes }`. `pedidos` es la cantidad de cargas
  del período; `paquetes` es la suma de su `cantidad`.
- **Resumen**: `{ registrados, filas }` para un corte y un cliente opcional.

### Invariantes (son las pruebas de `web/lib/tablero.test.ts`)

1. **La suma de `pedidos` de las filas es igual a `registrados`**, en los tres
   cortes y con o sin cliente (FR-005a, US2-2).
2. **`paquetes ≥ pedidos` en toda fila**, y **`>` en cuanto un pedido del
   período lleva más de un paquete** (SC-002a). Si fueran siempre iguales, se
   estaría contando pedidos dos veces.
3. **Sin huecos**: del período del primer pedido al período de "hoy", cada
   período aparece una vez, en orden descendente (D5). El rango no depende del
   cliente elegido.
4. **Un instante de las 22:00 de Montevideo cae en ese día** —que en UTC ya es el
   siguiente— (SC-006, FR-007). **Probado con el proceso en otra zona**: si la
   prueba corre con la zona de la máquina, que está en Montevideo, una
   implementación que use la zona local también la pasa (tasks T022).
5. **La semana empieza el lunes**: un domingo cae en la semana del lunes
   anterior, no en la siguiente.
6. **Con un cliente elegido, solo cuentan sus cargas**, y un cliente sin cargas
   da todas las filas en cero y `registrados = 0` (FR-011).
7. **Sin ninguna carga**: `registrados = 0` y **una sola fila, la del período
   actual, en cero**. Sin primer pedido, el rango empieza y termina hoy. Así la
   pantalla muestra ceros (FR-015) y no una tabla vacía, que se lee como una
   pantalla rota.
8. **"Hoy" entra por parámetro**, como en `lib/fechas.ts`: la prueba no depende
   del día en que corre.
