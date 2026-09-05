# Feature Specification: La etiqueta que se pega al paquete

**Feature Branch**: `020-resumen-imprimible`

**Created**: 2026-09-05

**Status**: Draft

**Input**: Mateo, el 2026-09-05, trayendo una lista que junto con Diego. Sobre
este punto, y marcandolo como lo mas importante de la tanda: *"lo importantisimo
seria la parte de imprimir el resumen del pedido una vez que terminas de
confirmar el pedido, que haya un boton de imprimir resumen para poder pegarlo en
el paquete que estan queriendo mandar. la idea es solo generar un pdf con el
resumen, hacerlo lindo y prolijo, hoja a4 y que ellos se lo descarguen y lo
impriman"*. En el documento del cliente figura en **MODIFICACIONES** como
*"imprimir resumen de pedido"*.

Tres decisiones suyas del mismo dia, tomadas sobre opciones puestas por escrito:

- **El PDF lo arma una libreria**, no el dialogo de impresion del navegador.
- **El boton va en la confirmacion y tambien en cada tarjeta de Mis pedidos**,
  para que cerrar la pestaña no cueste la etiqueta.
- **La hoja lleva el codigo grande, mas destinatario y remitente**, con fecha de
  retiro y cantidad.

## El problema: el pedido tiene codigo y el paquete no tiene nada

Desde `007` el pedido se guarda y sale con un codigo, `FU-####`, que la pantalla
de confirmacion muestra y le pide a la persona que anote
(`web/components/pedido-form.tsx`, componente `Confirmation`). **Anotarlo es todo
lo que hay.** Despues esa persona agarra una caja, la deja lista para que pase
Diego, y **entre la caja y el pedido no hay ningun vinculo fisico**: Diego llega
a una puerta, recibe un bulto, y tiene que preguntar de que pedido se trata o
deducirlo por la direccion.

Ese hueco se paga dos veces. Una en el retiro, adivinando cual de dos cajas es
cual. Y otra en la entrega, cuando el paquete viaja con el destinatario escrito
en ningun lado y el unico que sabe a donde va es el telefono de Diego.

Lo que falta no es informacion —el servicio la tiene toda— sino **un objeto de
papel que la lleve encima**.

## Que es esta hoja, y que no es

**Es una etiqueta de envio**, aunque el pedido la haya llamado "resumen". La
diferencia manda sobre el diseño: un resumen se lee sentado, una etiqueta se lee
**pegada a una caja, en una escalera, con una mano ocupada**. De ahi que el
codigo domine la hoja y no sea un renglon mas de una lista.

**No es un comprobante ni una factura, y no puede parecerlo.** El Principio V es
explicito: el producto no dice lo que sale un envio, y **ningun texto justifica
nada apelando al costo**. Una hoja titulada "resumen del pedido" es exactamente
el lugar donde un importe aparece solo, por costumbre de formulario. Aca no
aparece: ni el monto, ni la zona como si fuera una tarifa, ni un espacio en
blanco que sugiera que deberia ir uno.

## Clarifications

### Session 2026-09-05

- Q: ¿La etiqueta lleva la zona de entrega? → A: **Si, el nombre de la zona**
  junto al bloque de entrega. No es un importe, asi que no roza el Principio V, y
  le sirve a Diego para agrupar cajas por zona mirando los bultos en vez del
  telefono.

- Q: ¿La etiqueta lleva la marca? → A: **La silueta del camion en negro, y el
  nombre como texto.** Pedido de Mateo: *"el logo pero en blanco y negro y capaz
  solo la silueta del camion"*.

  **Y no es solo una preferencia: el logo actual no se puede poner sobre papel
  blanco.** Mirando `web/public/logo-flash-urbano.jpeg`, la marca esta diseñada
  para fondo azul — *FLASH* es **blanco**, *LOGÍSTICA Y TRANSPORTE* es **blanco**
  y **la caja del camion tambien es blanca**; lo unico naranja es *URBANO* y las
  lineas de velocidad. Sobre una hoja blanca no queda un logo apagado: queda
  "URBANO" flotando y un contorno suelto. Es la razon por la que `icon.svg` pinta
  un cuadrado azul detras.

  De ahi las dos mitades de la decision: **la silueta del camion** es la unica
  parte de la marca que sobrevive fuera del azul, y **el nombre va como texto del
  documento**, no como imagen, porque la tipografia original vive dentro de un
  PNG y no se puede reusar. Como texto ademas es nitido a cualquier tamaño, pesa
  cero y queda seleccionable.

  **Cuidado al construirla**: el camion de hoy es *blanco con contorno naranja*,
  asi que umbralar el PNG da un **contorno**, no una silueta. Hay que rellenar el
  cuerpo. Se resuelve como el resto de los assets del repo —un generador en
  `design-source/` y el resultado versionado— y el como lo decide el plan.

