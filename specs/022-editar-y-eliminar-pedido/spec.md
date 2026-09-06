# Feature Specification: Corregir o dar de baja un pedido, mientras nadie lo tomo

**Feature Branch**: `022-editar-y-eliminar-pedido`

**Created**: 2026-09-05

**Status**: Draft

**Input**: Mateo, el 2026-09-05: *"algo que se me paso por completo es el crud de
los pedidos para el cliente. editas y eliminar en caso de que no sea correcto lo
que crearon o le hayan errado a un nombre o telefono o lo que sea, que este la
posibilidad"*. En el documento del cliente figura en **MODIFICACIONES** como
*"editar y eliminar un pedido parte del cliente"*.

## Clarifications

### Session 2026-09-05

- Q: ¿Hasta cuando se puede editar o eliminar? → A: **Solo mientras el pedido
  este pendiente.** Palabras de Mateo, corrigiendo su propia decision de mas
  temprano ese dia: *"hoy dije que se podia editar y eliminar un pedido en
  cualquier parte. tenes razon, cuando Diego ya lo pone en curso y lo toma ahi ya
  no se puede hacer mas nada. asique mientras el pedido esta en pendiente todo
  bien. una vez que Diego lo tenga ya no se puede hacer nada."*

  **Es una reversion deliberada y conviene que quede dicha**, porque la version
  anterior —editar en cualquier estado, con aviso— llego a estar elegida por
  escrito. Lo que la cambio fue ver el caso concreto: **un pedido ya entregado**.
  Editarle la direccion no reescribe la realidad, reescribe el registro de a
  donde fue el paquete. Y editar uno **en curso** deja al repartidor yendo a una
  direccion que dejo de ser la correcta sin que el se entere.

- Q: ¿Diego recibe un push cuando el cliente edita o da de baja? → A: **Si, en
  los dos casos.**

- Q: ¿La baja borra o marca? → Ver *"El esquema ya decidio esto"* mas abajo: **con
  el alcance limitado a pendientes, se puede borrar de verdad**, y es lo que se
  hace.

## El problema: un pedido mal cargado no tiene arreglo

Hoy el cliente crea un pedido y **eso es todo lo que puede hacer**. El servicio
tiene `POST /pedidos`, `GET /pedidos` y el `PATCH` de estado que solo usa el
administrador. No hay forma de corregir un telefono mal tipeado, un nombre
equivocado o una direccion mal elegida, ni de dar de baja un pedido que se cargo
por error.

Lo que hace hoy una persona en esa situacion es **cargar otro pedido**. Y ahi el
costo no lo paga ella: lo paga Diego, que se encuentra con dos pedidos casi
iguales en su lista y tiene que adivinar cual vale. El producto existe para
sacarle esa clase de trabajo manual, y esto se lo devuelve.

## La ventana: mientras Diego no lo tome

**Se puede corregir o dar de baja mientras el pedido este pendiente. Una vez que
Diego lo toma, no se toca mas.**

No es una restriccion tecnica sino la unica que tiene sentido para las dos
partes: mientras nadie se comprometio con el pedido, cambiarlo no le cuesta nada
a nadie. Desde que Diego lo tomo, el pedido dejo de ser una intencion y paso a
ser un trabajo en curso — y ahi lo que hace falta no es un boton sino una
conversacion.

Lo que la persona ve cuando la ventana se cerro **tiene que decir por que**, no
solo esconder el boton: *"Diego ya tomo este pedido"* es informacion util;
un boton que desaparece es un producto que parece roto.

## El esquema ya decidio la mitad de esto

`pedidos_estados.pedido_id` es `ON DELETE RESTRICT`, y la migracion `0005` dice
por que: *"si alguna vez alguien borra un pedido a mano, que falle en voz alta en
vez de llevarse el registro sin avisar"*. Ese historial **solo se escribe cuando
Diego mueve el estado**.

De ahi se sigue, sin que nadie tenga que decidirlo:

- Un pedido **pendiente** no tiene historial → **se puede borrar de verdad**.
- Un pedido **tomado o entregado** si lo tiene → borrarlo **falla en la base**.

O sea que la ventana que eligio el cliente y lo que el esquema permite **son la
misma ventana**. La baja borra la fila; no hace falta inventar un estado
`anulado`, y **por lo tanto la app no cambia y el APK no se reinstala**.

## Lo que esto NO es

- **No es un CRUD de administrador.** Diego mueve estados y eso ya existe. Esto
  es del lado del cliente y solo sobre lo suyo.
