# Despliegue en Railway

Cómo está armado el backend en Railway, qué costó averiguar, y qué falta. Lo
levanta T019 del plan
[`006-backend-auth`](../../specs/006-backend-auth/plan.md).

**Ningún secreto vive acá.** El repo es público (FR-028): las credenciales
existen sólo dentro de Railway. Este documento nombra variables, no valores.

## Qué hay desplegado

Proyecto `sunny-healing` (`2cef0777-ae34-4d23-94c9-eadb278ad44a`), entorno
`production` (`af0bd840-d3aa-4717-a156-1e190a30742d`), plan **Hobby**.

| Servicio | ID | Qué es |
|---|---|---|
| `flash-urbano` | `61f3bbde-abc3-41c7-9bc8-2486a23e9282` | El servicio Go, desde GitHub |
| `postgis` | `f7618814-c973-4a1d-a838-c852876bafe0` | Postgres 17.5 + PostGIS 3.5 |

El API es público en **`https://flash-urbano-production.up.railway.app`**, con
el dominio generado por Railway apuntando al puerto `8080`. Todavía **no** está
detrás de `flashurbano.uy` — ver
[`dominio-y-dns.md`](dominio-y-dns.md).

### El servicio Go

- **Fuente**: repo `Matt122133/flash-urbano`, rama **`backend-auth`**.
  `master` no tiene el backend todavía, y la rama no se mergea hasta cerrar la
  Fase 4 del plan.
- **Root Directory**: **`backend`**. Sin eso el build corre sobre la raíz del
  repo, donde no hay `go.mod` ni `Dockerfile`, y falla con
  `directory .../backend does not exist`.
- **Build**: el [`Dockerfile`](../../backend/Dockerfile) del propio directorio.
- Las migraciones se aplican **al arrancar**, así que no hay paso manual: el
  log del primer despliegue dice `migracion aplicada: 0001_esquema_inicial.sql`.

### La base

Es una **imagen de Docker fijada a mano**, `postgis/postgis:17-3.5`, no la
plantilla PostGIS de Railway. La plantilla despliega `postgis/postgis:16-master`
—un build de la rama de desarrollo de PostGIS— y ponerle eso a una base de
producción no era aceptable. Ver *Trampas*, abajo, porque cambiarla después de
que arranque cuesta bastante más que fijarla al crearla.

El volumen (`/var/lib/postgresql/data`, con `PGDATA` en su subdirectorio
`pgdata`) es lo único con estado del proyecto entero.

`postgis` expone `DATABASE_PRIVATE_URL`, armada por referencia a sus propias
variables y apuntando a `postgis.railway.internal`. **El tráfico entre los dos
servicios no sale a internet**, y por eso la cadena lleva `sslmode=disable`.

## Variables del servicio Go

Todas obligatorias salvo aviso; el servicio **se niega a arrancar** si falta
alguna. Los nombres y qué significan están en
[`backend/README.md`](../../backend/README.md).

| Variable | Valor en producción | Estado |
|---|---|---|
| `DATABASE_URL` | `${{postgis.DATABASE_PRIVATE_URL}}` | ✅ real |
| `CORS_ORIGENES` | `https://matt122133.github.io` | ✅ real |
| `ADMIN_EMAILS` | la dirección de quien administra hoy | ✅ real |
| `GOOGLE_CLIENT_ID` | `PENDIENTE-fase-3` | ⚠️ **relleno** |
| `CORREO_API_KEY` | `PENDIENTE-fase-4` | ⚠️ **relleno** |
| `CORREO_REMITENTE` | `PENDIENTE-fase-4` | ⚠️ **relleno** |

Los tres rellenos son deliberados y **el valor es a propósito inválido**: el
servicio exige que estén definidas para arrancar, pero Google y el correo se
construyen en las Fases 3 y 4. Un valor con forma verosímil habría hecho creer
que el ingreso funciona; `PENDIENTE-fase-3` no engaña a nadie. **Reemplazarlos
es parte de esas fases, no un pendiente suelto.**

`CORS_ORIGENES` lleva **sólo el origen de Pages**. Cuando el sitio se mude a
`flashurbano.uy` hay que agregarlo acá — es configuración, no código (FR-023).

## Verificar que está vivo

```bash
curl -i https://flash-urbano-production.up.railway.app/salud
# {"estado":"ok","base":"ok"}   ← "base":"ok" es la base contestando, no un literal
```

El cruce de orígenes, del lado del servidor:

```bash
# Origen autorizado: 200 con el header de vuelta
curl -sD - -o /dev/null -H "Origin: https://matt122133.github.io" \
  https://flash-urbano-production.up.railway.app/salud | grep -i access-control

# Origen ajeno: 403 y ningún header permisivo
curl -s -H "Origin: https://evil.example" \
  https://flash-urbano-production.up.railway.app/salud
```

Los dos pasan al 2026-08-09. **Eso no cierra T023**, que pide el mismo pedido
**desde un navegador en el sitio publicado**: curl no ejecuta la política de
origen, la ejecuta el navegador.

## Trampas

Cuatro cosas que costaron averiguar y que se pagan de nuevo si se olvidan.

**El Postgres por defecto de Railway no trae PostGIS.** La migración `0001` hace
`CREATE EXTENSION postgis` y no arranca sin él. A un Postgres común no se le
puede agregar después: la extensión son binarios que la imagen no tiene.

**La plantilla PostGIS de Railway da `16-master`.** No es PostgreSQL 17 +
PostGIS 3.5, como parece prometer. Fijar la imagen a mano al crear el servicio.

**Cambiar la imagen de la base después de que arrancó es caro.** El `PGDATA` que
inicializó PostgreSQL 16 no lo puede leer el 17 (`database files are
incompatible with server`), así que hay que vaciar el volumen — y `railway
volume delete` es un **borrado diferido de 48 h**: el volumen queda
`isPendingDeletion` pero sigue montado, `volume detach` no lo suelta, y no se
puede agregar otro porque *ya hay uno montado*. La única salida rápida fue
borrar el servicio entero y rearmarlo. Si hay que cambiar la imagen, hacerlo
**antes** del primer arranque o asumir el rearmado.

**`railway redeploy` repite el despliegue viejo, no toma la configuración
nueva.** Reejecuta el `meta` congelado de aquel despliegue —incluidos su rama y
su `rootDirectory`—, así que después de tocar la fuente sigue construyendo lo
mismo y falla igual. Para forzar uno nuevo desde la rama conectada:

```bash
railway api --raw-var sid=<servicio> --raw-var eid=<entorno> \
  'mutation($sid: String!, $eid: String!) { serviceInstanceDeployV2(serviceId: $sid, environmentId: $eid) }'
```

## Notas de operación

`railway link` deja el enlace en el directorio; sin eso todo comando pide
`--service` explícito. En **Git Bash cualquier argumento que empiece con `/`
—`--mount-path /var/lib/...`, `PGDATA=/var/...`— se convierte en una ruta de
Windows** antes de llegar al CLI y el comando falla con un mensaje que no lo
explica. Correr esos desde PowerShell.

`railway setup agent` instala el MCP de Railway, pero **escribe en `.mcp.json`**,
que está versionado y fuera del `covers:` del plan activo: el sensor de
pre-commit rebota el commit. Con el CLI alcanza.

## Qué falta

- **T023**: el cruce de orígenes desde el navegador, en el sitio publicado.
  Necesita la variable de repositorio `NEXT_PUBLIC_API_URL` en GitHub apuntando
  al dominio de arriba (T022 ya la lee en el workflow).
- Las tres variables de relleno, en sus fases.
- El dominio propio delante del API.
