# Feature Specification: Un ambiente de staging

**Feature Branch**: `027-ambiente-de-staging`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Separar ambientes: un entorno `staging` en Railway, aislado de produccion, para que Mateo pueda crear pedidos y probar cambios contra un backend real sin ensuciar la base de produccion."

## Por qué existe esto

Hoy hay **un solo lugar donde el producto corre de verdad**, y es el que usan
los clientes. Cada vez que hay que comprobar algo que las pruebas automáticas no
ven —que un pedido se crea entero, que la etiqueta sale bien, que la app trae la
lista— hay que hacerlo contra la base de producción, y después limpiarla.

Eso ya pasó y ya costó: el 2026-09-12 hubo que **borrar pedidos de prueba de la
base de producción** antes de mostrarle el tablero a Diego, con un runbook
escrito para el caso. `026` cerró con la misma maniobra: se cargó un pedido real
con comentario para probar el Q10, y después se borró. **La limpieza a mano es
el síntoma; la causa es que no hay otro lado donde probar.**

Este trabajo le da a Mateo un segundo lugar donde el producto corre completo, con
su propia base, que puede ensuciar sin consecuencias.

## Clarifications

### Session 2026-09-13

- Q: ¿Dónde vive la guarda de FR-008? → A: Aserción dentro del build de
  producción, no un paso sólo de CI — así puede romperse a propósito y verse en
  rojo sin desplegar nada.
- Q: ¿Cómo se sabe qué corre en staging? → A: Las dos cosas. `/salud` suma un
  campo `ambiente`, y el procedimiento explica cómo leer la fecha del último
  despliegue. Son preguntas distintas: el campo dice **a cuál le estoy pegando**,
  la fecha dice **si es mi código**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear pedidos de prueba sin tocar producción (Priority: P1)

Mateo levanta la web en su máquina, la apunta al backend de staging, entra con
su cuenta y crea todos los pedidos que quiera: casos raros, direcciones al
límite, comentarios largos, pedidos que después edita y borra. Nada de eso
aparece en la base que usan los clientes, y no hay que limpiar nada después.

**Why this priority**: Es el motivo entero de la feature. Sin esto, lo demás no
tiene razón de ser. Y es lo que elimina el riesgo que hoy existe: que un pedido
de prueba sobreviva en producción y Diego actúe sobre él.

**Independent Test**: Se prueba solo. Crear un pedido en staging, verlo en *Mis
pedidos* de staging, y comprobar que la base de producción no cambió — el
tablero de producción sigue dando el mismo total que antes.

**Acceptance Scenarios**:

1. **Given** la web local apuntada a staging y Mateo con sesión iniciada,
   **When** confirma un pedido, **Then** el pedido aparece en *Mis pedidos* de
   staging **y** el total del tablero de producción no cambia.
2. **Given** un pedido creado en staging, **When** Mateo mira producción con la
   misma cuenta, **Then** ese pedido no está.
3. **Given** la base de staging recién creada, **When** el servicio de staging
   arranca por primera vez, **Then** el esquema queda completo sin ningún paso
   manual y sin ningún pedido adentro.

---

### User Story 2 - Probar un cambio antes de que llegue a producción (Priority: P2)

Mateo tiene un cambio de backend a medio hacer en su copia de trabajo. Lo
despliega a staging, lo prueba contra la web local, y recién cuando funciona lo
mergea. Hoy la única forma de ver un cambio de backend corriendo de verdad es
mergearlo a `master`, que es lo mismo que ponerlo en producción.

**Why this priority**: Es el valor que convierte a staging en parte del proceso y
no en un juguete. Pero la Historia 1 ya entrega la función completa sin esto.

**Independent Test**: Desplegar a staging un cambio que no está en `master`,
comprobar que staging lo tiene y que producción no.

**Acceptance Scenarios**:

1. **Given** un cambio de backend sin mergear en la copia de trabajo, **When**
   Mateo despliega a staging, **Then** staging sirve el cambio y producción
   sigue sirviendo lo de `master`.
2. **Given** una migración nueva que rompe al aplicarse, **When** se despliega a
   staging, **Then** el fallo se ve en staging y la base de producción nunca lo
   vio.

---

### User Story 3 - Mirar la app del repartidor contra datos de prueba (Priority: P3)

