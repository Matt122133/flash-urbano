# Feature Specification: El dia de trabajo, del mas viejo al mas nuevo

**Feature Branch**: `021-orden-de-la-app`

**Created**: 2026-09-05

**Status**: Draft

**Input**: Mateo, el 2026-09-05, trayendo la lista que junto con Diego: *"luego
el orden de la app, es mas que nada el ordenamiento, los mas nuevos que queden
abajo, y los mas viejos arriba, creo que ahora se estan ordenando por fecha de
retiro si no me equivoco. pero eso fue desicion de Diego. asique ordenemoslo
asi"*. En el documento del cliente figura en **MODIFICACIONES** como *"orden de
la app, los mas nuevos abajo, los mas viejos arriba"*.

Dos decisiones suyas del mismo dia, sobre opciones puestas por escrito:

- **Se ordena por fecha de creacion**, no por fecha de retiro.
- **Las tres pestañas igual**, Entregados incluida.

## El problema: la lista no esta en el orden en que se trabaja

Hoy `Todos()` ordena `retiro_fecha DESC, retiro_hora DESC`
(`backend/internal/pedidos/pedido.go:516`), o sea el retiro mas lejano primero.
Diego abre la app y lo primero que ve es lo ultimo que entro.

**Y el segundo criterio no ordena nada.** Desde `014` el sitio manda
`retiro_hora` fija en `"16:00"` para todos los pedidos: es relleno, no un dato
que alguien eligio, y la constitucion 5.1.0 prohibe leerlo. Asi que dentro de un
mismo dia el orden que hoy ve Diego **es el que la base tenga ganas de
devolver** — no hay desempate.

## Lo que se cambia, y es menos de lo que parece

**Una linea de SQL.** La app **no reordena nada**, y eso no es casualidad:
`agrupar()` usa `groupBy`, que preserva el orden de origen, y hay una prueba
—`la app no reordena los pedidos`— que lo afirma a proposito, porque decidir un
orden de visita es el feature de ruta que todavia no existe. El orden que ve
Diego es literalmente el que manda el servicio.

Consecuencias que conviene tener presentes:

- **El APK de Diego no hay que reinstalarlo.** El cambio le llega solo con el
  proximo despliegue del backend, sin que el toque nada. Para una app que se
  instala a mano, eso no es un detalle.
- **Cambia las tres pestañas de una vez.** El servicio devuelve **una lista
  plana** y la app la parte en Pendientes / Tomados / Entregados. No hay forma de
  darle un orden distinto a cada seccion sin romper ese reparto — sea haciendo
  que el servicio devuelva secciones, sea haciendo que la app ordene, que es
  justo lo que la prueba de arriba prohibe.

**El cliente eligio que las tres vayan igual**, sabiendo el costo: en Entregados,
lo que Diego acaba de entregar queda al fondo, y esa lista solo crece. Se
registra como decision tomada y no como descuido; si molesta, se revisa, y ahi
la conversacion es sobre el reparto en secciones.

## Lo que NO se cambia

- **`PorUsuario()`, la lista del cliente en *Mis pedidos*.** Sigue
  `creado_en DESC`, el mas reciente primero. Es un historial personal, no una
  cola de trabajo, y el pedido de Diego era sobre su app. Cambiarla de paso
  seria cambiar una pantalla que nadie pidio.
- **La app.** Ni una linea.
- **`retiro_fecha`.** Se sigue guardando y se sigue mostrando; deja de ordenar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diego abre la app y arriba esta lo mas viejo (Priority: P1)

Diego abre la app a la mañana. El pedido que entro primero esta arriba de todo, y
el que acaba de entrar, al final.

**Why this priority**: Es el feature entero.

**Independent Test**: Crear tres pedidos en orden conocido, pedir la lista de
administracion y comprobar que vuelven del mas viejo al mas nuevo.

**Acceptance Scenarios**:

1. **Given** tres pedidos creados en momentos distintos, **When** se pide la
   lista de administracion, **Then** vuelven ordenados por fecha de creacion
   ascendente: el primero que se creo, primero.
2. **Given** dos pedidos creados el mismo dia con la misma fecha de retiro,
   **When** se pide la lista, **Then** el que se creo antes viene antes — el
   orden **no depende** de `retiro_hora`, que es un valor fijo.
3. **Given** pedidos con fechas de retiro que no siguen el orden de creacion,
   **When** se pide la lista, **Then** manda la creacion y no el retiro.

---

### User Story 2 - Las tres pestañas quedan en el mismo orden (Priority: P2)

Pendientes, Tomados y Entregados muestran cada una sus pedidos del mas viejo al
mas nuevo.