- Q: ¿El producto manda a imprimir, o entrega un archivo? → A: **Entrega un
  archivo, siempre.** El boton descarga un PDF y ahi termina la
  responsabilidad del producto: la persona lo abre y lo imprime desde su propio
  visor. Palabras de Mateo: *"la idea es que siempre descargue un pdf, para que
  sea mas facil. asi cuando abris el pdf ya lo podes imprimir desde ahi y no
  tengo que integrar el tema de mandar a descargar con los drivers de la
  impresora"*.

**Esto reencuadra el caso de borde del telefono, y lo baja de riesgo a
variacion aceptable.** La preocupacion era que en iOS la descarga programatica
abre un visor en vez de guardar el archivo. Con la regla de arriba **eso no es
un defecto**: el visor es exactamente el lugar desde donde la persona iba a
imprimir de todos modos. Lo que importa no es donde aterriza el archivo sino
**que llegue**; el unico fracaso es que no pase nada.

Tambien cierra por que la libreria y no el dialogo del navegador: no es una
preferencia tecnica, es que el producto **no quiere estar en el medio de la
impresion**. Un `window.print()` mete al producto en la conversacion con la
impresora —margenes, encabezados del navegador, que bandeja— y eso es
precisamente lo que se decidio no hacer.

## Lo que se imprime, y por que ese recorte

| bloque | contenido | para que |
|---|---|---|
| **Codigo** | `FU-####`, dominante | vincula el bulto con el pedido en la app de Diego |
| **Entrega** | nombre, telefono y direccion del destinatario | para llegar a la puerta y tocar el timbre |
| **Retiro** | nombre, telefono y direccion del remitente | para devolverlo si no se puede entregar |
| **Envio** | fecha de retiro y cantidad de paquetes | que bulto de cuantos, y de que dia |
| **Zona** | el nombre de la zona de entrega | Diego agrupa cajas por zona sin abrir el telefono |
| **Marca** | silueta del camion en negro + el nombre como texto | que la caja se lea como un envio de Flash Urbano |

Queda afuera, deliberadamente:

- **Cualquier monto.** Principio V.
- **La cedula de quien recibe.** No la tiene el cliente: la captura Diego en la
  app al entregar (`016`), y el servicio no se la manda de vuelta.
- **El tamaño del paquete y la hora de retiro.** Estan en pausa desde `014`: el
  sitio manda `chico` y `16:00` fijos, que **no son datos, son relleno**.
  Imprimirlos seria publicar en papel un valor que nadie eligio.
- **El estado del pedido.** Una etiqueta impresa se queda con el estado del dia
  que se imprimio; el estado vive en la app y cambia.

## Dos pantallas, dos formas del mismo dato

El boton aparece en dos lugares que **no tienen la misma informacion en la
mano**, y eso es lo que estructura el trabajo:

- **En la confirmacion** el dato es lo que la persona acaba de tipear —el
  `FormState` del formulario— mas el codigo que devolvio el servicio.
- **En Mis pedidos** el dato es un `PedidoGuardado`, tal como el servicio lo
  devuelve, con otros nombres de campo y con la direccion ya descompuesta.

La hoja tiene que salir **identica** desde los dos lados. Si no, el mismo pedido
impreso dos veces produce dos etiquetas distintas, y la que vale pasa a depender
de desde donde se imprimio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Imprimir la etiqueta al confirmar (Priority: P1)

Alguien termina de cargar su pedido, ve la confirmacion con el codigo, toca
**Imprimir resumen** y obtiene un PDF A4 que manda a la impresora y pega en la
caja.

**Why this priority**: Es el pedido textual del cliente y el momento en que la
persona tiene la caja delante.

**Independent Test**: Confirmar un pedido, tocar el boton, abrir el archivo y
comprobar que la hoja tiene el codigo, los dos bloques de direccion y ningun
monto.

**Acceptance Scenarios**:

1. **Given** un pedido recien confirmado, **When** se toca *Imprimir resumen*,
   **Then** se descarga un PDF de una hoja A4 con el codigo del pedido como
   elemento dominante.
2. **Given** ese PDF, **When** se lo lee, **Then** contiene nombre, telefono y
   direccion de entrega; nombre, telefono y direccion de retiro; la fecha de
   retiro y la cantidad de paquetes.
3. **Given** ese PDF, **When** se busca cualquier importe, **Then** no hay
   ninguno, ni un lugar donde deberia haberlo.
4. **Given** una direccion con apto, esquina y cooperativa, **When** se imprime,
   **Then** la direccion sale compuesta igual que como se ve en pantalla.

---

### User Story 2 - Reimprimir desde Mis pedidos (Priority: P1)

