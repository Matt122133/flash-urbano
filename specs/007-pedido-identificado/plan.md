---
ticket: none
status: active
covers:
  # ---------------------------------------------------------------- backend
  # El paquete nuevo: repositorio, handlers y sus pruebas.
  - backend/internal/pedidos/
  # La migracion 0003. El prefijo cubre el .sql nuevo; embed.go no se toca.
  - backend/migrations/
  # AGREGADO EL 2026-08-12, con motivo. `vaciar()` en este archivo tiene la
  # lista de tablas ESCRITA A MANO desde `0001` —rastro_ingresos,
  # codigos_acceso, sesiones, usuarios, migraciones_aplicadas— y no incluye
  # `pedidos`. El CASCADE del DROP se lleva la FK de `pedidos` hacia `usuarios`
  # pero NO la tabla, asi que `pedidos` y su secuencia sobreviven entre pruebas
  # y la migracion choca contra si misma con
  # `relation "pedidos_codigo_seq" already exists`.
  #
  # No es opcional y no se puede diferir: sin esto TODO el paquete `db` queda
  # en rojo y el `verify:` no puede estar verde nunca. Se descubrio corriendo
  # las pruebas contra Postgres de verdad, no leyendo.
  #
  # El cambio se acota a sumar `pedidos` a esa lista. Que la lista sea
  # estatica —y por lo tanto se pudra con cada migracion que agregue una
  # tabla— es un defecto de clase, y va al tracker en vez de arreglarse de
  # paso: `AGENTS.md` prohibe la limpieza oportunista fuera de los pasos del
  # plan.
  - backend/internal/db/migrate_test.go
  # Tres rutas nuevas y tres dependencias mas. main.go ya lo anticipa: la
  # estructura `dependencias` existe porque "la lista va a seguir creciendo
  # con 007".
  - backend/cmd/api/main.go
  # ---------------------------------------------------------------- web
  # La composicion nueva: el que habla con el API y monta la puerta. Es la
  # pieza que hace posible D1 — el formulario no importa `lib/api.ts`, este si.
  - web/components/pedido/
  # El formulario. Recibe `onConfirmar` como prop, precarga desde el perfil, y
  # pierde la promesa falsa de la pantalla de confirmacion.
  - web/components/pedido-form.tsx
  # El copy de la pantalla: FR-027 y FR-028.
  - web/app/pedido/page.tsx
  # Se factoriza la composicion de ingreso a `panel-ingreso.tsx` para que el
  # dialogo y la pantalla no diverjan (research D2).
  - web/components/sesion/
  - web/app/ingresar/page.tsx
  # Las funciones nuevas del cliente del API.
  - web/lib/api.ts
  - web/lib/api.test.ts
  # El mapeo del formulario al cuerpo del pedido. Modulo PURO y con prueba
  # propia: no importa `lib/api.ts` ni `lib/sesion.ts`, y por eso puede vivir
  # en `lib/` sin poner en rojo la guarda.
  - web/lib/pedido.ts
  - web/lib/pedido.test.ts
  # La guarda de FR-001. Se le AGREGA el control positivo sobre
  # `crear-pedido.tsx`; NO se le tocan `ENTRADAS` ni `PROHIBIDOS`. Que este
  # archivo este cubierto no autoriza a debilitarlo — FR-004 lo prohibe.
  - web/lib/cotizar-abierto.test.ts
  # ---------------------------------------------------------------- raiz
  # FR-033. Una linea, en la raiz para que valga en todas las ramas.
  - .gitignore
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  #
  # NOTA DELIBERADA: `web/components/bloque-direccion.tsx` NO esta cubierto, y
  # es a proposito, igual que en `006`. Sus dos deudas conocidas —el campo
  # Esquina deshabilitado con una direccion precargada, y el estado interno no
  # rehidratable— van a molestar en este feature, porque precarga direcciones.
  # Dejarlo afuera hace que el sensor imponga la decision en vez de que alguien
  # lo arregle de paso: si la precarga no funciona sin tocarlo, se extiende
  # `covers:` con el motivo escrito.
  #
  # NOTA DELIBERADA: `web/lib/zonas.ts` y `web/lib/zona-lookup.ts` NO estan
  # cubiertos. Son los que FR-001 y FR-002 protegen, y este feature no tiene
  # ningun motivo legitimo para tocarlos.
