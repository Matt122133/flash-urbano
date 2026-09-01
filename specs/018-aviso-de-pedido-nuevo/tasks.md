---
description: "Tareas de 018 — Que Diego se entere del pedido cuando entra"
---

# Tasks: Que Diego se entere del pedido cuando entra

**Feature**: `018-aviso-de-pedido-nuevo` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Diseño**: [research.md](research.md) · [data-model.md](data-model.md) ·
[contracts/cabecera-push-token.md](contracts/cabecera-push-token.md) ·
[contracts/mensaje-de-aviso.md](contracts/mensaje-de-aviso.md) ·
[quickstart.md](quickstart.md)

## Cómo leer esto

**Las historias no son independientes, y decirlo importa.** La US1 —que el aviso
llegue— no se puede entregar sola: sin un destinatario guardado no hay a quién
mandarle nada. Por eso el token y su columna están en **Fase 2 (Fundacional)** y
no dentro de una historia.

**El MVP es Fase 1 + Fase 2 + Fase 3.** Con eso el aviso llega y el feature
existe. La Fase 4 hace que el silencio se note y la Fase 5 garantiza que un
accesorio roto no rompa el camino principal — ninguna de las dos es opcional
para cerrar, pero las dos se pueden probar aparte.

**La Fase 1 es una compuerta, no una formalidad.** Es el único riesgo que
`research.md` no pudo medir: si esta máquina no puede bajar los artefactos de
Firebase, el plan se detiene ahí y se informa, en vez de descubrirlo con medio
feature escrito.

Cada tarea nombra los `FR-`/`SC-` que cierra, para que la cobertura se audite
con un `grep` y no sólo leyendo.

---

## Fase 1: Preparación — bajar y compilar antes de escribir lógica

- [x] T001 En `android/gradle/libs.versions.toml` y `android/app/build.gradle.kts`,
      agregar el plugin `google-services` y la dependencia de
      `firebase-messaging` (BOM de Firebase), **sin escribir ninguna lógica**.
      Correr `.\gradlew.bat assembleDebug` y confirmar que resuelve y compila.
      Es la primera dependencia de Google de esta app.
      **Cerrada el 2026-09-01**, en dos mitades. La del 2026-08-31: la
      dependencia entró (BOM `34.18.0`, versiones preguntadas a `dl.google.com`
      y no adivinadas), **resolvió, bajó y compiló en verde** — que es el riesgo
      que esta tarea existía para medir. La de hoy: con `google-services.json`
      ya en el árbol (T003), **el plugin se aplica** y
      `assembleDebug testDebugUnitTest` sale `BUILD SUCCESSFUL`.

      **Una trampa que dejó el asistente de Firebase de Android Studio**, y que
      vale anotar porque se va a repetir: agregó `id("com.google.gms.google-
      services") version "4.5.0"` a mano en los dos `build.gradle.kts` y, en el
      del módulo, además un `id("com.android.application")` que **duplicaba** el
      `alias(libs.plugins.android.application)` que ya estaba. Corregido a la
      forma del repo: `alias(libs.plugins.google.services) apply false` en la
      raíz y aplicado por alias en `app/`, con la versión donde vive, que es el
      catálogo. Un número de versión pegado en dos archivos es exactamente lo
      que el catálogo existe para evitar.
- [x] T002 [P] En `backend/go.mod`, agregar `golang.org/x/oauth2` (hoy indirecta)
      y `cloud.google.com/go/compute/metadata` con `go mod tidy`, y confirmar con
      `go list -m all` que **no entra nada más** — medido: la vía elegida agrega
      2 módulos y el SDK de Firebase agrega 76 (research D2).
      **Hecho el 2026-08-31**: `go.mod` ganó **un solo renglón**
      (`cloud.google.com/go/compute/metadata v0.3.0`), porque `x/oauth2` ya
      estaba. Los dos quedan `// indirect` hasta que T014 los importe, que es lo
      correcto: todavía no hay código que los use. `go vet` y `go test` en verde.
- [x] T003 Crear el proyecto en la consola de Firebase con el `applicationId` que
      ya tiene la app (`uy.flashurbano.repartidor`), bajar `google-services.json`
      a `android/app/`, **y versionarlo** (viaja dentro del APK, que ya es
      público; research D8).
      **Hecho el 2026-09-01**: proyecto `flash-urbano-283d6`, con el paquete
      `uy.flashurbano.repartidor` — comprobado leyendo el archivo, no asumido.
      El plugin lo encuentra y el build pasa en verde (T001).
