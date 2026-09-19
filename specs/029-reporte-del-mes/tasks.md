# Tasks: El reporte del mes

**Input**: Design documents from `/specs/029-reporte-del-mes/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[quickstart.md](quickstart.md)

**Tests**: SI, y dos de ellas son el feature. La guarda de plata de cada lado y
la del filtro por cuenta **no son cobertura**: son la implementacion de FR-009,
FR-011 y FR-006. Se escriben **antes** que el codigo que vigilan, porque una
guarda sirve mientras alguien escribe lo que podria violarla, no despues.

**Organization**: por historia de usuario. Las tres son P1 y las tres se pueden
probar por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ir en paralelo (otro archivo, sin depender de algo incompleto)
- **[Story]**: US1, US2, US3

## Path Conventions

Dos superficies: `backend/` (Go) y `web/`. `android/` **no se toca**. La frontera
es el `covers:` del plan.

---

## Phase 1: Setup

- [x] T001 Correr `verify:` entero y anotar que queda **verde antes de tocar nada**: `cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... -p 1 && go build ./...`. **Anotar tambien cuantos `skip` hay en Go**: sin `TEST_DATABASE_URL` las pruebas contra Postgres se saltean solas, y arrancar sin saber cuantas se saltearon hace que el verde del final no signifique nada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el documento contra el que todo se justifica, y las dos guardas de
plata **antes** que el codigo que vigilan.

- [x] T002 Amendar `.specify/memory/constitution.md` a **6.2.0**: en *Scope boundaries*, el bullet del tablero pasa de decir que **cuenta** a decir que **cuenta y lista**, nombrando el reporte por cuenta y periodo. Agregar la entrada al historial de enmiendas explicando que es **MINOR** —ningun principio se reversa, el Principio V queda palabra por palabra, nada construido queda fuera de norma— y **por que no lleva ADR** (la gobernanza lo pide cuando se reversa una decision, y esto extiende sin contradecir). Mismo formato que 6.1.0. **Anotar tambien el riesgo de FR-021a**: que la lista de precios de Diego y los montos del modulo generado se pueden separar, y que poner el precio en el reporte seria una enmienda **MAJOR** y no un ajuste. **Va primero**: ninguna prueba lo rompe, asi que si queda para el final sale el feature con la constitucion diciendo otra cosa.
- [x] T003 Crear el paquete `backend/internal/reporte/` con los tipos de [data-model.md](data-model.md) y nada de logica. Documentar arriba **por que existe un paquete aparte** y no un parametro sobre el tablero (research D1).
- [x] T004 Crear `backend/internal/reporte/sin_plata_test.go`, copiando el patron de `internal/tablero/sin_plata_test.go`: ninguna fuente del paquete puede nombrar `precio`, `monto`, `importe` ni `costo`, **con su control positivo** (un fuente sintetico donde la guarda TIENE que encontrarlo). La de `tablero` escanea **su propio** paquete: este nace sin nada.
- [x] T005 EL CONTROL NEGATIVO de T004: meterle a proposito una variable `precio` a `internal/reporte`, correr `go test ./...` y **ver la guarda en ROJO**. Deshacer.
- [x] T006 [P] Crear `web/lib/reporte.ts` con los tipos de data-model y nada de logica, y `web/lib/reporte.test.ts` con la guarda de plata sobre su propio fuente, al estilo de la que `lib/tablero.ts` y los modulos de la etiqueta ya tienen. **`sin-precio-a-la-vista.test.ts` no lo cubre**: deja `lib/` afuera a proposito, porque ahi el precio tiene que seguir viviendo.
- [x] T007 EL CONTROL NEGATIVO de T006: lo mismo del lado de la web, y **ver la prueba en ROJO**. Deshacer.

**Checkpoint**: la constitucion dice lo que el feature va a hacer, y los dos
modulos nuevos nacen vigilados antes de tener una linea de logica.

---

## Phase 3: US1 — Diego arma la cuenta del mes (P1)

**Goal**: que desde el tablero salga un CSV con los envios de una cuenta en un
periodo, y que **se abra de doble clic**.

**Independent test**: bajar el reporte de un mes con pedidos y abrirlo en una
planilla en español.

- [x] T008 [US1] En `backend/internal/reporte/reporte.go`, la consulta: pedidos de **una** cuenta con `retiro_fecha` entre `desde` y `hasta` inclusive, con codigo, fecha de retiro, las cinco partes de la direccion de entrega, el punto de entrega y la cantidad. `retiro_fecha` es **`date`**, asi que el corte del periodo se compara como fecha de calendario y **no tiene trampa de zona** (research D4).
- [x] T009 [US1] En `backend/internal/reporte/handlers.go`, el handler de `GET /admin/reporte`: **exige `cliente`, `desde` y `hasta`** —sin `cliente` responde **400, nunca "todos"**— y responde **403 antes de tocar la base** a quien no sea administrador, igual que `tablero.Ver`. Solo `GET`.
- [x] T010 [US1] En `backend/internal/reporte/handlers_test.go`, la prueba de FR-006: **sin `cliente` el endpoint no devuelve filas de nadie**, y con `cliente` no devuelve ni una fila de otra cuenta. Con su **control positivo**: el caso que demuestra que la prueba sabria detectar una fila ajena si apareciera.
- [x] T010b [US1] En `backend/internal/reporte/handlers_test.go`, la prueba de **FR-018 y SC-009**: una cuenta que **no** es administradora recibe **403** y ninguna fila, y el 403 llega **antes de tocar la base**. Con su **control positivo**: el mismo caso con una cuenta administradora devuelve filas, porque si no la prueba pasaria con un handler que le responde 403 a todo el mundo. **Lo encontro el analyze**: T009 decia que el handler responde 403 y no habia una sola tarea que lo comprobara, en el feature que expone direcciones de clientes.
- [x] T011 [US1] EL CONTROL NEGATIVO de T010: hacer que el handler trate `cliente` vacio como "todos" y **ver la prueba en ROJO**. Deshacer. Es la guarda que impide que un cliente vea las direcciones de otro; verla en rojo una vez es barato.
- [x] T012 [US1] Montar la ruta en `backend/cmd/api/main.go` con `conSesion`, al lado de la del tablero y con el mismo comentario de por que es solo `GET`. **`/admin/tablero` no se toca** — es la mitad de FR-017.
- [x] T013 [US1] En `web/lib/api.ts`, la funcion que pide el reporte. Es una llamada de administracion mas; **no entra en el camino del formulario de pedido** y la guarda de `cotizar-abierto.test.ts` lo sigue afirmando.
- [x] T014 [US1] En `web/lib/reporte.ts`, armar `FilaDeReporte[]` desde la respuesta: la direccion **con `componerDireccion`**, la zona **con `resolverZona`** desde el punto guardado. **Tres funciones reusadas y ningun helper nuevo**: el repo ya tiene resueltas estas trampas, y escribir un segundo resolvedor de zona es lo que FR-007 prohibe.
- [x] T015 [US1] En `web/lib/reporte.ts`, el texto del CSV: **separador `;`**, **BOM de UTF-8**, **fin de linea CRLF**, y citado de campos que contengan `;`, comillas o salto de linea, duplicando las comillas internas.
- [x] T016 [P] [US1] En `web/lib/reporte.test.ts`, comparar el texto generado **byte a byte** contra un esperado escrito a mano, incluido el BOM. Es la unica forma de fijar separador y codificacion: una prueba que compare "campos" no ve ninguna de las dos cosas.
- [x] T017 [P] [US1] En `web/lib/reporte.test.ts`, el citado: una direccion con coma, una con comillas y una con las dos. **La direccion es el campo peligroso** —*"Rivera 1234, apto 2"*— y es el que parte la fila.
- [x] T018 [US1] En `web/lib/reporte.ts`, el pie: cuenta, periodo y fecha de generacion **al final del archivo, despues de un renglon en blanco** (FR-014a). Arriba del encabezado la planilla toma esa fila como encabezado y se pierden los nombres de columna, el filtro y el orden. **Y el nombre del archivo** (FR-015): lleva periodo y cuenta, para que dos descargas no se pisen en la carpeta de descargas.
- [x] T019 [P] [US1] En `web/lib/reporte.test.ts`, afirmar que **la fila 1 es el encabezado** y que el bloque de contexto esta despues de un renglon en blanco.
- [x] T020 [US1] En `web/lib/tablero.ts`, los textos de pantalla del boton y del estado sin cuenta elegida. Van en `lib/` y no en el componente **por el mismo motivo que los de `025`**: en este repo nada renderiza React en una prueba, y una constante en `lib/` si se puede afirmar.
- [x] T020b [US1] En `web/lib/tablero.ts`, que `Periodo` exponga **el rango de fechas que representa** (`desde` y `hasta`, inclusive), con su prueba: el mes de febrero de un año bisiesto, una semana que cruza de mes y un dia suelto. **Lo encontro el analyze, y sin esto T021 no se puede escribir**: el endpoint exige `desde` y `hasta`, y hoy `Periodo` solo tiene `clave` y `rotulo`. El rango se calcula donde ya vive la aritmetica de calendario, no en el componente.
- [x] T021 [US1] En `web/components/tablero/tablero.tsx`, el boton de descarga **por fila del cuadro**, que baja el periodo de esa fila con el filtro de cuenta vigente. **Por semana y por mes; por dia NO** (FR-005a, decision del 2026-09-19 despues de probarlo).
- [x] T022 [US1] En `web/components/tablero/tablero.tsx`, **sin cuenta elegida no hay descarga** (FR-006a) y la pantalla dice que hay que elegir una. El tablero arranca mostrando todas.
- [x] T022b [US1] `motivoSinReporte(corte, clienteId)` en `web/lib/tablero.ts`, con prueba: **quien puede bajar el reporte es una regla de producto y vive en `lib/`**, no en el componente, porque ahi se puede afirmar. Dos motivos: sin cuenta elegida (FR-006a) y con el corte en dia (FR-005a). La falta de cuenta pesa mas, porque es el mensaje que le dice a Diego que hacer.
- [x] T023 [US1] En `web/components/tablero/tablero.tsx`, el manejo de la falla (FR-019): si el reporte no se puede traer, **se dice con un mensaje visible**. Nunca bajar un archivo vacio ni quedarse sin hacer nada — es el modo de falla que este repo ya pago dos veces, en el boton de confirmar y en el de imprimir.
- [x] T024 [US1] Un mes sin pedidos se dice en pantalla y **no descarga un archivo con solo encabezados** (FR-020).

**Checkpoint**: se baja un archivo y se abre en una planilla. US1 entregable.

---

## Phase 4: US2 — Ningun envio se cae del reporte (P1)

**Goal**: que un pedido que Diego no marco como entregado **aparezca igual**.
Es P1 porque es plata: cada olvido suyo seria un envio facturado de menos.

**Independent test**: dejar pedidos sin marcar y comprobar que estan en el
archivo, con la celda de entrega vacia.

- [x] T025 [US2] En la consulta de `backend/internal/reporte/reporte.go`, traer la fecha de entrega con un **`LEFT JOIN`** al historial de estados —`estado='entrega'`, la marca **mas reciente** (FR-006c)—. **`LEFT`, no `INNER`**: un `INNER JOIN` hace desaparecer en silencio justo los pedidos que Diego no marco, que es el defecto que esta historia existe para impedir. Ausente y no `null` cuando no hay (data-model).
- [x] T026 [US2] En `backend/internal/reporte/reporte_test.go`, contra Postgres: un pedido **sin** marca de entrega **aparece** en el resultado, y uno con **dos** marcas trae la mas reciente. **Comprobar que la prueba no se salteo**: sin `TEST_DATABASE_URL` este caso no corre y el verde no dice nada.
- [x] T027 [US2] EL CONTROL NEGATIVO de T026: cambiar el `LEFT JOIN` por un `INNER JOIN` y **ver la prueba en ROJO**. Deshacer. Es exactamente el error que costaria plata y que no se ve mirando el archivo, porque lo que falta no esta.
- [x] T028 [US2] En `web/lib/reporte.ts`, convertir el instante de entrega a **fecha de Montevideo** con `fechaEnMontevideo()` de `lib/tablero.ts`, y dejar la celda **vacia** cuando no hay marca. **No se escribe un segundo conversor**: `025` ya resolvio esta trampa con la zona IANA escrita y no un `-03:00` a mano.
- [x] T029 [P] [US2] En `web/lib/reporte.test.ts`, el caso del borde del mes: un pedido entregado a las **22:00 del ultimo dia del mes** en Montevideo sale con **esa** fecha y no con la del dia siguiente (SC-011). **Forzar la zona adentro de la prueba y afirmar que tomo**: esta maquina esta en Montevideo, asi que una prueba que use la zona del proceso pasa por casualidad y no prueba nada.
- [x] T030 [P] [US2] En `web/lib/reporte.test.ts`, un pedido **sin punto de entrega** (anterior a `011`) sale con la zona vacia, y se distingue de uno con zona. **Vacio no es "no se cobra"**.

---

## Phase 5: US3 — El archivo no dice nada de plata (P1)

**Goal**: que nadie que abra el archivo encuentre un importe, un total, ni una
columna que sugiera que deberia haberlo.

**Independent test**: abrir el archivo entero, pie incluido, y buscar dinero.

- [x] T031 [US3] Comprobar que las guardas de T004 y T006 siguen verdes sobre el codigo ya escrito, y que **ninguna de las dos quedo mirando un archivo que se renombro**. Una guarda que apunta a un archivo que ya no existe pasa en verde sin mirar nada.
- [x] T032 [P] [US3] En `backend/internal/reporte/handlers_test.go`, afirmar sobre el **JSON de respuesta** —no sobre el struct— que no hay ninguna clave que hable de plata, con control positivo. Es la misma forma que `sin_plata_test.go` de `tablero` usa para el suyo: el struct puede tener un campo con `json:"-"` y el JSON es lo que viaja.
- [x] T032b [P] [US3] En `backend/internal/tablero/handlers_test.go`, afirmar que **la respuesta de `/admin/tablero` sigue teniendo exactamente las mismas claves que antes de `029`** (SC-010, la mitad verificable de FR-017). **Es lo unico que este feature toca de ese paquete, y es una prueba, no codigo** — ver la nota en `covers:`. Sin esto, "no encarecimos la pantalla de conteos" es una promesa que nadie comprueba.
- [x] T033 [P] [US3] En `web/lib/reporte.test.ts`, afirmar sobre el **texto final del CSV**, pie incluido, que no aparece ningun importe ni ningun encabezado que nombre dinero, con control positivo.

---

## Phase 6: Polish & Cross-Cutting

- [x] T033b [P] [US3] En `web/lib/reporte.test.ts`, **una fila por pedido y no por paquete** (FR-002): un pedido de cinco paquetes produce **una** fila, con `5` en su columna.
- [x] T034 Correr `verify:` entero y **comparar los `skip` de Go contra los de T001**. Si subieron, hay pruebas nuevas que no corrieron.
- [x] T035 Ejecutar [quickstart.md](quickstart.md) **completo**, abriendo el archivo **de doble clic** en una planilla en español. `verify:` no puede decir nada del separador, del BOM ni del fin de linea: los tres se ven ahi y en ningun otro lado.
- [x] T036 Comprobar en el quickstart los dos casos que cuestan plata: el pedido **sin marcar como entregado** aparece, y el pedido **sin punto** sale con zona vacia y se distingue.
- [x] T037 Comprobar que **la zona del CSV coincide** con la que muestran el formulario y la etiqueta impresa para el mismo pedido (SC-005). Si difieren, hay un segundo resolvedor de zona dando vueltas.
- [x] T038 Comprobar que la constitucion quedo en **6.2.0** con su entrada de historial. **Es el requisito que mas facil se olvida** porque no lo rompe ninguna prueba.
- [ ] T039 Desplegar a **staging** y ejercitarlo ahi antes de mergear. Aca no es formalidad: **hay una ruta nueva en el servicio**. Bajar el `npm run dev` al terminar.

---

## Dependencies

```text
Phase 1 (T001)
   └─> Phase 2 (T002 amendment; T003→T004→T005 Go; T006→T007 web)   BLOQUEA TODO
          └─> Phase 3 US1
                 backend: T008 → T009 → T010 → T011 → T012
                 web:     T013 → T014 → T015 → T016‖T017 → T018 → T019
                 pantalla: T020 → T021 → T022 → T023 → T024
                    ├─> Phase 4 US2 (T025 → T026 → T027 → T028 → T029‖T030)
                    └─> Phase 5 US3 (T031 → T032‖T033)
                           └─> Phase 6 (T034 → T035 → T036 → T037 → T038 → T039)
