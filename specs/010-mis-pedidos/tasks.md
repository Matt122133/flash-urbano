---
description: "Task list for 010-mis-pedidos"
---

# Tasks: Mis pedidos — el historial y el botón de repetir

**Input**: Design documents from `/specs/010-mis-pedidos/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/pantallas.md](contracts/pantallas.md),
[quickstart.md](quickstart.md)

**Tests**: sólo hay una tarea de pruebas automáticas (T009), y es deliberado. El
2026-08-22 se decidió **no** montar entorno de pruebas de interfaz; lo que cubre
las pantallas son las tareas de verificación manual (T007, T015), que **no son
opcionales**: son la única verificación que este feature tiene.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin depender de algo sin terminar)
- **[Story]**: a qué historia pertenece (US1 = ver el historial, US2 = repetir)

## Path Conventions

Una sola superficie: `web/`. El servicio no se toca. Los caminos que este plan
puede editar son los de `covers:` en [plan.md](plan.md); antes de cada escritura,
comprobar que el archivo empieza con uno de esos prefijos.

---

## Phase 1: Setup

**Purpose**: lo que el repo exige antes de escribir código de web.

- [x] T001 Leer `web/AGENTS.md` y la guía de la versión de Next bajo `node_modules/next/dist/docs/` antes de tocar nada en `web/` — es obligación del repo, y acá importa concretamente por el límite de Suspense de T011

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: sin esto ninguna de las dos historias puede leer un pedido completo.

- [x] T002 Ensanchar `PedidoGuardado` en `web/lib/api.ts` hasta lo que `GET /pedidos` devuelve de verdad (remitente, las dos direcciones con `numero`/`apto` nulables, el punto de retiro, paquete, cantidad, destinatario), según la tabla de [data-model.md](data-model.md), y dejar anotado en el comentario del tipo que es una copia a mano del backend que TypeScript no valida en runtime
- [ ] T003 Comprobar en la consola del navegador, con sesión iniciada, que `misPedidos()` devuelve objetos con `retiro.punto` y `destinatarioNombre` — no los siete campos de `007` (resultado observable del Tramo 1 de [plan.md](plan.md))

---

## Phase 3: User Story 1 — Ver mis pedidos (Priority: P1)

**Goal**: quien tiene sesión ve en *Mi cuenta* lo que envió, lo más reciente
primero, y puede desplegar cada pedido para ver el detalle.

**Independent Test**: con una cuenta con pedidos, entrar a `/perfil` y comprobar
códigos, orden y detalle; con una cuenta sin pedidos, ver el estado vacío. Se
entrega sola: cierra el agujero de `007` —perder el código no tenía vuelta— sin
depender de US2.

- [x] T004 [P] [US1] Crear `web/components/pedido/tarjeta-pedido.tsx`: tarjeta con código, fecha de **retiro**, estado traducido, precio cobrado y calle de entrega; detalle desplegable con `<details>`/`<summary>` (research D8) que muestra retiro y entrega completos, tamaño y cantidad, destinatario y `creadoEn`. Los estados se traducen según la tabla de [contracts/pantallas.md](contracts/pantallas.md) y un valor desconocido se muestra crudo antes que romper la pantalla (FR-006)
- [x] T005 [US1] Crear `web/components/pedido/historial.tsx`: trae la lista con `useLlamadaAutenticada()` —no con `pedir` directo, o un 401 deja la pantalla sin salida—, **respeta el orden en que vino** (el servicio ya devuelve `creado_en DESC`; re-ordenar en el navegador es la única forma de romper FR-002), muestra los 5 más recientes con un "Ver todos" para el resto de lo ya traído, y resuelve los tres estados que no son una lista: sin pedidos (FR-010), error con botón de reintentar (FR-009), y nada en absoluto sin sesión (FR-008)
- [x] T006 [US1] Montar `Historial` en `web/app/perfil/page.tsx` debajo del formulario de datos, sólo en la rama con sesión, sin tocar la rama `SinSesion` ni la de carga
- [ ] T007 [US1] Ejecutar M1, M2, M3 y M4 de [quickstart.md](quickstart.md) **en un teléfono**. M4 es ⚠: exige dos cuentas y comprobar que un `?repetir=` ajeno no filtra nada (SC-004)

**Checkpoint**: US1 entregable. `verify:` verde y M1–M4 hechos.

---

## Phase 4: User Story 2 — Repetir un pedido (Priority: P2)

**Goal**: desde el historial, un botón deja el formulario cargado tal como fue el
pedido, con el cuándo vacío y el precio de hoy.

**Independent Test**: repetir un pedido, comprobar que todo llega cargado salvo
fecha y hora, que el precio es el de hoy, confirmar, y ver un pedido nuevo con
código distinto sin que el original se altere.

- [x] T008 [P] [US2] Crear `web/lib/repetir.ts`: mapear la dirección de retiro del pedido a la forma que `rehidratarRetiro()` acepta (`null` a `""`), pasar remitente, entrega, tamaño, cantidad y destinatario a los campos del formulario, y decidir si hubo reajuste comparando el precio de la zona que resuelve el punto hoy contra el `precio` guardado. **No puede importar nada de `web/components/`** — la dependencia va en un solo sentido (research D5). **Y no copia cuatro cosas, a propósito**: `retiroFecha` y `retiroHora` quedan fuera del resultado (FR-014 — el formulario los muestra vacíos si `inicial` no los trae), y `precio` y `zonaId` tampoco viajan al formulario (FR-015 — el precio se resuelve del punto, no se hereda). Sólo se leen para decidir el reajuste
- [x] T009 [P] [US2] Crear `web/lib/repetir.test.ts`: pedido sin número y sin apartamento, cooperativa marcada y sin marcar, los tres tamaños, y el reajuste con precio igual, mayor y menor. Incluir una guarda de grafo de imports que se ponga en rojo si el módulo alcanzara `web/components/`, con el mismo patrón de `web/lib/cotizar-abierto.test.ts` — y con su control positivo, o la guarda no demuestra nada
- [x] T010 [US2] Agregar el botón *Repetir* **dentro del detalle desplegado** de `web/components/pedido/tarjeta-pedido.tsx`, apuntando a `/pedido?repetir=<id>` con el uuid, nunca el código `FU-####` (contrato §1)
- [x] T011 [US2] Envolver en `<Suspense>` la lectura de `?repetir=` en `web/app/pedido/page.tsx`: sin el límite, `useSearchParams()` rompe el prerender del export estático. El encabezado tiene que seguir estando en el HTML pre-renderizado — el sitio es indexable desde `004`
- [x] T012 [US2] En `web/components/pedido/crear-pedido.tsx`, agregar a `usePrecarga()` el camino **excluyente** de research D2: con `?repetir=` válido el `inicial` sale entero del pedido y la precarga del perfil no corre; sin él, todo queda como hoy. **La decisión se toma una vez adentro del efecto, nunca derivada del render**, y `PedidoForm` se monta una sola vez ya con su `inicial` — derivarla es lo que el 2026-08-14 borraba lo tipeado (FR-013b)
- [x] T012a [US2] **Revalidar el punto antes de dejar cobrar (FR-016)**, en el camino de repetir y con el mismo criterio que ya usa la precarga del perfil: si `rehidratarRetiro()` devuelve `puntoEnLaCuadra: false`, el punto se recoloca en el cruce y se avisa; si `resolverZona()` del punto da `null`, **no hay precio y no se puede confirmar**, y la pantalla encamina al contacto directo. Nunca la zona más cercana. Es el requisito de plata del feature y por eso es tarea propia y no un detalle de T012
- [x] T012b [US2] Comprobar que un envío repetido usa una **clave de idempotencia nueva** (`claveDeIntento()` de `web/lib/pedido.ts`), y que repetir dos veces a propósito no comparte clave (FR-019). Una clave reusada convierte dos envíos deliberados en uno, que no es un pedido de menos sino un paquete que nadie pasa a buscar
- [x] T013 [US2] Cubrir los casos feos de la tabla del contrato en la misma composición: id que no está en la lista, id de otra cuenta, servicio sin responder, y sin sesión. Los cuatro terminan en un aviso y un **formulario vacío y usable**, nunca en una pantalla a medio cargar (research D1)
- [x] T014 [US2] Mostrar el aviso de reajuste arriba del formulario, por el mismo camino que `avisoDelPunto`, sin el monto anterior y sin poner los dos precios juntos (FR-015a/b/c). Los dos avisos pueden convivir, y el del punto va primero
- [ ] T015 [US2] Ejecutar M5 a M13 de [quickstart.md](quickstart.md) **en un teléfono**. M7, M8 y M11 son ⚠ y son los que verifican SC-003 y FR-021; M5 incluye el paso que detecta el remonte del formulario, que ninguna prueba de este repo puede ver

