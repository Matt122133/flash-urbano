---
ticket: none
status: active
covers:
  # El paquete nuevo: el endpoint, su consulta, y las guardas de FR-014. NO
  # importa internal/pedidos, y una prueba lo sostiene (research D2, D9).
  - backend/internal/tablero/
  # Cableado de la ruta, y el camino nuevo en la lista de la prueba del
  # preflight: esa lista se mantiene a mano (contracts/tablero.md, CORS).
  - backend/cmd/api/
  # La pantalla: page.tsx de servidor (metadata noindex) + el cliente.
  - web/app/tablero/
  - web/components/tablero/
  # El calculo, puro y con pruebas: agrupar por periodo en hora de Montevideo,
  # filtrar por cliente, y el copy que FR-004a y FR-006a regulan (D10).
  - web/lib/tablero.ts
  - web/lib/tablero.test.ts
  # `web/lib/api.ts` NO esta: la llamada va por `useLlamadaAutenticada`, como
  # hace `historial.tsx`, que ya maneja el 401. Corregido al armar tasks.md.
  #
  # `esAdmin` en el tipo `Usuario`. El servicio lo manda desde 006 y la web lo
  # ignoraba. Y UN cambio de logica, que encontro el analyze (C1): la respuesta
  # del ingreso no trae `esAdmin`, asi que `entrar()` relee `/yo` en segundo
  # plano y copia SOLO ese campo (research D7).
  - web/components/sesion/proveedor-sesion.tsx
  # El enlace "Tablero", solo para administracion (D12).
  - web/components/nav-bar.tsx
  # La guarda de 013/024: se le agrega que app/tablero y components/tablero
  # esten entre los archivos escaneados (control positivo, D9). No se
  # relaja nada de lo que ya prohibe.
  - web/lib/sin-precio-a-la-vista.test.ts
  # `sinComentarios` sale de esa guarda a un modulo propio, sin cambiarle una
  # linea, para que `tablero.test.ts` escanee `lib/tablero.ts` con el mismo
  # recorte. Importarlo del `.test.ts` registraria sus casos dos veces.
  # Agregado al armar tasks.md (T016a).
  - web/lib/sin-comentarios.ts
  # Un paquete nuevo en backend/internal y una pantalla nueva: el mapa del repo
  # tiene que decirlo.
  - ARCHITECTURE.md
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./...
analyzed: 2026-09-11
---

# Implementation Plan: El tablero de Diego

