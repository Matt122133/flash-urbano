# Phase 1 — Data model

No hay base de datos. "Modelo de datos" acá significa **la forma del estado del
formulario en memoria** (`FormState` en `web/components/pedido-form.tsx`) y las
entidades que ese estado consulta. Nada de esto se persiste: al recargar la
página se pierde, y por eso quitar campos no arrastra migración ni
compatibilidad hacia atrás.

## Pedido

Lo que la persona carga. Este feature le saca seis campos y le agrega uno.

### Campos que quedan

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | texto | sí | Nombre y apellido, o razón social. |
| `phone` | texto | sí | Teléfono de quien envía. ≥8 dígitos tras descartar lo que no sea número. |
| `retiro` | dirección | sí | Calle, esquina, número, apto, cooperativa y **punto**. El punto sale del cruce y decide la zona y el precio. |
| `entrega` | dirección | sí | Calle, número y esquina. No resuelve punto y no afecta al precio. |
| `packageSize` | `chico` \| `mediano` \| `grande` | sí | Única forma de declarar qué se envía. |
| `quantity` | entero ≥ 1 | sí | Trae `1` puesto. |
| `pickupDate` | `YYYY-MM-DD` | sí | No puede ser un día anterior a hoy. |
| `pickupTime` | `HH:MM` | sí | |
| **`receiverPhone`** | texto | sí | **NUEVO.** Teléfono de quien recibe. Misma validación que `phone`. |

### Campos que se van

| Campo | Por qué |
|---|---|
| `clientType` | El cliente lo pidió: no cambia nada de lo que pasa después. |
| `packageMode` | Existía solo para elegir entre tamaño y descripción. Sin descripción no hay nada que elegir. |
| `packageDescription` | El cliente ya la había marcado como no necesaria en el relevamiento original; se implementó igual en `001`. Confirmado de nuevo el 2026-08-06. |
| `paymentMethod` | El cliente lo pidió. Las opciones que había (Efectivo, Transferencia) nunca las confirmó nadie: eran placeholder. |
| `deliveryDate` | Reemplazado por el compromiso fijo de 24 horas desde el retiro. |
| `deliveryTime` | Íd. |
| `recieverName` | La identificación de quien recibe se captura en la app Android al entregar, no en la web al pedir. |
| `recieverCI` | Íd. Además es un dato sensible que hoy se junta sin usarlo para nada. |

### Derivados, nunca guardados

Sin cambios respecto de `003`, y vale repetirlo porque es la parte que decide la
plata:

- **`zona`** y **`precio`** se recalculan desde `retiro.direccion.punto` en cada
  render y en la pantalla de confirmación. No viven en el estado, para que no
  puedan quedar desincronizados del punto.
- **La región de arrastre** se deriva de la esquina resuelta.

### Lo que ya no se deriva

El **compromiso de entrega** es texto fijo, igual para todo pedido. No se
calcula desde `pickupDate`/`pickupTime` ni desde ningún otro lado (FR-009a). No
es un campo del modelo: es una constante de la interfaz.

## Zona

Una de las cinco áreas de cobertura. **El dato no cambia** — `web/lib/zonas.ts`
lo genera `design-source/build-zonas.js` desde el KML del cliente y no se toca.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | 1..5 | |
| `nombre` | texto | "Zona 1" … "Zona 5". |
| `precio` | entero | 150, 200, 250, 250, 350 respectivamente. |
| `color` | texto | Para el mapa. |
| `anillo` | lista de `[lat, lng]` | Polígono cerrado. |

Lo que cambia es **la relación entre un punto y una zona cuando hay más de una
candidata**: los polígonos comparten bordes, así que un punto sobre una avenida
límite satisface a dos. Hasta hoy ganaba la primera de la lista; desde este
feature gana la de menor `precio`, con el `id` más bajo como desempate. Ver
[`contracts/zona-lookup.md`](contracts/zona-lookup.md).

Nótese que `precio` deja de ser un atributo puramente informativo y pasa a
**participar en la selección**. Es la única consecuencia estructural del feature:
si mañana se agrega un campo de precio por temporada o un descuento, la regla de
desempate tiene que decir contra cuál de los dos compara.
