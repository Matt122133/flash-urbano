---
ticket: none
status: completed
covers:
  # La unica superficie que este feature toca. Adentro: el tema nuevo, la barra
  # de navegacion, las pantallas y la tarjeta. Ver research D1 a D6.
  - android/
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-08-30
---

# Implementation Plan: La app de Diego, rediseñada para la calle

**Branch**: `015-diseno-de-la-app` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-diseno-de-la-app/spec.md`

## Summary

Barra de navegación inferior de tres destinos —Pendientes, En curso,
Entregados— en lugar de dos secciones que scrollean juntas y una tercera detrás
de un botón. Paleta de marca en vez del morado por defecto. Tarjeta de ~380 px a
~250, con la acción en su borde inferior. Estados vacíos y aviso de sin conexión
que no rompe la pantalla.

**No se toca ni un dato.** Ni el modelo de estados, ni el backend, ni la web:
este feature dibuja de otra manera lo que ya existe.

**El riesgo de este feature es que se declare hecho con una compilación.** No hay
lógica nueva que pueda fallar en una prueba; hay una pantalla que se usa con una
mano, al sol, con un paquete en la otra. `012` compiló verde en las tres
superficies y entregó cuatro defectos que solo aparecieron cuando alguien la
abrió. Por eso el quickstart tiene tres niveles y el `verify:` es el primero de
ellos, no el último.

## Technical Context

**Language/Version**: Kotlin, Jetpack Compose, Material 3. Sin cambios de
versión y **sin dependencias nuevas** (research D1).

**Storage**: N/A. Este feature no lee ni escribe nada que no se lea hoy.

**Testing**: pruebas de JVM con Gradle (`testDebugUnitTest`), las 30 que ya
existen más las de contraste y tamaño de toque que agrega este plan
(research D4, D5). **Sin pruebas instrumentadas**: ver D5 por qué, y qué queda
sin cubrir.

**Target Platform**: Android, `minSdk 26`. El teléfono de Diego es un Xiaomi con
Android 16 (API 36), medido en `012`.

**Project Type**: móvil, superficie `android/` únicamente.

**Performance Goals**: ninguno nuevo.

**Constraints**: se usa **con una mano**, afuera, de día. Todo lo que se toca,
48 dp o más. **Nada detrás de un toque** (contrato 4.2 de `012`).

**Scale/Scope**: un usuario. No hay que diseñar para varios repartidores.

## Constitution Check

*GATE: pasa antes de Fase 0, y se re-evalúa después de Fase 1.*

- **Constitución**: **sin enmienda.** La app de administración está en el
  alcance desde la versión 1.0.0 y este feature no cambia qué hace: cambia cómo
  se ve y dónde se toca.
  - Principio I (visual-first): es el feature más visual del repo. El cliente ya
    miró y aprobó la maqueta **antes** de que se escribiera una línea, que es
    exactamente lo que este principio pide.
  - Principio III (YAGNI): es el que decide D1 (sin biblioteca de navegación) y
    D5 (sin pruebas instrumentadas).
  - Principio IV (mobile-first, baja fricción): **es el principio que este
    feature implementa.** Está escrito para el formulario web, y su espíritu
    —pantallas chicas, mínimo esfuerzo, validación clara— es literalmente la
    queja de Diego.
  - Principio V (5.1.0): intacto. No hay precio, ni zona, ni cobertura en juego.
- **Plan-bounded change**: `covers:` nombra dos prefijos. **`backend/` y `web/`
  quedan afuera a propósito**, y eso es una guarda real: el sensor de pre-commit
  rebota cualquier intento de tocarlos desde este plan.
- **Verified before done**: `verify:` compila la app y corre sus pruebas de JVM.
  Su alcance y **lo mucho que deja afuera** están en research D7.

**Sin violaciones que justificar.** *Complexity Tracking* queda vacío.

## Project Structure

### Documentation (this feature)

```text
specs/015-diseno-de-la-app/
├── plan.md              # este archivo
├── spec.md
├── research.md          # Fase 0 — siete decisiones
├── quickstart.md        # Fase 1 — los tres niveles de verificacion
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2
```

**No hay `data-model.md` ni `contracts/`**: este feature no crea, cambia ni
guarda un solo dato, y el contrato HTTP no se toca. Escribir un archivo para
decir que nada cambia solo tendría sentido si alguien pudiera creer lo
contrario, como en `013`; acá el spec ya lo dice en una línea.

### Source Code (repository root)

```text
android/app/src/main/java/uy/flashurbano/repartidor/
├── MainActivity.kt              # pierde `viendoEntregados` y el BackHandler
├── datos/Pedido.kt              # `seccionDe()` NO cambia — solo se usa distinto
├── ui/tema/                     # NUEVO — el esquema de marca, sin color dinamico
└── pantallas/
    ├── Principal.kt             # se parte: la barra, la lista, la tarjeta
    ├── Entregados.kt            # deja de ser pantalla aparte
    ├── EstadoPantalla.kt        # vacios y sin conexion
    └── RepartidorViewModel.kt   # gana la seccion seleccionada

