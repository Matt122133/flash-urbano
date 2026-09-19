---
ticket: none
status: completed
covers:
  # El paquete Go nuevo: la consulta, el handler y SU guarda de plata.
  - backend/internal/reporte/
  # La ruta nueva. `/admin/tablero` NO se toca.
  - backend/cmd/api/main.go
  - backend/cmd/api/main_test.go
  # El CSV resuelto como dato, y su prueba. Modulo puro.
  - web/lib/reporte.ts
  - web/lib/reporte.test.ts
  # Estaba previsto meterle una funcion, y **al final no hizo falta**:
  # `useLlamadaAutenticada()` ya da un `llamar<T>(ruta)` generico, asi que la
  # ruta se arma en `lib/reporte.ts` —pura y probada— y este archivo no se
  # toco. Mejor asi: lo vigila `cotizar-abierto.test.ts`.
  - web/lib/api.ts
  # El boton por fila del cuadro, y el estado de "elegi una cuenta".
  - web/components/tablero/tablero.tsx
  # Los textos de pantalla del tablero viven aca, no en el componente.
  - web/lib/tablero.ts
  - web/lib/tablero.test.ts
  # La enmienda 6.2.0 (FR-021). `.specify/` NO esta en la lista de siempre
  # permitidos, asi que sin este prefijo el sensor rebota ese commit.
  - .specify/memory/constitution.md
  - .specify/feature.json
  # SOLO la prueba de que `/admin/tablero` sigue devolviendo las mismas claves
  # (T032b, SC-010). **El endpoint no se toca**: lo que se agrega es la guarda de
  # que sigue sin tocarse, que es la mitad verificable de FR-017. Mismo caso que
  # `026` con este mismo paquete. Sin el prefijo, el sensor rebota ese commit.
  # Si alguna tarea necesitara CAMBIAR algo de ahi, es una parada y una decision.
  - backend/internal/tablero/
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./...
analyzed: 2026-09-19
---

# Implementation Plan: El reporte del mes

**Branch**: `029-reporte-del-mes` | **Date**: 2026-09-19 | **Spec**:
[spec.md](spec.md)

## Summary

Desde el tablero, Diego baja un CSV con los envios de un periodo de **una**
cuenta: codigo, fecha de retiro, fecha de entrega, direccion, zona y paquetes.
**Ningun importe.** El aplica su lista de precios afuera del producto.

Toca **dos superficies**. En el servicio nace `GET /admin/reporte`, en un paquete
propio, que **exige** la cuenta: sin ella responde 400, nunca "todos". En la web
nace `lib/reporte.ts`, que arma el CSV como dato antes de volverlo texto, y el
cuadro del tablero gana un boton de descarga por fila.

Y **se amenda la constitucion a 6.2.0**: hoy dice que el tablero *cuenta*, y esto
lo hace *listar*. MINOR, sin ADR, y va antes del gate, no despues.

## Technical Context

**Language/Version**: Go 1.2x (`backend/`), TypeScript 5 + Next.js 16 (`web/`)

**Primary Dependencies**: ninguna nueva, **en ninguno de los dos lados**. Un CSV
son comas y comillas; esa es la mitad del motivo por el que se eligio sobre XLSX.

**Storage**: Postgres, **sin migracion**. Todo lo que el reporte necesita ya esta
guardado; lo que no existia era el camino de lectura. Ver
[data-model.md](data-model.md).

**Testing**: Vitest en `web/` (`environment: node`, `include: lib/**/*.test.ts`);
`go test` en `backend/`. **Las pruebas de Go contra Postgres se saltean solas sin
`TEST_DATABASE_URL`** — contar los `skip`, no mirar el verde.

**Target Platform**: la pantalla es un navegador de escritorio; el artefacto
final es un archivo que se abre en una planilla **configurada en español**.

**Project Type**: web + backend. **`android/` no se toca**, y por eso `verify:`
no corre la pierna de Gradle.

**Constraints**: FR-017 — traer el reporte no puede encarecer la pantalla de
conteos. Es lo que obliga al endpoint aparte (research D1).

**Scale/Scope**: un operador, decenas de pedidos por mes. Sin paginado.

## Constitution Check

*GATE: pasa antes de Phase 0 y se re-evalua despues del diseño.*

- **Principio V — el precio. Es el riesgo central de este feature.** Un archivo
  llamado "reporte", abierto en una planilla, es donde una columna de total
  aparece sola. **No aparece**: no esta el dato en la respuesta del servicio, no
  esta el campo en la estructura de la web, y hay **dos** guardas automaticas
  nuevas —una por lado— porque ninguna de las existentes cubre codigo nuevo
  (research D6). La columna `precio` no se lee ni directa ni indirectamente.

  **La zona no es un precio**, y esa distincion sostiene el feature: el nombre de
  la zona ya se muestra en el formulario y va impreso en la etiqueta desde `020`.
  Convertirla en plata es trabajo de Diego, afuera del producto, como la
  constitucion describe.
- **Principio V — adivinar zonas.** La zona sale **del punto guardado**, con el
  mismo resolvedor que el formulario y la etiqueta. Sin punto no hay zona y la
  celda va vacia. Nunca se deduce de la direccion escrita.
- **Scope boundaries — y aca hay una brecha real que este plan cierra.** La
  constitucion dice que el tablero *"cuenta"*. Este feature lo hace **listar**.
  **El plan NO declara que cumple contra el texto actual**: declara que el texto
  se amenda a **6.2.0** como parte del trabajo (FR-021, research D7). MINOR
  —ningun principio se reversa, nada construido queda fuera de norma— y **sin
  ADR**, igual que 6.1.0, 5.1.0 y 2.1.0.
