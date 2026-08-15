# Data model: El pedido se crea identificado y se guarda

**Feature**: `007-pedido-identificado` | **Fecha**: 2026-08-12

Una tabla nueva y una secuencia. `usuarios`, `sesiones`, `codigos_acceso` y
`rastro_ingresos` **no cambian**.

Sigue las dos reglas que fijó `0001`: **sólo hacia adelante** —la marcha atrás
real de una base con datos es restaurar una copia— y estado como `text` con
`CHECK` en vez de un enum nativo.

---

## `pedidos`

```sql
CREATE SEQUENCE pedidos_codigo_seq;

CREATE TABLE pedidos (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- RESTRICT y no CASCADE, a proposito. Con CASCADE, el historial de entregas
    -- de Diego desaparece en silencio el dia que un cliente se da de baja.
    --
    -- El 2026-08-12 el dueno del proyecto decidio que la baja de usuarios va a
    -- ser BORRADO LOGICO —una columna de activo/inactivo, manejada por Diego
    -- desde el dashboard de la app—, asi que en la practica no va a haber
    -- DELETE de filas y este RESTRICT no va a dispararse nunca. Se deja igual:
    -- cuesta cero, y es la red para el dia que alguien si necesite borrar de
    -- verdad (una baja pedida por privacidad, que una bandera NO satisface —
    -- ver docs/tech-debt-tracker.md). Un FK sin ON DELETE explicito hace
    -- NO ACTION, que es casi lo mismo pero no se lee como una decision.
    usuario_id          uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,

    -- FU-0142. Lo genera la BASE, no el servicio: dos instancias no pueden
    -- emitir el mismo, y no hay que reintentar ante colision.
    --
    -- lpad NO trunca: el pedido 10.000 sale FU-10000 y sigue siendo unico. El
    -- formato no se rompe al pasarse, solo se ensancha.
    codigo              text NOT NULL UNIQUE
        DEFAULT ('FU-' || lpad(nextval('pedidos_codigo_seq')::text, 4, '0')),

    -- Identifica un INTENTO DE ENVIO, no el pedido. La genera el navegador.
    -- Es lo que hace que un doble toque, un reintento de red, o la reanudacion
    -- despues del ingreso lleguen al mismo pedido en vez de crear otro.
    clave_idempotencia  text NOT NULL,

    -- text con CHECK y no enum: la lista YA cambio una vez (se cayo
    -- "confirmacion", respuesta del cliente del 2026-08-06). Agregar un estado
    -- tiene que ser una linea de migracion.
    --
    -- 007 solo escribe 'creacion'. Los otros dos los mueve la app Android.
    estado              text NOT NULL DEFAULT 'creacion'
        CHECK (estado IN ('creacion', 'aceptacion', 'entrega')),

    -- ---------------------------------------------------------------------
    -- Quien envia. COPIA del perfil, no referencia (FR-013).
    -- ---------------------------------------------------------------------
    -- NOT NULL aunque en `usuarios` sean nulables: alla existe la fila a medias
    -- del ingreso interrumpido (perfil_completo = false), aca no. Un pedido sin
    -- telefono de quien envia es un pedido que Diego no puede trabajar.
    remitente_nombre    text NOT NULL,
    remitente_telefono  text NOT NULL,

    -- ---------------------------------------------------------------------
    -- De donde se retira. Es el dato sobre el que se cobro.
    -- ---------------------------------------------------------------------
    retiro_calle        text NOT NULL,
    retiro_esquina      text NOT NULL,
    retiro_numero       text,
    retiro_apto         text,
    retiro_cooperativa  boolean NOT NULL DEFAULT false,

    -- NOT NULL: sin punto no hay zona, sin zona no hay precio, y sin precio no
    -- hay pedido (FR-020). Es tambien lo que mantiene el precio RECALCULABLE
    -- despues, que es lo unico que sostiene la decision de no verificarlo hoy
    -- (research D6). Guardar el punto no es un detalle del esquema: es la
    -- mitad de esa decision.
    retiro_punto        geography(Point, 4326) NOT NULL,

    -- ---------------------------------------------------------------------
    -- Adonde se entrega. Sin punto, y es correcto: FR-007a de `003` dejo la
    -- entrega como texto, no incide en el precio, y la ubica la app Android.
    -- ---------------------------------------------------------------------
    entrega_calle       text NOT NULL,
    entrega_esquina     text NOT NULL,
    entrega_numero      text,
    entrega_apto        text,
    entrega_cooperativa boolean NOT NULL DEFAULT false,

    -- ---------------------------------------------------------------------
    -- Que se envia.
    -- ---------------------------------------------------------------------
    -- Mismo criterio que `estado`: texto con CHECK. Los tres tamanos salen de
    -- `PackageSize` en pedido-form.tsx y son los mismos desde `001`.
    paquete_tamano      text NOT NULL
        CHECK (paquete_tamano IN ('chico', 'mediano', 'grande')),
    cantidad            integer NOT NULL CHECK (cantidad > 0),

    -- ---------------------------------------------------------------------
    -- Cuando se retira. Fecha y hora sueltas, NO timestamptz (research D8).
    -- El retiro ocurre en Montevideo siempre; convertir a UTC y volver es la
    -- receta conocida del error de un dia, a cambio de una generalidad que
    -- este producto no usa.
    -- ---------------------------------------------------------------------
    retiro_fecha        date NOT NULL,
    retiro_hora         time NOT NULL,

    -- ---------------------------------------------------------------------
    -- Quien recibe. Volvio al formulario en `005` porque sin el nombre el
    -- repartidor llega a una puerta sin saber a quien preguntar. La CEDULA no
    -- vuelve, y no debe aparecer nunca como columna.
    -- ---------------------------------------------------------------------
    destinatario_nombre   text NOT NULL,
    destinatario_telefono text NOT NULL,

    -- ---------------------------------------------------------------------
    -- La plata. Congelada al crear: un cambio de precios posterior no
    -- reescribe pedidos viejos.
    -- ---------------------------------------------------------------------
    -- Entero en pesos. No hay centavos en ningun lado del producto y un entero
    -- no tiene el redondeo de un flotante. Sin columna de moneda: el producto
    -- opera en una sola, y una columna que siempre dice lo mismo es una que
    -- nadie mantiene y que un dia miente.
    precio              integer NOT NULL CHECK (precio > 0),

    -- Derivable del punto, y se guarda igual: es la zona que el cliente VIO.
    -- Compararla despues contra la que el punto resuelve es lo que convierte
    -- una sospecha en una verificacion (research D6).
    zona_id             smallint NOT NULL CHECK (zona_id BETWEEN 1 AND 5),

    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now()
);

-- FR-016: la unicidad es por usuario, no global. Dos usuarios no pueden
-- colisionar ni usar la clave de otro para sondear si existe.
CREATE UNIQUE INDEX pedidos_idempotencia_idx
    ON pedidos (usuario_id, clave_idempotencia);

-- GET /pedidos, y el futuro "Mis Pedidos": los mios, los recientes primero.
CREATE INDEX pedidos_usuario_idx ON pedidos (usuario_id, creado_en DESC);

-- GET /admin/pedidos: el dia de trabajo de Diego se ordena por cuando se
-- retira, no por cuando se cargo.
CREATE INDEX pedidos_retiro_idx ON pedidos (retiro_fecha, retiro_hora);
```

