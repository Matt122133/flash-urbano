# Tasks: La etiqueta de 12 x 10

**Input**: Design documents from `/specs/028-etiqueta-12x10/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md)

**Tests**: SI, y no son opcionales en este feature. Son la razon de ser del
diseño: `research.md` D4 introduce `etiqueta-maqueta.ts` **precisamente para que
FR-003, FR-004 y FR-007 se puedan afirmar en una prueba**. Un feature que agrega
un modulo para hacer algo verificable y despues no lo verifica pago la
complejidad y no se llevo nada.

**Organization**: por historia de usuario, en el orden de prioridad del spec. El
orden entre fases **no es una preferencia de estilo**: la maqueta tiene que
existir antes que el dibujo, porque el dibujo la recorre.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (otro archivo, sin depender de algo incompleto)
- **[Story]**: a que historia pertenece (US1, US2, US3, US4)

## Path Conventions

Una sola de las tres superficies del repo: `web/`. Rutas relativas a la raiz.
La frontera es el `covers:` del plan.

---

## Phase 1: Setup

**Purpose**: saber de donde se parte, para que un rojo mas tarde signifique algo.

- [x] T001 Correr `cd web && npm install && npm run lint && npm test && npm run build` y anotar que queda **verde antes de tocar nada**. Si ya hay algo rojo en `master`, eso es otro problema y se resuelve o se anota antes de empezar; arrancar sobre rojo hace que el primer fallo propio sea indistinguible del heredado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la maqueta como dato. **Bloquea absolutamente todo lo demas**: sin
esta estructura no hay dibujo nuevo ni prueba de geometria.

- [x] T002 Crear `web/lib/etiqueta-maqueta.ts` con los tipos de [data-model.md](data-model.md): `Maqueta`, `Elemento`, `Rect`, `Segmento`, y la union de `bloque`. Sin logica todavia. Documentar arriba del archivo **por que existe** —la geometria tiene que ser inspeccionable— con la misma disciplina de comentario que tienen `etiqueta.ts` y `etiqueta-pdf.ts`.
- [x] T003 En `web/lib/etiqueta-maqueta.ts`, definir las constantes de [research.md](research.md) D2 y D3: el rectangulo en `x ∈ [15,135], y ∈ [15,115]`, margen interno de 5 mm, la conversion `pt x 0.440972 = mm` de interlineado, la tabla de cuerpos corrientes y **la tabla de pisos**. Exportar los pisos: la prueba los lee de aca, no los repite.
- [x] T004 En `web/lib/etiqueta-maqueta.ts`, implementar `maquetar(etiqueta, medir)` con el medidor **inyectado** (research D5), devolviendo `recorte`, `marcas`, `elementos`, `ajuste` y `comentarioCortado`. `medir(texto, pt) => mm` nunca se sustituye por un conteo de caracteres: *"Piñeyro"* y *"MMMMMMM"* tienen las mismas siete letras y ocupan anchos distintos.
- [x] T004b En `web/lib/etiqueta-maqueta.ts`, implementar `ajuste` como **interpolacion por bloque contra su propio piso** —`pt = corriente + (piso - corriente) x ajuste`— y **no** como multiplicador global. El analyze del 2026-09-19 midio por que: los rotulos tienen 8 % de aire hasta su piso y el codigo 24 %, asi que un factor global se frena en el bloque mas apretado y **deja 9.08 mm recuperables sin usar**. Ver [data-model.md](data-model.md), *Por que `ajuste` interpola por bloque*.

**Checkpoint**: `maquetar()` devuelve la estructura para una `Etiqueta` armada a
mano, **sin que exista todavia un solo PDF nuevo**.

---

## Phase 3: US1 — La etiqueta sale del tamaño que pidieron (P1)

**Goal**: que del papel salga un rectangulo de 120 x 100 mm, recortable.

**Independent test**: imprimir una hoja al 100 %, medir de marca a marca con una
regla, recortar, y comprobar que no quedo nada afuera ni marco impreso.

- [x] T005 [US1] En `web/lib/etiqueta-maqueta.ts`, generar las **cuatro escuadras de esquina** como `marcas`: afuera del rectangulo, 2 mm de separacion del vertice, brazos de 5 mm, grosor 0.2 mm (research D2). **Nada de recuadro entero**, ni punteado ni solido (FR-002).
- [x] T006 [US1] Crear `web/lib/etiqueta-maqueta.test.ts` con la regla 1 de [data-model.md](data-model.md): **ningun elemento se sale del recorte** (FR-003), con las `marcas` explicitamente excluidas porque viven afuera a proposito.
- [x] T006b [US1] En `web/lib/etiqueta-maqueta.test.ts`, la regla 7: **la hoja no lleva nada mas** fuera del recorte que las `marcas` (FR-002b). Es lo que hace comprobable la decision de dejar la hoja limpia, sin la linea de *"imprimir al 100 %"* que se evaluo y se descarto.
- [x] T007 [US1] EL CONTROL POSITIVO de T006, y no es opcional: bajar el margen interno de 5 mm a 0 en `web/lib/etiqueta-maqueta.ts`, correr `npm test` y **ver la prueba de FR-003 en ROJO**, nombrando el elemento que se salio. Despues deshacer. Una guarda negativa que nunca se vio en rojo no prueba nada.
- [x] T008 [US1] Reescribir `web/lib/etiqueta-pdf.ts` para que llame a `maquetar()` y **recorra los elementos** llamando a `doc.text`, `doc.roundedRect`, `doc.line` y `doc.addImage`. Las constantes `ANCHO/ALTO/MARGEN/UTIL` dejan de describir la A4 y pasan a describir el rectangulo. Se conserva la escala de grises (`NEGRO`, `GRIS`) y el motivo: la hoja se imprime en mono. **`format: "a4"` no cambia** (research D1).
- [x] T009 [US1] Dibujar las `marcas` en `web/lib/etiqueta-pdf.ts` y comprobar a ojo, abriendo el PDF, que el rectangulo cae donde dice D2 y que las escuadras quedan a 10 mm del borde del papel.

**Checkpoint**: se descarga un PDF, se imprime y se mide. US1 entregable sola.

---

## Phase 4: US2 — El pedido de todos los dias se lee comodo (P1)

**Goal**: que un pedido corriente salga con tipografia comoda, que es el 90 % de
lo que se va a imprimir y donde se gana o se pierde el feature.

**Independent test**: imprimir tres o cuatro pedidos reales, recortar y leerlos
parado.

- [x] T010 [US2] En `web/lib/etiqueta-maqueta.ts`, ubicar los seis bloques segun el presupuesto de research D3: encabezado, caja del codigo, ENTREGAR A, RETIRAR DE, COMENTARIO y pie. **La entrega pesa mas que el retiro** (FR-010) y el codigo domina (FR-011).
- [x] T011 [US2] En `web/lib/etiqueta-maqueta.ts`, implementar el corte de texto en renglones con el medidor inyectado (FR-013), respetando **los renglones que escribio la persona** en el comentario, como hace `026` hoy.
- [x] T012 [US2] En `web/lib/etiqueta-maqueta.ts`, omitir **el bloque entero** del comentario cuando no hay —ni rotulo ni hueco (FR-016 de `020`, FR-011)— y devolver ese alto a los demas bloques. Lo mismo con la zona cuando el pedido no tiene punto de entrega: **nunca se deduce de la direccion escrita**.
- [x] T013 [P] [US2] En `web/lib/etiqueta-maqueta.test.ts`, la regla 3 de data-model: **un pedido corriente no se achica** — `ajuste === 0` y `comentarioCortado === false` (FR-005). Es la prueba que defiende la decision de Mateo del 2026-09-19 de maquetar para el caso real.
- [x] T014 [P] [US2] En `web/lib/etiqueta-maqueta.test.ts`, la regla 2: **ningun cuerpo baja de su piso** (FR-007), leyendo la tabla exportada en T003.
- [x] T015 [US2] EL CONTROL POSITIVO de T014: bajar a mano un cuerpo por debajo de su piso y **ver la prueba en ROJO**. Deshacer.
- [x] T016 [US2] En `web/lib/etiqueta-maqueta.test.ts`, la regla 6: **no existe la pagina dos** (FR-004) — dejar escrito, como caso o como comentario del archivo, que no se prueba porque *no se puede expresar* en esta estructura. Que sea deliberado y no un olvido.
- [x] T016b [US2] **El punto de ajuste, si el presupuesto no cierra al dibujar.** Con 0.83 mm de sobra es probable que haga falta aca y no al final: los puntos de ajuste son **los aires entre bloques y el cuerpo del codigo, en ese orden**, y **nunca el piso de la entrega**, que es la direccion a la que hay que llegar. **Actualizar la tabla de research D3 en el mismo cambio**: una tabla que dice 89.17 de 90 cuando el codigo dice otra cosa es peor que no tenerla.

**Checkpoint**: un pedido corriente se lee comodo en papel. US2 entregable.

---

## Phase 5: US3 — La misma etiqueta desde Mis pedidos (P2)

**Goal**: que el re-maquetado no haga divergir las dos pantallas.

**Independent test**: imprimir el mismo pedido desde la confirmacion y desde su
tarjeta en Mis pedidos, y comparar las dos hojas.

- [x] T017 [US3] En `web/lib/etiqueta-maqueta.test.ts`, comprobar que `maquetar()` produce **la misma maqueta** para la `Etiqueta` que sale de `etiquetaDelFormulario()` y para la que sale de `etiquetaDelPedido()` con los mismos datos (FR-019). El corte de `020` ya garantiza que las dos convergen en `Etiqueta`; esto garantiza que de ahi para adelante tampoco se bifurcan.
- [x] T018 [US3] Comprobar a mano, con el sitio levantado, que el boton de la tarjeta de Mis pedidos sigue funcionando sin tocar `web/components/pedido/boton-imprimir.tsx`. **Si hace falta tocarlo, PARAR**: esta fuera de `covers:` a proposito y es una decision, no un ajuste.

---

## Phase 6: US4 — El caso extremo no arruina la etiqueta (P3)

**Goal**: que el tope de contenido salga apretado pero entero. **Es P3 por
decision de Mateo**: no se deforma el diseño por el, pero el corte con tijera es
fisico y lo que cae afuera no se lee nunca.

**Independent test**: armar el pedido mas largo que el formulario acepta,
imprimir, recortar y mirar que sobrevivio.

- [x] T019 [US4] En `web/lib/etiqueta-maqueta.ts`, implementar el achique (FR-006): subir `ajuste` desde 0 hasta que el contenido entre, con la interpolacion por bloque de T004b. **Achicar es la regla.**
- [x] T020 [US4] En `web/lib/etiqueta-maqueta.ts`, implementar el ultimo recurso (FR-008): **solo con `ajuste === 1`** —o sea, con todos los bloques exactamente en su piso— y todavia sin entrar, **cortar el comentario** con marca visible de que sigue y poner `comentarioCortado = true`. **Nunca una direccion, nunca un telefono.** La condicion de `ajuste === 1` es lo que impide cortar mientras quede aire en algun bloque.
- [x] T021 [P] [US4] En `web/lib/etiqueta-maqueta.test.ts`, la regla 4: un pedido en el tope **sigue entrando** en el recorte, con `ajuste > 0` permitido.
- [x] T022 [P] [US4] En `web/lib/etiqueta-maqueta.test.ts`, la regla 5: cuando `comentarioCortado === true`, **los bloques de entrega y retiro siguen completos** —ningun texto suyo termina en la marca de corte— **y `ajuste === 1`**, que es la guarda contra cortar de mas.
- [x] T022b [P] [US4] En `web/lib/etiqueta-maqueta.test.ts`, el caso que el analyze midio: **un comentario de 280 caracteres corridos NO se corta.** A 6.5 pt necesita 11.24 mm contra los 10.36 presupuestados, y llevar los bloques a sus pisos libera 9.08: entra con aire de sobra. Si esta prueba se pone roja, el achique de T019 no esta recuperando lo que puede.
- [x] T023 [US4] En `web/lib/etiqueta-maqueta.test.ts`, el caso del **comentario corto de muchos renglones** (indicaciones cortas, una por linea). Gasta alto sin gastar caracteres y **es mas probable que el tope de 280**. El analyze lo ubico: cinco renglones todavia entran, y FR-008 recien dispara alrededor de **siete u ocho**. Probar los dos lados de esa frontera, para que la prueba diga donde esta y no solo que existe.

---

## Phase 7: Polish & Cross-Cutting

- [x] T024 Agregar `lib/etiqueta-maqueta.ts` a la lista `ARCHIVOS` de la guarda de `window.print()` en `web/lib/etiqueta.test.ts` (FR-017 de `020`). Una linea; ninguna afirmacion existente se toca.
- [x] T024b **Tapar el agujero del Principio V que encontro el analyze.** En `web/lib/etiqueta.test.ts`, extender la guarda de **grafo de imports** para que recorra tambien `lib/etiqueta-maqueta.ts` y afirme que **no alcanza `lib/zonas.ts` ni `lib/api.ts` por ningun camino**. Motivo: `sin-precio-a-la-vista.test.ts` escanea `app/` y `components/` y **deja `lib/` afuera a proposito** —ahi el precio tiene que seguir viviendo—, asi que un modulo nuevo en `lib/` nace **sin ninguna proteccion**. Sin esto, el feature debilita la guarda del Principio V en vez de dejarla igual. Con su **control positivo**: el recorrido tiene que encontrar `zonas.ts` cuando de verdad esta.
- [x] T025 Correr `verify:` entero: `cd web && npm run lint && npm test && npm run build`. Verde antes de tocar papel.
- [x] T026 Ejecutar [quickstart.md](quickstart.md) **completo**, con impresora, tijera y regla. No es una nota al pie: **SC-001 (mide 12 x 10), SC-003 (se lee comodo) y SC-005 (el codigo a un brazo) no los toca ninguna prueba automatica** (research D7), y `020` y `012` los dos salieron con defectos que compilaban perfecto.
- [x] T027 Comprobar en el quickstart los dos riesgos que el plan marco como mas probables: que **26 pt se lean de verdad a un brazo** —el piso es una hipotesis de papel, no una medicion— y que **la silueta del camion no se vuelva una mancha** al pasar de 13 mm de alto a 5, impresa en mono.
- [ ] T028 **El reajuste despues del papel**, que Mateo anticipo como probable (*"despues probamos y vemos de cambiar algo"*). A diferencia de T016b —que resuelve que el presupuesto no cierre— este resuelve que **cierre y se vea mal**, que es otra cosa y solo se descubre impreso. Mismas reglas: los aires y el cuerpo del codigo primero, **el piso de la entrega nunca**, y la tabla de research D3 se actualiza en el mismo cambio. Si el ajuste toca un **piso**, eso ya no es un ajuste: es cambiar lo que FR-007 promete y va anotado como tal.
- [x] T029 Antes de cerrar: bajar el `npm run dev`, y pasar el cambio por staging —la web de staging corre local (`docs/processes/staging.md`)— antes de que llegue a `master`.

---

## Que se verifico de verdad, y que no (2026-09-19)

**Se verifico, contra el backend de staging**: el camino entero funciona. Login,
pedido creado (`FU-0002`), boton, PDF descargado desde las dos pantallas. Mateo
lo miro y lo dio por bueno: *"se ve reee bien"*. Eso cierra lo que importaba de
US1, US2 y US3 —la hoja se ve como tiene que verse— y cierra T029, porque **la
web de staging corre local** y es contra staging que se ejercito.

**NO se verifico con una regla sobre papel impreso.** SC-001 dice *"la etiqueta
recortada mide 12 cm x 10 cm, medida con una regla"*, y esa medicion no consta.
Se anota como lo que es —un hueco, no un tramite— por tres motivos:

- **No es un defecto de codigo**: la geometria esta afirmada en
  `etiqueta-maqueta.test.ts`, y el PDF sale de 210 x 297 con el rectangulo en
  x ∈ [15,135], y ∈ [15,115]. Si el papel no da 12 x 10, es la impresora
  escalando.
- **Pero es justo lo que el spec decidio no prevenir.** El 2026-09-19 se evaluo
  imprimir *"imprimir al 100 %, recortar por las marcas"* en la hoja y se
  descarto para que quedara limpia. La contrapartida quedo escrita en *Edge
  Cases*: el producto no avisa, y la unica defensa es que el error **se pueda
  medir**. Si nadie mide, esa defensa no existe.
- **Cuesta treinta segundos** la primera vez que alguien imprima una de verdad.

Lo mismo con los dos riesgos de T027 —que 26 pt se lean a un brazo y que la
silueta impresa en mono no sea una mancha—: se miraron **en pantalla**, que es
donde peor se juzgan las dos cosas.

---

## Requisitos cubiertos sin tarea propia

El analyze del 2026-09-19 los marco como huerfanos. **No lo son, pero no estaba
escrito por que**, y un requisito sin tarea y sin explicacion es indistinguible
de un olvido:

- **SC-010** — *no queda ninguna forma de obtener la etiqueta A4*. Se cumple
  **por construccion**: `020` dejo **una sola** maqueta y este feature la
  reescribe en el lugar (research D6). No hay selector de tamaño que sacar ni
  segundo camino de dibujo que borrar. Si alguna vez aparece un segundo formato,
  deja de cumplirse solo.
- **FR-014** — *ningun importe*. Lo cubre la guarda que ya existe sobre
  `etiqueta.ts`, que **no se toca**, mas T024b, que es lo que impide que el
  modulo nuevo abra una puerta nueva.
- **FR-018** — *tildes, ñ y diereses*. Heredado de `020`: los caracteres del
  español entran en WinAnsi y **no se cambia de fuente**. Que el visor los dibuje
  se mira en el quickstart (§2.3), no en una prueba.
- **FR-023** — *el nombre del archivo lleva el codigo*. `nombreDeArchivo()` vive
  en `etiqueta.ts`, que no se toca, y su prueba sigue verde.

---

## Dependencies

```text
Phase 1 (T001)
   └─> Phase 2 (T002 → T003 → T004 → T004b)        BLOQUEA TODO
          ├─> Phase 3 US1 (T005 → T006 ‖ T006b → T007 → T008 → T009)
          │       └─> Phase 4 US2 (T010 → T011 → T012, luego T013‖T014 → T015 → T016 → T016b)
          │              ├─> Phase 5 US3 (T017 → T018)
          │              └─> Phase 6 US4 (T019 → T020, luego T021‖T022‖T022b → T023)
          └─> T024 ‖ T024b  (solo necesitan que el modulo exista: se pueden hacer
                             apenas termina Phase 2, aunque figuren en Phase 7)
                 └─> Phase 7 (T025 → T026 → T027 → T028 → T029)
