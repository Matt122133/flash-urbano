# design-source

Material fuente y generadores de assets. Esta carpeta **no se sirve** (Next.js
solo publica `public/`): existe para poder rehacer lo generado sin partir de
cero.

## Zonas de entrega

Los límites de las cinco zonas **los definió el cliente por nombre de calle**,
escritos sobre `mapa-costos-original.jpeg`, la captura que entregó. Ese archivo
se conserva por eso: es el documento donde están las calles y los precios.

Las calles están transcritas a texto en
[`specs/002-mapa-zonas-precio/spec.md`](../../specs/002-mapa-zonas-precio/spec.md)
§ Límites de zona. **Esa lista es la definición autoritativa**: si un polígono
se aparta de su calle, el defecto está en el polígono.

Esa regla se ejerció por primera vez el 2026-08-30: el cliente reajustó el
trazado de la **Zona 5**, que se había apartado por el este, y las calles no
cambiaron. O sea que se corrigió el polígono contra la lista, no al revés.

`zonas-flash-urbano.kml` son esos límites trazados sobre Google My Maps y
exportados. El cliente validó el resultado.

### Regenerar `web/lib/zonas.ts`

```bash
cd web
node design-source/build-zonas.js \
  design-source/zonas-flash-urbano.kml \
  lib/zonas.ts
```

Lee el KML, normaliza los nombres (el export trae `"Zona  4"` con un espacio
duro), le asigna a cada zona su precio y emite un módulo TypeScript tipado que
**se commitea**.

Se emite código y no un `.geojson` servido desde `public/` a propósito:
importando el módulo, los polígonos viajan en el bundle y decidir si una
dirección entra no depende de que salga bien una request. Sin esa respuesta no
hay pedido, así que no conviene atarla a la red.

El script **falla ruidosamente** si un anillo no cierra, si falta una zona o si
un nombre no mapea a un precio conocido. Un archivo generado a medias es peor
que ninguno cuando de él depende si a alguien se le toma el envío.

**Los precios viven en una tabla dentro de `build-zonas.js` y en ningún otro
lado.** Para cambiar uno, se edita ahí y se regenera.

### El precio ya no se muestra, pero el dato sigue acá

Desde el 2026-08-30 (`013`) **ninguna pantalla muestra un monto**: el cliente
acuerda el precio por su cuenta. Ver
[ADR price-not-shown](../../docs/decisions/price-not-shown.md) y el Principio V,
versión 5.0.0.

Lo que eso cambia acá: **nada**. El generador sigue teniendo su tabla de precios
y el módulo generado los sigue emitiendo, a propósito, para que volver atrás
cueste reponer una pantalla y no recalcular un historial. Lo que cambió es para
qué se usa el resultado — la zona decide **admisión**, no monto: un punto fuera
de las cinco no produce pedido y se encamina al contacto.

**Ese número no se lee para nada**, y el Principio V lo prohíbe explícitamente:
desde que dejó de mostrarse registra lo que la regla vieja habría cobrado, no lo
que se cobra.

Una guarda automática, `web/lib/sin-precio-a-la-vista.test.ts`, falla si el
precio vuelve a cruzar de `lib/` hacia `app/` o `components/`.

### Corregir un límite

No se toca código. Se corrige el trazado en Google My Maps, se reexporta el KML
sobre `zonas-flash-urbano.kml`, se regenera `lib/zonas.ts` y se corre
`npm test` — hay un test que verifica que todos los anillos cierren.

## Calles y esquinas de Montevideo

`web/public/calles-mvd.json` es el índice que le permite al formulario resolver
una dirección a partir de calle y esquina. Es **dato generado, no se edita a
mano**.

### De dónde salió el dato

La fuente son los **ejes viales que la Facultad entregó como material del curso
de TSIG** (Tecnólogo en Informática). El dueño de este repo cursó esa materia y
es coautor del trabajo donde se usó esa capa; autorizó su uso acá.

La capa original es una tabla de PostGIS con tres columnas —identificador,
nombre y geometría de línea en EPSG:4326— y cubre todo el país. **No tiene
numeración domiciliaria**: por eso el formulario ubica por cruce de calles y el
número de puerta es sólo informativo para el repartidor.

Los archivos `.sql` de origen pesan unos 65 MB y **no se versionan acá**: lo que
se commitea es el índice ya recortado y procesado. Quien necesite regenerarlo
tiene que conseguir esos archivos aparte. Es un paso manual y poco frecuente,
igual que reexportar el KML de zonas.

### Regenerar `web/public/calles-mvd.json`

