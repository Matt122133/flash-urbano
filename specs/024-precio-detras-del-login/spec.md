# Feature Specification: El precio vuelve, del lado de adentro del login

**Feature Branch**: `024-precio-detras-del-login`

**Created**: 2026-09-10

**Status**: Draft

**Input**: Pedido del cliente (Diego), transmitido por Mateo el 2026-09-10:
*"una vez que el cliente está logueado y cargó su dirección, ahí sí se muestra
el precio. Lo que él no quería es que se viera el precio sin estar logueado."*

## Lo que cambia, dicho sin suavizar

El 2026-08-30, `013` sacó el precio de todas las pantallas y enmendó el
Principio V por tercera vez. El argumento que quedó escrito en aquel spec fue
que **el sitio perdía la mitad pública de su propuesta**: un visitante sin
cuenta podía marcar una esquina y saber el precio sin registrarse, y eso
desaparecía.

Diez días después el cliente dice que ese no era el problema. **El problema era
el visitante anónimo, no el precio.** Lo que él no quiere es que alguien que no
dejó ni un dato se lleve su tabla de precios; a un cliente identificado,
cargando un pedido real, le muestra el número sin drama.

O sea que este feature **no revierte `013`: lo corrige**. `013` cerró la puerta
y tiró el premio; esto vuelve a poner el premio, pero del lado de adentro. La
mitad pública de la propuesta sigue muerta a propósito, y ahora el precio pasa a
ser una razón más para entrar en vez de algo que se regala en la vereda.

Y hay que decir en voz alta lo que esto convierte al login: **hasta hoy la
sesión era un requisito administrativo** —hace falta para que Diego sepa a quién
buscar—, y a partir de acá **es también una recompensa**. Es un cambio de
producto, no de pantalla.

**El número que se muestra es verdad.** Mateo confirmó el 2026-09-10 que los
montos por zona vigentes son los mismos que están hoy en el generador de zonas.
Esta es la condición que sostiene todo el feature: si los montos hubieran
quedado viejos, mostrarlos sería peor que no mostrar nada, porque el sitio le
prometería al cliente una cifra que Diego no va a cobrar. **Si esa condición
deja de ser cierta, este feature deja de ser correcto** — ver *Assumptions*.

## Lo que este feature NO hace

- **No devuelve el precio a la parte pública.** Inicio, *Sobre nosotros* y el
  mapa de zonas siguen sin montos, para todo el mundo, con sesión o sin ella.
  La leyenda del mapa sigue siendo color y número.
- **No toca cómo se resuelve la zona.** Sigue saliendo del punto de **entrega**,
  la regla de desempate no cambia, y un punto fuera de las cinco zonas sigue sin
  producir pedido y sin recibir zona sustituta.
- **No lee la columna `precio` guardada. Para nada.** Ni para reportes, ni para
  dashboard, ni para mostrarle a un cliente lo que salió un pedido viejo. El
  monto que se muestra se **recalcula** siempre desde la zona de entrega. Esta
  es la decisión que mantiene chica la enmienda del Principio V.
- **No pone precio en *Mis pedidos*.** Las tarjetas de pedido siguen sin montos.
- **No pone precio en la etiqueta imprimible de `020`.** La etiqueta viaja
  pegada al paquete y pasa por manos de terceros; un monto ahí desarmaría la
  puerta que el cliente pidió.
- **No le anuncia al visitante sin sesión que hay un precio esperándolo.** Donde
  el logueado ve el monto, el visitante ve lo mismo que hoy: la confirmación de
  cobertura con el nombre de la zona, sin mensaje sustituto.
- **No cambia el dato.** No hay migración, el cuerpo de `POST /pedidos` no
  cambia de forma y el servicio sigue guardando zona y precio como hasta ahora.
- **No toca la app de Diego.** Nunca mostró montos y sigue sin mostrarlos.
- **No pone precio en el mensaje de fuera de zona.** Un punto no cubierto se
  sigue encaminando al contacto directo con un texto que no habla de costo.

