# Research: El precio vuelve, del lado de adentro del login

**Feature**: `024-precio-detras-del-login` | **Fecha**: 2026-09-10

Cuatro preguntas técnicas, todas resueltas leyendo el código antes de escribir
el plan. Ninguna quedó abierta.

---

## D1 — Cómo sabe el formulario si hay sesión, sin romper la guarda de imports

**Decisión**: `crear-pedido.tsx` le pasa a `PedidoForm` una prop nueva
(`conSesion: boolean`). `pedido-form.tsx` no importa nada nuevo.

**Rationale**: `web/lib/cotizar-abierto.test.ts` prohíbe estáticamente que el
grafo de imports que arranca en `components/pedido-form.tsx` llegue a
`lib/api.ts` o `lib/sesion.ts`. Eso protege que el formulario cargue con el
servicio caído, y sigue valiendo. Pero **el contenedor ya conoce la sesión**:
`web/components/pedido/crear-pedido.tsx:360` hace
`const { usuario, cargando } = useSesion()`, y `crear-pedido.tsx` **no** figura
entre las `ENTRADAS` de esa guarda. Bajar un booleano por props cruza la
frontera en la única dirección que la guarda permite.

**Hallazgo que simplifica FR-005a**: `PedidoForm` **no se monta** mientras la
sesión está sin resolver. `crear-pedido.tsx:277` corta con `Un momento…` hasta
que `listaLaPrecarga` es true, y la precarga espera a `cargando === false`
(`:413`). O sea que la ventana indeterminada nunca llega al formulario, y
`conSesion` está definido desde el primer render. Además el HTML que se
pre-renderiza al exportar el sitio es esa rama —ahí `cargando` siempre es
true—, así que **el monto no puede quedar en el HTML estático**: no hay
formulario en él.

**Hallazgo que sostiene FR-006**: la decisión de precarga **se congela** apenas
hay algo que entregar (`crear-pedido.tsx:352`), justamente para que
identificarse a mitad de formulario no desmonte `PedidoForm` y pise lo tipeado
—defecto real encontrado el 2026-08-14 por T039—. Como no hay desmontaje,
cambiar `usuario` de `null` a un usuario re-renderiza con `conSesion: true` y el
monto aparece **sin perder el punto ya marcado**. FR-006 sale gratis de una
decisión que ya estaba tomada por otro motivo.

**Alternativas consideradas**:

- *Que `pedido-form.tsx` llame a `useSesion()` directo.* Rechazada: pone en rojo
  `cotizar-abierto.test.ts`, y con razón — `proveedor-sesion.tsx` importa
  `lib/api.ts`.
- *Agregar `crear-pedido.tsx` a las `ENTRADAS` de la guarda y relajarla.*
  Rechazada: debilita la única guarda automática de que el formulario funciona
  sin red, para ganar nada.
- *Leer la credencial de `localStorage` desde el formulario.* Rechazada:
  duplica la lógica de sesión, no ve el vencimiento, y viola
  [[buscar-antes-de-escribir-un-helper]] en espíritu — el dato ya existe.

---

## D2 — Dónde vive el render del monto, dado que una prueba lo prohíbe

**Decisión**: un componente nuevo y mínimo,
`web/components/pedido/precio-de-zona.tsx`, es **el único archivo de `app/` o
`components/` autorizado a nombrar un precio**. `sin-precio-a-la-vista.test.ts`
lo exceptúa por ruta exacta y sigue prohibiendo todo lo demás.

**Rationale**: la guarda de `013` escanea `app/` y `components/` completos
buscando `/precio/i`, `/\$\s*\d/`, `/costo/i` y `/cuánto sale/i` fuera de
comentarios. Hoy pone en rojo exactamente lo que este feature quiere hacer, y
FR-017 obliga a redefinirla en vez de borrarla. De las formas de redefinirla,
la excepción por **ruta de archivo** es la única que se puede escribir sin
parsear regiones de código, y deja la superficie autorizada del tamaño de un
archivo de veinte líneas. Cualquier intento de escribir un monto en
`pedido-form.tsx`, en `historial.tsx`, en la etiqueta o en `sobre-nosotros`
sigue poniendo la prueba en rojo — que es la mitad del feature que el cliente
pidió (FR-008, FR-011, FR-012).

`pedido-form.tsx` le pasa al componente el `zona` que ya tiene y el booleano de
sesión; **nunca nombra `precio`**, así que el formulario entero sigue bajo la
prohibición general.

**Refuerzo barato**: la guarda además verifica que ese componente sea importado
por **exactamente un** archivo. Sin eso, la excepción autoriza un archivo que
después se puede colgar de cualquier pantalla, y FR-007a —el monto solo junto a
la zona— se pierde sin que nada se ponga en rojo.

