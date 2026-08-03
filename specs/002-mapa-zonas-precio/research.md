# Phase 0 — Research

**Feature**: `specs/002-mapa-zonas-precio` | **Date**: 2026-08-02

Resuelve lo que el spec dejó diferido a planificación y las trampas conocidas
de montar Leaflet dentro de Next 16 con export estático bajo `basePath`.

---

## D1 — Librería de mapa: Leaflet plano, sin `react-leaflet`

**Decisión**: dependencia runtime `leaflet`, más `@types/leaflet` en dev. El
ciclo de vida del mapa se maneja a mano dentro de un `useEffect`.

**Razón**: son dos usos del mismo componente. `react-leaflet` es una capa de
binding que se paga cuando hay muchos componentes de mapa componiéndose entre
sí; acá agrega una dependencia más, un peer-range que atar a React 19, y una
indirección para envolver tres llamadas de Leaflet. El Principio III de la
constitución (YAGNI) empuja para el otro lado.

**Alternativas consideradas**:
- `react-leaflet` — descartada por lo anterior. Reconsiderar si aparecen varios
  mapas con estado compartido.
- MapLibre GL — mosaicos vectoriales, mejor render, pero pesa bastante más y
  las fuentes de estilo gratuitas suelen pedir clave de API. El sitio es
  estático: una clave quedaría en el bundle. Descartada.
- SVG propio sin librería — ya descartada al elegir el render: sin calles de
  fondo el cliente no puede ubicar su casa, y de esa ubicación depende el
  precio.

---

## D2 — Proveedor de mosaicos: los servidores estándar de OSM

**Decisión**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, con la
atribución obligatoria visible en el mapa (FR-008).

**Razón**: cierra lo que `/speckit-clarify` dejó marcado. Hay **dos permisos
distintos y conviene no mezclarlos**:

| | Qué cubre | Estado |
|---|---|---|
| Licencia de los *datos* (ODbL) | Usar y mostrar la cartografía, incluso comercialmente | Permitido citando la fuente |
| Política de uso de los *servidores* de mosaicos | Descargar los PNG desde la infraestructura donada de OSMF | Pensada para volumen bajo |

El sitio de una mensajería de un operador está muy por debajo de lo que esa
política considera problemático. Lo que exige y este plan cumple: atribución
visible, sin descarga masiva, sin reempaquetar mosaicos.

**Condición de revisión**: si el tráfico crece, o si aparecen mosaicos rotos de
forma sistemática, mover a un proveedor pago o a servidores propios. Es un
cambio de una línea (la URL del `TileLayer`), no un rediseño — por eso no se
paga por adelantado.

**Alternativas consideradas**: Carto y Stadia (buenos, pero clave de API o
registro para uso comercial, incompatible con un sitio estático sin backend);
mosaicos propios (infraestructura que este proyecto no tiene por qué tener).

---

## D3 — El dato de zona se importa, no se descarga

**Decisión**: `build-zonas.js` genera `web/lib/zonas.ts`, un módulo TypeScript
que se commitea y se importa. No se sirve un `.geojson` desde `public/`.

**Razón**: la resolución de zona determina cuánto se cobra. Si el dato llega
por `fetch`, el precio queda atado a que esa request salga bien, y hay que
inventar estados de carga y de error para algo que puede ser una constante.
Importándolo, existe en el momento en que corre el componente. Cuesta ~40KB de
coordenadas en el bundle, que a cambio de eso está bien pagado.

Como módulo TS además tipa las zonas y el compilador atrapa un archivo generado
a medias, cosa que un JSON suelto no hace.

**Alternativa considerada**: `public/zonas.geojson` + `fetch`. Más chico el
bundle inicial, pero mete red en el camino del precio y obliga a manejar su
falla. Descartada.

---

## D4 — Leaflet dentro de Next 16: cliente y sin SSR

**Decisión**: `mapa-zonas.tsx` lleva `"use client"`; se importa desde
`mapa-zonas-dinamico.tsx` — **también `"use client"`** — vía
`dynamic(() => import("./mapa-zonas"), { ssr: false })`.

**Razón**: Leaflet toca `window` al evaluarse el módulo, así que revienta si se
prerenderiza. La doc de Next 16 en el repo
(`web/node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`) es
explícita:

> `ssr: false` option will only work for Client Components, move it into Client
> Components ensure the client code-splitting working properly.

O sea que el wrapper con `dynamic` no puede vivir en un Server Component.
`app/sobre-nosotros/page.tsx` es Server Component (exporta `metadata`), así que
importa el wrapper cliente, no `dynamic` directo.

---

## D5 — Marcador como `divIcon`, no la imagen por defecto

**Decisión**: el marcador se construye con `L.divIcon` y estilos propios. No se
usa `L.Icon.Default`.

**Razón**: `L.Icon.Default` referencia PNGs de `leaflet/dist/images/` armando
la URL en runtime. Es un problema conocido con bundlers, y acá se agrava: en
GitHub Pages el sitio vive bajo `basePath` `/flash-urbano`, y esas URLs no lo
llevan — daría 404 y el marcador no se vería, exactamente el elemento del que
depende el precio. Es el mismo problema que `web/lib/asset.ts` ya documenta
para las imágenes de `public/`.

