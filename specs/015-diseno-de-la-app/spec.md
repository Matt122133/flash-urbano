# Feature Specification: La app de Diego, rediseñada para la calle

**Feature Branch**: `015-diseno-de-la-app`

**Created**: 2026-08-30

**Status**: Draft

**Input**: Pedido del cliente sobre una maqueta que ya miró y aprobó el
2026-08-30. Es la fila del tracker del 2026-08-26, anotada el mismo día que
`012` se instaló en su teléfono: Diego la vio **"medio fea"**, y la quiere más
moderna, más colorida, con más devolución de lo que está pasando, y más
accesible — puntualmente **dónde apoyar el dedo**.

## Qué se está arreglando, dicho sin suavizar

`012` entregó una app que **funciona y es incómoda**. No es una opinión estética
suelta: el propio plan de `012` escribió desde el principio que esto es una
herramienta de calle, que se usa **con una mano mientras la otra tiene un
paquete**, y aun así entregó tres cosas que pelean con eso.

**Las secciones se pasan desplazando.** Pendientes y Tomados comparten una
pantalla que scrollea, y Entregados vive detrás de un botón **al final de esa
lista** — o sea que después de desplazar queda arriba de todo, el punto más lejos
del pulgar de cualquier teléfono. Desplazar tiene que servir para recorrer
paquetes, no para cambiar de sección.

**La acción está donde no se llega.** El botón que mueve el estado cuelga al
final de una tarjeta de unos 380 px. Con una tarjeta así, cuando la acción está
a la vista está arriba en la pantalla.

**Y la app no se parece al negocio.** Usa el morado por defecto de Material 3,
sin una sola pieza de la marca, mientras el sitio es azul y naranja.

## Lo que este feature NO hace

- **No toca el backend ni la web.** Ni una migración, ni un endpoint, ni una
  pantalla del sitio.
- **No cambia el modelo de estados.** Las tres secciones ya existen y ya mapean
  a los tres estados que el servicio conoce.
- **No agrega la ruta ni el panel.** Siguen esperando que el cliente defina qué
  significa "ruta económica".
- **No agrega quién recibió el paquete.** El cliente lo pidió el mismo día, con
  nombre y cédula de quien firma. **Es `016`**, y se separa a propósito: lleva
  una migración sobre la tabla que tiene los pedidos reales de Diego, y una
  decisión de privacidad sin resolver. Meterlo acá bloquearía un rediseño sin
  riesgo detrás del cambio más riesgoso que hay.
- **No esconde nada detrás de un toque.** Ver más abajo, FR-009.

## Clarifications

### Sesión 2026-08-30

- **¿Badge en las tres pestañas?** → **No: solo en Pendientes y En curso.**
  Entregados es un archivo que solo crece, y un número que sube para siempre deja
  de mirarse en una semana — de paso le quita fuerza a los dos que sí importan.
  (FR-004)
- **¿Signo de pregunta para Pendientes?** → **No.** En Android el `?` significa
  *ayuda*, y se lee así al pasar. Va una caja. El mapa para En curso y la bandera
  a cuadros para Entregados se mantienen: se leen sin pensar. (FR-003)
- **¿De dónde sale la paleta?** → **Del sitio, sin inventar nada**: azul
  `#1d4ed8`, azul oscuro `#1e3a8a`, naranja `#f97316`. Es la misma empresa.
  (FR-006)
- **¿Qué pasa con el texto crudo del estado, que `012` muestra siempre?** →
  **Se muestra solo cuando no coincide con la pestaña.** Antes de decidir se
  comprobó el modelo: `pedidos.estado` es `NOT NULL DEFAULT 'creacion'`
  (`0003_pedidos.sql:83`) y `seccionDe()` manda `creacion` a Pendientes, así que
  **todo pedido nace en Pendientes** y un estado desconocido ya no puede venir de
  un pedido nuevo. Solo aparecería si el servicio sumara un cuarto estado antes
  que la app — que es exactamente el caso que `012` quiso cubrir eligiendo texto
  en vez de un enum. Mostrarlo condicionalmente cumple ese motivo sin pagar una
  línea en cada tarjeta. (FR-011)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar de sección sin desplazar (Priority: P1)

Diego abre la app parado en la vereda. Ve lo que tiene pendiente. Toca abajo y
pasa a lo que lleva encima. Toca de nuevo y ve lo que ya cerró. En ningún
momento desplaza para cambiar de sección: desplazar es solo para recorrer
paquetes.

**Why this priority**: Es la queja principal y la que ordena todo lo demás. Si
se hace solo esto, la app ya se usa distinto.

**Independent Test**: Abrir la app con pedidos en las tres secciones y pasar
entre ellas tocando abajo, con una sola mano.

**Acceptance Scenarios**:

1. **Given** la app abierta, **When** Diego mira la pantalla, **Then** ve una
   barra de tres destinos en el borde inferior, dentro del alcance del pulgar.
2. **Given** cualquier sección, **When** toca otro destino, **Then** la lista
   cambia sin salir de la pantalla y sin volver atrás.
