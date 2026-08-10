---
ticket: none
status: active
covers:
  # El servicio Go entero. No existe todavía: este feature lo crea.
  - backend/
  # Pantallas nuevas: ingresar y perfil.
  - web/app/ingresar/
  - web/app/perfil/
  # El cliente del API y el manejo de la credencial de sesión en el browser.
  - web/lib/api.ts
  - web/lib/sesion.ts
  # Las pruebas de esos dos módulos, nombradas una por una. El sensor compara
  # por prefijo, así que `web/lib/api.ts` NO cubre `web/lib/api.test.ts`. Se
  # listan explícitas en vez de cubrir `web/lib/` entero, que arrastraría
  # `zonas.ts` y `zona-lookup.ts` — justo lo que FR-001 y FR-002 protegen.
  - web/lib/api.test.ts
  - web/lib/sesion.test.ts
  # La guarda automática de la Historia 1: que cotizar no dependa del servicio.
  # Es el único lugar cubierto donde puede vivir, y sin él esa historia queda
  # sólo con verificación manual.
  - web/lib/cotizar-abierto.test.ts
  # FR-024: el sitio publicado toma la dirección del servicio del build. Sin
  # esta línea en el workflow, el sitio de Pages compila apuntando a la nada y
  # el requisito queda cierto sólo en local.
  - .github/workflows/deploy-pages.yml
  # Componentes nuevos de sesión, y la navbar que muestra quién está adentro.
  - web/components/sesion/
  - web/components/nav-bar.tsx
  # El estado de sesión compartido necesita un proveedor arriba de todo. Se
  # cubre por adelantado en vez de descubrirlo cuando el sensor frene el commit.
  - web/app/layout.tsx
  # spec-kit escribe acá cuál es el feature activo.
  - .specify/feature.json
  # NOTA DELIBERADA: web/components/pedido-form.tsx NO está cubierto, y es a
  # propósito. FR-007b dice que el formulario de pedido no se toca en este
  # feature; dejarlo fuera de covers: hace que el sensor de pre-commit lo
  # imponga en vez de confiar en que alguien se acuerde.
# `-p 1` no es adorno: las pruebas contra Postgres comparten una sola base y la
# de migraciones la vacia entera para verificar SC-011 (migrar desde vacio). Go
# corre los paquetes en paralelo por defecto, asi que sin esto esa prueba le
# saca el esquema de abajo a las de usuarios y rastro mientras trabajan, y el
# verify: da rojo por una carrera y no por el cambio de quien lo corre. Se
# descubrio el 2026-08-10, la primera vez que las pruebas de base corrieron de
# verdad en vez de saltearse.
verify: (cd backend && go vet ./... && go test ./... -p 1 && go build ./...) && (cd web && npm run lint && npm test && npm run build)
analyzed: 2026-08-09
---

# Implementation Plan: El backend existe y sabe quién pide

**Feature dir**: `specs/006-backend-auth` | **Date**: 2026-08-08 | **Spec**: [spec.md](spec.md)

## Summary

Este feature crea el primer backend del proyecto y la identidad de quien pide.
Hasta hoy el repo tiene un solo artefacto: un sitio estático sin servidor, sin
base y sin auth. Al terminar tiene dos, en orígenes distintos, y esa división
—no la autenticación en sí— es la fuente de casi todo el riesgo.

Pone en efecto por primera vez el
[ADR backend-persistence-stack](../../docs/decisions/backend-persistence-stack.md),
que estaba aceptado como dirección y explícitamente no vigente.

**No guarda pedidos.** El formulario sigue muriendo en la pantalla de resumen.
Eso es `007`.

## Technical Context

**Language/Version**: Go para el servicio nuevo, en `backend/`. TypeScript 5 /
Next 16.2.12 / React 19.2.4 en `web/`, sin cambios de versión.

