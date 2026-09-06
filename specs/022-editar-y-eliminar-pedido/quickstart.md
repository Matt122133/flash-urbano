# Quickstart: comprobar editar y dar de baja

## Prerequisitos

```bash
docker start flash-pg-dev flash-pg-test
cd backend && set -a; . ./.env; set +a && go run ./cmd/api
cd web && npm run dev
```

**Y para las pruebas**, la variable, o se saltean solas y todo queda en verde sin
haber tocado la base:

```bash
export TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable'
cd backend && go test ./... -p 1        # el -p 1 no es opcional
```

## 1. Corregir un pedido (US1)

En `/perfil`, abrir un pedido **pendiente** y tocar **Editar**. Comprobar:

1. El formulario viene **con los datos del pedido**, no vacio ni con los del
   perfil.
2. Se nota que se esta **editando** y no creando otro: el boton no dice
   confirmar un pedido nuevo.
3. Al guardar, **el codigo no cambia**. Es el que la persona anoto y el que puede
   estar impreso en una etiqueta de `020`.
4. La pantalla de exito **no dice "anota tu codigo"** sobre un codigo que ya
   tenia.

## 2. La tercera fuente de precarga — el paso que mas importa

**Es donde este feature se rompe sin verse.** Hacer esto **en este orden, en la
misma sesion**:

1. `/pedido?editar=<id-A>` — cargar, **sin guardar**.
2. Navegar a `/pedido?repetir=<id-B>`.
3. Guardar.

**Tiene que crear un pedido nuevo con los datos de B.** Si edita el pedido A, o
guarda los datos de A sobre B, las fuentes de precarga se estan mezclando — que
es la forma del defecto del 2026-08-14, con mas superficie.

Y al reves: entrar por `?repetir=`, despues por `?editar=`, y comprobar que la
segunda edita y no crea.

## 3. La cobertura se revalida (US1, FR-006)

Editar un pedido y **cambiar la entrega a una direccion fuera de zona**. Tiene
que comportarse igual que al crear: **no deja guardar** y encamina al contacto.
No puede heredar la admision del pedido original, y **nunca** ofrecer la zona mas
cercana.

## 4. Dar de baja (US2)

1. Tocar **Eliminar** en un pedido pendiente: **pide confirmacion**.
2. Confirmar: desaparece de *Mis pedidos*.
3. En la app de Diego, **Actualizar**: ya no esta.

## 5. La ventana cerrada (US3)

Con la app de Diego, **tomar** un pedido. Despues, en `/perfil` del cliente:

1. **No hay Editar ni Eliminar.**
2. **Se lee el motivo** — algo del tipo "Diego ya tomó este pedido". Un boton que
   desaparece sin explicacion es un producto que parece roto.

### La carrera (FR-012), que es el caso que no se da solo

Hay que provocarlo:

1. En el navegador, abrir `/pedido?editar=<id>` de un pedido pendiente. **No
   guardar.**
2. En la app de Diego, **tomar ese pedido**.
3. Volver al navegador y **guardar**.

**Tiene que rechazarlo y decirlo.** Lo que no puede pasar es que guarde —pisaria
un pedido ya en curso— ni que falle en silencio dejando a la persona creyendo que
guardo.

## 6. Los avisos a Diego (FR-009, FR-010)

Con el telefono de Diego —o el de Mateo con la app instalada— y el backend
alcanzable:

1. Editar un pedido pendiente → **llega un aviso** de que cambio.
2. Dar de baja otro → **llega un aviso** de la baja.
3. En los dos, leer el texto **en la pantalla bloqueada** y comprobar que **no
   dice ningun importe, ningun nombre, ningun telefono, ni el numero de puerta o
   la esquina** — lo mismo que exige el aviso de pedido nuevo.

## 7. Que la app no se rompa con un pedido que ya no esta (FR-014)

1. En la app, **Actualizar** para que la lista traiga un pedido pendiente.
2. Sin refrescar, dar de baja ese pedido **desde el sitio**.
3. En la app, tocar ese pedido e intentar tomarlo.

**Tiene que decir que ya no existe, con un texto legible**, y no quedar en una
pantalla rota. El camino ya existe en la app —cualquier error del servicio llega
como `DEL_SERVICIO` con el mensaje del servicio—, asi que **lo que se comprueba
aca es el texto**, no el mecanismo.

**Y no hay que reinstalar nada**: si hizo falta, algo se toco en la app que no
debia tocarse.

Cerrar el `npm run dev` y el `go run` al terminar.