Un `divIcon` es HTML y CSS: sin request, sin ruta que prefijar, y se estiliza
con Tailwind como el resto.

---

## D6 — Gestos en mobile (FR-019)

**Decisión**: `scrollWheelZoom: false`, zoom por controles y por pinch; arrastre
con un dedo para desplazar el mapa; alto generoso y fijo del contenedor.

**Razón**: el conflicto real es que el mapa se coma el scroll de la página. Con
la rueda desactivada, en desktop la rueda hace scroll de la página como el
usuario espera, y el zoom queda en los botones `+`/`−`. En mobile, el pinch
hace zoom y el arrastre desplaza el mapa — que es lo que alguien espera al
tocar un mapa que le están pidiendo que use.

**Alternativa considerada**: exigir dos dedos para desplazar (lo que hacen los
embeds de Google Maps). Protege más el scroll, pero acá el mapa **no** es
decorativo: es un campo obligatorio del formulario, y agregarle fricción al
gesto principal choca con el Principio IV. Descartada.

**Verificación**: manual en 375px, es SC-006. No hay forma barata de
automatizarlo y este plan no monta infraestructura de tests de UI.

---

## D7 — Detección de mosaicos caídos (FR-020)

**Decisión**: suscribirse a `tileload` del `TileLayer`. Si a los **8 segundos**
del montaje no cargó **ningún** mosaico, se marca la fuente como no disponible
y se emite hacia arriba.

> **Corregido durante la implementación (T009).** El criterio original era
> "≥1 `tileerror` y 0 `tileload`", y tenía un hueco: una conexión que cuelga sin
> emitir `tileerror` nunca lo dispara, así que el estado se quedaba en
> `cargando` para siempre y el formulario quedaba trabado sin decir nada. El
> mapa está igual de inservible con 0 mosaicos haya habido error o no, así que
> el criterio es la ausencia de cargas. `tileerror` deja de mirarse.

**Por qué 8 segundos y no un valor cualquiera**: este umbral bloquea pedidos, así
que no puede quedar a criterio de quien implemente. Corto de más, una red móvil
lenta bloquea una venta legítima; largo de más, el cliente mira un hueco sin
entender qué pasa. 8 s está cómodamente por encima de lo que tarda un mosaico
en una 3G mala y bastante por debajo de los 15 s de SC-001.

**Razón**: es la señal que Leaflet ya da; no hace falta sondear la red. La
regla "errores y ninguna carga" evita el falso positivo del mosaico suelto que
falla en una red mala mientras el resto entra bien — ahí el mapa es
perfectamente usable y sería absurdo bloquear un pedido.

El consumidor decide qué hacer, que es distinto en cada superficie: en el
formulario bloquea el envío (FR-020), en `/sobre-nosotros` solo degrada a
texto. Por eso el componente **reporta** el estado en vez de decidirlo.

---

## D8 — Punto en polígono: ray casting propio

**Decisión**: implementación propia en `web/lib/zona-lookup.ts`. Sin Turf.js ni
equivalentes.

**Razón**: el algoritmo son unas veinte líneas y ya está validado el dato de
entrada (polígonos cerrados, sin solapamientos). Turf trae un árbol de módulos
geoespaciales para usar una función. Principio III.

**Desempate determinista (FR-018)**: las zonas se evalúan en orden 1→5 y gana
la primera que contenga el punto. Sobre un borde compartido no hay respuesta
correcta; hay que garantizar que sea **siempre la misma**, y un orden fijo lo
garantiza. Queda documentado en el contrato y cubierto por un test.

**Coordenadas**: se trabaja en lat/lng crudos, sin proyectar. A la escala de
Montevideo la distorsión es irrelevante para decidir de qué lado de una avenida
cae un punto, y proyectar agregaría una fuente de error propia.

---

## D9 — Vitest acotado a `web/lib/`

**Decisión**: Vitest como devDependency, `vitest.config.ts` en `web/`, script
`"test": "vitest run"`, y tests únicamente sobre la resolución de zona.

**Razón**: ver Complexity Tracking en `plan.md`. Vitest lee TypeScript sin
configuración extra y no choca con el toolchain de Next.

**Explícitamente fuera**: tests de componentes, de UI y end-to-end. Montar
jsdom y una librería de testing de React para este feature sería la
infraestructura especulativa que el Principio III prohíbe. Lo que se testea es
lo que decide plata.

---

## Riesgos abiertos que este plan no cierra

| Riesgo | Por qué queda abierto |
|---|---|
| Un tramo de polígono corrido respecto de su calle | Solo se detecta a ojo sobre el mapa real. Es SC-004, paso de verificación durante Execute, empezando por Zona 5 por ser la más cara. |
| Punto marcado sobre el eje de una avenida límite | Aceptado en el spec: la calle tiene ancho, el polígono es una línea. El desempate es determinista pero arbitrario. |
| Política de uso de los mosaicos de OSM si crece el tráfico | Ver D2. Revisión, no bloqueo. |
