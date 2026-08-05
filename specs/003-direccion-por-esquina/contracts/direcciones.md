# Contrato — El módulo de direcciones

**Feature dir**: `specs/003-direccion-por-esquina` | **Date**: 2026-08-04

La interfaz que `web/lib/direcciones.ts` le expone al formulario. Existe para
cumplir FR-024: **el origen de la resolución de direcciones tiene que poder
cambiar sin tocar el formulario.** Hoy la implementación lee un archivo
estático; el día que haya backend con PostGIS será una consulta. Si el
formulario sólo conoce estas funciones, ese cambio no lo alcanza.

## Reglas que valen para todo el módulo

- **Funciones puras sobre el índice ya cargado**: sin `window`, sin red, sin
  estado global. Corren igual en el navegador que bajo Vitest. Es la misma
  disciplina que hace testeable a `zona-lookup.ts`, y por la misma razón.
- La carga del índice queda **afuera** de estas funciones. Quien las usa le
  pasa el índice ya resuelto.
- Ninguna función elige por el cliente cuando hay ambigüedad. Devuelven todos
  los candidatos; decidir es de la interfaz, y sólo con el cliente presente.
- Nada acá conoce zonas ni precios. La zona sale de `resolverZona()` en
  `web/lib/zona-lookup.ts`, que no se modifica.

## `cargarIndice`

Trae `calles-mvd.json` desde `public/`, una sola vez, la primera vez que se
necesita.

- **Devuelve** el índice listo para consultar.
- **Falla explícitamente.** Si no se puede cargar, el que llama tiene que poder
  distinguirlo de "no hay resultados" y decírselo al cliente. Un formulario
  mudo con el índice caído es peor que un error.
- Debe resolver la ruta con `asset()` de `web/lib/asset.ts`. Sin eso anda en
  local y da 404 en GitHub Pages, que es la peor forma de romperse.
- Es la única parte del módulo que toca la red, y por eso está separada del
  resto.

## `buscarCalle`

Sugerencias de calle a partir de lo que el cliente viene tipeando.

- **Recibe** el índice y el texto tipeado.
- **Devuelve** calles que coinciden, ordenadas por cercanía a lo tipeado, con
  un tope razonable de resultados — una lista de 300 nombres no es una
  sugerencia.
- Compara sobre el nombre normalizado y sobre el canónico, así `18 de julio`,
  `18 de Julio` y `Avenida 18 de Julio` llegan al mismo lugar, y `Garzon`
  encuentra `Garzón` (FR-003).
- Texto vacío o demasiado corto devuelve nada, no todo.

## `buscarEsquinaDe`

Las calles que **efectivamente cruzan** una calle ya elegida (FR-009).

- **Recibe** el índice, la calle elegida y el texto tipeado.
- **Devuelve** sólo calles con las que existe una esquina en el índice.

Es lo que impide que el cliente arme un cruce que no existe: si nunca se le
ofrece, no lo elige. El chequeo de FR-004 —"esa esquina no existe"— queda como
red de contención, no como camino habitual.

## `buscarEsquina`

Resuelve un par calle/esquina a puntos concretos.

- **Recibe** el índice y las dos calles.
- **Devuelve una lista**, no un resultado. Vacía si no se cruzan; con más de un
  elemento si se cruzan más de una vez o si hay homónimas en barrios distintos.

**Devolver siempre una lista es deliberado.** Una firma que devolviera "la"
esquina obligaría a elegir una adentro, y elegir una en silencio es adivinar
una zona, o sea adivinar un precio (Principio V, FR-021).

## `regionPermitida`

La región donde el pin puede moverse, a partir de una esquina resuelta y de
cuál de las dos calles es la declarada.

- **Recibe** la esquina y cuál de sus dos calles es `calle` (la que lleva el
  número de puerta).
- **Devuelve** la región: el buffer alrededor de la polilínea `contigua
  anterior → esquina → contigua siguiente` sobre esa calle.
- Si falta una contigua —la esquina es la punta de la calle— ese lado se acota
  con la esquina misma.

Se calcula sobre `calle` y no sobre `esquina` porque la puerta pertenece a la
calle; la esquina sólo la ubica.

## `contiene` y `acercarALaRegion`

El par que sostiene el clampeo de FR-015.

- `contiene` responde si un punto cae dentro de la región.
- `acercarALaRegion` devuelve el punto permitido más cercano a uno que quedó
  afuera.

`acercarALaRegion` es lo que permite **clampear en vez de rechazar**: al soltar
el pin afuera vuelve solo al borde, y el estado inválido no llega a existir.
Sin esta función el formulario sólo podría rechazar al enviar, que es
exactamente lo que el spec descartó.

## Lo que este contrato NO tiene

- **`puntoACalle`** — la entrada inversa quedó fuera de alcance. El flujo
  acordado es dirección primero, pin después. Cuando exista, entra acá.
- **Numeración domiciliaria.** No hay dato. El número de puerta es texto que
  viaja con el pedido y no ubica nada.
- **Zonas y precios.** Los resuelve `zona-lookup.ts`, que este módulo no toca.

## Qué se prueba de este contrato

En `web/lib/direcciones.test.ts`:

- **El fixture de esquinas conocidas** (SC-002, research R6): al menos 30
  esquinas de Montevideo con coordenadas **confirmadas por una persona contra
  un mapa real**, y la prueba falla si alguna resuelve a más de 30 m. No las
  puede generar el mismo proceso que se quiere verificar.
- Las variantes de nombre encuentran la misma calle: `18 de julio`,
  `18 de Julio`, `Avenida 18 de Julio`; `Garzon` y `Garzón`.
- `buscarEsquinaDe` nunca ofrece una calle con la que no exista esquina.
- Un par con más de un cruce devuelve todos los candidatos, no el primero.
- Un punto fuera de la región vuelve al borde, y el devuelto sí está adentro.
- Una esquina que es punta de calle no rompe `regionPermitida`.
