---
description: "Task list for 003 — Dirección por cruce de calles en el formulario de pedido"
---

# Tasks: Dirección por cruce de calles en el formulario de pedido

**Input**: Design documents from `specs/003-direccion-por-esquina/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/direcciones.md, quickstart.md

**Tests**: sí se generan tareas de prueba. No es preferencia: SC-002 y FR-006a
exigen un fixture de esquinas con verificación automática, y el módulo de
direcciones decide el precio.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias abiertas)
- **[Story]**: a qué historia del spec pertenece

## Path Conventions

Una sola superficie: todo cuelga de `web/`. Ver § Project Structure del plan.

---

## Phase 1: Setup

**Purpose**: dejar la procedencia registrada y el script en pie antes de tocar dato.

- [X] T001 [P] Documentar en `web/design-source/README.md` de dónde salió la capa de ejes viales, quién la proveyó y bajo qué términos, y cómo se regenera el índice (FR-002)
- [X] T002 Crear `web/design-source/build-calles.js` con el esqueleto sin dependencias: lectura de los `.sql` por argumento, recorte al área de servicio y escritura del archivo de salida

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el índice y el módulo de direcciones. **Sin esto ninguna historia se puede implementar ni probar.**

⚠️ Todas las historias dependen de esta fase.

- [X] T003 Implementar en `web/design-source/build-calles.js` el parseo de geometría WKB, el descarte de tramos sin nombre y de nombres genéricos, y la normalización de nombres a `busqueda` y `canonico` (research R1, R3)
- [X] T004 Implementar en `web/design-source/build-calles.js` el cálculo de intersecciones con grilla espacial, sin fusionar geometría por nombre canónico (research R3 — fusionar fabrica esquinas inexistentes)
- [X] T005 Implementar en `web/design-source/build-calles.js` el colapso de calzadas dobles a 60 m con centroide (research R4)
- [X] T006 Implementar en `web/design-source/build-calles.js` el cálculo de esquinas contiguas por calle, guardadas como deltas contra la esquina a 5 decimales (research R7)
- [X] T007 Hacer que `web/design-source/build-calles.js` imprima al terminar la cantidad de calles y esquinas y el tamaño crudo y comprimido del índice
- [X] T008 Generar `web/public/calles-mvd.json` y comprobar contra las referencias: ~5.746 calles, ~20.884 esquinas, comprimido bajo 1 MB (SC-007). Si se pasa del techo, guardar distancias en vez de coordenadas según research R7
- [X] T009 [P] Definir el tipo `Direccion` en `web/lib/direccion.ts` con `punto`, `zona` y `precio` opcionales, según data-model.md
- [X] T010 Implementar `cargarIndice`, `buscarCalle`, `buscarEsquinaDe` y `buscarEsquina` en `web/lib/direcciones.ts` según contracts/direcciones.md — funciones puras, `buscarEsquina` devuelve siempre lista, la ruta se resuelve con `asset()`
- [X] T011 Implementar `regionPermitida`, `contiene` y `acercarALaRegion` en `web/lib/direcciones.ts`, con la región tomada sobre la calle declarada y el caso de esquina en punta de calle
- [ ] ⏭️ **DIFERIDA el 2026-08-04** — T012 🛑 **PARADA DURA — la hace una persona, no el agente.** Armar el fixture de al menos 30 esquinas conocidas en `web/lib/direcciones.test.ts` con coordenadas confirmadas a mano contra un mapa real. **Un agente NO puede completar esta tarea**: si genera las coordenadas desde el mismo índice que el test debe verificar, el test pasa siempre y SC-002 no prueba nada (research R6). Ante esta tarea, el loop se detiene y se le pide al dueño del repo
- [ ] ⏭️ **DIFERIDA el 2026-08-04** (depende de T012) — T013 Escribir en `web/lib/direcciones.test.ts` la prueba del fixture con tolerancia de 30 m (SC-002, FR-006a)
- [X] T014 [P] Escribir en `web/lib/direcciones.test.ts` las pruebas de variantes de nombre (`18 de julio` / `Avenida 18 de Julio`, `Garzon` / `Garzón`), de que `buscarEsquinaDe` nunca ofrece una calle sin esquina, de que un par ambiguo devuelve todos los candidatos, y de que el colapso de 60 m no fusiona dos esquinas consecutivas reales de la misma calle
- [X] T015 [P] Escribir en `web/lib/direcciones.test.ts` las pruebas de clampeo: un punto fuera vuelve al borde, el devuelto está adentro, y una esquina en punta de calle no rompe

**Checkpoint**: `npm test` verde. El módulo resuelve esquinas correctas sin que exista todavía interfaz.

> **T012 y T013 quedaron sin hacer, por decisión del dueño del repo el
> 2026-08-04**: validó el flujo a mano y prefirió cerrar. Lo que eso significa
> es concreto: **SC-002 no está verificado por ninguna prueba automática**. Las
> esquinas se comprobaron a ojo sobre cinco casos conocidos durante la
> investigación, y nada impide que una regeneración futura del índice las
> corra sin que nadie se entere. Queda registrado como `High` en
> [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md).

---

## Phase 3: User Story 3 — El mapa deja de taparle la interfaz (P2)

**Goal**: Leaflet deja de dibujarse por encima de la navegación y de cualquier elemento flotante.

**Independent test**: abrir `/pedido` y `/sobre-nosotros` en viewport de teléfono, scrollear con el mapa en pantalla y abrir el menú sobre el mapa.

> **Por qué va primero pese a ser P2**: US1 despliega listas de sugerencias justo encima del mapa. Sin esto, esa historia no se puede probar. Es además la más chica y la que paga una deuda `High` que está en producción hoy.

- [X] T016 [US3] Encerrar Leaflet en su propio contexto de apilado con `isolation: isolate` en el contenedor del mapa en `web/components/mapa-zonas.tsx`. **No** subir la navbar a `z-[1001]`: eso arranca una carrera contra una librería que ya usa 1000
- [X] T017 [US3] Verificar el resultado en `/pedido` y `/sobre-nosotros` en viewport de teléfono, con scroll y con el menú de navegación abierto sobre el mapa (SC-005)

**Checkpoint**: US3 entregable sola. La deuda `High` del tracker queda pagada.

---

## Phase 4: User Story 1 — Ubicar el retiro escribiendo calle y esquina (P1)

**Goal**: el cliente escribe dos campos y el sitio resuelve punto, zona y precio sin que toque el mapa.

**Independent test**: cargar `/pedido`, escribir un par calle/esquina conocido y verificar que el pin aparece en la intersección correcta con el precio de su zona, sin tocar el mapa.

- [X] T018 [US1] Crear el combobox accesible en `web/components/campo-autocompletado.tsx`: teclado completo (flechas, Enter, Escape), foco manejado y anuncios para lector de pantalla (FR-023a, FR-023b)
- [X] T019 [US1] Probar `campo-autocompletado.tsx` sólo con teclado antes de conectarlo a nada (SC-009)
- [X] T020 [US1] Crear `web/components/bloque-direccion.tsx` con Calle y Esquina primero y el resto de los campos deshabilitados con la razón visible (FR-007)
- [X] T021 [US1] Conectar en `web/components/bloque-direccion.tsx` la carga diferida del índice y las sugerencias de calle, con el mensaje de error explícito cuando el índice no carga
- [X] T021a [US1] Debounce del tipeo en `web/components/campo-autocompletado.tsx` y verificación de que las sugerencias aparecen en menos de 300 ms desde que se deja de tipear (SC-006)
- [X] T022 [US1] Hacer que el campo Esquina en `web/components/bloque-direccion.tsx` ofrezca sólo calles que crucen la calle elegida (FR-009)
- [X] T023 [US1] Reservar el espacio del mapa en `web/components/bloque-direccion.tsx` y mostrarlo **debajo** de los campos recién con el cruce resuelto, sin salto de layout (FR-010a, FR-010b)
- [X] T024 [US1] Colocar el punto en la intersección y centrar el mapa al resolverse el cruce, y desactivar el clic del mapa como forma de colocar el punto en `web/components/mapa-zonas.tsx` (FR-010, FR-010c)
- [X] T025 [US1] Reemplazar el bloque de retiro de `web/components/pedido-form.tsx` por `bloque-direccion.tsx`, dejando el bloque de entrega como texto libre sin tocar (FR-007a)
- [X] T026 [US1] Resolver zona y precio desde el punto con `resolverZona()` y mostrarlos en firme en `web/components/pedido-form.tsx`, sin guardarlos como estado independiente
- [X] T027 [US1] Implementar el caso fuera de zona en `web/components/pedido-form.tsx`: sin precio, sin poder enviar, derivado a contacto directo (FR-019)
- [X] T028 [US1] Bloquear el envío cuando el retiro no tiene cruce resuelto con punto en zona en `web/components/pedido-form.tsx` (FR-012)
- [X] T029 [US1] Invalidar punto, zona, precio y complementos al cambiar calle o esquina de un bloque ya resuelto en `web/components/bloque-direccion.tsx` (FR-013)

**Checkpoint**: US1 entregable. Es el MVP del feature.

---

## Phase 5: User Story 2 — Ajustar el pin dentro de la cuadra (P2)

**Goal**: el pin se mueve dentro de la cuadra declarada y el precio acompaña.

**Independent test**: con un cruce resuelto, arrastrar el pin a lo largo de la cuadra y hacia afuera, verificando que dentro se mueve libre, que fuera vuelve al borde, y que el precio se actualiza al cambiar de zona.

- [X] T030 [US2] Hacer el marcador arrastrable en `web/components/mapa-zonas.tsx`, con el punto libre dentro de la región y sin proyección ni imán al eje (FR-014)
- [X] T031 [US2] Clampear el arrastre en `web/components/mapa-zonas.tsx` con `acercarALaRegion`: soltar fuera devuelve el pin al borde más cercano y explica por qué (FR-015)
- [X] T032 [US2] Dibujar la región permitida en el mapa en `web/components/mapa-zonas.tsx` para que se vea hasta dónde se puede mover
- [X] T033 [US2] Recalcular zona y precio en cada movimiento del punto en `web/components/pedido-form.tsx` (FR-016)
- [X] T034 [US2] Mostrar el cambio de zona con zona y precio anterior y nuevo, sin frenar el arrastre ni pedir confirmación, en `web/components/pedido-form.tsx` (FR-017)
- [X] T035 [US2] Mostrar zona y precio finales en el resumen previo al envío en `web/components/pedido-form.tsx` (FR-017a)
- [X] T036 [US2] Revalidar al enviar que el punto sigue dentro de la región permitida en `web/components/pedido-form.tsx`, como guarda y no como control principal (FR-018)

**Checkpoint**: US2 entregable. El control de integridad del cobro queda cerrado.

---

## Phase 6: User Story 4 — Elegir entre cruces homónimos (P3)

**Goal**: ante varios cruces posibles elige el cliente, no el sitio.

**Independent test**: buscar un par de nombres repetidos (`Calle 2` con `Calle 3` sirve) y verificar que se ofrecen todos los cruces y que no se coloca punto hasta elegir.

- [X] T037 [US4] Mostrar todos los cruces candidatos ubicados en el mapa cuando `buscarEsquina` devuelve más de uno, sin colocar pin todavía, en `web/components/bloque-direccion.tsx` (FR-021)
- [X] T038 [US4] Permitir elegir un candidato y seguir el flujo igual que con cruce único en `web/components/bloque-direccion.tsx`
- [X] T039 [US4] Impedir el envío mientras haya candidatos sin elegir en `web/components/pedido-form.tsx` (SC-008)

**Checkpoint**: US4 entregable.

---

## Phase 7: User Story 5 — Datos complementarios para el repartidor (P3)

**Goal**: número de puerta, apto y cooperativa aparecen después de la esquina y no mueven nada.

**Independent test**: verificar que los tres campos están deshabilitados antes de resolver el cruce, habilitados después, y que escribir en ellos no cambia el pin ni el precio.

- [X] T040 [US5] Habilitar Número de puerta, Apto y Cooperativa en `web/components/bloque-direccion.tsx` recién con el cruce resuelto, como texto libre que no altera punto, zona ni precio (FR-011)
- [X] T041 [US5] Incluir número de puerta, apto y cooperativa junto con calle, esquina, punto, zona y precio en el resumen del pedido en `web/components/pedido-form.tsx`

**Checkpoint**: US5 entregable. El formulario queda completo.

---

## Phase 7b: Autocompletado en la dirección de entrega (agregada el 2026-08-04)

**Goal**: la entrega se escribe con las mismas sugerencias que el retiro, sin mapa y sin bloquear.

**Independent test**: cargar una entrega eligiendo de las sugerencias, y otra escribiendo una calle que no está en el índice; las dos tienen que poder enviarse.

> **Por qué se agregó**: el dueño del repo probó el formulario y pidió el autocompletado también para el destino. Revisa la decisión previa de dejarlo como texto libre; el mapa sigue fuera.

- [X] T048 Permitir texto libre en `web/components/campo-autocompletado.tsx`: lo tipeado vale aunque no se elija una sugerencia (FR-007b)
- [X] T049 Dar a `web/components/bloque-direccion.tsx` un modo sin punto ni complementos condicionados, para la entrega (FR-007a)
- [X] T050 Reemplazar el bloque de entrega de `web/components/pedido-form.tsx` por `bloque-direccion.tsx` en modo entrega, manteniendo sus campos obligatorios como hoy (FR-020)

---

## Phase 7c: Coherencia de fechas (agregada el 2026-08-04)

**Goal**: no se puede pedir una entrega anterior al retiro, ni un retiro en el pasado.

**Independent test**: intentar enviar con entrega anterior al retiro, con ambas en el mismo instante, y con retiro ayer. Los tres tienen que ser rechazados con un mensaje claro.

> **Por qué se agregó**: lo detectó el dueño del repo probando el formulario. Los cuatro campos existían desde `001` y sólo se validaba que estuvieran completos.

- [X] T051 Crear `web/lib/fechas.ts` con la comparación de retiro y entrega como función pura, y `web/lib/fechas.test.ts` con los bordes: mismo día distinta hora, mismo instante, entrega anterior, retiro en el pasado (FR-026, FR-027)
- [X] T052 Usar esa comparación en `validate()` de `web/components/pedido-form.tsx`, con mensajes que digan cuál es el problema (FR-026, FR-027)
- [X] T054 Mostrar el margen mínimo como aviso permanente en la sección de fechas de `web/components/pedido-form.tsx`, leyendo la constante para que no se desincronice (FR-029)
- [X] T055 Revisar la coherencia de fechas al salir de cada uno de los cuatro campos en `web/components/pedido-form.tsx`, sin pisar los errores de campo vacío (FR-030)
- [X] T053 Acotar los `input type="date"` en `web/components/pedido-form.tsx` con `min`, para que el error sea difícil de cometer y no sólo detectable al enviar (FR-028)

---

## Phase 8: Polish & Cross-Cutting

- [X] T042 [P] Recorrer entero el guion manual de `quickstart.md` en viewport de teléfono
- [X] T043 [P] Verificar el recorrido completo sólo con teclado y con lector de pantalla (SC-009)
- [X] T044 [P] Reflejar en `ARCHITECTURE.md` que el dato generado grande vive en `web/public/` y sumar `direcciones.ts` a los hotspots
- [X] T045 [P] Mover a Resolved en `docs/tech-debt-tracker.md` la deuda del apilado del mapa y la del doble ingreso de dirección
- [X] T046 Correr `verify:` — `cd web && npm run lint && npm test && npm run build` — hasta verde
- [X] T047 Pasar `specs/003-direccion-por-esquina/plan.md` a `status: completed`

---

## Dependencies

```text
Phase 1 (Setup)
      ↓
