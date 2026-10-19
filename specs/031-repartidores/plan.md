---
ticket: none
status: completed
covers:
  # La columna `pedidos.repartidor_email`, nulable, sin default (D2).
  - backend/migrations/
  # La prueba de 0011 contra una base con pedidos ya cargados (T005).
  - backend/internal/db/migrate_test.go
  # `REPARTIDOR_EMAILS`, opcional, y `EsRepartidor` (D1).
  - backend/internal/config/
  # Alcance por rol en la lista y el estado, `responsable`, la ruta de
  # asignacion y la prueba de pedido ajeno (D4, D5, D6).
  - backend/internal/pedidos/
  # `TokensDe`, `AvisarAsignacion`, edicion y baja al repartidor (D7).
  - backend/internal/avisos/
  # `repartidor` y `entregadoEn` por carga, y la lista de repartidores (D8).
  - backend/internal/tablero/
  # `?repartidor=`, corte por entrega en Montevideo (D9).
  - backend/internal/reporte/
  # Cablear `EsRepartidor` y montar `PUT /admin/pedidos/{id}/repartidor`.
  - backend/cmd/api/
  - backend/README.md
  - backend/.env.example
  # La seccion Repartidores del tablero y el reporte por repartidor.
  - web/lib/
  - web/components/tablero/
  # Modelo (`rol`, `responsable`, `repartidores`), servicio, chips, acciones.
  - android/app/src/main/java/uy/flashurbano/repartidor/
  - android/app/src/test/java/uy/flashurbano/repartidor/
  # 6.3.0 y su ADR (D11).
  - .specify/memory/constitution.md
  - docs/decisions/more-than-one-courier.md
  # Como sumar o sacar un repartidor, sin mails reales (D12).
  - docs/processes/app-repartidor.md
  - docs/processes/staging.md
  - docs/processes/railway-despliegue.md
  - docs/README.md
  # "android/ — Diego's app" deja de ser cierto; los dos, en el mismo commit.
  - AGENTS.md
  - CLAUDE.md
  - specs/031-repartidores/
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-10-18
---

# Implementation Plan: Repartidores

**Branch**: `031-repartidores` | **Date**: 2026-10-18 | **Spec**:
[spec.md](spec.md)

## Summary

Un segundo rol, **repartidor**, definido como el de administrador: por mail, en
una variable de entorno (`REPARTIDOR_EMAILS`, opcional). Cada pedido gana un
responsable en `pedidos.repartidor_email` —nulo = de los administradores—, que
Diego cambia desde la app y que **queda fijo al entregarse**. El repartidor ve y
trabaja solo lo suyo con las mismas rutas que hoy usa la app; el administrador
ve todo con un filtro **Mios / Todos**. Al asignar, al repartidor le llega
"Nuevo paquete asignado". El tablero web suma una seccion **Repartidores** que
cuenta y baja el reporte **por fecha de entrega**.

Toca **las tres superficies**. El servicio nuevo es compatible con la app
instalada hoy (D5), asi que el orden de despliegue no corre riesgo.

## Technical Context

**Language/Version**: Go 1.2x (`backend/`), TypeScript + Next (`web/`), Kotlin
+ Jetpack Compose (`android/`)

**Primary Dependencies**: ninguna nueva.

**Storage**: Postgres + PostGIS. Una columna nulable en `pedidos` y un indice
parcial. Nada en `usuarios`.

**Testing**: `go test` (las de base necesitan `TEST_DATABASE_URL` o se
saltean solas: **mirar el conteo de skips**), `vitest` en `web/`, JUnit en la
JVM para Android.

**Target Platform**: Railway (staging y produccion), el sitio estatico, y la app
instalada por `scripts/publicar-app.sh`.

**Project Type**: servicio + web + app movil.

**Performance Goals**: los de hoy. Un repartidor, decenas de pedidos por dia.

**Constraints**: no leer `precio` (Principio V); el formulario de pedido sigue
sin importar `web/lib/api.ts`; ningun mail real en el repo; ninguna variable
obligatoria nueva.

**Scale/Scope**: 2 administradores, 1 repartidor hoy, N admitidos.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Visual-first | si | Diego lo ve en la app y el tablero |
| II. Self-service | si | el formulario del cliente no cambia |
| III. Simplicity | **con enmienda** | "single-operator" deja de ser cierto → 6.3.0 (D11). Sin tablas nuevas, sin rutas paralelas, sin pantalla de detalle nueva |
| IV. Mobile-first | si | chips y acciones en la tarjeta; Q14 del quickstart |
| V. Precio | si | el reporte por repartidor no lee `precio`; guardas existentes cubren `reporte` y `tablero` |
| Scope boundaries | **con enmienda** | la app deja de ser solo de Diego; el tablero suma un corte |

**Gate**: pasa, condicionado a que la enmienda 6.3.0 entre en el mismo PR y
antes del codigo (FR-024).

Post-diseño: sin cambios. La unica complejidad agregada es el responsable
efectivo (D4), que evita una escritura masiva y se cubre con una prueba de
tabla.

## Project Structure

### Documentation (this feature)

```text
specs/031-repartidores/
├── spec.md
├── plan.md
├── research.md        # D1–D12
├── data-model.md
├── contracts/api.md
├── quickstart.md      # Q1–Q14, en staging
└── tasks.md           # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── migrations/0011_repartidor_del_pedido.sql
├── internal/config/          # REPARTIDOR_EMAILS, EsRepartidor
├── internal/pedidos/         # responsable, alcance, Asignar
├── internal/avisos/          # TokensDe, AvisarAsignacion
├── internal/tablero/         # repartidor, entregadoEn, repartidores
├── internal/reporte/         # ?repartidor=
└── cmd/api/main.go           # cableado y ruta nueva
web/
├── lib/tablero.ts, lib/reporte.ts   # resumir por entrega, ruta del reporte
└── components/tablero/              # seccion Repartidores
android/app/src/main/java/uy/flashurbano/repartidor/
├── datos/                    # Pedido.responsable, rol, Servicio.asignar
└── pantallas/                # chips Mios/Todos, Asignar, Devolver a Diego
```

**Structure Decision**: sin modulos nuevos. Todo entra en los paquetes que ya
llevan cada responsabilidad.

## Orden de trabajo

1. Enmienda 6.3.0 + ADR (FR-024). Sin esto el resto no cumple la constitucion.
2. Backend: migracion → config → `responsable` → alcance de lista y estado →
   `PUT …/repartidor` → avisos → tablero → reporte. Cada paso con su prueba; la
   de pedido ajeno con control positivo (romper el filtro a proposito y verla
   en rojo).
3. Web: seccion Repartidores y reporte por repartidor.
4. App: modelo, servicio, chips, acciones, textos.
5. Docs de proceso: sumar y sacar un repartidor (sin mails).
6. `verify:` verde, con el conteo de skips de Go mirado.
7. Staging: quickstart Q1–Q14.
8. PR a `master`; en produccion: variable → deploy → app → Diego asigna.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principio III ("single-operator") | hay un segundo repartidor | no hay alternativa: el hecho cambio; se enmienda en vez de esquivarlo |
| Responsable calculado al leer (D4) | sacar un mail no debe escribir | limpiar la columna al arrancar es una escritura masiva en el arranque |
