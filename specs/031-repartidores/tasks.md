# Tasks: Repartidores

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[quickstart.md](quickstart.md)

**Tests**: si. El repo prueba cada capa y el plan lo exige paso por paso. Las
pruebas de Go que tocan Postgres necesitan `TEST_DATABASE_URL` (Docker Desktop
levantado; **nunca** el postgres nativo del 5432): sin ella se saltean solas, y
el `verify:` verde no dice nada de la base.

**Format**: `[ID] [P?] [Story] Descripcion`

## Phase 1: Setup — la constitucion primero

- [X] T001 Enmendar `.specify/memory/constitution.md` a **6.3.0 (MINOR)**: el Principio III pasa a "a single courier business — one owner, possibly more than one person delivering — not a multi-tenant platform"; *Scope boundaries* describe la app como la de quien reparte (administradores y repartidores) y el tablero suma el corte por repartidor, contado por fecha de entrega y sin importes; entrada de historial con el pedido de Diego del 2026-10-18 (FR-024, research D11)
- [X] T002 [P] Escribir `docs/decisions/more-than-one-courier.md` (frontmatter `id: more-than-one-courier`, formato de `price-behind-the-login.md`): el rol en configuracion, la asignacion por mail sin FK, "fijo al entregar", y lo descartado (columna `type`)
- [X] T003 [P] Corregir "`android/` — Diego's app" en `AGENTS.md` y copiar el archivo byte a byte a `CLAUDE.md`; agregar el ADR a `docs/README.md`

## Phase 2: Foundational — rol, columna y responsable

**Bloquea todas las historias.**

- [X] T004 Escribir `backend/migrations/0011_repartidor_del_pedido.sql`: `ALTER TABLE pedidos ADD COLUMN repartidor_email text CHECK (repartidor_email = lower(repartidor_email))`, nulable y sin default, e indice parcial `WHERE repartidor_email IS NOT NULL`; comentario que nombre 0004 (data-model §1)
- [X] T005 Probar la migracion contra una base **con pedidos ya cargados**: todas las filas quedan con `repartidor_email` nulo y ninguna se reescribe; en `backend/internal/db/migrate_test.go` (SC-007)
- [X] T006 [P] Agregar `RepartidorEmails` y `EsRepartidor` en `backend/internal/config/config.go`: **opcional** (vacia = ninguno, nunca entra a `faltantes`), misma `normalizarEmail`, falso si `EsAdmin` (FR-001, FR-004, D1)
- [X] T007 [P] Pruebas en `backend/internal/config/config_test.go`: arranca sin la variable; mayusculas y espacios; mail en las dos listas → no es repartidor
- [X] T008 [P] Documentar `REPARTIDOR_EMAILS` (opcional, sin mails reales) en `backend/README.md` y `backend/.env.example`
- [X] T009 Leer `repartidor_email` en `columnas`/`escanear` de `backend/internal/pedidos/pedido.go` (campo no exportado, como `colorCliente`) y agregar la funcion pura `Responsable(p, esRepartidor) *string` de data-model §3
- [X] T010 Prueba de tabla de `Responsable` en `backend/internal/pedidos/pedido_test.go`: los cuatro casos de data-model §3
- [X] T011 Exponer `responsable` (omitido si es de administradores) en `ParaAdmin` en `backend/internal/pedidos/pedido.go`; **nunca** en `Pedido`, y extender `respuesta_cliente_test.go` para que `GET /pedidos` del cliente no lo traiga

**Checkpoint**: el servicio arranca igual que hoy y la app vieja no nota nada.

## Phase 3: User Story 1 — Diego le da un pedido al repartidor (P1) 🎯 MVP

**Goal**: asignar y desasignar desde la app; "Mios / Todos".

**Independent Test**: Q1, Q2, Q9 del quickstart.

### Backend

- [X] T012 [US1] Agregar `Asignar(ctx, id, a *string, soloSiEsDe *string)` en `backend/internal/pedidos/pedido.go`: `UPDATE … SET repartidor_email = $2 WHERE id = $1 AND estado <> 'entrega' [AND repartidor_email = $3]`, devolviendo si cambio; con cero filas, relee para distinguir `ErrNoExiste` de `ErrEntregado` (contrato §3)
- [X] T013 [US1] Handler `Asignar` en `backend/internal/pedidos/handlers.go` con la tabla completa del contrato §3: admin asigna solo a `EsRepartidor`; 400, 403, 404, 409 con los textos del contrato; mismo responsable → 200 sin escribir
- [X] T014 [US1] `Todos` en `backend/internal/pedidos/handlers.go`: admin recibe todos con `rol: "admin"` y `repartidores` (configurados, con `nombre` de `usuarios` por mail si existe); el handler recibe `esRepartidor` y la lista por constructor
- [X] T015 [US1] Montar `PUT /admin/pedidos/{id}/repartidor` con `conSesion` y cablear `cfg.EsRepartidor`/`cfg.RepartidorEmails` en `backend/cmd/api/main.go`; extender `main_test.go` para que la ruta no responda sin credencial
- [X] T016 [US1] Pruebas de handler y de base en `backend/internal/pedidos/handlers_test.go`: cada fila del contrato §3, incluida "pedido entregado → 409" y "asignar a un admin → 400"