# `-p 1` no es adorno: las pruebas contra Postgres comparten una sola base y la
# de migraciones la vacia entera. Sin esto, `0003` se corre mientras las de
# pedidos trabajan y el rojo es de una carrera, no del cambio.
#
# Y OJO con el verde: sin TEST_DATABASE_URL las pruebas contra Postgres SE
# SALTAN SOLAS. Ver quickstart.md — hay que contar los SKIP, no confiar en el
# verde.
verify: (cd backend && go vet ./... && go test ./... -p 1 && go build ./...) && (cd web && npm run lint && npm test && npm run build)
# 2026-08-12. `/speckit-analyze` corrio de verdad como hook `after_tasks` y
# reporto 9 hallazgos, 0 criticos: 2 HIGH de cobertura (G1 y G2), 1 HIGH de
# tension con el Principio V (D1, declarada en Complexity Tracking), 3 MEDIUM y
# 3 LOW. **G1, G2, U1 y U2 se corrigieron antes de esta promocion**: FR-020 se
# partio en FR-020/FR-020a porque prometia algo que ningun componente hacia
# cumplir, SC-008 paso a exigir cruzar FU-9999 y gano las tareas T005b, FR-019
# se reformulo como propiedad verificable, y T005a cubre FR-013. El dueno del
# proyecto leyo el reporte y aprobo la promocion explicitamente.
analyzed: 2026-08-12
---

# Implementation Plan: El pedido se crea identificado y se guarda

**Branch**: `pedido-identificado` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-pedido-identificado/spec.md`

## Summary

Este feature cierra la mitad que `006` dejó abierta a propósito: pone la puerta
delante de confirmar un pedido y hace que el pedido exista de verdad. Las dos
juntas, porque separadas ninguna sirve — exigir registro para llegar a una
pantalla que no guarda nada no le compra nada al cliente, y guardar un pedido de
un anónimo viola la constitución v3.0.0.

De paso corrige lo que se descubrió al escribir el spec: hoy la pantalla dice
*"¡Pedido cargado! Nos pondremos en contacto para confirmar el retiro"* y **no
se guarda nada, no se le avisa a nadie, y nadie se va a poner en contacto**.

Del lado del servicio es una tabla, una migración y tres endpoints. Del lado del
sitio, la parte interesante: **el formulario no puede importar el cliente del
API sin poner en rojo la guarda que protege el cotizar abierto**, así que recibe
`onConfirmar` como prop y nunca se entera de que existe un servicio. El ingreso
ocurre en un diálogo sobre la misma pantalla, lo que mantiene el borrador —con
el nombre y el teléfono de un tercero— fuera del disco del teléfono.

Todo el razonamiento está en [research.md](research.md); la forma de los datos
en [data-model.md](data-model.md); los endpoints en
[contracts/pedidos.md](contracts/pedidos.md); cómo se comprueba en
[quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: Go 1.24 (`backend/`), TypeScript 5 sobre Next 16.2.12
(`web/`). Sin lenguajes ni runtimes nuevos.

**Primary Dependencies**: Ninguna nueva, en ninguna de las dos superficies. El
enrutador sigue siendo `ServeMux` de la biblioteca estándar; el código de
idempotencia usa `crypto.randomUUID()`, que ya está en el navegador. **Si algo
del plan parece necesitar una dependencia nueva, es señal de que se desvió.**

**Storage**: Postgres con PostGIS en Railway. Una tabla nueva (`pedidos`), una
secuencia, tres índices. `usuarios`, `sesiones`, `codigos_acceso` y
`rastro_ingresos` no cambian.

**Testing**: `go test` con Postgres real vía `TEST_DATABASE_URL`; `vitest` en
`web/`, en entorno `node` **sin DOM** — que es la limitación que define el
reparto entre lo automático y lo manual.

**Target Platform**: Servicio en Railway; sitio como export estático en GitHub
Pages, servido en `https://flashurbano.uy`. Los clientes entran desde el
teléfono.

