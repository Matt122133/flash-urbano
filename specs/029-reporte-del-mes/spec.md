# Feature Specification: El reporte del mes

**Feature Branch**: `029-reporte-del-mes`

**Created**: 2026-09-19

**Status**: Draft

**Input**: Mateo, el 2026-09-19: *"el reporte es para diego para pasarselo a el
cliente para a fin de mes saber cuanto cobrar, por el principio creo que si lo
mandamos sin precio seria lo mejor, si creo que seria lo correcto indicar la
direccion de fecha de entrega y que zona es, despues diego sabra que cobrar y
que no"*. Y sobre el corte: *"todos los paquetes del mes, se entregaron o no"*.

## El problema: el tablero cuenta, y para cobrar no alcanza con contar

`025` le dio a Diego un tablero que dice **cuantos**: cuantos pedidos hay
registrados, y cuantos pedidos y paquetes entraron por dia, semana o mes, con un
filtro por cuenta. Eso contesta *"¿como viene el mes?"* y lo contesta bien.

No contesta **"¿que le cobro a este cliente?"**. Para eso Diego necesita, por
cada envio, **a donde fue** —porque su lista de precios es por zona— y **cuando
fue**. Hoy eso no existe en ninguna pantalla: esta en la base, repartido entre el
pedido y su historial de estados, y la unica forma de llegar a ello es que
alguien consulte la base a mano.

El resultado es que **a fin de mes Diego arma la cuenta de memoria o revisando
WhatsApp**, que es exactamente el trabajo manual que este producto existe para
sacarle de encima.

## Lo que este reporte es, y lo que deliberadamente no es

**Es una lista de envios con su zona.** Una fila por pedido, con la direccion de
entrega, las fechas y el nombre de la zona. Diego lo abre, mira, y **aplica su
propia lista de precios afuera del producto**.

**No es una factura, no es un presupuesto y no lleva un solo importe.** El
Principio V es explicito: el unico lugar del producto donde aparece un monto es
el bloque de cobertura del formulario, para un cliente con sesion. **El tablero
no muestra importes y no lee la columna `precio`**, y la constitucion 6.1.0 dice
que un tablero que alguna vez necesite plata en pantalla es una enmienda MAJOR.

Un archivo llamado "reporte", abierto en una planilla, es **el lugar del mundo
donde mas facil se agrega una columna de total**. Aca no se agrega: no esta el
dato, no esta la columna, y hay una guarda automatica que lo impide.

**La zona no es un precio, y esa distincion es la que sostiene todo el feature.**
El nombre de la zona ya se muestra hoy en el formulario y va impreso en la
etiqueta que se pega al paquete (`020`, `028`). Lo que el producto nunca hace es
convertirla en plata. Diego si: es su negocio y su lista.

## El riesgo que este reporte crea, y que nadie habia nombrado

Lo encontro el `/speckit-analyze` del 2026-09-19 y **no es de codigo**: es de
negocio, y merece estar escrito antes de construirlo.

Desde la constitucion 6.0.0, **el monto que el sitio le muestra a un cliente
identificado es una promesa**: *"las cantidades en el modulo de zonas generado
DEBEN ser las que el cliente cobra hoy"*, y editar una es un cambio de cara al
cliente. Hasta hoy eso no tenia consecuencia practica, porque **lo que el sitio
cotiza y lo que Diego factura nunca se ponian uno al lado del otro**: el cliente
veia un numero al cargar el pedido, y a fin de mes Diego le pasaba un total
armado de memoria.

**Este reporte es la primera herramienta que los pone en la misma mesa.** Si la
lista de precios de Diego se mueve y la del modulo generado no —o al reves—, el
cliente va a poder comparar lo que el sitio le prometio con lo que la factura
dice, fila por fila y zona por zona.

**No frena el feature y no cambia ni un requisito.** El producto sigue sin
mostrar un importe y sigue sin leer `precio`; la divergencia, si aparece, es
entre dos cosas que estan afuera. Se anota aca para que el dia que pase **sea una
consecuencia conocida y no una sorpresa**, y porque la reaccion natural —"que el
reporte traiga el precio y listo"— es exactamente la enmienda MAJOR que la
constitucion 6.1.0 nombra y que habria que pagar con la columna `precio`
arreglada primero.

## Lo que cambia en la constitucion

