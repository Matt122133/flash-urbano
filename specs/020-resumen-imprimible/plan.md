---
ticket: none
status: draft
covers:
  # El generador de la silueta y su README.
  - web/design-source/
  # SOLO la silueta generada. `web/public/` entero autorizaria editar
  # calles-mvd.json, 1,3 MB de dato generado que este feature no tiene por que
  # tocar.
  - web/public/silueta-camion.png
  # Los tres archivos nuevos, nombrados uno por uno. `web/lib/` entero
  # autorizaria editar api.ts, zonas.ts, zona-lookup.ts y direccion.ts, que este
  # plan dice explicitamente que NO se tocan — y FR-010 exige reusar
  # componerDireccion, no reescribirlo. Con el prefijo ancho, el sensor no lo
  # impide; con estos tres, si.
  - web/lib/etiqueta.ts
  - web/lib/etiqueta.test.ts
  - web/lib/etiqueta-pdf.ts
  # El boton en la confirmacion.
  - web/components/pedido-form.tsx
  # El boton en la tarjeta del historial.
  - web/components/pedido/tarjeta-pedido.tsx
  # jspdf entra como dependencia.
  - web/package.json
  - web/package-lock.json
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed:
---

# Implementation Plan: La etiqueta que se pega al paquete

**Branch**: `020-resumen-imprimible` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

El pedido sale con codigo y el paquete no lleva nada encima. Este plan agrega un
boton **Imprimir resumen** en la confirmacion y en cada tarjeta de Mis pedidos,
que descarga un PDF A4 con el codigo dominante, los bloques de entrega y retiro,
la fecha, la cantidad, la zona y la silueta de la marca.

Las tres incognitas ya estan resueltas y medidas en [research.md](research.md):
**jsPDF** pesa la mitad que pdf-lib (108 contra 201 KB gzip); **las tildes salen
bien con la fuente incorporada**, sin embeber nada, comprobado leyendo los bytes
del PDF; y **la silueta sale umbralando por alfa**, no por color — lo que corrige
un error del propio spec y vuelve ese paso mucho mas barato de lo previsto.

La forma del codigo la manda FR-003: **una sola composicion en `lib/`,
alimentada por dos adaptadores**, porque las dos pantallas tienen el pedido en
formas distintas y una hoja que dependa de desde donde se imprimio no sirve como
etiqueta.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16 (export estatico), React 19.

**Primary Dependencies**: **`jspdf` es la unica dependencia nueva** del feature.
El generador de la silueta usa `fast-png`, y va como dependencia **de
desarrollo**: corre en Node al generar el asset y no viaja al navegador.

**Storage**: N/A. La etiqueta no se guarda: es una vista que se recompone.

**Testing**: Vitest. La composicion vive en `lib/` justamente para poder probarse
en el entorno `node` que el repo ya tiene configurado.

**Target Platform**: navegador, mayoritariamente telefono (Principio IV).

**Project Type**: web. **Ni el backend ni la app Android se tocan**: todo ocurre
con datos que la pantalla ya tiene.

**Performance Goals**: que visitar el sitio no descargue nada de esto (SC-006).
La libreria se trae al tocar el boton.

**Constraints**: 108 KB gzip bajo demanda; la silueta ~3,5 KB. El PDF resultante
ronda los 3 KB mas la imagen.

**Scale/Scope**: un documento, una hoja, dos puntos de entrada.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio V — el producto no dice lo que sale un envio.** Es el riesgo
  central de este feature y por eso tiene requisito propio (FR-007) **y una
  prueba propia**: una hoja llamada "resumen del pedido" es el lugar natural
  donde un importe aparece por costumbre de formulario. La zona si se imprime
  (FR-018), como **nombre** y nunca como tarifa.
- **Principio V — nunca se adivina una zona.** La zona sale del punto de entrega
  guardado; sin punto, el bloque se omite entero. **No se deduce de la direccion
  escrita.**
- **Principio II — el autoservicio es el valor.** Este feature lo refuerza: hoy
  la unica forma de vincular caja y pedido es que alguien anote un codigo a mano.
- **Principio IV — movil primero.** La descarga se comporta distinto en cada
  telefono, y FR-017 lo vuelve aceptable: el producto entrega un archivo y no
  intenta imprimir.
- **Principio III — simplicidad.** Una dependencia nueva, y se justifica con una
  medicion. El generador de la silueta sigue el patron que el repo ya tiene.
- **`014` sigue respetado**: la etiqueta no imprime tamaño ni hora de retiro,
  que son valores fijos y no elegidos.
- **`covers:`** nombra los prefijos que el feature toca y nada mas.
- **`verify:`** es el comando estandar de `web/`.

Sin violaciones. Complexity Tracking queda fuera.

## Project Structure

### Documentation (this feature)

```text
specs/020-resumen-imprimible/
├── plan.md          # este archivo
├── spec.md
├── research.md      # las tres mediciones: libreria, tildes, silueta
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md         # lo escribe /speckit-tasks
```

Sin `contracts/`: no cambia ninguna interfaz. El servicio no se entera.

### Source Code (repository root)

