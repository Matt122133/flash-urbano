# Research — `014` Dos campos en pausa

Fase 0. Cinco decisiones, con la alternativa descartada. Lo que ya decidió el
cliente no se re-discute acá.

## D1 — Dónde vive cada campo, y qué se toca de cada uno

Se rastrearon los dos campos por todo `web/` antes de planificar:

| Archivo | Qué tiene | Qué pasa |
|---|---|---|
| `components/pedido-form.tsx` | el `<select>` de tamaño y el `<input type="time">`, sus dos `Field` | se comentan (FR-001, FR-002, FR-003) |
| `components/pedido-form.tsx` | `validate()`: `"Elegí un tamaño de paquete."` y `"Elegí un horario de retiro."` | se comentan (FR-005) |
| `components/pedido-form.tsx` | `Confirmation`: `Tamaño ${form.packageSize}` y `${form.pickupDate} ${form.pickupTime}` | tamaño fuera; la fila de retiro deja solo la fecha (FR-006) |
| `components/pedido/crear-pedido.tsx` | `tamano: form.packageSize \|\| "chico"` y `hora: form.pickupTime` | pasan a los valores fijos (FR-004) |
| `components/pedido/tarjeta-pedido.tsx` | `Retiro el <fecha> a las <hora>` y `<tamaño> · N paquetes` | se ocultan los dos (FR-006a) |
| `lib/repetir.ts` | `packageSize` en `CamposRepetidos` | se conserva, no se muestra (FR-009) |

**Lo que NO se toca y hay que decirlo**: `FormState` conserva `packageSize` y
`pickupTime`, `INITIAL_STATE` los inicializa igual, y el tipo `PackageSize`
sigue existiendo. Borrarlos obligaría a reescribirlos cuando vuelvan, que es
exactamente lo que el cliente pidió evitar.

## D2 — Comentar código es normalmente un defecto. Acá no, y con condiciones

La regla del repo es *si no está en el repo no existe*, y su corolario habitual
es que el código muerto se borra: git lo guarda, y un bloque comentado es una
pregunta sin responder para todo el que lo lea después.

**Se comenta igual, porque el cliente lo pidió explícitamente y dio el motivo**:
va a volver a usar los dos campos. Esa es una respuesta que git no da — el
historial dice qué se sacó, no que alguien planea reponerlo.

**Decisión**: se comenta, y cada bloque paga un peaje (FR-003). Tiene que decir:

1. qué feature lo desactivó y en qué fecha;
2. que fue decisión del cliente y que **dijo que vuelve**;
3. qué hay exactamente que descomentar para reponerlo — incluida la validación,
   que vive en otro lugar del archivo y es lo que se olvida.

Sin las tres, en tres meses nadie va a saber si eso se borra o no, y el bloque
se queda para siempre por las dudas. **El peaje es la diferencia entre "en
pausa" y "código muerto".**

**Alternativa descartada**: borrar y confiar en git. Es lo que haría por defecto,
y acá sería desobedecer una instrucción explícita para ganar prolijidad.

## D3 — El backend no se toca, y por qué eso es lo correcto y no lo cómodo

El pedido original decía *"hagamos que en el backend sea receptivo vaya o no"*.
Se ofrecieron tres caminos y Mateo eligió el más conservador: **el sitio manda
siempre un valor, así que el servicio nunca ve el campo ausente**.

**Decisión**: `backend/` no cambia una línea. `paquete_tamano` sigue
`NOT NULL CHECK (chico|mediano|grande)` y `retiro_hora` sigue `time NOT NULL`,
con su índice sobre `(retiro_fecha, retiro_hora)` intacto.

**Por qué**: hacerlos opcionales de verdad es una migración sobre una tabla que
**ya tiene los pedidos reales de Diego**. El 2026-08-12 una migración de esa
misma tabla —`entrega_punto` a nullable— tumbó producción porque se dio por
sentado que no había filas. Este feature no gana nada con ese riesgo: el
formulario no le pregunta a nadie, y el valor se completa una línea antes de
salir a la red.

**Lo que eso cuesta, dicho de frente**: el API queda menos tolerante de lo que
Mateo pidió literalmente. El día que otro cliente del servicio —o el propio
sitio, tras un refactor— mande el pedido sin esos campos, va a recibir un 400.
Está anotado como el riesgo que sostiene esta decisión, no escondido.

**Alternativa descartada**: aceptar los campos ausentes y guardar un default en
el servicio. Es la opción intermedia que se ofreció; se descartó porque agrega
código de servicio para un caso que el único cliente que existe nunca produce.

## D4 — Los valores fijos: `chico` y `16:00`

**`chico` no se eligió por bonito: es el respaldo que el sitio ya aplica hoy.**
`crear-pedido.tsx` tiene `form.packageSize || "chico"` desde antes de este
feature, para el caso de que el campo llegara vacío. Elegir cualquier otro
—`mediano`, por ejemplo— cambiaría el comportamiento de un camino que ya existe.
Con este, el pedido sin tamaño se comporta exactamente igual que antes.

**`16:00` es lo que Diego hace**: pasa a esa hora.

**Los dos son datos que dejan de ser verdad**, igual que `precio` después de
`013`. Desde este feature `paquete_tamano` dice `chico` sobre paquetes que nadie
midió y `retiro_hora` dice `16:00` sobre pedidos que nadie agendó. **Nadie puede
leer esas columnas para decidir nada.**

## D5 — La tarjeta de *Mis pedidos*, y el dato viejo que se pierde

La tarjeta muestra los dos valores. Sin tocarla, todo pedido nuevo le diría al
cliente *"Retiro el 3/9 a las 16:00 · chico"* sobre cosas que el cliente nunca
eligió.

**Decisión**: se ocultan los dos, **para todos los pedidos, viejos incluidos**
(FR-006a).

**Y el costo es real**: los pedidos anteriores a hoy sí tenían un tamaño y una
hora que la persona eligió de verdad, y esa historia deja de verse.

**Alternativa descartada**: distinguir por época —mostrar el dato en los viejos y
no en los nuevos—. Es lo más correcto de las tres y lo más caro: hay que saber de
qué era es cada pedido, y la única señal disponible sería comparar contra los
valores fijos, que es adivinar. Maquinaria que este cambio no justifica
(Principio III).

**La fecha de retiro se queda en la tarjeta**, porque la persona sí la eligió.