**La constitucion describe el tablero como algo que cuenta**, textual: *"cuantos
pedidos estan registrados, cuantos pedidos y paquetes por dia, semana o mes, y
lo mismo acotado a una cuenta de cliente. **Cuenta**; nunca muestra un importe, y
no lee el `precio` guardado"*.

Un CSV con una fila por pedido, con direccion y zona, **ya no es contar: es
listar**. Eso pide una enmienda **MINOR** de los *Scope boundaries* (6.1.0 →
6.2.0):

- **No reversa ningun principio.** Sigue sin importe, sigue sin leer `precio`, y
  el Principio V queda palabra por palabra como esta.
- **Nada de lo construido queda fuera de norma.** Se agrega una capacidad, no se
  invalida codigo existente.
- **Sin ADR**, por el mismo razonamiento que 2.1.0, 5.1.0 y 6.1.0: es el dueño
  del producto ajustando el alcance de su propio brief, no revirtiendo una
  decision anterior.

**Escribirla es parte del trabajo de este feature**, no un tramite posterior. La
constitucion es el documento de mayor autoridad del repo y un plan que la
contradice no puede pasar su propio Constitution Check.

## Clarifications

### Session 2026-09-19

Ya decidido por Mateo, sobre opciones puestas por escrito:

- **CSV, no XLSX.** Lo eligio al saber que Excel abre un CSV sin problema —creia
  que no—. Cero dependencias nuevas contra una libreria de planilla de varios
  cientos de KB.
- **Sin ningun importe.** Lo propuso el, apelando al Principio V antes de que
  nadie se lo recordara.
- **El mes se corta por una fecha que siempre existe**: *"todos los paquetes del
  mes, se entregaron o no"*. Ningun pedido puede caerse del reporte por no haber
  sido marcado como entregado en la app.
- **Los pedidos dados de baja no se persiguen.** Mateo: *"con el tema de los
  eliminados no le daria mucha vuelta porque se va a saber si hay eliminados o
  no"*. Un CSV es una foto: si despues alguien da de baja un pedido, el archivo
  ya bajado no se entera. **Riesgo aceptado a proposito**, y por eso FR-014 pide
  que el archivo diga cuando se genero.
- **Primero el reporte, despues el rediseño del tablero**, que es otro feature.

### Session 2026-09-19 (segunda vuelta)

Las tres zonas grises, cerradas:

- **El reporte es siempre de UNA cuenta.** No existe un archivo con todos los
  clientes mezclados. **La razon es de privacidad y es estructural, no una
  precaucion**: el archivo se le pasa al cliente, y si el producto nunca produce
  uno mezclado, entonces no hay apuro ni error posible que le muestre a un
  cliente las direcciones de otro. Un reporte general le serviria a Diego para
  si mismo, y se descarto porque crearia justo el archivo que no hay que mandar.

  **Consecuencia que hay que fijar**: el tablero arranca sin cuenta elegida,
  mostrando todas. **Sin cuenta elegida no hay descarga** — ver FR-006.
- **El periodo se elige con un boton por fila del cuadro.** El tablero ya lista
  periodos como filas; cada una gana su descarga. No se agrega ningun control
  nuevo a una pantalla que ademas se va a rediseñar despues, y **sirve igual
  para dia y semana** si algun dia Diego los quiere, sin escribir nada mas.
- **La fila NO lleva destinatario.** Direccion, zona y fechas alcanzan para
  cobrar, que es para lo que existe el reporte. Es ademas lo que Mateo pidio
  textual —*"la direccion, fecha de entrega y que zona es"*—, y deja fuera de un
  archivo que circula por mail el nombre y el telefono de un tercero.

### Session 2026-09-19 (hook `before_plan`)

**Cero preguntas nuevas**: lo que quedaba por decidir no necesitaba a nadie
afuera, pero si quedar escrito. Tres cosas, y dos de ellas tienen consecuencia
sobre lo que Diego cobra:

- **Los metadatos van al FINAL del archivo, no arriba del encabezado** (FR-014a).
  FR-014 pide que el archivo diga cuando se genero, y FR-012 pide que la planilla
  lo abra con cada dato en su columna. La forma obvia de cumplir el primero
  —unas filas de titulo arriba— **rompe el segundo**: la planilla toma la primera
  fila como encabezado y se pierden los nombres de columna, el filtro y el orden.