```

**T024 y T024b estan listados en Phase 7 y colgados de Phase 2 a proposito**: son
independientes del dibujo, asi que se pueden adelantar. **T024b conviene
adelantarlo**: es la guarda del Principio V, y una guarda sirve mientras se
escribe el codigo que podria violarla, no despues.

**La dependencia dura es Phase 2 → Phase 3.** El dibujo recorre la maqueta; antes
de que la maqueta exista no hay nada que recorrer. US2 depende de US1 porque el
presupuesto vertical se ubica **dentro** del rectangulo que US1 define.

## Parallel opportunities

Poco, y es honesto decirlo: casi todo el feature vive en dos archivos que se
escriben en orden. Lo que si va en paralelo:

- **T006 y T006b** — dos reglas independientes sobre la misma estructura.
- **T013 y T014** — dos casos de prueba independientes en el mismo archivo.
- **T021, T022 y T022b** — idem.
- **T024 y T024b** — se pueden adelantar apenas exista el modulo (ver el grafo).

Las tareas de control positivo (**T007, T015**) **no** son paralelizables por
definicion: rompen la implementacion a proposito, asi que mientras corren nada
mas puede estar corriendo pruebas.

## Implementation Strategy

**MVP = Phase 2 + Phase 3 (US1).** Con eso ya sale un PDF cuyo rectangulo mide
12 x 10 y se recorta, que es literalmente lo que el cliente de Diego pidio.
Feo, pero medible y demostrable.

**Incremento 2 = Phase 4 (US2)**, que es donde el feature se vuelve bueno en vez
de correcto.

**Phase 6 (US4) es la que se puede diferir** si aprieta el tiempo: es P3, el
riesgo esta aceptado por escrito, y lo unico que no se puede diferir de ella es
**T020**, porque sin el ultimo recurso un comentario largo se dibuja fuera del
recorte y la tijera se lo lleva. Si se difiere el resto, va al tracker de deuda,
no a un "despues lo vemos".
