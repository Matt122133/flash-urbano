# Specification Quality Checklist: El precio sale de la entrega, no del retiro

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — los tres se cerraron el
      2026-08-22: FR-011 (el retiro se valida contra el área), FR-012 (su punto
      se sigue guardando, resuelto en silencio) y FR-015 (si no resuelve, pasa
      como texto sin punto y sin avisar). FR-014 se cerró sin preguntar: resolver
      una calle homónima en silencio está prohibido por el propio índice.
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

- **El bloqueo de gobernanza quedó levantado el 2026-08-22**: el feature revertía
  el Principio V de la constitución, y ya están el
  [ADR pricing-from-delivery-zone](../../../docs/decisions/pricing-from-delivery-zone.md)
  y la enmienda (3.0.0 → 4.0.0). El plan ya se puede escribir; promoverlo a
  `active` sigue siendo decisión humana.
- `/speckit-clarify` del 2026-08-22 agregó dos decisiones que el spec no tenía:
  el formulario mantiene el orden retiro → entrega (FR-002a), y *Mi cuenta*
  conserva su mapa, lo que convierte al perfil en la mejor fuente de coordenadas
  de retiro (FR-016) y deja obsoleta la revalidación de `007` sobre ese punto
  (FR-017).
