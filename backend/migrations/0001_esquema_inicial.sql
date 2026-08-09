-- 0001 — esquema inicial de 006-backend-auth.
--
-- Cuatro entidades. Ninguna guarda pedidos: eso es 007.
-- Ver specs/006-backend-auth/data-model.md para el porque de cada decision.
--
-- Solo hacia adelante (research D7): no hay migracion de vuelta. La marcha
-- atras real de una base con datos es restaurar una copia.

-- PostGIS se habilita ahora aunque este feature no haga ninguna consulta
-- geografica. Lo pidio el ADR: agregar la columna con el tipo correcto hoy es
-- casi gratis, migrar despues una tabla con pedidos reales no lo es.
CREATE EXTENSION IF NOT EXISTS postgis;


-- ---------------------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------------------
-- La identidad es la direccion de mail verificada. El camino de ingreso
-- (Google o codigo) NO es identidad: es solo la forma de probar que la
-- direccion es tuya, y por eso no se guarda aca sino en el rastro.
CREATE TABLE usuarios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- UNIQUE es lo que implementa FR-007a: entrar con Google o con codigo
    -- sobre la misma direccion cae en la misma fila. El CHECK obliga a que la
    -- normalizacion a minusculas ocurra siempre; sin el, "X@a.com" y "x@a.com"
    -- serian dos usuarios y el cliente perderia su perfil sin entender por que.
    email           text NOT NULL UNIQUE CHECK (email = lower(email)),

    -- Nulables a proposito. FR-021a los pide en el alta y FR-021b describe la
    -- fila que existe sin tenerlos —alguien que verifico su identidad y cerro
    -- el navegador—. Con NOT NULL esa fila seria imposible de escribir. Quien
    -- impone la obligatoriedad es perfil_completo, no el esquema.
    nombre          text,
    telefono        text,

    -- false entre el primer ingreso y la carga de nombre y telefono (FR-021b).
    perfil_completo boolean NOT NULL DEFAULT false,

    -- Direccion de retiro guardada. Va en esta misma fila y no en una tabla
    -- aparte porque es UNA sola: separarla agregaria una union sin comprar
    -- nada. Los cuatro campos son opcionales y van juntos o no van: una
    -- direccion a medias no precarga nada.
    --
    -- Es un dato DE CONVENIENCIA, no de cobro (FR-019b). Nada se cobra a partir
    -- de lo que dice un perfil: que el punto caiga dentro de la cuadra
    -- declarada se verifica al crear el pedido, y eso es 007.
    retiro_calle    text,
    retiro_esquina  text,
    retiro_numero   text,
    retiro_punto    geography(Point, 4326),

    creado_en       timestamptz NOT NULL DEFAULT now(),
    actualizado_en  timestamptz NOT NULL DEFAULT now(),

    -- La otra mitad de la resolucion de arriba: el esquema no exige nombre y
    -- telefono siempre, pero si exige que un perfil declarado completo los
    -- tenga. Es SC-013 hecho restriccion en vez de convencion.
    CONSTRAINT perfil_completo_tiene_nombre_y_telefono CHECK (
        NOT perfil_completo OR (nombre IS NOT NULL AND telefono IS NOT NULL)
    )
);

-- NO hay columna de administrador: FR-022 dice que se decide comparando el
-- email contra la configuracion del entorno. Una columna invitaria a que
-- alguien la ponga en true a mano, que es justo lo que la decision evita.
--
-- NO hay columna de contrasena, y no debe aparecer nunca (FR-005).


-- ---------------------------------------------------------------------------
-- sesiones
-- ---------------------------------------------------------------------------
-- Varias filas por usuario: alguien puede estar identificado en el telefono y
-- en la computadora. Cerrar sesion revoca ESA sesion, no todas.
CREATE TABLE sesiones (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    -- El token en claro NO se guarda. Aca alcanza con un hash rapido: el token
    -- tiene entropia suficiente para que la fuerza bruta no sea un camino
    -- (research D1). UNIQUE ademas de indice: dos sesiones no pueden compartir
    -- credencial.
    token_hash  bytea NOT NULL UNIQUE,

    creada_en   timestamptz NOT NULL DEFAULT now(),
    expira_en   timestamptz NOT NULL,

    -- Nulo mientras la sesion sirva. Es lo que hace que FR-018 sea cierto de
    -- inmediato y TAMBIEN para quien copio el token: no hay que esperar a que
    -- venza nada. Es la diferencia practica con haber usado un JWT.
    revocada_en timestamptz
);

