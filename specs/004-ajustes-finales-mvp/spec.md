# Feature Specification: Ajustes finales del MVP

**Feature Branch**: `ajustes-finales-mvp`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Los cuatro puntos sin tachar de la sección MODIFICACIONES del doc de
relevamiento del cliente, más dos datos que el mismo doc ya responde y que
estaban bloqueando trabajo registrado en `docs/tech-debt-tracker.md`: el teléfono
de WhatsApp real y qué zona paga una dirección que cae sobre un límite de zona.

Los dos primeros ítems de MODIFICACIONES ya están hechos y tachados por el
cliente (el título del home ya dice "Enviá y recibí", el email real ya está en
`/contacto`), así que no forman parte de este feature.

## Clarifications

### Session 2026-08-06

- Q: ¿El aviso de 24 horas es una frase fija o un momento calculado a partir del
  retiro? → A: Frase fija. Diego pidió un aviso, no una fecha de entrega;
  calcular un momento concreto reintroduce el compromiso con horario que este
  feature justamente elimina, y le pone minutero a una promesa que se cumple a
  mano.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El formulario pide menos cosas (Priority: P1)

Quien carga un pedido hoy tiene que elegir si es particular o empresa y elegir
una forma de pago antes de poder confirmar. Ninguno de los dos datos le sirve a
la empresa: el tipo de cliente no cambia nada de lo que pasa después, y las
formas de pago que muestra el sitio (Efectivo, Transferencia) nunca fueron
confirmadas por el cliente — eran un placeholder. Ambos campos se quitan, y con
ellos su validación obligatoria y su fila en el resumen de confirmación.

Se quita también la opción de **describir el paquete con texto libre**. El
formulario ofrece hoy dos modos —"Tamaño predefinido" y "Describir el paquete"—
y el segundo no debería existir: en el relevamiento original el cliente ya había
marcado la descripción como **no necesaria**, y se implementó igual en `001`.
Queda el tamaño (chico, mediano, grande) como única forma de declarar qué se
envía. Confirmado de nuevo por el cliente el 2026-08-06.

**Why this priority**: El formulario de pedido es la superficie de mayor
prioridad del producto (Principio II de la constitución) y cada campo que no
tiene un uso real es fricción pura en un flujo que se completa desde el
teléfono. Además, una forma de pago inventada es una promesa que el negocio no
hizo.

**Independent Test**: Se carga un pedido completo de punta a punta sin ver ni
tocar en ningún momento el selector particular/empresa ni el de forma de pago, y
la confirmación no los menciona.

**Acceptance Scenarios**:

1. **Given** alguien abre el formulario de pedido, **When** mira la sección
   "¿Quién envía?", **Then** ve solamente nombre y teléfono, sin ninguna
   elección entre particular y empresa.
2. **Given** alguien completa todos los campos que quedan, **When** confirma el
   pedido, **Then** el pedido se acepta sin haber elegido forma de pago.
3. **Given** un pedido confirmado, **When** se lee el resumen, **Then** no
   aparece ni el tipo de cliente ni la forma de pago.
4. **Given** alguien llega a la sección "¿Qué envías?", **When** la mira,
   **Then** encuentra la elección de tamaño directamente, sin ningún paso previo
   de elegir entre tamaño y descripción, y sin campo de texto libre.
5. **Given** alguien no elige tamaño, **When** intenta confirmar, **Then** el
   sitio se lo pide con un mensaje visible junto al campo.

---

### User Story 2 - La entrega se promete, no se agenda (Priority: P1)

Hoy quien pide tiene que elegir fecha y hora de entrega, y el sitio le exige un
margen mínimo respecto del retiro. El cliente decidió reemplazar eso por un
compromiso fijo: el paquete se entrega dentro de las 24 horas contadas desde el
retiro. Se quitan la fecha y la hora de entrega; se mantienen la fecha y la hora
de retiro, porque son las que le dicen a la empresa cuándo pasar a buscar el
paquete. En su lugar el formulario muestra el compromiso de 24 horas, y el
resumen de confirmación lo repite.

