-- El perfil guarda la direccion de retiro ENTERA, no cuatro de sus seis campos.
--
-- Hasta 0001, el perfil guardaba calle, esquina, numero y punto. El formulario
-- de pedido pide ademas el apto y si el domicilio es una cooperativa, y esos dos
-- no se guardaban: quien vive en un apartamento tenia que volver a escribir su
-- apto en cada envio, que es exactamente lo que el perfil existe para evitar.
--
-- Decision del dueño del proyecto el 2026-08-11, con el motivo dicho: **es
-- informacion del cliente**, igual que el resto de la direccion. Se hace ahora
-- y no en `007` porque `007` es quien precarga el formulario, y llegar ahi con
-- la direccion incompleta obligaria a un segundo cambio de esquema encima del
-- codigo que ya la estaria leyendo.
--
-- Los dos son NULABLES y sin default, a proposito. La direccion de retiro entera
-- es opcional (se puede guardar nombre y telefono sin ella), asi que un NOT NULL
-- obligaria a inventar un valor para las filas que no tienen direccion. Y
-- `retiro_cooperativa` en particular **no lleva DEFAULT false**: "no es
-- cooperativa" y "nunca lo dijo" son cosas distintas, y colapsarlas haria que
-- toda fila vieja afirmara algo que nadie declaro.

ALTER TABLE usuarios
    ADD COLUMN retiro_apto        text,
    ADD COLUMN retiro_cooperativa boolean;

-- Las filas que ya tienen direccion quedan con estos dos en NULL, y esta bien:
-- significa "no lo declaro", que es la verdad. La proxima vez que esa persona
-- guarde su perfil, los completa.