- **Todas las fechas son de Montevideo, no UTC** (FR-006b). Una entrega de las
  22:00 del 30 de septiembre es el 1 de octubre en UTC: leida mal, **el envio se
  va al reporte del mes siguiente**. Es la misma trampa que `025` documento para
  contar, y es un error de facturacion, no de prolijidad.
- **Con dos marcas de entrega vale la mas reciente** (FR-006c). El historial
  admite varias filas por pedido; una segunda marca es una correccion, no un
  segundo envio, y el reporte sigue llevando una fila por pedido.

### Session 2026-09-19 (despues de probarlo)

Mateo ejercito el feature contra la base de desarrollo —16 pedidos, dos cuentas,
cinco sin punto de entrega y trece sin marca de entrega— abrio los archivos en
Excel y valido los seis puntos de la prueba manual. **Un cambio:**

- **El reporte por dia se saca** (FR-005a). Textual: *"sacaria la opcion del
  reporte por dia. me parece mucha info para algo que capaz no se va a usar"*.
  El reporte se le pasa a un cliente a fin de mes; **un archivo por dia son
  treinta archivos para armar una cuenta**, y ninguno de los treinta contesta la
  pregunta que se esta haciendo.

  **Se saca la DESCARGA, no el corte.** El cuadro sigue mostrando el conteo por
  dia: eso es de `025`, contesta "como viene la semana", y Mateo no lo toco. La
  distincion esta escrita aca porque el paso siguiente natural —"si no se baja
  por dia, saquemos el dia"— seria extender lo que dijo un paso mas de lo que
  dijo, que es lo que este repo ya pago cuatro veces.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diego arma la cuenta del mes (Priority: P1)

Fin de mes. Diego entra al tablero, elige la cuenta de un cliente, se baja el
reporte del mes y lo abre en la planilla. Ve una fila por envio con la direccion
de entrega y la zona. Agrupa por zona, multiplica por su lista de precios, y en
diez minutos tiene lo que antes sacaba de memoria.

**Why this priority**: es el feature entero. Sin esto no hay nada.

**Independent Test**: bajar el reporte de un mes con pedidos, abrirlo en una
planilla y comprobar que estan todos los envios de ese mes con su zona.

**Acceptance Scenarios**:

1. **Given** una cuenta con pedidos en un mes, **When** Diego baja el reporte de
   ese mes, **Then** el archivo tiene una fila por pedido de esa cuenta en ese
   mes, y ninguna de otro mes ni de otra cuenta.
2. **Given** ese archivo, **When** se abre de doble clic en una planilla,
   **Then** cada dato cae en su propia columna y las tildes y la ñ se ven bien.
3. **Given** un pedido con punto de entrega, **When** se mira su fila,
   **Then** la zona es la misma que el producto le asigno a ese punto en el
   formulario y en la etiqueta impresa.

---

### User Story 2 - Ningun envio se cae del reporte (Priority: P1)

Diego se olvido de marcar como entregados diez pedidos en la app durante el mes.
El reporte los lista igual, con la columna de fecha de entrega vacia.

**Why this priority**: **es P1 porque es plata.** La unica fecha de entrega que
existe se graba cuando Diego marca el pedido en la app; si el reporte se cortara
por esa fecha, cada olvido suyo seria un envio que factura de menos y **nada se
lo avisaria**. Un reporte de cobranza que omite filas en silencio es peor que no
tener reporte.

**Independent Test**: dejar pedidos sin marcar como entregados y comprobar que
aparecen igual.

**Acceptance Scenarios**:

1. **Given** un pedido del mes que nunca se marco como entregado, **When** se
   baja el reporte de ese mes, **Then** el pedido aparece, con la celda de fecha
   de entrega **vacia**.
2. **Given** un pedido del mes entregado y marcado, **When** se mira su fila,
   **Then** la fecha de entrega es la del momento en que se marco.

---

### User Story 3 - El archivo no dice nada de plata (Priority: P1)

Cualquiera que abra el archivo —Diego, el cliente al que se lo pasa, quien sea—
no encuentra un importe, ni un total, ni una columna vacia que sugiera que
deberia haber uno.

**Why this priority**: P1 y no una nota al pie. Es el Principio V, y un archivo
de planilla es donde un total aparece solo.

