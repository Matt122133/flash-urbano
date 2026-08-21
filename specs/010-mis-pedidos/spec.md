# Feature Specification: Mis pedidos — el historial y el botón de repetir

**Feature Branch**: `mis-pedidos`

**Created**: 2026-08-21

**Status**: Draft

**Input**: Pedido del dueño del proyecto el 2026-08-21: *"un histórico dentro de
la parte de la cuenta de cada cliente, y dentro de ese histórico un botón que
repita exactamente el mismo pedido"*.

Es el feature que `007` difirió **por su nombre**. Aquel spec lo dejó escrito
dos veces: en *Lo que este feature NO hace* —*"No construye Mis Pedidos. El
historial del cliente —con estados, código, y un botón para repetir un pedido a
la misma dirección— es un feature aparte"*— y en FR-030, que además nombró la
consecuencia asumida: **"si pierde el código, no tiene dónde recuperarlo hasta
que ese feature exista"**.

## Lo que hay que arreglar, dicho sin suavizar

Hoy, en producción:

1. Una persona confirma un pedido, ve el código `FU-0042` en la pantalla, cierra
   la pestaña y **el código deja de existir para ella**. No hay mail de
   confirmación —no se construyó—, y el servicio sí lo tiene guardado pero nadie
   del lado del cliente puede leerlo. La única forma de recuperarlo es
   escribirle a Diego por WhatsApp — exactamente el canal que este producto
   existe para descargar (Principio II).
2. Quien manda el mismo paquete a la misma dirección todas las semanas vuelve a
   tipear **las dos direcciones completas con su cruce de calles, el punto en el
   mapa, el paquete, la cantidad, y el nombre y teléfono de quien recibe**, cada
   vez. En un teléfono. El único dato que `007` le ahorra es el suyo propio —la
   precarga del perfil—; todo lo demás lo escribe de nuevo.
3. `/perfil` —"Mi cuenta"— muestra un formulario de datos personales y nada más.
   Es la única pantalla que el registro le devuelve al cliente, y no contiene ni
   un rastro de lo que hizo con la cuenta.

El punto 2 es el que el dueño del proyecto llama *"pila de valor"*, y tiene
razón por una razón medible: el formulario tiene **más de una docena de campos**
y este feature los deja en **dos decisiones** —cuándo se retira, y confirmar—.

**Nada de esto necesita servicio nuevo.** El servicio ya guarda cada pedido
entero y ya lo sirve autenticado. Lo que falta es la pantalla.

## Lo que este feature NO hace

- **No cambia el estado de ningún pedido**, ni deja cancelarlo. La pregunta 4 al
  cliente —si un pedido se puede cancelar— sigue sin responder, y el valor
  asumido desde `007` es que no. Este historial **muestra** estados; no los
  mueve. Quien los mueve es la app Android, que todavía no existe.
- **No le avisa nada a Diego.** Sigue valiendo el hueco declarado de `007`:
  entre este feature y la app Android, nadie mira los pedidos. Repetir un pedido
  es tan invisible para Diego como crear uno.
- **No manda mails.** Recuperar el código se resuelve con una pantalla, no con
  una notificación.
- **No toca el cálculo del precio.** `web/lib/zonas.ts` y `zona-lookup.ts` quedan
  intactos, y el pedido repetido se cotiza con ellos igual que uno nuevo.
- **No construye el panel de Diego.** `GET /admin/pedidos` ya existe desde `007`
  y sigue sin pantalla; eso es de la app Android.
- **No exporta ni imprime nada** —comprobante, PDF, factura—. Nadie lo pidió.

## Clarifications

### Session 2026-08-21

