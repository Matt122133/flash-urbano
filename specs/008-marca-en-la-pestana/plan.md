---
ticket: none
status: active
covers:
  # El generador. Un script versionado, no un binario que alguien produjo una
  # vez en su maquina (FR-007). Se nombra el archivo, NO `web/design-source/`
  # entero: ese directorio contiene build-zonas.js, que genera el dato que
  # decide la plata, y no hay motivo para autorizarlo en un feature de iconos.
  - web/design-source/build-favicon.js
  # Como se corre y que produce.
  - web/design-source/README.md
  # Los iconos, por convencion de archivo de Next 16. Se nombran uno por uno:
  # `web/app/` entero arrastraria layout.tsx y todas las pantallas.
  - web/app/favicon.ico
  - web/app/icon.svg
  - web/app/apple-icon.png
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  #
  # NOTA DELIBERADA: `web/app/layout.tsx` NO esta cubierto y no hace falta.
  # Next resuelve estos tres archivos por convencion; se verifico que layout.tsx
  # no declara `icons:`, asi que no hay nada que editar. Si resultara que si
  # hace falta, es senal de que la convencion no aplica y hay que repensar, no
  # extender `covers:` de apuro.
  #
  # NOTA DELIBERADA: `web/public/logo-flash-urbano.png` NO esta cubierto. Es la
  # FUENTE y no se toca; que el sensor lo impida es la garantia.
# El `ls out` no es adorno: `npm run build` sin GITHUB_PAGES no hace el export,
# asi que un verde sin esa parte no dice nada sobre lo que se publica — que es
# justo lo que el feature promete (FR-006).
verify: cd web && npm run lint && npm test && GITHUB_PAGES=true npm run build && ls out | grep -qE '^favicon\.ico$' && ls out | grep -qE '^icon\.'
# 2026-08-12. IMPORTANTE, para que este campo no diga mas de lo que paso: el
# analisis fue INLINE, no via `/speckit-analyze`. Se verifico cobertura FR/SC,
# el parseo de `covers:` con el propio check_plan_coverage.py, y la
# trazabilidad de los 6 SC — eso encontro y cerro tres huecos (SC-001, SC-003
# y SC-005 sin cita explicita en tareas). El dueno del proyecto leyo ese
# reporte y aprobo la promocion explicitamente el 2026-08-12.
analyzed: 2026-08-12
---

# Implementation Plan: La marca en la pestaña

**Branch**: `marca-en-la-pestana` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-marca-en-la-pestana/spec.md`

## Summary

Reemplazar el logo de Vercel que quedó en `web/app/favicon.ico` desde el
2026-08-02 por el camión de Flash Urbano, blanco sobre el azul de marca, en los
tres formatos que hacen falta: SVG para las pestañas modernas, `.ico` para el
resto, y un PNG de 180 px para la pantalla de inicio de un teléfono.

Los tres se generan con un script versionado que recorta el camión del logo que
ya está en el repo. **No se dibuja un camión nuevo**: sería una marca parecida,
no la marca.

Este plan **no tiene `research.md` aparte**. Son tres decisiones y viven abajo,
que es donde [`docs/PLANS.md`](../../docs/PLANS.md) pide que se resuelva la
ambigüedad — "no se la delegues al lector". Tampoco tiene `data-model.md` ni
`contracts/`: no hay datos ni interfaces.

## Technical Context

**Language/Version**: Node (script de build), TypeScript/Next 16.2.12 (el sitio,
que no se toca).

**Primary Dependencies**: `sharp` 0.35.3, **ya instalado** y ya usado por
`web/design-source/make-logo-transparent.js`. Ninguna dependencia nueva.

**Storage**: N/A.

**Testing**: El `verify:` prueba que los archivos lleguen al export. **Lo que
importa de verdad es visual y se hace a mano** — ver [quickstart.md](quickstart.md).

**Target Platform**: Export estático en GitHub Pages, servido en
`https://flashurbano.uy`.

**Project Type**: Web, sólo la superficie del sitio.

**Constraints**: El icono tiene que funcionar a **16×16**, que es donde casi
cualquier marca deja de leerse.

**Scale/Scope**: Tres archivos generados y un script.

## Constitution Check

| Principio | Cómo queda |
|---|---|
| **I — Visual-first** | El feature es literalmente visual y se ve en cinco segundos |
| **II — Self-service** | No lo toca |
| **III — Simplicidad (YAGNI)** | Sin dependencias nuevas, sin tocar pantallas, sin Open Graph. Tres archivos |
| **IV — Mobile-first** | `apple-icon.png` existe por esto: los clientes entran del teléfono |
| **V — El sitio cotiza** | No lo toca. `build-zonas.js` queda deliberadamente fuera de `covers:` |

**Plan-bounded change**: seis prefijos, todos nombrados archivo por archivo. Dos
exclusiones deliberadas con motivo escrito.

**Verified before done**: el `verify:` corre el export real y comprueba que los
iconos estén. **No alcanza**: que el archivo exista no es que se lea a 16 px.
Eso lo cubren las verificaciones manuales.

## Las tres decisiones

### D1 — Recortar el camión del logo, no dibujar uno

FR-004 lo pide y el motivo es que un camión dibujado a ojo es *una marca
parecida*, que es peor que ninguna. El recorte es
**`x 430–599, y 5–168`** del logo de 600×245 — medido, no estimado: a la
izquierda de x=430 empiezan las líneas naranjas de velocidad, debajo de y=168
están la barra naranja y el texto "LOGÍSTICA Y TRANSPORTE".

Son **170×164**, casi cuadrado, así que entra en un icono cuadrado sin
deformarse.