## Clarifications

### Sesión 2026-09-10

- **¿Qué ve el visitante SIN sesión en el lugar donde el logueado ve el monto?**
  → **Nada.** Queda exactamente como lo dejó `013`: la confirmación de cobertura
  con el nombre de la zona, sin mensaje sustituto. Se descartó la invitación
  explícita del tipo *"entrá para ver cuánto sale"*, que habría convertido el
  precio en el gancho para registrarse: **el FR-003 de `013` sigue vigente sin
  tocarse.** Consecuencia aceptada a sabiendas: el visitante no se entera de que
  hay un número del otro lado, así que el precio no funciona como argumento de
  registro. (FR-013)
- **¿Los pedidos ya creados muestran su precio guardado en *Mis pedidos*?** →
  **No.** El precio se muestra únicamente donde se **recalcula**. La columna
  guardada no se lee nunca. Esto evita el problema de los pedidos anteriores al
  2026-08-22, cuyo monto salió de la zona de **retiro** y nunca fue el precio de
  ese envío bajo las reglas de hoy. (FR-011, FR-015)
- **¿La etiqueta imprimible de `020` lleva el monto?** → **No.** La etiqueta se
  imprime y viaja pegada al paquete: un monto ahí lo ve cualquiera que tenga el
  paquete en la mano, no solo el cliente que la generó. Poner el precio ahí
  desarmaría justamente la puerta que el cliente pidió. Si Diego después lo
  quiere, se mueve; hoy no. (FR-012)
- **Entonces, ¿dónde vive el precio exactamente?** → **Pegado a la zona, y en
  ningún otro lado.** No es "en el formulario": es **dentro del mismo bloque que
  nombra la zona** —hoy `ResultadoZona`, el que está junto al mapa donde se
  marca la entrega—, y solo con sesión iniciada. Sin zona nombrada no hay monto.
  Nada de línea de precio suelta, total, resumen previo ni pantalla de
  confirmación con cifra; ninguna otra pantalla del sitio, de la app ni del
  papel muestra un monto. Textual: *"el precio solo se muestra con la zona, nada
  más"*. (FR-001, FR-007a, FR-008)
- **Consecuencia sobre la enmienda.** Como nada lee la columna guardada, el
  Principio V no necesita levantar esa prohibición: la enmienda habilita
  **precio recalculado, en el formulario, a un cliente identificado**, y deja
  en pie, textual, que leer la columna sigue siendo una decisión nueva. El
  feature `025` no hereda nada de acá.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El cliente identificado ve cuánto sale (Priority: P1)

Una persona con la sesión iniciada entra a cargar un envío. Escribe la dirección
de retiro, escribe la de entrega y marca su esquina en el mapa. En cuanto ese
punto cae dentro de una de las cinco zonas, el formulario le dice la zona **y el
monto**. Confirma sabiendo lo que va a pagar.

**Why this priority**: Es el pedido del cliente y es la superficie de mayor
tráfico. Si se hace solo esto, el cambio ya está entregado en lo que importa.

**Independent Test**: Entrar con sesión, recorrer el formulario con una
dirección de entrega válida y comprobar que aparece un monto junto a la zona, y
que el pedido se crea igual que antes.

**Acceptance Scenarios**:

1. **Given** una persona con sesión iniciada en el formulario, **When** resuelve
   el punto de entrega dentro de una zona, **Then** ve el nombre de la zona y el
   monto de esa zona.
2. **Given** el punto de entrega ya marcado y el monto a la vista, **When** mueve
   el pin a otra zona también cubierta con otro monto, **Then** el monto que ve
   pasa a ser el de la zona nueva.
3. **Given** una persona con sesión iniciada, **When** cargó la dirección de
   **retiro** pero todavía no resolvió el punto de entrega, **Then** no ve ningún
   monto. El retiro no decide el precio y no puede insinuarlo.