3. **Given** hay pedidos pendientes y en curso, **When** mira la barra, **Then**
   Pendientes y En curso muestran cuántos hay, y Entregados **no muestra
   número**.
4. **Given** una lista larga, **When** desplaza hasta el final, **Then** la barra
   de abajo **sigue en su lugar**.

---

### User Story 2 - Mover un pedido sin estirar la mano (Priority: P1)

Diego está en la puerta del remitente con el paquete en la mano. Toca la acción
del pedido que tiene delante, sin recolocar el teléfono ni usar la otra mano. Si
se equivocó, deshace.

**Why this priority**: Es la otra mitad del problema del pulgar, y es la acción
que hace todo el día.

**Independent Test**: Con tres pedidos en la lista, mover el segundo sin cambiar
de mano, y deshacerlo.

**Acceptance Scenarios**:

1. **Given** la lista de pendientes, **When** Diego mira una tarjeta completa,
   **Then** su acción está a la vista **sin desplazar**.
2. **Given** una tarjeta a la vista, **When** toca su acción, **Then** el pedido
   cambia de sección y aparece un aviso con **Deshacer**.
3. **Given** ese aviso, **When** toca Deshacer, **Then** el pedido vuelve donde
   estaba.
4. **Given** un teléfono común, **When** Diego usa la app con una mano, **Then**
   toda acción que mueva un pedido queda dentro del alcance del pulgar.

---

### User Story 3 - Que se lea al sol y se parezca a Flash Urbano (Priority: P2)

Diego usa la app afuera, de día. Los textos se leen, los toques se aciertan, y
la app se ve de la misma empresa que el sitio.

**Why this priority**: Es lo que el cliente nombró primero —"medio fea"— pero
llega después de lo que le duele al usarla.

**Independent Test**: Abrir la app afuera, de día, y leerla sin taparle el sol.

**Acceptance Scenarios**:

1. **Given** la app abierta, **When** Diego la mira, **Then** los colores son los
   de la marca y no queda morado por defecto en ninguna pantalla.
2. **Given** cualquier pantalla, **When** se mide el contraste del texto contra
   su fondo, **Then** cumple el mínimo de accesibilidad para texto normal.
3. **Given** cualquier pantalla, **When** se miden los elementos que se tocan,
   **Then** ninguno mide menos de 48 dp.
4. **Given** los dos teléfonos de una tarjeta, **When** Diego los mira, **Then**
   se ve que son tocables **sin tener que probar**.

---

### User Story 4 - Saber qué pasa cuando no pasa nada (Priority: P3)

Una sección vacía o un teléfono sin señal no dejan a Diego mirando una pantalla
en blanco preguntándose si se rompió.

**Why this priority**: Es la "más devolución de lo que está pasando" que pidió el
cliente. No bloquea el uso diario, pero es donde una app se siente rota.

**Independent Test**: Abrir una sección sin pedidos, y usar la app con el modo
avión puesto.

**Acceptance Scenarios**:

1. **Given** una sección sin pedidos, **When** Diego la abre, **Then** ve una
   explicación de por qué está vacía y qué puede hacer, no una pantalla en
   blanco.
2. **Given** el teléfono sin conexión, **When** Diego mira la app, **Then**
   **sigue viendo lo último que se bajó**, con un aviso visible de que no hay
   señal.
3. **Given** ese estado, **When** intenta mover un pedido, **Then** la app no lo
   deja y se ve que no lo deja, en vez de fallar al tocar.

---

### Edge Cases

- **Un estado que la app no conoce.** Hoy cae en Pendientes a propósito, y la
  tarjeta muestra el texto crudo para que se note. Con pestañas eso cambia de
  sentido: ver FR-011, que es la decisión abierta de este spec.
- **Muchos pedidos.** El número del badge tiene que seguir siendo legible con
  dos cifras; con tres, no puede romper la barra.
- **Una dirección muy larga.** No puede empujar el ancho de la tarjeta ni
  obligar a desplazarse de costado.
- **Un pedido sin teléfono.** El botón de llamar no puede quedar tocable ni
  parecer que lo está.
- **La barra de estado y la de navegación del sistema.** No pueden taparle nada
  a la app ni quedar pegadas al contenido — `012` ya entregó un título pegado a
  la barra de estado.

## Requirements *(mandatory)*

### Functional Requirements

**Navegación**

- **FR-001**: La app MUST tener una barra de navegación fija en el borde
  inferior con tres destinos: Pendientes, En curso, Entregados.
- **FR-002**: Cambiar de destino MUST NOT requerir desplazar, volver atrás, ni
  salir de la pantalla. La barra MUST quedar visible con la lista desplazada.
- **FR-003**: Cada destino MUST llevar un ícono que se lea sin texto: una caja
  para Pendientes, una ruta para En curso, una bandera a cuadros para Entregados.
  MUST NOT usarse un signo de pregunta.
- **FR-004**: Pendientes y En curso MUST mostrar cuántos pedidos tienen.
  Entregados MUST NOT mostrar un número.