android/app/src/test/                # las pruebas de contraste y de toque

web/       # NO SE TOCA
backend/   # NO SE TOCA
```

**Structure Decision**: superficie única `android/`. Es la primera vez que un
feature de este repo se queda solo en la app.

## Fases

**Fase 0 — [research.md](research.md).** Siete decisiones: las pestañas sin
biblioteca de navegación y qué pasa con "atrás" (D1), el tema de marca y por qué
se apaga el color dinámico (D2), de dónde salen los 130 px de la tarjeta (D3), el
contraste medido en vez de opinado (D4), qué de los 48 dp se puede automatizar y
qué no (D5), dónde aparece Deshacer ahora que el pedido cambia de pestaña (D6), y
el alcance de `verify:` con todo lo que no dice (D7).

**Fase 1 — [quickstart.md](quickstart.md).** Tres niveles: la sesión, el
emulador, y Diego.

**Fase 2 — `tasks.md`.**

## El gate — 2026-08-30

Promovido a `active` por instrucción explícita de Mateo, con el informe de
`/speckit-analyze` leído: **cero críticos**, dos hallazgos, los dos corregidos.

El que valió la pena: **FR-011, decidido el mismo día, tenía una comprobación
imposible.** El quickstart pedía fabricar un estado desconocido poniéndolo a mano
en la base, y `pedidos.estado` lleva un `CHECK` que no lo permite. Se movió a una
prueba de JVM sobre `seccionDe()`, que además corre en cada `verify:`.

## Lo que hay que aceptar, y se aceptó al promover

**Esta es la superficie más cara de iterar del repo, y no por el código.** Cada
corrección posterior es generar un APK, pasárselo a Diego y que él lo abra desde
el gestor de archivos — porque en su Xiaomi `adb install` **no funciona**,
HyperOS lo rechaza. Eso significa que el emulador no es una comodidad: es la
única oportunidad barata de encontrar los defectos.

## Complexity Tracking

Vacío: el *Constitution Check* no encontró violaciones que justificar.


---

## Cierre — 2026-08-30

`status: completed`. **El criterio que este feature vino a cumplir se cumplio, y
lo dijo una persona usando la app**: Mateo la probo en un telefono real con una
sola mano y llego a todo. Eso es SC-001 y SC-003, y es exactamente lo que `012`
dejo sin evaluar — de ahi salio este trabajo.

**Lo que NO se evaluo, y no se tilda**: la lectura **al sol**, y que **Diego**
la vea. Las dos quedan para cuando le llegue el APK. La fila del tracker se
cerro con esa salvedad escrita adentro en vez de darla por saldada entera.

### Lo que este feature enseño, que vale mas que el feature

**El emulador encontro cuatro defectos que 50 pruebas no podian ver**, y los
cuatro llegaron a existir en una sola jornada:

1. la barra de destinos en lila —`surfaceContainer` sin declarar—;
2. la accion del Snackbar en lila —`inversePrimary` sin declarar—;
3. un spinner en las acciones apagadas sin red, que decia "espera que esta
   yendo" cuando no iba nada;
4. seis textos sin sus tildes, incluido uno que antes estaba bien escrito.

Los dos primeros comparten causa y quedo escrita en `Tema.kt`: **un rol de
Material 3 sin declarar no es un valor que falta, es el morado de referencia
esperando a que alguien use el componente que lo lee.**

**Y lo que si atajaron las pruebas, antes de llegar a una pantalla**: el badge
en blanco sobre el naranja (2.80:1) y el gris que pasaba sobre blanco y fallaba
sobre el fondo (4.42:1 contra 4.5). Ninguno de los dos se ve mirando.

La conclusion no es que las pruebas sirvan poco: es que **cubren cosas
distintas, y las dos tienen que correr**. `ContrasteTest` lo tiene escrito como
limite adentro, y este cierre es la evidencia de que ese limite es real.

### Una correccion al proceso, medida

`adb install` **funciono** en un Xiaomi con Android 16. La nota de `012` decia
que HyperOS lo rechaza; lo que lo rechaza es tener apagada la opcion *Instalar
via USB*, que es por telefono. Corregido en el runbook.
