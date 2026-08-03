# Phase 1 — Data Model

**Feature**: `specs/002-mapa-zonas-precio` | **Date**: 2026-08-02

Sin base de datos ni persistencia: todo vive en el bundle (las zonas) o en el
estado de React (el pedido en curso). "Modelo" acá es la forma de esos datos y
las reglas que los validan.

---

## Zona

Constante generada desde el KML del cliente. **No se edita a mano**: se
regenera con `web/design-source/build-zonas.js`. Vive en `web/lib/zonas.ts`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `1 \| 2 \| 3 \| 4 \| 5` | Identificador estable. Fija además el orden de evaluación del desempate (D8). |
| `nombre` | `string` | Para mostrar: `"Zona 1"`. Normalizado — el KML trae `"Zona  4"` (FR-003). |
| `precio` | `number` | Pesos uruguayos, entero. Z1 150, Z2 200, Z3 250, Z4 250, Z5 350. |
| `color` | `string` | Hex, para diferenciar las zonas en el mapa y la leyenda (FR-006). |
| `anillo` | `[number, number][]` | Vértices `[lat, lng]`, cerrado (primero = último). |

**Invariantes** (los garantiza el generador, y el spec ya los verificó sobre el
archivo entregado):

- El anillo cierra: `anillo[0]` es igual a `anillo[anillo.length - 1]`.
- Las cinco zonas no se solapan; comparten bordes.
- Los cinco `id` son únicos y cubren 1–5.

**Origen normativo**: los polígonos son transcripción de las calles que definió
el cliente (`spec.md` § Límites de zona). Ante discrepancia, manda la calle.

---

## ResultadoZona

Lo que devuelve `resolverZona(lat, lng)`. No se almacena: se deriva del punto
cada vez.

| Campo | Tipo | Notas |
|---|---|---|
| — | `Zona \| null` | `null` significa **fuera de cobertura**, no "error" ni "todavía no sé". |

`null` es un resultado legítimo y tiene consecuencias definidas (FR-012): no se
muestra precio, no se asigna la zona más cercana, y como la ubicación es
obligatoria (FR-011), el pedido no se puede enviar.

---

## UbicacionRetiro

Estado del formulario. Se agrega a `FormState` en
`web/components/pedido-form.tsx`.

| Campo | Tipo | Notas |
|---|---|---|
| `lat` | `number \| null` | `null` = todavía no marcó. |
| `lng` | `number \| null` | Idem. |

La zona y el precio **no se guardan en el estado**: se derivan de `lat`/`lng`
llamando a `resolverZona`. Guardarlos abriría la puerta a que queden
desincronizados del punto, y son plata.

**Reglas de validación**:

- Enviar exige `lat`/`lng` no nulos **y** `resolverZona` distinto de `null`
  (FR-011, FR-012).
- Los mosaicos caídos bloquean el envío aunque haya punto marcado (FR-020).

---

## Domicilio

Nuevo en este feature. El pedido pasa a llevar **dos**, con los mismos campos
(FR-022, FR-023). Los de retiro ya existen en `FormState` — se renombran o se
rotulan como tales; los de entrega son nuevos.

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `calle` | `string` | Sí | |
| `numero` | `string` | Sí | Número de puerta. |
| `apto` | `string` | No | Único opcional, igual que en el milestone 001. |
| `esquina` | `string` | Sí | |
| `cooperativa` | `boolean` | Sí | Por defecto `false`. |

**Retiro** lleva además la `UbicacionRetiro` del mapa. **Entrega** no lleva
punto, no se resuelve a zona y no afecta el precio (FR-024).

---

## Pedido (delta sobre el milestone 001)

`specs/001-web-mvp/spec.md` § Key Entities define el Pedido. Este feature lo
cambia así:

| Cambio | Detalle |
|---|---|
| **Reinterpretado** | La dirección compuesta única pasa a ser explícitamente la de **retiro**. Mismos campos, rótulo distinto. |
| **Agregado** | `UbicacionRetiro` (lat/lng del punto marcado). |
| **Agregado** | Domicilio de **entrega** completo. |
| **Derivado** | Zona y precio, calculados desde la ubicación de retiro. Aparecen en la confirmación (FR-017); no se persisten porque nada se persiste. |
| **Sin cambios** | Cliente, teléfono, paquete, cantidad, fechas, forma de pago, quien recibe. En particular, cantidad y tamaño **no** entran en el precio (FR-015). |

---

## Estado del mapa (no es dato de dominio)

`mapa-zonas.tsx` maneja internamente si la fuente de mosaicos está disponible
(D7). Lo **reporta** hacia afuera en vez de decidir qué hacer, porque la
consecuencia cambia según la superficie: en el formulario bloquea el envío, en
`/sobre-nosotros` solo degrada a texto.

| Estado | Significado |
|---|---|
| `cargando` | Montado, sin veredicto todavía. |
| `ok` | Al menos un mosaico cargó. |
| `no-disponible` | Hubo errores y ningún mosaico cargó (FR-020). |
