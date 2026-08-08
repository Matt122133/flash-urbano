# Feature Specification: El backend existe y sabe quién pide

**Feature Branch**: `backend-auth`

**Created**: 2026-08-08

**Status**: Draft

**Input**: Primer corte del backend. Pone en efecto por primera vez el
[ADR backend-persistence-stack](../../docs/decisions/backend-persistence-stack.md),
que hasta hoy estaba aceptado como dirección y explícitamente no vigente.

Lo dispara una respuesta del cliente del 2026-08-08 (pregunta 1 de
[`docs/preguntas-cliente.md`](../../docs/preguntas-cliente.md)): cotizar queda
abierto a cualquiera, pero **crear un pedido exige estar identificado**, con
cuenta de Google o con un registro en el sistema propio. No hay pedido anónimo
y Diego no aprueba a nadie a mano.

Este feature construye la identidad y el servicio que la sostiene. **No guarda
pedidos.** Eso es `007`, y la vista con la que Diego los lee es `008`.

## Por qué esto va primero

El orden natural parecería ser al revés: el agujero abierto del producto es que
**el formulario no le llega a nadie**, y eso lo cierra `007`. Va segundo igual,
por dos razones.

La primera es del cliente: hacer `007` antes significaría desplegar la creación
de pedidos sin identidad, que es exactamente lo que Diego acaba de vetar.

La segunda es del ADR, que nombra el **auth cross-origin** como la parte más
probable de quemar un día entero, y pide diseñarla por adelantado en vez de
descubrirla. El sitio vive en `github.io` y el API va a vivir en Railway: son
orígenes distintos. El modo de falla predecible —y el que este feature tiene
que demostrar que no ocurre— es que el login ande en Chrome de escritorio y
falle en el teléfono de Diego.

## Conflicto con la constitución, señalado y no resuelto acá

La constitución (v2.2.0, *Scope boundaries*) todavía describe la web como
"**guest** or Google-login order creation". La respuesta del cliente elimina el
pedido como invitado. **Este spec no enmienda la constitución**: la enmienda es
decisión del dueño del repo, y el ADR ya había marcado el mismo conflicto sin
resolverlo. Hasta que se enmiende, este feature está construyendo contra una
línea vigente del documento de mayor autoridad del repo, y eso tiene que estar
a la vista de quien lo lea.

Nada del alcance de `006` depende de cómo se resuelva: acá se construye la
identidad, no la compuerta del formulario. El conflicto se vuelve bloqueante
recién en `007`.

## Clarifications

### Session 2026-08-08

- Q: ¿Este feature le pone la puerta al formulario de pedido? → A: **No. El
  formulario no se toca en `006`.** La identidad se ve en la navegación y en una
  pantalla de perfil; la puerta la pone `007`, junto con el pedido que sí se
  guarda. Exigir identificarse en `006` obligaría a registrarse para llegar a
  una pantalla que no hace nada, en un sitio que es público e indexable desde
  `004`. Descartado también precargar el formulario acá: es alcance declarado de
  `007` y moverlo desdibuja el límite entre los dos features.
- Q: Si alguien entra con Google usando `x@gmail.com` y otro día pide un código
  para `x@gmail.com`, ¿es el mismo usuario? → A: **El mismo. Una sola cuenta por
  dirección de mail.** El camino de ingreso es sólo la forma de probar que esa
  dirección es tuya, no una identidad distinta. Cuentas separadas por camino
  serían más simples de construir, pero el mismo cliente terminaría con dos
  perfiles sin entender por qué su dirección guardada desapareció, y Diego vería
  dos clientes donde hay uno.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar sigue sin pedir nada (Priority: P1)

Alguien que nunca oyó hablar de Flash Urbano entra al sitio, escribe una calle y
una esquina, ve el punto en el mapa y ve el precio. No se le pide cuenta, no se
le pide mail, no se le pide nada. Igual que hoy.

Esta historia no agrega funcionalidad: **defiende la que ya existe**. Se escribe
como historia y no como nota al pie porque es lo que más fácil se rompe cuando
se introduce autenticación, y porque el ADR compró esta propiedad a propósito en
`002` —el precio se calcula en el bundle del cliente— y dejó dicho que no se
gasta.