- **FR-005**: Las tres secciones MUST seguir derivándose de los mismos estados
  que la app ya conoce. El modelo de estados MUST NOT cambiar.

**Que se lea y se toque**

- **FR-006**: La app MUST usar la paleta de la marca —la misma del sitio— y
  MUST NOT quedar con el color por defecto del framework en ninguna pantalla.
- **FR-007**: Todo elemento que se toca MUST medir 48 dp o más en su lado menor.
- **FR-008**: Todo texto MUST cumplir el contraste mínimo de accesibilidad para
  su tamaño, contra el fondo sobre el que se dibuja.
- **FR-009**: La tarjeta MUST seguir mostrando **todo sin desplegar**: código,
  las dos direcciones, los dos teléfonos con su nombre, la cantidad y la fecha.
  **Nada de lo que Diego necesita en una puerta puede quedar detrás de un
  toque.**
- **FR-010**: Los dos teléfonos MUST verse tocables sin probarlos, y MUST seguir
  abriendo el marcador con el número puesto **sin llamar solos**.
- **FR-011**: El texto crudo del estado MUST mostrarse **solo cuando no
  corresponde a la sección en la que el pedido está listado**. En el caso normal
  la pestaña ya lo dice y la tarjeta no lo repite. **La decisión de `012` que
  esto ajusta sigue viva en lo que importaba**: un estado que la app no conoce
  cae en Pendientes y MUST verse que es raro, en vez de disimularse.

**La acción**

- **FR-012**: La acción que mueve un pedido MUST estar a la vista cuando su
  tarjeta lo está, sin desplazar.
- **FR-013**: Después de mover un pedido MUST aparecer un aviso con **Deshacer**,
  y deshacer MUST devolver el pedido a donde estaba.
- **FR-014**: La tarjeta MUST ocupar menos alto que hoy, lo suficiente para que
  entre más de una en pantalla en un teléfono común.

**Cuando no hay nada**

- **FR-015**: Cada sección vacía MUST explicar por qué está vacía y qué se puede
  hacer.
- **FR-016**: Sin conexión, la app MUST seguir mostrando lo último que bajó, con
  un aviso visible, y MUST impedir mover pedidos de forma que se vea antes de
  intentarlo.

**No regresiones**

- **FR-017**: Todo lo que `012` dejó andando MUST seguir andando: ver los pedidos
  agrupados, moverlos, deshacer, llamar a los dos teléfonos, ingresar, y que la
  sesión se renueve al usarse.
- **FR-018**: Nada de la app MUST quedar tapado por la barra de estado ni por la
  barra de navegación del sistema.

### Key Entities

Ninguna nueva. Este feature no crea, cambia ni guarda un solo dato: dibuja de
otra manera lo que ya existe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Diego pasa entre las tres secciones **sin desplazar** y con una
  sola mano.
- **SC-002**: Con la lista desplazada hasta el final, **la barra de destinos
  sigue accesible** sin volver arriba.
- **SC-003**: En un teléfono común entra **más de un pedido completo** en
  pantalla, con su acción visible.
- **SC-004**: Ningún elemento tocable mide menos de 48 dp, medido sobre la app
  corriendo.
- **SC-005**: Todo texto pasa el contraste mínimo de accesibilidad.
- **SC-006**: No queda morado por defecto en ninguna pantalla.
- **SC-007**: Con el teléfono sin señal, Diego **sigue viendo sus pedidos** y
  entiende por qué no puede moverlos.
- **SC-008**: Diego usa la app **al sol y con una mano** y dice que ahora sí — es
  el criterio que `012` dejó sin evaluar, y el único que puede cerrar esto.

## Assumptions

- La maqueta aprobada el 2026-08-30 es la referencia visual. Donde el código y
  la maqueta discrepen, manda la maqueta, salvo que discrepe con un requisito de
  acá.
- El teléfono de Diego es un Xiaomi con Android 16, medido en `012`. El objetivo
  mínimo de la app no cambia.
- La cantidad y la fecha se quedan en la tarjeta; el tamaño y la hora no, porque
  desde `014` valen siempre lo mismo y ocupan lugar sin decir nada.
- Nadie más que Diego usa esta app. No hay que diseñar para varios repartidores.

## Dependencias

- **`014` cerrado.** Ya está: `completed` y mergeado por el PR #26.
- **La maqueta**, publicada y aprobada.
- **El emulador antes que el teléfono.** No es una preferencia: en el Xiaomi de
  Diego `adb install` **no funciona** —HyperOS lo rechaza— así que cada vuelta de
  corrección es generar el APK, pasárselo, y que él lo abra desde el gestor de
  archivos. Es la superficie más cara de iterar del repo.
- **Y el verde no alcanza, está demostrado.** `012` compiló en las tres
  superficies y aun así entregó un botón con el texto cortado, un título pegado a
  la barra de estado, un error en inglés en la cara del usuario y un APK sin
  firmar. Un feature que es **enteramente visual** no puede darse por hecho con
  una compilación.
