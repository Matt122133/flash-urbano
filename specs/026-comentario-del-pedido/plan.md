---
ticket: none
status: active
covers:
  # La columna nueva. Migracion 0009, sin relleno de datos.
  - backend/migrations/
  # Insert, update (el camino de 022), scan y validacion del tope.
  - backend/internal/pedidos/
  # SOLO la prueba: que el tablero siga sin traer el comentario (FR-012, T006).
  # El paquete no se toca; lo que se agrega es la guarda de que sigue sin
  # tocarse. Sin este prefijo el sensor rebota el commit de T006.
  - backend/internal/tablero/
  # El tipo del formulario y el armado del cuerpo. Modulo puro, con pruebas.
  - web/lib/pedido.ts
  - web/lib/pedido.test.ts
  # La decision de "hay comentario que mostrar", afuera de los componentes para
  # que sea probable: el repo no tiene pruebas de componentes y montar un DOM
  # seria infraestructura de mas (vitest corre en node, include lib/**).
  - web/lib/comentario.ts
  - web/lib/comentario.test.ts
  # El tipo PedidoGuardado. OJO: se toca el TIPO, nunca se mete una llamada en
  # el camino del formulario; cotizar-abierto.test.ts lo guarda.
  - web/lib/api.ts
  # Que dice la etiqueta impresa, y donde se dibuja.
  - web/lib/etiqueta.ts
  - web/lib/etiqueta.test.ts
  - web/lib/etiqueta-pdf.ts
  # Repetir un pedido arrastra el comentario.
  - web/lib/repetir.ts
  - web/lib/repetir.test.ts
  # El campo en pantalla, con su ayuda y su contador.
  - web/components/pedido-form.tsx
  # El estado del formulario, el resumen de confirmacion, el camino de edicion
  # de 022, y la tarjeta de Mis pedidos.
  - web/components/pedido/
  # El modelo que lee la respuesta, y la tarjeta donde Diego lo lee.
  - android/app/src/main/java/uy/flashurbano/repartidor/datos/
  - android/app/src/main/java/uy/flashurbano/repartidor/pantallas/
  - android/app/src/test/java/uy/flashurbano/repartidor/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-09-12
---

# Implementation Plan: El comentario del pedido

