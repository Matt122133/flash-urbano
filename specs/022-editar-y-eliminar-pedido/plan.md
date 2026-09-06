---
ticket: none
status: completed
covers:
  # Los dos caminos nuevos, su autorizacion y sus pruebas.
  - backend/internal/pedidos/
  # Dos motivos de aviso mas, al lado del de pedido nuevo.
  - backend/internal/avisos/
  # El cableado de las dos rutas.
  - backend/cmd/api/
  # AMPLIACION DE ALCANCE, aprobada por Mateo el 2026-09-06 con el plan en
  # ejecucion, al ver un `CORS error` en el navegador al guardar una edicion.
  # El preflight autoriza "GET, POST, PUT, OPTIONS": sin PATCH ni DELETE, los
  # dos caminos de este feature no se pueden llamar desde NINGUN navegador, ni
  # en local ni desplegado. No es un feature aparte — es la mitad que falta de
  # las dos rutas que este plan agrega, y ningun test de Go lo ve porque llaman
  # a los handlers sin navegador. Es el gemelo del defecto de `Idempotency-Key`
  # que el mismo archivo tiene documentado.
  - backend/internal/httpx/
  # El cliente del API: editar y eliminar.
  - web/lib/api.ts
  # La composicion de /pedido y la tarjeta del historial.
  - web/components/pedido/
  # El formulario, que gana un modo "editar".
  - web/components/pedido-form.tsx
  # AMPLIACION DE ALCANCE, pedida por Mateo el 2026-09-06 con el plan ya en
  # ejecucion y verify verde: que /perfil recuerde en que vista estaba.
  # Entra aca y no en un feature aparte porque es la MISMA pantalla que este
  # plan vuelve util —desde `022` se vuelve a ella a mirar estados y a
  # corregir— y porque es justamente este feature el que vence la premisa de
  # FR-027 de `010`. Ver FR-015 del spec.
  - web/app/perfil/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1
analyzed: 2026-09-06
---

# Implementation Plan: Corregir o dar de baja un pedido, mientras nadie lo tomo

**Branch**: `022-editar-y-eliminar-pedido` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

## Summary

Hoy un pedido mal cargado no tiene arreglo: el cliente carga otro, y el costo lo
paga Diego, que se encuentra dos pedidos casi iguales. Este plan agrega **editar
y dar de baja, mientras el pedido este pendiente** — dos caminos nuevos en el
servicio, un modo mas en el formulario que ya existe, y dos avisos mas para
Diego.

La ventana la eligio el cliente por un motivo de negocio y **resulta ser la misma
que el esquema deja abierta** ([research](research.md) D1): un pedido pendiente
no tiene historial de estados, asi que se puede borrar de verdad. Eso evita
inventar un estado `anulado` y, con el, **un APK nuevo instalado a mano en el
telefono de Diego**.

Dos cosas mandan sobre el diseño, y las dos salen de leer el repo:

- **La ventana se hace valer en el `UPDATE`, no leyendo antes** (D2). Es lo que
  decide la carrera real: el cliente edita, Diego toma el pedido en ese momento,
  el guardado llega tarde. Gana la base.
- **Editar es una TERCERA fuente de precarga del formulario** (D3), y el archivo
  que las tiene ya advierte por escrito que dos fuentes sobre el mismo formulario
  produjeron un defecto el 2026-08-14. Aca el modo de falla es peor: guardar
  sobre el pedido equivocado.

## Technical Context

**Language/Version**: Go 1.26+, TypeScript 5 sobre Next.js 16.

**Primary Dependencies**: ninguna nueva.

**Storage**: Postgres + PostGIS. **Sin migracion**: no hay campos nuevos.

**Testing**: `go test ./... -p 1` con la base de pruebas levantada; Vitest en
`web/`.

**Target Platform**: sitio en el navegador; el servicio en Railway.

**Project Type**: web + backend. **La app Android NO se toca** y esta verificado
(D5): ya tolera un pedido que dejo de existir.

**Performance Goals**: sin cambio.

**Constraints**: el `-p 1` del `verify:` **no es opcional** — sin el, los
paquetes de Go corren en paralelo contra una sola base de pruebas y fallan por
pisarse. Es la fila `High` del tracker del 2026-09-05.

**Scale/Scope**: dos endpoints, dos avisos, un modo de formulario, un boton.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio II — el autoservicio es el valor.** Este feature es de los que mas
  lo sirven: hoy corregir un pedido significa hacerle trabajo manual a Diego, que
  es lo que el producto existe para eliminar.
- **Principio V — la zona decide admision y nunca se adivina.** FR-006: una
  edicion que cambie la entrega **revalida la cobertura con las mismas reglas que
  la creacion**. Un pedido editado no hereda la admision del original, y fuera de
  zona no se guarda ni se cae a la zona mas cercana.
- **Principio V — no se muestra ni se menciona plata.** Los dos avisos nuevos
  quedan bajo la misma disciplina que el de `018`: la garantia es que el tipo de
  entrada **no tiene** esos campos, asi que un descuido no compila.
- **Ningun pedido sin cliente identificado.** Las dos rutas van con el mismo
  `conSesion` que las demas, y ademas el pedido se busca acotado al usuario.
