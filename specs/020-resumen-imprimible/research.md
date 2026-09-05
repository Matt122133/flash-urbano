# Research: La etiqueta que se pega al paquete

**Fecha**: 2026-09-05

Las tres decisiones que este feature no podia tomar a ojo se midieron. Los
scripts corrieron en un directorio aparte, fuera del repo: nada de esto instalo
nada en `web/` todavia.

## D1 — jsPDF, no pdf-lib

**Decision**: `jspdf`, importada bajo demanda.

**Medido** (build ESM minificada de cada una, y su tamaño comprimido, que es lo
que viaja):

| | minificada | **gzip** |
|---|---:|---:|
| `jspdf.es.min.js` | 336 KB | **108 KB** |
| `pdf-lib.esm.min.js` | 511 KB | **201 KB** |

**Rationale**: pdf-lib pesa el doble para un documento que es texto, dos lineas y
una imagen chica. Nada de lo que pdf-lib hace mejor —editar PDFs existentes,
formularios, incrustar paginas— entra en este feature.

Sobre el peso, que es el unico contra de haber elegido libreria en vez del
dialogo del navegador: **108 KB gzip no es poco** en un telefono con datos
moviles, y por eso FR-014 exige traerla recien al tocar el boton. Quien entra a
`/contacto` no paga nada.

**Alternatives considered**:

- **pdf-lib**: rechazada por peso, arriba.
- **El dialogo de impresion del navegador** (`window.print()` + CSS de
  impresion): **cero bytes**, y era mi recomendacion inicial. La rechazo el
  cliente y el motivo esta en Clarifications: no quiere que el producto este en
  el medio de la conversacion con la impresora. Ademas el navegador agrega su
  propio encabezado y pie salvo que la persona los desactive a mano, que en una
  etiqueta se ve mal.
- **Armar el PDF a mano**, sin libreria: un PDF de texto plano son unos cientos
  de bytes de sintaxis. Rechazado — habria que resolver a mano el ancho de texto
  para cortar lineas (FR-012) y la codificacion WinAnsi (FR-011), que es
  exactamente lo que D2 muestra que la libreria ya hace bien.

## D2 — Las tildes salen bien con la fuente incorporada, sin embeber nada

**Decision**: Helvetica de las 14 estandar del formato. **No se embebe ninguna
fuente.**

Es la duda que hunde estos features en silencio: se prueba con "Juan Perez", sale
bien, y el defecto aparece el dia que alguien vive en Piñeyro. Se genero un PDF
real y se leyeron los bytes del content stream:

```text
original   : Piñeyro 1234, esq. Bulevar España - Peñarol, ácido, Ñandú, über
en el PDF  : Piñeyro 1234, esq. Bulevar España - Peñarol, ácido, Ñandú, über
  ñ (U+f1) -> OK    á (U+e1) -> OK    Ñ (U+d1) -> OK
  ú (U+fa) -> OK    ü (U+fc) -> OK
```

El PDF resultante pesa **3,1 KB**.

**Rationale**: los caracteres del español entran en WinAnsi, que es la
codificacion de las fuentes estandar, asi que no hace falta embeber una fuente
—que agregaria entre 100 y 300 KB al archivo **de cada etiqueta**, no al bundle—.

**Alternatives considered**: embeber una fuente propia para que la etiqueta use
la tipografia del sitio. Rechazado: multiplica el peso de cada PDF por cien para
una hoja que se imprime en blanco y negro y se pega a una caja. La marca la
aporta la silueta, no la tipografia.

**Limite de esta prueba, dicho explicitamente**: comprueba la **codificacion**,
o sea que los bytes correctos llegan al archivo. No comprueba que un visor los
**dibuje** bien. Eso lo cierra el quickstart abriendo un PDF de verdad.

## D3 — La silueta sale umbralando por ALFA, y esto corrige al spec

**Decision**: un generador en `design-source/` que umbrala
`public/logo-flash-urbano.png` **por canal alfa**, recorta el camion y emite un
PNG negro con fondo transparente.

**El primer borrador del spec decia lo contrario** —que umbralar daria un
contorno y habria que rellenar el cuerpo— y estaba mal. El error fue razonar
desde el color: el camion es blanco con contorno naranja, y de ahi se siguio que
un umbral lo dejaria hueco. **Pero el PNG tiene canal alfa y el cuerpo blanco es
opaco**, asi que umbralar por alfa lo incluye.

