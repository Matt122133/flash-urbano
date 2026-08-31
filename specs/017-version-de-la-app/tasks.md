---
description: "Tareas de 017 — Qué versión tiene el teléfono"
---

# Tasks: Qué versión tiene el teléfono

**Feature**: `017-version-de-la-app` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Diseño**: [research.md](research.md) · [data-model.md](data-model.md) ·
[contracts/cabecera-version.md](contracts/cabecera-version.md) ·
[quickstart.md](quickstart.md)

## Cómo leer esto

Las historias **no son independientes acá, y decirlo importa**. La US1 —que la
versión se vea y llegue al servicio— entregada sola mostraría `0.1.0` en todos
los binarios, que es exactamente el problema que este feature existe para
arreglar. Por eso derivar el número del tag está en **Fase 2 (Fundacional)** y
no dentro de una historia: sin eso, ninguna historia entrega valor.

**El MVP es Fase 2 + Fase 3.** Con eso se contesta qué versión corre un
teléfono, que es la US1 y el feature entero. Las fases 4 y 5 impiden que se
degrade con el tiempo.

---

## Fase 1: Preparación

- [ ] T001 Traer los tags al repo local con `git fetch --tags origin`, y
      confirmar con `git tag -l` que aparece `v0.1.0`. **Sin esto nada de la
      Fase 2 se puede probar**: `gh release create` creó ese tag sólo del lado
      del servidor (research D1), y un `git describe` sobre un repo sin tags
      siempre cae al caso "sin tag" y parece que el código está mal.

---

## Fase 2: Fundacional — el número sale del tag

**Bloquea todo lo demás.** Mientras el número sea constante, mostrarlo o
mandarlo al servicio no responde ninguna pregunta.

- [ ] T002 En `android/app/build.gradle.kts`, reemplazar `versionCode = 1` y
      `versionName = "0.1.0"` por el valor derivado de `git describe`, leído con
      `providers.exec`. La cuenta del entero es `major*10000 + minor*100 +
      patch`. Implementar **las tres situaciones de la tabla de research D3**, y
      que **ninguna falle el build**: un clon sin tags y sin red tiene que
      seguir compilando.
- [ ] T003 Comprobar el resultado **sobre el APK y no sobre el build**, con
      `aapt2 dump badging <apk> | grep -E "versionCode|versionName"`. Es Q3 del
      quickstart. En una rama de trabajo el caso que sale es "sin tag"
      (research D2); para ver los otros dos hay que crear un tag local y
      borrarlo después.

---

## Fase 3: US1 — Saber qué versión tiene el teléfono (P1)

**Meta**: que la versión se pueda averiguar por las dos vías, la que Diego lee y
la que contesta sin preguntarle.

**Prueba independiente**: con la app corriendo, averiguar qué versión usa
mirando la pantalla y mirando la base, y que las dos digan lo mismo.

### La que Diego lee

- [ ] T004 [P] [US1] Agregar la versión al pie de `PantallaIngreso`, después del
      botón, en
      `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Ingreso.kt`.
      Lee `BuildConfig.VERSION_NAME`.
- [ ] T005 [P] [US1] Agregar la versión al final de la lista de pedidos, después
      de la última tarjeta, en
      `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`.
      **No puede ocupar espacio permanente** (FR-003, Principio IV): va dentro
      de lo que se desplaza, no en una barra fija.
- [ ] T006 [US1] Comprobar que las dos leen el **mismo** valor y no dos fuentes
      distintas. Es FR-012, y es barato de romper después con una constante
      escrita a mano en una de las dos.

### La que contesta sin preguntarle

- [ ] T007 [P] [US1] Escribir la migración
      `backend/migrations/0007_version_de_la_app.sql`: `version_app text` y
      `version_vista_en timestamptz`, **las dos nullable y sin `DEFAULT`**. El
      porqué de cada decisión está en `data-model.md`.