### Lo que deliberadamente NO tiene

- **No hay columna de precio verificado ni de zona recalculada.** El servicio no
  resuelve zonas en este feature (research D6). Agregar la columna hoy sería
  fingir una verificación que no ocurre.
- **No hay cédula de quien recibe.** Salió del producto en `004` y el cliente
  confirmó que no vuelve. No tener dónde escribirla es la forma fuerte de que no
  se escriba.
- **No hay columna de cancelado.** La pregunta 4 al cliente sigue sin responder y
  el valor asumido es que no se puede cancelar. Si contesta que sí, es un estado
  más en el `CHECK` — una línea de migración, que es exactamente para lo que se
  eligió `text` sobre enum.
- **No hay `notificado_en` ni nada del aviso a Diego.** El aviso vive en la app
  Android y todavía no existe. Una columna preparada para algo que no se
  construyó es una columna que nadie sabe si se llena.
- **No hay borrado lógico.** Nada borra pedidos en este feature.

---

## Correspondencia con el formulario

Lo que el navegador ya tiene y cómo aterriza. Importa porque **el tipo ya
existe**: `web/lib/direccion.ts` define `DireccionCobrada`, escrito en un feature
anterior con este comentario — *"Este tipo es para el momento en que el pedido se
cierra: ahí hay que congelarlos, o un cambio futuro de límites reescribiría lo
ya cobrado."* Este es ese momento. **Se reutiliza, no se define otro.**

| `FormState` (`pedido-form.tsx`) | Columna |
|---|---|
| `name`, `phone` | `remitente_nombre`, `remitente_telefono` |
| `retiro.direccion.{calle,esquina,numero,apto,cooperativa}` | `retiro_*` |
| `retiro.direccion.punto` | `retiro_punto` |
| *(derivado del punto)* `resolverZona()` | `zona_id`, `precio` |
| `entrega.direccion.{calle,esquina,numero,apto,cooperativa}` | `entrega_*` |
| `packageSize`, `quantity` | `paquete_tamano`, `cantidad` |
| `pickupDate`, `pickupTime` | `retiro_fecha`, `retiro_hora` |
| `receiverName`, `receiverPhone` | `destinatario_nombre`, `destinatario_telefono` |

**Lo que no viaja**: la zona y el precio **no** están en `FormState` — el
formulario los deriva del punto en cada render, a propósito, para que no puedan
quedar desincronizados de la ubicación. Al confirmar se congelan por primera
vez, y ese es justamente el rol de `DireccionCobrada`.

---

## Transiciones de estado

```
creacion ──► aceptacion ──► entrega
```

Las tres son la respuesta del cliente del 2026-08-06, que además **descartó un
cuarto estado** ("confirmación") que el relevamiento original traía.

**`007` sólo escribe `creacion`.** No hay endpoint que mueva un pedido de estado
y no debe haberlo: mover estados es lo que hace la app Android, y construir el
camino sin quien lo use deja código sin ejercitar que envejece mal. El `CHECK`
acepta los tres desde hoy porque agregar el valor después sería una migración
sobre una tabla con datos, y eso sí conviene evitarlo.

---

## Sobre la deuda del índice de calles

El punto guardado en el perfil de un usuario —que `006` creó— se usa acá para
cobrar. La fila `Medium` del 2026-08-11 en el tracker advierte que una
regeneración de `calles-mvd.json` puede desplazarlo de cuadra, o de zona, sin
que nadie toque nada.

**Lo que este modelo hace al respecto**: el pedido copia el punto en vez de
referenciar el perfil, así que un pedido ya creado es inmune — se cobró sobre lo
que se guardó y ahí queda. Lo que sigue expuesto es el momento de la precarga, y
eso lo cubre la revalidación en el navegador (research D7), no el esquema.

**Lo que este modelo NO hace**: no detecta que un punto guardado envejeció. Eso
sigue necesitando el fixture de esquinas confirmadas a mano que pide SC-002 de
`003` desde el 2026-08-04, y sigue sin hacerse.
