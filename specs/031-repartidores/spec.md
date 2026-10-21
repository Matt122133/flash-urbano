# Feature Specification: Repartidores

**Feature Branch**: `031-repartidores`

**Created**: 2026-10-18

**Status**: Draft

**Input**: Mateo, el 2026-10-18, por pedido de Diego: *"se va a poner un nuevo
integrante a hacer delivery de paquetes. por lo tanto necesito que este pueda
tener la app con los paquetes asignados que diego le asigne"*. Y sobre el
tablero: *"el va a querer sacar un reporte de los pedidos que el delivery
entrego en el mes [...] tener la seccion 'deliverys' y que se filtre por mail de
delivery"*. El pago al repartidor lo calcula Diego, fuera del producto.

## El problema: la app supone que hay una sola persona en la calle

Hasta hoy el negocio tiene un solo operador, y el producto lo da por hecho: la
constitucion dice *"single-operator courier business"* y describe la app como la
herramienta de Diego. Todo pedido que entra lo ve Diego, y nadie mas.

Ahora entra un segundo repartidor. Necesita llevar en el telefono **los pedidos
que Diego le da, y solo esos**, y Diego necesita poder dárselos sin que le queden
duplicados en su propia lista. A fin de mes, Diego necesita saber **que pedidos
llevo ese repartidor** para pagarle.

## Lo que este feature es, y lo que deliberadamente no es

**Es asignacion.** Cada pedido tiene un responsable. Nace de Diego; Diego puede
dárselo a un repartidor. Lo que se cuenta y se lista despues es la asignacion.

**No registra quien entrego.** Mateo lo descarto explicitamente: si cada uno ve
solo lo suyo, solo el responsable puede marcar la entrega, y la asignacion ya
dice quien lo llevo.

**No convierte a nadie en administrador.** El repartidor no ve el tablero, no
asigna pedidos a terceros y no gana ningun permiso que hoy sea de un
administrador.

**No es un sistema de pagos.** Ni un porcentaje, ni un monto, ni una columna de
total. El reporte cuenta y lista, igual que el reporte por cliente (`029`), y el
Principio V se aplica sin cambios: no se lee `precio`.

**No agrega una columna de rol a la base.** Quien es repartidor lo dice la
configuracion del servicio, con el mismo mecanismo con el que hoy se decide
quien es administrador (FR-022 de `006`). Ver Assumptions.

## Lo que cambia en la constitucion

El Principio III dice *"This is a single-operator courier business"* y los
*Scope boundaries* describen la app como la del operador. Las dos cosas dejan de
ser ciertas. Sigue siendo **un solo negocio** —no es multi-tenant, no hay
cuentas de empresas—, pero con mas de una persona en la calle. La enmienda la
fija el plan (FR-024).

## Clarifications

### Session 2026-10-18

- Q: ¿Como recupera Diego un pedido asignado a un repartidor (por ejemplo, si el
  repartidor no sale)? → A: De dos maneras. **Los administradores ven todos los
  pedidos** en la app, cada uno con su responsable, y pueden asignar o
  desasignar cualquiera; un filtro arriba separa "mios" (sin repartidor) de
  "todos". **El repartidor puede devolverle un pedido a Diego**, y no puede
  dárselo a otro repartidor. La app del administrador **abre en "mios"**:
  recomendacion aceptada por Mateo para que la lista de trabajo del dia (y la
  ruta que se arma con ella) no mezcle pedidos de otro.
- Q: ¿Que fecha corta el periodo del reporte del repartidor? → A: **La fecha de
  entrega, y solo lo entregado**: *"se paga a paquete entregado"*. Distinto a
  propósito del reporte por cliente de `029`, que corta por fecha de retiro e
  incluye lo no entregado. Un pedido que no se marco como entregado no aparece.
- Q: ¿A quien se le cuenta un pedido ya entregado si despues se reasigna, o si
  el repartidor sale de la configuracion? → A: **Al entregar se fija el
  responsable**, y no cambia. Un pedido entregado no se reasigna ni se
  devuelve; el reporte de un repartidor que ya no esta en la configuracion se
  sigue pudiendo sacar. Motivo: un mes ya pagado no puede cambiar despues. No es
  "registrar quien entrego": es congelar la asignacion en el momento de la
  entrega.
- Q: ¿Diego asigna de a un pedido o varios a la vez? → A: **De a uno, desde la
  tarjeta del pedido** (la app no tiene pantalla de detalle; la tarjeta hace de
  detalle). La asignacion en lote queda fuera de este feature.
