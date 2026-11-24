# Feature Specification: Orden de la dirección en la app

**Feature Branch**: `032-orden-de-la-direccion`

**Created**: 2026-11-24

**Status**: Draft

**Input**: Mateo, el 2026-11-24, por pedido de Diego (Google Doc de relevamiento,
sección MODIFICACIONES: *"direccion en aplicacion, la esquina se carga antes y el
numero de puerta despues"*). En palabras de Mateo: *"cuando cargan la direccion
les sale primero la esquina y luego el numero de puerta y deberia ser al reves
porque sino parece que el numero de puerta es de la calle de la esquina"*.

## El problema

La app muestra una dirección como `Rivera esq. Soca 1234`. Quien la lee en la
calle entiende "Soca 1234", que es otra puerta, a veces a varias cuadras. El
número es de la calle principal; la esquina es una referencia. El orden actual
pega el número a la referencia.

La web ya lo muestra bien —`Rivera 1234, apto 3, esq. Soca, cooperativa`— y la
app es la única que lo invierte. Pasa en dos pantallas: la tarjeta del pedido
(con la dirección de retiro **y** la de entrega) y la hoja que se abre para
marcar la entrega.

## Lo que este feature es, y lo que no

**Es el orden del texto en la app.** Calle y número juntos, primero; después el
apartamento, la esquina y la marca de cooperativa, en el mismo orden que la web.

**No toca la web**, ni lo que se guarda, ni el formulario donde el cliente carga
la dirección. El dato está bien; lo que está mal es cómo la app lo arma.

**No toca el backend.** El servicio entrega los campos por separado y la app los
compone.

## Clarifications

### Session 2026-11-24

- Q: ¿Formato de la web con comas (`Rivera 1234, apto 3, esq. Soca, cooperativa`)
  o solo invertir el orden actual (`Rivera 1234 esq. Soca`)? → A: Con comas,
  como la web (Mateo).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Leer la dirección sin confundir la puerta (Priority: P1)

Diego o un repartidor abre la app, mira un pedido y lee la dirección en el orden
en que la buscaría en la calle: calle, número, y después la esquina como
referencia.

**Why this priority**: Es todo el pedido. Una dirección mal leída es una vuelta
de más o un paquete en la puerta equivocada.

**Independent Test**: Con un pedido que tenga calle, número, apto, esquina y
cooperativa, abrir la app y comprobar que la tarjeta y la hoja de entrega
muestran el número pegado a la calle principal y la esquina después.

**Acceptance Scenarios**:

1. **Given** un pedido con entrega en calle `Rivera`, número `1234`, esquina
   `Soca`, **When** se ve su tarjeta en la app, **Then** la dirección de entrega
   se lee `Rivera 1234, esq. Soca`.
2. **Given** ese mismo pedido, **When** se abre la hoja para marcar la entrega,
   **Then** la línea del pedido muestra la dirección como `Rivera 1234, esq. Soca`.
3. **Given** un pedido cuya dirección de retiro tiene esquina y número, **When**
   se ve su tarjeta, **Then** la dirección de retiro sigue el mismo orden que la
   de entrega.
4. **Given** una dirección con todos los campos (calle, número, apto, esquina,
   cooperativa), **When** se ve en la tarjeta, **Then** se lee
   `Rivera 1234, apto 3, esq. Soca, cooperativa`: el mismo texto que muestra la
   web para esa dirección.

### Edge Cases

- **Sin número**: `Rivera, esq. Soca`. No queda un espacio ni una coma colgando.
- **Sin esquina**: `Rivera 1234`, sin `esq.` vacío.
- **Solo calle**: `Rivera`.
- **Campos con espacios en blanco solamente** se tratan como vacíos, como hoy.
- **La hoja de entrega es una línea corta**: no muestra apto ni cooperativa (hoy
  tampoco), pero el número va pegado a la calle igual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La app MUST mostrar el número de puerta inmediatamente después de
  la calle principal, antes que la esquina, en toda pantalla donde muestre una
  dirección.
- **FR-002**: En la tarjeta del pedido, la dirección completa MUST seguir el
  orden calle y número, apartamento, esquina, cooperativa, separados por comas,
  igual que la web.
- **FR-003**: En la hoja de entrega, la dirección corta MUST seguir el orden
  calle y número, esquina; sin apartamento ni cooperativa.
- **FR-004**: Un campo vacío o con solo espacios MUST omitirse sin dejar
  separadores sueltos.
- **FR-005**: El cambio MUST aplicarse por igual a la dirección de retiro y a la
  de entrega.
- **FR-006**: El orden MUST quedar fijado por pruebas que fallen si la esquina
  vuelve a quedar antes que el número.
- **FR-007**: El cambio MUST salir como una versión nueva publicada de la app
  (`v0.6.1`), para que el teléfono pueda decir que la tiene.

### Key Entities

- **Dirección**: calle, número, apartamento, esquina y si es cooperativa. Ya
  existe y no cambia; solo cambia cómo la app la convierte en texto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En las dos pantallas de la app que muestran direcciones, el número
  de puerta aparece pegado a la calle principal en el 100% de los pedidos que
  tienen número.
- **SC-002**: Para cualquier dirección, el texto de la tarjeta de la app es el
  mismo que el de la web.
- **SC-003**: Diego confirma, con la versión nueva instalada, que la dirección ya
  no da a entender que el número es de la esquina.

## Assumptions

- **"Como la web" es la referencia**, incluida la coma antes de `esq.` y la
  posición del apto. Diego ya ve ese texto en la web y no lo objetó; tener dos
  formatos distintos para el mismo dato sería otra fuente de confusión.
- **El problema es de lectura, no de carga.** "La esquina se carga antes" se lee
  como "se muestra antes": el formulario de la web pide los campos en el orden
  calle, número, apto, esquina, y quien carga direcciones en la app no existe.
- **Distribución**: como toda versión de la app desde `017`, sale por tag y se
  instala a mano con el link (`docs/processes/app-repartidor.md`). No hay que
  tocar el backend ni el staging del servicio; la prueba es la app en el
  emulador y después en el teléfono.
