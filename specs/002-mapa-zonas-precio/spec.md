# Feature Specification: Mapa de zonas con precio automático por ubicación

**Feature Branch**: `002-mapa-zonas-precio`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Mapa de zonas de entrega con precio automático por ubicación. El cliente (Diego) trazó las 5 zonas de reparto de Montevideo a mano sobre Google My Maps y las exportó a KML (`web/design-source/zonas-flash-urbano.kml`). Las zonas pasan a ser dato versionado en el repo; `/sobre-nosotros` muestra un mapa interactivo con las 5 zonas y sus precios; y en el formulario de pedido el cliente marca su ubicación en el mapa y el sitio le resuelve la zona y le muestra el precio en firme."

## Contexto

Este feature reemplaza el mapa del milestone 001. Aquel era una **imagen**
generada por *flood fill* sobre una captura de Google Maps: los límites eran
una interpretación del sistema, no un dato, y el spec 001 los publicó
explícitamente como *referencia* no vinculante (ver `specs/001-web-mvp/spec.md`
§ Assumptions).

Lo que cambia es la naturaleza del artefacto: ahora existen **5 polígonos
cerrados con coordenadas geográficas reales**, trazados sobre Google My Maps
siguiendo las **calles límite que definió el cliente** (ver § Límites de zona).
El cliente definió las zonas, los precios y las calles que las separan; el
trazado del polígono es la transcripción de esas calles a geometría.
**El cliente validó el resultado.**

Verificación automática del archivo entregado: los 5 polígonos cierran (primer
vértice = último) y no se solapan (muestreo de 67.600 puntos sobre el área
total: 2 caen en dos zonas, consistente con bordes compartidos, no con
superposición). Eso es lo que habilita resolver una zona a partir de un punto.

Lo que esa verificación **no** cubre: que cada tramo de polígono efectivamente
corra sobre la calle que le corresponde. Eso es comprobación visual y se hace
al superponer los polígonos sobre el mapa real (SC-004), no antes.

