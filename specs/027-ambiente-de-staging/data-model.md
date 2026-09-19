# Data Model: Un ambiente de staging

**Feature**: `027-ambiente-de-staging` | **Date**: 2026-09-13

## No hay entidades nuevas persistidas

Esta feature **no agrega ninguna tabla, ninguna columna y ninguna migración**.
El esquema de `backend/migrations/` se queda exactamente como está, en
`0009_comentario_del_pedido.sql`.

Lo que la feature duplica no es un modelo de datos, es **una instancia entera**
del que ya existe. La base de staging corre las mismas nueve migraciones,
aplicadas solas al arrancar por `backend/internal/db/migrate.go`, sobre una base
vacía.

Que no haya migración es una propiedad, no una omisión: si esta feature
necesitara tocar el esquema, tocaría también el de producción, y el ADR dice que
la base de producción no se toca.

## Las entidades del problema, que no son datos

Son las dos del spec, y viven en infraestructura y en documentación, no en
Postgres:

### Ambiente

Una instancia completa y aislada del producto corriendo: un servicio Go y una
base. Se identifica por nombre.

| Atributo | `production` | `staging` |
|---|---|---|
| Nombre | `production` | `staging` |
| Origen del código | GitHub, rama `master`, automático | subida manual desde la copia de trabajo |
| Base | la que usan los clientes | propia, arranca vacía |
| Web que le habla | el sitio publicado | `npm run dev` en la máquina de Mateo |
| Origen permitido | el del sitio publicado | `http://localhost:3000` |
| Administradores | los de hoy | sólo Mateo |
| Avisos push | activos | **ninguno**: sin credencial |
| Remitente de correo | el de hoy | distinto, para distinguirlo en la bandeja |

El nombre **no se escribe a mano en ningún lado**: sale de
`RAILWAY_ENVIRONMENT_NAME`, que la plataforma inyecta sola (verificado).

### Base de staging

El almacenamiento del ambiente de staging. **Desechable por definición**: su
contenido no tiene valor, no se respalda, y puede borrarse entero en cualquier
momento sin pérdida. Arranca vacía y nunca recibe una copia de producción.

Esa propiedad es la que hace que FR-017 se pueda aceptar: lo que hay detrás del
servicio expuesto a internet es una base que no importa.

## Lo único que cambia de forma: la respuesta de salud

No es una entidad persistida, es un contrato de salida. Está en
[`contracts/salud.md`](contracts/salud.md).