**Why this priority**: Es un cambio de la promesa comercial, no solo de la
interfaz: hoy el sitio deja que la persona agende una entrega que la empresa
nunca se comprometió a cumplir. Además elimina dos campos y una regla de
validación cruzada de un formulario que se llena desde el teléfono.

**Independent Test**: Se carga un pedido eligiendo únicamente fecha y hora de
retiro; el formulario muestra en algún lugar visible que la entrega ocurre
dentro de las 24 horas, y la confirmación lo dice también.

**Acceptance Scenarios**:

1. **Given** alguien llega a la sección de fechas, **When** la mira, **Then**
   encuentra solamente fecha y hora de retiro, y un aviso de que el paquete se
   entrega dentro de las 24 horas del retiro.
2. **Given** alguien elige una fecha de retiro anterior a hoy, **When** sale del
   campo o intenta confirmar, **Then** el sitio le avisa que esa fecha ya pasó y
   no acepta el pedido.
3. **Given** alguien elige una fecha de retiro de hoy o posterior, **When**
   confirma, **Then** el pedido se acepta sin que se le pida ningún dato de
   entrega.
4. **Given** un pedido confirmado, **When** se lee el resumen, **Then** figura
   el retiro elegido y el compromiso de entrega en 24 horas, y ninguna fecha ni
   hora de entrega.
5. **Given** dos pedidos con fechas de retiro distintas, **When** se comparan
   sus confirmaciones, **Then** el texto del compromiso de 24 horas es idéntico
   en ambas: no se muestra ningún momento de entrega calculado.

---

### User Story 3 - Se puede llamar a quien recibe (Priority: P2)

Hoy el formulario pide el nombre y la cédula de quien recibe el paquete. Esos
datos sirven para identificar a la persona **en el momento de la entrega**, que
es algo que va a ocurrir en la app de administración, no en la web al momento de
pedir. Lo que sí hace falta al pedir es un teléfono para poder coordinar la
entrega con el destinatario. Se quitan nombre y cédula, y se pide teléfono, con
la misma exigencia de formato que el teléfono de quien envía.

**Why this priority**: Corrige qué dato se captura y cuándo. Pedir una cédula
para un envío es además un dato sensible que hoy se recolecta sin usarlo para
nada.

**Independent Test**: Se carga un pedido donde el único dato de quien recibe es
un teléfono; el formulario rechaza un teléfono con menos de 8 dígitos y acepta
uno válido.

**Acceptance Scenarios**:

1. **Given** alguien llega a la sección "¿Quién recibe el paquete?", **When** la
   mira, **Then** encuentra un solo campo: el teléfono del destinatario.
2. **Given** alguien deja vacío el teléfono del destinatario, **When** intenta
   confirmar, **Then** el sitio le muestra un mensaje visible pidiéndole el dato
   y no acepta el pedido.
3. **Given** alguien escribe un teléfono de menos de 8 dígitos, **When** intenta
   confirmar, **Then** el sitio le avisa que el teléfono no es válido.
4. **Given** un pedido confirmado, **When** se lee el resumen, **Then** figura el
   teléfono de quien recibe y no figura ni nombre ni cédula.

---

### User Story 4 - El contacto lleva al WhatsApp real (Priority: P2)

La página de contacto ofrece hoy un botón de WhatsApp que apunta a un número
ficticio. El cliente dio los números reales del negocio, y eligió publicar uno
solo: `092 171 791`. Tocarlo abre la conversación directamente, sin pasos
intermedios. Como el número deja de ser ficticio, también se levanta la
instrucción que le pide a los buscadores no indexar el sitio, que existía
justamente para que nadie escribiera a un número ajeno.

**Why this priority**: Mientras el número siga siendo ficticio, cualquier
persona que llegue al sitio y toque WhatsApp le escribe a un desconocido. Es un
daño a un tercero, y es la única cosa que mantiene el sitio invisible para los
buscadores.

