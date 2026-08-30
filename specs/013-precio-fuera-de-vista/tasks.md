---

description: "Tareas de 013 — El precio sale de la vista, y el sábado se coordina"
---

# Tasks: El precio sale de la vista, y el sábado se coordina

**Input**: `specs/013-precio-fuera-de-vista/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md), [quickstart.md](quickstart.md)

**Tests**: sí, y una sola es obligatoria: la guarda de FR-020. El spec la pide
explícitamente, y es el único control que impide que este feature se deshaga
solo. No hay pruebas de UI en este repo y este plan no las trae (research D2).

**Organization**: por historia de usuario, en orden de prioridad.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: se puede hacer en paralelo (archivo distinto, sin dependencia
  pendiente)
- **[Story]**: a qué historia pertenece (US1…US4)
- Cada tarea nombra el archivo exacto

## Path Conventions

Superficie única `web/`, en la raíz del repo. `backend/` y `android/` **no se
tocan**: es un requisito (FR-015, FR-016), no una omisión.

---

## Phase 1: Setup

- [x] T001 Correr `verify:` **antes de tocar nada** — `cd web && npm run lint && npm test && npm run build` — y anotar el resultado acá. Sirve para una sola cosa y es importante: si más tarde algo sale en rojo, hay que poder distinguir lo que rompió este feature de lo que ya venía roto **HECHO**: exit 0 — lint limpio, 147 pruebas, build OK. Cualquier rojo posterior es de este feature.

---

## Phase 2: Foundational (bloquea todas las historias)

- [x] T002 Regenerar `web/lib/zonas.ts` con el generador, nunca a mano: `cd web && node design-source/build-zonas.js design-source/zonas-flash-urbano.kml lib/zonas.ts`. **Comprobar que el diff toca solo el anillo de la Zona 5** (research D5): si toca otra zona, el KML trae más cambios de los que se creía y hay que frenar y preguntar. Correr `npm test` y confirmar que la prueba de cierre de anillos pasa **HECHO**: el generador reporta las cinco zonas y 459 vertices. El diff son 10 lineas y `git diff -U40` confirma que **caen todas dentro de `id: 5`**. Ninguna otra zona se movio.
- [x] T003 Escribir la guarda de FR-020 en `web/lib/sin-precio-a-la-vista.test.ts`, **y dejarla en rojo**. Lee el fuente de `web/app/` y `web/components/`, **les quita los comentarios primero** (`//…` y `/*…*/`), y sobre lo que queda afirma dos cosas (research D2): que no aparece el token `precio` en ninguna forma —`.precio`, `precio` suelto, `formatearPrecio`—, y que ningún literal de string contiene `precio`, `costo`, `cuánto sale` ni un signo de peso seguido de número. **Prohibir solo `.precio` deja una puerta**: un helper en `lib/` llamado desde un componente pasa los dos planos. Se escribe **primero** porque su salida en rojo es el mapa exacto del trabajo que sigue: cada archivo que liste es una tarea de abajo **HECHO**: `web/lib/sin-precio-a-la-vista.test.ts`. Salio en rojo listando **diez** archivos, y **dos no estaban en el inventario de research D1**: `app/perfil/page.tsx` y `components/sesion/panel-ingreso.tsx`, los dos con "ver cuánto sale un envío". Escribirla primero se pago solo.
- [x] T004 Agregarle a esa guarda su **control positivo**, en el mismo archivo: **tres** casos que le pasan al detector fragmentos que tiene que marcar — uno con `$ {zona.precio}`, uno que solo llama a un `formatearPrecio()` importado, y uno con un literal de texto que habla de costo — más **un cuarto que NO debe marcar**: un comentario que menciona el precio. Sin esto la guarda queda verde el día que el escáner deje de leer archivos, y nadie se entera **HECHO**: siete casos de control — cuatro que tiene que marcar (monto renderizado, helper importado, monto escrito a mano, texto de costo) y tres que NO (comentario de linea, de bloque y de JSX), mas uno que comprueba que un `//` dentro de un string no borra el resto de la linea.

