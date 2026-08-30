# Feature Specification: El tamaño del paquete y la hora de retiro quedan en pausa

**Feature Branch**: `014-campos-en-pausa`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Decisión del cliente (Diego), transmitida por Mateo el 2026-08-30, en
la misma conversación que `013`. Hoy Diego no usa el tamaño del paquete ni la
hora de retiro, y quiere sacarlos del formulario. **Dijo que en el futuro sí los
va a usar**, así que el código se comenta, no se borra.

## Por qué, y por qué "comentado" no es una excusa

Son dos campos con dos historias distintas.

**El tamaño del paquete** simplemente no le sirve hoy. Nada del negocio lo usa:
no cambia lo que se cobra, no cambia la ruta, no cambia nada. Es una pregunta que
el formulario le hace a la persona y cuya respuesta nadie mira.

**La hora de retiro tiene un motivo de negocio, y conviene entenderlo.** Diego
pasa a una hora fija y lo coordina él. Si una empresa necesita otra franja, lo
va a hablar en persona, **y ahí el precio puede subir**. O sea que la hora no
desaparece del negocio: sale del sitio para entrar en una conversación donde
también se negocia la plata. **Es la misma decisión que `013`**, dicha de otra
manera: lo que varía caso por caso, Diego lo quiere negociar, no publicar.

**Comentar en vez de borrar es pedido explícito y con motivo dado.** No es
indecisión: el cliente dijo que vuelven. En un repo cuya regla es *si no está en
el repo no existe*, el código comentado es una deuda visible, y este spec la
acepta a sabiendas: el comentario tiene que decir **quién lo desactivó, cuándo y
qué hay que descomentar**, o en tres meses nadie va a saber si eso se puede
borrar.

## Lo que este feature NO hace

- **No toca el backend.** Ninguna migración, ninguna columna nullable, ninguna
  validación nueva. La tabla `pedidos` tiene pedidos reales de Diego, y una
  migración ahí es exactamente lo que tumbó producción el 2026-08-12.
- **No toca la app Android.** Va a mostrar el valor fijo en todos los pedidos.
- **No saca la cantidad de paquetes.** Solo el tamaño.
- **No saca la fecha de retiro.** Solo la hora. Diego necesita saber para qué
  día es el pedido: su app ordena la jornada por eso.
- **No borra nada.** Ni un campo del estado, ni un tipo, ni una validación.

## Clarifications

### Sesión 2026-08-30

- **¿Se va la hora de retiro sola, o también la fecha?** → **Solo la hora.** Sin
  el día, Diego recibe pedidos sin ninguna señal de cuándo pasar. (FR-002)
- **¿Hasta dónde llega "que el backend sea receptivo vaya o no"?** → **El sitio
  manda siempre un valor fijo, y el servicio no cambia una línea.** Se descartó
  hacer los campos realmente opcionales: es una migración sobre la tabla con los
  pedidos reales, y el antecedente del 2026-08-12 pesa más que la prolijidad.
  (FR-004, FR-007)
- **¿Qué hora fija?** → **16:00**, la que Diego usa. (FR-004)
- **¿Qué tamaño fijo?** → **"chico"**, que es el respaldo que el sitio **ya usa
  hoy** cuando el campo viene vacío. Elegirlo es el único valor que no cambia el
  comportamiento de nada. (FR-004)
- **La tarjeta de *Mis pedidos* muestra los dos valores. ¿Qué pasa con ella?** →
  **Se ocultan ahí también.** El sitio no puede devolverle a alguien un dato que
  esa persona nunca escribió, presentado como si lo hubiera escrito. Se aceptó el
  costo con los ojos abiertos: los pedidos viejos sí tenían un tamaño y una hora
  de verdad, y esa historia deja de verse. Se descartó distinguir por época —es
  maquinaria que este cambio no justifica (Principio III). (FR-006a)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar un pedido sin que pregunten el tamaño ni la hora (Priority: P1)

Una persona carga un envío. No le preguntan de qué tamaño es el paquete ni a qué
hora lo retiran. Sí le preguntan cuántos paquetes son y qué día pasarlo a buscar.

**Why this priority**: Es el pedido del cliente y es la única historia con
trabajo visible. Todo lo demás es consecuencia.

**Independent Test**: Recorrer el formulario y comprobar que los dos campos no
están, que los otros dos siguen, y que el pedido se crea igual.

**Acceptance Scenarios**:

1. **Given** una persona en el formulario, **When** llega a la sección del
   paquete, **Then** ve cuántos paquetes son y **no** ve el selector de tamaño.
2. **Given** la misma persona, **When** llega a cuándo se retira, **Then** ve la
   fecha y **no** ve el horario.
3. **Given** el formulario completo, **When** confirma, **Then** el pedido se
   crea sin pedirle ninguno de los dos campos y sin ningún error de validación.
4. **Given** el pedido creado, **When** se lo mira en la base, **Then** tiene
   tamaño `chico` y hora `16:00`.
5. **Given** el resumen posterior a confirmar, **When** la persona lo lee,
   **Then** no aparece ni el tamaño ni la hora, y sí la fecha.

---

### User Story 2 - Que el próximo que abra el archivo entienda qué pasó (Priority: P2)

Alguien —persona o agente— abre el formulario dentro de tres meses y encuentra
código comentado. En vez de tener que adivinar si es basura o si hace falta,
lee ahí mismo qué lo desactivó, cuándo, y qué hay que descomentar.

