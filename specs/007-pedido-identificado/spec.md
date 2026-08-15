# Feature Specification: El pedido se crea identificado y se guarda

**Feature Branch**: `pedido-identificado`

**Created**: 2026-08-12

**Status**: Draft

**Input**: Cierra la mitad que `006` dejó abierta a propósito. `006` construyó la
identidad —quién es el cliente, cómo se identifica, dónde viven sus datos— y
**no tocó el formulario de pedido** (FR-007b), porque exigir registro para
llegar a una pantalla que no guarda nada no le compra nada al cliente. Este
feature pone la puerta y guarda el pedido, en el mismo cambio.

Alcance decidido por el dueño del proyecto el 2026-08-12: **las dos mitades
juntas**, no la puerta sola.

## Lo que hay que arreglar, dicho sin suavizar

Hoy, en producción, en un sitio indexable desde `004`:

1. Un visitante anónimo completa el formulario de pedido y lo confirma. La
   constitución v3.0.0 dice **"No package is created without an identified
   customer"**. El código dice que sí.
2. `web/app/pedido/page.tsx` lo invita explícitamente: *"Podés cargarlo como
   invitado, sin necesidad de crear una cuenta."*
3. Al confirmar, la pantalla responde **"¡Pedido cargado! Nos pondremos en
   contacto para confirmar el retiro."**

El punto 3 es el peor de los tres y no estaba anotado en ningún lado hasta hoy.
**No se guarda nada, no se le avisa a nadie, y nadie se va a poner en contacto.**
Los puntos 1 y 2 son una contradicción entre dos documentos del repo; el punto 3
es una promesa que el producto le hace a una persona real y que no puede
cumplir. Un cliente que use ese formulario hoy se queda esperando un retiro que
nadie agendó.

Esto reordena la prioridad del feature: la puerta cierra la violación de la
constitución, pero **lo que cierra el daño al cliente es que el pedido exista de
verdad y que alguien lo lea**. Por eso la pregunta de si Diego se entera no es un
detalle de alcance — es la que decide si este feature resuelve el problema o lo
maquilla.

## Lo que este feature NO hace

- **No construye la app Android**, y por lo tanto **no le avisa a Diego**. La
  notificación de pedido nuevo es de la app: le llega ahí, y desde ahí entra a
  operar. Decidido el 2026-08-12. La consecuencia queda dicha abajo y no
  escondida: entre que sale este feature y sale la app, **nadie mira los
  pedidos**.
- **No construye "Mis Pedidos".** El historial del cliente —con estados, código,
  y un botón para repetir un pedido a la misma dirección— es un feature aparte,
  decidido así el 2026-08-12. Acá el cliente ve su código al confirmar y nada
  más.
- **No agenda ni rutea nada.** El Principio V es explícito: sólo el precio está
  automatizado, la logística sigue siendo manual. Diego acepta y planifica.
- **No toca el cálculo del precio en el navegador.** `web/lib/zonas.ts` y
  `web/lib/zona-lookup.ts` siguen intactos, y la Historia 1 existe para
  protegerlos.

## Clarifications

### Session 2026-08-12

- Q: ¿Diego se entera de un pedido nuevo en este feature? → A: **No acá. Le
  llega una notificación en la app Android**, y desde ahí entra a hacer el resto
  —que se define cuando se haga la app—. Esto convierte a **FR-029 en el
  requisito que carga con la consecuencia**: mientras no exista la app, la
  pantalla de confirmación no puede prometer un contacto que nadie va a hacer.
  Se descartó una vista web mínima de pedidos del día: sería una superficie
  provisoria que la app reemplaza entera, y construir dos veces la misma
  pantalla es exactamente el tipo de trabajo que el Principio III evita.
  **Queda un hueco declarado y sin resolver**: ver *"El hueco que deja el
  diferimiento"* más abajo.
- Q: ¿El servicio verifica el precio al guardar? → A: **No. Guarda el punto de
  retiro y el precio declarado.** El punto es lo que hace que el precio sea
  **recalculable en cualquier momento posterior**, así que no se pierde la
  capacidad de auditar: se pospone. Se descartó resolver la zona del lado del
  servidor porque duplicaría la geometría que decide la plata en dos lugares, y
  dos fuentes de verdad que se desincronizan producen el peor de los defectos
  posibles acá —el cliente ve un precio y se le cobra otro—. El
  [ADR zone-based-automatic-pricing](../../docs/decisions/zone-based-automatic-pricing.md)
  queda intacto. **El riesgo residual es real y acotado**: alguien que arma la
  petición a mano puede declarar el precio que quiera, y hoy el único control es
  que Diego mira el pedido antes de aceptarlo. Es una decisión tomada con el
  riesgo a la vista, no un descuido.
- Q: ¿El cliente ve sus pedidos anteriores? → A: **En este feature no.** La
  sección *Mis Pedidos* —historial con estados, código, y un botón para repetir
  un pedido a la misma dirección— **es un feature aparte**. Acá el cliente ve el
  código en la pantalla de confirmación. Consecuencia asumida: si lo pierde, no
  tiene dónde recuperarlo hasta que ese feature exista.