**Independent Test**: Se abre `/contacto`, se toca WhatsApp, y se llega
directamente a una conversación con `092 171 791`. Ninguna página del sitio pide
a los buscadores que no la indexen.

**Acceptance Scenarios**:

1. **Given** alguien abre la página de contacto, **When** la mira, **Then** ve
   el número de WhatsApp del negocio legible como texto.
2. **Given** alguien toca el botón de WhatsApp, **When** se abre la aplicación,
   **Then** ya está en la conversación con ese número, con un mensaje inicial
   sugerido, sin ningún paso de por medio.
3. **Given** un buscador rastrea cualquier página del sitio, **When** lee sus
   metadatos, **Then** no encuentra ninguna instrucción de no indexar.

---

### User Story 5 - En un límite de zona se cobra lo más barato (Priority: P3)

Los límites de zona los definió el cliente por nombre de avenida, así que hay
avenidas que son borde entre dos zonas y tienen cientos de esquinas encima.
Cuando el punto de retiro cae exactamente sobre uno de esos bordes, dos zonas lo
contienen. El cliente respondió cuál manda: **la de menor costo**. Esa respuesta
tiene que quedar escrita como la regla que es, y verificada, en lugar de
depender del orden en que están listadas las zonas.

**Why this priority**: Hoy el resultado ya coincide con la respuesta del cliente,
pero por casualidad: las zonas están listadas en un orden cuyos precios resultan
crecientes. Si el cliente cambia el precio de una zona y rompe esa coincidencia,
el sitio empieza a cobrar de más en una franja entera de direcciones reales y
nada lo detecta. No es un error activo; es una red que falta.

**Independent Test**: Se comprueba que un punto contenido por dos zonas devuelve
siempre la de menor precio, incluso si la de menor precio no es la primera de la
lista.

**Acceptance Scenarios**:

1. **Given** un punto que cae sobre un borde compartido por dos zonas, **When**
   el sitio calcula el precio, **Then** muestra el precio de la zona más barata
   de las dos.
2. **Given** un punto contenido por dos zonas donde la más barata está listada
   después de la más cara, **When** el sitio calcula el precio, **Then** sigue
   mostrando el de la más barata.
3. **Given** un punto contenido por una sola zona, **When** el sitio calcula el
   precio, **Then** muestra el de esa zona.
4. **Given** un punto fuera de las cinco zonas, **When** el sitio lo evalúa,
   **Then** no muestra precio y deriva a contacto directo, como hasta ahora.

---

### Edge Cases

- **Dos zonas empatadas en precio contienen el punto.** Hoy hay dos zonas a $250.
  La regla del cliente ("la de menor costo") no distingue entre ellas. El
  resultado tiene que ser estable — siempre la misma — porque el precio que ve
  la persona no puede cambiar entre dos cargas idénticas.
- **La persona ya había cargado fechas de entrega antes del cambio.** No hay
  persistencia: no hay pedidos guardados ni borradores, así que no hay
  migración que hacer.
- **Fecha de retiro dejada vacía.** Sigue siendo obligatoria y sigue bloqueando
  el envío, igual que hoy.
- **El destinatario y el remitente son la misma persona.** El teléfono del
  destinatario puede coincidir con el de quien envía; eso es válido y no se
  advierte.
- **El WhatsApp publicado no contesta.** El sitio no puede saberlo. El email ya
  existe como segunda vía y se mantiene. El segundo número que el cliente tiene
  (`091 060 320`) queda deliberadamente sin publicar: elegir entre dos números
  es una decisión que a quien escribe le da lo mismo, y un enlace directo tiene
  que apuntar a uno solo.
- **El sitio pasa a ser indexable.** Es un cambio de una sola dirección en la
  práctica: una vez indexado, revertirlo no lo saca de los buscadores de
  inmediato. Se hace recién con los números reales puestos.

## Requirements *(mandatory)*

### Functional Requirements

**Formulario de pedido**

- **FR-001**: El formulario de pedido MUST NOT ofrecer ninguna elección entre
  cliente particular y empresa, ni en la carga ni en el resumen de confirmación.