**Branch**: `025-dashboard-de-diego` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/025-dashboard-de-diego/spec.md`

## Summary

Una pantalla web, `/tablero`, solo para administración, con **tres números y un
filtro**: cuántos pedidos hay registrados, cuántos pedidos y paquetes por día,
semana o mes —por **fecha de carga**, en hora de Montevideo—, y lo mismo acotado
a una cuenta. **Ni un peso**, y la columna `precio` no se lee.

El enfoque cabe en tres movimientos:

1. **Un paquete nuevo en el servicio, `internal/tablero`**, con un endpoint de
   solo lectura, `GET /admin/tablero`, autorizado igual que `/admin/pedidos`.
   Devuelve **hechos, no números**: una fila mínima por pedido (instante de
   carga, cantidad, cuenta) y la lista de cuentas. No importa `internal/pedidos`,
   así que no puede nombrar el precio aunque quiera (research D1, D2).
2. **El cálculo vive en `web/lib/tablero.ts`**, puro: la zona horaria, el inicio
   de la semana, los períodos en cero y el filtro. Es el único lugar del repo
   donde eso tiene una prueba que corre siempre, sin depender de que Postgres
   esté levantado (D1, D3).
3. **La pantalla** consume las dos cosas, y la navegación muestra el enlace solo
   a quien es admin.

FR-014 lo sostienen **cuatro guardas con control positivo**, una por frontera
que el dato cruza (D9).

## Technical Context

**Language/Version**: Go 1.26 (servicio); TypeScript 5, React 19, Next.js en
export estático (sitio) — la versión exacta de Next la gobierna `web/AGENTS.md`.

**Primary Dependencies**: ninguna nueva. `go/scanner` y `go/parser` son de la
biblioteca estándar; `Intl.DateTimeFormat` es del lenguaje.

**Storage**: Postgres + PostGIS, **sin migración**. Se leen `pedidos.creado_en`,
`pedidos.cantidad`, `pedidos.usuario_id` y `usuarios.{id,nombre,email}`. Ver
[data-model.md](data-model.md).

**Testing**: `go test` (las de base, contra `flash-pg-test` con
`TEST_DATABASE_URL`; **se saltan solas sin ella**) y vitest en `environment:
"node"` sobre `lib/**/*.test.ts`. **Nada en este repo renderiza React**: los
estados de la pantalla se verifican en el [quickstart](quickstart.md).

**Target Platform**: navegador de escritorio (Diego mira esto sentado, spec
*Assumptions*), sin romperse a 360 px. Servicio en Railway.

**Project Type**: web — `web/` y `backend/`. **`android/` no se toca** (FR-018).

**Performance Goals**: N/A a este volumen (una docena de pedidos). La respuesta
crece una fila por pedido; el umbral donde conviene agregar en SQL está en
research D1 y va al tracker al cerrar.

**Constraints**:
- **FR-013**: ninguna consulta del feature lee `precio`. Sostenido por no poder
  nombrarlo (D2) y por la guarda (D9).
- **FR-007**: períodos en `America/Montevideo`, nunca en la zona del navegador ni
  en UTC (D3).
- **FR-004b**: se cuentan todos los pedidos, sin excluir cuentas ni estados.
- El formulario de pedido no se toca, y `web/lib/api.ts` sigue fuera de su grafo
  de imports (`cotizar-abierto.test.ts`). El tablero llama al servicio con
  `useLlamadaAutenticada` —como `components/pedido/historial.tsx`—, que ya
  convierte un 401 en sesión vencida; el formulario no importa el tablero.

**Scale/Scope**: un paquete Go nuevo (handler, consulta, pruebas), un módulo TS
puro con su prueba, una ruta con un componente, y cambios chicos en archivos
existentes: el tipo `Usuario` y la relectura de `esAdmin` en `entrar()`, el
enlace, el cableado.

## Constitution Check

*GATE: pasa antes de Phase 0. Re-evaluado después del diseño de Phase 1.*

Contra `.specify/memory/constitution.md` **6.1.0**, enmendada para este feature
el 2026-09-11: el tablero pasa de la lista de la app Android a la de la web,
solo para administración. MINOR, sin ADR (spec § Clarifications).

| Principio | Estado | Cómo lo honra este plan |
|---|---|---|
| I. Visual-first MVP | ✅ | Una pantalla que Diego puede ver y criticar antes de invertir en más: sin gráficos ni tendencias hasta que los pida. |
| II. Self-service data entry | ✅ | No toca el formulario ni agrega fricción al cliente. |
| III. Simplicity over infrastructure | ✅ | Cero dependencias, cero migraciones, dos `SELECT` sin agregación. Se descartó agregar en SQL y llevar el estado a la URL porque a este volumen no compran nada (D1, D11). Tres números y un filtro, y ni uno más. |
| IV. Mobile-first, low-friction UI | ✅ | Rige el formulario del cliente; esta pantalla es de escritorio por decisión del spec, y aun así no se rompe a 360 px (quickstart Q14). |
| V. The price is behind the login | ✅ | **Ningún monto** en ninguna parte (FR-012). **La columna `precio` no se lee**, y el paquete del tablero ni siquiera puede nombrarla (D2, D9). 6.1.0 no tocó una palabra de este principio. |
| Scope boundaries (6.1.0) | ✅ | La superficie web lista ahora "for administrators only, the operator's tablero", que cuenta y no muestra plata. Es exactamente esto. |

**Plan-bounded change (harness)**: `covers:` nombra los tres directorios nuevos
del feature (`backend/internal/tablero/`, `web/app/tablero/`,
`web/components/tablero/`), `backend/cmd/api/` —cableado y la prueba del
preflight—, y archivos concretos para todo lo demás. `web/components/sesion/` y
`web/lib/` **no** entran como directorio: solo el archivo que se toca.

**Verified before done (harness)**: `verify:` corre las dos patas que se tocan,
web y backend. **Tiene el problema del skip silencioso de Postgres**: las pruebas
de base de `internal/tablero` se saltan sin `TEST_DATABASE_URL`, así que "verde"
exige además **cero SKIP** (quickstart Q1). No hay pata de Android porque
`android/` no se toca.

**Lo que `verify:` NO prueba**: los seis estados de la pantalla, que una cuenta
común no dispare la llamada, que el total coincida con la base real, y que la
ruta nueva pase el CORS **desde un navegador**. Lo cubre el quickstart, y **el
plan no está hecho hasta que se corrió**.

**Lo que decide si el feature funciona y no es código**: que `ADMIN_EMAILS` en
Railway tenga el mail de Diego, y que la base de producción no tenga pedidos de
prueba (FR-004b los cuenta). Los dos son pasos de Q15.

### Re-evaluación post-diseño (Phase 1)

Sin violaciones. El diseño **achica** la superficie que toca plata en vez de
agrandarla: el paquete nuevo no importa el que tiene el campo `Precio`, y la
respuesta no tiene dónde llevarlo. **Complexity Tracking queda vacío a
propósito.**

## Project Structure

### Documentation (this feature)

```text
specs/025-dashboard-de-diego/
├── plan.md              # Este archivo
├── spec.md              # Brief, con 6 clarificaciones (2026-09-10 y 2026-09-11)
├── research.md          # Phase 0: doce decisiones
├── data-model.md        # Phase 1: sin migracion; que se lee y que se calcula
├── quickstart.md        # Phase 1: Q1-Q15, lo que ninguna prueba ve
├── contracts/
│   └── tablero.md       # GET /admin/tablero y los seis estados de la pantalla
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks — NO lo crea /speckit-plan
```

### Source Code (repository root)

```text
backend/
├── cmd/api/
│   ├── main.go                  # MODIFICADO: GET /admin/tablero con conSesion
│   └── main_test.go             # MODIFICADO: el camino nuevo en la lista del preflight
└── internal/tablero/            # NUEVO
    ├── tablero.go               #   Repositorio: las dos consultas. Sin `precio`.
    ├── handlers.go              #   GET /admin/tablero: 403 si no es admin
    ├── tablero_test.go          #   contra Postgres: todas las filas, todas las cuentas
    ├── handlers_test.go         #   401/403/200, 403 sin datos, listas vacias no null
    └── sin_plata_test.go        #   las guardas de D9, con control positivo