- Q: ¿Dónde ocurre el ingreso cuando alguien sin sesión toca confirmar? → A:
  **Sobre `/pedido`, en un diálogo. No se navega.** Es posible porque los dos
  caminos de `006` funcionan sin abandonar la página: Google usa Identity
  Services, que abre un popup, y el código por mail es un envío al servicio.
  Dos consecuencias, y la segunda es la que decide: FR-007/FR-008/FR-009 se
  vuelven casi triviales —no hay nada que restaurar porque nunca se fue— y **el
  borrador nunca toca el almacenamiento del navegador**. Eso importa porque el
  formulario contiene el nombre y el teléfono de **quien recibe**, un tercero
  que no aceptó nada: dejarlo escrito en el disco de un teléfono compartido es
  guardar dato personal ajeno sin necesitarlo. Se descartaron `sessionStorage` y
  `localStorage` por eso, no por complejidad. `/ingresar` **sigue existiendo**
  como pantalla propia para quien entra desde la navegación.
- Q: Al cerrarse el diálogo con la sesión ya iniciada, ¿el pedido se envía solo?
  → A: **Sí, se reanuda, y no en silencio**: se ve que está enviando y se
  aterriza en la confirmación. Tocar *Confirmar pedido* ya fue el
  consentimiento, y el precio no pudo cambiar mientras el diálogo estaba abierto
  porque el punto no se movió. Volver a pedirlo es fricción contra el Principio
  IV sin protección adicional, y deja a la persona frente a un formulario sin
  saber si funcionó.
- Q: ¿Cómo se distingue un doble envío de dos pedidos legítimamente iguales? →
  A: **Con una clave de idempotencia que genera el navegador, una por intento de
  envío.** Los reintentos de red y la reanudación posterior al ingreso comparten
  clave; empezar un pedido nuevo genera una nueva. Se descartó deduplicar por
  contenido dentro de una ventana de tiempo, y el motivo es del negocio y no
  técnico: **un cliente que manda dos paquetes iguales a la misma dirección el
  mismo día es normal**, y esa estrategia se comería el segundo en silencio. El
  resultado no sería "un pedido duplicado de menos" sino **un paquete que nadie
  pasa a buscar**, descubierto recién cuando el cliente reclama.

## El hueco que deja el diferimiento

Diferir el aviso a la app Android deja un tramo en el que **un cliente carga un
pedido, el pedido se guarda, y Diego no se entera**. Dura desde que sale este
feature hasta que sale la app.

Es mejor que hoy —el pedido existe, en vez de evaporarse— pero **no es
inofensivo**: `/pedido` es público, está indexado desde `004` y vive en un
dominio propio desde `009`. Alguien puede pedir un retiro real en ese tramo.

Este spec **no resuelve el hueco**: lo nombra, y le pone dos obligaciones a
`007` para que no se convierta en la misma promesa falsa de hoy con otra
redacción:

- **FR-029** — la confirmación dice la verdad sobre qué va a pasar después.
- **FR-031** — existe una forma de que una persona lea los pedidos guardados sin
  abrir la base de datos a mano.

FR-031 es el mínimo indispensable, no un panel: sin él, "el pedido se guardó" es
un acto de fe incluso para nosotros, y el primer reclamo de un cliente se
diagnostica con `psql`. La forma que tome es decisión del plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar sigue sin pedir nada (Priority: P1)

Alguien que nunca oyó hablar de Flash Urbano entra al sitio, escribe una calle y
una esquina, ve el punto en el mapa y ve el precio. No se le pide cuenta, no se
le pide mail, no se le pide nada.

Esta historia **no agrega funcionalidad: defiende la que ya existe**, y se
repite de `006` a propósito. Es el feature donde más fácil se rompe: `006`
introdujo la sesión pero dejó el formulario afuera, y acá el formulario es
justamente lo que se toca. La tentación estructural de este trabajo es poner la
puerta un paso antes de donde va.

**Why this priority**: Es el Principio II de la constitución y la frase que la
enmienda v3.0.0 subraya al retirar el pedido anónimo: *"la cotización es
pública, el pedido no"*. Poner una puerta delante del precio le costaría al
negocio al visitante que sólo estaba preguntando cuánto sale.

**Independent Test**: Con el servicio de backend **detenido**, entrar al sitio y
cotizar de punta a punta sin un solo error. Si cotizar depende de que una
request salga bien, esta historia falló.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta y sin sesión, **When** carga calle y
   esquina de retiro, **Then** ve el punto en el mapa y el precio de la zona,
   sin que se le pida identificarse.
2. **Given** el servicio de backend completamente caído, **When** un visitante
   cotiza, **Then** el precio se muestra igual y no aparece ningún error.
3. **Given** un visitante sin sesión, **When** recorre el formulario entero
   hasta el paso anterior a confirmar, **Then** no se le pidió identificarse en
   ningún momento: la puerta está en el último paso, no en la visita.

---

### User Story 2 - El pedido existe después de confirmarlo (Priority: P1)

Un cliente identificado completa el formulario, confirma, y el pedido queda
guardado. Cierra el navegador, vuelve, y el pedido sigue existiendo. Tiene un
código corto para nombrarlo por WhatsApp.

**Why this priority**: Es lo único que convierte el formulario en un producto.
Hoy la pantalla dice "¡Pedido cargado!" y no hay ningún pedido en ningún lado.
Sin esta historia, la puerta de la Historia 3 sólo agrega fricción a un flujo
que igual no lleva a nada.

**Independent Test**: Confirmar un pedido, cerrar todo, y comprobar desde afuera
del navegador —consultando el servicio— que el pedido está, con sus datos
completos y ligado al usuario que lo creó.

**Acceptance Scenarios**:

1. **Given** un cliente identificado con el formulario completo, **When**
   confirma, **Then** el pedido queda guardado y la pantalla le muestra su
   código corto.
2. **Given** un pedido recién confirmado, **When** el cliente cierra el
   navegador y vuelve al día siguiente, **Then** el pedido sigue existiendo con
   los mismos datos.