```bash
cd web
node design-source/build-calles.js \
  <carpeta-con-los-sql> \
  public/calles-mvd.json
```

El script recorta al área de servicio, descarta los tramos sin nombre y los
rotulados con nombres genéricos de clasificación vial, calcula las
intersecciones geométricas reales entre ejes, colapsa las calzadas dobles y
resuelve las esquinas contiguas de cada calle.

Al terminar imprime cuántas calles y esquinas emitió y cuánto pesa el índice
crudo y comprimido. **Hay que mirarlo**: el techo comprimido es 1 MB, y las
referencias conocidas son ~5.746 calles y ~20.884 esquinas. Si los números se
apartan mucho, algo cambió en el dato de origen o en las reglas.

### Dos cosas que el script NO hace, a propósito

**No fusiona geometría por nombre canónico.** `Avenida José Pedro Varela` y
`José Pedro Varela` se encuentran juntas al *buscar*, pero sus geometrías no se
unen: al hacerlo, "josé pedro varela" pasaba a medir 15,6 km porque juntaba
calles homónimas de barrios distintos. Eso fabricaría esquinas entre calles que
nunca se tocan, y una esquina inventada es un precio inventado.

**No agrupa extremos compartidos en vez de intersectar.** Es mucho más barato,
pero la red no viene cortada en todos los cruces: el atajo pierde alrededor del 80% de las esquinas.

El detalle de ambas mediciones está en
[`specs/003-direccion-por-esquina/research.md`](../../specs/003-direccion-por-esquina/research.md).

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
detalles internos que son del mismo azul (los centros de las ruedas), y recorta
al contenido.

## Icono del sitio (la pestaña del navegador)

El camión del logo, blanco, sobre un cuadrado redondeado en el azul de marca
**`#032F9A`** — que no se eligió a ojo: es el azul exacto más frecuente del
propio logo.

```bash
cd web
node design-source/build-favicon.js
```

Emite tres archivos en `app/`, que Next resuelve **por convención de archivo**;
no hay que tocar `layout.tsx`:

| Archivo | Para qué |
|---|---|
| `app/favicon.ico` | 16, 32 y 48. Pestañas, y el `/favicon.ico` que el navegador pide por su cuenta |
| `app/icon.svg` | Pestañas modernas |
| `app/apple-icon.png` | 180×180, pantalla de inicio de iOS |

### Las tres decisiones, y por qué

**Sólo el camión, no el logo entero.** A 16×16 —el tamaño real de una pestaña—
el texto es una mancha gris. El camión es lo que se reconoce.

**Sobre azul, no sobre transparente.** Un camión blanco sobre nada desaparece en
las pestañas de tema claro, que son el default de Windows y de Chrome. Y como el
logo fue dibujado sobre ese azul, las contraformas del camión —ventana, huecos
de rueda, que quedaron transparentes al destondearlo— vuelven a asomar en azul
justo donde asomaban en el original.

**Los tamaños chicos usan un recorte distinto.** Hasta 24 px se recorta desde
`x=449`, o sea **sin las líneas naranjas de velocidad**. No es estética: se
renderizó a 16 px con las líneas y se miró al tamaño real — se comen el tercio
izquierdo en puro ruido y dejan al camión sin píxeles suficientes para leerse.
De 32 px para arriba sí entran, porque ahí ya se leen como movimiento.

### Dos cosas que conviene no perder

**El script recorta ajustado al contenido dentro de una región de búsqueda**, en
vez de usar coordenadas fijas. Si algún día se reprocesa el logo y el camión se
corre unos píxeles, el icono sigue saliendo bien; y si se corre mucho, el script
**falla ruidosamente** en vez de emitir un icono cortado que nadie va a mirar de
cerca.

**El SVG lleva el camión embebido como PNG, no vectorizado.** Vectorizar un
raster automáticamente da curvas sucias, y hacerlo a mano es dibujar un camión
nuevo — que es justo lo que este script existe para no hacer. El raster embebido
se limita a 200 px y va con paleta de 64 colores: sin eso el `icon.svg` pesa
**204 kB**, y lo descarga todo el que entra al sitio. Con eso, 5,8 kB.

### Verificar

Mirar el `.ico` **a 16×16, al tamaño real, sin ampliar**. La pregunta no es "¿se
ve algo?" sino "¿se distingue que es un camión?". Y probarlo en pestaña clara y
oscura, **en ventana privada**: el favicon se cachea con muchas ganas y es fácil
comprobar con satisfacción el icono anterior.
