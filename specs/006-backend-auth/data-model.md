# Data model — 006 backend auth

Cuatro entidades. Ninguna guarda pedidos: eso es `007`.

Regla que atraviesa todo: **el repo es público y la base guarda datos de
personas reales**. Nada acá se guarda "por las dudas".

---

## `usuarios`

Quien puede crear pedidos. La identidad es la dirección de mail verificada.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Clave primaria |
| `email` | texto | **Único**, normalizado a minúsculas. Es la identidad (FR-007a) |
| `nombre` | texto | **Nulable en el esquema.** Obligatorio como regla (FR-021a), no como `NOT NULL` — ver abajo |
| `telefono` | texto | **Nulable en el esquema.** Ídem |
| `perfil_completo` | booleano | `false` entre el primer ingreso y la carga de nombre y teléfono (FR-021b) |
| `creado_en` | timestamptz | |
| `actualizado_en` | timestamptz | |

**La unicidad de `email` es la que implementa FR-007a**: entrar con Google o con
código sobre la misma dirección cae en la misma fila. El camino de ingreso no se
guarda como identidad, sólo como dato del rastro.

**No hay columna de administrador.** FR-022 dice que se decide comparando el
`email` contra la configuración del entorno. Una columna invitaría a que alguien
la ponga en `true` a mano, que es justo lo que la decisión evita.

**No hay columna de contraseña**, y no debe aparecer nunca (FR-005).

`perfil_completo` existe por FR-021b: alguien que verifica su identidad y cierra
el navegador antes de cargar nombre y teléfono deja una fila a medias. Al volver
con la misma dirección retoma donde estaba en vez de chocar contra una fila que
no puede completar.

**Y por eso `nombre` y `telefono` no pueden ser `NOT NULL`.** Es la contradicción
más fácil de escribir mal en la migración: FR-021a dice "obligatorio desde el
alta" y FR-021b describe exactamente la fila que existe sin tenerlos. Las dos son
ciertas porque **la obligatoriedad no la impone el esquema, la impone
`perfil_completo`**: mientras esté en `false`, el usuario existe pero el sitio no
lo deja seguir sin completarlos. Poner `NOT NULL` haría imposible crear la fila
del primer ingreso, que es justo lo que FR-021b pide que se pueda hacer.