**Branch**: `026-comentario-del-pedido` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-comentario-del-pedido/spec.md`

## Summary

Un campo de texto opcional, **"Comentario"**, tope 280 caracteres, que el
cliente escribe al crear el pedido para avisarle algo al repartidor sobre el
viaje. Se guarda como **una columna anulable** en `pedidos` y aparece en las
cuatro pantallas donde ya se ve un pedido: el resumen de confirmación, *Mis
pedidos*, la etiqueta impresa y **la tarjeta de la app del repartidor**. Se
edita bajo la misma regla que `022`: mientras el pedido está pendiente.

Es una feature chica en código y **ancha en superficies**: las tres del repo. El
riesgo no está en la lógica —no hay— sino en las costuras, y en que la pata
Android es la que el `verify:` casi no mira.

## Technical Context

**Language/Version**: Go (servicio), TypeScript + Next (web), Kotlin + Compose (app)

**Primary Dependencies**: ninguna nueva. Esta feature no agrega un solo paquete.

**Storage**: Postgres + PostGIS en Railway. Una columna nueva, migración `0009`.

**Testing**: Vitest (web), `go test` (servicio), pruebas JVM de Gradle (app), y
el [quickstart](quickstart.md) en pantalla, que es lo que de verdad cubre la app.

**Target Platform**: sitio estático en `flashurbano.uy`, servicio en Railway, APK
instalado a mano.

**Project Type**: tres superficies en un repositorio (web + servicio + Android).

**Performance Goals**: ninguna nueva. 280 caracteres por pedido no mueven nada.

**Constraints**:
- El formulario **no puede depender del servicio** (guarda en `cotizar-abierto.test.ts`).
- **La columna `precio` no se lee desde código nuevo** (constitución, Principio V).
- La app **se instala a mano**: pueden convivir versiones, y una vieja no se
  puede romper.

**Scale/Scope**: 6 pedidos en producción. Un atributo, cuatro pantallas.

## Constitution Check

*GATE: pasa antes de la Fase 0 y se vuelve a chequear después de la Fase 1.*

| Principio | Cómo lo cumple |
|---|---|
| **I. Visual-first MVP** | Es una mejora que se ve: el cliente escribe y el repartidor lee. |
| **II. Self-service data entry** | Va al corazón del principio: hoy esa información viaja por WhatsApp y alguien la transcribe. |
| **III. Simplicity over infrastructure** | Una columna, cero dependencias nuevas, cero tablas nuevas (research D4). |
| **IV. Mobile-first, low-friction UI** | Campo opcional que no agrega un paso; la tarjeta de la app sigue sin plegarse. |
| **V. El precio detrás del login** | No se lee `precio` en ninguna consulta nueva. El texto libre del cliente **no** se censura, y el quickstart Q13 fija por qué eso no viola el principio. |

- **Plan-bounded change (harness)**: `covers:` nombra los prefijos de arriba.
- **Verified before done (harness)**: `verify:` corre las tres patas, la de
  Android incluida — que es nueva respecto de `024` y `025`, y es la que hace
  esta feature más lenta de verificar.

**Re-chequeo post Fase 1**: sin violaciones. La única tensión que el diseño
destapó —la etiqueta se pega al paquete, así que el comentario no es privado
(research D2)— se resolvió corrigiendo la promesa del spec, no el principio.

## Project Structure

### Documentation (this feature)

```text
specs/026-comentario-del-pedido/
├── plan.md              # Este archivo
├── spec.md
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── comentario.md    # Fase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── migrations/0009_comentario_del_pedido.sql   # columna + CHECK
└── internal/pedidos/                           # insert, update, scan, validacion

web/
├── lib/
│   ├── pedido.ts          # DatosDelPedido, CuerpoPedido, armarCuerpoPedido()
│   ├── api.ts             # PedidoGuardado (solo el TIPO)
│   ├── etiqueta.ts        # que dice el impreso
│   ├── etiqueta-pdf.ts    # donde se dibuja
│   └── repetir.ts         # repetir arrastra el comentario
└── components/
    ├── pedido-form.tsx    # el campo, la ayuda, el contador
    └── pedido/            # confirmacion, edicion de 022, Mis pedidos

