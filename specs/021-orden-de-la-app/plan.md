---
ticket: none
status: completed
covers:
  # La consulta y su prueba. Nada mas: el feature es un ORDER BY.
  - backend/internal/pedidos/pedido.go
  - backend/internal/pedidos/pedido_test.go
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd backend && go vet ./... && go test ./... -p 1 && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-09-05
---

# Implementation Plan: El dia de trabajo, del mas viejo al mas nuevo

**Branch**: `021-orden-de-la-app` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

> ## Cerrado el 2026-09-06, verificado en produccion
>
> `verify:` verde con las pruebas de base efectivamente corridas (2 salteadas,
> igual que la linea base). Mergeado y desplegado.
>
> **T011 lo cerro Mateo mirando la app**, sin instalar nada — que es lo que
> FR-006 pedia y lo que un emulador no habria probado. Su observacion fue "veo
> todo ordenado por codigo", que **es la confirmacion de que el SQL nuevo esta
> vivo**: con el viejo veria el orden por fecha de retiro descendente. Codigo y
> creacion coinciden porque los dos los pone la base al insertar.
>
> T012 —el historial del cliente en /perfil— quedo sin mirar a ojo, y lo cubre
> `TestPorUsuarioSigueDelMasNuevoAlMasViejo` contra Postgres.

## Summary

Diego abre la app y arriba ve lo ultimo que entro. Este plan invierte eso: **una
consulta SQL** pasa de `retiro_fecha DESC, retiro_hora DESC` a
`creado_en ASC, id ASC`. La app no se toca —el orden lo manda el servicio y hay
una prueba que lo fija— asi que **el APK de Diego no se reinstala**.

Dos cosas que la lectura del codigo agrego al pedido, y que estan en
[research.md](research.md):

- **El orden de hoy no es solo el inverso: es indefinido.** `retiro_hora` es
  `"16:00"` fija desde `014`, asi que dentro de un mismo dia de retiro no hay
  desempate y dos llamadas pueden devolver secuencias distintas. De ahi el
  `id ASC`.
- **La prueba de `Todos()` que ya existe cuenta filas y no mira el orden**, y
  las pruebas contra Postgres **se saltean solas** sin `TEST_DATABASE_URL`. O sea
  que hoy una regresion de orden no la detecta nada, y "verify verde" puede no
  haber probado el orden ni una vez.

## Technical Context

**Language/Version**: Go 1.26+.

**Primary Dependencies**: ninguna nueva.

**Storage**: Postgres + PostGIS. **Sin migracion**: `creado_en` ya existe y ya se
escribe.

**Testing**: `go test ./...`, con `flash-pg-test` levantado para que las pruebas
de base **no se salteen**.

**Target Platform**: el servicio en Railway; la app la consume sin cambiar.

**Project Type**: backend. El `verify:` incluye igual la pata de Android **como
guarda**: FR-005 exige que la prueba `la app no reordena los pedidos` siga en
verde, y compilarla cuesta poco.

**Performance Goals**: sin cambio. `creado_en` no tiene indice propio, pero la
tabla tiene decenas de filas; ordenar sin indice a esta escala es irrelevante.
Cuando importe, importara antes el paginado —fila `High` del 2026-08-26 del
tracker— que este `ORDER BY`.

**Constraints**: no se toca la app, no se toca el JSON, no hay migracion.

**Scale/Scope**: una consulta.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio V — nada lee `precio`, `paquete_tamano` ni `retiro_hora`.** Este
  feature **saca** una lectura de `retiro_hora`, o sea que acerca el codigo a la
  constitucion en vez de alejarlo. Ese es el unico punto en el que la
  constitucion tiene algo que decir aca.
- **Logistica manual.** El orden es una lista, **no una ruta**: no sugiere por
  donde ir ni en que orden visitar. La ruta economica sigue siendo un feature que
  no existe, y el contrato de la app se lo prohibe explicitamente.
- **Principio III — simplicidad.** Una linea de SQL y una prueba.
- **`covers:`** nombra dos archivos.
- **`verify:`** es el de `017`/`018`, backend + Android.

Sin violaciones. Complexity Tracking queda fuera.

## Project Structure

### Documentation (this feature)

```text
specs/021-orden-de-la-app/
├── plan.md          # este archivo
├── spec.md
├── research.md      # el orden indefinido de hoy y la trampa del skip
├── quickstart.md
├── checklists/requirements.md
└── tasks.md         # lo escribe /speckit-tasks
```

Sin `data-model.md`: no cambia ninguna forma. Sin `contracts/`: el JSON queda
igual, que es justamente lo que evita reinstalar el APK.

### Source Code (repository root)

```text
backend/internal/pedidos/
├── pedido.go        # Todos(): el ORDER BY. PorUsuario(): NO SE TOCA.
└── pedido_test.go   # la prueba de orden que falta

android/            # NO SE TOCA. Aparece para decir que no esta en covers:.
```

**Structure Decision**: `PorUsuario()` esta en el mismo archivo que `Todos()` y
**no se toca**: es el historial del cliente y sigue `creado_en DESC`. Que las dos
convivan a diez lineas de distancia es justo el motivo de que FR-004 exista como
requisito y tenga su propia prueba.

## Como se ejecuta

**1. Levantar la base de pruebas.** `flash-pg-test` en el 55432, y exportar
`TEST_DATABASE_URL`. **Sin esto el resto del plan no prueba nada**: las pruebas
de base se saltean solas y dejan todo en verde. Ver `backend/README.md`.

**2. Escribir la prueba primero, y verla en rojo.** En `pedido_test.go`: tres
pedidos creados en orden conocido, con fechas de retiro **desordenadas a
proposito** respecto de la creacion, y afirmar que `Todos()` los devuelve por
creacion ascendente. Con el SQL viejo tiene que fallar. Si pasa de una, la prueba
no esta probando el orden.

**3. Cambiar el `ORDER BY`** de `Todos()` a `creado_en ASC, id ASC`, y actualizar
el comentario de la funcion, que hoy explica el criterio viejo —*"por CUANDO SE
RETIRA y no por cuando se cargo"*— y quedaria diciendo lo contrario de lo que
hace.

**4. La guarda de `PorUsuario()`** (FR-004): una prueba que afirme que el
historial del cliente sigue del mas reciente al mas viejo. Es barata y protege
contra el arrastre, que es el riesgo real de tocar este archivo.

**5. Correr `verify:`** y **mirar el conteo de salteadas**. Verde con skips no es
verde.

## Como se sabe que funciono

`verify:` verde **y con las pruebas de base efectivamente corridas** prueba lo
que importa: que la lista de administracion viene por creacion ascendente, que es
determinista, que el historial del cliente no cambio, y que la app sigue sin
reordenar.

**Lo que no prueba**: que a Diego le sirva. Eso es mirarlo en la app, y esta en
el [quickstart](quickstart.md).

## Riesgos

**El riesgo principal es un falso verde**, y es especifico de este feature: la
unica prueba que verifica el cambio necesita una base, y sin `TEST_DATABASE_URL`
se saltea sin decir nada. Un `verify:` verde sin base levantada **no comprueba
absolutamente nada de este plan**. Por eso el paso 1 va primero y el 5 exige
mirar el conteo.

**El riesgo menor es Entregados.** Con orden ascendente, lo ultimo entregado
queda al fondo de una lista que solo crece. El cliente lo eligio sabiendolo; se
anota para revisarlo cuando haya volumen, y la salida es que el servicio devuelva
las secciones separadas.
