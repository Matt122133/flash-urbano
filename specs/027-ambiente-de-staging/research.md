# Research: Un ambiente de staging

**Feature**: `027-ambiente-de-staging` | **Date**: 2026-09-13

Todo lo de acá se midió o se leyó en esta sesión. Lo que es extrapolación está
marcado como tal.

---

## D1 — Dos entornos, no dos schemas

**Decisión**: dos entornos de Railway, cada uno con su servicio Go y su propia
base Postgres+PostGIS.

**Rationale**: está entero en
[ADR separate-staging-environment](../../docs/decisions/separate-staging-environment.md).
Lo corto: la red privada de Railway está aislada por entorno, así que el
servicio de staging **no tiene ruta** a la base de producción. La alternativa
barata hacía colgar la separación de un `search_path`, y el modo de falla de un
`search_path` mal puesto es **silencioso** — Postgres acepta un schema
inexistente sin error y, con `public` en la lista, las consultas caen en
producción y funcionan.

**Alternatives considered**: dos schemas en una base (rechazada por lo
anterior, y porque habría obligado a mover PostGIS a un schema `extensions`,
o sea a tocar producción); dos bases en la misma instancia (mismo problema de
red privada, sin la ventaja de precio).

---

## D2 — El costo, medido

**Decisión**: se procede sin cambiar de plan.

**Rationale**: consulta a la API de Railway el 2026-09-13. Los valores vienen
sin unidad; se fijó anclando contra algo conocido — disco dio `333,57` en una
ventana de 24 h y el volumen tiene 233 MB usados, o sea
`333,57 / 1440 min = 0,2317 GB`. **La unidad es GB-minuto.**

| Medido (24 h) | Promedio | US$/mes |
|---|---|---|
| `postgis` RAM | 41 MB | 0,41 |
| `flash-urbano` RAM | 14 MB | 0,13 |
| Volumen | 233 MB | 0,04 |
| CPU (ambos) | ~0 | ~0,00 |
| **Total** | | **≈ 0,58** |

Plan Hobby: US$5/mes **con US$5 de uso incluido**. Duplicar suma ~US$0,55, o sea
~US$1,15 de US$5. Hobby no limita la cantidad de entornos.

**Caveat, y es importante**: es una extrapolación de 24 horas sobre un sistema
con muy poco tráfico. Es una estimación, no una factura. SC-005 pide volver a
medirla al cierre, no darla por buena.

---

## D3 — Dónde vive la guarda del cruce de cables

**Decisión**: una aserción **dentro del build**, no un paso sólo de CI.

**Rationale**: el hallazgo que lo decide es que
`.github/workflows/deploy-pages.yml:66` toma
`NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}` — una **variable de
repositorio de GitHub**. El valor con el que se compila producción **no está en
el repo**, así que ninguna prueba de `npm test` puede leerlo, y la forma más
obvia de cumplir FR-008 no existe.

Adentro del build sí se ve, y además:

- corre también en la máquina de Mateo, o sea entra al `verify:` del plan;
- el control positivo de FR-009 se puede ejercer localmente —poner
  `GITHUB_PAGES=true` con la URL equivocada y ver el rojo— sin desplegar nada.

**Por qué la guarda importa más de lo que parece**: `web/app/layout.tsx` deriva
el `connect-src` de la CSP **de la misma variable**. Un build cruzado queda
internamente coherente: la CSP autoriza exactamente el backend equivocado. **No
hay ningún síntoma que delate el error.** El sitio funcionaría, y los pedidos de
clientes reales entrarían a la base de prueba.

**Alternatives considered**: un paso en el workflow (vive sólo en CI, no entra
al `verify:`, y sólo se demuestra el día que falla de verdad); una prueba en
`npm test` (imposible, por lo de arriba).

**Precio asumido**, en FR-009a: el repo pasa a tener una opinión sobre cuál es
la URL correcta, y mudar de dominio pasa a incluir un cambio acá. `006` había
puesto esa URL fuera del repo justamente para evitarlo. No hay guarda sin esto.

---

## D4 — Cómo se engancha la guarda al build: el único riesgo técnico abierto

**Decisión**: la lógica va en un módulo puro `web/lib/`, y `web/next.config.ts`
lo llama cuando `GITHUB_PAGES === "true"`.