Phase 2 (Foundational: índice + módulo)   ← bloquea todo
      ↓
Phase 3 (US3 apilado)   ← bloquea US1 por las listas de sugerencias
      ↓
Phase 4 (US1)   ← MVP del feature
      ↓
   ┌──┴──────────────┬─────────────┐
Phase 5 (US2)   Phase 6 (US4)   Phase 7 (US5)
   └──┬──────────────┴─────────────┘
      ↓
Phase 8 (Polish)
```

- US3 no depende de la fase 2: se puede hacer en cualquier momento y entregarse sola. Va antes de US1 sólo porque US1 la necesita para poder probarse.
- US2, US4 y US5 dependen todas de US1, pero **no entre sí**: una vez que US1 está, las tres pueden avanzar en paralelo.
- T012 es la única tarea con intervención humana obligatoria y bloquea T013.

## Parallel Opportunities

- **Fase 1**: T001 con T002.
- **Fase 2**: T009 en paralelo con la cadena T003→T008. T014 y T015 en paralelo entre sí una vez que T011 está.
- **Fase 3**: independiente de todo lo demás; puede ir en paralelo con la fase 2 entera.
- **Fases 5, 6 y 7**: en paralelo entre sí después de US1. Ojo con `pedido-form.tsx`, que las tres tocan.
- **Fase 8**: T042 a T045 en paralelo; T046 y T047 al final y en orden.

## Implementation Strategy

**MVP**: Fases 1, 2, 3 y 4 — o sea hasta US1. Con eso el formulario ya resuelve
la dirección de retiro por cruce de calles, muestra el punto y cotiza, y el
mapa dejó de tapar la interfaz. Es demostrable al cliente y tiene sentido solo.

**Incremento siguiente**: US2, que cierra el control de integridad del cobro.
Es la que más importa de las tres restantes, porque toca la plata.

**Después**: US4 y US5, en cualquier orden.

**Advertencia de orden**: `web/components/pedido-form.tsx` lo tocan las fases 4,
5, 6 y 7. Conviene no correrlas en paralelo de verdad sobre ese archivo aunque
las historias sean independientes.
