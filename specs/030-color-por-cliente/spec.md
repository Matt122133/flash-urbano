# Feature Specification: El color de cada cliente en la tarjeta

**Feature Branch**: `030-color-por-cliente`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Color por cliente en la tarjeta de la app del repartidor. Pedido de Diego: hoy confundió pedidos de dos clientes reales distintos porque el remitente se lee poco en la tarjeta, y no los realizó. Sólo una franja de color gruesa en la tarjeta; el nombre del remitente no se toca. El color se asigna una vez al registrarse, se guarda y no cambia. Paleta fija, guardado en hexadecimal. Las cuentas existentes quedan sin color, salvo las tres reales, que se colorean a mano."

## Por qué existe

El 2026-09-30 Diego dejó sin hacer pedidos de uno de sus clientes reales porque
los tomó por pedidos de otro. **El dato estaba en la tarjeta**: el rótulo
"ENVÍA" decía bien quién mandaba cada uno. Lo que falló fue la lectura. El
nombre está en un botón de teléfono chico, debajo de las dos direcciones y con
el mismo peso que "RECIBE". De un vistazo, dos tarjetas de clientes distintos
se ven iguales.

Diego propuso identificar los pedidos por color. Mateo objetó que los colores
que se distinguen a simple vista son pocos y que a Diego le toca memorizarlos, y
eligió el color **como ayuda y no como clave**: el nombre sigue siendo lo que
resuelve la duda, y el color hace que dos clientes distintos **no se vean
iguales** de reojo.

**Qué no es este feature**: no cambia cómo se muestra el nombre del remitente.
Mateo lo evaluó explícitamente: el nombre está bien cargado y bien mostrado, y
agrandarlo no entra en este alcance.

## Clarifications

### Session 2026-09-30 (antes del spec, con Mateo)

- Q: ¿El color reemplaza al nombre? → A: **No.** Es una marca adicional. El
  nombre del remitente queda exactamente como está.
- Q: ¿Qué forma tiene la marca? → A: **Una franja o línea gruesa** en la
  tarjeta. Mateo dibujó una mancha en la esquina del código y aceptó una línea.
- Q: ¿Cuándo se decide el color de un cliente? → A: **Una sola vez, cuando la
  cuenta se registra**, y queda guardado. No se recalcula nunca: si el color
  dependiera de los demás clientes, el alta de uno nuevo podría cambiarle el
  color a uno que Diego ya aprendió, y eso es peor que no tener color.
- Q: ¿Hexadecimal para tener más variaciones? → A: **Se guarda en hexadecimal,
  pero no se sortea.** Con hexadecimal se pueden escribir millones de colores,
  pero si se sortean libremente salen colores que el ojo no separa. Por eso
  primero se usa una lista elegida a mano, y después se generan colores con una
  regla (ver la sesión de clarify). Guardarlo en hex permite cambiar el color de
  un cliente o sumar colores a la lista sin cambiar el esquema.
- Q: ¿Qué pasa con las cuentas que ya existen? → A: **Quedan sin color**, salvo
  las tres cuentas reales de clientes, que reciben uno a mano. Las demás son
  cuentas de prueba y se conservan.

### Session 2026-09-30 (clarify)

- Q: ¿Cómo se representa la paleta y cómo se sabe qué color está disponible? →
  A: **Una lista ordenada de códigos hex en el código**: sumar un color es
  agregar un elemento. Mateo propuso guardar además un "usado sí/no" por color, y
  se descartó por dos motivos. Duplicaría un dato que ya está en las cuentas y
  se desincronizaría con el primer registro: el código no se reescribe cuando
  alguien se registra. **La disponibilidad se calcula al asignar**, mirando qué
  colores ya tienen las cuentas.