**Independent Test**: abrir el archivo y buscar cualquier cosa que hable de
dinero.

**Acceptance Scenarios**:

1. **Given** un reporte de cualquier mes, **When** se revisa entero,
   **Then** no hay ningun importe, ninguna columna de precio, ningun total y
   ningun encabezado que nombre dinero.

---

### Edge Cases

- **Un pedido sin punto de entrega** (anterior a `011`): no tiene zona, y la
  celda va **vacia**. **Vacio no significa "no se cobra"**, y el reporte tiene
  que permitir distinguirlo de un error. Es el caso que mas facil se lee mal.
- **Un mes sin pedidos**: no se baja un archivo con solo encabezados sin avisar;
  la pantalla dice que no hay nada que bajar.
- **Direcciones con coma**: *"Rivera 1234, apto 2"* parte una fila en dos si el
  archivo no cita bien los campos. Es el defecto clasico de un CSV y se ve recien
  al abrirlo.
- **Tildes y ñ**: las calles de Montevideo estan llenas de las dos. Un archivo
  mal codificado muestra "Piñeyro" como "PiÃ±eyro", y el defecto es invisible
  hasta que alguien abre el archivo en una planilla y no en un editor.
- **El separador de la planilla**: una planilla configurada en español espera
  `;` y con `,` abre **todo en una sola columna**. El archivo es "correcto" y
  sirve para nada.
- **Un archivo ya bajado envejece**: si despues se da de baja un pedido, el CSV
  guardado sigue mostrandolo. Riesgo aceptado (ver *Clarifications*), acotado por
  FR-014.
- **Una entrega de la noche del ultimo dia del mes**: el caso que mueve un envio
  de un reporte a otro si las fechas se leen en UTC. Ver FR-006b.
- **Un pedido marcado como entregado dos veces**: el historial admite varias
  filas; el reporte toma la ultima y sigue siendo una fila por pedido.
- **Datos de un tercero en un archivo que circula**: la direccion de entrega es
  de alguien que no acepto nada. Ver *Assumptions*.

## Requirements *(mandatory)*

### Functional Requirements

**El reporte**

- **FR-001**: Desde el tablero, un administrador MUST poder descargar un archivo
  con los pedidos de un periodo.
- **FR-002**: El archivo MUST tener **una fila por pedido**, no por paquete: la
  cantidad de paquetes va como dato de la fila.
- **FR-003**: El periodo MUST cortarse por una fecha que **existe siempre para
  todo pedido**, de modo que ningun pedido pueda quedar afuera por no haber sido
  marcado en la app.
- **FR-004**: El archivo MUST tener exactamente estas seis columnas, en este
  orden: **codigo del pedido**, **fecha de retiro**, **fecha de entrega** (vacia
  si no se marco), **direccion de entrega** compuesta, **nombre de la zona** de
  entrega y **cantidad de paquetes**.
- **FR-004a**: El archivo MUST NOT incluir el **nombre ni el telefono del
  destinatario**. No hacen falta para cobrar, y el archivo circula por mail.
- **FR-005**: Cada fila de periodo del cuadro del tablero MUST ofrecer la
  descarga de **ese** periodo. No se agrega ningun selector de periodo aparte.
- **FR-005a**: La descarga MUST ofrecerse **por semana y por mes, y NO por
  dia**. Con el corte en dia no hay boton, y la pantalla MUST decir por que —si
  no, la desaparicion se lee como un defecto.

  **El corte por dia del cuadro NO se saca**: sigue contando, que es para lo que
  `025` lo puso. Lo unico que se saca es la descarga sobre esas filas.
- **FR-006**: El archivo MUST contener los pedidos de **una sola cuenta de
  cliente**. El producto **MUST NOT** producir, por ningun camino, un archivo que
  mezcle pedidos de cuentas distintas.
- **FR-006a**: Con el tablero mostrando **todas** las cuentas, la descarga
  **MUST NOT** estar disponible, y la pantalla MUST decir que hay que elegir una
  cuenta. Un boton que baja un archivo distinto del que la pantalla sugiere es
  peor que un boton ausente.
