# Feature Specification: Qué versión tiene el teléfono

**Feature Branch**: `017-version-de-la-app`

**Created**: 2026-08-31

**Status**: Draft

**Input**: Mateo, el 2026-08-31, justo después de publicar el primer APK por
link. Hasta hoy la app se instalaba con el teléfono de Diego en la mano; desde
hoy se le manda un link de GitHub Releases y él la instala solo, en su casa. El
pedido textual: *"el versionCode sigue clavado en 1 y cuando Diego te diga 'me
pasa esto' no vas a saber qué versión tiene"*.

## El problema, y por qué recién aparece ahora

Mientras el APK se instalaba por cable, **la pregunta no existía**: quien
instalaba era quien había compilado, en el momento de compilar. La versión del
teléfono era, por construcción, la última.

Instalar a distancia rompe eso. Ahora hay un intervalo —de horas o de semanas—
entre que se publica una versión y que Diego la instala, y **nadie sabe en qué
punto de ese intervalo está el teléfono**. Eso convierte cada reporte de defecto
en una conversación previa: *"¿ya la actualizaste?"*, que Diego contesta de
memoria y sobre algo que no tiene forma de mirar.

Hoy la app no puede contestarlo ni aunque se le pregunte:
`android/app/build.gradle.kts` tiene `versionCode = 1` y `versionName = "0.1.0"`
escritos a mano desde `012` y **nunca se movieron**, en un binario que desde
entonces cambió con `015` y con `016`. Un teléfono con la app de agosto y otro
con la de hoy declaran exactamente lo mismo.

Es un defecto de diagnóstico, no de producto: **no rompe ninguna entrega**. Lo
que rompe es la capacidad de arreglar lo que sí las rompa, y por eso importa
ahora y no cuando haya un segundo repartidor.

## La decisión que le da forma a todo: el número solo sirve si alguien lo lee

Subir `versionCode` en cada release es la parte fácil y **no resuelve nada por
sí sola**. Un número que cambia pero que nadie puede observar desde afuera deja
el problema intacto: seguiría sin haber forma de saber qué tiene el teléfono.

Así que este feature tiene dos mitades y **la segunda es la que vale**:

1. Que cada versión publicada lleve un número distinto.
2. Que ese número se pueda **averiguar sobre el teléfono de Diego**, sin cable,
   sin visita, y sin que él tenga que entender qué es una versión.

La segunda mitad es la que tenía un diseño que decidir: quién hace el esfuerzo
de leer el número. **Se decidió que los dos** (Clarifications, 2026-08-31), y no
por indecisión — contestan preguntas distintas:

- **En pantalla**, Diego la lee y la dice. Sirve cuando él ya está escribiendo
  por otra cosa, que es el caso que motivó el feature.
- **Al servicio**, se averigua sin molestarlo. Es la única de las dos que
  contesta *"¿ya instaló la última?"* **sin preguntarle**, que es justamente la
  pregunta que uno se hace cuando él no está disponible o cuando la respuesta
  de memoria no es confiable.

La de pantalla sola dejaría el segundo caso sin cubrir; la del servicio sola
obligaría a mirar el servicio para algo que él podía leer y decir en el mismo
mensaje en que reporta el defecto.

## La restricción heredada que hay que escribir antes de que muerda

El APK se firma con la **clave de depuración de la máquina de Mateo**
(`~/.android/debug.keystore`), a propósito y desde `012` (research D11): no hay
tienda, y una clave propia sólo hace falta el día que la haya.

Eso era inofensivo mientras la instalación era presencial. **Con actualizaciones
a distancia deja de serlo**, porque Android sólo instala una actualización
encima si está firmada con la misma clave que la versión instalada. Si ese
archivo se pierde —una máquina nueva, un formateo, un disco muerto—, la próxima
versión **no se instala encima**: Diego tiene que desinstalar y reinstalar, lo
que le borra la sesión y lo obliga a pedir un código nuevo.

No es hipotético ni caro de evitar, y hoy **no está escrito en ningún lado del
repo**. Este feature lo escribe. No cambia la decisión de `012`: la documenta
con la consecuencia que antes no tenía.

## Lo que este feature NO hace

- **No emite una clave de firma propia.** La decisión de `012` sigue en pie. Lo
  que cambia es que su consecuencia queda escrita.
- **No avisa dentro de la app que hay una versión nueva.** Ver Assumptions: hoy
  el aviso es el mensaje de WhatsApp que acompaña al link, y con un solo
  repartidor eso alcanza.
