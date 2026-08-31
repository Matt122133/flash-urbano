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

Cada tarea nombra los `FR-`/`SC-` que cierra, para que la cobertura se pueda
auditar con un `grep` y no sólo leyendo.

---

## Fase 1: Preparación

- [x] T001 Traer los tags al repo local con `git fetch --tags origin`, y
      confirmar con `git tag -l` que aparece `v0.1.0`. **Sin esto nada de la
      Fase 2 se puede probar**: `gh release create` creó ese tag sólo del lado
      del servidor (research D1), y un `git describe` sobre un repo sin tags
      siempre cae al caso "sin tag" y parece que el código está mal.

---

## Fase 2: Fundacional — el número sale del tag

**Bloquea todo lo demás.** Mientras el número sea constante, mostrarlo o
mandarlo al servicio no responde ninguna pregunta.

- [x] T002 En `android/app/build.gradle.kts`, reemplazar `versionCode = 1` y
      `versionName = "0.1.0"` por el valor derivado de `git describe`, leído con
      `providers.exec`. La cuenta del entero es `major*10000 + minor*100 +
      patch` (**FR-001**). Implementar **las tres situaciones de la tabla de
      research D3** y que **ninguna falle el build** (**FR-002**): un clon sin
      tags y sin red tiene que seguir compilando.
- [x] T003 Comprobar el resultado **sobre el APK y no sobre el build**, con
      `aapt2 dump badging <apk> | grep -E "versionCode|versionName"`
      (**FR-001**, Q3 del quickstart). En una rama de trabajo el caso que sale
      es "sin tag" (research D2); para ver los otros dos hay que crear un tag
      local y borrarlo después.

---

## Fase 3: US1 — Saber qué versión tiene el teléfono (P1)

**Meta**: que la versión se pueda averiguar por las dos vías, la que Diego lee y
la que contesta sin preguntarle.

**Prueba independiente**: con la app corriendo, averiguar qué versión usa
mirando la pantalla y mirando la base, y que las dos digan lo mismo.

### La que Diego lee

- [x] T004 [P] [US1] Agregar la versión al pie de `PantallaIngreso`, después del
      botón, en
      `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Ingreso.kt`
      (**FR-003**). Lee `BuildConfig.VERSION_NAME`.
- [x] T005 [P] [US1] Agregar la versión al final de la lista de pedidos, después
      de la última tarjeta, en
      `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`
      (**FR-003**). **No puede ocupar espacio permanente** (Principio IV): va
      dentro de lo que se desplaza, no en una barra fija.
- [x] T006 [US1] Comprobar que las dos leen el **mismo** valor y no dos fuentes
      distintas (**FR-012**, **SC-007**). Es barato de romper después con una
      constante escrita a mano en una de las dos.

### La que contesta sin preguntarle

- [x] T007 [P] [US1] Escribir la migración
      `backend/migrations/0007_version_de_la_app.sql`: `version_app text` y
      `version_vista_en timestamptz`, **las dos nullable y sin `DEFAULT`**
      (**FR-010**). El porqué de cada decisión está en `data-model.md`.
- [x] T008 [US1] Crear el validador y el middleware en
      `backend/internal/httpx/version.go`: lee `X-App-Version`, acota el largo,
      descarta lo que no tenga forma de versión, y deja lo que sobrevive en el
      `context`. **Acepta las cuatro formas** del contrato, incluidas las de un
      binario sin tag (**FR-006**) — si sólo aceptara `X.Y.Z`, los binarios de
      trabajo llegarían como "no declarada" y se perdería la distinción.
- [x] T009 [US1] Pruebas del validador en
      `backend/internal/httpx/version_test.go`: las cuatro formas válidas, la
      cabecera ausente, la vacía, la larguísima y la que no es una versión.
      **Ninguna de las inválidas puede cambiar el código de respuesta.**
- [x] T010 [US1] En `backend/internal/auth/sesion.go`, convertir el `SELECT` de
      `Resolver` en un `UPDATE ... RETURNING` **con el mismo `WHERE`**, que
      escriba `version_app` y `version_vista_en` (**FR-010**). **Ninguna firma
      cambia**: `Resolver(ctx, token)` lee la versión del `context`. El filtro
      de `revocada_en` se queda **en la consulta**, que es lo que el comentario
      de esa función defiende.
- [x] T011 [US1] **El `UPDATE` usa `COALESCE`** sobre lo declarado, para que una
      sesión del sitio web —que no manda cabecera— no borre lo que la app anotó.
      Es lo más fácil de romper de todo el feature y falla en silencio.