3. **Given** un pedido guardado, **When** su cliente edita después su perfil
   —se muda, cambia el teléfono—, **Then** el pedido **no cambia**: conserva la
   dirección y el teléfono con los que se creó.
4. **Given** un cliente que toca confirmar dos veces, o cuya conexión reintenta
   el envío, **When** el servicio recibe el pedido más de una vez, **Then**
   queda **un solo** pedido.
5. **Given** un pedido guardado, **When** se lo consulta, **Then** está en el
   primer estado del ciclo de vida (creación), y ese estado es el único que este
   feature sabe escribir.

---

### User Story 3 - Confirmar exige identificarse, y no te hace perder lo cargado (Priority: P1)

Un visitante sin sesión completa el formulario entero. Al confirmar, se le abre
el ingreso **encima de la misma pantalla**. Se identifica —con Google o con un
código—, el diálogo se cierra, el envío se reanuda solo, y aterriza en la
confirmación con su código de pedido. Nunca salió de `/pedido` y no volvió a
escribir nada.

**Why this priority**: Es lo que hace cierta la constitución v3.0.0. Va con la
misma prioridad que la Historia 2 y no antes: la puerta sola, sin pedido
guardado, es la situación que `006` decidió evitar.

La segunda mitad de la historia —no perder lo cargado— **no es un extra**. El
formulario son varias pantallas de teléfono, con una dirección resuelta contra
el índice de calles y un punto que la persona puede haber arrastrado a mano
dentro de su cuadra. Una puerta que descarta todo eso convierte el registro en
un castigo, y choca de frente con el Principio IV.

**Independent Test**: Sin sesión, llenar el formulario completo, confirmar,
atravesar el ingreso, y comprobar que el pedido se creó sin haber vuelto a
escribir un campo ni haber tocado confirmar dos veces.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión con el formulario completo, **When**
   confirma, **Then** se le abre el ingreso sobre la misma pantalla y **no** se
   crea ningún pedido.
2. **Given** ese mismo visitante, **When** completa el ingreso, **Then** el
   envío se reanuda solo, se ve que está enviando, y termina en la confirmación
   con su código — sin haber vuelto a escribir nada ni a tocar confirmar.
3. **Given** un visitante que llega a la puerta y **desiste** de ingresar,
   **When** cierra el diálogo, **Then** lo que cargó sigue ahí, puede seguir
   cotizando, y no se creó ningún pedido.
4. **Given** un cliente cuya sesión venció mientras llenaba el formulario,
   **When** confirma, **Then** se le abre el ingreso y no pierde lo cargado — el
   vencimiento se comporta igual que no haber tenido sesión.
5. **Given** un cliente con dirección guardada en su perfil que escribió **otra**
   en el formulario, **When** se identifica desde el diálogo, **Then** el pedido
   sale con la que escribió: la precarga no pisa lo tipeado.
6. **Given** un visitante que atravesó el ingreso, **When** revisa el
   almacenamiento del navegador, **Then** el borrador del formulario **no está
   ahí** — ni el nombre ni el teléfono de quien recibe.
7. **Given** el copy de `/pedido`, **When** cualquiera entra a la pantalla,
   **Then** no dice que se puede pedir como invitado.

---

### User Story 4 - El formulario ya sabe quién soy (Priority: P2)

Un cliente identificado que ya cargó su perfil entra a pedir y encuentra su
nombre, su teléfono y su dirección de retiro —calle, esquina, número, apto,
cooperativa y el punto— ya puestos. Sólo completa lo que cambia de un envío a
otro: qué manda, cuándo lo retiran, y a quién se lo entregan.

**Why this priority**: Es el valor que `006` prometió y todavía no entrega. Es
la respuesta concreta a *"¿para qué me registro?"*, y es el Principio IV —mínimo
tipeo en un teléfono— aplicado a la superficie de mayor prioridad del producto.
Va en P2 porque el feature ya sirve sin esto: un pedido guardado detrás de una
puerta resuelve el problema del negocio; la precarga lo hace agradable.

**Independent Test**: Con un perfil cargado, entrar a `/pedido` y comprobar que
los campos vienen llenos y que el punto de retiro está en el mapa donde el
cliente lo había dejado.

**Acceptance Scenarios**:

1. **Given** un cliente identificado con perfil completo, **When** abre el
   formulario, **Then** su nombre, teléfono y dirección de retiro vienen
   cargados, con el punto en el mapa.
2. **Given** un cliente con la dirección precargada, **When** la corrige para
   este envío, **Then** el pedido usa lo corregido y **su perfil no cambia**.
3. **Given** un cliente identificado **sin** dirección guardada, **When** abre el
   formulario, **Then** ve el formulario vacío en esa parte y puede cargarla
   normalmente, sin ningún error.
4. **Given** un cliente cuyo punto guardado **ya no cae** dentro de la cuadra
   que declara su dirección guardada, **When** abre el formulario, **Then** el
   sistema no cobra sobre ese punto sin revalidarlo: o lo resuelve de nuevo, o
   se lo pide.

---

### User Story 5 - El pedido se puede leer sin abrir la base (Priority: P3)

Una persona con permiso puede ver que los pedidos existen y qué dicen, sin
ejecutar consultas SQL a mano.

**Why this priority**: No es la vista de Diego —eso es la app Android, y el
aviso de pedido nuevo le llega ahí—. Es el mínimo que hace falta para que
*"el pedido se guardó"* sea verificable por alguien que no tenga la base
abierta, y para que el primer reclamo de un cliente no se diagnostique con
`psql`. Va en P3 porque el feature entrega valor sin ella: es
instrumentación, no producto.

