# Tasks: Orden de la dirección en la app

**Input**: `specs/032-orden-de-la-direccion/` — plan.md, spec.md, research.md, quickstart.md

**Tests**: sí, los pide el spec (FR-006).

## Phase 1: Setup

No hay: no se agregan dependencias ni estructura nueva.

## Phase 2: Foundational

- [x] T001 Crear `textoDeDireccion(d: Direccion, breve: Boolean = false): String` en `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/TextoDeDireccion.kt`: partes `[calle + " " + numero]` (número solo si `isNotBlank`), `apto X` (si no `breve` y no vacío), `esq. Y` (si no vacía), `cooperativa` (si no `breve` y es `true`); descartar partes en blanco y unir con `", "` (plan D1–D3). Comentario corto con el porqué: el número es de la calle principal, y el orden es el de `web/lib/direccion.ts`.

## Phase 3: User Story 1 — Leer la dirección sin confundir la puerta (P1) 🎯 MVP

**Goal**: número pegado a la calle y esquina después, en la tarjeta (retiro y entrega) y en la hoja de entrega.

**Independent Test**: quickstart, sección 2.

### Tests

- [x] T002 [P] [US1] Crear `android/app/src/test/java/uy/flashurbano/repartidor/pantallas/TextoDeDireccionTest.kt` con cadenas literales (plan D4): completa → `Rivera 1234, apto 3, esq. Soca, cooperativa`; completa con `breve` → `Rivera 1234, esq. Soca`; sin número → `Rivera, esq. Soca`; sin esquina → `Rivera 1234`; solo calle → `Rivera`; número/apto/esquina en blanco (`"  "`) o `null` se omiten sin dejar comas ni espacios sueltos; y una prueba explícita de que el índice de `1234` es menor que el de `esq.`.
- [x] T003 [US1] Control positivo: invertir a propósito el orden en `TextoDeDireccion.kt` (esquina antes del número), correr `.\gradlew.bat testDebugUnitTest` desde `android/`, comprobar que T002 sale en rojo, y deshacer. Anotar el resultado en este archivo. **Hecho 2026-11-24: con la esquina primero, 4 de 8 en rojo; restaurado.**

### Implementation

- [x] T004 [US1] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`, reemplazar las dos llamadas a `comoTexto(...)` (RETIRA y ENTREGA) por `textoDeDireccion(...)` y borrar `comoTexto` con su KDoc, conservando la nota de que el punto no se usa para el texto.
- [x] T005 [US1] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/HojaEntrega.kt`, reemplazar `direccionCorta(pedido)` por `textoDeDireccion(pedido.entrega, breve = true)` y borrar `direccionCorta`, sin tocar el comentario de `ModalBottomSheet` que hoy está encima.

## Phase 4: Polish & cierre

- [x] T006 Correr el `verify:` del plan (`cd android && .\gradlew.bat assembleDebug testDebugUnitTest`) y anotar el conteo de pruebas. **Verde 2026-11-24: 91 pruebas, 0 salteadas, 0 fallidas; assembleDebug OK.**
- [x] T007 Quickstart sección 2: app debug contra staging en el **emulador** (`adb -s`), con un pedido de todos los campos y otro de solo calle y esquina; comparar con la web y mirar que la línea larga no rompa la tarjeta. **Hecho 2026-11-24, emulator-5554 contra staging**: pedidos de prueba FU-0003 (todos los campos) y FU-0004 (sin número) creados por API con la sesión del emulador. Tarjeta: `Bulevar Artigas 1500, esq. Rivera` / `Rivera 1234, apto 3, esq. Soca, cooperativa`; `Bulevar Artigas, esq. Rivera` / `Avenida Italia, esq. Comercio`. Hoja: `FU-0003 · Rivera 1234, esq. Soca`. La línea completa entra en una sola línea y no mueve la acción. La comparación con la web es por código (`componerDireccion` arma el mismo texto) y no se miró en el navegador. FU-0003 quedó En curso en staging.
- [x] T008 Commit en la rama (`feat: numero antes que la esquina en la app 032-orden-de-la-direccion`), PR, y merge a `master` con el cierre del plan en commit aparte antes del merge.
- [ ] T009 Desde `master` limpio: `scripts/publicar-app.sh v0.6.1 "..."` (quickstart sección 3) y pasarle el link a Diego; SC-003 queda abierto hasta que él lo confirme en el teléfono.

## Dependencies

- T001 → T002 → T003 (necesita la función y las pruebas).
- T001 → T004, T005 (independientes entre sí: archivos distintos).
- T004, T005, T003 → T006 → T007 → T008 → T009.

## Parallel

- T002, T004 y T005 tocan archivos distintos y pueden ir a la vez una vez hecho T001.

## Implementation Strategy

Una sola historia: el MVP es el feature entero. Lo que no prueba el `verify:` (cómo se ve) lo prueba T007, y lo que no prueba el emulador (que Diego lo lea bien) lo prueba T009.