Medido sobre el archivo real (600x245, 4 canales, 8 bits):

| recorte | caja | relleno medio por fila |
|---|---|---:|
| `x>=380` | 220x245 | 84,4% |
| `x>=400` | 200x245 | 82,9% |
| `x>=440` | 160x245 | 82,7% |

El 83% **no son agujeros a tapar**: son los huecos legitimos de un camion visto
de costado —el bajo chasis entre las ruedas, la separacion entre cabina y caja—.
Se genero el PNG y se miro: 200x245, **3,5 KB**, camion reconocible con sus
lineas de velocidad.

**Lo que si falta resolver es el recorte.** No hay ninguna columna vacia en toda
la imagen —la linea naranja bajo *URBANO* la cruza entera—, asi que el camion no
se puede separar buscando un hueco vertical. Con el recorte por `x` solamente
entran tambien la cola de *TRANSPORTE* y un resto de esa linea. Hace falta acotar
tambien en `y`. Es el mismo problema que `build-favicon.js` ya resuelve con un
recorte propio, y se resuelve igual: constantes con el motivo escrito al lado.

**Alternatives considered**:

- **Redibujar el camion como vector.** Mas nitido y mas liviano, pero es
  redibujar la marca del cliente por nuestra cuenta. Rechazado: la silueta
  derivada del logo real **es** su marca; una redibujada se le parece.
- **Umbralar por color.** Es lo que el spec suponia. Rechazado por lo medido:
  daria un contorno, y ademas dependeria de los valores exactos de naranja y azul
  del logo, que cambian si el cliente lo retoca.
- **Usar `icon.svg`.** Ya existe y ya tiene el camion — pero adentro lleva un
  PNG en base64 sobre un cuadrado azul, asi que no ahorra nada y arrastra el
  fondo que justamente hay que sacar.

## D4 — Una sola composicion, dos adaptadores

**Decision**: la etiqueta se compone en un modulo de `web/lib/`, que recibe **un
tipo neutro**, y cada pantalla trae su adaptador desde la forma que tiene a mano.

Es lo que exige FR-003, y el motivo es concreto: la confirmacion tiene un
`FormState` —lo que la persona acaba de tipear— y Mis pedidos tiene un
`PedidoGuardado` —lo que el servicio devolvio—, con otros nombres de campo. Sin
un tipo intermedio, la hoja se arma dos veces y diverge sin que nadie lo note
hasta que alguien imprime el mismo pedido desde los dos lados.

**Que vive en `lib/` y no en el componente**: la composicion es logica pura y
`lib/` es donde el repo pone lo que se puede probar en Node bajo Vitest, igual
que `lib/repetir.ts` —que existe por exactamente esta razon y resuelve
exactamente este problema para otro feature—. Las direcciones se componen con
`lib/direccion.ts`, que ya existe y ya usa la pantalla (FR-010): **no se escribe
un segundo compositor de direcciones.**

**Alternatives considered**: que cada pantalla arme su PDF. Rechazado por FR-003,
y porque duplica el layout, que es la parte cara.

## D5 — Que la libreria no entre al bundle, y que se note si no carga

**Decision**: importacion dinamica al tocar el boton, con estado de carga y
mensaje de error visible.

**Rationale**: FR-014 y SC-006. Un import estatico mete 108 KB en el bundle de
`/pedido` y de `/perfil` para una funcion que la mayoria no va a usar en esa
visita.

**Y el modo de falla hay que atenderlo, porque ya ocurrio en este mismo
formulario.** El 2026-08-14 el boton de confirmar dejo de hacer nada por una
excepcion no atrapada, y el sintoma —una pantalla que no reacciona— es
indistinguible de un boton roto; la persona vuelve a tocar. Un import dinamico es
una request, y una request falla. FR-015 existe por eso: si la libreria no carga,
**se dice**.

**Alternatives considered**: precargar la libreria al mostrar la confirmacion,
para que el primer toque sea instantaneo. Tentador, pero le cobra los 108 KB a
todo el que confirma un pedido, imprima o no. Se descarta hasta tener una queja
real de lentitud.
