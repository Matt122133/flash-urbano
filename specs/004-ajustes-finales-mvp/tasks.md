---
description: "Task list for 004-ajustes-finales-mvp"
---

# Tasks: Ajustes finales del MVP

**Input**: Design documents from `specs/004-ajustes-finales-mvp/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: **incluidos y no opcionales.** FR-024 pide explícitamente una
verificación automática de la regla de zona, y `verify:` corre `npm test`. Las
pruebas de `fechas.ts` además no se agregan: se **reescriben**, porque trece de
sus diecisiete casos pierden su sujeto (research R1).

**Organization**: por user story, en orden de prioridad. Ojo con una
particularidad de este feature: **US1, US2 y US3 tocan todas el mismo archivo**
(`web/components/pedido-form.tsx`), así que entre ellas no hay paralelismo real
por más que sean independientes en producto. Ver *Orden de ejecución
recomendado*.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin dependencias)
- **[Story]**: a qué user story pertenece
- Cada tarea nombra el archivo exacto

---

## Phase 1: Setup

**Purpose**: dejar constancia del punto de partida antes de borrar nada.

- [ ] T001 Correr `cd web && npm install && npm run lint && npm test && npm run build` y confirmar que la base está verde **antes** de tocar nada, para que cualquier rojo posterior sea atribuible a este feature y no a algo heredado. Anotar cuántas pruebas pasan (`fechas.test.ts` tiene 17 casos, `zona-lookup.test.ts` 9, más `direcciones.test.ts`).

---

## Phase 2: Foundational

**No hay fase fundacional.** No hay esquema, ni migración, ni infraestructura
compartida que crear: las cinco historias operan sobre archivos que ya existen y
ninguna bloquea a otra. Inventar tareas acá sería ruido. Se pasa directo a las
historias.

---

## Phase 3: User Story 1 - El formulario pide menos cosas (Priority: P1) 🎯 MVP

**Goal**: sacar el selector particular/empresa y la forma de pago del formulario
y del resumen, con su validación.

**Independent Test**: se carga un pedido de punta a punta sin ver ni tocar
ninguno de los dos, y la confirmación no los menciona.

- [ ] T002 [US1] Quitar `clientType` de `web/components/pedido-form.tsx`: el tipo `ClientType`, el campo en `FormState`, su valor en `INITIAL_STATE`, el par de botones de la sección "¿Quién envía?", y el `(${form.clientType})` de la fila Cliente del resumen — que pasa a mostrar solo `form.name`.
- [ ] T003 [US1] Quitar `paymentMethod` de `web/components/pedido-form.tsx`: el tipo `PaymentMethod`, el campo en `FormState`, su valor en `INITIAL_STATE`, la regla `if (!form.paymentMethod)` de `validate()`, el `<select>` de Forma de pago y su `<Field>`, y la fila "Forma de pago" del resumen. **Además, sacar "forma de pago" del encabezado de la sección**, que pasa de "Fechas y forma de pago" a "Fechas" (FR-010). Esto va acá y no en US2 a propósito: si US1 se entrega sola —y el tasks.md la declara MVP entregable— dejar el encabezado nombrando un campo que ya no existe rompe su independencia.
- [ ] T003a [US1] Quitar la descripción libre del paquete de `web/components/pedido-form.tsx` (FR-003a): el tipo `PackageMode`, los campos `packageMode` y `packageDescription` de `FormState` e `INITIAL_STATE`, el par de botones "Tamaño predefinido" / "Describir el paquete", el `<textarea>` y su rama del render, la regla de `validate()` que exigía descripción, y la rama del resumen que mostraba `form.packageDescription`. El `<select>` de tamaño queda visible siempre y obligatorio. **Agregada durante la ejecución**, el 2026-08-06: el cliente lo pidió, y revisando el relevamiento original resultó que ya lo había marcado como no necesario antes de `001` — se implementó igual y sobrevivió tres features. Cae dentro del `covers:` vigente.
- [ ] T004 [US1] Validar a mano según [quickstart.md](quickstart.md), pasos 1, 2 y 2b de la sección *Manual — el formulario*, en viewport de teléfono.

**Checkpoint**: el formulario ya no pide tipo de cliente ni forma de pago, y se
envía igual.

---

## Phase 4: User Story 2 - La entrega se promete, no se agenda (Priority: P1)

**Goal**: sacar fecha y hora de entrega, poner el aviso fijo de 24 horas, y
achicar `fechas.ts` a lo que sigue teniendo sentido.

**Independent Test**: se carga un pedido eligiendo solo fecha y hora de retiro;
el aviso de 24 horas está visible y es idéntico entre dos pedidos con retiros
distintos.

- [ ] T005 [P] [US2] Achicar `web/lib/fechas.ts` según research R1: conservar `Fecha`, `Hora` y `hoy()`; reemplazar `problemaDeFechas()` por una función booleana del tipo `retiroEnElPasado(fecha, diaDeHoy)`; borrar `MARGEN_MINIMO_MINUTOS`, `enMinutos()`, las variantes `entrega-antes-del-retiro` y `margen-insuficiente`, y el `Record` `MENSAJES_DE_FECHAS` (queda una constante con el único mensaje). Conservar la comparación **por día y no por instante**, que es una decisión deliberada ya documentada en el encabezado del módulo.
- [ ] T006 [US2] Reescribir `web/lib/fechas.test.ts`: **borrar** los trece casos de margen mínimo, orden entre retiro y entrega, mismo instante y cruce de medianoche — borrarlos, no apagarlos con `it.skip`. Conservar *rechaza el retiro en un dia que ya paso*, *acepta el retiro hoy mismo* y *formatea como lo espera un input de tipo date*; reformular *no opina si faltan las fechas* y el cruce de fin de mes sobre la fecha de retiro sola.
- [ ] T007 [US2] Quitar `deliveryDate` y `deliveryTime` de `web/components/pedido-form.tsx`: `FormState`, `INITIAL_STATE`, sus dos reglas en `validate()`, sus dos `<Field>`, y simplificar `revisarFechas()` para que solo revise el retiro. Ajustar el encabezado de la sección para que hable solo del retiro — si T003 ya corrió, viene como "Fechas"; si esta historia se entrega sin US1, viene como "Fechas y forma de pago" y hay que sacarle esa mitad igual. Reemplazar el párrafo del margen mínimo por el aviso fijo de las 24 horas.
- [ ] T008 [US2] En el resumen de `web/components/pedido-form.tsx`: quitar la fila "Entrega" y agregar la del compromiso de 24 horas, con **texto fijo** — sin calcular ningún momento a partir del retiro (FR-009a).
- [ ] T009 [US2] Validar a mano según [quickstart.md](quickstart.md), pasos 3, 7 y 8.

**Checkpoint**: no se pide nada de entrega, el compromiso está a la vista en las
dos pantallas, y `npm test` pasa con la suite de fechas reescrita.

---

## Phase 5: User Story 3 - Se puede llamar a quien recibe (Priority: P2)

**Goal**: reemplazar nombre y cédula de quien recibe por su teléfono.

**Independent Test**: se carga un pedido cuyo único dato del destinatario es un
teléfono; el formulario rechaza menos de 8 dígitos **mostrando el mensaje**.

- [ ] T010 [US3] En `web/components/pedido-form.tsx`, reemplazar `recieverName` y `recieverCI` por `receiverPhone`: `FormState`, `INITIAL_STATE`, las dos reglas de `validate()` por una sola de teléfono (no vacío y ≥8 dígitos tras descartar lo que no sea número, igual que `phone`), los dos `<Field>` de la sección "¿Quién recibe el paquete?" por uno, y la fila del resumen. **La clave del error tiene que escribirse idéntica en `validate()` y en el render** — research R5: la traspuesta `recieverName`/`receiverName` es por lo que el mensaje anterior nunca se mostró.
- [ ] T011 [US3] Validar a mano según [quickstart.md](quickstart.md), pasos 4, 5 y 6. **El paso 5 es el que importa**: dejar el campo vacío, enviar, y confirmar que el mensaje aparece junto al campo.

**Checkpoint**: la sección tiene un solo campo y sus errores se ven.

---

## Phase 6: User Story 4 - El contacto lleva al WhatsApp real (Priority: P2)

**Goal**: publicar `092 171 791` con enlace directo, y sacar el `noindex`.

**Independent Test**: `/contacto` muestra el número y el botón abre
`wa.me/59892171791`; ninguna página emite `<meta name="robots">` con `noindex`.

- [ ] T012 [P] [US4] En `web/app/contacto/page.tsx`: `WHATSAPP_NUMBER = "59892171791"` (research R3: `092 171 791` sin el cero nacional, con código de país 598), borrar el `TODO` del encabezado del archivo, y **mostrar el número como texto** en la tarjeta de WhatsApp — hoy solo vive dentro del `href`, mientras que la tarjeta de email sí muestra la dirección (FR-016).
- [ ] T013 [P] [US4] En `web/app/layout.tsx`: borrar `robots: { index: false, follow: false }` del objeto `metadata` junto con el comentario que lo justifica. Es la única señal de no-indexación del sitio: no hay `robots.txt` ni `sitemap` (research R4).
- [ ] T014 [US4] Validar según [quickstart.md](quickstart.md), sección *Manual — contacto e indexación*, los tres pasos.

**Checkpoint**: nadie que toque WhatsApp en el sitio le escribe a un
desconocido, y el sitio es indexable.

---

## Phase 7: User Story 5 - En un límite de zona se cobra lo más barato (Priority: P3)

**Goal**: codificar la respuesta del cliente como regla, con una prueba que
falle si un cambio de precios la rompe.

**Independent Test**: un punto contenido por dos zonas devuelve la de menor
precio, incluso cuando la más barata no es la primera de la lista.

- [ ] T015 [US5] En `web/lib/zona-lookup.ts`, cambiar la selección: entre todas las zonas que contienen el punto gana la de menor `precio`, y con precios empatados gana la de menor `id`. La lógica debe **aceptar la lista de zonas por parámetro**, con `resolverZona()` como envoltorio delgado sobre `ZONAS` — sin eso la prueba de T016 es una tautología (research R2, [contracts/zona-lookup.md](contracts/zona-lookup.md)). Reescribir el comentario del módulo: hoy afirma que sobre un borde compartido "no existe una respuesta correcta", y **eso pasó a ser falso** — es la respuesta del cliente, no una convención interna.
- [ ] T016 [US5] En `web/lib/zona-lookup.test.ts`: agregar el caso central —dos polígonos sintéticos superpuestos con **el caro primero en la lista**, que debe devolver el barato— más el empate de precio resuelto por `id` más bajo. Actualizar el test existente *resuelve un borde compartido de forma determinista* para que afirme la regla del cliente y no solo determinismo. Verificar que el caso central **falla** contra la implementación vieja; si pasa, está mal escrito.
- [ ] T017 [US5] Confirmar que siguen pasando los casos que no cambian: fuera de cobertura da `null`, nunca se devuelve la zona más cercana, y las cinco zonas conservan id, nombres y precios (150/200/250/250/350).

**Checkpoint**: la regla de cobro en los límites está escrita como regla y
protegida por una prueba.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Enmendar `.specify/memory/constitution.md`: en *Scope boundaries*, corregir la enumeración de la web de clientes — sale `payment method`, `pickup/delivery windows` pasa a ser solo la ventana de retiro más el compromiso de 24 horas, y `retriever info` pasa a ser el teléfono del destinatario. Subir a **2.1.0** (`Version` y `Last Amended`) y agregar la entrada al historial de enmiendas explicando que es el cliente achicando su propio brief y que por eso es MINOR y no lleva ADR.
- [ ] T019 [P] Actualizar `docs/tech-debt-tracker.md`: pasar a **Resolved** la fila `High` del 2026-08-04 sobre qué zona paga una dirección en el límite (respondida por el cliente y codificada en T015) y la fila `Medium` del 2026-08-02 sobre el error de `recieverName` que nunca se mostraba (el campo desapareció en T010). Agregar una fila nueva por el copy obsoleto de `web/app/pedido/page.tsx:16` — "marcá en el mapa desde dónde retiramos el paquete" dejó de ser cierto en `003` — dejado deliberadamente afuera de este feature.
- [ ] T020 Correr los dos greps de [quickstart.md](quickstart.md) desde `web/`. El de residuos: `grep -rn "paymentMethod\|clientType\|deliveryDate\|deliveryTime\|recieverName\|recieverCI\|MARGEN_MINIMO" lib/ components/ app/`, sin resultados. Y el de FR-019: `grep -rn "59892171791\|092 171 791" lib/ components/ app/`, que debe dar **un solo archivo** (`app/contacto/page.tsx`) — el número tiene un único lugar de definición y `pedido-form.tsx` enlaza a `/contacto` en vez de repetirlo.
- [ ] T021 Correr `verify:` completo: `cd web && npm run lint && npm test && npm run build`. **El plan no está hecho hasta que esto esté verde.**
- [ ] T022 Correr [quickstart.md](quickstart.md) entero de punta a punta, incluidos los pasos manuales de las historias ya validadas por separado.
- [ ] T023 Cerrar: `specs/004-ajustes-finales-mvp/plan.md` a `status: completed`.

---

## Dependencies & Execution Order

### Entre historias

Las cinco son independientes en producto: cada una se puede entregar y demostrar
sola. Ninguna necesita a otra para funcionar.

### La restricción real: un archivo compartido

**US1, US2 y US3 editan todas `web/components/pedido-form.tsx`.** No son
paralelizables entre sí aunque sean independientes: dos de ellas a la vez es un
conflicto garantizado. Se hacen en secuencia. Esto es lo que impide marcar `[P]`
en T002, T003, T007, T008 y T010.

US4 y US5 no tocan ese archivo y sí son paralelas a todo lo demás.

### Orden de ejecución recomendado

Difiere del orden de prioridad, a propósito, y es el que fija el plan:

1. **US5** (`zona-lookup.ts` + su test) — aislada, y es la que toca el código que
   decide la plata: conviene hacerla con la cabeza fresca y no al final.
2. **US2, mitad de librería** (T005, T006) — `fechas.ts` y su suite, también
   aislada del formulario.
3. **US4** (T012, T013) — dos archivos chicos e independientes, [P] entre sí.
   **T013 conviene dejarlo para el final del bloque**: sacar el `noindex` es de
   una sola dirección en la práctica, y no tiene sentido hasta que el número
   real ya esté puesto por T012.
4. **US1 → US2 (resto) → US3** sobre `pedido-form.tsx`, en secuencia. Es donde
   se acumula el riesgo de romper algo que ya andaba.
5. **Phase 8** al final.

### Paralelismo disponible

Poco, y conviene decirlo en vez de fabricarlo:

- T005 (`lib/fechas.ts`) es `[P]` respecto de todo lo del formulario.
- T012 y T013 son `[P]` entre sí y respecto del resto (con la salvedad de orden
  de arriba).
- T018 y T019 son `[P]` entre sí: constitución y tracker son archivos distintos.

---

## Implementation Strategy

### MVP

**US1 sola** ya es entregable: el formulario pide dos cosas menos y el cliente
lo ve. Pero el MVP útil de este feature es **US1 + US2**, las dos P1: juntas son
"el formulario pide lo que hace falta y nada más", que es lo que el cliente
pidió.

### Entrega incremental

Cada historia deja el sitio en un estado demostrable. Un orden razonable para
mostrarle avances al cliente: US1+US2 (el formulario corto) → US3 (el teléfono
del destinatario) → US4 (el contacto real) → US5 (invisible para el cliente,
visible en la factura del día que se repricee una zona).

### Equipo

No aplica: un solo desarrollador. La sección de paralelismo de arriba está para
ordenar el trabajo de una persona, no para repartirlo.

---

## Notes

- El feature es mayoritariamente **borrado**. El riesgo no es escribir mal, es
  dejar residuo a medio sacar: por eso T020 existe como paso propio.
- No se apagan pruebas con `it.skip`. Lo que pierde su sujeto se borra.
- `web/app/pedido/` está deliberadamente **fuera** de `covers:`. Si durante la
  ejecución hace falta tocarlo, hay que parar y decidir — no editarlo igual.
- `web/lib/zonas.ts` es dato generado y no se toca en ninguna tarea.
- Commit por tarea o por grupo lógico, con el formato de commit del repo.