**Checkpoint**: la guarda existe, sabe detectar, y está en rojo listando **diez
archivos** — dos de ellos fuera del inventario de research D1, que buscó por la
palabra `precio` y no vio los que decían *"cuánto sale"*.

---

## Phase 3: User Story 1 — Cargar un pedido sin que aparezca un precio (P1) 🎯 MVP

**Goal**: que una persona complete y confirme un pedido de punta a punta sin ver
un monto, y sin quedarse sin saber si su dirección entra en la cobertura.

**Independent Test**: recorrer el formulario con una dirección válida; cero
cifras de dinero y el pedido se crea igual (quickstart Q1 pasos 4–6, Q2).

- [x] T005 [US1] En `web/components/pedido-form.tsx`, reemplazar el bloque `Precio del envío` + `$ {zona.precio}` por la **confirmación de cobertura con el nombre de la zona**, sin ninguna cifra (FR-003, FR-003a). Es el corazón del cambio: ese bloque hacía dos trabajos y solo uno sobrevive **HECHO**: donde iba `$ 250` va ahora "Llegamos hasta acá / La entrega queda en Zona N", con `role="status"`.
- [x] T006 [US1] En `web/components/pedido-form.tsx`, la fila del resumen `Zona y precio` → `Zona`, con el nombre solo (FR-004) **HECHO**, y **arregla un defecto que ya estaba**: la fila calculaba la zona desde `form.retiro.direccion.punto`. `011` movio la zona a la entrega y esta pantalla se le paso, asi que venia mostrando la zona equivocada —y ninguna cuando el retiro no resolvia—. Ahora lee la entrega y dice solo `Zona de entrega`.
- [x] T007 [US1] En `web/components/pedido-form.tsx`, **eliminar entero** el aviso de cambio de precio al mover el pin entre dos zonas cubiertas (FR-005), y el estado que lo alimenta si no lo usa nadie más. Sin precio no hay nada que avisar: las dos zonas cubren igual **HECHO**: se fueron el aviso, el `useState`, el `useRef` y el `useEffect` que lo alimentaban, mas los imports que quedaron sin uso.
- [x] T008 [US1] En `web/components/pedido-form.tsx`, reescribir los textos que justifican una obligación apelando al precio — el que explica por qué hace falta el punto, el del mapa caído, y los dos de la sección de entrega (FR-002). El motivo pasa a ser la **cobertura**, que es el verdadero desde hoy **HECHO**: los cuatro pasan a hablar de cobertura.
- [x] T009 [P] [US1] En `web/components/bloque-direccion.tsx`, reescribir el error de "no podemos cargar el listado de calles… ni calcular el precio" (FR-002). Sigue bloqueando exactamente igual; cambia por qué lo dice **HECHO**.
- [x] T010 [P] [US1] En `web/app/pedido/page.tsx`, reescribir el copy que promete mostrar el precio al instante sin crear cuenta (FR-008). **Es la frase que más directamente pasa a ser falsa** **HECHO**: el comentario de ese archivo ya llevaba dos correcciones anotadas; esta es la tercera y queda con la misma disciplina.
- [x] T011 [US1] Verificar —sin cambiar código— que el bloqueo fuera de zona sigue intacto: no se confirma, se encamina al contacto, y **nunca** se ofrece la zona más cercana (FR-013, FR-014). Si alguna tarea de arriba lo tocó de rebote, este es el momento de verlo **HECHO en el codigo**: `validate()` conserva intactas las dos guardas —mapa caido y punto fuera de zona— y ninguna tarea las toco. **La comprobacion en el navegador es T026.**

**Checkpoint**: el MVP está entregado. Si el feature se cortara acá, el pedido
del cliente ya está cumplido en la pantalla que más se usa.

---

## Phase 4: User Story 2 — Ver dónde se trabaja, sin ver cuánto sale (P2)

**Goal**: el mapa se queda y cambia de sentido; la leyenda sobrevive sin montos.

**Independent Test**: abrir `/sobre-nosotros`, ver las cinco zonas dibujadas y
listadas por nombre, sin ningún monto (quickstart Q1 paso 2).