### App

- [X] T017 [P] [US1] Modelo en `android/app/src/main/java/uy/flashurbano/repartidor/datos/Pedido.kt`: `responsable: String?`, y la respuesta de lista con `rol` y `repartidores`
- [X] T018 [US1] `Servicio.asignar(credencial, id, repartidor: String?)` en `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt`, con 404/409 mapeados a textos para el usuario (nunca el error crudo de OkHttp)
- [X] T019 [P] [US1] Pruebas en `android/app/src/test/java/uy/flashurbano/repartidor/datos/ServicioTest.kt` y `PedidoTest.kt`: parseo con y sin las claves nuevas (app vieja / servicio nuevo), y los textos de 404 y 409
- [X] T020 [US1] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/RepartidorViewModel.kt`: guardar `rol` y `repartidores`, filtro `MIOS`/`TODOS` que **arranca en MIOS** y sobrevive a la rotacion, y `asignar(pedido, a)` que no dibuja el cambio hasta que el servicio conteste (FR-008 de `012`)
- [X] T021 [US1] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`: chips "Mios"/"Todos" solo con `rol == admin`; en Todos, el nombre del repartidor en la tarjeta; accion "Asignar" en la tarjeta de un pedido no entregado que abre la lista "Diego" + repartidores; **con `repartidores` vacia, "Asignar" no se ofrece** y Todos lo explica en una linea ("no hay repartidores configurados") (US1-3)
- [X] T022 [P] [US1] Prueba de que el filtro deja cada pedido en exactamente una de las dos vistas "Mios" o la de un repartidor, en `android/app/src/test/java/uy/flashurbano/repartidor/pantallas/EstadoPantallaTest.kt` (SC-002)

**Checkpoint**: Diego asigna y desasigna; nadie mas ve nada nuevo.

## Phase 4: User Story 2 — El repartidor trabaja sus pedidos (P1)

**Goal**: el repartidor entra, ve solo lo suyo, lo mueve y lo devuelve.

**Independent Test**: Q4, Q5, Q7, Q8, Q12 del quickstart.

- [X] T023 [US2] `PorRepartidor(ctx, email)` en `backend/internal/pedidos/pedido.go` (`WHERE repartidor_email = $1`) y `Todos` del handler: repartidor recibe solo lo suyo con `rol: "repartidor"` y sin `repartidores`; otro → 403 como hoy
- [X] T024 [US2] `CambiarEstado` en `backend/internal/pedidos/pedido.go` y `handlers.go`: el repartidor pasa, y el `SELECT … FOR UPDATE` suma `AND repartidor_email = $yo` cuando llama un repartidor; ajeno → `ErrNoExiste` → 404 con el mismo texto que un id inventado (FR-015, D6)
- [X] T025 [US2] Prueba de pedido ajeno en `backend/internal/pedidos/handlers_test.go` **con control positivo**: el repartidor no puede leer ni mover uno ajeno, puede con uno suyo, y quitando a proposito el filtro del `WHERE` la prueba se pone en rojo (anotar en el PR que se hizo)
- [X] T026 [US2] Devolver: el repartidor llama `PUT …/repartidor` con `null` sobre lo suyo; cubierto por T013, agregar el caso "devolver lo ajeno → 404" y "devolver lo entregado → 409" a `handlers_test.go`
- [X] T027 [US2] En `RepartidorViewModel.kt` y `Principal.kt`: con `rol == repartidor`, sin chips ni "Asignar"; accion **"Devolver a Diego"** en la tarjeta de un pedido no entregado; el texto en una sola constante (research D10)
- [X] T028 [US2] Comprobar que el rechazo de una cuenta que no es ni admin ni repartidor sigue diciendo lo mismo que hoy en `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt` (US2-4)

**Checkpoint**: US1 + US2 son el feature usable en la calle.

## Phase 5: User Story 3 — Aviso al repartidor (P2)

**Independent Test**: Q3, Q9 del quickstart.

- [X] T029 [P] [US3] `TokensDe(ctx, email)` en `backend/internal/avisos/destinatarios.go`, con los mismos tres filtros que `Tokens`; prueba de base en `destinatarios_test.go`
- [X] T030 [P] [US3] `ArmarAsignacion` en `backend/internal/avisos/mensaje.go`: titulo "Nuevo paquete asignado " + codigo, cuerpo con la calle de entrega; prueba en `mensaje_test.go`
- [X] T031 [US3] `AvisarAsignacion` en `backend/internal/avisos/avisador.go` (y `Mudo`), y que `AvisarEdicion`/`AvisarBaja` sumen los tokens del repartidor asignado si lo hay (FR-019a, research D7); pruebas en `avisador_test.go`, incluido que `AvisarPedidoNuevo` **no** le llega al repartidor y, como control positivo, que la edicion de un pedido suyo **si** (FR-019)
- [X] T032 [US3] Disparar `AvisarAsignacion` en segundo plano desde el handler `Asignar` solo si el responsable cambio **a** un repartidor; desasignar no avisa; una falla no deshace nada (FR-017, FR-017a, FR-018); pasar el repartidor a `avisarDeLaEdicion`/`avisarDeLaBaja` en `backend/internal/pedidos/handlers.go`; pruebas en `aviso_test.go`

