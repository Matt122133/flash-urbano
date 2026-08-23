# Feature Specification: La app de Diego — ver los pedidos y moverlos

**Feature Branch**: `012-app-repartidor`

**Created**: 2026-08-23

**Status**: Draft

**Input**: La app Android de administración, en su rebanada base: Diego ve en su
teléfono los pedidos que entraron por la web y los mueve por el ciclo de vida.

## Lo que hay que arreglar, dicho sin suavizar

**Hoy todo pedido dice "Pendiente" para siempre.** El ciclo de vida existe en la
base desde `007` —creación, aceptación, entrega— y **no hay una sola línea de
código que lo mueva**. `backend/internal/pedidos/pedido.go:44` lo dice con todas
las letras: los mueve la app Android, y el camino no se construyó para no dejar
código sin ejercitar.

Eso significa dos cosas que se acumulan:

- **Diego no tiene dónde ver los pedidos.** Los mira en el panel de
  administración de la web, en una pantalla que se hizo para verificar que el
  backend guardaba, no para trabajar desde la calle.
- **Quien envía ve una promesa congelada.** El historial que entregó `010`
  traduce los tres estados y muestra "Pendiente" en todos, porque nadie los
  cambia. La pantalla está lista para decir la verdad; falta quien la escriba.

**Este feature es la primera entrega de la segunda superficie** que la
constitución describe, y es deliberadamente la rebanada más chica que ya le sirve
a alguien: Diego abre la app, ve lo que hay, y lo mueve.

## Lo que este feature NO hace

- **No genera ninguna ruta.** El cliente todavía no definió qué significa "ruta
  económica" —ordenar las paradas, o navegar por calles— y la diferencia en
  trabajo es enorme. **Hasta que lo defina no se construye.**
- **No trae el panel de totales ni el histórico.** Es la otra mitad de lo que la
  constitución pide para esta superficie, y se difiere igual.
- **No funciona sin señal.** La app le pide los pedidos al servicio. Sin datos lo
  dice claro y reintenta; no guarda nada localmente ni encola cambios.
- **No se publica en Play Store.** Se genera un APK y el dueño del repo se lo
  instala a mano en el teléfono de Diego.
- **No le avisa nada a quien envía.** No hay notificaciones, ni mail, ni push.
  **Pero el cambio igual se ve**: el historial de `010` lee el estado del pedido,
  así que cuando Diego marca una entrega, quien envió lo ve la próxima vez que
  entra a *Mis pedidos*.
- **No agrega datos al pedido.** Nada de foto de entrega, firma ni observaciones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diego ve los pedidos que tiene que atender (Priority: P1)

Diego abre la app en su teléfono y ve los pedidos que entraron por la web, con lo
que necesita para salir a buscarlos: de dónde retira, a dónde lleva, qué es, y a
quién le toca timbre.

**Why this priority**: sin esto no hay app. Y es lo único que ya le sirve aunque
no pueda mover nada todavía: hoy no tiene el dato en el teléfono.

**Independent Test**: se crea un pedido desde la web y aparece en la app.

**Acceptance Scenarios**:

1. **Given** pedidos creados desde la web, **When** Diego abre la app, **Then**
   los ve listados, con su código, sus dos direcciones, el tamaño y quién recibe.
2. **Given** un pedido sin coordenadas de retiro —una calle homónima o fuera del
   índice (FR-014/FR-015 de `011`)—, **When** aparece en la lista, **Then** se
   muestra con su dirección escrita y **sin romperse**.
3. **Given** el teléfono sin señal, **When** Diego abre la app, **Then** dice que
   no pudo traer los pedidos y ofrece reintentar. No muestra una lista vacía como
   si no hubiera trabajo.

---

### User Story 2 - Diego mueve el pedido por su ciclo (Priority: P1)

Diego marca lo que va pasando: que toma el pedido, y que lo entregó.

**Why this priority**: es la mitad que le devuelve algo a quien envía. También es
P1 porque US1 sin esto deja el problema original intacto — todo seguiría diciendo
"Pendiente".