4. **Given** una persona con sesión iniciada, **When** marca un punto fuera de
   las cinco zonas, **Then** no ve ningún monto, no se crea el pedido y se la
   encamina al contacto directo con un texto que no menciona costo.
5. **Given** un pedido confirmado por esa persona, **When** se lo mira en la
   base, **Then** tiene guardados la misma zona y el mismo monto que se le
   mostraron en pantalla.

---

### User Story 2 - El visitante sin cuenta sigue sin llevarse el número (Priority: P1)

Alguien que nunca entró abre el formulario, escribe direcciones y marca la
esquina de la entrega. El sitio le confirma que llega hasta ahí, sin decirle
cuánto sale. Para saber el monto tiene que entrar.

**Why this priority**: Es **la mitad del pedido del cliente**, no un detalle: lo
que Diego pidió no fue "mostrar el precio", fue "que no se vea sin estar
logueado". Un feature que muestre el monto a cualquiera cumple la mitad
agradable y rompe la que él pidió. Va en P1 junto con la otra, y no después.

**Independent Test**: Sin sesión, recorrer el formulario entero con una
dirección válida y comprobar que no aparece ningún monto en ningún estado.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión en el formulario, **When** resuelve el punto
   de entrega dentro de una zona, **Then** ve la confirmación de cobertura con el
   nombre de la zona y **ningún monto**.
2. **Given** esa misma persona, **When** intenta confirmar el pedido, **Then** se
   le pide iniciar sesión, igual que hoy.
3. **Given** esa misma persona, **When** inicia sesión sin perder lo que había
   cargado, **Then** el monto de la zona que ya tenía marcada aparece sin que
   tenga que volver a marcar el punto.
4. **Given** una persona que cierra la sesión con el formulario abierto y un
   monto a la vista, **When** la sesión termina, **Then** el monto desaparece de
   la pantalla.

5. **Given** una persona sin sesión que resolvió el punto de entrega, **When**
   mira el bloque de cobertura, **Then** no hay ningún texto que le anuncie que
   existe un precio ni que la invite a entrar para verlo. Sin este escenario, el
   anterior se satisface con un "entrá para ver cuánto sale", que es
   exactamente lo que se descartó.

---

### User Story 3 - El precio no se escapa del formulario (Priority: P2)

El monto vive en un solo lugar. Una persona con sesión iniciada que recorre el
resto del producto —*Mis pedidos*, la etiqueta que imprime, la parte pública—
no encuentra un monto en ninguna parte, aunque acabe de ver uno en el
formulario.

**Why this priority**: Es lo que hace que "detrás del login" signifique algo.
`013` sacó el precio de once lugares; este feature lo devuelve a **uno**, y las
otras diez superficies siguen siendo el estado correcto, no un pendiente. Sin
esta historia, el feature se cumple con un monto que se filtra a un papel que
viaja pegado al paquete.

**Independent Test**: Con sesión iniciada, recorrer *Mis pedidos*, generar una
etiqueta y abrir *Sobre nosotros*, comprobando que no aparece ningún monto.

**Acceptance Scenarios**:

1. **Given** una persona con sesión en *Mis pedidos*, **When** mira sus pedidos
   —incluidos los creados después de este cambio—, **Then** ninguna tarjeta
   muestra un monto.
2. **Given** un pedido cualquiera, **When** la persona genera su etiqueta
   imprimible, **Then** la etiqueta lleva código, destinatario, remitente y
   zona, y **ningún monto**.
3. **Given** una persona con sesión iniciada, **When** abre *Sobre nosotros* y
   mira el mapa de zonas y su leyenda, **Then** no ve montos: la leyenda sigue
   siendo nombre y color.
4. **Given** una persona que repite un pedido viejo, **When** el formulario se
   precarga y ella resuelve el punto de entrega, **Then** el monto que ve es el
   de la zona de hoy, recalculado, y no un número traído del pedido anterior.