- Q: ¿Qué hace exactamente el botón de repetir, si *"exactamente el mismo
  pedido"* no puede incluir el *cuándo*? → A: **Precarga el formulario**. Abre
  `/pedido` con todo cargado —las dos direcciones, el punto de retiro, el
  paquete, la cantidad, quien recibe— y **sólo la fecha y la hora de retiro
  vacías**. La persona elige cuándo, ve el precio de hoy y confirma.

  Dos hechos lo obligan y ninguno es opinable: **la fecha de retiro del pedido
  viejo ya pasó** —el servicio rechaza una fecha pasada, validada en hora de
  Montevideo— y **el precio del pedido viejo está congelado a propósito**: la
  columna se guarda así para que un cambio de precios no reescriba pedidos
  viejos. Reusarlo sería cobrar el precio de otro día, que es justo lo que el
  Principio V prohíbe: el sitio **cotiza** desde el punto, no repite un número.

  Se descartaron dos alternativas, las dos por el mismo motivo de fondo:
  **crear el pedido de un toque** con una fecha por defecto —confirma un cobro
  sin que la persona haya visto ni el precio ni el día, y el día que el precio
  de su zona cambie se entera después— y **un diálogo corto que pregunte sólo
  el cuándo y cree el pedido ahí mismo** — sería una **segunda vía de creación
  de pedidos** a mantener en paralelo al formulario, con su propia validación,
  su propio resumen previo y su propio manejo de errores; el Principio III lo
  desaconseja y `007` ya pagó el costo de tener una sola.

  Consecuencia asumida y no escondida: repetir **no es un toque**, son tres
  —repetir, elegir cuándo, confirmar—. Se gana que el precio nunca miente.

- Q: ¿Cómo se ve cada pedido en la lista? → A: **Tarjeta resumida, detalle al
  tocar.** La tarjeta dice código, fecha de retiro, estado, precio y a dónde
  iba; tocarla despliega el resto —las direcciones completas, el paquete, quien
  recibe, cuándo se cargó—. Se descartó mostrarlo todo desplegado: en un
  teléfono cada pedido ocuparía una pantalla entera y el historial dejaría de
  poder recorrerse, que es contra el Principio IV.

- Q: ¿Dónde vive el historial? → A: **Dentro de `/perfil` ("Mi cuenta")**, que
  es a donde ya se llega tocando el nombre en la navegación. Decisión del dueño
  del proyecto: *"dentro de la parte de la cuenta de cada cliente"*. No se
  agrega un ítem nuevo a la navegación principal — `/perfil` ya es el lugar
  donde la persona mira para saber quién está adentro, y `006` decidió eso
  mismo con el mismo argumento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mis pedidos (Priority: P1)

Una persona que ya hizo al menos un pedido entra a *Mi cuenta* y ve la lista de
lo que envió, lo más reciente primero. Cada pedido se identifica por su código
—el mismo `FU-####` que vio al confirmar— con la fecha de retiro, el estado, lo
que pagó y a dónde iba. Tocando uno ve el detalle completo.

**Why this priority**: Cierra sola el agujero que `007` dejó anotado —perder el
código no tiene vuelta— y es la única mitad que **no depende de nada nuevo**: el
servicio ya devuelve todos estos datos. Entregada sola ya vale: le devuelve al
cliente algo por haberse registrado, que hoy es casi nada.

**Independent Test**: Con una cuenta que tenga pedidos guardados, entrar a
`/perfil` y comprobar que aparecen todos, con el código correcto, ordenados del
más nuevo al más viejo, y que el detalle coincide con lo que se cargó. Con una
cuenta sin pedidos, comprobar que la sección lo dice y ofrece hacer el primero.

**Acceptance Scenarios**:

1. **Given** una persona con sesión iniciada y tres pedidos guardados, **When**
   abre *Mi cuenta*, **Then** ve los tres, el más reciente arriba, cada uno con
   su código, fecha de retiro, estado, precio pagado y calle de entrega.
2. **Given** esa misma persona, **When** toca uno de los pedidos, **Then** se
   despliega el detalle: dirección de retiro completa —calle, esquina, número,
   apartamento, cooperativa—, dirección de entrega completa, tamaño y cantidad
   de paquetes, nombre y teléfono de quien recibe, y cuándo se cargó el pedido.
3. **Given** una persona con sesión iniciada y **ningún** pedido, **When** abre
   *Mi cuenta*, **Then** la sección dice que todavía no hizo ninguno y le ofrece
   ir a hacer el primero, sin mostrar una lista vacía sin explicación.
4. **Given** una persona **sin** sesión, **When** abre *Mi cuenta*, **Then** ve
   lo mismo que hoy —la invitación a ingresar— y **ninguna** parte del
   historial: ni la sección, ni un esqueleto de carga, ni un error.
5. **Given** una persona con sesión iniciada, **When** el servicio no responde,
   **Then** la sección dice que no se pudieron cargar los pedidos y ofrece
   reintentar, **sin** vaciar ni romper el resto de *Mi cuenta*: los datos del
   perfil siguen visibles y editables si ya estaban cargados.
