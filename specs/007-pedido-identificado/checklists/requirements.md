# Specification Quality Checklist: El pedido se crea identificado y se guarda

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-12
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

**Estado**: 16/16 ítems en verde, sin cambios de estado en la revalidación del
hook `before_plan`. Siete clarificaciones aceptadas en total el 2026-08-12: tres
de la sesión de `/speckit-specify` y cuatro más que encontró el barrido de
`/speckit-clarify`.

### Lo que agregó el barrido del hook

Tres huecos materiales que el spec original no cubría, los tres con consecuencia
en el diseño y no sólo en la redacción:

- **Dónde ocurre el ingreso** (FR-006, FR-006a, FR-010a). Se eligió un diálogo
  sobre `/pedido` en vez de navegar. Lo habilita un detalle de `006` que hubo que
  ir a verificar en el código: Google Identity Services abre un **popup**, no
  redirige, y el camino del código por mail tampoco navega. El argumento que
  decidió no fue la comodidad sino el dato ajeno — el formulario lleva **el
  nombre y el teléfono de quien recibe**, que no consintió nada, y las dos
  alternativas exigían escribirlo en el disco del teléfono.
- **Qué pasa al cerrarse el diálogo** (FR-007a). El envío se reanuda solo y no en
  silencio.
- **Cómo se detecta un doble envío** (FR-016, FR-016a, FR-016b). Clave de
  idempotencia del navegador. Se descartó deduplicar por contenido por un motivo
  del negocio: dos paquetes iguales a la misma dirección el mismo día son
  normales, y un falso positivo ahí no es un pedido de menos sino **un paquete
  que nadie pasa a buscar**.

Y un requisito que salió de combinar dos decisiones y no de una pregunta:
**FR-007** ahora exige que la precarga del perfil no pise lo que la persona ya
escribió. Con el ingreso en diálogo, identificarse a mitad del formulario es un
momento en que la precarga podría reescribir una dirección recién tipeada.

### Lo que sigue mereciendo atención al planificar

Dos de las tres clarificaciones originales se resolvieron **difiriendo**, y eso
deja el spec en una forma que conviene mirar de frente antes de planificar:

- **El aviso a Diego vive en la app Android**, que no existe. Entre este feature
  y la app hay un tramo donde un cliente puede pedir un retiro real y nadie
  mirar. El spec no lo resuelve: lo nombra en su propia sección (*"El hueco que
  deja el diferimiento"*) y le cuelga dos obligaciones, FR-029 (la confirmación
  dice la verdad) y FR-032 (los pedidos se pueden leer sin `psql`). **Si esas
  dos se aflojan durante el plan, el feature reemplaza la promesa falsa de hoy
  por otra.**
- **El supuesto que hace tolerable ese hueco —volumen bajo— no está
  confirmado.** Es la pregunta 11 a Diego, sin responder desde el 2026-08-06.
  No bloquea, pero es la que decide si el diferimiento fue barato o caro, y por
  eso está escrita en Assumptions y no dada por sentada.
- **El precio no se verifica del lado del servidor** (FR-021). La decisión es
  deliberada y su costo está acotado por guardar el punto, que mantiene el
  precio recalculable. FR-021a obliga a registrar el riesgo residual como deuda
  al cerrar, para que no quede viviendo sólo en este archivo.

Dos anotaciones que no son fallas del checklist pero viajan con él:

- La sección *"Lo que hay que arreglar"* nombra tres cosas y la tercera —la
  pantalla que hoy dice *"¡Pedido cargado! Nos pondremos en contacto"* sin que
  nada se guarde ni se avise— **no estaba registrada en ningún lado del repo
  antes de este spec**. Se descubrió leyendo el componente para escribirlo, no
  en una revisión. Ya tiene fila propia en el tracker.
- Las Historias 2 y 3 comparten P1 a propósito y **no son independientes entre
  sí en el sentido del template**: la puerta sin el pedido guardado es lo que
  `006` decidió no hacer, y el pedido guardado sin la puerta viola la
  constitución v3.0.0. Se dejan separadas porque se prueban distinto, no porque
  se puedan desplegar sueltas.
