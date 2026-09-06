# Research: Corregir o dar de baja un pedido, mientras nadie lo tomo

**Fecha**: 2026-09-05

## D1 — La ventana del cliente y la que permite el esquema son la misma

**Decision**: la baja **borra la fila**. No se inventa un estado `anulado`.

`pedidos_estados.pedido_id` es `ON DELETE RESTRICT` y su comentario dice para
que: *"si alguna vez alguien borra un pedido a mano, que falle en voz alta en vez
de llevarse el registro sin avisar"*. Y esa tabla **solo se escribe en
`CambiarEstado`** —no al crear—, verificado: el unico `INSERT INTO
pedidos_estados` del repositorio esta dentro de esa transaccion.

De ahi:

| estado | ¿tiene historial? | ¿se puede borrar? |
|---|---|---|
| `creacion` (pendiente) | no | **si** |
| `aceptacion` / `entrega` | si | **no**, lo impide la base |

El cliente limito el alcance a pendientes por un motivo de negocio —*"una vez que
Diego lo tenga ya no se puede hacer nada"*— y resulta ser **exactamente** la
ventana que la base deja abierta.

**Lo que eso ahorra**: un estado `anulado` habria obligado a que la app lo
mostrara —tacharlo, filtrarlo de las secciones— y eso es **un APK nuevo instalado
a mano en el telefono de Diego**. Con la ventana chica, la app no cambia.

**Alternatives considered**: borrado logico igual, "por prudencia". Rechazado: se
paga una version de la app y una columna nueva para conservar el registro de un
pedido que **nadie tomo y sobre el que nadie trabajo**. El registro que la
constitucion y el esquema protegen es el de las entregas, y ese sigue intacto
porque esos pedidos no se pueden borrar.

## D2 — La ventana se hace valer en el UPDATE, no leyendo antes

**Decision**: `UPDATE ... WHERE id = $1 AND usuario_id = $2 AND estado =
'creacion'`, y se decide por **filas afectadas**. Igual el `DELETE`.

Es lo que resuelve FR-012, la carrera real: el cliente abre *Editar*, Diego toma
el pedido en ese momento, y el guardado llega tarde. Un `SELECT` para comprobar
el estado y despues un `UPDATE` deja una ventana entre los dos en la que Diego
puede tomarlo, y el guardado pisaria un pedido ya en curso. Con la condicion
adentro del `UPDATE`, **la base decide**: si afecto cero filas, o no es suyo, o
ya no esta pendiente, o no existe — y las tres respuestas son la misma hacia
afuera.

Que las tres colapsen en una no es pereza: es FR-004. Distinguir "no es tuyo" de
"no existe" le confirma a un desconocido que ese pedido existe.

**El mismo patron que ya usa el repo.** `PorUsuario()` "toma el usuario por
parametro y no admite filtro alguno que lo esquive... es lo que implementa FR-017
en la capa que toca la base, en vez de confiar en que todos los handlers se
acuerden". Aca se extiende esa idea al estado.

**Alternatives considered**: leer, validar en Go, escribir. Rechazado por la
carrera. Es codigo mas legible que falla en el unico caso que importa.

## D3 — Una tercera fuente de precarga, que es donde este feature se puede romper

**Decision**: `/pedido?editar=<id>` **mutuamente excluyente** con `?repetir=` y
con la precarga del perfil, en la misma cadena de decision.

`crear-pedido.tsx` ya lo advierte por escrito: las dos fuentes actuales son
excluyentes *"para no reintroducir, con mas superficie, la forma del defecto que
este mismo hook produjo el 2026-08-14 — dos cosas escribiendo sobre el mismo
formulario"*.

Editar es la **tercera**, y es la mas peligrosa de las tres: repetir arranca un
pedido nuevo, pero editar tiene que terminar en un `PATCH` sobre uno existente.
Si las fuentes se mezclan, el modo de falla no es un campo raro — es **guardar
sobre el pedido equivocado**.

Por eso la decision se toma **una sola vez**, con `editar` primero, y el modo de
guardado viaja con la precarga en vez de deducirse despues de un parametro de la
URL leido en otro lado.

**Alternatives considered**: una pantalla de edicion propia. Rechazado: duplica
la definicion de que es un pedido valido —los campos, las validaciones, la
revalidacion de cobertura— y esa duplicacion diverge. Es el mismo argumento por
el que la etiqueta de `020` compone las direcciones con `componerDireccion` en
vez de escribir su propio compositor.

## D4 — Los dos avisos nuevos, con la garantia en el tipo y no en el texto

**Decision**: dos entradas nuevas al lado de `PedidoNuevo`, cada una con **solo
los campos que su mensaje puede decir**.

`avisos/mensaje.go` ya establecio la disciplina y la dice explicitamente: lo que
esta prohibido que aparezca —numero de puerta, esquina, nombres, telefonos,
importes— *"la garantia no es este cuerpo de funcion: es que `PedidoNuevo` no
tiene esos campos. Un descuido aca no compila"*.

Los dos mensajes nuevos siguen eso. **El de la baja necesita menos todavia que el
de un pedido nuevo**: alcanza el codigo. Diego no va a ir a ningun lado, asi que
la calle no aporta y su ausencia es una superficie menos.

**El aviso de edicion no dice que cambio**, solo que cambio. Calcular un diff
legible —"cambio el telefono del destinatario"— es un feature aparte, y ademas
tendria que decidir como nombrar cada campo sin filtrar su contenido, que es
exactamente el problema que la disciplina de arriba evita.

**Alternatives considered**: reusar `PedidoNuevo` para los tres. Rechazado: el
tipo lleva la calle de entrega, que el aviso de baja no necesita. Reusarlo seria
dejar disponible un dato que ese mensaje no tiene por que poder decir.

## D5 — La app de Diego no se toca, y esta verificado

**Decision**: `covers:` no incluye `android/`.

FR-014 pide que la app tolere que un pedido de su lista ya no exista. **Ya lo
hace**, leido: `Servicio.kt` mapea cualquier respuesta que no sea 2xx —salvo 401
y 403, que tienen su rama— a `Motivo.DEL_SERVICIO` con el mensaje del servicio,
y `RepartidorViewModel` maneja ese `Fallo` al cambiar estado sin romperse.

Asi que lo unico que hace falta del lado del servicio es **devolver un mensaje
legible** en el 404, porque ese texto es el que Diego va a leer.

Se comprueba igual en el quickstart, con la app contra el backend local: leer el
codigo dice que el camino existe, no que el mensaje se entienda.