- **FR-002**: El formulario de pedido MUST NOT pedir forma de pago, ni mostrarla
  en el resumen de confirmación.
- **FR-003**: El envío del formulario MUST NOT quedar bloqueado por la ausencia
  de tipo de cliente ni de forma de pago.
- **FR-003a**: El formulario MUST NOT ofrecer describir el paquete con texto
  libre, ni elegir entre "tamaño predefinido" y "describir el paquete". El
  paquete se declara **solamente** eligiendo uno de los tres tamaños, que MUST
  seguir siendo obligatorio. El resumen de confirmación MUST mostrar el tamaño.
- **FR-004**: El formulario MUST NOT pedir fecha ni hora de entrega.
- **FR-005**: El formulario MUST seguir pidiendo fecha y hora de retiro, y MUST
  seguir tratándolas como obligatorias.
- **FR-006**: El formulario MUST rechazar una fecha de retiro anterior al día de
  hoy, con un mensaje visible junto al campo.
- **FR-007**: El sistema MUST NOT aplicar ninguna otra regla de coherencia entre
  fechas, porque ya no hay dos momentos que comparar.
- **FR-008**: El formulario MUST mostrar, en la sección de fechas, que el
  paquete se entrega dentro de las 24 horas contadas desde el retiro.
- **FR-009**: El resumen de confirmación MUST mostrar el compromiso de entrega
  en 24 horas y MUST NOT mostrar fecha ni hora de entrega.
- **FR-009a**: El compromiso de 24 horas MUST ser un texto fijo, igual para todo
  pedido. El sistema MUST NOT calcular ni mostrar un momento de entrega
  derivado del retiro, en ninguna de las dos pantallas.
- **FR-010**: El encabezado de la sección de fechas MUST dejar de mencionar la
  forma de pago.

**Quien recibe el paquete**

- **FR-011**: El formulario MUST NOT pedir el nombre ni la cédula de quien
  recibe el paquete.
- **FR-012**: El formulario MUST pedir el teléfono de quien recibe el paquete, y
  MUST tratarlo como obligatorio.
- **FR-013**: El teléfono del destinatario MUST validarse con el mismo criterio
  que el de quien envía: al menos 8 dígitos.
- **FR-014**: Cuando el teléfono del destinatario falte o sea inválido, el
  sistema MUST mostrar el mensaje de error correspondiente junto al campo. (Hoy
  el error del nombre de quien recibe se calcula pero nunca se muestra por una
  discrepancia en el nombre de la clave; el campo nuevo no puede repetirlo.)
- **FR-015**: El resumen de confirmación MUST mostrar el teléfono de quien
  recibe.

**Contacto**

- **FR-016**: La página de contacto MUST ofrecer el número de WhatsApp del
  negocio, `092 171 791`, y MUST mostrarlo legible como texto.
- **FR-017**: Tocar el WhatsApp MUST abrir la conversación con ese número
  directamente, con un mensaje inicial sugerido y sin ningún paso intermedio de
  elección.
- **FR-018**: El sitio MUST NOT seguir pidiendo a los buscadores que no lo
  indexen.
- **FR-019**: El número de WhatsApp MUST seguir teniendo un único lugar de
  definición en el sitio; ninguna otra página lo duplica.

**Precio en los límites de zona**

- **FR-020**: Cuando un punto de retiro esté contenido por más de una zona, el
  sistema MUST devolver la zona de menor precio.
- **FR-021**: La elección de zona MUST ser independiente del orden en que las
  zonas estén listadas.
- **FR-022**: Cuando dos zonas que contienen el punto tengan el mismo precio, el
  resultado MUST ser siempre el mismo para el mismo punto.
- **FR-023**: El sistema MUST seguir sin devolver zona alguna para un punto que
  no caiga dentro de ninguna, y MUST seguir sin ofrecer la zona más cercana.
- **FR-024**: La regla "sobre un límite se paga la zona más barata" MUST estar
  cubierta por una verificación automática que falle si un cambio futuro de
  precios la rompe.

