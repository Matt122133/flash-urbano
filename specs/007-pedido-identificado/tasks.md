# Tasks: El pedido se crea identificado y se guarda

**Input**: documentos de diseño en `specs/007-pedido-identificado/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/pedidos.md](contracts/pedidos.md),
[quickstart.md](quickstart.md)

**Tests**: sí, pedidos explícitamente. El
[quickstart](quickstart.md#verificación-automática) lista diez propiedades que
las pruebas tienen que cubrir, y **nueve verificaciones manuales que ninguna
prueba de este repo puede hacer** — `vitest` corre en entorno `node` sin DOM, así
que la puerta, la reanudación y la precarga sólo se ven en un navegador. Las
tareas manuales están marcadas y **no son opcionales**.

**Organización**: por historia de usuario, siguiendo los cuatro tramos de
[plan.md](plan.md#cómo-se-ejecuta).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: a qué historia pertenece (US1…US5)
- **[MANUAL]**: requiere un navegador o un teléfono; no la cubre `verify:`
- Cada tarea nombra su archivo

---

## Cobertura

Los quince prefijos de `covers:` en [plan.md](plan.md) ya autorizan todo lo que
estas tareas escriben — se verificó parseando el frontmatter con el propio
`check_plan_coverage.py`. Dos exclusiones deliberadas que **el sensor va a
imponer**, y está bien que lo haga:

| Fuera de `covers:` | Qué pasa si hace falta |
|---|---|
| `web/components/bloque-direccion.tsx` | Sus dos deudas conocidas van a molestar en T034–T036. Si la precarga no funciona sin tocarlo, se **extiende `covers:` con el motivo escrito** — no se arregla de paso |
| `web/lib/zonas.ts`, `web/lib/zona-lookup.ts` | Nada de este feature tiene motivo legítimo para tocarlos. Si una tarea parece necesitarlo, la tarea está mal |

`docs/` y los anclas de raíz ya están exentos: no hacen falta en `covers:`.

---

## Phase 1: Setup

**Purpose**: la higiene que no depende de nada y cierra una fila `High` del
tracker.

- [ ] T001 Agregar al `.gitignore` de la raíz las líneas `.env`, `.env.*`, `!.env.example` y `!*.env.example` (research D11). La negación **no es opcional**: `.env*` a secas taparía `backend/.env.example`, que queremos versionado porque documenta qué variables hacen falta
- [ ] T002 Verificar SC-014 con el procedimiento de [quickstart M9](quickstart.md#m9--el-gitignore-sc-014): rama nueva desde `master`, `backend/.env` con contenido, `git add -A`, y comprobar que **no** queda preparado para commit. `backend/.gitignore` se deja como está — dos redes que se superponen es lo correcto

**Checkpoint**: SC-014 verde.

---

## Phase 2: Foundational — el servicio guarda pedidos (Tramo 1)

**Purpose**: la mitad verificable sin navegador. Se hace primero porque si el
contrato está mal, es más barato descubrirlo acá.

**⚠️ CRÍTICO**: ninguna historia arranca hasta que esta fase cierre.

**⚠️ ANTES DE CORRER LAS PRUEBAS**: sin `TEST_DATABASE_URL` las pruebas contra
Postgres **se saltan solas** y el verde no dice nada. Levantar la base con
PostGIS y **contar los `SKIP`** según [quickstart](quickstart.md#antes-de-empezar).

- [ ] T003 Escribir la migración `backend/migrations/0003_pedidos.sql` con la secuencia `pedidos_codigo_seq` y la tabla `pedidos` completa de [data-model.md](data-model.md), incluidos los tres índices. **`ON DELETE RESTRICT`** en `usuario_id`, no `CASCADE`; **`retiro_punto` NOT NULL**; `estado` y `paquete_tamano` como `text` con `CHECK`, no enums; `retiro_fecha date` + `retiro_hora time`, **no** un `timestamptz` (research D8). Sólo hacia adelante: no hay migración de vuelta
- [ ] T004 Implementar el repositorio en `backend/internal/pedidos/pedido.go`: `Crear` (con el `INSERT … ON CONFLICT (usuario_id, clave_idempotencia) DO NOTHING` y la relectura que devuelve el existente), `PorUsuario` y `Todos`. El código de pedido lo genera la base por `DEFAULT`, no el servicio
- [ ] T005 [P] Probar el repositorio en `backend/internal/pedidos/pedido_test.go`: crear y releer un pedido (incluido que el punto sobreviva el viaje a PostGIS), y que `PorUsuario` de un usuario **no** devuelva los de otro
- [ ] T005a [P] Probar en `pedido_test.go` que el pedido **copia y no referencia** (FR-013): crear un pedido, después mutar el usuario —cambiarle teléfono y dirección de retiro—, releer el pedido y comprobar que **no cambió nada**. Son diez líneas y hoy esa mitad de SC-007 sólo se verifica a mano; es justo el defecto que aparecería recién el día que un cliente se muda
- [ ] T005b [P] Probar en `pedido_test.go` **SC-008**: crear más de 10.000 pedidos y comprobar que todos los códigos son únicos y con formato válido **al cruzar `FU-9999`**. El `UNIQUE` de la columna ya garantiza la unicidad; lo que esta prueba cubre es lo otro — que el formato no se rompa al pasar de cuatro dígitos. [research D4](research.md) **afirma** que `lpad` no trunca y que el pedido 10.000 sale `FU-10000`; que esté razonado no es que esté probado
- [ ] T006 Implementar los handlers en `backend/internal/pedidos/handlers.go`: `Crear`, `Mios` y `Todos`, según [contracts/pedidos.md](contracts/pedidos.md). El `usuario_id` sale de `httpx.UsuarioDe`, **nunca del cuerpo**. `Idempotency-Key` obligatoria: sin ella, `400`. Clave repetida ⇒ **`200` con el pedido existente**, no `409` y no uno nuevo
- [ ] T007 Implementar en `handlers.go` la validación de fecha de retiro vencida comparando contra la hora actual en **`America/Montevideo`**, explícitamente. En Railway el proceso corre en UTC: sin esto, entre las 21:00 y la medianoche el servicio cree que ya es mañana y rechaza retiros válidos de hoy. **No** se valida la hora dentro del día de hoy
- [ ] T008 [P] Probar en `backend/internal/pedidos/handlers_test.go` la idempotencia: misma clave dos veces ⇒ un pedido y la segunda devuelve `200` con el mismo
- [ ] T009 [P] Probar en `handlers_test.go` el **control positivo de SC-005a**: dos pedidos idénticos con claves distintas ⇒ **quedan los dos**. Sin este caso, "deja un solo pedido" lo satisface una implementación que descarta pedidos buenos, y el resultado sería un paquete que nadie pasa a buscar
- [ ] T010 [P] Probar en `handlers_test.go` que `POST /pedidos` sin `Idempotency-Key` da `400`, y sin credencial da `401` (FR-010, SC-004)
- [ ] T011 [P] Probar en `handlers_test.go` la fecha vencida (`400`) **y el caso de las 22:00 hora de Montevideo** (se acepta). Sin el segundo, el bug de zona horaria sólo aparece de noche y en producción
- [ ] T012 [P] Probar en `handlers_test.go` que `GET /admin/pedidos` da `403` a un identificado no administrador, y `200` a la dirección configurada. Reusa `config.EsAdmin`, que `006` ya probó
- [ ] T013 Enganchar en `backend/cmd/api/main.go` el repositorio nuevo en la estructura `dependencias` y las tres rutas dentro de `rutas()`, las tres con `conSesion`. **Ninguna abierta**: no hay pedido anónimo (FR-005). Que se vea leyendo esa función y nada más, como ya hace `006`
- [ ] T014 Verificar SC-011: la base se levanta **desde vacía** aplicando las migraciones del repo, incluida `0003`, sin pasos manuales

**Checkpoint**: `cd backend && go vet ./... && go test ./... -p 1 && go build ./...`
verde **con cero `SKIP`**, y un `curl` con credencial válida crea un pedido y
devuelve su código `FU-####`.