**Why this priority**: Es lo que separa "en pausa" de "código muerto". Sin esto,
el pedido explícito del cliente se convierte en el clásico bloque comentado que
nadie se anima a borrar.

**Independent Test**: Leer los bloques comentados y comprobar que cada uno dice
qué, cuándo y cómo reponerlo.

**Acceptance Scenarios**:

1. **Given** el formulario, **When** alguien lee el bloque comentado del tamaño,
   **Then** encuentra que lo desactivó `014` el 2026-08-30 por decisión del
   cliente, que el cliente dijo que vuelve, y qué hay que descomentar.
2. **Given** lo mismo para la hora de retiro, **Then** encuentra además que la
   hora se negocia en persona y puede cambiar el precio.

---

### Edge Cases

- **Repetir un pedido viejo que tenía tamaño `grande` y hora `10:00`.** Se
  repite igual; el pedido nuevo sale con `chico` y `16:00`, porque el formulario
  ya no ofrece esos campos. El pedido viejo no se modifica.
- **La fecha sigue sin poder ser pasada.** Esa validación no se toca.
- **El historial de la persona.** La tarjeta de *Mis pedidos* hoy dice "Retiro
  el 3/9 **a las 16:00**" y "**chico** · 2 paquetes". Los dos se ocultan
  (FR-006a), incluso en pedidos viejos donde el dato era verdadero — es el costo
  aceptado de no distinguir por época.
- **La app de Diego.** Va a decir `Tamaño chico` y `16:00` en todos los pedidos.
  Aceptado a sabiendas: no se toca `android/`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El selector de tamaño de paquete MUST desaparecer del formulario.
  La cantidad de paquetes MUST quedarse.
- **FR-002**: El campo de horario de retiro MUST desaparecer del formulario. La
  fecha de retiro MUST quedarse, con su validación de fecha pasada intacta.
- **FR-003**: El código de los dos campos MUST quedar **comentado en su lugar**,
  no borrado. Cada bloque comentado MUST decir qué feature lo desactivó, en qué
  fecha, por decisión de quién, y qué hay que descomentar para reponerlo. El de
  la hora MUST decir además que se negocia en persona y puede mover el precio.
- **FR-004**: El pedido que se manda al servicio MUST seguir llevando un tamaño y
  una hora: **`chico`** y **`16:00`**.
- **FR-005**: La validación de esos dos campos MUST dejar de rechazar el
  formulario. No se puede exigir lo que no se muestra.
- **FR-006**: El resumen posterior a confirmar MUST dejar de mostrar el tamaño y
  la hora. La fecha MUST seguir.
- **FR-006a**: La tarjeta de pedido en *Mis pedidos* MUST dejar de mostrar el
  tamaño y la hora de retiro, para **todos** los pedidos, viejos incluidos. La
  fecha de retiro MUST seguir. El dato sigue llegando en la respuesta del
  servicio y sigue guardado.
- **FR-007**: El servicio MUST NOT cambiar: ninguna migración, ninguna
  validación nueva, ninguna columna nullable. Sigue exigiendo los dos campos y
  sigue recibiéndolos.
- **FR-008**: La app Android MUST NOT cambiar.
- **FR-009**: Repetir un pedido MUST seguir funcionando. Lo que ya no se muestra
  no se precarga.
- **FR-010**: Todo lo demás del formulario MUST quedar como está: direcciones,
  cantidad, fecha, quién recibe, y la confirmación de cobertura de `013`.

### Key Entities

- **Pedido**: sigue guardando `paquete_tamano` y `retiro_hora`, ahora con un
  valor fijo. Ninguna columna cambia de forma.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El formulario tiene **dos campos menos** que antes, y ninguno de
  los otros desapareció.
- **SC-002**: Una persona completa y confirma un pedido sin que se le pregunte
  el tamaño ni la hora, y sin ver un solo error de validación por eso.
- **SC-003**: Un pedido creado después del cambio llega a la base con
  `paquete_tamano = 'chico'` y `retiro_hora = '16:00'`, y el servicio lo acepta
  sin cambios.
- **SC-004**: Ninguna pantalla le muestra a la persona un tamaño de paquete ni
  una hora de retiro que ella no eligió.
- **SC-005**: Los dos bloques comentados dicen qué, cuándo, quién y cómo
  reponerlo — un lector que no estuvo en esta conversación puede descomentarlos
  sin preguntar nada.
- **SC-006**: Reponer cualquiera de los dos campos es descomentar, sin escribir
  código nuevo.

## Assumptions

- Nadie lee `paquete_tamano` ni `retiro_hora` para tomar decisiones. Desde este
  feature registran el valor fijo, no lo que pasó — igual que `precio` después de
  `013`.
- La cantidad de paquetes sigue siendo un dato que Diego usa.
- El respaldo `chico` que el sitio ya aplica hoy cuando el tamaño viene vacío es
  la razón de elegir ese valor: no cambia el comportamiento de nada.

## Dependencias

- **Enmienda de la constitución, MINOR.** Las *Scope boundaries* nombran
  "package type/description, quantity" y "the pickup window" como parte del
  formulario. Este feature saca dos de esos. **No es MAJOR y no lleva ADR**:
  ningún principio se revierte, es el cliente recortando su propio brief, y el
  gobierno pide ADR cuando una decisión revierte una anterior. Es el mismo caso
  que la versión 2.1.0, que sacó el método de pago y la ventana de entrega.
- **`013` tiene que estar cerrado.** No pueden convivir dos planes activos.