**Por qué la columna guardada no se lee, dicho una vez y en claro.** En el
formulario el monto se **recalcula** desde la zona de entrega: es el precio de
hoy, y Mateo confirmó el 2026-09-10 que es verdad. La columna guardada es otra
cosa: el Principio V dice, textual, que registra *"what the old rule would have
charged, not what Diego charges"*. Y hay pedidos creados antes del 2026-08-22
cuyo monto salió de la zona de **retiro**: para esos, el número guardado nunca
fue el precio de ese envío bajo las reglas de hoy. Mostrarlo sería mostrar una
cifra que el cliente no pagó.

---

### Edge Cases

- **Sesión que expira con el formulario abierto.** El monto tiene que
  desaparecer al perder la sesión, no quedar dibujado de antes. Si no, la puerta
  se puede saltear dejando la pestaña abierta.
- **El listado de calles o el mapa no cargan.** Sin punto no hay zona y sin zona
  no hay monto: el formulario sigue bloqueando como hoy, con el texto de
  cobertura y sin mencionar precio.
- **El servicio está caído.** Una persona con credencial guardada tiene que
  seguir pudiendo cargar el formulario y ver su precio; el monto se calcula en el
  navegador y no depende de la red. Ver FR-016.
- **Dos zonas reclaman el mismo punto.** La regla de desempate vigente —la de
  menor precio— vuelve a tener consecuencia **visible** después de haber dejado
  de tenerla en `013`. No cambia, pero desde este feature el cliente puede notar
  el resultado.
- **Pedido repetido cuyo punto guardado hoy cae fuera de toda zona.** Sigue sin
  poder confirmarse y sin mostrar monto.
- **Una persona sin sesión que ya vio un monto en un dispositivo compartido.**
  Al cerrar sesión, la pantalla no puede conservar el número.

## Requirements *(mandatory)*

### Functional Requirements

**El precio se muestra, y solo a quien tiene sesión**

- **FR-001**: El formulario de pedido MUST mostrar el monto de la zona a una
  persona **con sesión iniciada**, y MUST NOT mostrarlo a una persona sin
  sesión.
- **FR-002**: El monto MUST aparecer únicamente cuando el punto de **entrega**
  esté resuelto y caiga dentro de una de las cinco zonas. Cargar la dirección de
  retiro MUST NOT producir ningún monto.
- **FR-003**: El monto mostrado MUST ser el de la zona en que cae el punto de
  entrega según el dato de zonas vigente, recalculado en el momento y no leído
  de un pedido anterior.
- **FR-004**: Al mover el punto de entrega entre zonas cubiertas, el monto
  mostrado MUST pasar a ser el de la zona nueva.
- **FR-005**: Cuando la sesión termina o expira, el monto MUST desaparecer de la
  pantalla sin requerir que la persona recargue.
- **FR-006**: Al iniciar sesión con el formulario ya completado, el monto de la
  zona ya marcada MUST aparecer sin obligar a volver a marcar el punto.
- **FR-007**: La confirmación de cobertura que `013` puso en ese bloque —el
  nombre de la zona— MUST seguir existiendo para **todo el mundo**, con sesión y
  sin ella. El monto se suma a esa confirmación; no la reemplaza.
- **FR-007a**: **El monto MUST aparecer únicamente junto a la zona, dentro del
  mismo bloque que la nombra, y en ningún otro punto del formulario.** No hay
  línea de precio suelta, ni total, ni monto en un resumen previo a confirmar,
  ni en la pantalla de confirmación, ni repetido en otro lado de la pantalla.
  Sin zona nombrada no hay monto; el monto es un dato *de la zona*, no del
  pedido. Este requisito es literal: *"el precio solo se muestra con la zona,
  nada más"* (Mateo, 2026-09-10).

**Lo público sigue sin precio**

- **FR-008**: Inicio, *Sobre nosotros*, el mapa de zonas y sus globos MUST
  seguir sin mostrar montos, **también a una persona con sesión iniciada**. La
  puerta es el login, pero lo que abre es el formulario, no el sitio entero.
