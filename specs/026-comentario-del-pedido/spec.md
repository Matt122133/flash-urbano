# Feature Specification: El comentario del pedido

**Feature Branch**: `026-comentario-del-pedido`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Campo de comentarios en la creación de un pedido. Lo pidió un cliente real para poder avisarle algo al repartidor sobre el retiro o la entrega. Sale de la lista MODIFICACIONES del documento del cliente. La pregunta central que el spec tiene que dejar resuelta es dónde se lee."

## Por qué existe

Hoy el pedido describe **direcciones y personas**, y nada más. Todo lo que no
entra en esos campos —que hay que tocar el timbre del 2, que el portón de atrás
es el bueno, que conviene llamar antes— hoy viaja por WhatsApp o no viaja, que
es exactamente el problema que el producto vino a resolver: el cliente avisa por
un canal y alguien lo transcribe a mano.

Un cliente que usa el servicio lo pidió explícitamente. La lista MODIFICACIONES
del documento del cliente lo tiene como **"campo comentarios en la creación de
pedidos"**.

**Esto no es la descripción del paquete.** En el relevamiento original el
cliente marcó la descripción del contenido como *"NO ES NECESARIO"*, y sigue sin
serlo. Lo que este campo agrega es **información del viaje**: cómo llegar, a
quién buscar, qué tener en cuenta al retirar o al entregar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La indicación llega a quien hace el viaje (Priority: P1)

Un cliente carga un pedido y escribe una indicación para el repartidor. Cuando
el repartidor va a hacer ese retiro o esa entrega, **la ve**.

**Why this priority**: es la funcionalidad entera. Un comentario que se guarda y
nadie lee no le sirve a nadie: el cliente creería que avisó, el repartidor no se
enteraría, y el resultado sería peor que no tener el campo, porque genera una
expectativa falsa. Si sólo se entrega esta historia, la función ya vale.

**Independent Test**: cargar un pedido con una indicación desde la web y
comprobar que aparece donde el repartidor la va a mirar antes de salir, sin
que nadie se la reenvíe por otro canal.

**Acceptance Scenarios**:

1. **Given** un cliente creando un pedido, **When** escribe una indicación y
   confirma, **Then** el pedido queda registrado con esa indicación.
2. **Given** un pedido con indicación, **When** el repartidor lo mira para hacer
   el viaje, **Then** ve el texto completo tal como lo escribió el cliente.
3. **Given** un pedido sin indicación —porque es opcional, o porque es anterior
   a esta función—, **When** el repartidor lo mira, **Then** no ve ningún hueco,
   etiqueta vacía ni espacio reservado.

---

### User Story 2 - El cliente corrige lo que escribió (Priority: P2)

Un cliente se da cuenta de que la indicación estaba mal o incompleta y la
corrige, mientras el pedido siga pendiente.

**Why this priority**: una indicación equivocada es peor que ninguna, y el
cliente ya tiene la expectativa de poder corregir: `022` le dio editar y
eliminar el pedido mientras está pendiente. Que el comentario fuera el único
campo no editable sería una excepción sin motivo.

**Independent Test**: crear un pedido con indicación, editarla desde el perfil
mientras el pedido está pendiente, y comprobar que el repartidor ve la versión
nueva.

**Acceptance Scenarios**:

1. **Given** un pedido pendiente con indicación, **When** el cliente la edita,
   **Then** el pedido queda con el texto nuevo.
2. **Given** un pedido pendiente con indicación, **When** el cliente la borra
   entera, **Then** el pedido queda sin indicación, igual que si nunca la
   hubiera tenido.
3. **Given** un pedido que el repartidor ya tomó, **When** el cliente lo mira,
   **Then** no puede editar la indicación, **y ve el mismo motivo** que `022` ya
   muestra para el resto de los campos.

---

### User Story 3 - El cliente vuelve a ver lo que pidió (Priority: P3)

El cliente mira sus pedidos y encuentra la indicación que dejó, sin tener que
acordarse.

