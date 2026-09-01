# Feature Specification: Que Diego se entere del pedido cuando entra

**Feature Branch**: `018-aviso-de-pedido-nuevo`

**Created**: 2026-08-31

**Status**: Draft

**Input**: Mateo, el 2026-08-31, revisando qué quedaba pendiente con todo `017`
ya en producción. El pedido textual: *"el tema de la notificación, yo quería que
cuando desde la web crearan un pedido hubiera un trigger que hiciera una push
notificación a la app en el celu, así él siempre está atento"*. Y en la misma
vuelta, dos decisiones suyas: *"no quiero que le llegue un mail, el mail la idea
es que sea sólo para consultas"* y *"no es tan grave que tenga que actualizar la
app"*.

## El problema: el pedido llega a la base y ahí se queda

Desde `007` el pedido **se guarda de verdad**. Lo que nunca se construyó es el
tramo siguiente: **nada le avisa a Diego**. El pedido queda en una tabla,
esperando a que a él se le ocurra abrir la app y tocar *Actualizar*
(`android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt:132`).
El retraso entre que entra un pedido y que Diego lo sabe **es exactamente lo que
él tarde en acordarse de mirar**, y nada lo acota.

Eso está anotado en el tracker como fila `High` desde el 2026-08-14, declarada
ahí mismo como **bloqueante para promocionar el sitio**. La fila, además, hoy
describe un mundo que dejó de existir: dice que *"el aviso a Diego vive en la app
Android, que no existe"*. La app existe desde `012` y Diego la tiene instalada en
su teléfono desde el 2026-08-31. **El hueco no se cerró, cambió de forma**: ya no
falta la app, falta que la app despierte sola.

Mientras el sitio no se promocione el costo es cero, y por eso se pudo convivir
con esto tres semanas. El día que entre tráfico real, un pedido sin aviso es un
cliente esperando un retiro que nadie agendó.

## La decisión del dueño: el aviso es el push, y sólo el push

Sobre la mesa había dos caminos y se eligió uno solo, el 2026-08-31:

- **El mail queda descartado a propósito.** No es que sea caro —son pocas líneas
  sobre el paquete `correo` que ya construyó `006`—: es que el correo tiene un
  uso asignado en este producto, que es **la consulta del cliente**, y meterle
  avisos automáticos a la misma casilla lo degrada como canal.
- **La red de seguridad no es un segundo canal.** Si el push no llega, el pedido
  **sigue estando en la base y la app lo muestra al abrirla**, igual que hoy. O
  sea: este feature **acelera un camino que ya funciona**, no introduce un único
  punto de falla para el pedido.

Esa segunda mitad es la que hay que aceptar con los ojos abiertos: **cuando el
aviso no llegue, no lo va a reemplazar nada**. Se vuelve al comportamiento de
hoy, que es Diego abriendo la app. Es una degradación aceptable, y es la razón de
FR-008: si la app está en condiciones de no recibir avisos, **eso tiene que
verse en la pantalla**, no quedar en silencio haciéndole creer que está cubierto.

## Lo que impone el teléfono, y que no se negocia desde el código

Tres restricciones del entorno real mandan sobre el diseño, y ninguna es
opcional:

- **El teléfono es un Samsung**, y One UI **duerme las apps que no se usan
  seguido** (*Apps en suspensión* / *Apps en suspensión profunda*). Una app
  dormida **no recibe avisos**. Esto no se arregla programando: se arregla
  dejando la app marcada como *que nunca duerme* en ese teléfono, y por eso es
  parte del procedimiento de instalación (FR-011) y no una nota al pie.
- **Desde Android 13 el aviso exige un permiso que se pide en pantalla.** La app
  apunta a `targetSdk = 36`, así que le va a aparecer a Diego un cartel. Si toca
  *No permitir*, **el aviso se pierde para siempre y en silencio**: nada falla,
  nada avisa, simplemente no llega nunca. Ese caso es el que FR-008 obliga a
  hacer visible.
- **La app no tiene hoy ninguna dependencia de Google** (usa OkHttp, Compose y
  DataStore, nada más). Este feature le mete la primera, y con ella un servicio
  externo que decide si el aviso llega y cuándo. Es la clase de decisión que pide
  un ADR: suma una dependencia, un secreto nuevo y un canal de entrega que no
  controlamos.