**Why this priority**: Es la condición que hace que el sitio siga sirviendo como
herramienta de venta para alguien que sólo está comparando precios. Si se rompe,
el feature resta valor en vez de sumarlo, y lo hace en la superficie de mayor
prioridad del producto según el Principio II de la constitución.

**Independent Test**: Se prueba con el API **apagado**. Con el servicio de
backend detenido, entrar al sitio y cotizar de punta a punta tiene que funcionar
sin un solo error. Si cotizar depende de que una request salga bien, esta
historia falló.

**Acceptance Scenarios**:

1. **Given** un visitante sin cuenta y sin sesión, **When** carga calle y
   esquina de retiro, **Then** ve el punto en el mapa y el precio de la zona,
   sin que se le pida identificarse en ningún momento.
2. **Given** el servicio de backend completamente caído, **When** un visitante
   cotiza, **Then** el precio se muestra igual y no aparece ningún error.
3. **Given** un punto fuera de toda zona de servicio, **When** el visitante
   cotiza, **Then** el comportamiento es el que ya existe hoy —sin precio y
   derivación a contacto directo— y la sesión no cambia nada.

---

### User Story 2 - Entrar con Google desde el teléfono (Priority: P1)

Un cliente que ya usa Google en su teléfono toca "Ingresar", elige su cuenta, y
vuelve al sitio identificado, con su nombre a la vista. No escribió una
contraseña ni la va a tener que recordar.

**Why this priority**: Es el camino que va a usar la mayoría y el que ejercita
el riesgo real del feature —la sesión cruzando dos orígenes distintos— sin
depender del dominio propio ni del envío de mail. Es el primer corte que se
puede mostrar funcionando.

**Independent Test**: Se prueba entero sin que exista el dominio propio ni el
proveedor de mail: alcanza con el sitio publicado, el servicio desplegado y una
cuenta de Google. Entregable por sí solo.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión en el teléfono, **When** entra con su
   cuenta de Google, **Then** vuelve al sitio identificado y ve su nombre.
2. **Given** un usuario que entra por primera vez, **When** completa el ingreso,
   **Then** queda creado como usuario sin que nadie lo apruebe.
3. **Given** un usuario identificado, **When** cierra el navegador y vuelve
   días después, **Then** sigue identificado sin volver a ingresar.
4. **Given** un usuario identificado, **When** elige salir, **Then** su sesión
   deja de servir de inmediato, también si alguien la copió.
5. **Given** un usuario en **Safari de iPhone**, **When** entra con Google,
   **Then** el resultado es idéntico al de Chrome de escritorio.

---

### User Story 3 - Entrar con un código que llega por mail (Priority: P2)

Un cliente que no usa Google escribe su dirección de mail, recibe un código de
seis dígitos, lo escribe, y queda identificado. Tampoco hay contraseña.

**Why this priority**: Cubre a quien el camino de Google deja afuera, que es
requisito del cliente y no un extra. Va después de P1 porque **depende de que el
dominio propio esté comprado y verificado**, que es trabajo fuera del código y
con esperas que no controlamos.

**Independent Test**: Se prueba de punta a punta con una dirección de mail real
que no sea de Google, en un teléfono, verificando que el código llegue **a la
bandeja de entrada y no a spam**.

**Acceptance Scenarios**:

1. **Given** un visitante que escribe su mail, **When** pide el código,
   **Then** le llega un código de seis dígitos a la bandeja de entrada.
2. **Given** un código recién recibido, **When** lo escribe bien, **Then** queda
   identificado con la misma sesión larga que da el camino de Google.
3. **Given** un código de más de diez minutos, **When** lo escribe, **Then** es
   rechazado y se le ofrece pedir uno nuevo.
4. **Given** un código ya usado, **When** se intenta usar de nuevo, **Then** es
   rechazado.
5. **Given** cinco intentos fallidos sobre el mismo código, **When** se intenta
   una sexta vez, **Then** ese código queda invalidado aunque el sexto intento
   sea el correcto.
6. **Given** alguien pidiendo códigos en ráfaga para una dirección, o desde una
   misma conexión, **When** supera el límite, **Then** se lo frena sin revelar
   si esa dirección existe como usuario.

---

### User Story 4 - Mis datos quedan guardados (Priority: P3)

