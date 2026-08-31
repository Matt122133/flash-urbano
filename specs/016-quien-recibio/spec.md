# Feature Specification: Quién recibió el paquete

**Feature Branch**: `016-quien-recibio`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Pedido del cliente (Diego), transmitido por Mateo el 2026-08-30
mirando la maqueta de `015`: al marcar un pedido como entregado, Diego tiene que
poder anotar **el nombre y la cédula de quien lo recibió**, y que eso quede
pegado al pedido. El motivo es concreto: *"a veces recibe la persona que se
marcó en un principio pero a veces no, y lo atiende la madre por ejemplo"*.

## Por qué esto no contradice nada, y estaba previsto

La cédula del destinatario **salió del formulario web en `004`**, y la
constitución escribió por qué: era *"un número sensible que no se usaba para
nada"*. Pero no lo cerró — dejó dicho, textual, que se captura **"en la app
Android al entregar, si hace falta"**.

Hizo falta. Este feature es esa frase, cumplida cuatro meses después por el
mismo cliente que la motivó. **No hay enmienda de constitución que hacer.**

## La decisión que le da forma a todo: quién ve qué

Hay dos personas mirando este dato y **no necesitan lo mismo**.

**Diego** necesita las dos cosas. Un paquete que recibió alguien que no era el
destinatario es exactamente el caso en que alguien reclama después, y el nombre
solo no alcanza para responder.

**El cliente que mandó el paquete** necesita saber que llegó y a quién. *"Lo
recibió Susana"* es una confirmación de entrega útil. **El número de cédula de
Susana no.** Es el documento de un tercero, que esa persona le dio a Diego en la
puerta y no al remitente, viajando a una pantalla donde no hace falta.

**Entonces las dos respuestas del servicio dejan de tener la misma forma**, y
esa asimetría es la restricción central de este feature: la que es fácil de
romper después sin darse cuenta, con un `struct` compartido y un campo que
alguien agrega de buena fe.

**Sobre "la cédula es un dato público"**: se comparte muchísimo, y eso no es lo
mismo. En Uruguay es un dato personal bajo la **Ley 18.331**, y guardarlo nos
hace responsables de un dato de alguien que nunca nos lo dio a nosotros. Nada de
este spec cambia por eso —el diseño elegido ya lo trata bien— pero el repo no va
a decir que es público, porque alguien lo va a leer para decidir qué exponer.

## Lo que este feature NO hace

- **No devuelve la cédula al formulario web.** Sigue afuera, y por el mismo
  motivo por el que salió: ahí no se usa para nada.
- **No toca la tabla `pedidos`.** La migración va sobre `pedidos_estados`.
- **No hace obligatoria la cédula.** Ver FR-006.
- **No muestra el historial de estados.** Sigue siendo un dato que se escribe y
  se guarda (FR-014 de `012`); lo único que se expone es quién recibió.
- **No agrega firma, foto ni escaneo de documento.** Nadie lo pidió.

## Clarifications

### Sesión 2026-08-30

- **¿El cliente ve la cédula de quien recibió?** → **El nombre sí, la cédula
  no.** (FR-008, FR-009)
- **¿Dónde se guarda?** → **En `pedidos_estados`**, el historial de cambios de
  estado, que ya tiene una fila por cada movimiento. Quién recibió pertenece al
  **evento de entrega**, no al pedido. Y de paso no se toca la tabla `pedidos`,
  que es la que tiene los datos reales y la que tumbó producción el 2026-08-12.
  (FR-005)
- **¿Se actualiza `SECURITY.md`?** → **Sí**, como parte de este feature: entra
  una categoría de dato que el sistema no manejaba. (FR-013)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibe quien tenía que recibir (Priority: P1)

Diego llega, entrega el paquete a la persona que figura en el pedido, y marca
entregado. **Un toque.** No escribe nada.

**Why this priority**: Es el caso mayoritario, y si es lento el feature empeora
la app en vez de mejorarla. Diego está parado en una puerta con las manos
ocupadas.

**Independent Test**: Marcar entregado un pedido y confirmar con la opción
prellenada, contando los toques.

**Acceptance Scenarios**:

1. **Given** un pedido en *En curso*, **When** Diego toca *Entregado*, **Then**
   se le pregunta quién recibió, con **la persona del pedido ya propuesta**.
2. **Given** esa propuesta, **When** la toca, **Then** el pedido pasa a
   Entregados y queda registrado que lo recibió esa persona.
3. **Given** ese camino, **When** se cuenta, **Then** son **dos toques en
   total** desde la tarjeta: *Entregado* y confirmar.

---

### User Story 2 - Recibe otra persona (Priority: P1)

Atiende la madre. Diego escribe su nombre, le pide la cédula, y si se la dan la
anota. Si no se la dan, entrega igual.

**Why this priority**: Es el motivo por el que el cliente pidió esto. Sin este
camino el feature no existe.

**Independent Test**: Marcar entregado escribiendo un nombre distinto, con y sin
cédula.

**Acceptance Scenarios**:

1. **Given** la pregunta de quién recibió, **When** Diego elige que recibió otra
   persona, **Then** puede escribir un nombre y, opcionalmente, una cédula.
2. **Given** un nombre escrito y **sin cédula**, **When** confirma, **Then** la
   entrega se registra igual.
3. **Given** un nombre escrito, **When** confirma, **Then** el pedido pasa a
   Entregados con ese nombre, no con el del destinatario.
4. **Given** que se arrepiente, **When** cierra la pregunta sin confirmar,
   **Then** **el pedido NO cambia de estado** y sigue en *En curso*.

---

### User Story 3 - El cliente ve quién recibió su paquete (Priority: P2)

