# backend

El servicio HTTP de Flash Urbano. Go, sin framework, desplegado en Railway.

Lo crea el feature [`006-backend-auth`](../specs/006-backend-auth/plan.md), que
pone en efecto por primera vez el
[ADR backend-persistence-stack](../docs/decisions/backend-persistence-stack.md).

**No guarda pedidos.** Eso es `007`. Este servicio sabe *quien pide*, no *que
pide*.

## Que hay adentro

```text
cmd/api/          Arranque: configuracion, rutas, servidor
internal/config/  Lee el entorno. Falla al arrancar si falta algo
internal/db/      Conexion y aplicacion de migraciones
internal/usuarios/ Usuario y perfil: alta, lectura, edicion
internal/auth/    Google, codigo por mail, sesiones, limites
internal/rastro/  Registro de intentos de ingreso
internal/correo/  Envio del codigo. Interfaz + un proveedor
internal/httpx/   CORS por entorno, middleware de sesion, errores
migrations/       SQL versionado, solo hacia adelante
```

El corte es **por dominio**, no por capa: `usuarios`, `auth` y `rastro` son tres
cosas con reglas y ciclos de vida distintos, y un corte por capa (`models`,
`services`) las mezclaria. `internal/` impide que otro modulo importe estas
piezas.

## Variables de entorno

Ninguna vive en el arbol: **el repo es publico** (FR-028). La plantilla con los
nombres esta en [`.env.example`](.env.example); copiala a `.env` y completala.

**El servicio se niega a arrancar si falta una obligatoria.** Es deliberado: es
preferible que no levante a que levante a medias y falle en la primera request
de un cliente real.

| Variable | Obligatoria | Que es |
|---|---|---|
| `DATABASE_URL` | si | Conexion a Postgres. La provee Railway |
| `CORS_ORIGENES` | si | Origenes autorizados, separados por coma (FR-023) |
| `GOOGLE_CLIENT_ID` | si | Cliente OAuth. Se valida como destinatario del token |
| `CORREO_API_KEY` | si | Clave del proveedor de mail. Secreto real |
| `CORREO_REMITENTE` | si | Direccion desde la que sale el codigo |
| `ADMIN_EMAILS` | si | Administradores, separados por coma (FR-022) |
| `PORT` | no | Puerto de escucha. Railway lo inyecta. Por defecto `8080` |
| `SESION_DURACION` | no | Por defecto `672h` — cuatro semanas (FR-017) |
| `RASTRO_RETENCION` | no | Por defecto `2160h` — noventa dias (FR-022c) |

## Correrlo en local

Go 1.26+. Si `go version` no responde, la terminal es anterior a la instalacion
del toolchain — abrir una nueva. Ver
[`docs/processes/dev-setup.md`](../docs/processes/dev-setup.md).

Primero, un Postgres **con PostGIS**. El Postgres pelado no sirve: la migracion
`0001` hace `CREATE EXTENSION postgis`.

```bash
docker run -d --name flash-pg-dev \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=flash_dev \
  -p 55433:5432 postgis/postgis:17-3.5
```

Puerto `55433` a proposito, distinto del `55432` de la base de pruebas: **esa se
vacia entera** al correr los tests, y compartirla es perder los datos de
desarrollo cada vez que se verifica.

Despues, la configuracion y el arranque:

```bash
cd backend
cp .env.example .env    # y completar

# El servicio NO lee .env por si mismo: la configuracion sale del entorno y
# nada mas (FR-028). `set -a` exporta todo lo que se defina entre las dos
# lineas, que es lo que convierte el archivo en variables de entorno.
set -a; . ./.env; set +a

go run ./cmd/api
```

> **`go run ./cmd/api` a secas no arranca**, y el error —"faltan variables de
> entorno obligatorias"— parece un defecto del servicio y es la configuracion
> que nunca se cargo. No hay `godotenv` ni ningun lector de `.env` en el codigo,
> y es deliberado: una dependencia mas para algo que el shell ya hace.

Las opcionales pueden quedar vacias en el `.env`: una variable definida pero
vacia se trata como ausente y toma su valor por defecto.

Las migraciones se aplican **al arrancar** (research D7), asi que una base vacia
queda lista sin pasos manuales.

### Para probar el ingreso desde el sitio local

`CORS_ORIGENES` tiene que incluir `http://localhost:3000` — con esquema y
puerto, sin barra final. El de Railway **no lo tiene** y no deberia tenerlo: por
eso el sitio local se prueba contra un backend local y no contra el desplegado.

## Verificar

Es la primera mitad del `verify:` del plan:

```bash
go vet ./... && go test ./... -p 1 && go build ./...
```

### Las pruebas contra Postgres

**Sin `TEST_DATABASE_URL` se saltan solas**, y entonces "todo verde" no dice
nada sobre la base. Para que corran de verdad hace falta un Postgres **con
PostGIS**: el Postgres pelado no sirve, la migracion `0001` hace
`CREATE EXTENSION postgis`.

```bash
docker run -d --name flash-pg-test \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=flash_test \
  -p 55432:5432 postgis/postgis:17-3.5

TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable' \
  go test ./... -p 1
```

Con eso corren las 33 pruebas y no se saltea ninguna. La base es descartable:
`docker rm -f flash-pg-test` y listo. **Nunca apuntar `TEST_DATABASE_URL` a la
base de Railway** — la prueba de migraciones borra todas las tablas.

**El `-p 1` es obligatorio y no es preferencia.** Go corre los paquetes de
prueba en paralelo; todos comparten esta base, y la prueba de migraciones la
vacia entera para verificar que se migra desde cero (SC-011). Sin `-p 1` esa
prueba le saca el esquema de abajo a las de `usuarios` y `rastro` mientras
trabajan, y el resultado es una carrera que se lee como un defecto del codigo.

## Que NO va aca

- **Zonas y precios.** Siguen en el bundle del sitio y no se mudan a la base
  (FR-002). El precio se calcula en el navegador y no puede depender de que este
  servicio responda (FR-001).
- **El formulario de pedido.** No se toca en este feature (FR-007b).