- Q: ¿Se pueden repetir colores cuando la paleta se agota? → A: **No. Ningún
  color se repite nunca**; Mateo: *"sino no tiene sentido agregar colores"*.
  Primero se usan los colores de la lista, en orden. Cuando se terminan, el
  sistema **genera** un color nuevo: el más distinto posible de todos los que ya
  están asignados, fuera de las zonas de naranja, azul, rojo y verde y con contraste
  suficiente sobre la tarjeta. **Costo, dicho a Mateo antes de planificar**: que no se repita el
  código no garantiza que se distinga a simple vista. Pasado cierto número de
  clientes, los colores generados van a ser parecidos entre sí. La regla
  asegura que cada color sea siempre el más distinto posible, no que el ojo
  separe a todos. El nombre sigue siendo lo que resuelve la duda.
- Q: ¿Dónde va la línea? → A: **Franja vertical en el borde izquierdo de la
  tarjeta, de arriba a abajo, de unos 6 dp** (opción A). Se ve aunque la
  tarjeta esté a medio salir de la pantalla, no suma alto y no se confunde con
  el borde de la tarjeta destacada, que la rodea entera.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dos clientes distintos no se ven iguales (Priority: P1)

Diego mira la lista de pendientes. Cada pedido de un cliente con color lleva
una franja de ese color, así que los pedidos de clientes distintos **se
separan antes de leer**, y los de un mismo cliente se ven iguales entre sí.

**Why this priority**: es el feature entero, y es lo que falló el 2026-09-30.

**Independent Test**: con dos cuentas de colores distintos, cada una con un
pedido pendiente, abrir la app y comprobar que las dos tarjetas llevan franjas
distintas, y que un segundo pedido de la primera cuenta lleva la misma franja
que el primero.

**Acceptance Scenarios**:

1. **Given** dos cuentas con colores distintos y un pedido pendiente de cada
   una, **When** Diego abre Pendientes, **Then** cada tarjeta lleva la franja
   del color de su cuenta.
2. **Given** dos pedidos de la misma cuenta, **When** Diego los ve en cualquier
   pestaña, **Then** los dos llevan la misma franja.
3. **Given** un pedido de una cuenta sin color, **When** Diego lo ve, **Then**
   la tarjeta queda idéntica a la de hoy, sin franja, sin hueco y sin espacio
   reservado.
4. **Given** una tarjeta destacada (la que se abrió desde un aviso), **When**
   además tiene franja, **Then** se distinguen las dos cosas: el borde sigue
   diciendo "por acá entraste" y la franja sigue diciendo de quién es.

---

### User Story 2 - Un cliente nuevo recibe su color solo (Priority: P2)

Un cliente nuevo se registra y completa su perfil. Sin que nadie haga nada,
queda con un color de la paleta, y sus pedidos aparecen con él.

**Why this priority**: sin esto el color depende de que alguien se acuerde de
asignarlo, y un cliente sin color es justo el que se confunde con otro. Queda
detrás de P1 porque los clientes de hoy se colorean a mano (historia 3).

**Independent Test**: registrar una cuenta nueva en staging, completar el
perfil, crear un pedido y verlo en la app con franja; editar el perfil después
y comprobar que el color no cambió.

**Acceptance Scenarios**:

1. **Given** una cuenta que completa su perfil por primera vez, **When** se
   guarda, **Then** queda con un color de la paleta.
2. **Given** colores de la lista ya asignados, **When** se registra una
   cuenta nueva, **Then** recibe **el primer color de la lista que ninguna
   cuenta tiene**.
3. **Given** una cuenta con color, **When** edita su perfil o se registran
   otras cuentas, **Then** su color no cambia.
4. **Given** todos los colores de la lista ya usados, **When** se registra otra
   cuenta, **Then** recibe un color generado, **distinto de todos los
   asignados** y el más alejado de ellos.

---

### User Story 3 - Los tres clientes reales de hoy tienen color (Priority: P3)

Las tres cuentas reales de clientes que ya existen reciben un color cada una,
distinto entre sí, en staging y en producción. Las cuentas de prueba quedan sin
color.

**Why this priority**: sin esto la historia 1 no se ve en producción hasta que
entre un cliente nuevo, y los dos clientes que se confundieron siguen sin
franja. Es P3 sólo porque es una operación manual y no código.

**Independent Test**: después de la operación, abrir la app contra producción y
ver los pedidos de las tres cuentas con tres franjas distintas, y cualquier
pedido de una cuenta de prueba sin franja.