**Alternativas consideradas**:

- *Exceptuar `pedido-form.tsx` entero.* Rechazada: son mil líneas; la excepción
  autorizaría un total, un resumen o una línea suelta, que es justo lo que
  FR-007a prohíbe.
- *Exceptuar una región marcada con comentarios dentro de `ResultadoZona`.*
  Rechazada: pide parsear regiones, y la guarda ya tuvo que escribir un
  tokenizador para ignorar comentarios; agregarle otro es infraestructura para
  ahorrar un archivo.
- *Borrar la guarda y confiar en la revisión.* Rechazada por FR-017. Es
  exactamente la mitad que un agente futuro, leyendo solo "mostrar el precio",
  rompería sin enterarse.

---

## D3 — Qué se puede probar automáticamente en este repo, y qué no

**Decisión**: la decisión de mostrar o no el monto se extrae a una función pura
en `web/lib/precio-visible.ts`, con su tabla de casos en
`web/lib/precio-visible.test.ts`. Todo lo que sea React se verifica a mano en el
quickstart.

**Rationale**: `web/vitest.config.ts` corre con `environment: "node"` e
`include: ["lib/**/*.test.ts"]`. **Nada en este repo renderiza React**, y está
dicho en dos lugares del código como límite conocido. O sea que "el monto no
aparece sin sesión" no se puede probar montando el componente: si se quiere una
guarda automática (FR-018), la decisión tiene que vivir fuera de React, en
`lib/`, donde además el precio está permitido.

La función recibe la zona resuelta y si hay sesión, y devuelve el monto o
`null`. El componente no decide nada: dibuja lo que la función le dio.

**Control positivo, no solo guarda negativa**: la tabla incluye el caso que
**debe** dar monto. Una prueba que solo afirma "acá no hay precio" pasa también
cuando la función devuelve `null` siempre, o sea cuando el feature no existe.
Antes de dar la tarea por hecha se rompe la implementación a propósito —hacer
que devuelva el monto sin mirar la sesión— y se comprueba la prueba **en rojo**.
Ver [[guarda-negativa-necesita-control-positivo]].

**Alternativas consideradas**:

- *Agregar jsdom y `@testing-library/react` para probar el componente.*
  Rechazada. Es infraestructura nueva para un feature de un archivo, choca con
  el Principio III (YAGNI) y con la decisión que ya está escrita en
  `vitest.config.ts`. Si algún día el repo necesita probar React, es una
  decisión propia y no el peaje de este feature.
- *Probarlo con el HTML exportado por `npm run build`.* Rechazada como guarda
  principal: ata la prueba al build, es lenta, y sobre todo **no prueba lo que
  importa** — el HTML estático es la rama `Un momento…`, que nunca tuvo
  formulario ni precio. Pasaría en verde aunque el feature filtrara el monto en
  el navegador.

---

## D4 — Formato del monto

**Decisión**: se reusa el formato que el sitio ya usaba antes de `013`: pesos
uruguayos, sin decimales, con separador de miles y el símbolo delante
(`$ 1.200`). Vive dentro de `precio-de-zona.tsx`.

**Rationale**: es el formato que los clientes de este negocio ya vieron durante
cuatro semanas, y `zonas.ts` documenta el campo como *"Pesos uruguayos. Monto
fijo por zona: no se multiplica por cantidad ni tamaño"*. No hay decisión que
tomar; hay una que reponer.

**Consecuencia a nombrar**: el monto es **por envío**, no por paquete. Como el
formulario pregunta cuántos paquetes, un cliente puede leer el número como
unitario. El texto que acompaña al monto tiene que dejarlo claro sin convertirse
en un total (FR-007a prohíbe el total). Se resuelve con la palabra, no con
aritmética.

---

## Riesgos que el plan hereda y no puede cerrar solo

1. **Los montos de zona pasan a ser una promesa.** Confirmado el 2026-09-10 que
   están vigentes. Nada en el código puede verificar eso; es del cliente.
2. **FR-005a, FR-006 y el parpadeo no tienen prueba automática posible** en este
   repo. Van al quickstart, y el quickstart es lo único que los ve. `022` cerró
   con la mitad del quickstart sin correr y eso ya está anotado en el tracker;
   este feature es chico y no hay excusa para repetirlo.
3. **La regla de desempate entre zonas superpuestas vuelve a ser visible.** No
   se toca (alteraría dato guardado), pero un cliente puede notar que un punto
   en el borde cotiza como la zona más barata.
