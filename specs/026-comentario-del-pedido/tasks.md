---
description: "Tareas de 026 — el comentario del pedido"
---

# Tasks: El comentario del pedido

**Input**: documentos de diseño en `/specs/026-comentario-del-pedido/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/comentario.md](contracts/comentario.md),
[quickstart.md](quickstart.md)

**Tests**: sí, y no por ceremonia. Las pruebas que se piden acá son las que
cazan los defectos que este tipo de campo tiene de verdad —aplanar saltos de
línea, guardar `""` en vez de `NULL`, romper la app vieja— y ninguna la ve el
compilador.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (otro archivo, sin depender de algo abierto)
- **[Story]**: a qué historia del spec pertenece

---

## Fase 1: Preparación

- [ ] T001 Correr el `verify:` del plan **antes de tocar nada** y anotar el
  resultado, con `TEST_DATABASE_URL` puesto y Docker Desktop levantado.
  **Contar los `SKIP`**: sin esa variable las pruebas Go contra Postgres se
  saltan solas y el verde no dice nada de la base. Esta corrida es la línea de
  base contra la que se compara todo lo que siga, y la primera vez que se ejerce
  la pata Android de `verify:`, que `024` y `025` no tenían.

---

## Fase 2: Fundacional (bloquea todo lo demás)

**La columna y el servicio.** Nada de la web ni de la app se puede probar hasta
que el dato exista y viaje.

- [ ] T002 Migración `backend/migrations/0009_comentario_del_pedido.sql`:
  `ALTER TABLE pedidos ADD COLUMN comentario text` con
  `CHECK (comentario IS NULL OR char_length(comentario) <= 280)`. **Anulable y
  sin default**, y **sin rellenar nada**: `NULL` ya significa lo que pasó
  (data-model). `char_length` y no bytes, o una indicación con ñ valdría menos
  que la misma en ASCII.
- [ ] T003 El campo en `backend/internal/pedidos/pedido.go`: en la estructura,
  en el `INSERT INTO pedidos`, en el `UPDATE pedidos SET` del camino de `022`, y
  en el scan de las dos lecturas. En el JSON va con **`omitempty`**: cuando no
  hay comentario **la clave desaparece**, no llega `null` — es la forma que el
  cliente Kotlin ya sabe leer y que `Direccion.punto` documenta.
- [ ] T004 Validación y normalización en `backend/internal/pedidos/handlers.go`
  (`Crear` y `Editar`): recortar los extremos, y **si lo que queda es vacío
  guardar `NULL`**; rechazar con `400` lo que pase de 280. **El recorte vive
  sólo acá**: si el navegador recortara también, serían dos implementaciones de
  la misma regla separándose de a poco.
- [ ] T005 Pruebas en `backend/internal/pedidos/pedido_test.go`: crear con
  comentario y sin él; 281 caracteres → `400`; **sólo espacios y saltos de línea
  → el pedido queda con `NULL`**, no con `""`; y **un comentario de tres
  renglones se lee con sus tres renglones**, que es el defecto clásico de un
  campo multilínea y no lo ve ningún tipo.
- [ ] T006 [P] Prueba de que **el tablero no se enteró**, en
  `backend/internal/tablero/tablero_test.go`: la respuesta de `/admin/tablero`
  no trae la clave `comentario` ni siquiera con un pedido que lo tiene. Es
  FR-012, y hoy se cumple gratis porque la consulta nombra sus columnas
  (research D5) — la prueba es para que siga siendo gratis.

**Punto de control**: acá el servicio se puede desplegar solo. La web vieja no
manda el campo y la app vieja lo ignora (research D3).

---

## Fase 3: Historia 1 — la indicación llega a quien hace el viaje (P1)

**Objetivo**: el cliente lo escribe y Diego lo lee. Es la función entera.

**Prueba independiente**: cargar un pedido con una indicación desde la web y
verla en el teléfono, sin que nadie la reenvíe por otro canal.

- [ ] T007 [US1] `web/lib/pedido.ts`: el campo en `DatosDelPedido` (lo que se
  tipea) y en `CuerpoPedido` (lo que se manda), y que `armarCuerpoPedido()` lo
  arrastre. **Omitir la clave cuando está vacío**, para que el cuerpo de un
  pedido sin comentario sea byte por byte el de hoy.
- [ ] T008 [P] [US1] Pruebas en `web/lib/pedido.test.ts`: con comentario, sin
  comentario, y con saltos de línea adentro.
- [ ] T009 [US1] El campo en `web/components/pedido-form.tsx`: multilínea,
  **opcional**, rotulado **"Comentario"**, con contador y tope de 280. Y el
  **texto de ayuda debajo**, que es lo que hace el trabajo que la etiqueta sola
  no hace (FR-001a): decir quién lo lee, dar ejemplos —"tocar timbre del 2",
  "retirar por la puerta de atrás"— **y avisar que puede salir impreso en la
  etiqueta del paquete** (research D2).
- [ ] T010 [US1] Cablear el estado en `web/components/pedido/crear-pedido.tsx` y
  mostrarlo en el resumen de confirmación **sólo si hay comentario**: sin
  comentario, ni etiqueta ni hueco (FR-009).
- [ ] T011 [P] [US1] `android/app/src/main/java/uy/flashurbano/repartidor/datos/Pedido.kt`:
  el campo **opcional con `null` por defecto**, como `Direccion.punto`. No
  declararlo no-nulo: rompería la app con datos que ya existen.
- [ ] T012 [P] [US1] Pruebas en
  `android/app/src/test/java/uy/flashurbano/repartidor/datos/PedidoTest.kt`:
  decodificar un pedido **con** la clave, **sin** la clave, y —control positivo
  de research D3— **uno con una clave que la app no conoce**, que tiene que
  seguir decodificando. Ese último es el que demuestra que el servicio se puede
  desplegar antes que el APK.
- [ ] T013 [US1] El bloque en `TarjetaPedido`, en
  `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`:
  **dentro de la tarjeta**, visualmente distinto de las direcciones y los
  teléfonos, y **sólo en los pedidos que lo tienen**.
  **No crear pantalla de detalle y no plegar nada**: el contrato §4.2 de `012`
  dice que la tarjeta muestra todo sin desplegar y que no se toca, porque Diego
  no puede tener que tocar para leer algo parado en una puerta. Es lo que pide
  FR-006a, corregido el 2026-09-12 con lo que encontró research D1.
  **No hay prueba automática de esta pantalla**: las pruebas JVM no dibujan
  Compose. Lo cubre el quickstart Q11, en el teléfono.

**Punto de control**: la función ya vale. Lo que sigue la completa.

---

## Fase 4: Historia 2 — el cliente corrige lo que escribió (P2)

**Objetivo**: una indicación equivocada se puede arreglar mientras el pedido
esté pendiente. Misma regla que `022`, decidida en el clarify y no heredada.

**Prueba independiente**: crear con indicación, editarla desde el perfil con el
pedido pendiente, y ver la nueva en el teléfono.

- [ ] T014 [US2] El campo en el camino de edición: `Editar` en
  `backend/internal/pedidos/handlers.go`, con la misma validación de T004. Un
  comentario vacío o ausente **borra el que había** (pasa a `NULL`).
- [ ] T015 [P] [US2] Pruebas en `backend/internal/pedidos/pedido_test.go`:
  editar el comentario de un pedido pendiente; **borrarlo** y que quede `NULL`;
  y que un pedido **ya tomado** rechace la edición igual que hoy rechaza el
  resto de los campos.
- [ ] T016 [US2] El campo en el formulario de edición, en
  `web/components/pedido/crear-pedido.tsx`. Con el pedido ya tomado **no se
  puede editar y se ve el mismo motivo** que `022` ya muestra para los demás
  campos — no un botón que falle al tocarlo.

---

## Fase 5: Historia 3 — el cliente vuelve a ver lo que pidió (P3)

**Objetivo**: encontrar la indicación sin acordarse de memoria, y que salga en
el papel.

**Prueba independiente**: crear con indicación y encontrarla en *Mis pedidos* y
en la etiqueta impresa.

- [ ] T017 [P] [US3] El campo en el tipo `PedidoGuardado`, en `web/lib/api.ts`.
  **Sólo el tipo.** Meter una llamada en el camino del formulario pone en rojo
  la guarda de `cotizar-abierto.test.ts`, que existe para que el formulario
  funcione con el servicio caído.
- [ ] T018 [US3] Mostrarlo en `web/components/pedido/tarjeta-pedido.tsx`, sólo
  cuando existe.
- [ ] T019 [US3] Qué dice el impreso, en `web/lib/etiqueta.ts`: el comentario en
  un bloque propio y legible. **Sin comentario, la etiqueta sale exactamente
  como hoy**, ni un renglón corrido.
- [ ] T020 [P] [US3] Pruebas en `web/lib/etiqueta.test.ts`: con y sin
  comentario, y **el control positivo de research D7** — una etiqueta cuyo
  comentario diga `Cobrar $300` **tiene que salir con ese texto**. Es texto del
  cliente, no un precio del producto: si la guarda del Principio V se pone en
  rojo por eso, está mal escrita la guarda.
- [ ] T021 [US3] Dibujarlo en `web/lib/etiqueta-pdf.ts`, respetando los saltos
  de línea del texto.
- [ ] T022 [P] [US3] Que "repetir pedido" lo arrastre, en `web/lib/repetir.ts` y
  `web/lib/repetir.test.ts`.
  **Esta tarea no sale de ningún FR y es a propósito**: es una decisión de
  diseño (research D6), no un requisito del cliente. Se hace porque el resto de
  los campos se repiten y la excepción sin motivo sería la sorpresa. **Es la
  primera candidata a caerse** si hay que recortar alcance, y caerse no
  incumple el spec.

---

## Fase 6: Cierre

- [ ] T023 `verify:` entero con `TEST_DATABASE_URL` y **cero `SKIP`**, las tres
  patas. La de Android es `.\gradlew.bat`, no `./gradlew` ni `gradlew.bat`.
- [ ] T024 **Romper a propósito** las guardas nuevas y verlas en rojo: sacar el
  `omitempty` de T003, devolver `""` en vez de `NULL` en T004, y meter la clave
  `comentario` en la consulta del tablero. Una prueba que afirma que algo no
  pasa no vale hasta que se la vio fallar.
- [ ] T025 Quickstart Q1–Q9 y Q12–Q14 en pantalla, con Mateo
  ([quickstart.md](quickstart.md)). Lo que no se reporte **se anota en el
  tracker con su disparador**, no se tilda.
- [ ] T026 **Quickstart Q10 y Q11, en el teléfono**, que es lo que el `verify:`
  no ve. Q10 —**el APK viejo contra el servicio nuevo**— es el que decide si el
  servicio se puede desplegar antes que la app; si falla, cambia el orden de
  todo. Q11 mira que la tarjeta no se haya roto: nada de texto cortado, y a
  360 px también. En `012` dos defectos de esta clase compilaron perfecto.
- [ ] T027 Anotar en `docs/tech-debt-tracker.md` (fila nueva arriba) lo que haya
  quedado abierto, con disparador. Candidatos previsibles: que la tarjeta de la
  app no tiene prueba automática, y cualquier paso del quickstart sin reportar.
- [ ] T028 Commitear **con el plan todavía `active`**, stageando rutas
  explícitas. Con el plan cerrado el sensor rebota los archivos de código.
- [ ] T029 Después del merge y del deploy: **publicar el APK** con
  `scripts/publicar-app.sh vX.Y.Z` y que **Diego lo instale**. Hasta acá la
  feature **no está entregada**: el código en `master` no la pone en el
  teléfono de otra persona.
- [ ] T030 Confirmar con Diego que ve el comentario en un pedido de verdad, y
  recién después pasar `plan.md` a `status: completed`, en un commit aparte.

---

## Dependencias

```text
Fase 1 (T001)
  └─ Fase 2: la columna y el servicio (T002 → T003 → T004 → T005, T006)
       ├─ Fase 3: US1 — web (T007→T010) y app (T011→T013), independientes entre sí
       ├─ Fase 4: US2 — edición (T014→T016)
       └─ Fase 5: US3 — Mis pedidos, etiqueta y repetir (T017→T022)
            └─ Fase 6: cierre (T023→T030)
```

- **T002 bloquea todo.** Sin la columna no hay nada que probar.
- **La web y la app no se bloquean entre sí** una vez que el servicio manda el
  campo. Es la propiedad que evita coordinar un despliegue con un teléfono
  ajeno.
- **US2 y US3 no dependen entre sí**, y ninguna bloquea a US1.
- **T029 y T030 son lo último, y no son código.**

## Paralelo

- T006 con T005 (archivos distintos).
- T008, T011 y T012 entre sí, y con cualquier tarea de web de la Fase 3.
- T017, T020 y T022 entre sí.
- **Las dos mitades de US1** —web (T007–T010) y app (T011–T013)— son dos
  carriles enteros que no se tocan.

## MVP

**La Fase 2 más la Historia 1.** Con eso el cliente escribe la indicación y
Diego la lee en el teléfono, que es la función completa. Las historias 2 y 3
la pulen: corregir lo escrito, y volver a verlo.