**Checkpoint**: feature completa.

---

## Phase 5: Polish y cierre

- [x] T016 `verify:` verde: `cd web && npm run lint && npm test && npm run build`
- [x] T017 Comprobar que el diff **no** toca `web/components/pedido-form.tsx`, `web/components/sesion/rehidratar-retiro.ts` ni `backend/`, y que `npx vitest run lib/cotizar-abierto.test.ts` pasa **sin haber tocado `ENTRADAS` ni `PROHIBIDOS`** (FR-022)
- [ ] T018 Comprobar que `git status` no muestra `web/lib/zonas.ts` modificado: M7 y M8 lo editan a mano para forzar los casos malos, y ese archivo es generado — si el precio de prueba llega a un commit, se cobra mal
- [x] T019 Anotar en `docs/tech-debt-tracker.md` la ausencia de paginado **con el umbral en números** — a partir de cuántos pedidos por persona la respuesta empieza a doler (FR-024)
- [x] T020 Anotar en `docs/tech-debt-tracker.md` el agujero de verificación, diciendo **qué pantallas quedaron sin prueba automática**, sumándolo a la fila del 2026-08-14 o abriendo la suya (FR-026)
- [x] T021 Actualizar `ARCHITECTURE.md`: los componentes nuevos de `web/components/pedido/` y `web/lib/repetir.ts`, y que `/perfil` dejó de ser sólo el formulario de datos
- [ ] T022 Poner `specs/010-mis-pedidos/plan.md` en `status: completed` **después** de commitear el resto: el sensor de cobertura rebota un commit cuyo plan ya está cerrado

