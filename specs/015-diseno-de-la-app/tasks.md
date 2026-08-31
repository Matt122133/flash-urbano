---

description: "Tareas de 015 — La app de Diego, rediseñada para la calle"
---

# Tasks: La app de Diego, rediseñada para la calle

**Input**: `specs/015-diseno-de-la-app/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [quickstart.md](quickstart.md)

**Tests**: dos nuevas, y las dos existen porque convierten un criterio de opinión
en uno medible: el contraste del tema (research D4) y el piso de 48 dp
(research D5). Ninguna prueba nueva de lógica: no hay lógica nueva.

**Organization**: por historia de usuario.

## Path Conventions

Superficie única `android/`. `web/` y `backend/` **no se tocan**, y el sensor de
pre-commit lo hace cumplir porque no están en `covers:`.

---

## Phase 1: Setup

- [x] T001 Correr `verify:` **antes de tocar nada** — `cd android && .\gradlew.bat assembleDebug testDebugUnitTest` — y anotar el resultado. Si algo sale en rojo después, hay que poder distinguir lo que rompió este feature de lo que ya venía roto **HECHO el 2026-08-30**: `BUILD SUCCESSFUL in 24s`, exit 0. **Con un matiz**: `testDebugUnitTest` salió `FROM-CACHE`, o sea que el verde es el cacheado de la corrida anterior y no una ejecución fresca. Para línea de base alcanza; al cerrar hay que mirar que corran de verdad
- [ ] T002 **PARCIAL al 2026-08-30.** Abrir la app en el emulador y **sacar una captura de cada pantalla como está hoy**, antes de tocarla. Es la única forma de mostrarle a Diego el antes y el después, y de discutir con evidencia si algo empeoró. **HECHO**: emulador `Medium_Phone_API_36.0` levantado —la misma API que el teléfono de Diego—, APK de debug instalado, y capturada la pantalla de ingreso. **Confirma la queja con evidencia: fondo lila y botón morado, sin una sola pieza de la marca.** **FALTA, y es lo que más importa**: las tres listas. No se pueden capturar sin el backend local levantado y una sesión iniciada, porque sin datos no hay pedidos que dibujar. **NO se completo, y ya no se puede**: para cuando el backend estuvo arriba, la app ya estaba rediseñada, asi que **el "antes" de las tres listas se perdio**. Queda la captura del ingreso —fondo lila y boton morado— que es evidencia suficiente de la queja, pero no hay con que comparar las listas. **La leccion es del orden, no del paso**: las capturas del antes hay que sacarlas cuando el entorno esta arriba, no cuando uno se acuerda

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T003 Crear el tema de marca en `android/app/src/main/java/uy/flashurbano/repartidor/ui/tema/` — hoy **no existe ningún archivo de tema**, por eso la app sale morada. Esquema **solo claro**, escrito desde los tres valores del sitio: azul `#1d4ed8`, oscuro `#1e3a8a`, naranja `#f97316`. **Apagar explícitamente el color dinámico** (research D2): dejarlo encendido haría que la app tome el fondo de pantalla del teléfono de Diego y la marca vuelva a desaparecer, que es el defecto que este feature viene a arreglar **HECHO**: `ui/tema/Paleta.kt` (valores crudos, sin Compose, para que la prueba corra en la JVM) y `ui/tema/Tema.kt`. Color dinamico **descartado explicitamente y argumentado en el archivo**.
- [x] T004 Definir las constantes de tamaño de toque con nombre, en el mismo paquete del tema. Es lo que hace medible el piso de 48 dp **HECHO**: `ui/tema/Toques.kt`, cinco medidas con nombre.
- [x] T005 Escribir en `android/app/src/test/` la prueba de **contraste** (research D4): recorre los pares texto/fondo del tema y falla por debajo de 4.5:1, o 3:1 para texto grande. **Con su control positivo**: un par que se sabe malo —gris claro sobre blanco— tiene que hacerla saltar nombrando el par. **Y el límite escrito adentro**: prueba la paleta, no que la pantalla use esos colores **HECHO**: `ContrasteTest`, 6 casos. **Y encontro un defecto de la maqueta antes de que llegara al codigo**: el badge tenia el numero en BLANCO sobre el naranja — **2.80:1**, ni siquiera el minimo de texto grande. Se corrigio a texto oscuro sobre el mismo naranja (6.36:1) en vez de oscurecer el naranja, porque Diego pidio la app **mas colorida** y bajar el naranja habria pagado el contraste con lo que el fue a buscar. Ademas cambio `TEXTO_SUAVE` de `#64748B` a `#4B5563`: el primero da 4.42:1 sobre el fondo —pasa sobre blanco y no sobre el gris—, la clase de diferencia que nadie ve mirando.
- [x] T006 [P] Escribir la prueba que afirma que ninguna constante de toque baja de 48 dp, **con el límite escrito adentro**: comprueba las constantes, no su uso. Nada impide un `Modifier.size(32.dp)` escrito a mano al lado, y eso lo caza el emulador (quickstart Q5) **HECHO**: `ToquesTest`, 4 casos, con el control positivo y con un caso que impide bajar `MINIMO` sin que salte.

