# Feature Specification: El precio sale de la vista, y el sábado se coordina

**Feature Branch**: `013-precio-fuera-de-vista`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Decisión del cliente (Diego), tomada fuera del repo y transmitida por
Mateo el 2026-08-30: que el precio no aparezca en ningún lado. El tema de
precios lo gestiona él, contactando a la persona por su cuenta. El sitio queda
como el lugar donde se cargan los pedidos. Junto con eso, un cambio menor e
independiente: el horario del sábado pasa a ser *a coordinar*.

## Lo que cambia, dicho sin suavizar

Desde `002` este sitio **cotiza**: el punto de entrega cae en una de cinco
zonas y el sitio muestra el monto de esa zona, en firme. Eso fue una decisión
deliberada, con ADR, y **reescribió el Principio V de la constitución dos
veces** (2.0.0 y 4.0.0). Este feature lo revierte por tercera vez: el sitio deja
de decir cuánto sale.

Lo que **no** cambia es el mapa. Diego quiere que se siga viendo, y quiere que
se entienda que las zonas son distintas entre sí. Lo que se va de esa pantalla
es la columna de montos, no el dibujo. El mapa deja de ser una tabla de precios
y pasa a ser una declaración de cobertura: *acá trabajamos, y no todo es lo
mismo*.

Y una consecuencia que conviene decir en voz alta antes de que sorprenda: **el
sitio pierde la mitad pública de su propuesta**. Hasta hoy un visitante sin
cuenta podía llegar, marcar una esquina y saber el precio sin registrarse; ese
era el argumento explícito para que cotizar no tuviera puerta. Después de este
cambio, un visitante sin cuenta puede completar el formulario y no puede
confirmarlo, y no se lleva ningún número. La puerta del login sigue donde
estaba; lo que desaparece es el premio que había del lado de afuera.

**El dato no se toca.** El precio se sigue calculando en el navegador, se sigue
mandando al crear el pedido y se sigue guardando en la base. Lo que cambia es
que ningún ser humano lo ve. Esto es a pedido explícito de Mateo —*"por si en
algún momento se decide hacer como un rollback"*— y tiene una consecuencia
práctica que hay que aceptar de frente: **queda un número guardado que nadie
mira y que puede no tener nada que ver con lo que Diego termina cobrando.**
Volver atrás es barato; el costo es que la base contiene un campo que ya no es
verdad. Se acepta a sabiendas.

## Lo que este feature NO hace

- **No borra el precio del dato.** Ninguna migración elimina columnas, el cuerpo
  de `POST /pedidos` no cambia de forma, y la respuesta del servicio sigue
  trayendo `precio` y `zonaId`.
- **No toca las zonas como puerta.** Marcar el punto de la entrega sigue siendo
  obligatorio, y un punto fuera de las cinco zonas sigue sin producir pedido.
- **No cambia los límites de las zonas** más allá de regenerar el archivo
  generado a partir del KML que el cliente ya reajustó (ver *Dependencias*).
- **No cambia la regla de desempate** cuando dos zonas reclaman el mismo punto.
- **No agrega un mensaje sustituto.** Donde había un monto no va "coordinamos el
  precio por WhatsApp" ni equivalente.
- **No toca la app Android**, porque no hace falta: nunca mostró el precio.
- **No modifica los pedidos ya creados.** Los montos guardados quedan como
  están, simplemente dejan de mostrarse.

## Clarifications

### Sesión 2026-08-30

- **¿Hasta dónde va "sacar el precio": solo de la vista, o también del dato?** →
  **Solo de la vista.** Se sigue calculando, viajando y guardando. Motivo dado:
  poder revertir. (FR-015, FR-016)
- **¿Un punto fuera de zona sigue impidiendo el pedido?** → **Sí.** El mapa le
  promete al cliente dónde se trabaja y esa promesa se sostiene. Nunca la zona
  más cercana. (FR-013, FR-014)
- **¿El precio sale también de la app de Diego?** → **Sí**, decidido así. Al
  inventariar resultó que **la app nunca lo mostró**: el campo se parsea y
  ninguna pantalla lo dibuja. Queda como requisito de no-regresión. (FR-016)
- **¿Qué ve el cliente donde antes había un monto?** → **Nada sobre costo**, sin
  mención ni aviso de que se coordina aparte. (FR-003)
- **Entonces, ¿qué queda en ese lugar del formulario?** → **El nombre de la
  zona, confirmando la cobertura.** La pregunta salió de notar que el precio
  hacía dos trabajos a la vez: era el monto, y era también la señal de *tu
  dirección quedó dentro del área*. Sacarlo sin reemplazo dejaba el formulario
  hablando solo para decir que no. Nombrar la zona no es hablar de precio.
  (FR-003a)
