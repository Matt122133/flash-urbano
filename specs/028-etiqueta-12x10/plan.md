---
ticket: none
status: active
covers:
  # El re-maquetado. Deja de dibujar contra A4 y pasa a dibujar la maqueta.
  - web/lib/etiqueta-pdf.ts
  # El modulo nuevo: la maqueta como DATO, que es lo que hace probable la
  # geometria (research D4). Con su prueba.
  - web/lib/etiqueta-maqueta.ts
  - web/lib/etiqueta-maqueta.test.ts
  # SOLO para agregar `lib/etiqueta-maqueta.ts` a la lista ARCHIVOS de la guarda
  # de window.print() (FR-017 de `020`). Ninguna afirmacion existente se toca;
  # sin este prefijo el sensor rebota ese commit.
  - web/lib/etiqueta.test.ts
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  # NO va `web/lib/etiqueta.ts`: que DICE la hoja no cambia (research D6). Si la
  # implementacion concluye que si, es una parada y una decision, no un ajuste.
  # NO va `web/components/pedido/boton-imprimir.tsx`: un solo boton, mismo
  # texto, mismo import dinamico, mismo manejo del error.
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-09-19
---

# Implementation Plan: La etiqueta de 12 x 10

**Branch**: `028-etiqueta-12x10` | **Date**: 2026-09-19 | **Spec**:
[spec.md](spec.md)

## Summary

La etiqueta imprimible pasa de ocupar una hoja A4 a ser un **rectangulo de
120 x 100 mm dentro de una A4**, con marcas de corte en las esquinas, que se
recorta con tijera. Lo pidio un cliente de Diego.

El tamaño de pagina no cambia —sigue siendo A4— asi que el trabajo no esta en
`jsPDF` sino en la maqueta: `020` calzo a mano un layout contra 210 x 297 y en
120 x 100 hay **un quinto de la superficie**. Hay que rehacer el presupuesto
vertical entero, con numeros, y decidir que cede cuando el contenido se pasa.

La decision tecnica que sostiene todo lo demas es **D4**: la maqueta deja de ser
una secuencia de llamadas a jsPDF y pasa a ser **un dato inspeccionable**. Nace
`web/lib/etiqueta-maqueta.ts`, que convierte una `Etiqueta` en una lista de
elementos ubicados en milimetros, y `etiqueta-pdf.ts` queda como un dibujante
que recorre esa lista. Con eso, "nada se sale del rectangulo" deja de ser una
promesa y pasa a ser un `for` con un `expect`. Es el mismo corte que `020` hizo
entre *que dice* y *como se ve*, aplicado un nivel mas abajo.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (App Router, export estatico)

**Primary Dependencies**: `jspdf` — ya instalada desde `020`, se sigue trayendo
con **import dinamico** al tocar el boton (FR-021). Ninguna dependencia nueva.

**Storage**: N/A. Este feature no toca Postgres, ni el servicio Go, ni la app
Android. Ver [data-model.md](data-model.md).

**Testing**: Vitest, `environment: "node"`, `include: ["lib/**/*.test.ts"]`. El
archivo de prueba nuevo entra solo por vivir en `lib/`.

**Target Platform**: navegador, mayoritariamente movil; el artefacto final es
papel.

**Project Type**: web (`web/`), una sola de las tres superficies del repo.

**Constraints**: el rectangulo mide 120 x 100 mm con 5 mm de margen interno, o
sea **110 x 90 mm utiles**, y el presupuesto de `research.md` D3 los gasta casi
enteros: **89.2 de 90** en el caso corriente. No hay lugar para un bloque mas.

**Scale/Scope**: un archivo reescrito, uno nuevo, una prueba nueva, una linea
agregada a una prueba existente.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño de Phase 1.*

