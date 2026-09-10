# Feature Specification: El tablero de Diego

**Feature Branch**: `025-dashboard-de-diego`

**Created**: 2026-09-10

**Status**: Draft

**Input**: Pedido del cliente (Diego), transmitido por Mateo el 2026-09-10:
que entre solo él; que pueda ver *"un total de pedidos a lo modo histórico"*;
que pueda *"filtrar por cliente que tenga"*; y *"un reporte que él saca de
cuántos paquetes le hicieron por mes o por semana o por día"*.

Mateo confirmó el 2026-09-10 que eso es **todo** lo que Diego pidió y que no hay
nada adicional escrito en la sección MODIFICACIONES del documento del cliente.

## Lo que este feature es, dicho antes de que crezca

Es **la última pieza** de la tanda de MODIFICACIONES, y la que más fácil se
convierte en otra cosa. "Dashboard" es una palabra que arrastra un producto
entero: tarjetas de métricas, tendencias, comparativas contra el mes anterior,
gráficos. **Nada de eso lo pidió Diego, y el Principio III existe para este caso
exacto**: es un operador solo, no una plataforma. No hay equipo que mirar ni
volumen que agregar.

Lo que pidió son **tres números y un filtro**, y este spec no agrega un cuarto.
Si al verlo Diego pide más, eso es un feature siguiente con su propia
conversación — no una suposición nuestra hoy.

**Lo que hace que valga la pena igual**: hoy Diego no tiene forma de contestar
"¿cuántos paquetes moví este mes?" sin contarlos a mano en la app. La app lista
pedidos para trabajar; no cuenta.

## La regla que no se toca, y ahora hay evidencia dura

**Este tablero NO muestra plata. Ni un monto, ni un total facturado, ni un
promedio por envío.**

El Principio V (6.0.0) prohíbe leer la columna `precio` para reportes, totales,
agregados o un tablero — y `024`, que devolvió el precio al formulario, **no
levantó una palabra de esa prohibición**: la dejó escrita textual.

Y ya no es un argumento teórico. Medido el 2026-09-10 contra la base de
desarrollo: **hay 6 pedidos con `zona_id = 1` y `precio = 200`, cuando la zona 1
vale 150** — 200 es el precio de la zona 2 — y son **posteriores** al cambio de
retiro a entrega del 2026-08-22. La columna guarda números que no corresponden a
la zona del pedido. Un total facturado calculado sobre eso daría una cifra falsa
con aire de exactitud, que es peor que no darla.

Si Diego quiere plata en pantalla, **es una enmienda a la constitución, no un
feature**, y hay que arreglar antes de dónde sale el número.

Lo que pidió, felizmente, es **conteo**. Contar entra sin tocar nada.

## Lo que este feature NO hace

- **No muestra montos** de ningún tipo, ni lee la columna `precio`.
- **No inventa métricas que nadie pidió**: sin tendencias, sin comparación contra
  el período anterior, sin promedios, sin gráficos de torta, sin "tu mejor mes".
- **No toca la app de Diego.** Sigue siendo la herramienta de la calle.
- **No cambia el estado de ningún pedido.** Es de solo lectura; cambiar estados
  ya existe y vive en la app.
- **No genera rutas ni automatiza logística.** El Principio V lo mantiene manual.
- **No crea una entidad "cliente".** Los pedidos cuelgan de la cuenta que los
  creó, y eso es lo que se agrupa.
- **No cambia cómo se borran los pedidos**, aunque el borrado sea lo que rompe la
  palabra "histórico" — ver la clarificación de la User Story 1.

## Clarifications

### Sesión 2026-09-10

- **¿Qué es el "total histórico" si el borrado de `022` es físico?** → **Se
  llama por lo que realmente es**: el total de pedidos **registrados hoy**, y se
  acepta que **baje** cuando un cliente da de baja el suyo. No se empieza a
  llevar registro de bajas: eso tocaría el borrado de `022` y agrandaría el
  feature.
  **La consecuencia es de copy y hay que decirla**: la pantalla **no puede usar
  la palabra "histórico"**, aunque sea la que usó Diego, porque el número no lo
  es. Un rótulo honesto que baje se explica solo; uno que diga "histórico" y baje
  parece un defecto y va a costar una conversación. (FR-004, FR-004a)
- **¿El reporte por período cuenta pedidos o paquetes?** → **Los dos**, en dos
  columnas de la misma fila. Cuesta casi lo mismo que uno solo y elimina la
  ambigüedad de raíz: Diego dijo "pedidos" en un punto y "paquetes" en el otro, y
  las dos preguntas son legítimas —viajes que hizo contra bultos que movió—.
  (FR-008)