- **Sin precio, "Zona 3" deja de significar algo para el cliente. ¿La leyenda
  del mapa dice algo más?** → **No: color y número, nada más.** Comunica lo que
  Diego pidió —son cinco, son distintas, se trabajan las cinco— sin inventar
  contenido que él no aprobó. Se descartó agregarle a cada zona la referencia de
  qué calles la limitan: es texto nuevo que hay que mantener cada vez que se
  mueva un trazado, y el pie de la sección ya nombra las avenidas que hacen de
  límite. (FR-010)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar un pedido sin que aparezca un precio (Priority: P1)

Una persona entra a cargar un envío, escribe las dos direcciones, marca la
esquina de la entrega en el mapa y confirma. En ningún momento del recorrido ve
un monto. Sabe igual que su dirección está dentro del área que se cubre, porque
si no lo estuviera el formulario se lo diría.

**Why this priority**: Es el pedido de Diego y es la superficie de mayor
tráfico. Si se hace solo esto, el cambio ya está entregado en lo que importa.

**Independent Test**: Recorrer el formulario de punta a punta con una dirección
válida y comprobar que no aparece ningún monto en pesos en ninguna pantalla, y
que el pedido se crea igual.

**Acceptance Scenarios**:

1. **Given** una persona con sesión iniciada en el formulario, **When**
   completa las dos direcciones y marca un punto de entrega dentro de una zona,
   **Then** el formulario la deja confirmar y en ninguna parte de la pantalla
   aparece un monto.
1a. **Given** el mismo caso, **When** el punto queda dentro de una zona,
   **Then** el formulario **le confirma que la dirección entra en la
   cobertura, nombrando la zona** y sin ninguna cifra. Sin este escenario el
   anterior se satisface con un formulario que no dice nada cuando la dirección
   está bien.
2. **Given** el punto de entrega ya marcado dentro de una zona, **When** la
   persona mueve el pin a otra zona también cubierta, **Then** no aparece
   ningún aviso de cambio de precio y el pedido se sigue pudiendo confirmar.
3. **Given** una persona que marca un punto fuera de las cinco zonas, **When**
   intenta confirmar, **Then** no se crea el pedido y se la encamina al
   contacto directo, con un mensaje que no menciona costo.
4. **Given** un pedido recién creado, **When** se lo mira en la base, **Then**
   tiene su zona y su precio guardados como antes del cambio.

---

### User Story 2 - Ver dónde se trabaja, sin ver cuánto sale (Priority: P2)

Alguien entra a *Sobre nosotros* para saber si le llegan. Ve el mapa con las
cinco zonas dibujadas y distinguibles, y una leyenda en texto que las nombra.
No ve precios en ninguna parte de la sección.

**Why this priority**: Es la pantalla donde el precio estaba más a la vista y
donde el mapa tiene que sobrevivir al cambio. Se puede entregar sin tocar el
formulario.

**Independent Test**: Abrir `/sobre-nosotros` y comprobar que las cinco zonas
siguen dibujadas y listadas por nombre, y que no hay ningún monto.

**Acceptance Scenarios**:

1. **Given** `/sobre-nosotros` cargada, **When** la persona mira la sección de
   zonas, **Then** ve el mapa con las cinco zonas y una leyenda con el nombre y
   el color de cada una, sin montos.
2. **Given** la misma sección, **When** la persona pasa el cursor sobre un
   polígono, **Then** el globo dice el nombre de la zona y ningún monto.
3. **Given** que los mosaicos del mapa no cargan, **When** la persona mira la
   sección, **Then** el aviso la remite a la leyenda de texto sin hablar de
   precios.
4. **Given** una persona que usa lector de pantalla, **When** recorre la
   sección, **Then** puede enumerar las cinco zonas sin ver el mapa.

---

### User Story 3 - El sábado se coordina (Priority: P3)

Alguien mira los horarios en *Sobre nosotros* y ve que el sábado no tiene una
franja fija: es a coordinar.

**Why this priority**: Es un cambio de una línea, independiente del resto, y no
bloquea nada.

**Independent Test**: Abrir `/sobre-nosotros` y leer la fila del sábado.

**Acceptance Scenarios**:

1. **Given** `/sobre-nosotros` cargada, **When** la persona mira los horarios,
   **Then** el sábado figura como *a coordinar* y no como una franja horaria.
2. **Given** la misma tabla, **When** la persona mira el resto, **Then** lunes a
   viernes y domingo siguen como estaban.

---

### User Story 4 - Repetir un pedido viejo sin arrastrar precios (Priority: P3)

Una persona repite un envío que ya hizo. El formulario se precarga y no le habla
de reajustes ni de cuánto salía antes.