- [x] T012 [US1] Pruebas en `backend/internal/auth/sesion_test.go`: que la
      versión declarada queda guardada con su marca de tiempo, que un pedido sin
      cabecera **no la borra**, que una sesión revocada o vencida sigue sin
      resolver, y —explícitamente— que **una sesión del sitio web, que nunca
      manda cabecera, sigue resolviendo igual que antes**. Ese último caso es el
      que protege al sitio de una regresión en el camino compartido de sesión.
      Necesitan `TEST_DATABASE_URL`; sin ella **se saltan solas y en silencio**
      (`backend/README.md`).
- [x] T013 [US1] **Romper las dos guardas a propósito y verlas en rojo** (Q2 del
      quickstart): sacar el `COALESCE` y sacar el tope de largo. Si alguna de
      las pruebas sigue verde, no está probando nada y hay que arreglarla antes
      de seguir. Volver a poner las dos.
- [x] T014 [US1] En
      `android/app/src/main/java/uy/flashurbano/repartidor/datos/Servicio.kt`,
      agregar `X-App-Version` a **todos** los pedidos que arma, no sólo a los
      autenticados. Ver `contracts/cabecera-version.md`.
- [x] T015 [US1] Prueba que **enumera las cabeceras** que la app arma y falla
      ante una no esperada (**FR-011**). Sin esto, "no viaja nada del teléfono"
      es una afirmación que nada comprobaría el día que alguien agregue una
      cabecera de buena fe: es una guarda negativa sin control positivo.
- [x] T016 [US1] Ejecutar el **nivel 2** del quickstart (Q5 a Q8) en el emulador
      contra el servicio local (**SC-006**, **SC-007**). **Q6 se mira en la
      base, no en la pantalla**: una pantalla correcta con un dato distinto
      llegando al servicio es la forma exacta en que FR-012 se rompe sin que
      nadie lo note.
      **PARCIAL al 2026-08-31.** La mitad del servicio esta comprobada **contra
      el backend corriendo de verdad**, no solo en pruebas: se creo una sesion a
      mano —insertando el SHA-256 de un token conocido— y se golpeo `GET /yo` en
      los cinco casos. Q6: `0.2.0` quedo en la fila con su marca de tiempo. Q7:
      un pedido **sin** cabecera dejo la version y **no movio la marca**. Q8: la
      cabecera basura y una de 5000 caracteres dieron **200** y la fila intacta.
      Y un binario de trabajo (`0.0.0-ef2e896`) quedo anotado distinto, que es
      FR-006 sobre el servicio real.
      **Q5 CONFIRMADO por Mateo el 2026-08-31**, sobre el telefono real y no en
      el emulador: instalo `v0.2.0` y la version **se ve al final de todas las
      listas**. Con eso el nivel 2 queda completo.

---

## Fase 4: US2 — Publicar sin poder olvidarse del número (P2)

**Meta**: que publicar dos veces el mismo número se detenga solo.

**Prueba independiente**: intentar las tres publicaciones prohibidas de Q9 y que
ninguna suba nada.

- [x] T017 [US2] Escribir `scripts/publicar-app.sh` con las comprobaciones
      **antes** de subir nada: árbol de trabajo limpio, y el tag pedido no
      existe ni local ni en el remoto (**FR-005**, **FR-002**). Recién ahí:
      crear el tag, compilar, verificar el APK y publicar.
- [x] T018 [US2] El script **lee el APK compilado y compara** su `versionName`
      contra el tag que se está publicando, y se planta si no coinciden
      (**FR-004**). Es la única comprobación que detecta el modo de falla de
      research D1 —compilar con un tag que el repo local no tiene— y sin ella
      ese error publica en silencio.
- [x] T019 [US2] El script **reusa** las dos comprobaciones que ya están
      escritas con su comando exacto en `docs/processes/app-repartidor.md` —que
      el `release` no lleve la excepción de texto plano, y que el APK esté
      firmado— en vez de escribir una versión propia.
- [x] T020 [US2] Ejecutar Q9 del quickstart: provocar los tres rechazos a
      propósito (**SC-005**, **SC-002**). **Si alguno publica, la guarda no
      existe.**

---

## Fase 5: US3 — Publicar siguiendo sólo el documento (P3)

**Meta**: que el runbook describa el mundo actual y no el de antes.

- [x] T021 [US3] En `docs/processes/app-repartidor.md`, agregar la publicación
      por link: el orden **tag local → compilar → publicar** con el porqué de
      research D1 (**FR-007**), porque es el paso que se puede hacer mal en
      silencio.
- [x] T022 [US3] Agregar el mensaje que se le manda a Diego, con lo de
      **Archivos → Descargas** (**FR-007**) — abrirlo desde ahí usa el permiso
      de instalar apps desconocidas que ya tiene dado al gestor de archivos;
      desde el navegador se lo pediría de nuevo.
