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

- [ ] T001 En `android/gradle/libs.versions.toml` y `android/app/build.gradle.kts`,
      agregar el plugin `google-services` y la dependencia de
      `firebase-messaging` (BOM de Firebase), **sin escribir ninguna lógica**.
      Correr `.\gradlew.bat assembleDebug` y confirmar que resuelve y compila.
      Es la primera dependencia de Google de esta app.
- [ ] T002 [P] En `backend/go.mod`, agregar `golang.org/x/oauth2` (hoy indirecta)
      y `cloud.google.com/go/compute/metadata` con `go mod tidy`, y confirmar con
      `go list -m all` que **no entra nada más** — medido: la vía elegida agrega
      2 módulos y el SDK de Firebase agrega 76 (research D2).
- [ ] T003 Crear el proyecto en la consola de Firebase con el `applicationId` que
      ya tiene la app (`uy.flashurbano.repartidor`), bajar `google-services.json`
      a `android/app/`, **y versionarlo** (viaja dentro del APK, que ya es
      público; research D8).
- [ ] T004 Generar la credencial de **service account** y dejarla **fuera del
      repo**: variable de entorno local y en Railway, junto a `CORREO_API_KEY`.
      Confirmar con `git status` que no aparece ningún archivo de credencial sin
      ignorar (research D8).
- [x] T005 ADR en `docs/decisions/push-as-the-only-alert.md` + su línea en
      `docs/README.md`. **Ya escrito** en la sesión del 2026-08-31, antes de
      ejecutar, como exige la fase Decide.

**Compuerta**: si T001 o T002 no resuelven, **parar acá** y reportarlo.

---

## Fase 2: Fundacional — que exista un destinatario

**Bloquea todo lo demás.** Sin token guardado no hay a quién avisarle, y todo lo
de la Fase 3 sería código que no se puede probar.

- [ ] T006 Migración `backend/migrations/0008_aviso_de_pedido_nuevo.sql`:
      `ALTER TABLE sesiones ADD COLUMN push_token text`, nullable y sin
      `DEFAULT`, con el comentario que explique por qué va en `sesiones` y no en
      una tabla de dispositivos (data-model).
- [ ] T007 [P] En `backend/internal/httpx/`, la cabecera `X-App-Push-Token`:
      constante, validación de largo (≤512) y forma, y el descarte **silencioso**
      de lo mal formado — un token raro no puede devolver 400 ni dejar a Diego
      sin trabajar (contrato `cabecera-push-token.md`).
- [ ] T008 En `backend/internal/auth/sesion.go`, sumar `push_token` al
      `UPDATE ... RETURNING` de `Resolver` **con `COALESCE(NULLIF($n, ''),
      push_token)`**, igual que la versión (**FR-012**, research D1).
- [ ] T009 Prueba en `backend/internal/auth/` de que **una llamada sin la
      cabecera no borra el token guardado** — el caso del sitio web. **Con
      control positivo**: sacar el `COALESCE` a propósito y ver la prueba en
      rojo antes de dejarla (quickstart Q2). Es el defecto más barato de
      introducir y el más caro de diagnosticar.
- [ ] T010 [P] En `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt`,
      mandar la cabecera en `llamar()`, al lado de `CABECERA_VERSION`; leer el
      token de FCM al arrancar y cuando el proveedor lo renueve, y guardarlo en
      `datos/Credencial.kt` — **FR-012**, sin ningún otro dato del aparato.
- [ ] T011 [P] Consulta de destinatarios en `backend/internal/avisos/`: los
      `push_token` de **todas** las sesiones vivas de una dirección
      administradora, filtrando `revocada_en IS NULL AND expira_en > now()`.
      **Devuelve un conjunto, no una fila** (**FR-018**): hay dos teléfonos.
      Las direcciones salen de `config.EsAdmin`, no de una columna.
- [ ] T012 Prueba de que **revocar la sesión saca al teléfono del conjunto**
      (**FR-007**, **SC-008**). Sale gratis del filtro de T011; la prueba fija
      que siga siendo cierto.

---

## Fase 3: US1 — Diego se entera del pedido sin estar mirando (P1)

**Test independiente**: con la app cerrada, crear un pedido desde el sitio y ver
que el teléfono avisa sin que nadie lo toque.

- [ ] T013 [P] [US1] En `backend/internal/avisos/`, el **armado del mensaje**,
      puro y sin red: título `Pedido nuevo <código>` y cuerpo `Entrega en <calle
      de entrega>`, sin número, sin esquina, sin nombres, sin teléfonos y **sin
      ningún importe** (**FR-005**, Principio V). Prueba con control positivo:
      un `entrega_calle` con número tiene que hacerla fallar (quickstart Q3).
- [ ] T014 [US1] En `backend/internal/avisos/`, el **envío**: token de acceso con
      `x/oauth2/google` y `POST` a la API HTTP v1 de FCM. Mensaje híbrido
      (`notification` + `data`), `priority: HIGH`, `ttl: 86400s` y
      `channel_id: pedidos-nuevos` (**FR-001**, **FR-002**, **FR-017**, contrato
      `mensaje-de-aviso.md`).
- [ ] T015 [US1] El envío **recorre el conjunto** de destinatarios y manda un
      mensaje por token. Un destinatario que falla **no corta el recorrido**
      (**FR-018**), y el resultado de cada uno se evalúa aparte.
