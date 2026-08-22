# Feature Specification: El precio sale de la entrega, no del retiro

**Feature Branch**: `011-precio-por-entrega`

**Created**: 2026-08-22

**Status**: Draft

**Input**: El cliente (Diego) pidió el 2026-08-22, en persona, que el mapa, el
punto y la deducción del precio salgan de la dirección de **entrega** y no de la
de retiro.

## Lo que hay que arreglar, dicho sin suavizar

El sitio cobra por la zona del **retiro**. Diego siempre definió sus zonas y sus
precios por **a dónde va el paquete**. Nadie introdujo un defecto: se construyó
sobre un entendido equivocado, y el propio dueño del repo lo reconoce como error
de comunicación de las dos partes.

Lo que eso significa hoy, en plata: **todo pedido cuyo retiro y entrega caigan en
zonas distintas está cobrado mal**. No "podría estar" — está. Un envío que sale
de zona 1 ($150) hacia zona 5 ($350) se cobró $150.

**Esto no es una mejora de precisión. Es el precio equivocado.** Y por eso no
entra por la puerta de las mejoras: entra ahora, y lo único que lo demora es que
contradice un documento que hay que corregir primero (ver *Dependencias*).

**La inversión es de la pantalla y del precio, no del cálculo.** Lo que hoy hace
la sección de retiro —mostrar el mapa, dejar ver y ajustar el punto, decidir zona
y precio— pasa entero a la sección *a dónde llevamos el paquete*. El retiro
**pierde el mapa pero conserva el punto**, resuelto en silencio: se sigue usando
para comprobar que esté dentro del área y para que la ruta de Diego tenga
coordenadas (FR-011, FR-012). Un solo mapa en el formulario, y es el de la
entrega.

## Lo que este feature NO hace

- **No cambia dónde se calcula el precio.** Se sigue calculando en el navegador,
  sin preguntarle al servicio, para que cotizar funcione con el backend caído.
  Cambia **de qué punto sale**, no quién lo resuelve.
- **No cambia las zonas, ni sus límites, ni sus precios.** Son los mismos cinco
  polígonos y los mismos cinco montos.
- **No cambia la regla de la zona ambigua.** Cuando dos zonas reclaman el punto
  sigue ganando la más barata.
- **No toca el historial ni la tarjeta de pedido** que entregó `010`, salvo en lo
  que repetir un pedido necesite.
- **No arregla el precio de los pedidos ya creados.** No hay pedidos reales en
  producción; los locales son de prueba.

## Clarifications

### Sesión 2026-08-22

- **¿El retiro tiene que estar dentro del área de servicio?** → **Sí**, y el
  sitio lo comprueba (FR-011).
- **¿Se sigue guardando el punto de retiro?** → **Sí**, resuelto en silencio y
  sin mapa (FR-003, FR-012). La respuesta llegó con una corrección al vuelo sobre
  la opción ofrecida: la opción decía "quedan dos mapas" y la respuesta fue
  *"que resuelva por atrás silenciosamente los puntos"*, que valida el área sin
  devolverle al retiro la pantalla que este feature le quita. **La inversión se
  mantiene: un solo mapa, y es el de la entrega.**

- **¿Y cuando el retiro no resuelve a ningún punto?** → **Pasa igual, como texto
  y sin punto, en silencio** (FR-015). El registro queda con el punto vacío y eso
  alcanza para encontrarlo después; el caso se atiende por el canal humano que ya
  existe, cuando Diego avise que no le anda el mapa para ir a retirar.
  **Explícitamente provisorio**: se elige no trancar el primer pedido real por
  encima de tener el dato completo, y se puede elegir así justamente porque
  todavía no hay nadie en producción.

Lo que esas respuestas abren, y quedó anotado en vez de descubrirse
implementando: el retiro **no siempre** se puede resolver en silencio. Con calle
homónima hay que preguntar (FR-014), y sin resolución no hay área que comprobar,
así que **FR-011 pasa a ser de mejor esfuerzo** y **el punto de retiro deja de ser
obligatorio en la base** (FR-012).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El precio sale de a dónde va el paquete (Priority: P1)

