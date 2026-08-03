---
description: "Task list for 002-mapa-zonas-precio"
---

# Tasks: Mapa de zonas con precio automático por ubicación

**Input**: Design documents from `specs/002-mapa-zonas-precio/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/zonas.md](contracts/zonas.md), [quickstart.md](quickstart.md)

**Tests**: Sí, acotados. El plan agrega Vitest deliberadamente para una sola
pieza — la resolución de zona, que decide cuánto se le cobra a una persona
(ver `plan.md` § Complexity Tracking). **No** se testea UI ni componentes.

**Organization**: agrupadas por historia de usuario. Orden de prioridad del
spec: US1 (P1) → US2 (P2) → US4 (P2) → US3 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1, US2, US3, US4)
- Todas las rutas son relativas a la raíz del repo

> **Aviso de alcance**: `covers:` de `plan.md` está **WIRED** al pre-commit en
> este clone. Un commit que toque algo fuera de esos prefijos se rechaza.
> Antes de cada Edit/Write, verificar que la ruta esté cubierta.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dejar el toolchain listo. Nada de esto es visible para el usuario.

- [X] T001 Agregar `leaflet` a `dependencies` y `@types/leaflet` + `vitest` a `devDependencies` en `web/package.json`, e instalar (`cd web && npm install`) para que `web/package-lock.json` quede consistente
- [X] T002 Agregar el script `"test": "vitest run"` a `web/package.json` (mismo archivo que T001, no paralelizable)
- [X] T003 [P] Crear `web/vitest.config.ts` apuntando el entorno a Node — `zona-lookup.ts` es una función pura y no debe necesitar jsdom

**Checkpoint**: `cd web && npm test` corre y reporta "sin tests" sin explotar.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el dato de zona, la lógica que lo consulta y el componente de mapa.
Los tres los comparten US1 y US2.

**⚠️ CRITICAL**: ninguna historia puede empezar antes de terminar esta fase.

- [X] T004 Escribir `web/design-source/build-zonas.js`: lee el KML, normaliza nombres (colapsa `\xa0` y espacios repetidos, FR-003), mapea cada zona a su precio desde una tabla explícita en el propio script (FR-005), y emite `web/lib/zonas.ts`. Debe **fallar ruidosamente** si un anillo no cierra, si no encuentra las cinco zonas o si un nombre no mapea a un precio — ver `contracts/zonas.md` § 4
- [X] T005 Ejecutar el generador y commitear el resultado: `cd web && node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts`. El archivo lleva encabezado de "generado, no editar" con el comando que lo regenera
- [X] T006 Escribir `web/lib/zona-lookup.test.ts` con los seis casos que exige `contracts/zonas.md` § 2: un punto interior por zona, punto en el río, punto en otro departamento, mismo punto de borde dos veces, los cinco precios, y el cierre de todos los anillos. **Deben fallar** antes de T007 (`resolverZona` todavía no existe)
- [X] T007 Implementar `resolverZona(lat, lng)` en `web/lib/zona-lookup.ts` con ray casting propio, sin librería de geometría. Desempate determinista: recorre `ZONAS` en orden de id 1→5 y devuelve el primer match (FR-018). Devuelve `null` para fuera de cobertura — nunca la zona más cercana (FR-012). Función pura: sin red, sin `window`. T006 pasa a verde
- [X] T008 Crear `web/components/mapa-zonas.tsx` (`"use client"`) siguiendo la interfaz de `contracts/zonas.md` § 3: dibuja las cinco zonas desde `ZONAS`, `TileLayer` de OSM con la atribución visible (FR-008), marcador con `L.divIcon` — nunca `L.Icon.Default`, que se rompe bajo `basePath` (research D5) — y `scrollWheelZoom: false` (D6). **No** resuelve zona ni calcula precio: solo emite el punto por `onPunto`
- [X] T009 Agregar a `web/components/mapa-zonas.tsx` la detección de mosaicos caídos: suscribirse a `tileload` y reportar por `onEstadoMosaicos` — `no-disponible` si a los **8 segundos** del montaje no cargó **ningún** mosaico (research D7, criterio corregido durante la implementación: exigir además un `tileerror` dejaba colgado el caso de la conexión que no responde). El umbral es 8 s y no queda a criterio de quien implemente: bloquea pedidos, así que corto de más frena una venta legítima en red lenta y largo de más deja al cliente mirando un hueco. El componente **reporta**, no decide
- [X] T010 Crear `web/components/mapa-zonas-dinamico.tsx` (`"use client"`) que exporte el mapa vía `dynamic(() => import("./mapa-zonas"), { ssr: false })`. Tiene que ser Client Component: la doc de Next 16 (`web/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`) dice que `ssr: false` solo aplica ahí (research D4)

**Checkpoint**: `npm test` verde y el mapa se puede montar en cualquier página sin romper el build.

---

## Phase 3: User Story 1 - Saber cuánto cuesta antes de pedir (P1) 🎯 MVP

**Goal**: el cliente marca el punto de retiro y ve la zona y el precio en firme, sin preguntarle a nadie.

**Independent Test**: abrir `/pedido`, marcar un punto dentro de una zona conocida, ver nombre de zona y precio. Sin pasar por ninguna otra sección.

**⚠️ Todas las tareas de esta fase tocan `web/components/pedido-form.tsx`: ninguna es paralelizable entre sí.**

- [X] T011 [US1] En `web/components/pedido-form.tsx`, agregar `ubicacionRetiro: { lat: number \| null; lng: number \| null }` a `FormState` e `INITIAL_STATE`, y rotular la sección "Dirección" existente como **dirección de retiro** (FR-022). La zona y el precio **no** se guardan en el estado: se derivan llamando a `resolverZona` (ver `data-model.md`)
- [X] T012 [US1] Insertar `MapaZonasDinamico` con `interactivo` en la sección de retiro de `web/components/pedido-form.tsx`, cableando `onPunto` para actualizar `ubicacionRetiro` (FR-009)
- [X] T013 [US1] Mostrar el resultado bajo el mapa en `web/components/pedido-form.tsx`: con zona resuelta, nombre y precio (FR-010, FR-014); fuera de las cinco zonas, aviso de fuera de cobertura **sin precio** y con vía de contacto (FR-012)
- [X] T014 [US1] Extender `validate()` en `web/components/pedido-form.tsx` para exigir punto marcado **y** zona resuelta, con el mismo tratamiento de campo obligatorio que el resto (FR-011)
- [X] T015 [US1] Cablear `onEstadoMosaicos` en `web/components/pedido-form.tsx`: en `no-disponible`, mostrar qué pasó, ofrecer contacto y **bloquear el envío** (FR-020). No dejar el hueco en blanco ni fallar en silencio
- [X] T016 [US1] Agregar zona y precio al resumen de `Confirmation` en `web/components/pedido-form.tsx` (FR-017)

**Checkpoint**: US1 funciona sola. Es el MVP demostrable al cliente.

---

## Phase 4: User Story 2 - Ver la zona de cobertura y los precios (P2)

**Goal**: `/sobre-nosotros` muestra un mapa navegable con las cinco zonas y sus precios, en vez de un JPEG con límites adivinados.

**Independent Test**: navegar a "Sobre Nosotros" y ver las cinco zonas sobre calles reales con leyenda de precios, sin tocar el formulario.

- [X] T017 [US2] En `web/app/sobre-nosotros/page.tsx`, reemplazar el `<Image>` del mapa por `MapaZonasDinamico` en modo no interactivo, y quitar el `import Image` y el `asset()` si quedan sin uso (FR-006). La página es Server Component (exporta `metadata`): importa el wrapper cliente, no `dynamic` directo
- [X] T018 [US2] Agregar la leyenda de zonas y precios en `web/app/sobre-nosotros/page.tsx` como **texto real siempre visible**, fuera del mapa (FR-007). El `<Image>` que se borra lleva un `alt` que describe las cinco zonas y sus precios; un mapa es opaco para quien no lo ve, así que sin esta leyenda el cambio sería una regresión de accesibilidad. Actualizar además el copy que hoy dice "precio de referencia" y "los límites son de referencia" — ya no lo son (constitución 2.0.0, Principio V)
- [X] T019 [US2] Manejar `onEstadoMosaicos` en `web/app/sobre-nosotros/page.tsx`: en `no-disponible` explicar que el mapa no cargó. La leyenda de T018 ya está siempre visible, así que la información de zonas y precios no depende de este caso. Acá **no** bloquea nada — el mapa es informativo, no cobra
- [X] T020 [P] [US2] Borrar `web/public/mapa-zonas-flash-urbano.jpeg` (ya sin referencias tras T017)
- [X] T021 [P] [US2] Borrar `web/design-source/build-map.js` (generaba la imagen que se acaba de borrar). **No tocar** `web/design-source/mapa-costos-original.jpeg`: es donde el cliente escribió las calles y los precios (FR-025)

**Checkpoint**: US1 y US2 funcionan independientemente. Queda un solo mapa en el sitio.

---

## Phase 5: User Story 4 - Decir a dónde va el paquete (P2)

**Goal**: capturar el domicilio de entrega, que hasta ahora no existía en ningún lado.

**Independent Test**: completar el formulario y verificar que pide dos domicilios claramente rotulados, y que la confirmación los muestra por separado.

**⚠️ Toca `web/components/pedido-form.tsx`: no paralelizable con la Phase 3 ni entre sí.**

- [X] T022 [US4] Agregar los campos de entrega a `FormState` e `INITIAL_STATE` en `web/components/pedido-form.tsx` — calle, número, apto (opcional), esquina, cooperativa (FR-023), mismos tipos que los de retiro
- [X] T023 [US4] Renderizar el segundo bloque de dirección en `web/components/pedido-form.tsx`, rotulado sin ambigüedad respecto del de retiro (FR-022). Sin mapa y sin resolución de zona (FR-024)
- [X] T024 [US4] Extender `validate()` en `web/components/pedido-form.tsx` para los campos obligatorios de entrega, con errores por campo. **No** validar el destino contra las zonas de cobertura (FR-024)
- [X] T025 [US4] Separar los dos domicilios en el resumen de `Confirmation` en `web/components/pedido-form.tsx`

**Checkpoint**: el formulario captura origen y destino sin ambigüedad.

---

## Phase 6: User Story 3 - Usar mi ubicación actual (P3)

**Goal**: atajo para quien está parado en el domicilio de retiro.

**Independent Test**: tocar "usar mi ubicación", conceder el permiso, y ver el mapa centrado con el marcador puesto y la zona resuelta.

- [X] T026 [US3] Agregar el botón "usar mi ubicación" en `web/components/pedido-form.tsx` usando la geolocalización del navegador: al conceder, centra el mapa, coloca el marcador y resuelve la zona igual que el marcado manual (FR-016). **No** se pide el permiso al abrir la página (`spec.md` § Assumptions)
- [X] T027 [US3] Manejar el rechazo del permiso y el error de obtención en `web/components/pedido-form.tsx`: informar sin romper, dejando el marcado manual disponible (US3 escenario 2)

**Checkpoint**: las cuatro historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] Reescribir `web/design-source/README.md`: documentar `build-zonas.js` y retirar la sección de `build-map.js`. Quitar la advertencia de "límites no validados" — el cliente los definió por calle y los validó — y conservar la sección del logo
- [X] T029 [P] Actualizar `ARCHITECTURE.md`: sumar `web/lib/zonas.ts` (dato generado) y `zona-lookup.ts` a "Current hotspots", y anotar la separación dato/lógica dentro de `web/lib/`
- [X] T030 [P] Revisar el copy de `web/app/pedido/page.tsx` para que mencione que hay que marcar la ubicación, si el texto actual quedó desalineado
- [X] T031 Revisar **todo el copy nuevo de cara al usuario** contra FR-021 (voz institucional, sin nombrar personas del equipo): el resultado de zona y precio y el aviso de fuera de cobertura (T013), el aviso de mosaicos caídos en las dos superficies (T015, T019), los rótulos de los dos domicilios (T023) y el copy de `web/app/sobre-nosotros/page.tsx` (T018). Es el único requisito del spec que ninguna otra tarea toca
- [X] T032 Correr `verify:` completo: `cd web && npm run lint && npm test && npm run build`
- [X] T033 Validación manual de [quickstart.md](quickstart.md) pasos 1–13: las dos superficies, fuera de cobertura, envío sin punto, mosaicos bloqueados en ambas páginas, y mobile a 375px. **Cronometrar SC-001** en el paso 5: desde que se llega al mapa hasta ver el precio, en celular y sin ayuda, tienen que ser menos de 15 s medidos — no estimados
- [X] T034 **SC-004 — verificar los límites contra las calles.** Con el mapa a la vista, recorrer las 10 arterias de `spec.md` § Límites de zona y confirmar que cada tramo corre sobre la suya. **Empezar por Zona 5**: es la más cara, así que un tramo corrido ahí es el error más caro. Si algo no coincide, el defecto está en el polígono — se corrige reexportando el KML y regenerando, sin tocar código
- [X] T035 Verificar el export estático: `cd web && GITHUB_PAGES=true npm run build && npx serve out`. Confirmar que **el marcador se ve** bajo `basePath` `/flash-urbano` — es la falla que evita el `divIcon` (research D5) y solo se manifiesta acá, no en `npm run dev`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **Bloquea todas las historias.**
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational. Independiente de US1.
- **US4 (Phase 5)**: depende **solo de Setup** — no usa el mapa. Se serializa después de US1 nada más que porque comparte archivo.
- **US3 (Phase 6)**: depende de US1 (extiende su mapa).
- **Polish (Phase 7)**: depende de las historias que se decidan entregar.

### Dentro de cada historia

- Los tests de Phase 2 (T006) se escriben antes de la implementación (T007) y deben fallar primero.
- T004 → T005 → T006 → T007 es estrictamente secuencial: el generador antes que el dato, el dato antes que los tests, los tests antes que la lógica.
- T008 → T009 → T010: el mapa antes de su detección de fallas, y ambos antes del wrapper.

### Parallel Opportunities

Pocas y honestas — casi todo el trabajo de UI cae en un solo archivo.

- T003 en paralelo con T001/T002 (archivo distinto).
- T020 y T021 entre sí (dos borrados independientes, después de T017).
- T028, T029 y T030 entre sí (tres archivos distintos). T031 va después, porque
  revisa copy que T030 puede haber tocado.
- **US1 y US2 en paralelo si hay dos personas**: tocan archivos distintos (`pedido-form.tsx` vs `sobre-nosotros/page.tsx`).
- **Todo lo demás dentro de Phase 3, 5 y 6 es secuencial**: `pedido-form.tsx` es un único archivo y paralelizarlo solo genera conflictos.

```bash
# Ejemplo real de paralelismo, tras completar T017:
Task: "Borrar web/public/mapa-zonas-flash-urbano.jpeg"
Task: "Borrar web/design-source/build-map.js"
```

---

## Implementation Strategy

### MVP primero (US1)

1. Phase 1 Setup
2. Phase 2 Foundational (crítica, bloquea todo)
3. Phase 3 US1
4. **PARAR y VALIDAR**: US1 sola, contra su Independent Test
5. Es la porción que se le muestra al cliente

Cumple el Principio I de la constitución: algo visible y funcional antes de
seguir invirtiendo.

### Entrega incremental

1. Setup + Foundational → base lista
2. + US1 → **MVP demostrable**
3. + US2 → el sitio queda con un solo mapa, coherente
4. + US4 → el formulario captura origen y destino
5. + US3 → el atajo de geolocalización
6. Polish → docs, verify, y la verificación de límites contra calles

### Qué NO se puede saltear

- **T034** no es opcional aunque sea manual. Es el único paso que comprueba que
  los polígonos caen sobre las calles correctas, y de eso depende cuánto se le
  cobra a una persona. Ningún test del repo lo cubre.
- **T032** (`verify:`) es la condición de "hecho" del harness. El plan no está
  completo hasta que esté verde.
- **T031** tampoco: FR-021 no lo cubre ninguna otra tarea, y este feature agrega
  bastante copy nuevo de cara al usuario.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- **No** arreglar el bug de `errors.receiverName` en `pedido-form.tsx` aunque se
  lo cruce en T011–T016: está registrado en `docs/tech-debt-tracker.md` y queda
  fuera de los pasos de este plan (`AGENTS.md`, prohibición de limpieza
  oportunista). Si se quiere adentro, primero se extiende el plan.
- Commitear por tarea o por grupo lógico; nunca en `master` (abrir rama).
- Antes de cada Edit/Write, verificar que la ruta prefije con `covers:`.
