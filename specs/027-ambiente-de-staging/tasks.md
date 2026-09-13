---
description: "Tareas de 027 — un ambiente de staging"
---

# Tasks: Un ambiente de staging

**Input**: documentos de diseño en `/specs/027-ambiente-de-staging/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/salud.md](contracts/salud.md),
[quickstart.md](quickstart.md)

**Tests**: sí, pero pocas y con un propósito claro. Esta feature tiene dos
piezas de código y **las dos existen para que un error silencioso deje de
serlo**, así que lo que se prueba es que la guarda sepa fallar y que el campo
nuevo no pueda tumbar el arranque. El resto de la evidencia no la da una prueba
automática: la da el [quickstart](quickstart.md).

**Advertencia sobre el `verify:` verde**: no crea un entorno, no manda un correo
y no comprueba que dos bases estén separadas. En esta feature el `verify:` es la
parte chica.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (otro archivo, sin depender de algo abierto)
- **[Story]**: a qué historia del spec pertenece

---

## Fase 1: Preparación

- [X] T001 Correr el `verify:` del plan **antes de tocar nada** y anotar el
  resultado. Con `TEST_DATABASE_URL` puesto y Docker Desktop levantado, y
  **contando los `SKIP`**: sin esa variable las pruebas Go contra Postgres se
  saltan solas y el verde no dice nada de la base. Este `verify:` **no lleva la
  pata de Android**, a diferencia del de `026`: esta feature no toca `android/`.

- [X] T002 **Spike de D4, y bloquea todo lo demás.** Averiguar si
  `web/next.config.ts` puede importar un módulo TypeScript local con la
  resolución que Next usa para cargar su configuración. Prueba mínima: un
  `web/lib/url-del-api.ts` que exporte una constante, importado desde
  `next.config.ts`, y `npm run build`. **Si compila**, el enganche del plan
  sirve tal cual. **Si no**, la salida es mover la invocación al script `build`
  de `web/package.json` (`node ... && next build`), dejando el módulo puro donde
  está para que `vitest` lo siga cubriendo. Anotar cuál de los dos caminos quedó
  en [research.md](research.md), D4 — hoy dice "no se verificó" y tiene que
  dejar de decirlo.

---

## Fase 2: Fundacional (bloquea todas las historias)

**Primero el código, después Railway.** Las dos piezas se prueban enteras en
local y llegan al entorno nuevo ya funcionando; al revés, cada corrección
costaría un despliegue.

### La guarda del cruce de cables (FR-008, FR-008a, FR-009, FR-009a)

- [X] T003 [P] Escribir `web/lib/url-del-api.ts`: una función pura que reciba la
  URL cruda y si se está publicando el sitio, y devuelva la URL normalizada o
  **falle con un mensaje que nombre la que recibió y la que esperaba**. La URL
  de producción vive acá (FR-009a). **NO debe importar `web/lib/api.ts`**: hay
  una prueba que guarda que `api.ts` no entre al grafo de importación del
  formulario, y romperla tumbaría la cotización con el servicio caído.

- [X] T004 [P] Escribir `web/lib/url-del-api.test.ts` con las **tres**
  situaciones, que son las tres del Q1: publicación con la URL de producción
  pasa; publicación con otra URL **falla**; y **sin publicación, cualquier URL
  pasa** — apuntar la web local a staging es el uso normal de esta feature
  (FR-008a) y no puede romperse.

- [X] T005 Enganchar la guarda al build por el camino que haya quedado en T002:
  `web/next.config.ts` cuando `GITHUB_PAGES === "true"`, o el script `build` de
  `web/package.json`. La bandera ya se lee en `next.config.ts`
  (`const isPages = process.env.GITHUB_PAGES === "true"`), así que el punto de
  enganche existe.

- [X] T006 **Control positivo de FR-009, y no es opcional.** Correr desde `web/`
  el build con `GITHUB_PAGES=true` y una URL que no sea la de producción, y
  **ver el rojo**. Después el mismo build con la URL correcta, y verlo verde. Una
  guarda que nadie hizo fallar no distingue "está bien" de "no está mirando", y
  ésta es especialmente fácil de escribir de forma que nunca dispare. Guardar la
  salida del rojo como evidencia.

### El campo `ambiente` en `/salud` (FR-021, FR-022, FR-023)

- [X] T007 [P] En `backend/internal/config/config.go`, leer
  `RAILWAY_ENVIRONMENT_NAME` con **`os.Getenv` pelado y después del corte por
  faltantes**, con `desconocido` por defecto. **No con `obligatoria(...)`**: una
  variable obligatoria de más es la forma conocida de dejar producción sin
  arrancar. El patrón exacto ya está en ese archivo, en
  `cfg.FCMCredencialBase64`, con el comentario que explica por qué; se copia, no
  se inventa.

- [X] T008 [P] En `backend/internal/config/config_test.go`, la prueba que
  protege FR-022: **sin `RAILWAY_ENVIRONMENT_NAME` la configuración carga bien**
  y el valor queda en `desconocido`. Es la prueba que se pondría en rojo si
  alguien moviera la variable al grupo de las obligatorias.

- [X] T009 Agregar el campo a la respuesta de `salud` en
  `backend/cmd/api/main.go` (hoy en la línea 272, devolviendo `{estado, base}`).
  **En las dos respuestas, la de `200` y la de `503`**: saber a cuál se le está
  pegando importa especialmente cuando algo anda mal. Ver
  [contracts/salud.md](contracts/salud.md).

- [X] T010 En `backend/cmd/api/main_test.go`, cubrir que **las dos** respuestas
  traen `ambiente` — la sana y la degradada.

- [X] T011 **Control positivo de FR-022.** Mover a propósito la lectura de la
  variable a `obligatoria(...)`, correr T008 y **verla en rojo**, y recién ahí
  revertir. Sin esto, T008 es una prueba que afirma algo sin haber demostrado
  que sabría detectar lo contrario.

- [X] T012 Correr el `verify:` completo y **verlo verde antes de tocar
  Railway**. Todo lo que sigue cuesta despliegues; entrar con el código roto los
  multiplica.

### El entorno (FR-001 a FR-005, FR-019)

- [X] T013 Crear el entorno **`staging`** en el proyecto `sunny-healing`
  (`2cef0777-ae34-4d23-94c9-eadb278ad44a`). Hoy hay uno solo, `production`.

- [X] T014 Crear en `staging` el servicio de base con la **misma imagen fijada**,
  `postgis/postgis:17-3.5`, y su volumen. **No la plantilla PostGIS de
  Railway**: despliega `postgis/postgis:16-master`, un build de la rama de
  desarrollo, y cambiar la imagen después de que la base arranque cuesta
  bastante más que fijarla al crearla.

- [X] T015 Crear el servicio Go de `staging` **sin conectarlo al repositorio**
  (FR-019). Un servicio conectado se despliega solo en cada push de la rama que
  siga, y entonces "manual" es mentira. Root directory `backend`, build por
  `backend/Dockerfile`, igual que producción.

  **Hecho el 2026-09-13, y NO como estaba escrito.** Duplicar el entorno reusa
  **el mismo servicio**, y en Railway **la fuente cuelga del servicio, no de la
  instancia por entorno**: desconectar staging desconecto tambien produccion, y
  reconectar produccion reconecto staging — comprobado en las dos direcciones.
  Con la fuente compartida FR-019 es **imposible** sobre el servicio duplicado,
  y peor: un `railway up` contra staging le habria cambiado la fuente a
  produccion. La forma que si sirve es un **servicio propio**,
  `flash-urbano-staging` (`6f34f11b-...`), creado con `railway add`, sin fuente,
  desplegado con `railway up ./backend --path-as-root`. El duplicado se borro
  **desde el panel** y no con el CLI: `service delete` tiene la misma forma que
  el comando que ya fallo, y de comportarse igual habria borrado produccion.

- [X] T016 Cargar las **seis obligatorias** en el servicio de staging antes del
  primer despliegue — sin alguna, el servicio no arranca, aunque reporta todas
  las que faltan juntas. `DATABASE_URL` por referencia a la base **del propio
  entorno** (la red privada está aislada por entorno, así que no hay forma de
  apuntar sin querer a la de producción); `CORS_ORIGENES` = `http://localhost:3000`
  y nada más; `ADMIN_EMAILS` = sólo la cuenta de Mateo (FR-007);
  `CORREO_REMITENTE` **distinto** al de producción (FR-016). Y
  **`FCM_CREDENCIAL_BASE64` NO se carga** (FR-006): sin ella el servicio arranca
  con un avisador mudo, que es exactamente lo que se quiere.