- Q: ¿Al repartidor le llegan tambien los avisos de "pedido modificado" y
  "pedido dado de baja" de sus pedidos? → A: **Si** (Mateo, en el analisis del
  plan): el cliente puede cambiar la direccion de un pedido pendiente, y sin el
  aviso el repartidor va a la vieja.
- Q: ¿Se le avisa al repartidor cuando Diego le saca o le reasigna un pedido? →
  A: **No.** Lo ve al recargar la lista.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diego le da un pedido al repartidor (Priority: P1)

Diego abre la app, ve sus pedidos como hoy, toca "asignar" en uno y elige un
repartidor de la lista. El pedido sale de su vista "mios" y aparece en la
del repartidor. En "todos" Diego sigue viendolo, con el nombre de quien lo
tiene, y puede sacarselo o pasarselo a otro.

**Why this priority**: Es el feature. Sin esto el repartidor no tiene nada que
llevar.

**Independent Test**: Con un repartidor configurado, Diego asigna un pedido y
comprueba que deja de verlo y que el repartidor lo ve.

**Acceptance Scenarios**:

1. **Given** un pedido recien creado, **When** Diego abre la app, **Then** el
   pedido esta en su lista: todo pedido nace de Diego.
2. **Given** un pedido en la lista de Diego y un repartidor configurado,
   **When** Diego lo asigna al repartidor, **Then** el pedido sale de "mios",
   sigue en "todos" con el nombre del repartidor, y aparece en la lista del
   repartidor.
5. **Given** que Diego abre la app, **When** carga la lista, **Then** esta en
   "mios": solo los pedidos sin repartidor.
6. **Given** un pedido asignado al repartidor, **When** Diego lo desasigna o lo
   reasigna desde "todos", **Then** sale de la lista del repartidor y queda
   donde Diego lo puso.
3. **Given** que no hay ningun repartidor configurado, **When** Diego abre un
   pedido, **Then** no se le ofrece asignar, o se le dice que no hay
   repartidores, en vez de una lista vacia sin explicacion.
4. **Given** los pedidos que existian antes de este feature, **When** se
   despliega, **Then** todos estan en la lista de Diego, sin que nadie los haya
   tenido que asignar a mano.

---

### User Story 2 - El repartidor trabaja sus pedidos (Priority: P1)

El repartidor entra a la app con su mail y ve solo los pedidos que Diego le
asigno. Con ellos hace lo mismo que Diego hace hoy con los suyos.

**Why this priority**: Sin esto la asignacion no sirve: el repartidor tiene que
poder llevar el paquete y marcarlo.

**Independent Test**: El repartidor entra, ve exactamente los pedidos asignados
a el, avanza uno hasta la entrega y Diego ve el estado final en el tablero.

**Acceptance Scenarios**:

1. **Given** un repartidor con tres pedidos asignados y otros diez en la lista
   de Diego, **When** entra a la app, **Then** ve los tres y ninguno de los diez.
2. **Given** un pedido asignado al repartidor, **When** lo abre, **Then** puede
   hacer todo lo que Diego puede hacer hoy con un pedido: cambiar su estado,
   cargar quien lo recibio, ver los datos de quien recibe, ver el comentario y
   el color del cliente.
3. **Given** un repartidor en la app, **When** abre un pedido, **Then** no tiene
   la opcion de asignarlo a otro repartidor, pero si de devolverselo a Diego.
6. **Given** un pedido asignado al repartidor, **When** lo devuelve, **Then**
   sale de su lista y vuelve a "mios" de los administradores.
4. **Given** un mail que no es ni administrador ni repartidor, **When** intenta
   entrar a la app, **Then** se le niega igual que hoy.
5. **Given** un repartidor, **When** intenta abrir o modificar un pedido que no
   le esta asignado (por ejemplo, pidiendolo directo al servicio), **Then** el
   servicio lo rechaza sin revelar nada del pedido.

---

### User Story 3 - El repartidor se entera de que tiene un pedido nuevo (Priority: P2)

Cuando Diego le asigna un pedido, al repartidor le llega una notificacion al
telefono: "Nuevo paquete asignado".

**Why this priority**: Sin la notificacion el repartidor tiene que abrir la app
para enterarse, pero el feature funciona igual.