CREATE INDEX sesiones_usuario_idx ON sesiones (usuario_id);


-- ---------------------------------------------------------------------------
-- codigos_acceso
-- ---------------------------------------------------------------------------
CREATE TABLE codigos_acceso (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Texto suelto a proposito: NO referencia a usuarios. Pedir un codigo es lo
    -- que CREA al usuario, asi que en ese momento la fila puede no existir.
    email       text NOT NULL CHECK (email = lower(email)),

    -- Hashing lento (bcrypt o Argon2), no un digest rapido. Un codigo de seis
    -- digitos tiene un millon de valores posibles: con SHA-256, calcular el
    -- millon de digests y darlos vuelta es cuestion de segundos y el hash no
    -- protege nada (research D2). El codigo en claro no se guarda en ningun
    -- lado (FR-012); vive en el mail que recibio la persona.
    codigo_hash bytea NOT NULL,

    -- Origen de la conexion que pidio el codigo. Esta aca y no en una tabla de
    -- contadores aparte porque esta fila YA existe una vez por pedido: contar
    -- sobre ella cubre los limites por direccion y por origen (FR-013) sin
    -- sumar infraestructura, que es lo que pide research D6.
    origen      text,

    creado_en   timestamptz NOT NULL DEFAULT now(),
    expira_en   timestamptz NOT NULL,

    -- Arranca en 0. A los cinco el codigo muere aunque el sexto intento traiga
    -- el valor correcto (FR-010).
    intentos    integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),

    -- Nulo hasta que se usa. Un solo uso (FR-011).
    usado_en    timestamptz
);

-- Para verificar un codigo y para contar pedidos recientes por direccion.
CREATE INDEX codigos_acceso_email_idx ON codigos_acceso (email, creado_en DESC);

-- Para contar pedidos recientes por origen (FR-013).
CREATE INDEX codigos_acceso_origen_idx ON codigos_acceso (origen, creado_en DESC);

-- Para la purga de filas vencidas.
CREATE INDEX codigos_acceso_expira_idx ON codigos_acceso (expira_en);


-- ---------------------------------------------------------------------------
-- rastro_ingresos
-- ---------------------------------------------------------------------------
-- Es la unica parte del feature que, si falla en silencio, no se detecta nunca.
CREATE TABLE rastro_ingresos (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ocurrido_en timestamptz NOT NULL DEFAULT now(),
    email       text,
    camino      text NOT NULL CHECK (camino IN ('google', 'codigo')),

    -- Texto con CHECK y no un enum nativo, por el mismo motivo que los estados
    -- del pedido en el ADR: la lista va a crecer, y agregarle un valor tiene
    -- que ser una linea de migracion.
    --
    -- Un bloqueo por limite y un codigo simplemente equivocado son problemas
    -- distintos (FR-022d): el primero puede ser alguien atacando, el segundo es
    -- alguien que se equivoco tipeando. Si el rastro no los separa, no sirve
    -- para lo que se creo.
    resultado   text NOT NULL CHECK (resultado IN (
        'exito',
        'codigo_incorrecto',
        'codigo_vencido',
        'codigo_agotado',
        'limite_excedido',
        'google_rechazado',
        'email_no_verificado'
    )),

    -- Origen de la conexion. Sale de X-Forwarded-For, no de RemoteAddr: detras
    -- del proxy de Railway RemoteAddr es el mismo para todos (research D6).
    origen      text

    -- NUNCA guarda el codigo de acceso ni la credencial de sesion (FR-022b).
    -- No hay columna donde ponerlos, y es deliberado.
);

-- Para la purga por antiguedad (FR-022c).
CREATE INDEX rastro_ingresos_ocurrido_idx ON rastro_ingresos (ocurrido_en);

-- Para reconstruir que paso con un intento concreto (SC-012).
CREATE INDEX rastro_ingresos_email_idx ON rastro_ingresos (email, ocurrido_en DESC);