Cómo se lee entonces SC-013 ("ningún usuario creado queda sin nombre y
teléfono"): es una afirmación sobre las altas **completas**, no sobre las filas
de la tabla. Un usuario con `perfil_completo: false` es un alta en curso, no un
usuario creado. La prueba que corresponde es que ninguna fila quede en `false`
después de un alta terminada por cualquiera de los dos caminos, y que una fila en
`false` siempre se pueda completar.

### Dirección de retiro guardada

Va en la misma fila de `usuarios`, no en una tabla aparte: es **una sola**, y
sacarla a otra tabla agregaría una unión sin comprar nada.

| Campo | Tipo | Reglas |
|---|---|---|
| `retiro_calle` | texto | Opcional |
| `retiro_esquina` | texto | Opcional |
| `retiro_numero` | texto | Opcional |
| `retiro_punto` | `geography(Point,4326)` | Opcional |

**Los cuatro campos son opcionales**: FR-021a pide nombre y teléfono en el alta,
no la dirección. Van juntos o no van — una dirección a medias no sirve para
precargar nada.

**El punto se guarda como geometría desde el día uno**, aunque este feature no
haga ninguna consulta geográfica. Es lo que pidió el ADR: agregar la columna con
el tipo correcto ahora es casi gratis, migrar después una tabla con pedidos
reales no lo es.

**Este punto no autoriza ningún cobro** (FR-019b). Es un dato de conveniencia
para precargar el formulario. Que caiga dentro de la cuadra declarada se
verifica cuando se usa para cobrar, que es `007`. Y cuando `007` arme un pedido,
**copia** estos valores en vez de referenciarlos: un cliente que se muda no
puede reescribir adónde fue Diego hace seis meses.

---

## `sesiones`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Clave primaria |
| `usuario_id` | UUID | → `usuarios.id`, borrado en cascada |
| `token_hash` | bytea | Hash del token. **El token en claro no se guarda** |
| `creada_en` | timestamptz | |
| `expira_en` | timestamptz | Cuatro semanas por defecto, configurable |
| `revocada_en` | timestamptz | Nulo mientras sirva. Se llena al cerrar sesión |

Una sesión sirve si no venció y no está revocada. `revocada_en` es lo que hace
que FR-018 sea cierto **de inmediato y también para quien copió el token**: no
hay que esperar a que venza nada.

Varias filas por usuario: alguien puede estar identificado en el teléfono y en
la computadora. Cerrar sesión revoca **esa** sesión, no todas.

---

## `codigos_acceso`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Clave primaria |
| `email` | texto | Normalizado. **No** referencia a `usuarios`: se pide antes de existir |
| `codigo_hash` | bytea | Hashing lento (research D2), no un digest rápido |
| `origen` | texto | Origen de la conexión que pidió el código. Ver abajo |
| `creado_en` | timestamptz | |
| `expira_en` | timestamptz | Diez minutos (FR-009) |
| `intentos` | entero | Arranca en 0. A los 5 el código muere (FR-010) |
| `usado_en` | timestamptz | Nulo hasta que se usa. Un solo uso (FR-011) |

`email` es texto suelto a propósito: pedir un código es lo que **crea** al
usuario, así que en ese momento la fila de `usuarios` puede no existir.

**El código en claro no se guarda en ningún lado, ni acá ni en el rastro**
(FR-012, FR-022b). Vive en el mail que recibió la persona y nada más.

**`origen` se agregó al implementar** (2026-08-09, migración `0001`). FR-013 pide
limitar la frecuencia por dirección **y por origen de conexión**, y research D6
decidió llevar esos contadores en Postgres. Esta fila ya existe una vez por
pedido de código, así que contar sobre ella cubre los dos límites **sin una
tabla de contadores aparte** — que es exactamente la infraestructura que D6
quería no agregar. Sale de `X-Forwarded-For`, con la salvedad de D6.

Las filas vencidas se borran por antigüedad. No hacen falta.

---

## `rastro_ingresos`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | UUID | Clave primaria |
| `ocurrido_en` | timestamptz | |
| `email` | texto | La dirección del intento |
| `camino` | texto | `google` o `codigo`, con `CHECK` |
| `resultado` | texto | Con `CHECK`. Ver abajo |
| `origen` | texto | Origen de la conexión |

`resultado` tiene que distinguir, como mínimo (FR-022d):

`exito`, `codigo_incorrecto`, `codigo_vencido`, `codigo_agotado`,
`limite_excedido`, `google_rechazado`, `email_no_verificado`.

Es texto con `CHECK` y no un enum nativo por el mismo motivo por el que lo son
los estados del pedido en el ADR: la lista va a crecer, y agregarle un valor
tiene que ser una línea de migración.

**Un bloqueo por límite y un código simplemente equivocado son problemas
distintos.** El primero puede ser alguien atacando; el segundo es alguien que se
equivocó tipeando. Si el rastro no los separa, no sirve para lo que se creó.

**Nunca guarda el código ni la credencial de sesión** (FR-022b).

Se borra por antigüedad, noventa días por defecto (FR-022c). Es la única entidad
del feature que se borra sola, y la excepción está escrita en las Assumptions
del spec: son datos personales que se acumulan rápido y que no hace falta
conservar.

---

## Lo que no está

- **Pedidos.** `007`.
- **Estados del pedido** (`creacion` → `aceptacion` → `entrega`). `007`.
- **Zonas y precios.** Siguen en el bundle del sitio y **no se mudan a la base**
  (FR-002). PostGIS está acá por la app Android, no por el precio.
- **Borrado de cuenta a pedido del usuario.** Declarado deuda en el spec.
