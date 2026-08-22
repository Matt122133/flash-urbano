# Research — 010 Mis pedidos

Decisiones tomadas antes de escribir código, con lo que se descartó y por qué.
Todo lo que dice "ya existe" se verificó leyendo el archivo, no de memoria.

## D1 — Cómo viaja "qué pedido repetir" de `/perfil` a `/pedido`

**Decisión**: un parámetro de consulta, `/pedido?repetir=<id>`. La composición de
`/pedido` lee el id, pide `GET /pedidos` con la credencial y busca ese pedido en
la respuesta.

**Por qué**: es lo único que sobrevive a recargar la pantalla, no escribe nada en
el disco del teléfono, y **no pone dato personal en la URL** — un uuid no dice
quién recibe ni a dónde va, y sin la credencial no sirve para nada.

**Descartado**:

- **Estado en memoria** (un contexto que `/perfil` llena y `/pedido` lee). Se
  pierde al recargar, y el App Router no tiene estado de navegación como el de
  react-router. Una pantalla que se rompe al apretar F5 es una pantalla rota.
- **`sessionStorage`**. Lo prohíbe FR-021, y por el mismo motivo por el que `007`
  eligió el diálogo de ingreso sobre navegar: el pedido lleva el nombre y el
  teléfono de **quien recibe**, un tercero que no aceptó nada.
- **Un endpoint nuevo `GET /pedidos/{id}`**. Sería backend, migración de rutas y
  pruebas nuevas para ahorrar una lista que ya se está trayendo. El spec dice que
  el servicio no cambia; esto lo respeta.

**Costo asumido**: al entrar por `?repetir=`, `/pedido` hace una llamada más. Es
la misma llamada que el historial acaba de hacer, sin caché compartida entre
pantallas. Se acepta: montar una caché para ahorrar un `GET` de una lista corta
es infraestructura por adelantado (Principio III).

**Caso feo que hay que cubrir**: un `?repetir=` con un id que no está en la
respuesta —lo borraron, se copió mal la URL, es de otra cuenta—. La pantalla no
puede quedarse cargando ni precargar a medias: dice que no encontró ese pedido y
deja el formulario vacío, que sigue siendo utilizable.

## D2 — Cómo convive con la precarga del perfil (FR-013b)

**Decisión**: `usePrecarga()` en `web/components/pedido/crear-pedido.tsx` gana un
camino nuevo y **excluyente**: si hay `?repetir=<id>` válido, el `inicial` sale
**entero** del pedido y la precarga del perfil no corre. Sin `?repetir=`, todo
queda exactamente como hoy.

**Por qué excluyente y no una mezcla**: FR-013b lo pide, y la razón está en el
tracker. El 2026-08-14 este mismo hook produjo el peor defecto de `007` —el
formulario se montaba dos veces y borraba lo tipeado— y no fue por un efecto mal
escrito sino por **una decisión que se derivaba de un estado que cambiaba**.
Mezclar dos fuentes campo por campo es reintroducir esa forma de bug con más
superficie.

**Lo que hay que preservar sí o sí**: la propiedad que arregló aquel defecto —la
decisión se toma **una vez adentro del efecto** y no se deriva del render— y que
`PedidoForm` se monte **una sola vez**, ya con su `inicial`. Un remonte pierde lo
tipeado. Esto no lo va a ver ninguna prueba automática (ver D9): es el primer
paso del quickstart por algo.

## D3 — Rehidratar la dirección de retiro guardada

**Decisión**: reusar `rehidratarRetiro()` de
`web/components/sesion/rehidratar-retiro.ts` tal cual está, pasándole la
dirección de retiro del pedido mapeada a la forma que ya acepta.

**Por qué**: hace exactamente lo que hace falta y **ya está ganado a los golpes**.
Resuelve el cruce contra el índice de calles, desempata entre calles homónimas
usando el punto guardado —hay 50 grupos de nombres homónimos en Montevideo, y el
caso que lo destapó fue `Vicente Yañez Pinzón` con y sin tilde— y devuelve
`puntoEnLaCuadra`, que es el dato con el que se decide si se puede cobrar sobre
ese punto. Escribir una segunda copia sería el error que el propio archivo
advierte en su encabezado: *"tener dos copias es como una recibe el arreglo y la
otra no"*.

**Lo único que hay que adaptar**: el pedido trae `numero` y `apto` nulables y la
función espera `numero: string`. Es un mapeo de `null` a `""`, y va en
`web/lib/repetir.ts` (D5), no adentro de la función que ya anda.

**No hay que tocar `rehidratar-retiro.ts`**, y por eso **no está en `covers:`**.
Si al construir resulta que sí hay que tocarlo, corresponde frenar y ampliar
`covers:`, no editarlo de paso.

## D4 — La dirección de entrega

**Decisión**: se precarga **como texto, tal como se guardó**, sin intentar
resolver el cruce contra el índice.

**Por qué**: la entrega no tiene punto guardado —`003` la dejó como texto a
propósito, FR-007a de aquel feature— y sin punto **no hay con qué desempatar
entre calles homónimas**. Resolver "a ojo" eligiendo la primera coincidencia es
precisamente lo que FR-017 prohíbe: un valor aproximado que se confirma sin que
nadie lo mire. El texto guardado, en cambio, es exacto: es lo que la persona
escribió.

**Consecuencia visible**: el bloque de entrega llega con los campos escritos y
sin cruce resuelto, que es el mismo estado degradado que ya muestra el perfil
cuando el índice no ubica una dirección. La entrega no incide en el precio y su
autocompletado no bloquea, así que no impide confirmar.