**Why this priority**: P2 porque sale gratis de US1 — pero hay que **comprobarlo**,
no suponerlo: depende de que el reparto de la app preserve el orden.

**Independent Test**: Agrupar una lista ordenada y comprobar que cada seccion
sale en el mismo orden relativo.

**Acceptance Scenarios**:

1. **Given** una lista ordenada por creacion ascendente con pedidos de los tres
   estados, **When** la app la reparte en secciones, **Then** dentro de cada
   seccion el orden relativo es el mismo que traia la lista.
2. **Given** cualquier lista, **When** la app la reparte, **Then** **no la
   reordena** por su cuenta — la prueba que ya existe sigue en verde.

---

### User Story 3 - El cliente sigue viendo su historial como antes (Priority: P2)

En *Mis pedidos*, el cliente sigue viendo primero lo mas reciente.

**Why this priority**: P2 y es una **guarda**, no una funcion nueva: lo que
protege es que este cambio no se derrame a una pantalla que nadie pidio tocar.

**Independent Test**: Pedir la lista propia y comprobar que sigue descendente.

**Acceptance Scenarios**:

1. **Given** varios pedidos de una misma persona, **When** pide su historial,
   **Then** vienen del mas reciente al mas viejo, como hasta ahora.

---

### Edge Cases

- **Dos pedidos creados en el mismo instante.** `creado_en` tiene resolucion de
  microsegundos y los pedidos entran de a uno, asi que en la practica no pasa. Si
  pasara, el orden entre esos dos es indistinto y no hay nada que decidir.
- **La lista vacia.** Sigue serializandose como `[]` y no como `null`.
- **Un pedido cuyo retiro ya paso.** Queda arriba, que es lo correcto: es el mas
  viejo y el que mas tiempo lleva esperando.
- **La lista de Entregados creciendo.** Con el orden ascendente, lo ultimo
  entregado queda al fondo. Es la consecuencia aceptada de la decision del
  cliente, y **se agrava con el tiempo** — vale la pena mirarla de nuevo cuando
  haya volumen real.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La lista de administracion MUST devolver los pedidos ordenados por
  **fecha de creacion ascendente**: el mas viejo primero.
- **FR-002**: El orden MUST NOT depender de `retiro_hora`, que desde `014` es un
  valor fijo para todos los pedidos y que la constitucion prohibe leer.
- **FR-003**: El orden MUST ser **total y determinista**: dos llamadas seguidas
  sobre los mismos datos devuelven la misma secuencia.
- **FR-004**: La lista propia del cliente (*Mis pedidos*) MUST seguir ordenada
  del mas reciente al mas viejo, sin cambios.
- **FR-005**: La app MUST NOT ordenar por su cuenta. El orden lo decide el
  servicio, y la prueba que ya lo afirma MUST seguir en verde.
- **FR-006**: El cambio MUST NOT requerir reinstalar el APK.
- **FR-007**: Las tres secciones MUST quedar en el mismo criterio ascendente,
  Entregados incluida, por decision del cliente del 2026-09-05.
- **FR-008**: MUST existir una prueba automatica que afirme el orden. Hoy la
  unica prueba de `Todos()` **cuenta filas y no mira el orden**, asi que una
  regresion pasaria sin que nada la detecte.

### Key Entities

- **Pedido** — ya existe. Lo unico que este feature usa es `creado_en`, que la
  base pone sola al insertar y que nadie edita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al abrir la app, el pedido que lleva mas tiempo esperando esta
  arriba de todo.
- **SC-002**: Dos pedidos del mismo dia salen siempre en el mismo orden entre si,
  en llamadas repetidas.
- **SC-003**: El historial del cliente sigue mostrando primero lo mas reciente.
- **SC-004**: Diego ve el cambio **sin instalar nada**.

## Assumptions

- **`creado_en` es la hora del servidor y no la del telefono.** La pone la base
  al insertar, asi que no depende del reloj de nadie.
- **La zona horaria no entra en juego para ordenar.** Se comparan instantes entre
  si; que se muestren en hora de Montevideo es otro asunto y no cambia.
- **El volumen no obliga a paginar todavia.** La fila `High` del 2026-08-26 del
  tracker ya anota que esta lista viene sin paginar y que crece; este feature
  **no lo resuelve ni lo empeora**, sólo cambia el `ORDER BY`.
- **Las pruebas que tocan Postgres se saltean solas sin `TEST_DATABASE_URL`**, y
  la prueba de FR-008 es una de esas: "todo verde" no dice nada del orden si no
  se miro el conteo de salteadas.
