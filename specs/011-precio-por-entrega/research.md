# Research: El precio sale de la entrega

**Feature**: `011-precio-por-entrega` | **Fecha**: 2026-08-22

Lo que se averiguó antes de planificar, con lo descartado. Las decisiones se
numeran D1..D8 y el plan las referencia por número.

---

## D1 — El bloque de dirección ya tiene modos, y no alcanzan

**Hallazgo**: `web/components/bloque-direccion.tsx` expone
`ModoDireccion = "retiro" | "entrega"`, y la diferencia está documentada como no
cosmética:

- `retiro` — elegir de las sugerencias es **obligatorio**, el cruce se resuelve a
  un punto, y ese punto se cobra.
- `entrega` — el autocompletado es **ayuda, no puerta**; no hay punto ni mapa, y
  lo tipeado vale aunque no esté en el índice.

**Lo tentador y equivocado**: cambiar `modo="retiro"` por `modo="entrega"` y
viceversa. No alcanza, porque el retiro nuevo **no es el modo `entrega` actual**:
tiene que capturar el punto cuando pueda (FR-012) sin exigirlo nunca (FR-015).
Eso es un tercer comportamiento.

**Decisión**: los modos dejan de nombrarse por la dirección que ocupan y pasan a
nombrarse por lo que hacen.

| Modo | Qué hace | Quién lo usa |
|---|---|---|
| `exigente` | Hay que elegir de las sugerencias; sin punto no se sigue; muestra mapa | Entrega (y el perfil) |
| `oportunista` | El texto vale siempre; el punto se guarda **si** se resuelve solo; sin mapa | Retiro |

**Rationale**: el nombre `retiro` sobre un modo que ahora usa la entrega es una
mentira que dura hasta que alguien la lee mal. Renombrar cuesta un `sed` y evita
la clase entera de defecto.

**Alternativa descartada**: dejar los nombres y documentar la inversión en un
comentario. Descartada — es exactamente el tipo de deuda que este repo evita, y
el archivo ya tiene comentario explicando la diferencia entre modos: quedaría
contradiciendo al código.

---

## D2 — Qué pasa cuando la calle del retiro es homónima

**El contexto**: Montevideo tiene ~50 familias de calles con el mismo nombre en
barrios distintos, y el índice lo tiene documentado como trampa. `buscarEsquina`
devuelve varios candidatos y `bloque-direccion` **nunca toma el primero**.

**FR-014 del spec decía: preguntar.** Este research propuso cambiarlo, y **el
cambio se aprobó el 2026-08-22**: el spec ya dice lo de abajo.

**Decisión**: cuando el retiro sea ambiguo, **no preguntar y no guardar punto** —
tratarlo igual que un texto que no resuelve (FR-015).

**Rationale**:

1. **El resultado es igual de seguro y cuesta menos.** Lo que FR-014 evita es un
   punto en el barrio equivocado. No guardar punto lo evita igual.
2. **Fricción cero en vez de fricción para ~50 familias de calles.** Preguntar
   por el retiro reintroduce en la dirección propia justo lo que este feature le
   saca.
3. **Es consistente con FR-015**, que ya acepta guardar un pedido sin punto de
   retiro en silencio. Preguntar en un caso y callar en el otro son dos reglas
   donde alcanza una.
4. **El caso común ya está cubierto por otro lado**: FR-016 hace que quien envía
   desde su dirección guardada aporte un punto que confirmó a mano en *Mi
   cuenta*. La resolución silenciosa es el respaldo, no la fuente principal.

**Lo que cuesta**: se pierden las coordenadas de retiro de las direcciones sobre
calles homónimas cuya persona no guardó su dirección en el perfil. Cae en la
misma deuda ya anotada, y la misma consulta la mide.

**FR-014 quedó corregido en el spec el 2026-08-22.** El encuadre del dueño del
repo al aprobarlo, que vale conservar porque es el criterio y no el detalle: *"en
vez de levantar un problema pasamos nomás la ubicación como texto, cualquier cosa
que Diego se comunique"*. Es la misma lógica que FR-015 y tiene la misma fecha de
vencimiento: **primera instancia, sin nadie en producción**.

---

## D3 — El contrato de la API no cambia

**Hallazgo**: `backend/internal/pedidos/pedido.go` define **un solo** tipo
`Direccion`, compartido por retiro y entrega, y ya lleva
`Punto *Punto \`json:"punto,omitempty"\``.

**Decisión**: el formato del cuerpo de `POST /pedidos` **no cambia**. La entrega
empieza a mandar su punto y el retiro pasa a poder omitirlo. Lo que cambia es la
validación, no la forma.

**Consecuencia**: no hay versionado de API, ni compatibilidad que sostener, ni
cliente que actualizar más allá de qué se manda.

---

## D4 — Dónde vive la validación que hoy exige el punto de retiro