**Acceptance Scenarios**:

1. **Given** el feature desplegado, **When** se ejecuta la operación documentada
   sobre las tres cuentas reales, **Then** quedan con tres colores distintos de
   la paleta.
2. **Given** la operación hecha, **When** se revisa el repositorio, **Then** no
   hay en él ningún nombre, correo ni nombre comercial de esas cuentas. Queda el
   procedimiento, no los datos.

---

### Edge Cases

- **Una cuenta que guarda el perfil más de una vez.** El perfil se puede
  editar. Sólo el primer guardado asigna color, y los siguientes no lo tocan.
- **Dos registros al mismo tiempo.** No pueden terminar con el mismo color. La
  unicidad la garantiza la base, no el cálculo previo. El segundo toma otro
  color, y ninguno de los dos registros falla por eso.
- **Las cuentas de prueba gastan colores.** Como ningún color se repite, cada
  cuenta de prueba nueva ocupa uno de los colores de la lista. Aceptado.
- **Un color guardado que la app no reconoce como color** (un valor mal escrito
  a mano). La tarjeta se ve como la de una cuenta sin color. Nunca se cae la
  pantalla ni se pinta algo inesperado.
- **Un teléfono con una versión vieja de la app.** No hay tienda, así que
  pueden convivir versiones. Una versión que no conoce el color sigue
  funcionando igual que hoy.
- **Las cuentas de Diego.** Existen varias y son de prueba: quedan sin color
  como las demás cuentas existentes.
- **Cuentas de prueba nuevas.** Las que se creen después de este feature
  reciben color como cualquier cuenta. Aceptado: no molesta y distinguirlas
  costaría una regla que no se pidió.
- **Pedidos anteriores al feature.** El color es de la cuenta, no del pedido,
  así que un pedido viejo de una cuenta con color también lleva franja.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada cuenta de cliente MUST poder tener **un color o ninguno**.
  El color se guarda como código hexadecimal.
- **FR-002**: El sistema MUST asignar un color a una cuenta **la primera vez
  que completa su perfil**, y MUST NOT volver a asignarlo en guardados
  posteriores del perfil.
- **FR-003**: Hay una **lista ordenada de colores elegidos a mano** para
  distinguirse entre sí a simple vista. Ni la lista ni los colores generados
  (FR-004a) pueden usar los colores que la app ya usa con otro significado:
  naranja (retiro), azul (entrega y tarjeta destacada), rojo (error) y verde
  (entregado). Todos MUST contrastar al menos 3:1 contra el blanco de la
  tarjeta, y ninguno puede ser un gris, que se leería como "deshabilitado". Con
  estas reglas entran **siete** colores bien separados (research D2).
- **FR-004**: Al asignar, el sistema MUST elegir **el primer color de la lista
  que ninguna cuenta tenga**.
- **FR-004a**: Si todos los colores de la lista están asignados, el sistema MUST
  generar uno nuevo: **el más distinto posible de todos los asignados**, bajo
  las mismas exclusiones de FR-003.
- **FR-004b**: **Dos cuentas MUST NOT tener nunca el mismo color**, tampoco si se
  registran al mismo tiempo.
- **FR-005**: El color de una cuenta MUST NOT cambiar por el alta, la edición o
  la baja de ninguna otra cuenta.
- **FR-006**: Las cuentas que al desplegar este feature ya tienen **el perfil
  completo** MUST quedar **sin color**, y editar su perfil no se lo asigna. Una
  cuenta que existía sin haber completado el perfil y lo completa después
  **se está registrando**, así que recibe color por FR-002 (research D4).
- **FR-007**: La app del repartidor MUST mostrar en la tarjeta de cada pedido
  una **franja gruesa del color de la cuenta que creó el pedido**, en las tres
  pestañas (Pendientes, En curso, Entregados).
- **FR-008**: Un pedido de una cuenta sin color, o con un color que no se puede
  interpretar, MUST verse **idéntico a hoy**: sin franja, sin hueco y sin
  espacio reservado.
