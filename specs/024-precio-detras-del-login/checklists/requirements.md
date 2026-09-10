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

- **Las cuatro clarificaciones se cerraron el 2026-09-10**, todas hacia el lado
  conservador: el visitante sin sesión no ve nada nuevo, *Mis pedidos* sigue sin
  montos, la etiqueta tampoco lleva, y la ventana en que la sesión todavía no se
  resolvió se trata como *sin sesión*. El monto queda en **un solo lugar**,
  pegado al nombre de la zona. Quedan registradas en § Clarifications.
- **La cuarta salió del hook `before_plan`, no de la sesión inicial**, y es la
  que más cerca estuvo de convertirse en un defecto: el proveedor de sesión
  expone `cargando` arrancando en `true`, así que hay una ventana en **cada**
  carga de página donde no se sabe si hay sesión. La rama equivocada le filtra
  el monto a un visitante anónimo durante unos frames.
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
