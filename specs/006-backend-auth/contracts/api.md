# Contrato del API — 006 backend auth

Siete endpoints. Todo JSON. El sitio y el servicio viven en orígenes distintos,
así que **cada punto de este contrato cruza CORS**.

## Reglas que valen para todos

**La credencial va en un header, nunca en una cookie.** El navegador manda
`Authorization: Bearer <token>`. Es la decisión del ADR que esquiva el bloqueo
de cookies entre orígenes, y es lo que hace que el login no se rompa en Safari
de iPhone.

**Los orígenes permitidos salen del entorno** (FR-023, FR-025). El servicio
rechaza lo que venga de otro lado. Mover el sitio a `flashurbano.uy` es agregar
un valor a una variable, no tocar código.

**Los errores no filtran.** Nunca dicen si una dirección de mail está
registrada, ni distinguen "código incorrecto" de "código vencido" hacia afuera
(FR-014). Esa distinción existe, pero vive en el rastro, que sólo se lee del
lado del servidor.

**Ningún endpoint devuelve el código ni la credencial de otro usuario.**

**Los tipos de Go y TypeScript se sincronizan a mano.** El ADR lo decidió así
para una superficie de este tamaño; si pasa de unas veinte operaciones,
corresponde revisarlo.

---

## `GET /salud`

Sin credencial. Responde que el servicio está vivo y que la base contesta. Es lo
primero que se construye y lo que se usa para probar el cruce de orígenes antes
de que exista login que culpar.

---

## `POST /auth/google`

**Cuerpo**: el token de identidad que Google le dio al navegador.

El servicio verifica firma, destinatario, emisor, vencimiento y
`email_verified`. Si la dirección no está verificada del lado de Google,
rechaza (FR-007).

Crea el usuario si no existe, sin aprobación de nadie (FR-006). Emite una sesión.

**Devuelve**: la credencial, cuándo vence, y el usuario — incluido
`perfilCompleto`, que le dice al sitio si tiene que pedir nombre y teléfono
antes de seguir (FR-021a). Con Google el nombre viene precargado (FR-021).

---

## `POST /auth/codigo`

**Cuerpo**: una dirección de mail.

Genera un código de seis dígitos, lo manda por mail, y lo guarda hasheado con
hashing lento (FR-008, FR-012). Diez minutos de validez (FR-009).

**Responde siempre lo mismo**, exista o no esa dirección como usuario (FR-014).
Si el límite de frecuencia está excedido, también responde lo mismo: decir "vas
muy rápido" a una dirección y "listo" a otra ya revela cuál existe.

Los límites son por dirección **y** por origen de conexión (FR-013).

---

## `POST /auth/codigo/verificar`

**Cuerpo**: la dirección y el código.

Rechaza si el código venció, si ya se usó, o si el contador de intentos llegó a
cinco (FR-009, FR-010, FR-011). Cada fallo incrementa el contador; al quinto el
código queda muerto **aunque el sexto intento traiga el valor correcto**.

En éxito: marca el código como usado, crea el usuario si no existe, emite sesión.

**Devuelve** lo mismo que `/auth/google`. Un usuario nuevo por esta vía llega con
`perfilCompleto: false` y sin nombre, porque el código sólo prueba la dirección.

Hacia afuera, un código incorrecto y uno vencido dan la misma respuesta.

---

## `POST /auth/salir`

Con credencial. Revoca **esa** sesión, de inmediato (FR-018). Las otras sesiones
del mismo usuario siguen vivas: cerrar sesión en el teléfono no cierra la de la
computadora.

Reusar la credencial revocada falla. Es SC-007, y se prueba a mano.

---

## `GET /yo`

Con credencial. Devuelve el usuario que la credencial identifica: nombre,
teléfono, `perfilCompleto`, la dirección de retiro guardada si la hay, y si es
administrador.

**`esAdmin` se calcula comparando el mail contra la configuración del entorno**
(FR-022). No sale de una columna, y no hay forma de volverse administrador desde
el sitio.

---

## `PUT /yo`

Con credencial. Actualiza nombre, teléfono y —opcionalmente— la dirección de
retiro con la forma del formulario: calle, esquina, número y punto (FR-019a).

Es también el endpoint que **completa el alta**: el sitio lo llama con nombre y
teléfono cuando `perfilCompleto` viene en `false`. No hace falta un endpoint
aparte para eso; es el mismo dato.

Un usuario sólo puede tocar lo suyo (FR-020). La credencial dice quién es: el
identificador del usuario **no se lee del cuerpo del pedido**, porque entonces
cualquiera podría mandar el de otro. Es SC-010 y se prueba con una sesión ajena.

La dirección se guarda **sin darla por válida** (FR-019b). Que el punto caiga
dentro de la cuadra declarada se verifica al cobrar, y eso es `007`.

---

## Lo que este contrato no tiene

Nada de pedidos: ni crear, ni listar, ni estados, ni precio. `007` y `008`.

**Y `/pedido` en el sitio no llama a ninguno de estos endpoints** (FR-007b).
Sigue muriendo en la pantalla de resumen.
