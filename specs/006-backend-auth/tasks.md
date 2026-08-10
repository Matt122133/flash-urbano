# Tasks: El backend existe y sabe quién pide

**Input**: documentos de diseño en `specs/006-backend-auth/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[quickstart.md](quickstart.md)

**Tests**: sí, pedidos explícitamente. El
[quickstart](quickstart.md#verificación-automática) lista siete propiedades que
las pruebas del backend tienen que cubrir "porque es lo que se rompe en
silencio". Las tareas de prueba de este archivo son esas siete, más las que
sostienen cada historia.

**Organización**: por historia de usuario, para que cada una se pueda construir
y probar sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: a qué historia pertenece (US1…US5)
- Cada tarea nombra su archivo

---

## Cobertura: resuelto el 2026-08-09

El sensor está **WIRED** en este clon (`check_plan_coverage.py --doctor`), y
cuatro archivos que estas tareas necesitan escribir no estaban autorizados. Ya se
agregaron a `covers:` en [plan.md](plan.md), nombrados uno por uno:

| Archivo | Por qué hace falta | Tarea |
|---|---|---|
| `.github/workflows/deploy-pages.yml` | FR-024: sin esa línea el sitio **publicado** compila con la base URL vacía | T022 |
| `web/lib/api.test.ts` | El sensor compara por prefijo: `web/lib/api.ts` **no** cubre `web/lib/api.test.ts` | T021 |
| `web/lib/sesion.test.ts` | Ídem | T038 |
| `web/lib/cotizar-abierto.test.ts` | US1 no tenía ningún lugar cubierto donde poner su guarda automática | T024 |

Se listaron explícitos en vez de cubrir `web/lib/` entero, que arrastraría
`zonas.ts` y `zona-lookup.ts` — justo lo que FR-001 y FR-002 protegen. **Y nada
de esto toca `web/components/pedido-form.tsx`**: la exclusión deliberada que
impone FR-007b queda intacta.

Los anclas de raíz (`ARCHITECTURE.md`, `SECURITY.md`) y todo `docs/` ya están
exentos en el sensor: esos **no** hacen falta en `covers:`, tal como dice el plan.

---

## Phase 1: Setup

**Purpose**: que `backend/` exista y compile antes de que haya lógica.

- [x] T001 Inicializar el módulo Go en `backend/go.mod` (Go 1.26) y crear los directorios de [plan.md](plan.md#project-structure) con un `.keep` en los vacíos
- [x] T002 [P] Escribir `backend/.gitignore` (binario compilado, `.env`, artefactos locales). El `.gitignore` de la raíz no se toca: no está en `covers:` y no hace falta
- [x] T003 [P] Escribir `backend/README.md` con la lista de variables de entorno obligatorias y cómo correr el servicio en local. **Nombres de variables solamente, ningún valor** (FR-028)
- [x] T004 [P] Escribir `backend/Dockerfile` para el despliegue en Railway
- [x] T005 Escribir `backend/cmd/api/main.go` mínimo que compile y arranque un servidor vacío, para que `go build ./...` esté verde desde la primera tarea

**Checkpoint**: `cd backend && go vet ./... && go build ./...` verde.

---

## Phase 2: Foundational (bloqueante para todas las historias)

**Purpose**: el paso *Primero* y *Segundo* del plan — que el servicio exista, se
despliegue y cruce orígenes, **antes** de que haya auth que culpar.

**⚠️ CRÍTICO**: ninguna historia arranca hasta que esta fase cierre.

### Configuración y base

- [x] T006 Implementar la lectura del entorno en `backend/internal/config/config.go`: dirección de la base, orígenes permitidos, credenciales de Google, clave del proveedor de mail, mails administradores, duración de sesión y del rastro. **El servicio no arranca si falta una obligatoria** (FR-028)
- [x] T007 [P] Probar en `backend/internal/config/config_test.go` que falta una variable obligatoria ⇒ error al arrancar, y que los valores configurables (sesión, rastro) tienen los defaults del spec: cuatro semanas y noventa días
- [x] T008 Escribir la migración `backend/migrations/0001_esquema_inicial.sql`: extensión PostGIS, tabla de control de migraciones, y las cuatro entidades de [data-model.md](data-model.md) — `usuarios` (con los cuatro campos de retiro y `retiro_punto` como `geography(Point,4326)`), `sesiones`, `codigos_acceso`, `rastro_ingresos` con sus `CHECK` de `camino` y `resultado`. **Sin columna de administrador y sin columna de contraseña**, y **`nombre` y `telefono` nulables**: la obligatoriedad la impone `perfil_completo`, no el esquema, o el primer ingreso de FR-021b no se puede escribir
- [x] T009 Implementar la conexión a Postgres en `backend/internal/db/db.go`
- [x] T010 Implementar el aplicador de migraciones en `backend/internal/db/migrate.go`: sólo hacia adelante, al arrancar, registrando qué se aplicó (research D7)
- [x] T011 Probar en `backend/internal/db/migrate_test.go` que una base **vacía** queda migrada sin pasos manuales (SC-011, FR-027)

### HTTP, CORS y salud

- [x] T012 [P] Implementar la forma de los errores JSON en `backend/internal/httpx/errores.go`. Hacia afuera nunca distinguen "código incorrecto" de "código vencido" ni revelan si un mail existe (FR-014)
- [x] T013 Implementar CORS por entorno en `backend/internal/httpx/cors.go`: sólo los orígenes de la configuración (FR-023, FR-025)
- [x] T014 [P] Probar en `backend/internal/httpx/cors_test.go` que un origen no autorizado es rechazado y uno autorizado pasa (SC-008), y que agregar un origen es cambiar configuración, no código (SC-009)
- [x] T015 Cablear en `backend/cmd/api/main.go`: config → base → migraciones al arrancar → `ServeMux` con patrones de método → CORS, y el endpoint `GET /salud` que responde que el servicio vive y la base contesta

### El rastro (transversal: lo escriben US2 y US3)

- [x] T016 Implementar el registro de intentos en `backend/internal/rastro/rastro.go` con los siete resultados de [data-model.md](data-model.md): `exito`, `codigo_incorrecto`, `codigo_vencido`, `codigo_agotado`, `limite_excedido`, `google_rechazado`, `email_no_verificado` (FR-022a, FR-022d)
- [x] T017 [P] Probar en `backend/internal/rastro/rastro_test.go` que un intento fallido se puede reconstruir y que **el código no aparece en ningún registro** (SC-012, FR-022b)
- [x] T018 Implementar el borrado por antigüedad: la purga del rastro en `backend/internal/rastro/purga.go` con su prueba —noventa días por defecto, configurable (FR-022c)— y el **disparador** en `backend/internal/db/janitor.go`, una goroutine con ticker arrancada desde `backend/cmd/api/main.go`. El janitor recibe las funciones de purga, así que US3 le engancha la suya sin tocar esta tarea. Que no lo dispare nadie es el modo de falla real: la tabla que más rápido crece se acumularía para siempre

### El sitio habla con el servicio

- [x] T019 Desplegar en Railway: servicio público, base provisionada, PostGIS habilitado, migraciones corriendo desde vacío, variables de entorno cargadas. Verificar `GET /salud` desde afuera (FR-026, FR-029 — Pages no cambia). **Manual, sin archivo** — hecho el 2026-08-09: `https://flash-urbano-production.up.railway.app/salud` devuelve `{"estado":"ok","base":"ok"}`. Cómo quedó armado y las trampas que costó: [`docs/processes/railway-despliegue.md`](../../docs/processes/railway-despliegue.md). `GOOGLE_CLIENT_ID`, `CORREO_API_KEY` y `CORREO_REMITENTE` están cargadas con valores de relleno deliberadamente inválidos, y las reemplazan las Fases 3 y 4
- [x] T020 Escribir el cliente del API en `web/lib/api.ts`: base URL desde `NEXT_PUBLIC_API_URL` (FR-024), credencial en `Authorization: Bearer` (FR-016), y errores de red que no rompan la página
- [x] T021 [P] Probar en `web/lib/api.test.ts` que el header se arma bien y que la base URL sale de la configuración, no del código
- [x] T022 Agregar `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_GOOGLE_CLIENT_ID` al paso de build en `.github/workflows/deploy-pages.yml`, al lado de `GITHUB_PAGES`. El Client ID es un identificador **público** por diseño —viaja en el bundle igual que la base URL— pero no va escrito en el código por el mismo motivo que FR-024: mudar de dominio o rotar el cliente OAuth no puede ser tocar una pantalla. Va como variable de repositorio de GitHub, no como secreto
- [x] T023 Probar el cruce de orígenes a mano: desde el sitio publicado, pedir `GET /salud` y ver que pasa CORS. **Antes de que exista login.** Es la guarda de proceso contra el riesgo que el ADR nombra como el más probable de quemar un día — hecho el 2026-08-09 en Chrome, con la consola sobre `https://matt122133.github.io/flash-urbano/`: `fetch(...)` resolvió e imprimió `{estado: 'ok', base: 'ok'}`. Vale como prueba del origen y no sólo de la red, porque el servicio devuelve **403 a todo origen fuera de `CORS_ORIGENES`** y la lista tiene una sola entrada: que resolviera implica que el `Origin` enviado era el del sitio. Con `curl` quedaron cubiertos los dos lados por separado (200 con `Access-Control-Allow-Origin` para el origen de Pages, 403 para uno ajeno), pero eso solo no alcanzaba: curl no ejecuta la política de origen