> **Go 1.26.5 instalado el 2026-08-08**, en `C:\Users\USUARIO\golang\go`, con
> `...\golang\go\bin` y `...\go\bin` agregados al PATH de usuario. No se usó
> winget porque Go no publica instalador de ámbito de usuario y la máquina no
> tiene privilegios de administrador: se bajó el zip oficial y **se verificó su
> SHA-256 contra el que publica go.dev** antes de extraerlo. Comprobado con
> `go vet`, `go test`, `go build` y `go run` sobre un módulo de prueba, desde
> Bash, que es donde corre el `verify:`.
>
> Salvedad: las terminales abiertas **antes** de la instalación no lo ven, porque
> heredaron el PATH viejo. Hay que abrir una nueva.

**Primary Dependencies**: biblioteca estándar de Go para el HTTP (`net/http` con
el `ServeMux` con patrones de método, disponible desde Go 1.22) — sin framework.
Fuera de la estándar, sólo lo que no se puede escribir a mano razonablemente:
driver de Postgres, verificación del token de Google, hashing del código, y el
cliente del proveedor de mail. Ver [research.md](research.md).

**Storage**: Postgres con PostGIS en Railway. La extensión se habilita en este
feature aunque **todavía no se guarde geometría**: el punto de retiro del perfil
va como geometría desde el día uno, que es lo que el ADR pidió para no migrar
después una tabla con datos reales.

**Testing**: `go test` en el backend. Vitest 4 en `web/`. El grueso de lo que
hay que probar automáticamente es del lado del servidor: vencimiento del código,
conteo de intentos, límites de frecuencia, aislamiento entre usuarios. Lo que
**no** se prueba automáticamente es el ingreso real en un teléfono, que es el
criterio principal del feature (SC-002, SC-003) y es manual por naturaleza.

**Target Platform**: servicio en Railway (Linux). Sitio estático en GitHub
Pages. Navegadores de teléfono primero.

**Project Type**: dos artefactos — servicio HTTP + aplicación web estática.

**Performance Goals**: ninguno que valga fijar. El ADR estimó el orden de 16.000
requests por mes, alrededor de uno cada tres minutos. Poner un objetivo de
latencia acá sería inventar un requisito.

**Constraints**: el sitio **no puede depender del servicio para cotizar**
(FR-001, FR-002). El repo es **público**: ningún secreto en el árbol (FR-028).

**Scale/Scope**: unos ocho endpoints, cuatro entidades, dos pantallas nuevas.

## Constitution Check

Contra `.specify/memory/constitution.md` **v2.2.0**.

**Principio I (visual-first)**: entrega algo que el cliente puede ver y tocar —
se loguea desde su teléfono y ve su perfil. No es la superficie de mayor valor
(ésa es que el pedido llegue, y es `007`), pero es una tajada demostrable y no
un backend invisible. **Pasa.**

**Principio II (la autogestión es el valor central)**: es el principio en
tensión. El feature **agrega fricción**: una puerta para pedir, y un alta que
pide nombre y teléfono. Dos cosas lo salvan. La puerta la pidió el cliente, así
que no es una decisión de diseño nuestra que contradiga su brief: es su brief.
Y **cotizar queda abierto** (FR-001), que es la parte del flujo donde un
desconocido decide si le sirve el servicio. **Pasa.**

**Principio III (simplicidad sobre infraestructura, YAGNI)**: es el principio
que más se podría discutir, porque este feature suma un servicio, una base de
datos y autenticación de una sola vez. No lo viola: III prohíbe infraestructura
**prematura**, y el ADR argumentó que el momento llegó —el formulario no le
llega a nadie y el cliente vetó los pedidos anónimos—. Dentro de ese marco el
plan elige deliberadamente lo aburrido: sin framework HTTP, sin Redis, sin cola,
sin generación de código. **Pasa**, y las decisiones que lo sostienen están en
[research.md](research.md).

**Principio IV (mobile-first, baja fricción)**: SC-002 y SC-003 hacen del
teléfono la superficie de aceptación, no del escritorio. **Pasa.**

**Principio V (el sitio cotiza; la logística es manual)**: FR-001 y FR-002
existen para protegerlo, y el `verify:` incluye las pruebas de zonas que ya
existen. El recálculo del precio en el servidor —la otra mitad del principio—
es de `007`. **Pasa.**