---

## Dependencies

- **T001** antes de cualquier edición en `web/`.
- **T002 → T003 → todo lo demás.** Sin el tipo ensanchado, ni la tarjeta ni el mapeo tienen de dónde leer.
- **US1 (T004–T007)** no depende de US2. Es el MVP.
- **US2 (T008–T015)** depende de US1 sólo por T010: el botón vive en la tarjeta.
- **T012 depende de T008**: la composición usa el mapeo puro.
- **T012a depende de T012**, y es la que M8 verifica. Si se saltea, el feature puede cobrar sobre un punto que envejeció.
- **Phase 5** al final, y **T022 el último de todos**.

## Parallel opportunities

- **T004 y T005** son archivos distintos; T005 consume a T004, así que conviene acordar antes la forma de la tarjeta y escribirlos juntos.
- **T008 y T009** en paralelo (módulo y su prueba).
- **T019, T020 y T021** son tres archivos distintos y no dependen entre sí.

## Implementation Strategy

**MVP = US1.** El historial solo ya cierra el agujero que `007` dejó anotado: hoy
quien pierde el código no lo recupera sin escribirle a Diego. Si US2 se
complicara, se corta después de T007 y lo entregado sigue en pie.

**El orden no es negociable en un punto**: T012 es la tarea delicada del feature
y no tiene red automática. Hacerla al final, con todo lo demás verde y con M5 a
mano, es lo que la hace revisable.