- [x] T004 Generar la credencial de **service account** y dejarla **fuera del
      repo**: variable de entorno local y en Railway, junto a `CORREO_API_KEY`.
      Confirmar con `git status` que no aparece ningún archivo de credencial sin
      ignorar (research D8).
      **Hecha el 2026-09-01** del lado de Mateo: la credencial está en su
      máquina y **no** en el repo. La variable se llama **`FCM_CREDENCIAL_BASE64`**
      y lleva el JSON en base64, no crudo — `backend/dev.sh` carga el `.env` con
      `. ./.env`, o sea que lo **interpreta el shell**, y un JSON de service
      account trae llaves, comillas, saltos de línea y `$` adentro de la clave
      privada. El sufijo del nombre está para que nadie pegue el JSON pelado.
      **En Railway todavía no**: va cuando se despliegue.
- [x] T005 ADR en `docs/decisions/push-as-the-only-alert.md` + su línea en
      `docs/README.md`. **Ya escrito** en la sesión del 2026-08-31, antes de
      ejecutar, como exige la fase Decide.

**Compuerta**: si T001 o T002 no resuelven, **parar acá** y reportarlo.

---

## Fase 2: Fundacional — que exista un destinatario

**Bloquea todo lo demás.** Sin token guardado no hay a quién avisarle, y todo lo
de la Fase 3 sería código que no se puede probar.

- [x] T006 Migración `backend/migrations/0008_aviso_de_pedido_nuevo.sql`:
      `ALTER TABLE sesiones ADD COLUMN push_token text`, nullable y sin
      `DEFAULT`, con el comentario que explique por qué va en `sesiones` y no en
      una tabla de dispositivos (data-model).
      **Hecha el 2026-09-01**, y **corrida contra un Postgres de verdad**: las
      226 pruebas del backend pasan con `TEST_DATABASE_URL` puesta y **cero
      `SKIP`**, así que este verde sí dice algo de la migración.
- [x] T007 [P] En `backend/internal/httpx/`, la cabecera `X-App-Push-Token`:
      constante, validación de largo (≤512) y forma, y el descarte **silencioso**
      de lo mal formado — un token raro no puede devolver 400 ni dejar a Diego
      sin trabajar (contrato `cabecera-push-token.md`).
      **Hecha el 2026-09-01** en `internal/httpx/push.go`, con
      `ConPushToken` encadenado dentro de `ConSesion` al lado de `ConVersion`
      —o sea en el único camino que lo consume, que es lo que hace imposible
      olvidarse de cablearlo.
      **La forma se valida laxa a propósito**, y el archivo explica por qué: los
      dos errores no cuestan lo mismo. Un validador estricto de más rechaza un
      token bueno el día que el proveedor cambie el formato, y eso apaga los
      avisos **en silencio**; uno laxo de más deja entrar basura a una columna
      que sólo se usa como dirección opaca, que el proveedor rechaza y FR-013
      limpia. El segundo error se arregla solo; el primero no se descubre.
- [x] T008 En `backend/internal/auth/sesion.go`, sumar `push_token` al
      `UPDATE ... RETURNING` de `Resolver` **con `COALESCE(NULLIF($n, ''),
      push_token)`**, igual que la versión (**FR-012**, research D1).
      **Hecha el 2026-09-01**: una cabecera más y un `SET` más, sin endpoint
      nuevo y sin un segundo viaje a la base.
- [x] T009 Prueba en `backend/internal/auth/` de que **una llamada sin la
      cabecera no borra el token guardado** — el caso del sitio web. **Con
      control positivo**: sacar el `COALESCE` a propósito y ver la prueba en
      rojo antes de dejarla (quickstart Q2). Es el defecto más barato de
      introducir y el más caro de diagnosticar.
      **Hecha y comprobada en rojo el 2026-09-01.** Con el `COALESCE` sacado a
      propósito del `UPDATE`, **tres** pruebas se ponen rojas
      (`TestUnaLlamadaSinCabeceraNoBorraElPushToken`,
      `TestLaVersionYElPushTokenSonIndependientes` y
      `TestUnPushTokenBasuraNoEnsuciaLaSesion`), y vuelven a verde al reponerlo.
      Sin ese paso la guarda no valía nada.
      Van además tres pruebas que el plan no pedía y que cubren el resto del
      contrato: que la versión y el token **no se pisen** —el caso real de una
      app con el permiso de avisos negado, que declara versión y no token—, que
      una cabecera basura no ensucie la fila ni devuelva error, y que una sesión
      revocada no acepte un token nuevo.
