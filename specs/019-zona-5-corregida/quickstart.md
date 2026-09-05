# Quickstart: comprobar el borde nuevo

`verify:` prueba que el codigo compila y que las zonas conocidas siguen
resolviendo igual. **No prueba que el trazado sea el que Diego pidio** — eso es
FR-008 y es una mirada humana. Esto es como se hace esa mirada.

## Prerequisitos

```bash
cd web
npm install     # si es la primera vez en este clon
```

## 1. Regenerar y ver que dice el generador

```bash
cd web
node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts
```

Esperado, exactamente:

```text
escrito lib/zonas.ts
  Zona 1: $150, 128 vertices
  Zona 2: $200, 125 vertices
  Zona 3: $250, 110 vertices
  Zona 4: $250, 81 vertices
  Zona 5: $350, 32 vertices
total 5 zonas, 476 vertices
```

**128 y 32 son el control.** Si dice 119 y 24, el KML que se leyo es el viejo. Si
el comando falla, el defecto esta en el KML y no en el generador: falla a
proposito antes que escribir un archivo a medias.

```bash
git diff --stat lib/zonas.ts    # tiene que haber cambiado
```

## 2. Las pruebas

```bash
cd web
npm test
```

Las cinco referencias de barrio de `lib/zona-lookup.test.ts` tienen que seguir en
verde, mas el caso nuevo que este feature agrega: un punto en el tramo que la
zona 5 gano.

**Control positivo, y no es opcional.** Para saber que el caso nuevo prueba algo,
revertir `lib/zonas.ts` al trazado viejo y correr `npm test`: **tiene que quedar
en rojo** en ese caso y solo en ese. Si queda verde, el caso esta puesto en un
lugar que ya estaba cubierto antes y no prueba nada.

```bash
git stash push lib/zonas.ts && npm test   # el caso nuevo debe FALLAR
git stash pop
```

## 3. Comprobar que lo de afuera sigue afuera (FR-006)

Esta mitad **no la cubre ninguna prueba automatica** y el trazado nuevo cambia
cuales son los puntos de afuera, asi que se mira a mano.

```bash
cd web
npm run dev
```

En `http://localhost:3000/pedido`, marcar una entrega claramente fuera de toda
zona (por ejemplo bien al norte, pasando Paso de la Arena). Esperado:

- **No deja confirmar.**
- **Ofrece el contacto directo.**
- **No nombra una zona cercana** ni sugiere una alternativa — Principio V: nunca
  la zona mas cercana.
- **No muestra ningun monto**, ni ahi ni en ninguna otra parte del flujo.

## 4. Mirar el mapa (FR-008 — esto es lo que le mostras a Diego)

Con el mismo `npm run dev` del paso anterior, abrir
`http://localhost:3000/sobre-nosotros` y mirar el mapa. Tres cosas:

1. **La zona 5 llega mas al este** que antes, sobre la Ciudad de la Costa.
2. **El borde entre la zona 1 y la zona 5 corre por donde Diego lo quiso.** Es el
   tramo que se movio y es lo unico que hay que confirmar con el.
3. **No hay una franja blanca entre las dos zonas.** Medido: no la hay, y el
   maximo alejamiento de un punto que perdio cobertura es 96 m. Pero se mira,
   porque una franja de una cuadra se ve en el mapa y no se ve en una prueba.

Y en `http://localhost:3000/pedido`, marcar una entrega en el tramo nuevo
(alrededor de `-34.8674, -56.0089`): el sitio tiene que confirmar que se llega,
nombrando la zona 5, **sin mostrar ningun monto**.

Cerrar el `npm run dev` al terminar.

## 5. Lo que hay que contarle a Diego antes de mergear

No es un paso tecnico y es el que decide si esto sale. **Va antes del merge y no
antes del despliegue**, porque en este repo son el mismo acto: un push a `master`
que toque `web/**` publica solo, via `.github/workflows/deploy-pages.yml`.

- Gana ~0,21 km2 de cobertura nueva al este, que antes no se podia pedir.
- **135 puntos de grilla pasan de zona 1 a zona 5**, ~0,34 km2. El pedido decia
  "modificar mapa zona 5" y esto tambien cambia zona 1. Como el precio no se
  muestra, lo que cambia para el cliente es el nombre de la zona; para Diego
  cambia de que lado del borde esta trabajando.
- El borde se corre menos de una cuadra en los flecos. Nadie queda aislado.

Si algo de eso no es lo que quiso, **se corrige el KML y se vuelve al paso 1**.
Nunca se ajusta `lib/zonas.ts` a mano.