**Este feature reversa el Principio V de la constitución** (*"Price and
logistics stay manual for now... The MVP does not attempt automatic pricing"*).
La reversión es deliberada y aprobada por el dueño del repo. La evidencia nueva
que la motiva: el mapa del propio cliente asigna un precio fijo por zona, lo
que contradice el "no hay costo fijo" en el que se apoyaba ese principio.
Requiere ADR en `docs/decisions/` y bump de versión de la constitución en la
fase Decide, **antes** de planificar.

## Clarifications

### Session 2026-08-02

- Q: Si los mosaicos del mapa no cargan, ¿qué pasa con el pedido? (FR-011 exigía
  ubicación obligatoria y FR-020 exigía que el formulario siguiera siendo
  enviable — no podían cumplirse a la vez) → A: Se bloquea el envío y se ofrece
  contacto directo. Sin calles de fondo no se considera confiable marcar un
  punto del que depende un cobro en firme.

## Límites de zona *(normativo)*

Los límites los definió el cliente por **nombre de calle**, escritos sobre la
captura que entregó (`web/design-source/mapa-costos-original.jpeg`). Se
transcriben acá porque hasta ahora existían únicamente como píxeles dentro de
esa imagen: sin este listado nadie puede verificar el trazado, discutir un
cobro ni rehacer el archivo si se pierde.

**Ante una discrepancia entre un polígono y esta lista, manda la lista.** El
polígono es la transcripción; las calles son la definición.

Arterias que separan zonas, leídas de la imagen:

| Límite | Separa |
|---|---|
| **Ruta 102** | borde norte de Zona 2 y Zona 4 |
| **Ruta 5** | borde oeste de Zona 2 — Zona 3 queda del lado oeste |
| **Cno. Ramírez / La Teja** | tramo suroeste, cierre de Zona 3 contra Zona 1 |
| **Av. Aparicio Saravia** | Zona 2 (norte) de Zona 1 (sur) |
| **Av. Garzón** | tramo norte-sur del oeste de Zona 1 |
| **Av. José Belloni** | tramo norte-sur del este de Zona 1 |
| **Irigoyen** | continuación sur del límite este de Zona 1 |
| **Cno. Maldonado** | diagonal noreste, límite oeste de Zona 4 |
| **Cno. Carrasco** | borde sur entre Zona 1 y Zona 4 |
| **Av. de las Américas / Ruta 101** | Zona 4 de Zona 5 (este) |

Zona 3 (oeste) y Zona 5 (este) se extienden más allá del recorte de la captura;
en el trazado sí llegan hasta sus extremos reales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber cuánto cuesta antes de pedir (Priority: P1) 🎯

Un cliente que está cargando un pedido marca en un mapa el punto **desde donde
hay que retirar el paquete** — típicamente donde él está parado — y el sitio le
dice al instante en qué zona cae y cuánto sale el envío, sin preguntarle a
nadie.

**Why this priority**: Es el salto de valor del feature. Hoy el cliente carga
el pedido a ciegas y tiene que esperar a que le pasen el precio por WhatsApp —
justo el ida y vuelta manual que el proyecto existe para eliminar (Principio II
de la constitución). Sin esto, el feature es solo un mapa más lindo.

**Independent Test**: Abrir el formulario de pedido, marcar un punto dentro de
una zona conocida y ver el nombre de la zona y su precio, sin haber pasado por
ninguna otra sección del sitio.

**Acceptance Scenarios**:

1. **Given** un cliente en el formulario de pedido, **When** toca un punto del
   mapa que cae dentro de una zona de cobertura, **Then** ve la zona
   identificada y el precio de esa zona, y el punto queda marcado visiblemente.
2. **Given** un cliente que ya marcó un punto, **When** arrastra el marcador o
   toca otro punto, **Then** la zona y el precio se actualizan al nuevo punto.
3. **Given** un cliente que marca un punto fuera de las 5 zonas (por ejemplo en
   el agua o fuera del área de cobertura), **When** suelta el marcador,
   **Then** el sitio le dice que ese punto está fuera de la zona de cobertura,
   **no muestra ningún precio**, le ofrece la vía de contacto directo y el
   pedido no se puede enviar.
4. **Given** un cliente que no marcó ningún punto, **When** intenta enviar el
   pedido, **Then** el formulario señala la ubicación como campo obligatorio
   faltante y no permite el envío, igual que con cualquier otro campo.
5. **Given** un cliente en un celular de 375px, **When** usa el mapa con el
   pulgar, **Then** puede desplazar, hacer zoom y colocar el marcador sin que
   el gesto quede atrapado por el scroll de la página.
6. **Given** un cliente que marcó un punto y obtuvo un precio, **When** envía
   el pedido, **Then** la pantalla de confirmación incluye la zona y el precio
   junto al resto del resumen.

---

### User Story 2 - Ver la zona de cobertura y los precios (Priority: P2)

Un cliente potencial entra a "Sobre Nosotros" para ver hasta dónde llega el
servicio y cuánto cuesta, antes de decidirse a cargar un pedido.

**Why this priority**: Da confianza y responde la pregunta de precio antes de
entrar al formulario, pero el sitio funciona sin esta pantalla: US1 ya resuelve
el precio donde importa. Reemplaza una imagen que ya existe, así que no hay
regresión funcional si se pospone.

**Independent Test**: Navegar a "Sobre Nosotros" desde la home y ver las 5
zonas dibujadas sobre un mapa navegable con su precio, sin tocar el formulario.

**Acceptance Scenarios**:

1. **Given** un visitante en "Sobre Nosotros", **When** mira la sección de
   zonas, **Then** ve las 5 zonas dibujadas y diferenciadas sobre un mapa con
   calles reales, con una leyenda que asocia cada zona a su precio.
2. **Given** un visitante mirando el mapa, **When** hace zoom o se desplaza,
   **Then** el mapa responde y las zonas se mantienen alineadas con las calles.
3. **Given** un visitante en el mapa, **When** mira la esquina del mapa,
   **Then** ve la atribución de la fuente cartográfica que exige su licencia.

---

### User Story 3 - Usar mi ubicación actual (Priority: P3)

Un cliente que está parado en el domicilio de retiro usa la ubicación de su
teléfono en vez de buscarse a mano en el mapa.

**Why this priority**: Ahorra pasos en el caso más común (cargar el pedido
desde el lugar), pero es puro atajo: US1 ya cubre el flujo completo marcando a
mano. Depende de un permiso que el usuario puede negar, así que nunca puede ser
el único camino.

**Independent Test**: Tocar "usar mi ubicación", aceptar el permiso, y ver el
mapa centrado con el marcador puesto y la zona resuelta.

**Acceptance Scenarios**:

1. **Given** un cliente en el formulario, **When** toca "usar mi ubicación" y
   concede el permiso, **Then** el mapa se centra en su posición, coloca el
   marcador y resuelve la zona igual que si lo hubiera marcado a mano.
2. **Given** un cliente que **niega** el permiso de ubicación o cuyo
   dispositivo no la puede obtener, **When** ocurre el rechazo o el error,
   **Then** el sitio lo informa sin romperse y el marcado manual sigue
   disponible.

---

### User Story 4 - Decir a dónde va el paquete (Priority: P2)

Un cliente indica el domicilio de entrega, separado y distinguible del de
retiro, para que el operador sepa dónde dejarlo.

**Why this priority**: No es opcional a nivel producto — un pedido sin destino
no se puede cumplir — pero sí es separable a nivel entrega: el resto del feature
(mapa, zona, precio) funciona y se puede demostrar sin esto. Aparece en este
spec y no en uno propio porque es consecuencia directa de etiquetar la
dirección existente como "de retiro": sin destino, el formulario queda
incoherente el día que se publique el cambio.

**Independent Test**: Completar el formulario y verificar que pide dos
domicilios claramente rotulados, y que el resumen de confirmación los muestra
por separado.

**Acceptance Scenarios**:

1. **Given** un cliente en el formulario, **When** mira los campos de
   dirección, **Then** ve dos bloques rotulados sin ambigüedad — de dónde se
   retira y a dónde se entrega — y entiende cuál es cuál sin ayuda.
2. **Given** un cliente que completó el retiro pero dejó el destino
   incompleto, **When** intenta enviar, **Then** el formulario marca el error
   en el campo puntual del destino y no permite el envío.
3. **Given** un cliente que puso un destino fuera de las zonas de cobertura,
   **When** envía, **Then** el pedido se acepta igual: el destino no se valida
   contra las zonas ni cambia el precio.

---

### Edge Cases

- **Punto exactamente sobre el borde entre dos zonas**: la resolución debe ser
  determinista — el mismo punto siempre devuelve la misma zona, nunca "ninguna"
  ni dos a la vez. Se resuelve con una regla de desempate fija y documentada,
  no al azar.
- **Punto fuera de las 5 zonas**: no se inventa precio ni se asigna la zona más
  cercana. Se informa "fuera de zona de cobertura" y se ofrece contacto. Como
  la ubicación es obligatoria (FR-011), esto además bloquea el envío: un
  domicilio fuera de cobertura no puede autogestionarse y pasa a contacto
  directo. Es la consecuencia buscada, no un efecto colateral.
- **Los mosaicos no cargan** (sin conexión, servidor caído, bloqueador):
  el pedido no se puede enviar y se deriva a contacto directo (FR-020).
  Técnicamente los polígonos son dato local y podrían dibujarse sobre fondo
  gris, pero marcar un punto sin calles de referencia no es base confiable para
  un precio en firme. La sección debe explicar qué pasó, no quedar en blanco.
- **La misma falla en `/sobre-nosotros`** no bloquea nada: ahí el mapa es
  informativo, no cobra. Debe degradar mostrando al menos las zonas y sus
  precios en texto, en vez de un hueco.
- **El cliente envía el pedido sin marcar ubicación**: no se permite (FR-011).
  Nunca sale un pedido con precio vacío o en cero.
- **El punto marcado contradice la dirección escrita de retiro**: el pedido
  lleva las dos cosas y no se intenta reconciliarlas automáticamente; el punto
  manda para el precio, la dirección escrita manda para llegar a la puerta.
- **El destino queda fuera de las zonas de cobertura**: se acepta igual. El
  precio depende solo del retiro (FR-013) y el destino no se valida contra las
  zonas (FR-024). Es una consecuencia asumida de cobrar por retiro: un envío
  desde Zona 1 hacia afuera de Montevideo se cobraría $150.
- **Retiro y entrega caen en zonas distintas**: se cobra la zona de retiro y
  punto. Un retiro en Zona 1 con entrega en Zona 5 sale $150. Es una decisión
  consciente (ver Assumptions), no un descuido.
- **Cliente con muchos paquetes o paquetes grandes**: el precio no cambia
  (FR-015). Un envío de 10 bultos grandes dentro de la Zona 1 sale los mismos
  $150 que uno chico.
- **Punto pegado a una arteria límite**: la calle tiene ancho y el polígono es
  una línea. Un punto marcado sobre Av. Aparicio Saravia puede caer de
  cualquiera de los dos lados, y con eso cambian $50. No se mitiga en esta
  iteración: el cliente marca dónde está el paquete, no sobre el eje de la
  avenida.
- **El cliente marca un punto, obtiene precio, y después cambia la dirección
  escrita**: el precio mostrado sigue correspondiendo al punto, no al texto.

## Requirements *(mandatory)*

### Functional Requirements

**Las zonas como dato**

- **FR-001**: Los límites de las 5 zonas MUST vivir versionados en el repo como
  dato geográfico consultable por el sitio, no como imagen.
- **FR-002**: Cada zona MUST llevar asociados un identificador estable, un
  nombre para mostrar y su precio: Zona 1 $150, Zona 2 $200, Zona 3 $250,
  Zona 4 $250, Zona 5 $350.
- **FR-003**: Los nombres de zona MUST estar normalizados (el archivo de origen
  entrega "Zona&nbsp;&nbsp;4" con un espacio duro y un espacio extra).
- **FR-004**: El archivo original entregado por el cliente MUST conservarse en
  el repo junto al procedimiento para regenerar el dato a partir de él, de modo
  que una corrección futura de los límites no obligue a rehacer el trabajo.
- **FR-025**: Las calles que definen los límites (§ Límites de zona) MUST estar
  registradas como texto versionado, no solo dentro de una imagen. Son la
  definición autoritativa contra la cual se verifica y se corrige la geometría.
  *(Numerado al final por orden de creación; pertenece a este bloque.)*
- **FR-005**: Los precios MUST estar definidos en un solo lugar, de forma que
  actualizar un precio no exija tocar más de un archivo.

**Mapa público de zonas**

- **FR-006**: "Sobre Nosotros" MUST mostrar las 5 zonas dibujadas y
  visualmente distinguibles entre sí sobre un mapa navegable con calles reales,
  reemplazando la imagen estática actual.
- **FR-007**: El mapa MUST mostrar una leyenda que asocie cada zona con su
  precio, **como texto real y siempre visible**, no dibujada dentro del mapa ni
  reservada para cuando algo falle. Hoy la imagen que se reemplaza lleva una
  descripción textual de las cinco zonas y sus precios; un mapa es opaco para
  quien no lo ve, así que sin esta leyenda el cambio sería una regresión de
  accesibilidad respecto de lo que el sitio ya ofrece.
- **FR-008**: El mapa MUST mostrar la atribución que exige la licencia de la
  fuente cartográfica utilizada.

**Precio por ubicación**

- **FR-009**: El formulario de pedido MUST permitir al cliente marcar un punto
  en un mapa, tocándolo o arrastrando un marcador.
- **FR-010**: Al marcar un punto, el sitio MUST determinar en qué zona cae y
  mostrar la zona y su precio, sin recargar la página y sin intervención
  manual.
- **FR-011**: Marcar la ubicación MUST ser obligatorio para enviar el pedido:
  el formulario MUST NOT aceptar un envío sin un punto marcado que haya
  resuelto una zona, y MUST señalar la falta igual que cualquier otro campo
  obligatorio.
- **FR-012**: Si el punto cae fuera de las 5 zonas, el sitio MUST informarlo
  explícitamente y MUST NOT mostrar un precio ni asignar la zona más cercana.
  Combinado con FR-011, un punto fuera de cobertura impide enviar el pedido;
  en ese caso el sitio MUST ofrecer la vía de contacto directo.
- **FR-013**: La zona que determina el precio MUST ser la del punto de
  **retiro** — dónde se busca el paquete. Es el único punto que se marca en un
  mapa; el destino no se marca ni afecta al precio (FR-022).
- **FR-014**: El precio mostrado MUST presentarse como el precio del envío, no
  como una estimación sujeta a confirmación posterior.
- **FR-015**: El precio MUST ser el monto fijo de la zona, sin multiplicarse ni
  ajustarse por la cantidad de paquetes ni por el tipo Chico/Mediano/Grande que
  el formulario ya captura.
- **FR-016**: El sitio SHOULD ofrecer un atajo para usar la ubicación del
  dispositivo, y MUST seguir siendo utilizable si el cliente lo niega o falla.
- **FR-017**: La pantalla de confirmación del pedido MUST incluir la zona
  resuelta y el precio junto al resto del resumen.
- **FR-018**: La determinación de zona MUST ser determinista: el mismo punto
  devuelve siempre el mismo resultado, incluso sobre un borde compartido.

**Transversales**

- **FR-019**: El mapa y el marcado de ubicación MUST ser operables con una mano
  en un viewport de 375px, sin que el gesto de desplazar el mapa secuestre el
  scroll de la página.
- **FR-020**: Si los mosaicos del mapa no están disponibles, el sitio MUST
  informarlo, MUST NOT aceptar el envío del pedido y MUST ofrecer la vía de
  contacto directo. Marcar un punto sin calles de fondo no se considera base
  confiable para un precio en firme. La sección MUST NOT quedar en blanco ni
  fallar en silencio: el cliente tiene que entender qué pasó y qué hacer.
- **FR-021**: El texto de cara al usuario MUST usar voz institucional
  ("nosotros", "Flash Urbano") y no nombrar personas del equipo.

**Origen y destino del pedido**

- **FR-022**: El formulario MUST distinguir explícitamente dos domicilios: el
  de **retiro** (la dirección compuesta que ya captura el milestone 001, ahora
  etiquetada como tal, más el punto marcado en el mapa) y el de **entrega**,
  que hoy no se captura.
- **FR-023**: El domicilio de entrega MUST capturarse con los mismos campos que
  el de retiro — calle, número, esquina, apto opcional, cooperativa sí/no —
  para que el operador pueda llegar a la puerta.
- **FR-024**: El domicilio de entrega MUST NOT requerir marcar un punto en el
  mapa ni influir en el precio. No se valida contra las zonas de cobertura.

### Key Entities

- **Zona**: identificador estable, nombre para mostrar, precio del envío, y el
  contorno geográfico que la delimita. Las 5 zonas no se solapan entre sí.
- **Ubicación de retiro**: el punto geográfico que eligió el cliente, donde hay
  que buscar el paquete. Se agrega al Pedido definido en
  `specs/001-web-mvp/spec.md`, junto a la zona resuelta y el precio. Convive
  con la dirección escrita de retiro (calle, número, esquina); no la reemplaza.
- **Domicilio de entrega**: dirección compuesta con los mismos campos que la de
  retiro, sin punto en el mapa y sin zona asociada. Nueva en este feature; el
  Pedido de 001 no la tenía. Se relaciona con la persona que recibe (nombre,
  CI) que 001 ya captura.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente que abre el formulario obtiene el precio de su envío
  en menos de 15 segundos desde que llega al mapa, en un celular, sin ayuda.
  Se mide con cronómetro sobre un recorrido real, no se estima.
- **SC-002**: El 100% de los puntos marcados dentro de las 5 zonas devuelven
  exactamente una zona; ningún punto interior devuelve "ninguna" ni dos zonas.
- **SC-003**: El 100% de los puntos marcados fuera de las 5 zonas muestran el
  aviso de fuera de cobertura y ningún precio.
- **SC-004**: Cada tramo de límite corre sobre la calle que le corresponde
  según § Límites de zona, verificado a ojo sobre el mapa real arteria por
  arteria (Ruta 102, Ruta 5, Cno. Ramírez/La Teja, Av. Aparicio Saravia,
  Av. Garzón, Av. Belloni, Irigoyen, Cno. Maldonado, Cno. Carrasco,
  Av. de las Américas/Ruta 101). Empezando por Zona 5, la más cara.
- **SC-005**: Con los mosaicos bloqueados, el cliente ve un aviso que
  explica qué pasó y cómo contactar, y en ningún caso ve un mapa vacío, un
  precio sin punto marcado, ni un envío aceptado. Verificado manualmente.
- **SC-006**: El mapa es operable en un viewport de 375px y en uno de ≥1280px,
  verificado manualmente en ambos.
- **SC-007**: Ningún pedido enviado queda sin domicilio de entrega, y ninguna
  persona que mire el formulario por primera vez confunde cuál bloque es el de
  retiro y cuál el de entrega.

## Assumptions

- **Decisiones tomadas con el dueño del repo antes de este spec** (se registran
  acá para que el plan no las vuelva a abrir):
  - El precio de zona es **precio en firme**, no una referencia sujeta a
    confirmación del operador. Esto reversa el Principio V de la constitución y
    exige ADR + bump de versión en la fase Decide, antes de planificar.
  - La ubicación se indica **marcando un punto en el mapa**, no escribiendo una
    dirección. No hay geocodificación de texto libre ni ningún servicio externo
    más allá de los mosaicos del mapa. Razón: el sitio es un export estático sin
    backend donde guardar una credencial, y las alternativas gratuitas de
    geocodificación restringen el uso comercial.
  - Render con mapa interactivo sobre mosaicos de OpenStreetMap. **Hay dos
    permisos distintos y conviene no confundirlos**: los *datos* de OSM son
    ODbL, que permite el uso comercial citando la fuente — de ahí que se
    descarte la captura de Google Maps del milestone 001, que no lo permitía.
    Los *servidores de mosaicos* públicos de OSM son otra cosa: tienen una
    política de uso propia, pensada para volumen bajo, que espera que un sitio
    de tráfico alto pase a un proveedor pago o a servidores propios. Para el
    tráfico de este sitio alcanza, pero **el plan debe elegir el proveedor de
    mosaicos con esa política a la vista**, no asumir que "OSM es libre" cierra
    el tema.
  - **El precio se calcula sobre la zona de retiro**, no la de entrega ni una
    combinación de ambas. Un solo mapa en el formulario. Consecuencia asumida:
    un retiro en Zona 1 con entrega en Zona 5 se cobra $150, aunque sea el
    viaje más largo. Se eligió por simplicidad y porque coincide con el flujo
    real: el cliente carga el pedido parado donde está el paquete. Si el
    operador reporta que se le escapan viajes largos, se revisa con su propio
    spec.
  - **Monto fijo por zona**, sin multiplicar por cantidad de paquetes ni
    ajustar por tamaño. Es lo que dice el mapa del cliente. Ajustar por volumen
    exigiría reglas que el cliente no definió y sería inventarlas.
  - **La ubicación es obligatoria** para enviar el pedido. Sin punto no hay
    envío, y por lo tanto ningún pedido llega sin precio.
- **Los límites están validados por el cliente y siguen calles nombradas.** Él
  definió zonas, precios y las arterias que las separan; el trazado transcribe
  esas calles a geometría y él validó el resultado. No hay gate de release por
  este motivo. Las calles están listadas en § Límites de zona y **son la
  autoridad**: si un polígono se aparta de su calle, el defecto está en el
  polígono.
- **La validación es del cliente, no automática.** Lo que se comprobó por
  programa es que los polígonos cierran y no se solapan. Que cada tramo corra
  sobre la calle correcta es comprobación visual y se cierra con SC-004, al
  superponer los polígonos sobre el mapa real. Al ser precio en firme, ese
  chequeo no es cosmético: un tramo corrido una cuadra cambia lo que se cobra.
- **Zona 5 tiene menos vértices (24 contra 74–125) porque su límite es más
  simple**, no porque esté trazada con menos cuidado: corre sobre Av. de las
  Américas / Ruta 101, arterias largas y rectas que necesitan pocos puntos.
  Igual es la zona más cara, así que un error de borde ahí es el que más
  cuesta; es la primera que conviene mirar en SC-004.
- **Sin persistencia**, igual que en el milestone 001: el pedido con su zona y
  precio termina en la pantalla de confirmación del navegador. Guardar los
  pedidos sigue siendo un milestone aparte.
- **Sin dependencias más allá de la librería de mapas** (Principio III, YAGNI):
  sin backend, sin base de datos, sin servicio de geocodificación.
- **El mapa arranca mostrando Montevideo entero con las 5 zonas**, y el cliente
  se acerca o usa el atajo de geolocalización (US3). No se pide el permiso de
  ubicación al abrir la página: un diálogo del navegador sin que el usuario
  haya pedido nada se rechaza seguido, y perder el permiso de entrada deja al
  atajo inservible para el resto de la sesión.
- **La imagen generada del milestone 001 queda muerta.**
  `web/public/mapa-zonas-flash-urbano.jpeg` y su generador
  `web/design-source/build-map.js` dejan de tener uso al reemplazarse por el
  mapa interactivo, y el plan debería retirarlos en vez de dejar dos mapas
  compitiendo. **No** se toca `mapa-costos-original.jpeg`: es el documento
  donde el cliente escribió las calles y los precios (FR-025).
- **El punto marcado no valida la dirección escrita.** Si no coinciden, no se
  avisa: el punto define el precio, el texto define cómo llegar. Reconciliarlos
  sería trabajo especulativo hasta que el operador reporte que es un problema
  real.
- **RESUELTO — la dirección escrita del milestone 001 es la de retiro.**
  Confirmado por el dueño del repo. Ese formulario captura *una* dirección
  compuesta y dos momentos (retiro y entrega); el spec 001 nunca desambiguó a
  cuál correspondía porque no calculaba nada con ella. Ahora queda fijado: esa
  dirección y el punto del mapa describen **el mismo domicilio, el de retiro**
  — el punto da la zona y el precio, el texto da la calle y el timbre.
  Consecuencia asumida y aceptada: **el domicilio de entrega no se capturaba en
  ningún lado**, así que este feature lo agrega (US4, FR-022 a FR-024). Es una
  expansión de alcance deliberada respecto del pedido original: sin ella, el
  formulario queda incoherente al rotular la dirección existente como "de
  retiro".

## Dependencias

- `web/design-source/zonas-flash-urbano.kml` — los polígonos trazados sobre las
  calles que definió el cliente. Ya está en el repo y verificado.
- `web/design-source/mapa-costos-original.jpeg` — la captura donde el cliente
  escribió las calles límite y los precios. Es el origen de § Límites de zona y
  se conserva como respaldo de esa transcripción.
- `specs/001-web-mvp/` — este feature modifica dos superficies que ese
  milestone construyó: `/sobre-nosotros` (reemplaza el mapa) y el formulario de
  pedido (agrega ubicación, precio y domicilio de entrega). Su FR-014
  ("representación visual de la zona de entregas") queda satisfecho por el mapa
  nuevo. Su FR-005 (dirección compuesta) queda **reinterpretado**: esa
  dirección pasa a ser explícitamente la de retiro, y se le suma una segunda
  para la entrega.
- Fase Decide pendiente: ADR de la reversión del Principio V + enmienda de
  `.specify/memory/constitution.md`. **El plan no puede escribirse antes.**