- **Principio V — el precio.** La etiqueta **nunca** mostro un importe y sigue
  sin mostrarlo. `etiqueta.ts` no se toca, asi que la estructura sobre la que
  `etiqueta.test.ts` afirma la prohibicion es la misma. El riesgo del
  re-maquetado es que al reescribir un pie aparezca un total "porque queda raro
  el hueco": no hay ni el dato ni el lugar.

  **Pero el modulo nuevo abre un hueco, y el `/speckit-analyze` del 2026-09-19 lo
  encontro.** `sin-precio-a-la-vista.test.ts` escanea `app/` y `components/` y
  **deja `lib/` afuera a proposito**, porque es justo donde el precio tiene que
  seguir viviendo (`zonas.ts` conserva `precio`). O sea que `lib/etiqueta.ts`
  esta protegido por su guarda de grafo de imports, y **un
  `lib/etiqueta-maqueta.ts` recien nacido no lo estaria**: nada le impediria
  importar `zonas.ts` y dibujar un monto en el papel. Es la misma forma del
  agujero que el analyze de `025` encontro con un `formatearPrecio()` en `lib/`,
  antes de que se escribiera una linea.

  **Por eso T024 extiende la guarda de grafo de `etiqueta.test.ts` al modulo
  nuevo**, ademas de la de `window.print()`. Cuesta una linea, el archivo ya esta
  en `covers:` por el otro motivo, y sin eso este feature **debilitaria** la
  proteccion del Principio V en vez de dejarla igual.
- **Principio I — visual-first.** Es literalmente un artefacto que el cliente ve
  y toca. Se demuestra imprimiendolo.
- **Principio III — YAGNI.** El modulo nuevo es la unica complejidad que este
  plan agrega, y **hay que justificarla o no va**: sin el, FR-003, FR-004 y
  FR-007 son afirmaciones que nadie puede comprobar salvo imprimiendo a mano las
  doce combinaciones de largos en cada cambio futuro. No es una abstraccion
  especulativa: es la forma de verificar tres requisitos escritos. La
  alternativa —rasterizar el PDF y comparar pixeles— es la que si seria
  infraestructura de mas, y esta rechazada en `research.md` D4.
- **Principio IV — mobile-first.** El boton no cambia. La descarga en telefono se
  comprueba igual que en `020`.
- **Plan-bounded change (harness).** `covers:` nombra cinco prefijos y dice en
  comentario por que `etiqueta.ts` y `boton-imprimir.tsx` **no** estan.
- **Verified before done (harness).** `verify:` es el de un feature de `web/`:
  `cd web && npm run lint && npm test && npm run build`. Las otras dos piernas
  —Go y Gradle— no se corren porque **este feature no toca ni `backend/` ni
  `android/`**; `covers:` lo dice y el sensor lo hace cumplir.
- **Staging antes que produccion.** La web de staging **no esta desplegada**:
  corre local (`docs/processes/staging.md`). Para este feature eso alcanza y
  sobra, porque la etiqueta **no habla con el servicio** (FR-022): se arma en el
  navegador con datos que la pantalla ya tiene. Lo que no se saltea es ejercitar
  el cambio antes de mergear a `master`, y eso es el `quickstart.md` con una
  impresora de verdad.

Re-evaluacion post-diseño: **sin violaciones nuevas.** El diseño de Phase 1 no
agrego dependencias, ni datos persistidos, ni superficie de red. *Complexity
Tracking* queda vacio a proposito.

## Project Structure

### Documentation (this feature)

```text
specs/028-etiqueta-12x10/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # Las siete decisiones, con los numeros
├── data-model.md        # La `Maqueta`, y que nada persistido cambia
├── quickstart.md        # La mitad que `verify:` no puede probar
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo escribe /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
web/lib/
├── etiqueta.ts              # QUE dice la hoja. NO SE TOCA.
├── etiqueta-maqueta.ts      # NUEVO: DONDE va cada cosa, en milimetros.
├── etiqueta-maqueta.test.ts # NUEVO: la geometria, afirmada sobre el dato.
├── etiqueta-pdf.ts          # COMO se dibuja. Reescrito contra la maqueta.
├── etiqueta.test.ts         # +1 linea: el modulo nuevo entra a la guarda de print().
└── silueta-camion.ts        # El asset. NO SE TOCA.

web/components/pedido/
└── boton-imprimir.tsx       # NO SE TOCA.
```