**Independent Test**: Crear un pedido desde el sitio y recuperarlo desde afuera
del navegador sin tocar la base de datos directamente.

**Acceptance Scenarios**:

1. **Given** un pedido recién creado, **When** alguien con permiso lo consulta,
   **Then** lo ve completo, con su código y su estado.
2. **Given** un usuario cualquiera identificado, **When** intenta consultar
   pedidos que no son suyos, **Then** es rechazado.

---

### Edge Cases

- **El punto guardado en el perfil quedó en otra zona.** `006` guardó el punto
  de retiro y `FR-019b` de ese feature dijo explícitamente que su validez **se
  verifica cuando se usa para cobrar, no cuando se guarda**. Este feature es
  quien lo usa para cobrar. Un punto guardado en agosto, con el índice de calles
  regenerado en octubre, puede caer en otra cuadra —o en otra zona, o sea a otro
  precio— sin que nadie haya tocado nada. Está registrado como deuda abierta y
  este feature es donde se vuelve plata.
- **El punto de retiro cae fuera de toda zona.** No hay precio, y sin precio no
  hay pedido: el Principio V prohíbe adivinar la zona y prohíbe caer a la más
  cercana. El flujo termina en contacto directo, igual que hoy al cotizar.
- **Doble confirmación.** Un doble toque en un teléfono, un reintento de la red,
  o la reanudación posterior al ingreso pisándose con un envío manual, no pueden
  dejar dos pedidos que Diego después tiene que desempatar. Lo resuelve la clave
  de idempotencia (FR-016), no una comparación de contenido.
- **Dos pedidos legítimamente iguales.** El mismo cliente manda dos paquetes
  iguales a la misma dirección el mismo día. **Son dos pedidos** y los dos tienen
  que existir. Es el caso que descarta deduplicar por contenido, y el que
  convierte un falso positivo en un paquete sin retirar.
- **El servicio está caído al confirmar.** Cotizar tiene que seguir andando
  (Historia 1) y confirmar tiene que fallar **diciendo la verdad** —el pedido no
  se creó— sin descartar lo que la persona cargó.
- **La fecha de retiro ya pasó cuando el pedido llega.** Alguien llena el
  formulario a las 23:58 y confirma a las 00:03 pidiendo retiro "hoy". Lo que el
  navegador validó al escribir dejó de ser cierto.
- **Alguien le manda un pedido al servicio sin pasar por el sitio.** El precio se
  calcula en el navegador desde `002`; nada impide armar la request a mano con
  un precio inventado. Es el caso que hace de la clarificación 2 una pregunta de
  plata y no de arquitectura.
- **El cliente cambia su perfil después de pedir.** El pedido guardado no puede
  cambiar: `006` ya decidió que el pedido **copia** la dirección en vez de
  referenciarla, para que quien se muda no reescriba adónde fue Diego hace seis
  meses.
- **Dos pestañas, dos pedidos.** Alguien deja una pestaña abierta con el
  formulario a medias y carga otro pedido en otra. Los dos son válidos y
  distintos; ninguno pisa al otro.
- **Un cliente sin nombre ni teléfono en el perfil.** `006` permite la fila a
  medias (`perfil_completo = false`) para el ingreso interrumpido. El pedido no
  puede quedar sin el nombre y el teléfono de quien envía.

## Requirements *(mandatory)*

### Functional Requirements

**Cotizar abierto — el invariante que no se toca**

- **FR-001**: El sistema MUST permitir cotizar —cargar calle y esquina, ver el
  punto y ver el precio— sin cuenta, sin sesión y sin ninguna comunicación con
  el servicio de backend.
- **FR-002**: El cálculo del precio que se le muestra al visitante MUST seguir
  ocurriendo en el navegador, con los datos que el sitio ya sirve.
- **FR-003**: La puerta de identificación MUST estar en el paso de confirmar, y
  MUST NOT estar en la entrada a la pantalla, en la carga de la dirección, ni en
  ningún punto anterior a la confirmación.
- **FR-004**: La guarda automática que hoy verifica que cotizar no dependa del
  servicio MUST seguir en verde, y MUST cubrir el formulario después de este
  feature. Si la puerta obliga a que el formulario conozca la sesión, la guarda
  se adapta pero **no se retira**.

**La puerta**

- **FR-005**: El sistema MUST NOT crear un pedido sin un usuario identificado.
- **FR-006**: Un intento de confirmar sin sesión válida MUST abrir el ingreso
  **sin navegar fuera de `/pedido`**, y MUST NOT crear ningún pedido hasta que
  la identificación se complete.
- **FR-006a**: El borrador del formulario MUST NOT escribirse en el
  almacenamiento del navegador para sobrevivir al ingreso. Vive mientras vive la
  pestaña. El motivo es de dato ajeno, no de simplicidad: el formulario lleva el
  nombre y el teléfono de quien recibe, que no consintió nada, y el teléfono
  desde donde se pide puede ser compartido.
- **FR-007**: Completar el ingreso MUST dejar el formulario tal como estaba,
  incluido el punto de retiro. Ningún dato precargado del perfil MUST pisar algo
  que la persona ya haya escrito: identificarse no puede reescribirle la
  dirección que acaba de tipear.
- **FR-007a**: Completar el ingreso desde la confirmación MUST **reanudar el
  envío** sin exigir un segundo toque, y MUST NOT hacerlo en silencio: la
  persona ve que está enviando y termina en la pantalla de confirmación.