- [X] T017 Primer despliegue con `railway up` desde la copia de trabajo, y
  **leer el log**: las nueve migraciones aplicándose en orden desde
  `migracion aplicada: 0001_esquema_inicial.sql`. Es el Q2, y prueba FR-004 —
  la base estaba vacía y se llenó sola, sin ningún paso manual.

- [ ] T018 **El Q5, y va acá y no al final: si falla, bloquea todo.** Pedir un
  código de acceso en staging y **recibirlo**. Resend exige remitentes
  verificados, y un remitente rechazado deja staging **sin forma de entrar**
  (FR-016a). Comprobar además que el remitente se distingue del de producción de
  un vistazo.

- [ ] T019 El Q3: pedir `/salud` a los dos ambientes y ver que dicen
  `production` y `staging`. Es la primera vez que FR-021 se ejerce contra dos
  servicios de verdad. **Dos comprobaciones más en la misma pasada**, que son
  configuración y no comportamiento: que la cadena de conexión de staging
  apunte a la base **de su propio entorno** — es lo único que demuestra FR-002,
  el aislamiento estructural, porque T021 prueba que no pasó nada y esto prueba
  que **no puede** pasar —, y que `ADMIN_EMAILS` de staging tenga sólo la cuenta
  de Mateo (FR-007), que hasta acá se había configurado sin mirarse.

  **Parcial al 2026-09-13.** Staging contesta
  `{"estado":"ok","base":"ok","ambiente":"staging"}` y produccion contesta
  `{"estado":"ok","base":"ok"}` **sin el campo**, porque corre `master` y el
  campo vive en la rama. La mitad de produccion se cierra con el merge; no se
  marca hecha antes. Verificado ademas que la cadena de conexion de staging
  apunta a la base de su propio entorno (por referencia) y que `ADMIN_EMAILS`
  tiene solo la cuenta de Mateo.