Quien envía escribe la dirección de entrega —calle y esquina—, ve el punto
ubicado en el mapa, y de ese punto sale la zona y el precio. El retiro lo escribe
sin mapa: el sitio lo ubica por atrás y sólo le habla si hay algo que decidir.

**Why this priority**: es el feature entero. Sin esto se sigue cobrando mal.

**Independent Test**: se cotiza un envío cuya entrega cae en una zona distinta a
la del retiro, y el precio mostrado es el de la zona de **entrega**.

**Acceptance Scenarios**:

1. **Given** una entrega en zona 1 y un retiro en zona 5, **When** se resuelve el
   cruce de la entrega, **Then** el precio es $150 y no $350.
2. **Given** una entrega cuyo punto no cae en ninguna zona, **When** se resuelve
   el cruce, **Then** no hay precio, no se puede confirmar, y la pantalla
   encamina al contacto directo — nunca la zona más cercana.
3. **Given** el servicio apagado, **When** se completa la dirección de entrega,
   **Then** el precio se muestra igual.
4. **Given** un retiro escrito con una calle inequívoca, **When** se completa,
   **Then** el punto se resuelve **sin mostrar mapa ni pedir nada**, y sólo se
   avisa si cae fuera del área de servicio.

---

### User Story 2 - Repetir un pedido sigue funcionando (Priority: P2)

Repetir un pedido del historial precarga el formulario y resuelve el precio de
nuevo, ahora desde el punto de entrega guardado.

**Why this priority**: `010` acaba de entregar esto y no puede quedar roto.
Depende de US1 y es más chico.

**Independent Test**: se repite un pedido y el precio que aparece es el de la
zona de su entrega, con el aviso de reajuste si cambió.

**Acceptance Scenarios**:

1. **Given** un pedido con punto de entrega guardado, **When** se repite,
   **Then** el punto se recoloca en el cruce y el precio se resuelve de ese
   punto.
2. **Given** un pedido cuya entrega hoy no resuelve a ninguna zona, **When** se
   repite, **Then** no hay precio ni confirmación, igual que en un pedido nuevo.

---

### User Story 3 - Mi cuenta sigue precargando lo que sabe (Priority: P3)

La dirección guardada en *Mi cuenta* sigue precargando el **retiro** — es la
dirección propia de quien envía, y de ahí sale el paquete casi siempre.

**Why this priority**: es continuidad de `007`, no capacidad nueva. Si se
rompiera, se pierde el motivo por el que alguien guarda su dirección.

**Acceptance Scenarios**:

1. **Given** una cuenta con dirección guardada, **When** se abre el formulario,
   **Then** el retiro viene precargado y la entrega vacía.

### Edge Cases

- **La entrega es la dirección de un tercero.** Quien envía puede conocerla peor
  que la propia: sabe la calle y el número, pero no la esquina. Hoy esa dificultad
  la tiene en el retiro, que es su propia casa. **El feature mueve la fricción al
  lugar donde hay menos información, y eso es inherente a cobrar por destino.**
  Lo que existe para amortiguarlo ya está construido: el índice de esquinas, la
  lista de candidatos cuando la calle es homónima, y el mapa que muestra dónde
  quedó el punto.
- **Una entrega fuera de toda zona.** Antes esto pasaba con el retiro y bloqueaba
  el pedido. Ahora pasa con la entrega. El resultado es el mismo —sin zona no hay
  precio ni pedido— pero **va a pasar más seguido**, porque enviar fuera del área
  de servicio es más común que retirar fuera de ella.
- **Un pedido de `010` sin punto de entrega guardado.** Los pedidos creados antes
  de este feature no tienen esa columna. Repetirlos tiene que hacer algo definido
  y no romperse.
