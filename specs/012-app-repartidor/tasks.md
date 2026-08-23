---
feature: 012-app-repartidor
---

# Tasks: La app de Diego — ver los pedidos y moverlos

**Input**: Design documents from `/specs/012-app-repartidor/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/servicio-y-pantallas.md](contracts/servicio-y-pantallas.md),
[quickstart.md](quickstart.md)

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: puede correr en paralelo — archivo distinto, sin dependencia pendiente
- **[Story]**: a qué historia sirve la tarea
- Toda tarea nombra su archivo

## Path Conventions

Tres superficies: `web/` (que **no se toca**), `backend/` (Go + Postgres) y
`android/` (Kotlin, **nueva**). Las rutas son relativas a la raíz del repo y
**todas tienen que prefijar con el `covers:` de [plan.md](plan.md)**.

## Cuándo hace falta el teléfono de Diego

**Sólo en T034 a T037.** Todo lo demás se construye y se verifica en el emulador.
No hay que conseguir el teléfono antes de tiempo.

---

## Phase 1: Setup

- [ ] T001 Leer [research.md](research.md) entero. **D3, D5 y D7 no son contexto opcional**: D3 es un dato que falta y puede impedir instalar la app, D5 es una trampa de seguridad que se cuela sola, y D7 es un cambio que afecta también a la web
- [ ] T002 Confirmar el entorno de Android, que ya se comprobó y conviene no dar por sentado: JDK de Android Studio en `C:\Program Files\Android\Android Studio\jbr`, SDK en `%LOCALAPPDATA%\Android\Sdk` con `android-36`, y la distribución de Gradle 8.13 en `~/.gradle/wrapper/dists`
- [ ] T003 **Averiguar qué versión de Android tiene el teléfono de Diego** (research D3). El APK va a exigir 8.0 o superior. **Es una pregunta para una persona, no una tarea de código**, y si la respuesta fuera menor a 8 hay que volver al plan antes de escribir nada

---

## Phase 2: Foundational (Blocking Prerequisites)

**Bloquean todo**: sin el endpoint no hay nada que la app pueda hacer, y sin el esqueleto no hay dónde escribirla.

- [ ] T004 Crear `backend/migrations/0005_historial_de_estados.sql` con la tabla `pedidos_estados` según [data-model.md](data-model.md) §2: `pedido_id` referenciando `pedidos`, `estado` con el mismo `CHECK` que la columna original, y `ocurrido_en`. **Sin `estado_anterior`, sin quién lo hizo y sin ubicación**, cada omisión con su motivo escrito en el archivo. **No se rellena hacia atrás**: el historial empieza cuando empieza
- [ ] T005 Comprobar que `0005` corre **sobre la base local con datos adentro**. A diferencia de `0004`, no exige nada — y comprobarlo es barato después de lo que pasó el 2026-08-23
- [ ] T006 Agregar en `backend/internal/pedidos/pedido.go` la operación que cambia el estado y escribe su fila de historial **en la misma transacción**. Si el historial se escribiera aparte, un fallo entre las dos deja un pedido movido sin rastro, que es exactamente lo que FR-014 quiere evitar
- [ ] T007 **Cuando el estado pedido es el que el pedido ya tiene, MUST NOT escribirse una fila** (FR-009, contrato §1). Es lo que hace que tocar dos veces con guantes no ensucie el registro
- [ ] T008 Agregar el handler de `PATCH /admin/pedidos/{id}/estado` en `backend/internal/pedidos/handlers.go`: acepta los tres estados **en cualquier dirección** (FR-004), rechaza cualquier otro valor con un mensaje legible, y devuelve `404` si el pedido no existe
- [ ] T009 Registrar la ruta en `backend/cmd/api/main.go` **con el mismo middleware que `GET /admin/pedidos`**. Si se registra sin él, el feature publica el nombre, la dirección y el teléfono de todos los destinatarios y deja que cualquiera mueva pedidos
- [ ] T010 Cubrir en `backend/internal/pedidos/handlers_test.go` la tabla entera del [contrato](contracts/servicio-y-pantallas.md) §1: hacia adelante, hacia atrás, el mismo estado dos veces —**comprobando que el historial NO crece**—, un valor inválido, un id inexistente, y **sin credencial**. El último es el que verifica SC-006

**Checkpoint**: el servicio hace todo lo que la app va a necesitar, y está probado sin que exista una sola línea de Kotlin.

---

## Phase 3: User Story 3 — Diego no ve nunca una pantalla de ingreso (Priority: P2, va primero)

**Goal**: que la sesión no se caiga sola.

**Va antes que US1 y US2 aunque sea P2**: es del backend, es chico, y hacerlo acá evita construir la app contra una sesión que se muere a las cuatro semanas.

**Independent Test**: una sesión vieja que se usa mueve su vencimiento hacia adelante.

- [ ] T011 [US3] En `backend/internal/auth/sesion.go`, renovar el vencimiento al validar una sesión **si le queda menos de la mitad de vida** (research D7). **Con umbral, no en cada petición**: renovar siempre sería un `UPDATE` por request sobre la tabla más caliente para no ganar nada
- [ ] T012 [US3] Probar las dos mitades del umbral: una sesión vieja **mueve** su `expira_en`, y una recién creada **no lo mueve**. La segunda es el control positivo — sin ella, una implementación que renueva siempre pasa igual
- [ ] T013 [US3] Comprobar que esto **no rompe la web**, que usa la misma sesión: `go test ./...` verde y el sitio sigue entrando normal

---

## Phase 4: El esqueleto de la app

- [ ] T014 Generar `android/` con la distribución de Gradle local (research D1): `settings.gradle.kts`, el módulo `app`, y **el wrapper** con `gradle wrapper`. El `gradle-wrapper.jar` es un binario y **se commitea**, como en cualquier proyecto Android
- [ ] T015 Configurar `android/app/build.gradle.kts`: `minSdk 26`, `targetSdk 36`, Compose con Material 3, OkHttp y `kotlinx.serialization` (research D4). **Sin Retrofit**
- [ ] T016 Definir la URL del servicio **por tipo de compilación** (research D5): `debug` a `http://10.0.2.2:8080`, `release` a producción. **La excepción de texto plano va SÓLO en `debug`** — si se cuela en `release`, la app de Diego acepta conexiones sin cifrar contra producción, que es lo que el bloqueo de Android existe para impedir
- [ ] T017 Agregar al `.gitignore` de la raíz las salidas de Gradle (`android/build/`, `android/app/build/`, `.gradle/`, `local.properties`). **`local.properties` lleva la ruta del SDK de cada máquina y no se versiona**
- [ ] T018 Comprobar que `./gradlew assembleDebug` produce un APK y que el `verify:` de las tres superficies queda verde **con una app que todavía no hace nada**

