# Feature Specification: La etiqueta de 12 x 10

**Feature Branch**: `028-etiqueta-12x10`

**Created**: 2026-09-19

**Status**: Draft

**Input**: Mateo, el 2026-09-19: *"resulta que la impresion del resumen para
pegar en el paquete me pidieron que la haga de 12 de ancho x 10 de alto, y ahora
tenemos toda la hoja a4"*.

**Quien lo pidio: un cliente de Diego**, confirmado por Mateo el mismo dia. No
es una preferencia del equipo ni de Diego: es de quien usa el sitio para mandar
paquetes, imprime la etiqueta y la pega. Por eso se le hace caso.

**Lo que sigue sin estar dicho es el motivo**, y se deja anotado como lo que es:
no se sabe si esa persona tiene una etiquetadora, compra autoadhesivos de ese
tamaño, o simplemente le sobra hoja. Con la decision de imprimir en A4 y
recortar (ver *Clarifications*) el motivo dejo de ser bloqueante, pero **si
aparece una etiquetadora de rollo mas adelante, la respuesta correcta cambia** —
y este parrafo es donde esta anotado que nadie lo pregunto.

**Es la primera vez que un pedido de cambio entra por ese camino**: repo ←
Mateo ← Diego ← cliente de Diego. Cuatro eslabones, y la constitucion ya cobro
cuatro amendments por extender con tres lo que el cliente dijo. Cada suposicion
sobre el por que de esta hoja vale menos de lo que parece.

## El problema: la hoja es cinco veces mas grande que la etiqueta

`020` entrego la etiqueta como un PDF de una hoja A4, que es lo que el cliente
pidio entonces —*"hoja a4"*, textual— y `026` le sumo el comentario del cliente.
La hoja funciona: el codigo domina, la entrega pesa mas que el retiro, no hay un
solo importe. Lo que cambio es el pedido: ahora la quieren de **12 cm de ancho
por 10 cm de alto**.

No es un cambio de parametro. La maqueta de `020` esta calzada a mano, en
milimetros, contra 210 x 297. Este es el presupuesto vertical que gasta hoy, con
margenes de 18 mm y 261 mm utiles:

| Bloque | Alto que ocupa |
|---|---|
| Encabezado (silueta + nombre + linea) | ~31 mm |
| Caja del codigo (34 mm + aire) | ~46 mm |
| Bloque de entrega (17/13 pt, dos renglones de direccion) | ~44 mm |
| Bloque de retiro (13/11 pt) | ~34 mm |
| Comentario (dos renglones) | ~18 mm |
| Pie (fecha y cantidad) | 16 mm |
| **Total** | **~189 mm de 261** |

En 120 x 100 quedan, con margenes chicos, unos **88 mm utiles de alto**. Hay que
meter 189 en 88. **La superficie total cae cinco veces** (12.000 mm² contra
62.370). No hay recorte de margenes que arregle eso: hay que rehacer la
jerarquia, los tamaños y los espacios, y decidir de antemano que cede cuando el
contenido no entra.

## Que esta en juego que no es tipografia

Dos cosas de `020` se volvieron caras en una hoja chica, y son las que este
feature tiene que resolver a proposito en vez de descubrir imprimiendo:

1. **El codigo se lee a un brazo de distancia** (FR-004 de `020`). En A4 eso era
   gratis: 46 pt en una hoja donde sobraban 72 mm. Aca compite con todo lo demas.
   El requisito sigue siendo la legibilidad, no el tamaño en puntos — un digito
   de 28 pt mide ~10 mm y se lee de lejos igual; lo que no sobra es el espacio
   alrededor.
2. **Cuanto contenido se toma como normal.** Dos direcciones de Montevideo con
   calle compuesta, numero, apto, esquina y cooperativa, mas un comentario de 280
   caracteres, es el maximo que el formulario deja escribir. En A4 sobraba. Aca
   **no puede ser lo que define el diseño**, por decision de Mateo del
   2026-09-19: diseñar para ese maximo obliga a tipografia chica en las once
   etiquetas de cada doce que no lo alcanzan. Se maqueta para el caso real y se
   acepta el riesgo del extremo — ver *Clarifications* y *Assumptions*.

