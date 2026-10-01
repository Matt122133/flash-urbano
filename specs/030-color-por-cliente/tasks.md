# Tasks: El color de cada cliente en la tarjeta

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/color-de-cliente.md](contracts/color-de-cliente.md),
[quickstart.md](quickstart.md)

**Pruebas**: sí. El quickstart las enumera, y el repo no da por buena una guarda
negativa sin un control positivo.

**Antes de cada Edit/Write**: la ruta tiene que caer bajo un prefijo de
`covers:`. `docs/` y `specs/` están siempre permitidos por el sensor.

## Format: `[ID] [P?] [Story] Descripción`

- **[P]**: puede ir en paralelo (archivo distinto y sin dependencias pendientes)
- **[Story]**: US1, US2 o US3 del spec

---

## Fase 1: Preparación

- [X] T001 Correr el `verify:` del plan **antes de tocar nada**, con Docker
  Desktop levantado y `TEST_DATABASE_URL` definida, y anotar acá el conteo de
  `SKIP` de `go test -v ./...`. Es la línea de base: si después aparece un
  `SKIP` nuevo o un rojo, se sabe que es de este feature.
  **Resultado 2026-09-30**: `go vet`, `go test -p 1` y `go build` en verde con
  `TEST_DATABASE_URL` → 241 `--- PASS` de primer nivel y **2 `SKIP`**, los dos
  de FCM por falta de `FCM_CREDENCIAL_BASE64`; ninguno de base. Android:
  `assembleDebug testDebugUnitTest` → `BUILD SUCCESSFUL`.
- [ ] T002 Sacar una captura de **Pendientes** en el emulador con la app de hoy,
  con al menos tres pedidos. Contra esa captura se mide SC-003 (T021).

---

## Fase 2: Fundacional (bloquea las tres historias)

- [X] T003 Migración `backend/migrations/0010_color_de_cliente.sql`, con el
  encabezado en el estilo de `0009`: `ALTER TABLE usuarios ADD COLUMN color
  text CHECK (color ~ '^#[0-9a-f]{6}$')`, **nulable, sin default y sin
  relleno**, más `CREATE UNIQUE INDEX usuarios_color_unico ON usuarios (color)
  WHERE color IS NOT NULL`. El comentario explica por qué es nulable (la lección
  de `0006`) y por qué exige minúsculas (data-model).
- [X] T004 [P] Paquete nuevo `backend/internal/colores/colores.go`:
  `var Lista = []string{"#c026d3", "#0891b2", "#65a30d", "#7c3aed", "#db2777",
  "#8a7a00", "#86198f"}`, en ese orden (research D2); la conversión sRGB →
  OKLab y OKLCH; el contraste WCAG; `Valido(hex string) error`, con las cuatro
  reglas de D2 (contraste ≥ 3:1 contra `#ffffff`, croma ≥ 0.08, tono fuera de
  10–75, 135–165 y 250–280, y distancia ≥ 0.12 a los cinco reservados de
  `Paleta.kt`, con sus hex copiados y citando el archivo); y `Elegir(asignados
  []string) string` según D3 (primero libre de la lista; si no queda ninguno,
  la grilla OKLCH L 0.45–0.65 / C 0.10–0.22 / H cada 5°, filtrada por gamut y
  por `Valido`, eligiendo el que maximiza la distancia mínima a los asignados y
  los reservados; desempate por orden de grilla; comparación en minúsculas).
  **No agrega dependencias.**
- [X] T005 [P] Pruebas en `backend/internal/colores/colores_test.go`:
  - cada color de `Lista` pasa `Valido`, y no hay repetidos;
  - `Valido` rechaza el naranja, el azul, el verde y el rojo de `Paleta.kt`, un
    gris, un amarillo claro que no llega a 3:1 y un hex mal formado;
  - `Elegir(nil)` devuelve `Lista[0]`, y `Elegir` con los tres primeros
    devuelve `Lista[3]`, aunque los asignados vengan desordenados o en
    mayúsculas;
  - con la lista entera asignada, genera un color que pasa `Valido` y no está
    en los asignados;
  - **treinta llamadas encadenadas** (cada resultado se suma a los asignados)
    dan treinta colores distintos, todos válidos;
  - dos llamadas con la misma entrada dan la misma salida.

**Checkpoint**: la paleta existe y está probada sin base de datos.

---