---

## Phase 5: User Story 1 — Diego ve los pedidos (Priority: P1)

**Goal**: que el dato esté en su teléfono.

**Independent Test**: se crea un pedido desde la web y aparece en la app.

- [ ] T019 [P] [US1] Modelar en Kotlin la respuesta de `GET /admin/pedidos` con `kotlinx.serialization`. **Los tres puntos son opcionales** (data-model §5): un pedido puede venir sin punto de retiro, sin punto de entrega, o con un estado desconocido. Modelarlos como obligatorios rompe la app con datos que hoy existen en producción
- [ ] T020 [P] [US1] Probar ese mapeo en JVM con las tres formas: pedido completo, sin punto de retiro, y sin punto de entrega. **Es lo único que se puede probar sin dispositivo, y es justo donde estuvo el defecto en `011` las dos veces**
- [ ] T021 [US1] Cliente del servicio con OkHttp: traer la lista con la credencial, y traducir un fallo de red en algo que la pantalla pueda mostrar — **no en una excepción que la tumbe**
- [ ] T022 [US1] Pantalla de ingreso: mail, código, y guardar la credencial en `DataStore` (research D6). Se ve **una vez en la vida**
- [ ] T023 [US1] Pantalla principal con **dos secciones, Pendientes y Tomados** (FR-013), y cada pedido mostrando código, las dos direcciones, tamaño y cantidad, y **los dos teléfonos** —quien envía y quien recibe (FR-015)—, tocables para llamar
- [ ] T024 [US1] Resolver los estados que no son una lista (contrato §5): sin señal al abrir dice que no pudo y ofrece reintentar —**nunca una lista vacía**, que parecería que no hay trabajo—, y sin pedidos de verdad dice otra cosa distinta
- [ ] T025 [US1] Ejecutar **E1 y E2** de [quickstart.md](quickstart.md) en el emulador. E2 es ⚠ y exige fabricar el pedido sin punto de entrega a mano, porque ya no se puede crear uno así

---

## Phase 6: User Story 2 — Diego mueve el pedido (Priority: P1)

**Goal**: que "Pendiente" deje de ser para siempre.

**Independent Test**: se mueve un pedido desde la app y *Mis pedidos* de la web muestra el estado nuevo.

- [ ] T026 [US2] Agregar al cliente la llamada de `PATCH .../estado`, mandando el estado **destino** y no una transición (contrato §1)
- [ ] T027 [US2] Un botón grande por sección: *Ya lo tengo* en Pendientes, *Entregado* en Tomados. **Un toque por pedido y SIN selección múltiple** (FR-012) — los paquetes se levantan de a uno
- [ ] T028 [US2] El deshacer como **acción secundaria**, no como botón principal (contrato §4.4). Lo que avanza tiene que ser lo fácil de tocar; volver atrás no puede tocarse sin querer justo cuando se quería evitar
- [ ] T029 [US2] **No mostrar el cambio como hecho hasta que el servicio conteste** (FR-008). Un pedido que "se movió" en la pantalla y no en la base es peor que un error visible: Diego sigue su día creyendo que quedó registrado
- [ ] T030 [US2] La lista se puede actualizar sin cerrar y volver a abrir la app (FR-010)
- [ ] T031 [US2] Ejecutar **E3 a E7** en el emulador. **E3 es el feature entero** —la primera vez que las dos superficies se hablan— y E5, E6 y E7 son ⚠