**Independent Test**: Diego asigna un pedido; el telefono del repartidor recibe
la notificacion con la app cerrada.

**Acceptance Scenarios**:

1. **Given** un repartidor con la app instalada y la sesion abierta, **When**
   Diego le asigna un pedido, **Then** le llega una notificacion "Nuevo paquete
   asignado".
2. **Given** un pedido nuevo creado por un cliente, **When** se crea, **Then**
   el aviso de pedido nuevo le llega a los administradores como hoy y **no** al
   repartidor: el pedido todavia es de Diego.
3. **Given** que la notificacion falla, **When** Diego asigna, **Then** la
   asignacion se hace igual: la notificacion no es condicion de nada.

---

### User Story 4 - Diego saca lo que llevo el repartidor en el mes (Priority: P2)

En el tablero web, Diego tiene una seccion "Repartidores". Elige un repartidor y
ve lo mismo que hoy ve al filtrar por cliente —conteos por periodo y la descarga
del archivo— pero con los pedidos asignados a ese repartidor.

**Why this priority**: Es lo que Diego necesita para pagarle, pero puede llegar
despues de que el repartidor ya este trabajando.

**Independent Test**: Con pedidos asignados al repartidor en un mes, Diego
descarga el archivo de ese mes y contiene exactamente esos pedidos.

**Acceptance Scenarios**:

1. **Given** un repartidor con pedidos asignados entregados en septiembre,
   **When** Diego lo elige en "Repartidores" y descarga septiembre, **Then** el
   archivo trae una fila por cada uno de esos pedidos y ninguno de otro
   responsable.
5. **Given** un pedido asignado al repartidor, retirado en septiembre y sin
   marcar como entregado, **When** Diego descarga septiembre, **Then** el pedido
   no esta en el archivo.
6. **Given** una entrega marcada a las 22:00 del 30 de septiembre en
   Montevideo, **When** Diego descarga septiembre, **Then** el pedido esta en
   septiembre y no en octubre.
2. **Given** la seccion "Repartidores", **When** Diego la abre, **Then** la
   lista tiene solo repartidores: Diego y los demas administradores no aparecen.
3. **Given** el archivo de un repartidor, **When** se abre, **Then** no tiene un
   solo importe, igual que el reporte por cliente.
4. **Given** un pedido entregado por el repartidor en octubre, **When** Diego
   intenta reasignarlo o el repartidor intenta devolverlo, **Then** la app no
   lo permite, y el pedido sigue en el reporte de octubre del repartidor.
7. **Given** un repartidor que entrego pedidos en octubre y en noviembre sale
   de la configuracion, **When** Diego abre "Repartidores", **Then** lo puede
   elegir igual y descargar octubre completo.

---

### Edge Cases

- **El repartidor no sale un dia** y tiene pedidos asignados: Diego los ve en
  "todos" y los desasigna, sin depender del repartidor.
- **Un pedido entregado** no se reasigna ni se devuelve (US4-4). Para
  corregirlo hay que deshacer la entrega primero.
- **Se saca un mail de la configuracion de repartidores** teniendo pedidos
  asignados. Esos pedidos no pueden quedar invisibles para todos: vuelven a
  Diego (se tratan como sin asignar).
- **Un mail esta a la vez en administradores y en repartidores.** Gana
  administrador; no es repartidor a efectos de la lista ni del reporte.
- **El repartidor nunca entro a la app** cuando Diego le asigna: la asignacion
  funciona; la notificacion no le llega porque no tiene telefono registrado, y
  ve el pedido cuando entre.
- **El repartidor tambien hace pedidos como cliente** en la web con el mismo
  mail: la web lo trata como cliente, como hoy. Ser repartidor no cambia nada en
  la web.
- **Dos administradores** (Diego y Mateo): "la lista de Diego" son los pedidos
  sin asignar a un repartidor, y la ven los dos.
- **Una entrega se deshace** (la app permite deshacer): el pedido deja de estar
  entregado, vuelve a poder reasignarse, y la proxima marca de entrega fija a
  quien sea responsable en ese momento.
- **Un administrador marca como entregado un pedido asignado al repartidor**
  (por ejemplo, lo llevo el en su lugar): la entrega se fija al repartidor
  asignado y cuenta en su reporte. Si no corresponde, el administrador lo
  desasigna antes de marcarlo.
- **El repartidor entra alguna vez a la web**: aparece en la lista de clientes
  del tablero como una cuenta sin pedidos, como cualquier cuenta. Se acepta.
