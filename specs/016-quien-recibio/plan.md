---
ticket: none
status: completed
covers:
  # La migracion 0006: dos columnas nullable en `pedidos_estados`.
  - backend/migrations/
  # El endpoint que mueve el estado ahora recibe quien recibio, y las dos
  # respuestas dejan de tener la misma forma. Ver research D1.
  - backend/internal/pedidos/
  # La hoja que pregunta quien recibio, colgada de la accion Entregado.
  - android/
  # La tarjeta de Mis pedidos muestra el nombre, nunca el documento.
  - web/components/pedido/
  # El tipo de lo que devuelve el servicio.
  - web/lib/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-08-30
---

# Implementation Plan: Quién recibió el paquete

**Branch**: `016-quien-recibio` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-quien-recibio/spec.md`

## Summary

Al marcar entregado, la app pregunta quién recibió. El caso mayoritario —recibe
quien figura— es **un toque**; si atendió otra persona, Diego escribe su nombre
y, si se la dan, la cédula. Se guarda en el historial de estados, junto al evento
de entrega.

**El cliente ve el nombre. La cédula no sale del lado de Diego.**

**El riesgo de este feature no es que algo no funcione: es que un dato salga por
donde no debe.** Hoy `GET /pedidos` y `GET /admin/pedidos` devuelven la misma
estructura, así que agregarle la cédula al pedido se la agrega a los dos — en el
mismo commit, sin que nadie lo escriba. Por eso la decisión de diseño central
(research D1) es partir los tipos, y por eso hay una prueba cuyo único trabajo es
fallar si la cédula aparece donde no va.

## Technical Context

**Language/Version**: Go (servicio), Kotlin/Compose (app), TypeScript/Next (web).
Sin cambios de versión, **sin dependencias nuevas** en ninguna de las tres.

**Storage**: Postgres. **Migración `0006`**: dos columnas **nullable** en
`pedidos_estados`. La tabla `pedidos` **no se toca** (research D2).

**Testing**: Go con Postgres real, vitest en web, JVM en Android. **Ojo con los
skips**: las pruebas de Go se saltean solas sin `TEST_DATABASE_URL`, y **la
guarda de FR-010 y la migración viven ahí**.

**Target Platform**: las tres superficies del repo.

**Performance Goals**: leer quién recibió **no puede costar una consulta por
pedido** (research D3). La lista de admin ya está anotada como sin paginar.

**Constraints**: la app se usa con una mano, parado en una puerta. Entregar al
destinatario **son dos toques**, contados.

**Scale/Scope**: 1 migración, 2 endpoints tocados, 1 pantalla nueva en la app, 1
línea en la tarjeta web.

## Constitution Check

*GATE: pasa antes de Fase 0, y se re-evalúa después de Fase 1.*

- **Constitución**: **sin enmienda, y esta vez porque el documento ya lo
  previó.** Las *Scope boundaries* dicen que la cédula del destinatario salió del
  formulario web y que se captura **"en la app Android al entregar, si hace
  falta"**. Este feature es esa frase cumplida. Es la primera vez que una
  previsión defensiva del documento se cobra sola, y vale registrarlo.
  - Principio I (visual-first): el cliente aprobó la pantalla en la maqueta antes
    de que existiera.
  - Principio II (autoservicio): intacto. Esto no agrega nada al formulario del
    cliente — al contrario, es lo que permitió sacarle la cédula en `004`.
  - Principio III (YAGNI): decide D5 (no validar el formato de la cédula) y D3
    (una consulta, no un viaje por pedido).
  - Principio IV (mobile-first): es el que exige que el caso común sea un toque
    (D4).
  - Principio V (5.1.0): intacto. No hay precio ni zona en juego.
- **Plan-bounded change**: `covers:` nombra seis prefijos. **`web/app/` queda
  afuera**: la web solo cambia en la tarjeta y en el tipo.
- **Verified before done**: `verify:` con las tres patas, y research D6 nombra
  las dos trampas que este feature vuelve a pisar.

**Sin violaciones que justificar.**

## Project Structure

### Documentation (this feature)

```text
specs/016-quien-recibio/
├── plan.md
├── spec.md
├── research.md          # Fase 0 — seis decisiones
├── data-model.md        # Fase 1 — la migracion y lo que NO se toca
├── contracts/           # Fase 1 — las dos respuestas, que dejan de ser iguales
├── quickstart.md        # Fase 1
├── checklists/
└── tasks.md             # Fase 2
```

**Sí hay `contracts/` esta vez**, a diferencia de `014` y `015`: el contrato HTTP
cambia en tres lugares —lo que acepta el cambio de estado, y lo que devuelven las
dos listas, que dejan de ser la misma forma— y esa asimetría es justo lo que hay
que poder leer sin abrir el código.

### Source Code (repository root)

```text
backend/
├── migrations/0006_*.sql          # NUEVO — dos columnas nullable
└── internal/pedidos/
    ├── pedido.go                  # el tipo del cliente y el del admin
    └── handlers.go                # el cambio de estado acepta el receptor

android/                           # la hoja de "quien recibio"

web/
├── lib/api.ts                     # el tipo, sin el documento
└── components/pedido/tarjeta-pedido.tsx

SECURITY.md                        # FR-013 — es ancla de raiz, exenta del sensor
```

**Structure Decision**: tres superficies, la primera vez desde `012`.

## Fases

**Fase 0 — [research.md](research.md).** Seis decisiones: el corte entre las dos
respuestas y por qué lo seguro tiene que ser el default (D1), por qué la
migración va sobre `pedidos_estados` (D2), cómo se lee sin una consulta por
pedido (D3), de dónde sale el nombre propuesto (D4), por qué la cédula se guarda
como se escribe (D5), y el `verify:` con sus dos trampas (D6).

**Fase 1 — [data-model.md](data-model.md), [contracts/](contracts/),
[quickstart.md](quickstart.md).**

**Fase 2 — `tasks.md`.**

## El gate — 2026-08-30

Promovido a `active` por instruccion explicita de Mateo, con el informe de
`/speckit-analyze` leido: **cero criticos**, tres hallazgos, los tres aplicados.
El que valia: mover a `entrega` sin receptor pasa a devolver 400, y ninguna
tarea exigia que la app tuviera **un solo camino** hacia ese estado — una
regresion que no aparece hasta que alguien entrega de verdad.

## Lo que hay que aceptar, y se acepto al promover

**Este feature guarda el documento de identidad de personas que nunca
interactuaron con el sistema.** Susana le dio su cédula a Diego en la puerta, no
a nosotros. Eso no lo hace ilegítimo —es un respaldo de entrega razonable y el
cliente lo pidió por un motivo concreto— pero sí cambia lo que este repo
contiene, y por eso `SECURITY.md` entra en el alcance (FR-013).

**No es un dato público.** Se comparte muchísimo, que es distinto: en Uruguay es
dato personal bajo la Ley 18.331. El diseño elegido ya lo trata bien —no sale del
lado de Diego— y lo único que cambia es que el repo lo va a decir en vez de
suponerlo.

## Complexity Tracking

Vacío: el *Constitution Check* no encontró violaciones que justificar.
