-- 0004 — el precio pasa a salir de la ENTREGA, de 011-precio-por-entrega.
--
-- El cliente definio sus zonas y sus precios por adonde va el paquete; el sitio
-- venia cobrando por la zona del RETIRO. Ver
-- docs/decisions/pricing-from-delivery-zone.md, que enmienda el Principio V de
-- la constitucion por segunda vez (3.0.0 -> 4.0.0), y
-- specs/011-precio-por-entrega/data-model.md para el porque de cada linea.
--
-- Solo hacia adelante: no hay migracion de vuelta, igual que 0001 y 0003.

-- --------------------------------------------------------------------------
-- 1. El punto de entrega, que es el que ahora decide zona y precio.
-- --------------------------------------------------------------------------
--
-- NOT NULL, sin default y sin relleno. Eso EXIGE que la tabla este vacia, y es
-- deliberado: no hay con que rellenar las filas viejas —la entrega nunca tuvo
-- punto y no se puede inventar— y un default seria un punto falso, o sea un
-- precio falso, en filas que nadie reviso.
--
-- En produccion no hay ni un pedido. En desarrollo hay que vaciar la tabla
-- antes de correr esto (`TRUNCATE pedidos;`), y los pedidos que se pierden
-- tenian su precio calculado con la regla vieja: conservarlos seria conservar
-- numeros que ya no significan nada.
--
-- Que esta migracion falle ruidosamente sobre una tabla con datos es la
-- proteccion, no el problema.
ALTER TABLE pedidos
    ADD COLUMN entrega_punto geography(Point, 4326) NOT NULL;

-- --------------------------------------------------------------------------
-- 2. El punto de retiro deja de ser obligatorio.
-- --------------------------------------------------------------------------
--
-- **El comentario de 0003 sobre esta columna quedo falso.** Decia, textual:
--
--     "NOT NULL: sin punto no hay zona, sin zona no hay precio, y sin precio no
--      hay pedido. Es tambien lo que mantiene el precio RECALCULABLE despues."
--
-- Ese argumento ahora describe a entrega_punto, no a esta. **0003 no se edita**
-- —es una migracion ya aplicada, y reescribirla es reescribir historia que otra
-- base ya ejecuto—, asi que la correccion vive aca.
--
-- Que hace el punto de retiro a partir de ahora, y por que se guarda igual:
--
--   1. Comprueba que el retiro caiga dentro del area de servicio (FR-011). Es
--      una comprobacion de MEJOR ESFUERZO: solo actua cuando el texto resuelve.
--   2. Le da coordenadas reales a la ruta que la app Android va a planificar.
--
-- Y por que puede faltar: cuando el texto del retiro no resuelve a ningun cruce
-- —calle fuera del indice, error de tipeo— o cuando la calle es HOMONIMA y hay
-- varios candidatos, el pedido se guarda igual, sin punto y sin decirle nada a
-- quien lo crea (FR-014, FR-015). Una fila con retiro_punto NULL no es un error:
-- es ese caso, y `WHERE retiro_punto IS NULL` es como se lo encuentra.
--
-- **La app Android tiene que tolerar un retiro sin coordenadas.**
ALTER TABLE pedidos
    ALTER COLUMN retiro_punto DROP NOT NULL;
