# Specification Quality Checklist: El comentario del pedido

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-12
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

- **Todos los ítems pasan (16/16).** El marcador que el spec dejó abierto
  —FR-006, dónde lee el repartidor la indicación— lo contestó Mateo el
  2026-09-12 y quedó como D1, junto con D2 (una sola indicación por pedido).
- El `/speckit-clarify` del 2026-09-12 agregó tres decisiones más, en
  `## Clarifications`: el tope de 280 caracteres (confirmado, no heredado del
  borrador), la etiqueta **"Comentario"** —Mateo eligió la palabra del cliente
  por sobre una etiqueta que explicara el campo, así que el encauzamiento pasó
  al texto de ayuda, FR-001a— y que el comentario sigue la regla de `022` para
  editarse, decidido a la vista de que soltarla era defendible.
- La decisión de D1 **arrastra la app Android**, que es la superficie que el
  `verify:` casi no cubre: compila y corre pruebas JVM, y eso no dice que la
  pantalla se vea. El plan tiene que tratarlo como quickstart en el teléfono, no
  como verde de CI.
- La mención al cliente que pidió la función va **sin nombre ni correo**: el
  repo es público (ver la restricción en `AGENTS.md`).
- El `/speckit-analyze` del 2026-09-12 encontró 6 hallazgos, 2 de ellos CRITICAL,
  y se corrigieron cinco: FR-006a y la sección D1 describían una pantalla de
  detalle que la app no tiene (F1); `covers:` no incluía
  `backend/internal/tablero/`, que T006 necesita (F2); FR-013 no decía quién lo
  cumple (F3); T022 no salía de ningún FR y ahora lo declara (F4); y "tres
  superficies" contra "cuatro pantallas" (F6). **Queda abierto F5**: FR-009 —sin
  comentario no hay hueco— sólo lo mira el quickstart, sin prueba automática en
  la web.