**El riesgo real, y qué se hace si aparece**: a 16×16 un recorte fotográfico se
puede volver una mancha. La tarea de verificación **mira el archivo al tamaño
real**; si no se lee, la salida es simplificar el camión —engrosar la silueta,
sacar detalle interno— y **no** bajar la vara. Es un punto de decisión
declarado, no una esperanza.

### D2 — Camión blanco sobre cuadrado redondeado azul `#032F9A`

Un camión blanco sobre transparente —lo que se pidió literalmente— **desaparece
en las pestañas de tema claro**, que es el default de Windows y de Chrome. El
azul lo hace visible en los dos temas y es el fondo sobre el que el logo fue
dibujado.

El azul es `#032F9A`, **medido** sobre el propio logo: es el azul exacto más
frecuente del archivo. No un azul "parecido" elegido a ojo.

Un efecto secundario que sale gratis: el logo tiene fondo transparente y las
contraformas internas del camión —ventana, huecos de rueda— también quedaron
transparentes (43 % del recorte). Al ponerlo sobre azul, **ese azul vuelve a
asomar exactamente por donde asomaba en el logo original**. Se restaura la
composición en vez de aproximarla.

### D3 — Tres archivos por convención de Next, sin tocar `layout.tsx`

| Archivo | Para qué |
|---|---|
| `app/icon.svg` | Pestañas modernas. Nítido a cualquier tamaño y pesa poco |
| `app/favicon.ico` | El resto, y el `/favicon.ico` que los navegadores piden solos. Reemplaza al de Vercel |
| `app/apple-icon.png` (180×180) | Pantalla de inicio de iOS (FR-005) |

Next 16 los resuelve por convención de archivo. Se verificó que
`app/layout.tsx` **no** declara `icons:`, así que no hay nada que editar — por
eso no está en `covers:`.

**El SVG no lleva el camión vectorizado**: lleva el recorte embebido como PNG en
un `<image>` sobre el rectángulo azul. Vectorizar un raster automáticamente
produce curvas sucias, y hacerlo a mano es dibujar un camión nuevo, que es lo
que D1 descarta.

## Project Structure

```text
web/
├── app/
│   ├── favicon.ico      # REEMPLAZADO (hoy es el logo de Vercel)
│   ├── icon.svg         # NUEVO
│   └── apple-icon.png   # NUEVO
├── design-source/
│   ├── build-favicon.js # NUEVO — el generador
│   └── README.md        # + cómo se corre
└── public/
    └── logo-flash-urbano.png   # la fuente, NO se toca
```

**Structure Decision**: se sigue el patrón que el repo ya tiene — el generador
en `design-source/`, el artefacto generado versionado junto al código que lo
usa. Es exactamente cómo conviven `build-zonas.js` y `lib/zonas.ts`.

## Cómo se ejecuta

1. **Leer** `app-icons.md` de los docs de Next que están en `node_modules`,
   como manda `web/AGENTS.md`. Esta versión de Next tiene cambios que rompen, y
   la convención de iconos es justo el tipo de cosa que cambió.
2. **Escribir el generador** y correrlo.
3. **Mirar el resultado a 16×16.** Si no se lee, simplificar (D1).
4. **Verificar en navegador**, en ventana privada — el favicon se cachea con
   ganas y "comprobar" el icono viejo es el error clásico acá.

## Complexity Tracking

Sin violaciones que justificar.

## Cierre — 2026-08-12

`verify:` verde, incluido el export real. Los tres iconos llegan a `out/` y el
`<head>` publicado trae los tres `<link>`. Lint limpio, 99 pruebas.

**Lo que cambió respecto del plan, y por qué.** El punto de decisión de D1 se
activó: el primer render a 16 px no pasaba —las líneas naranjas de velocidad se
comían el tercio izquierdo en puro ruido— así que los tamaños ≤ 24 px usan una
segunda región de recorte desde `x=449`, sin líneas. Además el `icon.svg` pesaba
**204 kB**, que lo descarga todo el que entra al sitio; con el raster embebido
limitado a 200 px y paleta de 64 colores quedó en **5,8 kB**, indistinguible al
ojo del `apple-icon.png` renderizado al lado.

**Lo que quedó SIN verificar.** Se escribe acá y no se tilda, porque un criterio
sin comprobar que nadie nombra es un criterio que se da por bueno:

- **SC-003** — el ícono en la pantalla de inicio de un teléfono. T008 diferida.
  El `apple-icon.png` sale del mismo compuesto que sí se verificó renderizado,
  así que el riesgo es bajo, pero **bajo no es cero y no es lo mismo que
  comprobado**.
- **El sitio publicado** — T015 es posterior al merge por construcción: verifica
  el despliegue, y el despliegue ocurre al mergear. No puede condicionar este
  cierre, y por eso el plan se cierra con ese chequeo pendiente y con dueño.
- **SC-001, con una precisión.** Verificado por el dueño del proyecto contra el
  dev server: se ve bien en tema claro y oscuro. **No quedó constancia de las
  dos mitades de navegador por separado** — el caso que la decisión D2 existía
  para cubrir, el tema claro, sí está confirmado.

Estas dos verificaciones pendientes **no van al tracker a propósito**, y la
razón es de merge y no de criterio: la rama de `007` ya suma cuatro filas arriba
de la misma tabla, y agregar otra desde acá garantiza un conflicto al mergear la
segunda. Siendo las dos de riesgo bajo y estando escritas en un artefacto
versionado que `docs/README.md` enlaza, se prefirió no cambiar ruido en el
tracker por un conflicto seguro. Decisión tomada con el dueño del proyecto el
2026-08-12.
