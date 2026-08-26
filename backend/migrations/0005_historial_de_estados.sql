-- 0005 — el historial de estados, de 012-app-repartidor.
--
-- Es lo UNICO que este feature agrega al modelo. Ver
-- specs/012-app-repartidor/data-model.md seccion 2 para el porque de cada
-- columna, y research D9 para el porque de la tabla.
--
-- Solo hacia adelante: no hay migracion de vuelta, igual que 0001, 0003 y 0004.
--
-- --------------------------------------------------------------------------
-- No exige nada de lo que ya hay, y eso es deliberado.
-- --------------------------------------------------------------------------
--
-- 0004 tumbo el servicio en produccion el 2026-08-23 por agregar una columna
-- `NOT NULL` a una tabla que se creia vacia y no lo estaba. Esta migracion NO
-- puede repetirlo: crea una tabla nueva y no toca ninguna fila existente. Aun
-- asi se comprueba contra una base CON datos adentro antes de desplegar (T010),
-- porque el razonamiento "no puede fallar" es exactamente el que fallo.

-- --------------------------------------------------------------------------
-- 1. Una fila por cambio de estado.
-- --------------------------------------------------------------------------
CREATE TABLE pedidos_estados (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ON DELETE RESTRICT, igual que `pedidos.usuario_id`, y por el mismo
    -- motivo: si alguna vez alguien borra un pedido a mano, que falle en voz
    -- alta en vez de llevarse el registro sin avisar. CASCADE seria comodo y
    -- perderia en silencio justo el dato que esta tabla existe para conservar.
    pedido_id   uuid NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,

    -- EL MISMO CHECK que `pedidos.estado` en 0003, repetido a proposito y no
    -- factorizado: son dos columnas independientes y una restriccion compartida
    -- via dominio esconderia que hay que tocar las dos al agregar un estado.
    -- 0003 ya dejo escrito que agregar un estado es editar un CHECK, que es
    -- para lo que se eligio `text` sobre `enum`.
    estado      text NOT NULL
        CHECK (estado IN ('creacion', 'aceptacion', 'entrega')),

    ocurrido_en timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2. El unico camino de lectura que se le preve.
-- --------------------------------------------------------------------------
--
-- El historial NO SE MUESTRA en ningun lado (FR-014): se escribe y se guarda.
-- La unica lectura previsible es a mano, meses despues, cuando alguien reclama:
-- "todo lo que le paso a ESTE pedido, en orden". Es la consulta que este indice
-- sirve, y la razon de que lleve `ocurrido_en`.
CREATE INDEX pedidos_estados_pedido_idx
    ON pedidos_estados (pedido_id, ocurrido_en);

-- --------------------------------------------------------------------------
-- 3. Lo que esta migracion NO hace.
-- --------------------------------------------------------------------------
--
-- **No rellena hacia atras.** Los pedidos que ya existen no reciben una fila de
-- "creacion" inventada. Fabricarla seria inventar un momento que nadie observo;
-- un pedido sin ninguna fila significa "es anterior a esto", que es la verdad.
--
-- **No purga.** A diferencia de `rastro_ingresos`, que se borra a los 90 dias
-- porque son datos personales que crecen rapido, esto son tres filas por pedido
-- y es justamente el dato que se quiere tener cuando el reclamo llega tarde.
