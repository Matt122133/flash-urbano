---
ticket: none
status: active
covers:
  # El numero sale del tag, y la version se muestra en dos pantallas.
  - android/
  # La migracion 0007: dos columnas nullable en `sesiones`.
  - backend/migrations/
  # `Resolver` pasa de SELECT a UPDATE ... RETURNING, sin cambiar su firma.
  - backend/internal/auth/
  # El middleware que deja la version declarada en el contexto.
  - backend/internal/httpx/
  # La guarda que impide publicar dos veces el mismo numero.
  - scripts/publicar-app.sh
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed: 2026-08-31
---

# Implementation Plan: Qué versión tiene el teléfono

**Branch**: `017-version-de-la-app` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

## Summary

Desde el 2026-08-31 el APK le llega a Diego por un link en vez de por cable, y
eso abre un hueco: entre que se publica una versión y que él la instala pasa un
tiempo que nadie puede medir. Hoy la app no ayuda —`versionCode` está en `1`
desde `012`, sin moverse a través de `015` y `016`— así que dos binarios muy
distintos declaran lo mismo.

Este plan cierra el hueco por los dos lados. **El número deja de escribirse a
mano**: sale del tag de la publicación, que pasa a ser la única fuente, con una
guarda que se planta antes de publicar dos veces el mismo. **Y el número se
vuelve observable por dos vías**: Diego lo lee en pantalla y lo dice, y la app
además se lo declara al servicio, que lo guarda en la fila de la sesión — lo
único que contesta *"¿ya actualizó?"* sin preguntarle nada.

No cambia ninguna pantalla de trabajo, no se emite una clave de firma propia, y
publicar sigue siendo un acto manual desde la máquina donde vive esa clave.

## Contexto técnico

Tres superficies del repo, y las tres cambian poco:

- **`android/`** — `build.gradle.kts` deriva el número del tag; dos renglones de
  Compose lo muestran; `Servicio.kt` lo declara en una cabecera.
- **`backend/`** — la migración `0007`, un middleware de `httpx` y una consulta
  de `auth` que pasa de leer a leer-y-escribir en el mismo viaje.
- **`scripts/`** — el script de publicación, que es donde vive la guarda.

`web/` **no se toca** y no está en `covers:`, por eso el `verify:` tiene dos
patas y no tres.

Todo lo que sigue se apoya en [`research.md`](research.md), que se midió sobre
este repo y no se dedujo. Dos hallazgos de ahí mandan sobre el diseño:

- **D1**: `gh release create` crea el tag **sólo del lado del servidor**. Se
  comprobó después de publicar `v0.1.0`: el repo local tenía `git tag -l` vacío.
  Por eso el orden es **tag local primero, compilar después, publicar último**;
  al revés, el APK sale con un número que no es el de la publicación y nada lo
  avisa.
- **D2**: `git describe` sólo ve tags alcanzables desde HEAD, así que en una
  rama de trabajo no hay tag y el binario se identifica con un hash. Eso hace
  cierto FR-006 **sin escribir código**: un binario de trabajo no puede hacerse
  pasar por publicado.

## Constitution Check

- **Principio III (simplicidad sobre infraestructura)**: es el que más presiona
  acá y el que decidió tres cosas. No hay tabla nueva —dos columnas en una tabla
  que ya existe—, no hay segunda consulta —el `UPDATE ... RETURNING` viaja una
  sola vez—, y no hay aviso de actualización dentro de la app: el aviso es el
  mensaje de WhatsApp con el link, y con un repartidor eso alcanza.
- **Principio IV (móvil primero, poca fricción)**: es por qué la versión **no**
  va fija arriba. `015` existió para recuperar milímetros de pantalla y alcance
  del pulgar; gastar alto permanente en un dato que se mira dos veces por año
  desharía parte de eso. Va al final de la lista y al pie del ingreso.
- **Principio V (el sitio no habla de plata)**: no lo toca. Nada de este feature
  se acerca a un precio.
- **Alcance del producto**: no agrega una superficie ni cambia ninguna. La app
  hace lo mismo que hacía; lo único nuevo es que dice quién es.

Sin violaciones que justificar.

## Los pasos

### 1. El número sale del tag

En `android/app/build.gradle.kts`, `versionCode` y `versionName` dejan de estar
escritos y se calculan con `providers.exec` sobre `git describe`. La cuenta del
entero es `major*10000 + minor*100 + patch`, así que `0.2.0` es `200` y se lee
al revés.

**El build no falla cuando no hay tag**, y eso es deliberado: compilar tiene que
seguir andando en un clon recién bajado, sin tags y sin red, o se rompe el
trabajo diario para resolver un problema de publicación. Las tres situaciones y
lo que produce cada una están en la tabla de research D3.