- **FR-008**: Desistir del ingreso MUST devolver al formulario con lo cargado
  intacto y **sin** haber creado ningún pedido.
- **FR-009**: Una sesión vencida MUST comportarse igual que la ausencia de
  sesión: se abre el ingreso, no se pierde lo cargado, y no se muestra una
  pantalla rota.
- **FR-010**: El servicio MUST rechazar un pedido que llegue sin credencial de
  sesión válida, con independencia de lo que haga el sitio.
- **FR-010a**: `/ingresar` MUST seguir existiendo como pantalla propia para
  quien se identifica desde la navegación. El diálogo se suma al camino que ya
  existe, no lo reemplaza.

**El pedido que se guarda**

- **FR-011**: El sistema MUST guardar el pedido de forma persistente, ligado al
  usuario que lo creó, y MUST sobrevivir al cierre del navegador y al reinicio
  del servicio.
- **FR-012**: El pedido MUST guardar, como mínimo: quién envía (nombre y
  teléfono), la dirección de retiro completa con su punto, la dirección de
  entrega, qué se envía y en qué cantidad, cuándo se retira, y el nombre y
  teléfono de quien recibe.
- **FR-013**: El pedido MUST **copiar** los datos del perfil que usa, no
  referenciarlos. Un cambio posterior en el perfil MUST NOT alterar un pedido ya
  creado.
- **FR-014**: El pedido MUST llevar un ciclo de vida de tres estados —creación,
  aceptación, entrega— guardado de forma que agregar o cambiar un estado sea una
  migración y no un cambio de tipo. Este feature sólo escribe el primero.
- **FR-015**: El pedido MUST llevar un código corto legible, del estilo
  `FU-0142`, único, apto para nombrarlo por WhatsApp y para dictarlo por
  teléfono.
- **FR-016**: Confirmar el mismo pedido más de una vez —doble toque, reintento
  de red, reanudación después del ingreso— MUST dejar un solo pedido. La
  identidad del intento MUST venir de una **clave de idempotencia que genera el
  navegador**, una por intento de envío: los reintentos y la reanudación
  comparten clave, y empezar un pedido nuevo genera una nueva.
- **FR-016a**: Recibir una clave de idempotencia ya usada MUST devolver **el
  pedido que se creó con ella**, no un error y no un pedido nuevo. Quien
  reintenta porque no supo si funcionó tiene que llegar al mismo lugar que si
  hubiera funcionado a la primera.
- **FR-016b**: El sistema MUST NOT deduplicar pedidos por su contenido. Dos
  pedidos iguales del mismo cliente el mismo día son un caso normal del negocio
  —dos paquetes iguales a la misma dirección— y descartar el segundo produce un
  paquete que nadie pasa a buscar.
- **FR-017**: Un usuario MUST NOT poder leer ni modificar los pedidos de otro.
- **FR-018**: Los cambios de forma de la base MUST aplicarse por migraciones
  versionadas en el repo, con camino de ida desde una base vacía.

**El precio del pedido**

- **FR-019**: El precio que se guarda MUST derivarse **del mismo punto** que
  produjo el precio que se le mostró al cliente, sin pasar por ningún estado
  intermedio que pueda quedar desincronizado. Un pedido no puede quedar guardado
  con un precio que su cliente nunca vio.

  *Redactado así a propósito.* La versión anterior decía "MUST ser el mismo que
  el cliente vio", que **no es verificable por nadie**: el servicio no sabe qué
  vio el cliente, y no hay prueba automática del sitio que renderice la
  pantalla. Como propiedad del mapeo —el precio sale del punto, en el momento de
  cerrar el pedido— sí se puede probar, y es lo que de verdad protege contra el
  defecto real: que la zona y el precio se arrastren en el estado del formulario
  y queden viejos respecto de la ubicación.
- **FR-020**: **El sitio** MUST NOT permitir confirmar un pedido cuyo punto de
  retiro caiga fuera de todas las zonas. Sin zona no hay precio, y sin precio no
  hay pedido: el flujo termina en contacto directo.
- **FR-020a**: El servicio **no** comprueba que el punto caiga dentro de una
  zona, y este spec no finge que sí. Comprobarlo exige la geometría del lado del
  servidor, que la clarificación del 2026-08-12 descartó. La consecuencia es
  concreta y hay que tenerla escrita: **una petición armada a mano con un punto
  fuera de cobertura se guarda igual**. Cae bajo la misma deuda que FR-021a
  obliga a registrar, y se cierra por el mismo camino — el día que el servicio
  conozca las zonas, conoce las dos cosas.

  Un `MUST NOT` del *sistema* que ningún componente hace cumplir es exactamente
  la clase de promesa vacía que este feature vino a sacar de la pantalla de
  confirmación. Por eso se parte en dos: lo que el sitio garantiza, y lo que
  nadie garantiza.
- **FR-021**: El sistema MUST guardar el punto de retiro junto al precio, de modo
  que el precio de cualquier pedido sea **recalculable** después sin depender de
  lo que declaró el cliente. El servicio **no** resuelve la zona por su cuenta en
  este feature (decidido el 2026-08-12): no se duplica la geometría que decide
  la plata. La verificación se pospone, no se pierde — y eso es cierto **sólo**
  gracias a que el punto queda guardado, así que guardar el punto no es un
  detalle del esquema sino lo que sostiene esta decisión.
- **FR-021a**: El sistema MUST NOT exponer el precio como algo que el cliente
  elige. Que hoy no se verifique del lado del servidor es una decisión tomada
  con el riesgo a la vista —quien arma la petición a mano puede declarar
  cualquier monto **y también un punto fuera de cobertura** (FR-020a)— y el
  único control es que Diego mira el pedido antes de aceptarlo. Ese riesgo
  residual MUST quedar registrado como deuda al cerrar este feature, no
  implícito en el código.
