# Research: El borde corregido de la zona 5 llega al sitio

**Fecha**: 2026-09-05

Todo lo de aca esta **medido**, no supuesto. El metodo es siempre el mismo:
parsear los dos KML —el de `HEAD` y el del working tree—, armar los cinco
anillos de cada uno, y resolver una grilla de ~50 m (`0.00045°`, 380.462 puntos)
sobre el area total con **una copia exacta de la regla del sitio**: el mismo ray
casting de `web/lib/zona-lookup.ts` y la misma seleccion de
`resolverZonaEntre` —menor precio, desempate por id menor—.

Que sea una copia y no la funcion real es deliberado: `zonas.ts` todavia tiene el
trazado viejo, asi que la funcion real no puede contestar por el nuevo. La copia
se verifico contra los cinco puntos de referencia de `zona-lookup.test.ts`, que
devuelven lo mismo que la implementacion.

## D1 — Que cambia el trazado, exactamente

**Decision**: El trazado modifica **dos** poligonos, `Zona 5` y `Zona 1`, y el
efecto neto es cobertura nueva al este mas un borde corrido.

| | vertices antes | vertices ahora |
|---|---:|---:|
| Zona 1 | 119 | 128 |
| Zona 2 | 125 | 125 |
| Zona 3 | 110 | 110 |
| Zona 4 | 81 | 81 |
| Zona 5 | 24 | 32 |

Sobre la grilla, cuatro transiciones y ninguna otra:

| transicion | puntos | ~area | lectura |
|---|---:|---:|---|
| `Zona 1 -> Zona 5` | 135 | 0,34 km2 | el borde se movio |
| `fuera -> Zona 5` | 82 | 0,21 km2 | **cobertura nueva** |
| `Zona 5 -> fuera` | 44 | 0,11 km2 | fleco de borde |
| `Zona 1 -> fuera` | 35 | 0,09 km2 | fleco de borde |

Un ejemplo de cada uno, para usar como caso de prueba:

- gana zona 5 donde no habia nada: `-34.867420, -56.008911`
- pasa de zona 1 a zona 5: `-34.881820, -56.035011`
- deja de tener zona: `-34.881820, -56.033211`

**Rationale**: El pedido del cliente decia "modificar mapa zona 5" y el archivo
toca dos zonas. No es un error —mover un limite reescribe los dos anillos, porque
en KML cada zona es un anillo cerrado independiente— pero cambia que hay que
verificar y que hay que contarle al cliente.

**Alternatives considered**: Mirar solo la zona 5, que es lo que el pedido
literalmente nombra. Rechazado: habria dado por bueno cualquier desalineacion
entre los dos anillos, que es justamente el modo de falla de este cambio.

## D2 — Los 79 puntos que pierden cobertura son fleco, no hueco

**Decision**: Se publica el trazado tal cual. La perdida de cobertura es
resolucion de grilla sobre un borde que se movio, no un agujero.

La primera lectura de D1 asusta: 79 puntos de grilla (~0,2 km2) que tenian zona
y dejan de tenerla, 35 de ellos saliendo de una zona que nadie pidio tocar. Se
midio en tres pasos y cada uno acoto mas el problema:

1. **Forma.** Agrupados por vecindad de 8, los 79 caen en 16 manchas: una de 60
   puntos con **grosor medio de ~78 m** repartida sobre una caja de 1249 × 1926 m,
   y quince manchas de 1 a 4 puntos ensartadas en una diagonal. Todo fino y
   pegado a una linea; nada con cuerpo.
2. **Distancia al borde.** Los puntos sueltos estan a **2, 3, 6, 10, 19 m** del
   anillo nuevo de la zona 1. Estan encima del borde, no adentro de un hueco.
3. **Profundidad, que es la medida que decide.** Para cada punto perdido, la
   distancia al punto de grilla mas cercano que **si** sigue cubierto:
   **mediana 41 m, p90 65 m, maximo 96 m. Cero puntos a mas de 100 m.**

O sea: nadie queda a mas de una cuadra de la cobertura. Con una grilla de 50 m,
un borde que se corre 30 m produce exactamente este fleco.

**Rationale**: La pregunta que importa no es "cuantos puntos perdieron zona"
sino "hay alguna direccion que quede aislada". La respuesta medida es no.

**Alternatives considered**:

- **Volver el trazado y pedirle a Diego que lo redibuje.** Rechazado: no hay
  defecto que corregir. Se le habria hecho repetir un trabajo bien hecho.
- **Coser los dos anillos a mano para que compartan vertices exactos.** Rechazado
  por dos motivos. Es editar el KML por fuera de lo que el cliente dibujo, que es
  lo que la constitucion prohibe; y no hay nada que coser: los dos anillos **no se
  solapan en ningun punto de la grilla**, ni en el trazado viejo ni en el nuevo,
  asi que no hay costura defectuosa sino dos bordes que corren cerca.

## D3 — El desempate no interviene aca, y el spec decia lo contrario

**Decision**: Se corrigio el spec. No se toca `zona-lookup.ts`.

El borrador de este spec afirmaba que sobre el borde compartido "gana la Zona 1
porque `resolverZona()` recorre por id ascendente y devuelve el primer match".
**Las dos mitades estan mal.** La regla real, desde `004` y por respuesta del
cliente del 2026-08-06, es **gana el menor precio**; el id solo desempata
precios iguales (hoy, zonas 3 y 4, las dos $250). Y medido: zona 1 y zona 5
**no comparten ni un punto de grilla**, asi que la regla no llega a intervenir
entre ellas ni antes ni ahora.

De donde salio el error: **el comentario de cabecera de
`web/design-source/build-zonas.js` lo dice asi**, y lo repite en el encabezado que
escribe dentro de `zonas.ts`. Quedo desactualizado en `004`, cuando la regla paso
a ser por precio, y describe mal justo la funcion que decide la cobertura. Es un
comentario a un renglon de distancia de quien vaya a "mejorar" `resolverZona`
convirtiendola en un primer-match.

**Rationale**: Se corrige en este feature, como paso declarado del plan y no como
limpieza oportunista, porque es el unico feature que va a abrir ese archivo y
porque el comentario ya indujo un error documentado —este mismo spec— en el
primer intento.

**Alternatives considered**: Anotarlo en `docs/tech-debt-tracker.md` y no
tocarlo. Rechazado: cuesta una linea de comentario en un archivo que este plan
ya cubre, y dejar escrito el mecanismo equivocado al lado del codigo correcto es
mas caro que arreglarlo.

## D4 — El precio sigue en `zonas.ts` y sigue sin poder leerse para nada

**Decision**: `build-zonas.js` sigue escribiendo `precio` por zona y no se toca.

Es tentador sacarlo: desde `013` no se muestra en ningun lado. Pero **no es la
misma columna que el Principio V prohibe leer**. Lo que la constitucion declara
ficcion es `pedidos.precio`, el monto guardado con cada pedido. El `precio` de
`zonas.ts` es la tabla de precios por zona, y **`resolverZonaEntre` la lee para
desempatar**: sacarla cambiaria la regla de seleccion, que es una respuesta del
cliente, no una convencion del codigo.

Que la decision de cobertura dependa hoy de una lista de precios que el producto
ya no publica es una rareza real, y queda anotada como tal. No se resuelve aca:
este feature corrige un borde.
