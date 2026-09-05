# Quickstart: comprobar la etiqueta

`verify:` prueba que la etiqueta lleve lo que tiene que llevar. **No prueba que
se vea bien, que las tildes se dibujen, ni que la descarga funcione en un
telefono.** Esto es esa mitad.

## Prerequisitos

```bash
cd web
npm install
```

## 1. Regenerar la silueta y mirarla

```bash
cd web
node design-source/build-silueta.js
```

Abrir `public/silueta-camion.png`. Tiene que verse **un camion negro macizo con
sus lineas de velocidad**, y nada mas:

- **Sin la cola de *TRANSPORTE***. Es el error mas probable del recorte: con un
  recorte solo en `x` entra la ultima palabra del logotipo.
- **Sin el resto de la linea naranja** que cruza el logo por debajo.
- **Macizo, no hueco.** Los unicos huecos legitimos son el bajo chasis entre las
  ruedas y la separacion entre cabina y caja. Si el cuerpo de la caja sale vacio,
  se umbralo por color en vez de por alfa (research D3).

## 2. Las pruebas

```bash
cd web
npm test
```

**Control negativo, y no es opcional.** La prueba que mas importa es la de
FR-007, que afirma que no hay ningun importe. Una guarda que afirma que algo *no*
pasa necesita un caso que demuestre que sabria detectarlo:

- Agregar temporalmente un campo con un monto a la estructura de la etiqueta.
- Correr `npm test`: **la prueba de FR-007 tiene que ponerse en rojo.**
- Sacarlo.

Si queda verde, la guarda no mira donde cree que mira.

## 3. La hoja, impresa de verdad

```bash
cd web
npm run dev
```

Cargar un pedido en `http://localhost:3000/pedido` **con los campos al maximo**,
que es el caso que rompe el layout:

- nombre largo, del tipo "María Fernanda Rodríguez Piñeyro"
- direccion con **todo**: calle compuesta, numero, apto, esquina y cooperativa
- lo mismo en retiro y en entrega

Confirmar, tocar **Imprimir resumen**, y abrir el PDF. Comprobar:

1. **El codigo se lee a un brazo de distancia** (FR-004). La prueba real es
   imprimirla, pegarla en una caja y leerla parado.
2. **Las tildes y la ñ se DIBUJAN bien.** research D2 comprobo que los bytes
   correctos llegan al archivo; que el visor los dibuje es otra cosa y se mira
   aca.
3. **Ningun bloque se pisa con otro** y nada se sale de la hoja, con los datos
   largos de arriba.
4. **No hay ningun importe en ninguna parte**, ni un espacio que sugiera que
   deberia haberlo.
5. **La zona aparece como nombre** —"Zona 3"— y no como una tarifa.
6. El archivo descargado **tiene el codigo en el nombre** (FR-016).

Y despues **imprimirla en papel**, en blanco y negro. Es el unico modo de ver si
la silueta queda como una mancha o como un camion.

## 4. La misma etiqueta desde Mis pedidos (FR-003)

En `http://localhost:3000/perfil`, buscar ese mismo pedido y tocar **Imprimir
resumen** en su tarjeta. **Las dos hojas tienen que decir exactamente lo mismo.**
Es el requisito que justifica todo el tipo neutro, asi que se compara en serio,
campo por campo.

Y con un pedido **anterior a `011`**, sin punto de entrega guardado: la etiqueta
sale igual, **sin el bloque de zona**, sin un hueco donde iba y sin la leyenda
"sin zona".

## 5. Que la libreria no viaje de arranque (SC-006)

Con la pestaña de red abierta, cargar `http://localhost:3000/contacto` y navegar
por el sitio **sin tocar el boton**. No tiene que descargarse ningun trozo de
jsPDF. Recien al tocar *Imprimir resumen* aparece esa request.

Y para FR-015: con la red cortada desde las herramientas del navegador, tocar el
boton. **Tiene que decir que no pudo**, con un mensaje visible. Si no pasa nada,
esta mal — es el mismo sintoma que el 2026-08-14 hizo parecer roto el boton de
confirmar.

## 6. El telefono

Lo unico que no se puede dar por hecho desde la maquina de desarrollo. Con el
sitio servido por LAN (ver la nota de `docs/processes/` sobre probar en el
telefono: `npm run dev` no alcanza), abrir el sitio en el telefono y tocar el
boton.

**Lo que hay que ver es que el archivo LLEGUE y se abra.** Donde aterrice —la
carpeta de descargas, un visor de PDF, la hoja de compartir— **da igual, las tres
son correctas** (FR-017): la persona iba a imprimir desde el visor de todos
modos. El unico resultado incorrecto es que no pase nada.

Cerrar el `npm run dev` al terminar.
