# Data Model: El precio vuelve, del lado de adentro del login

**Feature**: `024-precio-detras-del-login` | **Fecha**: 2026-09-10

## Lo primero, porque cambia cómo se lee el resto

**Este feature no toca el dato.** No hay migración, no hay columna nueva, el
cuerpo de `POST /pedidos` no cambia de forma y la respuesta del servicio sigue
igual. Lo único que este documento modela es **una decisión de presentación** y
las entidades que ya existen, para dejar dicho qué se lee y qué no.

## Entidades existentes

### `Zona` (`web/lib/zonas.ts`, generado)

| Campo | Tipo | Qué hace en este feature |
|---|---|---|
| `id` | `1..5` | Sin cambios. |
| `nombre` | `string` | Ya se muestra hoy; sigue mostrándose **a todo el mundo**. |
| `precio` | `number` | **Vuelve a leerse para mostrar**, y solo con sesión. Pesos uruguayos, monto fijo por envío: no se multiplica por cantidad de paquetes ni por tamaño. |
| `color` | `string` | Sin cambios. |
| `anillo` | `[number, number][]` | Sin cambios. |

**Regla de negocio que este feature vuelve visible sin cambiarla**: cuando dos
zonas contienen el mismo punto, gana la de **menor precio** (respuesta del
cliente del 2026-08-06); el `id` solo desempata precios iguales. Esa regla no
tuvo efecto visible desde `013` y vuelve a tenerlo ahora. **No se toca**:
cambiarla alteraría qué `zona_id` se guarda, y este feature es de presentación.

### `Pedido` (columna `precio` en Postgres)

| Campo | Qué hace en este feature |
|---|---|
| `precio` | **Nada. No se lee.** Sigue calculándose en el navegador, viajando en el alta y guardándose, exactamente como desde `013`. |

**Por qué no se lee, y es normativo**: la columna registra lo que la regla del
día habría cobrado. Para pedidos anteriores al 2026-08-22 se calculó desde la
zona de **retiro**, así que nunca fue el precio de ese envío bajo las reglas de
hoy. El Principio V lo prohíbe explícitamente y **6.0.0 no levantó una sola
palabra de esa prohibición**. Todo monto que se muestra está **recalculado**.

## Entidad nueva: la decisión de visibilidad

No es dato persistido: es una función pura, y es la única parte del feature con
prueba automática posible (research D3).

**`web/lib/precio-visible.ts`**

Entradas:

| Entrada | Tipo | Significado |
|---|---|---|
| `zona` | `Zona \| null` | La zona resuelta desde el punto de **entrega**. `null` si no hay punto o si cae fuera de las cinco. |
| `conSesion` | `boolean` | Si hay sesión confirmada. El estado **sin resolver** entra acá como `false` (FR-005a). |

Salida: `number | null` — el monto a mostrar, o `null` si no se muestra ninguno.

Reglas, y las cuatro son requisitos:

| `zona` | `conSesion` | Salida | Requisito |
|---|---|---|---|
| una zona | `true` | `zona.precio` | FR-001, FR-003 |
| una zona | `false` | `null` | FR-001, FR-013 |
| `null` | `true` | `null` | FR-002 |
| `null` | `false` | `null` | FR-002, FR-013 |

**La tabla se lee en una frase**: hay monto si y solo si hay zona **y** hay
sesión. Está escrita como tabla igual, porque es lo que la prueba recorre.

**Invariante que la prueba tiene que sostener con un control positivo**: la fila
1 devuelve un número. Sin esa fila, una implementación que devuelva `null`
siempre —o sea, el feature sin construir— pasa las otras tres en verde.

## Estados y transiciones (lo que ve la persona)

| Estado | Zona nombrada | Monto |
|---|---|---|
| Sin punto de entrega resuelto | No | No |
| Punto fuera de las cinco zonas | No (se encamina al contacto) | No |
| Punto en zona, sesión sin resolver | **Sí, de inmediato** | No |
| Punto en zona, sin sesión | Sí | No |
| Punto en zona, con sesión | Sí | **Sí** |
| Punto en zona, con sesión, y la sesión vence | Sí | Desaparece |

La tercera fila es FR-005a y es la que no es obvia: **la confirmación de
cobertura no espera a la sesión**, porque no depende de ella y hoy es
instantánea. Solo el monto espera.