- [ ] T008 [US1] Crear el validador y el middleware en
      `backend/internal/httpx/version.go`: lee `X-App-Version`, acota el largo,
      descarta lo que no tenga forma de versión, y deja lo que sobrevive en el
      `context`. **Acepta las cuatro formas** del contrato, incluidas las de un
      binario sin tag — si sólo aceptara `X.Y.Z`, los binarios de trabajo
      llegarían como "no declarada" y se perdería FR-006.
- [ ] T009 [US1] Pruebas del validador en
      `backend/internal/httpx/version_test.go`: las cuatro formas válidas, la
      cabecera ausente, la vacía, la larguísima y la que no es una versión.
      **Ninguna de las inválidas puede cambiar el código de respuesta.**
- [ ] T010 [US1] En `backend/internal/auth/sesion.go`, convertir el `SELECT` de
      `Resolver` en un `UPDATE ... RETURNING` **con el mismo `WHERE`**, que
      escriba `version_app` y `version_vista_en`. **Ninguna firma cambia**:
      `Resolver(ctx, token)` lee la versión del `context`. El filtro de
      `revocada_en` se queda **en la consulta**, que es lo que el comentario de
      esa función defiende.
- [ ] T011 [US1] **El `UPDATE` usa `COALESCE`** sobre lo declarado, para que una
      sesión del sitio web —que no manda cabecera— no borre lo que la app anotó.
      Es lo más fácil de romper de todo el feature y falla en silencio.
- [ ] T012 [US1] Pruebas en `backend/internal/auth/sesion_test.go`: que la
      versión declarada queda guardada con su marca de tiempo, que un pedido sin
      cabecera **no la borra**, y que una sesión revocada o vencida sigue sin
      resolver. Necesitan `TEST_DATABASE_URL`; sin ella **se saltan solas y en
      silencio** (`backend/README.md`).
- [ ] T013 [US1] **Romper las dos guardas a propósito y verlas en rojo** (Q2 del
      quickstart): sacar el `COALESCE` y sacar el tope de largo. Si alguna de
      las pruebas sigue verde, no está probando nada y hay que arreglarla antes
      de seguir. Volver a poner las dos.
- [ ] T014 [US1] En
      `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt`,
      agregar `X-App-Version` a **todos** los pedidos que arma, no sólo a los
      autenticados. Ver `contracts/cabecera-version.md`.
- [ ] T015 [US1] Ejecutar el **nivel 2** del quickstart (Q5 a Q8) en el emulador
      contra el servicio local. **Q6 se mira en la base, no en la pantalla**:
      una pantalla correcta con un dato distinto llegando al servicio es la
      forma exacta en que FR-012 se rompe sin que nadie lo note.

---

## Fase 4: US2 — Publicar sin poder olvidarse del número (P2)

**Meta**: que publicar dos veces el mismo número se detenga solo.

**Prueba independiente**: intentar las tres publicaciones prohibidas de Q9 y que
ninguna suba nada.

- [ ] T016 [US2] Escribir `scripts/publicar-app.sh` con las comprobaciones
      **antes** de subir nada: árbol de trabajo limpio, y el tag pedido no
      existe ni local ni en el remoto (FR-005). Recién ahí: crear el tag,
      compilar, verificar el APK y publicar.
- [ ] T017 [US2] El script **reusa** las dos comprobaciones que ya están
      escritas con su comando exacto en `docs/processes/app-repartidor.md` —que
      el `release` no lleve la excepción de texto plano, y que el APK esté
      firmado— en vez de escribir una versión propia.
- [ ] T018 [US2] Ejecutar Q9 del quickstart: provocar los tres rechazos a
      propósito. **Si alguno publica, la guarda no existe.** Es SC-005.

---

## Fase 5: US3 — Publicar siguiendo sólo el documento (P3)

**Meta**: que el runbook describa el mundo actual y no el de antes.

- [ ] T019 [US3] En `docs/processes/app-repartidor.md`, agregar la publicación
      por link: el orden **tag local → compilar → publicar** con el porqué de
      research D1, porque es el paso que se puede hacer mal en silencio.
