# Phase 0 — Research: Dirección por cruce de calles

**Feature dir**: `specs/003-direccion-por-esquina` | **Date**: 2026-08-04

Todo lo de acá se midió sobre el dato real, no se estimó. Los scripts de
sondeo fueron descartables; lo que sobrevive son los números y las decisiones.

## R1 — ¿El dato alcanza para resolver esquinas de Montevideo?

**Decisión**: sí. Se calcula la intersección geométrica real entre ejes de
calle y eso produce **23.191 esquinas** dentro del recuadro de Montevideo.

**Cómo se llegó**: partiendo de los ejes viales del curso de TSIG (tabla
`ft_street`, sólo `gid`, `name`, `geom LineString 4326`), recortados al
recuadro de Montevideo:

| Medición | Valor |
|---|---|
| Tramos en el recuadro | 30.095 |
| Descartados por no tener nombre | 10.624 (35%) |
| Descartados por nombre genérico (`Vehicular/ Peatonal` y similares) | 445 |
| Polilíneas útiles | 19.026 |
| Nombres únicos | 6.184 |
| Segmentos rectos | 99.492 |
| Pares calle-calle con cruce | 22.541 |
| Puntos de cruce crudos | 66.746 |
| **Esquinas tras colapsar calzadas dobles** | **23.191** |
| Largo total de la red | 5.797 km |

**Alternativa rechazada**: agrupar extremos compartidos de tramos en vez de
intersectar de verdad. Es mucho más barato pero devuelve sólo 4.567 esquinas —
la red no viene cortada en todos los cruces, así que el atajo pierde el 80%.

> **Los números de esta tabla son del sondeo, no del índice final.** El sondeo
> recortó por un recuadro de Montevideo dibujado a mano; el script de build
> recorta por el área real de las cinco zonas más un margen (FR-006), que no es
> la misma superficie. El índice que se publicó tiene **5.746 calles y 20.884
> esquinas**, y pesa **0,47 MB comprimido**. Las conclusiones no cambian; las
> cifras de referencia para comparar una regeneración futura son las del índice,
> y están en `quickstart.md`.

## R2 — ¿La red tiene agujeros?

**Decisión**: no de forma significativa. Se puede construir sobre ella.

Sin ground truth externo, la medida usada fue la distribución de esquinas por
calle: una calle urbana real de varias cuadras tiene varias esquinas, así que
muchas calles largas con 0 o 1 esquina delatarían una red rota.

Sobre las 3.553 calles de más de 300 m:

| Esquinas | Calles | |
|---|---|---|
| 0 | 17 | 0,5% |
| 1 | 111 | 3,1% |
| 2 a 4 | 859 | 24,2% |
| 5 a 9 | 1.330 | 37,4% |
| 10 o más | 1.236 | 34,8% |

**96,4% tiene 2 o más.** Y las aisladas son lo que uno esperaría que lo esté:
`entrada Babuglia`, `caminería parque Punta Espinillo`, `entrada Dieppa` —
accesos rurales del norte del departamento, no calles de barrio.

**Nota metodológica, y vale la pena tenerla presente**: durante este sondeo dos
esquinas que yo daba por ciertas dieron cero cruces (`8 de Octubre` con
`José Pedro Varela`, `Rivera` con `Solano García`). Al medir la distancia entre
esas geometrías dieron 778 m y 2.051 m — no era un problema de tolerancia. Las
cuatro calles están bien representadas (68, 109, 140 y 9 esquinas
respectivamente), así que **el error era mi referencia, no el dato**. De ahí
sale una consecuencia para R6: el fixture de verificación no puede armarse de
memoria.

## R3 — Nombres: variantes y canonicalización

**Decisión**: canonicalizar **sólo para buscar**, nunca para fusionar
geometría.

El dato trae la misma calle bajo nombres distintos: `José Pedro Varela` y
`Avenida José Pedro Varela`, `Wilson Ferreira Aldunate` y
`Avenida Wilson Ferreira Aldunate`, `Juan Benito Blanco` y
`Bulevar Juan Benito Blanco`. Sacando el prefijo de tipo de vía (`avenida`,
`bulevar`, `calle`, `camino`, `pasaje`, `continuación`, `rambla`, `ruta`), los
6.186 nombres crudos colapsan a 5.868, con **276 grupos que tienen más de una
variante**.