**Checkpoint**: hay un servicio desplegado que no hace nada, y el sitio le habla desde otro origen.

---

## Phase 3: User Story 1 — Cotizar sigue sin pedir nada (P1) 🎯

**Goal**: que introducir autenticación no le cobre nada a quien sólo compara precios.

**Independent Test**: con el servicio **detenido**, cotizar de punta a punta sin un solo error.

Esta historia no agrega funcionalidad: defiende la que existe. Va antes que US2
a propósito — la guarda tiene que estar puesta antes de que haya sesión que la
rompa.

- [x] T024 [US1] Escribir la guarda en `web/lib/cotizar-abierto.test.ts`: el camino de cotizar (`lib/zonas.ts`, `lib/zona-lookup.ts`, `lib/direcciones.ts` y lo que importa el formulario) **no depende de `lib/api.ts` ni de `lib/sesion.ts`**, ni directa ni transitivamente, y el precio se resuelve sin red (FR-001, FR-002)
- [ ] T025 [US1] Verificar a mano con el servicio apagado: cargar calle y esquina, ver punto y precio, sin errores en consola (SC-001, quickstart paso 1)
- [x] T026 [US1] Verificar a mano un punto fuera de toda zona: mismo comportamiento que hoy — sin precio y derivación a contacto directo — verificado el 2026-08-09 con un punto en La Paz: sin precio, cartel *"Ese punto queda fuera de nuestra zona de cobertura"* y botón de contacto. Salió de acá una costura anotada en [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md): apenas afuera del recorte del índice de calles la respuesta deja de ser ésta y pasa a ser *"No hay calles que coincidan."*, que no lleva a ningún lado

