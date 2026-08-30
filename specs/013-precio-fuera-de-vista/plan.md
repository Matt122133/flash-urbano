---
ticket: none
status: completed
covers:
  # Las once pantallas y componentes donde el precio se ve o se nombra.
  # Ver research.md D1 para el inventario archivo por archivo.
  - web/app/
  - web/components/
  # `lib/zonas.ts` se REGENERA (no se edita), `lib/repetir.ts` pierde la
  # comparacion de precios, y la guarda nueva de FR-020 vive en `lib/` porque
  # es el unico lugar desde donde vitest recoge pruebas. Ver research.md D2, D3.
  - web/lib/
  # El KML que el cliente reajusto, y el README que explica como se regenera.
  - web/design-source/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  # La enmienda del Principio V a 5.0.0. Va en `covers:` porque es parte de este
  # feature —el spec la nombra en Dependencias— y porque el sensor NO exime
  # `.specify/`: sin esto el commit rebota. El ADR que la respalda vive en
  # `docs/`, que si esta exento.
  #
  # Ojo con el orden: la enmienda se ESCRIBIO antes que el plan, como exige el
  # gobierno cuando una decision revierte un principio. Que ademas quede
  # cubierta por el plan no invierte eso; solo lo deja commitear.
  - .specify/memory/constitution.md
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-30
---

# Implementation Plan: El precio sale de la vista, y el sábado se coordina

**Branch**: `013-precio-fuera-de-vista` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-precio-fuera-de-vista/spec.md`

## Summary

Sacar el precio de las once pantallas y componentes donde hoy se ve o se nombra,
sin tocar el dato: se sigue calculando, se sigue mandando y se sigue guardando.
El mapa de zonas se queda y cambia de sentido —deja de ser una tabla de precios
y pasa a decir dónde se trabaja—, la zona sigue siendo la puerta que decide si
el pedido entra, y donde estaba el monto queda la confirmación de cobertura con
el nombre de la zona. Aparte, dos cosas chicas: el sábado pasa a *a coordinar*, y
`lib/zonas.ts` se regenera del KML que el cliente reajustó.

**El riesgo real de este feature no es técnico, es de omisión.** No hay
algoritmo nuevo ni dato nuevo; hay once lugares y basta olvidar uno para que el
sitio siga prometiendo lo que ya no hace. Por eso el control central es una
prueba automática que lee el fuente y falla si vuelve a aparecer un monto
(FR-020), y no la lectura cuidadosa de un diff.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 (App Router, export
estático). Sin cambios de versión.

**Primary Dependencies**: Next.js, Tailwind, Leaflet (a través de
`mapa-zonas.tsx`). Ninguna se agrega ni se quita.

**Storage**: N/A para este feature. Postgres sigue guardando `precio` y
`zona_id` sin ninguna migración — es un requisito (FR-015), no una omisión.

**Testing**: vitest, `environment: node`, `include: ["lib/**/*.test.ts"]`. Sin
DOM y sin pruebas de componentes; ver research.md D2 por qué eso determina dónde
vive la guarda nueva.

**Target Platform**: navegador, mayoría móvil. Sitio estático servido en
`https://flashurbano.uy`.

**Project Type**: web, superficie `web/` únicamente. `backend/` y `android/` no
se tocan.

**Performance Goals**: sin objetivos nuevos. El cambio quita render, no lo
agrega.

**Constraints**: el formulario tiene que seguir cargando y funcionando con el
servicio caído hasta el momento de confirmar (FR-019), guardado por
`lib/cotizar-abierto.test.ts`.

**Scale/Scope**: 11 archivos de UI, 1 módulo generado, 2 archivos de prueba
tocados y 1 nuevo.

## Constitution Check

*GATE: pasa antes de Fase 0, y se re-evalúa después de Fase 1.*

- **Constitución (documento supremo)**: este plan es lo que la versión **5.0.0**
  del Principio V obliga a hacer. La enmienda y su
  [ADR price-not-shown](../../docs/decisions/price-not-shown.md) **ya están
  escritos y aceptados**, antes de este plan y no después, que es el orden que
  el gobierno exige cuando una decisión revierte un principio. Sin esa enmienda
  este plan estaría en violación directa del texto vigente.
  - Principio I (visual-first): el cambio es enteramente visible y el cliente lo
    puede mirar el mismo día.
  - Principio II (autoservicio es el valor): el formulario no pierde ni un
    campo ni gana fricción. Lo que pierde está del lado de la recompensa, y la
    constitución lo registra como riesgo asumido por el cliente.
  - Principio III (YAGNI): no entra infraestructura. La guarda de FR-020 reusa
    la técnica de lectura de fuente que `cotizar-abierto.test.ts` ya sostiene,
    en vez de traer un entorno de pruebas de UI.
  - Principio IV (mobile-first): se quitan elementos de pantallas chicas.
  - Principio V (5.0.0): es el principio que este plan implementa.
- **Plan-bounded change**: `covers:` nombra los cinco prefijos, y cada uno tiene
  escrito al lado por qué está.
- **Verified before done**: `verify:` corre las tres cosas que pueden romperse
  en `web/` — lint, pruebas y build. Su alcance y **lo que deliberadamente no
  cubre** están argumentados en research.md D6.

**Sin violaciones que justificar.** La sección *Complexity Tracking* queda
vacía a propósito.

## Project Structure

### Documentation (this feature)