- **FR-009**: Ningún texto MUST justificar un bloqueo apelando al precio. El
  mensaje de punto fuera de zona MUST seguir hablando de cobertura.
- **FR-010**: Los llamados a la acción de la parte pública MUST NOT volver a
  ofrecer "conocé los precios" ni equivalente.

**El monto vive en un solo lugar**

- **FR-011**: *Mis pedidos* MUST NOT mostrar montos, en ninguna tarjeta, con
  sesión iniciada o sin ella, para pedidos creados antes o después de este
  cambio.
- **FR-012**: La etiqueta imprimible de `020` MUST NOT mostrar montos. Sigue
  llevando código, destinatario, remitente y zona.
- **FR-013**: Donde el cliente con sesión ve el monto, el visitante sin sesión
  MUST ver la confirmación de cobertura con el nombre de la zona y **ningún
  mensaje sustituto**: ni invitación a entrar para ver el precio, ni monto
  tapado, ni mención de que existe un precio. El FR-003 de `013` sigue vigente
  tal como está escrito.

**El dato no se toca, y no se lee**

- **FR-014**: El pedido que se manda al servicio MUST seguir llevando zona y
  precio, y el servicio MUST seguir persistiéndolos sin cambio de forma ni
  migración.
- **FR-015**: Ninguna superficie MUST leer la columna `precio` guardada, para
  nada: ni para mostrarle a un cliente lo que salió un pedido suyo, ni para
  totales, reportes o agregados. Todo monto que se muestre MUST estar
  **recalculado** desde la zona de entrega en el momento. La prohibición del
  Principio V sobre esa columna sobrevive intacta a este feature.

**No regresiones**

- **FR-016**: La guarda automática que impide que el cliente del servicio y el
  módulo de sesión entren en el grafo de importación del formulario MUST seguir
  en verde. El formulario MUST seguir cargando y funcionando con el servicio
  caído hasta el momento de confirmar.
- **FR-017**: La guarda automática de `013` que hoy falla si aparece un monto en
  cualquier pantalla de cara al cliente MUST redefinirse, no borrarse: MUST
  seguir fallando si aparece un monto en una superficie **pública**, y MUST
  permitirlo solo donde este spec lo autoriza. Borrarla dejaría al feature sin
  ninguna guarda de la mitad que el cliente pidió.
- **FR-018**: MUST existir una prueba automática que falle si el monto se
  vuelve visible sin sesión.
- **FR-019**: La app de Diego MUST seguir sin mostrar montos.

### Key Entities

- **Zona**: una de las cinco áreas de cobertura. Tiene identificador, nombre,
  color, límite y **precio**. El precio vuelve a ser visible; el límite sigue
  siendo la puerta de cobertura.
- **Sesión**: deja de ser solo el requisito para confirmar un pedido y pasa a
  ser **la condición para ver el precio**. Es el cambio de producto de este
  feature.
- **Pedido**: sigue guardando zona y precio con que se creó, y **ese número
  guardado no se le muestra a nadie**. Es dato de respaldo, no una cifra de cara
  al cliente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona con sesión iniciada sabe cuánto sale su envío antes de
  confirmarlo, sin salir del formulario y sin preguntarle a nadie.
- **SC-002**: Recorriendo el sitio entero **sin sesión** —inicio, pedido, sobre
  nosotros, contacto— no aparece ningún monto en pesos, en ningún estado, ni en
  los globos del mapa.
- **SC-003**: Recorriendo el producto entero **con sesión iniciada** —inicio,
  sobre nosotros, mis pedidos, la etiqueta impresa, la app de Diego— aparece
  monto en **exactamente un** lugar: junto al nombre de la zona, dentro del
  bloque que confirma la cobertura. Es lo único que cambia respecto de SC-002, y
  contar los lugares donde aparece un monto en toda la sesión tiene que dar
  **uno**.
