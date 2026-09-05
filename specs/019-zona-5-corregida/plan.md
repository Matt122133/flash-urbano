---
ticket: none
status: active
covers:
  # El KML editado por el cliente y el generador. Del generador solo se toca un
  # comentario de cabecera, y esta declarado como paso: ver research D3.
  - web/design-source/
  # El archivo generado. Se escribe corriendo el generador, nunca a mano.
  - web/lib/zonas.ts
  # El caso nuevo: un punto del tramo que la zona 5 gano.
  - web/lib/zona-lookup.test.ts
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-09-05
---

# Implementation Plan: El borde corregido de la zona 5 llega al sitio

**Branch**: `019-zona-5-corregida` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

Diego pidio corregir el mapa de la zona 5, Mateo edito el KML, y ahi quedo: el
sitio no lee el KML sino `web/lib/zonas.ts`, que es generado y sigue teniendo el
trazado de `013`. Este plan corre el generador, deja el trazado nuevo publicado
con su fuente al lado, y agrega el unico caso de prueba que faltaba —un punto en
el territorio que la zona 5 gano—. **No se toca una linea de logica**, que es
tanto el alcance como la comprobacion: la constitucion exige que un borde se
pueda corregir sin tocar codigo, y si hiciera falta, el defecto seria del diseño.

Lo que la medicion de [research.md](research.md) agrego al pedido original: el
archivo modifica **dos** zonas, no una, y hay 135 puntos de grilla que pasan de
zona 1 a zona 5. Eso no cambia el trabajo pero **sale del alcance de lo que
Diego pidio literalmente**, asi que se le muestra antes de mergear.

## Technical Context

**Language/Version**: TypeScript 5 sobre Next.js 16 (export estatico); el
generador es Node puro, sin dependencias.

**Primary Dependencies**: ninguna nueva. `build-zonas.js` usa solo `fs`.

**Storage**: N/A. El trazado vive en el bundle, no en la base — decision de `002`
(D3), para que decidir cobertura no dependa de que una request salga bien.

**Testing**: Vitest (`npm test`). El unico modulo del repo con pruebas unitarias
de esta area es `lib/zona-lookup.test.ts`.

**Target Platform**: navegador, mayoritariamente telefono.

**Project Type**: web (una de las tres superficies del repo; las otras dos no se
tocan).

**Performance Goals**: sin cambio medible. El anillo de la zona 5 pasa de 24 a 32
vertices y el de la zona 1 de 119 a 128: 476 vertices en total contra 459. El ray
casting es lineal en vertices y corre una vez por punto marcado.

**Constraints**: `lib/zonas.ts` va en el bundle, asi que crece ~17 pares de
coordenadas. Irrelevante frente a los 0,47 MB del indice de calles, que ni
siquiera esta en el bundle.

**Scale/Scope**: cinco poligonos, 476 vertices, un archivo generado.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio V — la zona decide admision, nunca se adivina.** Se cumple y es el
  motivo del feature: el trazado publicado vuelve a ser el que el cliente
  dibujo. No se agrega ningun fallback a la zona mas cercana; los 82 puntos que
  ganan cobertura la ganan por estar dentro del poligono nuevo, y los que la
  pierden pasan a `null`, que es "escribinos", no "te cobro la de al lado".
- **Los limites son un dato versionado y regenerable sin tocar codigo.** Se
  cumple literalmente: el unico cambio de comportamiento sale de correr el
  generador. El unico renglon que se edita a mano en `.js` es un comentario.
- **Un limite que el cliente no confirmo no llega a produccion.** **Este es el
  punto abierto.** Diego pidio el cambio, Mateo dibujo las coordenadas, y nadie
  verifico que lo dibujado sea lo pedido. Se cumple via FR-008 con el paso 4 del
  [quickstart](quickstart.md), que es humano.

  **Y bloquea el merge, no el despliegue**, porque en este repo son el mismo
  acto: `.github/workflows/deploy-pages.yml` publica con `push` a `master`
  filtrado por `paths: web/**`, y este feature toca `web/lib/zonas.ts`. Tratarlo
  como un gate de despliegue —que fue como quedo escrito en el primer borrador de
  este plan— habria puesto el trazado sin confirmar en `flashurbano.uy` en el
  momento del merge, sin ninguna ventana para mirarlo.
- **`covers:`** nombra los cuatro prefijos que este feature toca y nada mas.
- **`verify:`** es el comando estandar de `web/`, el mismo de `013` y `014`.

Sin violaciones. La tabla de Complexity Tracking queda fuera.

## Project Structure

### Documentation (this feature)

```text
specs/019-zona-5-corregida/
├── plan.md              # este archivo
├── spec.md
├── research.md          # las mediciones: que cambia y cuanto
├── data-model.md        # la cadena KML -> generador -> zonas.ts
├── quickstart.md        # como se mira el mapa, y que contarle a Diego
├── checklists/
│   └── requirements.md
└── tasks.md             # lo escribe /speckit-tasks
```

Sin `contracts/`: este feature no expone ni cambia ninguna interfaz. Ni el
servicio ni la app Android se enteran — la resolucion de zona vive entera en el
navegador, y el backend guarda el punto sin resolverlo (fila `Medium` del
2026-08-12 en el tracker).