- **¿"Cliente" es la cuenta o el remitente escrito en cada pedido?** → **La
  cuenta.** Es una identidad real, estable y única, y es lo que el sistema ya
  sabe agrupar. El `remitente_nombre` es texto libre que la misma persona puede
  escribir de tres formas distintas, así que agruparía mal y en silencio. Se
  descartó también mostrar el remitente más frecuente como etiqueta: es
  información que hay que mantener y nadie pidió. (FR-009)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cuántos pedidos van (Priority: P1)

Diego abre el tablero desde la computadora, con su cuenta, y lo primero que ve
es cuántos pedidos hay en total.

**Why this priority**: Es el número que pidió primero y el que no existe hoy en
ninguna pantalla. Si se hace solo esto, ya contesta una pregunta que hoy se
contesta contando a mano.

**Independent Test**: Entrar con la cuenta admin y comprobar que el total
coincide con la cantidad de pedidos en la base.

**Acceptance Scenarios**:

1. **Given** Diego con sesión iniciada y cuenta administradora, **When** abre el
   tablero, **Then** ve el total de pedidos.
2. **Given** el mismo tablero, **When** lo mira, **Then** **no aparece ningún
   monto en pesos** en ninguna parte de la pantalla.
3. **Given** una persona con sesión que **no** es administradora, **When**
   intenta abrir el tablero, **Then** no lo ve y no obtiene ningún dato de
   pedidos ajenos.
4. **Given** una persona sin sesión, **When** intenta abrir el tablero, **Then**
   se la manda a iniciar sesión.
5. **Given** que todavía no hay ningún pedido, **When** Diego abre el tablero,
   **Then** ve un cero y un texto que lo explica, no una pantalla vacía ni un
   error.

**El problema de la palabra "histórico", y es real.** Desde `022` un cliente
puede **dar de baja** su pedido mientras está pendiente, y ese borrado es
**físico**: `DELETE FROM pedidos` (`backend/internal/pedidos/pedido.go:835`). La
fila desaparece. O sea que **el "total histórico" puede bajar de un día para el
otro**, y un número que se llama histórico y baja es un número que miente. Hoy no
existe ningún registro de los pedidos borrados.

**Decidido**: el número se muestra como **pedidos registrados**, no como
histórico, y se acepta que baje. Ver § Clarifications. El escenario 6 es la
guarda de esa decisión:

6. **Given** el tablero mostrando un total, **When** Diego lee el rótulo,
   **Then** **no dice "histórico"** ni ninguna palabra que prometa que el número
   no puede bajar. Sin este escenario, la decisión se cumple en el dato y se
   pierde en la pantalla, que es donde importa.

---

### User Story 2 - Cuántos paquetes por período (Priority: P1)

Diego quiere saber cuántos paquetes movió este mes. Elige el período —día,
semana o mes— y ve el número de ese período.

**Why this priority**: Es el "reporte" que pidió, dicho con sus palabras:
*"cuántos paquetes le hicieron por mes o por semana o por día"*. Es también el
único de los tres que le dice algo sobre **su trabajo** y no sobre la base de
datos.

**Independent Test**: Elegir un mes con pedidos conocidos y comprobar que el
número coincide con lo cargado en ese mes.

**Acceptance Scenarios**:

1. **Given** Diego en el tablero, **When** elige ver por mes, **Then** ve, para
   cada mes con actividad, cuántos hubo.
2. **Given** el mismo tablero, **When** cambia a semana o a día, **Then** el
   corte cambia y los números siguen sumando lo mismo en el total.
3. **Given** un período sin actividad, **When** aparece en el corte, **Then** se
   muestra en cero o no se muestra, pero **nunca** se saltea sin que se note.
4. **Given** cualquiera de los tres cortes, **When** Diego lo mira, **Then** cada
   fila dice de qué período habla, sin ambigüedad de zona horaria.

**Paquetes y pedidos no son el mismo número.** Cada pedido lleva una `cantidad`
de paquetes, así que un mes con 20 pedidos puede ser 45 paquetes. Diego dijo
*"pedidos"* en un punto y *"paquetes"* en el otro.

**Decidido**: se muestran **los dos**, en dos columnas de la misma fila. Ver
§ Clarifications. Escenario que lo sostiene:

5. **Given** un período con pedidos de más de un paquete, **When** Diego mira la
   fila, **Then** ve **dos números distintos** —pedidos y paquetes— y cada
   columna dice cuál es. Si los dos números fueran siempre iguales, el corte
   estaría sumando pedidos en las dos columnas y nadie lo notaría.

---

### User Story 3 - Filtrar por cliente (Priority: P2)

Diego quiere ver los números de un cliente en particular: cuántos pedidos le
hizo esa persona, y cuántos paquetes.

**Why this priority**: Lo pidió tercero y depende de que los dos números
anteriores existan. Es también el que menos sentido tiene con el volumen de hoy
—una docena de pedidos entre pocas cuentas— y el que más lo va a ganar con el
tiempo.