## D5 — Dónde vive el mapeo pedido → formulario

**Decisión**: la parte pura en `web/lib/repetir.ts`, **con pruebas**. El armado
final del `FormState` —que necesita `EstadoDireccion` y llamar a
`rehidratarRetiro`— en `web/components/pedido/`.

**Por qué partido en dos**: `web/lib/` no puede importar de `web/components/`
(ARCHITECTURE: la dependencia va en un solo sentido), y `EstadoDireccion` vive en
un componente. Lo que sí es puro —mapear la dirección del pedido a la forma que
`rehidratarRetiro` acepta, pasar `null` a `""`, traducir tamaño y cantidad,
**decidir si hubo reajuste de precio**— no depende de nada de React y se prueba
en el entorno que ya existe.

**Relación con la decisión de verificación manual (D9)**: la elección fue no
montar infraestructura de pruebas de interfaz. Esto no la contradice: es la
convención que el repo ya tiene —`lib/` se prueba, y `007` hizo lo mismo con
`lib/pedido.ts`— aplicada a la lógica que igual iba a existir. **Lo que queda sin
prueba automática es la pantalla, no la aritmética.**

## D6 — El aviso de reajuste de precio (FR-015a/b/c)

**Decisión**: lo calcula y lo muestra la composición, **arriba del formulario**,
por el mismo camino por el que hoy se muestra `avisoDelPunto`. `PedidoForm` no se
entera.

**Cómo se decide**: con el punto ya revalidado, la composición resuelve la zona
con `resolverZona()` y compara el precio de esa zona contra el `precio` guardado
del pedido. Distinto → aviso. Igual → nada.

**Por qué no adentro del formulario**: `pedido-form.tsx` no puede importar el
cliente del API ni saber que existe un pedido anterior, y hay una prueba que lo
vigila (`web/lib/cotizar-abierto.test.ts`, FR-022). El patrón de pasarle un aviso
ya resuelto desde afuera **ya existe** en este mismo archivo; esto es una segunda
instancia, no una invención.

**Los dos avisos pueden aparecer juntos**, y está bien: que el punto haya
envejecido y que el precio haya cambiado son dos cosas distintas y la persona
tiene que enterarse de las dos. El del punto va primero: uno explica por qué se
movió algo, el otro qué salió de eso.

## D7 — Dónde vive la sección del historial

**Decisión**: componentes nuevos en `web/components/pedido/`, montados desde
`web/app/perfil/page.tsx`.

**Por qué ahí y no en `components/sesion/`**: `web/components/pedido/` es, por
ARCHITECTURE, **la capa de composición que tiene permitido importar
`lib/api.ts`**. El historial habla con el servicio, así que es exactamente esa
capa. Que se monte dentro de `/perfil` no lo hace de la cuenta: el dominio es
pedidos.

**Para leer el servicio se usa `useLlamadaAutenticada()`**, no `pedir` directo. Es
el único camino que convierte un 401 en el aviso de sesión vencida en vez de en
una pantalla rota, y su propio comentario dice que es el único que las pantallas
identificadas deberían usar.

## D8 — Decisiones de pantalla que el spec dejó abiertas

- **Nombres de los estados** (FR-006): `creacion` → **"Pendiente"**,
  `aceptacion` → **"Aceptado"**, `entrega` → **"Entregado"**. "Pendiente" es lo
  único honesto mientras no exista la app Android: el pedido está cargado y
  nadie lo miró todavía. Se descartaron "Recibido" y "En preparación" — los dos
  afirman una acción de Diego que no ocurrió.
- **Cuántos se muestran** (FR-024, Assumptions): **los 5 más recientes**, y un
  "Ver todos" que muestra el resto de lo que ya se trajo. Cinco entra en una
  pantalla de teléfono sin scroll infinito y cubre a casi todo el mundo. No es
  paginado: la respuesta ya vino entera.
- **Desplegar el detalle** (FR-011a): `<details>`/`<summary>` nativos. Teclado y
  lector de pantalla salen gratis y correctos, sin estado propio ni `aria-*` a
  mano. El botón *Repetir* va **adentro del detalle desplegado**, no en la
  cabecera: repetir es una acción con consecuencia de plata, y que exija haber
  abierto y visto el pedido es una fricción a favor.
- **La fecha de la tarjeta** es la de **retiro**, no la de creación. Es la que la
  persona recuerda ("el envío del martes"). La de creación va en el detalle.

## D9 — Verificación

**Decisión (del dueño del proyecto, 2026-08-22)**: manual y documentada. No se
agrega jsdom ni librería de testing.

**Lo que eso significa para este plan, sin suavizar**: el `verify:` —`npm run
lint && npm test && npm run build`— **no ejercita ni una línea de las pantallas
nuevas**. Verde quiere decir "compila, pasa el lint, y no rompí lo que ya se
probaba". Nada más.

**Lo que sí queda cubierto automáticamente**: `web/lib/repetir.ts` (D5), y la
guarda de FR-022 (`cotizar-abierto.test.ts`), que sigue corriendo y que este
feature no debe poner en rojo — no toca `pedido-form.tsx`.

**Lo que lo reemplaza**: `quickstart.md`, con pasos que **producen el caso malo a
propósito** y no sólo recorren el camino feliz. SC-003 y SC-004 son guardas
negativas y sin prueba automática no hay control positivo posible; lo más
parecido es forzar la condición y ver que la pantalla reacciona.