**Checkpoint**: cotizar sobrevive al resto del feature, y hay una prueba que lo dice.

---

## Phase 4: User Story 2 — Entrar con Google desde el teléfono (P1)

**Goal**: el cliente toca "Ingresar", elige su cuenta de Google, vuelve identificado y ve su nombre.

**Independent Test**: sin dominio propio y sin proveedor de mail. Alcanza con el sitio publicado, el servicio desplegado y una cuenta de Google.

**Nota de alcance**: esta historia construye `GET /yo` y una versión de `PUT /yo`
**limitada a nombre y teléfono**, porque FR-021a exige completar el alta por los
dos caminos. US4 extiende ese mismo endpoint con la dirección de retiro; no se
duplica.

### Backend

- [x] T027 [P] [US2] Definir el usuario y su repositorio en `backend/internal/usuarios/usuario.go`: buscar o crear por mail **normalizado a minúsculas**, con `perfil_completo` (FR-006, FR-007a, FR-021b)
- [x] T028 [P] [US2] Probar en `backend/internal/usuarios/usuario_test.go` que la misma dirección por los dos caminos devuelve **un solo** usuario con el mismo perfil (SC-010a), que un ingreso interrumpido antes de nombre y teléfono se retoma al volver (FR-021b), y que **ningún alta terminada deja `perfil_completo` en `false`** por ninguno de los dos caminos (SC-013, leído como dice [data-model.md](data-model.md): una fila en `false` es un alta en curso, no un usuario creado)
- [ ] T029 [US2] Implementar las sesiones en `backend/internal/auth/sesion.go`: token opaco de fuente criptográficamente segura, guardado **hasheado**, vencimiento configurable y `revocada_en` (research D1, FR-015, FR-017, FR-018)
- [ ] T030 [P] [US2] Probar en `backend/internal/auth/sesion_test.go` que una sesión revocada deja de servir **de inmediato**, que una vencida no sirve, y que cerrar sesión en un dispositivo no cierra las otras (SC-007)
- [ ] T031 [US2] Implementar el middleware de sesión en `backend/internal/httpx/sesion.go`: lee `Authorization: Bearer`, resuelve el usuario, y devuelve un error claro cuando la sesión venció mientras el cliente usaba el sitio
- [ ] T032 [US2] Implementar la verificación del token de Google en `backend/internal/auth/google.go`: firma contra las claves públicas de Google, destinatario, emisor, vencimiento y **`email_verified`** (research D3, FR-003, FR-007)
- [ ] T033 [P] [US2] Probar en `backend/internal/auth/google_test.go` que un token con `email_verified: false` es rechazado, que uno con destinatario ajeno es rechazado, y que ambos casos quedan en el rastro con su resultado propio
- [ ] T034 [US2] Implementar `POST /auth/google` en `backend/internal/auth/handlers.go` y cablearlo en `backend/cmd/api/main.go`: verifica, crea el usuario si no existe, emite sesión, devuelve credencial + vencimiento + usuario con `perfilCompleto`
- [ ] T035 [US2] Implementar `POST /auth/salir` en `backend/internal/auth/handlers.go`: revoca **esa** sesión (FR-018)
- [ ] T036 [US2] Implementar `GET /yo` y `PUT /yo` (nombre y teléfono) en `backend/internal/usuarios/handlers.go`. El identificador del usuario **sale de la credencial, nunca del cuerpo** (FR-020). `PUT /yo` es también lo que completa el alta