- **Principio III — YAGNI.** Lo unico que se agrega es un endpoint y un modulo
  puro. Sin libreria de planilla, sin migracion, sin agregaciones en SQL: el
  servicio devuelve hechos y la web formatea, que es el reparto que `025` ya
  eligio y justifico.
- **Privacidad, que no es un principio pero es la decision mas fuerte del
  feature.** FR-006 se implementa **en el servicio**, no en la pantalla: el
  endpoint no sabe contestar "todas las cuentas". Un boton que no se muestra es
  una precaucion; un endpoint que no puede producir el archivo mezclado es una
  garantia.
- **Plan-bounded change (harness).** `covers:` nombra los dos lados.
  `backend/internal/tablero/` **si esta, y solo por una prueba**: T032b afirma
  que ese endpoint sigue devolviendo las mismas claves, que es la mitad
  verificable de FR-017. **El endpoint no se toca; lo que se agrega es la guarda
  de que sigue sin tocarse** — mismo caso que `026` con ese mismo paquete. La
  primera version de este plan lo excluia, y el `/speckit-analyze` mostro que
  entonces SC-010 no tenia donde caer: no hay forma de probar que algo no
  cambio sin escribir la prueba al lado de lo que no cambio.
- **Verified before done (harness).** `verify:` corre las dos piernas que este
  feature toca. **No corre Gradle** porque `android/` no se toca.
- **Staging antes que produccion.** Aca no es formalidad: **hay una ruta nueva en
  el servicio**, asi que se despliega a staging y se ejercita ahi antes de
  mergear a `master`.

Re-evaluacion post-diseño: **sin violaciones**, con la enmienda 6.2.0 como parte
declarada del trabajo. *Complexity Tracking* vacio.

## Project Structure

```text
backend/internal/reporte/        # NUEVO: consulta + handler + guarda de plata
├── reporte.go
├── reporte_test.go
├── handlers.go
├── handlers_test.go
└── sin_plata_test.go            # Su propia: la de `tablero` escanea su paquete
backend/cmd/api/main.go          # +1 ruta. /admin/tablero NO se toca.

web/lib/reporte.ts               # NUEVO: el CSV como dato, y despues como texto
web/lib/reporte.test.ts          # NUEVO
web/lib/api.ts                   # NO SE TOCO: `llamar<T>()` ya era generico
web/lib/tablero.ts               # +textos de pantalla (el boton, "elegi cuenta")
web/components/tablero/tablero.tsx  # +boton por fila

.specify/memory/constitution.md  # 6.1.0 -> 6.2.0
```

**Structure Decision**: se respeta el patron de los dos lados. En Go, **un
paquete por dominio** (`auth/`, `usuarios/`, `tablero/`, ahora `reporte/`), no
por capa. En `web/lib/`, **la logica pura separada de la pantalla**, porque en
este repo nada renderiza React en una prueba: lo que vive en `lib/` se puede
afirmar y lo que vive en un componente, no.

## El trabajo, en orden

**1. La enmienda, primero.** Amendar `.specify/memory/constitution.md` a 6.2.0:
el bullet del tablero pasa a decir que **cuenta y lista**, y se agrega la entrada
al historial explicando por que es MINOR y por que no lleva ADR. Va primero
porque es el documento contra el que todo lo demas se justifica.

**2. El servicio.** Paquete `internal/reporte`: la consulta —con el `LEFT JOIN`
lateral al historial para la marca de entrega **mas reciente**— y el handler, que
**exige `cliente`, `desde` y `hasta`**, y responde 403 a quien no sea
administrador, antes de tocar la base. Su `sin_plata_test.go`, con control
positivo. Observable: `curl` con sesion de administrador devuelve las filas; sin
`cliente`, 400.

**3. El CSV como dato.** `lib/reporte.ts`: de la respuesta del servicio a
`FilaDeReporte[]` —componiendo la direccion con la funcion que ya existe,
resolviendo la zona con la que ya existe, y pasando el instante de entrega por
`fechaEnMontevideo` que ya existe— y de ahi al texto, con `;`, BOM, CRLF y
citado. **Tres funciones reusadas y ningun helper nuevo**: el repo ya tiene
resueltas estas trampas. Observable: una prueba arma un pedido y compara el texto
exacto, byte a byte.

**4. La pantalla.** El boton por fila del cuadro, el estado deshabilitado cuando
no hay cuenta elegida con su texto, y el manejo de la falla: si el reporte no
sale, **se dice**; nunca se baja un archivo vacio ni no pasa nada.

**5. El papel, que aca es una planilla.** `quickstart.md`, entero, abriendo el
archivo **de doble clic** en una planilla en español. Es donde se ve si el
separador, el BOM y el fin de linea estan bien, y ningun `expect` lo sabe.

## Lo que mas probablemente salga mal

- **El verde de Go sin base.** Las pruebas contra Postgres se saltean solas sin
  `TEST_DATABASE_URL`, y la consulta del reporte —con su join al historial— es
  justo lo que esas pruebas cubren. **Contar los `skip`.**
- **La prueba de la fecha de Montevideo pasando por casualidad.** Esta maquina
  esta en Montevideo: una prueba que use la zona del proceso pasa sin probar
  nada. Hay que forzar la zona adentro y afirmar que tomo.
- **El citado del CSV**, que es la parte aburrida y la que rompe el archivo. El
  campo peligroso es la direccion. Se prueba con coma, con comillas y con las dos.
- **Olvidarse de la enmienda.** FR-021 no lo rompe ninguna prueba: si nadie lo
  mira, el feature sale con la constitucion diciendo otra cosa. Por eso es el
  paso 1 y no el ultimo.
