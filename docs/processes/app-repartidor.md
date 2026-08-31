---
owner: flash-urbano
status: living
last_reviewed: 2026-08-26
update_trigger: on-app-release-or-session-policy-change
---

# La app de Diego: generar el APK y cortarle la sesión a un teléfono perdido

Los dos procedimientos operativos de `012-app-repartidor` (FR-011 y FR-016). La
app vive en [`android/`](../../android), es la **tercera superficie** del repo, y
no se publica en ninguna tienda: el archivo se instala a mano.

---

## 1. Generar el APK e instalarlo (FR-011)

### Qué hace falta en la máquina

Lo comprobado el 2026-08-26, y no se da por sentado porque nada de esto viene
con el repo:

| | |
|---|---|
| JDK | el de Android Studio, `C:\Program Files\Android\Android Studio\jbr` |
| SDK | `%LOCALAPPDATA%\Android\Sdk`, con `android-36` |
| Gradle | lo baja el wrapper; la 8.13 ya estaba en `~/.gradle/wrapper/dists` |

`android/local.properties` lleva la ruta del SDK y **no está versionado**: en una
máquina nueva hay que escribirlo, con barras normales.

```
sdk.dir=C:/Users/<quien-sea>/AppData/Local/Android/Sdk
```

**Con barras invertidas simples no anda.** Un `.properties` de Java las trata
como escapes, así que `C:\Users\...` se lee `C:Users...` y Gradle falla con *"El
nombre de archivo, el nombre de directorio o la sintaxis de la etiqueta del
volumen no son correctos"*, que no menciona el archivo ni la ruta.

### El comando

```
cd android
.\gradlew.bat assembleRelease
```

El archivo queda en `android/app/build/outputs/apk/release/app-release.apk`.

**`.\gradlew.bat`, y ni `./gradlew` ni `gradlew.bat` a secas.** El `verify:` del
harness corre en `cmd.exe`, donde `./` no es sintaxis válida; y cuando ese `cmd`
lo lanza un shell tipo MSYS —Git Bash— hereda `NoDefaultCurrentDirectoryInExePath`
y el nombre pelado tampoco resuelve. `.\` funciona en los dos casos.

### Qué comprobar antes de pasarlo

Dos cosas, y las dos se descubren tarde si no se miran:

**1. Que no lleve la excepción de texto plano.**

```
aapt2 dump xmltree --file AndroidManifest.xml app-release.apk | grep -i cleartext
aapt2 dump xmltree --file AndroidManifest.xml app-release.apk | grep -i networkSecurityConfig
```

Los dos tienen que salir **vacíos**. El mismo comando contra el APK de `debug` sí
tiene que encontrar `networkSecurityConfig`: si no lo encuentra, la comprobación
está rota y no está probando nada.

La excepción existe sólo para que `debug` le hable al backend local por `http://`,
y vive en `android/app/src/debug/`. Si se colara en `release`, la app de Diego
aceptaría conexiones sin cifrar contra producción, que es exactamente lo que el
bloqueo de Android existe para impedir.

**2. Que el APK esté firmado.** `release` se firma con la **clave de
depuración**, a propósito (research D11): alcanza para instalar a mano y una
clave propia sólo hace falta el día que esto vaya a una tienda. Sin
`signingConfig`, Gradle produce `app-release-unsigned.apk` y **Android no lo
instala** — un archivo que parece listo y no lo es.

### Instalarlo

Con el teléfono conectado por USB y la depuración activada:

```
adb install -r app-release.apk
```

**En un Xiaomi eso falla**, y no es el APK. HyperOS/MIUI rechaza la instalación
por USB con:

```
INSTALL_FAILED_USER_RESTRICTED: Install canceled by user
```

Nadie canceló nada: falta la opción **Ajustes → Ajustes adicionales → Opciones
de desarrollador → "Instalar vía USB"**, que en Xiaomi es **aparte** de la
depuración USB. Y activarla **exige sesión con cuenta Mi y conexión**, porque
hace una verificación contra los servidores de Xiaomi — si el teléfono no tiene
cuenta Mi, ese camino no está disponible.

Las dos vías de esquive por `adb` **tampoco funcionan** (comprobado el
2026-08-26 sobre el teléfono de Diego, Redmi con HyperOS 3.0): `pm install`
desde el propio teléfono choca con la misma restricción, y abrir el instalador
con un intent `file://` no resuelve ninguna actividad.