- [x] T010 [P] En `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt`,
      mandar la cabecera en `llamar()`, al lado de `CABECERA_VERSION`; leer el
      token de FCM al arrancar y cuando el proveedor lo renueve, y guardarlo en
      `datos/Credencial.kt` — **FR-012**, sin ningún otro dato del aparato.
      **Hecha el 2026-09-01.** El token entra a `Servicio` como **función y no como
      valor**, y esa es la decisión que importa: el proveedor lo renueva sin avisar,
      así que un valor congelado al construir el `Servicio` haría que desde la primera
      renovación se anote una dirección que ya no entrega — y los avisos se apagarían
      **sin que nada falle**. Hay una prueba que fija exactamente eso.
      **Sin token no se manda la cabecera**, en vez de mandarla vacía: del lado del
      servicio dan lo mismo, pero en el cable una cabecera vacía se lee como un dato
      que se perdió, y esto tiene que leerse como lo que es — todavía no hay token.
      La guarda de FR-011 de `017` —que del teléfono no viaje nada más— ganó la
      cabecera nueva en su lista blanca **y se la ejercita con token declarado**, para
      no dar por buena una entrada que ninguna petición produce.
- [x] T011 [P] Consulta de destinatarios en `backend/internal/avisos/`: los
      `push_token` de **todas** las sesiones vivas de una dirección
      administradora, filtrando `revocada_en IS NULL AND expira_en > now()`.
      **Devuelve un conjunto, no una fila** (**FR-018**): hay dos teléfonos.
      Las direcciones salen de `config.EsAdmin`, no de una columna.
      **Hecha el 2026-09-01** en `internal/avisos/destinatarios.go`. Recibe la
      lista de direcciones ya normalizada en vez del `*config.Config` entero:
      este paquete no tiene por qué saber leer variables de entorno.
      Trae además `Olvidar`, que es la mitad de base de **T031** (borra el token
      que el proveedor declaró muerto **sin tocar la sesión**: que un token se
      muera no dice nada sobre si la credencial sirve). Lo que le falta a T031 es
      el otro extremo — reconocer esa respuesta del proveedor, que es T014.
- [x] T012 Prueba de que **revocar la sesión saca al teléfono del conjunto**
      (**FR-007**, **SC-008**). Sale gratis del filtro de T011; la prueba fija
      que siga siendo cierto.
      **Hecha el 2026-09-01**, con cinco pruebas más alrededor. Dos merecen
      nombrarse: que **dos** teléfonos administradores devuelvan **dos** tokens
      —FR-018 medido, no asumido: una implementación con `QueryRow` en vez de
      `Query` pasaría cualquier prueba escrita con un teléfono solo—, y que
      **un cliente no reciba avisos**. Esta última es la guarda de privacidad de
      la consulta: cualquier cliente identificado tiene sesión en la misma tabla,
      y lo único que lo separa de Diego es el `JOIN` con la lista de direcciones
      administradoras. Hoy ningún cliente puede tener token porque el sitio no
      manda la cabecera; la prueba existe para que la separación viva en el
      `WHERE` y no en ese hecho accidental.
      Las pruebas hacen declarar el token **por la cabecera**, pasando por
      `Resolver` y por el middleware, y no escribiendo la columna a mano: así
      cubren el camino real y no una versión idealizada de él.

---

## Fase 3: US1 — Diego se entera del pedido sin estar mirando (P1)

**Test independiente**: con la app cerrada, crear un pedido desde el sitio y ver
que el teléfono avisa sin que nadie lo toque.

