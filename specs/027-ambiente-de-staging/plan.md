---
ticket: none
status: completed
covers:
  # La guarda del cruce de cables: modulo puro, su prueba, y el enganche.
  - web/lib/url-del-api.ts
  - web/lib/url-del-api.test.ts
  - web/next.config.ts
  # Solo por si el enganche desde next.config.ts no resuelve el import (D4).
  # La salida es mover la invocacion al script `build`. Probablemente no se
  # toque; sin el prefijo, si hay que tocarlo el sensor rebota el commit.
  - web/package.json
  # El campo `ambiente` en /salud, y de donde sale su valor.
  - backend/cmd/api/main.go
  - backend/cmd/api/main_test.go
  - backend/internal/config/config.go
  - backend/internal/config/config_test.go
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  # NOTA: docs/ y specs/ estan siempre permitidos sin cobertura, asi que
  # docs/processes/railway-despliegue.md, el procedimiento nuevo y
  # docs/README.md no necesitan prefijo. No se listan para no dar a entender
  # que la lista es la definicion del alcance documental.
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./...
analyzed: 2026-09-13
---

# Implementation Plan: Un ambiente de staging

**Branch**: `027-ambiente-de-staging` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/027-ambiente-de-staging/spec.md`

## Summary

Poner en pie un segundo ambiente completo —servicio Go y base propia— en el que
Mateo pueda crear, editar y borrar pedidos de prueba **sin ensuciar la base de
producción y sin limpiar nada después**. Hoy no existe otro lado donde probar, y
eso ya obligó a borrar pedidos de producción a mano dos veces en septiembre.

La decisión de forma está en
[ADR separate-staging-environment](../../docs/decisions/separate-staging-environment.md):
**dos entornos de Railway de verdad**, no dos schemas en una base. La red
privada de Railway está aislada por entorno, así que el servicio de staging no
tiene ruta a la base de producción — el aislamiento es estructural y no depende
de que una cadena de conexión esté bien escrita. La objeción era el precio, y se
midió: el proyecto gasta ~US$0,58/mes contra US$5 incluidos, y duplicarlo suma
~US$0,55.

**Casi todo el trabajo es configuración de Railway y documentación.** Hay
exactamente dos piezas de código, y las dos existen para que un error silencioso
deje de serlo:

1. **La guarda del cruce de cables.** El riesgo nuevo que crea esta feature es
   publicar el sitio de producción apuntado al backend de staging: los pedidos
   de clientes reales entrarían a la base de prueba, y como
   `web/app/layout.tsx` deriva la CSP de la misma variable, el sitio
   funcionaría perfecto. No hay síntoma. Una aserción dentro del build lo
   convierte en un fallo ruidoso.
2. **El campo `ambiente` en `/salud`**, para que descubrir que estás apuntado al
   lado equivocado cueste una consulta y no media tarde.

## Technical Context

**Language/Version**: Go 1.x (`backend/`), TypeScript + Next.js (`web/`). No se
toca Kotlin: `android/` no cambia una línea.

**Primary Dependencies**: pgx v5 / pgxpool, Resend para correo, Next.js con
export estático. Ninguna dependencia nueva.

**Storage**: Postgres 17.5 + PostGIS 3.5, imagen fijada `postgis/postgis:17-3.5`.
**Sin migraciones nuevas** — ver [data-model.md](data-model.md).

**Testing**: `go test` para el servicio, `vitest` en entorno `node` para
`web/lib/**`.

**Target Platform**: Railway (plan Hobby), un proyecto, pasando de uno a **dos
entornos**.

**Project Type**: servicio web con front estático, más una app Android que acá
no participa.

**Performance Goals**: ninguno. Es un ambiente para un usuario; escribir
objetivos de latencia sería inventarlos.

**Constraints**: el costo total del proyecto tiene que seguir dentro de los US$5
de uso ya incluidos (FR-013, SC-005). La base de staging arranca **vacía** y
nunca recibe copia de producción.

**Scale/Scope**: un usuario, un ambiente extra, cero réplicas.

## Constitution Check

*GATE: revisado antes de Phase 0 y otra vez después de Phase 1.*

**Principio III — "Simplicity over infrastructure (YAGNI)"** es el que esta
feature tiene que responder, y hay que hacerlo de frente: dice explícitamente
que no se agrega infraestructura especulativa a un negocio de un solo operador.
Un segundo ambiente **es** infraestructura nueva.

Lo que lo justifica no es una previsión sino un hecho consumado: **la base de
producción ya tuvo que limpiarse a mano**, con un runbook escrito para eso, y
volvió a pasar al cerrar `026`. La alternativa a este trabajo no es "menos
infraestructura", es seguir probando en producción y seguir limpiando. El
requisito además nace de una necesidad declarada por el dueño del repo, que es
la evidencia que el principio pide.

Donde el principio sí manda es en el **tamaño**, y así quedó acotado: un solo
ambiente extra, un solo usuario, sin réplicas, sin ambientes por rama, sin
promoción automática, sin web de staging desplegada y sin control de acceso
propio.

**Principio V** — intacto. Nada de esta feature cambia qué se muestra ni quién
lo ve, y la columna `precio` sigue sin leerse.

**Repo público / sin datos de clientes** — FR-003 (base vacía) es la forma que
toma esa restricción acá: copiar producción habría puesto datos de clientes
reales en un segundo lugar, y el historial de un repo público no se borra.

**Plan-bounded change** — `covers:` nombra los ocho archivos de código y el
`feature.json`. Los documentos van por la exención de `docs/`.

**Verified before done** — el `verify:` corre las dos patas que este plan toca.
**No lleva la pata de Android a propósito**: no se toca `android/`. Dos
advertencias sobre lo que ese verde no dice:

- las pruebas de Go contra Postgres **se saltean solas sin
  `TEST_DATABASE_URL`**, así que "todo verde" no dice nada de la base salvo que
  se mire el conteo de saltos;
- **el `verify:` no crea un entorno, no manda un correo y no comprueba que dos
  bases estén separadas.** Eso es el [quickstart](quickstart.md), y en esta
  feature el quickstart es la mayor parte de la evidencia, no un apéndice.

**Sin violaciones que justificar**: la sección *Complexity Tracking* queda
vacía y por eso se removió.

## Project Structure

### Documentation (this feature)

```text
specs/027-ambiente-de-staging/
├── plan.md              # Este archivo
├── spec.md              # 26 requisitos, cero marcadores abiertos
├── research.md          # D1-D10: lo medido y lo decidido
├── data-model.md        # No hay entidades nuevas, y por qué eso es correcto
├── quickstart.md        # Q1-Q11: donde vive la evidencia de esta feature
├── contracts/
│   └── salud.md         # El único contrato que cambia, aditivo
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Lo escribe /speckit-tasks
```

### Source Code (repository root)

```text
web/
├── lib/
│   ├── url-del-api.ts        # NUEVO: la guarda, como funcion pura
│   └── url-del-api.test.ts   # NUEVO: las dos mitades, incluido el rojo
├── next.config.ts            # invoca la guarda cuando GITHUB_PAGES=true
└── package.json              # solo si el enganche de next.config falla (D4)

backend/
├── cmd/api/
│   ├── main.go               # el campo `ambiente` en la respuesta de /salud
│   └── main_test.go          # 200, 503, y sin la variable
└── internal/config/
    ├── config.go             # lee RAILWAY_ENVIRONMENT_NAME, opcional
    └── config_test.go        # que su ausencia NO impida arrancar

docs/
├── processes/
│   ├── staging.md            # NUEVO: el procedimiento de uso (FR-014)
│   └── railway-despliegue.md # refresco: hoy describe el estado de 006 (FR-015)
└── README.md                 # indexar el procedimiento nuevo
```

**Structure Decision**: se respeta el reparto que el repo ya tiene. La guarda va
como **módulo puro en `web/lib/`** porque es la única forma probada de que
`vitest` la cubra: `web/vitest.config.ts` corre en `node` con
`include: ["lib/**/*.test.ts"]`, y el repo no tiene pruebas de componentes. El
módulo **no debe importar `web/lib/api.ts`** — hay una prueba que guarda que
`api.ts` no entre al grafo de importación del formulario de pedido, y romperla
sería tumbar la cotización con el servicio caído.