**Why this priority**: Es la superficie donde más texto sobre precios quedó
escrito (`010`, `011`). Sin limpiarla el cambio queda a medias, pero llega
después de lo principal.

**Independent Test**: Repetir un pedido guardado y comprobar que no aparece
ningún aviso de precio ni monto.

**Acceptance Scenarios**:

1. **Given** un pedido anterior cuya zona hoy tiene otro precio, **When** la
   persona lo repite, **Then** no aparece ningún aviso de reajuste.
2. **Given** un pedido anterior a `011`, sin punto de entrega guardado, **When**
   la persona lo repite, **Then** se le pide igual la esquina de la entrega,
   con un texto que la justifica por cobertura y no por precio.
3. **Given** un pedido cuyo punto guardado hoy cae fuera de toda zona, **When**
   la persona lo repite, **Then** no puede confirmar y se la encamina al
   contacto.

---

### Edge Cases

- **El mapa del formulario no carga.** Sin mapa no hay punto, sin punto no hay
  zona y sin zona no se sabe si la dirección está cubierta: sigue bloqueando el
  pedido, pero el mensaje deja de decir que no se puede calcular el precio.
- **El listado de calles no carga.** Mismo caso: sigue bloqueando, con un texto
  que no menciona precio.
- **Dos zonas reclaman el mismo punto.** La regla de desempate vigente se
  mantiene tal cual. Deja de tener consecuencia visible, pero sigue decidiendo
  qué zona se guarda, así que cambiarla sería tocar el dato — y este feature no
  toca el dato.
- **Pedidos viejos con monto guardado.** En *Mis pedidos* dejan de mostrar el
  monto; el dato sigue en la base.
- **Un pedido cuyo punto queda fuera de zona al repetirlo.** El camino que ya
  existe (no se confirma, se encamina al contacto) se mantiene sin cambios de
  comportamiento, solo de texto.

## Requirements *(mandatory)*

### Functional Requirements

**Nada de precio a la vista**

- **FR-001**: Ninguna pantalla del sitio de cara al cliente MUST mostrar un
  monto en pesos, en ningún estado del recorrido.
- **FR-002**: Ningún texto de cara al cliente MUST justificar una acción, una
  obligación o un bloqueo apelando al precio. Donde el motivo real es la
  cobertura, el texto lo dice por cobertura.
- **FR-003**: El bloque que hoy muestra el precio del envío en el formulario
  MUST dejar de mostrar el monto, y en su lugar MUST NOT aparecer ninguna
  mención al costo ni promesa de coordinarlo aparte.
- **FR-003a**: Ese mismo bloque MUST confirmar, cuando el punto cae dentro de
  una zona, que la dirección entra en la cobertura, **nombrando la zona** y sin
  ninguna cifra. Es lo que queda del trabajo que hacía el precio: sin esto el
  formulario solo habla cuando la dirección está mal.
- **FR-004**: El resumen previo a confirmar MUST dejar de mostrar el monto.
- **FR-005**: El aviso que hoy informa un cambio de precio al mover el pin entre
  dos zonas cubiertas MUST desaparecer.
- **FR-006**: La tarjeta de pedido en *Mis pedidos* MUST dejar de mostrar el
  monto cobrado.
- **FR-007**: Al repetir un pedido, los avisos de reajuste de precio y de
  "pedido anterior al cambio de precios" MUST desaparecer. La necesidad de
  volver a marcar la esquina de la entrega, cuando el pedido viejo no tiene
  punto, MUST seguir existiendo y MUST justificarse por cobertura.
- **FR-008**: Los llamados a la acción y los textos introductorios que hoy
  ofrecen ver o conocer precios MUST dejar de hacerlo.

**El mapa se queda, y sigue siendo legible sin verlo**

- **FR-009**: La sección de zonas de *Sobre nosotros* MUST seguir mostrando el
  mapa con las cinco zonas dibujadas y distinguibles entre sí.
- **FR-010**: Esa sección MUST conservar una leyenda en texto con las cinco
  zonas, cada una con su nombre y su color, **y nada más**: sin montos y sin
  descripción de qué calles limitan cada una. La leyenda es
  permanente, no un reemplazo para cuando el mapa falla: es lo que hace la
  información accesible para quien no ve el mapa.
- **FR-011**: El globo de cada polígono, en los dos mapas donde aparece, MUST
  decir el nombre de la zona y MUST NOT decir un monto.
- **FR-012**: El aviso de mosaicos caídos MUST seguir remitiendo a la leyenda de
  texto, sin mencionar precios.

**La zona sigue siendo puerta**

- **FR-013**: Marcar el punto de la entrega MUST seguir siendo obligatorio para
  crear un pedido, y el sitio MUST seguir resolviendo la zona a partir de ese
  punto.