- **FR-009**: La franja MUST NOT confundirse con el borde que marca la tarjeta
  destacada. Una tarjeta puede tener las dos cosas a la vez y se tienen que leer
  por separado.
- **FR-010**: La franja MUST NOT hacer crecer la tarjeta de forma apreciable.
  El alto de la tarjeta es una decisión de `012` (que entren dos y media y
  siempre haya una acción cerca del pulgar) y este feature no la reabre.
- **FR-011**: El nombre del remitente, el rótulo "ENVÍA" y el resto de la
  tarjeta MUST quedar como están.
- **FR-012**: Una versión de la app que no conozca el color MUST seguir
  funcionando sin cambios.
- **FR-013**: El repo MUST documentar cómo se colorean a mano cuentas que ya
  existen (el caso de las tres cuentas reales) **sin contener ningún dato de
  esas cuentas**: ni nombres, ni correos, ni nombres comerciales, ni
  identificadores que se usen sólo para ellas.
- **FR-014**: El color MUST NOT mostrarse al cliente ni en ninguna pantalla de
  la web. Es una ayuda de lectura para el repartidor.

### Key Entities

- **Cuenta de cliente**: gana un atributo nuevo, **su color**. Es opcional, se
  asigna una sola vez al completar el perfil y se guarda en hexadecimal. No
  participa de ningún cálculo: ni del precio, ni de la zona, ni del tablero.
- **Lista de colores**: la lista fija y ordenada de códigos hex de la que salen las
  primeras asignaciones. **"Paleta"**, en este spec, es el conjunto de colores
  posibles: esta lista más los que se generan cuando se agota. Cuando se agota, los colores siguientes se generan.
  Es parte del producto, no un dato de la base, y **no guarda qué color está
  usado**: eso se mira en las cuentas al momento de asignar. Agregarle un color
  no cambia los colores ya asignados.
- **Color de la cuenta**: único entre todas las cuentas. No hay dos cuentas con
  el mismo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con pedidos de las tres cuentas reales en pantalla, una persona
  que no conoce a los clientes puede agrupar las tarjetas por cliente **sin
  leer ningún texto**, sólo por la franja.
- **SC-002**: El 100% de las tarjetas de cuentas sin color se ven igual que
  antes del feature.
- **SC-003**: En la pantalla de Pendientes del teléfono de Mateo siguen
  entrando las mismas tarjetas que antes del feature.
- **SC-004**: Una cuenta registrada después del feature tiene color sin que
  nadie intervenga, y lo conserva después de editar su perfil.
- **SC-005**: Ninguna cuenta comparte color con otra, sin importar cuántas
  haya ni cuándo se registren.
- **SC-006**: El repositorio no contiene ningún dato de las tres cuentas reales
  después de colorearlas.

## Assumptions

Son decisiones tomadas por defecto al escribir el spec. Se pueden revertir en
el clarify.

- **Nadie cambia el color desde la interfaz.** Ni el cliente ni Diego tienen una
  pantalla para elegirlo. Si hace falta cambiar uno, es la misma operación
  manual de la historia 3.
- **"Registrarse" es completar el perfil**, no el primer ingreso con Google. Una
  cuenta que entró y nunca cargó nombre y teléfono no es un cliente y no gasta
  un color.
- **La paleta no depende del modo oscuro.** La app hoy usa sólo tema claro.
- **El tablero no muestra el color.** Cuenta pedidos y no tiene tarjetas.
- **El precio no se toca.** La constitución prohíbe leer esa columna, y este
  feature no tiene motivo para acercarse.

## Dependencias

- **Hay que publicar un APK nuevo y Diego lo tiene que instalar a mano.** No hay
  tienda. El feature no está entregado cuando el código llega a `master`, sino
  cuando el teléfono de Diego muestra las franjas.
- **Staging antes que producción.** La migración, la asignación al registrarse y
  la operación manual se prueban primero en staging, con la app apuntada ahí.
- **La operación manual sobre las tres cuentas reales se hace en producción
  después del deploy.** Sin ella, en producción no se ve ninguna franja hasta
  que se registre un cliente nuevo.