- **No automatiza el build ni la publicación desde CI.** Publicar sigue siendo
  un acto deliberado desde la máquina donde vive la clave de firma.
- **No fuerza la actualización.** Un teléfono con una versión vieja sigue
  funcionando; el servicio no rechaza versiones.
- **No toca la app de Diego como producto.** Ninguna pantalla de trabajo cambia
  de comportamiento; lo único que aparece es la versión, que no hace nada al
  tocarla.
- **No identifica el teléfono ni arma un registro de dispositivos.** Lo que
  viaja al servicio es la versión de la app y nada más (FR-011). Saber qué
  modelo, qué Android o qué IMEI tiene no hace falta para esto, y un dato que no
  hace falta no se guarda.
- **No publica en ninguna tienda.**

## Clarifications

### Session 2026-08-31

- **P: ¿Cómo se averigua qué versión tiene el teléfono de Diego?** (FR-003)
  → **Las dos vías: la app la muestra en pantalla y además se la informa al
  servicio.** Contestan preguntas distintas y ninguna cubre a la otra: la
  pantalla sirve cuando Diego ya está escribiendo, y el servicio es lo único que
  responde *"¿ya instaló la última?"* sin preguntarle. Es la opción más cara de
  las cuatro que se plantearon, y se eligió a sabiendas. Toca `android/` y
  `backend/`. Ver FR-003 y FR-010.

- **P: ¿Cómo se garantiza que el número sube en cada publicación?** (FR-002)
  → **Se deriva del tag de la publicación**, que pasa a ser la única fuente del
  número. La alternativa —editarlo a mano y verificarlo antes de publicar— deja
  vivo el paso que se puede olvidar; derivarlo lo elimina. Además cae de arriba
  el cumplimiento de FR-004 (el APK y la publicación no pueden discrepar, porque
  salen del mismo dato) y de FR-006 (un binario compilado sin tag se identifica
  distinto sin que nadie haga nada). Ver FR-002.

- **P: ¿Con qué regla se calcula el entero que Android compara?** (FR-001)
  → **`major*10000 + minor*100 + patch`**, derivado del mismo tag. Se lee al
  revés (`200` es `0.2.0`), sube siempre que suba el tag, y **el mismo tag
  produce siempre el mismo número**, que es lo que FR-012 necesita. Se descartó
  contar commits (no guarda relación con el nombre) y la fecha del build
  (recompilar el mismo tag daría un número distinto, rompiendo la
  reproducibilidad). Límite aceptado: ninguna parte de la versión puede pasar
  de 99.

- **P: ¿Dónde queda, del lado del servicio, la versión que informa la app?**
  (FR-010) → **En la fila de la sesión**, junto con cuándo se la vio por última
  vez. Una sola consulta contesta qué versión está usando Diego, sin tabla
  nueva y sin crecer sin límite: hay una fila por sesión, no por pedido. Se
  descartó dejarla sólo en el log (los de Railway rotan, así que la respuesta
  caduca) y una tabla histórica nueva (crecería con cada pedido para responder
  algo que hoy tiene una sola respuesta — Principio III).

- **P: ¿Dónde ve Diego la versión dentro de la app?** (FR-003)
  → **En dos lugares: al pie de la pantalla de Ingreso y al final de la lista
  de pedidos.** La primera sola no alcanzaba y casi se acepta igual: **la sesión
  no expira**, así que Diego puede pasar meses sin ver esa pantalla, y llegar a
  ella significaría cerrar sesión — justo lo que no se quiere. El renglón al
  final de la lista es el que cumple FR-003 y SC-001 mientras él trabaja, y no
  gasta un milímetro de pantalla permanente, que es lo que `015` estuvo sacando.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber qué versión tiene el teléfono que reporta el defecto (Priority: P1)

Diego avisa por WhatsApp que algo no anda. Antes de mirar una línea de código,
Mateo necesita saber si eso está pasando sobre la versión que él cree o sobre
una de hace tres semanas — porque si es lo segundo, el defecto puede estar
arreglado desde hace tres semanas y la respuesta es *"actualizá"*, no una sesión
de depuración.

**Why this priority**: Es el feature entero. Las otras dos historias existen
para que ésta sea posible o para que no se degrade con el tiempo.

**Independent Test**: Con la app instalada en un teléfono, averiguar qué versión
tiene sin conectarlo por cable y sin tenerlo en la mano, y comparar contra lo
publicado.

**Acceptance Scenarios**:

1. **Given** un teléfono con una versión publicada instalada, **When** se
   averigua qué versión corre, **Then** el dato obtenido identifica sin
   ambigüedad a **una** versión publicada.