**Checkpoint**: la app se ve de la marca y hay dos pruebas que sostienen lo que antes era opinión.

---

## Phase 3: User Story 1 — Cambiar de sección sin desplazar (P1) 🎯 MVP

**Goal**: tres destinos abajo, siempre alcanzables.

**Independent Test**: quickstart Q3.

- [x] T007 [US1] En `RepartidorViewModel.kt`, agregar la **sección seleccionada** al estado, usando el `Seccion` que ya existe en `datos/Pedido.kt`. **No se toca `seccionDe()`**: el mapeo de estados a secciones se usa distinto, no cambia **HECHO**: vive en el ViewModel y no en la pantalla, para que sobreviva a un giro de telefono. Arranca en PENDIENTES, que es donde nace todo pedido.
- [x] T008 [US1] Construir la barra inferior con los tres destinos y sus íconos —caja, ruta, bandera a cuadros (FR-003)— en el paquete de pantallas. **Sin `androidx.navigation`** (research D1) **HECHO**: `BarraDestinos.kt`, y los tres iconos dibujados a mano en `Iconos.kt` con `PathParser` — **sin `material-icons-extended`**, que habria traido un catalogo entero para usar tres.
- [x] T009 [US1] Los badges: número en Pendientes y En curso, **ninguno en Entregados** (FR-004). Comprobar que dos cifras entran y que tres no rompen la barra **HECHO**: badge naranja con texto oscuro. Ademas el lector de pantalla dice cuantos hay, no solo el nombre del destino.
- [x] T010 [US1] En `MainActivity.kt`, sacar `viendoEntregados` y el `BackHandler`, y montar la barra con la lista de la sección seleccionada. **Atrás pasa a salir de la app desde cualquier pestaña** — es el cambio de comportamiento que decidió research D1, y va escrito en el código para que no parezca un descuido **HECHO**: se fueron `viendoEntregados`, el `BackHandler` y cinco imports. El cambio de significado de "atras" quedo escrito en el KDoc de `AppRepartidor`, no como descuido.
- [x] T011 [US1] Absorber `Entregados.kt`: deja de ser una pantalla aparte y pasa a ser la tercera lista. Su tarjeta es la misma, sin acción **HECHO**: `Entregados.kt` borrado. Su logica de acciones se unifico en `AccionesDe()`, que decide por seccion en vez de recibir los dos estados a mano desde cada lista.

**Checkpoint**: el MVP. La queja principal está resuelta.

---

## Phase 4: User Story 2 — Mover un pedido sin estirar la mano (P1)

**Goal**: la acción a la vista, y deshacer donde estás.

**Independent Test**: quickstart Q4 y Q5.