- [x] T012 [P] [US2] En `web/components/mapa-zonas.tsx`, el globo de cada polígono pasa de `Zona 3 — $ 250` a `Zona 3` (FR-011). **Esto arregla los dos mapas de una**: el de la sección y el del formulario comparten componente **HECHO**.
- [x] T013 [US2] En `web/components/mapa-zonas-seccion.tsx`, cuatro cosas: sacar el monto de cada fila de la leyenda dejando **color y nombre nada más** (FR-010); reescribir la bajada que hoy dice que el precio depende de la zona *de retiro* —que además quedó vieja desde `011`—; el aviso de mosaicos caídos deja de hablar de precios y sigue remitiendo a la leyenda (FR-012); y el pie deja de prometer "ver el precio exacto" al cargar un pedido (FR-008) **HECHO**: la leyenda paso de `<dl>` a `<ul>` porque ya no hay par termino/definicion — es una lista de cinco zonas, no una tabla de tarifas.
- [x] T014 [P] [US2] En `web/app/page.tsx`, el llamado a la acción `Ver zonas y precios` → `Ver zonas` (FR-008) **HECHO**: dice `Ver zonas de entrega`.

**Checkpoint**: la sección de zonas comunica cobertura y nada de plata, y sigue
siendo legible para quien no ve el mapa.

---

## Phase 5: User Story 3 — El sábado se coordina (P3)

**Goal**: el sábado deja de tener franja fija.

**Independent Test**: leer la fila del sábado en `/sobre-nosotros`.

- [x] T015 [P] [US3] En `web/app/sobre-nosotros/page.tsx`, la fila `Sábados — 9:00 – 13:00` pasa a `Sábados — A coordinar` (FR-017). Se mantiene la estructura de dos columnas que usan las otras dos filas (research D4). **Lunes a viernes y domingo no se tocan** **HECHO**.

---

## Phase 6: User Story 4 — Repetir un pedido sin arrastrar precios (P3)

**Goal**: ni avisos de reajuste ni montos en el historial.

**Independent Test**: repetir un pedido guardado y no ver ningún aviso de precio
(quickstart Q1 pasos 7–8).

- [x] T016 [P] [US4] En `web/components/pedido/tarjeta-pedido.tsx`, sacar `$ {pedido.precio}` de la tarjeta (FR-006). El dato sigue llegando en la respuesta y sigue guardado; deja de dibujarse **HECHO**.
- [x] T017 [US4] En `web/components/pedido/crear-pedido.tsx`, eliminar los dos avisos de precio —el de "pedido anterior a nuestro cambio de precios" y el de "el precio se reajustó"— y el copy que ofrece "ver el precio" a quien no ingresó (FR-007, FR-008). **Lo que NO se toca**: que a un pedido viejo sin punto de entrega se le siga pidiendo la esquina. Ese pedido sigue existiendo, y ahora se justifica por cobertura **HECHO**: se fueron `AVISO_REAJUSTE`, `avisoDeReajuste` de `Precarga` y sus tres usos. `AVISO_SIN_PUNTO_DE_ENTREGA` se queda y cambia de motivo.
- [x] T018 [US4] En `web/lib/repetir.ts`, borrar `precioDeHoy()` y la comparación que decidía si hubo reajuste (research D3). **Conservar** la resolución de zona que detecta si el punto guardado cae hoy fuera de cobertura: ese camino sigue vivo y sigue encaminando al contacto **HECHO**, y con una correccion sobre lo que decia el plan: al irse `precioDeHoy` este modulo perdio su ultimo uso de `resolverZona()`, asi que tambien se fue ese import. **La comprobacion de fuera de zona nunca vivio aca** —esta en `validate()` de `pedido-form.tsx`— y el comentario que quedo lo dice.
- [x] T019 [US4] En `web/lib/repetir.test.ts`, borrar los casos de la comparación de precios y **conservar los de fuera de zona**. Si al terminar quedan casos que ya no prueban nada porque su función no existe, se van con ella **HECHO**: se fueron los siete casos y el import de `ZONAS`.

**Checkpoint**: las cuatro historias entregadas.

---

## Phase 7: Polish y cierre