6. **Given** dos personas distintas con pedidos, **When** cualquiera de las dos
   abre su historial, **Then** ve **solamente** los suyos.

---

### User Story 2 - Repetir un pedido (Priority: P2)

Desde cualquier pedido del historial, la persona toca *Repetir* y llega al
formulario de pedido con todo cargado menos el cuándo: las dos direcciones, el
punto de retiro sobre el mapa, el tamaño y la cantidad de paquetes, y quien
recibe. Elige la fecha y la hora de retiro, ve el precio que corresponde hoy a
ese punto y confirma. Sale un pedido nuevo, con código nuevo.

**Why this priority**: Es el valor que el dueño del proyecto vino a buscar, y
depende de US1: el botón vive en la tarjeta del historial. Sin la lista no hay
desde dónde repetir.

**Independent Test**: Con un pedido en el historial, tocar *Repetir*, comprobar
que el formulario llega con todos los campos cargados salvo fecha y hora, que el
precio mostrado es el que corresponde al punto **hoy** —no el que dice la
tarjeta, si cambió—, completar el cuándo, confirmar, y comprobar que se creó un
pedido **nuevo y distinto**, con código distinto, con los mismos datos.

**Acceptance Scenarios**:

1. **Given** una persona viendo un pedido en su historial, **When** toca
   *Repetir*, **Then** llega al formulario de pedido con retiro, entrega,
   paquete, cantidad y destinatario ya cargados, y con la fecha y la hora de
   retiro **vacías**.
2. **Given** ese formulario precargado, **When** la persona lo mira antes de
   tocar nada, **Then** el precio que ve es el que corresponde hoy al punto de
   retiro guardado, y **en ningún lugar** se presenta el precio del pedido viejo
   como el precio de este.
3. **Given** ese formulario precargado, **When** completa fecha y hora y
   confirma, **Then** se crea un pedido **nuevo**, con **código propio**, y el
   pedido original queda intacto en el historial.
4. **Given** un pedido cuyo punto de retiro **ya no cae en ninguna zona**
   —porque las zonas se corrigieron desde entonces—, **When** la persona toca
   *Repetir*, **Then** el formulario lo dice, **no muestra precio**, **no deja
   confirmar**, y encamina al contacto directo: nunca inventa una zona ni usa la
   más cercana.
5. **Given** una persona cuya sesión venció mientras miraba el historial,
   **When** toca *Repetir* y confirma, **Then** se le pide ingresar sobre el
   propio formulario y el envío se reanuda solo, sin perder lo precargado — el
   mismo camino que `007` construyó.
6. **Given** una persona que repite el mismo pedido dos veces a propósito,
   **When** confirma las dos, **Then** se crean **dos** pedidos distintos: la
   deduplicación protege contra el doble toque de un mismo intento, no contra
   dos envíos que la persona quiso hacer.

---

### Edge Cases

- **Un pedido cuya calle ya no está en el índice de direcciones** —el índice se
  regenera—: el campo llega vacío o marcado, nunca con un valor que el sistema
  no pueda resolver. Un dato mal rehidratado en silencio es peor que un campo
  vacío, porque se confirma sin que nadie lo mire.
- **Calles homónimas**: hay unos 50 grupos de calles con el mismo nombre en
  Montevideo. Al repetir, la que se recupera tiene que ser la que la persona
  eligió, no la primera que coincide por nombre. El punto guardado es lo que
  desempata.
- **Muchos pedidos**: hoy el servicio devuelve todos, sin límite. Ver
  *Assumptions*: la sección muestra los más recientes y ofrece ver el resto, y
  el umbral a partir del cual esto empieza a doler queda anotado como deuda en
  vez de resuelto de más.
- **Un pedido con el estado movido por la app Android** —`aceptacion`,
  `entrega`—: el historial lo muestra con su nombre en castellano y sin prometer
  nada que nadie esté haciendo. Ver FR-006.
- **Precio distinto al repetir**: es lo esperado, no un error. Manda el de hoy.
- **Repetir desde un teléfono angosto**: la tarjeta se lee entera sin
  desplazamiento horizontal y el botón de repetir se toca con el pulgar.

## Requirements *(mandatory)*

### Functional Requirements

