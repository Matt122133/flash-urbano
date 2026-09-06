# Specification Quality Checklist: Corregir o dar de baja un pedido

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-05
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

**La seccion mas importante del spec no la pidio nadie**: *"El esquema ya decidio
la mitad de esto"*. El alcance que eligio el cliente —solo pendientes— y lo que
el `ON DELETE RESTRICT` de `pedidos_estados` permite **resultaron ser la misma
ventana**, y esa coincidencia es la que evita inventar un estado `anulado` y, con
el, tocar la app. Sin decirlo, el plan podria elegir borrado logico "por
prudencia" y pagar un APK nuevo por nada.

Dos concesiones a la regla de "sin detalles de implementacion", las dos
deliberadas:

- El spec nombra `pedidos_estados`, `ON DELETE RESTRICT` y el estado `creacion`.
  Es lo de arriba: la restriccion del esquema **es** una regla de negocio ya
  tomada y escrita, no un detalle de implementacion.
- FR-004 especifica **como** hay que responderle a quien pide un pedido ajeno
  —como si no existiera, no "no podes"—. Es una propiedad observable y de
  seguridad, no una eleccion de implementacion: la otra respuesta confirma la
  existencia del pedido.

**Una reversion del cliente quedo registrada en Clarifications en vez de
borrada.** La version anterior —editar en cualquier estado— estuvo elegida por
escrito, y lo que la cambio fue un caso concreto. Dejarlo escrito evita que
alguien "restaure" la version vieja creyendo que se perdio.