**Rationale**: `next.config.ts` ya lee esa bandera (`const isPages =
process.env.GITHUB_PAGES === "true"`), así que el punto de enganche existe. Un
módulo puro en `web/lib/` es además la forma que el repo ya usa para lo probable:
`vitest.config.ts` corre en `node` con `include: ["lib/**/*.test.ts"]`.

**RESUELTO el 2026-09-13 (T002): el import funciona.** Next 16.2.12 compila la
config a `next.config.compiled.js` con el módulo importado adentro — se vio en
el rastro del error del control positivo. Las tres corridas dieron lo esperado:
publicación con la URL de producción compila, publicación con otra URL **falla
con salida 1**, y sin `GITHUB_PAGES` cualquier URL compila. La doc del repo
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/index.md`)
lo respalda: la config es "a regular Node.js module" usado en las fases de build
y de servidor.

**La salida no se necesitó**: mover la invocación al script `build` de
`web/package.json`. `web/package.json` se deja igual en el `covers:` — quitarlo
ahora no gana nada y lo dejaría sin autorizar si el enganche tuviera que
moverse.

**Lo que el spike enseñó y no estaba previsto**: el build local **ya carga
`web/.env.local`** (lo dice: `Environments: .env.local`). O sea que apuntar la
web local a staging cambia también lo que ve `npm run build`, no sólo
`npm run dev`. Es exactamente el caso que FR-008a protege, y ahora está
comprobado y no supuesto.

**Lo que la guarda NO debe hacer**: fallar en desarrollo. Apuntar la web local a
staging es el uso normal de esta feature (FR-011, FR-008a). Sin
`GITHUB_PAGES=true` la guarda es inerte.

---

## D5 — El campo `ambiente` en `/salud`

**Decisión**: `/salud` suma un campo que nombra el ambiente, leído de
`RAILWAY_ENVIRONMENT_NAME`.

**Rationale**: verificado con el CLI — Railway ya inyecta
`RAILWAY_ENVIRONMENT_NAME=production` en el servicio, **sin que nadie la
configure**. En el entorno de staging va a valer `staging`. O sea que el campo
sale gratis y no hay una variable nueva que alguien tenga que acordarse de
poner.

Hoy `backend/cmd/api/main.go:272` devuelve sólo `{estado, base}`.

**La trampa, y es FR-022**: si se leyera con `obligatoria(...)` en
`config.Cargar`, su ausencia impediría el arranque — y dejar producción sin
arrancar por una variable de más ya pasó en este proyecto. Se lee con
`os.Getenv` pelado **después del corte por faltantes**, con un valor por
defecto, exactamente como ya se hace con `FCM_CREDENCIAL_BASE64`
(`config.go`, con el comentario que explica por qué). El patrón existe; se
copia, no se inventa.

**Lo que este campo NO resuelve (FR-023)**: dice *a cuál le estoy pegando*, no
*si el código es el mío*. Un staging sin desplegar hace tres semanas contesta
`staging` con total tranquilidad.

---

## D6 — Saber qué versión corre en staging

**Decisión**: disciplina —desplegar justo antes de probar— más una comprobación
externa: leer con el CLI la fecha del último despliegue de staging.

**Rationale**: producción está conectada a GitHub, así que su despliegue trae
`commitHash`, rama y mensaje; se leyeron en esta sesión. **Un `railway up` sube
un tarball, no un commit**, así que el despliegue de staging no va a tener
ninguna de esas tres cosas. No hay commit que mostrar.

Exponer una versión desde el servicio se evaluó y se dejó afuera: para una
subida manual, quien estampa la versión sigue siendo la persona, así que la
disciplina no desaparece y el código sí aparece.

**Alternatives considered**: sólo disciplina (satisface FR-020 de palabra);
estampar la versión en el servicio (código, y no elimina la disciplina).

---

## D7 — El correo de staging

**Decisión**: correo real, mismo camino que producción, con `CORREO_REMITENTE`
distinto.

**Rationale**: `backend/cmd/api/main.go:100` cablea
`correo.NuevoResend(cfg.CorreoAPIKey, cfg.CorreoRemitente)` sin ninguna llave
que lo desactive, aunque `backend/internal/correo/falso.go` ya existe. Meter un
interruptor de entorno habría bifurcado **el camino de autenticación**, que es
lo más sensible que tiene el servicio, y habría hecho que staging dejara de
probar el camino real.

**El riesgo que esto crea, y es FR-016a**: Resend exige remitentes verificados.
Un remitente rechazado deja staging **sin forma de entrar**, y el fallo no
aparece hasta el primer intento de ingreso. Hay que comprobarlo mandando y
recibiendo un código, no configurándolo y suponiendo.

**Asunción**, no verificada, barata de corregir si es falsa: staging reutiliza
la misma `CORREO_API_KEY` y el mismo dominio verificado, cambiando sólo la
dirección del remitente. Si el dominio no estuviera verificado para esa
dirección, la salida es usar otra dirección del mismo dominio.

---

## D8 — Google OAuth no se toca

**Decisión**: staging usa el mismo `GOOGLE_CLIENT_ID`.

**Rationale**: `localhost:3000` ya es origen autorizado, y la web de staging
corre local. `CORS_ORIGENES` del servicio de staging lleva `http://localhost:3000`
y nada más.

