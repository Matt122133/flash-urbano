---
ticket: none
status: draft
covers:
  # La app: permiso, canal, recepcion, el renglon de la lista y el token.
  - android/
  # La migracion 0008: una columna nullable mas en `sesiones`.
  - backend/migrations/
  # `Resolver` guarda el token en el mismo UPDATE que ya escribe la version.
  - backend/internal/auth/
  # La cabecera nueva, validada como se valida la version.
  - backend/internal/httpx/
  # El disparo del aviso al crear un pedido, atado a `esNuevo`.
  - backend/internal/pedidos/
  # Paquete nuevo: el cliente de FCM y el armado del mensaje.
  - backend/internal/avisos/
  # La credencial, leida como OPCIONAL.
  - backend/internal/config/
  # El cableado del servicio.
  - backend/cmd/api/
  - backend/go.mod
  - backend/go.sum
  - backend/.env.example
  # spec-kit escribe aca cual es el feature activo.
  - .specify/feature.json
verify: cd backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
analyzed:
---

# Implementation Plan: Que Diego se entere del pedido cuando entra

**Branch**: `018-aviso-de-pedido-nuevo` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

## Summary

Hoy el pedido se guarda y ahí se queda: nada le avisa a Diego, y el retraso
entre que entra un pedido y que él lo sabe es lo que tarde en acordarse de abrir
la app. Este plan cierra ese tramo con **un aviso push al teléfono, y sólo eso**
—sin mail, por decisión explícita del dueño del proyecto.

La forma la decide un hallazgo de [`research.md`](research.md): **el camino ya
está construido**. `017` hizo que la app declare su versión en una cabecera y
que el servicio la escriba en la fila de la sesión, dentro de la misma consulta
que valida la credencial. El token del teléfono viaja igual, se guarda igual, y
por eso **cortar una sesión corta los avisos sin escribir una línea para eso**.

Del lado del servicio, el aviso se dispara al crear un pedido, **fuera del
camino de la respuesta** y sólo cuando el pedido es nuevo de verdad — condición
que la idempotencia de `POST /pedidos` ya calcula. Y la credencial que lo
autoriza **es opcional para arrancar**: si falta, el servicio levanta igual y se
queda sin avisos.

## Contexto técnico

Dos superficies de las tres, y `web/` **no se toca** — por eso el `verify:` tiene
dos patas.

**Lenguajes**: Go 1.26 (`backend/`), Kotlin/Compose (`android/`).
**Dependencias nuevas**: `golang.org/x/oauth2` (hoy indirecta, pasa a directa) y
`cloud.google.com/go/compute/metadata` del lado de Go; el plugin
`google-services` y `firebase-messaging` del lado de Android — la **primera
dependencia de Google** de esa app.
**Almacenamiento**: una columna nullable más en `sesiones` (migración `0008`).
**Pruebas**: `go test` (incluye las que tocan Postgres, que se saltean solas sin
`TEST_DATABASE_URL`) y pruebas de JVM en Android.
**Plataforma**: servicio en Railway; app instalada a mano en un Samsung.
**Escala**: un repartidor, un teléfono, decenas de pedidos por semana.

**La pata Android del `verify:` se escribe `.\gradlew.bat`**, no `./gradlew` ni
`gradlew.bat`: `verify:` corre en `cmd.exe`, donde `./` es inválido, y un `cmd`
lanzado desde un shell tipo MSYS hereda `NoDefaultCurrentDirectoryInExePath`, así
que el nombre pelado tampoco resuelve.

## Constitution Check

- **Principio III (simplicidad sobre infraestructura)** — es el que más apretó, y
  se contestó con una medición, no con una opinión: el SDK de Firebase para Go
  arrastra **76 módulos** (Firestore, Storage, *translate*, gRPC) a un servicio
  que hoy tiene **tres** dependencias directas; la vía elegida agrega **2**. Ver
  D2. No se construye cola de mensajes, ni reintentos propios, ni tabla de
  dispositivos: una columna y un `POST`.
- **Principio V (el producto no habla de plata)** — el aviso **no lleva importe
  ni referencia al costo** (FR-005). Tampoco lee la columna `precio`, que la
  constitución prohíbe leer.
- **Principio II y IV** — no se tocan: el formulario del cliente no cambia en
  ningún punto, y la app suma un cartel que sólo aparece cuando algo está mal.