- **FR-006b**: Todas las fechas del archivo —la del periodo, la de retiro, la de
  entrega y la de generacion— MUST ser **fechas de calendario de Montevideo**,
  nunca UTC ni la zona del navegador de quien mire.

  **Esto es plata, no prolijidad.** La fecha de entrega sale de un instante
  guardado en UTC: una entrega de las 22:00 del 30 de septiembre en Montevideo
  es el 1 de octubre en UTC, y leida mal **se va al reporte del mes siguiente**.
  Es la misma trampa que `025` ya documento para contar, y hay que resolverla
  con la misma zona escrita y no con un desplazamiento fijo: Uruguay no tiene
  horario de verano desde 2015, pero si vuelve, un `-03:00` a mano se equivoca
  una hora durante meses sin que nada falle.
- **FR-006c**: Si un pedido tiene **mas de una** marca de entrega en su
  historial, el archivo MUST usar **la mas reciente**, y hacerlo siempre igual.
  Una segunda marca es una correccion de la primera, no un segundo envio, y el
  reporte igual lleva **una fila por pedido** (FR-002).
- **FR-007**: La zona MUST resolverse **del punto de entrega guardado**, con la
  misma resolucion que ya usan el formulario y la etiqueta impresa. MUST NOT
  deducirse de la direccion escrita: eso es adivinar una zona, que el Principio
  V prohibe. Sin punto no hay zona, y la celda va vacia.
- **FR-008**: Las direcciones MUST componerse con la misma funcion que usan la
  pantalla y la etiqueta, para que los tres no puedan divergir.

**La plata, que no esta**

- **FR-009**: El archivo MUST NOT contener ningun importe, ninguna columna de
  precio, ningun total, ni ningun encabezado que nombre dinero. **Principio V.**
- **FR-010**: La generacion del reporte MUST NOT leer la columna `precio`
  guardada, ni directa ni indirectamente.
- **FR-011**: Una guarda automatica MUST impedir que un modulo del reporte
  nombre la plata, del mismo modo que ya protege al tablero. La guarda que
  escanea las pantallas **deja `lib/` afuera a proposito** —ahi el precio tiene
  que seguir viviendo—, asi que un modulo nuevo nace sin proteccion.

**Que el archivo se abra bien**

- **FR-012**: El archivo MUST abrirse de doble clic en una planilla con **cada
  dato en su columna**, sin que la persona tenga que elegir un separador ni
  correr un asistente de importacion.
- **FR-013**: El archivo MUST mostrar correctamente tildes, ñ y diereses al
  abrirse en una planilla.
- **FR-014**: El archivo MUST decir **cuando se genero** y **a que periodo y
  cuenta corresponde**, adentro del archivo y no solo en su nombre: un CSV
  guardado en una carpeta pierde el contexto, y este es un documento con el que
  alguien va a cobrar.
- **FR-014a**: Esos datos MUST ir **al final del archivo**, despues de las filas
  de pedidos y separados por un renglon en blanco. **MUST NOT ir arriba del
  encabezado.** Puestos arriba, la planilla toma la primera fila de metadatos
  como encabezado y rompe FR-012: se pierden los nombres de columna, el filtro y
  el orden. El renglon en blanco ademas deja los metadatos fuera de la region
  contigua, asi que ordenar los datos no se los lleva puestos.
- **FR-015**: El nombre del archivo MUST identificar el periodo y la cuenta, para
  que dos descargas no se pisen en la carpeta.
- **FR-016**: Un texto que contenga el separador, comillas o un salto de linea
  MUST quedar citado de modo que la fila no se parta.

**Lo que no cambia**

- **FR-017**: La pantalla de conteos MUST seguir funcionando igual, y traer lo
  que el reporte necesita **MUST NOT encarecerla**: hoy trae una fila minima por
  pedido para contar, y cargar cada visita con todas las direcciones de entrega
  seria pagar por algo que casi nunca se usa.
- **FR-018**: El reporte MUST ser solo para administradores, con el mismo control
  que ya protege al tablero. Una cuenta que no lo es no ve el boton ni puede
  obtener el archivo.
- **FR-019**: Si el reporte no se puede generar, la pantalla MUST decirlo con un
  mensaje visible. **Nunca bajar un archivo vacio ni quedarse sin hacer nada.**
- **FR-020**: Un mes sin pedidos MUST decirse en pantalla, en vez de descargar un
  archivo con solo encabezados.

**La constitucion**

