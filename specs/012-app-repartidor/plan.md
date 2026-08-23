---
ticket: none
status: draft
covers:
  # La app. TODAVIA NO EXISTE: este feature crea el directorio, y con el la
  # tercera superficie del repo. Ver research D2.
  - android/
  # Las salidas de compilacion de Gradle. `.gitignore` NO esta entre los caminos
  # exentos del sensor de cobertura, asi que va nombrado.
  - .gitignore
  # La migracion 0005: la tabla del historial de estados.
  - backend/migrations/
  # El endpoint que escribe el estado, y el historial que lo acompaña.
  - backend/internal/pedidos/
  # La renovacion deslizante de la sesion. Ver research D7.
  - backend/internal/auth/
  # Donde se registra la ruta nueva.
  - backend/cmd/api/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... && cd ../android && ./gradlew assembleDebug testDebugUnitTest
analyzed:
---

# Implementation Plan: La app de Diego — ver los pedidos y moverlos

**Branch**: `app-repartidor` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-app-repartidor/spec.md`

## Summary

Diego abre una app en su teléfono, ve los pedidos que entraron por la web
agrupados en **pendientes** y **tomados**, y los mueve con un toque: *ya lo
tengo* cuando levanta el paquete, *entregado* cuando lo deja. Quien envió lo ve
en *Mis pedidos* sin que nadie le avise nada.

**Es la primera entrega de la segunda superficie**, y lo que arregla es concreto:
hoy **todo pedido dice "Pendiente" para siempre** porque el ciclo de vida existe
en la base y no hay una línea que lo mueva.

**Tres superficies, y las tres se tocan.** El servicio gana el camino que escribe
el estado —que no existe—, el historial de cambios, y la renovación de sesión que
hace que Diego no vea nunca una pantalla de ingreso. La app es nueva entera. El
sitio **no se toca**: ya sabe mostrar los tres estados desde `010`.

**Lo que gobierna este plan**: la app es una herramienta de calle, no un panel.
Un toque por pedido, botones grandes, y **nada que se pueda tocar sin querer** —
porque cada corrección posterior es un archivo nuevo instalado a mano en el
teléfono de otra persona.

## Technical Context

**Language/Version**: Kotlin sobre Android (Jetpack Compose, Material 3),
`minSdk 26`, `targetSdk 36`. Go 1.26 y Postgres+PostGIS del lado del servicio.
TypeScript del lado del sitio, que **no se modifica**.

**Primary Dependencies**: OkHttp y `kotlinx.serialization` para hablar con el
servicio; `DataStore` para la credencial. **Sin Retrofit** — son dos llamadas
(research D4). Del lado del servicio, ninguna nueva.

**Storage**: una tabla nueva, `pedidos_estados`, en la migración `0005`. En el
teléfono **no hay base de datos**: sólo la credencial.

**Testing**: `vitest` en el sitio, `go test` en el servicio, y en Android
**pruebas de JVM** (`testDebugUnitTest`) sobre lo que no necesita dispositivo —
el mapeo de la respuesta y qué se muestra cuando faltan puntos. Las pruebas
instrumentadas quedan fuera del `verify:` (research D10). **Las pantallas no
tienen prueba automática**, igual que en `010` y `011`: su verificación es
[`quickstart.md`](quickstart.md), y acá tiene **dos niveles** — emulador y el
teléfono de Diego.

**Target Platform**: el teléfono de Diego, un Android cuya versión **nadie
verificó todavía** (research D3). El emulador cubre casi todo lo demás.

**Project Type**: tres superficies. Este feature crea la tercera.

**Performance Goals**: ninguno medible. La lista es corta y la app hace dos
llamadas.

**Constraints**: sin señal no funciona y lo dice (FR-008); nada se muestra como
hecho antes de que el servicio lo confirme; no hay forma de leer ni escribir
pedidos sin identificarse (FR-006).

**Scale/Scope**: dos pantallas y media, un endpoint, una tabla, y un cambio
chico en la sesión.

## Constitution Check

*GATE: pasa antes de Phase 0 y se vuelve a evaluar después del diseño.*

**Este feature cumple la constitución en vez de contradecirla**, a diferencia de
`011`. La segunda superficie está descrita ahí desde el principio; esto entrega
una parte.

- **Principio I (visual-first)**: entrega la rebanada más chica que ya le sirve a
  alguien. Diego puede tocarla y opinar antes de que exista la ruta.
- **Principio II (autoservicio)**: no lo toca. El autoservicio es del cliente
  final; esta superficie es del operador.
- **Principio III (simplicidad/YAGNI)**: sin Retrofit, sin base local, sin
  notificaciones, sin firma propia, sin ruteo. El historial de estados es lo
  único que se agrega sin que nadie lo pida hoy, y su justificación está escrita:
  **no se puede reconstruir después**.
- **Principio IV (móvil, poca fricción)**: es literalmente el principio de este
  feature. Un toque por pedido, y la decisión de no llevar selección múltiple
  sale de que los paquetes se levantan de a uno.
- **Principio V (el sitio cotiza)**: **intacto**. La app no calcula precios ni
  toca zonas. `web/lib/zonas.ts` y `zona-lookup.ts` no están en `covers:`.
- **Alcance (segunda superficie)**: la constitución pide más de lo que esto
  entrega —ruta y panel—, y entregar una parte no la contradice.
- **Plan acotado (harness)**: `covers:` nombra siete caminos, uno de los cuales
  **todavía no existe**. `web/` **no está**, y eso es una afirmación: si el sitio
  aparece en el diff, algo se entendió mal — ya sabe mostrar los tres estados.
- **Verificado antes de terminar (harness)**: `verify:` cubre las tres
  superficies. **Y no alcanza**, como siempre.

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/012-app-repartidor/
├── plan.md              # Este archivo
├── spec.md              # El qué y el porqué
├── research.md          # D1..D11, con lo descartado
├── data-model.md        # Una entidad nueva y una columna que empieza a moverse
├── quickstart.md        # LA verificación, en dos niveles
├── contracts/
│   └── servicio-y-pantallas.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo emite /speckit-tasks
```

