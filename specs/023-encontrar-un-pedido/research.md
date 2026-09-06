# Research: Encontrar un pedido entre muchos

Cuatro decisiones. Ninguna sale de preferencia: las cuatro salen de leer lo que
el repo ya resolvio o ya sufrio.

## D1 — La decision de filtrar vive en `lib/`, no en el componente

**Decision**: `web/lib/filtrar-pedidos.ts` exporta una funcion pura
`filtrarPedidos(pedidos, { estado, texto })`. `historial.tsx` solo dibuja.

**Por que**: `web/vitest.config.ts` corre `include: ["lib/**/*.test.ts"]` en
entorno `node`. **No hay jsdom, no hay testing-library, no hay ninguna prueba de
componente en este repo**, y esa ausencia es una fila `High` del tracker
(2026-08-22) que ya nombra a `historial.tsx` como una de las tres pantallas sin
cobertura. Todo lo que quede adentro del componente **no lo prueba nada**.

Es ademas el reparto que `010` ya eligio: `lib/repetir.ts` tiene 24 casos y la
tarjeta que los muestra no tiene ninguno.

**Alternativas descartadas**: montar jsdom + testing-library para probar la
pantalla. Es la herramienta que **tres requisitos distintos ya pidieron** segun
el tracker, y sigue siendo una decision de infraestructura mas grande que este
feature — no se decide adentro de `023`.

## D2 — El corte por estado se COMPONE en la URL, no se pisa

**Decision**: el corte viaja como `?estado=`, junto a `?ver=`, y quien escribe la
URL **preserva los parametros que no le pertenecen**.

**Por que**: hoy `/perfil` arma la URL con literales —
`router.replace(id === "pedidos" ? "/perfil?ver=pedidos" : "/perfil")`—. Agregar
`?estado=` sin tocar eso da un defecto silencioso y perfectamente logico: la
persona filtra, toca *Mis datos*, vuelve a *Mis pedidos*, y **el filtro
desaparecio** sin que nadie lo haya sacado.

La forma correcta es partir de los parametros actuales y modificar **solo la
clave propia**. Es una linea de mas y evita un defecto que ninguna prueba de
`lib/` puede ver.

**Alternativas descartadas**: guardar el filtro en un estado de React arriba de
las dos vistas. Sobrevive alternar, pero no sobrevive recargar — que es la mitad
de lo que FR-016 pidio.

## D3 — Quien lee la URL: la lista, no la pantalla

**Decision**: `historial.tsx` lee `?estado=` con `useSearchParams()` y lo escribe
con `router.replace()`. `/perfil` sigue siendo dueño de `?ver=`.

**Por que**: el filtro es de la lista; la vista es de la pantalla. Pasarlo por
props obligaria a `/perfil` a conocer los estados de un pedido, que no son
asunto suyo. **El limite de Suspense que `useSearchParams` exige ya existe** en
`/perfil` desde `022`, y `Historial` se monta adentro — asi que esto no agrega
ninguna restriccion nueva al build estatico.

El precio es que **dos componentes escriben la misma URL**, y por eso D2 es
obligatorio para los dos.

## D4 — La normalizacion del texto ya existe: `normalizar()`

**Decision**: reusar `normalizar()` de `web/lib/direcciones.ts` —NFD, saca
diacriticos, minusculas, colapsa espacios— para el texto buscado y para el campo
contra el que se compara.

**Por que**: es exactamente el problema que FR-004 describe, y esta resuelto en
este repo desde `003`, ganado contra el indice de calles de Montevideo: hay 50
grupos de nombres homonimos que se normalizan al mismo texto porque el dato de
origen escribio la misma calle con y sin tilde. Escribir una segunda
normalizacion seria tener dos definiciones de "el mismo texto" que divergen.

`filtrar-pedidos.ts` importa de `direcciones.ts` y no lo edita — por eso ese
archivo **no esta en `covers:`**.

**Sobre el codigo**: `FU-0142` se busca comparando **solo los digitos** de lo que
la persona escribio contra los digitos del codigo, asi `142`, `fu-0142` y
`FU-0142` encuentran lo mismo (FR-003). Un texto sin digitos no toca esa rama.

## Lo que NO se investigo, y por que

- **Paginado y filtrado en el servicio**: fuera de alcance por decision del spec,
  con el umbral ya medido en el tracker (~300 pedidos por persona; hoy los
  codigos van por `FU-00xx`).
- **Ordenar por otra cosa**: FR-009 lo prohibe. El orden lo pone el servicio.
- **Filtrar por fecha**: diferido en clarify.