### La vía que sí funciona: instalar desde el gestor de archivos

Es la que se usó. No necesita cuenta Mi ni tocar opciones de desarrollador.

```bash
adb push app-release.apk /sdcard/Download/flash-urbano.apk
```

Desde un shell tipo MSYS (Git Bash) hay que desactivar la conversión de rutas o
`/sdcard/...` se convierte en una ruta de Windows y el archivo va a cualquier
lado:

```bash
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' adb push ...
```

Después, en el teléfono: **Archivos → Descargas → `flash-urbano.apk` → tocar**.
Pide permitir **"instalar aplicaciones desconocidas"** para el gestor de
archivos, una sola vez, y con eso instala.

Si no hay cable, el archivo se le pasa por el medio que sea y el resto es igual.

**El teléfono tiene que tener Android 8.0 o superior** (`minSdk 26`). El de
Diego, medido el 2026-08-26 con `adb shell getprop ro.build.version.release`: un
**Redmi con Android 16 (API 36)**, muy por encima del piso.

---

## 2. Cortarle la sesión a un teléfono perdido (FR-016)

**Lo que protege la credencial es el cifrado del sistema mientras el teléfono
está bloqueado**, no nada que haga la app. Un teléfono desbloqueado en manos de
otra persona deja ver la app igual. Por eso la respuesta a "se perdió el
teléfono" no es del lado del teléfono: es borrar su sesión del servicio.

**No hay pantalla para esto.** Se hace en la base, desde la consola de Postgres
de Railway (ver [`railway-despliegue.md`](railway-despliegue.md)).

```sql
-- 1. Ver que sesiones tiene, y desde cuando.
SELECT s.id, s.creada_en, s.expira_en, s.revocada_en
FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
WHERE u.email = '<el mail de Diego>'
ORDER BY s.creada_en DESC;

-- 2. Cortarlas todas.
UPDATE sesiones SET revocada_en = now()
WHERE usuario_id = (SELECT id FROM usuarios WHERE email = '<el mail de Diego>');
```

**`UPDATE ... revocada_en` y no `DELETE`.** Las dos cortan el acceso —`Resolver`
filtra por `revocada_en IS NULL` en la misma consulta que busca la sesión, así
que el efecto es inmediato y también para quien haya copiado la credencial— pero
el `UPDATE` deja el rastro de que pasó y cuándo. Un `DELETE` borra la evidencia
del incidente junto con el acceso.

**Se cortan TODAS, no una.** Desde la consola no hay forma de saber cuál fila es
el teléfono perdido: lo único guardado es el hash del token, y el token está en
el teléfono. Cortar todas y que Diego vuelva a ingresar en el que tenga es el
único procedimiento que se puede ejecutar con la información disponible.

**Qué pasa después**: la próxima vez que la app pida algo recibe 401, borra la
credencial que tiene guardada y muestra la pantalla de ingreso diciendo el
motivo. Diego pide un código nuevo y entra.

### Lo que este procedimiento NO es

**No es revocación remota.** Requiere que alguien con acceso a Railway lo
ejecute a mano. Mientras haya un solo repartidor, alcanza. **El día que haya un
segundo, esto se vuelve obligatorio como función del producto** — está anotado
en [`../tech-debt-tracker.md`](../tech-debt-tracker.md) con ese disparador.


## `adb install` y el Xiaomi: la traba es por telefono, no por HyperOS

**Corregido el 2026-08-30, midiendolo.** Este documento decia que HyperOS
rechaza `adb install` con `INSTALL_FAILED_USER_RESTRICTED`. Lo que rechaza no es
HyperOS: es tener apagada la opcion **"Instalar via USB"** de Opciones de
desarrollo, que es un ajuste **por telefono** y que ademas pide cuenta Mi para
activarse.

En otro Xiaomi con Android 16, con esa opcion prendida, `adb install -r`
funciono a la primera.

O sea que hay dos caminos y conviene probar el barato primero:

1. **`adb install -r <apk>`**, si el telefono tiene "Instalar via USB" activada.
2. Si devuelve `INSTALL_FAILED_USER_RESTRICTED`, recien ahi el camino largo:
   empujar el APK a Descargas con `adb push` y abrirlo desde el gestor de
   archivos.

El de Diego necesita el segundo. Otro telefono puede no necesitarlo.
