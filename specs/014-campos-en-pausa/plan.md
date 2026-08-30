---
ticket: none
status: active
covers:
  # Los tres componentes que muestran o mandan los dos campos. Ver research D1.
  - web/components/
  # `repetir.ts` conserva `packageSize` sin mostrarlo, y sus pruebas siguen.
  - web/lib/
  # La enmienda MINOR de las Scope boundaries. El sensor NO exime `.specify/`.
  - .specify/memory/constitution.md
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-30
---

# Implementation Plan: El tamaño del paquete y la hora de retiro quedan en pausa

**Branch**: `014-campos-en-pausa` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-campos-en-pausa/spec.md`

## Summary

Sacar del formulario el selector de tamaño de paquete y el campo de hora de
retiro, **dejando el código comentado en su lugar** porque el cliente dijo que
vuelven. La cantidad y la fecha se quedan. El sitio pasa a mandar `chico` y
`16:00` fijos, así que **el servicio no cambia una línea y no hay migración**.
La tarjeta de *Mis pedidos* deja de mostrar los dos valores.

**El riesgo de este feature no es romper algo: es dejar código comentado sin
explicación.** Técnicamente es media hora; lo que puede salir mal es que dentro
de tres meses alguien encuentre dos bloques muertos sin saber si se borran. Por
eso FR-003 no es decoración, es el requisito central de la mitad no visible.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15. Sin cambios.

**Primary Dependencies**: ninguna se agrega ni se quita.

**Storage**: sin cambios. `paquete_tamano` sigue `NOT NULL` con su `CHECK`, y
`retiro_hora` sigue `time NOT NULL` con su índice. **Es un requisito (FR-007),
no una omisión**; el argumento está en research D3.

**Testing**: vitest, `environment: node`, `include: ["lib/**/*.test.ts"]`. Las
pruebas de `lib/repetir.ts` que tocan el tamaño siguen: la función pura que lo
traduce no se toca.

**Target Platform**: navegador, mayoría móvil.

**Project Type**: web, superficie `web/` únicamente.

**Performance Goals**: ninguno nuevo. Se quitan dos campos.

**Constraints**: la guarda de `013` (`lib/sin-precio-a-la-vista.test.ts`) sigue
corriendo sobre estos mismos archivos y tiene que seguir verde.

**Scale/Scope**: 3 archivos de UI, 1 de `lib/`, 1 de gobierno.

## Constitution Check

*GATE: pasa antes de Fase 0, y se re-evalúa después de Fase 1.*

- **Constitución (documento supremo)**: las *Scope boundaries* nombran "package
  type/description, quantity" y "the pickup window" como parte del formulario.
  Este feature saca dos. **Enmienda MINOR, sin ADR**: ningún principio se
  revierte, es el cliente recortando su propio brief, y el gobierno pide ADR
  cuando una decisión revierte una anterior. Precedente exacto: la versión
  **2.1.0**, que sacó el método de pago y la ventana de entrega por la misma
  razón. La enmienda va **antes** del código.
  - Principio II (autoservicio es el valor): **reforzado.** Dos campos menos que
    llenar en la pantalla de mayor prioridad.
  - Principio III (YAGNI): es la razón por la que se descartó distinguir la
    tarjeta por época (research D5) y por la que el servicio no cambia (D3).
  - Principio IV (mobile-first): dos controles menos en una pantalla chica; uno
    de ellos un `input type="time"`, que en móvil abre un selector.
  - Principio V (5.0.0): intacto. La zona, la cobertura y el silencio sobre el
    precio no se tocan.
- **Plan-bounded change**: `covers:` nombra cuatro prefijos, cada uno con su
  motivo escrito.
- **Verified before done**: `verify:` corre lint, pruebas y build de `web/`.
  **No incluye la pata de Go a propósito, y esta vez el argumento es más fuerte
  que en `013`**: que el servicio no cambie no es solo una observación, es
  FR-007. Si una tarea tocara `backend/`, el sensor de cobertura la rebota antes
  de que `verify:` llegue a correr.

**Sin violaciones que justificar.** *Complexity Tracking* queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/014-campos-en-pausa/
├── plan.md              # este archivo
├── spec.md
├── research.md          # Fase 0 — cinco decisiones
├── quickstart.md        # Fase 1 — lo que solo se comprueba a mano
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2
```

**No hay `data-model.md` ni `contracts/`.** En `013` el modelo de datos tuvo
archivo propio porque "no cambia nada" era una afirmación que había que poder
verificar, y ya está escrita ahí. Acá la situación es la misma y la conclusión
también: repetirla en un archivo nuevo sería ruido. Lo que hay que saber vive en
FR-007 y en research D3.

### Source Code (repository root)

```text
web/
├── components/
│   ├── pedido-form.tsx          # los dos Field, su validacion, el resumen
│   └── pedido/
│       ├── crear-pedido.tsx     # los valores fijos que salen a la red
│       └── tarjeta-pedido.tsx   # Mis pedidos deja de mostrarlos
└── lib/
    └── repetir.ts               # conserva packageSize, no lo muestra

.specify/memory/constitution.md  # enmienda MINOR de Scope boundaries

backend/    # NO SE TOCA — es FR-007
android/    # NO SE TOCA — es FR-008
```

**Structure Decision**: superficie única `web/`, igual que `013`.

## Fases

**Fase 0 — [research.md](research.md).** Cinco decisiones: el rastreo archivo por
archivo (D1), por qué comentar es aceptable acá y qué peaje paga (D2), por qué el
backend no se toca y qué cuesta eso (D3), de dónde salen `chico` y `16:00` (D4),
y la tarjeta con el dato viejo que se pierde (D5).

**Fase 1 — [quickstart.md](quickstart.md).** Lo que `verify:` no puede probar.

**Fase 2 — `tasks.md`.**

## Complexity Tracking

Vacío: el *Constitution Check* no encontró violaciones que justificar.
