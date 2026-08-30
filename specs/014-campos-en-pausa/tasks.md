---

description: "Tareas de 014 — El tamaño del paquete y la hora de retiro quedan en pausa"
---

# Tasks: El tamaño del paquete y la hora de retiro quedan en pausa

**Input**: `specs/014-campos-en-pausa/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [quickstart.md](quickstart.md)

**Tests**: ninguna prueba nueva. No hay lógica nueva que probar: se comentan dos
campos y se fijan dos valores. Lo que protege este cambio es la suite que ya
existe —incluida la guarda de `013`, que corre sobre estos mismos archivos— más
el quickstart.

**Organization**: por historia de usuario.

## Format: `[ID] [P?] [Story] Descripción`

## Path Conventions

Superficie única `web/`. `backend/` y `android/` **no se tocan**: son FR-007 y
FR-008, no omisiones.

---

## Phase 1: Setup

- [x] T001 **Cerrar `013` antes de promover este plan.** Poner `specs/013-precio-fuera-de-vista/plan.md` en `status: completed`, con lo que quedó sin verificar escrito en el propio plan y sin tildar: al 2026-08-30 estaban pendientes el nivel 1 y el nivel 2 de su quickstart y la mirada de Diego. **No pueden convivir dos planes activos**, y el spec de `014` lo nombra en Dependencias pero ninguna tarea lo hacía — lo encontró el analyze **HECHO**: `013` en `completed`, con T026, T027 y T029 **sin tildar** y el detalle en su propio cierre. No fueron al tracker: son verificacion de trabajo entregado, no deuda.
- [x] T002 Enmendar `.specify/memory/constitution.md`: sacar de las *Scope boundaries* el tamaño de paquete y la ventana de retiro de la lista del formulario, subir a **5.1.0** y agregar la entrada al historial. **MINOR y sin ADR**, con el precedente de la 2.1.0 escrito al lado. Va **antes** del código, como exige el gobierno **HECHO**: constitucion en **5.1.0**. Ademas de la lista, la entrada del historial deja escrito lo que empieza a doler: **ya son tres columnas que guardan un relleno en vez de un hecho** (`precio`, `paquete_tamano`, `retiro_hora`), y que si la lista crece otra vez la pregunta deja de ser "se puede revertir barato" y pasa a ser "para que es esta tabla".

---

## Phase 2: User Story 1 — Cargar un pedido sin que pregunten el tamaño ni la hora (P1) 🎯 MVP

**Goal**: los dos campos no están, el pedido se crea igual, y lo que sale a la
red lleva los valores fijos.

**Independent Test**: quickstart Q1, Q2 y Q6.

- [x] T003 [US1] En `web/components/pedido-form.tsx`, **comentar** el `Field` del tamaño de paquete con su `<select>` (FR-001). **No borrar** `packageSize` de `FormState` ni de `INITIAL_STATE`, ni el tipo `PackageSize`: borrarlos obliga a reescribirlos cuando vuelvan, que es justo lo que el cliente pidió evitar **HECHO**.
- [x] T004 [US1] En `web/components/pedido-form.tsx`, **comentar** el `Field` del horario de retiro con su `<input type="time">` (FR-002). **La fecha no se toca** **HECHO**, y la grilla del bloque de retiro paso de `sm:grid-cols-2` a una columna, porque quedaba un campo solo. Anotado en el comentario para que al reponerlo se devuelva.
- [x] T005 [US1] En `web/components/pedido-form.tsx`, **comentar** las dos líneas de `validate()` que exigen tamaño y horario (FR-005). **Es lo que más fácil se olvida**: sin esto el formulario rechaza un pedido pidiendo un campo que no muestra, y el error no tiene dónde dibujarse. **La validación de fecha pasada NO se toca** — quickstart Q2 existe por eso **HECHO**.
- [x] T006 [US1] En `web/components/pedido/crear-pedido.tsx`, fijar los dos valores que salen a la red: `tamano` pasa de `form.packageSize || "chico"` a `"chico"` fijo, y `hora` de `form.pickupTime` a `"16:00"` (FR-004). Dejar escrito de dónde salen los dos: `chico` es **el respaldo que esta misma línea ya usaba**, `16:00` es la hora a la que pasa Diego **HECHO**.
- [x] T007 [US1] En `web/components/pedido-form.tsx`, el resumen posterior a confirmar deja de mostrar el tamaño, y la fila de retiro deja solo la fecha (FR-006). **Ojo con la fila del paquete**: hoy su valor es `Tamaño chico · x2` — tamaño **y** cantidad en la misma cadena. Se va el tamaño y **queda la cantidad**, que la persona sí eligió. Lo marcó el analyze porque "deja de mostrar el tamaño" no decía qué pasaba con lo otro **HECHO**: la fila del paquete quedo `2 paquetes` —se fue el tamaño, quedo la cantidad, que es lo que marco el analyze— y la de retiro quedo solo con la fecha.

**Checkpoint**: el MVP está entregado.

---

## Phase 3: User Story 2 — Que el próximo que abra el archivo entienda qué pasó (P2)

**Goal**: los bloques comentados se explican solos.

**Independent Test**: quickstart Q5.

- [x] T008 [US2] Escribirle a cada uno de los tres bloques comentados (T003, T004, T005) el encabezado que pide FR-003: **qué feature lo desactivó y cuándo** (`014`, 2026-08-30), **que fue decisión del cliente y que dijo que vuelve**, y **qué hay que descomentar** — nombrando explícitamente que la validación vive en otro lugar del archivo, porque es la mitad que se olvida. El de la hora dice además que **se negocia en persona y puede mover el precio**, que es el motivo de negocio y explica por qué esto es hermano de `013` **HECHO**: los tres bloques dicen que feature, que fecha, que fue del cliente, que **vuelve**, y las TRES cosas que hay que descomentar. El de la hora lleva el motivo de negocio.
- [x] T009 [US2] Dejar en `web/components/pedido/crear-pedido.tsx` la contraparte: que quien reponga los campos sepa que **también hay que revertir los valores fijos de T006**, o el formulario va a preguntar el tamaño y mandar `chico` igual. Es el modo de falla más probable de la reposición **HECHO**: el comentario de `crear-pedido.tsx` nombra el modo de falla mas probable de la reposicion —descomentar el campo y olvidarse del valor fijo— ademas del antecedente del 2026-08-12 que explica por que no se toco el backend.

---

## Phase 4: Consecuencias en el resto del sitio

- [x] T010 [P] En `web/components/pedido/tarjeta-pedido.tsx`, sacar la hora de `Retiro el <fecha> a las <hora>` y el tamaño de `<tamaño> · N paquetes` (FR-006a). **La fecha y la cantidad se quedan**: esas la persona sí las eligió. Aplica a **todos** los pedidos, viejos incluidos — el costo está aceptado en research D5 **HECHO**, y salio una consecuencia: `tamanoVisible()` quedo sin uso. Se comento con el mismo criterio que el resto en vez de borrarse, porque vuelve con el campo.
- [x] T011 [P] En `web/lib/repetir.ts`, anotar que `packageSize` se sigue precargando aunque no se muestre (FR-009). **No se saca**: el día que el campo vuelva, repetir un pedido tiene que volver a precargarlo solo **HECHO**.

---

## Phase 5: Polish y cierre

- [x] T012 [P] Revisar `ARCHITECTURE.md` donde describe `web/components/pedido-form.tsx` —"Client-side validation and the field set live here"— y cualquier enumeración del formulario que haya quedado falsa. Es lo primero que lee cualquier agente antes de tocar código **HECHO**: la seccion de `pedido-form.tsx` dice ahora que hay dos campos comentados, que la validacion vive aparte, y que reponerlos exige revertir tambien los dos literales.
- [x] T013 `verify:` verde — `cd web && npm run lint && npm test && npm run build`. **Mirar que la guarda de `013` siga en verde**: corre sobre los mismos archivos que este feature toca **HECHO**: lint limpio, **175 pruebas**, build OK. **La guarda de `013` sigue verde** aunque los comentarios nuevos nombran el precio — es exactamente el comportamiento para el que se diseño. Ademas, sobre el bundle del export estatico real: "Tamaño del paquete" y "Horario de retiro" **no aparecen**, "Cantidad de paquetes" y "Fecha de retiro" **si**.
- [ ] T014 Ejecutar el **nivel 1** del [quickstart](quickstart.md): Q1 (los campos no están), Q2 (la fecha sigue validando), Q3 (*Mis pedidos*), Q4 (repetir) y **Q5 (los comentarios se explican solos)**
- [ ] T015 Ejecutar el **nivel 2** del [quickstart](quickstart.md), Q6: crear un pedido contra el servicio local y comprobar en Postgres que llegó con `chico` y `16:00`. **`verify:` no puede probar esto**, y es el único modo de falla que la decisión de no tocar el backend deja abierto: si el sitio deja de mandar alguno, el servicio devuelve 400
- [ ] T016 **TUYA** Ejecutar el **nivel 3**, Q7: que Diego lo mire, y que vea que **su app va a decir `Tamaño chico` y `16:00` en todos los pedidos**. Está aceptado a sabiendas, pero él no lo vio
- [ ] T017 Poner `specs/014-campos-en-pausa/plan.md` en `status: completed` **después** de commitear el resto

---

## Dependencies

```text
T001 (cerrar 013) → T002 (la enmienda, antes del codigo)
  └── US1 (T003–T007)   ← MVP
        ├── US2 (T008, T009)   ← depende de que los bloques existan
        └── Fase 4 (T010, T011) ← independientes entre si
              └── Polish (T012–T017)
                    └── T016 es TUYA y bloquea T017
```

**T010 y T011 no dependen de US1**: tocan archivos distintos y se pueden hacer
en cualquier orden.

**T008 y T009 sí dependen de US1**, porque escriben sobre los bloques que US1
crea. Están separadas a propósito: si se hicieran juntas, el comentario se
escribiría de memoria mientras se corta el código, y es justo cuando sale corto.

## Parallel opportunities

- **T010 y T011** en paralelo, y en paralelo con US1 entera
- **T012** en paralelo con todo lo demás

## Implementation strategy

**MVP = US1.** Cinco tareas y el pedido del cliente está cumplido en la pantalla
que importa. **US2 no es opcional aunque parezca**: es lo que evita que esto se
convierta en dos bloques muertos que nadie se anima a borrar.

## Requisitos sin tarea, a propósito

- **FR-007** (el backend no cambia) y **FR-008** (la app no cambia) no tienen
  tarea porque **la forma de cumplirlos es no hacer nada**. La guarda es que
  `covers:` no incluye `backend/` ni `android/`: el sensor de pre-commit rebota
  cualquier intento. Se verifican en T015
- **FR-010** (todo lo demás queda igual) tampoco: se cumple no tocándolo, y lo
  comprueban la suite existente (T013) y el quickstart (T014)