## Clarifications

### Session 2026-09-19

Tres decisiones de Mateo, tomadas sobre opciones puestas por escrito. Las tres
suenan contradictorias juntas y no lo son, asi que se dicen de una: **la hoja
sigue siendo A4; la etiqueta pasa a ser de 12 x 10.** El A4 deja de ser el
formato de la etiqueta y queda como el papel que la transporta hasta la tijera.

- **Se imprime en una impresora comun y se recorta.** El documento sigue siendo
  A4 y lleva adentro el rectangulo de 120 x 100 con marcas de corte. Se eligio
  contra la pagina de 120 x 100 exactos porque **no hay etiquetadora de rollo
  confirmada del otro lado**, y una pagina de tamaño raro mandada a una
  impresora comun es justo donde el *ajustar a la pagina* la agranda en
  silencio. Aca el escalado se ve: el rectangulo impreso se mide con una regla.
- **Cuando no entra, se achica hasta que entre**, con un piso de legibilidad, en
  vez de recortar el comentario. Nada de lo que el cliente escribio deja de
  llegarle a Diego por una decision de maqueta. El costo esta anotado en FR-007
  y FR-008: en el peor caso el comentario sale en cuerpo chico.
- **El 12 x 10 reemplaza a la A4**, no conviven. Un solo boton, una sola maqueta.
  Dos maquetas en paralelo es donde empiezan a divergir sin que nadie lo note, y
  este feature existe justo porque una maqueta calzada a mano no se generaliza
  sola.

### Session 2026-09-19 (segunda vuelta)

- **Quien lo pidio: un cliente de Diego.** Ver el bloque *Input*. El motivo
  sigue sin estar dicho y se anota como tal, no se infiere.
- **El maximo de contenido deja de ser el caso de diseño.** Mateo: *"no creo que
  hayan comentarios tan grandes de 280 caracteres, asique es un peligro que vamos
  a correr"*. **Es una decision de producto y esta tomada**: la maqueta se calza
  al contenido real —direcciones normales, comentario corto o ausente— con
  tipografia comoda, en vez de achicar todo para que el extremo salga lindo. Lo
  que se compra es que las once etiquetas de cada doce se lean mejor; lo que se
  arriesga es que la que llegue al tope salga apretada.

  **Esto reordena FR-005 y FR-006 y no elimina FR-008.** La maqueta se calza al
  caso corriente (FR-005) y achica solo cuando hace falta (FR-006); el corte del
  comentario (FR-008) sigue existiendo porque FR-003 prohibe que algo quede fuera
  del recorte y una tijera no negocia. **El riesgo aceptado es que el caso
  ocurra, no que la tijera se lleve media direccion.**

### Session 2026-09-19 (hook `before_plan`)

- Q: La hoja A4, fuera del rectangulo recortable, ¿lleva instrucciones impresas
  (*"imprimir al 100 %, recortar por las marcas"*)? → A: **No. La hoja va
  limpia**: solo el rectangulo y sus marcas.
- Q: ¿Como se marca por donde cortar? → A: **Marcas en las esquinas**, afuera del
  rectangulo. Nada de recuadro entero.

Las dos van en la misma direccion y conviene decir cual: **la etiqueta gana
prolijidad y el producto renuncia a avisar del escalado.** La marca de esquina no
deja marco impreso en la etiqueta pegada y perdona un corte torcido; la hoja sin
instrucciones no le dice a nadie que imprima al 100 %. El modo de falla del
escalado (ver *Edge Cases*) queda sin defensa dentro del papel y pasa a ser cosa
del quickstart y de la primera etiqueta que alguien mida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La etiqueta sale del tamaño que pidieron (Priority: P1)

Quien acaba de confirmar un pedido toca *Imprimir resumen*, lo imprime en la
impresora que tiene, recorta por las marcas, y lo que queda en la mano mide 12 cm
de ancho por 10 de alto. Lo pega en la caja y se ve entero: el codigo de lejos,
la direccion de entrega de cerca.

