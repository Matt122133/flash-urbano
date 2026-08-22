---
feature: 011-precio-por-entrega
---

# Tasks: El precio sale de la entrega, no del retiro

**Input**: Design documents from `/specs/011-precio-por-entrega/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/formulario-y-pedido.md](contracts/formulario-y-pedido.md),
[quickstart.md](quickstart.md)

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: puede correr en paralelo — archivo distinto, sin dependencia pendiente
- **[Story]**: a qué historia sirve la tarea
- Toda tarea nombra su archivo

## Path Conventions

Dos superficies: `web/` (Next.js, export estático) y `backend/` (Go + Postgres
con PostGIS). Las rutas son relativas a la raíz del repo y **todas tienen que
prefijar con el `covers:` de [plan.md](plan.md)**.

---

## Phase 1: Setup

- [x] T001 Leer `web/AGENTS.md` y la guía de la versión de Next bajo `node_modules/next/dist/docs/` antes de tocar nada en `web/` — es obligación del repo
- [x] T002 Leer [research.md](research.md) entero antes de la primera edición. **D1, D2 y D6 no son contexto opcional**: D6 en particular describe una guarda de `007` que se muda, y tocarla sin haberla leído es la forma más probable de romper este feature
- [x] T003 Confirmar que `.specify/memory/constitution.md` está en **4.0.0** y que el Principio V dice "delivery zone". Si dice "pickup", la enmienda se perdió en un merge y **hay que frenar** — este plan sería una violación directa

---

## Phase 2: Foundational (Blocking Prerequisites)

**Bloquean todo lo demás**: sin la columna y sin los modos, ninguna historia se puede terminar.

- [x] T004 Vaciar la tabla de pedidos de la base local antes de migrar: `docker exec flash-pg-dev psql -U postgres -d flash_dev -c "TRUNCATE pedidos;"`. **No es limpieza, es parte del procedimiento** (research D5): la columna nueva entra `NOT NULL` sin default y las filas viejas tienen precios calculados con la regla vieja
- [x] T005 Crear `backend/migrations/0004_precio_por_entrega.sql`: `ADD COLUMN entrega_punto geography(Point,4326) NOT NULL`, `ALTER COLUMN retiro_punto DROP NOT NULL`, y **el comentario que corrige** al de `0003` —que argumenta "sin punto no hay zona, sin zona no hay precio" sobre la columna equivocada—. **`0003` no se edita**: es una migración aplicada, y reescribirla es reescribir historia que otra base ya ejecutó
- [x] T006 Comprobar que la migración corre limpia y que `\d pedidos` muestra `entrega_punto` obligatoria y `retiro_punto` nullable
- [x] T007 [P] Mudar la guarda de `backend/internal/pedidos/handlers.go:209` del punto de retiro al de entrega, con el mensaje nuevo (*falta el punto de entrega*). **La guarda del retiro se borra, no se afloja**: con FR-015 un retiro sin punto es válido, y una guarda que rechaza lo válido es un defecto (research D4)
- [x] T008 [P] Mudar la misma guarda de `backend/internal/pedidos/pedido.go:212`, conservando su motivo textual —evitar un `NOT NULL violation` con un mensaje incomprensible—, que ahora aplica a `entrega_punto`
- [x] T009 Cubrir en `backend/internal/pedidos/handlers_test.go` los tres casos del [contrato](contracts/formulario-y-pedido.md) §2: con los dos puntos (creado), **sin el de retiro (creado — es el caso de FR-015 y no es un error)**, y sin el de entrega (400). El caso del medio es el que demuestra que la guarda vieja se fue de verdad
- [ ] T010 Renombrar los modos de `web/components/bloque-direccion.tsx`: `retiro`/`entrega` pasan a `exigente`/`oportunista` (research D1), y actualizar el comentario de cabecera que hoy explica la diferencia entre los modos viejos. **Un modo llamado `retiro` que usa la entrega es una mentira que dura hasta que alguien la lee mal**
- [ ] T010a **Quitar el valor por defecto de `modo`** (`bloque-direccion.tsx:73` dice `modo = "retiro"`) y volverlo obligatorio. Lo encontró el analyze del 2026-08-22: hoy **un solo** sitio pasa el modo explícito, y los otros dos —la sección de retiro y *Mi cuenta*— viven del default. Renombrar sin esto **le cambia el comportamiento a Mi cuenta sin que nadie lo pida**, y en silencio. Con `modo` obligatorio, el compilador enumera los tres sitios y no queda ninguno decidido por descarte
- [ ] T011 Agregar al modo `oportunista` lo único que no existía: capturar el punto **cuando el cruce resuelve solo**, y **no ofrecer candidatos cuando hay más de uno** (research D2, FR-014). Sin preguntar nunca y sin bloquear nunca
- [ ] T012 Pasar `modo="exigente"` **explícito** en `web/components/sesion/formulario-perfil.tsx`, que hoy no pasa ninguno. **Su comportamiento no cambia**: Mi cuenta conserva mapa y punto ajustable (FR-016). La tarea existe justamente para que siga sin cambiar — sin ella, T010a lo deja sin compilar o T010 se lo cambia de callado

**Checkpoint**: `verify:` verde en las dos superficies, y ningún archivo del repo menciona `modo="retiro"`.

---

## Phase 3: User Story 1 — El precio sale de a dónde va el paquete (Priority: P1)

**Goal**: cotizar y confirmar un envío cuyo precio salga del punto de entrega.

**Independent Test**: retiro en zona 1 y entrega en zona 5 cobra $350; invertidas, $150.

- [ ] T013 [US1] En `web/components/pedido-form.tsx`, pasar `exigente` a la sección de entrega y mover ahí el mapa. La sección de retiro pasa a `oportunista` y **pierde el mapa**. El orden de las secciones **no cambia** (FR-002a)
- [ ] T014 [US1] Derivar el precio de `entrega.direccion.punto` en el único lugar donde hoy sale del retiro (`pedido-form.tsx:291` y `:736`). **Una sola fuente de precio**: si quedan dos caminos de cálculo, quedan dos precios posibles para el mismo envío, que es el defecto que este feature saca
- [ ] T014a [US1] En `web/lib/pedido.ts`, mover el punto obligatorio del retiro a la entrega en `armarCuerpoPedido()` (`:50` lo tipa requerido, `:121` lo escribe) y cubrirlo en `web/lib/pedido.test.ts`. **Es el último eslabón y el más fácil de olvidar**: `crearPedido(cuerpo: unknown)` no tipa el payload, así que si esto falta **TypeScript no dice nada** y el defecto aparece recién al confirmar, como un 400 del servicio. El cuerpo tiene que poder llevar la entrega con punto y el retiro **sin** punto (FR-015)
- [ ] T015 [US1] Mudar la validación de "sin ubicación no hay pedido" (`pedido-form.tsx:154-174`) al punto de entrega: sin punto no hay precio ni confirmación, fuera de toda zona se encamina al contacto directo, y **nunca la zona más cercana**
- [ ] T016 [US1] Agregar la comprobación del área para el retiro (FR-011): si el punto resolvió y cae fuera de toda zona, avisa y no deja confirmar. **Sólo actúa cuando hay punto** — si no resolvió, el pedido sigue en silencio (FR-015). Esa asimetría es deliberada y va comentada en el código
- [ ] T017 [US1] En `web/components/sesion/rehidratar-retiro.ts`, quitar del camino del **retiro** la rama que descarta el punto guardado y avisa cuando ya no cae en su cuadra (FR-017), y dejar esa revalidación donde ahora corresponde: el punto que cobra. **Citar research D6 en el commit** — quien vea una prueba de `007` en rojo sin este contexto va a revivir una guarda que dejó de tener sentido o borrar una que sí lo tiene
- [ ] T018 [US1] Ajustar la copia del formulario que hoy afirma que del retiro salen la zona y el precio (`pedido-form.tsx:468`, `:519`). Es texto de cara al cliente diciendo algo que pasa a ser falso
- [ ] T019 [US1] Ejecutar M1 a M8 de [quickstart.md](quickstart.md) **en un teléfono**. M3, M4, M5 y M6 son ⚠. **M3 es el más importante del feature**: cotizar sin cuenta, con el servicio apagado, completando sólo la entrega

**Checkpoint**: US1 entregable sola. El precio ya es el correcto aunque repetir todavía no funcione.

---

## Phase 4: User Story 2 — Repetir un pedido sigue funcionando (Priority: P2)

**Goal**: que `010` no quede roto.

**Independent Test**: repetir un pedido muestra el precio de la zona de su entrega, con aviso de reajuste si cambió.

- [ ] T020 [P] [US2] En `web/lib/api.ts`, ensanchar `PedidoGuardado` para admitir punto en las dos direcciones, y corregir el comentario que hoy afirma que *"el punto solo lo tiene el retiro"*. **Tiene que admitir las tres formas** que `GET /pedidos` puede devolver (contrato §3), incluidos los pedidos anteriores a `011`
- [ ] T021 [US2] En `web/lib/repetir.ts`, mudar a la entrega las dos mitades: el mapeo del punto al formulario, y la decisión del reajuste comparando la zona que resuelve el punto **de entrega** hoy contra el precio guardado. La mitad que hoy adapta el retiro a `rehidratarRetiro()` se achica: el retiro ya no tiene mapa
- [ ] T022 [US2] Actualizar `web/lib/repetir.test.ts` — las 24 pruebas existentes cambian de campo. **Agregar el caso de un pedido sin punto de entrega**, que es el que FR-013 protege y hoy no existe
- [ ] T023 [US2] En `web/components/pedido/crear-pedido.tsx`, resolver el caso del pedido anterior a `011`: precarga todo lo demás, la entrega queda por completar, con un aviso que lo explique. **Nunca una pantalla a medio cargar** (contrato §4)
- [ ] T024 [US2] Ejecutar M9 y M10 de [quickstart.md](quickstart.md) con los cuatro casos de la tabla del contrato §4. **El tercero exige insertar a mano una fila con `entrega_punto` nulo**, porque la columna no lo admite — es la única forma de probar FR-013 y no se saltea por incómoda

---

## Phase 5: User Story 3 — Mi cuenta sigue precargando lo que sabe (Priority: P3)

**Goal**: que el perfil siga sirviendo para lo que la gente lo llenó.

**Independent Test**: con dirección guardada, el retiro viene precargado y la entrega vacía.

- [ ] T025 [US3] Comprobar que el retiro precargado del perfil usa el punto **guardado** —el que la persona marcó a mano— y no el resuelto en silencio del texto (FR-016). Es el mejor dato de retiro que el sistema tiene y sería absurdo descartarlo
- [ ] T026 [US3] Ejecutar M8 de [quickstart.md](quickstart.md), con su paso ⚠: un punto guardado que ya no cae en su cuadra **se usa igual y no avisa**. Si el aviso viejo todavía aparece, quedó viva la guarda que T017 tenía que sacar

---

## Phase 6: Polish y cierre

- [ ] T027 `verify:` verde: `cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./...`. **Mirar el conteo de skips de Go**: sin `TEST_DATABASE_URL` las pruebas que tocan Postgres se saltean solas y el verde no dice nada de la migración
- [ ] T028 Comprobar que `npx vitest run lib/cotizar-abierto.test.ts` pasa **sin haber tocado `ENTRADAS` ni `PROHIBIDOS`** (research D8). Si se puso en rojo, el defecto está en el cambio — sacar una entrada para calmarla es cómo se rompe la cotización pública sin que nadie se entere
- [ ] T029 Ejecutar **H1** de [quickstart.md](quickstart.md): teclado y lector de pantalla sobre el historial y el conmutador de `010`. Deuda heredada
- [ ] T030 Ejecutar **H2**: los tres estados que no son una lista, incluido el ⚠ del servicio caído con su reintento. Deuda heredada
- [ ] T031 Ejecutar **H3**: ⚠ que nadie vea lo ajeno, con dos cuentas. **Es la única de las tres que cubre un agujero de seguridad (SC-004) y sigue sin verificarse desde que se construyó**
- [ ] T032 [P] Anotar en `docs/tech-debt-tracker.md` **el número** que a la deuda del retiro sin punto le falta: cuántos pedidos quedaron con `retiro_punto IS NULL` sobre el total, contando los dos caminos (texto que no resuelve, y calle homónima)
- [ ] T033 [P] Actualizar `ARCHITECTURE.md`: de dónde sale el precio, los modos renombrados del bloque de dirección, y que el punto de retiro dejó de ser obligatorio
- [ ] T034 [P] Actualizar `docs/processes/dev-setup.md` si el procedimiento de vaciar la base local antes de migrar merece quedar escrito para la próxima
- [ ] T035 Comprobar que `git status` no muestra `web/lib/zonas.ts` ni `web/public/calles-mvd.json` modificados: son archivos generados y este feature no tiene por qué tocarlos
- [ ] T036 Poner `specs/011-precio-por-entrega/plan.md` en `status: completed` **después** de commitear el resto: el sensor de cobertura rebota un commit cuyo plan ya está cerrado

---

## Requisitos sin tarea, a propósito

**FR-006** (con dos zonas gana la más barata) y **FR-010** (el servicio no
resuelve zonas) no tienen ninguna tarea, y está bien: describen lo que **no**
cambia. `web/lib/zona-lookup.ts` ya los implementa y `zona-lookup.test.ts` ya los
prueba, y por eso ninguno de los dos está en `covers:`.

**Lo que sí hay que mirar al revisar el diff**: si alguno de esos dos archivos
aparece tocado, o el feature se desvió o alguien "arregló" una prueba que estaba
bien.

## Dependencies

- **T001–T003** antes de cualquier edición. T003 es un gate real, no un trámite.
- **T004 → T005 → T006.** La migración no corre sobre la base con datos.
- **T005 → T007, T008.** Las guardas del servicio suponen la columna.
- **T010 → T010a → T011, T012, T013.** Los modos primero, el default después: T010a es lo que obliga a que los tres consumidores se declaren.
- **T014 → T014a.** Sin el cuerpo del POST, el precio correcto no llega a la base.
- **T013 → T014 → T015, T016.** La sección tiene que tener el modo antes de que se le mueva el precio.
- **US1 (T013–T019)** no depende de US2 ni de US3. Es el MVP.
- **US2 (T020–T024)** depende de US1 y de T020.
- **US3 (T025–T026)** depende de T017: lo que verifica es que esa guarda se fue.
- **Phase 6** al final, y **T036 el último de todos**.

## Parallel opportunities

- **T007 y T008** son archivos distintos del backend.
- **T020** puede empezar apenas termine la Phase 2: es un tipo, no depende del formulario.
- **T032, T033 y T034** son tres archivos distintos y no dependen entre sí.
- **Las dos superficies avanzan en paralelo**: T005–T009 (backend) y T010–T012 (web) no se tocan.

## Implementation Strategy

**MVP = US1.** El precio correcto es el feature; si US2 se complicara, se corta
después de T019 y lo entregado ya arregla lo que estaba mal. Repetir un pedido
quedaría roto para los pedidos viejos, que son cero en producción.

**El orden no es negociable en dos puntos.** T004 antes que T005, o la migración
falla a mitad de camino. Y T017 con research D6 leído, porque es la única tarea
del plan que **quita** una protección: hacerla sin entender por qué existía es
cómo se borra una guarda que todavía hacía falta.

**Lo que se verifica a mano es más que de costumbre.** Este plan hereda tres
pasos sin correr de `010` (T029–T031) además de los suyos. **T031 cubre un
agujero de seguridad**, y si algo de la Phase 6 se va a recortar por tiempo, no
puede ser ésa.
