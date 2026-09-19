# Specification Quality Checklist: Un ambiente de staging

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

**Tercera pasada, 2026-09-13, hook `before_plan` (`/speckit-clarify`): sigue
16/16, sin cambios de estado.** Dos preguntas más, las dos de las que dependía
la forma del plan:

- **FR-008 / FR-008a / FR-009 / FR-009a** — la guarda del cruce vive **dentro
  del build**, no sólo en CI. Lo decidió un hallazgo: `deploy-pages.yml:66` toma
  la URL de `${{ vars.NEXT_PUBLIC_API_URL }}`, una variable de GitHub, así que
  **el valor con el que se compila producción no está en el repo** y ninguna
  prueba de `npm test` puede verlo. FR-009a deja escrito el precio que se paga:
  mudar de dominio pasa a incluir un cambio en el repo, revirtiendo en parte una
  decisión de `006`.
- **FR-021 / FR-022 / FR-023** — `/salud` suma un campo con el ambiente. FR-022
  existe para que ese campo **no pueda impedir el arranque**: se lee opcional,
  con valor por defecto, igual que la credencial de avisos. FR-023 existe porque
  el campo NO satisface FR-020 y era fácil creer que sí: dice a cuál se le pega,
  no si el código es el tuyo.

Se corrigió también un subtítulo mal ubicado — "Cómo llega el código a staging"
encabezaba requisitos de correo y de exposición — y el ADR, que decía "producción
no se modifica" en un sentido que FR-021 volvió falso: la **base** no se toca, el
servicio gana un campo.


**Segunda pasada, 2026-09-13: 16 de 16.** Los tres marcadores
[NEEDS CLARIFICATION] de la primera pasada quedaron resueltos por el dueño del
repo en la misma sesión:

- **FR-016 / FR-016a** — el correo de staging sale de verdad, por el mismo
  camino que producción, con **remitente distinto**. Se rechazó a propósito el
  interruptor de código que habría usado el enviador falso: habría metido una
  bifurcación en el camino de autenticación, y habría hecho que staging dejara
  de probar el camino real. FR-016a existe porque un remitente sin verificar
  deja staging **sin forma de entrar**, y eso no se ve hasta el primer ingreso.
- **FR-017** — no se agrega control de acceso propio. Lo que protege staging es
  lo que ya se deriva de su configuración.
- **FR-018 / FR-019 / FR-020** — despliegue sólo a mano. FR-019 (no conectar el
  servicio al repositorio) es lo que hace que "manual" sea cierto y no una
  intención; apareció al responder la pregunta, no estaba en ella. FR-020
  registra el riesgo que la decisión acepta —el staging viejo— y le pone una
  obligación al procedimiento en vez de dejarlo como confianza.

**Sobre "No implementation details"**: la feature ES de infraestructura, así que
los requisitos hablan de ambientes, bases y despliegues porque ése es el dominio
del problema, no la solución elegida. Se evitaron a propósito los nombres de
proveedor, de servicio y de variable en los FR; viven en las Assumptions y en el
Constitution Check, donde son contexto y no requisito.

El **Constitution Check** se agregó fuera de la plantilla porque el Principio III
(YAGNI sobre infraestructura) es el que esta feature tiene que responder de
frente, y dejarlo para el plan habría escondido la única objeción seria.