2. **Given** dos teléfonos con versiones publicadas distintas, **When** se
   averigua la versión de cada uno, **Then** los dos datos son distintos.
3. **Given** que se le pregunta a Diego, **When** él contesta, **Then** no
   necesitó navegar ajustes del sistema ni saber qué es un `versionCode`.

---

### User Story 2 - Publicar una versión nueva sin poder olvidarse del número (Priority: P2)

Mateo termina un arreglo y quiere publicarlo. Sigue el procedimiento del repo y
al final hay un link para mandarle a Diego. **Si en el camino no subió el número
de versión, se entera antes de publicar y no después**, cuando el APK ya está en
el teléfono de otra persona y declara ser algo que no es.

**Why this priority**: Sin esto la historia 1 se degrada sola. Un procedimiento
que depende de acordarse funciona las primeras veces y falla exactamente el día
que hay apuro, que es el día que se publica un arreglo urgente.

**Independent Test**: Intentar publicar dos veces sin tocar el número y
comprobar que la segunda no pasa inadvertida.

**Acceptance Scenarios**:

1. **Given** una versión ya publicada, **When** se intenta publicar otra sin
   haber subido el número, **Then** el intento se detiene o avisa, y no produce
   una publicación silenciosa.
2. **Given** una versión publicada, **When** se mira el release y el APK,
   **Then** el número que declara el archivo y el que nombra el release
   coinciden.

---

### User Story 3 - Publicar por link siguiendo sólo el documento (Priority: P3)

Alguien que no vivió esta sesión —Mateo dentro de seis meses— tiene que poder
publicar una versión y hacérsela llegar a Diego leyendo únicamente
`docs/processes/app-repartidor.md`, incluido qué mensaje mandarle para que la
instalación no se trabe en un permiso.

**Why this priority**: El documento hoy describe un mundo que ya no existe
—cable, `adb`, gestor de archivos— y no menciona la publicación por link. Un
runbook desactualizado es peor que ninguno: se sigue, y lleva al lugar
equivocado.

**Independent Test**: Seguir el documento de punta a punta sin consultar esta
conversación, y llegar a un link que instala.

**Acceptance Scenarios**:

1. **Given** el documento actualizado, **When** alguien lo sigue desde cero,
   **Then** llega a una versión publicada y a un mensaje para mandar, sin
   preguntar nada fuera del documento.
2. **Given** el documento, **When** se busca qué pasa si se pierde la clave de
   firma, **Then** la consecuencia y el costo están escritos.

---

### Edge Cases

- **Diego nunca instala la actualización.** El teléfono sigue en la versión
  vieja y eso tiene que ser observable, no invisible: es el caso que motivó el
  feature.
- **Diego reinstala a mano una versión anterior**, porque le quedó el archivo
  viejo en Descargas. Android no permite bajar de versión, así que el intento
  falla; lo que importa es que el mensaje que ve no lo deje pensando que la app
  se rompió.
- **Se publica una versión y se descubre que está mal antes de que la instale.**
  Retirarla no alcanza si él ya la bajó: la que la reemplace necesita un número
  mayor igual, sin reutilizar el retirado.
- **Se compila un APK sin publicarlo** —una prueba local— y termina en un
  teléfono. Ese binario también declara una versión, y no debería hacerse pasar
  por una publicada.
- **La clave de firma se pierde.** No hay recuperación: es desinstalar,
  reinstalar y volver a ingresar. Lo único que se puede hacer es que esté
  escrito antes de que pase.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada versión publicada MUST llevar un identificador de versión
  estrictamente mayor que el de la anterior, de modo que Android la acepte como
  actualización encima de la instalada. El entero que Android compara MUST
  calcularse como `major*10000 + minor*100 + patch` sobre el número del tag, de
  modo que sea legible al revés y que un mismo tag produzca siempre el mismo
  entero.
- **FR-002**: El identificador de versión MUST derivarse del tag de la
  publicación, de modo que exista **una sola fuente** y no haya un paso separado
  que se pueda olvidar. Compilar sin un tag MUST seguir siendo posible —hace
  falta para probar— pero MUST producir un identificador que no se confunda con
  el de una versión publicada.
- **FR-003**: La app MUST mostrar su versión **al final de la lista de pedidos**
  —un lugar al que Diego llega desplazando, sin instrucciones, mientras
  trabaja— y **al pie de la pantalla de Ingreso**, con un texto que se entienda
  sin saber qué es una versión. Ninguna de las dos MUST ocupar espacio
  permanente de pantalla en las secciones de trabajo.