- **FR-021**: La constitucion MUST amendarse a 6.2.0 (MINOR) para que los *Scope
  boundaries* digan que el tablero **cuenta y lista**, con la historia de la
  enmienda. **Sin ADR**: no reversa ninguna decision anterior.
- **FR-021a**: Esa entrada de historial MUST dejar anotado el riesgo de la
  seccion *El riesgo que este reporte crea*: que la lista de precios de Diego y
  los montos del modulo generado pueden separarse, y que **la salida facil —poner
  el precio en el reporte— es una enmienda MAJOR**, no un ajuste. Es el lugar
  donde alguien lo va a leer dentro de un año.

### Key Entities

- **Reporte** — la lista de envios de un periodo, resuelta: una fila por pedido
  con sus fechas, su direccion de entrega, su zona y su cantidad. **Es una vista,
  no un dato**: no se guarda, no se versiona, y se recompone cada vez.
- **Pedido** — ya existe. Aporta codigo, fecha de retiro, direccion y punto de
  entrega, cantidad y la cuenta que lo creo.
- **Historial de estados** — ya existe, y **hasta hoy no se leia desde ningun
  lado**: la migracion que lo creo dice textual que se escribe y se guarda. De
  ahi sale la fecha de entrega, cuando existe. **Es un camino de lectura nuevo**
  y se anota como tal; a diferencia de `precio`, registra un hecho real y no un
  valor de relleno.
- **Cuenta de cliente** — ya existe. Es por quien se filtra y a quien se le pasa
  el archivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diego obtiene el reporte de un mes en un solo toque desde el
  tablero.
- **SC-002**: El archivo se abre de doble clic en una planilla con cada dato en
  su columna, sin asistente de importacion.
- **SC-003**: Las tildes y la ñ se ven correctamente en la planilla.
- **SC-004**: Todos los pedidos del periodo aparecen, **incluidos los que nunca
  se marcaron como entregados**.
- **SC-005**: La zona de cada fila coincide con la que el producto le asigna al
  mismo punto en el formulario y en la etiqueta impresa.
- **SC-006**: Cero importes en el archivo.
- **SC-007**: Una direccion con comas, comillas o acentos no parte ni corre
  ninguna columna.
- **SC-008**: El archivo dice cuando se genero y a que periodo y cuenta
  corresponde.
- **SC-009**: Una cuenta que no es administradora no obtiene el archivo por
  ningun camino.
- **SC-009a**: Ningun archivo generado contiene pedidos de mas de una cuenta.
- **SC-009b**: Con todas las cuentas a la vista, no hay boton de descarga, y la
  pantalla dice por que.
- **SC-009c**: Con el corte en dia no hay boton de descarga, y la pantalla dice
  por que. El cuadro sigue contando por dia.
- **SC-010**: Abrir el tablero sin bajar ningun reporte no trae mas datos de los
  que ya traia.
- **SC-011**: Un pedido entregado a las 22:00 del ultimo dia de un mes aparece en
  el reporte de **ese** mes, y no en el del siguiente.
- **SC-012**: Los datos de generacion estan en el archivo **sin** costarle a la
  planilla el encabezado: la fila 1 sigue siendo la de nombres de columna.

## Assumptions

- **Diego tiene su lista de precios por zona y hace la cuenta el.** El producto
  no la conoce, no la aplica y no la va a aplicar: esa es la linea que separa
  este feature de una enmienda MAJOR.
- **El reporte se abre en Excel o equivalente**, en una maquina configurada en
  español. Es lo que hay en Montevideo y es lo que decide el separador.
- **La direccion de entrega es de un tercero que no acepto nada**, y viaja en un
  archivo que Diego le pasa a su cliente. Es la misma informacion que ese cliente
  ya le dio al cargar el pedido, y la misma que va impresa en la etiqueta
  (`020`), asi que no se le esta mostrando nada nuevo **sobre sus propios
  envios**. Lo que el feature tiene que impedir es que vea los de **otro**
  cliente — ver FR-006.
- **Nada de esto toca la app Android ni el formulario de pedido.**
- **El volumen es chico**: un operador, decenas de pedidos por mes. No hay que
  paginar ni transmitir el archivo por partes.
- **Las pruebas no llevan datos reales.** Este repo es publico: nombres,
  direcciones y correos de los casos de prueba son inventados.