---

## Fase 3: Historia 1 — crear pedidos sin tocar producción (P1)

**Meta**: Mateo carga lo que quiera en staging y la base de producción no se
entera. **Prueba independiente**: el total del tablero de producción no cambia.

- [ ] T020 [US1] Apuntar `web/.env.local` a staging y levantar `npm run dev`.
  **Leer el archivo antes de escribirlo**: existe, está cubierto por
  `web/.gitignore`, y si se pisa no hay de dónde traerlo. Con esto FR-011 queda
  probado sin construir nada.

- [ ] T021 [US1] **El Q6, que es la prueba que justifica la feature entera.**
  Anotar el total del tablero de producción; crear, editar y borrar pedidos en
  staging; volver a mirar producción y ver el **mismo número** (SC-002).
  **Con control positivo**: comprobar antes que el pedido de staging existe de
  verdad — sin eso, "producción no cambió" también sería cierto si el pedido no
  se hubiera creado en ningún lado, y la prueba pasaría sin probar nada.

- [ ] T022 [US1] El Q7: con la app corriendo contra **producción**, crear un
  pedido en **staging** y ver que el teléfono **no suena** (FR-006). Es el peor
  defecto posible de esta feature —molestar a Diego con una prueba— y la
  comprobación cuesta un minuto.

---

## Fase 4: Historia 2 — probar un cambio antes de que llegue a producción (P2)

**Meta**: ver un cambio de backend corriendo sin mergearlo. **Prueba
independiente**: staging sirve algo que `master` no tiene.

- [ ] T023 [US2] Desplegar a staging un cambio que **no esté en `master`** y
  comprobar las dos mitades: staging lo sirve, y producción sigue sirviendo lo
  de `master` (FR-010, FR-018). Confirma de paso que el servicio no está atado
  al repositorio.

- [ ] T024 [US2] El Q9: leer con el CLI **la fecha del último despliegue de
  staging** y ver que es la de recién. Es la comprobación externa que FR-020
  pide para no depender de la memoria, y lo que se escriba acá es lo que va al
  procedimiento en T026.

---

## Fase 5: Historia 3 — la app contra staging (P3)

**Meta**: mirar la app con datos de prueba. **Prueba independiente**: la lista
trae los pedidos de staging.

- [ ] T025 [US3] El Q8: `.\gradlew.bat assembleDebug -PurlDeDebug=<url de
  staging>` y **`adb -s emulator-5554 install`**. **Nunca `installDebug`, y
  nunca contra un teléfono**: mismo `applicationId` y misma firma que el
  release, así que pisa la app de producción en silencio y la deja apuntando al
  lado equivocado; y con dos dispositivos conectados instala en los dos.
  Comprobar **por lectura** que los teléfonos siguen en la versión de producción
  antes de instalar nada.

---

## Fase 6: Que quede escrito, y cierre

