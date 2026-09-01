# Quickstart: Que Diego se entere del pedido cuando entra

Tres niveles, de menos a más caro. **El `verify:` en verde no prueba este
feature** (D7 de [`research.md`](research.md)): compila y corre pruebas de JVM, y
nada de lo que decide si el aviso llega es observable desde ahí. Los criterios
de éxito que importan se miden en los niveles 2 y 3.

**Dato medido el 2026-08-31**: los dos emuladores de esta máquina son
`google_apis_playstore` (`android-36` y `android-37.0`), así que **el nivel 2
recibe avisos de verdad**, no simulados. No hace falta el teléfono para saber si
esto funciona; hace falta para saber si funciona *en su Samsung*.

---

## Nivel 1 — Sin teléfono y sin emulador

### Q1. Las dos patas del `verify:` en verde

```bash
cd backend && go vet ./... && go test ./...
cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
```

**Mirá el conteo de `SKIP` en Go.** Las pruebas contra Postgres se saltean solas
sin `TEST_DATABASE_URL`, así que un verde sin base no dice nada de la migración
ni de la consulta de destinatarios:

```bash
export TEST_DATABASE_URL="postgres://...@localhost:5432/flash_test"
cd backend && go test ./... -count=1
```

### Q2. Romper el `COALESCE` a propósito y verlo en rojo

Es la prueba más importante del feature y la que se rompe más barato. Con la
prueba escrita, **sacá el `COALESCE(NULLIF(...))` del `UPDATE` de `Resolver`** y
corré de nuevo:

```bash
cd backend && go test ./internal/auth/ -run Push -count=1
```

Tiene que ponerse **roja**. Si sigue verde, la prueba no está mirando lo que
cree: una guarda que afirma que algo no pasa no vale nada hasta que se la ve
fallar cuando el defecto está puesto.

Lo que fija: una llamada **sin** la cabecera (el sitio web) **no borra** el token
que la app había anotado.

### Q3. El texto del aviso, contra lo prohibido

Prueba pura sobre el armado del mensaje, sin red:

- El título lleva el código; el cuerpo, **la calle de entrega sin número y sin
  esquina**.
- **No** aparecen: número de puerta, esquina, nombre ni teléfono de ninguna de
  las dos puntas, ni ningún importe (FR-005, Principio V).

Control positivo: armá un pedido de prueba cuyo `entrega_calle` contenga un
número y verificá que la prueba lo rechaza.

### Q4. Un pedido repetido no avisa dos veces

Dos `POST /pedidos` con **la misma** clave de idempotencia. El segundo devuelve
`200` y **no** dispara envío (FR-003). La prueba mira el contador del cliente de
avisos, no la respuesta HTTP.

### Q5. El servicio arranca sin la credencial

```bash
cd backend
unset FCM_CREDENCIAL   # o como se llame la variable que quede
go run ./cmd/api
curl -s localhost:8080/salud
```

Tiene que responder `{"estado":"ok","base":"ok"}` y haber dejado anotado que no
va a mandar avisos (FR-010). **Si no arranca, el feature está mal hecho**: un
servicio que se niega a levantar por una función accesoria ya nos tumbó
producción una vez.

### Q6. La migración sobre datos reales

Correr `0008` sobre una copia con filas de `sesiones` existentes. La columna
entra nullable: ninguna fila vieja falla, y las sesiones del sitio web quedan en
`NULL` para siempre, que es lo correcto.

---

## Nivel 2 — Emulador con Play Store contra el servicio local

```bash
emulator -avd Medium_Phone_API_36.0
cd backend && go run ./cmd/api
```

**Antes**: acordate del proceso huérfano — si el servicio ignora un cambio del
`.env`, es que el `go run` viejo sigue tomando el 8080 y el nuevo nunca arrancó.

### Q7. El permiso se pide y el silencio se ve

1. Instalá la app limpia. Tiene que aparecer el cartel del permiso.
2. Tocá **No permitir**. Abrí la app: tiene que decir que no va a recibir avisos
   y llevarte a los ajustes (FR-008, **SC-005**).
3. Concedelo desde ahí y volvé: el cartel **desaparece** y no queda ocupando
   pantalla.

### Q8. El aviso llega con la app cerrada

Con la app **cerrada** (deslizada de recientes, no sólo en segundo plano), creá
un pedido desde el sitio local. Tiene que aparecer el aviso solo.