**Why this priority**: es consistencia, no capacidad nueva. Sin esto el cliente
no puede verificar qué pidió ni decidir si hace falta corregirlo, que es lo que
la historia 2 le permite hacer.

**Independent Test**: crear un pedido con indicación y encontrarla en la lista
de pedidos del perfil y en el resumen imprimible.

**Acceptance Scenarios**:

1. **Given** un pedido con indicación, **When** el cliente lo abre en su perfil,
   **Then** ve la indicación.
2. **Given** un pedido con indicación, **When** el cliente imprime el resumen,
   **Then** la indicación sale en el papel.

---

### Edge Cases

- **Un comentario larguísimo.** El campo tiene un tope y el cliente lo ve antes
  de chocarlo, no después de escribir.
- **Un comentario que es sólo espacios o saltos de línea.** Cuenta como vacío:
  el pedido queda sin indicación, no con una indicación en blanco.
- **Saltos de línea dentro del comentario.** Se conservan al leerlo; una lista
  de tres renglones no se lee como un párrafo pegado.
- **Caracteres que rompen una pantalla.** Comillas, ñ, tildes, emoji: se
  guardan y se muestran como se escribieron, en las tres superficies.
- **Un comentario que el cliente usa para pedir algo que el servicio no hace**
  (cambiar la dirección, coordinar otro día). El producto no lo interpreta: es
  texto para una persona, no una instrucción para el sistema.
- **Pedidos anteriores a esta función.** Existen y son la mayoría: se comportan
  exactamente como un pedido sin indicación.
- **Un teléfono con una versión vieja de la app.** La app se instala a mano y no
  hay tienda: pueden convivir versiones. Una versión que no conoce el campo
  tiene que seguir funcionando igual que hoy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El formulario de pedido MUST ofrecer un campo de texto libre para
  una indicación dirigida al repartidor.
- **FR-002**: El campo MUST ser **opcional**. Un pedido sin indicación se crea
  exactamente como hoy, sin pasos ni avisos nuevos.
- **FR-003**: El campo MUST tener un tope de largo visible para el cliente
  mientras escribe, y el sistema MUST rechazar un texto que lo supere.
- **FR-004**: El sistema MUST tratar un texto compuesto sólo de espacios en
  blanco como ausencia de indicación.
- **FR-005**: El sistema MUST conservar el texto tal como lo escribió el
  cliente, incluidos los saltos de línea.
- **FR-006**: La indicación MUST comportarse como **un dato más del pedido**, a
  la par de la dirección: aparece en toda pantalla que muestre el pedido —el
  resumen de confirmación, el resumen imprimible, los pedidos del perfil, y la
  app del repartidor—, no en una pantalla propia.
- **FR-006a**: En la app del repartidor, la lista MUST **marcar** los pedidos
  que traen indicación, para que se vea sin abrirlos cuál tiene algo que leer;
  el texto completo se lee al abrir el pedido.
- **FR-007**: El cliente MUST poder editar y borrar la indicación **bajo la
  misma regla que `022` ya aplica al resto del pedido**: mientras esté
  pendiente, y con el mismo motivo a la vista cuando ya no se puede.
- **FR-008**: El cliente MUST ver la indicación que dejó en el resumen de
  confirmación, en los pedidos de su perfil y en el resumen imprimible.
- **FR-009**: Un pedido sin indicación MUST verse igual que hoy en todas las
  pantallas: sin etiqueta, sin hueco y sin espacio reservado.
- **FR-010**: Los pedidos creados antes de esta función MUST seguir
  funcionando, y MUST comportarse como pedidos sin indicación.
- **FR-011**: Una versión de la app del repartidor que no conozca el campo MUST
  seguir funcionando sin cambios.
- **FR-012**: El tablero de administración MUST seguir sin mostrar detalle de
  pedidos: cuenta pedidos y paquetes, y la indicación no aparece ahí.
