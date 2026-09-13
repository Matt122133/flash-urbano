# Contrato: `GET /salud`

**Feature**: `027-ambiente-de-staging` | **Date**: 2026-09-13

Es el único contrato que esta feature modifica. El cambio es **aditivo**: un
campo nuevo, ningún campo removido, ningún significado alterado.

## Hoy

`backend/cmd/api/main.go:272`. Dos campos:

```json
{ "estado": "ok", "base": "ok" }
```

Degradado, con `503`:

```json
{ "estado": "degradado", "base": "sin conexion" }
```

El endpoint es **público y sin autenticación**: lo consulta el chequeo de salud
de Railway, que llega sin cabecera `Origin` y por eso `internal/httpx/cors.go`
lo deja pasar.

## Después

Un campo más, en las dos respuestas:

```json
{ "estado": "ok", "base": "ok", "ambiente": "production" }
```

```json
{ "estado": "degradado", "base": "sin conexion", "ambiente": "staging" }
```

### Reglas del campo `ambiente`

1. **Siempre presente**, en la respuesta de `200` y en la de `503`. Saber a
   cuál se le está pegando importa **especialmente** cuando algo anda mal.
2. **El valor sale de `RAILWAY_ENVIRONMENT_NAME`**, que la plataforma inyecta
   sola. Verificado: en el servicio de producción vale `production`.
3. **Nunca puede impedir el arranque** (FR-022). Se lee con `os.Getenv` pelado
   y **después** del corte por variables faltantes de `config.Cargar`, igual
   que `FCM_CREDENCIAL_BASE64`. Sin valor, el campo dice `desconocido` y el
   servicio arranca normalmente — que es lo que pasa al correr el backend en la
   máquina de alguien.
4. **No es un secreto.** Nombrar el ambiente en un endpoint público no revela
   nada que no se deduzca del dominio.

### Qué NO dice este campo

**No dice qué versión del código está corriendo.** Un staging sin desplegar
hace tres semanas contesta `staging` igual (FR-023). La versión se averigua por
la fecha del último despliegue, no por acá.

## Compatibilidad

Aditivo y seguro:

- **La web** no consume `/salud`.
- **La app** no consume `/salud`.
- **El chequeo de salud de Railway** mira el código de estado, no el cuerpo.

Un cliente viejo que lea el JSON ignora el campo que no conoce. Es el mismo
razonamiento que dejó pasar el despliegue del servicio antes que la app en
`026`, y ahí se verificó contra la app real.

## Lo que hay que probar

- `200` con base viva: el cuerpo trae los tres campos.
- `503` con base caída: **también** trae `ambiente`.
- Sin `RAILWAY_ENVIRONMENT_NAME` en el entorno: el servicio **arranca** y el
  campo dice `desconocido`. Esta es la prueba que protege FR-022, y es la que
  importa: es la que fallaría si alguien la moviera a `obligatoria`.
