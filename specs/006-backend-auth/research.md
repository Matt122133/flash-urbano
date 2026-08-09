# Research — 006 backend auth

Decisiones técnicas que el spec deja abiertas a propósito y que el plan cierra
antes de que empiece la implementación. El ADR ya fijó lenguaje, hosting, motor
de base y la forma general de la auth; nada de eso se rediscute acá.

Cada decisión sigue el mismo formato: qué se eligió, por qué, y qué se descartó.

---

## D1 — La credencial de sesión es un token opaco, no un JWT

**Decisión**: un valor aleatorio sin significado, generado con fuente
criptográficamente segura, guardado **hasheado** en la base. Cada request lo
presenta y el servicio lo busca.

**Por qué**: FR-018 exige que cerrar sesión invalide la credencial **de
inmediato, también para quien la haya copiado**. Un JWT es válido hasta que
vence porque su verificación no consulta nada — para revocarlo hay que mantener
una lista de revocados, que es exactamente la consulta a la base que el JWT
venía a evitar. Se paga la complejidad y no se gana nada.

El argumento habitual a favor del JWT es no golpear la base en cada request. A
este volumen —el ADR estimó ~16.000 requests por mes, uno cada tres minutos— ese
ahorro no existe.

Se guarda hasheado por la misma razón que el código: quien lea la base no debe
poder hacerse pasar por un usuario. Acá alcanza con un hash rápido, porque el
token tiene entropía suficiente para que la fuerza bruta no sea un camino.

**Descartado**: JWT con lista de revocados. Sesiones en memoria del proceso
(Railway reinicia el servicio y se caen todas las sesiones).

---

## D2 — El código de seis dígitos se guarda con hashing lento, no con SHA-256

**Decisión**: hashing deliberadamente costoso (bcrypt o Argon2), no un digest
rápido.

**Por qué**: es la decisión de seguridad menos obvia de todo el feature y la más
fácil de equivocar. **Un código de seis dígitos tiene un millón de valores
posibles.** Si la base se filtra y los códigos están con SHA-256, calcular el
millón de digests y darlos vuelta es cuestión de segundos: el hash no protege
nada. Un hash lento hace que ese ataque cueste horas por código, y como el
código vive diez minutos, para entonces ya no sirve.

Es la diferencia entre "guardado hasheado" como fórmula y como propiedad real.

**Descartado**: SHA-256 con sal, por lo anterior. Guardar el código en claro,
que contradice FR-012.

---

## D3 — Google se verifica con un token de identidad, sin flujo de redirección

**Decisión**: el sitio usa Google Identity Services para obtener un token de
identidad en el navegador y se lo manda al servicio. El servicio verifica firma
contra las claves públicas de Google, destinatario, emisor, vencimiento y
`email_verified`.

**Por qué**: el flujo clásico de OAuth con redirección devuelve al usuario a una
URL de retorno, y esa URL es justamente lo que cambia cuando el sitio se mude a
`flashurbano.uy`. El flujo con token de identidad no redirige a ningún lado:
sucede dentro de la página. Con la arquitectura partida en dos orígenes, es
menos superficie donde equivocarse.

`email_verified` no es opcional: FR-007 dice que una dirección que Google no da
por verificada no sirve como identidad, y sin ese chequeo cualquiera que pueda
crear una cuenta de Google con una dirección ajena entra como esa persona.

**Descartado**: OAuth con redirección y `state`, por lo anterior. Confiar en lo
que el navegador afirme sin verificar la firma del lado del servidor, que sería
dejar la identidad en manos del cliente.

---

## D4 — La credencial vive en el almacenamiento local del navegador, con CSP estricta

**Decisión**: `localStorage`, y una Content Security Policy estricta en el sitio.

**Por qué**: es la consecuencia incómoda de D1 y del ADR, y conviene escribirla
en vez de que aparezca sola. Al no usar cookies —decisión del ADR para esquivar
el bloqueo de cookies entre orígenes, sobre todo en Safari— la credencial tiene
que guardarla el código de la página, y eso significa que un XSS puede leerla.
Una cookie `HttpOnly` no se podría leer, pero es exactamente lo que no funciona
de forma confiable cruzando orígenes.

Lo que hace el riesgo aceptable en **este** sitio: es un export estático, sin
contenido de terceros, sin comentarios ni nada que un usuario pueda inyectar, y
la sesión se puede revocar de inmediato (D1). Sumar una CSP estricta cierra el
vector más probable.

**Descartado**: cookie `SameSite=None; Secure`, que es lo que el ADR ya rechazó.
Guardar la credencial sólo en memoria, que obligaría a reingresar en cada
recarga y contradice FR-017.

---

## D5 — HTTP con la biblioteca estándar, sin framework