## Fase 3: Historia 1 — dos clientes distintos no se ven iguales (P1) 🎯 MVP

**Goal**: la tarjeta dibuja la franja del color de la cuenta que creó el pedido.

**Independent Test**: dos cuentas con colores distintos (puestos a mano en la
base local), un pedido de cada una, y las dos franjas en el emulador; una
cuenta sin color, sin franja.

- [X] T006 [US1] **Hecho con un `LEFT JOIN LATERAL` de una sola columna en vez
  de un JOIN plano** (ver data-model): `usuarios` comparte con `pedidos` mas
  columnas que las previstas. En `backend/internal/pedidos/pedido.go`: `desdePedidos` suma
  `JOIN usuarios u ON u.id = pedidos.usuario_id`; `columnas` suma `u.color` al
  final; `escanear` lo lee a un campo **no exportado** `colorCliente *string`;
  `ParaAdmin` gana `ColorCliente *string` con `json:"colorCliente,omitempty"`,
  que `(*Pedido).ParaAdmin()` completa. Las siete lecturas ya usan
  `SELECT columnas + desdePedidos` y ninguna `RETURNING columnas` (revisado en
  el analyze), pero hay que volver a mirarlo por si cambió. Con el JOIN quedan
  ambiguas `id`, `creado_en` y `actualizado_en`, que existen en las dos
  tablas. Calificar las de `pedidos` en `columnas` y en los
  `ORDER BY`/`WHERE` que lo necesiten.
- [X] T007 [US1] En `backend/internal/pedidos/handlers.go`: `CambiarEstado`
  responde con `pedido.ParaAdmin()` en vez de `Pedido` (research D7). Si hace
  falta, un tipo de respuesta `{ "pedido": *ParaAdmin }` junto a
  `respuestaListaAdmin`, con un comentario que diga por qué.
- [X] T008 [US1] Pruebas en `backend/internal/pedidos/`:
  - `respuesta_cliente_test.go`: `colorCliente` **no** aparece en lo que ve el
    cliente (`respuestaLista`, `respuestaCrear`), y **sí** aparece en
    `respuestaListaAdmin` cuando hay color; sin color, la clave no viaja;
  - con base: una cuenta con color puesto a mano y un pedido suyo → `Todos`
    trae el color; `CambiarEstado` también; una cuenta sin color → nil;
  - con base: las consultas del cliente (`Mios`, crear, editar) siguen
    funcionando con el JOIN, sin errores de columna ambigua.
- [X] T009 [P] [US1] En
  `android/app/src/main/java/uy/flashurbano/repartidor/datos/Pedido.kt`:
  `val colorCliente: String? = null`, documentado como `comentario`, y la
  función pura `colorDeCliente(hex: String?): Long?`, que devuelve
  `0xFFrrggbb` sólo para `#rrggbb` (seis dígitos hex, sin importar
  mayúsculas) y `null` para todo lo demás.
- [X] T010 [P] [US1] Pruebas JVM: en
  `android/app/src/test/java/uy/flashurbano/repartidor/datos/PedidoTest.kt`, un
  pedido con `colorCliente` y otro sin la clave se leen bien; en un
  `ColorDeClienteTest.kt` nuevo, en el mismo directorio, `#c026d3` y `#C026D3`
  dan el mismo `Long`, y `null`, `""`, `c026d3`, `#c026d`, `#c026d3ff` y
  `#zzzzzz` dan `null`. Además, un pedido con una clave extra que la app no
  conoce se sigue leyendo (FR-012: así se ve una app vieja frente a un
  servicio nuevo).
- [X] T011 [US1] La franja en `TarjetaPedido`, en
  `android/app/src/main/java/uy/flashurbano/repartidor/pantallas/Principal.kt`:
  si `colorDeCliente(pedido.colorCliente)` no es nulo, un
  `Modifier.drawWithContent` que dibuja el contenido y encima un rectángulo de
  **6 dp** de ancho y el alto entero, en x = 0, recortado por la forma de la
  `Card`. **Sin cambiar ningún padding ni agregar ningún elemento** (FR-010,
  FR-011). Sin color, el modifier no se aplica. Un comentario explica por qué
  se dibuja y no se maqueta (research D5), y por qué no se confunde con el
  borde destacado (FR-009).

**Checkpoint**: con colores puestos a mano, la historia 1 se ve entera.

---

## Fase 4: Historia 2 — un cliente nuevo recibe su color solo (P2)