Un cliente identificado guarda su nombre, su teléfono y su dirección de retiro
una vez, y los vuelve a ver la próxima vez que entra.

**Why this priority**: Sin esto la identidad no le devuelve nada al cliente —
sólo le pone una puerta. El valor que justifica registrarse (no volver a
escribir la misma dirección) se cobra recién en `007`, cuando el perfil
precarga el formulario. Acá se construye el lugar donde ese dato vive.

**Independent Test**: Identificarse, guardar los tres datos, salir, volver a
entrar y verlos.

**Acceptance Scenarios**:

1. **Given** un usuario identificado, **When** guarda nombre, teléfono y
   dirección de retiro, **Then** los ve al volver a entrar.
2. **Given** un usuario que entró con Google, **When** ingresa por primera vez,
   **Then** su nombre viene precargado de Google y puede corregirlo.
3. **Given** un usuario que edita su perfil, **When** guarda, **Then** ningún
   dato de otro usuario cambia.

---

### User Story 5 - Diego entra como administrador (Priority: P3)

Diego entra igual que cualquier cliente, y el sistema lo reconoce como
administrador porque su dirección de mail está configurada como tal en el
entorno del servicio.

**Why this priority**: Hace falta para `008`, pero no hay nada que administrar
todavía. Se construye acá porque define quién es administrador **sin que nadie
tenga que tocar la base de datos a mano**, y porque resuelve el problema de
quién crea al primer administrador.

**Independent Test**: Entrar con la dirección configurada y comprobar que el
sistema la distingue; entrar con otra y comprobar que no.

**Acceptance Scenarios**:

1. **Given** la dirección de Diego configurada como administradora, **When**
   entra por cualquiera de los dos caminos, **Then** el sistema lo reconoce
   como administrador.
2. **Given** un cliente cualquiera, **When** entra, **Then** no es
   administrador, y no hay forma de volverse administrador desde el sitio.
3. **Given** que cambia quién administra, **When** se cambia la configuración
   del entorno, **Then** el cambio tiene efecto sin editar la base a mano.

### Edge Cases

- **La misma persona por los dos caminos.** Alguien entra con Google usando
  `x@gmail.com` y otro día pide un código para `x@gmail.com`. Es **el mismo
  usuario**, con el mismo perfil, entre por donde entre.
- **Google devuelve una dirección distinta de la registrada.** Una cuenta de
  Google puede tener una dirección primaria que no es la que el usuario espera,
  y puede cambiarla. La identidad se decide por la dirección verificada que
  Google devuelve en ese ingreso: si es una que no conocemos, es un usuario
  nuevo, no un cambio de dirección del anterior.
- **El mail nunca llega.** El proveedor lo rechaza, cae en spam, o la casilla no
  existe. El sitio tiene que decir algo útil y dejar reintentar, sin quedarse
  esperando para siempre y sin confirmar si esa dirección está registrada.
- **Google devuelve un mail no verificado.** No alcanza con que Google diga que
  la cuenta existe: si la dirección no está verificada del lado de Google, no
  sirve como identidad.
- **La sesión vence mientras el cliente está usando el sitio.** Tiene que
  enterarse con un mensaje claro, no con una pantalla rota.
- **El servicio está caído y alguien intenta entrar.** Cotizar tiene que seguir
  andando (Historia 1) y el intento de ingreso tiene que fallar con un mensaje,
  no colgarse.
- **Se mueve el sitio al dominio propio.** El cambio de origen no puede exigir
  tocar código ni volver a desplegar el servicio.
- **Dos pestañas abiertas y en una se cierra sesión.** La otra deja de estar
  identificada.
- **Reloj del teléfono desfasado.** La validez del código se decide del lado del
  servidor, no del dispositivo.

## Requirements *(mandatory)*

### Functional Requirements

**Cotizar abierto**

- **FR-001**: El sistema MUST permitir cotizar —cargar calle y esquina, ver el
  punto y ver el precio— sin cuenta, sin sesión y sin ninguna comunicación con
  el servicio de backend.
- **FR-002**: El cálculo del precio mostrado MUST seguir ocurriendo en el
  navegador, con los datos que el sitio ya sirve. No se traslada al servicio ni
  a la base de datos.

**Identificarse**

