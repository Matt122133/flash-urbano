---

description: "Tareas de 016 — Quién recibió el paquete"
---

# Tasks: Quién recibió el paquete

**Input**: `specs/016-quien-recibio/` — [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[contracts/pedidos.md](contracts/pedidos.md), [quickstart.md](quickstart.md)

**Tests**: sí, y una es el corazón del feature: la guarda de FR-010, que falla si
la cédula aparece en lo que se le manda al cliente.

**Organization**: por historia de usuario.

## Path Conventions

Tres superficies: `backend/`, `android/` y `web/`. Es el primer feature desde
`012` que las toca todas.

---

## Phase 1: Setup

- [x] T001 Correr `verify:` **entero y con `TEST_DATABASE_URL` puesto**, antes de tocar nada, y **anotar el conteo de skips de Go**. Si más tarde algo sale en rojo hay que poder distinguir lo que rompió este feature; y si los skips no son cero, el verde de la pata de Go no dice nada **HECHO**: `go test ./... -p 1 -count=1` con la base de pruebas levantada. **SKIPS: 0** — el numero que importa. Se forzo con `-count=1` porque la primera corrida salio de cache y una linea de base cacheada no es una linea de base.

---

## Phase 2: Foundational — la base y el corte de los tipos

- [x] T002 Escribir la migración `0006` sobre `pedidos_estados`: `receptor_nombre` y `receptor_documento`, **las dos `text` y nullable** (data-model). **No se toca `pedidos`.** Dejar escrito en el `.sql` por qué son nullable —es la corrección explícita del error del 2026-08-12— y por qué **no** lleva un `CHECK` que ate las columnas al estado `entrega` **HECHO**: `0006_quien_recibio.sql`. El archivo deja escrito por que son nullable (la correccion del 2026-08-12), por que **no** lleva un CHECK que ate las columnas al estado, y por que no hace falta un indice nuevo.
- [x] T003 Probar la migración **contra una base que ya tiene filas** (quickstart Q3), no contra una vacía. Es el paso que faltó el 2026-08-12 y que dejó producción sin arrancar **HECHO, y contra datos de verdad**: se aplico sobre `flash_dev`, que tenia **24 filas reales** en `pedidos_estados`. Las 24 sobrevivieron y quedaron con receptor nulo. Es exactamente la condicion que el 2026-08-12 se dio por sentada y dejo el servicio sin arrancar.
- [x] T004 **Partir los tipos de la respuesta** (research D1): `Pedido` es lo que ve el cliente y **no tiene el documento**; el admin usa un tipo propio que lo embebe y lo agrega. **El orden importa y va escrito**: lo seguro tiene que ser el default, para que el próximo dato sensible caiga del lado del cliente solo si alguien lo escribe ahí a propósito **HECHO**: `Pedido` es lo del cliente y `ParaAdmin` lo embebe y suma el documento. Las dos alternativas descartadas —blanquear al salir, `MarshalJSON` con bandera— quedaron escritas en el tipo con su motivo, porque la que se elige por comodidad seis meses despues es una de esas dos.
- [x] T005 **La guarda de FR-010**, en `backend/internal/pedidos/`: serializa la respuesta del cliente con una cédula conocida en el dato y afirma que **esa cadena no aparece**. **Con su control positivo**: la respuesta del admin **sí** tiene que contenerla, o la prueba estaría pasando porque no encuentra nada en ningún lado **HECHO**: cuatro casos, y **se rompio a proposito**. Agregandole el documento al tipo del cliente —como lo haria alguien de buena fe— la prueba sale en rojo, **muestra el JSON con la cedula adentro** y dice donde va el campo si hace falta. Ademas hay control positivo (la del admin SI la tiene) y un caso que sostiene que `ParaAdmin` **embeba** en vez de duplicar.
- [x] T006 Leer el receptor en la misma consulta que arma la lista (research D3): el último cambio a `entrega` de cada pedido, con un `LEFT JOIN LATERAL` sobre el índice `(pedido_id, ocurrido_en)` que `012` ya creó. **Una consulta por lista, no una por pedido** **HECHO**: `desdePedidos`, un `LEFT JOIN LATERAL` que toma el ultimo cambio a `entrega`. **Salio una consecuencia que no estaba prevista**: `RETURNING columnas` dejo de funcionar en `Crear` y en el `UPDATE` del cambio de estado, porque un RETURNING no puede referirse a una tabla que no esta en la sentencia. Se resolvio con **un solo camino de lectura** —`porID()`— que usan los dos: dos formas de leer un pedido son dos oportunidades de que una se olvide de un campo.

**Checkpoint**: el dato se puede guardar y leer, y hay una prueba que impide que se filtre.

---

## Phase 3: User Story 1 y 2 — cargarlo desde la app (P1)

**Independent Test**: quickstart Q4 y Q5.

- [x] T007 [US1] En `backend/internal/pedidos/handlers.go`, que `PATCH /admin/pedidos/{id}/estado` acepte `receptor` según [el contrato](contracts/pedidos.md): opcional en el cuerpo, **obligatorio el nombre cuando el estado es `entrega`**, documento opcional, y **ignorado —no rechazado— con otros estados** **HECHO**: el cuerpo acepta `receptor`, con nombre obligatorio al entregar, documento opcional, e **ignorado —no rechazado— en los otros estados**. Cuatro pruebas nuevas del contrato, incluida una que comprueba que un 400 **no mueve el pedido**: un rechazo que igual mueve seria peor que aceptar, porque dejaria el pedido entregado sin registro y diciendo que fallo.
- [x] T008 [US1] La hoja de "quién recibió" en `android/`, tal como quedó en la maqueta aprobada: la persona del pedido propuesta en un botón grande, y abajo, separado, el camino de escribir otro nombre con la cédula marcada como opcional **HECHO**: `HojaEntrega.kt`, un `ModalBottomSheet`. La propuesta es un boton de 64 dp arriba y el camino largo queda abajo, separado por una linea: **no son dos opciones equivalentes**, y la pantalla lo dice con el tamano.
- [x] T009 [US1] Aceptar la propuesta manda **el nombre del destinatario copiado**, no una marca de "el mismo" (research D4): dentro de seis meses el historial tiene que contestar quién recibió sin ir a buscar cómo se llamaba el destinatario entonces **HECHO**: manda `pedido.destinatarioNombre` copiado. **Comprobado en la base**: quedo `entrega | Lucía Fernández |` con documento nulo.
- [x] T010 [US2] El camino largo: nombre obligatorio, cédula opcional, y **cerrar sin confirmar NO mueve el pedido** (FR-004). Es lo que hace que la hoja sea el paso de confirmación y no un trámite después del hecho **HECHO**: el boton de confirmar esta **apagado sin nombre** —el servicio tambien lo rechaza, pero que el boton no se pueda tocar evita que Diego se entere por un error despues de haber entregado— y cerrar la hoja no mueve nada.
- [x] T011 [US1] **Un solo camino hacia `entrega`, y pasa por la hoja.** Desde `016` el servicio devuelve **400** si el estado es `entrega` y no viene el nombre de quien recibio, asi que cualquier llamada suelta a mover con ese estado **falla en la calle, en una entrega real**. Revisar que no quede ninguna: la accion de la tarjeta, un reintento, o cualquier atajo. **Lo encontro el analyze del 2026-08-30** — es una regresion que no aparece hasta que alguien entrega de verdad **HECHO**: la accion de Entregados ya **no llama a mover**: abre la hoja. `Acciones` gano `avanzarAparte`, que es una accion que no es un cambio de estado directo, y el comentario dice por que — una segunda llamada suelta a `alMover(pedido, ENTREGA)` no fallaria al compilar, fallaria en la calle.
- [x] T012 [US1] Contar los toques del caso común y que sean **dos** (SC-001). Si son tres, este feature empeoró la app y hay que rediseñar la hoja, no aceptarlo **HECHO y contado en el emulador: DOS toques.** Entregado, y la propuesta. El pedido paso a Entregados, el badge bajo de 2 a 1, y salio el aviso de deshacer.

---

## Phase 4: User Story 3 — que el cliente lo vea (P2)

**Independent Test**: quickstart Q7 y Q8.

- [x] T013 [US3] En `web/lib/api.ts`, el tipo del pedido gana **el nombre de quien recibió y nada más**. El documento **no se declara**: un tipo que lo nombra es una invitación a mostrarlo **HECHO**: el tipo gana `recibioNombre?` y **el documento no se declara ni como opcional** — un tipo que lo nombra es una invitacion a mostrarlo.
- [x] T014 [P] [US3] En `web/components/pedido/tarjeta-pedido.tsx`, mostrar quién recibió cuando el pedido está entregado. **Un pedido sin ese dato no muestra nada** —ni hueco ni "sin datos"— porque no registrarlo es la verdad de lo que pasó (FR-011) **HECHO**: una fila `Lo recibió` que **solo aparece si hay dato**. Un pedido entregado antes de `016` no muestra ni un hueco ni "sin datos": no haberlo registrado es la verdad de lo que paso.
- [x] T015 [US3] **Se tildo a medias y se corrigio:** parsear no es mostrar, y la tarjeta quedo sin dibujarlo hasta que se reviso. En la app: **`datos/Pedido.kt` parsea los dos campos nuevos** —opcionales, porque un pedido viejo no los trae— y la tarjeta de un entregado muestra **el nombre y la cédula** (FR-008). Ese archivo tiene disciplina propia escrita: los estados son texto y no enum **para que un campo nuevo del servicio no tire la app**, y los campos nuevos siguen el mismo criterio **HECHO**: `Pedido.kt` parsea los dos campos **con valor por defecto**, por el mismo motivo que los estados son texto y no un enum — un pedido anterior a `016` no los trae, y un tipo que los exija haria que la app no pueda leer su propia lista.

---

## Phase 5: Polish y cierre

- [x] T016 [P] Actualizar `SECURITY.md` (FR-013): qué categoría de dato entra, dónde vive, quién la ve, y **por qué no sale del lado de Diego**. Decir también lo que es: **dato personal bajo la Ley 18.331, no un dato público** — ese documento se lee para decidir qué se puede exponer, así que no puede repetir una suposición cómoda **HECHO**: seccion propia en `SECURITY.md`, *Personal data of people who never used this system*. Dice lo que es —dato personal bajo la **Ley 18.331**, y que "se comparte mucho" no es lo mismo que publico—, donde vive, quien lo ve, y que la frontera **es un tipo que el compilador sostiene, no una convencion**. Y lo que deliberadamente NO se hace: ni foto, ni firma, ni escaneo.
- [x] T017 [P] Anotar en `docs/tech-debt-tracker.md` que **la cédula se guarda sin normalizar** (research D5), con su disparador: el día que haga falta buscar por cédula **HECHO**: fila del 2026-08-30 con el costo escrito —los formatos van a estar mezclados, asi que normalizar despues sera sobre datos y no sobre un formato acordado— y su disparador.
- [x] T018 [P] Actualizar `ARCHITECTURE.md`: que las dos listas **dejaron de devolver la misma forma**, y por qué el tipo del cliente es el default. Es lo primero que lee cualquier agente antes de tocar `pedidos/` **HECHO**: `ARCHITECTURE.md` dice que las dos listas dejaron de devolver la misma forma, y por que el tipo del cliente es el default.
- [x] T019 `verify:` verde, **con los skips de Go en cero**. Si no lo están, **el verde de esa pata no cuenta y la tarea no se cierra**: falta `TEST_DATABASE_URL`, y sin ella no corrieron ni la migración ni la guarda de la cédula, que son las dos cosas que este feature no puede permitirse romper **HECHO**: las tres patas. Web lint limpio, **175 pruebas**, build OK. Go `vet` limpio, **8 paquetes, SKIPS: 0**. Android build OK, **50 pruebas**. Los skips se contaron con `-count=1`, porque una corrida cacheada no cuenta.
- [x] T020 Ejecutar el **nivel 1** del [quickstart](quickstart.md): Q1, **Q2 (romper la guarda de la cédula a propósito y verla en rojo)** y Q3 **HECHO**: Q1 (las tres patas verdes, Go con SKIPS 0), Q2 (la guarda rota a proposito: agregandole el documento al tipo del cliente sale en rojo **mostrando el JSON con la cedula adentro**) y Q3 (la migracion sobre 24 filas reales).
- [x] T021 Ejecutar el **nivel 2** en el emulador contra el servicio local: Q4 a Q8. **Q7 se mira sobre la respuesta del servicio, no sobre la pantalla** — una pantalla que no muestra un dato que igual viajó es exactamente la forma en que esto se rompe sin que nadie lo note **HECHO, contra el servicio local y mirando la base en cada paso.** Q4: **dos toques** y quedo `entrega | Lucía Fernández |` sin documento. Q5: el camino largo con nombre y cedula quedo `Susana la madre | 4.567.891-2`, y el boton esta **apagado sin nombre**. Q6: la tarjeta muestra el receptor, y **un pedido entregado antes de `016` no muestra nada** —ni hueco ni "sin datos"—. Q7: pasa a ser una prueba de Go que va **por el handler real** —Ana pide su lista y la cedula no viene, Diego pide la suya y si—, porque el token de sesion se guarda hasheado y no se puede emitir uno a mano para `curl`. Q8 queda para cuando la web se mire con una sesion de cliente. **HALLAZGO**: el boton de confirmar quedaba **debajo del borde de la hoja y no se podia tocar** con el teclado abierto, que es el estado normal. Es la misma familia que el boton con el texto cortado de `012`. Corregido con scroll e insets.
- [ ] T022 **TUYA** Desplegar la migración a producción y comprobar que **el servicio arranca**. Es el paso que el 2026-08-12 se dio por sentado
- [ ] T023 **TUYA** Nivel 3, Q9: que Diego lo use en una entrega real, incluyendo una a un tercero. Dos preguntas que solo contesta él: si los dos toques le alcanzan con las manos ocupadas, y **si pedir la cédula le resulta natural o incómodo frente a la persona**. Lo segundo puede cambiar el diseño
- [ ] T024 Poner `specs/016-quien-recibio/plan.md` en `status: completed` **después** de commitear el resto

---

## Dependencies

```text
T001 (linea de base, con skips en cero)
  └── Foundational (T002–T006)
        ├── US1/US2 (T007–T012)   ← la app y el endpoint
        └── US3 (T013–T015)       ← la web
              └── Polish (T016–T024)
                    └── T022 y T023 son TUYAS y bloquean T024
```

**T004 y T005 van juntas y antes que todo lo demás.** Partir los tipos sin la
guarda deja la regla sostenida por la memoria de quien la escribió; la guarda sin
partir los tipos no tiene qué proteger.

## Parallel opportunities

- **T014** en paralelo con la app
- **T016, T017 y T018** en paralelo con todo lo demás

## Implementation strategy

**MVP = Foundational + US1/US2.** Con eso Diego ya puede registrar quién recibió,
que es lo que pidió. La web (US3) es el valor para el otro lado y llega después.

## Requisitos sin tarea, a propósito

- **FR-012** (mover entre los otros estados sigue igual) no tiene tarea: se
  cumple no tocándolo, y lo comprueban las pruebas que ya existen (T019) y el
  quickstart (T021)
