# Tasks: El dia de trabajo, del mas viejo al mas nuevo

**Feature**: `021-orden-de-la-app` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Fecha**: 2026-09-05

Feature de una linea de SQL. **Todo el riesgo esta en la verificacion, no en el
cambio**: la unica prueba que comprueba el feature necesita una base, y sin
`TEST_DATABASE_URL` **se saltea sola dejando todo en verde**. Por eso T001 va
primero y T010 exige mirar el conteo de salteadas.

Tests: se generan, y son la mitad del trabajo. La prueba que hoy existe de
`Todos()` **cuenta filas y no mira el orden**, asi que una regresion pasa sin que
nada la detecte.

## Phase 1: Setup — la base, antes que nada

- [x] T001 Levantar `flash-pg-test` (puerto **55432**, no el 55433 de
      desarrollo: la de pruebas **se vacia entera**) y exportar
      `TEST_DATABASE_URL`. Ver `backend/README.md` y el paso 1 del
      [quickstart](quickstart.md).
- [x] T002 Correr `cd backend && go test ./...` y **anotar el conteo de
      salteadas** como linea base. Es el numero contra el que se compara despues:
      si al final hay mas skips que ahora, algo dejo de correr.

## Phase 2: User Story 1 — la lista viene del mas viejo al mas nuevo (P1)

**Goal**: Que Diego abra la app y arriba este el pedido que lleva mas tiempo
esperando.

**Independent test**: `go test ./internal/pedidos/ -run Orden`, con la base.

- [x] T003 [US1] Escribir en `backend/internal/pedidos/pedido_test.go` la prueba
      del orden de `Todos()`: tres pedidos creados en orden conocido y con
      **fechas de retiro desordenadas a proposito** respecto de la creacion.
      Afirma que vuelven por `creado_en` ascendente. Las fechas de retiro tienen
      que contradecir al orden de creacion, **o la prueba pasa con el SQL viejo y
      no prueba nada**.
- [x] T004 [US1] **Verla en rojo antes de arreglar nada.** Con el `ORDER BY`
      todavia viejo, T003 tiene que fallar. Si pasa de una, volver a T003: lo mas
      probable es que las fechas de retiro no contradigan a la creacion.
- [x] T005 [US1] Cambiar el `ORDER BY` de `Todos()` en
      `backend/internal/pedidos/pedido.go` a **`creado_en ASC, id ASC`**. El
      desempate por `id` no es adorno: sin el, dos pedidos con el mismo
      `creado_en` quedan en orden indefinido y FR-003 seria falso. **Es estable y
      arbitrario a proposito** —`id` es un uuid aleatorio—, que es lo que FR-003
      pide: determinismo, no significado.

      **NO desempatar por `codigo`**, aunque parezca lo natural por venir de una
      secuencia: se guarda como texto y `FU-10000` ordena antes que `FU-9999`.
      Ver research D2.
- [x] T006 [US1] Reescribir el comentario de `Todos()`, que hoy explica el
      criterio viejo —*"por CUANDO SE RETIRA y no por cuando se cargo"*— y
      quedaria **diciendo lo contrario de lo que hace**. Dejar dicho por que
      `retiro_hora` dejo de ordenar: es `"16:00"` fija desde `014`, o sea que el
      orden de hoy dentro de un mismo dia es indefinido.
- [x] T007 [US1] Afirmar el **determinismo** (FR-003): dos llamadas seguidas a
      `Todos()` sobre los mismos datos devuelven la misma secuencia.

## Phase 3: User Story 3 — el historial del cliente no se mueve (P2)

**Goal**: Que *Mis pedidos* siga mostrando primero lo mas reciente.

**Independent test**: una prueba sobre `PorUsuario()`.

- [x] T008 [US3] Agregar la guarda de FR-004 en `pedido_test.go`: `PorUsuario()`
      sigue devolviendo del **mas reciente al mas viejo**. Vive a diez lineas de
      `Todos()` en el mismo archivo, y ese es exactamente el riesgo que esta
      prueba cubre: que el cambio se arrastre a una pantalla que nadie pidio
      tocar.

## Phase 4: User Story 2 — las tres pestañas, mismo criterio (P2)

**Goal**: Que el orden llegue igual a Pendientes, Tomados y Entregados.

**Independent test**: la prueba de agrupacion que la app ya tiene.

- [x] T009 [US2] Comprobar que la prueba `la app no reordena los pedidos` de
      `android/.../EstadoPantallaTest.kt` **sigue en verde y sin tocarla**. Es lo
      que sostiene que el orden del servicio llega intacto a las tres secciones,
      y es la razon de que este feature no necesite reinstalar el APK. **No se
      escribe nada en la app.**

## Phase 5: Cierre

- [x] T010 Correr `verify:` completo:
      `cd backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest`
      **y comparar el conteo de salteadas contra T002.** Verde con skips de mas
      **no es verde**: significa que las pruebas de base no corrieron y el feature
      quedo sin verificar.
- [ ] T011 Verlo en la app (paso 4 del quickstart): backend local contra la base
      de **desarrollo**, la app apuntada ahi, *Actualizar*, y comprobar que arriba
      esta lo mas viejo en las tres pestañas. **No se puede cerrar desde la
      sesion**: necesita emulador o telefono.
- [ ] T012 Comprobar en el sitio (`/perfil`) que el historial del cliente sigue
      con lo mas reciente arriba. Tambien a ojo.
- [ ] T013 Commitear con el plan todavia en `active`, o el sensor rebota.
      Convencion: `feat: mensaje corto 021-orden-de-la-app`, sin tildes.

## Dependencies

```text
T001 ─> T002
         └─> T003 ─> T004 ─> T005 ─> T006
                                └─> T007
                                └─> T008
                                └─> T009
                                      └─> T010 ─> T011, T012 ─> T013
```

- **T001 antes que todo.** Sin la base, T003 se saltea y el resto del plan es
  teatro.
- **T004 antes de T005**, y no al reves: es la unica forma de saber que la prueba
  mira el orden y no otra cosa.
- **T006 con T005.** Un comentario que describe el criterio contrario al que el
  codigo aplica es peor que no tener comentario.

## Parallel opportunities

Practicamente ninguna: todo pasa por dos archivos y una cadena de dependencias.
T008 y T009 se pueden hacer en cualquier orden entre si, una vez cambiado el SQL.

## Implementation strategy

**MVP = Fase 2** (T003 a T007). Ahi el feature esta hecho y probado.

Las fases 3 y 4 son guardas de lo que **no** tiene que moverse, y son la mitad
del valor de este plan: el cambio es trivial, lo caro es saber que no arrastro el
historial del cliente ni obligo a reinstalar el APK.

**T011 no lo cierra ningun comando** y es el unico que responde la pregunta que
importa —si a Diego le sirve—, pero a diferencia de otros features aca el riesgo
es bajo: lo que se verifica a ojo ya esta verificado por una prueba con base.