- **Scope boundaries** — la app de administración ya está declarada en la
  constitución; este plan le agrega el aviso, no una superficie nueva.
- **Decide**: la decisión de sumar una dependencia de Google, un secreto nuevo y
  un canal de entrega que no controlamos **es difícil de revertir y es un
  tradeoff real**, así que va a ADR antes de ejecutar (paso 2).

## Los pasos

### 1. Primero se baja y se compila, antes de escribir lógica

El único riesgo que `research.md` deja sin medir es si esta máquina puede
**bajar** los artefactos de Firebase y los dos módulos de Go. Los repositorios ya
están declarados (`google()` en `settings.gradle.kts`), pero la caché de Gradle
de esta máquina se armó a propósito para no volver a bajar todo.

Entonces: se agregan el plugin, la dependencia de `firebase-messaging` y los
módulos de Go, y **se compila en verde sin ninguna lógica escrita**. Si algo no
resuelve, el plan se detiene acá y se informa — no se descubre con medio feature
hecho.

### 2. El proyecto de Firebase, los dos archivos, y el ADR

Se crea el proyecto en la consola de Firebase con el `applicationId` que ya
tiene la app (`uy.flashurbano.repartidor`) y se bajan los **dos** archivos, que
tienen reglas opuestas (D8):

- `google-services.json` → **se versiona** en `android/app/`. Viaja dentro del
  APK, que ya es descargable por cualquiera, y sin él la app no compila.
- La credencial de **service account** → **nunca entra al repo**. Es la que
  autoriza a mandar avisos. Va como variable de entorno en Railway, junto a
  `CORREO_API_KEY`.

En el mismo paso se escribe el ADR en `docs/decisions/`: qué se suma, qué se
pierde, y cuál es el disparador para revisarlo.

### 3. La app pide permiso, arma el canal, y dice cuándo está muda

- Se declara `POST_NOTIFICATIONS` en el manifiesto y se pide **en runtime**
  (Android 13+; la app apunta a `targetSdk = 36`).
- Se crea **un** canal, de importancia alta, para pedidos nuevos. Suena y
  aparece encima, y **respeta el No molestar del sistema**: eso es FR-006
  cumplido sin escribir ninguna franja horaria.
- Si el permiso está negado o las notificaciones de la app están apagadas, la
  pantalla principal muestra un renglón que lo dice y **lleva a los ajustes**
  (FR-008). Cuando todo está bien, ese renglón no existe: no ocupa pantalla,
  que es lo que `015` estuvo cuidando.

Lo que **no** se puede detectar es que One UI haya dormido la app (D6); eso es
documentación, paso 8.

### 4. La app manda su token en la cabecera que ya existe

Una cabecera más en `llamar()` de `Servicio.kt`, al lado de la de versión. Se
lee el token de FCM al arrancar y cuando el proveedor lo renueva, se guarda en
el mismo DataStore donde vive la credencial, y viaja en las llamadas que la app
ya hace. **Sin endpoint nuevo** (D1).

### 5. El servicio lo guarda donde ya guarda la versión

Migración `0008`: una columna nullable en `sesiones`, con el mismo argumento que
escribió `0007` (una fila por sesión, no por pedido; sin `DEFAULT`, para que una
sesión recién creada no afirme un token que nunca declaró).

`Resolver` suma la columna a su `UPDATE ... RETURNING`, **con el mismo
`COALESCE(NULLIF(...))`**. Esto no es un detalle de estilo: el sitio web usa esa
misma consulta y no manda la cabecera, así que sin el `COALESCE` **cada visita
de Diego al sitio desde el navegador le borraría el token al teléfono** y los
avisos morirían en silencio. Una prueba tiene que fijar exactamente eso.

La cabecera se valida como se validó la de versión: largo acotado y forma
esperada **antes** de escribir.

### 6. El servicio manda el aviso al crear un pedido

Paquete nuevo `backend/internal/avisos/`, con dos piezas separables:

- **El armado del mensaje** — puro, sin red: recibe el pedido y devuelve qué
  dice el aviso. Es lo que se puede probar de verdad, y es donde viven FR-005
  (código + calle de entrega, sin número ni esquina, sin importe) y FR-017 (el
  vencimiento de 24 horas).
- **El envío** — token de acceso vía `x/oauth2/google` y un `POST` a la API HTTP
  v1 de FCM (D2). Mensaje híbrido: bloque `notification` para que lo dibuje el
  sistema con la app muerta, más `data` con el código del pedido para el toque y
  para el primer plano (D5).