- [x] T012 [US2] Reescribir `TarjetaPedido` a ~250 px con el desglose de research D3: la cantidad y la fecha suben a la fila del código; las direcciones pasan a una fila con flecha (naranja sube = retira, azul baja = entrega); los dos teléfonos pasan a **dos botones de 48 dp lado a lado**. **Todo se sigue viendo sin desplegar** — contrato 4.2 de `012`, que no se toca **HECHO**: medido en el emulador, la tarjeta quedo en ~233 dp. **Entran dos completas con su accion a la vista y una tercera asomando**; antes entraba una y un cachito. Se fueron el tamano, la hora y los rotulos de dos lineas; la fecha pasa por `fechaCorta()` — `2026-08-31` no se lee de reojo, `lun 31/8` si.
- [x] T013 [US2] La acción como **borde inferior entero** de la tarjeta (FR-012): "Lo tengo" en Pendientes, "Entregado" en En curso, nada en Entregados **HECHO**: la franja entera del borde inferior. Azul para `Lo tengo`, verde para `Entregado` — se distingue sin leer el boton.
- [x] T014 [US2] Los teléfonos siguen abriendo el marcador **sin llamar solos** (FR-010) — es `ACTION_DIAL` y no `ACTION_CALL`, decidido en `012` para que un toque de más con guantes no llame. Y un pedido **sin teléfono** no puede quedar tocable ni parecerlo **HECHO**: sigue siendo `ACTION_DIAL`. Sin numero el boton no es tocable y se ve que no lo es.
- [x] T015 [US2] Deshacer: el aviso aparece **sobre la pestaña donde está Diego**, no salta a la pestaña destino (research D6). Moverle la pantalla debajo del dedo mientras trabaja parado en una puerta es la forma más rápida de que toque lo que no quería **HECHO y probado en el emulador**: al tocar `Lo tengo` aparece `FU-0003 pasó a En curso` con **Deshacer**, sobre Pendientes, y los badges bajan y suben. Dos decisiones que quedaron escritas en el codigo: el aviso se arma **despues** de que el servicio confirmo —ofrecer deshacer algo que todavia no paso es prometer marcha atras sobre algo que puede fallar—, y **lo que deshace un deshacer no deja aviso**, para que Diego no quede rebotando entre dos estados. **SEGUNDO HALLAZGO DE MORADO**: la accion del Snackbar salio lila porque `inversePrimary` tampoco estaba declarado. Se declaro el esquema COMPLETO y quedo escrito el patron: un rol de Material 3 sin declarar no es un valor que falta, es el morado esperando a que alguien use ese componente.
- [x] T016 [US2] El estado crudo **solo cuando no coincide con la sección** (FR-011) **HECHO**, y **con una correccion al requisito**: FR-011 decia "cuando no coincide con la seccion", y eso no puede pasar nunca — la seccion se calcula CON `seccionDe(estado)`, asi que coinciden por construccion. Lo que hay que detectar es que el estado **no sea ninguno de los tres conocidos**, que es el caso que `012` quiso cubrir. Quedo en `esEstadoConocido()`.
- [x] T017 [US2] Probar FR-011 con una **prueba de JVM sobre `seccionDe()`**, no contra la base: darle un estado que la app no conoce y afirmar que cae en `PENDIENTES` y que la tarjeta lo muestra en crudo; darle los tres conocidos y afirmar que no lo muestra. **Lo encontró el analyze del 2026-08-30**: el quickstart pedía fabricar el caso poniendo un estado raro en la base, y eso **es imposible** — `pedidos.estado` tiene `CHECK (estado IN ('creacion','aceptacion','entrega'))` y no acepta otro valor sin tirar la restricción. O sea que FR-011 estaba escrito sin ninguna verificación ejecutable **HECHO**: `EstadoConocidoTest`, 5 casos, incluido que un desconocido siga cayendo en Pendientes. Ademas `FechasTest` con 5 casos para `fechaCorta()`, que recorre **los siete dias** — un error de uno ahi corre todos los nombres y nadie lo nota hasta que un martes dice lunes.

---

## Phase 5: User Story 3 — Que se lea al sol (P2)

**Independent Test**: quickstart Q6.

- [x] T018 **PARCIAL — el barrido de morado ya encontro uno.** [US3] Aplicar el tema a las cuatro pantallas —las tres listas y el ingreso— y **recorrerlas buscando morado**. No puede quedar un solo elemento con el color por defecto. **HALLAZGO del 2026-08-30, en el emulador**: la barra de destinos salio LILA. `NavigationBar` no pinta con `surface` sino con `surfaceContainer`, que `lightColorScheme()` dejaba en el valor de referencia de Material 3. Corregido declarando la familia `surfaceContainer*` entera. **Es el caso real del limite que `ContrasteTest` tiene escrito**: esa prueba mide la paleta, no que la pantalla la use. Falta recorrer el ingreso y las otras pantallas **CERRADA**: recorridas las cuatro pantallas. **Dos hallazgos de morado, los dos en roles sin declarar**: `surfaceContainer` (la barra de destinos) e `inversePrimary` (la acción del Snackbar). Se declaró el esquema COMPLETO y quedó escrito el patrón en `Tema.kt`. El ingreso ya salía azul.
- [x] T019 [P] [US3] Comprobar que nada queda tapado por la barra de estado ni por la del sistema (FR-018). **`012` ya entregó un título pegado a la barra de estado**: es un defecto conocido de esta app, no una precaución teórica **HECHO**: comprobado en todas las capturas — el título no queda pegado a la barra de estado y la barra de destinos no queda tapada por la del sistema. `safeDrawingPadding` en la raíz, que `012` puso justamente por eso, sigue haciendo su trabajo.

---

## Phase 6: User Story 4 — Saber qué pasa cuando no pasa nada (P3)

**Independent Test**: quickstart Q7.

- [x] T020 [P] [US4] Estado vacío por pestaña en `EstadoPantalla.kt`, con el motivo y qué hacer (FR-015). Tres textos distintos: no es lo mismo "no hay pedidos nuevos" que "no llevás nada encima" **HECHO** junto con T010: `SeccionVacia()` con tres textos distintos. Salio naturalmente al reestructurar, porque la pantalla necesitaba decir algo por pestana.
- [x] T021 [P] [US4] El aviso de sin conexión como **franja**, no como pantalla (FR-016): lo que ya se bajó se sigue viendo, y las acciones se ven apagadas **antes** de tocarlas **HECHO y probado con el emulador en modo avión**: franja oscura arriba, la lista se conserva, y las acciones quedan grises con su texto. **Salió un defecto propio en el camino**: la primera versión reusó `yendo` para "sin red", así que las acciones apagadas mostraban un spinner — "esperá que está yendo" cuando no iba nada y no iba a ir. Ahora `yendo` y `habilitada` son dos cosas distintas, con el motivo escrito en el código.

