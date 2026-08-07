# Feature Specification: Nombre de quien recibe el paquete

**Feature Branch**: `nombre-destinatario`

**Created**: 2026-08-06

**Status**: Draft

**Input**: El cliente corrigió una decisión de `004`. Ese feature quitó del
formulario el **nombre** y la **cédula** de quien recibe el paquete, sobre la
base de que ambos datos se capturan en la app Android al momento de entregar.
Consultado de nuevo el 2026-08-06, el cliente aclaró que **el nombre sí hace
falta al pedir**. La cédula no.

## Contexto

`specs/004-ajustes-finales-mvp/spec.md` está en `status: completed` y **no se
reescribe**, igual que `001` no se reescribió cuando el ADR de precios cambió
una de sus decisiones. Este spec es el registro del cambio.

Lo que sigue siendo cierto de `004` y no se revierte:

- **La cédula no vuelve.** Es un dato sensible que al momento de pedir no se
  usa para nada, y quien recibe todavía no está identificado. Se captura en la
  app Android al entregar, si hace falta.
- El resto del formulario queda como lo dejó `004`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Se sabe a nombre de quién va el paquete (Priority: P1)

Hoy el formulario pide solamente el teléfono de quien recibe. Con eso se puede
coordinar la entrega, pero no se sabe **a quién** hay que entregarle. El
repartidor llega a una dirección con un número de teléfono y nada más. Vuelve el
campo de nombre, antes del teléfono.

**Why this priority**: Es la única historia del feature, y corrige un dato que
falta para operar.

**Independent Test**: Se carga un pedido completo; la sección de quien recibe
pide nombre y teléfono, en ese orden, y el resumen de confirmación muestra los
dos.

**Acceptance Scenarios**:

1. **Given** alguien llega a la sección "¿Quién recibe el paquete?", **When** la
   mira, **Then** encuentra dos campos —nombre y teléfono, en ese orden— y
   ninguno de cédula.
2. **Given** alguien deja el nombre vacío, **When** intenta confirmar, **Then**
   el sitio le muestra un mensaje **visible junto al campo** y no acepta el
   pedido.
3. **Given** un pedido confirmado, **When** se lee el resumen, **Then** figuran
   el nombre y el teléfono de quien recibe, y ninguna cédula.

### Edge Cases

- **El nombre con espacios en blanco solamente** no cuenta como completo, igual
  que el nombre de quien envía.
- **Quien recibe es la misma persona que envía.** Válido, no se advierte nada.
- **No hay persistencia**, así que reponer un campo no arrastra migración.

## Requirements *(mandatory)*

- **FR-001**: El formulario MUST pedir el nombre de quien recibe el paquete, y
  MUST tratarlo como obligatorio.
- **FR-002**: El nombre MUST aparecer **antes** del teléfono en la sección
  "¿Quién recibe el paquete?".
- **FR-003**: Cuando el nombre falte, el sistema MUST mostrar el mensaje de
  error junto al campo. La clave del error MUST estar escrita idéntica en la
  validación y en el render — es exactamente el defecto que
  `docs/tech-debt-tracker.md` registró durante dos features sobre el campo
  anterior, y el campo que vuelve es el mismo.
- **FR-004**: El resumen de confirmación MUST mostrar el nombre junto al
  teléfono de quien recibe.
- **FR-005**: El formulario MUST NOT volver a pedir la cédula, ni mostrarla en
  el resumen.
- **FR-006**: La sección *Scope boundaries* de la constitución MUST reflejar que
  de quien recibe se piden nombre y teléfono. Hoy dice solo teléfono, porque la
  enmienda 2.1.0 se escribió con la información anterior.

## Success Criteria *(mandatory)*

- **SC-001**: Los campos obligatorios del formulario pasan de 12 a **13**.
- **SC-002**: El error del nombre de quien recibe **se ve** cuando el campo
  queda vacío, verificado a mano.
- **SC-003**: La suite de verificación del proyecto queda en verde.

## Assumptions

- **Solo vuelve el nombre.** Confirmado con el cliente el 2026-08-06. Si más
  adelante pide también la cédula, es otra decisión y otro feature.
- **El nombre no se valida contra nada** — no hay lista de personas ni
  verificación de identidad. Es texto libre no vacío, igual que el de quien
  envía.
- **El prellenado desde el perfil no aplica acá.** Quien recibe cambia de un
  pedido a otro; es dato del pedido, no del usuario. Cuando llegue el login, el
  perfil prellena al remitente, no al destinatario.

## Out of Scope

- La cédula de quien recibe.
- Backend, persistencia, login y prellenado — son del feature del backend.
- Cualquier otro campo del formulario.