- **Logistica manual.** Nada se automatiza para Diego: se le avisa y el decide.
- **`covers:`** nombra los prefijos que se tocan. `android/` **no esta**, y es
  parte del diseño.
- **`verify:`** backend + web, con `-p 1`.

Sin violaciones. Complexity Tracking queda fuera.

## Project Structure

### Documentation (this feature)

```text
specs/022-editar-y-eliminar-pedido/
├── plan.md
├── spec.md
├── research.md      # las cinco decisiones, con lo que se leyo del repo
├── quickstart.md
├── checklists/requirements.md
└── tasks.md         # lo escribe /speckit-tasks
```

Sin `data-model.md`: no cambia ninguna forma guardada. Sin `contracts/`: se
agregan dos rutas al contrato existente y se describen aca.

### Source Code (repository root)

```text
backend/
├── cmd/api/main.go              # PATCH /pedidos/{id}, DELETE /pedidos/{id}
└── internal/
    ├── pedidos/
    │   ├── pedido.go            # Editar() y Eliminar(), acotados en el UPDATE
    │   ├── handlers.go          # las dos rutas y sus avisos
    │   └── pedido_test.go       # la ventana, la carrera, el pedido ajeno
    └── avisos/mensaje.go        # PedidoEditado y PedidoDadoDeBaja

web/
├── lib/api.ts                   # editarPedido() y eliminarPedido()
└── components/
    ├── pedido-form.tsx          # modo editar: que dice el boton y la confirmacion
    └── pedido/
        ├── crear-pedido.tsx     # la TERCERA fuente de precarga (D3)
        └── tarjeta-pedido.tsx   # Editar y Eliminar

android/                         # NO SE TOCA. Verificado en research D5.
```

**Structure Decision**: la edicion **reusa el formulario de creacion** en vez de
tener pantalla propia. Los campos, las validaciones y la revalidacion de
cobertura son los mismos, y un segundo formulario seria una segunda definicion de
que es un pedido valido — que diverge. Es el mismo argumento por el que la
etiqueta de `020` no escribio su propio compositor de direcciones.

## Como se ejecuta

**1. El repositorio, primero, con la ventana adentro del SQL.** `Editar()` y
`Eliminar()` reciben el `usuarioID` y acotan en la misma sentencia:
`WHERE id = $1 AND usuario_id = $2 AND estado = 'creacion'`. Deciden por filas
afectadas y devuelven **un solo tipo de "no"**: no existe, no es tuyo, o ya no
esta pendiente — las tres iguales hacia afuera (FR-004).

**2. Las pruebas de la ventana**, que son el nucleo: editar y eliminar un
pendiente propio funciona; sobre uno **tomado** no; sobre uno **ajeno** no y
responde como si no existiera; y la carrera —tomarlo entre medio— la pierde el
cliente.

**3. Los dos avisos.** Dos tipos de entrada nuevos al lado de `PedidoNuevo`, cada
uno **con solo los campos que su mensaje puede decir**. El de la baja alcanza con
el codigo.

**4. Los handlers y las rutas**, con el mismo `conSesion` que el resto, y un
**mensaje legible en el 404**: es el texto que Diego va a leer en la app cuando
toque un pedido que ya no esta (FR-014, D5).

**5. El cliente del API** en `web/lib/api.ts`.

**6. El modo editar del formulario.** La precarga decide **una sola vez** y con
`editar` primero, en la misma cadena que hoy elige entre repetir y el perfil
(D3). El modo de guardado **viaja con la precarga**, no se deduce despues de
volver a leer la URL. Cambian los textos: el boton dice guardar, y la pantalla de
exito no dice "anota tu codigo" sobre un codigo que la persona ya tenia.

**7. Los dos botones en la tarjeta del historial**, visibles **solo mientras el
pedido este pendiente**, y cuando no lo esta, **el motivo escrito** (FR-011).
Eliminar pide confirmacion.

**8. `verify:`** con la base de pruebas levantada y el conteo de salteadas
mirado.

## Como se sabe que funciono

`verify:` verde con las pruebas de base corridas cubre lo que importa del
servicio: la ventana, el pedido ajeno, la carrera, y que el aviso no diga lo que
no puede decir.

**Lo que no cubre**, y va al quickstart: que la pantalla de edicion se entienda
—que no parezca que se esta creando otro pedido—, que el motivo se lea cuando la
ventana esta cerrada, y que Diego reciba los dos avisos en un telefono de verdad.

## Riesgos

**El grande es la tercera fuente de precarga.** Es el unico lugar del feature
donde un error no se ve: si las fuentes se mezclan, el formulario guarda sobre el
pedido equivocado, y en pantalla no hay nada raro. Por eso la decision se toma
una sola vez y el modo de guardado viaja con ella; y por eso el quickstart entra
a `/pedido?editar=` y a `/pedido?repetir=` uno despues del otro.

**El mediano es la ventana vista desde el cliente.** El boton desaparece por algo
que paso del otro lado y que la persona no vio. Sin el motivo escrito, el
producto parece roto justo cuando funciono bien.

**El chico es el aviso de mas.** Diego ya recibe un push por pedido nuevo; ahora
puede recibir tres por el mismo pedido. Si molesta, la salida no es sacarlo sino
agrupar, y eso es otro feature.