- [ ] T020 [US3] Agregar el mensaje que se le manda a Diego, con lo de
      **Archivos → Descargas** — abrirlo desde ahí usa el permiso de instalar
      apps desconocidas que ya tiene dado al gestor de archivos; desde el
      navegador se lo pediría de nuevo.
- [ ] T021 [US3] Agregar la consulta de `data-model.md` junto al procedimiento
      de cortar sesiones, que ya vive en ese documento y ya explica cómo llegar
      a la consola de Postgres de Railway.
- [ ] T022 [US3] Escribir **la consecuencia de perder la clave de firma**: dónde
      vive el archivo, y que sin él la próxima versión no se instala encima y
      Diego pierde la sesión (FR-008). Hoy no está en ningún lado del repo.

---

## Fase 6: Cierre

- [ ] T023 Decidir si `SECURITY.md` suma una línea. Guardar la versión en
      `sesiones` cambia qué se guarda en una tabla que ese documento describe.
      **No es dato personal** —FR-011 lo acota a la versión de la app— pero el
      precedente de `016` fue actualizarlo. `SECURITY.md` es ancla de raíz, así
      que no necesita estar en `covers:`.
- [ ] T024 Correr el `verify:` del plan entero y mirarlo con dos ojos: que las
      dos patas estén verdes **y que el conteo de `SKIP` de Go sea 0** con
      `TEST_DATABASE_URL` puesta. Un verde con saltos no dice nada sobre la
      migración `0007`.
- [ ] T025 **TUYA** Desplegar la migración `0007` a producción y **comprobar que
      el servicio arranca**. Las migraciones se aplican al arrancar (research D7
      de `012`), así que una que falle deja el servicio abajo. Es el paso que el
      2026-08-12 se dio por sentado y tumbó producción.
- [ ] T026 **TUYA** Ejecutar Q10: publicar una versión de verdad, mandarle el
      link a Diego e instalarla **encima**. Comprobar que no hizo falta
      desinstalar, que él **no volvió a ingresar** (FR-009, SC-003), y que la
      consulta contesta sola (SC-006).
- [ ] T027 **TUYA** Ejecutar Q11: que alguien publique una versión leyendo
      **sólo** `docs/processes/app-repartidor.md`. Es SC-004, y lo que haya que
      preguntar es un agujero del documento.
- [ ] T028 Poner `specs/017-version-de-la-app/plan.md` en `status: completed`
      **después** de commitear el resto: el sensor de cobertura rebota el commit
      si el plan ya está cerrado.

---

## Dependencias

```
T001  (tags locales)
  └─ Fase 2: T002 → T003          BLOQUEA TODO LO DEMAS
       ├─ Fase 3 (US1)  ── el MVP
       │    android:  T004 ∥ T005 → T006 → T014
       │    backend:  T007 → T008 → T009 → T010 → T011 → T012 → T013
       │    juntos:   T015
       ├─ Fase 4 (US2): T016 → T017 → T018
       └─ Fase 5 (US3): T019 ∥ T020 ∥ T021 ∥ T022
            └─ Fase 6: T023 → T024 → T025 → T026 → T027 → T028
```

**En paralelo de verdad**: T004 y T005 (dos archivos distintos de Compose); las
cuatro de la Fase 5 (secciones distintas del mismo documento, con cuidado al
juntarlas). La cadena del backend **no** paraleliza: cada una toca lo que dejó
la anterior.

**Fase 4 y Fase 5 no dependen de la Fase 3.** El script y el documento se pueden
escribir mientras la app se prueba, si conviene.

## Alcance del MVP

**Fase 2 + Fase 3.** Ahí ya se contesta la pregunta que motivó todo esto: qué
versión corre el teléfono de Diego, por las dos vías. Las fases 4 y 5 no agregan
capacidad — impiden que ésta se pierda con el tiempo, que es distinto y también
hace falta.
