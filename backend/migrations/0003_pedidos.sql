-- 0003 — la tabla de pedidos, de 007-pedido-identificado.
--
-- Es la mitad que 006 dejo abierta a proposito: alli se construyo la identidad
-- y NO se guardaron pedidos, porque la puerta y el pedido que se guarda de
-- verdad tienen que salir juntos.
--
-- Ver specs/007-pedido-identificado/data-model.md para el porque de cada
-- decision. Solo hacia adelante: no hay migracion de vuelta, igual que 0001.

-- El codigo corto lo genera la BASE, no el servicio: dos instancias no pueden
-- emitir el mismo y no hay que reintentar ante colision.
CREATE SEQUENCE pedidos_codigo_seq;


-- Formatea el codigo: FU-0001, y FU-10000 cuando se pasa de cuatro digitos.
--
-- **Existe porque `lpad` TRUNCA**, y eso costo un rojo. La version original de
-- esta migracion usaba `lpad(nextval(...)::text, 4, '0')` directo en el
-- DEFAULT, sobre la creencia —escrita en research.md D4— de que lpad no
-- truncaba. Es falso: la documentacion de Postgres dice "if the string is
-- already longer than length then it is truncated (on the right)", asi que el
-- pedido 10.000 salia `FU-1000` y el 10.001 tambien. **Dos pedidos distintos
-- con el mismo codigo**, o mas bien un INSERT que revienta contra el UNIQUE
-- cuando el negocio esta en su mejor momento.
--
-- Lo encontro la prueba que cruza FU-9999 a proposito. Estaba razonado y no
-- comprobado, que es exactamente la clase de afirmacion que conviene ejercitar.
--
-- Es una funcion y no una expresion inline porque hace falta mirar el valor DOS
-- veces —para decidir si se rellena— y `nextval` no se puede llamar dos veces
-- sin avanzar la secuencia dos veces. Un DEFAULT no admite subconsultas, asi
-- que la subconsulta tiene que vivir adentro de una funcion.
--
-- Se descarto `to_char(v, 'FM0000')`: medido en Postgres 17, devuelve `####`
-- cuando el numero no entra en el formato. Cambia un codigo repetido por uno
-- invalido, que no es mejor.
--
-- CREATE OR REPLACE y no CREATE a secas: el helper que vacia la base de pruebas
-- dropea tablas, no funciones, y un CREATE pelado fallaria en la segunda
-- migracion de la misma base.
CREATE OR REPLACE FUNCTION pedidos_codigo_nuevo() RETURNS text
LANGUAGE sql VOLATILE AS $$
    SELECT 'FU-' || CASE WHEN v < 10000
                         THEN lpad(v::text, 4, '0')
                         ELSE v::text
                    END
    FROM (SELECT nextval('pedidos_codigo_seq') AS v) AS s;
$$;


