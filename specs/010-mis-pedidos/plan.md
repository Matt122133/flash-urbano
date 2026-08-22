---
ticket: none
status: draft
covers:
  # La pantalla que gana la sección de historial. Hoy sólo monta el formulario
  # de perfil.
  - web/app/perfil/page.tsx
  # Necesita un límite de Suspense: leer `?repetir=` con useSearchParams rompe
  # el prerender del export estático sin él. Ver research D1.
  - web/app/pedido/page.tsx
  # La capa de composición: la única con permiso de importar lib/api.ts. Acá
  # viven el historial, la tarjeta, y el camino nuevo de la precarga.
  - web/components/pedido/
  # El tipo PedidoGuardado está más angosto que la respuesta real y hay que
  # ensancharlo. Ver data-model.md.
  - web/lib/api.ts
  # Lo puro del mapeo pedido → formulario, y la decisión del reajuste. Con
  # pruebas, que es la convención de lib/ en este repo.
  - web/lib/repetir.ts
  - web/lib/repetir.test.ts
  # spec-kit escribe acá cuál es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build
analyzed:
---

# Implementation Plan: Mis pedidos — el historial y el botón de repetir

**Branch**: `mis-pedidos` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-mis-pedidos/spec.md`

## Summary

*Mi cuenta* gana una sección que lista los pedidos de quien está adentro —lo más
reciente primero, cada uno como una tarjeta con su código, su fecha de retiro, su
estado y lo que costó— y cada pedido se puede desplegar para ver el resto y
repetirlo. Repetir abre `/pedido?repetir=<id>` con todo precargado tal como se
guardó, salvo la fecha y la hora de retiro, que quedan vacías, y el precio, que
se resuelve de nuevo del punto: si cambió, la pantalla avisa que hubo un reajuste
sin decir cuánto salía antes.

**El servicio no se toca.** `GET /pedidos` ya devuelve el pedido entero, con su
punto de retiro, ordenado del más nuevo al más viejo, y ya sale de la credencial
sin aceptar filtro que lo esquive. Este feature es pantalla y un mapeo; lo único
que pasa del lado de los datos es que el tipo `PedidoGuardado` del navegador
—hoy con siete campos— se ensancha hasta lo que la respuesta realmente trae.

**El formulario de pedido tampoco se toca.** La precarga entra por el `inicial`
que `PedidoForm` ya acepta, y los avisos se muestran arriba del formulario por el
camino que `007` ya construyó para el aviso del punto. Eso no es prolijidad: si
`web/components/pedido-form.tsx` termina en el diff, la guarda de FR-022 se pone
en rojo con razón, porque sería un formulario que puede necesitar la red para
mostrar un precio.

## Technical Context

**Language/Version**: TypeScript sobre Next.js 16 (App Router, export estático).
El guía de la versión vive en `node_modules/next/dist/docs/` y `web/AGENTS.md`
obliga a leerlo antes de escribir código de web.

**Primary Dependencies**: ninguna nueva. Se usa lo que ya está: `lib/api.ts`
(cliente del servicio), `useLlamadaAutenticada()` de
`components/sesion/proveedor-sesion.tsx` (el único camino que convierte un 401 en
"tu sesión venció" en vez de una pantalla rota), `rehidratarRetiro()` de
`components/sesion/rehidratar-retiro.ts`, `resolverZona()` de `lib/zona-lookup.ts`
y `claveDeIntento()` de `lib/pedido.ts`.

**Storage**: nada nuevo. El único uso de `localStorage` sigue siendo la
credencial de sesión; la repetición viaja como un uuid en la URL justamente para
no escribir el pedido en el disco del teléfono (FR-021).

**Testing**: `vitest` en entorno `node`, alcance `lib/**/*.test.ts`. **No se
agrega jsdom ni librería de renderizado** — decisión del 2026-08-22. Lo que queda
cubierto automáticamente es `lib/repetir.ts`; **las pantallas no**. Su
verificación es [`quickstart.md`](quickstart.md), y es obligatoria.

**Target Platform**: navegador de teléfono en primer lugar (Principio IV), sitio
estático servido desde `flashurbano.uy`.

**Project Type**: aplicación web de dos superficies. **Esta feature vive entera
en una sola**: `web/`.

**Performance Goals**: ninguno nuevo. El historial trae una lista corta en una
llamada; entrar por `?repetir=` cuesta una llamada más, aceptada en research D1.

**Constraints**: cotizar tiene que seguir funcionando con el servicio apagado
(FR-022); nada de dato de terceros en el almacenamiento del navegador (FR-021);
nunca adivinar una zona (Principio V).

**Scale/Scope**: dos pantallas (una sección nueva en `/perfil`, un camino nuevo
en `/pedido`), un módulo puro con pruebas, y un tipo ensanchado. Sin paginado: la
respuesta viene entera y se muestran los 5 más recientes con un "Ver todos".

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después del diseño.*

- **Principio I (visual-first)**: el feature es, literalmente, algo que el
  cliente ve. US1 se entrega sola y ya vale.
- **Principio II (autoservicio)**: quita tipeo en vez de agregarlo, y le devuelve
  al registro un valor concreto — hoy *Mi cuenta* no muestra nada de lo que la
  persona hizo con la cuenta.
- **Principio III (simplicidad/YAGNI)**: sin endpoint nuevo, sin migración, sin
  paginado, sin caché entre pantallas, sin infraestructura de pruebas nueva. Se
  reusa `rehidratarRetiro()` en vez de escribir una segunda copia de la lógica de
  calles homónimas.
- **Principio IV (móvil, poca fricción)**: la tarjeta resumida existe por esto, y
  el quickstart exige probar en un teléfono.
- **Principio V (el sitio cotiza)**: el precio del pedido repetido **se resuelve
  del punto en el momento de repetir**; el congelado no se reusa jamás. Sin zona
  no hay precio ni pedido, y no hay caída a la zona más cercana.
- **Alcance (no hay pedido sin cliente identificado)**: el historial exige sesión
  y la repetición termina en el mismo camino de confirmación de `007`, con su
  puerta.
- **Plan acotado (harness)**: `covers:` nombra los seis caminos que este feature
  puede editar. `rehidratar-retiro.ts` **no está**, a propósito: se usa, no se
  toca.
- **Verificado antes de terminar (harness)**: `verify:` es un comando real. **Y
  no alcanza**: lo que prueba las pantallas es el quickstart, y eso está dicho en
  el propio `verify:` de este plan y en FR-025.

Sin violaciones que justificar. La tensión real de este plan no es con la
constitución sino con el harness: **`verify:` verde no demuestra que el feature
funcione**, y eso queda escrito acá arriba en vez de descubrirse al cerrar.

## Project Structure

### Documentation (this feature)

```text
specs/010-mis-pedidos/
├── plan.md              # Este archivo
├── spec.md              # El qué y el porqué
├── research.md          # D1..D9: las decisiones, con lo descartado
├── data-model.md        # Lo que ya existe y se lee; las dos formas del navegador
├── quickstart.md        # LA verificación de este feature
├── contracts/
│   └── pantallas.md     # La URL de repetición y lo que cada pantalla muestra
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo emite /speckit-tasks
```

### Source Code (repository root)

```text
web/
├── app/
│   ├── perfil/page.tsx           # MODIFICADO: monta la sección de historial
│   └── pedido/page.tsx           # MODIFICADO: límite de Suspense para ?repetir=
├── components/
│   └── pedido/
│       ├── crear-pedido.tsx      # MODIFICADO: camino nuevo de precarga + aviso
│       ├── historial.tsx         # NUEVO: la lista, sus tres estados vacíos
│       └── tarjeta-pedido.tsx    # NUEVO: la tarjeta, el detalle, el botón
└── lib/
    ├── api.ts                    # MODIFICADO: PedidoGuardado ensanchado
    ├── repetir.ts                # NUEVO: lo puro del mapeo y el reajuste
    └── repetir.test.ts           # NUEVO
