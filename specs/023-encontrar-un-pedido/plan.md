---
ticket: none
status: active
covers:
  # La lista, sus vacios, y el bloque de filtros que se monta arriba.
  - web/components/pedido/historial.tsx
  # Quien lee y escribe la URL de la cuenta: ahi se compone `ver` con `estado`.
  - web/app/perfil/
  # La decision de que pedido pasa el filtro, pura y sin React: es la UNICA
  # parte de este feature que puede tener pruebas automaticas en este repo.
  - web/lib/filtrar-pedidos.ts
  - web/lib/filtrar-pedidos.test.ts
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  # El sensor deja pasar los documentos de la raiz aunque no esten aca, pero
  # `AGENTS.md` prohibe editar fuera de `covers:`. Las dos reglas no dicen lo
  # mismo, y `022` ya paso por esa grieta sin resolverla: se nombra y listo.
  - ARCHITECTURE.md
verify: cd web && npm run lint && npm test && npm run build
analyzed: 2026-09-06
---

# Implementation Plan: Encontrar un pedido entre muchos

**Branch**: `023-encontrar-un-pedido` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

## Summary

*Mis pedidos* muestra hoy los 5 mas recientes y un "Ver todos" sobre una lista
que llega entera. Con cincuenta pedidos, encontrar **uno** es recorrerlos con el
ojo. Este plan agrega **un corte por estado y una busqueda por texto**, los dos
sobre lo que la respuesta ya trajo.

Tres cosas mandan sobre el diseño, y las tres salen de leer el repo:

- **La decision de que pedido pasa el filtro vive en `lib/`, no en el
  componente.** No es prolijidad: `vitest.config.ts` corre `lib/**/*.test.ts` en
  entorno `node`, y **no hay ninguna infraestructura para probar componentes**
  (fila `High` del tracker del 2026-08-22). Lo que quede adentro de
  `historial.tsx` no lo prueba nada. Es el mismo reparto que `010` hizo con
  `lib/repetir.ts`.
- **El filtro viaja en la URL y el texto buscado no** (FR-016, FR-017). La
  pantalla ya tiene el mecanismo desde `022` —`/perfil?ver=pedidos`, con
  `router.replace` y su limite de Suspense—, asi que esto **compone un parametro
  mas**, no inventa uno nuevo.
- **El naranja marca cual filtro esta puesto, y nada mas.** `--accent: #f97316`
  hoy significa "la accion principal" (el boton de *Crear pedido*), y el ambar es
  el lenguaje de los avisos. Un solo control naranja por pantalla mantiene los
  tres significados separados.

## Prerequisito, y no es opcional

**Esta rama salio de `master`, que todavia no tiene `022`.** Los tres archivos
que este plan toca son los que `022` acaba de modificar: `historial.tsx` (la
recarga tras dar de baja), `tarjeta-pedido.tsx` (los botones) y `perfil/page.tsx`
(el `?ver=`, que es justo el mecanismo que este feature extiende).

Implementar antes de que el PR #35 este mergeado significa **escribir sobre una
version vieja de esos archivos** y descubrirlo en el merge. Asi que: mergear
`022`, `git rebase` de esta rama sobre `master`, y recien ahi empezar.

## Technical Context

**Language/Version**: TypeScript 5 sobre Next.js 16.2 (App Router).

**Primary Dependencies**: ninguna nueva. La normalizacion de texto ya existe:
`normalizar()` de `web/lib/direcciones.ts` saca tildes y mayusculas, y es la
misma que resuelve las calles homonimas del indice de Montevideo.

**Storage**: ninguno. **El filtro no se guarda en ningun lado** — vive en la URL
(el estado) y en memoria (el texto).

**Testing**: Vitest en `web/`, entorno `node`, **solo sobre `lib/`**.

**Target Platform**: el sitio en el navegador, mayormente telefonos.

**Project Type**: web. **El backend NO se toca**: `GET /pedidos` ya devuelve todo
lo que hace falta. **La app Android NO se toca.**

**Performance Goals**: sin cambio. Filtrar 50 objetos en memoria no es un
problema de rendimiento y no se va a tratar como uno.

**Constraints**: `useSearchParams` obliga a un limite de Suspense o **el build
estatico falla**; ya existe en `/perfil` desde `022`.

**Scale/Scope**: dos controles, una funcion pura, dos vacios distintos.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio III — simplicidad sobre infraestructura.** Es el principio que mas
  manda aca: **no se agrega paginado ni filtrado del lado del servicio**. El
  umbral que lo justificaria (~300 pedidos por persona) esta medido y anotado
  desde el 2026-08-22, y esta lejos. Filtrar en pantalla lo que ya llego es la
  cosa mas simple que resuelve el problema dicho.
- **Principio IV — mobile-first, poco tecleo.** US1 se resuelve **sin escribir
  nada**, con un toque. La busqueda —que exige teclado— es P2 por eso mismo.
- **Principio V — nada de plata.** No se puede filtrar ni ordenar por precio, y
  ninguna superficie muestra un monto. La garantia es que el filtro no mira esos
  campos.