**El historial (US1)**

- **FR-001**: *Mi cuenta* MUST mostrar, a quien tenga sesión iniciada, la lista
  de los pedidos que esa persona creó.
- **FR-002**: La lista MUST ordenarse del pedido más reciente al más viejo.
- **FR-003**: Cada pedido de la lista MUST mostrarse resumido con: su código, la
  fecha de retiro, el estado, el precio que se le cobró, y a dónde iba.
- **FR-004**: Cada pedido MUST poder desplegarse para ver el resto de lo que se
  guardó: dirección de retiro completa, dirección de entrega completa, tamaño y
  cantidad de paquetes, nombre y teléfono de quien recibe, y cuándo se creó.
- **FR-005**: El precio que se muestra de un pedido MUST ser el que se le cobró
  a ese pedido, no el que correspondería hoy a esa dirección.
- **FR-006**: El estado MUST mostrarse con un nombre que la persona entienda y
  que **no prometa una acción que nadie está haciendo**. Mientras la app Android
  no exista, todos los pedidos están en el primer estado, y la pantalla no puede
  sugerir que alguien ya lo aceptó o está por retirarlo. Es la misma regla que
  FR-029 de `007` le impuso a la pantalla de confirmación.
- **FR-007**: Una persona MUST NOT poder ver los pedidos de otra, por ningún
  camino: la lista sale de quién es la credencial, y no existe forma de pedir la
  de otra persona.
- **FR-008**: Sin sesión iniciada, *Mi cuenta* MUST NOT mostrar el historial ni
  ningún vestigio suyo; MUST seguir ofreciendo ingresar, como hoy.
- **FR-009**: Si los pedidos no se pueden cargar, la pantalla MUST decirlo y
  ofrecer reintentar, y MUST NOT romper ni vaciar el resto de *Mi cuenta*.
- **FR-010**: Si la persona no tiene ningún pedido, la sección MUST decirlo y
  ofrecerle crear el primero.
- **FR-011**: El historial MUST leerse entero en un teléfono, sin desplazamiento
  horizontal (Principio IV).

**Repetir (US2)**

- **FR-012**: Cada pedido del historial MUST ofrecer repetirlo.
- **FR-013**: Repetir MUST llevar al formulario de pedido con estos datos ya
  cargados: dirección de retiro —calle, esquina, número, apartamento,
  cooperativa— **y su punto**, dirección de entrega, tamaño de paquete,
  cantidad, y nombre y teléfono de quien recibe.
- **FR-014**: Repetir MUST dejar **vacías** la fecha y la hora de retiro, y MUST
  NOT proponer una por defecto.
- **FR-015**: El precio del pedido repetido MUST resolverse del punto de retiro
  **en el momento de repetir**, con el mismo cálculo que usa cualquier pedido
  nuevo. El precio congelado del pedido original MUST NOT presentarse como el
  precio del nuevo.
- **FR-016**: Antes de dejar cobrar, el punto de retiro guardado MUST
  revalidarse. Si ya no resuelve zona, MUST NOT haber precio ni pedido: la
  pantalla lo dice y encamina al contacto directo. Nunca se adivina una zona ni
  se usa la más cercana (Principio V).
- **FR-017**: Un dato guardado que hoy no se pueda resolver —una calle que ya no
  figura en el índice— MUST llegar vacío o señalado, y MUST NOT llegar con un
  valor aproximado.
- **FR-018**: Confirmar un pedido repetido MUST crear un pedido **nuevo**, con
  código propio, y MUST dejar el original intacto.
- **FR-019**: Cada repetición MUST contar como un intento de envío nuevo, de
  modo que dos repeticiones deliberadas creen dos pedidos, y un doble toque o un
  reintento de red dentro de **una** repetición cree uno solo.
- **FR-020**: Si la sesión venció, confirmar un pedido repetido MUST abrir el
  ingreso **sobre el formulario** y reanudar el envío solo, sin perder lo
  precargado — el camino que ya existe desde `007`.
- **FR-021**: Repetir MUST NOT escribir los datos del pedido en el
  almacenamiento del navegador. El pedido contiene el nombre y el teléfono de
  **quien recibe** —un tercero que no aceptó nada— y `007` decidió
  explícitamente (FR-006a) que ese dato no se deja escrito en el disco de un
  teléfono que puede ser compartido.