## El dato nuevo que aparece, y por qué contradice en apariencia a `017`

Para mandarle un aviso a un teléfono hay que **poder nombrar a ese teléfono**.
Eso es un identificador de la instalación de la app, y hay que guardarlo.

`017` había cerrado la puerta contraria: su FR-011 dice que lo que la app le
informa al servicio **no puede incluir ningún dato del teléfono más allá de la
versión**, y el argumento era que *un dato que no hace falta no se guarda*. Acá
el dato **sí hace falta**, y no hay forma de evitarlo: sin él no hay a quién
mandarle el aviso.

Lo que se mantiene de aquella decisión es el criterio, no la lista: **entra
únicamente lo que el aviso necesita** —el identificador que permite entregar el
mensaje— y **nada más**. Ni modelo, ni versión de Android, ni número de línea, ni
ubicación. Este feature no abre un registro de dispositivos: agrega un casillero
para poder tocarle el timbre a uno.

## Lo que este feature NO hace

- **No manda ningún mail.** Decisión explícita del dueño del proyecto; el correo
  queda para consultas.
- **No le avisa nada al cliente.** El cliente no tiene app. Su experiencia no
  cambia en ningún punto.
- **No avisa de cambios de estado**, ni de cancelaciones, ni de nada que no sea
  **un pedido nuevo**. Un aviso por cada cosa que pasa entrena a ignorarlos.
- **No acepta ni toma el pedido.** El aviso informa; tomar el pedido lo sigue
  haciendo Diego con el dedo, en la app, como hasta ahora.
- **No cambia cómo se crea un pedido.** El formulario del sitio no se toca.
- **No fuerza a que la app esté abierta ni corriendo en segundo plano por cuenta
  propia.**
- **No arma un registro de dispositivos** más allá del identificador necesario
  para entregar el aviso.
- **No agrega una segunda vía por si el push falla.** La vía de reserva es la que
  ya existe: abrir la app.
- **No hace obligatoria la credencial del proveedor de avisos.** Si falta, el
  servicio arranca igual y se queda sin avisos (FR-010). Un arranque que se niega
  por una credencial de una función accesoria ya tumbó producción una vez.

## Clarifications

### Session 2026-08-31

- **P: ¿Qué muestra el aviso en la pantalla bloqueada?** (FR-005)
  → **El código del pedido y la calle de entrega, sin número y sin esquina**
  —*"Pedido nuevo FU-0142 — entrega en Av. Brasil"*—, sin nombre y sin teléfono
  de nadie. Es el punto donde el aviso **le sirve para decidir sin abrir la
  app**, que es para lo que se pide: el código solo no dice si le queda de paso,
  y la dirección exacta deja la casa de un cliente legible para cualquiera que
  mire el teléfono apoyado en un mostrador. Se descartó *"tenés un pedido
  nuevo"* a secas —lo obliga a abrir la app siempre, que es justo el gesto que
  este feature viene a evitar— y la dirección completa, por privacidad. Ver
  FR-005 y SC-009.

- **P: ¿Y de dónde sale ese dato de "dónde entrega"?** (FR-005) → **De la calle
  de entrega que el pedido ya guarda.** La primera redacción decía *"la zona o
  barrio"* y ponía de ejemplo *"entrega en Pocitos"*: **el barrio no existe como
  dato** —las zonas se llaman `Zona 1` a `Zona 5` y nada más— así que ese
  ejemplo no tenía de dónde salir. Se descartó la zona sola (un área demasiado
  grande para decidir si le queda de paso) y **la calle con su esquina**, que en
  este producto **es** la dirección: el punto de entrega se resuelve justamente
  de ese cruce, así que mostrarlo sería mostrar la dirección exacta con otro
  nombre. Ninguna de las dos alternativas exigía un campo nuevo, y la elegida
  tampoco.