Alguien cerro la pestaña, se le trabo la impresora, o manda el paquete al dia
siguiente. Entra a su historial y vuelve a sacar la misma etiqueta.

**Why this priority**: Misma prioridad porque sin esto el feature falla en el
caso mas comun de todos —que la impresion no salga a la primera— y obliga a
crear un pedido de nuevo, que ademas ensucia los datos de Diego.

**Independent Test**: Imprimir el mismo pedido desde la confirmacion y desde el
historial, y comparar los dos archivos.

**Acceptance Scenarios**:

1. **Given** un pedido en Mis pedidos, **When** se toca *Imprimir resumen* en su
   tarjeta, **Then** se descarga la etiqueta de ese pedido.
2. **Given** un mismo pedido, **When** se lo imprime desde la confirmacion y
   desde el historial, **Then** las dos hojas dicen exactamente lo mismo.
3. **Given** un pedido anterior a `011`, sin punto de entrega guardado,
   **When** se imprime, **Then** la etiqueta sale igual con la direccion que si
   se guardo, **omitiendo el bloque de zona** — sin dejar un hueco, sin decir
   "sin zona", y **sin adivinarla desde la direccion escrita**.

---

### User Story 3 - Que la hoja se lea pegada a una caja (Priority: P2)

La etiqueta sirve si el repartidor la lee de un vistazo, no si es prolija de
cerca.

**Why this priority**: P2 porque el feature entrega valor sin esto, pero el
cliente pidio explicitamente que sea "lindo y prolijo" y una etiqueta ilegible es
una etiqueta que nadie usa.

**Independent Test**: Imprimir una en papel, pegarla en una caja y leerla parado.

**Acceptance Scenarios**:

1. **Given** la hoja impresa en A4, **When** se la mira a un brazo de distancia,
   **Then** el codigo se lee sin acercarse.
2. **Given** un nombre o una direccion larga, **When** se imprime, **Then** el
   texto no se sale de la hoja ni se superpone con otro bloque.
3. **Given** una direccion con tildes y ñ, **When** se imprime, **Then** los
   caracteres salen correctos y no como simbolos rotos.

---

### Edge Cases

- **Una direccion muy larga.** El caso real: calle con nombre compuesto, numero,
  apto, esquina y cooperativa, todo junto. Tiene que cortar en varias lineas, no
  desbordar.
- **Tildes y ñ.** El sitio esta en español y las direcciones de Montevideo estan
  llenas de las dos. Si la fuente que se elija no las soporta, salen rotas y el
  defecto es invisible hasta que alguien imprime "Piñeyro".
- **Un pedido sin punto de entrega** (anterior a `011`). Se imprime igual: la
  etiqueta lleva la direccion escrita, no coordenadas.
- **La descarga en el telefono.** El sitio es mayoritariamente movil
  (Principio IV) y la descarga programatica se comporta distinto en cada
  navegador: en iOS puede abrir un visor en vez de guardar el archivo. **Eso es
  aceptable** —ver Clarifications—: desde el visor se imprime igual, que es a
  donde la persona iba. Lo que hay que comprobar en un telefono de verdad no es
  *donde* aterriza, sino **que el archivo llegue y se abra**.
- **Tocar el boton dos veces.** Descarga dos archivos identicos. Molesto, no
  grave; no se crea nada en el servicio.
- **La libreria no carga.** Si se trae bajo demanda y la red falla, el boton
  tiene que decirlo, no quedarse mudo — el mismo modo de falla que el 2026-08-14
  dejo el boton de confirmar sin hacer nada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Desde la pantalla de confirmacion, quien acaba de crear un pedido
  MUST poder descargar un PDF de una sola hoja A4 con la etiqueta de ese pedido.
- **FR-002**: Desde cada tarjeta de Mis pedidos, MUST poder descargarse la misma
  etiqueta de ese pedido.
- **FR-003**: Las dos rutas MUST producir el mismo documento para el mismo
  pedido. La composicion de la hoja MUST vivir en un solo lugar, alimentado por
  las dos formas del dato.
- **FR-004**: La etiqueta MUST mostrar el codigo del pedido como elemento
  dominante de la hoja, legible a un brazo de distancia.
- **FR-005**: La etiqueta MUST incluir, del destinatario, nombre, telefono y
  direccion de entrega compuesta; y del remitente, nombre, telefono y direccion
  de retiro compuesta.
- **FR-006**: La etiqueta MUST incluir la fecha de retiro y la cantidad de
  paquetes.
- **FR-007**: La etiqueta MUST NOT mostrar ningun importe, ni ningun texto que
  apele al costo, ni un espacio reservado para uno. **Principio V.**
- **FR-008**: La etiqueta MUST NOT mostrar el tamaño del paquete ni la hora de
  retiro, que desde `014` son valores fijos y no elegidos.