- **FR-013**: La indicación MUST viajar únicamente entre el cliente que la
  escribió y la administración. Ningún otro cliente puede leerla.

### Key Entities

- **Pedido**: gana un atributo nuevo, **la indicación para el repartidor**:
  texto libre, opcional, escrito por el cliente al crear el pedido y editable
  mientras el pedido esté pendiente. No participa de ningún cálculo: no afecta
  el precio, ni la zona, ni el conteo del tablero.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente puede dejar una indicación sin que crear el pedido le
  lleve más pasos que hoy: sigue siendo una sola pantalla y una sola
  confirmación.
- **SC-002**: El repartidor encuentra la indicación de un pedido **sin salir de
  la app** y sin consultar ningún otro canal.
- **SC-003**: El 100% de los pedidos que existen hoy —ninguno tiene
  indicación— se siguen viendo y operando igual que antes, en la web y en la
  app.
- **SC-004**: Una indicación con tildes, ñ, comillas y tres renglones se lee
  íntegra y con sus renglones en las tres superficies donde aparece.
- **SC-005**: Un cliente que se equivocó puede corregir la indicación mientras
  el pedido esté pendiente, y el repartidor pasa a ver la corregida.
- **SC-006**: Las indicaciones que hoy viajan por WhatsApp para los pedidos
  cargados por la web dejan de necesitar ese canal.

## Assumptions

Son decisiones tomadas por defecto al escribir el spec. Cada una se puede
revertir en el clarify; se listan para que se vean, no para darlas por firmes.

- **El tope es de 280 caracteres.** Alcanza de sobra para las indicaciones que
  motivaron el pedido y evita que el campo se convierta en el lugar donde el
  cliente escribe un pedido entero en prosa.
- **No se muestra en el tablero.** El `025` decidió que el tablero cuenta y no
  detalla; mostrar ahí el texto lo convertiría en otra cosa.
- **No viaja en el aviso push** que el repartidor recibe al entrar un pedido
  nuevo. El aviso dice que hay un pedido; el detalle se lee en la app.
- **No se traduce, no se corrige y no se interpreta.** Es texto de una persona
  para otra persona.
- **El precio no se toca.** La constitución prohíbe leer la columna de precio
  desde código nuevo, y esta función no tiene motivo para acercarse.
- **El formulario de pedido sigue sin depender del servicio para cotizar**: la
  pantalla de precio tiene que seguir andando con el servicio caído, como hoy
  lo garantiza una prueba.

## Dependencias

- **Si la indicación se muestra en la app del repartidor, hay que publicar una
  versión nueva del APK y Diego tiene que instalarla a mano.** No hay tienda. La
  función no está entregada el día que el código está en `master`: está
  entregada el día que el teléfono de Diego la muestra.

---

## Decisiones del cliente (2026-09-12)

Las dos preguntas que el spec dejó abiertas quedaron contestadas por Mateo antes
de planificar.

### D1 — La indicación es un dato del pedido, y la lee todo el mundo

No es información para una sola superficie: se comporta **como la dirección de
entrega**. Aparece en el resumen, en el resumen imprimible, en los pedidos del
perfil y en la app del repartidor. Recogido en FR-006 y FR-008.

En la app, además, **la lista marca los pedidos que traen indicación**, "para
que sepa si hay alguna forma específica de entregar algo" — o sea que la marca
existe para que Diego lo sepa **al decidir qué lleva**, no recién al abrir el
pedido. Recogido en FR-006a.

**Consecuencia que hay que tener presente**: esto arrastra la app Android. Ver
*Dependencias*: la función no está entregada hasta que el teléfono de Diego la
muestra, y eso pide publicar el APK e instalarlo a mano.

### D2 — Una sola indicación por pedido

No se parte en retiro y entrega. Un campo, y el cliente aclara adentro a qué se
refiere. Si algún día molesta, partirlo cuesta una migración; hoy no hay
evidencia de que haga falta.