```

**T002 no bloquea tecnicamente a nadie** —es un documento— y esta igual en
Foundational a proposito: es lo unico del feature que ninguna prueba defiende.

Las ramas de backend y de web de US1 **son independientes hasta T013**: se puede
escribir el modulo del CSV contra una respuesta de ejemplo mientras el endpoint
se termina.

## Parallel opportunities

- **T004/T005 (Go) y T006/T007 (web)** — las dos guardas, lados distintos.
- **T016 y T017** — dos casos del mismo archivo de prueba.
- **T029 y T030** — idem.
- **T032 y T033** — lados distintos.

Los **controles negativos** (T005, T007, T011, T027) no son paralelizables: rompen
la implementacion a proposito, asi que nada mas puede estar corriendo pruebas.

## Implementation Strategy

**MVP = Phase 2 + Phase 3 (US1).** Con eso Diego ya baja un CSV de una cuenta y
un mes y lo abre en Excel, que es el pedido completo.

**US2 no es opcional aunque sea una fase aparte.** Sin T025 el archivo se ve
perfecto y **le faltan filas**, que es el peor modo de falla del feature: lo que
falta no se ve. Si algo se difiere, no es esto.

**US3 tampoco**, y ademas es barata: las dos guardas ya estan escritas desde la
Phase 2; esta fase solo agrega las afirmaciones sobre la salida.