**Scope boundaries — el conflicto conocido**: la constitución sigue diciendo
"**guest** or Google-login order creation", y la respuesta del cliente elimina el
pedido como invitado. **Este feature no lo viola**, y conviene ser preciso sobre
por qué: `006` no le pone puerta al formulario (FR-007b), así que al terminar
este plan el pedido como invitado sigue existiendo exactamente igual que hoy. El
conflicto se vuelve real en `007`. La enmienda es decisión del dueño del repo y
**no se toma en este plan**. **Pasa, con el conflicto señalado.**

**Plan-bounded change (harness)**: `covers:` nombra los prefijos reales, y deja
`web/components/pedido-form.tsx` **afuera a propósito** para que el sensor
imponga FR-007b. **Pasa.**

**Verified before done (harness)**: `verify:` corre las dos mitades, y las dos
mitades tienen su cadena de herramientas instalada y probada. **Pasa.**

Sin violaciones que justificar.

## Project Structure

```text
backend/
├── cmd/api/main.go              # Arranque: config del entorno, rutas, servidor
├── internal/config/             # Lee el entorno. Falla al arrancar si falta algo
├── internal/db/                 # Conexión y aplicación de migraciones
├── internal/usuarios/           # Usuario y perfil: alta, lectura, edición
├── internal/auth/               # Google, código por mail, sesiones, límites
├── internal/rastro/             # Registro de intentos de ingreso
├── internal/correo/             # Envío del código. Interfaz + un proveedor
├── internal/httpx/              # CORS por entorno, middleware de sesión, errores
└── migrations/                  # SQL versionado, sólo hacia adelante

web/
├── app/ingresar/page.tsx        # Las dos vías de ingreso
├── app/perfil/page.tsx          # Ver y editar nombre, teléfono y dirección
├── components/sesion/           # Formularios y estado de sesión en el cliente
├── components/nav-bar.tsx       # Muestra quién está adentro
├── lib/api.ts                   # Cliente del API: base URL de build, header
└── lib/sesion.ts                # Guardar, leer y borrar la credencial
```

**Structure Decision**: `backend/` es un directorio nuevo de primer nivel, al
lado de `web/`. Es el cambio estructural más grande desde que arrancó el repo, y
`ARCHITECTURE.md` —que hoy dice que el repo tiene *una* superficie y que no habla
con ningún sistema externo— deja de ser cierto el día que esto se mergea.
Actualizarlo es un paso del plan, no un arreglo posterior.

Dentro de `backend/`, `internal/` sigue la convención de Go de impedir que otro
módulo importe estas piezas. El corte por dominio (`usuarios`, `auth`, `rastro`)
en vez de por capa (`models`, `services`) es a propósito: son tres cosas con
reglas distintas y ciclos de vida distintos, y el corte por capa las mezclaría.

## Enfoque de ejecución

**Primero, que el servicio exista y no haga nada.** Un servicio desplegado en
Railway que responde que está vivo, con la base creada, PostGIS habilitado y las
migraciones corriendo desde vacío. Sin auth, sin usuarios. El objetivo es tener
el camino de despliegue funcionando antes de que haya lógica que culpar cuando
algo falle. Cierra FR-026, FR-027, FR-029 y SC-011.

**Segundo, CORS y configuración, antes que la auth.** Orígenes permitidos desde
el entorno (FR-023, FR-025), base URL del API en la configuración de build del
sitio (FR-024), y el servicio que **se niega a arrancar** si falta una variable
obligatoria. Va acá y no al final porque es lo que hace que mudar el dominio no
sea tocar código, y porque el modo de falla cross-origin se descubre mejor
contra un endpoint trivial que contra un login.

**Tercero, Google.** El sitio obtiene un token de Google, el servicio lo verifica
—firma, destinatario, vencimiento y `email_verified`—, crea el usuario si no
existe y emite su propia credencial de sesión. Acá se cierra la Historia 2
entera, incluido el alta con nombre y teléfono (FR-021a). **Se prueba en un
teléfono real antes de seguir**, porque es donde el ADR predice la falla.