- **Retiro y entrega en la misma cuadra.** No cambia nada: el precio sale de la
  entrega igual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El precio MUST derivarse del punto de la dirección de **entrega**.
- **FR-002**: La sección de entrega MUST resolver el cruce de calles, colocar el
  punto y mostrarlo en el mapa, con el mismo comportamiento que hoy tiene el
  retiro: candidatos cuando la calle es homónima, y el punto confinado a la
  cuadra indicada.
- **FR-003**: La sección de retiro MUST perder el mapa. **No pierde el punto**:
  lo resuelve **en silencio**, sin mostrarlo y sin pedirle nada a quien escribe
  (clarificación del 2026-08-22). Es lo mismo que `bloque-direccion` ya hace
  cuando el cruce es inequívoco; lo que se quita es la pantalla, no el cálculo.
- **FR-004**: El precio MUST seguir calculándose en el navegador, sin depender
  del servicio. Cotizar con el backend caído MUST seguir funcionando.
- **FR-005**: Un punto de entrega fuera de toda zona MUST dar **sin precio y sin
  pedido**, y encaminar al contacto directo. MUST NOT caer a la zona más cercana.
- **FR-006**: Cuando dos zonas reclamen el punto de entrega, MUST ganar la de
  menor precio, igual que hoy.
- **FR-007**: El pedido MUST guardar el punto de entrega, y ese punto MUST ser el
  que permita recalcular después qué zona correspondía.
- **FR-008**: Repetir un pedido MUST resolver el precio del punto de entrega
  guardado, con el aviso de reajuste que `010` ya define si cambió.
- **FR-009**: La dirección guardada en *Mi cuenta* MUST seguir precargando el
  **retiro**.
- **FR-010**: El servicio MUST NOT resolver zonas ni recalcular precios. Sigue
  guardando el punto y el precio declarado.
- **FR-011**: El retiro MUST caer dentro del área de servicio **cuando su punto
  se pueda resolver** (decisión del 2026-08-22). La comprobación se hace contra el
  punto resuelto en silencio de FR-003, **no** pidiéndole a nadie que marque un
  mapa. Un retiro que resuelve y cae fuera de toda zona MUST avisar y MUST NOT
  dejar confirmar.
  - **Es una comprobación de mejor esfuerzo, no una garantía**, y conviene no
    confundirse: por FR-015 un retiro que no resuelve pasa igual, sin control.
    O sea que el área se cumple **casi siempre**, no siempre, y la diferencia es
    exactamente el tamaño de los huecos del índice de calles.
- **FR-012**: El punto de retiro MUST seguir guardándose **cuando exista**,
  aunque no decida el precio (decisión del 2026-08-22). El motivo no es la
  cotización sino la ruta: la app Android planifica desde la posición de Diego, y
  un pedido sin coordenadas del retiro la obliga a geocodificar texto o a
  ubicarlo a mano.
  - **Deja de ser obligatorio.** Hoy la columna es `NOT NULL` con el argumento
    escrito de que "sin punto no hay zona, sin zona no hay precio". Ese argumento
    ya no aplica —el precio sale de la entrega— y FR-015 exige poder guardar un
    pedido sin él. **La app Android tiene que tolerar un retiro sin coordenadas**,
    y eso hay que decírselo a quien la construya.
- **FR-013**: Los pedidos creados antes de este feature MUST tener un
  comportamiento definido al repetirse, y ese comportamiento MUST NOT ser una
  pantalla rota.
- **FR-014**: Cuando el cruce del retiro sea **ambiguo** —más de un candidato,
  que es lo que pasa con las ~50 familias de calles homónimas de Montevideo—
  el sitio MUST pedir que se elija, igual que hace hoy. **Resolver la ambigüedad
  en silencio quedándose con el primer candidato está prohibido**: pondría el
  retiro en otro barrio sin que nadie se entere, y es la trampa que el índice de
  calles tiene documentada. La fricción aparece **sólo** cuando hay ambigüedad
  real, no en el caso común.