CREATE TABLE pedidos (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- RESTRICT y no CASCADE. Con CASCADE, el historial de entregas de Diego
    -- desaparece en silencio el dia que un cliente se da de baja.
    --
    -- El 2026-08-12 se decidio que la baja de usuarios va a ser BORRADO LOGICO
    -- —una columna de activo/inactivo, manejada desde el dashboard de la app—,
    -- asi que en la practica no va a haber DELETE de filas y esto no se va a
    -- disparar nunca. Se deja igual: cuesta cero y es la red para el dia que
    -- alguien necesite borrar de verdad. Un FK sin ON DELETE explicito hace
    -- NO ACTION, que es casi lo mismo pero no se lee como una decision.
    usuario_id          uuid NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,

    -- FU-0142, y FU-10000 al pasarse de cuatro digitos. Ver el comentario de
    -- pedidos_codigo_nuevo() arriba: el formato NO se rompe al cruzar, y hay
    -- una prueba que lo cruza a proposito porque la primera version de esto si
    -- se rompia.
    codigo              text NOT NULL UNIQUE DEFAULT pedidos_codigo_nuevo(),

    -- Identifica un INTENTO DE ENVIO, no el pedido. La genera el navegador.
    -- Es lo que hace que un doble toque, un reintento de red, o la reanudacion
    -- despues del ingreso lleguen al mismo pedido en vez de crear otro.
    clave_idempotencia  text NOT NULL,

    -- text con CHECK y no enum: la lista YA cambio una vez (se cayo
    -- "confirmacion", respuesta del cliente del 2026-08-06). Agregar un estado
    -- tiene que ser una linea de migracion.
    --
    -- 007 solo escribe 'creacion'. Los otros dos los mueve la app Android. Los
    -- tres se aceptan desde hoy igual, porque ampliar el CHECK sobre una tabla
    -- con datos es mas caro que preverlo.
    estado              text NOT NULL DEFAULT 'creacion'
        CHECK (estado IN ('creacion', 'aceptacion', 'entrega')),

    -- --------------------------------------------------------------------
    -- Quien envia. COPIA del perfil, no referencia (FR-013).
    -- --------------------------------------------------------------------
    -- NOT NULL aunque en `usuarios` sean nulables: alla existe la fila a medias
    -- del ingreso interrumpido (perfil_completo = false), aca no. Un pedido sin
    -- telefono de quien envia es un pedido que Diego no puede trabajar.
    remitente_nombre    text NOT NULL,
    remitente_telefono  text NOT NULL,

    -- --------------------------------------------------------------------
    -- De donde se retira. Es el dato sobre el que se cobro.
    -- --------------------------------------------------------------------
    retiro_calle        text NOT NULL,
    retiro_esquina      text NOT NULL,
    retiro_numero       text,
    retiro_apto         text,
    retiro_cooperativa  boolean NOT NULL DEFAULT false,

    -- NOT NULL: sin punto no hay zona, sin zona no hay precio, y sin precio no
    -- hay pedido. Es tambien lo que mantiene el precio RECALCULABLE despues,
    -- que es lo unico que sostiene la decision de no verificarlo hoy. Guardar
    -- el punto no es un detalle del esquema: es la mitad de esa decision.
    retiro_punto        geography(Point, 4326) NOT NULL,

    -- --------------------------------------------------------------------
    -- Adonde se entrega. Sin punto, y es correcto: FR-007a de 003 dejo la
    -- entrega como texto, no incide en el precio, y la ubica la app Android.
    -- --------------------------------------------------------------------
    entrega_calle       text NOT NULL,
    entrega_esquina     text NOT NULL,
    entrega_numero      text,
    entrega_apto        text,
    entrega_cooperativa boolean NOT NULL DEFAULT false,

    -- --------------------------------------------------------------------
    -- Que se envia. Mismo criterio que `estado`: texto con CHECK.
    -- --------------------------------------------------------------------
    paquete_tamano      text NOT NULL
        CHECK (paquete_tamano IN ('chico', 'mediano', 'grande')),
    cantidad            integer NOT NULL CHECK (cantidad > 0),

    -- --------------------------------------------------------------------
    -- Cuando se retira. Fecha y hora sueltas, NO timestamptz.
    --
    -- El retiro ocurre en Montevideo, siempre. Convertir a UTC y volver es la
    -- receta conocida del error de un dia —un retiro a las 00:30 guardado como
    -- el dia anterior— a cambio de una generalidad que este producto no usa.
    -- Lo que la persona escribio es lo que Diego tiene que leer.
    -- --------------------------------------------------------------------
    retiro_fecha        date NOT NULL,
    retiro_hora         time NOT NULL,

    -- --------------------------------------------------------------------
    -- Quien recibe. El nombre volvio al formulario en 005 porque sin el, el
    -- repartidor llega a una puerta sin saber a quien preguntar.
    --
    -- La CEDULA no vuelve, y no debe aparecer nunca como columna: no tener
    -- donde escribirla es la forma fuerte de que no se escriba.
    -- --------------------------------------------------------------------
    destinatario_nombre   text NOT NULL,
    destinatario_telefono text NOT NULL,

    -- --------------------------------------------------------------------
    -- La plata. Congelada al crear: un cambio de precios posterior no
    -- reescribe pedidos viejos.
    -- --------------------------------------------------------------------
    -- Entero en pesos. No hay centavos en ningun lado del producto y un entero
    -- no tiene el redondeo de un flotante. Sin columna de moneda: el producto
    -- opera en una sola, y una columna que siempre dice lo mismo es una que
    -- nadie mantiene y que un dia miente.
    precio              integer NOT NULL CHECK (precio > 0),

    -- Derivable del punto, y se guarda igual: es la zona que el cliente VIO.
    -- Compararla despues contra la que el punto resuelve es lo que convierte
    -- una sospecha en una verificacion.
    zona_id             smallint NOT NULL CHECK (zona_id BETWEEN 1 AND 5),

    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now()
);

-- La secuencia muere con la tabla. Sin esto queda huerfana en el esquema.
ALTER SEQUENCE pedidos_codigo_seq OWNED BY pedidos.codigo;

-- NO hay columna de precio verificado ni de zona recalculada: el servicio no
-- resuelve zonas en este feature. Agregarla hoy seria fingir una verificacion
-- que no ocurre.
--
-- NO hay columna de cancelado: la pregunta 4 al cliente sigue sin responder y
-- el valor asumido es que no se puede cancelar. Si contesta que si, es un
-- estado mas en el CHECK — que es justo para lo que se eligio text sobre enum.
--
-- NO hay `notificado_en` ni nada del aviso a Diego: eso vive en la app Android
-- y todavia no existe. Una columna preparada para algo que no se construyo es
-- una columna que nadie sabe si se llena.


-- La unicidad de la clave es POR USUARIO, no global: dos usuarios no pueden
-- colisionar ni usar la clave de otro para sondear si existe.
CREATE UNIQUE INDEX pedidos_idempotencia_idx
    ON pedidos (usuario_id, clave_idempotencia);

-- GET /pedidos, y el futuro "Mis Pedidos": los mios, los recientes primero.
CREATE INDEX pedidos_usuario_idx ON pedidos (usuario_id, creado_en DESC);

-- GET /admin/pedidos: el dia de trabajo de Diego se ordena por cuando se
-- retira, no por cuando se cargo.
CREATE INDEX pedidos_retiro_idx ON pedidos (retiro_fecha, retiro_hora);
