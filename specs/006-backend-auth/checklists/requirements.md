# Specification Quality Checklist: El backend existe y sabe quién pide

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-08
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

**14 de 14 en verde.** Los dos que fallaban en la primera pasada se cerraron el
mismo día contestando las dos preguntas de alcance; quedaron registradas en
*Clarifications*, sesión 2026-08-08.

- **Q1 — ¿`006` le pone la puerta al formulario de pedido?** No. El formulario
  no se toca; la puerta la pone `007`. Cerró con **FR-007b**, que lo escribe
  como requisito explícito en vez de dejarlo como omisión.
- **Q2 — ¿Google y el código por mail son la misma cuenta?** Sí, una sola cuenta
  por dirección de mail. Cerró con **FR-007a**, **SC-010a**, y un caso de borde
  nuevo para cuando Google devuelve una dirección distinta de la registrada.

**Sobre los nombres propios que sí aparecen.** El spec nombra Google, GitHub
Pages y el dominio `flashurbano.uy`. No son filtraciones de implementación: el
ingreso con Google es un requisito del cliente, seguir en Pages es una
restricción que el ADR fija y que este feature no puede cambiar, y el dominio es
una compra ya aprobada. El lenguaje, el hosting del servicio y el motor de base
de datos —que sí serían decisiones de implementación— quedan fuera del spec y
viven en el ADR.

**Restricciones sin resolver, deliberadamente.** El conflicto entre el pedido
como invitado y la constitución v2.2.0 está señalado en el spec y **no** se
resuelve ahí: enmendar la constitución es decisión del dueño del repo. No
bloquea `006`; bloquea `007`.
