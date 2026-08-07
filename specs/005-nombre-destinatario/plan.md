---
ticket: none
status: completed
covers:
  - web/components/pedido-form.tsx
  # La enmienda 2.1.0 dejó escrito que de quien recibe se pide solo el teléfono.
  # Con el nombre de vuelta, esa línea queda desactualizada (FR-006).
  - .specify/memory/constitution.md
  # spec-kit escribe acá cuál es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-06
---

# Implementation Plan: Nombre de quien recibe el paquete

**Feature dir**: `specs/005-nombre-destinatario` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

## Summary

Un campo. `004` sacó el nombre y la cédula de quien recibe; el cliente aclaró
después que el nombre sí hace falta. Vuelve el nombre, antes del teléfono. La
cédula no.

El plan es corto pero no trivial, por un motivo concreto: **el campo que vuelve
es exactamente el que cargaba el defecto** de
`docs/tech-debt-tracker.md` — `validate()` escribía `recieverName` y el render
leía `errors.receiverName`, así que el error nunca se mostraba y el formulario se
negaba a enviarse sin decir por qué. Sobrevivió dos features. Reponer el campo
sin cuidado es reponer el defecto.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.12, React 19.2.4. Sin cambios.

**Primary Dependencies**: ninguna nueva.

**Storage**: ninguna. Sitio estático; el estado del formulario vive en memoria.

**Testing**: Vitest 4. `pedido-form.tsx` no tiene pruebas y este plan **no las
agrega** — montarle un entorno de DOM es un feature aparte, no un paso de este.
La verificación del campo es manual y está en los pasos de ejecución.

**Target Platform**: navegadores de teléfono primero. Export estático en GitHub
Pages.

**Scale/Scope**: un archivo de código y una línea de la constitución.

## Constitution Check

**Principio I (visual-first)**: cambio visible en la superficie que el cliente
está revisando. **Pasa.**

**Principio II (autogestión)**: suma un campo obligatorio, o sea que agrega
fricción. Se acepta porque el dato lo pidió el cliente y sin él el repartidor
llega a una puerta sin saber a nombre de quién va el paquete. **Pasa.**

**Principio III (simplicidad)**: sin dependencias, sin abstracciones. **Pasa.**

**Principio IV (mobile-first)**: un campo de texto más. El costo es real y
está aceptado arriba. **Pasa.**

**Principio V (el sitio cotiza)**: no toca el precio ni las zonas. **N/A.**

**Enmienda**: la sección *Scope boundaries* dice hoy que de quien recibe se pide
un teléfono, porque la enmienda 2.1.0 se escribió el 2026-08-06 con la
información que había. Ahora son nombre y teléfono. Corresponde **bump MINOR
(2.1.0 → 2.2.0)**: cambia el alcance, no se reversa ningún principio, y no lleva
ADR porque es el cliente ajustando su propio brief — el mismo razonamiento que
`004`.

**Plan-bounded change (harness)**: `covers:` nombra los tres prefijos. **Pasa.**

**Verified before done (harness)**: `verify:` es el mismo de siempre. **Pasa.**

Sin violaciones que justificar.

## Project Structure

```text
web/components/pedido-form.tsx     # El campo, su validación y su fila del resumen
.specify/memory/constitution.md    # Scope boundaries + versión 2.2.0
```

**Structure Decision**: sin cambios. `ARCHITECTURE.md` ya describe a
`pedido-form.tsx` como el archivo que se toca cuando cambia el brief del
cliente, que es exactamente lo que pasa acá.

## Enfoque de ejecución

**Primero, el campo.** En `FormState` e `INITIAL_STATE` entra `receiverName`.
En el render, un `<Field>` nuevo **antes** del teléfono, dentro de la misma
grilla de dos columnas que ya existe.

**Segundo, la validación, con cuidado.** La regla es la misma que la del nombre
de quien envía: no vacío después de `trim()`. Lo que importa es la clave:
`errors.receiverName` escrita **igual** en `validate()` y en el `<Field>`. Se
verifica a ojo antes de seguir, comparando las dos líneas — el defecto anterior
era exactamente esto y pasó desapercibido dos features seguidas.

**Tercero, el resumen.** La fila del destinatario pasa a mostrar el nombre y el
teléfono.

**Cuarto, la constitución.** *Scope boundaries* a "nombre y teléfono de quien
recibe", versión 2.2.0, y la entrada en el historial de enmiendas explicando que
`004` sacó los dos datos y el cliente después repuso uno.

**Quinto, verificar.** `verify:` verde, y a mano: dejar el nombre vacío, tocar
Confirmar, **ver el mensaje**. Ese paso no es opcional; es el único que
distingue este plan de haber repuesto el defecto.

## Riesgos

**El defecto que vuelve sin que nadie lo note.** Es el riesgo central y por eso
el plan lo nombra tres veces. `pedido-form.tsx` no tiene pruebas, así que nada
automático lo va a atrapar. La guarda es mirar las dos líneas y probarlo a mano.

**La deuda de fondo sigue abierta.** Las claves de error del formulario no están
tipadas contra los campos — es la fila `Low` del 2026-08-06 en el tracker. Este
plan **no la paga**: tiparlas es refactorizar el formulario entero, que cae fuera
de sus pasos. Lo que hace es no empeorarla.

## Complexity Tracking

Sin violaciones. Nada que justificar.