- [x] T023 [US3] Agregar la consulta de `data-model.md` junto al procedimiento
      de cortar sesiones (**SC-006**), que ya vive en ese documento y ya explica
      cómo llegar a la consola de Postgres de Railway.
- [x] T024 [US3] Escribir **la consecuencia de perder la clave de firma**: dónde
      vive el archivo, y que sin él la próxima versión no se instala encima y
      Diego pierde la sesión (**FR-008**). Hoy no está en ningún lado del repo.

---

## Fase 6: Cierre

- [x] T025 Decidir si `SECURITY.md` suma una línea. Guardar la versión en
      `sesiones` cambia qué se guarda en una tabla que ese documento describe.
      **No es dato personal** —FR-011 lo acota a la versión de la app— pero el
      precedente de `016` fue actualizarlo. `SECURITY.md` es ancla de raíz, así
      que no necesita estar en `covers:`.
- [x] T026 Correr el `verify:` del plan entero y mirarlo con dos ojos: que las
      dos patas estén verdes **y que el conteo de `SKIP` de Go sea 0** con
      `TEST_DATABASE_URL` puesta. Un verde con saltos no dice nada sobre la
      migración `0007`.
- [x] T027 **TUYA** Desplegar la migración `0007` a producción y **comprobar que
      el servicio arranca**. **HECHO el 2026-08-31**, y medido: el despliegue
      vivo es el commit `9f8514d` —el merge del PR #30— con `status: SUCCESS`, y
      `GET /salud` devuelve `{"estado":"ok","base":"ok"}`. Como las migraciones
      se aplican al arrancar, un servicio Online prueba que `0007` corrio. Las migraciones se aplican al arrancar, así que una
      que falle deja el servicio abajo. Es el paso que el 2026-08-12 se dio por
      sentado y tumbó producción.
- [x] T028 **TUYA** Ejecutar Q10: publicar una versión de verdad, mandarle el
      link a Diego e instalarla **encima**. Comprobar que no hizo falta
      desinstalar, que él **no volvió a ingresar** (**FR-009**, **SC-003**),
      que la pantalla muestra la nueva (**SC-001**) y que la consulta contesta
      sola (**SC-006**).
      **PARCIAL al 2026-08-31: el mecanismo esta probado de punta a punta en
      PRODUCCION, pero sobre el telefono de Mateo, no el de Diego.**
      `v0.2.0` se publico con el script, se instalo, y la consulta contra la
      base de Railway devolvio `mateo.tambasco12@gmail.com | 0.2.0 |
      2026-08-31 15:23:37+00` — **SC-006 comprobado sobre el producto real**.
      Las otras seis sesiones vivas quedaron en NULL, que es lo correcto: son
      del sitio web, y el navegador no declara version. Tambien se confirmo que
      la version se ve al final de todas las listas (SC-001).
      **ACEPTADO por Mateo el 2026-08-31 con la instalacion en su telefono.**
      Instalo `v0.2.0` **encima** de la anterior: entro sin desinstalar y sin
      volver a ingresar (FR-009, SC-003). El razonamiento que lo extiende al
      telefono de Diego cierra: `v0.1.0` y `v0.2.0` salieron de **esta misma
      maquina y de la misma clave** (`1dbade77...`), asi que lo que Diego tiene
      instalado esta firmado con la misma. **Queda por validar** —no por
      construir— corriendo la consulta cuando el actualice: su mail tiene que
      aparecer con la version.
- [x] T029 **TUYA** Ejecutar Q11: que alguien publique una versión leyendo
      **sólo** `docs/processes/app-repartidor.md` (**SC-004**). Lo que haya que
      preguntar es un agujero del documento. **HECHO de hecho el 2026-08-31**:
      Mateo publico `v0.2.0` con el script sin preguntar nada del
      procedimiento. **Encontro un agujero, y no en este documento sino en
      `railway-despliegue.md`**, que no dice como llegar a la consola de
      Postgres — anotado en el tracker.
- [x] T030 Poner `specs/017-version-de-la-app/plan.md` en `status: completed`
      **después** de commitear el resto: el sensor de cobertura rebota el commit
      si el plan ya está cerrado. **HECHO el 2026-08-31.**

---

## Dependencias

```
T001  (tags locales)
  └─ Fase 2: T002 → T003          BLOQUEA TODO LO DEMAS
       ├─ Fase 3 (US1)  ── el MVP
       │    android:  T004 ∥ T005 → T006 → T014 → T015
       │    backend:  T007 → T008 → T009 → T010 → T011 → T012 → T013
       │    juntos:   T016
       ├─ Fase 4 (US2): T017 → T018 → T019 → T020
       └─ Fase 5 (US3): T021 ∥ T022 ∥ T023 ∥ T024
            └─ Fase 6: T025 → T026 → T027 → T028 → T029 → T030
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