**Project Type**: Web, dos superficies desplegadas por separado.

**Performance Goals**: Ninguno específico. El volumen real es desconocido —la
pregunta 11 a Diego sigue sin respuesta— y a la escala de un operador único,
inventar un objetivo sería inventar un requisito.

**Constraints**: La dura es **FR-001**: cotizar tiene que funcionar con el
servicio apagado, y hay una guarda automática que lo vigila. La segunda es que
`web/` es un export estático: no hay servidor donde poner lógica del lado del
sitio.

**Scale/Scope**: Un operador, un cliente por pedido. Tres endpoints, una tabla,
cinco archivos nuevos en `web/`.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después de Phase 1 — sin cambios.*

| Principio | Cómo queda |
|---|---|
| **I — Visual-first MVP** | El feature es una rebanada visible y demostrable: se carga un pedido y aparece un código. |
| **II — Self-service es el valor** | **Reforzado.** La precarga del perfil es exactamente esto, y la puerta va en el último paso: la cotización sigue pública. FR-001 a FR-004 la defienden. |
| **III — Simplicidad (YAGNI)** | Sin dependencias nuevas, sin panel, sin *Mis Pedidos*, sin geometría duplicada en el servicio. La verificación de precio que **no** se construye (research D6) es esta principio aplicado. |
| **IV — Mobile-first, poco tipeo** | Es el argumento que decidió dos cosas: el ingreso en diálogo y la reanudación sin segundo toque. |
| **V — El sitio cotiza; la logística es manual** | Sin ruteo, sin aceptación automática, sin tope diario. El precio se sigue calculando en el navegador. **Con una tensión declarada abajo.** |
| **Scope boundaries v3.0.0** | Este feature **es** lo que la enmienda del 2026-08-11 obliga: la puerta y el copy. |

**Plan-bounded change**: `covers:` nombra los quince prefijos, con motivo escrito
en los tres casos no obvios (`web/app/ingresar/`, `web/components/sesion/`,
`.gitignore`) y con dos exclusiones deliberadas.

**Verified before done**: `verify:` corre las dos mitades. **No alcanza por sí
solo** — la puerta, la reanudación y el copy sólo se ven a mano, y
`quickstart.md` lista las nueve comprobaciones manuales que faltan.

## Project Structure

### Documentation (this feature)

```text
specs/007-pedido-identificado/
├── plan.md              # Este archivo
├── spec.md
├── research.md          # Phase 0 — 12 decisiones
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── pedidos.md       # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks — todavía no existe
```

### Source Code (repository root)

```text
backend/
├── cmd/api/main.go                      # + 3 rutas, + 1 dependencia
├── internal/pedidos/                    # NUEVO
│   ├── pedido.go                        #   repositorio
│   ├── pedido_test.go
│   ├── handlers.go                      #   Crear, Mios, Todos
│   └── handlers_test.go
└── migrations/
    └── 0003_pedidos.sql                 # NUEVO

web/
├── app/
│   ├── pedido/page.tsx                  # copy (FR-027, FR-028)
│   └── ingresar/page.tsx                # pasa a montar el panel factorizado
├── components/
│   ├── pedido-form.tsx                  # + onConfirmar, + precarga, − promesa falsa
│   ├── pedido/                          # NUEVO
│   │   ├── crear-pedido.tsx             #   la composición: API + puerta + form
│   │   └── dialogo-ingreso.tsx          #   la puerta, sobre /pedido
│   └── sesion/
│       └── panel-ingreso.tsx            # NUEVO — factorizado de /ingresar
└── lib/
    ├── api.ts                           # + crearPedido, misPedidos
    ├── pedido.ts                        # NUEVO — mapeo puro, sin red
    └── cotizar-abierto.test.ts          # + control positivo

.gitignore                               # + .env, .env.*, !.env.example
```