- **La asignacion llega a un repartidor sin conexion**: la app la muestra al
  recargar, como cualquier otro cambio de lista.

## Requirements *(mandatory)*

### Functional Requirements

**Quien es repartidor**

- **FR-001**: El sistema MUST determinar quien es repartidor a partir de la
  configuracion del entorno del servicio, con el mismo mecanismo y la misma
  normalizacion de mails que usa para los administradores.
- **FR-002**: El sistema MUST NOT ofrecer ninguna forma de volverse repartidor
  ni administrador desde el sitio ni desde la app (FR-022 de `006` sigue
  vigente).
- **FR-003**: El sistema MUST NOT guardar en la base el rol de ningun usuario.
- **FR-004**: Un mail que este en las dos listas MUST tratarse como
  administrador.
- **FR-005**: Un repartidor MUST poder entrar a la app con su mail, por los
  mismos caminos de ingreso que hoy usa Diego.

**Asignacion**

- **FR-006**: Todo pedido MUST tener un responsable. Un pedido sin repartidor
  asignado MUST ser responsabilidad de los administradores.
- **FR-007**: Todo pedido nuevo MUST nacer sin repartidor asignado, y los
  pedidos que existen al desplegar MUST quedar sin repartidor asignado, sin
  escribir sobre ninguna fila existente para lograrlo.
- **FR-008**: Un administrador MUST poder asignar desde la app, **de a un pedido
  y desde su tarjeta**, cualquier pedido no entregado a uno de los repartidores
  configurados. Asignar varios a la vez queda fuera de este feature.
- **FR-009**: La lista de repartidores que se ofrece al asignar MUST mostrar a
  cada uno de forma reconocible (nombre si tiene perfil, mail si no).
- **FR-010**: Un repartidor MUST NOT poder asignar un pedido a otro
  repartidor, y MUST poder devolverle a los administradores un pedido que
  tiene asignado.
- **FR-010a**: Un administrador MUST poder desasignar o reasignar cualquier
  pedido que no este entregado, este asignado a quien este.
- **FR-010b**: Al marcarse un pedido como entregado, el sistema MUST fijar
  quien era su responsable en ese momento. Un pedido entregado MUST NOT poder
  reasignarse ni devolverse; si la entrega se deshace, vuelve a poder.
- **FR-011**: Si un mail sale de la configuracion de repartidores, sus pedidos
  **no entregados** MUST volver a la lista de los administradores. Los
  entregados MUST seguir contandose para el (FR-010b).

**Que ve cada uno**

- **FR-012**: La app de un administrador MUST mostrar todos los pedidos, cada
  uno con su responsable, con un filtro que separe "mios" (sin repartidor) de
  "todos". MUST abrir en "mios".
- **FR-013**: La lista de la app de un repartidor MUST contener solo los pedidos
  asignados a el.
- **FR-014**: Sobre sus pedidos, un repartidor MUST poder hacer todo lo que hoy
  hace un administrador en la app, excepto asignar.
- **FR-015**: El servicio MUST rechazar que un repartidor lea o modifique un
  pedido que no le esta asignado, sin revelar en la respuesta si el pedido
  existe.
- **FR-016**: El repartidor MUST NOT tener acceso al tablero web ni al reporte.

**Avisos**

- **FR-017**: Al asignar un pedido a un repartidor, el sistema MUST mandarle una
  notificacion "Nuevo paquete asignado" a los telefonos donde tenga la sesion
  abierta.
- **FR-017a**: Desasignar o reasignar un pedido MUST NOT notificar al
  repartidor que lo tenia: lo ve al recargar su lista.
- **FR-018**: Una falla al notificar MUST NOT impedir ni deshacer la
  asignacion.
- **FR-019**: El aviso de pedido nuevo MUST seguir yendo solo a los
  administradores.
- **FR-019a**: Los avisos de pedido modificado y de pedido dado de baja MUST
  llegarle, ademas de a los administradores, al repartidor que tiene asignado
  ese pedido.

**Tablero: la seccion Repartidores**

- **FR-020**: El tablero MUST tener una seccion "Repartidores", solo para
  administradores, que permita elegir un repartidor: los configurados hoy y
  cualquiera que tenga entregas fijadas, aunque ya no este en la
  configuracion.