Después de este paso, `aapt2 dump badging` sobre el APK de `debug` muestra un
`versionName` con hash en vez de `0.1.0`.

### 2. La app dice qué versión es

Dos renglones de Compose que leen el mismo `BuildConfig.VERSION_NAME`: uno al
pie de `PantallaIngreso`, después del botón; otro al final de la lista de
pedidos, después de la última tarjeta. Que las dos salgan del mismo valor es lo
que hace cierto FR-012 sin esfuerzo — no hay dos fuentes que puedan discrepar.

Después de este paso, en el emulador se ve la versión abajo de todo en las dos
pantallas, con el mismo texto.

### 3. La app se lo declara al servicio

`Servicio.kt` agrega `X-App-Version` a **todos** los pedidos que arma, no sólo
a los autenticados. El contrato está en
[`contracts/cabecera-version.md`](contracts/cabecera-version.md).

### 4. El servicio la guarda

La migración `0007` agrega `version_app` y `version_vista_en` a `sesiones`, las
dos nullable y sin `DEFAULT`; el porqué de cada decisión está en
[`data-model.md`](data-model.md).

Un middleware de `httpx` deja la versión declarada —ya validada y acotada— en el
`context`, y `Sesiones.Resolver` la lee de ahí. **Ninguna firma cambia.**
`Resolver(ctx, token)` no ve el `*http.Request` y no puede leer una cabecera;
cambiar eso arrastraría `httpx.ConSesion`, que es genérico a propósito para que
`httpx` no importe `internal/usuarios` e invierta las capas.

El `SELECT` de `Resolver` pasa a ser un `UPDATE ... RETURNING` **con el mismo
`WHERE`**. Eso conserva la propiedad que el comentario de esa función defiende
—el filtro de `revocada_en` vive en la consulta, no en Go— y no agrega un
segundo viaje a la base.

**El `UPDATE` usa `COALESCE`**, y es la parte fácil de romper: sin eso, cada vez
que Diego mirara sus pedidos desde el navegador —una sesión que no manda
cabecera— se borraría la versión que la app había anotado, y el feature dejaría
de funcionar sin que nada fallara.

Después de este paso, la consulta del final de `data-model.md` contesta qué
versión está corriendo la app.

### 5. La guarda de publicación

`scripts/publicar-app.sh` hace las comprobaciones **antes** de subir nada: árbol
limpio, y el tag pedido no existe ni local ni en el remoto. Recién ahí crea el
tag, compila, verifica el APK y publica.

Un párrafo en un runbook no es comprobable; un script que sale con error sí, y
SC-005 pide provocarlo a propósito.

El script **hereda las comprobaciones que ya existen** en
`docs/processes/app-repartidor.md` y no las reescribe: que el `release` no lleve
la excepción de texto plano, y que el APK esté firmado. Las dos ya están escritas
ahí con el comando exacto.

### 6. El documento

`docs/processes/app-repartidor.md` gana la publicación por link —el orden de D1
incluido, porque es el que se puede hacer mal en silencio—, el mensaje que se le
manda a Diego con lo de **Archivos → Descargas**, la consulta de la versión
junto al procedimiento de cortar sesiones que ya vive ahí, y **la consecuencia
de perder la clave de firma**, que hoy no está escrita en ningún lado del repo.

`docs/` está siempre permitido por el sensor, así que no necesita entrada en
`covers:`.

## Cómo se comprueba

El `verify:` de arriba es la puerta mínima: compila y las pruebas pasan. **No
alcanza**, y `012` dejó la lección de por qué — dos defectos reales de aquella
app compilaban perfecto. Lo que dice si esto funciona es
[`quickstart.md`](quickstart.md), en tres niveles.

Dos cosas que el `verify:` verde **no** demuestra, y hay que mirar aparte:

- **Los saltos de Go.** Las pruebas que tocan Postgres se saltan solas y en
  silencio sin `TEST_DATABASE_URL`, así que un verde sin mirar el conteo no dice
  nada sobre la migración `0007`.
- **Las dos guardas negativas.** La del `COALESCE` y la del largo afirman que
  algo *no* pasa, y este repo pide romper la implementación a propósito y verlas
  en rojo. Está en Q2 del quickstart.

## Lo que queda afuera, y por qué

- **No se emite una clave de firma propia.** La decisión de `012` sigue en pie;
  lo que cambia es que su consecuencia queda escrita. Emitir una hoy no
  resolvería nada y agregaría un secreto que custodiar.
- **No se publica desde CI.** Exigiría llevar la clave de firma fuera de la
  máquina de Mateo, que es una decisión distinta y más cara.
- **No hay aviso de versión nueva dentro de la app.** Principio III: es la
  solución del día que haya varios repartidores.
- **El servicio no rechaza versiones viejas.** Un teléfono desactualizado sigue
  trabajando; este feature diagnostica, no controla.
