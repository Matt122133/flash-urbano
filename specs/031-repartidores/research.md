# Research: Repartidores

Decisiones de diseño de `031`. Cada una con lo que se eligio, por que, y lo que
se descarto.

## D1 — El rol vive en `REPARTIDOR_EMAILS`, opcional

**Decision**: una variable de entorno nueva, `REPARTIDOR_EMAILS`, separada por
comas, normalizada con la misma `normalizarEmail` que `ADMIN_EMAILS`.
`Config.EsRepartidor(email)` es verdadero si el mail esta en la lista **y no**
es administrador (FR-004). **La variable es opcional**: vacia o ausente
significa "no hay repartidores", y el servicio arranca igual.

**Rationale**: FR-001 a FR-003, y la decision de Mateo del 2026-10-18. Que sea
opcional no es comodidad: una variable obligatoria nueva **tumba el despliegue**
de cualquier entorno que no la tenga cargada antes del deploy, y produccion ya
cayo una vez por algo que "no podia fallar" (0004). Staging, local y las
pruebas no tienen repartidor y no tienen por que inventarse uno.

**Alternatives**: columna `type` en `usuarios` (la propuesta original de Mateo,
descartada en el spec); variable obligatoria (rompe arranques).

## D2 — La asignacion es `pedidos.repartidor_email`, nulable, sin FK

**Decision**: una columna `repartidor_email text NULL` en `pedidos`, con
`CHECK (repartidor_email = lower(repartidor_email))`. Nulo = de los
administradores. Sin default, sin backfill.

**Rationale**:

- **Por mail y no por `usuarios.id`**: el rol se define por mail (D1), y el
  repartidor **puede no tener fila en `usuarios`** el dia que Diego le asigna su
  primer pedido (spec, Edge Cases: "el repartidor nunca entro a la app"). Una
  FK obligaria a que exista la cuenta antes de poder asignar.
- **Nulable y sin default**: `ALTER TABLE ... ADD COLUMN` nulable sin default no
  reescribe filas en Postgres, y todos los pedidos existentes quedan en "de los
  administradores" sin una sola escritura (FR-007, SC-007). Es lo contrario de
  0004.
- **No es un rol en la base** (FR-003): la columna dice a quien se le dio un
  pedido, no que permisos tiene nadie. Si el mail sale de la configuracion, la
  columna no le da nada (D4).

**Alternatives**: tabla `asignaciones` con historial (nadie pidio el historial
de asignaciones; la entrega ya esta en `pedidos_estados`); FK a `usuarios`
(descartada arriba).

## D3 — "Fijar al entregar" no necesita una columna mas

**Decision**: la responsabilidad al momento de la entrega (FR-010b) **es la
misma `repartidor_email`**, porque un pedido en `entrega` no se puede
reasignar: el `UPDATE` de asignacion lleva `AND estado <> 'entrega'` en el
`WHERE`. Deshacer la entrega devuelve el pedido a un estado reasignable sin
tocar la columna.

**Rationale**: una segunda columna (`entregado_por`) seria una copia que tiene
que coincidir siempre con la primera mientras el pedido este entregado. La regla
en el `WHERE` es atomica: no hay ventana entre comprobar el estado y escribir.

**Consecuencia aceptada**: si un administrador marca como entregado un pedido
asignado al repartidor (puede, ver D6), cuenta para el repartidor. Es su pedido.

## D4 — El responsable efectivo se calcula al leer

**Decision**: el servicio expone `responsable` y no la columna cruda:

- `repartidor_email` nulo → de los administradores.
- `repartidor_email` presente y **el pedido entregado** → ese repartidor, este o
  no en la configuracion (FR-011, entregas fijas).
- `repartidor_email` presente, **no entregado**, y el mail **ya no es
  repartidor** → de los administradores (FR-011). Sin escribir nada.
- Si no, ese repartidor.

Vive en una funcion pura en `pedidos` que recibe `esRepartidor`, con prueba de
tabla de los cuatro casos.

**Rationale**: sacar un mail de la variable no dispara ningun proceso que
"devuelva" pedidos; la siguiente lectura ya los muestra en "mios". Lo mismo vale
para un mail que se pasa a administrador (FR-004).