- [x] T020 [P] **Barrer los comentarios que quedaron falsos** en los tres archivos que ningún otro task toca: `web/components/campo-autocompletado.tsx` (dice que elegir una sugerencia es obligatorio *porque de ahí sale el precio* — sigue siendo obligatorio, pero por la cobertura), `web/components/sesion/boton-google.tsx` (*"identificarse es opcional para mirar precios"*) y `web/components/sesion/proveedor-sesion.tsx` (*"el precio sigue saliendo con el…"*). **Lo encontró el analyze del 2026-08-30**: el inventario de research D1 contó once lugares que se ven y se le pasó este grupo, que solo tiene comentarios. No son de cara al cliente, así que ningún FR los cubre — pero son lo que lee el próximo agente antes de tocar estos archivos, y dejarlos es sembrar una regla derogada. Repasar de paso los comentarios sobre precio en los archivos que sí se tocaron **HECHO**: los tres, mas los dos archivos nuevos que encontro la guarda, mas los comentarios sobre precio de los archivos que si se tocaron.
- [x] T021 [P] En `web/lib/cotizar-abierto.test.ts`, reescribir la explicación de por qué existe (research D7). **No se cambia lo que prueba**: el formulario sigue teniendo que cargar y funcionar con el servicio caído, y su caso dinámico sigue siendo verdadero porque el dato del precio sigue existiendo. Lo que cambia es el motivo escrito, que hoy habla de "ver el precio" **HECHO**: la guarda se queda y su cabecera ahora dice que sobrevivio a su propio motivo.
- [x] T022 [P] En `web/design-source/README.md`, ajustar lo que dice sobre la sección de zonas ahora que no muestra precios. **Lo que sigue igual y conviene dejar dicho**: los montos siguen viviendo en la tabla de `build-zonas.js` y el módulo generado los sigue emitiendo **HECHO**, con una seccion nueva sobre por que el precio sigue en el dato y no se lee. Ademas queda anotado que la regla "si el poligono se aparta de la calle, el defecto es del poligono" **se ejercio por primera vez** con la Zona 5.
- [x] T023 [P] En `ARCHITECTURE.md`, corregir las siete menciones al precio como algo que el sitio muestra (líneas 22, 108, 143, 160, 196, 206, 220). Es lo primero que lee cualquier agente antes de tocar código: dejarlo diciendo que "el pin decide el precio" garantiza que el próximo trabajo se construya contra una regla derogada **HECHO**: las siete, mas un parrafo nuevo que prohibe leer `pedidos.precio`.
- [x] T024 **Romper la implementación a propósito** y ver la guarda en rojo: devolver un monto a `web/components/pedido/tarjeta-pedido.tsx`, correr `npm test`, confirmar que falla y que el mensaje nombra el archivo, deshacer, y confirmar verde (quickstart Q3). **No se reemplaza por leer el código**: es la única forma de saber que la guarda sirve **HECHO**: en rojo con el archivo nombrado (`components/pedido/tarjeta-pedido.tsx volvió a traer...`), verde al deshacer.
- [x] T025 `verify:` verde — `cd web && npm run lint && npm test && npm run build` **HECHO**: lint limpio, **175 pruebas** (147 + 35 de la guarda − 7 de precio), build OK. Ademas se corrio el export estatico real (`GITHUB_PAGES=true`) y se comprobo sobre el HTML publicado: **ninguna frase de precio y ningun monto**, y el sabado dice *A coordinar*.
- [ ] T026 Ejecutar el **nivel 1** del [quickstart](quickstart.md): Q1 (las ocho pantallas, cero cifras), Q2 (fuera de zona), Q4 (los anillos cierran) y Q5 (el formulario vivo con el servicio caído)
- [ ] T027 Ejecutar el **nivel 2** del [quickstart](quickstart.md), Q6: crear un pedido real contra el servicio local y **mirar la fila en Postgres** — `zona_id` y `precio` poblados (FR-015). Después abrirlo en la app de Diego: aparece, se mueve de estado, y no muestra ningún monto (FR-016). **`verify:` no puede probar nada de esto** (research D6), así que si no se corre, no está probado
- [x] T028 **TUYA** Resolver la pregunta abierta de research D5: ¿Diego **cambió** el límite de la Zona 5, o el polígono estaba mal dibujado y esto lo corrige hacia las calles que ya estaban escritas? Si cambió el límite, la lista autoritativa de `specs/002-mapa-zonas-precio/spec.md` § Límites de zona quedó vieja y hay que decidir si se actualiza, sale a deuda, o se deja **CERRADA el 2026-08-30**: el polígono estaba mal dibujado y esto lo corrige. Las calles de la Zona 5 no cambiaron, `specs/002` sigue siendo la autoridad, **no hay nada que actualizar ni deuda que anotar**. Es la primera vez que se ejerce la regla del README de `design-source` — cuando polígono y calle discrepan, el defecto está en el polígono
- [ ] T029 **TUYA** Ejecutar el **nivel 3** del [quickstart](quickstart.md), Q7: que Diego lo mire y confirme que es lo que pidió. **Es la única comprobación que puede decir que el feature acertó**, porque el criterio es suyo
- [ ] T030 Poner `specs/013-precio-fuera-de-vista/plan.md` en `status: completed` **después** de commitear el resto — el sensor de cobertura rebota el commit si el plan ya está cerrado