- **FR-015**: Cuando el texto del retiro **no resuelva a ningún punto** —calle
  fuera del índice, error de tipeo, o un cruce que no existe— el pedido MUST
  seguir adelante **con el retiro como texto y sin punto**, y MUST NOT decirle
  nada a quien lo está creando (decisión del 2026-08-22). El pedido se guarda con
  el punto de retiro **vacío**, y ese vacío es la señal: quien opera el sistema
  puede encontrarlo consultando la base, sin que el que envía se entere de que
  hubo un problema.
  - **El hueco se atiende por el canal humano que ya existe.** El caso previsto
    es Diego preguntando "no me anda el mapa para ir a retirar"; la respuesta sale
    de mirar el registro, y él sigue adelante con la dirección escrita.
  - **Es deliberadamente provisorio**, y el motivo es que todavía no hay nadie en
    producción: prioriza no trancar el primer pedido real por encima de tener el
    dato completo. Queda anotado como deuda con su disparador.

### Key Entities

- **Pedido**: gana un punto de entrega y **conserva** el de retiro. La zona y el
  precio congelados pasan a corresponder a la entrega.
- **Dirección de entrega**: pasa de texto libre a dirección resuelta a un punto.
- **Dirección de retiro**: conserva su punto, que se resuelve sin pantalla. Deja
  de decidir el precio y pasa a servir para dos cosas: comprobar el área y darle
  coordenadas a la ruta.
- **Perfil**: sigue guardando la dirección propia de quien envía, que precarga el
  retiro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Cero** envíos cobrados a la zona del retiro. Cada pedido creado
  después de este feature paga la zona que le corresponde a su destino.
- **SC-002**: Cotizar sin cuenta y con el servicio apagado sigue funcionando: se
  escribe una entrega y se ve un precio.
- **SC-003**: **Cero** pedidos confirmados sin punto de entrega resuelto.
- **SC-004**: Repetir un pedido del historial termina en un precio correcto o en
  un aviso claro, nunca en una pantalla rota.
- **SC-005**: Completar un pedido no cuesta más pasos que antes del cambio: lo
  que se resuelve en una dirección se dejó de resolver en la otra.

## Dependencias y bloqueos

- **BLOQUEANTE — la constitución dice lo contrario.** El Principio V dice
  *"Pricing is a function of the pickup zone… the customer marks the pickup
  point"*, y Scope boundaries describe el retiro como *"written plus a point
  marked on the map"* con el precio *"shown from that point"*. Este feature
  **revierte** eso. Governance exige que una reversión venga acompañada de una
  entrada en `docs/decisions/`. **El plan de este feature no se puede promover a
  `active` hasta que la constitución esté enmendada y el ADR escrito.** Hay
  precedente exacto: el ADR `zone-based-automatic-pricing` ya enmendó este mismo
  principio una vez.
- **`010` quedó cerrado con verificación manual parcial**, y los pasos que no se
  corrieron (M2, M3 y M4 de su quickstart) se arrastran al de este feature.

## Assumptions

- **No hay pedidos reales en producción.** Confirmado por el dueño del repo el
  2026-08-22. Por eso la columna del punto de entrega puede entrar obligatoria,
  sin relleno ni compatibilidad hacia atrás. **Si esto resultara falso, FR-013
  cambia de tamaño.**
- **Los pedidos locales de prueba son descartables.** Se pueden recrear.
- **Las zonas siguen siendo las mismas cinco.** El caso del precio en avenida
  límite quedó despriorizado por el cliente el mismo día y anotado en el tracker;
  no entra acá.
- **El área de servicio no cambia**, y desde la clarificación del 2026-08-22 se
  mide contra **los dos** extremos: la entrega decide el precio, y el retiro tiene
  que estar adentro igual.
- **La regla es del cliente.** Las zonas y los precios los definió Diego, y él es
  quien dice a qué extremo del envío se aplican.
