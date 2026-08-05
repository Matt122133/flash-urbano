# Specification Quality Checklist: Dirección por cruce de calles en el formulario de pedido

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-04
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

- **Cero marcadores `[NEEDS CLARIFICATION]`.** Las tres decisiones que podrían
  haberlo sido se resolvieron con defaults derivados de la constitución y
  quedaron escritas en § Assumptions, no ocultas:
  1. *Esquinas sobre el límite de zona* — pendiente de respuesta del cliente
     desde el 2026-08-04, registrada como `High` en el tracker. El spec fija
     el comportamiento provisorio (desempate determinista de `002`) y acota el
     bloqueo al precio de esas direcciones.
  2. *Qué pasa si la calle no está en el índice* — sin pin libre de rescate,
     deriva a contacto directo. Se eligió por el Principio V ("nunca adivinar
     una zona") y porque un pin libre reabre el agujero de integridad de
     cobro que FR-014 cierra.
  3. *Ancho de la región de arrastre* — del orden de 50 m, valor exacto al
     plan.
- **Referencias a rutas de archivo** en § Contexto y § Dependencies
  (`web/lib/zonas.ts`, `web/components/pedido-form.tsx`,
  `docs/tech-debt-tracker.md`). Es deliberado y sigue la convención de
  `specs/002-mapa-zonas-precio/spec.md`: son punteros de trazabilidad a dato y
  deuda ya existentes, no descripciones de cómo implementar. Los
  requisitos funcionales (FR-001 a FR-025) están libres de tecnología.
- **Procedencia del dato**: se levantó como dependencia bloqueante en la
  primera versión del spec y **el dueño del repo la cerró el 2026-08-04**: es
  coautor del trabajo de curso donde se investigó la capa, y la capa es
  material que entregó la facultad para ese curso. Lo que quedó de eso no es
  un bloqueo sino un requisito de trazabilidad (FR-002): dejar escrito el
  origen junto al índice generado.
- **Dirección de entrega recortada del alcance el 2026-08-04**, también por
  decisión del dueño del repo: queda como texto libre, sin mapa ni punto,
  porque no incide en el precio y quien la necesita ubicada es el repartidor
  desde la app Android. Se eliminó la historia P3 que la cubría y se agregó
  FR-007a. La consecuencia asumida — que un pedido pueda salir con una
  dirección de entrega inexistente — está escrita en § Assumptions y **no es
  un riesgo nuevo**: es el comportamiento actual.
- Validado en una sola iteración; no hubo ítems fallidos que requirieran
  reescritura. Las dos correcciones posteriores fueron decisiones del dueño
  del repo, no defectos del spec.