## Orden de ejecución, y por qué es ése

**Lo primero es D4, y no es negociable.** El único riesgo técnico abierto del
plan es si `next.config.ts` puede importar un módulo TypeScript local con la
resolución que Next usa para cargar su configuración. **No está verificado.** Si
no puede, la salida es mover la invocación al script `build` de
`web/package.json`, dejando el módulo puro donde está. Averiguarlo primero
cuesta minutos; averiguarlo al final cuesta rehacer el enganche y sus pruebas.

Después, **las dos piezas de código antes de tocar Railway**. La guarda y el
campo `ambiente` se prueban enteros en local, y llegan al entorno nuevo ya
funcionando. Al revés —crear el entorno y después escribir el código— obliga a
desplegar para probar cada corrección.

**Crear el entorno viene tercero**, y con él el orden interno importa: la base
antes que el servicio, y las variables antes del primer despliegue. El servicio
**se niega a arrancar** si falta cualquiera de las seis obligatorias, aunque
reporta todas juntas.

**Q5 —el correo— apenas el entorno exista.** Es el fallo que no se ve hasta el
primer intento de ingreso, y si el remitente no está verificado en Resend,
staging no tiene forma de entrar. Descubrirlo tarde bloquea todo lo demás.

**La documentación va al final pero no como relleno**: FR-020 le pone una
obligación concreta —decir cómo saber qué versión corre en staging— y SC-006 se
mide releyéndola sin usar lo que quedó en la cabeza.