- **FR-003**: Los usuarios MUST poder identificarse con una cuenta de Google.
- **FR-004**: Los usuarios MUST poder identificarse con un código de seis
  dígitos enviado a su dirección de mail.
- **FR-005**: El sistema MUST NOT ofrecer, pedir ni almacenar contraseñas por
  ningún camino.
- **FR-006**: El alta MUST ser autogestionada: quien se identifica por primera
  vez queda registrado sin aprobación de nadie.
- **FR-007**: El sistema MUST rechazar como identidad una dirección de mail que
  el proveedor no dé por verificada.
- **FR-007a**: Una dirección de mail MUST corresponder a un único usuario, sea
  cual sea el camino por el que se identifique. Quien entra con Google y quien
  pide un código para la misma dirección son la misma persona y comparten
  perfil.
- **FR-007b**: El sistema MUST NOT tocar el formulario de pedido en este
  feature: sigue sin exigir identificación, sin precargarse, y terminando en la
  pantalla de resumen que ya tiene.

**El código por mail**

- **FR-008**: El código MUST ser de seis dígitos y generado con una fuente
  criptográficamente segura.
- **FR-009**: El código MUST dejar de ser válido a los diez minutos de emitido.
- **FR-010**: El código MUST quedar invalidado tras cinco intentos fallidos,
  aunque después se presente el valor correcto.
- **FR-011**: El código MUST servir una sola vez.
- **FR-012**: El sistema MUST guardar el código de forma que leer la base no
  permita usarlo.
- **FR-013**: El sistema MUST limitar la frecuencia de pedidos de código por
  dirección de mail y por origen de la conexión.
- **FR-014**: Las respuestas al pedido de código MUST NOT revelar si esa
  dirección corresponde a un usuario existente.

**La sesión**

- **FR-015**: El sistema MUST emitir su propia credencial de sesión, después de
  verificar la identidad por cualquiera de los dos caminos.
- **FR-016**: La credencial de sesión MUST viajar en cada pedido de una forma
  que no dependa del comportamiento del navegador con cookies entre orígenes
  distintos.
- **FR-017**: La sesión MUST durar semanas, de modo que un cliente habitual no
  vuelva a identificarse en el uso normal.
- **FR-018**: Los usuarios MUST poder cerrar sesión, y la credencial cerrada
  MUST dejar de servir de inmediato, también para quien la haya copiado.

**El perfil**

- **FR-019**: Los usuarios MUST poder guardar y editar su nombre, su teléfono y
  su dirección de retiro.
- **FR-020**: Un usuario MUST NOT poder leer ni modificar los datos de otro.
- **FR-021**: El nombre MUST venir precargado desde Google cuando ese sea el
  camino de ingreso, y MUST ser editable.

**Administración**

- **FR-022**: El sistema MUST determinar quién es administrador a partir de la
  configuración del entorno del servicio, y MUST NOT ofrecer ninguna forma de
  volverse administrador desde el sitio.

**Que mover el dominio no sea tocar código**

- **FR-023**: Los orígenes autorizados a consumir el servicio MUST salir de la
  configuración del entorno, no del código.
- **FR-024**: El sitio MUST tomar la dirección del servicio de una configuración
  de build, no escrita en el código de las pantallas.
- **FR-025**: El servicio MUST rechazar pedidos de orígenes no autorizados.

**El servicio y sus datos**

- **FR-026**: El servicio MUST quedar desplegado y accesible públicamente, con
  su base de datos provisionada y con soporte geográfico habilitado, aunque
  este feature todavía no guarde geometría.
- **FR-027**: Los cambios de forma de la base MUST aplicarse por migraciones
  versionadas en el repo, con camino de ida desde una base vacía.
- **FR-028**: Ninguna credencial, secreto ni dirección de base de datos MUST
  quedar escrita en el repositorio, que es público.
- **FR-029**: El sitio MUST seguir publicándose como export estático en GitHub
  Pages, sin cambios en su forma de despliegue.

### Key Entities

- **Usuario**: Quien puede crear pedidos. Su identidad es una dirección de mail
  verificada. Guarda nombre, teléfono y dirección de retiro. Su condición de
  administrador no es un dato suyo: se decide comparando su dirección contra la
  configuración del servicio.
