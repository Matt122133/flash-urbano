# Specification Quality Checklist: La app de Diego, rediseñada para la calle

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-30
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

**16/16.** Arranco en 14/16 con un [NEEDS CLARIFICATION] deliberado en FR-011,
resuelto el mismo dia.

El texto crudo del estado lo muestra `012` SIEMPRE, con el motivo escrito en
`seccionDe()`: un estado que la app no conoce cae en Pendientes, y mostrar el
texto es lo que hace que se note en vez de disimularse. Con pestañas eso cambia
de sentido —la pestaña ya dice el estado— pero **decidirlo solo seria revertir
una decision documentada de otro feature**, en una tarjeta que este ademas esta
acortando. **Resuelto**: se muestra solo cuando no coincide con la pestaña. Y se
resolvio COMPROBANDO el modelo antes de opinar — `pedidos.estado` es
`NOT NULL DEFAULT 'creacion'` y `seccionDe()` lo manda a Pendientes, asi que un
estado desconocido solo puede venir de un cuarto estado futuro del servicio, no
de un pedido nuevo. Esa comprobacion es la que hizo obvia la respuesta.

Dos observaciones mas:

- **Este es el primer spec del repo cuyo criterio de exito no lo puede firmar
  una maquina.** SC-008 es que Diego use la app al sol, con una mano, y diga que
  ahora si. Ninguna prueba lo cubre, y el spec lo dice en vez de inventar una
  metrica que suene objetiva.
- **"Sin detalles de implementacion" pasa limpio esta vez**: no se nombra ni
  Compose, ni Material, ni un solo archivo. Es un feature visual y el spec
  describe lo que Diego ve, no como se dibuja.
