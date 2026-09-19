---
owner: flash-urbano
status: living
last_reviewed: 2026-09-13
update_trigger: on-staging-change
---

# El ambiente de staging

Un segundo lugar donde el producto corre completo, con su propia base, para
**probar sin ensuciar producción**. Lo levantó
[`027-ambiente-de-staging`](../../specs/027-ambiente-de-staging/plan.md); el
porqué de la forma está en
[ADR separate-staging-environment](../decisions/separate-staging-environment.md).

**Ningún secreto vive acá.** El repo es público: este documento nombra
variables, no valores.

## La regla

**Todo desarrollo se prueba primero en staging, y después pasa a producción.**
Decidido el 2026-09-13, apenas el ambiente existió.

Las excepciones son reales y tienen nombre: **un hotfix** de algo que está roto
en producción ahora mismo, y **lo que sólo se puede ver en producción** — sus
datos, su dominio, su escala. Tomar una es una decisión, no un descuido: se dice
cuál aplica y por qué, en el PR o en el plan.

Lo que **no** es una excepción es "el cambio es chico". Todos los defectos
silenciosos que juntó este repo parecían chicos.

Está también como gate en [`AGENTS.md`](../../AGENTS.md) y su copia `CLAUDE.md`,
que es lo que un agente lee al arrancar.

## Para qué es, y para qué no

Es **para Mateo**, para poder crear pedidos y probar cambios contra un backend
real. No es un ambiente de demo para el cliente, ni una preview para nadie más.
Eso fija todo lo demás: no tiene alta disponibilidad, no tiene control de acceso
propio, y su base se puede borrar entera sin pensarlo.

Existe porque hasta el 2026-09-13 **no había otro lado donde probar**, y la base
de producción hubo que limpiarla a mano de pedidos de prueba dos veces en
septiembre.

## Qué hay

Proyecto `sunny-healing` (`2cef0777-ae34-4d23-94c9-eadb278ad44a`), **dos
entornos**:

| Entorno | Servicio Go | Base | Se despliega |
|---|---|---|---|
| `production` (`af0bd840-…`) | `flash-urbano` (`61f3bbde-…`) | `postgis` | solo, en cada push a `master` |
| `staging` (`ba3b7879-…`) | `flash-urbano-staging` (`6f34f11b-…`) | `postgis` propio | **a mano**, con `railway up` |

- API de staging: **`https://flash-urbano-staging-staging.up.railway.app`**
- **La web de staging no está desplegada**: corre local. Un repo es un sitio en
  Pages, y `localhost:3000` ya es origen autorizado en Google OAuth.

Diferencias de configuración de staging respecto de producción:

| Variable | En staging |
|---|---|
| `CORS_ORIGENES` | `http://localhost:3000` y nada más |
| `ADMIN_EMAILS` | solo la cuenta de Mateo |
| `CORREO_REMITENTE` | distinto, para reconocer el mail de un vistazo |
| `FCM_CREDENCIAL_BASE64` | **no existe** — staging no puede hacer sonar el teléfono de Diego |

Las demás son iguales, incluida la clave del proveedor de correo: el dominio
verificado es el mismo.

## Apuntar la web local

`web/.env.local` tiene las tres opciones y **una sola sin comentar**. Cambiar de
ambiente es mover el `#`:

```bash
NEXT_PUBLIC_API_URL=https://flash-urbano-staging-staging.up.railway.app
#NEXT_PUBLIC_API_URL=https://flash-urbano-production.up.railway.app
#NEXT_PUBLIC_API_URL=http://localhost:8080
```

Después `cd web && npm run dev`.

**Ese archivo no está versionado.** Si se pisa, no hay de dónde traerlo: leerlo
antes de escribirlo.

**El build local también lo carga** (`npm run build` dice
`Environments: .env.local`), no sólo `npm run dev`. Por eso la guarda de
`web/lib/url-del-api.ts` no se queja mientras no se esté publicando: apuntar a
staging es el uso normal.

## Desplegar a staging

Desde la raíz del repo, con la rama que quieras en el árbol de trabajo:

```bash
railway up ./backend --path-as-root --service flash-urbano-staging --environment staging --detach
```

Sube el contenido de `backend/` como raíz del archivo, con lo cual Railway
encuentra el `Dockerfile` sin necesidad de configurar Root Directory. Respeta
`.gitignore`, así que **el `.env` local no se sube**.

Sube **lo que tenés en el árbol**, esté commiteado o no. Eso es lo que permite
ver un cambio corriendo antes de mergearlo.

## Saber qué está corriendo en staging

Dos preguntas distintas, y conviene no confundirlas.

**"¿A cuál le estoy pegando?"** — lo dice el servicio:

```bash
curl -s https://flash-urbano-staging-staging.up.railway.app/salud
# {"estado":"ok","base":"ok","ambiente":"staging"}
```

**"¿Es mi código el que corre?"** — eso el campo `ambiente` **no** lo dice. Un
staging sin desplegar hace tres semanas contesta `staging` con total
tranquilidad. Lo que responde esa pregunta es la fecha del último despliegue:

```bash
railway deployment list --service flash-urbano-staging --environment staging --json
```

Si el `SUCCESS` de arriba es de hace un momento, es tuyo.

**Trampa**: cambiar una variable dispara un redespliegue que **reusa el último
código subido**. O sea que la fecha puede ser reciente sin que hayas subido nada
nuevo. Ante la duda, volvé a hacer `railway up`: cuesta un minuto y elimina la
pregunta.

La costumbre que evita todo esto: **desplegar justo antes de probar**.

## La app contra staging

```bash
cd android
.\gradlew.bat assembleDebug -PurlDeDebug=https://flash-urbano-staging-staging.up.railway.app
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
```

**Sólo emulador, y siempre con `-s`.** El APK de debug tiene el **mismo
`applicationId` y la misma firma** que el de producción, así que instalarlo en
un teléfono **reemplaza la app real en silencio** y la deja apuntando a staging.
No existe "instalarla al lado": para Android es la misma app. Y `installDebug`
con dos dispositivos conectados instala en los dos.

Antes de instalar nada, `adb devices` y comprobar qué hay enchufado.

Para verificar que la URL entró de verdad, sin suponerlo:

```bash
grep BASE_URL android/app/build/generated/source/buildConfig/debug/uy/flashurbano/repartidor/BuildConfig.java
```

**Tener las dos apps conviviendo en un teléfono sí se puede**, con un
`applicationIdSuffix` para el build de debug. Es trabajo y está anotado en el
[tracker de deuda](../tech-debt-tracker.md).

## Volver a producción

1. Mover el `#` en `web/.env.local`.
2. Reiniciar `npm run dev` — la variable se lee al arrancar.
3. Comprobarlo con `/salud`: producción **no** trae el campo `ambiente` hasta que
   `027` se mergee, y después dirá `production`.

## Dos trampas que costaron caro

### La fuente es del servicio; las variables son del entorno

En Railway **las variables se separan por entorno, pero la fuente de código
no**: cuelga del servicio. Un entorno duplicado con
`railway environment new --duplicate` **reusa el mismo servicio**, y entonces:

```bash
# ESTO desconecta produccion tambien, aunque diga --environment staging
railway service source disconnect --service flash-urbano --environment staging
```

El `--environment` de esos comandos **resuelve** el servicio, no acota el
cambio. Pasó el 2026-09-13 y dejó producción sin auto-despliegue hasta que se
restauró.

Por eso staging tiene un **servicio propio** y no la instancia duplicada. Y por
eso, ante cualquier comando de escritura sobre un recurso que producción
comparte: comprobar el alcance primero, o hacerlo desde el panel, donde se ve
qué se va a tocar antes de confirmar.

### `railway environment config --json` imprime los secretos resueltos

`railway variables --kv` se puede filtrar; `environment config` no, y vuelca
claves de API y contraseñas en la terminal. **No usarlo para mirar
configuración.** Para leer una variable sin exponer las demás:

```bash
railway variables --service <svc> --environment <env> --kv | Select-String '^ADMIN_EMAILS='
```

## Qué NO hacer

- **No copiar datos de producción a staging.** El repo es público y su historial
  no se borra; una copia pone datos de clientes reales en un segundo lugar. La
  base de staging arranca vacía y las migraciones la llenan solas al arrancar.
- **No cargar `FCM_CREDENCIAL_BASE64` en staging.** Es lo único que impide que
  una prueba le haga sonar el teléfono a Diego.
- **No instalar el APK de staging en un teléfono.**
- **No conectar el servicio de staging al repositorio.** Se despliega a mano; es
  lo que permite probar antes de mergear.

## Si el sitio muda de dominio

Desde `027` el repo tiene una opinión sobre cuál es el backend de producción:
la constante `URL_DEL_API_DE_PRODUCCION` en `web/lib/url-del-api.ts`. La guarda
del build **rechaza publicar el sitio contra cualquier otra URL**.

**Mudar el dominio ahora incluye cambiar esa constante**, además de la variable
de repositorio `NEXT_PUBLIC_API_URL`. Si no, el build de Pages falla con un
mensaje que nombra las dos URLs. `006` había dejado esa URL fuera del repo
justamente para que mudarse no fuera tocar código; eso cambió, y es el precio de
tener una guarda — sin ella, publicar el sitio apuntado a staging **no da
ningún síntoma**.

## Cuánto cuesta

Medido el 2026-09-13 sobre una hora con los dos ambientes andando: **≈ US$1,48
al mes**, contra los **US$5 de uso incluidos** en el plan Hobby. Es una
estimación alta: esa hora tuvo builds y despliegues.

El desglose y el método —los valores de la API de Railway vienen en
**GB-minuto**, y se fijó anclando contra el tamaño conocido del volumen— está en
[`research.md`](../../specs/027-ambiente-de-staging/research.md), D2 y D11.
