---
owner: flash-urbano
status: living
last_reviewed: 2026-08-31
update_trigger: on-app-release-or-session-policy-change
---

# La app de Diego: compilarla, publicarla y cortarle la sesión a un teléfono perdido

Los procedimientos operativos de la app. La app vive en
[`android/`](../../android), es la **tercera superficie** del repo, y no se
publica en ninguna tienda.

**Desde el 2026-08-31 no se instala a mano.** Hasta `016` el APK se ponía en el
teléfono de Diego por cable, con el teléfono presente; desde `017` se publica
por link y lo instala él, en su casa. Las dos vías están acá: la de cable sigue
sirviendo para probar en el emulador o en un teléfono conectado, y la de link es
la que se usa para entregarle una versión.

| | Procedimiento |
|---|---|
| 1 | Generar el APK e instalarlo por cable (FR-011 de `012`) |
| 2 | **Publicar una versión y hacérsela llegar** (`017`) |
| 3 | Saber qué versión tiene puesta (`017`) |
| 4 | Cortarle la sesión a un teléfono perdido (FR-016 de `012`) |

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

### Los dos gestos que hay que dar en el teléfono, o los avisos no llegan (`018`)

**Instalar la app no alcanza para que suene.** Desde `018` el servicio le manda
un aviso al teléfono cuando entra un pedido, y hay **dos cosas que sólo se
arreglan tocando el teléfono** — ninguna se puede hacer desde el código, y las
dos fallan en silencio: no hay error, no hay cartel, simplemente no llega nada.

Van acá, dentro de la instalación, y no como nota al pie: son parte de dejar la
app funcionando, no un ajuste opcional para después.

#### 1. Conceder el permiso de notificaciones

La primera vez que se abre la app, Android pregunta. **Hay que decir que sí.**

Si se dijo que no, la app lo dice en la pantalla principal con un renglón rojo
que lleva derecho a los ajustes — pero conviene no llegar ahí: **Android sólo
pregunta una vez por instalación**, y a la segunda negativa ni siquiera muestra
el cartel.

Para comprobarlo sin adivinar:

```bash
adb shell dumpsys package uy.flashurbano.repartidor | grep POST_NOTIFICATIONS
```

#### 2. Sacar la app del ahorro de batería

Éste es el que muerde a los días, no el primer día: el sistema **duerme** las
apps que no se abren seguido, y una app dormida no recibe avisos aunque el
permiso esté concedido y el servicio los mande bien.

**Dónde está depende del fabricante, y el de Diego no es el del caso típico.**
El suyo es un **Redmi con HyperOS**, medido el 2026-08-26, donde son **dos
ajustes separados** y hay que dar los dos:

- **Ajustes → Aplicaciones → Flash Urbano → Ahorro de batería → Sin
  restricciones.**
- **Ajustes → Aplicaciones → Flash Urbano → Inicio automático**, activado. En
  HyperOS/MIUI esto es aparte del anterior, y sin él el sistema no levanta la
  app para entregarle un aviso cuando está cerrada.

En un Samsung el equivalente es **Ajustes → Batería → Límites de uso en segundo
plano → Apps que nunca duermen**, y en un Android sin capa del fabricante,
**Ajustes → Aplicaciones → Flash Urbano → Batería → Sin restricciones**.

**Lo que no hay es forma de comprobarlo desde la app** (research D6 de `018`): no
existe una API confiable que diga "el fabricante te durmió". Por eso esto es
documentación y no un cartel, y por eso la única verificación de verdad es la
prueba de varios días del quickstart de `018` (Q16): dejar el teléfono sin abrir
la app y ver si un pedido de la mañana siguiente lo hace sonar.

---

## 2. Publicar una versión y hacérsela llegar (`017`)

Es la vía normal desde el 2026-08-31. Diego no viene, no hay cable: le llega un
link y la instala él.

### El comando

```bash
scripts/publicar-app.sh v0.2.0 "Que cambio en esta version"
```

El script hace todo: comprueba, crea el tag, compila, verifica el APK, publica,
y al final imprime el link y el mensaje para mandarle. **Si algo no cierra, se
planta antes de que nada suba** y borra el tag que había creado.

### Por qué hay un script y no una lista de pasos

Porque **el orden se puede hacer mal en silencio**, y esa es la única forma de
error que este procedimiento tiene.

El número de versión ya no se escribe a mano: sale del tag, con `git describe`.
Y `gh release create` **sabe crear el tag, pero lo crea del lado del servidor**
— el repo local no se entera hasta un `git fetch --tags`. Así que si se compila
antes de que el tag exista **localmente**, el APK sale con el número de la
versión *anterior*, se publica igual, y no hay ningún síntoma: Diego instala
algo que dice ser lo que no es.