**Lo que este feature no puede romper**

- **FR-022**: Cotizar MUST seguir funcionando con el servicio apagado. El
  formulario de pedido MUST NOT quedar acoplado al cliente del servicio por
  culpa de la precarga; la guarda automática que lo vigila MUST seguir en verde,
  y MUST seguir teniendo su control positivo.
- **FR-023**: Este feature MUST NOT cambiar el estado de ningún pedido ni
  permitir cancelarlo.
- **FR-024**: Al cerrar, la ausencia de paginado MUST quedar registrada como
  deuda en `docs/tech-debt-tracker.md`, **con el umbral dicho en números** —a
  partir de cuántos pedidos por persona la respuesta empieza a doler—. Es la
  misma obligación que FR-021a de `007` le puso al precio no verificado: un
  riesgo asumido que vive sólo dentro de un spec cerrado es un riesgo que nadie
  vuelve a mirar.

### Key Entities

- **Pedido guardado**: lo que el servicio ya persiste desde `007`. Código,
  estado, quién lo envía —copia, no referencia—, dirección de retiro con su
  punto, dirección de entrega sin punto, tamaño y cantidad de paquetes, fecha y
  hora de retiro, quien recibe, precio congelado, zona, cuándo se creó. **Este
  feature no le agrega ni un campo**: lo lee.
- **Historial**: la lista de los pedidos de una persona, del más nuevo al más
  viejo. No es una entidad guardada; es una vista de lo anterior.
- **Repetición**: no es una entidad. Es un pedido nuevo cuyos valores iniciales
  salieron de uno viejo. Nada en el sistema recuerda que un pedido fue repetido
  de otro, y este feature no lo introduce: nadie pidió esa trazabilidad y
  agregarla sería una columna que nadie mira (Principio III).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona que perdió el código de su pedido lo recupera **sin
  contactar a nadie**, en dos toques desde la navegación: nombre → Mi cuenta.
- **SC-002**: Repetir un envío pasa de **más de una docena de campos** a **dos
  decisiones**: cuándo se retira, y confirmar.
- **SC-003**: **Cero** pedidos repetidos cobrados a un precio que no sea el
  vigente al momento de confirmarlos.
- **SC-004**: **Cero** casos en que una persona vea un pedido que no es suyo.
- **SC-005**: El historial se lee y se opera entero en la pantalla de un
  teléfono, sin desplazamiento horizontal ni zoom.
- **SC-006**: Con el servicio caído, el precio de un envío se sigue pudiendo
  consultar en el sitio.

## Assumptions

- **El servicio no cambia.** `GET /pedidos` ya devuelve el pedido completo
  —incluido el punto de retiro— ordenado del más nuevo al más viejo, y ya sale
  de la credencial sin aceptar parámetro que lo esquive. Este feature se
  construye contra lo que existe. Si al planificar aparece un dato que la
  respuesta no trae, hay que decirlo explícitamente y decidirlo ahí, no
  asumirlo.
- **No hay paginado, y se asume que todavía no hace falta.** El servicio
  devuelve todos los pedidos de la persona sin límite. Con el volumen actual del
  negocio eso es irrelevante; con un cliente que envíe a diario durante un año
  deja de serlo. El supuesto es que este feature **no** construye paginado
  (Principio III) y que la sección muestra los más recientes y ofrece ver el
  resto de lo ya recibido. **Queda como deuda anotada, con el umbral dicho**, no
  como problema resuelto.
- **El estado va a decir siempre lo mismo por ahora.** Hasta que exista la app
  Android, todo pedido está en el primer estado. La pantalla se construye para
  los tres estados que el servicio acepta, pero se asume que en producción hoy
  se ve uno solo, y la copia se escribe sabiendo eso.
- **Repetir no vuelve a validar los datos de quien recibe.** Se copian tal como
  se guardaron; si esa persona cambió de teléfono, quien envía lo corrige en el
  formulario como lo haría en cualquier pedido.
- **La dirección de entrega no tiene punto guardado** —`003` la dejó como texto
  a propósito— así que al repetir se precarga como texto, igual que se cargó.
- **Se reusa la maquinaria de precarga de `007`.** El formulario ya acepta
  valores iniciales y ya sabe revalidar un punto guardado antes de cobrar; este
  feature le da otra fuente, no una segunda implementación.