```text
specs/013-precio-fuera-de-vista/
├── plan.md              # este archivo
├── spec.md
├── research.md          # Fase 0 — siete decisiones con su alternativa
├── data-model.md        # Fase 1 — lo que NO cambia, que acá es el punto
├── quickstart.md        # Fase 1 — lo que solo se comprueba a mano
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 — lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
web/
├── app/
│   ├── page.tsx                        # CTA "Ver zonas y precios"
│   ├── pedido/page.tsx                 # copy que promete precio al instante
│   └── sobre-nosotros/page.tsx         # el sábado
├── components/
│   ├── pedido-form.tsx                 # bloque de precio, resumen, aviso, copy
│   ├── mapa-zonas.tsx                  # el globo de cada polígono
│   ├── mapa-zonas-seccion.tsx          # leyenda y textos de la sección
│   ├── bloque-direccion.tsx            # error que apela al precio
│   └── pedido/
│       ├── crear-pedido.tsx            # avisos de reajuste
│       └── tarjeta-pedido.tsx          # el monto cobrado
├── lib/
│   ├── zonas.ts                        # GENERADO — se regenera, no se edita
│   ├── repetir.ts                      # pierde la comparación de precios
│   ├── repetir.test.ts                 # y sus casos
│   ├── cotizar-abierto.test.ts         # se queda, con el motivo reescrito
│   └── sin-precio-a-la-vista.test.ts   # NUEVO — la guarda de FR-020
└── design-source/
    ├── zonas-flash-urbano.kml          # ya modificado por el cliente
    └── README.md                       # qué dice ahora la sección de zonas

backend/    # NO SE TOCA
android/    # NO SE TOCA
```

**Structure Decision**: superficie única `web/`. Es la primera vez desde `011`
que un feature se queda en una sola de las tres, y es lo que permite un
`verify:` corto; research.md D6 argumenta por qué eso es honesto y qué deja
afuera.

## Fases

**Fase 0 — [research.md](research.md).** Siete decisiones: el inventario de los
once lugares (D1), dónde vive la guarda y por qué no puede ser una prueba de UI
(D2), qué queda de `repetir.ts` (D3), el sábado (D4), la regeneración del KML y
**la Zona 5, cuya pregunta abierta se cerró en el gate** (D5), el alcance de
`verify:` (D6), y
por qué la guarda de cotizar sobrevive a su propio motivo (D7).

**Fase 1 — [data-model.md](data-model.md) y [quickstart.md](quickstart.md).** No
hay `contracts/`: el contrato HTTP **no cambia**, y escribir un contrato
idéntico al vigente para documentar que no cambió sería ruido. Lo que sí hay que
demostrar —que el pedido sigue llegando con su `cobro` y se sigue guardando— es
una comprobación manual y vive en el quickstart.

**Fase 2 — `tasks.md`.** La escribe `/speckit-tasks`.

## El gate — 2026-08-30

Promovido a `active` por instrucción explícita de Mateo, con las dos condiciones
que este plan puso como previas ya resueltas:

1. **La Zona 5.** research.md D5. Respondida: el polígono estaba mal dibujado y
   el KML nuevo lo corrige hacia las calles que ya estaban escritas. `specs/002`
   sigue siendo la autoridad y no se toca. **Sin deuda.**
2. **La rama.** Resuelta: `app-repartidor` ya estaba mergeada desde el
   2026-08-26 (PR #22) —lo que parecía trabajo pendiente era un `master` local
   atrasado 54 commits— y su cierre entró por el PR #23. `013` sale limpia de
   `master`.

**El informe de `/speckit-analyze` se leyó antes de promover**: cinco hallazgos,
**cero críticos**, los cinco corregidos sobre los artefactos en borrador. El de
más peso encontró que la guarda de FR-020 se evadía sola —un helper en `lib/`,
que la guarda no puede escanear, llamado desde un componente— y por eso hoy
prohíbe el token y no solo el acceso a la propiedad.

## Complexity Tracking

Vacío: el *Constitution Check* no encontró violaciones que justificar.


---

## Cierre — 2026-08-30

`status: completed`, para dejar entrar a `014`. Lo que se verificó y lo que
**no**, sin maquillar:

**Verificado**: `verify:` verde (lint limpio, 175 pruebas, build OK); la guarda
de FR-020 **rota a propósito** y vista en rojo nombrando el archivo; y el export
estático real (`GITHUB_PAGES=true`) grepeado sobre el HTML publicado — ninguna
frase de precio, ningún monto, y el sábado diciendo *A coordinar*.

**NO verificado, y no se tilda**:

- **T026 — nivel 1 del quickstart.** Nada de esto se vio en un navegador. Las
  ocho pantallas, el bloqueo fuera de zona, el mapa y el formulario con el
  servicio caído siguen sin mirarse.
- **T027 — nivel 2.** Que el pedido siga llegando con su `cobro` y se siga
  guardando (FR-015) no lo puede tocar `verify:`, y no se corrió contra Postgres.
  **Es el requisito con menos respaldo de todo el feature.**
- **T029 — que Diego lo mire.** El criterio del feature era suyo.

Las tres son verificación de trabajo entregado, no deuda técnica, así que **no
van al tracker**: quedan acá, en el plan del feature que las dejó sin correr, que
es donde alguien las va a buscar. Si al mirarlas aparece un defecto, es de `013`
y se arregla como tal.

**Lo que este feature enseñó y conviene no perder**: el inventario manual de
"dónde se muestra el precio" contó once lugares y eran trece. La guarda
automática, escrita **antes** de tocar una pantalla, encontró los dos que
faltaban en su primera corrida. En un cambio cuyo riesgo es la omisión, el
control tiene que existir antes que el trabajo — no después, como comprobación.
