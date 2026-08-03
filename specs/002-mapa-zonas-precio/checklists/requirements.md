# Specification Quality Checklist: Mapa de zonas con precio automático por ubicación

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-02
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Iteración 1 — 2026-08-02

**Falla abierta**: quedan 3 marcadores `[NEEDS CLARIFICATION]`, en FR-011,
FR-013 y FR-015. Los tres son de alcance, que es la categoría de mayor
prioridad, y ninguno tiene un default razonable:

- **FR-013** (¿retiro o entrega?) es el más grave: el formulario del milestone
  001 captura **una** dirección compuesta pero **dos** momentos (retiro y
  entrega). Un servicio de mensajería tiene origen y destino; el spec 001 nunca
  tuvo que resolverlo porque no calculaba precio. Ahora sí, y de la respuesta
  depende si hay uno o dos mapas en el formulario.
- **FR-015** (¿fijo por zona o por cantidad/tamaño?) cambia la definición misma
  de "precio en firme" y afecta a FR-002 y FR-014.
- **FR-011** (¿obligatorio para enviar?) decide si el feature es un bloqueo del
  flujo existente o un agregado.

Presentados al usuario como Q1–Q3. La casilla queda sin marcar hasta que se
respondan y se reescriban los tres requisitos.

### Iteración 2 — 2026-08-02 — todos los ítems pasan

Q1–Q3 respondidos por el dueño del repo. Los tres marcadores se reemplazaron
por requisitos cerrados y se propagaron al resto del spec:

| # | Requisito | Respuesta | Qué se propagó |
|---|---|---|---|
| Q1 | FR-013 | Zona de **retiro** | US1 (título y relato), US3, Key Entities, nuevo edge case de retiro/entrega en zonas distintas, Assumptions |
| Q2 | FR-015 | Monto **fijo por zona** | Nuevo edge case de volumen/tamaño, Assumptions |
| Q3 | FR-011 | **Obligatorio** para enviar | US1 escenarios 3 y 4, FR-012 (fuera de zona ⇒ bloquea envío), edge cases, Assumptions |

**Nueva ambigüedad detectada al propagar, NO marcada como
[NEEDS CLARIFICATION]**: a qué domicilio corresponde la única dirección escrita
que captura el formulario del milestone 001 — ¿retiro o entrega? Ese spec nunca
lo desambiguó porque no calculaba nada con ella; ahora que el punto del mapa es
explícitamente el retiro, la lectura cambia el conjunto de campos del
formulario y podría expandir el alcance con una dirección de destino.

Se registró en § Assumptions como **PENDIENTE PARA `/speckit-clarify`** en vez
de como marcador, porque ya se había alcanzado el límite de 3 y porque el hook
obligatorio `before_plan` ejecuta `/speckit-clarify` antes de planificar, que es
donde corresponde cerrarla. **No planificar sin resolverla.**

### Iteración 3 — 2026-08-02 — ambigüedad de la iteración 2, resuelta

El dueño del repo confirmó: **la dirección escrita del milestone 001 es la de
retiro**. El punto del mapa y ese bloque describen el mismo domicilio.

Consecuencia aceptada: **el domicilio de entrega no existía en ningún lado**, y
este feature lo agrega. Expansión de alcance deliberada respecto del pedido
original, incorporada como:

- **US4** (P2) — Decir a dónde va el paquete, con 3 escenarios de aceptación.
- **FR-022 a FR-024** — dos domicilios distinguibles; el de entrega con los
  mismos campos que el de retiro; el de entrega sin mapa, sin zona y sin efecto
  sobre el precio.
- **SC-007** — ningún pedido sin destino, y los dos bloques distinguibles sin
  ayuda.
- Nuevo edge case: destino fuera de cobertura se acepta igual (se cobra por
  retiro).
- § Dependencias: el FR-005 del spec 001 queda **reinterpretado**, no
  reemplazado.

Se prefirió meterlo acá antes que en un spec propio porque etiquetar la
dirección existente como "de retiro" y no capturar destino deja el formulario
incoherente. Se aisló en una historia P2 para que siga siendo descartable sin
tocar US1–US3.

**Estado**: 16/16 ítems pasan, 0 marcadores. `/speckit-clarify` (hook
obligatorio `before_plan`) no tiene ambigüedades heredadas para resolver; queda
igual como red de seguridad.

**Nota sobre "No implementation details"**: el spec nombra OpenStreetMap y
"mapa interactivo" en § Assumptions. Se dejó a propósito: son decisiones ya
tomadas con el dueño del repo, con su justificación (licencia comercial,
ausencia de backend), y registrarlas evita que el plan las reabra. Los
requisitos funcionales y los criterios de éxito se mantienen agnósticos.

### Verificación del dato de origen — 2026-08-02

Contra `web/design-source/zonas-flash-urbano.kml`, previo al spec:

- 5 polígonos, los 5 cerrados (primer vértice = último). ✅
- Sin solapamientos: 67.600 puntos muestreados, 2 caen en dos zonas —
  consistente con bordes compartidos. ✅
- Coordenadas lat/lng reales de Montevideo. ✅
- Áreas: Z1 104 km², Z2 83 km², Z3 150 km², Z4 57 km², Z5 47 km².
- Vértices: Z1 91, Z2 125, Z3 103, Z4 74, **Z5 24**.
- Nombre "Zona&nbsp;&nbsp;4" con espacio duro (`\xa0`) → FR-003.

**Sin verificar por programa**: que cada tramo corra sobre su calle. Es visual
y se cierra con SC-004.

### Iteración 4 — 2026-08-02 — corrección de dos afirmaciones falsas