**El destinatario es un conjunto, no una fila** (FR-018). Hay **dos teléfonos
con sesión administradora** —el de Diego, que trabaja, y el de Mateo, que
verifica—, así que la consulta devuelve N tokens y el envío los recorre: la API
HTTP v1 manda **un mensaje por token**. Un destinatario que falla —token muerto,
teléfono sin red— **no puede cortar el recorrido**: se registra, se sigue con el
siguiente, y sólo el token que el proveedor declara muerto se borra.

El disparo va en `Crear`, **sólo si `esNuevo`** — la idempotencia que ya existe
es la que hace verdadero FR-003 sin construir nada (D4).

**Y sale del camino de la respuesta, con un contexto propio.** Llevarse
`r.Context()` a una goroutine es la trampa que compila perfecto y hace que el
aviso no salga nunca: ese contexto se cancela apenas el handler responde (D3).
El cliente no espera y no ve nada de esto (FR-009).

Un fallo de envío **se registra con el código del pedido** (FR-014): como el
error ya no puede viajar en la respuesta, el registro es la única señal que
queda.

### 7. La app recibe, y no le mueve la lista debajo del dedo

- **App cerrada o en segundo plano**: lo dibuja el sistema. Tocarlo abre la app
  y la deja en la lista, en ese pedido (FR-004), leyendo el código del bloque
  `data`.
- **App abierta**: no se dibuja solo; lo recibe la app y aparece un renglón
  *"1 pedido nuevo — tocá para actualizar"*. **La lista no se reordena sola**
  (FR-016): un pedido que aparece justo cuando Diego está por tocar *tomar* es
  tocar el pedido equivocado.

### 8. La credencial opcional, y el documento

- `config.Cargar()` la lee **fuera** de la lista de obligatorias. Si falta, el
  servicio arranca y deja anotado que no va a haber avisos (FR-010). Un servicio
  que no levanta por una función accesoria ya nos tumbó producción una vez.
- `backend/.env.example` gana el nombre, y nada más.
- `docs/processes/app-repartidor.md` documenta **los dos gestos del teléfono**
  que no se arreglan desde el código (FR-011): conceder el permiso de
  notificaciones, y dejar la app en *Apps que nunca duermen* de Samsung.
- `docs/tech-debt-tracker.md`: la fila `High` del 2026-08-14 se cierra o se
  reescribe (FR-015). Hoy afirma que la app Android no existe.
- `docs/README.md` gana la línea del ADR.

## Cómo se comprueba

`verify:` corre las dos patas y **no prueba lo que importa**, cosa que hay que
decir antes de que alguien lea el verde como garantía (D7): compila la app y
corre pruebas de JVM. Que el aviso llegue con el teléfono en el bolsillo no es
observable desde ahí.

Lo que sí cubre `verify:`:

- que el mensaje se arme como manda FR-005, con una prueba pura;
- que un pedido repetido con la misma clave de idempotencia **no** dispare un
  segundo aviso;
- que un envío que falla no rompa la creación del pedido;
- que el servicio arranque sin la credencial;
- **que una llamada sin la cabecera no borre el token guardado** — la prueba que
  fija el `COALESCE`, que es la que más barato se rompe;
- que con **dos** sesiones administradoras vivas se manden **dos** mensajes, y
  que un fallo en el primero no impida el segundo (FR-018).

Lo demás es el [`quickstart.md`](quickstart.md), sobre el teléfono de Diego:
SC-001, SC-002, SC-003, SC-005 y SC-009 se miden ahí y en ningún otro lado.

## Lo que queda afuera, y por qué

- **El mail.** Decisión explícita del dueño: el correo es para consultas.
- **Cualquier aviso que no sea un pedido nuevo** — cambios de estado,
  cancelaciones. Avisar de todo entrena a ignorar los avisos.
- **Una cola de envíos con reintentos propios.** El proveedor ya guarda y
  reintenta durante la ventana de 24 horas; construir una segunda encima es
  infraestructura para un problema que no existe con este volumen.
- **Avisarle al cliente.** No tiene app.
- **Un registro de dispositivos.** Entra el token y nada más (FR-012).
- **Detectar que el fabricante durmió la app.** No hay forma confiable; es
  documentación (D6).