- [x] T013 [P] [US1] En `backend/internal/avisos/`, el **armado del mensaje**,
      puro y sin red: título `Pedido nuevo <código>` y cuerpo `Entrega en <calle
      de entrega>`, sin número, sin esquina, sin nombres, sin teléfonos y **sin
      ningún importe** (**FR-005**, Principio V). Prueba con control positivo:
      un `entrega_calle` con número tiene que hacerla fallar (quickstart Q3).
      **Hecha el 2026-09-01**, y con **el control positivo cambiado**, porque el
      que pedía el quickstart era incorrecto y vale explicar por qué.

      El armador recibe `PedidoNuevo{Codigo, EntregaCalle}` y **no el pedido
      entero**: así FR-005 no depende de que quien escriba el mensaje se
      acuerde de qué no incluir — el nombre, el teléfono, el número de puerta y
      el precio **no cruzan la firma**, y el compilador lo sostiene. El control
      positivo es entonces una recompilación: se le agregó `EntregaNumero` a la
      estructura y se lo concatenó al cuerpo, y dos pruebas se pusieron rojas.

      **Lo que el quickstart pedía —fallar ante una calle que contiene un
      número— habría sido un defecto**: `18 de Julio`, `8 de Octubre` y
      `26 de Marzo` son calles principales de Montevideo y su nombre **es** un
      número. Hay una prueba que fija que no se las mutile. FR-005 se cumple por
      **qué campos se leen**, no censurando el texto de uno.
- [x] T014 [US1] En `backend/internal/avisos/`, el **envío**: token de acceso con
      `x/oauth2/google` y `POST` a la API HTTP v1 de FCM. Mensaje híbrido
      (`notification` + `data`), `priority: HIGH`, `ttl: 86400s` y
      `channel_id: pedidos-nuevos` (**FR-001**, **FR-002**, **FR-017**, contrato
      `mensaje-de-aviso.md`).
      **Hecha el 2026-09-01** en `internal/avisos/fcm.go`, probada contra un
      servidor de mentira. **Ningún módulo nuevo**: `go mod tidy` sólo movió
      `x/oauth2` de indirecta a directa — research D2 predijo +2 y el costo real
      fue **0**. El identificador del proyecto sale de la propia credencial y no
      de una variable aparte: son el mismo dato, y en dos lugares algún día no
      coinciden.

      **La decisión que más se pensó no está en el plan**: qué respuestas del
      proveedor borran el token. `INVALID_ARGUMENT` es también lo que contesta
      ante un **mensaje** mal armado, o sea ante un defecto nuestro, así que
      tratarlo como token muerto haría que **un despliegue con el JSON torcido
      borrara los tokens de los dos teléfonos en el primer pedido**, dejando a
      Diego mudo hasta reinstalar la app. Sólo cuenta como muerto si el
      proveedor **nombra al token** como el campo en falta. La asimetría está
      probada caso por caso.
- [x] T015 [US1] El envío **recorre el conjunto** de destinatarios y manda un
      mensaje por token. Un destinatario que falla **no corta el recorrido**
      (**FR-018**), y el resultado de cada uno se evalúa aparte.
      **Hecha el 2026-09-01** en `internal/avisos/avisador.go`. `Avisar` **no
      devuelve error a propósito**: si lo devolviera, tarde o temprano alguien
      lo propagaría a la respuesta del cliente, que es justo lo que FR-009
      prohíbe. Sin valor de retorno ese camino no existe.
- [x] T016 [US1] Prueba de T015: con **dos** sesiones administradoras vivas se
      mandan **dos** mensajes, y con el primero fallando el segundo sale igual
      (**SC-010**).
      **Hecha el 2026-09-01, y sin base de datos**: el avisador recibe la
      libreta como interfaz, así que esta prueba corre siempre y no se saltea
      sola en un `verify:` sin `TEST_DATABASE_URL` — que es el agujero que el
      tracker viene anotando desde `010`. La consulta de verdad se prueba
      aparte, contra Postgres.
      El que falla es **el primero** a propósito: con el orden que devuelva la
      base, "el que falla" puede ser cualquiera.
- [x] T017 [US1] Cablear el enviador en `backend/cmd/api/main.go`: construirlo
      desde la configuración y pasárselo a `pedidos.NuevosHandlers`, cuya firma
      cambia (hoy es `NuevosHandlers(repoPedidos, cfg.EsAdmin)`, línea 126). **Si
      la credencial no está, se cablea un enviador que no manda nada** — el
      servicio arranca igual (**FR-010**).
      **Hecha el 2026-09-01**, con un camino de degradación más de los que el
      plan pedía: **una credencial rota también da un avisador mudo**, no un
      error. La variable ausente es el caso obvio; una credencial vencida,
      pegada a medias o de otro proyecto es el que va a pasar de verdad, y meses
      después. Los cinco casos están probados en `cmd/api/main_test.go`.
      `avisos.Mudo` es **un tipo y no un nil**: con el nulo, cada lugar que
      avisa tendría que acordarse de comprobarlo, y el día que alguien se olvide
      el síntoma es un panic en el camino de crear un pedido.