Se descubrió así, publicando `v0.1.0` el 2026-08-31 y encontrando `git tag -l`
vacío después. Por eso el orden es **tag local primero, compilar después,
publicar último**, y por eso el script compara el `versionName` del APK contra
el tag antes de subir nada.

### Lo que el script rechaza, y por qué

| Rechaza | Por qué |
|---|---|
| Un formato que no sea `vX.Y.Z` | De ahí sale el entero que Android compara (`mayor*10000 + menor*100 + parche`). Ninguna parte puede pasar de 99. |
| El árbol de trabajo sucio | El APK no correspondería a ningún estado del repositorio: el tag apuntaría a un commit que no es lo que se compiló. |
| Un tag que ya existe, local o remoto | **Un identificador publicado no se reutiliza, ni siquiera si esa versión se retiró.** Si alguien ya se la bajó, la que la reemplace necesita un número mayor o Android no la instala encima. |
| Que el APK declare algo distinto del tag | Es el síntoma de haber compilado sin el tag local. |
| La excepción de texto plano en `release` | La app de Diego aceptaría conexiones sin cifrar contra producción. |
| Un APK sin firmar | Android no lo instala. Un archivo que parece listo y no lo es. |

### El mensaje que se le manda

```
Che, actualización de la app. Tocá este link:
https://github.com/Matt122133/flash-urbano/releases/download/v0.2.0/app-release.apk
Cuando termine de bajar, andá a Archivos → Descargas y tocá app-release.apk.
Se instala encima, no desinstales nada.
```

**Lo de "Archivos → Descargas" no es adorno.** Abierto desde ahí usa el permiso
de *"instalar aplicaciones desconocidas"* que Diego **ya le dio al gestor de
archivos** el 2026-08-26. Si lo abre desde la notificación de descarga del
navegador, Android se lo pide de nuevo, ahora para el navegador — un paso extra
que en la calle se traduce en un llamado.

No hay que desinstalar nada y **no pierde la sesión**: se instala encima.

### La clave de firma: lo único de todo esto que no tiene arreglo

El APK se firma con la **clave de depuración de la máquina desde la que se
publica**, a propósito y desde `012` (research D11). En esta máquina vive en:

```
C:\Users\USUARIO\.android\debug.keystore
```

Eso era inofensivo mientras la instalación era presencial. **Con actualizaciones
a distancia deja de serlo**: Android sólo instala una actualización encima si
viene firmada con la misma clave que la versión instalada.

**Si ese archivo se pierde** —máquina nueva, formateo, disco muerto— la próxima
versión **no se instala encima**. La única salida es que Diego desinstale y
reinstale, lo que le **borra la sesión** y lo obliga a pedir un código nuevo. No
hay recuperación posible: esa clave no se puede volver a generar igual.

Hacerle una copia fuera del repo es lo más barato que se puede hacer hoy contra
el problema más caro de este documento.

La huella se imprime en cada publicación, y **tiene que ser siempre la misma**:

```
SHA-256  1dbade77950f9f5fca32ceb52c34e8426cdd924df5fac1a08a4c0e242268482b
```

---

## 3. Saber qué versión tiene puesta (`017`)

Hay dos vías, y contestan preguntas distintas.

### Preguntándole

La app muestra su versión **al final de la lista de pedidos** —desplazando hasta
abajo— y al pie de la pantalla de ingreso. Sirve cuando él ya está escribiendo
por otra cosa.

### Sin preguntarle

Es la única que contesta *"¿ya instaló la última?"* cuando él no está
disponible. La app declara su versión en cada pedido que hace, y queda anotada
en la fila de su sesión. Desde la consola de Postgres de Railway (ver
[`railway-despliegue.md`](railway-despliegue.md)):

```sql
SELECT u.email, s.version_app, s.version_vista_en
FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
WHERE s.revocada_en IS NULL
  AND s.expira_en > now()
  AND s.version_app IS NOT NULL
ORDER BY s.version_vista_en DESC;
```

**`version_app` en nulo no es un dato faltante.** Significa que esa sesión nunca
declaró una versión, y es lo normal en las **sesiones del sitio web**: el
navegador no es la app y no tiene versión que declarar.

**Un valor con un hash adentro** —`0.2.0+3-gc3eb8fe` o `0.0.0-c3eb8fe`— no es un
error: es un binario compilado **fuera del procedimiento de publicación**, o sea
una prueba que terminó en un teléfono. Que se distinga de una versión publicada
es a propósito.

---

## 4. Cortarle la sesión a un teléfono perdido (FR-016)

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