- **FR-014**: Un punto que cae fuera de las cinco zonas MUST seguir sin producir
  pedido y MUST seguir encaminando al contacto directo. El sistema MUST NOT
  ofrecer ni asumir la zona más cercana.

**El dato sigue como está**

- **FR-015**: El pedido que se manda al servicio MUST seguir llevando la zona y
  el precio calculados, y el servicio MUST seguir persistiéndolos. Ninguna
  migración elimina columnas.
- **FR-016**: El sitio y la app MUST seguir aceptando la zona y el precio en la
  respuesta del servicio sin mostrarlos. La app de Diego MUST NOT mostrar
  montos — hoy no los muestra, y el requisito existe para que siga así.

**Horarios**

- **FR-017**: El horario del sábado MUST figurar como *a coordinar*, sin franja
  horaria. Lunes a viernes y domingo MUST quedar como están.

**Dato de zonas**

- **FR-018**: El módulo generado de zonas MUST regenerarse a partir del KML
  vigente, y sus cinco anillos MUST cerrar.

**No regresiones**

- **FR-019**: El formulario MUST seguir cargando y funcionando con el servicio
  caído hasta el momento de confirmar. La guarda automática que impide que el
  cliente del servicio entre en el grafo de importación del formulario MUST
  seguir en verde.
- **FR-020**: MUST existir una prueba automática que falle si vuelve a
  aparecer un monto en una pantalla de cara al cliente.

### Key Entities

- **Zona**: una de las cinco áreas de cobertura. Tiene identificador, nombre,
  color y límite. **Sigue teniendo precio en el dato**; deja de tenerlo a la
  vista.
- **Pedido**: sigue guardando la zona y el precio con que se creó. Ninguno de
  los dos se muestra a nadie.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recorriendo el sitio entero —inicio, pedido, sobre nosotros, mis
  pedidos, repetir un pedido— no aparece **ningún** monto en pesos, en ningún
  estado, ni en globos del mapa.
- **SC-002**: Una persona completa y confirma un pedido de punta a punta sin ver
  un precio y sin quedar en duda sobre si su dirección está dentro del área que
  se cubre.
- **SC-003**: El 100% de los puntos marcados fuera de las cinco zonas sigue sin
  producir pedido, y ninguno recibe una zona sustituta.
- **SC-004**: Una persona que no ve el mapa puede enumerar las cinco zonas desde
  el texto de la página.
- **SC-005**: La fila del sábado dice que el horario se coordina.
- **SC-006**: Un pedido creado después del cambio tiene zona y precio guardados
  en la base, igual que uno creado antes.
- **SC-007**: Una prueba automática falla si alguien reintroduce un monto en una
  pantalla de cara al cliente.

## Assumptions

- Los montos por zona siguen existiendo en el generador de zonas y se siguen
  emitiendo al módulo generado, porque el dato se conserva (FR-015).
- Diego contacta por su cuenta a cada cliente para acordar el precio. El sitio
  no participa de esa conversación y no la anuncia.
- Nadie depende hoy del sitio para saber cuánto sale un envío: no hay volumen
  real en producción que quede huérfano por el cambio.
- El mapa del formulario y el de *Sobre nosotros* comparten componente, así que
  lo que se saque del globo se saca de los dos a la vez.

## Dependencias

- **Enmienda de la constitución.** El Principio V vigente dice que el sitio
  resuelve el precio sin intervención humana y lo muestra *como el precio, no
  como estimación*, y las *Scope boundaries* prometen que el precio de la zona
  se muestra desde el punto de entrega y que cotizar es público. Este feature
  contradice las dos cosas. **La constitución se enmienda antes de escribir
  código**, no después: es el documento de mayor autoridad del repo y el
  gobierno exige que una reversión de principio sea MAJOR y quede fechada.
- **ADR.** La decisión es difícil de revertir en su efecto de producto, es
  sorprendente sin contexto —revierte dos ADR previos que argumentaron lo
  contrario— y tiene un tradeoff real (se pierde la cotización pública, se gana
  el control del cliente sobre su propio precio). Los dos ADR anteriores sobre
  precio quedan **superseded** en lo que hace a mostrarlo.
- **KML reajustado.** `web/design-source/zonas-flash-urbano.kml` está modificado
  sin commitear: el cliente reajustó el trazado de un polígono. El módulo
  generado de zonas quedó desactualizado y se regenera dentro de este feature.
  El límite dibujado tiene que seguir correspondiendo a las calles que son la
  definición autoritativa.
- **Plan `012` abierto.** `specs/012-app-repartidor/plan.md` sigue en
  `status: active` con tres tareas sin cerrar. No pueden convivir dos planes
  activos: hay que pausarlo o cerrarlo, con la decisión registrada en el propio
  plan, antes de promover el de este feature.