**Why this priority**: es el pedido, completo. Sin esto no hay feature.

**Independent Test**: imprimir una hoja, recortar por las marcas y medir con una
regla; despues leer el codigo parado a un brazo de la caja.

**Acceptance Scenarios**:

1. **Given** un pedido recien confirmado, **When** se descarga e imprime la hoja
   al 100%, **Then** el rectangulo marcado mide 120 x 100 mm y el contenido entra
   completo adentro.
2. **Given** la hoja impresa, **When** se recorta por las marcas, **Then** no
   queda ningun elemento de la etiqueta del lado de afuera del corte.
3. **Given** la etiqueta recortada y pegada a una caja, **When** alguien la mira
   parado a un brazo de distancia, **Then** lee el codigo sin acercarse.

---

### User Story 2 - El pedido de todos los dias se lee comodo (Priority: P1)

Un pedido normal —direcciones de largo corriente, con o sin un comentario de un
par de renglones— sale en una etiqueta que Diego lee en la calle sin entrecerrar
los ojos. **Este es el caso que manda sobre la maqueta**, no el maximo que el
formulario permite.

**Why this priority**: es el 90 % de lo que se va a imprimir, y es donde se gana
o se pierde el feature. Calzar el diseño al extremo —280 caracteres mas dos
direcciones de cinco lineas— obliga a cuerpo chico en todas las demas, que es
pagar once etiquetas para salvar una.

**Independent Test**: imprimir tres o cuatro pedidos reales, recortar, y leerlos
parado.

**Acceptance Scenarios**:

1. **Given** un pedido con direcciones de largo corriente y un comentario de un
   par de renglones, **When** se imprime y se recorta, **Then** todos los bloques
   se leen comodos a distancia de lectura y el codigo se lee de lejos.
2. **Given** un pedido sin comentario, **When** se genera la etiqueta,
   **Then** no aparece ni el titulo del comentario ni un hueco donde iria, y ese
   espacio queda para los demas bloques.

---

### User Story 3 - La misma etiqueta desde Mis pedidos (Priority: P2)

Quien cerro la pestaña y vuelve despues saca la misma etiqueta desde la tarjeta
del pedido en Mis pedidos.

**Why this priority**: ya funciona desde `020`; esta aca porque el cambio de
tamaño no puede romperlo ni hacer que las dos pantallas diverjan.

**Independent Test**: imprimir el mismo pedido desde la confirmacion y desde Mis
pedidos, y comparar las dos hojas.

**Acceptance Scenarios**:

1. **Given** un pedido ya guardado, **When** se imprime desde su tarjeta,
   **Then** sale el mismo documento que salio desde la confirmacion.

---

### User Story 4 - El caso extremo no arruina la etiqueta (Priority: P3)

Alguien escribe un comentario de 280 caracteres sobre dos direcciones largas. La
etiqueta sale apretada —eso esta aceptado— pero **sigue siendo una etiqueta**:
nada queda del lado de afuera del corte, ninguna direccion se pierde, y si algo
tiene que ceder se ve que cedio.

**Why this priority**: **P3 y no P1, por decision de Mateo del 2026-09-19**: es
poco probable y no vale deformar el diseño por el. Sigue en la lista porque el
corte con tijera es fisico — lo que cae afuera del rectangulo no se lee nunca — y
porque el modo de falla feo (media direccion en la basura) cuesta tres lineas
evitarlo.

**Independent Test**: armar el pedido mas largo que el formulario acepta,
imprimir, recortar, y mirar que sobrevivio.

**Acceptance Scenarios**:

1. **Given** un pedido en el tope de contenido, **When** se imprime y se
   recorta, **Then** el codigo, las dos direcciones completas, los dos telefonos,
   la fecha y la cantidad estan enteros adentro del recorte.
2. **Given** ese mismo pedido, **When** el comentario no entra ni con la maqueta
   en su piso, **Then** se corta con una marca visible de que sigue, y **nunca**
   se recorta una direccion ni un telefono en su lugar.

---

### Edge Cases