Mateo abre la app en un emulador apuntada a staging y ve la lista de pedidos que
él mismo cargó, en vez de tener que crear pedidos reales para tener algo que
mirar.

**Why this priority**: Útil y prácticamente gratis —el mecanismo ya existe—,
pero la app se prueba poco y contra el emulador. No justifica el trabajo por sí
sola.

**Independent Test**: Compilar la app con la URL de staging, correrla en un
emulador, y ver los pedidos de staging.

**Acceptance Scenarios**:

1. **Given** pedidos cargados en staging, **When** Mateo corre la app apuntada a
   staging en un emulador, **Then** ve esos pedidos y ninguno de producción.

---

### Edge Cases

- **El caso más caro: que el sitio de producción termine hablándole a staging.**
  La web toma la URL del API de una variable de build. Si esa variable queda
  apuntando a staging cuando se publica el sitio, los clientes reales cargan
  pedidos en la base de prueba y nadie se entera hasta que Diego pregunta dónde
  están los pedidos. Es el riesgo nuevo que introduce esta feature, y necesita
  una guarda, no una advertencia.
- **El caso simétrico: que staging termine hablándole a la base de producción.**
  Una variable mal puesta y staging escribe donde no debe.
- **Staging con la base vacía y sin nadie adentro**: el primer ingreso tiene que
  poder ocurrir. Una base vacía no tiene cuentas, así que el camino de alta
  tiene que funcionar sin sembrar datos a mano.
- **El servicio de staging queda accesible desde internet**, porque es cómo lo
  alcanza el navegador de Mateo. No hay forma de evitarlo sin trabajo extra, y
  se aceptó tal cual (FR-017): lo único que hay del otro lado es una base
  desechable.
- **Staging desactualizado**: staging corriendo código viejo y dando resultados
  que no valen para nada. Un staging en el que no se confía es peor que no
  tenerlo, porque igual se prueba en producción "por las dudas".
- **Un despliegue de staging que rompe producción por accidente** — cualquier
  camino por el que tocar staging afecte al otro lado.

## Requirements *(mandatory)*

### Functional Requirements

**Aislamiento — lo que la feature garantiza**

- **FR-001**: El ambiente de staging DEBE tener su propia base de datos,
  separada de la de producción, sin ningún dato en común.
- **FR-002**: El servicio de staging NO DEBE tener ninguna ruta de acceso a la
  base de producción. El aislamiento DEBE ser estructural —imposible por cómo
  está armado— y no depender de que una variable de configuración esté bien
  escrita.
- **FR-003**: La base de staging DEBE arrancar **vacía**. NO DEBE copiarse
  ningún dato de producción, en ningún momento y por ningún camino.
- **FR-004**: El esquema de la base de staging DEBE quedar completo sin
  intervención manual.
- **FR-005**: Ninguna operación sobre staging DEBE poder alterar producción: ni
  sus datos, ni su configuración, ni su disponibilidad.

**Que no suene el teléfono ajeno**

- **FR-006**: Staging NO DEBE poder enviar notificaciones al teléfono de Diego,
  bajo ninguna circunstancia.
- **FR-007**: Sólo la cuenta de Mateo DEBE tener privilegios de administrador en
  staging.

**La guarda contra el cruce de cables**

- **FR-008**: La construcción del sitio de producción DEBE **fallar** si la URL
  del servicio con la que se está compilando no es la de producción. La guarda
  DEBE vivir **dentro del build**, no sólo en el sistema de integración: así
  corre también en la máquina de Mateo y entra al `verify:` del plan. Una nota
  en un documento no satisface este requisito.
- **FR-008a**: La guarda DEBE ser **inerte en una construcción de desarrollo**.
  Apuntar la web local a staging es el uso normal de esta feature (FR-011) y no
  puede fallar; lo que no puede pasar es publicar el sitio así.
- **FR-009**: La guarda DEBE demostrarse **rompiéndola a propósito y viéndola en
  rojo**, no sólo viéndola en verde. Una guarda negativa que nadie hizo fallar no
  distingue "está bien" de "no está mirando", y ésta es especialmente fácil de
  escribir de forma que nunca dispare.
