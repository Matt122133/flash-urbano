# Feature Specification: Dirección por cruce de calles en el formulario de pedido

**Feature Branch**: `003-direccion-por-esquina`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "003 - Direccion por cruce de calles en el formulario de pedido. En `web/components/pedido-form.tsx` los campos calle, numero y esquina son texto libre que solo se concatena en el mensaje de WhatsApp: no validan nada, no tocan el mapa, y ademas el usuario tiene que marcar el punto en el mapa aparte. El formulario pasa a mostrar primero solo Calle y Esquina, con autocompletado sobre un indice de calles de Montevideo generado offline; al resolverse el cruce el mapa coloca el punto en esa interseccion, y recien ahi se habilitan Numero de puerta, Apto y Cooperativa. El pin se puede arrastrar pero restringido a las cuadras adyacentes al cruce, y el precio se recalcula en vivo. Incluye el fix de z-index del mapa. Sin backend, sin base de datos, sin servicios externos y sin cuentas."

## Contexto

Hoy el formulario de pedido pide la misma información dos veces. Por un lado
el cliente escribe `calle`, `numero` y `esquina` como texto libre; por otro
marca un punto en el mapa. **Los dos datos son la misma dirección y no se
hablan entre sí**: el texto no valida nada, no mueve el mapa y termina
concatenado en el mensaje de WhatsApp; el punto es el único que decide zona y
precio. Está registrado como deuda `Medium` en
[`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md) y choca de
frente con el Principio IV de la constitución (mínimo tipeo en pantalla
chica). Lo detectó el dueño del repo probando el MVP.

Lo que habilita resolverlo sin depender de un servicio externo de
geocodificación: **los ejes viales de Montevideo son un dato público que se
puede versionar en el repo**, igual que se hizo con las zonas en `002`. Sobre
la investigación previa (2026-08-04), dentro del recuadro de Montevideo hay
unos 30.000 tramos de calle con nombre, y calcular las intersecciones
geométricas reales devuelve las esquinas donde corresponde: en una caja de
prueba de Centro/Cordón/Parque Rodó salieron 1.506 pares calle-calle, con
18 de Julio y Ejido, Canelones y Convención, y Maldonado y Gaboto cayendo en
su ubicación correcta.

Lo que ese dato **no** tiene es numeración domiciliaria. No existe forma de
llevar "Zapicán 1234" a un punto con los ejes solos. Por eso el diseño
acordado invierte el orden: **la esquina posiciona, el número informa**. El
cliente ubica la dirección por cruce de calles — que es como se dan las
direcciones en Montevideo — y ajusta los metros finales arrastrando el pin
dentro de esa cuadra. El número de puerta viaja con el pedido para el timbre,
no para ubicar.

Ese arrastre no es sólo comodidad. Como el punto decide el precio
(Principio V), un pin que se puede mover a cualquier lado vuelve el cobro
manipulable: alcanza con arrastrar hacia la zona más barata. **Restringir el
arrastre a la cuadra que el propio cliente declaró es el control de
integridad del cobro**, y por eso es un requisito, no un detalle de
interacción.

Este feature **no reversa ningún principio**. Al contrario, es la primera vez
que la dirección escrita y el punto cobrable son el mismo dato.

## Clarifications

### Session 2026-08-04

- Q: ¿El pin se mueve libre dentro de la región permitida o queda pegado al eje de la calle? → A: Libre dentro del buffer, sin imán al eje: el pin puede quedar sobre la vereda o el edificio, que es lo que el repartidor necesita ver.
- Q: Si arrastrar el pin cambia de zona y de precio, ¿hay que frenar al cliente? → A: No. Aviso destacado con zona y precio anterior → nuevo, sin bloquear el arrastre; el resumen previo al envío sigue siendo el punto de confirmación.
- Q: ¿Qué muestra el mapa antes de que se resuelva la esquina? → A: Nada: el mapa está oculto hasta que hay calle y esquina. Y cuando aparece va debajo del bloque de dirección, no arriba de todo.
- Q: ¿Contra qué se verifica que las esquinas caen donde deben? → A: Contra un fixture versionado de esquinas conocidas con coordenadas de referencia, verificado a mano una vez y ejercitado por un test automático que corre siempre, no sólo al construir el índice.
- Q: ¿La dirección de entrega lleva autocompletado? → A: Sí, calle y esquina, pero sin mapa ni punto — y como ayuda, no como puerta: si la calle no está en el índice se acepta lo tipeado, porque una entrega fuera del área de servicio es un pedido válido. Revisa la decisión del 2026-08-04 de dejarla como texto libre, tomada tras probar el formulario.
- Q: ¿Hay relación entre las fechas de retiro y de entrega? → A: Sí, y no estaba validada: tiene que haber un mínimo de 2 horas entre el retiro y la entrega, y el retiro no puede caer en un día ya pasado. Detectado por el dueño del repo probando el formulario el 2026-08-04.
- Q: ¿Qué nivel de accesibilidad tiene el autocompletado? → A: Combobox accesible completo: teclado (flechas, Enter, Escape), foco manejado y sugerencias anunciadas por lector de pantalla. Es requisito, porque el feature retira el texto libre que hoy sirve de vía accesible.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ubicar el retiro escribiendo calle y esquina (Priority: P1)

Una clienta entra a `/pedido` desde el teléfono. En el bloque de retiro ve
sólo dos campos: **Calle** y **Esquina**. Escribe "zapican" y elige la
sugerencia; en Esquina escribe "tacu" y elige entre las calles que realmente
cruzan Zapicán. Apenas quedan las dos, el mapa se centra y aparece el pin
sobre esa esquina, con la zona y el precio en firme. No tuvo que buscar nada
en el mapa a mano.

**Why this priority**: es el feature. Elimina el doble ingreso, es el camino
que recorre el 100% de los pedidos, y es la única historia que por sí sola ya
mejora el formulario. Sirve Principio II (autogestión) y Principio IV (mínimo
tipeo).

**Independent Test**: se prueba entera cargando `/pedido`, escribiendo un par
calle/esquina conocido y verificando que el pin aparece en la intersección
correcta con el precio de la zona que corresponde, sin tocar el mapa.

**Acceptance Scenarios**:

1. **Given** el bloque de retiro vacío, **When** la clienta escribe tres o
   más letras en Calle, **Then** ve sugerencias de calles del área de
   servicio que coinciden, sin importar tildes ni mayúsculas.
2. **Given** una calle ya elegida, **When** escribe en Esquina, **Then** sólo
   se le sugieren calles que efectivamente cruzan la calle elegida.
3. **Given** calle y esquina elegidas y un único cruce posible, **When** se
   resuelve, **Then** aparece el mapa debajo de los campos, centrado en esa
   intersección, con el pin colocado y la zona y el precio en firme.
4. **Given** una calle y una esquina que no se cruzan, **When** intenta
   continuar, **Then** se le dice que ese cruce no existe y no se coloca
   ningún punto.
5. **Given** un cruce que cae fuera de las cinco zonas, **When** se resuelve,
   **Then** no se muestra precio, no se puede enviar el pedido, y se lo deriva
   a contacto directo.
6. **Given** una dirección ya resuelta con el mapa visible debajo, **When** la
   clienta vuelve a editar la calle y se despliegan sugerencias sobre el mapa,
   **Then** la lista se ve completa y por encima del mapa.
7. **Given** el bloque de retiro, **When** la clienta lo recorre sólo con el
   teclado, **Then** puede abrir las sugerencias, recorrerlas, elegir una y
   descartar la lista sin usar el mouse.

---

### User Story 2 - Ajustar el pin dentro de la cuadra (Priority: P2)

Resuelta la esquina, la clienta ve que su puerta está a mitad de cuadra.
Arrastra el pin unos metros sobre la calle. El pin la sigue mientras esté
dentro de las cuadras que tocan esa esquina; si intenta soltarlo más lejos,
vuelve solo al punto permitido más cercano. Si el movimiento la cruza de
zona, el precio cambia a la vista y se le avisa.

**Why this priority**: sube la precisión de la dirección de "esquina" a
"cuadra", que es lo que el repartidor necesita, y es el control que evita que
el pin se use para elegir precio. Depende de US1 pero se puede probar y
demostrar aparte.

**Independent Test**: con un cruce ya resuelto, arrastrar el pin a lo largo
de la cuadra y hacia afuera, verificando que dentro se mueve libre, que fuera
vuelve al borde, y que el precio se actualiza al cambiar de zona.

**Acceptance Scenarios**:

1. **Given** un pin colocado en un cruce, **When** la clienta lo arrastra
   dentro de las cuadras adyacentes, **Then** el pin queda donde lo soltó y
   la zona y el precio se recalculan.
2. **Given** un pin colocado en un cruce, **When** intenta soltarlo fuera de
   la región permitida, **Then** el pin se reubica en el punto permitido más
   cercano y se le explica por qué.
3. **Given** un pin sobre una avenida que separa dos zonas, **When** lo
   arrastra al otro lado, **Then** el precio nuevo se muestra de forma
   explícita, con el cambio de zona visible y nunca en silencio, pero sin
   frenar el arrastre ni pedir confirmación en el momento.
4. **Given** un pin arrastrado, **When** envía el pedido, **Then** el precio
   enviado es el de la zona del punto final, no el del cruce original.

---

### User Story 3 - El mapa deja de taparle la interfaz al resto de la página (Priority: P2)

Un cliente scrollea `/pedido` o `/sobre-nosotros` en el teléfono. El mapa se
queda en su lugar: no pasa por encima del header ni del logo, y ninguna capa
del mapa aparece sobre menús, listas de sugerencias o mensajes de error.

**Why this priority**: es una falla `High` ya registrada en el tracker y en
producción hoy. Además es prerrequisito de US1: la lista de sugerencias se
despliega justo encima del mapa. Es la historia más chica del plan y se puede
entregar sola.

**Independent Test**: abrir las dos páginas que usan el mapa en viewport de
teléfono, scrollear y abrir el menú de navegación sobre el mapa.

**Acceptance Scenarios**:

1. **Given** `/pedido` en un viewport de teléfono, **When** el cliente
   scrollea con el mapa en pantalla, **Then** el header y el logo se ven por
   encima del mapa.
2. **Given** `/sobre-nosotros` en un viewport de teléfono, **When** abre el
   menú de navegación, **Then** el menú se dibuja completo sobre el mapa.
3. **Given** cualquier página con mapa, **When** se agrega un elemento
   flotante nuevo, **Then** no hace falta subirle el nivel de apilado para
   ganarle al mapa.

---

### User Story 4 - Elegir entre cruces homónimos (Priority: P3)

Un cliente de la periferia escribe "Calle 2" y "Calle 3". En Montevideo hay
decenas de calles con esos nombres, en loteos distintos, y varias se cruzan
entre sí. En vez de que el sitio elija una, se le muestran los cruces
candidatos ubicados en el mapa y elige el suyo.

**Why this priority**: afecta a una minoría de direcciones pero, cuando pega,
manda el paquete a la otra punta de la ciudad y cobra la zona equivocada.
Elegir el primero en silencio sería adivinar una zona, que el Principio V
prohíbe.

**Independent Test**: buscar un par de nombres repetidos conocido y verificar
que se ofrecen todos los cruces y que no se coloca ningún punto hasta elegir.

**Acceptance Scenarios**:

1. **Given** un par calle/esquina con más de un cruce en el área de servicio,
   **When** se resuelve, **Then** se muestran todos los candidatos ubicados
   en el mapa y no se coloca ningún pin todavía.
2. **Given** varios candidatos en pantalla, **When** el cliente elige uno,
   **Then** el flujo sigue igual que con un cruce único.
3. **Given** varios candidatos sin elegir, **When** intenta enviar,
   **Then** no puede, y se le pide que elija cuál es.

---

### User Story 5 - Datos complementarios para el repartidor (Priority: P3)

Con la esquina resuelta, aparecen **Número de puerta**, **Apto** y
**Cooperativa**. El cliente los completa y viajan con el pedido. Ninguno de
los tres mueve el pin.

**Why this priority**: son datos que el repartidor necesita para tocar el
timbre, pero no ubican nada. Mostrarlos recién después de la esquina es lo
que le da al formulario el orden que hoy no tiene.

**Independent Test**: verificar que los tres campos están deshabilitados
antes de resolver el cruce, habilitados después, y que escribir en ellos no
cambia el pin ni el precio.

**Acceptance Scenarios**:

1. **Given** un cruce sin resolver, **When** el cliente mira el formulario,
   **Then** Número de puerta, Apto y Cooperativa están deshabilitados y se
   explica por qué.
2. **Given** un cruce resuelto, **When** completa el número de puerta,
   **Then** el pin y el precio no se mueven.
3. **Given** los campos completos, **When** envía el pedido, **Then** el
   número de puerta, el apto y la cooperativa aparecen en el resumen del
   pedido junto con la calle, la esquina, el punto, la zona y el precio.

---

### Edge Cases

- **La calle escrita no existe en el índice** (calle nueva, o nombre que el
  índice no tiene): no hay pin libre de rescate — se deriva a contacto
  directo. Un pin libre reabriría el agujero de integridad que US2 cierra.
- **El cruce existe pero cae fuera de las cinco zonas**: sin precio y sin
  pedido, deriva a contacto directo (Principio V).
- **El cruce cae justo sobre la avenida que separa dos zonas**: ver
  § Assumptions. Hoy resuelve el desempate determinista existente; la
  respuesta del negocio está pendiente.
- **Avenidas de doble calzada**: el mismo cruce puede aparecer varias veces
  en el dato crudo (Bulevar Artigas con Avenida Italia da cuatro puntos). Al
  cliente se le ofrece una sola esquina.
- **Tramos sin nombre o con nombre genérico** (más de un tercio de los tramos
  del recuadro de Montevideo no tienen nombre, y hay cientos rotulados
  literalmente "Vehicular/ Peatonal"): no se ofrecen nunca como sugerencia.
- **El cliente cambia la calle después de haber resuelto el cruce**: el punto,
  la zona, el precio y los complementos dejan de ser válidos y se limpian.
- **Conexión lenta o dato de calles que no carga**: el formulario tiene que
  decir que no puede resolver direcciones en vez de quedarse mudo; no se envía
  un pedido sin punto.
- **El cliente escribe la esquina en el campo de la calle y viceversa**: el
  cruce es el mismo punto, así que debe resolver igual.

## Requirements *(mandatory)*

### Functional Requirements

#### Dato de calles

- **FR-001**: El índice de calles y esquinas del área de servicio DEBE ser
  dato versionado en el repo, regenerable desde su fuente original, y nunca
  editado a mano — mismo tratamiento que las zonas de `002`.
- **FR-002**: El origen del dato DEBE quedar documentado junto al índice
  generado: de dónde salió la capa, quién la proveyó y bajo qué términos. El
  dueño del repo es coautor del trabajo de curso donde se investigó la capa y
  autorizó su uso acá; la capa en sí es material que la facultad entregó para
  ese curso.
- **FR-003**: La búsqueda DEBE ser insensible a mayúsculas, tildes y espacios
  repetidos, de modo que "18 de julio", "18 de Julio" y "Avenida 18 de Julio"
  lleven al cliente a la misma calle.
- **FR-004**: Los tramos sin nombre y los rotulados con nombres genéricos de
  clasificación vial NO DEBEN ofrecerse como sugerencia.
- **FR-005**: Las esquinas repetidas por calzadas separadas de una misma
  avenida DEBEN presentarse al cliente como una sola esquina.
- **FR-006**: El índice DEBE estar recortado al área de servicio (las cinco
  zonas más un margen), no al país.
- **FR-006a**: El repo DEBE contener un conjunto de esquinas conocidas con sus
  coordenadas de referencia, y una prueba automática que falle si el índice
  las resuelve fuera de tolerancia. Es el control que sobrevive a cada
  regeneración del dato, no una verificación de una sola vez.

#### Carga de la dirección

- **FR-007**: El bloque de **retiro** DEBE mostrar primero, y sólo, Calle y
  Esquina. Los campos restantes permanecen deshabilitados hasta que el cruce
  esté resuelto, con la razón visible.
- **FR-007a**: El bloque de **entrega** también DEBE ofrecer autocompletado de
  calle y esquina sobre el mismo índice, pero **sin mapa y sin punto**: ubicarla
  es problema de la app Android. Sirve para escribir menos y para no mandar una
  calle mal escrita.
- **FR-007b**: En entrega el autocompletado DEBE ser una **ayuda, no una
  puerta**: si la calle no está en el índice, lo tipeado se acepta igual. El
  índice cubre el área de servicio, y una entrega fuera de ella es un pedido
  válido — bloquearla sería inventar una restricción que el negocio no tiene.
- **FR-008**: El campo Calle DEBE ofrecer sugerencias del índice a partir de
  lo tipeado.
- **FR-009**: El campo Esquina DEBE ofrecer únicamente calles que crucen la
  calle ya elegida.
- **FR-010**: Resuelto el cruce, el sistema DEBE colocar el punto en esa
  intersección y centrar el mapa ahí, sin intervención del cliente.
- **FR-010a**: El mapa NO DEBE mostrarse hasta que haya calle y esquina. Antes
  de eso el espacio queda reservado, explicando que el punto se completa
  escribiendo la dirección — así no hay salto de layout al aparecer.
- **FR-010b**: El mapa DEBE ubicarse **debajo** del bloque de dirección, no
  encima. Los campos son lo primero de la pantalla; el mapa es la respuesta a
  lo que el cliente escribió.
- **FR-010c**: El clic sobre el mapa NO DEBE colocar el punto. El punto lo
  pone el cruce resuelto, y desde ahí sólo se arrastra dentro de lo que
  permite FR-014.
- **FR-011**: Número de puerta, Apto y Cooperativa DEBEN ser texto libre y NO
  DEBEN modificar el punto, la zona ni el precio.
- **FR-012**: El sistema NO DEBE permitir enviar un pedido cuya dirección de
  retiro no tenga un cruce resuelto y un punto dentro de zona.
- **FR-013**: Al cambiar la calle o la esquina de un bloque ya resuelto, el
  sistema DEBE invalidar el punto, la zona, el precio y los complementos de
  ese bloque.

#### Punto, arrastre y precio

- **FR-014**: El punto de retiro DEBE poder arrastrarse dentro de las cuadras
  de la calle declarada que tocan el cruce elegido, y sólo dentro de ellas.
  Dentro de esa región el punto es **libre**: no se proyecta ni se imanta al
  eje de la calle, así que puede quedar sobre la vereda o sobre el edificio.
  Lo que importa es dónde está la puerta, no dónde está la calzada.
- **FR-015**: Un intento de soltar el punto fuera de la región permitida DEBE
  reubicarlo en el punto permitido más cercano y explicar el motivo. NO DEBE
  rechazarse recién al enviar.
- **FR-016**: Cada movimiento del punto DEBE recalcular la zona y el precio.
- **FR-017**: Un cambio de zona provocado por mover el punto DEBE mostrarse de
  forma explícita, con la zona y el precio anterior y el nuevo. Nunca en
  silencio. El aviso NO DEBE interrumpir el arrastre ni exigir confirmación en
  el momento: el cliente reacomoda el pin varias veces y frenarlo en cada
  cruce de zona pelea con el Principio IV.
- **FR-017a**: El resumen previo al envío DEBE mostrar la zona y el precio
  finales. Ese resumen es el punto de confirmación del cobro.
- **FR-018**: Al enviar, el sistema DEBE revalidar que el punto está dentro de
  la región permitida por la dirección declarada.
- **FR-019**: Un cruce que cae fuera de las cinco zonas NO DEBE producir
  precio ni pedido: deriva a contacto directo.
- **FR-020**: El precio DEBE seguir saliendo exclusivamente de la zona del
  punto de retiro. La dirección de entrega NO DEBE influir en el precio. Sus
  campos siguen siendo obligatorios como hoy — FR-007a manda: el bloque de
  entrega no cambia.

#### Ambigüedad

- **FR-021**: Si un par calle/esquina resuelve a más de un cruce dentro del
  área de servicio, el sistema DEBE mostrarlos todos ubicados en el mapa y
  exigir que el cliente elija. NUNCA DEBE tomar el primero.

#### Presentación

- **FR-022**: Ningún elemento del mapa DEBE dibujarse por encima de la
  navegación, del menú, de las listas de sugerencias ni de los mensajes del
  formulario. Agregar un elemento flotante nuevo a la página NO DEBE requerir
  ajustarle el nivel de apilado para ganarle al mapa.
- **FR-023**: Todo el flujo DEBE ser operable en pantalla de teléfono, que es
  donde se usa (Principio IV).
- **FR-023a**: Los campos con sugerencias DEBEN ser operables enteramente por
  teclado — abrir y cerrar la lista, recorrerla, elegir y descartar — con el
  foco manejado de forma predecible.
- **FR-023b**: Las sugerencias, su cantidad y la opción elegida DEBEN quedar
  anunciadas para lectores de pantalla. Este feature retira el texto libre que
  hoy es la vía accesible para cargar una dirección, así que la pérdida de
  accesibilidad sería una regresión, no una mejora pendiente.

#### Fechas

- **FR-026**: Entre el retiro y la entrega DEBE haber un margen mínimo de **2
  horas**. El sistema NO DEBE aceptar un pedido que se entrega antes de haberse
  retirado, ni uno con un margen menor: no es una restricción técnica, es
  cuánto tarda una persona en cruzar Montevideo con un paquete.
- **FR-027**: La fecha de retiro NO DEBE ser anterior al día de hoy. Es el
  mismo defecto que FR-026 visto del otro lado: una fecha que ya pasó no se
  puede cumplir.
- **FR-028**: Los campos de fecha DEBEN acotar lo que se puede elegir para que
  el error sea difícil de cometer, no sólo detectable después. La validación al
  enviar sigue siendo la autoridad: el navegador ayuda, no decide.
- **FR-029**: El margen mínimo DEBE estar dicho **antes** de que el cliente
  elija, no sólo cuando se equivoca.
- **FR-030**: La coherencia de fechas DEBE revisarse al salir de cada campo,
  en cuanto los cuatro valores estén cargados. Enterarse al final de que las
  fechas no cierran obliga a volver a subir por el formulario, que en un
  teléfono es toda la pantalla.

#### Mantenibilidad

- **FR-024**: El origen de la resolución de direcciones DEBE poder cambiarse
  (de dato local a un servicio con base de datos geográfica) sin modificar el
  formulario.
- **FR-025**: La forma de la dirección DEBE quedar definida como una unidad
  única, con el punto, la zona y el precio como partes opcionales — el retiro
  las tiene, la entrega no. Es la forma que después va a persistirse por
  pedido, así que la entrega tiene que entrar en el mismo molde aunque hoy
  llegue sólo con texto.

### Key Entities

- **Calle**: un nombre de vía dentro del área de servicio, con su nombre para
  mostrar, su forma normalizada para buscar, y los tramos de eje que la
  componen.
- **Esquina (cruce)**: el punto donde dos calles se intersectan. Identificada
  por el par de calles; guarda su ubicación y las cuadras que la tocan.
- **Cuadra (tramo)**: el pedazo de una calle entre dos esquinas consecutivas.
  Es lo que define hasta dónde puede moverse el pin.
- **Dirección**: calle, esquina, número de puerta, apto, cooperativa, punto
  (latitud y longitud), zona resuelta y precio. Es la unidad que el formulario
  arma dos veces (retiro y entrega) y la que mañana será una fila por pedido.
- **Zona** y **precio**: ya existen desde `002`; este feature los consume, no
  los redefine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente ubica su dirección de retiro escribiendo únicamente
  dos campos y sin tocar el mapa. Hoy necesita tres campos escritos **más**
  una interacción con el mapa.
- **SC-002**: Existe en el repo un conjunto de al menos 30 esquinas conocidas
  de Montevideo con sus coordenadas de referencia, verificadas a mano una sola
  vez, y una prueba automática que falla si el índice resuelve cualquiera de
  ellas a más de 30 metros de su referencia. La prueba corre siempre, no sólo
  cuando se regenera el índice.
- **SC-003**: El 100% de los pedidos enviados tienen su punto dentro de la
  cuadra que el propio cliente declaró.
- **SC-004**: El 100% de los pedidos enviados llevan el precio de la zona en
  la que cae su punto final, sin excepción.
- **SC-005**: En pantalla de teléfono, en las dos páginas que usan mapa, el
  mapa no tapa la navegación ni ningún elemento flotante en ningún momento del
  scroll.
- **SC-006**: Las sugerencias de calle aparecen en menos de 300 ms desde que
  el cliente deja de tipear.
- **SC-007**: Lo que el cliente descarga para poder buscar direcciones no
  supera 1 MB comprimido.
- **SC-008**: Ningún par calle/esquina ambiguo produce un pedido sin que el
  cliente haya elegido cuál de los cruces era.
- **SC-009**: Una persona puede cargar una dirección de retiro completa sin
  usar el mouse y con un lector de pantalla, del primer campo al punto
  resuelto.
- **SC-010**: Ningún pedido enviado tiene la entrega antes del retiro, ni el
  retiro en una fecha ya pasada.
- **SC-011**: Un cliente que carga fechas incoherentes se entera al salir del
  campo, no al intentar enviar.

## Assumptions

- **Esquinas sobre el límite de zona**: los límites que definió el cliente son
  avenidas, así que hay cientos de esquinas ubicadas exactamente sobre un
  borde. Hasta que el cliente responda qué zona paga una dirección así, esos
  puntos se resuelven con el desempate determinista que ya existe desde `002`
  (gana la zona de menor `id`). **La pregunta está hecha al cliente el
  2026-08-04 y registrada como `High` en el tracker.** Bloquea el precio de
  esas direcciones, no el resto del feature.
- **Sin numeración domiciliaria**: no hay dato público de numeración
  disponible para este feature, así que el número de puerta es informativo
  para el repartidor y no ubica nada. Si más adelante aparece un dato con
  rangos de numeración por cuadra, se suma sin rehacer este flujo.
- **Sin pin libre de rescate**: si la calle o el cruce no están en el índice,
  el flujo deriva a contacto directo en vez de permitir marcar un punto
  cualquiera. Es la misma regla que la constitución fija para un punto fuera
  de zona, y sostiene la integridad del cobro que persigue FR-014.
- **El arrastre se limita a las cuadras de la Calle, no a las de la Esquina**:
  la puerta pertenece a la calle, la esquina sólo la ubica.
- **Región permitida**: las dos cuadras adyacentes al cruce, con un margen
  lateral del orden de 50 metros para cubrir veredas y retiros. El valor
  exacto se ajusta en el plan.
- **Área de servicio = las cinco zonas de `002`**. Direcciones fuera de eso no
  se resuelven ni se cotizan.
- **La dirección de entrega no lleva mapa ni punto**, por decisión del dueño
  del repo: no incide en el precio, y quien la necesita ubicada es el
  repartidor, que la va a ver desde la app Android. Ubicarla es problema de esa
  app y de su propio spec. Sí lleva autocompletado (FR-007a), agregado el
  2026-08-04 después de probar el formulario: escribir menos vale igual, y de
  paso evita mandar una calle mal escrita.
- **En entrega el autocompletado no bloquea** (FR-007b). Consecuencia asumida:
  un pedido puede salir con una dirección de entrega que no existe. Es el mismo
  riesgo que había antes, no uno nuevo, y es preferible a rechazar una entrega
  real fuera del área de servicio.
- **Entrega fuera de zona**: este feature no cambia si una entrega fuera de
  las cinco zonas se acepta o no; mantiene el comportamiento actual. Sólo el
  retiro condiciona el precio.
- **Procedencia del dato de calles**: la capa de ejes viales es material que
  la facultad entregó para el curso de TSIG, y el dueño del repo es coautor
  del trabajo donde se la usó. Autorizó su uso acá. Queda como requisito
  (FR-002) dejar registrado el origen junto al índice, para que dentro de un
  año se sepa de dónde salió el dato sin tener que reconstruirlo de memoria.
- **El dato de calles se recorta y se genera una sola vez por versión**; no se
  espera que cambie seguido, y regenerarlo es un paso manual documentado, como
  el de las zonas.

## Dependencies

- **Capa de ejes viales del curso de TSIG**, autorizada por el dueño del repo
  (§ Assumptions). Ya no es una dependencia bloqueante; lo que queda es
  registrar su procedencia junto al índice (FR-002).
- **Zonas y resolución de zona de `002`** (`web/lib/zonas.ts`,
  `web/lib/zona-lookup.ts`): este feature las consume tal cual. Si el
  desempate de borde cambia por respuesta del cliente, cambia ahí, no acá.
- **Deuda de apilado del mapa** registrada como `High` el 2026-08-02: se paga
  dentro de este plan (US3).

## Out of Scope

- Geocodificar el número de puerta (no hay dato).
- Ubicar la dirección de **entrega** en un mapa. Queda como texto libre; lo
  resuelve la app Android en su propio spec.
- Entrada inversa: marcar primero en el mapa y que el sistema complete calle y
  esquina. El flujo acordado es dirección primero, pin después.
- Backend, base de datos y cualquier servicio externo.
- Cuentas de usuario, direcciones guardadas y "repetir pedido".
- Generación de recorridos y optimización de rutas.
- La app Android de administración.
