---
ticket: none
status: draft
covers:
  # El formulario: pasa `conSesion` y `zona` al bloque del monto. NO nombra
  # precio en ninguna linea — la guarda de 013 lo sigue prohibiendo aca.
  - web/components/pedido-form.tsx
  # El contenedor que ya conoce la sesion (`useSesion`) y monta el formulario.
  - web/components/pedido/crear-pedido.tsx
  # EL UNICO archivo de app/ o components/ autorizado a nombrar un monto.
  - web/components/pedido/precio-de-zona.tsx
  # La decision de mostrar o no, pura y sin React: la unica parte de este
  # feature que puede tener prueba automatica en este repo.
  - web/lib/precio-visible.ts
  - web/lib/precio-visible.test.ts
  # La guarda de 013. Se REDEFINE, no se borra (FR-017).
  - web/lib/sin-precio-a-la-vista.test.ts
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  # Lo que quede sin correr del quickstart se anota, no se da por hecho.
  - docs/tech-debt-tracker.md
verify: cd web && npm run lint && npm test && npm run build
analyzed:
---

# Implementation Plan: El precio vuelve, del lado de adentro del login

**Branch**: `024-precio-detras-del-login` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/024-precio-detras-del-login/spec.md`

## Summary

Un cliente con sesión iniciada ve el monto de su zona **pegado al nombre de la
zona**, en el bloque de cobertura del formulario, y nadie más ve un monto en
ninguna parte. El monto se recalcula desde la zona de entrega; la columna
`precio` guardada no se lee.

El enfoque técnico cabe en cuatro movimientos, y ninguno toca el backend, la app
ni el dato:

1. `crear-pedido.tsx` —que ya conoce la sesión— le baja `conSesion: boolean` a
   `PedidoForm` por props, porque el formulario tiene **prohibido** importar el
   módulo de sesión.
2. La decisión "¿se muestra un monto?" se extrae a una función pura en `lib/`,
   que es el único lugar de este repo donde puede tener pruebas automáticas.
3. El render del monto vive en un componente nuevo de veinte líneas, que pasa a
   ser el único archivo de `app/` o `components/` exceptuado de la guarda de
   `013`.
4. Esa guarda se redefine para exceptuar esa ruta y solo esa, y se le suma que
   ese componente sea importado por exactamente un archivo.

Ver [research.md](research.md) para por qué cada uno es así y qué se descartó.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js (App Router, export
estático) — la versión exacta la gobierna `web/AGENTS.md`.

**Primary Dependencies**: ninguna nueva. El feature no agrega paquetes.

**Storage**: N/A. No hay migración, el cuerpo de `POST /pedidos` no cambia y la
columna `precio` no se lee.

**Testing**: vitest, `environment: "node"`, `include: ["lib/**/*.test.ts"]`.
**Nada en este repo renderiza React**, así que todo lo que sea comportamiento de
componente se verifica a mano en el quickstart.

**Target Platform**: navegador, móvil primero. Sitio exportado estático servido
en `https://flashurbano.uy`.

**Project Type**: web (solo la superficie `web/`; `backend/` y `android/` no se
tocan).

**Performance Goals**: N/A — no hay cómputo nuevo. `resolverZona` ya corre en
cada movimiento del pin y ya devuelve la zona con su precio adentro.

**Constraints**:
- El formulario MUST seguir funcionando con el servicio caído: el grafo de
  imports que arranca en `components/pedido-form.tsx` no puede llegar a
  `lib/api.ts` ni a `lib/sesion.ts` (`web/lib/cotizar-abierto.test.ts`).
- Ningún archivo de `app/` o `components/` puede nombrar un precio, salvo el
  único exceptuado (`web/lib/sin-precio-a-la-vista.test.ts`, redefinida).
- El monto solo junto al nombre de la zona: sin total, sin resumen previo, sin
  línea suelta (FR-007a).

**Scale/Scope**: un componente nuevo, un módulo puro nuevo, dos pruebas, y
props en dos archivos existentes. Es el feature más chico desde `019`.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después del diseño de Phase 1.*