Quien mandó el paquete entra a *Mis pedidos* y ve que lo recibió Susana. No ve
su documento.

**Why this priority**: Es el valor del dato para el otro lado del negocio, y
llega después de que Diego lo pueda cargar.

**Independent Test**: Entregar a un tercero desde la app y mirar el pedido desde
la web, con la sesión del cliente.

**Acceptance Scenarios**:

1. **Given** un pedido entregado a un tercero, **When** el cliente lo mira en
   *Mis pedidos*, **Then** ve el nombre de quien lo recibió.
2. **Given** ese mismo pedido, **When** se mira **todo** lo que el servicio le
   manda al cliente, **Then** **la cédula no aparece en ningún lado** — ni en la
   pantalla, ni en la respuesta.
3. **Given** un pedido entregado a la persona del pedido, **When** el cliente lo
   mira, **Then** ve que lo recibió esa persona.

---

### Edge Cases

- **Deshacer una entrega.** El historial es append-only: la fila de la entrega
  **queda**, con quien recibió. Volver a entregar escribe una fila nueva. El
  registro no se reescribe.
- **Un pedido entregado antes de este feature.** No tiene quién recibió, y eso
  no es un error: la pantalla no muestra el dato en vez de mostrarlo vacío.
- **Un nombre vacío en el camino largo.** No se puede confirmar sin nombre: si
  Diego eligió que recibió otra persona, el nombre es lo mínimo.
- **Una cédula con cualquier formato.** Ver *Assumptions*.
- **Sin conexión.** No se puede entregar, igual que hoy: la app no deja mover
  pedidos sin red y lo dice antes de tocar.

## Requirements *(mandatory)*

### Functional Requirements

**Cargarlo**

- **FR-001**: Marcar un pedido como entregado MUST preguntar quién lo recibió,
  antes de mover el estado.
- **FR-002**: La persona que figura en el pedido MUST venir propuesta, y
  aceptarla MUST ser **un solo toque**.
- **FR-003**: MUST poder registrarse que recibió otra persona, con su nombre.
- **FR-004**: Cerrar la pregunta sin confirmar MUST NOT cambiar el estado del
  pedido.

**Guardarlo**

- **FR-005**: Quién recibió MUST guardarse en el historial de cambios de estado,
  junto al evento de entrega. La tabla de pedidos MUST NOT cambiar.
- **FR-006**: La cédula MUST ser opcional. Una entrega sin cédula MUST
  registrarse igual — si quien recibe no la da, eso no puede trabar una entrega
  que ya ocurrió.
- **FR-007**: El nombre MUST ser obligatorio cuando Diego declara que recibió
  otra persona.

**Quién ve qué**

- **FR-008**: La app de Diego MUST mostrar el nombre y la cédula de quien
  recibió.
- **FR-009**: Lo que el servicio le manda al cliente MUST incluir el nombre de
  quien recibió y **MUST NOT incluir la cédula**, en ninguna forma y por ningún
  camino.
- **FR-010**: MUST existir una prueba automática que falle si la cédula aparece
  en lo que se le manda al cliente. **Es la guarda de FR-009**, y sin ella esa
  regla dura hasta el próximo campo que alguien agregue de buena fe.
- **FR-011**: La web MUST mostrar quién recibió cuando el pedido está entregado,
  y MUST NOT mostrar nada cuando el pedido no tiene ese dato.

**No regresiones**

- **FR-012**: Mover un pedido entre los otros estados MUST seguir funcionando
  igual, sin preguntar nada.
- **FR-013**: `SECURITY.md` MUST describir la categoría de dato que entra con
  este feature, dónde vive, quién la ve y por qué no sale del lado de Diego.

### Key Entities

- **Cambio de estado**: la fila que ya existe por cada movimiento. Gana dos
  datos opcionales: **quién recibió** y **su documento**. Solo tienen sentido en
  el evento de entrega.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Entregar a la persona del pedido cuesta **dos toques** desde la
  tarjeta.
- **SC-002**: Diego puede registrar que recibió otra persona, con o sin cédula,
  y en los dos casos la entrega queda hecha.
- **SC-003**: El cliente ve quién recibió su paquete.
- **SC-004**: **La cédula no aparece en nada de lo que recibe el cliente**,
  comprobado sobre la respuesta del servicio y no solo sobre la pantalla.
- **SC-005**: Una prueba automática falla si alguien expone la cédula al
  cliente.
- **SC-006**: Los pedidos entregados antes de este feature se siguen viendo bien,
  sin huecos ni datos vacíos.

## Assumptions

- **La cédula se guarda tal como Diego la escribe**, sin validar el dígito
  verificador ni normalizar puntos y guiones. Es un respaldo que Diego anota
  parado en la calle, no una clave: rechazarle un formato sería trabarle una
  entrega ya hecha por un problema de tipeo. Si algún día hace falta buscar por
  cédula, ahí se normaliza.
- Diego es el único que usa la app, así que "quién ve la cédula" es él y nadie
  más.
- El historial de estados sigue sin mostrarse: lo único que se expone de él es
  quién recibió.

## Dependencias

- **`015` mergeado.** Ya está: PR #27. La hoja de "quién recibió" cuelga de la
  acción *Entregado* que ese feature rediseñó.
- **Tres superficies.** Es el primer feature desde `012` que toca las tres, así
  que el `verify:` vuelve a llevar las tres patas — con `.\gradlew.bat`, que es
  la forma que funciona en `cmd`.
- **Una migración sobre producción.** Sobre `pedidos_estados`, con columnas
  **nullable**. No tiene el riesgo de la del 2026-08-12, que fue `NOT NULL`
  sobre una tabla con filas — pero es una migración sobre la base que tiene los
  pedidos reales de Diego, y se trata como tal.