El dueño del repo aportó dos hechos que invalidaban parte de lo escrito. Se
leyó `web/design-source/mapa-costos-original.jpeg` para confirmarlos: la imagen
tiene los nombres de calle rotulados sobre cada línea divisoria.

| Lo que decía el spec | Lo que es cierto |
|---|---|
| "Los límites no fueron validados por el cliente" — riesgo abierto, bloqueante de release | El cliente definió zonas, precios y calles, y validó el trazado. **Sin gate de release.** |
| "Los límites no siguen nombres de calle, están trazados a ojo" | **Siguen arterias nombradas**, escritas por el cliente en la imagen |
| "Zona 5 es la menos precisa (24 vértices)" | Pocos vértices porque su límite son Av. de las Américas / Ruta 101, rectas y largas. Sigue siendo la de mayor exposición por ser la más cara, pero por precio, no por descuido |
| "Los polígonos los trazó el cliente" | Los definió el cliente por calle; el trazado a geometría lo hizo el dueño del repo |

Se agregó **§ Límites de zona** al spec: las 10 arterias transcritas a texto,
declaradas normativas por encima de la geometría. Motivo: existían solo como
píxeles dentro de un JPEG, así que no eran verificables, ni citables en una
discusión de cobro, ni sobrevivían a la pérdida del archivo — contra el
principio operativo del repo ("si no está en el repo, no existe"). Respaldado
por FR-025 (numerado FR-004b al crearse; renumerado en la iteración 6).

También se corrigieron SC-004 (ahora nombra las arterias a verificar, empezando
por Zona 5), un edge case nuevo por el ancho de las avenidas límite, y el ADR
`zone-based-automatic-pricing`, que había apoyado un gate de release en el
supuesto falso.

**Estado**: 16/16 ítems siguen pasando.

### Iteración 5 — 2026-08-02 — `/speckit-clarify`

Barrido de ambigüedad sobre las 10 categorías de la taxonomía. **1 pregunta
formulada** (de 5 permitidas); el resto se resolvió con defaults documentados.

**Contradicción encontrada en el propio spec** — FR-011 exigía ubicación
obligatoria para enviar; FR-020 exigía que el formulario siguiera siendo
enviable con la fuente cartográfica caída. Imposibles a la vez. Resuelta por el
dueño del repo: **con el mapa caído se bloquea el envío y se deriva a
contacto**. Se reescribieron FR-020, SC-005 y el edge case correspondiente, y
se agregó un edge case para la misma falla en `/sobre-nosotros`, donde el mapa
es informativo y no debe bloquear nada.

**Corrección de una imprecisión propia**: el spec decía que "la licencia de
OpenStreetMap permite el uso comercial citando la fuente". Eso vale para los
*datos* (ODbL), no para los *servidores de mosaicos* públicos, que tienen una
política de uso aparte orientada a volumen bajo. Se separaron ambos permisos y
se dejó la elección de proveedor como restricción explícita para el plan.

**Defaults documentados sin preguntar** (bajo impacto o default obvio):
vista inicial del mapa (Montevideo entero, sin pedir geolocalización al abrir),
y retiro de los assets muertos del milestone 001 (`build-map.js` y el JPEG
generado; el original del cliente se conserva).

**Diferido a planificación**: proveedor concreto de mosaicos, accesibilidad por
teclado del marcado de punto (Principio III / YAGNI), precisión de
almacenamiento de coordenadas.

### Iteración 6 — 2026-08-02 — `/speckit-analyze` y sus correcciones

Análisis cruzado de `spec.md`, `plan.md` y `tasks.md`. **0 hallazgos CRITICAL**,
cobertura de requisitos 92%. Los 8 hallazgos se corrigieron:

| ID | Sev | Qué era | Corrección |
|---|---|---|---|
| E1 | HIGH | **FR-021 (voz institucional) sin ninguna tarea**, con tres tareas escribiendo copy nuevo | Tarea T031 dedicada, que enumera los cinco lugares de copy nuevo |
| F1 | HIGH | **Regresión de accesibilidad**: el `<Image>` que se borra describe las zonas en su `alt`; el mapa es un canvas opaco y la lista en texto solo aparecía si fallaban los mosaicos | FR-007 ahora exige la leyenda como texto real siempre visible, fuera del mapa. Propagado a T018, T019 y quickstart pasos 1 y 11 |
| D1 | MEDIUM | Vitest no lo exige ningún requisito; es criterio del plan, no del spec | Aceptado explícitamente. La justificación (la función decide plata) se sostiene y ya estaba en Complexity Tracking |
| C1 | MEDIUM | SC-001 (15 s) no se medía en ninguna tarea | SC-001 dice "se mide con cronómetro, no se estima"; T033 y quickstart paso 5 lo cronometran |
| B1 | MEDIUM | "Un plazo corto desde el montaje" sin cuantificar, en una regla que **bloquea pedidos** | Fijado en **8 s**, con el razonamiento en research D7 y en T009 |
| F2 | LOW | `zonas.test.ts` testeaba `zona-lookup.ts` | Renombrado a `zona-lookup.test.ts` en los cuatro artefactos |
| F3 | LOW | `FR-004b` rompía la convención `FR-###` | Renumerado a **FR-025** en spec, plan y tasks |
| B2 | LOW | Deriva terminológica entre "fuente cartográfica", "servicio de mapas" y "mosaicos" | Unificado en "mosaicos" para disponibilidad y falla; **"fuente cartográfica" se conserva a propósito** en FR-008 y US2 escenario 3, donde se habla de atribución — ahí lo que se cita es el origen de los datos (ODbL), no los servidores de mosaicos, y son dos permisos distintos (research D2) |

**Estado**: 16/16 ítems del checklist siguen pasando. Sin marcadores pendientes.
Listo para promoción humana del plan a `status: active`.