Contra `.specify/memory/constitution.md` **6.0.0**, enmendada para este feature
el 2026-09-10 ([ADR price-behind-the-login](../../docs/decisions/price-behind-the-login.md)).

| Principio | Estado | Cómo lo honra este plan |
|---|---|---|
| I. Visual-first MVP | ✅ | Cambio visible en la pantalla de mayor tráfico, sin infraestructura nueva. |
| II. Self-service data entry | ✅ | No agrega fricción: el visitante sin cuenta sigue pudiendo completar todo el formulario hasta confirmar. |
| III. Simplicity over infrastructure | ✅ | Cero dependencias nuevas. Se rechazó explícitamente agregar jsdom y una librería de testing de React (research D3). |
| IV. Mobile-first, low-friction UI | ✅ | El monto se suma a un bloque que ya existe; no agrega pasos ni pantallas. El bloque no debe saltar de tamaño al aparecer el monto. |
| V. The site takes the order; the price is behind the login | ✅ | Es el principio que este feature implementa, en su forma 6.0.0. **Y lo que 6.0.0 NO levantó también se honra**: nada lee la columna `precio` guardada (FR-015), y ninguna superficie pública muestra monto (FR-008). |

**Plan-bounded change (harness)**: `covers:` nombra ocho rutas, siete de ellas
archivos concretos. No hay prefijos de directorio abiertos.

**Verified before done (harness)**: `verify:` es
`cd web && npm run lint && npm test && npm run build`. Solo la pata de web,
porque `backend/` y `android/` no se tocan — y por lo tanto **este verify no
tiene el problema del skip silencioso de Postgres**: no hay pruebas de base en
juego.

**Lo que `verify:` NO prueba, dicho antes de que sorprenda**: que el monto no se
vea sin sesión en un navegador de verdad, que no parpadee, y que aparezca al
entrar por el diálogo sin perder lo tipeado. Nada de eso es testeable en este
repo (research D3). Lo cubre [quickstart.md](quickstart.md), y **el plan no está
hecho hasta que el quickstart se corrió**.

### Re-evaluación post-diseño (Phase 1)

Sin violaciones nuevas. El diseño de Phase 1 **reduce** superficie en vez de
agregarla: el único archivo con permiso de nombrar un monto es más chico que la
excepción que cualquier alternativa habría necesitado. **Complexity Tracking
queda vacío a propósito.**

## Project Structure

### Documentation (this feature)

```text
specs/024-precio-detras-del-login/
├── plan.md              # Este archivo
├── spec.md              # Brief, cerrado con 4 clarificaciones
├── research.md          # Phase 0: las cuatro decisiones tecnicas
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: lo que ninguna prueba ve
├── contracts/
│   └── bloque-de-zona.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks — NO lo crea /speckit-plan
```

### Source Code (repository root)

```text
web/
├── components/
│   ├── pedido-form.tsx           # MODIFICADO: recibe `conSesion`, se lo pasa
│   │                             #   a ResultadoZona -> PrecioDeZona.
│   │                             #   NO nombra precio.
│   └── pedido/
│       ├── crear-pedido.tsx      # MODIFICADO: baja `conSesion` desde useSesion
│       └── precio-de-zona.tsx    # NUEVO: unico archivo autorizado a un monto
└── lib/
    ├── precio-visible.ts         # NUEVO: la decision, pura
    ├── precio-visible.test.ts    # NUEVO: tabla de casos + control positivo
    ├── sin-precio-a-la-vista.test.ts  # REDEFINIDA (FR-017)
    ├── cotizar-abierto.test.ts   # NO SE TOCA: tiene que seguir verde (FR-016)
    └── zonas.ts                  # NO SE TOCA: ya trae `precio` en cada zona
```

**Structure Decision**: solo `web/`. `backend/` y `android/` quedan fuera del
`covers:` a propósito: el dato ya viaja y ya se guarda desde `011`, y la app
nunca mostró montos (FR-019 es no-regresión, no trabajo).

## Complexity Tracking

Vacío. El Constitution Check no tiene violaciones que justificar.