- **No es un historial de cambios.** El pedido corregido queda como quedo. Quien
  quiera saber que cambio, no lo va a poder saber, y eso es aceptable en esta
  ventana: nadie trabajo todavia sobre el dato viejo.
- **No es una papelera.** Lo dado de baja se va.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Corregir un dato mal cargado (Priority: P1)

Alguien se equivoco en el telefono del destinatario. Entra a *Mis pedidos*, abre
el pedido, toca **Editar**, corrige y guarda. El pedido queda con el dato bueno,
con el mismo codigo.

**Why this priority**: Es el caso que el cliente describio con esas palabras.

**Independent Test**: Crear un pedido, editarle un campo, y comprobar que se
guardo y que el codigo no cambio.

**Acceptance Scenarios**:

1. **Given** un pedido pendiente propio, **When** se edita cualquier dato y se
   guarda, **Then** queda guardado **con el mismo codigo** — no es un pedido
   nuevo.
2. **Given** una edicion que cambia la direccion de entrega, **When** el punto
   nuevo cae fuera de toda zona, **Then** **no se guarda** y se encamina al
   contacto, igual que al crear. La cobertura se comprueba de nuevo, nunca se
   hereda.
3. **Given** un pedido editado, **When** Diego mira su telefono, **Then** le
   llego un aviso de que ese pedido cambio.
4. **Given** un pedido de otra persona, **When** se intenta editar, **Then** no
   se puede — y el servicio responde como si no existiera.

---

### User Story 2 - Dar de baja un pedido cargado por error (Priority: P1)

Alguien cargo un pedido que no va. Lo da de baja y desaparece de su lista y de la
de Diego.

**Why this priority**: Misma prioridad. Sin esto, el pedido equivocado le llega
igual a Diego y alguien tiene que avisarle por otro lado.

**Independent Test**: Crear un pedido, darlo de baja, y comprobar que no aparece
en ninguna de las dos listas.

**Acceptance Scenarios**:

1. **Given** un pedido pendiente propio, **When** se da de baja, **Then**
   desaparece de *Mis pedidos* y de la lista de Diego.
2. **Given** esa baja, **When** Diego mira su telefono, **Then** le llego un
   aviso de que ese pedido se dio de baja.
3. **Given** la baja, **When** se pide confirmacion, **Then** **se pide**: es
   irreversible y no puede pasar de un toque.
4. **Given** un pedido de otra persona, **When** se intenta dar de baja,
   **Then** no se puede.

---

### User Story 3 - La ventana se cierra cuando Diego toma el pedido (Priority: P1)

Diego acepta el pedido. A partir de ahi el cliente ya no puede editarlo ni darlo
de baja, y la pantalla se lo dice.

**Why this priority**: Misma prioridad porque es lo que protege el trabajo en
curso, y porque **una ventana que no se cierra bien es peor que no tenerla**.

**Independent Test**: Mover un pedido a aceptado y comprobar que las dos
operaciones dejan de estar disponibles.

**Acceptance Scenarios**:

1. **Given** un pedido que Diego ya tomo, **When** el cliente lo mira, **Then**
   no ve *Editar* ni *Eliminar*, y **si ve el motivo**.
2. **Given** un pedido tomado o entregado, **When** llega una edicion o una baja
   igual —una pestaña vieja, un doble toque, alguien probando—, **Then** el
   servicio la **rechaza**. La pantalla no es la que decide.
3. **Given** un pedido que se toma **entre** que la pantalla se dibujo y que
   llega el guardado, **Then** el guardado se rechaza y la persona ve por que.

---

### Edge Cases

- **La carrera con Diego.** El caso real de arriba: el cliente abre *Editar*,
  Diego toma el pedido en ese momento, y el guardado llega tarde. **Gana Diego**,
  y la persona tiene que enterarse de por que — no puede quedar creyendo que
  guardo.
- **Una edicion que saca la entrega de cobertura.** Se rechaza, como al crear.
  Nunca se guarda un pedido a una direccion que no se cubre, y nunca se cae a la
  zona mas cercana.
- **Dar de baja dos veces.** La segunda no encuentra nada. No es un error que
  haya que gritar.
- **Editar sin cambiar nada.** Se guarda igual; no vale la pena detectar que no
  cambio. El aviso a Diego si conviene mandarlo igual, porque el no sabe que no
  cambio.
- **La app de Diego con la lista vieja.** Si el pedido se dio de baja despues del
  ultimo refresco, al tocarlo se va a encontrar con que no esta. **No puede
  quedar en una pantalla rota**: tiene que decir que ese pedido ya no existe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El cliente MUST poder editar un pedido propio **mientras este
  pendiente**.