### Source Code (repository root)

```text
android/                             # NUEVO — la tercera superficie
├── gradlew, gradle/                 # el wrapper, generado con la distribucion local
├── settings.gradle.kts
└── app/
    ├── build.gradle.kts             # minSdk 26, la URL por tipo de compilacion
    └── src/
        ├── main/                    # ingreso, lista, detalle, cliente del servicio
        └── test/                    # pruebas de JVM: mapeo y estados faltantes

backend/
├── migrations/0005_*.sql            # NUEVO: pedidos_estados
├── internal/pedidos/                # MODIFICADO: PATCH del estado + historial
├── internal/auth/                   # MODIFICADO: renovacion deslizante
└── cmd/api/main.go                  # MODIFICADO: la ruta nueva
```

**Structure Decision**: `android/` es hermano de `web/` y `backend/` porque la
app habla con el servicio por HTTP igual que el sitio — anidarla sugeriría una
dependencia que no existe. **El sitio no aparece**, y es deliberado.

## Cómo se ejecuta

Cinco tramos. Los tres primeros son del servicio y **se pueden verificar
enteros**; los dos últimos son la app.

### Tramo 1 — El servicio sabe escribir un estado

Migración `0005` con `pedidos_estados`, y `PATCH /admin/pedidos/{id}/estado` con
la forma del [contrato](contracts/servicio-y-pantallas.md) §1: acepta los tres
estados en cualquier dirección, es idempotente porque manda el **destino**, y
rechaza cualquier otro valor.

Cada cambio escribe su fila en el historial — **salvo cuando el estado no cambia**
(FR-009), que es lo que hace que tocar dos veces no ensucie el registro.

**Resultado observable**: las pruebas de `internal/pedidos` cubren la tabla
entera del contrato, incluido el caso de "el mismo estado dos veces" con su
control positivo sobre el historial.

### Tramo 2 — La sesión se renueva sola

En `internal/auth`, al validar una sesión: si le queda menos de la mitad de vida,
se extiende (research D7). **Con umbral, no en cada petición.**

Vale también para la web, y es correcto que valga: es la misma sesión.

**Resultado observable**: una prueba que usa una sesión vieja y comprueba que
`expira_en` se movió, y otra que usa una recién creada y comprueba que **no** se
escribió.

### Tramo 3 — El esqueleto de la app compila

Crear `android/` con la distribución de Gradle local (research D1), el wrapper,
Compose, y la URL por tipo de compilación — **con la excepción de texto plano
limitada a `debug`** (research D5).

**Resultado observable**: `./gradlew assembleDebug` produce un APK, y el
`verify:` de las tres superficies queda verde con una app que todavía no hace
nada.

### Tramo 4 — Ingreso y lista (US1, US3)

El ingreso por código, la credencial en `DataStore`, y la pantalla principal con
sus dos secciones. Los pedidos se muestran tolerando las tres formas que
data-model §5 enumera.

**Resultado observable**: E1 y E2 del quickstart, en el emulador.

### Tramo 5 — Mover el pedido (US2)

El botón único por sección, el deshacer como acción secundaria, y los estados que
no son una lista del contrato §5 — sobre todo **que nada se muestre como hecho
antes de que el servicio conteste**.

**Resultado observable**: E3 a E7, y sobre todo E3 — la primera vez que las dos
superficies se hablan.

### Al cerrar

- **T1 a T4 en el teléfono de Diego.** T4 cierra además algo pendiente desde el
  2026-08-11: ver un pedido real contra producción.
- Escribir en el repo **cómo se genera el APK** (FR-011) y **cómo se le corta la
  sesión a un teléfono perdido** (FR-016).
- `ARCHITECTURE.md` gana la tercera superficie.

## Complexity Tracking

Sin violaciones de la constitución que justificar.

Tres cosas que un revisor va a querer discutir, y que están decididas a la vista:

**Un toolchain nuevo en el repo.** Kotlin y Gradle se suman a TypeScript y Go.
Lo acepta la constitución —la app está en el alcance desde el día uno— pero el
costo es real: una superficie más que mantener, actualizar y verificar. Lo que lo
hace manejable es que la app es chica y no comparte código con nada.

**La verificación tiene un piso que la sesión no alcanza.** Puedo compilar,
instalar en el emulador y manejarlo con `adb`; **no puedo probar en el teléfono
de Diego**. Y es justo donde aparecen los defectos de una app de calle: el pulgar
que no llega, el sol de frente. El quickstart lo separa en dos niveles para que
nadie confunda uno con el otro.

**El historial de estados es lo único que se construye sin que nadie lo pida.**
Se acepta por el mismo argumento que ayer justificó guardar el punto de retiro:
el dato no se puede reconstruir hacia atrás, y con las reversiones permitidas el
estado actual **no cuenta lo que pasó**.