### Source Code (repository root)

```text
web/
├── design-source/
│   ├── zonas-flash-urbano.kml    # editado por Diego/Mateo; se commitea tal cual
│   └── build-zonas.js            # solo el comentario de cabecera (research D3)
└── lib/
    ├── zonas.ts                  # GENERADO — se reescribe corriendo el generador
    ├── zona-lookup.ts            # NO SE TOCA. Si hiciera falta, hay un defecto.
    └── zona-lookup.test.ts       # un caso nuevo
```

**Structure Decision**: se respeta la separacion que `002` establecio entre dato
generado y logica que lo consulta, que es exactamente la propiedad que hace
barato este feature. `zona-lookup.ts` aparece en el arbol para decir que **no**
esta en `covers:`.

## Como se ejecuta

Siete pasos, en este orden. Los ultimos dos no los cierra ningun comando y son
los que mas facil se saltean.

**1. Regenerar `zonas.ts`.** Desde `web/`, correr el generador con el KML del
working tree. El comando y la salida esperada estan en el paso 1 del
[quickstart](quickstart.md); el control es que reporte **128 vertices para la
zona 1 y 32 para la zona 5**. Si reporta 119 y 24, leyo el archivo viejo y no hay
nada mas que hacer hasta resolver eso.

**2. Agregar el caso de prueba del territorio ganado.** En
`lib/zona-lookup.test.ts`, junto a las cinco referencias de barrio que ya
existen, un caso que afirme que `-34.867420, -56.008911` resuelve a la zona 5.
Ese punto sale de la medicion de research D1: **antes no tenia zona y ahora la
tiene**, que es lo que hace que el caso pruebe este feature y no otra cosa.

**3. Comprobar que el caso nuevo sabe fallar.** Revertir `lib/zonas.ts` al
trazado viejo, correr `npm test`, y verificar que **ese caso queda en rojo y solo
ese**. Despues restaurar. Sin este paso el caso podria estar sobre territorio que
ya estaba cubierto y pasaria igual con el trazado viejo, que es la forma en que
una prueba de cobertura no prueba nada. Esta escrito en el paso 2 del quickstart.

**4. Corregir el comentario de `build-zonas.js`.** Dos lugares dicen que
`resolverZona()` "recorre la lista tal cual y devuelve el primer match, y eso ES
la regla de desempate": la cabecera del script y el encabezado que ese script
escribe dentro de `zonas.ts`. Es falso desde `004` —gana el menor precio, el id
solo desempata precios iguales— y describe mal la funcion que decide la
cobertura. **Va como paso declarado y no como limpieza oportunista** porque este
es el unico feature que abre ese archivo y porque ese comentario ya indujo un
error concreto: la primera version de este spec lo copio. Ver research D3. Al
tocarlo hay que **volver a correr el paso 1**, porque el encabezado de `zonas.ts`
lo escribe el generador.

**5. Correr `verify:`.** `cd web && npm run lint && npm test && npm run build`.

**6. Commitear el KML y el generado juntos** (FR-007), en un solo commit, con
`build-zonas.js` si el paso 4 lo toco. Que la fuente y su proyeccion viajen
juntas **es el requisito entero**: este feature existe porque una vez quedaron
separadas, y separarlas de nuevo reproduce el mismo defecto en el proximo clon.
Va **antes** de pasar el plan a `completed`, o el sensor de cobertura rebota el
commit.

**7. Mostrarle el mapa a Diego** (FR-008), paso 4 del quickstart. Bloquea el
merge — ver el Constitution Check.

## Como se sabe que funciono

`verify:` en verde prueba tres cosas: que el generado es TypeScript valido, que
las cinco zonas conocidas resuelven igual que antes, y que el punto del tramo
nuevo resuelve a la zona 5.

**No prueba las otras dos**, y conviene decirlo antes de que alguien lea el verde
como permiso para desplegar:

- **Que no haya un hueco (FR-004).** Esta medido y cerrado —maximo 96 m, mediana
  41 m, cero puntos a mas de 100 m— pero la medicion es una grilla de 380.462
  puntos contra cinco poligonos, que no entra en una prueba unitaria. Vive en
  research D2 como medicion fechada, no como guarda permanente. Si el trazado se
  vuelve a tocar, se vuelve a medir.
- **Que el trazado sea el que Diego pidio (FR-008).** Es humano por definicion.
  Paso 4 del quickstart, y **bloquea el merge** — que aca es lo mismo que el
  despliegue.

## Riesgos

**El unico riesgo real es el que `verify:` no ve**: que el trazado este bien
construido y sea el equivocado. La medicion acota el daño —las zonas 2, 3 y 4
estan intactas y nadie queda a mas de una cuadra de cobertura— pero no puede
decir si el borde entre zona 1 y zona 5 quedo donde Diego lo quiere. Por eso el
quickstart termina en una conversacion y no en un comando.

**El riesgo menor**: el caso de prueba nuevo queda clavado a esta geometria. Si
Diego vuelve a mover el borde por ahi, la prueba se pone en rojo. Es el
comportamiento correcto —un cambio de cobertura tiene que hacerse notar— pero
quien la vea en rojo tiene que saber que la respuesta puede ser actualizar el
punto, no "arreglar" el trazado.
