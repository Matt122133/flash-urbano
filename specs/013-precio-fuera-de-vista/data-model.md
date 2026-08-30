# Data model — `013`

**El modelo de datos no cambia. Ese es el requisito, no una omisión.**

Este archivo existe porque en este feature "no cambia nada" es una afirmación
que hay que poder verificar, no una que se pueda dar por descontada. Un feature
que saca el precio de la vista invita a sacarlo también de la base, y la
decisión explícita fue la contraria (FR-015, FR-016; ver
[ADR price-not-shown](../../docs/decisions/price-not-shown.md) § Alternatives
considered).

## Lo que sigue exactamente igual

| Entidad | Dónde vive | Qué pasa |
|---|---|---|
| `Zona.precio` | `web/lib/zonas.ts` (generado) | **Se conserva.** El generador lo sigue emitiendo desde su tabla de precios en `design-source/build-zonas.js` |
| `cobro: { zonaId, precio }` | cuerpo de `POST /pedidos` | **Se conserva.** `lib/pedido.ts` lo sigue armando desde el punto, en el momento de confirmar |
| `pedidos.precio`, `pedidos.zona_id` | Postgres | **Se conservan.** Ninguna migración nueva. La `0004_precio_por_entrega.sql` queda como está |
| `Pedido.Precio`, `Pedido.ZonaID` | `backend/internal/pedidos/pedido.go` | **Se conservan**, se siguen escaneando y se siguen serializando en la respuesta |
| `Pedido.precio`, `Pedido.zonaId` | `android/.../datos/Pedido.kt` | **Se conservan**, se siguen parseando. La app nunca los dibujó |

## Lo único que cambia de forma

`web/lib/zonas.ts` se **regenera** desde el KML que el cliente reajustó. Los
tipos son los mismos; cambian diez vértices del anillo de la **Zona 5**, que se
achicó por el este. Ver research.md D5, que además deja una pregunta abierta
sobre si la lista autoritativa de calles de `002` quedó vieja.

`web/lib/repetir.ts` pierde `precioDeHoy()` y la comparación de precios, porque
su único consumidor —los avisos de reajuste— desaparece con FR-007. Eso es una
función que se borra, no una entidad que cambia: nada de lo que se guarda o se
transmite se ve afectado.

## La consecuencia que hay que tener escrita

Desde el día que esto sale, `pedidos.precio` guarda **lo que la regla vieja
habría cobrado, no lo que Diego cobra**. El Principio V, versión 5.0.0, prohíbe
leer esa columna para facturación, reportes o tableros: es una ficción que se
conserva únicamente para que la decisión se pueda revertir barato. Si alguna vez
se la lee para algo, eso es una decisión nueva y no un defecto.