**Structure Decision**: Se sigue el reparto que ya tiene el repo — un paquete Go
por área de dominio bajo `backend/internal/`, componentes por feature bajo
`web/components/`. Lo único estructuralmente nuevo es
**`web/components/pedido/`**, y existe por un motivo concreto y no por prolijidad:
es donde vive el código que **sí** puede importar `lib/api.ts`. Mantenerlo fuera
de `pedido-form.tsx` es lo que deja la guarda de FR-001 intacta.

## Cómo se ejecuta

Cuatro tramos, en este orden. El orden importa: cada uno se puede verificar
antes de empezar el siguiente, y el primero es el que puede obligar a repensar
el resto.

### Tramo 1 — El servicio guarda pedidos

La migración `0003`, el paquete `pedidos` y las tres rutas. Al terminar, un
`curl` con una credencial válida crea un pedido y lo devuelve con su código, y
las pruebas de la tabla del quickstart pasan **con los `SKIP` en cero**.

Se hace primero porque es la mitad verificable sin navegador, y porque si el
contrato resulta estar mal, es más barato descubrirlo acá.

### Tramo 2 — El formulario deja de saber de la red

La inversión de dependencia de [research D1](research.md). `pedido-form.tsx`
pasa a recibir `onConfirmar`; nace `components/pedido/crear-pedido.tsx` con el
envío; nace `lib/pedido.ts` con el mapeo puro; se le agrega a
`cotizar-abierto.test.ts` el control positivo.

**El paso que no se puede saltear**: romper la guarda a propósito —un
`import { pedir } from "@/lib/api"` en el formulario— y **ver la prueba en
rojo** antes de deshacerlo. Una guarda negativa que nadie vio fallar no está
demostrada.

Al terminar este tramo el pedido ya se guarda desde el sitio, con sesión
iniciada. Todavía no hay puerta.

### Tramo 3 — La puerta

Se factoriza `panel-ingreso.tsx` desde `/ingresar`, se monta en
`dialogo-ingreso.tsx`, y `crear-pedido.tsx` lo abre cuando no hay sesión o
cuando el servicio contesta `401`. La reanudación reusa la misma clave de
idempotencia.

Al terminar corren M2, M3, M4 y M5 del quickstart, **en un teléfono**.

### Tramo 4 — El copy, y el `.gitignore`

Las tres frases (FR-027, FR-028, FR-029) y la línea de la raíz. Va último porque
FR-029 depende de que ya se sepa qué es cierto decir, pero **no es opcional**: es
el requisito que carga con la consecuencia de haber diferido el aviso a Diego, y
cerrar el feature sin él cambia una promesa falsa por otra.

## Complexity Tracking

Una sola tensión, y se declara en vez de esconderse.

| Tensión | Por qué se acepta | Alternativa rechazada |
|---|---|---|
| **El Principio V dice que los límites de zona son "binding for charging", y este feature guarda el precio que declaró el navegador sin verificarlo.** Quien arme la petición a mano puede declarar el monto que quiera. | Es una decisión del dueño del proyecto tomada el 2026-08-12 **con el riesgo a la vista**. Está acotada: el punto queda guardado, así que el precio es **recalculable** en cualquier momento — la verificación se pospone, no se pierde. Y hay un control humano real: Diego mira el pedido antes de aceptarlo. FR-021a obliga a registrarlo como deuda al cerrar. | **Resolver la zona en el servicio**: duplica la geometría que decide la plata, y dos fuentes que se desincronizan hacen que el cliente vea un precio y se le cobre otro. **Una tabla de cinco precios sin geometría** —que cerraría casi todo el agujero— se evaluó en [research D6](research.md) y se dejó anotada: pone los precios en un segundo lugar, y un precio cambiado en un lado y no en el otro produce **pedidos rechazados**, que es peor que el riesgo que evita. La forma correcta es generarla desde `web/design-source/`, que está fuera del alcance de este feature. |