---

## D9 — Apuntar la web local: ya está resuelto

**Decisión**: no se construye nada para FR-011.

**Rationale**: `web/.env.local` **ya existe** y está cubierto por
`web/.gitignore` (`.env*`). Apuntar la web local a staging o a producción es
editar una línea de ese archivo.

**Cuidado en la ejecución**: ese archivo **no está versionado**. Si se pisa, no
hay de dónde traerlo. Se lee antes de escribirlo.

---

## D10 — La app no necesita cambios

**Decisión**: FR-012 se satisface con lo que ya hay.

**Rationale**: la app acepta `-PurlDeDebug=<url>`. Contra staging se compila con
esa bandera y se corre **en un emulador**. Nunca `installDebug` contra un
teléfono: el `applicationId` es el mismo en debug y en release y el release se
firma con la misma clave, así que la instalación **pisa la app de producción en
silencio**. Con dos dispositivos conectados, además, `installDebug` instala en
los dos; se usa `adb -s <serie> install`.

Por eso el `verify:` de este plan **no lleva la pata de Android**: no se toca una
línea de `android/`.

---

## D11 — La fuente es del servicio, no del entorno (descubierto ejecutando)

**Decision**: staging tiene un **servicio propio**, `flash-urbano-staging`, y no
la instancia duplicada de `flash-urbano`.

**Rationale**: no estaba previsto y costo un incidente. `railway environment new
staging --duplicate production` **reusa el mismo servicio** — el id
`61f3bbde-...` aparece en los dos entornos— y en Railway **la fuente de codigo
cuelga del servicio, no de la instancia por entorno**. Comprobado en las dos
direcciones el 2026-09-13:

- `railway service source disconnect --service flash-urbano --environment staging`
  dejo **los dos** entornos sin repo. El flag `--environment` esta documentado
  como "Environment to use for **resolving** the service": elige el servicio, no
  acota el cambio.
- `railway service source connect ... --environment production` volvio a
  conectar **los dos**.

Consecuencias, y la segunda es la grave:

1. **FR-019 es imposible sobre el servicio duplicado.** Staging no puede estar
   desconectado mientras produccion esta conectado.
2. **Un `railway up` contra staging le habria cambiado la fuente a produccion**,
   dejandola apuntando a un tarball subido a mano en vez de a GitHub. No se
   probo, y no se va a probar.

**La forma que si sirve**: `railway add --service flash-urbano-staging` crea un
servicio nuevo con id propio —y por lo tanto fuente propia— **solo en el
entorno vinculado**, no en todos. Se despliega con
`railway up ./backend --path-as-root --service flash-urbano-staging`, que sube
el contenido de `backend/` como raiz del archivo, con lo cual Railway encuentra
el `Dockerfile` sin necesidad de configurar Root Directory.

**Lo que SI se separa por entorno**: las variables. Verificado leyendo los dos
lados despues de escribir en staging — produccion conservo sus origenes, sus
administradores y su remitente. La regla precisa es: **variables por entorno,
fuente por servicio.**

**Lo que costo**: produccion quedo unos minutos sin auto-despliegue en push a
`master`. No se cayo, no se desplegio nada distinto y no se perdio nada; el
commit activo siguio siendo `c6533373`. Se restauro con
`service source connect` y se verifico repo, rama, root directory y builder.

**La leccion, que vale mas que el hallazgo**: en este CLI un `--environment` en
un comando de escritura **no garantiza** que el cambio sea de ese entorno. Antes
de correr uno contra un recurso que produccion comparte, hay que comprobar el
alcance — o hacerlo desde el panel, donde se ve que se va a tocar.