## Lo que este plan deliberadamente no hace

- **No mueve PostGIS** a un schema `extensions`. Era el costo de la opción
  barata y desapareció con la decisión de dos entornos.
- **No toca la base de producción.** Ni una migración, ni un dato.
- **No agrega control de acceso** al servicio de staging (FR-017).
- **No agrega un interruptor** que elija el enviador falso de correo. Habría
  bifurcado el camino de autenticación y habría hecho que staging dejara de
  probar el camino real.
- **No despliega una web de staging.** Corre local.
- **No toca `android/`, Firebase, Pages, el DNS ni Google OAuth.**
- **No conecta el servicio de staging al repositorio** (FR-019). Es lo que hace
  que "manual" sea cierto y no una intención.

## Riesgos, en orden de qué tan caro sale equivocarse

1. **El sitio de producción publicado contra staging.** Silencioso, y el daño
   son pedidos de clientes reales en la base equivocada. Es el motivo de
   FR-008/009 y del control positivo de Q1. **No alcanza con verlo en verde.**
2. **El remitente de staging sin verificar en Resend** deja staging sin forma de
   entrar (FR-016a, Q5). Se descubre tarde por naturaleza.
3. **`RAILWAY_ENVIRONMENT_NAME` leída como obligatoria** dejaría producción sin
   arrancar en el próximo despliegue (FR-022, Q4). Ya pasó algo así en este
   proyecto; el patrón correcto ya existe en `config.go` y se copia.
4. **Pisar `web/.env.local`**, que existe y no está versionado. Se lee antes de
   escribirlo.
5. **Instalar la app de staging en un teléfono.** Mismo `applicationId` y misma
   firma que producción: la reemplaza en silencio y la deja apuntando al lado
   equivocado. Sólo emulador, sólo `adb -s`.
6. **El costo real por encima de la estimación.** La cifra de `research.md` es
   una extrapolación de 24 horas anterior a que staging existiera; SC-005 pide
   medirla de nuevo, no repetirla.