---

## Phase 7: Polish y cierre

- [ ] T032 `verify:` verde en las **tres** superficies, con `TEST_DATABASE_URL` puesto. **Mirar el conteo de skips de Go**: sin esa variable el paquete que este feature cambia se saltea entero y el verde no dice nada
- [ ] T033 Ejecutar **E8 y E9**: E8 comprueba con `curl` que **ni leer ni escribir pedidos funciona sin credencial** (SC-006), y E9 que la sesión mueve su vencimiento
- [ ] T034 **Averiguar la versión de Android del teléfono de Diego si T003 quedó sin respuesta**, antes de generar el APK de entrega
- [ ] T035 Generar el APK de `release` y **comprobar que NO lleva la excepción de texto plano** (research D5). Se puede mirar el manifiesto del APK compilado; confiar en que la configuración quedó bien es justo cómo se cuela
- [ ] T036 Instalar la app **en el teléfono de Diego**. Con el teléfono conectado por USB y depuración activada se instala con `adb`; si no, se le pasa el archivo y hay que habilitar "instalar aplicaciones desconocidas" una vez
- [ ] T037 Ejecutar **T2, T3 y T4** de [quickstart.md](quickstart.md) con Diego: que se use con una mano, que se lea al sol, y **un pedido real de punta a punta**. T4 cierra además algo pendiente desde el 2026-08-11 — ver un pedido real contra producción
- [ ] T038 [P] Escribir en `docs/processes/` **cómo se genera el APK** (FR-011) y **cómo se le corta la sesión a un teléfono perdido** (FR-016), que es borrar su fila de `sesiones` desde la consola de Railway
- [ ] T039 [P] Actualizar `ARCHITECTURE.md` con la tercera superficie: qué vive en `android/`, que habla con el servicio por HTTP igual que el sitio, y que no comparte código con nada
- [ ] T040 Anotar en `docs/tech-debt-tracker.md` lo que este feature deja afuera **con su disparador**: la ruta y el panel (esperando que el cliente defina "ruta económica"), la revocación remota de sesión (**se vuelve obligatoria el día que haya un segundo repartidor**), y que elegir qué pedidos lleva cada día no queda registrado
- [ ] T041 Poner `specs/012-app-repartidor/plan.md` en `status: completed` **después** de commitear el resto

---

## Requisitos sin tarea, a propósito

Ninguno. Los dieciséis requisitos del spec tienen al menos una tarea.

**Lo que sí conviene mirar en el diff**: si aparece cualquier archivo bajo `web/`.
El sitio ya sabe mostrar los tres estados desde `010` y **no está en `covers:`**;
si aparece, o el feature se desvió o alguien "arregló" algo que estaba bien.

## Dependencies

- **T001–T003** antes de todo. T003 puede frenar el plan entero.
- **T004 → T005 → T006 → T007 → T008 → T009 → T010.** El servicio es una cadena.
- **US3 (T011–T013)** va antes que la app, aunque sea P2.
- **T014 → T015 → T016 → T017 → T018.** El esqueleto es otra cadena.
- **US1 (T019–T025)** depende del esqueleto y del endpoint.
- **US2 (T026–T031)** depende de US1.
- **T034–T037 necesitan el teléfono de Diego**, y son las únicas.
- **T041 el último de todos.**

## Parallel opportunities

- **El servicio (T004–T013) y el esqueleto (T014–T018) no se tocan**: son dos superficies distintas y pueden avanzar juntos.
- **T019 y T020** son el modelo y su prueba.
- **T038, T039 y T040** son tres archivos distintos.

## Implementation Strategy

**MVP = US1 + US2**, y las dos son P1 a propósito: US1 sola pone el dato en el
teléfono pero deja el problema original intacto —todo seguiría diciendo
"Pendiente"—, y US2 sin US1 no tiene dónde tocarse.

**El orden no es negociable en dos puntos.** T009 con el middleware correcto, o
el feature publica datos de terceros. Y T016 con la excepción de texto plano
limitada a `debug`, o la app de Diego acepta conexiones sin cifrar.

**Lo que se verifica a mano es más que nunca**, y en dos niveles: el emulador
(E1–E9), que se maneja desde la sesión, y el teléfono de Diego (T1–T4), que no lo
reemplaza nada. **Si algo de la Phase 7 se recorta por tiempo, no puede ser
T037**: es lo único que prueba que la app sirve en la calle.