- [ ] T016 [US1] Prueba de T015: con **dos** sesiones administradoras vivas se
      mandan **dos** mensajes, y con el primero fallando el segundo sale igual
      (**SC-010**).
- [ ] T017 [US1] Cablear el enviador en `backend/cmd/api/main.go`: construirlo
      desde la configuración y pasárselo a `pedidos.NuevosHandlers`, cuya firma
      cambia (hoy es `NuevosHandlers(repoPedidos, cfg.EsAdmin)`, línea 126). **Si
      la credencial no está, se cablea un enviador que no manda nada** — el
      servicio arranca igual (**FR-010**).
- [ ] T018 [US1] Disparo en `backend/internal/pedidos/handlers.go`, dentro de
      `Crear` y **sólo si `esNuevo`** (**FR-003**, research D4). Fuera del camino
      de la respuesta, en una goroutine **con `context.Background()` y plazo
      propio** — llevarse `r.Context()` compila perfecto y hace que el aviso no
      salga nunca (research D3).
- [ ] T019 [US1] Prueba de que un `POST /pedidos` repetido con **la misma** clave
      de idempotencia **no** dispara un segundo aviso (**FR-003**, **SC-006**,
      quickstart Q4).
- [ ] T020 [P] [US1] En `android/app/src/main/AndroidManifest.xml`,
      `POST_NOTIFICATIONS`, pedido en runtime desde `MainActivity.kt`; y **un**
      canal de importancia alta `pedidos-nuevos` — suena, aparece encima y
      **respeta el No molestar del sistema**, que es **FR-006** sin escribir
      ninguna franja horaria.
- [ ] T021 [US1] Crear
      `android/app/src/main/java/uy/flashurbano/repartidor/datos/AvisosService.kt`
      (subclase de `FirebaseMessagingService`) y **declararlo en
      `AndroidManifest.xml`**: sin esa declaración no llega nada, y es el
      artefacto que sostiene T022 y T023. Ahí vive también `onNewToken`, que
      alimenta a T010.
- [ ] T022 [US1] Recepción con la app en segundo plano o cerrada: lo dibuja el
      sistema, y **tocarlo abre la app en la lista, en ese pedido**, leyendo
      `data.pedido` (**FR-001**, **FR-004**, **SC-003**).
- [ ] T023 [US1] Recepción con la app **en primer plano**: no se dibuja solo;
      aparece el renglón *"1 pedido nuevo — tocá para actualizar"* y **la lista
      no se reordena sola** hasta que Diego lo toque (**FR-016**). Prueba de
      estado en `pantallas/` de que la lista no cambia sin la acción.

---

## Fase 4: US2 — Que el aviso mudo se note (P2)

**Test independiente**: negar el permiso y comprobar que la app lo dice, con una
salida para arreglarlo.

- [ ] T024 [US2] En `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`,
      un renglón que aparezca **sólo** cuando el permiso está negado o las
      notificaciones de la app están apagadas, y que lleve a los ajustes del
      sistema (**FR-008**, **SC-005**).
- [ ] T025 [US2] Que ese renglón **desaparezca** al conceder el permiso, y que en
      estado normal **no ocupe pantalla** — es lo que `015` estuvo sacando.
- [ ] T026 [P] [US2] Prueba de JVM sobre la decisión de mostrarlo o no, separada
      del dibujo: los dos estados que la disparan y el que no.

---

## Fase 5: US3 — El pedido se guarda aunque el aviso no salga (P3)

**Test independiente**: dejar al servicio sin poder mandar avisos y crear un
pedido de punta a punta.

- [ ] T027 [US3] En `backend/internal/config/config.go`, leer la credencial de
      FCM **fuera de la lista de obligatorias**. Si falta, el servicio arranca y
      deja anotado que no va a mandar avisos (**FR-010**).
- [ ] T028 [US3] Prueba de arranque sin la credencial: `GET /salud` responde
      `ok` (**SC-004**, quickstart Q5). Es la que impide repetir la caída de
      producción que ya nos costó una vez.
- [ ] T029 [US3] Prueba de que un envío que falla **no rompe la creación del
      pedido** ni hace esperar al cliente (**FR-009**).
- [ ] T030 [US3] Registro del fallo **con el código del pedido** (**FR-014**):
      como el error ya no viaja en la respuesta, el registro es la única señal
      que queda para comprobar un "no me llegó".
- [ ] T031 [US3] Ante un token que el proveedor declara muerto, **borrar ese
      `push_token`** y no reintentarlo (**FR-013**, quickstart Q11).
- [ ] T032 [P] [US3] `backend/.env.example`: el nombre de la variable nueva, y
      nada más.

---

## Fase 6: Pulido y transversales

- [ ] T033 `docs/processes/app-repartidor.md`: los **dos gestos del teléfono**
      que no se arreglan desde el código (**FR-011**, **SC-007**) — conceder el
      permiso de notificaciones, y dejar la app en *Apps que nunca duermen* de
      Samsung. Van dentro del procedimiento de instalación, no como nota al pie.
- [ ] T034 `docs/tech-debt-tracker.md`: cerrar o reescribir la fila `High` del
      2026-08-14 (**FR-015**). Hoy afirma que la app Android no existe, y existe.
- [ ] T035 Correr el `verify:` completo con `TEST_DATABASE_URL` puesta, y
      **mirar el conteo de `SKIP`**: sin esa variable las pruebas contra Postgres
      se saltean solas y el verde no dice nada de la migración (quickstart Q1).
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