- **FR-009**: La etiqueta MUST NOT mostrar la cedula de quien recibe.
- **FR-010**: Las direcciones MUST componerse con la misma funcion que ya usa la
  pantalla, para que papel y pantalla no puedan divergir.
- **FR-011**: El documento MUST representar correctamente tildes, ñ y diereses.
- **FR-012**: Un texto mas largo que su espacio MUST cortarse en varias lineas
  dentro de la hoja, sin desbordar ni pisar otro bloque.
- **FR-013**: Generar la etiqueta MUST NOT requerir ninguna llamada al servicio
  mas alla de los datos que la pantalla ya tiene.
- **FR-014**: El peso de la libreria de PDF MUST NOT cargarse al visitar el
  sitio: se trae **cuando se toca el boton**. Una persona que entra a `/contacto`
  no paga por una etiqueta que no va a imprimir.
- **FR-015**: Si la etiqueta no se puede generar —la libreria no carga, el
  navegador bloquea la descarga— el boton MUST decirlo con un mensaje visible.
  **Nunca quedarse sin hacer nada**: ese sintoma ya se produjo una vez en este
  formulario y es indistinguible de un boton roto.
- **FR-016**: El nombre del archivo descargado MUST contener el codigo del
  pedido, para que dos etiquetas no se pisen en la carpeta de descargas.
- **FR-017**: El producto MUST entregar un archivo y **MUST NOT intentar
  imprimir**. Nada de abrir el dialogo de impresion del navegador, elegir
  impresora, fijar margenes ni hablar con un driver. Donde el sistema deposite el
  archivo —carpeta de descargas, visor de PDF, hoja de compartir— es asunto del
  navegador, y **las tres cosas son resultados correctos**. El unico resultado
  incorrecto es que no pase nada, que es lo que cubre FR-015.
- **FR-018**: La etiqueta MUST mostrar el nombre de la zona de entrega junto al
  bloque de entrega. El nombre, nunca un importe ni nada que parezca una tarifa.
  La zona **se resuelve del punto de entrega guardado**; cuando no hay punto —un
  pedido anterior a `011`— el bloque **se omite entero**, sin hueco y sin leyenda.
  **Nunca se deduce la zona de la direccion escrita**: eso es adivinar una zona,
  que el Principio V prohibe.
- **FR-019**: La etiqueta MUST llevar la marca como **silueta del camion en
  negro** mas el nombre **compuesto como texto del documento**. MUST NOT usar el
  logo a color tal cual: sobre papel blanco la mitad de sus elementos son blancos
  y desaparecen.
- **FR-020**: La silueta MUST ser un asset generado y versionado, producido por
  un script de `design-source/` como el resto de los assets del repo, y **MUST
  ser una silueta rellena y no un contorno**.

### Key Entities

- **Etiqueta** — la representacion imprimible de un pedido: codigo, bloque de
  entrega, bloque de retiro, fecha y cantidad. **Es una vista, no un dato**: no
  se guarda, no se versiona, y se recompone cada vez desde el pedido.
- **Pedido** — ya existe. Llega en dos formas segun la pantalla: lo que se acaba
  de tipear, o lo que el servicio devolvio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde que se confirma un pedido, la etiqueta se obtiene en un solo
  toque.
- **SC-002**: La misma etiqueta se puede volver a sacar despues de cerrar el
  navegador, sin crear un pedido nuevo.
- **SC-003**: El mismo pedido impreso desde las dos pantallas produce documentos
  con el mismo contenido.
- **SC-004**: Cero importes en el documento.
- **SC-005**: Una persona parada a un brazo de la caja lee el codigo sin
  acercarse.
- **SC-006**: Visitar el sitio sin imprimir nada no descarga la libreria de PDF.

## Assumptions

- **La etiqueta se imprime en A4**, que es lo que el cliente pidio, y se pega
  entera o doblada. No se diseña para etiquetas autoadhesivas ni para media hoja.
- **Una etiqueta por pedido, no una por bulto.** El pedido lleva la cantidad
  impresa; si hacen falta varias copias, se imprime la misma hoja varias veces.
  El cliente no pidio numeracion de bultos.
- **Quien imprime tiene impresora en algun momento.** El PDF se descarga; el
  producto no imprime nada por si mismo.
- **Los datos del destinatario van en papel a la calle.** Es un tercero que no
  acepto nada, y su nombre y telefono viajan pegados a una caja. Es inevitable
  para que el envio funcione —es la misma informacion que lleva cualquier
  paquete— y se anota para que sea una decision y no un descuido. Se imprime lo
  minimo que hace falta para entregar.
- **No cambia nada del servicio ni de la app Android.** Todo ocurre en el
  navegador con datos que la pantalla ya tiene.