**Independent Test**: se mueve un pedido desde la app y el historial de la web
muestra el estado nuevo.

**Acceptance Scenarios**:

1. **Given** un pedido en creación, **When** Diego lo marca como aceptado,
   **Then** el cambio queda guardado y se ve en *Mis pedidos* de quien envió.
2. **Given** un pedido aceptado, **When** Diego lo marca como entregado,
   **Then** queda en su estado final.
3. **Given** un pedido que Diego marcó por error, **When** lo revierte, **Then**
   vuelve al estado anterior sin dejar el pedido inservible.
4. **Given** el teléfono sin señal, **When** Diego intenta mover un pedido,
   **Then** la app dice que no pudo y **no muestra el cambio como hecho**.

---

### User Story 3 - Diego no ve nunca una pantalla de ingreso (Priority: P2)

La app se instala una vez, se ingresa una vez, y de ahí en más Diego abre y
trabaja.

**Why this priority**: no agrega capacidad, pero sin esto la app es hostil justo
cuando más molesta — parado en la calle, con un paquete en la mano.

**Acceptance Scenarios**:

1. **Given** la app recién instalada, **When** se abre por primera vez, **Then**
   pide el mail y el código, una sola vez.
2. **Given** que Diego usa la app todos los días, **When** pasan meses, **Then**
   no se le vuelve a pedir el código.
3. **Given** una sesión que efectivamente venció, **When** Diego abre la app,
   **Then** se lo dice y le ofrece volver a ingresar, sin perder nada.

### Edge Cases

- **Un pedido de otra persona.** El servicio ya decide qué se ve por la
  credencial y por `ADMIN_EMAILS`; la app no puede pedir "todos los pedidos" por
  otra vía.
- **Dos cambios seguidos sobre el mismo pedido.** Diego toca "entregado" dos
  veces, o toca mientras la señal va y viene. El resultado tiene que ser el mismo
  que tocarlo una vez.
- **El pedido cambió mientras la lista estaba abierta.** Diego tiene la pantalla
  abierta un rato largo y el estado que ve ya no es el real.
- **Un pedido anterior a `011`, sin punto de entrega.** Existe y se muestra.
- **Un valor de estado que la app no conoce.** El servicio guarda el estado como
  texto justamente porque la lista puede crecer. Un valor nuevo se muestra crudo
  antes que romper la pantalla, igual que decidió `010` (FR-006).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La app MUST mostrar los pedidos que el servicio le devuelve, con
  código, dirección de retiro, dirección de entrega, tamaño y cantidad, y nombre
  y teléfono de quien recibe.
- **FR-002**: La app MUST tolerar un pedido **sin coordenadas de retiro** y un
  pedido **sin punto de entrega**, mostrando lo que sí tiene.
- **FR-003**: Diego MUST poder mover un pedido a **aceptación** y a **entrega**.
- **FR-004**: Diego MUST poder **volver un pedido a un estado anterior**. Un
  toque equivocado en la calle no puede quedar clavado.
- **FR-005**: El servicio MUST ofrecer un camino para escribir el estado de un
  pedido, que hoy **no existe**, y MUST rechazar un valor de estado que no sea
  uno de los tres.
- **FR-006**: Cambiar el estado MUST requerir la misma credencial que ya protege
  la lista de administración. **MUST NOT** existir ninguna forma de leer ni de
  escribir pedidos sin identificarse.
- **FR-007**: La app MUST guardar la sesión en el teléfono, y el servicio MUST
  **renovarla cada vez que se usa**, de modo que quien la usa a diario no vuelva
  a ingresar.
- **FR-008**: Cuando no haya conexión, la app MUST decirlo y ofrecer reintentar.
  **MUST NOT** mostrar un cambio como aplicado si no llegó al servicio.
- **FR-009**: Repetir el mismo cambio de estado MUST dejar el pedido igual que
  aplicarlo una vez.
- **FR-010**: El estado que muestra la app MUST poder actualizarse sin cerrar y
  volver a abrir.
- **FR-011**: La app MUST distribuirse como un archivo instalable a mano, sin
  tienda, y el proceso de generarlo MUST estar escrito en el repo.