- **El escalado de la impresora.** Sigue existiendo aunque la hoja sea A4:
  *ajustar a la pagina* encoge el A4 un 4 % o 5 % para meterlo en el area
  imprimible, y entonces el rectangulo sale de 115 x 96 en vez de 120 x 100. **El
  producto no controla esto** —no abre el dialogo de impresion (FR-017 de
  `020`)— y desde el 2026-09-19 **tampoco avisa**: la hoja va limpia, sin la
  linea de *"imprimir al 100 %"* que se evaluo y se descarto (FR-002b).

  Lo que queda como defensa es que el error **se pueda medir**: las marcas de
  esquina estan a 120 x 100 exactos, asi que una regla sobre la primera etiqueta
  contesta la pregunta en dos segundos. **Eso no es lo mismo que prevenirlo**, y
  es el riesgo que este spec acepta a cambio de una hoja prolija: la primera
  etiqueta de alguien con la impresora en *ajustar a la pagina* sale de 115 x 96
  y nada en el papel se lo dice. El quickstart MUST incluir la medicion, que es
  donde esto se agarra.
- **La impresora no llega hasta el borde.** El rectangulo MUST caer dentro del
  area imprimible de una A4 comun, con aire de sobra, o el corte se come un
  renglon en la impresora de alguien.
- **El peor caso de contenido**, arriba: es una historia P1 y no una nota al pie.
- **Un pedido sin punto de entrega** (anterior a `011`): se imprime igual, sin el
  bloque de zona, sin hueco y sin leyenda. Igual que en `020`.
- **Comentario con renglones puestos a proposito**: se respetan, como en `026`.
  En una hoja chica un comentario de tres renglones cuesta mucho mas que en A4.
- **Tildes y ñ**: el sitio esta en español y las calles de Montevideo estan
  llenas de las dos. Un tamaño de hoja no las rompe, pero si se cambia de fuente
  para ganar espacio, si.
- **Tocar el boton dos veces**: descarga dos archivos identicos. Igual que antes.

## Requirements *(mandatory)*

### Functional Requirements

**Lo que cambia**

- **FR-001**: El documento MUST seguir siendo una hoja A4, y MUST llevar adentro
  **un rectangulo de 120 mm de ancho por 100 mm de alto** que contiene la
  etiqueta entera. El A4 es el papel que la transporta, no el formato de la
  etiqueta.
- **FR-002**: El rectangulo MUST señalarse con **marcas de corte en las cuatro
  esquinas, dibujadas afuera del rectangulo**. MUST NOT llevar recuadro entero,
  ni punteado ni solido: la etiqueta recortada queda **sin marco**, y un corte
  torcido no deja medio renglon de linea impreso en el borde.
- **FR-002b**: La hoja A4 MUST NOT llevar **nada mas** fuera del rectangulo: ni
  instrucciones de impresion, ni pie de pagina, ni numero de hoja. Se evaluo
  imprimir *"imprimir al 100 %, recortar por las marcas"* y **se descarto**
  (2026-09-19): la contrapartida esta anotada en *Edge Cases*.
- **FR-003**: **Nada de la etiqueta MUST quedar fuera del rectangulo.** Ni un
  renglon, ni un borde, ni el pie. Lo que cae afuera del corte no existe.
- **FR-004**: Una etiqueta MUST caber entera en un solo rectangulo. MUST NOT
  desbordar a un segundo: una etiqueta partida en dos no se pega.
- **FR-005**: La maqueta MUST calzarse al **contenido corriente** —direcciones de
  largo normal, comentario corto o ausente— y no al maximo que el formulario
  acepta. Un pedido de todos los dias MUST salir con tipografia comoda, sin
  achicarse de antemano para reservar lugar a un caso que casi no ocurre.
- **FR-006**: Cuando el contenido excede lo corriente, la maqueta MUST achicarse
  hasta que entre, en vez de recortar contenido. **Achicar es la regla; recortar
  es el fondo de la red (FR-008).**