**Structure Decision**: se mantiene el patron que `web/lib/` ya usa y que
`ARCHITECTURE.md` describe: **datos generados y logica pura separados, y un
modulo por responsabilidad**. La cadena queda en tres pasos —`etiqueta.ts` (que
dice) → `etiqueta-maqueta.ts` (donde va) → `etiqueta-pdf.ts` (como se pinta)— y
cada corte existe porque hace verificable algo que del otro lado no lo era. El
primero lo pago `020`; el segundo lo paga este feature.

## El trabajo, en orden

**1. La maqueta, antes que el dibujo.** Escribir `etiqueta-maqueta.ts` con la
firma `maquetar(etiqueta, medir)`, donde `medir(texto, pt) => mm` se inyecta
(research D5) para que la prueba mida con **el mismo jsPDF que despues dibuja** y
no con una imitacion. Implementar el presupuesto de D3 y la tabla de pisos.
Observable: `maquetar()` devuelve la estructura de `data-model.md` para una
`Etiqueta` armada a mano, sin que exista todavia ningun PDF.

**2. La prueba de la geometria.** `etiqueta-maqueta.test.ts` con las seis reglas
de `data-model.md`, y **cada guarda negativa con su control positivo**: la de
FR-003 tiene que ponerse roja cuando se empuja un elemento afuera a proposito, y
la de los pisos cuando se baja un cuerpo por debajo del suyo. Una guarda que
afirma que algo no pasa y nunca se vio en rojo no prueba nada. Observable:
`npm test` verde, y rojo cuando se rompe la implementacion adrede.

**3. El dibujo.** Reescribir `etiqueta-pdf.ts` para que llame a `maquetar()` y
recorra los elementos. Las constantes `ANCHO/ALTO/MARGEN/UTIL` dejan de describir
la A4 y pasan a describir el rectangulo; las seis funciones de dibujo pierden la
aritmetica de posiciones, que se fue a la maqueta. Agregar las escuadras de
esquina. Observable: se descarga un PDF y el rectangulo esta donde dice D2.

**4. La guarda heredada.** Agregar `lib/etiqueta-maqueta.ts` a la lista
`ARCHIVOS` de la prueba de `window.print()` en `etiqueta.test.ts`. Una linea, y
es la unica razon por la que ese archivo esta en `covers:`.

**5. El papel.** `quickstart.md`, entero, con impresora, tijera y regla. **Es
parte del trabajo, no una sugerencia**: la seccion D7 de `research.md` lista los
cuatro requisitos que ninguna prueba puede tocar, y tres de ellos son criterios
de exito del spec.

## Lo que mas probablemente salga mal

Se anota para que quien implemente lo mire antes y no despues:

- **El presupuesto de D3 tiene 0.8 mm de sobra.** Es poco. Si al dibujar no
  cierra, lo que hay que ajustar son los *aires* entre bloques y el cuerpo del
  codigo, **en ese orden**, y nunca el piso de la entrega. Y si hay que ajustar,
  se actualiza la tabla de D3 en vez de dejarla mintiendo.
- **Los pisos son una hipotesis de papel.** 26 pt para el codigo sale de una
  cuenta de altura de mayuscula, no de haberlo leido parado. El quickstart es
  quien lo confirma o lo tumba.
- **La silueta del camion puede volverse una mancha.** En A4 median 13 mm de
  alto; aca son 5. Impresa en mono y chica, una silueta se empasta. Si pasa, la
  salida no es agrandarla —no hay milimetros— sino revisar si a ese tamaño sigue
  aportando algo.
- **El comentario con renglones a proposito.** Cinco indicaciones cortas, una por
  linea, gastan mas alto que 280 caracteres seguidos y son **mas probables**. Es
  el caso que dispara FR-008 antes que el del tope de caracteres.