**Alternatives**: limpiar la columna al arrancar el servicio si un mail
desaparecio (una escritura masiva en el arranque es justo lo que no se quiere).

## D5 — Las mismas rutas `/admin/pedidos`, con el alcance segun quien llama

**Decision**: `GET /admin/pedidos` y `PATCH /admin/pedidos/{id}/estado` dejan
pasar a administradores **y** repartidores. Un administrador sigue recibiendo
todos los pedidos; un repartidor, solo los que tiene asignados. La respuesta de
la lista suma `rol` y, para un administrador, `repartidores`. Una ruta nueva,
`PUT /admin/pedidos/{id}/repartidor`, asigna y devuelve. Ver
[contracts/api.md](contracts/api.md).

**Rationale**:

- **La app instalada hoy sigue andando.** Entre el deploy del servicio y que
  Diego instale la version nueva, su app vieja pide `GET /admin/pedidos`, recibe
  lo mismo que hoy mas campos que ignora (`ignoreUnknownKeys`, `Pedido.kt:23`),
  y no se rompe. Es lo que el clarify difirio al plan.
- El prefijo `/admin` queda con un nombre algo impreciso para el repartidor. Se
  acepta: renombrar rutas obliga a que app y servicio se desplieguen a la vez.
- `rol` en la lista evita una llamada mas al abrir la app: la app necesita
  saber si mostrar el filtro y el boton de asignar en el mismo momento en que
  recibe los pedidos.

**Alternatives**: rutas `/repartidor/pedidos` aparte (duplica handlers y
obliga a la app a saber a cual llamar antes de saber quien es); `rol` en
`GET /yo` (lo usa la web, y la web no tiene por que enterarse del repartidor).

## D6 — Quien puede hacer que, sobre que pedido

| Accion | Administrador | Repartidor |
|---|---|---|
| Ver la lista | todos, con `responsable` | solo `responsable == el` |
| Cambiar estado | cualquiera (como hoy) | solo los suyos; otro → 404 |
| Asignar a un repartidor | cualquiera no entregado | nunca → 403 |
| Devolver a administradores | cualquiera no entregado | solo los suyos no entregados |

El 404 del repartidor sobre un pedido ajeno usa **el mismo texto que un pedido
que no existe** (FR-015). La comprobacion va en el `WHERE` (o en el
`SELECT ... FOR UPDATE` que `CambiarEstado` ya hace), no en una lectura previa.

## D7 — Avisos: uno nuevo, al repartidor, y los de edicion y baja tambien le llegan

**Decision**:

- `Destinatarios.TokensDe(ctx, email)`: los mismos tres filtros de `Tokens`,
  acotados a un mail.
- `Avisador.AvisarAsignacion(ctx, PedidoAsignado{Codigo, Repartidor,
  EntregaCalle})`: titulo **"Nuevo paquete asignado"** + codigo, cuerpo con la
  calle de entrega, como `Armar`. Solo al asignar **a** un repartidor, y solo si
  el responsable cambio (asignar dos veces a la misma persona no suena dos
  veces). Desasignar no avisa (FR-017a).
- **Los avisos de edicion y baja de un pedido asignado le llegan tambien al
  repartidor**, ademas de a los administradores. El cliente solo puede editar o
  dar de baja un pedido pendiente (`022`), y Diego puede asignar un pendiente:
  sin esto, el repartidor va a una direccion que el cliente ya cambio.
- El aviso de pedido nuevo no cambia (FR-019).

**Rationale**: FR-017 a FR-019. Lo de edicion y baja no esta pedido
explicitamente; se agrega porque el spec dice que el repartidor hace con sus
pedidos "lo mismo que Diego", y Diego hoy se entera de esas dos cosas por aviso.
Aprobado por Mateo el 2026-10-18 en el analisis del plan; queda como FR-019a.

En la app, el aviso de asignacion entra por el mismo `AvisosService` que ya
cuenta "pedidos nuevos": el renglon dice que hay algo nuevo y se baja al
tocarlo. No hace falta otro canal.

## D8 — Tablero: la seccion Repartidores cuenta por fecha de entrega