- [x] T018 [US1] Disparo en `backend/internal/pedidos/handlers.go`, dentro de
      `Crear` y **sólo si `esNuevo`** (**FR-003**, research D4). Fuera del camino
      de la respuesta, en una goroutine **con `context.Background()` y plazo
      propio** — llevarse `r.Context()` compila perfecto y hace que el aviso no
      salga nunca (research D3).
      **Hecha el 2026-09-01, y la trampa de D3 se comprobó en rojo**: se le pasó
      `r.Context()` a `avisarDelPedido` y `TestElAvisoNoSeLlevaElContextoDeLaPeticion`
      falló con `context canceled`. Sin ese paso la prueba no valía nada — y
      hubo que escribirla dos veces: la primera guardaba el contexto y lo miraba
      después, y **siempre lo veía cancelado**, con la implementación buena y
      con la mala, porque `avisarDelPedido` cancela el suyo con un `defer` al
      terminar. Lo que hay que capturar es cómo estaba **cuando se lo iba a
      usar**.
      `enSegundoPlano` se inyecta para que las pruebas que cuentan avisos no
      compitan contra el planificador; las dos que necesitan la goroutine de
      verdad la usan.
- [x] T019 [US1] Prueba de que un `POST /pedidos` repetido con **la misma** clave
      de idempotencia **no** dispara un segundo aviso (**FR-003**, **SC-006**,
      quickstart Q4).
      **Hecha el 2026-09-01**, mirando el contador del espía y no la respuesta
      HTTP: el 200 del reintento ya estaba probado desde `007`, y es exactamente
      el caso donde un aviso de más pasaría desapercibido.
      Va con una tercera que el plan no pedía: un pedido **rechazado** tampoco
      avisa. Si no se guardó nada, no hay nada que anunciar.
- [x] T020 [P] [US1] En `android/app/src/main/AndroidManifest.xml`,
      `POST_NOTIFICATIONS`, pedido en runtime desde `MainActivity.kt`; y **un**
      canal de importancia alta `pedidos-nuevos` — suena, aparece encima y
      **respeta el No molestar del sistema**, que es **FR-006** sin escribir
      ninguna franja horaria.
      **Hecha el 2026-09-01.** El canal se crea **desde los dos lados** —la pantalla
      y el servicio de avisos—: crearlo dos veces no es un error, y cubre el caso en
      que un aviso arranque el proceso antes de que alguien haya abierto la app.
      **Si el nombre del canal no coincide con el que manda el servicio, Android
      entrega el aviso con la importancia por defecto y nada falla**: no suena, no
      aparece encima, y el feature se pierde en silencio. Por eso la constante está
      escrita en un solo lugar de cada lado, las dos apuntando al contrato.
- [x] T021 [US1] Crear
      `android/app/src/main/java/uy/flashurbano/repartidor/datos/AvisosService.kt`
      (subclase de `FirebaseMessagingService`) y **declararlo en
      `AndroidManifest.xml`**: sin esa declaración no llega nada, y es el
      artefacto que sostiene T022 y T023. Ahí vive también `onNewToken`, que
      alimenta a T010.
      **Hecha el 2026-09-01.** `onNewToken` guarda con `runBlocking`, y no es un
      atajo: Android lo llama en un hilo de fondo suyo y el método tiene que terminar
      habiendo guardado — volver antes con una corrutina suelta es cómo se pierde un
      token en un proceso que el sistema mata a los dos segundos.
      **Se usan dos APIs deprecadas a propósito, y está medido por qué.** El reemplazo
      (`register()` / `onRegistered()`) **está apagado por defecto**: desensamblando el
      AAR con `javap -c`, lo primero que hace `register()` es devolver
      `IllegalStateException("API disabled. Please enable it by adding
      firebase_messaging_installation_id_enabled=true...")`. Migrar no es cambiar dos
      llamadas, es optar por otro modelo de registro, y eso pide su propia
      comprobación en un teléfono. Anotado en el tracker con su disparador.