**Hallazgo**: está en dos lugares y los dos hay que tocar.

- `handlers.go:209` — `if p.Retiro.Punto == nil { return "falta el punto de retiro" }`
- `pedido.go:212` — la misma guarda antes del `INSERT`, con un comentario que
  explica que existe para no producir un `NOT NULL violation` con un mensaje
  incomprensible.

**Decisión**: las dos guardas se mudan al punto de **entrega**. La segunda
conserva su motivo textual —la columna nueva entra `NOT NULL`— y la primera
cambia el mensaje.

**Lo que NO se hace**: dejar la guarda del retiro "por las dudas". Con FR-015 un
retiro sin punto es válido, y una guarda que rechaza lo válido es un defecto.

---

## D5 — La migración

**Hallazgo**: `pedidos.retiro_punto` es `geography(Point,4326) NOT NULL`, con el
argumento escrito en el esquema: *"sin punto no hay zona, sin zona no hay
precio"*. `usuarios.retiro_punto` ya es **nullable** — ahí no hay nada que hacer.

**Decisión**: una migración `0004`, con tres cosas y ningún relleno:

1. `ALTER TABLE pedidos ADD COLUMN entrega_punto geography(Point,4326) NOT NULL`
2. `ALTER TABLE pedidos ALTER COLUMN retiro_punto DROP NOT NULL`
3. Reemplazar el comentario del esquema que ya no es cierto.

**`NOT NULL` sin default y sin relleno sólo funciona sobre una tabla vacía.**
Producción está vacía; **local no**. La migración va a fallar contra la base de
desarrollo con sus ocho pedidos de prueba, y eso es correcto: son descartables y
recrearlos es parte del quickstart. **Que falle ruidosamente es preferible a un
default inventado**, que pondría un punto falso —o sea un precio falso— en filas
que nadie revisó.

**Alternativa descartada**: entrar `NULL`, rellenar, y después endurecer. Es el
procedimiento correcto con datos reales y sobra acá: no hay con qué rellenar,
porque la entrega nunca tuvo punto y no se puede inventar.

---

## D6 — Qué pasa con `rehidratarRetiro()` y la regla de `007`

**Hallazgo**: `web/components/sesion/rehidratar-retiro.ts` documenta que sus dos
consumidores deciden distinto sobre `puntoEnLaCuadra`: el perfil **muestra** el
punto guardado; el pedido lo **descarta y avisa**, porque FR-022 de `007` prohíbe
cobrar sobre un punto guardado sin revalidar.

**Decisión**: la rama de "descartar y avisar" **desaparece del camino del
retiro** y reaparece en el de la entrega.

**Rationale**: la regla nunca fue sobre el retiro — fue sobre **el punto que
cobra**. Al mudarse el cobro, se muda la regla. Un punto de retiro envejecido
pasa a ser una molestia de ruta.

**Esto es FR-017 del spec, y es la trampa más fácil del feature**: si alguien ve
una prueba de `007` en rojo y la "arregla" sin leer esto, o revive una guarda que
ya no corresponde o borra una que sí. **El archivo se toca con esta decisión
citada en el commit.**

---

## D7 — `lib/repetir.ts` y sus 24 pruebas

**Hallazgo**: mapea la dirección de retiro del pedido al formulario y decide el
reajuste comparando el precio de la zona que resuelve **el punto de retiro**
contra el guardado.

**Decisión**: las dos mitades se mudan a la entrega. La forma del módulo no
cambia; cambia de qué campo lee.

**Lo que hay que cuidar**: los pedidos viejos no tienen `entrega.punto`, así que
repetirlos no puede resolver precio. Por FR-013 eso tiene que terminar en un
formulario usable con un aviso, no en una pantalla rota — el mismo camino que
`010` ya construyó para un `?repetir=` que no existe.

**Y una simplificación real**: hoy `repetir.ts` mapea el retiro a la forma que
`rehidratarRetiro()` acepta. Con el retiro sin mapa, esa mitad se achica.

---

## D8 — La guarda de FR-022 (cotizar con el servicio caído)

**Hallazgo**: `web/lib/cotizar-abierto.test.ts` recorre el grafo de imports desde
un conjunto `ENTRADAS` y falla si alcanza `PROHIBIDOS` (`lib/api.ts`).

**Decisión**: la prueba **no se toca**, y eso es un control del feature, no un
detalle. Todo lo que este plan mueve es cálculo local: `resolverZona`, el índice
de calles y el mapa ya están del lado permitido, y **mover el precio de una
sección a otra no puede necesitar la red**.

**Si esta prueba se pone en rojo durante la implementación, el defecto está en el
cambio, no en la prueba.** Sacar una entrada de `ENTRADAS` para calmarla es
exactamente cómo se rompe la cotización pública sin que nadie se entere.