**Goal**: el color se asigna solo en la transición `perfil_completo false →
true`, y nunca se repite.

**Independent Test**: registrar una cuenta nueva por la web local y ver su
pedido con franja; editar el perfil y ver que el color no cambió.

- [X] T012 [US2] En `backend/internal/usuarios/usuario.go`, `GuardarPerfil`
  pasa a una transacción (research D4): `SELECT perfil_completo ... FOR
  UPDATE`; el `UPDATE` de hoy **sin cambiarle nada**; y, **sólo si el valor
  previo era `false`**, `pg_advisory_xact_lock(<clave fija, en una constante
  con comentario>)`, `SELECT color FROM usuarios WHERE color IS NOT NULL`,
  `colores.Elegir(...)`, y `UPDATE usuarios SET color = $2 WHERE id = $1 AND
  color IS NULL`. **`Usuario` y `columnas` de usuarios no cambian**: el color
  no viaja a `GET /yo`. Si la fila no existe, se mantiene el `ErrNoExiste` de
  hoy.
- [X] T013 [US2] Pruebas con base, en `backend/internal/usuarios/`:
  - cuenta nueva (perfil incompleto) → primer `GuardarPerfil` → tiene
    `Lista[0]`; una segunda cuenta nueva → `Lista[1]`;
  - la misma cuenta guarda el perfil otra vez → mismo color;
  - cuenta con perfil **ya completo y sin color** (una cuenta de prueba de hoy)
    → `GuardarPerfil` → **sigue sin color**;
  - **dos cuentas nuevas en paralelo** (dos goroutines, un `sync.WaitGroup`) →
    las dos tienen color, y son distintos;
  - escribir a mano el color de otra cuenta → error de índice único;
  - `GET /yo` no trae `color`.