```

**Structure Decision**: los componentes nuevos van a `web/components/pedido/`
—no a `components/sesion/`— porque esa carpeta es, por
[`ARCHITECTURE.md`](../../ARCHITECTURE.md), la capa de composición con permiso de
importar `lib/api.ts`, y el historial habla con el servicio. Que se monte dentro
de `/perfil` no lo vuelve de la cuenta: el dominio es pedidos. Lo puro va a
`web/lib/` con pruebas, que es la convención que el repo ya tiene y que `007`
siguió con `lib/pedido.ts`.

## Cómo se ejecuta

Cuatro tramos. Los dos primeros entregan US1, que vale sola; los dos últimos,
US2. Después de cada tramo el `verify:` tiene que quedar verde.

### Tramo 1 — El navegador sabe leer un pedido entero

Ensanchar `PedidoGuardado` en `web/lib/api.ts` hasta lo que `GET /pedidos`
realmente devuelve (ver [data-model.md](data-model.md)): remitente, las dos
direcciones con sus campos nulables, el punto de retiro, paquete, cantidad,
destinatario. `misPedidos()` ya existe y no cambia de forma.

**Resultado observable**: en la consola del navegador, con sesión iniciada,
`misPedidos()` devuelve objetos con la dirección de retiro y su punto, no siete
campos sueltos.

### Tramo 2 — *Mi cuenta* muestra el historial (US1)

`historial.tsx` pide la lista con `useLlamadaAutenticada()` y resuelve sus tres
estados que no son una lista —sin pedidos, sin sesión, servicio caído—;
`tarjeta-pedido.tsx` dibuja la tarjeta y su detalle con `<details>`/`<summary>`
(research D8: teclado y lector de pantalla salen correctos sin `aria-*` a mano).
`perfil/page.tsx` lo monta debajo del formulario de datos.

Los estados se traducen según la tabla del [contrato](contracts/pantallas.md), y
un valor desconocido se muestra crudo antes que romper la pantalla.

**Resultado observable**: entrar a `/perfil` con una cuenta que hizo pedidos
muestra sus códigos, el más nuevo arriba; detener el backend y recargar muestra
el aviso con su botón de reintentar, y el formulario de perfil sigue en pie.

### Tramo 3 — Lo puro de repetir, con pruebas

`web/lib/repetir.ts`: mapear la dirección de retiro del pedido a la forma que
`rehidratarRetiro()` acepta (nulos a `""`), pasar tamaño, cantidad, remitente y
destinatario a los campos del formulario, y **decidir si hubo reajuste** —el
precio de la zona que resuelve el punto hoy contra el `precio` guardado—.

Nada de este archivo puede importar de `web/components/`: la dependencia va en un
solo sentido.

**Resultado observable**: `npx vitest run lib/repetir.test.ts` pasa, con casos
para un pedido sin número y sin apartamento, y para precio igual, mayor y menor.

### Tramo 4 — El botón, la URL y los avisos (US2)

El botón en el detalle de la tarjeta lleva a `/pedido?repetir=<id>`.
`crear-pedido.tsx` gana el camino excluyente de research D2: con `?repetir=`
válido el `inicial` sale entero del pedido y la precarga del perfil no corre; sin
él, todo queda como hoy. El aviso de reajuste se muestra arriba del formulario,
por el mismo camino que `avisoDelPunto`, y los dos pueden convivir.

**Lo que hay que cuidar acá, y es lo único delicado del feature**: la decisión de
qué precarga corre se toma **una vez adentro del efecto**, no derivada del render.
Derivarla es lo que el 2026-08-14 desmontaba `PedidoForm` y borraba lo tipeado.
`PedidoForm` se monta **una sola vez**, ya con su `inicial`.

**Resultado observable**: los pasos M5 a M13 de [quickstart.md](quickstart.md).

### Al cerrar

Las dos deudas que el spec obliga a registrar, y que no son opcionales: el
paginado ausente **con el umbral en números** (FR-024) y el agujero de
verificación diciendo **qué pantallas quedaron sin prueba automática** (FR-026).

## Complexity Tracking

Sin violaciones de la constitución que justificar.

Vale anotar igual, porque es lo que un revisor va a querer discutir: **este plan
acepta a sabiendas que su `verify:` no ejercita las pantallas nuevas**. No es un
descuido ni una omisión del harness — es la respuesta a una pregunta que se hizo
explícitamente el 2026-08-22, con las tres opciones sobre la mesa. Lo que
compensa la decisión son FR-025 y FR-026: un quickstart que produce los casos
malos a propósito, y una deuda anotada con el tamaño real del hueco.