- **FR-002**: El cliente MUST poder dar de baja un pedido propio **mientras este
  pendiente**.
- **FR-003**: Las dos operaciones MUST estar prohibidas en cuanto el pedido deja
  de estar pendiente, **y la prohibicion MUST hacerse valer en el servicio**, no
  solo escondiendo botones.
- **FR-004**: Un pedido ajeno MUST ser inalcanzable para las dos operaciones, y
  el servicio MUST responder **como si no existiera** — no "no podes", que
  confirmaria que existe.
- **FR-005**: La edicion MUST conservar el **codigo** del pedido: es el que la
  persona anoto y el que puede estar impreso en una etiqueta.
- **FR-005a**: La edicion MUST ser un **reemplazo total**: el cliente manda el
  pedido entero y lo guardado pasa a ser eso. **No es una edicion parcial.**

  El motivo es un modo de falla concreto: con una edicion parcial hay que
  distinguir *"no mande este campo"* de *"quiero vaciarlo"*, y si esa
  distincion se resuelve mal, **un campo que falta borra el dato sin que nada
  avise**. Es perdida de datos silenciosa, no un error. La ambiguedad entre
  ausente y vacio ya costo una decision explicita en `016`.

  El reemplazo total no cuesta nada aca porque **el formulario ya tiene el
  pedido entero cargado**: mandarlo completo es lo natural, no un esfuerzo
  extra. Y lo que se guarda MUST pasar por **las mismas validaciones que la
  creacion**, o el camino de edicion seria una puerta de atras para guardar un
  pedido que el de creacion habria rechazado.
- **FR-006**: Una edicion que cambie la entrega MUST **revalidar la cobertura**
  con las mismas reglas que la creacion, y MUST NOT guardar un pedido fuera de
  zona ni asignar la zona mas cercana.
- **FR-007**: Dar de baja MUST pedir confirmacion.
- **FR-008**: Dar de baja MUST quitar el pedido de la lista del cliente y de la
  de Diego.
- **FR-009**: Diego MUST recibir un aviso cuando un pedido pendiente se edita, y
  otro cuando se da de baja.
- **FR-010**: Los avisos MUST NOT mencionar ningun importe (Principio V) ni la
  cedula de nadie, igual que el aviso de pedido nuevo.
- **FR-011**: Cuando la ventana esta cerrada, la pantalla MUST **decir por que**,
  no limitarse a esconder las acciones.
- **FR-012**: Un guardado que llega tarde —el pedido se tomo mientras tanto—
  MUST rechazarse **y la persona MUST enterarse**, sin quedar creyendo que
  guardo.
- **FR-013**: El cambio MUST NOT requerir reinstalar la app de Diego.
- **FR-014**: La app de Diego MUST tolerar que un pedido de su lista ya no
  exista, sin romperse.

### Key Entities

- **Pedido** — ya existe. Gana dos operaciones y **ningun campo nuevo**.
- **Aviso** — ya existe (`018`). Gana dos motivos ademas de "pedido nuevo".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un dato mal cargado se corrige sin crear un pedido nuevo.
- **SC-002**: Un pedido cargado por error deja de existir para las dos partes.
- **SC-003**: Cero pedidos duplicados por correcciones.
- **SC-004**: Ningun pedido tomado o entregado cambia por accion del cliente.
- **SC-005**: Diego se entera de las dos cosas sin abrir la app.
- **SC-006**: Diego no instala nada.

## Assumptions

- **"Pendiente" es el estado `creacion`**, el que trae un pedido recien creado y
  hasta que Diego lo mueve.
- **La baja borra la fila.** Es posible justamente porque la ventana coincide con
  "sin historial de estados"; fuera de esa ventana la base lo impide, y esa
  coincidencia es lo que evita inventar un estado nuevo y tocar la app.
- **La edicion reusa el formulario de creacion.** Los campos son los mismos y las
  reglas de validacion tambien; construir un segundo formulario seria construir
  una segunda definicion de que es un pedido valido.
- **No se registra quien edito ni cuando.** Nadie trabajo sobre el dato viejo
  dentro de esta ventana. Si algun dia se abre la ventana, esto vuelve a ser una
  pregunta.
- **El aviso de edicion no dice que cambio**, solo que cambio. Diego abre la app
  y ve el pedido al dia; calcular un diff legible es un feature aparte que nadie
  pidio.
