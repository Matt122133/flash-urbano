---
ticket: none
status: completed
covers:
  # La funcion unica que arma el texto, y las dos pantallas que la usan.
  - android/app/src/main/java/uy/flashurbano/repartidor/pantallas/
  # Sus pruebas JVM (FR-006).
  - android/app/src/test/java/uy/flashurbano/repartidor/pantallas/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
  - specs/032-orden-de-la-direccion/
verify: cd android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-11-24
---

# Implementation Plan: Orden de la dirección en la app

**Branch**: `032-orden-de-la-direccion` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

> ## Cerrado el 2026-11-24
>
> `verify:` verde: 91 pruebas JVM, 0 salteadas, 0 fallidas. El control
> positivo (T003) dio 4 de 8 en rojo con la esquina antes del número.
>
> **Staging**: app de debug contra staging en el emulador, con pedidos de
> prueba FU-0003 y FU-0004. La tarjeta y la hoja muestran el orden nuevo (ver
> T007 en `tasks.md`). La igualdad con la web se comprobó por código, no en el
> navegador.
>
> **Abierto**: T009 (publicar `v0.6.1`) se hace desde `master` después del
> merge, que es lo único que el tag puede marcar; y SC-003 queda en manos de
> Diego con la versión instalada.

**Input**: Feature specification from `specs/032-orden-de-la-direccion/spec.md`

## Summary

La app arma el texto de una dirección en dos funciones privadas, cada una con su
propio orden equivocado (`calle esq. X numero`): `comoTexto` en `Principal.kt`
(tarjeta, retiro y entrega) y `direccionCorta` en `HojaEntrega.kt` (hoja de
entrega). Se reemplazan por **una sola función pura**, en un archivo propio, que
compone `calle numero, apto X, esq. Y, cooperativa` igual que
`componerDireccion` de la web, con un modo breve (`calle numero, esq. Y`) para
la hoja. Al ser pura y no estar dentro de un `@Composable`, se prueba en la JVM.

## Technical Context

**Language/Version**: Kotlin (la versión que ya usa `android/`), Jetpack Compose

**Primary Dependencies**: ninguna nueva

**Storage**: N/A — no cambia el modelo `Direccion` ni lo que manda el servicio

**Testing**: JUnit 4 en `testDebugUnitTest`, como `EstadoPantallaTest`

**Target Platform**: Android, la app del repartidor

**Project Type**: mobile-app (solo la pierna `android/`)

**Performance Goals**: N/A

**Constraints**: el texto de la tarjeta tiene que ser **idéntico** al de la web
para la misma dirección (SC-002)

**Scale/Scope**: una función nueva, dos llamadas reemplazadas, un archivo de
pruebas

## Constitution Check

- **I. Visual-first / IV. Mobile-first**: es un arreglo de lectura en la pantalla
  del teléfono. Cumple.
- **II. Self-service**: no toca el formulario del cliente. Cumple.
- **III. Simplicity (YAGNI)**: una función en vez de dos; nada de compartir
  código con la web, que es otro lenguaje. Cumple.
- **V. Precio**: no se toca ni se lee `precio`. Cumple.
- **Plan-bounded change**: `covers:` nombra las dos carpetas de `pantallas`
  (main y test) y la carpeta del spec. No toca backend ni web.
- **Verified before done**: `verify:` compila la app y corre las pruebas JVM. Las
  pruebas de FR-006 fallan si se vuelve al orden viejo (control positivo, T003).
- **Staging antes que producción**: no hay cambio de backend. La pierna de
  staging es la de la app: `assembleDebug -PurlDeDebug=<staging>` en el
  **emulador**, nunca en un teléfono (`docs/processes/staging.md`, "La app
  contra staging"). Después, `v0.6.1` por `scripts/publicar-app.sh` desde
  `master`.

Sin violaciones; Complexity Tracking no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/032-orden-de-la-direccion/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md            # /speckit-tasks
```

No hay `data-model.md` ni `contracts/`: no cambia ningún dato ni ninguna
interfaz. El servicio sigue mandando los campos separados.

### Source Code

```text
android/app/src/main/java/uy/flashurbano/repartidor/pantallas/
├── TextoDeDireccion.kt     # NUEVO: textoDeDireccion(d, breve)
├── Principal.kt            # comoTexto() -> textoDeDireccion(d)
└── HojaEntrega.kt          # direccionCorta() -> textoDeDireccion(entrega, breve = true)

android/app/src/test/java/uy/flashurbano/repartidor/pantallas/
└── TextoDeDireccionTest.kt # NUEVO
```

**Structure Decision**: la función vive en `pantallas/` porque es formato de
presentación, no dato. Se borran las dos privadas en vez de dejarlas
delegando: dos nombres para lo mismo es como llegamos a dos órdenes distintos.

## Decisiones (detalle en research.md)

- **D1 — Una función, dos modos.** `breve = true` omite apto y cooperativa, que
  es lo que la hoja de entrega ya omite hoy.
- **D2 — El orden y los separadores son los de la web**, copiados de
  `web/lib/direccion.ts`: `[calle numero], apto X, esq. Y, cooperativa`, unidos
  por `", "`, saltando lo vacío. La web filtra vacíos con `filter(Boolean)`; en
  Kotlin, `isNotBlank()`, que además descarta solo-espacios como hacían las dos
  funciones viejas (FR-004).
- **D3 — `(cooperativa)` pasa a `cooperativa`.** La tarjeta hoy dice
  `(cooperativa)` entre paréntesis; la web dice `cooperativa`. SC-002 pide el
  mismo texto, así que cambia. Es visible, y se menciona al publicar.
- **D4 — Las pruebas comparan contra cadenas literales**, no contra otra llamada
  a la función: una prueba que se calcula a sí misma no detecta nada.

## Riesgos

- **Que compile y se vea mal.** Una línea más larga con comas puede cortarse
  distinto en la tarjeta. Lo cubre el quickstart en el emulador, con una
  dirección de todos los campos (el `verify:` no lo ve; ver AGENTS.md).