- **FR-022**: El punto de retiro guardado en un perfil MUST NOT usarse para
  cobrar sin revalidar que sigue cayendo dentro de la cuadra que declara esa
  dirección. Es la contraparte que `FR-019b` de `006` dejó pendiente para este
  feature.

**La precarga del perfil**

- **FR-023**: El formulario MUST venir precargado con el nombre, el teléfono y
  la dirección de retiro guardados en el perfil, incluidos apto y cooperativa.
- **FR-024**: Editar un campo precargado MUST afectar sólo a este pedido, y
  MUST NOT modificar el perfil.
- **FR-025**: Un perfil sin dirección guardada MUST dejar el formulario
  utilizable y vacío en esa parte, sin errores.
- **FR-026**: El pedido MUST tener nombre y teléfono de quien envía, también
  cuando el perfil del usuario esté incompleto.

**El copy**

- **FR-027**: `/pedido` MUST NOT decir que se puede pedir como invitado.
- **FR-028**: `/pedido` MUST NOT decir que hay que marcar el punto en el mapa.
  Dejó de ser cierto en `003` —el punto sale del cruce de calles y sólo se
  arrastra dentro de la cuadra declarada— y es lo primero que lee quien llega
  desde un buscador, con el sitio indexable desde `004`.
- **FR-029**: La pantalla de confirmación MUST NOT prometer un contacto que el
  sistema no pueda respaldar. Con el aviso a Diego diferido a la app Android, la
  frase actual —*"Nos pondremos en contacto para confirmar el retiro"*— es falsa
  y MUST cambiar en este feature. Lo que la reemplace MUST decir que el pedido
  quedó registrado y con qué código. **Este es el requisito que carga con la
  consecuencia del diferimiento**, y cerrar el feature sin él reemplaza una
  promesa falsa por otra.

  **Enmendado el 2026-08-14.** Hasta esa fecha este requisito exigía una segunda
  cosa: *"y por dónde se coordina de verdad mientras tanto"*, que la pantalla
  cumplía enlazando a `/contacto` para escribir por WhatsApp con el código. El
  dueño del proyecto lo sacó al verlo funcionando, con este motivo: **la
  coordinación la inicia Diego desde la app**, que va a tener el contacto del
  cliente, y el frente no tiene por qué empujar al cliente a WhatsApp — que es
  exactamente el canal manual que el producto existe para reemplazar
  (Principio II).

  **Lo que la enmienda deja abierto, y no hay que perder**: mientras la app
  Android no exista, ese enlace era el único camino por el que un pedido llegaba
  a un humano. El pedido queda en la base, pero **nada le avisa a Diego** y hoy
  se leen con `curl`. O sea que entre esta fecha y la app, un cliente que pide
  recibe un código y silencio. Se acepta porque el sitio todavía no se promociona
  y `/contacto` sigue existiendo en la navegación. Queda como fila en
  `docs/tech-debt-tracker.md`, y **es un bloqueante para promocionar el sitio**,
  no una deuda cosmética.

**Que el cliente vea sus pedidos**

- **FR-030**: El cliente MUST ver el código de su pedido al confirmarlo. La
  sección *Mis Pedidos* —historial, estados, y repetir un pedido a la misma
  dirección— es un feature aparte y NO entra acá (decidido el 2026-08-12). El
  spec lo deja escrito para que el diferimiento sea una decisión registrada y no
  un olvido, y porque su existencia futura condiciona qué se guarda hoy: un
  historial que se va a mostrar después necesita que el pedido conserve desde
  ahora lo que se le va a querer mostrar.

**Que los pedidos se puedan leer**

- **FR-031**: MUST existir una forma de leer los pedidos guardados sin abrir la
  base de datos a mano. No es la vista de Diego —esa es la app— sino el mínimo
  que hace verificable que el pedido existe. Sin esto, *"el pedido se guardó"*
  es un acto de fe también para nosotros.
- **FR-032**: El acceso a pedidos ajenos MUST estar cerrado también por esa vía.
  Sumar una forma de leer no puede sumar una forma de leer lo de otro.

**Higiene del repositorio público**

- **FR-033**: La protección contra subir secretos MUST NOT depender de la rama
  en la que se esté parado. Hoy `backend/.env` sólo está ignorado por un archivo
  que nació en la rama de `006`; el patrón tiene que valer para todo el
  repositorio. Ya ocurrió una vez que el `.env` quedara preparado para commit, y
  lo frenó por casualidad un control que buscaba otra cosa.

**Después de confirmar**

*Los dos requisitos de abajo se agregaron el **2026-08-14**, con el feature ya
implementado y probándose en un teléfono. Salieron de mirar la pantalla real, no
de la planificación — que es exactamente para lo que sirve verificar a mano.
Entran acá en vez de a un feature aparte porque los dos son sobre la pantalla que
`007` acaba de construir, y ninguno agrega superficie: son cinco líneas cada uno,
dentro de archivos que ya están en `covers:`. Lo que sí agregan es **verificación
manual**, y por eso ganan tareas propias en vez de colarse.*

*No confundir FR-035 con “repetir pedido”, que FR-030 difiere explícitamente a
otro feature: aquello es recuperar un pedido del historial: esto es no vaciar un
formulario que la persona tiene delante.*