- **FR-004**: El identificador que declara el APK MUST coincidir con el que
  nombra la publicación, para que el dato obtenido del teléfono se pueda cruzar
  contra lo publicado.
- **FR-005**: Una versión ya publicada MUST NOT ver su identificador reutilizado
  por otra distinta, ni siquiera si la primera se retira.
- **FR-006**: Un APK compilado fuera del procedimiento de publicación MUST poder
  distinguirse de uno publicado.
- **FR-007**: `docs/processes/app-repartidor.md` MUST documentar la publicación
  por link: cómo se publica una versión, qué se le manda a Diego, y qué tiene
  que tocar él para que instale.
- **FR-008**: Ese documento MUST registrar que el APK se firma con la clave de
  depuración de una máquina concreta, dónde vive ese archivo, y que perderlo
  obliga a desinstalar y reinstalar con pérdida de la sesión.
- **FR-009**: Instalar una versión nueva encima de una instalada MUST NOT
  obligar a desinstalar ni hacer que Diego vuelva a ingresar.
- **FR-010**: La app MUST informarle su versión al servicio al comunicarse con
  él, y el servicio MUST guardarla **en la fila de la sesión** junto con cuándo
  la vio por última vez, de modo que una sola consulta conteste qué versión está
  en uso **sin preguntarle nada a Diego**. MUST quedar una fila por sesión, no
  una por pedido.
- **FR-011**: Lo que la app le informa al servicio MUST NOT incluir ningún dato
  del teléfono más allá de la versión de la app. Saber qué versión corre no
  requiere saber qué teléfono es, y el feature no abre esa puerta.
- **FR-012**: La versión que muestra la pantalla y la que se le informa al
  servicio MUST ser la misma, para que las dos vías no puedan contradecirse.

### Key Entities

- **Versión publicada**: una entrega concreta de la app a Diego. La identifican
  un número que Android compara para decidir si acepta la actualización y un
  nombre legible para las personas. Se corresponde con un archivo publicado y
  con el estado del repositorio del que salió.
- **Sesión** (ya existe): gana la versión que la app declaró la última vez que
  usó esa credencial y cuándo fue. Es lo que se consulta para saber qué está
  corriendo Diego. No es un dato del teléfono: es un dato de la app (FR-011).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ante un reporte de Diego, se averigua qué versión tiene el
  teléfono **en menos de un minuto**, sin cable, sin visita y sin que él tenga
  que buscar nada en los ajustes del sistema.
- **SC-002**: Sobre las versiones publicadas, **no hay dos que compartan
  identificador**, comprobable mirando lo publicado.
- **SC-003**: Diego instala una actualización encima de la que tiene **sin
  desinstalar y sin volver a ingresar**, comprobado sobre su teléfono real.
- **SC-004**: Alguien que sigue `docs/processes/app-repartidor.md` desde cero
  publica una versión y la instala en un teléfono **sin consultar nada fuera del
  documento**.
- **SC-005**: Publicar sin subir el número **no produce una publicación
  silenciosa**: el intento se detiene o avisa, comprobado provocándolo a
  propósito.
- **SC-006**: Se averigua qué versión está en uso **sin mandarle un mensaje a
  Diego ni esperar que conteste**, comprobado consultando el servicio después de
  que la app haya trabajado.
- **SC-007**: Cuando se le pregunta a Diego qué versión tiene, la que él lee en
  pantalla **coincide** con la que registró el servicio.

## Assumptions

- **Un solo repartidor, un solo teléfono.** Nada acá supone una flota. Averiguar
  la versión de un teléfono se puede hacer preguntando; con diez no.
- **La app no avisa que hay una versión nueva.** El aviso es el mensaje de
  WhatsApp con el link. Un aviso dentro de la app es la solución del día que
  haya varios repartidores, y hoy sería infraestructura para un problema que no
  existe (Principio III de la constitución).
- **Publicar sigue siendo manual y deliberado**, desde la máquina donde vive la
  clave de firma. Automatizarlo en CI exigiría llevar la clave a otro lado, que
  es una decisión distinta y más cara.
- **El canal de distribución es una publicación pública del repositorio**, que
  ya se usó para `v0.1.0` el 2026-08-31. Que el APK quede descargable por
  cualquiera es aceptable: sin un código de ingreso la app no muestra ningún
  dato, y la URL del servicio ya es pública en el código.
- **El servicio no rechaza versiones viejas.** Un teléfono desactualizado sigue
  trabajando.
