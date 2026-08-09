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

```bash
cd backend
cp .env.example .env    # y completar
go run ./cmd/api
```

Las migraciones se aplican **al arrancar** (research D7), asi que una base vacia
queda lista sin pasos manuales.

## Verificar

Es la primera mitad del `verify:` del plan:

```bash
go vet ./... && go test ./... && go build ./...
```

## Que NO va aca

- **Zonas y precios.** Siguen en el bundle del sitio y no se mudan a la base
  (FR-002). El precio se calcula en el navegador y no puede depender de que este
  servicio responda (FR-001).
- **El formulario de pedido.** No se toca en este feature (FR-007b).