Mirá el texto contra Q3: **código y calle, nada más** (**SC-009**).

### Q9. Tocarlo abre la lista en ese pedido

Un solo toque, sin pasos intermedios (**SC-003**, FR-004).

### Q10. Con la app abierta, la lista no se mueve sola

Con la app **abierta en la lista**, creá un pedido. Tiene que aparecer el
renglón *"1 pedido nuevo — tocá para actualizar"* y **la lista tiene que quedarse
quieta** hasta que lo toques (FR-016).

Probalo con el dedo apoyado sobre un pedido: lo que este requisito evita es que
Diego toque el pedido equivocado.

### Q11. Un token muerto se limpia

Guardá un `push_token` inventado en la fila de la sesión, creá un pedido, y
comprobá que el proveedor lo rechaza y que **la columna queda en `NULL`** sin
reintentos (FR-013).

### Q12. Cortar la sesión corta los avisos

Revocá la sesión a mano en la base —el procedimiento de teléfono perdido de
`app-repartidor.md`— y creá otro pedido. **No llega nada** (**SC-008**).

### Q13. El aviso viejo se descarta

Apagá la red del emulador, creá un pedido, y adelantá el reloj más de 24 horas
antes de devolverle la red. El aviso **no** llega; el pedido **sí** está en la
lista (FR-017).

---

## Nivel 3 — Los dos teléfonos

Hay **dos aparatos con sesión administradora**: el de Mateo y el de Diego. No son
intercambiables, y repartirse el trabajo entre los dos es lo que evita quedar
esperando a que Diego esté disponible:

- **El de Mateo** prueba todo lo que no depende del fabricante, **hoy y sin
  coordinar con nadie**: que el aviso llegue con la app cerrada, el toque, el
  texto, el renglón con la app abierta.
- **El de Diego** es el único que puede probar **lo suyo**: One UI durmiendo la
  app, y que el runbook le alcance a él para dejarlo configurado. Si el de Mateo
  no es Samsung, Q16 **no se puede dar por hecha** con él.

### Q14a. Los dos reciben el mismo pedido

Con las dos sesiones vivas al mismo tiempo, creá un pedido: **tiene que sonar en
los dos teléfonos** (**SC-010**, FR-018).

Después ensuciá el token de uno de los dos en la base y repetí: **el otro tiene
que recibir igual**. Es lo que prueba que un destinatario roto no corta el
recorrido — y es el caso que va a pasar de verdad, porque el teléfono de prueba
se reinstala seguido.

### Q14. Los dos gestos del Samsung

Siguiendo **sólo** `docs/processes/app-repartidor.md` (**SC-007**):

1. Conceder el permiso de notificaciones.
2. Dejar la app en **Apps que nunca duermen**.

Si el documento no alcanza para los dos, el documento está mal, no el teléfono.

### Q15. Tres pedidos seguidos, con el teléfono en el bolsillo

Con la app cerrada y el teléfono bloqueado, tres pedidos reales espaciados.
**Los tres avisan, en menos de dos minutos** (**SC-001**, **SC-002**, FR-002).

Y **tres pedidos tienen que dar tres avisos, ni uno más** (**SC-006**): la
prueba unitaria fija que un reintento con la misma clave de idempotencia no
duplica, pero que sobre pedidos reales seguidos no aparezca un aviso de más sólo
se ve acá.

**Se puede correr con el teléfono de Mateo el mismo día que se termina**, sin
esperar a nadie. SC-001 pide comprobarlo sobre un teléfono real y no sobre un
emulador; no pide que sea el de Diego.

### Q16. Una semana después, sin abrir la app — **sólo vale en el de Diego**

El caso que mata a los push en Samsung no se ve el primer día: se ve cuando el
sistema decide que la app no se usa. **Repetir Q15 después de varios días sin
tocarla, en el teléfono de Diego.** Si ahí falla, lo que falló es Q14, no el
código.

Correrla en el teléfono de Mateo **no la cierra**, salvo que sea Samsung con One
UI: es exactamente el comportamiento del fabricante lo que se está probando.

### Q17. **TUYA** — que el aviso le sirva de verdad

La pregunta que ninguna prueba contesta: leyendo sólo el aviso, sin desbloquear,
**¿sabe si le queda de paso?** Si la respuesta es "tengo que abrir igual", el
renglón está mal elegido y se corrige con lo que él diga — no agregando un campo
al formulario del cliente (FR-005).