**Independent Test**: Elegir un cliente conocido y comprobar que los números
bajan a los de esa persona y que el resto desaparece.

**Acceptance Scenarios**:

1. **Given** Diego en el tablero, **When** elige un cliente, **Then** el total y
   el corte por período pasan a ser los de ese cliente.
2. **Given** un cliente elegido, **When** Diego lo quita, **Then** vuelve a ver
   todo sin recargar ni volver a configurar el período.
3. **Given** un cliente sin pedidos, **When** se lo elige, **Then** se ven ceros
   y un texto que lo dice, no una pantalla rota.
4. **Given** dos clientes distintos con el mismo nombre, **When** Diego elige
   uno, **Then** ve solo los de esa persona y puede distinguirlos entre sí.

**No existe una entidad "cliente".** Los pedidos cuelgan de `usuario_id`, la
cuenta que los creó. Cada pedido guarda además un `remitente_nombre` que la
persona puede cambiar pedido a pedido.

**Decidido**: "cliente" es **la cuenta**. Ver § Clarifications. La consecuencia
que Diego puede notar está en el escenario 5:

5. **Given** una cuenta que despachó pedidos con dos nombres de remitente
   distintos, **When** Diego filtra por esa cuenta, **Then** ve **todos** sus
   pedidos juntos, aunque los remitentes se llamen distinto. Es lo correcto —es
   una sola persona— pero puede sorprenderlo si él los pensaba como dos clientes.

---

### Edge Cases

- **La cuenta de Diego no está en la lista de administradores en producción.** El
  tablero no lo dejaría entrar a él. Es configuración, no código, y es la falla
  más probable del feature entero — ver *Dependencias*.
- **Un cliente da de baja un pedido mientras Diego mira el tablero.** El número
  baja al recargar. Sin registro de bajas no hay nada que explique la diferencia.
- **Pedidos con fecha de retiro futura.** El corte por período tiene que decir
  con qué fecha corta —cuándo se cargó, o para cuándo es el retiro—, porque no son
  la misma pregunta.
- **Zona horaria.** "Cuántos hoy" depende de dónde empieza el día. Montevideo, no
  UTC: un pedido de las 22:00 tiene que caer en su día y no en el siguiente.
- **Una sola cuenta con casi todos los pedidos.** Es el caso real hoy, y hace que
  el filtro por cliente parezca roto cuando funciona bien.
- **Volumen mínimo.** Con una docena de pedidos, cualquier corte por día son doce
  filas de un dígito. El tablero tiene que verse razonable así, no solo con
  volumen.

## Requirements *(mandatory)*

### Functional Requirements

**Quién entra**

- **FR-001**: El tablero MUST ser accesible **solo** a las cuentas
  administradoras, usando el mecanismo que ya existe. Una cuenta común con sesión
  MUST NOT verlo ni obtener por él datos de pedidos ajenos.
- **FR-002**: Sin sesión, el acceso MUST encaminar a iniciar sesión, sin filtrar
  ningún dato agregado por el camino.
- **FR-003**: La negativa a una cuenta no administradora MUST NOT revelar que el
  tablero existe más de lo que ya revela cualquier ruta protegida.

**Los números**

- **FR-004**: El tablero MUST mostrar el total de pedidos **registrados**, y ese
  total MUST poder bajar cuando un cliente da de baja el suyo. No se lleva
  registro de las bajas.
- **FR-004a**: El rótulo de ese total MUST NOT decir "histórico" ni prometer de
  ninguna otra forma que el número no puede bajar. Es la mitad de FR-004 que vive
  en la pantalla, y la que se pierde si no se escribe.
- **FR-005**: El tablero MUST mostrar un corte por período con tres
  granularidades —**día, semana y mes**— elegibles por Diego.
- **FR-006**: Cada fila del corte MUST identificar sin ambigüedad de qué período
  habla.
- **FR-007**: Los períodos MUST calcularse en la zona horaria de Montevideo, no
  en UTC.
- **FR-008**: Cada fila del corte MUST mostrar **dos** números: cuántos
  **pedidos** y cuántos **paquetes** —la suma de la cantidad de cada pedido—, con
  cada columna rotulada. Los dos, no uno.

**El filtro**

- **FR-009**: Diego MUST poder acotar los números a un cliente, entendiendo por
  cliente **la cuenta que creó los pedidos**. El sistema MUST NOT agrupar por el
  nombre del remitente escrito en cada pedido: es texto libre y agruparía mal en
  silencio.
- **FR-010**: Quitar el filtro MUST devolver la vista completa sin perder la
  granularidad de período elegida.
- **FR-011**: Un cliente sin pedidos MUST mostrar ceros y un texto que lo
  explique, no una pantalla vacía.

**Nada de plata**