**Decisión**: `net/http` y el `ServeMux` con patrones por método que Go trae
desde 1.22.

**Por qué**: son alrededor de ocho endpoints. El Principio III de la
constitución pide la pila más simple que satisfaga el requisito, y desde 1.22 la
estándar hace ruteo por método y por parámetro de camino, que es todo lo que
hace falta acá. Un framework agrega una dependencia, una convención propia y una
versión que mantener, a cambio de nada medible a esta escala.

**Descartado**: los frameworks HTTP habituales de Go. Ninguno resuelve un
problema que tengamos.

---

## D6 — Los límites de frecuencia se llevan en Postgres, no en Redis

**Decisión**: contadores por dirección de mail y por origen de conexión en la
misma base, con ventana de tiempo.

**Por qué**: Redis es la respuesta correcta cuando el volumen justifica no tocar
la base. Acá el volumen es de un pedido de código cada varios minutos en el peor
caso. Sumar un segundo servicio a mantener, desplegar y pagar para contar eso
sería infraestructura anticipada, que es lo que el Principio III prohíbe.

**De dónde sale "el origen de la conexión"**: de `X-Forwarded-For`, **no** de
`RemoteAddr`. Railway pone un proxy adelante del servicio, así que `RemoteAddr`
es la dirección del proxy y es **la misma para todo el mundo**. Contar por ahí
convierte un límite por origen en un límite global: el primero que pida diez
códigos deja a todos los demás afuera. Es un modo de falla que no se ve en local
—donde no hay proxy y `RemoteAddr` es correcto— y que aparece recién en
producción, contra usuarios reales.

La dirección a usar es la **última** que el proxy de confianza agregó al
encabezado, no la primera: el cliente puede mandar un `X-Forwarded-For` inventado
y esas entradas quedan a la izquierda. Confiar en la primera es dejar que
cualquiera se saltee el límite cambiando una cadena.

El mismo valor es el que va a `rastro_ingresos.origen`, con la misma salvedad.

**Descartado**: Redis. Contadores en memoria del proceso, que se pierden al
reiniciar y no sirven si algún día hay más de una instancia. `RemoteAddr` a
secas, por lo anterior.

---

## D7 — Migraciones con archivos SQL versionados y numerados

**Decisión**: SQL plano bajo `backend/migrations/`, sólo hacia adelante,
aplicado al arrancar el servicio, con una tabla que registra qué se aplicó.

**Por qué**: FR-027 pide camino de ida desde una base vacía y SC-011 pide que se
levante sin pasos manuales. Aplicarlas al arrancar hace que desplegar y migrar
sean el mismo acto, que a un servicio con una sola instancia le queda bien.

Sin migraciones de vuelta a propósito: escribirlas es trabajo que casi nunca se
usa, y cuando se usa suele estar mal porque nunca se probó. La marcha atrás real
de una base con datos es restaurar una copia.

**Descartado**: un ORM que genere el esquema desde los tipos de Go — invierte
quién manda sobre la forma de la base, y la base es lo caro de cambiar según el
propio ADR. Aplicar migraciones a mano, que contradice SC-011.

---

## D8 — El envío de mail va detrás de una interfaz, con un proveedor concreto elegido

**Decisión**: una interfaz de una sola operación —mandar un código a una
dirección— con una implementación real. La recomendada es Resend por su nivel
gratuito permanente de 3.000 mensajes por mes; Brevo (300 por día) es
equivalente para este uso.

**Por qué**: el volumen esperado está uno o dos órdenes de magnitud por debajo
del nivel gratuito de cualquiera de los dos, así que el criterio no es el precio
sino poder cambiar de proveedor sin tocar la lógica de auth. La interfaz también
es lo que permite probar el vencimiento del código, el conteo de intentos y los
límites **sin mandar mail**, que es lo que hace que esas pruebas sean
automatizables.

Lo que **no** resuelve ningún proveedor: la entrega a bandeja de entrada depende
de DKIM, SPF y DMARC sobre `flashurbano.uy`, y eso es configuración de DNS, no
código. Es el prerequisito operativo del feature.

**Descartado**: SMTP de Gmail con la casilla del negocio. Funciona, pero ata el
envío a una cuenta personal, tiene límites diarios bajos y no da visibilidad de
rebotes. Fue además lo que motivó comprar el dominio.

---

## Lo que este documento no decide

- **El plazo exacto de la sesión y del rastro.** El spec los fijó en cuatro
  semanas y noventa días como valores configurables, no como constantes de
  negocio.
- **La forma concreta de los endpoints.** Está en [contracts/](contracts/).
- **Cualquier cosa de `007`**: recálculo del precio en el servidor, generador de
  zonas para Go, código `FU-0142`, estados del pedido.