- **Sesión**: La prueba de que un usuario se identificó, con un momento de
  vencimiento y la capacidad de ser anulada antes. Es lo que el navegador
  presenta en cada pedido.
- **Código de acceso**: Un valor de un solo uso asociado a una dirección de
  mail, con vencimiento, cuenta de intentos, y guardado de forma no reversible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante sin cuenta cotiza de punta a punta **con el servicio
  de backend apagado**, sin ver un solo error.
- **SC-002**: Diego se identifica por los dos caminos **desde su propio
  teléfono**, al primer intento, sin ayuda. Éste es el criterio principal del
  feature.
- **SC-003**: El ingreso funciona igual en Safari de iPhone y en Chrome de
  Android que en Chrome de escritorio. Verificado a mano en los tres, porque el
  modo de falla que el ADR predice es exactamente que uno de ellos se comporte
  distinto.
- **SC-004**: El código pedido llega **a la bandeja de entrada, no a spam**, en
  menos de un minuto, en al menos dos proveedores de mail distintos.
- **SC-005**: Un cliente que se identificó una vez vuelve al sitio dos semanas
  después, en el mismo teléfono, y sigue identificado.
- **SC-006**: Un código vencido, uno ya usado, y uno con cinco fallos previos
  son rechazados los tres.
- **SC-007**: Después de cerrar sesión, la credencial anterior no sirve para
  nada, comprobado reusándola a mano.
- **SC-008**: Un pedido al servicio desde un origen no autorizado es rechazado.
- **SC-009**: Cambiar el dominio del sitio se resuelve cambiando configuración,
  sin editar código del servicio.
- **SC-010**: Un usuario no consigue leer ni modificar el perfil de otro,
  comprobado intentándolo con una sesión válida ajena al dato pedido.
- **SC-010a**: La misma dirección de mail, usada primero con Google y después
  con código, devuelve **un solo** usuario con el mismo perfil guardado.
- **SC-011**: La base se levanta desde vacía aplicando las migraciones del repo,
  sin pasos manuales.

## Assumptions

- **El dominio propio se compra antes de empezar la Historia 3.** Aprobado por
  el cliente el 2026-08-08 con tope de USD 20 al año. Sin dominio verificado no
  se puede probar el envío del código, y por eso esa historia es P2 y no P1: las
  demás no dependen de él.
- **El sitio no se muda al dominio propio dentro de este feature.** Comprarlo es
  prerequisito del mail; mudar el sitio es un cambio aparte, y FR-023/FR-024
  existen justamente para que se pueda hacer después sin tocar código.
- **"Semanas" se toma como cuatro**, salvo indicación distinta. Es un valor
  configurable, no una constante de negocio.
- **El servicio expone su interfaz sobre HTTP en el estilo que ya usa el resto
  del ecosistema del proyecto.** El ADR fija lenguaje y hosting; la forma exacta
  de la interfaz es decisión del plan.
- **No hay recuperación de cuenta más allá de volver a pedir un código.** Sin
  contraseñas no hay nada que recuperar; quien pierde el acceso a su mail pierde
  el acceso a su cuenta, y eso es aceptable en este producto.
- **El pedido sigue terminando en la pantalla de resumen** durante todo este
  feature. El agujero de que el formulario no le llegue a nadie **no se cierra
  acá**: se cierra en `007`. El sitio es indexable desde `004`, así que ese
  agujero sigue abierto en producción mientras dure este trabajo.
- **No se borran cuentas ni datos personales en este feature.** Guardar
  direcciones y teléfonos de personas reales abre una obligación de borrado que
  hoy el producto no tiene resuelta; queda registrada como deuda, no como
  alcance.

## Dependencies

- [ADR backend-persistence-stack](../../docs/decisions/backend-persistence-stack.md)
  — decide lenguaje, hosting, base de datos y la forma de la autenticación. Este
  feature es el que lo pone en efecto.
- Compra y verificación de `flashurbano.uy` — prerequisito operativo de la
  Historia 3, fuera del código.
- `web/lib/zonas.ts` y `web/lib/zona-lookup.ts` — no se tocan, y FR-001/FR-002
  existen para protegerlos.
- `SECURITY.md` — describe un repo sin frontera de confianza. Este feature crea
  una. Registrado como deuda abierta en
  [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md) desde el
  2026-08-06.