android/app/src/main/java/uy/flashurbano/repartidor/
├── datos/Pedido.kt        # campo opcional, null por defecto
└── pantallas/Principal.kt # el bloque dentro de TarjetaPedido
```

**Structure Decision**: no se crea ningún módulo ni paquete nuevo. El comentario
es un atributo más del pedido y viaja por los caminos que el pedido ya tiene, así
que `ARCHITECTURE.md` no cambia y queda fuera de `covers:`. Si al implementar
resultara que sí hace falta tocarlo, eso es extender `covers:` y no hacerlo de
prepo.

## El orden en que conviene construirlo

Cada paso deja el repositorio en verde y desplegable.

1. **La base y el servicio.** Migración `0009`, el campo en el insert, en el
   update de `022`, en el scan y en las dos respuestas de lectura, con la
   validación del tope y el recorte. Se puede desplegar solo: la web vieja no lo
   manda y la app vieja lo ignora (research D3).
2. **La web.** El campo en el formulario con su ayuda y su contador, el
   comentario en el resumen, en *Mis pedidos*, en la edición y en la etiqueta.
   Acá se entrega la mitad visible para el cliente.
3. **La app.** El campo en `Pedido.kt` y el bloque en `TarjetaPedido`. Es la
   mitad que hace útil a la otra.
4. **El quickstart en pantalla**, y recién después publicar el APK.

**El paso 1 no depende de los otros dos, y los dos últimos no dependen entre
sí.** Esa independencia es lo que evita una ventana de despliegue coordinada con
el teléfono de otra persona.

## Lo que hay que mirar al aprobar este plan

**Una respuesta del clarify describía una pantalla que no existe, y el spec se
corrigió.**

La respuesta original decía que la app **marca** el pedido en la lista y que el
texto completo se lee **al abrirlo**. **En la app no existe "abrir un pedido"**:
el contrato §4.2 de `012` fija que la tarjeta muestra todo sin desplegar y que
no se toca, con el motivo escrito en el código —Diego no puede tener que tocar
para leer algo parado en una puerta—.

El diseño pone **el comentario dentro de la tarjeta**, como bloque propio y sólo
en los pedidos que lo tienen (research D1): cumple lo que la respuesta buscaba
—que Diego lo sepa al decidir qué lleva— sin romper §4.2. **FR-006a y la sección
D1 del spec se reescribieron el 2026-09-12** para decir eso, así que spec, plan,
contrato y tareas dicen hoy lo mismo. Lo encontró el `/speckit-analyze` (F1).

**Si se prefiere igual la pantalla de detalle, se puede**: el costo es enmendar
el contrato de `012`, y entonces este plan cambia.

Lo segundo, más chico pero conviene saberlo antes: **lo que se imprime es la
etiqueta que se pega al paquete**, no un resumen privado. Poner ahí el comentario
—que es lo pedido— significa que lo lee cualquiera que manipule el paquete, así
que FR-013 se corrigió para no prometer una confidencialidad que el papel no da,
y el texto de ayuda del campo tiene que avisarlo (research D2).

## Requisitos que ya estan cumplidos, y por quien

Dos requisitos del spec **no generan trabajo**, y conviene decirlo para que no se
lean como cobertura faltante:

- **FR-013 — ningun otro cliente puede leer la indicacion de un pedido ajeno.**
  Lo cumple el camino de lectura que ya existe: `Mios` devuelve solo los pedidos
  del usuario de la sesion, y `022` ya tiene prueba de que no se puede editar ni
  eliminar un pedido ajeno. El comentario viaja adentro del pedido, asi que
  hereda esa autorizacion sin agregar nada. **Lo que si hay que cuidar es no
  agregar un camino nuevo** que devuelva pedidos sin ese filtro.
- **FR-009 — sin indicación, ninguna pantalla dibuja un hueco.** No se prueba
  automáticamente **el dibujo**, porque el repo no tiene pruebas de componentes
  y montarlas sería la infraestructura que el Principio III desaconseja y que
  `vitest.config.ts` rechaza por escrito. Lo que sí se prueba es **la decisión**,
  sacada a `lib/comentario.ts` (T007/T008): las cuatro pantallas la comparten,
  así que no pueden desalinearse. Que además no dibujen nada lo mira el
  quickstart Q3, a ojo, y eso queda dicho y no disimulado.
- **FR-011 — una app vieja no se rompe.** Lo cumple `ignoreUnknownKeys`, que ya
  esta puesto en `Pedido.kt` (research D3). La tarea T012 no lo construye: lo
  **demuestra**, que es distinto y es lo que hace que se pueda desplegar el
  servicio antes que el APK.

## Riesgos

| Riesgo | Por qué es real | Cómo se ataja |
|---|---|---|
| **La app compila y se ve mal** | Pasó en `012`: texto cortado y un error crudo en pantalla, con todo verde | Quickstart Q11 en el teléfono, a 360 px incluido |
| **Un `SKIP` silencioso tapa la base** | Sin `TEST_DATABASE_URL` las pruebas Go contra Postgres se saltan solas | Quickstart lo pide explícito y manda contar los `SKIP` |
| **Meter `api.ts` en el camino del formulario** | Hay que tocar ese archivo, y la tentación de llamar desde el form es real | La guarda de `cotizar-abierto.test.ts` ya existe y se pone en rojo |
| **Aplanar los saltos de línea** | Es el defecto clásico de un campo multilínea, y no lo ve ninguna prueba de tipos | Quickstart Q5, con un texto de tres renglones |
| **La feature queda "hecha" sin llegar al teléfono** | La app se instala a mano y no hay tienda | El plan no se cierra hasta que Diego la tenga instalada y lo confirme |