- [ ] T026 Escribir `docs/processes/staging.md` (FR-014): cómo se despliega,
  cómo se apunta la web, **cómo se vuelve a producción**, y —obligatorio por
  FR-020— **cómo saber qué versión está corriendo en staging**. Que diga también
  lo que FR-023 exige: el campo `ambiente` dice a cuál se le está pegando, no si
  el código es el tuyo.

  **Y una frase que es fácil de omitir y cara de perder** (FR-009a): desde este
  trabajo, **mudar el dominio del sitio incluye cambiar la URL esperada en el
  repo**, porque si no la guarda del build va a rechazar el dominio nuevo. `006`
  había puesto esa URL fuera del repo justamente para que mudarse no fuera tocar
  código; eso cambió, y el único lugar donde alguien lo va a leer a tiempo es
  este procedimiento.

- [ ] T027 Refrescar `docs/processes/railway-despliegue.md` (FR-015). Hoy
  describe el estado de `006` y es **falso en tres puntos**: dice que el
  servicio despliega de la rama `backend-auth` (despliega de `master`), que el
  sitio todavía no está en `flashurbano.uy`, y que `GOOGLE_CLIENT_ID`,
  `CORREO_API_KEY` y `CORREO_REMITENTE` son rellenos `PENDIENTE-fase-N`. Sumar
  el entorno `staging` a la tabla de qué hay desplegado.

- [ ] T028 [P] Indexar el procedimiento nuevo en `docs/README.md`, una línea.

- [ ] T029 [P] El Q10: **volver a medir** el costo con staging andando, sobre
  una ventana de 24 h, y comprobar que el proyecto sigue dentro de los US$5
  incluidos (SC-005, FR-013). La cifra de `research.md` es una extrapolación
  anterior a que staging existiera; reportarla de nuevo en vez de medir no
  satisface el criterio.

- [ ] T030 El Q11: releer el procedimiento escrito **sin usar nada de lo que
  quedó en la cabeza** durante la ejecución, y ver si alcanza para levantar la
  web contra staging (SC-006). Cualquier paso que sólo funcione si ya sabías
  algo, se escribe.

- [ ] T031 Anotar en `docs/tech-debt-tracker.md` (fila nueva arriba) lo que haya
  quedado abierto, con disparador. Candidato previsible: que la URL de
  producción ahora viva en el repo (FR-009a) y que mudar de dominio pase a
  incluir ese cambio.

- [ ] T032 Commitear **con el plan todavía `active`**, stageando rutas
  explícitas. Con el plan cerrado el sensor rebota los archivos de código. El
  cierre a `status: completed` va en un **commit aparte**, después de que el
  quickstart esté recorrido y reportado.

---

## Dependencias

```text
T001 (línea de base)
  └─ T002  ← SPIKE: decide la forma de T005. Nada se construye antes.
       ├─ Guarda:  T003 ─┬─ T004 ─┐
       │            └─ T005 ─────┴─ T006 (rojo a propósito)
       ├─ /salud:   T007 ─┬─ T008 ─── T011 (rojo a propósito)
       │            └─ T009 ─── T010
       └─ T012 (verify verde) ── T013 ── T014 ── T015 ── T016 ── T017 ── T018 ── T019
                                                                                  ├─ US1: T020 ── T021, T022
                                                                                  ├─ US2: T023 ── T024
                                                                                  └─ US3: T025
                                                                                          └─ Fase 6
```

- **T002 bloquea todo.** Es el único riesgo técnico abierto del plan, y decide
  en qué archivo vive T005.
- **T012 es la puerta a Railway.** Entrar con el código en rojo multiplica los
  despliegues.
- **T018 bloquea las tres historias**: sin poder entrar a staging no hay nada
  que probar.
- **T024 alimenta a T026**: lo que se descubra leyendo la fecha del despliegue
  es lo que se escribe en el procedimiento.
- Las tres historias **no dependen entre sí** una vez que T019 pasó.

## Paralelo

- **T003/T004 con T007/T008**: son dos superficies distintas, web y servicio, y
  no se tocan. Es el corte más grande de la fase.
- T028 y T029 entre sí, y con T030.
- **Lo que NO va en paralelo**: T006 y T011, los dos controles positivos. Cada
  uno rompe algo a propósito, y hacerlos juntos deja dudando cuál rojo es de
  cuál.

## MVP

**Fase 1 + Fase 2 + Historia 1.** Con eso Mateo ya carga pedidos de prueba sin
ensuciar producción, que es la función completa y el motivo entero de la
feature. Las historias 2 y 3 la extienden: probar antes de mergear, y mirar la
app.

**Lo que no se puede recortar del MVP**, aunque tiente: T006 y T011, los dos
rojos a propósito. Son la diferencia entre tener una guarda y creer que se tiene
una.