### Sitio

- [ ] T037 [US2] Implementar el manejo de la credencial en `web/lib/sesion.ts`: guardar, leer y borrar en `localStorage` (research D4), y propagar el cierre de sesión entre pestañas abiertas
- [ ] T038 [P] [US2] Probar en `web/lib/sesion.test.ts` que cerrar sesión en una pestaña deja a la otra sin identidad, y que una credencial vencida se descarta al leerla
- [ ] T039 [US2] Implementar el estado de sesión compartido en `web/components/sesion/proveedor-sesion.tsx`, incluido el caso de **la sesión que vence mientras el cliente está usando el sitio**: cuando el servicio responde que la credencial no sirve, el proveedor la descarta y muestra un mensaje claro que invita a reingresar. Es un caso de borde declarado del spec y sin esto termina en pantalla rota
- [ ] T040 [US2] Montar el proveedor y agregar la **Content Security Policy estricta** en `web/app/layout.tsx` (research D4: es lo que hace aceptable guardar la credencial en `localStorage`). Tiene que permitir Google Identity Services **y los tiles del mapa**, que se cargan de un servidor externo. **Volver a correr T025 apenas esta tarea cierre**: la CSP es lo único de US2 que puede romper la cotización, que es exactamente lo que US1 defiende, y esperar hasta T074 para descubrirlo es tarde
- [ ] T041 [P] [US2] Implementar el botón de Google en `web/components/sesion/boton-google.tsx` con Google Identity Services, sin flujo de redirección (research D3). El Client ID sale de `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (T022), nunca escrito en el componente
- [ ] T042 [P] [US2] Implementar el paso de alta en `web/components/sesion/completar-alta.tsx`: pide nombre y teléfono, con el nombre precargado de Google y editable (FR-021, FR-021a)
- [ ] T043 [US2] Escribir la pantalla de ingreso en `web/app/ingresar/page.tsx`, con el camino de Google y el hueco del camino por mail (US3)
- [ ] T044 [US2] Mostrar quién está adentro en `web/components/nav-bar.tsx`: "Ingresar" sin sesión, nombre + salir con sesión. Mobile primero — el menú colapsado también
- [ ] T045 [US2] Registrar la configuración de Google (origen autorizado del cliente OAuth) para el origen de Pages y para `flashurbano.uy`. **Manual, en la consola de Google, sin archivo**
- [ ] T046 [US2] Probar el ingreso a mano en **Safari de iPhone** y **Chrome de Android**, no sólo en escritorio: entrar, completar nombre y teléfono, ver el nombre en la navegación, cerrar el navegador y volver identificado (SC-002, SC-003, SC-005)
- [ ] T047 [US2] Probar a mano SC-007: copiar la credencial, cerrar sesión, reusarla contra `GET /yo`, que falle

**Checkpoint**: se entra con Google desde un teléfono. Es el primer corte mostrable, y cierra la Historia 2 entera.

---

## Phase 5: User Story 3 — Entrar con un código que llega por mail (P2)

**Goal**: quien no usa Google escribe su mail, recibe seis dígitos y entra.

**Independent Test**: de punta a punta con una dirección real que no sea de Google, en un teléfono, verificando que el código llegue **a la bandeja de entrada**.

**Bloqueo conocido**: T059 depende de que `flashurbano.uy` esté dado de alta y
verificado. Todo lo demás de esta fase se construye y se prueba sin dominio,
contra la interfaz de mail (research D8). Si al llegar acá el dominio sigue
pendiente, se deja T059 abierto **y se dice al cerrar el plan**, no se da por hecho.

- [ ] T048 [P] [US3] Definir la interfaz de envío en `backend/internal/correo/correo.go` — una sola operación: mandar un código a una dirección
- [ ] T049 [P] [US3] Implementar el proveedor real en `backend/internal/correo/resend.go` (research D8: Resend por su nivel gratuito permanente; Brevo es equivalente si se prefiere)
- [ ] T050 [P] [US3] Implementar el doble de prueba en `backend/internal/correo/falso.go`, que captura el envío en memoria. Es lo que hace automatizables las pruebas de vencimiento, intentos y límites **sin mandar mail**
- [ ] T051 [US3] Implementar el código de acceso en `backend/internal/auth/codigo.go`: seis dígitos de fuente criptográficamente segura, guardado con **hashing lento** —bcrypt o Argon2, no SHA-256— diez minutos de validez, cinco intentos, un solo uso (research D2, FR-008 a FR-012). Incluye el borrado de las filas vencidas —que [data-model.md](data-model.md) pide y nada más cubre— enganchado al janitor de T018
- [ ] T052 [US3] Probar en `backend/internal/auth/codigo_test.go`: un código vencido, uno ya usado y uno con cinco fallos previos son rechazados los tres, y **el quinto fallo mata el código aunque el sexto intento traiga el valor correcto** (SC-006, FR-010)
- [ ] T053 [US3] Implementar los límites de frecuencia en `backend/internal/auth/limites.go`, contados en Postgres por dirección **y** por origen de conexión, con ventana de tiempo (research D6, FR-013). El origen sale de `X-Forwarded-For` —última entrada agregada por el proxy de confianza—, **no de `RemoteAddr`**: detrás del proxy de Railway `RemoteAddr` es el mismo para todos y el límite por origen se vuelve global
- [ ] T054 [P] [US3] Probar en `backend/internal/auth/limites_test.go` que el límite frena, que se libera al pasar la ventana, que el rastro distingue `limite_excedido` de `codigo_incorrecto` (FR-022d), y que **un `X-Forwarded-For` inventado por el cliente no saltea el límite**
- [ ] T055 [US3] Implementar `POST /auth/codigo` y `POST /auth/codigo/verificar` en `backend/internal/auth/handlers.go` y cablearlos en `backend/cmd/api/main.go`. En éxito: marca usado, crea el usuario si no existe, emite la misma sesión larga que Google
- [ ] T056 [US3] Probar en `backend/internal/auth/handlers_test.go` que `POST /auth/codigo` **responde exactamente lo mismo** exista o no el usuario, y también cuando el límite está excedido (FR-014), y que hacia afuera un código incorrecto y uno vencido son indistinguibles
- [ ] T057 [P] [US3] Implementar los dos pasos del camino por mail en `web/components/sesion/ingreso-por-codigo.tsx`: pedir el código y escribirlo, con reintento y un mensaje útil cuando el mail no llega, sin confirmar si la dirección está registrada
- [ ] T058 [US3] Sumar el camino por mail a `web/app/ingresar/page.tsx`, y el alta de nombre y teléfono también por esta vía (FR-021a: quien entra por código llega sin nombre)
- [ ] T059 [US3] Configurar DKIM, SPF y DMARC sobre `flashurbano.uy` y probar la entrega a mano: el código llega **a la bandeja de entrada, no a spam**, en menos de un minuto, en al menos dos proveedores distintos (SC-004). **Manual, DNS, sin archivo — bloqueado hasta que el dominio esté dado de alta**

**Checkpoint**: se entra por los dos caminos, y la misma dirección por ambos es un solo usuario.

---

## Phase 6: User Story 4 — Mis datos quedan guardados (P3)

**Goal**: el cliente guarda nombre, teléfono y dirección de retiro una vez y los vuelve a ver.

**Independent Test**: identificarse, guardar los tres datos, salir, volver a entrar y verlos.

- [ ] T060 [US4] Extender `PUT /yo` en `backend/internal/usuarios/handlers.go` con la dirección de retiro completa —calle, esquina, número y punto— guardando el punto como geometría (FR-019, FR-019a). Los cuatro campos van juntos o no van: una dirección a medias no precarga nada
- [ ] T061 [US4] Extender `GET /yo` para devolver la dirección guardada, **sin darla por válida** (FR-019b). Que el punto caiga dentro de la cuadra se verifica al cobrar, y eso es `007`
- [ ] T062 [US4] Probar en `backend/internal/usuarios/handlers_test.go` que un usuario **no puede leer ni escribir el perfil de otro**, intentándolo con una sesión válida ajena al dato pedido (SC-010, FR-020), y que mandar un identificador ajeno en el cuerpo no cambia nada
- [ ] T063 [US4] Escribir el formulario de perfil en `web/components/sesion/formulario-perfil.tsx`, reutilizando `web/components/bloque-direccion.tsx` **sin modificarlo** (no está en `covers:`, y no hace falta: se importa)
- [ ] T064 [US4] Escribir la pantalla en `web/app/perfil/page.tsx`: ver y editar nombre, teléfono y dirección de retiro
- [ ] T065 [US4] Verificar a mano el quickstart paso 6: guardar con el punto arrastrado dentro de la cuadra, salir, volver, y ver el punto **donde se lo dejó**, no en la esquina

**Checkpoint**: la identidad le devuelve algo al cliente. El cobro de ese valor —precargar el formulario— es `007`.

---

## Phase 7: User Story 5 — Diego entra como administrador (P3)

**Goal**: el sistema reconoce a Diego como administrador por configuración del entorno, sin tocar la base.

**Independent Test**: entrar con la dirección configurada y comprobar que lo distingue; entrar con otra y comprobar que no.

- [ ] T066 [US5] Calcular `esAdmin` comparando el mail contra la configuración en `backend/internal/usuarios/handlers.go`, y devolverlo en `GET /yo` (FR-022). **No sale de una columna**
- [ ] T067 [P] [US5] Probar en `backend/internal/usuarios/admin_test.go` que la dirección configurada es administradora, que cualquier otra no, que cambiar la configuración cambia el resultado sin tocar la base, y que **no existe ningún camino desde el API para volverse administrador**
- [ ] T068 [US5] Verificar a mano el quickstart paso 7: entrar con la dirección configurada, entrar con otra, cambiar la variable y comprobar el efecto

**Checkpoint**: `008` tiene a quién dejar entrar cuando llegue.

---

## Phase 8: Polish y cierre

**Purpose**: el paso *Séptimo* y *Octavo* del plan — la documentación que este feature invalida, y verificar.

- [ ] T069 [P] Actualizar `ARCHITECTURE.md`: el repo deja de tener una sola superficie y deja de no hablar con sistemas externos. Es un ancla de raíz, exenta del sensor
- [ ] T070 [P] Actualizar `SECURITY.md`: este feature crea la primera frontera de confianza del repo — orígenes, credencial en header, secretos sólo del entorno. Paga la fila `Medium` del 2026-08-06 de [`docs/tech-debt-tracker.md`](../../docs/tech-debt-tracker.md)
- [ ] T071 [P] Anotar en `docs/tech-debt-tracker.md` lo que este feature abre y no cierra: **borrado de cuenta a pedido del usuario** (declarado deuda en las Assumptions del spec), y que el punto guardado en el perfil suma un consumidor a la deuda `High` del índice de calles
- [ ] T072 [P] Agregar `backend/` a `docs/README.md` y a la sección que corresponda de `AGENTS.md` si hace falta, ahora que el repo tiene dos artefactos
- [ ] T073 Correr el `verify:` del plan entero y dejarlo verde: `(cd backend && go vet ./... && go test ./... && go build ./...) && (cd web && npm run lint && npm test && npm run build)`
- [ ] T074 Correr el [quickstart](quickstart.md#verificación-manual) completo, los ocho pasos, e informar cuáles quedaron abiertos (esperable: paso 3 si el dominio no está dado de alta)
- [ ] T075 Verificar el quickstart paso 8 una última vez: entrar a `/pedido` **sin identificarse** y comprobar que funciona exactamente como antes — sin puerta, sin precargado, terminando en la pantalla de resumen (FR-007b)
- [ ] T076 Commitear todo **antes** de poner el plan en `status: completed`: el sensor rebota el commit si el plan ya no está `active`

---

## Dependencies & Execution Order

### Fases

- **Setup (1)**: sin dependencias
- **Foundational (2)**: depende de Setup — **bloquea todas las historias**
- **US1 (3)**: depende de Foundational. Va primero a propósito: la guarda se pone antes de que haya sesión que la rompa
- **US2 (4)**: depende de Foundational
- **US3 (5)**: depende de Foundational y **reutiliza** el usuario y la sesión de US2 (T027, T029). No los reimplementa
- **US4 (6)**: depende de US2 — extiende `GET /yo` y `PUT /yo`
- **US5 (7)**: depende de US2 — agrega un campo a `GET /yo`
- **Polish (8)**: depende de todo lo anterior

### Dependencias entre historias

- **US1 (P1)**: independiente. Se prueba con el servicio apagado. **Con una vuelta atrás**: T040 mete una CSP que puede romper el mapa, así que T025 se vuelve a correr después de T040
- **US2 (P1)**: independiente una vez cerrada la Foundational. Es el corte mostrable
- **US3 (P2)**: depende de US2 por el usuario y la sesión, no por el camino de ingreso. Su parte propia —código, límites, mail— es toda nueva
- **US4 (P3)** y **US5 (P3)**: las dos tocan `GET /yo`. Hacer US4 antes que US5 evita el conflicto en `backend/internal/usuarios/handlers.go`

### Paralelizables

- Setup: T002, T003, T004
- Foundational: T007 con T008–T011; T012 y T014 con T013; T017 con T018
- US2: T027 con T028; T030, T033 entre sí; T041 con T042
- US3: T048, T049, T050 entre sí (interfaz y sus dos implementaciones); T054 con T056
- Polish: T069, T070, T071, T072

### Dentro de cada historia

- Migración antes que repositorio, repositorio antes que servicio, servicio antes que endpoint
- Backend antes que la pantalla que lo consume
- Lo manual al final de la historia, no al final del feature — SC-002 es el criterio principal y descubrirlo tarde es el riesgo que el ADR nombra

---

## Implementation Strategy

### MVP

Fases 1, 2 y 3, más la 4. Al terminar hay un servicio desplegado, cotizar sigue
abierto y probado, y Diego entra con Google desde su teléfono. Es lo mínimo que
se puede mostrar y lo que ejercita el riesgo real del feature.

**Parar y validar ahí**: T046 y T047 antes de seguir. Si el ingreso cruzando
orígenes falla en Safari de iPhone, se arregla con dos historias construidas, no
con cinco.

### Entrega incremental

1. Fases 1–2 → hay un servicio que no hace nada, y el sitio le habla
2. Fase 3 → cotizar tiene guarda
3. Fase 4 → **MVP**: se entra con Google desde el teléfono
4. Fase 5 → se entra sin Google (bloqueada por el dominio en su último paso)
5. Fases 6–7 → el perfil guarda, y Diego es administrador
6. Fase 8 → documentación al día y `verify:` verde

### Lo que este plan no cierra

El formulario **sigue sin llegarle a nadie** y el sitio es indexable desde `004`.
Eso es `007`. Quien termine estas tareas no debería reportar que el producto
quedó funcionando de punta a punta.

---

## Notes

- **`web/AGENTS.md` manda sobre el Next de este repo**: antes de escribir cualquier tarea de `web/`, leer la guía correspondiente en `node_modules/next/dist/docs/`. La versión tiene cambios que rompen respecto de lo conocido
- 76 tareas: 5 de setup, 18 de foundational, 3 de US1, 21 de US2, 12 de US3, 6 de US4, 3 de US5, 8 de cierre
- 12 son manuales sin archivo (T019, T023, T025, T026, T045, T046, T047, T059, T065, T068, T074, T075) — son las que verifican lo que ningún comando puede
- Commitear por tarea o por grupo lógico, con la convención del repo
</content>
</invoke>
