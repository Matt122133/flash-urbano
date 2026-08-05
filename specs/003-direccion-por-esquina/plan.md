---
ticket: none
status: completed
covers:
  - web/lib/
  - web/components/
  - web/app/pedido/
  - web/app/sobre-nosotros/
  # Ediciones a mano del dueño del repo durante la ejecución: el email real de
  # contacto y un par de retoques de copy que el cliente pidió. Fuera del
  # feature, pero se suman acá para no partir el commit en dos.
  - web/app/contacto/
  - web/app/page.tsx
  - web/design-source/
  - web/public/
  - web/package.json
  - web/package-lock.json
  # spec-kit escribe acá cuál es el feature activo; el sensor de cobertura lo
  # ve como edición igual que cualquier otra. Mismo caso que en 002.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-08-04
---

# Implementation Plan: Dirección por cruce de calles en el formulario de pedido

**Feature dir**: `specs/003-direccion-por-esquina` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-direccion-por-esquina/spec.md`

> **Rama git**: se crea desde `master` al empezar a ejecutar. El `BRANCH` que
> reporta spec-kit sale de `.specify/feature.json`, no de git, así que los dos
> nombres pueden no coincidir — es lo mismo que pasó en `002`.

## Summary

La dirección de retiro deja de ser texto suelto y pasa a resolverse contra un
índice de calles de Montevideo versionado en el repo. El cliente escribe calle
y esquina con autocompletado; el sitio calcula el cruce, muestra el mapa debajo
con el punto ya colocado, y de ahí sale la zona y el precio. El pin se puede
arrastrar, pero sólo dentro de las cuadras que tocan esa esquina, y cada
movimiento recalcula el precio a la vista.

El índice se genera fuera de línea con un script (20.884 esquinas, 0,47 MB
comprimido) y se sirve como archivo estático, no dentro del bundle. Es el mismo
patrón con que `002` convirtió el KML del cliente en `web/lib/zonas.ts`:
**dato generado, versionado, regenerable, nunca editado a mano**.

De paso se paga la deuda `High` del apilado del mapa, porque este feature
despliega listas de sugerencias justo encima de él.

## Technical Context

**Language/Version**: TypeScript 5 sobre Next.js 16.2.12 (App Router), React
19.2.4. El script de build es JavaScript de Node sin dependencias, como
`web/design-source/build-zonas.js`.

**Primary Dependencies**: las que ya hay — `leaflet` 1.9.4 para el mapa. **No
se agrega ninguna** (ver research R8).

**Storage**: ninguna. El índice es un archivo estático en `web/public/`; el
estado del formulario vive en memoria. Sin backend y sin base de datos, por
decisión explícita del dueño del repo.

**Testing**: Vitest 4 (`npm test`). Hoy el único módulo con pruebas es
`web/lib/zona-lookup.ts`; este feature agrega el segundo, por la misma razón:
es de los que deciden la plata.

**Target Platform**: navegadores de teléfono en primer lugar (Principio IV).
Se publica como sitio estático en GitHub Pages bajo el `basePath`
`/flash-urbano`.

**Project Type**: aplicación web de una sola superficie (`web/`).

**Performance Goals**: sugerencias en menos de 300 ms desde que se deja de
tipear (SC-006); el índice no supera 1 MB comprimido (SC-007, medido en
0,47 MB ya con las cuadras).

**Constraints**: sitio estático sin servidor — nada puede depender de cómputo
en el servidor. El índice se carga bajo demanda, no al abrir el sitio.

**Scale/Scope**: 5.746 nombres de calle y 20.884 esquinas en el área de
servicio. Un operador, decenas de pedidos por día.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después del diseño de Phase 1.*

**Principio I (visual-first)**: el feature entrega algo que el cliente ve y
prueba en el formulario, que es la superficie de mayor prioridad. Las historias
están ordenadas para que cada una sea demostrable sola. **Pasa.**

**Principio II (autogestión es el valor)**: el feature existe para que cargar
una dirección sea más rápido y menos ambiguo. **Pasa.**

**Principio III (simplicidad sobre infraestructura)**: sin backend, sin base de
datos, sin servicios externos, sin dependencias nuevas. El índice es un archivo.
**Pasa.**

**Principio IV (mobile-first, poco tipeo)**: se pasa de tres campos escritos
más una interacción con el mapa, a dos campos con autocompletado. **Pasa.**

**Principio V (el sitio cotiza; nunca adivinar una zona)**: es el principio con
más superficie de contacto y merece detalle.

- El precio sigue saliendo del punto de retiro y de ningún otro lado (FR-020).
- Un cruce fuera de las cinco zonas no produce precio ni pedido (FR-019).
- Ante ambigüedad no se elige por el cliente: se muestran los candidatos y se
  exige elección (FR-021). Elegir el primero sería adivinar una zona.
- La geometría **no se fusiona por nombre canónico** (research R3), porque eso
  fabricaría esquinas entre calles homónimas que nunca se tocan, y una esquina
  inventada es un precio inventado.
- **Punto de fricción declarado**: las esquinas que caen sobre la avenida que
  separa dos zonas se resuelven con el desempate determinista de `002`. No es
  adivinar — es una regla fija y documentada — pero tampoco es una respuesta
  del negocio. Está registrado como `High` en el tracker desde el 2026-08-04 y
  el spec lo lleva como supuesto explícito. **Pasa con la salvedad anotada.**

**Plan-bounded change (harness)**: `covers:` nombra los prefijos que este
feature toca. **Pasa.**

**Verified before done (harness)**: `verify:` es
`cd web && npm run lint && npm test && npm run build`, el mismo que usó `002`.
**Pasa.**

Sin violaciones que justificar; Complexity Tracking queda vacío.

### Re-evaluación después del diseño (Phase 1)

El diseño no introdujo violaciones nuevas. Lo que se agregó y por qué sigue
pasando:

- El índice como archivo estático en `public/` **refuerza** el Principio III:
  cero infraestructura, cero dependencias, y no penaliza a quien entra al sitio
  sin cargar una dirección.
- El contrato de `direcciones.ts` (FR-024) no es una abstracción especulativa,
  que es lo que el Principio III prohíbe: existe porque hay una segunda
  implementación concreta prevista —la consulta a PostGIS cuando exista
  backend— y porque sin él ese cambio arrastraría al formulario.
- `buscarEsquina` devuelve una lista y nunca un resultado único. Es la forma de
  la firma la que impide adivinar una zona, no la disciplina de quien la use
  (Principio V).

## Project Structure

### Documentation (this feature)

```text
specs/003-direccion-por-esquina/
├── plan.md              # Este archivo
├── spec.md              # Qué y por qué
├── research.md          # Phase 0: mediciones y decisiones
├── data-model.md        # Phase 1: entidades y forma del índice
├── quickstart.md        # Phase 1: cómo se valida que anda
├── contracts/
│   └── direcciones.md   # Phase 1: la interfaz del módulo de direcciones
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo emite /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
web/
├── design-source/
│   ├── build-calles.js        # NUEVO. Genera el índice desde los .sql del curso
│   └── README.md              # Se amplía: procedencia del dato (FR-002)
├── public/
│   └── calles-mvd.json        # NUEVO. Índice generado. No se edita a mano
├── lib/
│   ├── direcciones.ts         # NUEVO. buscarCalle/buscarEsquina/regionPermitida
│   ├── direcciones.test.ts    # NUEVO. Incluye el fixture de esquinas conocidas
│   ├── direccion.ts           # NUEVO. El tipo Direccion compartido
│   ├── zonas.ts               # Existe. No se toca
│   └── zona-lookup.ts         # Existe. Se consume, no se modifica
├── components/
│   ├── campo-autocompletado.tsx  # NUEVO. El combobox accesible
│   ├── bloque-direccion.tsx      # NUEVO. Calle + esquina + complementos
│   ├── pedido-form.tsx           # Se reescribe el bloque de retiro
│   ├── mapa-zonas.tsx            # Punto arrastrable acotado + fix de apilado
│   └── mapa-zonas-dinamico.tsx   # Existe. Probablemente no se toca
└── app/
    ├── pedido/page.tsx           # Sólo si el layout lo pide
    └── sobre-nosotros/page.tsx   # Sólo por el fix de apilado