- [X] T014 [US2] **Control positivo** (quickstart §1): comentar el lock **y**
  el índice único y correr la prueba de cuentas en paralelo **varias veces**
  hasta verla en rojo; restaurar los dos y verla en verde. Anotar acá cuántas
  corridas hicieron falta. Si nunca se pone en rojo, la prueba no detecta la
  carrera y hay que rehacerla, por ejemplo forzando el solapamiento con una
  barrera antes del `SELECT` de colores.
  **Resultado 2026-09-30**: sin el lock en el codigo y con el indice borrado de
  la base de pruebas, **rojo en la primera corrida** ("dos cuentas con el mismo
  color: #65a30d"). La prueba ya larga los ocho guardados juntos con una
  barrera (`sync.WaitGroup`). Restaurados los dos, **verde cinco veces
  seguidas**. El control del indice solo (sin tocar el lock) queda cubierto por
  `TestLaBaseRechazaUnColorRepetidoOMalEscrito`.

**Checkpoint**: una cuenta nueva sale con color sin que nadie haga nada.

---

## Fase 5: Historia 3 — los tres clientes reales de hoy tienen color (P3)

**Goal**: el procedimiento manual, documentado sin datos.

**Independent Test**: seguir el documento en la base local sobre una cuenta
existente y ver su franja.

- [X] T015 [US3] `docs/processes/color-de-clientes.md`: para qué es; cómo abrir
  la sesión de base en staging y en producción (remitir a
  `docs/processes/staging.md`, sin repetir comandos que puedan quedar viejos); cómo **buscar el `id` sin copiarlo a ningún archivo**; el `UPDATE
  usuarios SET color = '<hex>' WHERE id = '<id>' AND color IS NULL`; **qué
  color usar** (el siguiente libre de `colores.Lista`, en orden, con la
  consulta para saber cuáles están tomados); y cómo verificarlo. Sin nombres,
  correos ni ids reales: las tres cuentas se nombran como "las tres cuentas
  reales".
- [X] T016 [US3] Entrada de una línea en `docs/README.md`.
- [ ] T017 [US3] Seguir el documento en la base **local** sobre una cuenta
  existente, y confirmar que sus pedidos viejos muestran la franja en el
  emulador. Corregir el documento si algún paso no anduvo tal cual.

---

## Fase 6: Cierre

- [X] T018 `verify:` entero con `TEST_DATABASE_URL` y **ningún `SKIP` nuevo**
  respecto de T001.
  **Resultado 2026-09-30**: verde, 260 `--- PASS` de primer nivel (19 nuevos:
  7 de colores, 5 de pedidos, 7 de usuarios) y los mismos **2 `SKIP`** de FCM.
  Android `BUILD SUCCESSFUL`, con `ColorDeClienteTest` (3) y `PedidoTest` (13)
  sin fallas.
- [X] T019 Chequeo de datos antes de commitear:
  `git diff master..HEAD | grep "^+" | grep -oE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+"`
  tiene que salir vacío, y ningún archivo nuevo puede contener el nombre
  comercial de un cliente.
- [X] T020 Commitear **con el plan todavía `active`**, stageando rutas
  explícitas. Mensaje: `feat: el color de cada cliente en la tarjeta
  030-color-por-cliente`.
- [X] T021 Quickstart §2 en el emulador: los pasos 2 a 5, y **SC-003 contra la
  captura de T002**. Cerrar el emulador y pasarle a Mateo el comando para
  repetirlo.
  **Hecho 2026-09-30 en el emulador, con Mateo.** Dos cuentas locales
  coloreadas a mano (fucsia y cian, los dos primeros de la lista). Visto:
  franjas distintas por cuenta e iguales dentro de la misma cuenta; la cuenta
  sin color, sin franja; la franja no pisa texto, convive con el bloque de
  comentario y con "LO RECIBIÓ", sigue en En curso despues de "Lo tengo" y
  aparece en Entregados. **Ajuste pedido por Mateo**: que no pase por el
  costado del boton de accion → `drawBehind` (research D5). Mateo: "quedo
  perfecto".
  **Sin hacer**: la comparacion numerica de SC-003 contra la captura de T002,
  que no se saco con sesion iniciada. La franja se dibuja y no cambia ninguna
  medida, asi que no puede cambiar cuantas tarjetas entran, pero no se midio.
  Tampoco se miro la tarjeta destacada (FR-009) en pantalla.
- [ ] T022 Quickstart §3 en **staging**: `railway up`, colorear una cuenta de
  staging con el documento, registrar una nueva, y mirar la app apuntada a
  staging en el teléfono de Mateo.
  **Parcial 2026-09-30**: `railway up` al servicio de staging → deploy
  `SUCCESS` y `/salud` con `"ambiente":"staging"`. Como el servicio aplica las
  migraciones al arrancar y no arranca si una falla, **la `0010` entró**.
  **Falta**: colorear una cuenta de staging con el documento, registrar una
  nueva y mirar la app contra staging. Necesita a Mateo: la sesión de base de
  staging (`railway connect postgis --environment staging` no encontró la
  variable de conexión desde la sesión) y el código de ingreso por mail.
- [X] T023 Anotar en `docs/tech-debt-tracker.md` (fila nueva arriba) lo que
  haya quedado, como mínimo: **pasados ~16 clientes los colores generados se
  parecen** (research D3), y que no hay pantalla para cambiar un color.
- [ ] T024 Después del merge y del deploy: colorear **las tres cuentas reales**
  en producción, publicar el APK y confirmar con Diego que ve las franjas.
  **SC-001**: con pedidos de las tres cuentas en Pendientes, mostrarle la
  pantalla a alguien que no conozca a los clientes y pedirle que agrupe las
  tarjetas sin leer. Anotar acá el resultado. El
  feature se entrega ahí (spec, *Dependencias*). Pasar el plan a `completed`
  **después** del commit que lo cierra.

---

## Dependencias

- **Fase 2 → todo.** T003 bloquea toda prueba con base. T004 bloquea T012.
- **US1**: T006 → T007 → T008 del lado del servicio; T009 → T010 y T011 del
  lado de la app. Los dos lados son independientes hasta mirarlo en el
  emulador.
- **US2** depende sólo de la Fase 2. **US1 y US2 no dependen entre sí**: US1 se
  prueba con colores puestos a mano, y US2 se prueba sin la app.
- **US3** necesita T003 y, para T017, US1.
- **Cierre**: todo lo anterior.

## En paralelo

- T004 y T005 con T003.
- Dentro de US1: el lado Go (T006–T008) con el lado Android (T009–T011).
- US2 entera con el lado Android de US1.

## Estrategia

1. **MVP = Fase 2 + US1**. Con los tres colores puestos a mano ya se resuelve lo
   que falló el 2026-09-30, aunque ningún cliente nuevo reciba color solo.
2. US2 hace que no dependa de acordarse.
3. US3 es el documento, y en producción es lo que hace visible todo lo anterior
   el primer día.