**Cuarto, el código por mail.** Depende de que `flashurbano.uy` esté activo y
verificado con DKIM, SPF y DMARC. Seis dígitos, diez minutos, cinco intentos,
guardado con hashing lento, límites por dirección y por origen. Las respuestas
no revelan si la dirección existe (FR-014). Si el dominio todavía está pendiente
cuando se llega acá, se implementa y se prueba contra un proveedor en modo de
prueba, y la verificación real de entrega a bandeja de entrada (SC-004) queda
pendiente hasta que el dominio esté.

**Quinto, el perfil.** Guardar y editar nombre, teléfono y dirección de retiro
con la forma del formulario, punto incluido (FR-019a). Aislamiento entre
usuarios probado con una sesión ajena (SC-010). El punto se guarda **sin darlo
por válido** (FR-019b): la validación contra la cuadra es de `007`, y este plan
sólo se compromete a no afirmar lo contrario.

**Sexto, el rastro y el administrador.** Registro de intentos exitosos y
fallidos, sin el código ni la credencial, con borrado por antigüedad (FR-022a a
FR-022d). Administrador por variable de entorno (FR-022).

**Séptimo, la documentación que este feature invalida.** `ARCHITECTURE.md`
describe un repo de una sola superficie sin sistemas externos. `SECURITY.md`
describe un repo sin frontera de confianza — es la fila `Medium` del 2026-08-06
del tracker, y el momento de pagarla es éste, no después. Los dos son anclas de
raíz, así que no necesitan estar en `covers:`.

**Octavo, verificar.** `verify:` verde, y después lo que ningún comando puede
hacer: entrar por las dos vías desde un teléfono, en Safari de iPhone y en
Chrome de Android. Ver [quickstart.md](quickstart.md).

## Riesgos

**El auth cross-origin en el teléfono.** El ADR lo nombra como lo más probable
de quemar un día. La guarda de diseño ya está tomada —credencial en un header,
no cookie (FR-016), así que no hay `SameSite=None` que Safari pueda bloquear—,
pero la guarda de proceso es el paso segundo: probar el cruce de orígenes contra
un endpoint trivial antes de que haya login que culpar.

**El dominio no resuelve.** ~~Bloquea la Historia 3 y SC-004~~ — **cerrado el
2026-08-10.** La zona se mudó a Cloudflare, `a.nic.uy` delega ahí, el SOA resuelve
y `_dmarc` está cargado. Lo que le queda a T059 es dar de alta el dominio en
Resend y cargar los registros que indique, que ya no depende de nadie más. Ver
[`docs/processes/dominio-y-dns.md`](../../docs/processes/dominio-y-dns.md), que
además documenta la trampa de mudar el sitio al apex: el `basePath` de
`web/next.config.ts` lo rompe, y ese archivo **no está en `covers:`**.

**Primeros secretos reales en un repo público.** Hasta hoy no había nada que
filtrar. Ahora hay URL de base de datos, credenciales de Google y clave del
proveedor de mail. FR-028 lo prohíbe; la guarda práctica es que la configuración
se lee sólo del entorno y que el servicio no arranca si falta.

**El punto guardado puede quedar viejo.** FR-019a guarda el punto ya ajustado.
El índice de calles tiene una deuda `High` abierta desde el 2026-08-04: sus
esquinas no tienen verificación automática, y una regeneración futura puede
moverlas. Un punto guardado en un perfil no se entera. No lo resuelve este plan
—FR-019b lo acota diciendo que el punto guardado no vale por estar guardado—,
pero conviene saber que la deuda ahora tiene un consumidor más.

**El agujero de fondo sigue abierto todo el feature.** El formulario no le llega
a nadie y el sitio es indexable desde `004`. Este plan no lo cierra y no
pretende hacerlo. Si el sitio se promociona a clientes reales antes de `007`,
eso deja de ser aceptable — y la alternativa registrada en el ADR (que el pedido
le llegue a Diego por mail) sigue siendo el plan de contingencia.

## Complexity Tracking

Sin violaciones de la constitución que justificar. La única tensión real es con
el Principio III, y está argumentada arriba: el feature suma infraestructura
porque un requisito declarado del cliente la exige, no por anticipación.
