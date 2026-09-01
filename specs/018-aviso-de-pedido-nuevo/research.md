# Research: Que Diego se entere del pedido cuando entra

Todo lo que sigue se midió sobre este repo y sobre esta máquina el 2026-08-31.
Donde algo no se pudo medir, lo dice.

---

## D1 — El token del teléfono viaja por la vía que ya abrió `017`, no por un endpoint nuevo

**Decisión**: la app manda su token de avisos en una **cabecera**, en las
llamadas que ya hace, y el servicio lo guarda en la fila de la sesión dentro de
la consulta que ya corre. Sin ruta nueva, sin viaje extra, sin nada que
autenticar aparte.

**Por qué**: el camino ya está construido y probado. `017` puso exactamente esta
mecánica para la versión:

- `android/.../datos/Servicio.kt:163` — `llamar()` agrega
  `CABECERA_VERSION` a **todas** las peticiones, en un solo lugar.
- `backend/internal/auth/sesion.go:150` — `Resolver` dejó de ser un `SELECT` y
  es un `UPDATE ... RETURNING` que escribe lo declarado **en el mismo viaje** con
  el que valida la credencial.

Agregar el token es una cabecera más y una columna más en ese mismo `UPDATE`.

**La trampa que ya está resuelta y hay que copiar tal cual**: el `COALESCE(NULLIF($2,
''), ...)` de esa consulta. **El sitio web usa la misma consulta y no manda
ninguna de estas cabeceras**; sin el `COALESCE`, cada vez que Diego mirara sus
pedidos desde el navegador **borraría el token que la app había anotado**, y los
avisos dejarían de llegar sin que nada fallara. El comentario que está sobre esa
consulta lo dice para la versión; vale igual para el token.

**Lo que sale gratis por elegir esto**: FR-007 (*una sesión cortada deja de
recibir avisos*) no necesita código. El `UPDATE` sólo toca filas con
`revocada_en IS NULL AND expira_en > now()`, y el envío sale de esa misma tabla:
revocar la sesión borra al destinatario del conjunto, y el procedimiento de
teléfono perdido que ya existe en `app-repartidor.md` corta los avisos como
efecto.

**Alternativa descartada**: un `POST /yo/push-token` dedicado. Es un viaje más,
una ruta más que autenticar y un momento más en el que la app puede fallar,
para escribir el mismo dato en la misma fila.

---

## D2 — Del lado de Go se manda con `x/oauth2/google` y un POST, no con el SDK de Firebase

**Decisión**: obtener el token de acceso con `golang.org/x/oauth2/google` a
partir de la credencial de service account, y hacer un `POST` a la API HTTP v1
de FCM. **No** se usa `firebase.google.com/go/v4`.

**Medido**, con dos módulos de prueba en el scratchpad y `go mod tidy`:

| Camino | Módulos que agrega | Qué entra |
|---|---|---|
| `golang.org/x/oauth2/google` + POST | **2** | `golang.org/x/oauth2` (ya estaba como **indirecta** en `go.mod`, pasa a directa) y `cloud.google.com/go/compute/metadata v0.3.0` |
| `firebase.google.com/go/v4/messaging` | **76** | Firestore, Cloud Storage, IAM, monitoring, *translate*, gRPC, envoy/protoc-gen-validate… |

Setenta y seis módulos para mandar un JSON a una URL, en un servicio que hoy
tiene **tres** dependencias directas, es exactamente lo que el Principio III
prohíbe.

**La razón de no bajar un escalón más**: se evaluó firmar el JWT a mano con
`github.com/go-jose/go-jose/v4`, que **ya es dependencia directa** (la usa el
ingreso con Google), y cambiarlo por un token de acceso sin agregar ningún
módulo. Se descarta: el cacheo y el refresco del token de acceso es
precisamente la parte que uno no quiere escribir ni mantener, y
`cloud.google.com/go/compute/metadata` es un módulo minúsculo. La regla del
repo es buscar antes de escribir un helper, no escribir uno para ahorrar una
dependencia de dos archivos.

---

## D3 — El envío sale del camino de la respuesta, y **no puede usar `r.Context()`**

**Decisión**: `Crear` responde primero y el aviso se manda aparte, con un
contexto propio y con plazo.

**Por qué**: FR-009 exige que el cliente no espere por el aviso ni vea un error
por su culpa. FCM es una llamada de red a un tercero.

**La trampa concreta**, y es de las que compilan perfecto: si el envío se lanza
en una goroutine llevándose `r.Context()`, ese contexto **se cancela en cuanto
el handler devuelve**. El resultado no es un error visible: es que el aviso no
sale nunca, casi siempre, y de forma intermitente en pruebas locales rápidas.
Hay que armar un `context.Background()` con `WithTimeout`.

**Lo que esto implica para FR-014**: como el fallo ya no puede viajar en la
respuesta HTTP, **el registro es la única señal**. Un envío que falla tiene que
dejar escrito qué pedido no se avisó, o "no me llegó" no se puede comprobar.

---

## D4 — "Un aviso, no dos" ya está resuelto, y no hay que construirlo

