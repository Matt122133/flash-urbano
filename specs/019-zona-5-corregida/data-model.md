# Data Model: El borde corregido de la zona 5 llega al sitio

**Ninguna forma cambia en este feature.** Cambian valores dentro de una forma que
ya existe desde `002`. Este archivo esta para dejar claro cual es el dato
autoritativo y cual es su copia, porque confundirlos es lo que hizo que el
trabajo se diera por hecho sin estarlo.

## La cadena del dato

```text
zonas-flash-urbano.kml   fuente autoritativa, editada por el cliente
        |
        |  node design-source/build-zonas.js  (paso manual, no automatico)
        v
web/lib/zonas.ts         generado, versionado, importado por el sitio
        |
        v
resolverZona(lat, lng)   decide si el envio se toma
```

El eslabon fragil es la flecha del medio: **no la corre nadie sola**. Un KML
editado y no regenerado deja los dos archivos discrepando en silencio, que es el
estado en el que este feature encontro el repo.

## Zona

Sin cambios de campos. Se transcribe para poder hablar de `anillo` y `precio` sin
ambiguedad.

| campo | tipo | que es |
|---|---|---|
| `id` | `1..5` | identidad de la zona. Ordena la lista en `zonas.ts`. |
| `nombre` | texto | `"Zona 5"`, tal como viene del KML ya normalizado. |
| `precio` | entero | pesos. **No se muestra desde `013`.** Lo lee `resolverZonaEntre` para desempatar cuando dos zonas contienen el punto — ver D4 de [research.md](research.md). |
| `color` | hex | el relleno en el mapa. |
| `anillo` | `[lat, lng][]` | los vertices, cerrado: el primero es igual al ultimo. **Es lo unico que este feature cambia.** |

### Reglas que el generador ya impone, y que siguen valiendo

- Nombre de placemark distinto de `Zona <n>` → falla ruidosamente.
- Zona repetida o zona faltante → falla.
- Anillo con menos de 4 vertices, o que no cierra → falla.
- Coordenada no numerica → falla.

Un generado a medias no se escribe. Eso importa mas que de costumbre aca: el
archivo que produce decide si se le toma el pedido a alguien.

## Que cambia, en numeros

| | antes | ahora |
|---|---:|---:|
| vertices de `Zona 1` | 119 | 128 |
| vertices de `Zona 5` | 24 | 32 |
| vertices totales | 459 | 476 |

Zonas 2, 3 y 4: identicas, verificado vertice a vertice.

## Lo que NO es parte de este modelo

`pedidos.precio` en la base. Es otra cosa y esta bajo otra regla: guarda lo que
la regla vieja habria cobrado, y el Principio V prohibe leerlo. Este feature no
lo mira, no lo recalcula y no reclasifica ningun pedido ya guardado — un pedido
conservo su punto y su zona del dia que se creo.