- [x] T022 [US1] Recepción con la app en segundo plano o cerrada: lo dibuja el
      sistema, y **tocarlo abre la app en la lista, en ese pedido**, leyendo
      `data.pedido` (**FR-001**, **FR-004**, **SC-003**).
      **Escrita el 2026-09-01, y sin comprobar en un aparato**: eso es Q8 y Q9.
      Va por el intent que abre la actividad **y también por `onNewIntent`** — sin
      eso, tocar el aviso con la app ya abierta la trae al frente en la pantalla donde
      estaba, que es la mitad de FR-004 que se pierde en silencio, porque desde afuera
      se ve igual: la app se abre.
      El pedido queda **destacado con un borde**, no con otro fondo: en esa pantalla
      los colores ya significan estados de un pedido, y esto sólo dice "por acá
      entraste".
- [x] T023 [US1] Recepción con la app **en primer plano**: no se dibuja solo;
      aparece el renglón *"1 pedido nuevo — tocá para actualizar"* y **la lista
      no se reordena sola** hasta que Diego lo toque (**FR-016**). Prueba de
      estado en `pantallas/` de que la lista no cambia sin la acción.
      **Hecha el 2026-09-01.** Lo que llega del aviso es **un contador, no la lista**,
      y ahí está toda la decisión: `AvisosEnVivo` sube un entero y con él aparece el
      renglón; la lista se mueve cuando Diego lo toca, y no antes.
      La propiedad de FR-016 queda entonces **estructural** —lo que se dibuja sale de
      `EstadoPantalla`, que sólo escribe `cargar()`— y lo que las pruebas de JVM fijan
      es el contador y su texto, con el singular y el plural, que es lo primero que él
      va a leer a las siete de la mañana.

---

## Fase 4: US2 — Que el aviso mudo se note (P2)

**Test independiente**: negar el permiso y comprobar que la app lo dice, con una
salida para arreglarlo.