- **FR-021**: Para el repartidor elegido, la seccion MUST ofrecer lo mismo que
  hoy ofrece el tablero filtrado por una cuenta de cliente: conteos por periodo
  y la descarga del archivo con las mismas columnas, el mismo formato y las
  mismas reglas de `029`, con los pedidos cuya entrega quedo fijada a ese repartidor (FR-010b).
- **FR-022**: El periodo MUST cortarse por la **fecha de entrega**, en
  calendario de Montevideo, y MUST incluir solo pedidos entregados. Un pedido
  sin marca de entrega MUST NOT aparecer. Si tiene mas de una marca, vale la mas
  reciente (FR-006c de `029`). Es distinto a proposito del reporte por cliente:
  al repartidor se le paga por paquete entregado.
- **FR-023**: La lista de la seccion MUST contener solo repartidores; los
  administradores MUST NOT aparecer. El archivo MUST NOT mezclar dos
  repartidores ni incluir un importe, y su generacion MUST NOT leer `precio`.

**Cuentas de reparto** *(enmienda del 2026-10-18, al probar en staging)*

- **FR-025**: Una cuenta de reparto MUST NOT poder cargar pedidos. El servicio
  MUST rechazarlo con un texto que diga que use otro mail. Quien reparte y
  quiere mandar un paquete propio lo hace desde otra cuenta. Lo pidio Mateo al
  ver su cuenta de repartidor en la lista de clientes del tablero.
- **FR-026**: La lista de clientes del tablero MUST NOT incluir a los
  repartidores configurados, sin excepcion. FR-025 es lo que lo permite: no
  queda pedido nuevo sin cliente que lo muestre.

**Constitucion**

- **FR-024**: La constitucion MUST amendarse para reflejar que el negocio tiene
  mas de una persona repartiendo, que la app la usan administradores y
  repartidores, y que el tablero tambien cuenta por repartidor. El tipo de
  enmienda lo fija el plan.

### Key Entities

- **Repartidor**: una persona que reparte y no administra. Se identifica por su
  mail, que figura en la configuracion del servicio. Puede tener o no un perfil
  (nombre, telefono) si entro alguna vez.
- **Asignacion**: el vinculo entre un pedido y un repartidor. A lo sumo uno por
  pedido; su ausencia significa "de los administradores". Mientras el pedido no
  se entrega se puede cambiar; al entregarse queda fija.
- **Pedido**: el de siempre; gana un responsable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diego asigna un pedido al repartidor en no mas de tres toques desde
  la tarjeta del pedido.
- **SC-002**: En el 100% de los casos, un pedido tiene exactamente un
  responsable: aparece en "mios" de los administradores o en la lista de un
  repartidor, nunca en las dos ni en ninguna.
- **SC-003**: Un repartidor no puede ver ni modificar un pedido ajeno por ningun
  camino, comprobado tanto desde la app como pidiendolo directo al servicio.
- **SC-004**: La notificacion de asignacion llega al telefono del repartidor en
  menos de un minuto en condiciones normales.
- **SC-005**: El archivo del mes de un repartidor contiene exactamente los
  pedidos cuya entrega quedo fijada a ese repartidor en ese periodo, aunque
  despues haya salido de la configuracion: ni uno de mas, ni uno de menos, y
  ningun importe.
- **SC-006**: Sumar o sacar un repartidor no requiere desplegar codigo ni tocar
  la base.
- **SC-007**: Al desplegar, el 100% de los pedidos existentes sigue en la lista
  de Diego.

## Assumptions

- **El rol va en configuracion, no en la base.** Mateo propuso una columna
  `type` en `usuarios` con `admin`/`delivery`/`client`; se descarto el
  2026-10-18 a favor de una variable de entorno de repartidores, para mantener
  FR-022 de `006` (que un cambio en la base no alcance para dar permisos) y para
  que sumar un repartidor sea configuracion y no SQL en produccion.
- **Los mails reales van solo en la configuracion**, nunca en el repo: el repo
  es publico.
- Hoy hay un solo repartidor, pero nada en el feature lo supone: la lista admite
  varios.
- "La lista de Diego" incluye a todos los administradores; hoy son Diego y
  Mateo.
- El repartidor usa la misma app que Diego (mismo APK), que cambia segun quien
  entra.
- La asignacion se hace desde la app y no desde el tablero web.
- La notificacion usa el mismo canal que el aviso de pedido nuevo (`018`).
- El pago al repartidor (porcentaje, montos) queda fuera del producto.