---

## Dependencies

```text
T001 (línea de base)
  └── T002, T003 (Foundational)
        └── T004 (control positivo de la guarda)
              ├── US1 (T005–T011)   ← MVP, entrega sola
              ├── US2 (T012–T014)   ← entrega sola
              ├── US3 (T015)        ← entrega sola, no depende de nada
              └── US4 (T016–T019)   ← entrega sola
                    └── Polish (T020–T030)
                          └── T028 y T029 son TUYAS y bloquean T030
```

**Las cuatro historias son independientes entre sí.** Ninguna toca un archivo de
otra, salvo que US1 y US2 comparten `mapa-zonas.tsx` de forma indirecta: US2 lo
edita (T012) y US1 lo consume sin tocarlo.

**T015 (el sábado) no depende de nada** — ni siquiera de la fase Foundational.
Es una línea y se puede hacer primero si hace falta mostrar algo rápido.

**T028 y T029 no las puede hacer la sesión.** Una necesita saber qué decidió
Diego sobre el límite de la Zona 5; la otra, que Diego mire el sitio. Hasta que
las dos cierren, **T030 no se toca**: cerrar el plan antes sería tildar como
hecho algo que nadie comprobó. Lo encontró el analyze del 2026-08-30, que vio
la dependencia implícita y sin escribir.

## Parallel opportunities

- Dentro de US1: **T009 y T010** en paralelo (archivos distintos), después de T005–T008
- Dentro de US2: **T012 y T014** en paralelo
- Entre historias: **US2, US3 y US4 enteras** pueden ir en paralelo una vez cerrada la fase Foundational
- En Polish: **T020, T021, T022 y T023** en paralelo

## Implementation strategy

**MVP = US1.** Once tareas hasta T011 y el pedido del cliente ya está cumplido
en la pantalla que más se usa. Todo lo demás mejora la coherencia del sitio,
pero nada de eso es lo que Diego pidió mirando el formulario.

**El orden recomendado es el de arriba**, con una excepción: si hace falta
enseñarle algo a Diego el mismo día, T015 (el sábado) cuesta una línea y se ve.

**Lo que no se hace hasta que `verify:` esté verde**: cualquier limpieza que no
esté en esta lista. El repo tiene deuda anotada y tentadora en estos mismos
archivos; no es de este plan.

## Requisitos sin tarea, a propósito

- **FR-015 y FR-016** (el dato se conserva) no tienen tarea de implementación
  porque **la forma de cumplirlos es no hacer nada**. Se verifican en T027, y
  la guarda contra hacerlo sin querer es que `covers:` no incluye `backend/` ni
  `android/`
- **FR-009** (el mapa se queda) tampoco: se cumple no borrando la sección. T013
  la toca sin sacarla, y T026 lo comprueba
- **FR-019** (el formulario funciona con el servicio caído) no se implementa: ya
  está, y lo guarda `cotizar-abierto.test.ts`. T021 le reescribe la explicación
  y T026/Q5 comprueba el comportamiento