- [x] T024 [US2] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`,
      un renglón que aparezca **sólo** cuando el permiso está negado o las
      notificaciones de la app están apagadas, y que lleve a los ajustes del
      sistema (**FR-008**, **SC-005**).
      **Hecha el 2026-09-01**, y con **dos textos y no uno**: el permiso negado y
      las notificaciones apagadas desde el sistema se arreglan en lugares distintos,
      y mandar a Diego al equivocado lo deja dando vueltas por una pantalla donde no
      está lo que busca. El renglón lleva a los ajustes **de esta app**, no a la
      lista general del teléfono.
- [x] T025 [US2] Que ese renglón **desaparezca** al conceder el permiso, y que en
      estado normal **no ocupe pantalla** — es lo que `015` estuvo sacando.
      **Hecha el 2026-09-01.** Se vuelve a preguntar en cada `ON_RESUME`: sin eso,
      Diego concede el permiso desde los ajustes, vuelve, y el cartel sigue ahí hasta
      que cierre y abra — o sea, un cartel sobre algo que ya arregló.
      En estado normal el bloque **no existe**, y eso es distinto de existir vacío:
      un renglón en blanco ocupa alto y empuja la lista hacia abajo.
- [x] T026 [P] [US2] Prueba de JVM sobre la decisión de mostrarlo o no, separada
      del dibujo: los dos estados que la disparan y el que no.
      **Hecha el 2026-09-01**, y con una cuarta que el plan no pedía: **el orden de
      las dos preguntas**. Desde Android 13, negar el permiso también deja las
      notificaciones apagadas, así que los dos booleanos vienen en falso a la vez;
      preguntar primero por el sistema haría que un permiso negado se reportara como
      "andá a los ajustes a prenderlas", que es el consejo equivocado. Va con una
      prueba de que los dos textos **no son iguales**, para que nadie los unifique y
      deje una distinción que no distingue.

---

## Fase 5: US3 — El pedido se guarda aunque el aviso no salga (P3)

**Test independiente**: dejar al servicio sin poder mandar avisos y crear un
pedido de punta a punta.

- [x] T027 [US3] En `backend/internal/config/config.go`, leer la credencial de
      FCM **fuera de la lista de obligatorias**. Si falta, el servicio arranca y
      deja anotado que no va a mandar avisos (**FR-010**).
      **Hecha el 2026-09-01**: se lee con `os.Getenv` pelado y **después** del
      corte por faltantes, así que no puede sumar a esa lista por ningún camino.
      Hay una prueba que se pone roja si algún día alguien la pasa por
      `obligatoria` "para validarla".
- [x] T028 [US3] Prueba de arranque sin la credencial: `GET /salud` responde
      `ok` (**SC-004**, quickstart Q5). Es la que impide repetir la caída de
      producción que ya nos costó una vez.
      **Hecha el 2026-09-01, y en dos lugares en vez de uno**, porque `GET
      /salud` no es donde se decide: en `internal/config` que `Cargar` no exija
      la variable, y en `cmd/api/main_test.go` que **los cinco caminos de
      credencial rota devuelvan `avisos.Mudo` y no un error**. Lo que tumba un
      servicio no es que falte una variable: es que la construcción de una
      dependencia devuelva un error y alguien lo propague hasta `main`.
      **Falta el `/salud` de verdad**, que es el nivel 1 del quickstart (Q5) y
      se corre a mano; queda en T035.
- [x] T029 [US3] Prueba de que un envío que falla **no rompe la creación del
      pedido** ni hace esperar al cliente (**FR-009**).
      **Hecha el 2026-09-01.** La de "no hace esperar" es la más linda del
      archivo: el avisador se queda **trabado** y el `POST` tiene que volver
      igual. Si el aviso estuviera en el camino de la respuesta, esa prueba no
      falla con un mensaje — **se cuelga**, que también es una falla y bien
      ruidosa.
      La garantía de fondo es estructural y conviene decirla: `Avisar` no
      devuelve nada, así que **no existe** un camino por el que un fallo de
      envío llegue a la respuesta.
- [x] T030 [US3] Registro del fallo **con el código del pedido** (**FR-014**):
      como el error ya no viaja en la respuesta, el registro es la única señal
      que queda para comprobar un "no me llegó".
      **Hecha el 2026-09-01.** Cuatro renglones, todos con el código: no se pudo
      buscar destinatarios, no hay ninguno, se borró un token muerto, y falló un
      envío. El de "no hay ninguno" **no es un error** y se anota igual: es la
      única pista de un "no me llegó" cuya causa está en el teléfono y no en el
      servicio.
- [x] T031 [US3] Ante un token que el proveedor declara muerto, **borrar ese
      `push_token`** y no reintentarlo (**FR-013**, quickstart Q11).
      **Hecha el 2026-09-01**, en sus dos mitades: `Olvidar` borra el token **sin
      tocar la sesión** —que un token se muera no dice nada sobre si la
      credencial sirve; revocarla dejaría a Diego afuera de la app por haber
      reinstalado la app— y `esTokenMuerto` decide cuándo. Ver la nota de T014
      sobre por qué `INVALID_ARGUMENT` casi nunca alcanza.
      Falta sólo verlo contra el proveedor de verdad, que es Q11.
- [x] T032 [P] [US3] `backend/.env.example`: el nombre de la variable nueva, y
      nada más.
      **Hecha el 2026-09-01**, en una sección propia: *"Opcional SIN valor por
      defecto: si falta, la función no existe"*. No entraba en ninguna de las
      dos que había, y esa es justamente la información.

---

## Fase 6: Pulido y transversales

- [x] T033 `docs/processes/app-repartidor.md`: los **dos gestos del teléfono**
      que no se arreglan desde el código (**FR-011**, **SC-007**) — conceder el
      permiso de notificaciones, y dejar la app en *Apps que nunca duermen* de
      Samsung. Van dentro del procedimiento de instalación, no como nota al pie.
      **Hecha el 2026-09-01 — y el teléfono NO es un Samsung.** Este repo tiene
      **medido** el 2026-08-26 con `adb shell getprop`, en el mismo documento, que el
      de Diego es un **Redmi con HyperOS**, y hay una sección entera sobre las trabas
      de instalación de Xiaomi. `018` dice "Samsung" en cinco lugares —spec, plan,
      quickstart y el ADR— y eso **no es un detalle de redacción**: en HyperOS son
      **dos** ajustes separados (*Ahorro de batería → Sin restricciones* e *Inicio
      automático*), y las instrucciones de Samsung mandan a Diego a una pantalla que
      su teléfono no tiene. Seguirlas al pie de la letra produce exactamente el
      síntoma que este feature existe para evitar, y en silencio.
      El documento quedó escrito para HyperOS, con los equivalentes de Samsung y de
      Android sin capa al lado. **Cuál de las dos afirmaciones es la buena hay que
      confirmárselo a Mateo** antes de T038; anotado como fila `High` en el tracker.
- [x] T034 `docs/tech-debt-tracker.md`: cerrar o reescribir la fila `High` del
      2026-08-14 (**FR-015**). Hoy afirma que la app Android no existe, y existe.
      **Reescrita el 2026-09-01, y NO cerrada.** Lo que estaba vencido —que la app
      no existe— se corrigió. Lo que la cierra de verdad es ver el aviso llegar a un
      teléfono, y eso no es observable desde un `verify:`: hasta Q14/Q16 la fila **se
      queda en `High`**, porque un aviso que se manda y no llega deja el circuito
      igual de abierto que no mandarlo, con el agravante de que ahora parece
      resuelto.
      Se agregaron dos filas más: la del fabricante equivocado (T033) y la de las dos
      APIs deprecadas de Firebase (T021).
- [x] T035 Correr el `verify:` completo con `TEST_DATABASE_URL` puesta, y
      **mirar el conteo de `SKIP`**: sin esa variable las pruebas contra Postgres
      se saltean solas y el verde no dice nada de la migración (quickstart Q1).
      **Corrido el 2026-09-01, con las dos patas y mirando el conteo.**

      - `backend`: `go vet` limpio y **265 pruebas en verde con `TEST_DATABASE_URL`
        puesta y CERO `SKIP`**. Sin la variable el mismo comando también sale `ok` y
        no dice nada de la migración ni de la consulta de destinatarios — que es la
        fila del tracker del 2026-08-22, y por eso el número que importa acá es el
        cero, no el verde.
      - `android`: `.\gradlew.bat assembleDebug testDebugUnitTest` en
        `BUILD SUCCESSFUL`, **62 pruebas de JVM, 0 fallas y 0 warnings**.

      **Y este verde no prueba el feature**, cosa que hay que decir antes de que
      alguien lo lea como garantía (research D7): compila la app y corre pruebas de
      JVM. Que el aviso llegue con el teléfono en el bolsillo se mide en T036 a T038
      y en ningún otro lado.
- [ ] T036 Quickstart nivel 2 en el emulador `Medium_Phone_API_36.0`
      (`google_apis_playstore`, medido): Q7 a Q13.
- [ ] T037 Quickstart nivel 3 **en el teléfono de Mateo**: Q14a y Q15
      (**SC-001**, **SC-002**, **SC-006**, **SC-009**, **SC-010**). No depende de
      nadie más y se puede correr el mismo día.
- [ ] T038 Quickstart nivel 3 **en el teléfono de Diego**: Q14 y Q16 — los dos
      gestos del Samsung y la prueba de varios días sin abrir la app. **Es la
      única que el teléfono de Mateo no puede cerrar**, porque lo que se prueba
      es el comportamiento del fabricante.
- [ ] T039 Q17: preguntarle a Diego si, leyendo sólo el aviso y sin desbloquear,
      **sabe si le queda de paso**. Si la respuesta es "tengo que abrir igual",
      se corrige el renglón con lo que él diga — no agregando un campo al
      formulario del cliente.

---

## Dependencias

```
Fase 1 (compuerta)
   └─> Fase 2 (token guardado)
          ├─> Fase 3 (US1) ──> Fase 6
          ├─> Fase 4 (US2)  [sólo depende de T020]
          └─> Fase 5 (US3)  [T027-T028 no dependen de la Fase 3]