- **FR-034**: Con un pedido ya confirmado en pantalla, `/pedido` MUST mostrar
  sólo el comprobante. El encabezado —el título *Crear pedido* y la instrucción
  de escribir la calle y la esquina— MUST desaparecer: invita a hacer algo que
  se acaba de hacer, arriba de la constancia de haberlo hecho. Al volver al
  formulario MUST reaparecer. Es el mismo criterio que FR-027 y FR-028 aplicado
  al estado siguiente de la pantalla: **el texto tiene que ser cierto en el
  momento en que se lee**.
- **FR-035**: *Cargar otro pedido* MUST conservar los datos de quien envía —su
  nombre, su teléfono y su dirección de retiro con el punto ya ubicado— y MUST
  vaciar los del envío que se cerró: dirección de entrega, fecha y hora de
  retiro, quién recibe, y tipo y cantidad de paquete. El corte es entre **lo que
  no cambia entre dos pedidos de la misma persona** y lo que sí.

  Los datos MUST salir del pedido **recién confirmado**, no de la precarga del
  perfil. No es equivalente: la precarga corre sólo al montar (FR-007), así que
  quien se identificó desde el diálogo a mitad de formulario **nunca la tuvo**, y
  ése es el camino más común. Tampoco corresponde revalidar el punto (FR-022):
  se acaba de usar en esta misma sesión.

  Hasta el 2026-08-14 el botón devolvía el formulario **completamente vacío**, y
  eso obligaba a quien mandaba un segundo paquete desde su casa a reescribir su
  propio nombre y su propia dirección — justo el tipeo que el Principio II
  existe para eliminar.

### Key Entities

- **Pedido**: Lo que un cliente identificado le encarga a Flash Urbano. Guarda
  una copia de quién envía, de dónde se retira —con su punto—, adónde se
  entrega, qué es, cuánto, cuándo se retira, quién recibe, el precio, y en qué
  estado del ciclo de vida está. Lleva un código corto legible. Pertenece a un
  usuario y ningún otro puede verlo.
- **Estado del pedido**: Creación → aceptación → entrega. Respuesta del cliente
  del 2026-08-06, que ya descartó un cuarto estado ("confirmación") que existía
  en el relevamiento original. Guardado de modo que sumar un estado sea una
  migración, porque la lista **ya cambió una vez**.
- **Código de pedido**: Un identificador corto y legible, tipo `FU-0142`, para
  que un cliente y Diego puedan hablar del mismo pedido por WhatsApp sin dictar
  un identificador largo.
- **Dirección de retiro del pedido**: La misma forma que la del perfil —calle,
  esquina, número, apto, cooperativa, punto— pero **copiada**, no referenciada.
  Es el dato sobre el que se cobró.
- **Clave de idempotencia**: Identifica un **intento de envío**, no un pedido.
  La genera el navegador, viaja con la petición, y es lo que permite que un
  reintento llegue al mismo pedido en vez de crear otro. Vive lo que vive el
  intento: empezar un pedido nuevo genera una nueva.
- **Usuario** *(existente, de `006`)*: No cambia de forma en este feature. Pasa
  de ser el dueño de un perfil a ser el dueño de pedidos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante sin cuenta cotiza de punta a punta **con el servicio
  de backend apagado**, sin ver un solo error, y sin que se le pida
  identificarse en ningún momento antes de confirmar.
- **SC-002**: Un pedido confirmado se puede recuperar íntegro después de
  reiniciar el servicio y cerrar el navegador, con todos sus campos y ligado a
  su usuario.
- **SC-003**: Un visitante sin sesión llena el formulario entero, toca confirmar
  **una sola vez**, se identifica en el diálogo, y aterriza en la confirmación
  con su código **sin haber vuelto a escribir un solo campo** ni haber navegado
  fuera de la pantalla. Medido a mano en un teléfono.
- **SC-003a**: Después de ese recorrido, el almacenamiento del navegador
  —`localStorage` y `sessionStorage`— **no contiene** el borrador del
  formulario, en particular el nombre y el teléfono de quien recibe.
- **SC-004**: Ningún pedido queda creado sin usuario identificado, comprobado
  también **saltándose el sitio**: una petición directa al servicio sin
  credencial válida es rechazada.
- **SC-005**: Confirmar dos veces seguidas deja **un** pedido, y el segundo
  intento devuelve ese mismo pedido en vez de un error. Comprobado contando en
  la base.
- **SC-005a**: Dos pedidos idénticos creados a propósito, uno tras otro, quedan
  **los dos**. Es el control positivo de SC-005: sin él, "deja un solo pedido"
  se satisface con una implementación que descarta pedidos buenos.
- **SC-006**: Un cliente con perfil completo carga un pedido tocando únicamente
  los campos que cambian entre un envío y otro. Medido contando los campos que
  tuvo que escribir: cero para nombre, teléfono y dirección de retiro.
- **SC-007**: Editar la dirección precargada en un pedido no cambia el perfil, y
  editar el perfil después no cambia ningún pedido ya creado. Las dos
  direcciones comprobadas.
- **SC-008**: El código de pedido es único y con formato correcto a lo largo de
  **más de 10.000 pedidos creados seguidos** — o sea **cruzando `FU-9999`**, que
  es el único punto donde el formato puede romperse. La cifra no es decorativa:
  con 1.000 el caso interesante ni se alcanza, y el `UNIQUE` de la columna
  garantiza la unicidad pero **no** que el código siga siendo legible al pasar
  de cuatro dígitos.
- **SC-009**: Un pedido cuyo punto de retiro cae fuera de todas las zonas **no se
  puede confirmar desde el sitio**, y el cliente termina en contacto directo en
  vez de en un error. Comprobado desde el sitio, que es donde FR-020 aplica;
  FR-020a deja dicho que una petición directa al servicio pasa igual.