- **SC-004**: El monto que ve el cliente en el formulario coincide con el que
  queda guardado en el pedido, en el 100% de los pedidos creados.
- **SC-005**: El 100% de los puntos marcados fuera de las cinco zonas sigue sin
  producir pedido, sin monto y sin zona sustituta.
- **SC-006**: El formulario carga y muestra el precio con el servicio apagado,
  para una persona con credencial guardada.
- **SC-007**: Una prueba automática falla si un monto aparece sin sesión, y otra
  falla si aparece en una pantalla pública.
- **SC-008**: Ninguna pantalla lee la columna `precio` guardada. Un pedido
  creado antes del 2026-08-22 —con monto calculado desde la zona de retiro— no
  muestra ese número en ninguna parte.

## Assumptions

- **Los montos por zona vigentes son los que están en el generador de zonas.**
  Confirmado por Mateo el 2026-09-10. Es el supuesto que sostiene el feature
  entero: si Diego cambió sus precios desde el 2026-08-30 y no lo dijo, este
  feature le miente al cliente. Cualquier cambio futuro de montos pasa a ser un
  cambio de cara al cliente, no un dato interno.
- El estado de sesión ya está disponible una capa arriba del formulario —el
  contenedor que hoy decide si se puede confirmar ya lo conoce—, así que
  distinguir con y sin sesión no obliga a que el formulario importe nada de lo
  que la guarda de FR-016 prohíbe.
- Diego sigue acordando por su cuenta cualquier caso que se salga de la tabla
  —urgencias, paquetes fuera de lo común—. El monto del sitio es el precio
  normal de esa zona, no un contrato.
- Nadie depende hoy del sitio para saber cuánto sale un envío, así que no hay
  clientes en producción que se sorprendan por el número que aparece.
- La regla de desempate entre zonas superpuestas no se toca, aunque vuelva a
  tener efecto visible.

## Dependencias

- **Enmienda de la constitución, y es bloqueante.** El Principio V vigente
  (5.1.0) dice textual: *"No surface shows an amount to anyone"*. Este feature lo
  contradice de frente. La constitución es el documento de mayor autoridad del
  repo y su gobierno exige que una reversión de principio sea **MAJOR y
  fechada**: **5.1.0 → 6.0.0**. Va en la fase Decide, antes del plan, siguiendo
  el precedente de `013` —donde la enmienda, el ADR y el feature viajaron en el
  mismo commit—. **La enmienda es angosta**: habilita monto *recalculado*, *en
  el formulario*, *a un cliente identificado*. El párrafo que prohíbe leer la
  columna guardada **no se toca**, y conviene que quede escrito que no se tocó.
- **ADR nuevo en `docs/decisions/`.** La decisión es sorprendente sin contexto
  —es la cuarta vez que este principio cambia de dirección— y tiene un tradeoff
  real: se gana que el cliente sepa lo que paga y que el login valga algo; se
  pierde que el precio quede fuera de discusión y se acepta que cualquier cambio
  de montos ahora sea visible. `price-not-shown.md` queda **superseded en
  parte**: sobrevive en que la parte pública no cotiza, muere en que nadie ve el
  número.
- **`web/lib/sin-precio-a-la-vista.test.ts`.** Es la guarda de `013` y **hoy
  pone en rojo exactamente lo que este feature quiere hacer**. Se redefine, no se
  borra (FR-017). Es el archivo que decide si el feature entrega la mitad que el
  cliente pidió.
- **`web/lib/cotizar-abierto.test.ts`.** La guarda del grafo de imports del
  formulario, que prohíbe `lib/api.ts` y `lib/sesion.ts`. Sigue en verde
  (FR-016).
- **Feature `025`, el dashboard.** Corre después y **no hereda nada de esta
  enmienda**: mostrar precio recalculado en el formulario no autoriza a leer la
  columna guardada para reportes. Si el dashboard necesita plata en pantalla, es
  otra decisión.