- **FR-012**: Ninguna pantalla de este feature MUST mostrar un monto, un total
  facturado, un promedio por envío ni ninguna cifra en pesos.
- **FR-013**: Ninguna consulta de este feature MUST leer la columna `precio`.
  Esto no es una consecuencia de FR-012: es una prohibición sobre el **dato**, y
  sigue valiendo aunque el número no se muestre.
- **FR-014**: MUST existir una prueba automática que falle si este feature
  empieza a leer `precio` o a mostrar un monto.

**Vacíos y errores**

- **FR-015**: Sin ningún pedido, el tablero MUST mostrar ceros con un texto que
  lo explique.
- **FR-016**: Si los datos no se pueden traer, el tablero MUST decirlo con un
  mensaje legible y MUST NOT mostrar ceros como si fueran el dato real. Un cero
  falso es peor que un error visible.

**Alcance**

- **FR-017**: El feature MUST NOT cambiar el estado de ningún pedido ni ofrecer
  acciones de escritura.
- **FR-018**: El feature MUST NOT modificar la app Android.

### Key Entities

- **Pedido**: ya existe. Aporta la fecha con que se corta, la `cantidad` de
  paquetes y la cuenta que lo creó. **Su columna `precio` no se lee.**
- **Cuenta (cliente)**: ya existe. Es lo que agrupa los pedidos. No se crea una
  entidad nueva.
- **Período**: día, semana o mes en zona horaria de Montevideo. No es dato
  guardado: es cómo se agrupa al mirar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diego contesta "cuántos paquetes moví este mes" abriendo una
  pantalla, sin contar a mano y sin pedirle nada a nadie.
- **SC-002**: Los números del tablero coinciden con lo que hay en la base: el
  total, y las dos columnas de cada fila de cada uno de los tres cortes.
- **SC-002a**: En un período con al menos un pedido de más de un paquete, la
  columna de paquetes es **mayor** que la de pedidos. Si fueran siempre iguales,
  el corte estaría contando pedidos en las dos columnas y nadie lo notaría.
- **SC-002b**: El rótulo del total no dice "histórico", y un pedido dado de baja
  hace bajar el número sin que la pantalla parezca rota.
- **SC-003**: Recorriendo el tablero entero, en cualquier corte y con o sin
  filtro, **no aparece ningún monto en pesos**.
- **SC-004**: Una cuenta con sesión que no es administradora no obtiene ningún
  dato del tablero, ni en pantalla ni por el camino que la pantalla usa.
- **SC-005**: Con la base vacía, el tablero muestra ceros explicados y no una
  pantalla rota ni un error.
- **SC-006**: Un pedido cargado a las 22:00 hora de Montevideo cuenta en ese día
  y no en el siguiente.
- **SC-007**: Una prueba automática falla si el feature lee `precio` o muestra un
  monto.

## Assumptions

- **Diego mira esto sentado, en una computadora**, no en la calle. Decidido por
  Mateo el 2026-09-10: por eso va en la web y no en la app.
- **Se muestran exactamente los tres números que pidió**, y ninguno más. Sin
  tendencias, comparativas ni gráficos. Si al verlo pide más, es la conversación
  siguiente (Principio III).
- **El volumen de hoy es de una docena de pedidos.** Cualquier criterio que se
  mida con un cronómetro o que dependa de agregación pesada no diría nada a este
  volumen. Ya pasó con SC-001 de `023`, que quedó sin medir y está en el tracker;
  este spec evita repetirlo no poniendo criterios de tiempo.
- **Los pedidos dados de baja no dejan rastro.** El borrado de `022` es físico.
  Esto no se cambia acá salvo que la clarificación de la User Story 1 lo pida.
- **No hay pedidos anteriores al producto**: el conteo empieza donde empieza la
  base, y no hay histórico de papel que incorporar.

## Dependencias

- **La cuenta de Diego tiene que estar en la lista de administradores en
  producción.** El mecanismo existe y ya gatea la lista de pedidos, pero
  **este spec no da por hecho que su mail esté cargado en el entorno
  desplegado**, solo en el local. Es configuración, no código, y es la forma más
  probable de que el feature "no funcione" el día que se lo mostremos. Se verifica
  antes de dar el plan por hecho.
- **Feature `024`, en el PR #37.** No hay dependencia de código, pero sí de
  documento: `024` enmendó el Principio V a 6.0.0 **sin levantar** la prohibición
  de leer `precio`, y este spec se apoya en esa versión. Esta rama sale de `024`;
  cuando se mergee, rebasa contra `master`.
- **La constitución no se enmienda para este feature.** Es la diferencia con
  `024`, y conviene que quede escrito: contar pedidos y paquetes no toca ningún
  principio. **Si en algún momento este tablero necesita mostrar plata, ahí sí
  hay enmienda**, y antes hay que arreglar de dónde sale el número.
