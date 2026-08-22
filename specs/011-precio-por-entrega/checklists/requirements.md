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

- [ ] No [NEEDS CLARIFICATION] markers remain — **queda 1**. FR-011 y FR-012 se
      contestaron el 2026-08-22 (el retiro se valida contra el área, y su punto
      se sigue guardando, resuelto en silencio). Esa respuesta **abrió** FR-015:
      qué hacer cuando el texto del retiro no resuelve a ningún punto y por lo
      tanto no hay contra qué comprobar el área. FR-014 (calle homónima) se
      cerró sin preguntar: resolver la ambigüedad en silencio está prohibido por
      el propio índice de calles.
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

- **Bloqueo de gobernanza, no de calidad del spec**: el feature revierte el
  Principio V de la constitución. El plan no se puede promover a `active` sin la
  enmienda y su ADR en `docs/decisions/`. Está escrito en el spec, sección
  *Dependencias y bloqueos*.
- Las dos preguntas abiertas se resuelven en `/speckit-clarify`, y la respuesta
  de las dos la tiene Diego. FR-012 es la más urgente de preguntar: es un dato
  que, si se deja de guardar, no se puede recuperar después.