**Decision**: `GET /admin/tablero` suma a cada carga `repartidor` (solo si esta
**entregada** y asignada) y `entregadoEn` (la ultima marca de entrega, solo si
el pedido sigue entregado), y a la respuesta una lista `repartidores`: los
configurados **mas** cualquier mail con entregas fijas (FR-020), con el nombre
si tiene cuenta. La web arma la seccion con las mismas funciones de periodo de
`lib/tablero.ts`, pero agrupando por `entregadoEn` en Montevideo
(`fechaEnMontevideo`) y no por `creadoEn`.

**Rationale**: FR-020 a FR-022 y la clarificacion de "se paga a paquete
entregado". Es el mismo patron que `025`: el servicio da hechos, la web cuenta.
Que los dos cortes del tablero usen fechas distintas se dice en pantalla con un
texto propio, como `TEXTO_CORTE` ya lo hace para el de clientes.

## D9 — Reporte: el mismo `GET /admin/reporte`, con `repartidor` en vez de `cliente`

**Decision**: `GET /admin/reporte?repartidor=<mail>&desde&hasta`. **Exactamente
uno** de `cliente` o `repartidor`; los dos o ninguno → 400. Con `repartidor`, el
filtro es `estado = 'entrega' AND repartidor_email = $1` y el periodo se corta
por `(ultima entrega AT TIME ZONE 'America/Montevideo')::date`. Mismas
columnas, mismo formato de archivo, misma ausencia de `precio` (la guarda
`sin_plata_test.go` ya cubre el paquete).

**Rationale**: FR-021 a FR-023. La zona escrita y no `-03:00` por lo mismo que
FR-006b de `029`.

## D10 — La app: un filtro arriba para el administrador, y una accion en la tarjeta

**Decision**:

- **Administrador**: una fila de dos chips arriba de la lista, **"Mios"** (por
  defecto) y **"Todos"**. En "Todos", cada tarjeta asignada lleva el nombre del
  repartidor. La tarjeta de un pedido no entregado ofrece **"Asignar"**, que
  abre una lista con "Diego" (= administradores) y los repartidores.
- **Repartidor**: sin chips. La tarjeta de un pedido no entregado ofrece
  **"Devolver a Diego"**. Ni asignar ni la lista de repartidores.
- Las secciones de hoy (Pendientes, Tomados, Entregados) siguen iguales.

El spec dice "desde la tarjeta del pedido": la app no tiene una pantalla de
detalle aparte, y crear una para esto viola el Principio III.

**El texto "Diego"** en "Devolver a Diego" es el unico nombre propio de cara al
usuario; la app es interna, no publica, y es como el repartidor lo va a
entender. Se usa la constante en un solo lugar.

**Enmienda del 2026-10-18, al probar en staging (Mateo):** el boton dice
**"Devolver"** a secas; en la tarjeta se entiende a quien vuelve. "Diego" queda
solo como la opcion de la lista de "Asignar". Y en "Todos", los pedidos que
llevan los demas van **arriba**, los del administrador abajo, con una linea gris
entre las dos tandas.

## D11 — La constitucion: 6.3.0, MINOR, con ADR

**Decision**: enmienda **6.3.0 (MINOR)**: el Principio III pasa de "a
single-operator courier business" a "a single courier business — one owner,
possibly more than one person delivering — not a multi-tenant platform"; los
*Scope boundaries* describen la app como la de quien reparte (administradores y
repartidores) y el tablero suma el corte por repartidor. ADR nuevo
`docs/decisions/more-than-one-courier.md`, porque la Governance pide ADR cuando
una enmienda revierte una decision previa, y "un solo operador" lo era.

**Rationale**: MINOR y no MAJOR porque ningun codigo escrito contra el texto
anterior queda incumpliendo: todo lo existente sigue valiendo para el caso de
un solo repartidor. El Principio V no se toca.

## D12 — Despliegue

Staging primero (`docs/processes/staging.md`): `REPARTIDOR_EMAILS` con una
cuenta de prueba de Mateo, el emulador como repartidor y el telefono de Mateo
como administrador. **Orden en produccion**: cargar `REPARTIDOR_EMAILS` en
Railway, desplegar el servicio (compatible con la app vieja, D5), publicar la
app con `scripts/publicar-app.sh`, y recien entonces Diego asigna.