**Por qué no fusionar la geometría**: al fusionar por nombre canónico,
`josé pedro varela` pasa a medir 15,6 km y `italia` 40,5 km. Ninguna avenida de
Montevideo mide eso. Está juntando calles homónimas de barrios distintos, que
son vías diferentes que casualmente comparten nombre. Fusionar produciría
esquinas inventadas entre calles que nunca se tocan — justo el error que el
Principio V prohíbe, porque una esquina inventada es un precio inventado.

Entonces: la identidad de una calle es su **nombre crudo**; el nombre canónico
es sólo una clave de búsqueda que hace que tipear "varela" encuentre todas sus
variantes, y que el cliente elija cuál.

**Normalización de búsqueda**: minúsculas, sin tildes, espacios colapsados.
Resuelve `18 de julio` / `18 de Julio` / `Avenida 18 de Julio` y
`Garzon` / `Garzón`.

## R4 — Calzadas dobles

**Decisión**: colapsar puntos del mismo par de calles que estén a menos de
~60 m entre sí, quedándose con el centroide.

Una avenida con cantero central son dos polilíneas paralelas, así que el cruce
con otra avenida igual genera hasta cuatro puntos. Antes de colapsar hay
66.746 puntos crudos para 22.541 pares; después quedan 23.191 esquinas.

Verificado: `Bulevar Artigas` con `Avenida Italia` pasó de 4 puntos a 1.
60 m cubre el ancho de una avenida con cantero sin llegar a fusionar dos
esquinas consecutivas, que en Montevideo están a 80-100 m.

## R5 — Tamaño del índice y cómo se sirve

**Decisión**: un archivo estático en `web/public/`, cargado bajo demanda con
`fetch` la primera vez que el cliente toca un campo de dirección. No entra al
bundle de JavaScript.

Medido sobre el índice de 6.184 nombres + 23.191 esquinas, con coordenadas a
6 decimales:

| | |
|---|---|
| JSON crudo | 0,88 MB |
| **JSON comprimido (gzip -9)** | **0,28 MB** |

SC-007 pone el techo en 1 MB comprimido: sobra margen, y ese margen es
justamente lo que va a consumir R7 (las cuadras). El archivo se referencia con
`asset()` de `web/lib/asset.ts`, que ya existe para resolver el `basePath` de
GitHub Pages — sin eso da 404 en producción y anda en local, que es la peor
forma de romperse.

**Alternativa rechazada**: emitir el índice como módulo TypeScript al estilo de
`web/lib/zonas.ts`. Las zonas son 5 polígonos y pesan poco; 0,88 MB dentro del
bundle penalizarían a todo el que entra al sitio, incluso a los que sólo miran
`/contacto`.

**Alternativa rechazada**: un archivo por calle, cargado al elegirla. Miles de
archivos diminutos en el repo y en el deploy, para ahorrar 0,28 MB.

## R6 — Cómo se verifica que las esquinas caen bien

**Decisión**: fixture versionado + prueba automática, según la respuesta 4 del
clarify.

El fixture es una lista de esquinas conocidas con su coordenada de referencia y
una tolerancia de 30 m. La prueba corre con `npm test`, no sólo al regenerar el
índice, y protege cada regeneración futura.

**Restricción que sale de R2, y es importante**: las coordenadas de referencia
del fixture **las tiene que confirmar una persona contra un mapa real**. No
sirve que las genere el mismo proceso que se quiere verificar (sería un test
tautológico), y tampoco sirve mi memoria de la geografía de Montevideo, que
en este mismo sondeo ya falló dos veces de cinco. Es una tarea con intervención
humana, y hay que planificarla como tal.

## R7 — La región donde se puede arrastrar el pin

**Decisión**: al construir el índice, guardar por esquina las coordenadas de
las **esquinas contiguas sobre cada una de las dos calles**. La región
permitida en tiempo de ejecución es el buffer alrededor de la polilínea
`esquina anterior → esquina elegida → esquina siguiente` sobre la calle
declarada.