**Medido** en `backend/internal/pedidos/handlers.go:158-202`: `POST /pedidos`
**exige** una cabecera de idempotencia (`CabeceraIdempotencia`, obligatoria: sin
ella responde 400) y `h.repo.Crear` devuelve `esNuevo bool`, que hoy sólo se usa
para elegir entre `201` y `200`.

**Decisión**: el aviso se manda **si y sólo si `esNuevo`**. FR-003 sale de una
condición que ya está escrita: un reintento del navegador reusa la clave,
`esNuevo` es `false`, y no hay segundo aviso.

---

## D5 — El mensaje lleva `notification` **y** `data`, con vencimiento de 24 horas

**Decisión**: mensaje híbrido, prioridad alta, `ttl` de 86400 s.

**Por qué no sólo `data`**: un mensaje de datos puros lo tiene que dibujar la
app, o sea que **necesita que el proceso arranque**. Con la app cerrada y el
teléfono en reposo eso es justo lo que el sistema restringe, y es el caso
principal de US1. Con un bloque `notification`, el aviso lo dibuja el sistema
aunque el proceso esté muerto.

**Por qué además `data`**: es lo que lleva el código del pedido para que tocar el
aviso abra la lista en ese pedido (FR-004), y es lo que la app lee cuando está
**en primer plano**, donde el bloque `notification` no se dibuja solo y la app
decide qué hacer — que es exactamente lo que pide FR-016 (mostrar el renglón
*"1 pedido nuevo"* y **no** reordenar la lista).

**El `ttl` es FR-017 tal cual**: 24 horas. Es un campo del mensaje, no lógica
propia; el proveedor descarta lo que venza mientras el teléfono está sin red.

---

## D6 — Qué se puede detectar del silencio, y qué no

FR-008 obliga a que un teléfono que no va a recibir avisos lo diga. **Se puede
detectar una parte, y hay que ser honesto sobre la otra:**

- **Se detecta**: el permiso `POST_NOTIFICATIONS` (Android 13+; la app apunta a
  `targetSdk = 36`) y el interruptor general de notificaciones de la app. Las dos
  cosas se consultan desde la app y alcanzan para el cartel de FR-008.
- **NO se detecta con confianza**: que One UI haya mandado la app a *suspensión
  profunda*. No hay una respuesta fiable para "¿este fabricante me está matando
  en segundo plano?". **Por eso FR-011 es documentación y no código**: se deja la
  app en *Apps que nunca duermen* al instalar, y queda escrito en el runbook.

**El canal**: uno solo, de importancia alta, para pedidos nuevos. Un canal de
importancia alta suena y aparece encima, y **respeta el No molestar del
sistema** — que es exactamente lo que decidió FR-006, sin escribir ninguna
franja horaria.

---

## D7 — El `verify:` no puede probar esto, y hay que decirlo antes de que alguien lo crea

`AGENTS.md` ya lo advierte para `android/`: la pata de Gradle **compila y corre
pruebas de JVM**. Nada de lo que decide si este feature funciona —que el aviso
llegue con la app cerrada, que suene, que no lo mate el fabricante— es
observable desde ahí.

**Decisión**: el `verify:` cubre que el servicio y la app compilen y que la
lógica que sí es pura (armar el mensaje, elegir destinatarios, decidir si hay
que avisar) tenga pruebas de verdad. **Lo demás lo prueba el quickstart, sobre
el teléfono de Diego**, y los SC-001 a SC-003 están escritos para eso.

El riesgo que esto deja abierto es el mismo que `012` documentó y que se cobró
dos defectos reales: **compilar no prueba nada del uso**.

---

## D8 — Dos archivos de credencial, con reglas opuestas

Se confunden fácil y una confusión acá es una filtración:

- **`google-services.json`** (app Android) — identifica al proyecto de Firebase.
  **Se versiona.** Va dentro del APK, y el APK es descargable por cualquiera
  desde la publicación del repo, así que ocultarlo no ocultaría nada; sin él la
  app no compila. No da acceso a mandar avisos.
- **La credencial de service account** (servicio Go) — **es la que sí manda
  avisos en nombre del proyecto**. Nunca entra al repo: variable de entorno en
  Railway, como `CORREO_API_KEY`. Va al `.env.example` sólo por el nombre.

**Y la regla de arranque, que ya nos costó producción una vez**: en
`backend/internal/config/config.go`, `Cargar()` reporta y **falla** con las
obligatorias. Esta credencial **no va por ahí**: se lee como opcional, y si no
está, el servicio arranca y anota que no va a mandar avisos (FR-010). Un
servicio que se niega a levantar por una función accesoria es un servicio caído
por una notificación.

---

## Riesgo abierto (no medido): que las dependencias de Gradle no resuelvan

`android/settings.gradle.kts` ya declara `google()` en `pluginManagement` y en
`dependencyResolutionManagement`, así que **los artefactos de Firebase resuelven
desde donde ya se resuelve AndroidX**. Lo que no se midió es si esta máquina los
puede **bajar** ahora mismo: el catálogo de versiones advierte que lo que hay en
la caché de Gradle se eligió para no volver a bajar todo.

**Por eso el paso 1 del plan es bajar las dependencias y compilar en verde antes
de escribir una línea de lógica.** Si no resuelven, el plan se detiene ahí y eso
se informa, en vez de descubrirlo con medio feature escrito.