- **Ningun pedido sin cliente identificado.** La pantalla ya no muestra nada sin
  sesion, y este plan no cambia eso.
- **Datos de terceros.** FR-010 y FR-017: el texto buscado **no se guarda en el
  dispositivo ni viaja en la URL**, porque puede ser el nombre de quien recibe.
- **`covers:`** nombra archivos concretos y no `web/lib/` entero: este feature no
  tiene por que poder editar `api.ts`.
- **`verify:`** es solo la pata web, y es honesto: no se toca `backend/` ni
  `android/`.

Sin violaciones. Complexity Tracking queda fuera.

## Project Structure

### Documentation (this feature)

```text
specs/023-encontrar-un-pedido/
├── plan.md
├── spec.md
├── research.md      # las cuatro decisiones, con lo que se leyo del repo
├── quickstart.md
├── checklists/requirements.md
└── tasks.md         # lo escribe /speckit-tasks
```

Sin `data-model.md`: no cambia ninguna forma guardada, ni en la base ni en el
dispositivo. Sin `contracts/`: no hay endpoint nuevo ni parametro nuevo al
servicio.

### Source Code (repository root)

```text
web/
├── lib/
│   ├── filtrar-pedidos.ts       # la decision pura: que pasa el filtro
│   └── filtrar-pedidos.test.ts  # lo unico que este repo puede probar solo
├── components/pedido/
│   └── historial.tsx            # los controles, los dos vacios, el conteo
└── app/perfil/page.tsx          # compone `ver` con `estado` en la URL

backend/                         # NO SE TOCA
android/                         # NO SE TOCA
```

**Structure Decision**: la logica sale del componente a `lib/` **por la unica
razon que importa en este repo: es lo que se puede probar**. `historial.tsx`
queda con lo que ninguna prueba automatica va a mirar igual —dibujar los
controles y llamar a `router.replace`— y eso va al quickstart.

## Como se ejecuta

**1. La funcion pura, primero, con sus pruebas.** `filtrarPedidos(pedidos, {
estado, texto })` devuelve el subconjunto, en el mismo orden en que entro
(FR-009). Casos que las pruebas tienen que cubrir: el codigo con y sin prefijo y
en cualquier caja (FR-003), tildes en las dos direcciones (FR-004), **un estado
desconocido que no desaparece cuando no hay filtro** (FR-005), y que **ningun
campo de plata ni de direccion participe** (FR-014, FR-002).

**2. Los controles en `historial.tsx`.** Cuatro cortes excluyentes —todos,
pendientes, aceptados, entregados— y un campo de texto. El corte que esta puesto
va en naranja; los otros, en contorno. Los controles **no se dibujan** si la
lista no llego (FR-011).

**3. Los dos vacios**, que es donde este feature se rompe si sale mal: "todavia
no hiciste ningun envio" sigue siendo el de la lista vacia de verdad; el de cero
coincidencias dice eso y ofrece limpiar el filtro (FR-006).

**4. El recorte de 5 convive con el filtro.** Con un corte puesto se muestran
**todas** las coincidencias: el "Ver todos" existe para no volver larga la
pantalla por defecto, y quien filtro ya dijo que quiere ver ese subconjunto
entero (US1, escenario 1).

**5. La URL.** El corte por estado entra como `?estado=`, **componiendo** con el
`?ver=` que ya existe. Es el punto mas delicado del feature: hoy `irA()` de
`/perfil` arma la URL a mano con un literal, asi que agregar un parametro sin
tocar eso lo borraria al cambiar de vista. Ver research D2.

**6. El conteo** cuando hay filtro (FR-007), para que "no hay" no se confunda con
"no se muestran".

## Como se sabe que funciono

`verify:` verde cubre **la decision**: que pedido pasa y cual no, con sus casos
de borde. Es mas de lo que parece, porque es exactamente donde vive la logica.

**Lo que no cubre**, y va al quickstart: que los controles se entiendan en un
telefono, que el naranja se lea como "este es el que esta puesto", que los dos
vacios digan cosas distintas, que el filtro sobreviva a dar de baja un pedido
(`022`), y que alternar entre *Mis datos* y *Mis pedidos* no se coma el filtro.

## Riesgos

**El grande es la URL compartida.** FR-017 existe porque una URL se copia a un
chat: si el texto buscado entrara ahi, el nombre de un tercero viajaria a un
historial de navegador ajeno. El control es que **el texto vive en memoria y
nada mas**, y se pierde al recargar — a proposito.

**El mediano es el filtro invisible.** Un corte puesto que no se ve deja a la
persona mirando 3 de 50 pedidos y creyendo que perdio el resto. Por eso el color
y el conteo son requisitos (FR-007, FR-015), no adorno.

**El chico es el recorte de 5.** Si el filtro se aplicara *despues* del recorte,
filtrar por pendientes sobre los 5 mas recientes mostraria "no hay pendientes"
teniendo tres. El orden correcto —filtrar y despues recortar— es una linea, y es
la clase de error que ninguna prueba de `lib/` ve.