---

## Phase 3: US2 — El pedido existe después de confirmarlo (P1) (Tramo 2)

**Goal**: el pedido se guarda desde el sitio, con sesión ya iniciada. Todavía sin
puerta.

**Independent test**: confirmar un pedido, cerrar todo, y comprobar con
`GET /admin/pedidos` que está, completo y ligado a su usuario.

**⚠️ Ésta es la fase donde se juega FR-004.** `pedido-form.tsx` es *entrada* de
la guarda de FR-001 y `lib/api.ts` está *prohibido*. La salida es la inversión de
dependencia de [research D1](research.md), no debilitar la prueba.

- [ ] T015 [P] [US2] Escribir el mapeo puro en `web/lib/pedido.ts`: de los datos del formulario al cuerpo de `POST /pedidos`. Reutiliza **`DireccionCobrada`**, que ya existe en `web/lib/direccion.ts` con el comentario *"para el momento en que el pedido se cierra"* — es este momento. **Este módulo no importa `lib/api.ts` ni `lib/sesion.ts`**, y por eso puede vivir en `lib/`
- [ ] T016 [P] [US2] Probar el mapeo en `web/lib/pedido.test.ts`. El caso que importa es **FR-019**: que la zona y el precio del cuerpo se deriven **del punto** en el momento de cerrar el pedido, y no se arrastren de un estado que pueda haber quedado viejo. El control positivo: mover el punto a otra zona y comprobar que el cuerpo cambia de precio — sin él, un mapeo que devuelva una constante pasa la prueba
- [ ] T017 [US2] Agregar a `web/lib/api.ts` las funciones `crearPedido` (con la cabecera `Idempotency-Key`) y `misPedidos`. Sin dependencias nuevas: `ErrorApi` ya distingue `sinRespuesta` de `sesionInvalida`, que es todo lo que la pantalla necesita
- [ ] T018 [P] [US2] Probar las funciones nuevas en `web/lib/api.test.ts`, incluido que la cabecera de idempotencia viaje y que un `200` y un `201` se traten igual desde el punto de vista de quien llama
- [ ] T019 [US2] Modificar `web/components/pedido-form.tsx` para que reciba `onConfirmar` como prop y exporte el tipo de sus datos. **No agrega ni un import hacia `lib/api.ts` ni `lib/sesion.ts`**: el formulario deja de saber que existe un servicio
- [ ] T020 [US2] Escribir `web/components/pedido/crear-pedido.tsx`: el componente cliente que importa `lib/api.ts`, genera la clave de idempotencia con `crypto.randomUUID()` en un `useRef` y monta `<PedidoForm onConfirmar={…} />`. La clave se comparte entre reintentos y se descarta después de un pedido creado
- [ ] T021 [US2] Modificar `web/app/pedido/page.tsx` para montar `crear-pedido.tsx` en vez del formulario directo. La página sigue siendo de servidor: sólo metadata y encabezado
- [ ] T022 [US2] Agregar a `web/lib/cotizar-abierto.test.ts` el **control positivo**: afirmar que `components/pedido/crear-pedido.tsx` **sí** alcanza `lib/api.ts`. Sin él, borrar el envío entero deja la guarda verde y nadie se entera. **No se tocan `ENTRADAS` ni `PROHIBIDOS`**
- [ ] T023 [US2] [MANUAL] **Romper la guarda a propósito**: agregar `import { pedir } from "@/lib/api";` en `pedido-form.tsx`, correr `npx vitest run lib/cotizar-abierto.test.ts`, **ver el rojo**, y deshacerlo. Una guarda negativa que nadie vio fallar no está demostrada
- [ ] T024 [US2] [MANUAL] Verificar M1 de [quickstart](quickstart.md#m1--cotizar-sigue-abierto-con-el-servicio-apagado-sc-001): con el backend **detenido**, cotizar de punta a punta sin un solo error y con **cero llamadas fallidas** en la pestaña de red. Es US1, y se corre acá porque acá es donde se pudo romper

**Checkpoint**: con sesión iniciada, confirmar crea un pedido real y la
confirmación muestra su código.

---

## Phase 4: US3 — La puerta, sin perder lo cargado (P1) (Tramo 3)

**Goal**: un visitante sin sesión completa el formulario, se identifica en un
diálogo **sobre la misma pantalla**, y el envío se reanuda solo.

**Independent test**: sin sesión, llenar el formulario, tocar confirmar **una
sola vez**, identificarse, y aterrizar en la confirmación sin haber vuelto a
escribir nada.

- [ ] T025 [US3] Factorizar la composición de ingreso a `web/components/sesion/panel-ingreso.tsx`, recibiendo qué hacer al terminar (research D2). Es `BotonGoogle` + `IngresoPorCodigo` + `CompletarAlta`, hoy embebidos en la pantalla
- [ ] T026 [US3] Modificar `web/app/ingresar/page.tsx` para montar el panel factorizado con `router.push("/")` como final. La pantalla **sigue existiendo** para quien entra desde la navegación (FR-010a): el diálogo se suma al camino, no lo reemplaza
- [ ] T027 [US3] Escribir `web/components/pedido/dialogo-ingreso.tsx`: monta `panel-ingreso.tsx` en un diálogo, con foco atrapado y cierre por Escape. **No escribe el borrador en `localStorage` ni en `sessionStorage`** (FR-006a) — no hace falta, porque no se navega
- [ ] T028 [US3] Modificar `crear-pedido.tsx` para abrir el diálogo cuando no hay sesión al confirmar, y también cuando el servicio contesta `401` (FR-009: una sesión vencida se comporta igual que no tener sesión)
- [ ] T029 [US3] Implementar en `crear-pedido.tsx` la **reanudación** (FR-007a): al cerrarse el diálogo con sesión iniciada, el envío continúa **con la misma clave de idempotencia**, se ve que está enviando, y termina en la confirmación. Sin segundo toque y **sin silencio**
- [ ] T030 [US3] Implementar en `crear-pedido.tsx` que desistir del ingreso deje lo cargado intacto y **no cree ningún pedido** (FR-008)
- [ ] T031 [US3] [MANUAL] Verificar M2 en un **teléfono**: formulario entero, un solo toque en confirmar, ingreso con Google, código `FU-####`. Comprobar que la URL **no cambió**, que no se reescribió ni un campo, y que el pin quedó donde se lo había arrastrado
- [ ] T032 [US3] [MANUAL] Verificar M3: `Object.keys(localStorage)` y `Object.keys(sessionStorage)` **no contienen el borrador**, en particular el nombre y el teléfono de quien recibe. Es la razón por la que se eligió el diálogo — un tercero que no consintió nada no puede quedar escrito en el disco de un teléfono compartido
- [ ] T033 [US3] [MANUAL] Verificar M4: desistir del diálogo deja lo cargado y **`GET /admin/pedidos` no muestra ningún pedido nuevo**. Que la pantalla no diga nada no prueba que no se creó
- [ ] T034 [US3] [MANUAL] Repetir M2 entero en **Safari de iPhone**. `006` encontró que el modo de falla predecible es que un navegador se comporte distinto

**Checkpoint**: SC-003 y SC-003a verdes, medidos a mano.

---

## Phase 5: US4 — El formulario ya sabe quién soy (P2)

**Goal**: cero tipeo para nombre, teléfono y dirección de retiro.

**Independent test**: con un perfil cargado, abrir `/pedido` y contar los campos
que hay que escribir de esos tres: cero.

- [ ] T035 [US4] Implementar en `crear-pedido.tsx` la precarga desde `GET /yo`: nombre, teléfono y dirección de retiro con apto, cooperativa y punto. Un perfil **sin** dirección deja el formulario utilizable y vacío en esa parte, sin errores (FR-025)
- [ ] T036 [US4] Implementar la revalidación del punto guardado (FR-022, research D7): reconstruir la esquina, comprobar que el punto caiga en la cuadra declarada, y **si no cae**, descartarlo, recolocar en el cruce resuelto y avisar. Nunca se cobra en silencio sobre un punto que ya no corresponde. Es la contraparte que `FR-019b` de `006` dejó pendiente
- [ ] T037 [US4] Reutilizar en esa reconstrucción el manejo de **calles homónimas** que ya resuelve `formulario-perfil.tsx` —probar todas las combinaciones y desempatar con el punto guardado—. El índice tiene 50 grupos de nombres que se normalizan igual, y `callePorNombre` devuelve el primero, que puede ser el equivocado. **No escribir esa lógica de nuevo**
- [ ] T038 [US4] Implementar que la precarga **no pise lo que la persona ya escribió** (FR-007). Con la puerta a mitad de formulario, identificarse es un momento en que la precarga podría reescribir una dirección recién tipeada — un caso que antes de este feature no existía
- [ ] T039 [US4] [MANUAL] Verificar M5 completo, incluidas **las dos direcciones**: que el perfil no cambie al pedir, y que escribir una dirección distinta de la guardada y después identificarse deje el pedido con la que se escribió
- [ ] T040 [US4] [MANUAL] Comprobar si `bloque-direccion.tsx` alcanza sin modificarlo. Si no —la deuda conocida del campo *Esquina* deshabilitado con una dirección precargada—, **extender `covers:` en el plan con el motivo escrito** en vez de arreglarlo de paso

**Checkpoint**: SC-006 y SC-007 verdes.

---

## Phase 6: US5 — Los pedidos se pueden leer sin abrir la base (P3)

**Goal**: que *"el pedido se guardó"* sea comprobable por alguien sin `psql`.

**Los endpoints ya existen**: se construyeron en la Fase 2 porque viven en el
mismo archivo y la misma tarea de enganche que `POST /pedidos`, y porque US2 los
necesita para su propia verificación. Esta fase es lo que **prueba** FR-031 y
FR-032.

- [ ] T041 [P] [US5] Probar en `handlers_test.go` que `GET /pedidos` devuelve sólo los del usuario del contexto de sesión, con dos usuarios y pedidos cruzados (FR-017, SC-010). Una lista vacía es `200` con `"pedidos": []`, no `404`
- [ ] T042 [P] [US5] Probar que `GET /pedidos` **no acepta ningún parámetro** que permita pedir los de otro. No hay `?usuarioId=` y no debe haberlo
- [ ] T043 [US5] [MANUAL] Verificar SC-015: crear un pedido desde el sitio y recuperarlo íntegro con `curl` contra `GET /admin/pedidos`, sin ejecutar una consulta SQL

**Checkpoint**: SC-015 verde. **Sin pantalla**, a propósito: FR-030 difiere *Mis
Pedidos*.

---

## Phase 7: El copy, y el cierre

**⚠️ No es "polish".** FR-029 es el requisito que carga con la consecuencia de
haber diferido el aviso a Diego. Cerrar el feature sin él cambia una promesa
falsa por otra.

- [ ] T044 Corregir en `web/app/pedido/page.tsx` las dos frases: sacar *"Podés cargarlo como invitado, sin necesidad de crear una cuenta"* (FR-027) y *"marcá en el mapa desde dónde retiramos el paquete"* (FR-028), que dejó de ser cierta en `003`. Es lo primero que lee quien llega desde un buscador
- [ ] T045 Reemplazar en `web/components/pedido-form.tsx` el texto de la confirmación (FR-029). Hoy dice **"¡Pedido cargado! Nos pondremos en contacto para confirmar el retiro"** y **nadie se va a poner en contacto**: el aviso a Diego vive en la app Android, que no existe. Lo que lo reemplace tiene que decir dos cosas ciertas — que el pedido quedó registrado con su código, y por dónde se coordina de verdad mientras tanto
- [ ] T046 [MANUAL] Verificar M6: leer `/pedido` y la confirmación **texto por texto** contra SC-012. Es la verificación que se olvida
- [ ] T047 [MANUAL] Verificar M7: con el servicio caído, confirmar falla diciendo que el pedido **no** se creó, lo cargado sigue en pantalla, y al levantarlo confirmar de nuevo deja **un** pedido (SC-013)
- [ ] T048 [MANUAL] Verificar M8: un punto de retiro fuera de las cinco zonas **no permite confirmar desde el sitio** y deriva a contacto directo (SC-009, FR-020). **No** hay que verificar que el servicio lo rechace: no lo hace, y FR-020a lo dice explícitamente
- [ ] T049 Anotar en `docs/tech-debt-tracker.md` el **riesgo residual del precio** que FR-021a obliga a registrar: el servicio guarda el precio declarado sin verificarlo, quien arme la petición a mano puede declarar cualquier monto **y también un punto fuera de cobertura** (FR-020a), y el único control es que Diego mira el pedido antes de aceptarlo. Las dos mitades se cierran por el mismo camino —el día que el servicio conozca las zonas, conoce las dos— así que van en **una sola fila**, no en dos. Incluir la salida evaluada en [research D6](research.md) —la tabla de cinco precios sin geometría, generada desde `web/design-source/`— para que la próxima discusión no arranque de cero
- [ ] T050 Cerrar en `docs/tech-debt-tracker.md` las dos filas `High` que este feature resuelve: la promesa falsa de la confirmación (2026-08-12) y la contradicción del formulario con la constitución (2026-08-11). **Cerrarlas sólo si T044, T045 y la puerta están hechas**; si alguna quedó afuera, la fila se actualiza, no se cierra
- [ ] T051 Actualizar `ARCHITECTURE.md` con la tabla `pedidos`, los tres endpoints, y la inversión de dependencia de `pedido-form.tsx` — **por qué** el formulario no importa el cliente del API es lo que hay que dejar escrito, o el próximo lo "arregla"
- [ ] T052 Agregar la entrada de este feature a `docs/README.md`
- [ ] T053 Correr el `verify:` completo del plan y dejarlo verde, **con `TEST_DATABASE_URL` puesta y los `SKIP` en cero**
- [ ] T054 Poner `specs/007-pedido-identificado/plan.md` en `status: completed`. **Commitear antes**: el sensor de cobertura rebota el commit si el plan ya está en `completed`

---

## Dependencias entre historias

```
Setup (T001–T002)
   │
   └─► Foundational (T003–T014)  ◄── bloquea todo lo demás
          │
          ├─► US2 (T015–T024)   el pedido se guarda desde el sitio
          │      │
          │      ├─► US3 (T025–T034)   la puerta  ◄── necesita crear-pedido.tsx
          │      │      │
          │      │      └─► US4 (T035–T040)   la precarga  ◄── T038 necesita la puerta
          │      │
          │      └─► US5 (T041–T043)   [P] con US3/US4: sólo toca el backend
          │
          └─────► Phase 7 (T044–T054)   el copy y el cierre
```

**US1 no tiene fase propia**: no agrega funcionalidad, defiende la que existe. Su
trabajo son T022, T023 y T024, y viven en US2 porque es ahí donde se puede
romper.

**US5 puede ir en paralelo con US3 y US4**: sólo toca `handlers_test.go`.

## Paralelismo

| Fase | Tareas `[P]` |
|---|---|
| Foundational | T005, T005a, T005b, T008, T009, T010, T011, T012 — archivos de prueba distintos |
| US2 | T015 y T016 (`lib/pedido.*`) contra T018 (`lib/api.test.ts`) |
| US5 | T041 y T042 |

T019, T020 y T021 son **secuenciales**: cada una depende de la forma que dejó la
anterior.

## Estrategia de entrega

**MVP**: Setup + Foundational + US2 + US3. Con eso la constitución v3.0.0 deja
de estar incumplida y el pedido existe. US4 lo hace agradable; US5 lo hace
diagnosticable.

**Lo que no se puede dejar afuera del MVP aunque tiente**: T045. Un pedido que se
guarda detrás de una puerta, con la pantalla todavía prometiendo un contacto que
nadie va a hacer, deja al cliente esperando igual que hoy.
