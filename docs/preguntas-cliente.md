---
owner: flash-urbano
status: living
last_reviewed: 2026-08-06
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

Las tres primeras **bloquean el spec del backend**. Las demás se pueden asumir
con un valor razonable y corregir después.

## Bloqueantes

| # | Tema | Pregunta |
|---|---|---|
| 1 | Quién puede pedir | Para que no le cargue un pedido alguien sin identificar, se le va a pedir a la gente que **entre con su cuenta de Google** o con un **código enviado por mail**: queda registrado quién es, y no se puede pedir de forma anónima. Cualquiera puede registrarse solo, sin que Diego apruebe. ¿Es lo que quiso decir, o prefiere habilitar él a cada cliente después de hablarle? Ver [ADR backend-persistence-stack](decisions/backend-persistence-stack.md) § *How that constraint is met*. |
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
| 12 | Dominio | Hace falta comprar un dominio propio (`flashurbano.uy` o similar), del orden de USD 25 al año. Sin él los códigos de acceso por mail caen en spam, porque no se puede mandar mail automático en nombre de una dirección `@gmail.com`. Además el sitio deja de estar en `matt122133.github.io`. ¿Lo compramos? |

## Respondidas

| # | Tema | Respuesta | Fecha |
|---|---|---|---|
| 2 | Alta de clientes | Autogestionada. Diego no aprueba a nadie. | 2026-08-06 |
| 3 | Estados del pedido | Tres: creación → aceptación → entrega. **Confirmación se cae.** Puede cambiar; por eso la columna es texto con `CHECK` y no un enum. | 2026-08-06 |
| — | Plazo de entrega | 24 horas contadas **desde el retiro**. Textual del cliente. | 2026-08-06 |
| — | Nombre de quien recibe | **Sí hace falta** al momento de pedir. La cédula no. Revierte parcialmente una decisión de `004`; ver `specs/005-nombre-destinatario/`. | 2026-08-06 |
| — | Zona sobre un límite | Paga **la zona de menor costo**. Implementado en `004`. | 2026-08-06 |
| — | WhatsApp | `092 171 791` (se publica) y `091 060 320` (no se publica). | 2026-08-06 |