- **P: ¿Qué pasa si entra un pedido con la app abierta?** (FR-016) → **Llega el
  aviso igual, y además aparece un renglón *"1 pedido nuevo — tocá para
  actualizar"*: la lista no se mueve sola.** El motivo de que no se refresque
  sola es de seguridad de uso, no de rendimiento: un pedido que aparece y
  reordena la lista justo cuando Diego está por tocar *tomar* es tocar el pedido
  equivocado, y eso es exactamente lo que `015` estuvo cuidando en esta app. Se
  descartó no mostrar nada con la app abierta (deja vivo el caso *"la tenía
  abierta y no me enteré"*, que US1 escenario 3 prohíbe) y refrescar la lista
  sola. Ver FR-016.

- **P: ¿Hasta cuándo vale un aviso que quedó guardado porque el teléfono estaba
  sin red?** (FR-017) → **24 horas.** Es el horizonte que el negocio ya se puso
  —entrega dentro de las 24 horas del retiro—, así que un aviso más viejo que
  eso no informa: confunde, porque anuncia como nuevo algo que ya no lo es. Lo
  que quede afuera **no se pierde**: está en la lista de pendientes, que es
  donde corresponde mirarlo. Se descartó no vencer nunca (volver de un fin de
  semana sin señal con quince banners viejos de golpe entrena a ignorarlos) y
  vencer a las 4 horas (tira un pedido de la mañana que vuelve a la tarde y
  todavía era perfectamente accionable). Ver FR-017.

- **P: ¿El aviso suena a cualquier hora?** (FR-006)
  → **Sí, y respeta el *No molestar* del teléfono.** No se escribe ninguna
  franja horaria en el producto: el horario en que Diego acepta ser interrumpido
  lo maneja él desde el sistema, que ya sabe hacerlo. Se descartó sonar siempre
  pisando el *No molestar* (termina silenciado a mano, y ahí se pierden todos) y
  una franja fija tipo 8 a 21 (mete en el código una regla de negocio que nadie
  midió; hoy no sabemos cuál es su horario real). Si más adelante se llena de
  avisos de madrugada, la franja se agrega **sabiendo el horario**, no
  suponiéndolo. Ver FR-006.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diego se entera del pedido sin estar mirando (Priority: P1)

Un cliente confirma un pedido desde el sitio a las 15:40. Diego está manejando,
con el teléfono en el bolsillo y la app cerrada desde la mañana. El teléfono le
avisa. Él lo mira cuando puede, abre la app y el pedido está ahí, en pendientes.

**Why this priority**: Es el feature entero. Todo lo demás existe para que esto
sea confiable o para que su falla no sea invisible.

**Independent Test**: Con la app instalada y cerrada, crear un pedido desde el
sitio y comprobar que el teléfono avisa sin que nadie lo toque.

**Acceptance Scenarios**:

1. **Given** la app instalada, con permiso concedido y **cerrada**, **When** un
   cliente confirma un pedido en el sitio, **Then** el teléfono muestra un aviso
   sin que Diego haga nada.
2. **Given** un aviso en pantalla, **When** Diego lo toca, **Then** la app se
   abre en la lista donde está ese pedido, sin pasos intermedios.
3. **Given** la app **abierta** en la lista de pedidos, **When** entra un pedido,
   **Then** Diego se entera igual y la lista le ofrece actualizarse, **sin
   reordenarse sola mientras él la está tocando**.
4. **Given** dos pedidos que entran con segundos de diferencia, **When** llegan
   los avisos, **Then** ninguno de los dos se pierde ni se pisa con el otro.

---

### User Story 2 - Que el aviso mudo se note (Priority: P2)

Diego instaló la app y, sin pensarlo, tocó *No permitir* en el cartel del
permiso. O el teléfono mandó la app a dormir. En los dos casos **no le va a
llegar nunca un aviso** y nada se rompe: la app funciona igual. Sin este
escenario, se enteraría el día que pierda un pedido.

**Why this priority**: Es lo que separa una función que falla de una función que
miente. La decisión de no tener segundo canal sólo es aceptable si el silencio es
observable.

**Independent Test**: Negar el permiso de avisos y comprobar que la app lo dice
en pantalla, con una salida para arreglarlo.

**Acceptance Scenarios**:

1. **Given** el permiso de avisos negado, **When** Diego abre la app, **Then** ve
   que no va a recibir avisos y **cómo** habilitarlos.
2. **Given** el permiso concedido, **When** Diego abre la app, **Then** no ve
   ningún cartel sobre avisos: el estado normal no ocupa pantalla.
3. **Given** que Diego arregla el permiso desde donde la app le indica, **When**
   vuelve a la app, **Then** el aviso de que estaba mudo desaparece.

---

### User Story 3 - El pedido se guarda aunque el aviso no salga (Priority: P3)

El proveedor de avisos está caído, o la credencial no está puesta, o el
identificador del teléfono quedó viejo porque Diego reinstaló la app. El cliente,
del otro lado, **no tiene por qué enterarse de nada de eso**: confirma su pedido
y recibe su código, igual que antes de este feature.

**Why this priority**: Es la garantía de que un accesorio no puede romper el
camino principal. Sin ella, este feature empeora el producto en vez de mejorarlo.

**Independent Test**: Dejar al servicio sin poder mandar avisos y crear un pedido
desde el sitio de punta a punta.

**Acceptance Scenarios**:

1. **Given** un servicio sin credencial de avisos, **When** arranca, **Then**
   arranca igual y queda registrado que no va a mandar avisos.
2. **Given** que el envío del aviso falla, **When** un cliente confirma un
   pedido, **Then** el pedido queda guardado, el cliente ve su código, y el fallo
   queda registrado para poder mirarlo después.
3. **Given** el proveedor de avisos lento, **When** un cliente confirma un
   pedido, **Then** la confirmación no lo hace esperar a él.

---

### Edge Cases

- **Diego niega el permiso de avisos.** No llega nada, nunca, y nada falla. Lo
  cubre FR-008.
- **El teléfono manda la app a dormir** por no usarla en unos días. Mismo efecto,
  y no se arregla desde el código: es procedimiento (FR-011).
- **El teléfono está sin red** cuando entra el pedido. El aviso llega cuando la
  red vuelva, siempre que no hayan pasado 24 horas desde que se creó el pedido
  (FR-017). Más viejo que eso se descarta: el pedido igual está en la lista.
- **Diego reinstala la app o cambia de teléfono.** El identificador viejo deja de
  servir y hay que reemplazarlo sin que nadie haga nada a mano.
- **Un aviso queda dirigido a un teléfono que ya no es de Diego** (teléfono
  perdido, sesión cortada). Un teléfono al que se le cortó la sesión **no puede
  seguir recibiendo avisos de pedidos**.
- **El mismo pedido dispara dos envíos** por un reintento. Diego tiene que ver un
  aviso, no dos.
- **Entra un pedido de madrugada.** El aviso suena, salvo que Diego tenga puesto
  *No molestar* (FR-006). El producto no decide por él a qué hora se lo puede
  interrumpir.
- **El teléfono queda apoyado en un mostrador y alguien lo mira.** Lo que
  aprende es que entró un pedido a una calle. El número, la esquina, el nombre y
  el teléfono del cliente quedan del otro lado del desbloqueo (FR-005).
- **La app está abierta justo cuando entra el pedido.** No puede quedar mostrando
  una lista vieja.
- **El proveedor de avisos rechaza el mensaje** (identificador vencido). El
  pedido no se toca y el identificador muerto no se reintenta para siempre.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cuando un cliente confirma un pedido, el sistema MUST avisarle al
  teléfono de Diego **sin que él tenga que abrir la app ni tocar nada**, y con la
  app cerrada.
- **FR-002**: El aviso MUST llegar en el orden de **segundos a un par de
  minutos** desde que el pedido se confirma, no en el orden de horas. Se acepta
  que la entrega depende de un tercero y del estado de la red del teléfono.
- **FR-003**: Cada pedido confirmado MUST producir **un solo** aviso, aunque el
  envío se reintente.
- **FR-004**: Tocar el aviso MUST abrir la app **en la lista donde está ese
  pedido**, sin pasos intermedios.
- **FR-005**: El contenido visible del aviso MUST alcanzar para que Diego decida
  **si le queda de paso, sin desbloquear el teléfono**: el código del pedido y
  **la calle de entrega, sin número y sin esquina**. Ese dato MUST salir de lo
  que el pedido ya guarda, sin inventar un campo nuevo ni pedirle nada más al
  cliente. MUST NOT incluir el número, la esquina, el nombre ni el teléfono de
  ninguna de las dos puntas —eso queda del otro lado de la pantalla bloqueada, y
  la calle con su esquina identifica el punto de entrega tan bien como la
  dirección— y en ningún caso MUST incluir un importe ni ninguna
  referencia a lo que cuesta el envío: el producto no habla de plata en ninguna
  superficie (Principio V de la constitución).
- **FR-006**: El aviso MUST poder sonar a cualquier hora del día y MUST respetar
  el *No molestar* del teléfono, sin ninguna franja horaria escrita en el
  producto. El horario en que Diego acepta ser interrumpido lo decide él desde
  el sistema, y el producto MUST NOT tener una regla propia que lo contradiga.
- **FR-007**: Sólo MUST recibir estos avisos quien administra el negocio. Un
  cliente MUST NOT recibir avisos de pedidos, ni propios ni ajenos, y un teléfono
  al que se le cortó la sesión MUST dejar de recibirlos.
- **FR-018**: El aviso MUST llegarle a **todas** las sesiones administradoras
  vivas, no a una. Hoy hay **dos teléfonos** —el de Diego, que trabaja, y el de
  Mateo, que verifica—, así que "el destinatario" es un conjunto y no una fila.
  Un destinatario que falla —token muerto, teléfono sin red— MUST NOT impedir
  que los demás reciban el aviso.
- **FR-008**: Si la app está en condiciones de **no** recibir avisos —permiso
  negado, o el sistema no la deja— la app MUST decirlo en pantalla cuando Diego
  la abra, junto con **cómo** arreglarlo. Cuando los avisos funcionan, eso MUST
  NOT ocupar espacio de pantalla.
- **FR-009**: Confirmar un pedido MUST seguir funcionando aunque el aviso no se
  pueda mandar: el pedido se guarda, el cliente recibe su código, y **el cliente
  MUST NOT esperar** por el envío del aviso ni ver ningún error a causa de él.
- **FR-010**: La credencial del proveedor de avisos MUST ser opcional para el
  arranque del servicio. Si falta, el servicio MUST arrancar igual, MUST quedar
  registrado que no va a haber avisos, y MUST NOT negarse a levantar.
- **FR-011**: `docs/processes/app-repartidor.md` MUST documentar qué hay que
  dejar configurado en el teléfono para que los avisos lleguen —el permiso de
  notificaciones y la exclusión del ahorro de batería de Samsung— como parte del
  procedimiento de instalación, no como una nota suelta.
- **FR-012**: Lo que la app le informa al servicio para poder recibir avisos MUST
  limitarse al identificador necesario para entregarlos. MUST NOT incluir modelo,
  número de teléfono, ubicación ni ningún otro dato del aparato.
- **FR-013**: El identificador de destino MUST poder reemplazarse solo cuando
  cambia —reinstalación, teléfono nuevo, vencimiento— sin ninguna intervención
  manual, y un identificador que el proveedor declara muerto MUST NOT seguir
  reintentándose indefinidamente.
- **FR-014**: Un fallo de envío MUST quedar registrado con lo suficiente para
  saber **qué pedido** no se avisó, de modo que "no me llegó" se pueda comprobar
  en vez de discutir.
- **FR-015**: La fila `High` del 2026-08-14 de `docs/tech-debt-tracker.md` MUST
  quedar cerrada o reescrita, porque su texto afirma que la app Android no existe
  y eso dejó de ser cierto.
- **FR-016**: Con la app abierta, un pedido que entra MUST avisar igual, y la
  lista MUST NOT reordenarse sola: MUST aparecer un aviso dentro de la pantalla
  que diga que hay pedidos nuevos y que **Diego decide cuándo aplicar**. Una
  lista que se reacomoda mientras él la está tocando le hace tocar el pedido
  equivocado.
- **FR-017**: Un aviso que no se pudo entregar porque el teléfono estaba sin red
  MUST entregarse cuando el teléfono vuelva, **hasta 24 horas después de creado
  el pedido**. Pasado ese plazo MUST descartarse en vez de entregarse tarde: el
  pedido sigue estando en la lista, y un aviso viejo anunciado como nuevo es
  peor que ninguno.

### Key Entities

- **Aviso de pedido nuevo**: el mensaje que le llega al teléfono cuando un
  cliente confirma un pedido. Lo identifica el pedido que lo originó; su
  contenido es lo mínimo para que Diego decida si mira ahora o después.
- **Destino de aviso**: el casillero que dice a qué instalación de la app hay que
  mandarle el mensaje. Cambia solo cuando Diego reinstala o cambia de teléfono, y
  muere cuando se corta la sesión de ese teléfono. **No es un registro del
  aparato**: es una dirección de entrega (FR-012).
- **Pedido** (ya existe): no cambia. Gana un efecto al ser creado, no un campo.
- **Sesión** (ya existe): es lo que ata un destino de aviso a Diego, y cortarla
  tiene que cortar también los avisos (FR-007).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con la app cerrada, un pedido creado desde el sitio le llega al
  teléfono de Diego **en menos de dos minutos**, comprobado sobre su teléfono
  real y no sobre un emulador.
- **SC-002**: Diego se entera de un pedido **sin abrir la app y sin que nadie le
  escriba**, en al menos tres pedidos seguidos.
- **SC-003**: Tocar el aviso lo deja mirando ese pedido **en un solo toque**.
- **SC-004**: Con el proveedor de avisos deshabilitado, un pedido creado desde el
  sitio **se guarda igual y el cliente ve su código**, sin ningún cambio
  observable de su lado.
- **SC-005**: Con el permiso de avisos negado, **la app lo dice**, comprobado
  negándolo a propósito.
- **SC-006**: Un pedido genera **un aviso, no dos**, comprobado sobre pedidos
  reales seguidos.
- **SC-007**: Alguien que instala la app siguiendo únicamente
  `docs/processes/app-repartidor.md` termina con los avisos funcionando, **sin
  preguntar nada fuera del documento**.
- **SC-008**: Un teléfono al que se le cortó la sesión **deja de recibir avisos**,
  comprobado provocándolo.
- **SC-009**: Con el teléfono bloqueado, el aviso alcanza para saber **a qué
  calle va el pedido y cómo se llama**, sin desbloquear; y **no** deja a la
  vista el número, la esquina, el nombre ni el teléfono de nadie.
- **SC-010**: Un mismo pedido le llega **a los dos teléfonos**, comprobado con
  las dos sesiones administradoras vivas al mismo tiempo; y con uno de los dos
  con un token muerto, **el otro recibe igual**.

## Assumptions

- **Un solo repartidor, pero dos teléfonos.** El negocio tiene un repartidor y
  eso no cambia. Lo que sí hay, desde el día uno, son **dos aparatos con sesión
  administradora**: el de Diego, que trabaja, y el de Mateo, que verifica. Por
  eso el aviso va a un conjunto de sesiones (FR-018) y no a "el teléfono". Lo
  que sigue sin existir es una **regla de reparto**: no se decide quién recibe
  qué; los dos reciben todo.
- **El volumen es de decenas de pedidos por semana.** Un aviso por pedido no
  satura a nadie. Con cien pedidos por día esta decisión se revisa.
- **La red de reserva es abrir la app.** No hay reintento por otro canal, ni
  mail, ni SMS, ni WhatsApp. Es decisión explícita del dueño del proyecto.
- **La entrega la hace un tercero y no se controla.** El sistema operativo del
  teléfono puede demorar o descartar un aviso por ahorro de batería, y eso no es
  un defecto de este feature: es la razón por la que FR-008 y FR-011 existen.
- **Se acepta sumar una dependencia de Google en la app**, que hoy no tiene
  ninguna. Va a ADR.
- **La sesión de Diego no expira** (`017`), así que el destino del aviso vive
  mientras él no cierre sesión ni reinstale.
- **El sitio todavía no se promociona.** Ese es el margen que existe para hacer
  esto ahora y no a las apuradas.