---

## Phase 7: Polish y cierre

- [x] T022 [P] Actualizar `ARCHITECTURE.md` con lo que cambió del mapa de `android/`: el tema nuevo, que la navegación es una barra sin biblioteca, y que `Entregados.kt` dejó de ser una pantalla **HECHO**: tres entradas nuevas — el tema con las dos trampas (color dinámico apagado, roles sin declarar), `ContrasteTest` con su límite, y la barra de destinos con el cambio de "atrás".
- [x] T023 [P] Anotar en `docs/tech-debt-tracker.md` que **no hay pruebas instrumentadas** (research D5): las dos pruebas nuevas cubren la paleta y las constantes, no el dibujo. Con su disparador: cuando la app gane una segunda pantalla con lógica propia **HECHO**: fila del 2026-08-30, con los **tres** defectos que el emulador encontró y las pruebas no podían ver, y con su disparador.
- [ ] T024 Cerrar la fila del tracker del 2026-08-26 sobre el diseño de la app — es la que este feature vino a pagar. **Cerrarla solo si T028 confirma**, no antes
- [x] T025 `verify:` verde **HECHO**: `BUILD SUCCESSFUL`, **50 pruebas, 0 fallos** — de 30 en la línea de base.
- [x] T026 Ejecutar el **nivel 1** del [quickstart](quickstart.md): Q1 y **Q2, que incluye romper la prueba de contraste a propósito** y verla en rojo **HECHO**: Q1 verde, y Q2 con la rotura a propósito — puse blanco sobre el naranja en la tabla de pares y la prueba salió en rojo nombrando el par y el número (`2.80:1, hace falta 4.5:1`). Deshecho y verde.
- [ ] T027 Ejecutar el **nivel 2 completo** en el emulador: Q3 a Q8. **Es obligatorio y es donde se encuentran los defectos de este feature**; `012` demostró que compilar no dice nada. Sacar capturas para comparar con las de T002 **PARCIAL al 2026-08-30**: Q3 (las tres pestañas), Q4 (mover y deshacer), Q6 (nada de morado, nada tapado), Q7 (vacíos y sin señal) y Q8 (que paso a ser prueba de JVM) **hechos**, con capturas. **Q5 queda sin hacer y no lo puedo hacer yo**: es agarrar el teléfono con una mano y recorrer la app sin ayudarse con la otra. Es el criterio del feature y necesita una persona
- [ ] T028 **TUYA** Ejecutar el **nivel 3** ([quickstart](quickstart.md) Q9 y Q10): generar el APK firmado, pasárselo a Diego —`adb install` **no funciona** en su Xiaomi—, y que haga una jornada real. **Es SC-008 y es lo único que puede cerrar este feature.** `012` dejó estos dos pasos sin evaluar y de ahí salió este trabajo
- [ ] T029 Poner `specs/015-diseno-de-la-app/plan.md` en `status: completed` **después** de commitear el resto

---

## Dependencies

```text
T001, T002 (linea de base + capturas del ANTES)
  └── Foundational (T003–T006)
        ├── US1 (T007–T011)   ← MVP
        ├── US2 (T012–T016)   ← depende de US1 para verse en su lugar
        ├── US3 (T018, T019)
        └── US4 (T020, T021)
              └── Polish (T022–T029)
                    └── T028 es TUYA y bloquea T024 y T029
```

**T002 no se saltea.** Sin las capturas del antes, "quedó mejor" es una opinión
de quien lo hizo.

## Parallel opportunities

- **T006** en paralelo con T005
- **US3 y US4** en paralelo entre sí una vez cerrada US1
- **T022 y T023** en paralelo con todo lo demás

## Implementation strategy

**MVP = Foundational + US1.** Con el tema de marca y las tres pestañas, la queja
principal de Diego está resuelta y la app ya se ve de la empresa.

**US2 es la que más valor agrega después**, porque es la acción que hace todo el
día.

## Requisitos sin tarea, a propósito

- **FR-005** (el modelo de estados no cambia) y **FR-009** (nada detrás de un
  toque) no tienen tarea porque **la forma de cumplirlos es no hacer nada**.
  T012 los toca de cerca y los respeta; el emulador lo comprueba
- **FR-017** (todo lo de `012` sigue andando) tampoco: lo cubren las 30 pruebas
  que ya existen (T025) y el recorrido del emulador (T027)
