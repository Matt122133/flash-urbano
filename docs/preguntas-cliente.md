---
owner: flash-urbano
status: living
last_reviewed: 2026-08-08
update_trigger: on-client-answer
---

# Preguntas abiertas al cliente

Lo que hace falta que conteste Diego. Vive acá y no solo en su Google Doc,
porque el doc no está versionado y porque una respuesta suya suele cambiar un
requisito, no una pantalla.

**Cómo se usa**: cuando conteste, se traslada la respuesta al spec o al ADR que
corresponda, se marca la fila como respondida con la fecha, y se deja el
razonamiento en el artefacto que la consume. Esta tabla no es la fuente de
verdad de nada — es la lista de lo que falta.

La que bloqueaba de verdad el spec del backend —quién puede pedir— **ya está
contestada**. Las dos que quedan abajo tienen un valor asumido que el cliente
todavía no confirmó: no impiden escribir el spec, pero si las contesta distinto
cambian comportamiento, no una pantalla.

## Bloqueantes

| # | Tema | Pregunta |
|---|---|---|
| 4 | Cancelaciones | ¿Un cliente puede cancelar un pedido que ya cargó? ¿Hasta qué momento? **Asumido por ahora: no se puede.** |
| 5 | Si no hay nadie | Cuando llega a retirar y no lo atiende nadie, ¿qué pasa? ¿Se reprograma, se cancela, se cobra igual? **Asumido por ahora: lo resuelve él llamando por teléfono, el sistema no se entera.** |

## No bloqueantes

| # | Tema | Pregunta |
|---|---|---|
| 6 | Código de pedido | Cada pedido va a llevar un código corto tipo **FU-0142** para poder referirse a él por WhatsApp. ¿Le sirve así o prefiere otro formato? |
| 7 | El panel | Al abrir la lista de pedidos del día, ¿qué necesita ver de cada uno **sin entrar**? Ordenados por importancia. |
| 8 | Comprobante | ¿Quiere poder **sacar una foto** al entregar como constancia? Cambia dónde se guarda la información: las fotos no van en la base de datos. |
| 9 | Estadísticas | Del dashboard: ¿qué números le sirven de verdad? ¿Paquetes por día, por zona, por cliente, facturado por mes? |
| 10 | Cobro | Se sacó el campo de forma de pago del formulario. ¿Cómo cobra hoy en la práctica — al retirar, al entregar, por transferencia después? |
| 11 | Volumen | ¿Cuántos paquetes mueve por día hoy, más o menos? Y en un día bueno. |

## Respondidas

| # | Tema | Respuesta | Fecha |
|---|---|---|---|
| 12 | Dominio | **Aprobado, con tope de USD 20 al año.** Se compra `flashurbano.uy` —está libre— a través de hostingmontevideo.com, agente registrador acreditado, a **USD 9.85 + IVA ≈ USD 12 el primer año**. El titular tiene que ser Diego, no quien lo registra. Descartado el canal directo de nic.uy (SeCIU/UdelaR), que cobra USD 25 al año por el mismo dominio y se pasa del tope. Descartado `flashurbano.com`: está tomado desde 2025-07-07 y parkeado para reventa. **Renovación confirmada el 2026-08-08: USD 13.50 al año** desde el segundo. Entra en el tope incluso si a ese precio hay que sumarle IVA (USD 16.47). El titular tiene que quedar a nombre de Diego desde el alta: cambiarlo después es un trámite que nic.uy cobra USD 33, más caro que el dominio. | 2026-08-08 |
| 1 | Quién puede pedir | **Confirmada la lectura del ADR.** Cotizar queda abierto: cualquiera entra, pone calle y esquina y ve el precio sin cuenta. Crear el pedido exige estar logueado, con cuenta de Google o con un registro en el sistema propio. No hay pedido anónimo y no hay aprobación manual de Diego. **Consecuencia que hay que resolver aparte: elimina el pedido como invitado, que la constitución todavía nombra en *Scope boundaries*.** | 2026-08-08 |
| 2 | Alta de clientes | Autogestionada. Diego no aprueba a nadie. | 2026-08-06 |
| 3 | Estados del pedido | Tres: creación → aceptación → entrega. **Confirmación se cae.** Puede cambiar; por eso la columna es texto con `CHECK` y no un enum. | 2026-08-06 |
| — | Plazo de entrega | 24 horas contadas **desde el retiro**. Textual del cliente. | 2026-08-06 |
| — | Nombre de quien recibe | **Sí hace falta** al momento de pedir. La cédula no. Revierte parcialmente una decisión de `004`; ver `specs/005-nombre-destinatario/`. | 2026-08-06 |
| — | Zona sobre un límite | Paga **la zona de menor costo**. Implementado en `004`. | 2026-08-06 |
| — | WhatsApp | `092 171 791` (se publica) y `091 060 320` (no se publica). | 2026-08-06 |
