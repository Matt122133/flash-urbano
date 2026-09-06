# Quickstart: comprobar el orden

## 1. La base de pruebas, primero — sin esto no se prueba nada

```bash
docker start flash-pg-test    # o crearla, ver backend/README.md
export TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable'
```

**Puerto 55432, no 55433.** La de pruebas **se vacia entera** al correr los
tests; el 55433 es la de desarrollo y tiene los pedidos con los que se prueba a
mano.

## 2. Correr las pruebas, y mirar el conteo de salteadas

```bash
cd backend
go test ./internal/pedidos/ -run Orden -v
```

**Verde con `--- SKIP` no es verde.** Es la trampa que `AGENTS.md` marca primera:
las pruebas contra Postgres se saltean solas sin `TEST_DATABASE_URL` y dejan todo
en verde sin haber tocado la base. Si aparece un SKIP en la prueba de orden, la
variable no llego al proceso y **el feature esta sin verificar**.

```bash
go test ./... 2>&1 | grep -c SKIP    # que este en lo esperado, no en "mas que antes"
```

## 3. El control negativo del cambio

La prueba tiene que saber fallar:

```bash
# volver el ORDER BY a `retiro_fecha DESC, retiro_hora DESC`
go test ./internal/pedidos/ -run Orden     # tiene que quedar en ROJO
# restaurar
```

Si con el SQL viejo la prueba pasa igual, no esta probando el orden — lo mas
probable es que los pedidos de prueba se hayan creado con fechas de retiro que
**coinciden** con el orden de creacion, y entonces los dos criterios dan lo
mismo. Hay que desordenarlas a proposito.

## 4. Verlo en la app

Con el backend local levantado contra la base de **desarrollo** (55433, que tiene
pedidos de verdad):

```bash
cd backend
set -a; . ./.env; set +a
go run ./cmd/api
```

Abrir la app en el emulador o en el telefono, apuntada al backend local, y
**Actualizar**. Comprobar:

1. **En Pendientes, arriba esta el pedido mas viejo** — el que lleva mas tiempo
   esperando.
2. **Lo ultimo que entro esta al fondo.**
3. **Las tres pestañas siguen el mismo criterio**, Entregados incluida. Ahi lo
   ultimo entregado queda al fondo: **es lo decidido, no un defecto**.
4. **No hubo que reinstalar nada.** Si hizo falta, algo se toco en la app que no
   debia tocarse.

## 5. Que el cliente no se entere

En el sitio, `/perfil`: el historial del cliente tiene que seguir mostrando
**primero lo mas reciente**. Es la pantalla que este feature no toca, y la que
mas facil se arrastra: `PorUsuario()` vive a diez lineas de `Todos()`.
