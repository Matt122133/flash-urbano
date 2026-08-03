---
ticket: none
status: active
covers:
  - web/lib/
  - web/components/
  - web/app/sobre-nosotros/
  - web/app/pedido/
  - web/design-source/
  - web/public/mapa-zonas-flash-urbano.jpeg
  - web/package.json
  - web/package-lock.json
  - web/vitest.config.ts
  # Fase Decide: la enmienda 2.0.0 del Principio V que autoriza este feature,
  # y el bookkeeping con que spec-kit resuelve el feature activo. Se agregaron
  # al detectarlos el sensor de cobertura antes del primer commit.
  - .specify/memory/constitution.md
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-02
---

# Implementation Plan: Mapa de zonas con precio automático por ubicación

**Feature dir**: `specs/002-mapa-zonas-precio` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-mapa-zonas-precio/spec.md`

> **Rama git**: `upgrade-zonas`, creada desde `master` el 2026-08-02. El
> `BRANCH` que reporta spec-kit sale de `.specify/feature.json`, no de git, así
> que los dos nombres no coinciden y está bien.

## Summary

Las cinco zonas de reparto dejan de ser una imagen y pasan a ser geometría
consultable dentro del bundle. Con eso, `/sobre-nosotros` muestra un mapa
navegable en vez de un JPEG, y el formulario de pedido gana un mapa donde el
cliente marca **dónde hay que retirar el paquete**: al soltar el marcador el
sitio resuelve la zona con un test punto-en-polígono y muestra el precio en
firme de esa zona. Se agrega además el domicilio de entrega, que hasta ahora
no se capturaba en ningún lado.

Enfoque técnico: convertir el KML del cliente a un módulo TypeScript versionado
(no un `fetch` en runtime, así el cálculo del precio no depende de la red),
renderizar con Leaflet sobre mosaicos de OpenStreetMap dentro de un único
componente cliente cargado con `ssr: false`, y resolver la zona con ray casting
propio. El precio es plata, así que la resolución de zona lleva tests unitarios
— la única pieza del repo que los va a tener.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.4, Node ≥20

**Primary Dependencies**: Next.js 16.2.12 (App Router), Tailwind 4. Se agrega
`leaflet` (runtime) y `@types/leaflet` + `vitest` (dev). Sin `react-leaflet`:
son dos componentes, y una capa de binding extra no se paga sola.

**Storage**: N/A — sin persistencia, igual que el milestone 001. Los datos de
zona viven como módulo TS versionado en `web/lib/`.

**Testing**: Vitest, acotado a la resolución de zona y precio
(`web/lib/zona-lookup.test.ts`). No se testea UI en este plan.

**Target Platform**: Navegadores modernos, mobile-first (viewport mínimo
375px). Deploy como export estático a GitHub Pages bajo `basePath`
`/flash-urbano` cuando `GITHUB_PAGES=true`.

**Project Type**: Web app single-project (`web/`), sin backend.

**Performance Goals**: SC-001 — precio visible en menos de 15s desde que el
cliente llega al mapa. El costo real es la descarga de mosaicos; la resolución
de zona es despreciable (5 polígonos, ≤125 vértices).

**Constraints**: Sin backend y sin claves de API — el sitio es estático, así que
cualquier credencial quedaría en el bundle. Sin geocodificación. Los datos de
zona deben estar en el bundle, no detrás de un `fetch`, para que el precio no
dependa de la red. Leaflet toca `window` al importarse: obliga a componente
cliente con `ssr: false`.

**Scale/Scope**: 5 polígonos (24–125 vértices), ~40KB de coordenadas en el
bundle. Dos superficies tocadas, un componente de mapa reutilizado en ambas.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después de Phase 1.*

| Principio | Estado | Nota |
|---|---|---|
| I. Visual-first MVP | ✅ | Es una porción demostrable de punta a punta; se le muestra a Diego y reacciona. |
| II. Self-service es el valor | ✅ | Elimina el ida y vuelta de WhatsApp para saber el precio, que es el corazón del principio. |
| III. Simplicity / YAGNI | ⚠️ | Agrega dos dependencias. Justificado en Complexity Tracking. |
| IV. Mobile-first, baja fricción | ✅ | FR-019 y SC-006 lo exigen; el gesto del mapa se verifica a mano en 375px. |
| V. El sitio cotiza; logística manual | ✅ | Este plan *es* la implementación del principio en su forma enmendada (2.0.0). Nada de capacidad, aceptación ni ruteo. |

- **Plan-bounded change (harness)**: `covers:` nombra los prefijos que este
  feature toca, incluida la imagen que se borra (los deletes también necesitan
  cobertura).
- **Verified before done (harness)**: `verify:` corre lint, tests y build.
  `npm test` no existe todavía — lo agrega este plan junto con Vitest.

**Aviso de sensor**: correr
`python3 scripts/harness/check_plan_coverage.py --doctor` antes de commitear.
Si devuelve `UNWIRED`, `covers:` es convención y no control — ver
`docs/HARNESS-TODO.md`.

## Project Structure

### Documentation (this feature)

```text
specs/002-mapa-zonas-precio/
├── plan.md              # Este archivo
├── spec.md
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── zonas.md         # Contrato del módulo de zonas y del componente de mapa
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — lo genera /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
web/
├── lib/
│   ├── asset.ts                  # existente, sin cambios
│   ├── zonas.ts                  # NUEVO — generado: polígonos + precios (dato)
│   ├── zona-lookup.ts            # NUEVO — punto-en-polígono y resolución (lógica)
│   └── zona-lookup.test.ts       # NUEVO — tests de resolución y precio
├── components/
│   ├── mapa-zonas.tsx            # NUEVO — el mapa Leaflet (client, sin SSR)
│   ├── mapa-zonas-dinamico.tsx   # NUEVO — wrapper dynamic(ssr:false)
│   ├── pedido-form.tsx           # MODIFICADO — retiro con mapa, precio, destino
│   ├── nav-bar.tsx               # sin cambios
│   └── footer.tsx                # sin cambios
├── app/
│   ├── sobre-nosotros/page.tsx   # MODIFICADO — el mapa reemplaza al <Image>
│   └── pedido/page.tsx           # MODIFICADO — copy, si hace falta
├── design-source/
│   ├── zonas-flash-urbano.kml    # existente — fuente del cliente
│   ├── mapa-costos-original.jpeg # existente — SE CONSERVA (FR-025)
│   ├── build-zonas.js            # NUEVO — KML → lib/zonas.ts
│   ├── build-map.js              # SE BORRA — generaba el JPEG que ya no se usa
│   └── README.md                 # MODIFICADO
├── public/
│   └── mapa-zonas-flash-urbano.jpeg  # SE BORRA
├── package.json                  # MODIFICADO — leaflet, vitest, script `test`
└── vitest.config.ts              # NUEVO
```

**Structure Decision**: se mantiene el patrón que ya fija `ARCHITECTURE.md` —
proyecto único bajo `web/`, componentes compartidos planos en `web/components/`,
sin split por feature. La única estructura nueva es la separación **dato /
lógica** dentro de `web/lib/`: `zonas.ts` es generado y no se edita a mano,
`zona-lookup.ts` es código escrito. Mantenerlos aparte permite regenerar los
polígonos cuando el cliente corrija un límite sin tocar la lógica ni sus tests.

## Enfoque de implementación

### 1. El dato de zona

`web/design-source/build-zonas.js` lee el KML, normaliza los nombres (FR-003:
"Zona&nbsp;&nbsp;4" trae un espacio duro), asocia cada zona a su precio y emite
`web/lib/zonas.ts` como módulo TypeScript tipado. **Se emite código, no JSON, y
se commitea**: importar el módulo lo mete en el bundle, así el cálculo del
precio no depende de una request. Un `fetch` a `public/` funcionaría, pero
ataría la plata a la red sin necesidad.

El script vive junto al KML y se documenta en el README de `design-source/`,
igual que hoy se documenta `build-map.js` — que se borra en el mismo paso,
porque genera un JPEG que deja de mostrarse.

### 2. La resolución de zona

`web/lib/zona-lookup.ts` expone `resolverZona(lat, lng)`, que devuelve la zona
y su precio, o `null` si el punto cae fuera de las cinco. Ray casting clásico;
no entra ninguna librería de geometría para 5 polígonos.

**Determinismo (FR-018)**: los polígonos comparten bordes, así que un punto
sobre un límite puede satisfacer a dos. La regla de desempate es fija y
documentada: **se evalúan las zonas en orden 1→5 y gana la primera que contenga
el punto**. No es "la correcta" — sobre un borde compartido no existe una
correcta — pero es la misma siempre, que es lo que el requisito pide.

Es la única pieza con tests: casos dentro de cada zona, casos fuera (el río,
más allá de la cobertura), y un caso sobre un borde compartido verificando que
dos llamadas seguidas dan lo mismo. El precio es en firme; un error acá es
plata.

### 3. El mapa

`web/components/mapa-zonas.tsx` es un componente cliente que monta Leaflet
sobre un `<div>` y dibuja los cinco polígonos desde `lib/zonas.ts`. Un solo
componente sirve a los dos usos, con una prop que decide si acepta marcado de
punto (formulario) o es solo lectura (`/sobre-nosotros`).

Leaflet toca `window` al importarse, así que no puede prerenderizarse. Se carga
desde `mapa-zonas-dinamico.tsx` con `next/dynamic` y `ssr: false` — y ese
wrapper **tiene que ser un Client Component**, porque la doc de Next 16
(`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`) dice que
`ssr: false` solo aplica ahí.

Decisiones que evitan trampas conocidas, detalladas en `research.md`: marcador
como `divIcon` en vez de la imagen por defecto de Leaflet (que se rompe bajo
`basePath` en el export estático), y `scrollWheelZoom` apagado para no
secuestrar el scroll de la página (FR-019).

### 4. Falla de los mosaicos (FR-020)

Leaflet emite `tileerror`. El componente cuenta cargas y errores: si hay al
menos un error y ninguna carga exitosa cuando termina de asentarse la vista
inicial, marca la fuente como no disponible. En el formulario eso muestra el
aviso y **bloquea el envío**, derivando a contacto. En `/sobre-nosotros` no
bloquea nada: degrada a la lista de zonas y precios en texto.

### 5. El formulario

`pedido-form.tsx` gana tres cosas: el mapa de retiro con su precio, el bloque
de domicilio de entrega (US4), y el rotulado explícito de la dirección
existente como **de retiro**. La validación existente se extiende para exigir
punto marcado con zona resuelta (FR-011) y los campos de destino (FR-023). La
pantalla de confirmación suma zona y precio (FR-017) y separa los dos
domicilios.

## Complexity Tracking

> El Constitution Check marca ⚠️ en el Principio III. Ambas dependencias se
> justifican acá.

| Violación | Por qué hace falta | Alternativa más simple, y por qué se rechaza |
|---|---|---|
| Dependencia runtime `leaflet` | Un mapa navegable con calles reales, zoom y marcado de punto sobre mosaicos externos. El spec lo fija como decisión tomada (§ Assumptions). | Dibujar los polígonos en SVG propio, sin librería: se rechazó al elegir el render, porque sin calles de fondo el cliente no puede ubicar su casa — y el precio depende de que la ubique bien. |
| Dependencia dev `vitest` | La resolución de zona decide cuánto se le cobra a una persona. Es la primera lógica del repo con consecuencia monetaria, y verificarla a ojo no escala a 5 polígonos y 400+ vértices. | Verificación manual, como el resto del repo: se rechaza porque un borde mal resuelto no se ve mirando la pantalla, se ve en la factura. También se consideró `node:test`, descartado por la fricción de correr TypeScript sin transpilar. |

Notar que el spec asumía "sin dependencias más allá de la librería de mapas".
Vitest es dev-only y no llega al bundle, así que no contradice la intención
(peso y superficie de lo que se sirve), pero **sí** amplía lo que el spec dijo.
Queda declarado acá en vez de colado.

## Fuera de alcance de este plan

- Geocodificación de direcciones escritas.
- Persistencia de pedidos.
- Validar que el domicilio de entrega exista o esté dentro de cobertura
  (FR-024 lo prohíbe explícitamente).
- Tests de UI o end-to-end.
- Arreglar el bug preexistente de `errors.receiverName` en `pedido-form.tsx`
  (el mensaje de error del nombre de quien recibe nunca aparece, porque
  `validate()` escribe `recieverName` y el render lee `receiverName`).
  Registrado en `docs/tech-debt-tracker.md`; **no se toca acá** aunque el
  archivo esté en `covers:`, porque no es parte de los pasos de este plan.