```

**Structure Decision**: se mantiene la estructura de `ARCHITECTURE.md` sin
cambios de fondo. `web/lib/` sigue separando dato generado de lógica escrita a
mano, que es exactamente la razón por la que esa separación existe: una
corrección del dato de calles se regenera sin tocar la lógica ni sus pruebas.

La única novedad estructural es que **el dato generado más grande deja de vivir
en `lib/` y pasa a `public/`**, porque 0,88 MB dentro del bundle penalizarían a
todo el que entra al sitio, incluso a quien sólo mira `/contacto`. Conviene
reflejarlo en `ARCHITECTURE.md` al cerrar el feature.

## Enfoque de ejecución

El orden no es negociable en su primera mitad: sin índice no hay nada que
probar, y sin el arreglo de apilado las listas de sugerencias quedan debajo del
mapa.

**Primero, el apilado.** Encerrar Leaflet en su propio contexto con
`isolation: isolate` en el contenedor del mapa. Es la corrección chica que ya
está diagnosticada en el tracker, y **no** se sube la navbar a `z-[1001]`: eso
arranca una carrera contra una librería que ya usa 1000. Se verifica en
`/pedido` y en `/sobre-nosotros` en viewport de teléfono.

**Segundo, el índice.** `build-calles.js` lee los `.sql` del curso por
argumento, recorta al área de servicio, descarta tramos sin nombre y con nombre
genérico, calcula las intersecciones con una grilla espacial, colapsa las
calzadas dobles a 60 m, resuelve las esquinas contiguas de cada calle y emite
`web/public/calles-mvd.json`. Al terminar **imprime el tamaño crudo y
comprimido**, porque SC-007 es un requisito y no una aspiración.

**Tercero, el módulo de direcciones.** `web/lib/direcciones.ts` con la interfaz
del contrato. Funciones puras sobre el índice ya cargado, sin `window` y sin
red, para que corran igual en el navegador que bajo Vitest — la misma
disciplina que hace testeable a `zona-lookup.ts`. Acá va el fixture de esquinas
conocidas, con las coordenadas que **una persona confirmó contra un mapa real**
(research R6: no las genera el mismo proceso que se quiere verificar, y no
salen de la memoria de nadie).

**Cuarto, el combobox.** `campo-autocompletado.tsx`, teclado completo y
anuncios para lector de pantalla. Se prueba con teclado antes de conectarlo a
nada.

**Quinto, el bloque de dirección.** `bloque-direccion.tsx` orquesta: calle →
esquina → resolución → mapa debajo → complementos habilitados. El mapa aparece
recién con el cruce resuelto, en un espacio ya reservado para que no salte el
layout.

**Sexto, el arrastre acotado y el precio.** El punto se mueve libre dentro del
buffer de las dos cuadras; soltarlo afuera lo devuelve al borde más cercano. El
precio se recalcula en cada movimiento y el cambio de zona se muestra sin
frenar el arrastre.

**Séptimo, los bordes.** Invalidar punto, zona, precio y complementos cuando
cambia la calle o la esquina. Y el mensaje cuando el índice no carga: el
formulario tiene que decirlo, no quedarse mudo.

## Riesgos

**El fixture necesita una persona.** Es el único paso que no se puede
automatizar ni delegar en el agente, y es el que decide si el índice sirve.
Está fundamentado en research R6, con la evidencia de por qué.

**El presupuesto de tamaño se ajusta al final.** Cerrado: el índice mide 0,47 MB
comprimido ya con las esquinas contiguas de R7, y el script falla solo si
alguna vez pasa el techo de 1 MB.

**El combobox a mano.** Riesgo asumido y acotado por SC-009. Si el patrón se
vuelve inmanejable, se agrega la dependencia headless — no se baja la vara de
accesibilidad.

**Fuera del alcance de este plan, pero conviene tenerlo escrito**: hoy el
formulario no transmite el pedido a ningún lado. Termina en una pantalla de
resumen. Ni Diego ni nadie recibe lo que el cliente carga. Este feature mejora
el dato que se junta; no cambia que ese dato no viaje. Eso es del backend.

## Complexity Tracking

Sin violaciones al Constitution Check. Nada que justificar.