```text
web/
├── design-source/
│   ├── build-silueta.js      # NUEVO: umbrala por alfa y recorta el camion
│   └── README.md             # una seccion mas, como pide el repo
├── public/
│   └── silueta-camion.png    # GENERADO, ~3,5 KB
├── lib/
│   ├── etiqueta.ts           # NUEVO: el tipo neutro y los dos adaptadores
│   ├── etiqueta.test.ts      # NUEVO: donde se prueba que no hay importes
│   ├── etiqueta-pdf.ts       # NUEVO: dibuja la hoja con jsPDF
│   └── direccion.ts          # NO SE TOCA: ya compone direcciones (FR-010)
└── components/
    ├── pedido-form.tsx       # el boton en Confirmation
    └── pedido/
        └── tarjeta-pedido.tsx # el boton en la tarjeta
```

**Structure Decision**: el corte entre `etiqueta.ts` y `etiqueta-pdf.ts` **no es
cosmetico y es lo que hace testeable el requisito que importa**. `etiqueta.ts` es
puro: convierte cualquiera de las dos formas del pedido en la estructura de la
hoja —que renglones, con que contenido— y se prueba en Node sin abrir un PDF.
`etiqueta-pdf.ts` toma esa estructura y la dibuja. **FR-007, que no haya ningun
importe, se verifica sobre la estructura**, que es texto inspeccionable, y no
raspando bytes de un PDF.

## Como se ejecuta

**1. Generar la silueta.** Un script nuevo en `design-source/`, con la forma de
los que ya estan: lee `public/logo-flash-urbano.png`, umbrala por **canal alfa**
—no por color, ver research D3—, recorta el camion y escribe
`public/silueta-camion.png` en negro sobre transparente. El recorte necesita
acotar en `x` **y en `y`**: con `x` solo entran la cola de *TRANSPORTE* y un resto
de la linea naranja. Las constantes del recorte llevan el motivo escrito al lado,
como en `build-favicon.js`. Se documenta en `design-source/README.md`.

**2. El tipo neutro y los dos adaptadores** en `lib/etiqueta.ts`. Un tipo que
describe la hoja, y dos funciones que llegan a el: una desde el `FormState` mas
el codigo, otra desde un `PedidoGuardado`. Las direcciones salen de
`componerDireccion` de `lib/direccion.ts` — **no se escribe otro compositor**. La
zona se resuelve con `resolverZona` del punto de entrega, y **se omite el bloque
cuando no hay punto**.

**3. Las pruebas de `lib/etiqueta.ts`**, que son el nucleo de la verificacion
automatica: que las dos formas del mismo pedido produzcan la **misma**
estructura (FR-003), que no aparezca ningun importe (FR-007), que no aparezcan
tamaño ni hora (FR-008), que la zona se omita sin punto (FR-018), y que las
direcciones compuestas coincidan con las de pantalla (FR-010).

**4. El dibujo** en `lib/etiqueta-pdf.ts`: A4, codigo dominante, bloques de
entrega y retiro, fecha, cantidad, zona, silueta arriba y el nombre como texto.
El corte de lineas largas (FR-012) se hace con el medidor de ancho de la propia
libreria, no contando caracteres. Devuelve el documento; **no decide el nombre
del archivo ni dispara la descarga**, para poder probarlo sin navegador.

**5. Los dos botones.** En `Confirmation` de `pedido-form.tsx` y en
`tarjeta-pedido.tsx`. Los dos hacen lo mismo: importan `etiqueta-pdf` de forma
**dinamica** al tocarse, muestran que estan trabajando, disparan la descarga con
el codigo en el nombre del archivo, y **si algo falla lo dicen en pantalla**
(FR-015).

**6. Correr `verify:`** y el quickstart, que es donde se comprueba lo que
ninguna prueba puede: que la hoja se lea, que las tildes se **dibujen**, y que en
un telefono el archivo llegue.

## Como se sabe que funciono

`verify:` verde prueba la mitad que importa y **conviene saber cual**:

- **Si prueba**: que las dos rutas produzcan la misma estructura; que no haya
  importes, ni tamaño, ni hora; que la zona se omita sin punto; que las
  direcciones se compongan igual que en pantalla; y que el bundle no cargue la
  libreria de arranque.
- **No prueba**: que la hoja se vea bien, que el corte de lineas no se superponga,
  que las tildes se **dibujen** —research D2 comprueba la codificacion, no el
  render— ni que la descarga funcione en un telefono. Todo eso es el quickstart.

## Riesgos

**El que mas probablemente muerda: el layout con datos largos.** Un nombre largo
mas una direccion con calle compuesta, numero, apto, esquina y cooperativa puede
empujar un bloque sobre otro. La prueba de estructura no lo ve, porque es un
problema de dibujo. El quickstart lleva un caso con los campos al maximo.

**El peso, que ya se acepto con los ojos abiertos.** 108 KB gzip bajo demanda es
el precio de haber elegido libreria en vez del dialogo del navegador. Se paga
solo al imprimir, y esa decision esta registrada en Clarifications con su motivo.

**La silueta depende del logo actual.** Si el cliente cambia el logo, el asset se
regenera; si le cambia la disposicion —el camion de otro lado— hay que ajustar el
recorte. Vive en un generador versionado justamente para que eso sea barato.