- **FR-007**: El achique MUST tener un piso de legibilidad por bloque —la tabla
  vive en `research.md` D3— y **medido sobre papel impreso, no en pantalla**. El
  piso del bloque de entrega MUST ser mas alto que el del comentario: es la
  direccion a la que hay que llegar. Cada bloque MUST bajar **hacia su propio
  piso**, no todos por el mismo factor: tienen aire distinto, y un factor unico
  se frena en el mas apretado desperdiciando el del resto.
- **FR-008**: Si con todos los bloques en su piso el contenido **todavia** no
  entra, el unico que MUST ceder es el comentario, cortandose con una marca
  visible de que sigue. **Nunca una direccion, nunca un telefono, nunca a medias
  y sin avisar.** No es el comportamiento normal y no se diseña para el: existe
  porque FR-003 prohibe que algo quede fuera del corte, y una tijera no negocia.
- **FR-009**: El formato de 12 x 10 MUST ser el unico que el boton produce. La
  etiqueta A4 de `020` **desaparece**: no hay eleccion de tamaño en pantalla ni
  dos maquetas que mantener.
- **FR-010**: La jerarquia visual MUST sobrevivir la reduccion: el codigo sigue
  siendo el elemento dominante y la entrega MUST pesar mas que el retiro.
- **FR-011**: El codigo MUST seguir siendo legible a un brazo de distancia
  (FR-004 de `020`). **El requisito es la legibilidad, no el tamaño en puntos**:
  el numero en si puede bajar, el espacio en blanco que lo rodea no puede
  desaparecer.
- **FR-012**: La marca MUST seguir en la etiqueta como silueta negra mas el
  nombre compuesto como texto (FR-019 de `020`), y MUST NOT competir con el
  codigo por la jerarquia. Sus medidas actuales —13 mm de silueta mas el nombre a
  20 pt— no caben.
- **FR-013**: Un texto mas largo que su espacio MUST cortarse en varias lineas
  sin desbordar el rectangulo ni pisar otro bloque. **En A4 esto casi no se
  ejercitaba; aca es el caso normal.**

**Lo que NO cambia** — se repite aqui porque un re-maquetado es donde estas cosas
se pierden sin que nadie lo note.

- **FR-014**: La etiqueta MUST NOT mostrar ningun importe, ni ningun texto que
  apele al costo, ni un espacio reservado para uno. **Principio V.** La guarda
  que lo prueba vive sobre la estructura, no sobre el dibujo, y MUST seguir
  valiendo sin cambios.
- **FR-015**: La etiqueta MUST NOT mostrar el tamaño del paquete, la hora de
  retiro ni la cedula de quien recibe.
- **FR-016**: La etiqueta MUST seguir mostrando: codigo; del destinatario nombre,
  telefono y direccion de entrega compuesta; del remitente nombre, telefono y
  direccion de retiro compuesta; fecha de retiro; cantidad de paquetes; y el
  comentario del cliente cuando hay.
- **FR-017**: La zona de entrega MUST seguir apareciendo junto al bloque de
  entrega cuando el pedido tiene punto guardado, y el bloque MUST omitirse entero
  cuando no lo tiene. **Nunca se deduce la zona de la direccion escrita.**
- **FR-018**: Las direcciones MUST componerse con la misma funcion que ya usa la
  pantalla, para que papel y pantalla no puedan divergir.
- **FR-019**: El documento MUST representar correctamente tildes, ñ y diereses.
- **FR-020**: Las dos pantallas —confirmacion y Mis pedidos— MUST producir el
  mismo documento para el mismo pedido, y la composicion MUST seguir viviendo en
  un solo lugar.
- **FR-021**: El peso de la libreria de PDF MUST seguir cargandose **al tocar el
  boton** y nunca al visitar el sitio.
- **FR-022**: Generar la etiqueta MUST NOT requerir ninguna llamada al servicio.
- **FR-023**: Si la etiqueta no se puede generar, el boton MUST decirlo con un
  mensaje visible. Nunca quedarse sin hacer nada.
- **FR-024**: El nombre del archivo descargado MUST seguir conteniendo el codigo
  del pedido.

### Key Entities

- **Etiqueta** — sin cambios desde `020`: la representacion imprimible de un
  pedido. **Es una vista, no un dato.** Lo que este feature toca es como se
  dibuja, no que dice.
