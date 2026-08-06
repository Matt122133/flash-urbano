# Phase 0 — Research

Cinco decisiones. Ninguna necesitó investigación externa: todas se resuelven
leyendo el código que ya está y el doc del cliente. Lo que sigue es el
razonamiento, para que la ejecución no lo rehaga.

---

## R1 — Qué queda de `web/lib/fechas.ts`

**Decisión**: se achica, no se borra. Sobreviven los tipos `Fecha` y `Hora`, la
función `hoy()`, y **una sola** comprobación: que la fecha de retiro no caiga en
un día que ya terminó. Se van `MARGEN_MINIMO_MINUTOS`, la función privada
`enMinutos()`, y dos de los tres `ProblemaDeFechas`
(`entrega-antes-del-retiro`, `margen-insuficiente`).

`problemaDeFechas()` recibe hoy cuatro campos y devuelve un veredicto de tres
valores. Con la entrega fuera, recibiría uno y devolvería dos valores, uno de
los cuales es `null`. Eso ya no es un veredicto: es un booleano con disfraz.
Se reemplaza por una función de nombre honesto —del tipo
`retiroEnElPasado(fecha, diaDeHoy)`— que devuelve `boolean`, y el mensaje sale
de una constante en lugar de un `Record` de un solo elemento.

**Por qué no borrarlo entero.** El encabezado del módulo explica por qué existe:
los errores que importan están en los bordes —cambio de mes, mismo día— y eso se
verifica con pruebas, no mirando la pantalla. Esa razón sobrevive al recorte. La
comparación **por día y no por instante** también se queda: es una decisión
deliberada ya documentada en el módulo ("alguien cargando un pedido a las 9 para
retirar hoy a las 8 es un caso raro"), y este feature no la revisa.

**Alternativas consideradas**:

- *Mover la comprobación adentro de `pedido-form.tsx`.* Rechazada: devuelve al
  formulario una lógica de bordes que se sacó de ahí justamente para poder
  probarla, y `pedido-form.tsx` no tiene pruebas.
- *Dejar `problemaDeFechas()` con la firma actual e ignorar los campos de
  entrega.* Rechazada: deja parámetros muertos en una firma pública y una unión
  de tipos con dos variantes inalcanzables. Es el tipo de residuo que después
  nadie se anima a tocar.

**Costo en pruebas, explícito.** `fechas.test.ts` tiene 17 casos. Sobreviven
cuatro: *rechaza el retiro en un dia que ya paso*, *acepta el retiro hoy mismo*,
*no opina si faltan las fechas* (reducido al retiro) y *formatea como lo espera
un input de tipo date*. Los otros trece —margen mínimo, orden entre retiro y
entrega, cruce de medianoche, mismo instante— **dejan de existir porque su
sujeto dejó de existir**, no porque queden pendientes. El caso de cruce de fin de
mes se conserva reformulado sobre el retiro, que es donde sigue habiendo
aritmética de calendario.

---

## R2 — Cómo se elige la zona cuando hay más de una

**Decisión**: entre todas las zonas que contienen el punto, gana **la de menor
`precio`**; si dos empatan en precio, gana **la de menor `id`**. Y la función
que implementa la regla toma la lista de zonas por parámetro, con
`resolverZona()` como envoltorio delgado sobre la constante `ZONAS`.

**Por qué cambia algo si el resultado hoy es el mismo.** `resolverZona()`
recorre `ZONAS` en orden y devuelve la primera que contenga el punto. Los
precios de las cinco zonas son 150, 200, 250, 250 y 350, en ese orden de id: la
lista está ordenada por precio creciente **por casualidad**, así que "la primera
que contiene" y "la más barata que contiene" hoy dan lo mismo. El día que el
cliente repricee una zona y rompa esa monotonía, el sitio empieza a cobrar de
más en una franja entera de direcciones reales —Bulevar Artigas, Avenida Italia,
8 de Octubre son borde de zona y tienen cientos de esquinas encima— y **ningún
test lo detecta**, porque todos los tests corren contra la lista real, donde el
accidente sigue en pie.

**Por qué la función tiene que tomar la lista por parámetro.** Es el punto que
hace la diferencia entre una prueba real y una tautología. Para verificar que la
regla no depende del orden hace falta un caso donde **la más barata no sea la
primera**, y ese caso no se puede construir con las cinco zonas reales sin
mentir sobre el dato. Con la lista como parámetro se prueba contra dos polígonos
sintéticos superpuestos, con el caro primero, y la prueba falla si alguien
vuelve al "primero que contenga".

**Alternativas consideradas**:

- *Reordenar `ZONAS` por precio y dejar el recorrido como está.* Rechazada por
  dos motivos. `zonas.ts` es **dato generado** por `design-source/build-zonas.js`
  y no se edita a mano; y hay un test que afirma que las zonas vienen "ordenadas
  por id", que habría que romper. Además deja la regla del negocio codificada
  como un orden de lista, que es exactamente el problema que se quiere sacar.
- *Mockear el módulo `zonas.ts` en el test.* Rechazada: acopla la prueba al
  sistema de módulos en lugar de a la lógica, y hace ilegible el caso justo
  donde más importa que se lea.
- *Devolver la zona de menor precio y nada más, sin desempate por id.*
  Rechazada: hoy hay dos zonas a $250. Sin segundo criterio, cuál gana depende
  del orden de iteración, que es la fragilidad que se está eliminando. FR-022
  pide estabilidad y esto la da.

**Lo que no cambia**: un punto fuera de las cinco sigue devolviendo `null`, y
sigue sin existir "la zona más cercana" (FR-023). El comentario del módulo hoy
dice que el desempate es una convención interna sin respuesta correcta; eso pasó
a ser falso y hay que reescribirlo: ahora es la respuesta del cliente.

---

## R3 — El número de WhatsApp en formato de enlace

**Decisión**: `092 171 791` se escribe `59892171791` en el enlace `wa.me`, y
`092 171 791` como texto a la vista.

Los celulares uruguayos son `09X XXX XXX`. El enlace `wa.me` pide el número
internacional sin `+`, sin espacios y sin el cero inicial de la marcación
nacional: código de país `598` + `92171791` = `59892171791`, once dígitos. Es la
misma forma que tenía el número ficticio que se reemplaza (`59899000000`), así
que la construcción del enlace no cambia — cambia el valor.

**El segundo número no se publica.** El cliente tiene dos (`092 171 791` y
`091 060 320`) y eligió publicar el primero. El motivo está en el spec: un
enlace que abre la conversación directamente tiene que apuntar a uno solo, y
ofrecer dos le traslada a quien escribe una decisión que le es indiferente. El
segundo queda registrado en el spec por si alguna vez hace falta.

**Se agrega el número como texto.** Hoy la tarjeta de WhatsApp dice "WhatsApp" y
"La forma más rápida de coordinar tu envío", y el número no aparece en ningún
lado — solo vive dentro del `href`. La de email sí muestra la dirección. FR-016
pide que el número sea legible, y además sirve a quien quiere copiarlo o
llamar.

---

## R4 — Qué implica sacar el `noindex`

**Decisión**: se borra `robots: { index: false, follow: false }` del objeto
`metadata` de `web/app/layout.tsx`, junto con el comentario que lo justifica. No
hace falta nada más.

El sitio no tiene `robots.txt` ni `sitemap.ts` ni `sitemap.xml` — `web/public/`
contiene solamente el índice de calles y dos logos. La única señal de "no me
indexes" que emite el sitio es esa línea, que Next convierte en la etiqueta
`<meta name="robots">` de todas las páginas por herencia del layout raíz.
Borrarla es suficiente para cumplir FR-018.

**Los dos motivos del comentario dejan de aplicar, y conviene verificarlo y no
suponerlo.** El comentario declara: "telefono y email de contacto ficticios y
precios de zona sin validar".

- El email ya era real desde el 2026-08-04. El teléfono pasa a serlo en este
  mismo feature — por eso el `noindex` sale acá y no antes.
- Los precios los definió el cliente. El doc de relevamiento lo corrobora por
  fuera del mapa: *"COBRO POR COLON ES DECIR ZONA 2 $ 200"*, y `zonas.ts` tiene
  Zona 2 en 200. La última pregunta abierta sobre el cobro —qué zona paga una
  dirección sobre el límite— es justamente la que R2 resuelve.

**Alternativa considerada**: *dejar el `noindex` hasta después de mergear y
sacarlo en un commit aparte.* Tiene mérito —indexarse es difícil de revertir—
pero parte el feature en dos y deja el repo en un estado donde el motivo
declarado del `noindex` ya no existe. Se resuelve con orden de ejecución (es el
anteúltimo paso, con el número real ya puesto) y no con un commit separado.

---

## R5 — La clave del error del teléfono del destinatario

**Decisión**: la clave se llama `receiverPhone`, escrita idéntica en
`validate()` y en el render, y el caso se cubre al probar el formulario a mano
según `quickstart.md`.

Suena a trivialidad y no lo es: es exactamente el defecto que este feature
elimina de casualidad. Hoy `validate()` escribe `errors.recieverName` —con la
`i` y la `e` traspuestas— y el render lee `errors.receiverName`. Las dos claves
no coinciden, así que **el mensaje nunca se muestra**. El campo igual bloquea el
envío, con lo cual el formulario se niega a enviarse sin decir por qué. Está
registrado como `Medium` en el tracker desde el 2026-08-02 y sobrevivió a dos
features porque arreglarlo caía siempre fuera del `covers:` de turno.

El campo que lo contenía desaparece en este feature, así que la fila se cierra
sola. Lo que queda es la lección: **el campo nuevo no puede repetirlo**. La
guarda no es un test —`pedido-form.tsx` no tiene pruebas y agregarle un entorno
de DOM es un feature aparte, no un paso de este— sino un paso explícito de
validación manual en `quickstart.md`: dejar el campo vacío, intentar enviar, y
**ver el mensaje**. FR-014 existe por esto.

**Alternativa considerada**: *tipar las claves de error contra las del
`FormState`* para que el compilador atrape la discrepancia. Es la solución
correcta y sigue estando disponible, pero es un refactor del formulario entero
—alcanza a los diez campos, no al nuevo— y `AGENTS.md` prohíbe la limpieza
oportunista fuera de los pasos del plan. Va al tracker como deuda propuesta, no
a este feature.
