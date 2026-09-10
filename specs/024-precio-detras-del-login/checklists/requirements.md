# Specification Quality Checklist: El precio vuelve, del lado de adentro del login

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
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

- **Las tres clarificaciones se cerraron el 2026-09-10**, todas hacia el lado
  conservador: el visitante sin sesión no ve nada nuevo, *Mis pedidos* sigue sin
  montos y la etiqueta tampoco lleva. El monto queda en **un solo lugar**, el
  bloque de cobertura del formulario. Quedan registradas en § Clarifications.
- **La decisión de no leer nunca la columna `precio` guardada hace que la
  enmienda del Principio V sea angosta**: habilita monto recalculado, en el
  formulario, a un cliente identificado, y deja intacto el párrafo que prohíbe
  leer esa columna. Eso importa porque el feature `025` (dashboard) viene
  después y no hereda ninguna habilitación de acá.
- **Nombres de archivo en § Dependencias.** Se los deja a propósito: las dos
  guardas automáticas (`sin-precio-a-la-vista.test.ts` y
  `cotizar-abierto.test.ts`) no son detalle de implementación sino
  **restricciones preexistentes** que deciden si el feature es correcto. La
  primera hoy pone en rojo justamente lo que este feature quiere hacer;
  omitirla del spec la convertiría en una sorpresa en la fase de plan.
- **El spec está completo, pero NO habilita `/speckit-plan` todavía**: la
  enmienda del Principio V (5.1.0 → 6.0.0) y su ADR son bloqueantes y viven en
  la fase Decide.