## Phase 6: User Story 4 — Repartidores en el tablero (P2)

**Independent Test**: Q10, Q11 del quickstart.

- [X] T033 [US4] `Cargas` en `backend/internal/tablero/tablero.go` suma `repartidor` (solo entregadas y asignadas) y `entregadoEn` (ultima entrega, solo si sigue entregado); `Repartidores(ctx, configurados)` = configurados ∪ mails con entregas fijas, sin admins, con `nombre` por mail; cablear en `handlers.go` y `main.go`
- [X] T034 [US4] Pruebas en `backend/internal/tablero/tablero_test.go` y `forma_estable_test.go`: forma estable con las claves nuevas; un repartidor fuera de la configuracion con entregas sigue en la lista; **una sesion de repartidor en `GET /admin/tablero` → 403** (FR-016); `sin_plata_test.go` sigue verde
- [X] T035 [US4] `?repartidor=` en `backend/internal/reporte/handlers.go` y `reporte.go`: exactamente uno de `cliente`/`repartidor` (400 si no); filtro `estado = 'entrega' AND repartidor_email = $1` y corte por `(ultima entrega AT TIME ZONE 'America/Montevideo')::date` (D9)
- [X] T036 [US4] Pruebas en `backend/internal/reporte/reporte_test.go`: entrega a las 22:00 del 30/9 en Montevideo cae en septiembre; pedido no entregado no aparece; ningun pedido de otro repartidor; los dos parametros → 400; **una sesion de repartidor → 403**, aun pidiendo su propio reporte (FR-016)
- [X] T037 [P] [US4] En `web/lib/tablero.ts`: tipos con `repartidor`, `entregadoEn`, `repartidores`; `resumirPorRepartidor` que agrupa por `entregadoEn` en Montevideo con `periodoDe`; textos propios (corte por entrega, repartidor sin entregas, no hay repartidores)
- [X] T038 [P] [US4] En `web/lib/reporte.ts`: `rutaDelReporte` acepta `repartidor`, y `nombreDeArchivo` identifica al repartidor
- [X] T039 [US4] Pruebas en `web/lib/tablero.test.ts` y `web/lib/reporte.test.ts`: corte por entrega, el 30/9 22:00, el nombre del archivo; `lib/sin-precio-a-la-vista.test.ts` sigue verde
- [X] T040 [US4] Seccion "Repartidores" en `web/components/tablero/tablero.tsx`: selector de repartidor, el mismo cuadro por periodo y "Bajar reporte" por semana y mes, con el texto que explica el corte por entrega

## Phase 7: Polish

- [X] T041 [P] `docs/processes/app-repartidor.md`: como sumar y sacar un repartidor (la variable, el redeploy, que pasa con sus pedidos), sin mails reales
- [X] T042 [P] `docs/processes/staging.md` y `docs/processes/railway-despliegue.md`: `REPARTIDOR_EMAILS` en la tabla de variables, opcional
- [ ] T043 Correr el `verify:` del plan y **contar los skips de Go** con `TEST_DATABASE_URL` puesta; pegar el resultado en el PR
- [ ] T044 Desplegar a staging (`railway up`) y correr Q1–Q14 de `specs/031-repartidores/quickstart.md`, con la app en el emulador (`adb -s`)
- [ ] T045 `git diff master..HEAD | grep "^+" | grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+"` antes del PR: ningun mail que no sea de ejemplo o el publicado del negocio

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → US1.** La enmienda va antes del codigo (FR-024).
- **US2 depende de US1** en el backend (T023–T026 usan `Asignar` y el
  `Todos` con rol de T013–T014). En la app, T027 depende de T020–T021.
- **US3 depende de T013** (el handler que dispara el aviso).
- **US4 depende solo de Phase 2**: puede ir en paralelo con US1–US3.
- Polish al final; T044 despues de T043.

### Parallel Opportunities

- T002 ‖ T003; T006 ‖ T007 ‖ T008.
- En US1: T017 ‖ T019 mientras el backend avanza; T022 al lado de T020.
- US3: T029 ‖ T030.
- US4: T037 ‖ T038 mientras T033–T036 avanzan.

## Implementation Strategy

**MVP = Phase 1 + 2 + US1 + US2**: con eso Diego asigna y el repartidor
trabaja. US3 (aviso) y US4 (tablero) pueden llegar en el mismo PR o en uno
siguiente: ninguna de las dos bloquea el trabajo en la calle. Todo pasa por
staging antes de `master`.