```

- **T009 depende de T008**, y no al revés: la prueba se escribe contra el
  `COALESCE` ya puesto, y después se lo saca para verla en rojo.
- **T018 depende de T013, T014, T015 y T017**: el disparo se cablea cuando hay
  algo que disparar y alguien que lo tenga.
- **T022 y T023 dependen de T021**: sin el servicio declarado en el manifiesto no
  llega nada que recibir.
- **T038 no puede empezar antes que T033**: el documento es lo que se está
  probando.

## Paralelo

- Fase 1: **T002** con T001 (superficies distintas).
- Fase 2: **T007**, **T010** y **T011** entre sí — `httpx`, `android/` y
  `avisos/` no se tocan.
- Fase 3: **T013** y **T020** (armado puro en Go, permisos en Kotlin).
- Fase 5: **T032** con cualquiera.

## Estrategia

**Entrega mínima**: Fases 1 + 2 + 3 → el aviso llega. Es lo que cierra la fila
`High` que bloquea promocionar el sitio.

**Después**: Fase 4 (que el silencio se vea) y Fase 5 (que un accesorio roto no
rompa el pedido). Ninguna de las dos es negociable para cerrar el plan, porque
sin la 4 la decisión de no tener segundo canal deja de ser aceptable, y sin la 5
este feature empeora el producto.
