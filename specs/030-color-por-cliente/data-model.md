# Data model: El color de cada cliente en la tarjeta

## `usuarios.color` (migración `0010_color_de_cliente.sql`)

| Campo | Tipo | Nulable | Regla |
|---|---|---|---|
| `color` | `text` | **sí** | `CHECK (color ~ '^#[0-9a-f]{6}$')`, índice único parcial `WHERE color IS NOT NULL` |

- **Nulable, sin default y sin relleno.** Las filas que existen quedan en
  `NULL` (FR-006). Es la misma lección de `0006` y `0009`: una columna
  `NOT NULL` sobre una tabla con filas es como el servicio no arrancó el
  2026-08-12.
- **Minúsculas y con `#`, forzado por el `CHECK`.** `#C026D3` y `#c026d3` serían
  el mismo color guardado dos veces y el índice único no los vería iguales. La
  normalización la exige la base, igual que el `email = lower(email)` de `0001`.
- **Único** (FR-004b). Parcial porque `NULL` no es un color.
- Se escribe una sola vez: en la transición `perfil_completo false → true`
  (research D4), o a mano (D6). **Nada del código lo sobrescribe.**

## `Pedido` (Go) → `ParaAdmin.colorCliente`

- `desdePedidos` suma un `LEFT JOIN LATERAL (SELECT color AS color_cliente
  FROM usuarios WHERE usuarios.id = pedidos.usuario_id) c ON true`, y
  `columnas` suma `c.color_cliente` al final. **LATERAL con una sola columna y
  no un JOIN plano**, cambio hecho al implementar: `usuarios` también tiene
  `id`, `creado_en`, `actualizado_en` y los cinco `retiro_*`, y un JOIN plano
  las volvía ambiguas en todas las consultas.
- `Pedido` gana un campo **no exportado** `colorCliente *string`, sin etiqueta
  JSON, igual que `recibioDocumento`.
- `ParaAdmin` gana `ColorCliente *string` con la etiqueta
  `json:"colorCliente,omitempty"`. Si es nulo, la clave no viaja.

## `Pedido` (Kotlin)

- `val colorCliente: String? = null`. Nulable con default, por la misma razón
  que `comentario` y `punto`: la clave puede no venir.
- `colorDeCliente(hex: String?): Long?` (pura). Devuelve `0xFFrrggbb` sólo para
  `#rrggbb` válido (en mayúsculas o minúsculas), y `null` para cualquier otra
  cosa.

## Paleta (Go, paquete nuevo `backend/internal/colores`)

- `var Lista = []string{...}`: los siete de research D2, en ese orden. **Agregar
  un color es agregar una línea**, y la prueba del paquete rechaza el que no
  cumpla las reglas.
- `Elegir(asignados []string) (string, bool)`: research D3. Pura, determinista
  y sin base de datos. `false` sólo si no queda ningún candidato libre, cientos
  de cuentas después; en ese caso la cuenta queda sin color en vez de repetir
  uno.
- `Valido(hex string) error`: las reglas de D2. La usan la prueba de la lista y
  el generador.