- **FR-009a**: El valor correcto contra el que compara la guarda DEBE quedar en
  el repo, y el procedimiento de FR-014 DEBE decir que **mudar de dominio ahora
  incluye cambiarlo ahí**. Es una pérdida asumida: `006` puso esa URL en una
  variable fuera del repo para que mudar de dominio no fuera tocar código, y no
  hay guarda posible sin que el repo tenga una opinión sobre qué es lo correcto.

**Poder usarlo**

- **FR-010**: Mateo DEBE poder desplegar a staging el código de su copia de
  trabajo, esté mergeado o no.
- **FR-011**: DEBE poder apuntar la web local a staging o a producción con un
  solo cambio, sin editar código.
- **FR-012**: DEBE poder compilar la app del repartidor contra staging sin
  tocar código, y sin riesgo de pisar la app de producción de ningún teléfono.
- **FR-013**: El costo mensual del ambiente de staging DEBE quedar dentro del
  crédito ya incluido en el plan contratado, sin cargo adicional.

**Que quede escrito**

- **FR-014**: El procedimiento de uso de staging —cómo se despliega, cómo se
  apunta la web, cómo se vuelve a producción— DEBE quedar documentado en el
  repo.
- **FR-015**: La documentación de despliegue existente DEBE quedar describiendo
  el estado real al cierre de este trabajo. Hoy describe el estado de `006` y es
  falsa en tres puntos: la rama de la que despliega el servicio, el dominio, y
  tres variables que figuran como relleno `PENDIENTE-fase-N` y hace rato no lo
  son.

**El correo de staging**

- **FR-016**: Los códigos de acceso de staging DEBEN llegar por correo de
  verdad, por el mismo camino que los de producción, pero **con un remitente
  distinto**, de modo que se distingan de un vistazo en la bandeja. NO se agrega
  ningún interruptor de código que desvíe el envío: el camino de autenticación
  de staging es el mismo que el real, o staging no lo está probando.
- **FR-016a**: El remitente de staging DEBE quedar comprobado enviando un código
  y recibiéndolo. El proveedor de correo exige remitentes verificados, y un
  remitente rechazado deja staging **sin forma de entrar** — el fallo no se ve
  hasta el primer ingreso.
**La exposición del servicio**

- **FR-017**: La protección del servicio de staging, que es accesible desde
  internet, DEBE ser la que ya se deriva de su configuración: base vacía, un
  único administrador, y el origen del navegador restringido a la máquina de
  Mateo. NO se agrega ningún control de acceso propio. El peor caso de un abuso
  es contenido basura en una base desechable, y entrar sigue requiriendo un
  código enviado al correo de Mateo.
**Cómo llega el código a staging**

- **FR-018**: Staging DEBE desplegarse **sólo a mano**, desde la máquina de
  Mateo, con la rama que él elija. NO DEBE existir ningún disparador automático.
- **FR-019**: El servicio de staging NO DEBE estar conectado al repositorio de
  código. Es lo que hace que "manual" sea cierto: un servicio conectado se
  despliega solo en cada push de la rama que siga, y entonces staging se mueve
  sin que nadie se lo pida. **Es además la segunda mitad de FR-005**: sin
  conexión al repo no hay ningún camino por el que un push destinado a
  producción toque staging, ni al revés.
- **FR-020**: El riesgo asumido de FR-018 es el **staging viejo**: como nada lo
  actualiza solo, puede quedar corriendo código de hace semanas y dar resultados
  que no valen. La mitigación aceptada es de uso, no de mecanismo — se despliega
  justo antes de probar —, y el procedimiento de FR-014 DEBE decir **cómo leer la
  fecha del último despliegue de staging** para confirmarlo desde afuera, sin
  depender de la memoria de nadie.

**Saber a cuál se le está pegando**

- **FR-021**: La respuesta de salud del servicio DEBE nombrar **el ambiente al
  que pertenece**. Es lo que permite descubrir en un segundo que la web local
  está apuntada al lado equivocado — la confusión que esta feature crea al
  poner en pie dos servicios idénticos.
- **FR-022**: Ese dato NO DEBE poder impedir el arranque del servicio. DEBE
  leerse de forma que su ausencia dé un valor por defecto y nunca un fallo de
  configuración — el mismo trato que ya recibe la credencial de avisos, y por
  el mismo motivo: una variable obligatoria de más es una forma conocida de
  dejar producción sin arrancar.