### Key Entities

- **Pedido**: lo que la persona carga. Después de este feature: quien envía
  (nombre, teléfono), dirección de retiro (con su punto, su zona y su precio),
  dirección de entrega, paquete (tamaño o descripción, cantidad), momento de
  retiro (fecha y hora) y teléfono de quien recibe. Deja de tener tipo de
  cliente, forma de pago, momento de entrega, y nombre y cédula de quien recibe.
- **Zona**: una de las cinco áreas de cobertura definidas por el cliente, con un
  precio. Sin cambios en el dato; cambia la regla que elige entre dos zonas que
  contienen el mismo punto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los campos obligatorios que la persona tiene que completar pasan
  de 16 a 12. Se van cinco — forma de pago, fecha de entrega, hora de entrega,
  nombre de quien recibe y cédula de quien recibe — y entra uno, el teléfono del
  destinatario. Además desaparecen dos selectores que no contaban entre los 16
  porque venían con una opción ya elegida: particular/empresa y el modo de
  declarar el paquete (tamaño o descripción). El tamaño sigue contando como un
  campo obligatorio, igual que antes contaba "tamaño o descripción", así que el
  total no cambia por eso. No se cuenta la cantidad de paquetes, que viene con 1
  puesto.
- **SC-002**: Cualquier persona que abra el sitio y toque WhatsApp llega a un
  número del negocio; ninguna ruta lleva a un número que no le pertenece.
- **SC-003**: Un punto sobre un límite de zona devuelve el precio más bajo de
  las zonas que lo contienen en el 100% de los casos, verificado
  automáticamente, incluso con un orden de precios distinto del actual.
- **SC-004**: Todos los mensajes de error del formulario se muestran junto a su
  campo cuando la validación falla: ninguna regla de validación bloquea el envío
  sin decir por qué.
- **SC-005**: El sitio queda disponible para los buscadores, sin ninguna página
  que pida lo contrario.
- **SC-006**: La suite de verificación del proyecto queda en verde.

## Assumptions

Los tres primeros puntos **no son supuestos**: están confirmados por el cliente y
se dejan escritos acá porque no surgen del código.

- **Las 24 horas se cuentan desde el retiro.** Confirmado por el cliente de
  viva voz, en los mismos términos en que lo escribió en el doc.
- **Se publica un solo WhatsApp: `092 171 791`.** El cliente tiene dos números y
  decidió publicar ese. El motivo de publicar uno y no los dos es que el enlace
  lleve directo a la conversación: con dos, o el sitio elige igual, o le traslada
  a quien escribe una decisión que le es indiferente.
- **La identificación de quien recibe (nombre y cédula) se captura en la app
  Android, en el momento de la entrega**, donde el administrador registra a quién
  le dejó el paquete. Por eso sale de la web: al pedir todavía no se sabe.
- **No hay persistencia ni pedidos guardados**, así que quitar campos no
  requiere ninguna migración de datos ni compatibilidad hacia atrás.
- **El compromiso de 24 horas es una promesa comercial del cliente**, no una
  restricción que el sitio pueda verificar ni hacer cumplir. El sitio solo la
  comunica.
- **El resto del flujo de dirección y precio no se toca**: el punto de retiro
  sigue saliendo del cruce de calles, sigue restringido a la cuadra declarada, y
  el precio sigue dependiendo solo del retiro.
- **Quitar el `noindex` es parte de este feature** porque su única razón de ser
  era el número ficticio, y ese motivo desaparece acá. Los métodos de pago —
  el otro dato que el cliente tenía pendiente — dejan de estar pendientes
  porque el campo se elimina.

## Out of Scope

- Backend, persistencia de pedidos, usuarios o login.
- La app Android de administración.
- La sección Reseñas.
- Los dos ítems ya tachados de MODIFICACIONES (título del home, email en
  contacto), que ya están hechos.
- Los precios y los límites de las zonas en sí: este feature cambia la regla de
  desempate, no el dato.