- **SC-010**: Un usuario no consigue leer ni modificar el pedido de otro,
  comprobado intentándolo con una sesión válida ajena al pedido.
- **SC-011**: La base se levanta desde vacía aplicando las migraciones del repo,
  sin pasos manuales, incluida la nueva.
- **SC-012**: Ninguna pantalla del flujo le promete al cliente algo que el
  sistema no haga: revisado texto por texto, incluida la confirmación. En
  particular, la frase *"Nos pondremos en contacto para confirmar el retiro"* no
  sobrevive a este feature mientras no exista quien lo haga.
- **SC-013**: Con el servicio caído, confirmar falla diciendo que el pedido no
  se creó, y lo cargado sigue en pantalla.
- **SC-014**: Un `git add -A` desde una rama recién creada, con un `backend/.env`
  presente, **no** lo prepara para commit.
- **SC-015**: Un pedido creado desde el sitio se recupera íntegro **sin ejecutar
  una consulta SQL a mano**, y el mismo camino rechaza el pedido de otro
  usuario.

## Assumptions

- **El formato del código de pedido es `FU-` más cuatro dígitos.** Es la
  pregunta 6 de [`docs/preguntas-cliente.md`](../../docs/preguntas-cliente.md),
  **no respondida**. Se asume para poder avanzar, y es barata de cambiar
  mientras no haya pedidos reales. Conviene preguntárselo a Diego antes de que
  el primer cliente reciba uno por WhatsApp.
- **Un pedido no se puede cancelar.** Pregunta 4, sin responder, con este valor
  ya asumido en el tracker de preguntas. Si el cliente contesta que sí, es
  funcionalidad nueva y un estado más, no un ajuste.
- **Cuando no hay nadie al retirar, el sistema no se entera.** Pregunta 5, sin
  responder, asumido: lo resuelve Diego por teléfono.
- **No hay límite de pedidos por día ni aceptación automática.** Principio V y
  respuesta del cliente: no hay tope, Diego acepta y planifica a mano.
- **El plazo de entrega sigue siendo el compromiso fijo de 24 horas desde el
  retiro**, que el sitio enuncia y no controla. No se agenda ventana de entrega.
- **El pedido se guarda con la moneda y el monto de la zona vigente al momento
  de crearlo.** Un cambio de precios posterior no reescribe pedidos viejos.
- **No hay borrado de pedidos a pedido del usuario**, del mismo modo que `006`
  dejó pendiente el borrado de cuenta. Se agrupa con esa deuda: cuando exista
  `DELETE /yo`, tiene que decidir qué pasa con los pedidos de esa persona.
- **La app Android no existe todavía**, así que cualquier lectura de pedidos que
  este feature construya es provisoria respecto de la superficie definitiva.
- **Diego revisa los pedidos por su cuenta hasta que exista la app.** Es la
  consecuencia directa de diferir la notificación, y se asume a sabiendas. El
  supuesto que sostiene que esto sea tolerable es que **el volumen en ese tramo
  es bajo** — lo cual, notablemente, **nadie confirmó**: la pregunta 11 del
  cliente ("¿cuántos paquetes mueve por día?") sigue sin respuesta. Si el
  volumen resulta alto, el hueco deja de ser tolerable y el aviso deja de poder
  esperar a la app.
- **"Mis Pedidos" se construye después**, con historial, estados y repetición de
  un pedido anterior. Lo que este feature guarda tiene que alcanzar para
  mostrarlo entonces sin una migración de rescate.

## Dependencies

- **`006-backend-auth`** — provee la identidad, la sesión, el perfil con la
  dirección guardada, el servicio desplegado y la base con PostGIS. Este feature
  no tiene sentido sin él y cierra la mitad que dejó abierta.
- **Constitución v3.0.0** — la enmienda del 2026-08-11 nombra a `007` como quien
  debe poner la puerta y corregir el copy. Cerrar este feature sin las dos cosas
  deja la enmienda incumplida.
- **[ADR zone-based-automatic-pricing](../../docs/decisions/zone-based-automatic-pricing.md)**
  — decide que el precio sale de la zona del punto de retiro y se resuelve sin
  intervención humana. **Queda intacto**: la clarificación del 2026-08-12
  resolvió no llevar la geometría al servidor, así que este feature no lo
  extiende. Lo que sí queda expuesto es que el ADR dice dónde se **cotiza** y no
  dice nada de dónde se **verifica lo que se cobra**; el día que eso haga falta,
  es una decisión de ADR y no de plan.
- **`006` FR-016** — la credencial de sesión viaja de una forma que no depende
  de cookies entre orígenes. El diálogo de ingreso sobre `/pedido` y la
  reanudación del envío se apoyan en eso: si la sesión dependiera de una cookie
  de tercero, el camino elegido no funcionaría en Safari.
- **`docs/tech-debt-tracker.md`** — cuatro filas abiertas caen dentro de este
  feature: la promesa falsa de la pantalla de confirmación (`High`, del
  2026-08-12), la contradicción del formulario con la constitución (`High`, se
  cierra acá), el punto guardado sin verificación contra el índice de calles
  (`Medium`, acá se vuelve plata), y el `.gitignore` de la raíz sin `.env*`
  (`High`, FR-033).
- **`docs/preguntas-cliente.md`** — preguntas 4, 5 y 6 tocan este feature y
  están sin responder. Ninguna bloquea; las tres tienen valor asumido y
  declarado arriba.
