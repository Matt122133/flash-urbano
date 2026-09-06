# Research: El dia de trabajo, del mas viejo al mas nuevo

**Fecha**: 2026-09-05

## D1 — El orden lo decide el servicio, y la app ya esta bien como esta

**Decision**: se cambia **una consulta SQL** y no se toca la app.

**Rationale**: leido, no supuesto. `agrupar()` en
`android/.../pantallas/EstadoPantalla.kt` usa `groupBy`, que **preserva el orden
de origen** dentro de cada grupo, y su comentario lo declara: *"El orden dentro
de cada seccion es el que mando el servicio. La app no decide un orden de visita
ni sugiere una ruta"*. Hay ademas una prueba llamada `la app no reordena los
pedidos` que lo fija.

Eso tiene una consecuencia que vale mas que el cambio: **el APK no se
reinstala**. Para una app que se instala a mano en el telefono de otra persona,
que una correccion llegue con el despliegue del backend es la diferencia entre
"hecho" y "hecho cuando nos veamos".

**Alternatives considered**:

- **Ordenar en la app.** Rechazado: pondria en rojo una prueba que existe a
  proposito, y metaria en la app una decision que el contrato le asigna al
  servicio. Ademas obligaria a reinstalar.
- **Que el servicio devuelva las tres secciones ya separadas**, para poder darle
  a Entregados un orden propio. Rechazado por alcance: cambia la forma del JSON
  —lo unico que acopla la app al servicio— y el cliente eligio que las tres vayan
  igual. Es la puerta por la que se entra si Entregados molesta.

## D2 — `retiro_hora` no desempata nada, y por eso el orden de hoy es indefinido

**Decision**: se ordena por `creado_en`, y se agrega `id` como desempate.

El orden actual es `ORDER BY retiro_fecha DESC, retiro_hora DESC`. El segundo
criterio **no ordena**: desde `014` el sitio manda `retiro_hora` fija en
`"16:00"` para todos los pedidos —es relleno, no un dato elegido, y la
constitucion 5.1.0 prohibe leerlo—. Asi que **dentro de un mismo dia de retiro,
el orden que Diego ve hoy es el que la base tenga ganas de devolver**, y puede
cambiar entre dos llamadas sin que nadie toque nada.

O sea que este feature no solo invierte el sentido: **le da un orden total a algo
que hoy no lo tiene**.

Por eso el desempate por `id`: sin el, dos pedidos con el mismo `creado_en`
quedarian otra vez en orden indefinido y FR-003 seria falso. Es barato y hace
verdadero el requisito. En la practica no deberia activarse —`creado_en` tiene
resolucion de microsegundos y los pedidos entran de a uno—, pero un orden
"determinista salvo empate" no es determinista.

**Que es y que no es el desempate por `id`.** `pedidos.id` es un **uuid
aleatorio** (`gen_random_uuid()`), asi que ordenar por el da un resultado
**estable pero arbitrario**: no es "el que se creo primero". Y esta bien, porque
lo que FR-003 pide es determinismo, no significado — entre dos pedidos con el
mismo instante de creacion no hay un "primero" que descubrir.

**Alternatives considered**:

- **Dejar solo `creado_en ASC`.** Rechazado por lo de arriba: seria repetir en
  chico el defecto que este feature viene a corregir.
- **Desempatar por `codigo`, que sale de una secuencia. RECHAZADO, y hay que
  dejar escrito por que o alguien lo va a proponer.** Parece el desempate
  correcto: `pedidos_codigo_seq` es monotona, asi que un codigo mayor significa
  un pedido posterior. **Pero el codigo se guarda como TEXTO** —`FU-0001`— y el
  relleno con ceros llega hasta cuatro digitos: despues de `FU-9999` viene
  `FU-10000`, que **ordena ANTES** que `FU-9999` en comparacion lexicografica.
  O sea que `ORDER BY codigo` empieza a mentir en el pedido diez mil, y hasta
  entonces se ve perfecto.

  El mismo formato ya produjo un defecto real en este repo: la version original
  de la migracion `0003` usaba `lpad(..., 4, '0')` directo y **generaba el mismo
  codigo para el pedido 10.000 y el 10.001**. Lo encontro una prueba que cruza
  `FU-9999` a proposito. El formato esta arreglado; **su orden lexicografico no**,
  y no tiene por que estarlo — el codigo es para que una persona lo lea, no para
  ordenar.

## D3 — La prueba tiene que correr de verdad, y por defecto no corre

**Decision**: la prueba de orden va en `pedido_test.go`, con la base, **y hay que
comprobar el conteo de salteadas**.

Es la trampa que `AGENTS.md` marca en primer lugar: *"Los tests de Go que pegan a
Postgres **se saltean solos** sin `TEST_DATABASE_URL`, asi que 'todo verde' no
dice nada de la base salvo que se haya mirado el conteo de skips"*.

Aplica de lleno: la prueba de FR-008 es exactamente una de esas. Correr
`go test ./...` sin levantar `flash-pg-test` deja todo en verde **sin haber
comprobado el orden ni una vez**, que es el modo de falla mas probable de este
feature.

La prueba actual de `Todos()` **cuenta filas y no mira el orden** — lo que
significa que hoy una regresion de orden pasa sin que nada la detecte, y que
FR-008 no es una formalidad.

**Alternatives considered**: probar el orden sin base, con un doble del
repositorio. Rechazado: lo que hay que verificar **es el SQL**, y un doble no
tiene SQL. Seria una prueba que pasa siempre.