Es lo que hace realizable "las dos cuadras adyacentes" (FR-014) sin embarcar la
geometría completa: son 4 puntos extra por esquina en vez de la polilínea
entera de cada cuadra.

**Presupuesto**: guardar esas coordenadas como **deltas contra la esquina, con
5 decimales** (~1 m de resolución, de sobra). Números chicos y repetitivos
comprimen mucho mejor que coordenadas absolutas. La tarea que genere el índice
**tiene que medir el tamaño final y comprobar que sigue bajo el techo de
SC-007**; si no entra, se cae a guardar sólo la distancia a la esquina contigua
en vez de su coordenada.

**Alternativa rechazada**: derivar las cuadras en tiempo de ejecución tomando
las esquinas más cercanas en línea recta sobre la misma calle. No necesita dato
extra, pero en una calle curva la esquina más cercana en línea recta puede
estar en otro tramo, y la región permitida degenera en un círculo — que es
exactamente lo que se descartó por no restringir nada en zonas densas.

**Alternativa rechazada**: embarcar la geometría completa de las calles
(186.144 vértices, ~4 MB). Rompe SC-007 por cuatro veces.

### R7b — Hubo que unir las polilíneas de cada calle (hallazgo de la ejecución)

Al implementar R7 apareció un problema que este research no había previsto: una
calle **no viene como una línea sino partida en varios tramos**, y calcular las
esquinas contiguas tramo por tramo corta la cuadra en cada juntura.

Medido sobre el primer índice generado: el **4,9%** de las esquinas quedaba con
región de largo cero y el **44,4%** con un solo lado. O sea que en la mitad de
los casos el pin se podía mover para un lado nomás, y en uno de cada veinte no
se podía mover.

La corrección es encadenar, antes de intersectar, las polilíneas del mismo
nombre que se continúan punta con punta — uniendo sólo junturas inequívocas,
donde se encuentran exactamente dos extremos, para no inventar continuidad en
una bifurcación. Resultado:

| | Antes | Después |
|---|---|---|
| Con las dos contiguas | 50,8% | **64,9%** |
| Con una sola | 44,4% | 31,1% |
| Sin ninguna | 4,9% | **4,0%** |
| Largo mediano de cuadra | 147 m | **178 m** |

El 4% restante degenera en un disco del radio del margen (50 m) en vez de una
cuadra. Sigue siendo una región usable, que es lo que importa: el pin se puede
mover, y sigue acotado.

## R8 — El combobox accesible

**Decisión**: escribirlo a mano siguiendo el patrón ARIA de combobox, sin
agregar dependencias.

El repo hoy tiene cuatro dependencias de producción (`leaflet`, `next`,
`react`, `react-dom`) y ninguna librería de componentes: todo lo visual es
Tailwind y componentes propios. Meter una librería headless por un solo control
contradice el Principio III, y una vez adentro se expande.

**El riesgo es real y hay que nombrarlo**: un combobox accesible hecho a mano
es de los controles que más se rompen. Por eso FR-023a y FR-023b son requisitos
con criterio de aceptación propio (SC-009) y no "lo revisamos después". Si al
implementarlo el patrón se vuelve inmanejable, la salida es agregar la
dependencia headless, no bajar la vara de accesibilidad.

**Alternativa rechazada**: `@headlessui/react`. Más confiable en accesibilidad,
pero es la primera librería de UI del repo por un único control.

## R9 — Entrada del build

**Decisión**: el script de build recibe por argumento la ruta a los archivos
`.sql` del curso; el repo versiona **el índice generado**, no la fuente.

La fuente son ~65 MB de `INSERT` que no aportan nada dentro de este repo. La
procedencia se documenta en `web/design-source/README.md` (FR-002), igual que
`build-zonas.js` documenta de dónde sale el KML. La diferencia con las zonas es
de tamaño: el KML son unos KB y se versiona; esto no.

**Consecuencia asumida**: quien regenere el índice necesita esos archivos a
mano. Es un paso manual, documentado, poco frecuente — el mismo trato que ya
tiene la regeneración de zonas.