web/
├── app/tablero/
│   └── page.tsx                 # NUEVO: servidor; metadata noindex + montaje
├── components/
│   ├── tablero/
│   │   └── tablero.tsx          # NUEVO: los seis estados del contrato
│   ├── sesion/
│   │   └── proveedor-sesion.tsx # MODIFICADO: `esAdmin?: boolean` en Usuario, y
│   │                            #   entrar() relee /yo y copia solo esAdmin
│   └── nav-bar.tsx              # MODIFICADO: "Tablero" si usuario.esAdmin
└── lib/
    ├── tablero.ts               # NUEVO: el calculo y el copy, puros
    ├── tablero.test.ts          # NUEVO: invariantes de data-model.md
    ├── api.ts                   # NO SE TOCA: la llamada va por useLlamadaAutenticada
    ├── sin-precio-a-la-vista.test.ts  # MODIFICADO: control positivo (D9)
    ├── sin-comentarios.ts       # NUEVO: sale de la guarda de arriba, sin cambios
    └── cotizar-abierto.test.ts  # NO SE TOCA: tiene que seguir verde
```

**Structure Decision**: web + backend, con el dominio nuevo en su propio
paquete de `internal/` (por dominio, como pide `ARCHITECTURE.md`) y su pantalla
en una ruta propia. `android/` queda fuera del `covers:` a propósito (FR-018).

## Complexity Tracking

Vacío. El Constitution Check no tiene violaciones que justificar.