- **FR-023**: FR-021 NO satisface FR-020, y el procedimiento DEBE decirlo. El
  ambiente responde "a cuál le estoy pegando"; la fecha del despliegue responde
  "si es mi código". Un staging sin desplegar hace tres semanas sigue
  contestando `staging`.

### Key Entities

- **Ambiente**: una instancia completa y aislada del producto corriendo —
  servicio y base—, identificada por un nombre. Hay dos: el que usan los
  clientes y el que usa Mateo.
- **Base de staging**: el almacenamiento del ambiente de staging. Desechable por
  definición: su contenido no tiene valor y puede borrarse entero en cualquier
  momento sin pérdida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Mateo puede crear, editar y borrar pedidos de prueba **sin ninguna
  operación de limpieza posterior sobre producción**. Hoy esa limpieza es un
  runbook escrito que se ejecutó al menos dos veces en septiembre.
- **SC-002**: Después de una sesión de pruebas en staging, el conteo de pedidos
  de producción es idéntico al de antes de empezar.
- **SC-003**: Un cambio de backend puede verse corriendo de verdad **sin
  mergearlo a la rama que va a producción**.
- **SC-004**: Publicar el sitio con el backend equivocado **falla de forma
  visible** en vez de publicarse. Verificado rompiéndolo a propósito y viendo el
  rojo, no sólo viendo el verde.
- **SC-005**: El gasto mensual total del proyecto sigue dentro del crédito
  incluido del plan, medido y no estimado.
- **SC-006**: Alguien que no participó de este trabajo puede levantar la web
  contra staging siguiendo sólo lo escrito en el repo.
- **SC-007**: Averiguar a qué ambiente le está hablando la web local toma **una
  sola consulta al servicio**, sin abrir ningún archivo de configuración ni
  entrar al panel del proveedor.

## Assumptions

- **El destinatario es Mateo, y sólo Mateo.** Staging no es un ambiente de demo
  para Diego, ni una preview para clientes. Eso fija el tamaño de todo:
  disponibilidad, protección y prolijidad se miden contra un solo usuario que
  sabe lo que está tocando.
- **La web de staging corre local**, no desplegada. El sitio se publica desde un
  repositorio a un solo hosting, así que no hay lugar para un segundo sitio sin
  trabajo desproporcionado. Correrla local además no cuesta nada.
- **La dirección local ya está autorizada** como origen para el ingreso con
  Google, así que ese servicio no se toca.
- **No se tocan**: la app Android (más allá de apuntarla), las notificaciones
  push, el hosting del sitio, el DNS ni el dominio.
- **La app contra staging se mira en un emulador, nunca instalando en un
  teléfono.** La app de prueba y la de producción comparten identificador y
  firma, así que instalar una reemplaza la otra en silencio.
- El costo se estimó a partir del consumo real medido el 2026-09-13: el proyecto
  gasta unos ~US$0,58 al mes contra US$5 incluidos, y duplicar el ambiente suma
  ~US$0,55. Es una extrapolación de una ventana de 24 horas, no una factura.
- La cuenta de correo de Mateo es la que se usa para entrar a staging.

## Constitution Check

**Principio III, "Simplicity over infrastructure (YAGNI)"**, es el que este
trabajo tiene que responder: dice explícitamente que no se agrega infraestructura
especulativa a un negocio de un solo operador. Un segundo ambiente **es**
infraestructura nueva.

Lo que lo justifica no es una previsión sino un hecho ya ocurrido: **la base de
producción tuvo que limpiarse a mano de pedidos de prueba**, con un runbook
escrito para eso, y volvió a pasar al cerrar `026`. La alternativa a este trabajo
no es "menos infraestructura", es seguir probando en producción y seguir
limpiando. Además el requisito nace de una necesidad declarada por el dueño del
repo, que es la prueba que el principio pide.

Donde el principio sí manda es en el tamaño: **un solo ambiente extra, para un
solo usuario, sin réplicas, sin ambientes por rama, sin automatización de
promoción, y sin web de staging desplegada.**

**Principio V** no se toca: staging no cambia nada sobre qué se muestra ni sobre
la columna `precio`, que sigue sin leerse.

**Repo público / sin datos de clientes**: FR-003 (base vacía) es la forma que
toma esa restricción acá. Copiar producción habría puesto datos de clientes
reales en un segundo lugar.
