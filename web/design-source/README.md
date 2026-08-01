# design-source

Material fuente y generadores de los assets de `web/public/`. Esta carpeta
**no se sirve** (Next.js solo publica `public/`), es solo para poder rehacer
las imágenes sin partir de cero.

Los scripts usan `sharp`, que ya viene como dependencia de Next.

## `mapa-zonas-flash-urbano.jpeg`

Mapa de zonas con precios que se muestra en `/sobre-nosotros`.

```bash
cd web
node design-source/build-map.js \
  design-source/mapa-costos-original.jpeg \
  public/mapa-zonas-flash-urbano.jpeg \
  12
```

Entrada: `mapa-costos-original.jpeg`, la captura de Google Maps que entregó el
cliente con las divisiones de zona trazadas a mano y los precios.

Qué hace: detecta las líneas negras dibujadas y la costa como barreras,
rellena cada zona por *flood fill* partiendo de su etiqueta, y compone los
rellenos semitransparentes, las etiquetas recoloreadas y el panel de leyenda.

El tercer argumento es el **radio de dilatación** (12 por defecto). Existe
porque las líneas que trazó el cliente son polilíneas **abiertas**: no cierran
polígonos, se cortan antes de llegar a la costa o al borde. Dilatar la barrera
cierra esos huecos. El valor cambia el resultado, así que **los límites del
mapa son una interpretación, no un dato exacto** — ver la advertencia abajo.

### Advertencias

- **Los límites no están validados por el cliente.** Se derivaron de las
  líneas dibujadas y de cerrar los extremos abiertos. Antes de tratarlos como
  fuente de verdad para cobrar, el cliente tiene que confirmarlos.
- **Las zonas 3 y 5 se cortan en el borde de la imagen.** En la realidad se
  extienden más al oeste y al este; la captura no las contiene enteras.
- **La base es una captura de Google Maps.** Publicarla modificada y sin
  atribución en un sitio comercial no cumple los términos de Google. Si el
  mapa se va a mantener a largo plazo, conviene rehacerlo sobre tiles de
  OpenStreetMap, que permiten esto citando la fuente.

## `logo-flash-urbano.png`

Versión con fondo transparente del logo, para usarlo sobre la sección azul del
home. En navbar y footer se usa el `.jpeg` original, porque el texto del logo
es blanco y sobre fondo claro no se leería.

```bash
cd web
node design-source/make-logo-transparent.js \
  public/logo-flash-urbano.jpeg \
  public/logo-flash-urbano.png
```

Borra el fondo azul con un flood fill desde los bordes, así respeta los
detalles internos que son del mismo azul (los centros de las ruedas), y
recorta al contenido.
