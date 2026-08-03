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
importando el módulo, los polígonos viajan en el bundle y el cálculo del precio
no depende de que salga bien una request. El precio es en firme, así que no
conviene atarlo a la red.

El script **falla ruidosamente** si un anillo no cierra, si falta una zona o si
un nombre no mapea a un precio conocido. Un archivo generado a medias es peor
que ninguno cuando de él depende cuánto se le cobra a alguien.

**Los precios viven en una tabla dentro de `build-zonas.js` y en ningún otro
lado.** Para cambiar uno, se edita ahí y se regenera.

### Corregir un límite

No se toca código. Se corrige el trazado en Google My Maps, se reexporta el KML
sobre `zonas-flash-urbano.kml`, se regenera `lib/zonas.ts` y se corre
`npm test` — hay un test que verifica que todos los anillos cierren.

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