- **FR-012**: "Aceptación" MUST [NEEDS CLARIFICATION: ¿qué significa exactamente
  para Diego? Las dos lecturas dan apps distintas: (a) "me hago cargo de este
  pedido hoy", que es una selección que hace en su casa a la mañana y que la
  constitución describe como "filter/select which to carry each day"; o (b) "ya
  lo retiré y lo tengo conmigo", que es algo que marca en la puerta del
  remitente. El relevamiento original decía "Aceptación/Recepción", que son
  justamente esas dos cosas distintas.]
- **FR-013**: La app MUST [NEEDS CLARIFICATION: ¿qué pedidos muestra? ¿Todos los
  que existen, sólo los que no están entregados, o los del día? Hoy hay pocos y
  cualquier respuesta funciona; la pregunta es qué le sirve a Diego cuando abra
  la app con cuarenta pedidos viejos adentro.]

### Key Entities

- **Pedido**: no cambia de forma. Lo que cambia es que su **estado** deja de ser
  un campo que nadie escribe.
- **Estado**: creación, aceptación, entrega. Ya existen en la base y en el
  servicio. El cliente descartó un cuarto ("confirmación") el 2026-08-06.
- **Sesión**: la misma que la web. Lo que se agrega es que se renueva al usarse.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diego ve en su teléfono un pedido creado desde la web **sin que
  nadie le mande nada** — ni un mensaje, ni una captura.
- **SC-002**: Un pedido entregado se ve como entregado en *Mis pedidos* de quien
  lo envió. **Cero pedidos que digan "Pendiente" después de haber sido
  entregados.**
- **SC-003**: Diego usa la app durante una jornada entera de reparto **sin ver
  una pantalla de ingreso**.
- **SC-004**: **Cero** cambios de estado perdidos en silencio: todo cambio o
  quedó guardado, o Diego vio que falló.
- **SC-005**: Un toque equivocado se corrige **desde la app**, sin que nadie
  toque la base de datos.
- **SC-006**: **Cero** formas de leer o escribir pedidos sin identificarse.

## Dependencias y decisiones tomadas

- **App Android nativa, en Kotlin**, distribuida como archivo instalable a mano.
  Decisión del 2026-08-23. **Cada actualización es un archivo nuevo instalado a
  mano**, lo que hace que corregir un defecto en la calle sea caro — y es un
  argumento para que esta primera versión sea chica.
- **La ruta y el panel quedan fuera**, hasta que el cliente defina "ruta
  económica".
- **Diego no tiene que ver login**, pero el servicio sí tiene que saber quién
  llama. El dueño del repo pidió primero que no hubiera usuario ni identificación
  y **cambió de posición al ver la consecuencia**: dejar el camino abierto
  publicaría el nombre, la dirección y el teléfono de **todos los destinatarios**
  —terceros que no consintieron nada— y meter una clave dentro del archivo
  instalable la vuelve pública apenas ese archivo existe. Quedó: ingresa una vez,
  y la sesión se renueva sola.
- **La constitución nombra esta superficie** y describe más de lo que este
  feature entrega. No hace falta enmendarla: entregar una parte no contradice el
  alcance, sólo lo cumple de a poco (Principio I).

## Assumptions

- **Diego es el único que usa la app.** El servicio ya admite una lista de
  direcciones administradoras, así que sumar a alguien más no pide código nuevo.
- **La app apunta al servicio en producción.** Para desarrollo hará falta apuntar
  a otro lado, y eso es asunto del plan.
- **La cobertura de datos en Montevideo alcanza.** Si en la calle resulta que no,
  se sabrá con evidencia y la app offline será una decisión con fundamento en vez
  de una suposición.
- **El teléfono de Diego acepta instalar aplicaciones fuera de la tienda.** Es un
  ajuste del teléfono y hay que hacerlo una vez.
- **La máquina de desarrollo puede compilar y probar la app**: tiene el entorno
  de Android completo y dos emuladores, así que la verificación no depende de
  tener el teléfono de Diego a mano — aunque probar en su teléfono sigue siendo
  lo que cierra el feature.