- **Pedido** — ya existe, en sus dos formas (recien tipeado, o devuelto por el
  servicio).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La etiqueta recortada mide 12 cm x 10 cm, medida con una regla
  sobre el papel, imprimiendo al 100 %.
- **SC-002**: Recortar por las marcas no deja ningun elemento de la etiqueta del
  lado de afuera, y la etiqueta recortada **no tiene marco impreso**: un corte
  1 mm torcido no se nota.
- **SC-003**: Un pedido corriente —direcciones de largo normal, comentario de un
  par de renglones o ninguno— se lee comodo en todos sus bloques, comprobado
  **sobre papel recortado y no en pantalla**. Este es el criterio que manda.
- **SC-004**: Un pedido en el tope de contenido sale apretado pero completo en lo
  que importa: codigo, las dos direcciones, los dos telefonos, fecha y cantidad,
  enteros y adentro del recorte. Si cede el comentario, se ve que cedio.
- **SC-005**: Una persona parada a un brazo de la caja lee el codigo sin
  acercarse.
- **SC-006**: Cero importes en el documento.
- **SC-007**: El mismo pedido impreso desde las dos pantallas produce documentos
  con el mismo contenido.
- **SC-008**: Visitar el sitio sin imprimir nada no descarga la libreria de PDF.
- **SC-009**: Un pedido sin punto de entrega se imprime sin bloque de zona y sin
  hueco.
- **SC-010**: No queda ninguna forma de obtener la etiqueta A4 de `020`: un solo
  boton, un solo tamaño.

## Assumptions

- **"12 de ancho x 10 de alto" se toma literal**: 120 mm de ancho por 100 mm de
  alto, apaisada. Si eran centimetros al reves —10 de ancho por 12 de alto— la
  maqueta cambia entera, asi que se confirma antes de dibujar.
- **La hoja portadora es A4 vertical**, que es lo que tiene cualquier impresora
  de oficina en Montevideo. El rectangulo va arriba y con aire respecto de los
  bordes, no centrado en la hoja: recortar desde una esquina es mas facil que
  desde el medio, y un rectangulo pegado al borde lo come el area no imprimible.
- **Se imprime una etiqueta por hoja.** Poner dos o tres por A4 para ahorrar
  papel no se pidio, y multiplicaria la maqueta por las combinaciones de pedidos.
  Si Diego lo pide, es otro feature.
- **Una etiqueta por pedido, no una por bulto.** Se hereda de `020`: el pedido
  lleva la cantidad impresa y no hay numeracion de bultos. Un pedido de cinco
  paquetes se imprime cinco veces si hace falta.
- **No cambia nada del servicio ni de la app Android.** Todo ocurre en el
  navegador con datos que la pantalla ya tiene.
- **El producto entrega un archivo y no imprime.** Sigue sin abrir el dialogo de
  impresion, sin elegir impresora, sin fijar margenes y sin hablar con un driver
  (FR-017 de `020`). Por eso el escalado no es algo que el producto controle: lo
  unico que puede hacer es dejarlo **medible**, que es para lo que estan las
  marcas de corte.
- **No hay etiquetadora de rollo confirmada.** Si mas adelante aparece una, la
  pagina de 120 x 100 exactos vuelve a ser la opcion correcta y este spec es
  donde esta anotado por que hoy no se eligio.
- **Se asume que casi nadie escribe 280 caracteres de comentario**, y ese riesgo
  **esta aceptado a proposito** (Mateo, 2026-09-19). Es una suposicion sobre el
  comportamiento de gente real, tomada sin datos: `026` lleva poco en produccion
  y nadie conto los comentarios que se escribieron. **Se puede comprobar despues
  y barato** —contar largos de comentario sobre los pedidos que ya existen— y si
  resulta que se usan largos, la maqueta se recalibra sin cambiar ningun
  requisito. Se anota aca para que sea una decision con fecha y no una creencia
  heredada.
- **Los datos del destinatario siguen viajando en papel pegados a una caja.** Es
  la misma decision que anoto `020`; una hoja mas chica no la cambia.
