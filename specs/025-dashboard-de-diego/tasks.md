# Tasks: El tablero de Diego

**Feature**: `025-dashboard-de-diego` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Organización**: por historia. US1 y US2 son P1, US3 es P2. Las tres comparten
un endpoint y un módulo de cálculo, que se construyen en la Fase 3 (bloquea a
todas); cada historia agrega **su parte del cálculo, su prueba y su parte de la
pantalla**.

**Sobre las pruebas: acá no son opcionales.** FR-014 y SC-007 exigen una prueba
automática que falle si el feature lee `precio` o muestra un monto, y las
invariantes de [data-model.md](data-model.md) son lo único del cálculo que se
puede probar sin abrir un navegador. Dos límites que ordenan todo lo de abajo:

- `web/vitest.config.ts` corre en `environment: "node"` sobre
  `lib/**/*.test.ts`. **Nada en este repo renderiza React**: los seis estados de
  la pantalla salen del [quickstart](quickstart.md) o no salen.
- Las pruebas de Go contra Postgres **se saltan solas** sin `TEST_DATABASE_URL`.
  Un `verify:` verde vale solo con **cero SKIP** contados.

**El orden que manda**: en un cambio cuyo riesgo es la omisión, **el control va
antes que el trabajo** (`013`, donde la guarda escrita primero encontró dos
lugares que el inventario manual no había visto). Por eso la Fase 2 son las
guardas, escritas antes que una línea de la consulta o de la pantalla.

**Stagear rutas explícitas**, nunca `git add -A`: el `backend/.env` puede
aparecer como no rastreado según la rama.

---

## Fase 1: Preparación

- [X] T001 Con Docker Desktop levantado y `flash-pg-test` en el 55432, correr el
  `verify:` del plan con
  `TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable'`
  y contar los SKIP (`go test ./... -p 1 -v 2>&1 | grep -c -- '--- SKIP'`).
  Anotar el resultado acá: es la línea de base. Esperado: verde y `0`. **Nunca
  contra `flash-pg-dev` (55433)**: el arnés de pruebas borra usuarios. Si Docker
  no está levantado, es de Mateo.
  **Resultado (2026-09-11)**: verde. Web: lint, **224** pruebas, build. Go: vet,
  build, **288 PASS**, 0 FAIL, **2 SKIP que no son de Postgres**: las dos de
  `internal/avisos/proveedor_real_test.go`, que piden `FCM_CREDENCIAL_BASE64`
  real. **Cero pruebas de base salteadas.** Esos 2 SKIP son la línea de base: más
  de 2 al cerrar es una prueba de base que no corrió.

---

## Fase 2: Las guardas, antes que el código (FR-014, SC-007)

**Por qué primero**: una guarda escrita después de la implementación se escribe
para que pase. Escrita antes, se escribe para que falle, y sus controles
positivos se ven en rojo sobre algo que todavía no existe.

- [X] T002 Crear `backend/internal/tablero/tablero.go` con **solo** la cláusula
  `package tablero` y el comentario de paquete: qué es (contar pedidos para
  mirar, solo lectura), y por qué **no importa `internal/pedidos`** y no puede
  nombrar el precio (research D2). Sin tipos ni funciones todavía.
- [X] T003 Crear `backend/internal/tablero/sin_plata_test.go` con dos funciones
  auxiliares y sus pruebas (research D9). Sin base de datos: estas corren
  siempre.
  - `nombresDePlata(fuente []byte) []string`: recorre el fuente con
    `go/scanner` **sin** `scanner.ScanComments`, y devuelve los tokens `IDENT` y
    `STRING` que coincidan con `(?i)precio|monto|importe|costo`. Los
    comentarios quedan fuera a propósito: explicar por qué el precio no está es
    útil (mismo criterio que la guarda de `013`).
  - `importaPedidos(fuente []byte) bool`: `go/parser` con `parser.ImportsOnly`;
    true si algún import termina en `/internal/pedidos`.
  - **Control positivo de cada una, y no son opcionales**: un fuente sintético
    con `const q = "SELECT creado_en, precio FROM pedidos"` y un campo `Precio
    int` tiene que dar dos coincidencias; uno con
    `import _ "github.com/Matt122133/flash-urbano/backend/internal/pedidos"`
    tiene que dar true. Y uno con `// el precio no se lee` como único uso tiene
    que dar **cero**: prueba que los comentarios de verdad quedan afuera.
  - La prueba real: recorre los `*.go` **no `_test.go`** del directorio del
    paquete, afirma que no hay coincidencias ni import prohibido, y **falla si
    escaneó cero archivos** —si no, un directorio vacío o un camino mal armado
    la dejan en verde sin mirar nada—.
  - `cd backend && go test ./internal/tablero/` en verde.
- [X] T004 Crear el esqueleto de la pantalla, sin contenido todavía:
  `web/app/tablero/page.tsx` (componente de **servidor**: exporta `metadata` con
  `title` y `robots: { index: false, follow: false }`, y monta `<Tablero />`) y
  `web/components/tablero/tablero.tsx` (`"use client"`, exporta `Tablero`, que
  por ahora devuelve el "Un momento…" del estado 1). **Leer antes la guía de
  `metadata` en `web/node_modules/next/dist/docs/`** (`web/AGENTS.md`).
- [X] T005 En `web/lib/sin-precio-a-la-vista.test.ts`, agregar una prueba que
  afirme que los archivos que el escaneo recorre **incluyen**
  `app/tablero/page.tsx` y `components/tablero/tablero.tsx`, reusando la misma
  función de recorrido de la guarda (no una lista aparte). Es el control
  positivo de D9: sin él, mover el tablero a otra carpeta dejaría la guarda
  verde sin mirarlo. **No relajar nada de lo que la guarda ya prohíbe**, ni
  tocar `EXCEPTUADOS`. `cd web && npm test` en verde.

---

## Fase 3: Lo que comparten las tres historias (bloquea a todas)

**Meta**: el endpoint responde con hechos a quien es admin y con 403 a quien
no, y la web sabe si la cuenta es admin.

### El servicio

- [X] T006 En `backend/internal/tablero/tablero.go`: tipos `Carga`
  (`CreadoEn time.Time` → `json:"creadoEn"`, `Cantidad int` → `"cantidad"`,
  `ClienteID string` → `"clienteId"`) y `Cliente` (`ID` → `"id"`, `Nombre
  *string` → `"nombre"`, **sin `omitempty`**, para que viaje `null`; `Email` →
  `"email"`); `Repositorio` con `NuevoRepositorio(pool *db.Pool)` y dos
  métodos. Contrato: [contracts/tablero.md](contracts/tablero.md) §1.
  - `Cargas(ctx)`: `SELECT creado_en, cantidad, usuario_id FROM pedidos ORDER
    BY creado_en, id`. **Sin `WHERE`**: ni por estado ni por cuenta (FR-004b).
  - `Clientes(ctx)`: `SELECT id, nombre, email FROM usuarios ORDER BY nombre IS
    NULL, lower(nombre), email`. Todas las cuentas, incluidas las
    administradoras y las que no tienen pedidos (D6).
  - Los dos devuelven **slice vacío y no `nil`** sin filas.
  - Al terminar, `go test ./internal/tablero/` sigue verde: si la guarda de T003
    se pone en rojo, la consulta nombró algo que no debía.
- [X] T007 Crear `backend/internal/tablero/tablero_test.go`, contra Postgres, con
  un helper `repositorioDePrueba` que **se salta sin `TEST_DATABASE_URL`** y
  limpia en el orden que imponen los `RESTRICT`: `pedidos_estados`, `pedidos`,
  `usuarios` (copiar el de `internal/pedidos/pedido_test.go`). Los pedidos se
  crean con `pedidos.NuevoRepositorio(...).Crear` —**el import de `pedidos` es
  legal acá** porque la guarda de T003 solo mira los no-test— y `creado_en` se
  fija con un `UPDATE` cuando la prueba lo necesita. Casos:
  - Dos cuentas con pedidos, uno de ellos movido a `entrega` con
    `CambiarEstado`: `Cargas` devuelve **todos**, en orden de `creado_en`
    (FR-004b, FR-005a).
  - `Clientes` incluye una cuenta **sin pedidos**, y una creada con
    `BuscarOCrear` sin `CompletarAlta` sale con `Nombre == nil`, no `""`.
  - Base vacía: los dos devuelven slice vacío, no `nil`.
- [X] T008 Crear `backend/internal/tablero/handlers.go`: `Handlers{repo,
  esAdmin func(string) bool}`, `NuevosHandlers(repo, esAdmin)`, y
  `(h *Handlers) Ver(w, r)` para `GET /admin/tablero`:
  - Usuario del contexto con `usuarios.DeContexto`; si falta, `ErrorInterno`
    (error de cableado, como en `pedidos.Todos`).
  - **403 `"no autorizado"`** si `!h.esAdmin(u.Email)`, **antes** de tocar la
    base: el 403 no puede llevar un dato (SC-004).
  - 200 con `respuesta{Pedidos []Carga "pedidos", Clientes []Cliente
    "clientes"}`. Sin parámetros: se ignoran.
- [X] T009 Crear `backend/internal/tablero/handlers_test.go` con un `monta` como
  el de `internal/pedidos/handlers_test.go` (resolver contra un mapa,
  `httpx.ConSesion`, `httpx.ErrSesionInvalida` para el token desconocido) y los
  casos del contrato:
  - Sin credencial → **401**.
  - Cuenta común → **403**, cuerpo exactamente `{"error":"no autorizado"}`, y
    con pedidos cargados en la base el cuerpo **no contiene** ni el mail de
    nadie ni `"pedidos"` ni `"clientes"` (SC-004). **Control positivo en la
    misma prueba**: la cuenta admin, con la misma base, sí recibe esos datos.
  - Admin con base vacía → 200 con `"pedidos":[]` y `"clientes":[...]`, nunca
    `null` (se afirma sobre el JSON crudo, no sobre el struct).
  - FR-017 (solo lectura) **no** se prueba acá: un 405 sobre el `monta` de esta
    prueba solo diría algo del enrutador de la prueba. Va contra el enrutador
    real, en T011.
- [X] T010 Agregar a `backend/internal/tablero/sin_plata_test.go` la guarda de la
  respuesta (D9): serializar una `respuesta` con una carga y un cliente de
  ejemplo, recorrer **todas las claves** del JSON y fallar si alguna coincide con
  `(?i)precio|monto|importe|costo`. Sin base.
- [X] T011 En `backend/cmd/api/main.go`: construir
  `tablero.NuevosHandlers(tablero.NuevoRepositorio(pool), cfg.EsAdmin)`, sumarlo
  a `dependencias`, y montar `mux.Handle("GET /admin/tablero",
  conSesion(dep.tablero.Ver))` junto a las otras rutas de admin, con un
  comentario de por qué va con `conSesion` y dónde se decide el 403. En
  `backend/cmd/api/main_test.go`, agregar `"/admin/tablero"` a la lista de
  caminos de `TestElPreflightAutorizaTodosLosMetodosQueSirveElEnrutador`.
  **Y una prueba nueva para FR-017 (solo lectura)**, sobre el enrutador real
  (`rutas(nil, dependencias{})`) y con la misma técnica que esa: un método
  inventado a `/admin/tablero` devuelve 405 con la cabecera `Allow`, y esa
  cabecera **no puede contener nada fuera de `GET` y `HEAD`** (el `ServeMux`
  suma `HEAD` solo, por el patrón `GET`). La prueba del preflight **no** cubre
  esto: solo exige que lo servido esté autorizado por el CORS, y `PATCH` y
  `DELETE` ya lo están. **Control positivo en la misma prueba**: la misma
  lectura sobre `/pedidos/{id}` sí encuentra `PATCH` y `DELETE`, así que la
  técnica sabe ver un método de escritura cuando existe.
- [X] T012 **Romper a propósito** y ver cada guarda de Go en rojo, revirtiendo
  después de cada una (quickstart Q2, filas 1 y 2): agregar `, precio` al
  `SELECT` de `Cargas` → rojo en T003; agregar el import de `internal/pedidos` a
  `tablero.go` → rojo en T003. Anotar acá qué prueba se puso en rojo y con qué
  mensaje.
  **Resultado (2026-09-11)**: `, precio` en el `SELECT` → rojo en
  `TestElTableroNoNombraLaPlata`, que cita el SQL entero. Import de
  `internal/pedidos` → rojo en `TestElTableroNoImportaPedidos`. **Y una tercera
  que no estaba en la lista**: `POST /admin/tablero` en `main.go` → rojo en
  `TestElTableroEsDeSoloLectura` **con el preflight en verde**, que es
  exactamente lo que G1 del analyze decía. También se rompió a propósito la
  consulta con `WHERE estado <> 'entrega'`: rojo en
  `TestCargasTraeTodosLosPedidosSinFiltrar` ("tenían que ser 3 cargas… y fueron
  2"). Todo revertido y verde.

### La web

- [X] T013 [P] En `web/components/sesion/proveedor-sesion.tsx` (research D7):
  - Agregar al tipo `Usuario` el campo `esAdmin?: boolean`, con un comentario
    que diga sus **tres** valores: `true`/`false` los contesta `/yo`;
    **`undefined` es lo que deja el ingreso**, que no trae el campo porque `auth`
    no conoce la configuración, y significa "no sé", no "no". **No es una
    guarda**: el que niega es el servicio.
  - En `entrar()`, después de `guardar(...)` y `setUsuario(respuesta.usuario)`,
    releer `/yo` **en segundo plano** con la credencial recién guardada y, si
    contesta, copiar **solo `esAdmin`** con
    `setUsuario(prev => prev && prev.id === u.id ? { ...prev, esAdmin: u.esAdmin } : prev)`.
    **Solo ese campo, nunca el usuario entero**: la relectura compite con
    *completar el alta*, y pisar todo le devolvería `perfilCompleto: false` a
    quien ya guardó nombre y teléfono. Un fallo se traga en silencio: queda
    `undefined` y el tablero le pregunta al servicio. Un 401 acá **no** llama a
    `vencio()`: la sesión se acaba de crear, y un aviso de sesión vencida en ese
    momento sería peor que no saber si es admin.
  - La rehidratación al abrir el sitio no cambia: ya lee `/yo`.
- [X] T014 [P] Crear `web/lib/tablero.ts` con los tipos que viajan
  (`Carga { creadoEn: string; cantidad: number; clienteId: string }`,
  `Cliente { id: string; nombre: string | null; email: string }`,
  `RespuestaTablero { pedidos: Carga[]; clientes: Cliente[] }`) y el tipo
  `Corte = "dia" | "semana" | "mes"`. El comentario del módulo dice por qué el
  cálculo vive acá y no en SQL (research D1) y que **en este archivo tampoco se
  nombra el precio**.

**Checkpoint**: `verify:` verde, con cero SKIP. El endpoint existe y está
cerrado para quien no es admin; todavía no hay pantalla que lo use.

---

## Fase 4: US1 — Cuántos pedidos van (P1) 🎯 MVP

**Meta**: Diego abre `/tablero` con su cuenta y ve cuántos pedidos hay
registrados; nadie más ve nada.

**Prueba independiente**: entrar como admin y comparar el número con
`SELECT count(*) FROM pedidos`; entrar con una cuenta común y no obtener nada.

- [X] T015 [US1] En `web/lib/tablero.ts`: las constantes de copy de research D10
  (`TEXTO_TOTAL`, `BAJADA_TOTAL`, `TEXTO_SIN_PEDIDOS`, `TEXTO_ERROR`,
  `TEXTO_SOLO_ADMINISTRACION`) y `registrados(cargas: Carga[]): number`.
- [X] T016 [US1] Mover `sinComentarios` de `web/lib/sin-precio-a-la-vista.test.ts`
  a un módulo nuevo, `web/lib/sin-comentarios.ts`, **sin cambiarle una línea**,
  e importarlo desde las dos pruebas. **Por qué no importarlo del archivo de
  pruebas directamente**: importar un `.test.ts` desde otro registra sus casos
  una segunda vez. La guarda de `013`/`024` tiene que seguir verde con el mismo
  número de casos que antes: contarlos antes y después.
- [X] T017 [US1] Crear `web/lib/tablero.test.ts` con:
  - **FR-004a**: ningún texto exportado del módulo coincide con
    `/hist[oó]ric/i`, recorriendo los exports de tipo `string` (no una lista
    escrita a mano, que se desactualiza). **Control positivo**: la misma
    comprobación sobre `"Pedidos históricos"` da positivo.
  - `registrados` sobre cero, una y varias cargas.
  - **La guarda de `lib/`** (D9): leer el fuente de `lib/tablero.ts`, sacar los
    comentarios con `sinComentarios` (de `lib/sin-comentarios.ts`, T016) y
    afirmar que no coincide con `/precio|monto|importe|costo/i` ni con
    `/\$\s*\d/`. Control positivo: la misma comprobación sobre
    `"const x = zona.precio"` da positivo, y sobre `"// precio"` da negativo.
- [X] T018 [US1] En `web/components/tablero/tablero.tsx`, los estados 1 a 6 de
  [contracts/tablero.md](contracts/tablero.md) §2, en ese orden:
  - `useSesion()` para `cargando` y `usuario`.
  - Sin sesión: `<PanelIngreso onListo={() => {}} />` en el lugar (D8), sin el
    pie que invita a cargar un pedido.
  - `usuario.esAdmin === false`: `TEXTO_SOLO_ADMINISTRACION` y **ninguna
    llamada** al servicio (D7, FR-003).
  - **`usuario.esAdmin === undefined` NO es `false`**: es lo que queda recién
    entrado, porque el ingreso no trae el campo. Pide igual que un admin, y el
    403 decide. Escribir la condición como `!== true` es el defecto que el
    analyze encontró (C1): Diego entra desde el panel y la pantalla le dice que
    no es administrador.
  - `esAdmin` en `true` o `undefined`: `useLlamadaAutenticada()` contra `"/admin/tablero"`, con el patrón
    de cancelación de `components/pedido/historial.tsx`. **Leer antes su
    comentario sobre `yaCorrio`**: cancelar en la limpieza de un efecto que no
    puede volver a correr cuelga la pantalla (lección de `022`).
  - Error: `TEXTO_ERROR` y un botón **Reintentar** que vuelve a pedir. **Nunca
    ceros** (FR-016). Un `ErrorApi` con `estado === 403` va al estado de "solo
    administración", no al de error.
  - Listo: `TEXTO_TOTAL` con el número de `registrados` grande y `BAJADA_TOTAL`
    debajo. Con cero pedidos, además `TEXTO_SIN_PEDIDOS` (FR-015).
  - Mismo idioma visual que `/perfil` (`sectionClass`, `text-slate-*`,
    `border-brand`), contenedor más ancho que el suyo (`max-w-3xl`).
- [X] T019 [US1] En `web/components/nav-bar.tsx`, el enlace **"Tablero"** a
  `/tablero` cuando `usuario?.esAdmin === true`, junto a *Mi cuenta*, **en la
  barra de escritorio y en el menú móvil** (D12). No va en `LINKS`: esa lista
  es para todo el mundo. Acá `undefined` **sí** es "no mostrar": el enlace
  aparece cuando la relectura de `/yo` de T013 contesta, sin recargar.
- [X] T020 [US1] `cd web && npm run lint && npm test && npm run build`. El build
  tiene que exportar `/tablero` como página estática; si falla por un límite de
  `Suspense`, es que algo usó `useSearchParams` —no debería: el estado va en el
  componente (D11)—.

**Checkpoint**: US1 entera. Con esto solo, Diego ya contesta "cuántos pedidos
hay" sin contar a mano.

---

## Fase 5: US2 — Cuántos paquetes por período (P1)

**Meta**: elegir día, semana o mes y ver, por período, cuántos pedidos y cuántos
paquetes, por fecha de carga y en hora de Montevideo.

**Prueba independiente**: comparar cada fila de los tres cortes contra el SQL de
quickstart Q4.

- [X] T021 [US2] En `web/lib/tablero.ts`, las funciones del corte (data-model.md
  y research D3–D5):
  - `fechaEnMontevideo(instante: string): string` → `YYYY-MM-DD` con
    `Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", ... })`.
    **Nunca** `getDate()` ni la zona del proceso.
  - `periodoDe(fecha: string, corte: Corte): { clave: string; rotulo: string }`
    con la semana **de lunes** y los rótulos de la tabla de D4, con los nombres
    de días y meses **escritos a mano** en el módulo.
  - `resumir(cargas, { corte, hoy }): { registrados: number; filas: Fila[] }`
    donde `Fila = { periodo; pedidos; paquetes }`: del período de la primera
    carga al de `hoy`, **sin huecos**, del más nuevo al más viejo; sin cargas,
    una sola fila del período de `hoy` en cero. `hoy` entra por parámetro
    (`YYYY-MM-DD` de Montevideo).
  - `TEXTO_CORTE`: la aclaración de FR-006a, que menciona la fecha de carga.
- [X] T022 [US2] En `web/lib/tablero.test.ts`, las invariantes 1 a 5, 7 y 8 de
  data-model.md, cada una con su caso:
  - **SC-006, y cómo NO escribirla** (analyze T1): `"2026-09-11T01:30:00Z"`
    (22:30 del 10 en Montevideo) cae en `2026-09-10`. **Pero esa afirmación sola
    no detecta nada en la máquina donde corre `verify:`**, que está en
    Montevideo: una implementación rota con `getDate()` —la zona del proceso—
    también da el 10. Por eso:
    - Al tope del archivo, **antes de cualquier `new Date`**, fijar
      `process.env.TZ = "Asia/Tokyo"` (UTC+9: ese instante es el **11** a las
      10:30), y restaurar el valor original en `afterAll`. Vitest 4 corre cada
      archivo en su propio proceso (`pool: "forks"`) y Node aplica un cambio de
      `TZ` en caliente.
    - **Una prueba que afirme que el cambio tomó efecto**:
      `new Date("2026-09-11T01:30:00Z").getDate() === 11`. Si la herramienta
      dejara de respetar el `TZ` en caliente, esta se pone en rojo en vez de
      dejar pasar el caso de SC-006 por casualidad. Es el control positivo de
      la guarda: sin él, la prueba mide la zona de la máquina y no el código.
    - Con eso, `fechaEnMontevideo` tiene que dar `2026-09-10` en un proceso que
      cree estar en Tokio. Solo lo logra si usa `timeZone:
      "America/Montevideo"` explícito.
  - **SC-002a**: un período con una carga de 3 paquetes y otra de 1 da
    `pedidos: 2, paquetes: 4`. Si alguien suma pedidos en las dos columnas, esta
    se pone en rojo.
  - Suma de filas = `registrados` en los **tres** cortes, sobre el mismo juego
    de cargas repartido en varios meses.
  - Un domingo cae en la semana del lunes anterior; el rótulo de semana nombra
    los dos extremos.
  - Un mes sin cargas entre dos con cargas aparece en cero.
  - Cero cargas: una fila, la de `hoy`, en cero.
  - `TEXTO_CORTE` menciona la carga (`/carg/i`).
- [X] T023 [US2] En `web/components/tablero/tablero.tsx`: los tres botones de
  corte (Día, Semana, Mes) con `aria-pressed`, **Mes** por defecto, el
  `TEXTO_CORTE` pegado a ellos, y la tabla con encabezados *Período*,
  *Pedidos*, *Paquetes* sobre `resumir(...)`. `hoy` sale de
  `fechaEnMontevideo(new Date().toISOString())`, calculado en el componente y
  pasado a la función pura. Cambiar de corte **no** vuelve a llamar al
  servicio (D1).
- [X] T024 [US2] `cd web && npm run lint && npm test && npm run build`.

**Checkpoint**: US1 + US2. SC-001 cumplido: "cuántos paquetes me pidieron este
mes" es la primera fila.

---

## Fase 6: US3 — Filtrar por cliente (P2)

**Meta**: acotar el total y el corte a una cuenta, y volver a todo sin perder el
corte.

**Prueba independiente**: elegir un cliente conocido y comparar con el SQL con
`WHERE usuario_id = '…'`.

- [X] T025 [US3] En `web/lib/tablero.ts`: `resumir` acepta `clienteId?:
  string` y cuenta solo sus cargas, **con el mismo rango de períodos que sin
  filtro** (D5: las filas no aparecen ni desaparecen al filtrar);
  `rotuloCliente(c: Cliente): string` → `"Nombre — mail"`, o solo el mail si
  `nombre` es `null`; y `TEXTO_CLIENTE_SIN_PEDIDOS` (FR-011).
- [X] T026 [US3] En `web/lib/tablero.test.ts`, la invariante 6: con un cliente,
  solo cuentan sus cargas y el rango es el mismo que sin filtro; un cliente sin
  cargas da `registrados: 0` y todas las filas en cero; dos clientes con el
  mismo nombre dan rótulos **distintos** (US3-4); `nombre: null` da solo el
  mail. **Control positivo del filtro**: el mismo juego de cargas sin
  `clienteId` da un total mayor —si no, el filtro podría no estar filtrando—.
- [X] T027 [US3] En `web/components/tablero/tablero.tsx`: el `<select>` con
  "Todos los clientes" primero y `rotuloCliente` para cada cuenta, con `<label>`
  asociado. El cliente elegido es estado del componente, **separado del
  corte**: volver a "Todos" no toca el corte (FR-010). Con un cliente sin
  pedidos, `TEXTO_CLIENTE_SIN_PEDIDOS`.
- [X] T028 [US3] `cd web && npm run lint && npm test && npm run build`.

**Checkpoint**: las tres historias.

---

## Fase 7: Cierre

- [X] T029 Actualizar `ARCHITECTURE.md`: `tablero/` en la lista de paquetes de
  `internal/` (sección *Module pattern*), y una entrada en *Current hotspots*
  para `backend/internal/tablero` + `web/lib/tablero.ts` que diga lo que se
  deshace fácil sin querer: **el paquete no importa `internal/pedidos` y hay
  una prueba que lo sostiene**, y el cálculo vive en la web a propósito, no en
  SQL (research D1, D2).
- [X] T030 `verify:` entero con `TEST_DATABASE_URL` y **cero SKIP** (quickstart
  Q1). Anotar el conteo de pruebas de Go y de web.
  **Resultado (2026-09-11)**: verde. Web: lint, **267** pruebas (eran 224),
  build con `/tablero` estático. Go: vet, build, **305 PASS** (eran 288), 0 FAIL,
  **2 SKIP, los mismos de la línea de base** (FCM real, no Postgres).
- [X] T031 Romper a propósito las cuatro guardas de la web (quickstart Q2, filas
  3 a 6), una por vez, y revertir. Anotar qué se puso en rojo. La fila 6 es la
  de T1: cambiar `fechaEnMontevideo` para que use `getDate()` y la zona del
  proceso tiene que poner en rojo la prueba de SC-006 **en esta máquina**, que
  está en Montevideo. Si queda verde, la prueba no protege nada.
  **Resultado (2026-09-11)**, las cuatro en rojo y revertidas:
  `<span>$ 150</span>` en `tablero.tsx` → rojo en `sin-precio-a-la-vista`
  ("volvió a traer: un monto en pesos"). El componente movido fuera de
  `components/` → rojo en "el tablero de 025 está entre lo que se mira".
  `TEXTO_TOTAL = "Pedidos históricos"` → rojo en `TEXTO_TOTAL`.
  `fechaEnMontevideo` con `getDate()` → **5 rojas**, entre ellas la de las 22:30.
  **Y el contrafáctico de T1, medido**: con la misma implementación rota y el
  `TZ` de Tokio apagado, las cinco pasan en verde en esta máquina, y la única que
  falla es el control "el proceso está de verdad en otra zona". O sea que el
  analyze tenía razón, y ese control es lo que impide que se repita.
- [X] T032 Pasarle a Mateo los comandos para levantar backend y sitio
  (`backend/dev.sh`, `cd web && npm run dev`) y **no dejar un dev server
  corriendo**. Correr con él el quickstart **Q3 a Q14** en el navegador, y
  anotar acá el resultado de cada uno. Lo que no se corra se escribe como no
  corrido, no se tilda.
  **Avance del 2026-09-11, sin navegador** (la tarea sigue abierta):
  - **Q3, Q4, Q5 y Q7.1 a nivel de datos: COINCIDE CON LA BASE.** La respuesta
    real de `GET /admin/tablero` sobre `flash-pg-dev` (14 pedidos, 20 paquetes,
    2 cuentas) pasada por `resumir()`, contra un calculo independiente en SQL con
    `date_trunc(... AT TIME ZONE 'America/Montevideo')`: los tres cortes y los
    dos clientes, fila por fila. Agosto da 6 pedidos y 11 paquetes (SC-002a con
    datos reales).
  - **Q6 con un caso real, no sembrado**: 6 pedidos cargados a las 00:51 UTC del
    lunes 31/8 caen el **domingo 30** y en la semana **del 24 al 30**. En UTC
    serian otro dia y otra semana.
  - **Q10.3 contra el servicio real** (binario local, dos sesiones de prueba
    creadas en la base de desarrollo y borradas al terminar): sin credencial
    401, cuenta comun 403 con `{"error":"no autorizado"}` exacto, admin 200,
    `POST` 405. **Preflight de CORS desde `localhost:3000`: 204, autoriza
    `Authorization`**; el `GET` vuelve con el origen permitido.
  - La cuenta con el alta a medias viaja con `nombre: null` y al final (D6).
  - **Encontro un defecto**: `creadoEn` salia con la zona del PROCESO
    (`-03:00` aca, `Z` en Railway), no en UTC como dice el contrato. Corregido
    en `Cargas` con `.UTC()`, con la prueba escrita antes y vista en rojo.
  - **Falta todo lo de pantalla**: Q3/Q4 mirando la tabla, Q7.2 a Q7.4, Q8, Q9,
    Q10.1 y Q10.2, Q11 (los tres recorridos de `esAdmin`), Q12, Q13 y Q14.
  **Validacion de Mateo en el navegador, 2026-09-11**, con sus palabras: *"entre
  con mi cuenta que es admin y se ve todo, y entre con otra cuenta que no es
  admin y no se ve el dashboard"*. O sea: el tablero completo con la cuenta
  admin (Q3/Q4 a la vista) y la negativa a una cuenta comun (Q10.1). **No
  reportados, y por eso no se dan por hechos**: Q8 (una baja hace bajar el
  total), Q9 (buscar `$`), **Q11 (entrar SIN recargar, que es el cruce de
  `esAdmin` del analyze C1)**, Q12 (servicio que no contesta), Q13 (base vacia)
  y Q14 (360 px). Van al tracker, fila del 2026-09-11.
- [X] T033 Anotar en `docs/tech-debt-tracker.md` (fila nueva arriba): el umbral
  de D1 —la respuesta crece una fila por pedido, ~1 MB a 10.000 pedidos, y
  pasar a agregar en SQL es cambiar el cuerpo, no la pantalla—, y cualquier paso
  del quickstart que haya quedado sin correr.
- [X] T034 Commitear con el plan todavía `active`, stageando rutas explícitas.
  Abrir el PR con `gh pr create`; **mergear lo hace Mateo**.
- [ ] T035 Después del merge y del deploy en Railway, **con Mateo**: quickstart
  Q15 — `ADMIN_EMAILS` en Railway incluye el mail de Diego; los pedidos de
  prueba en producción se listan y **Mateo decide cuáles se borran**; abrir
  `https://flashurbano.uy/tablero` como admin desde un navegador (el CORS de un
  camino nuevo no está probado hasta que un navegador lo llamó); comparar el
  total con `SELECT count(*) FROM pedidos` en la consola de Railway.
  **Avance del 2026-09-11, antes del merge**: `ADMIN_EMAILS` en Railway
  (servicio `flash-urbano`, `production`), leido con el CLI y sin mostrar otra
  variable: `mateo.tambasco12@gmail.com,flashurbanomvd@gmail.com`. La segunda
  es el mail del negocio que publica `/contacto`: si Diego entra a la web con
  esa cuenta, el tablero lo deja pasar sin tocar Railway. **Falta**: confirmar
  con Diego que esa es la cuenta con la que va a entrar, la limpieza de pedidos
  de prueba, y abrir el tablero en produccion desde un navegador.
- [ ] T036 Pasar `plan.md` a `status: completed` en un commit aparte, **después**
  de T034: con el plan cerrado, el sensor rebota los archivos de código.

---

## Dependencias

```text
Fase 1 (T001)
  └─ Fase 2: guardas (T002 → T003; T004 → T005)
       └─ Fase 3: servicio (T006 → T007, T008 → T009, T010, T011 → T012)
                  web (T013, T014, en paralelo con el servicio)
            ├─ Fase 4: US1 (T015 → T016 → T017 → T018 → T019 → T020)   🎯 MVP
            │    └─ Fase 5: US2 (T021 → T022 → T023 → T024)
            │         └─ Fase 6: US3 (T025 → T026 → T027 → T028)
            └─ Fase 7: cierre (T029–T036), después de la última historia que se entregue
```

**Las historias no son independientes en el código**, y se dice en vez de
fingirlo: las tres escriben en `web/lib/tablero.ts`, `tablero.test.ts` y
`tablero.tsx`, así que van en serie. Sí lo son **en lo que entregan**: cortar
después de US1 deja un tablero con el total y nada roto; después de US2, el
reporte que Diego pidió.

## Paralelo

- **T013 y T014** (web) corren en paralelo con todo el servicio de la Fase 3:
  archivos distintos y ninguna dependencia entre sí.
- **T002–T003** (guarda de Go) y **T004–T005** (guarda de la web) son dos
  cadenas independientes dentro de la Fase 2.
- Dentro de cada historia, no: los tres archivos son los mismos.

## Estrategia

1. **MVP = Fases 1 a 4.** Tablero con el total, cerrado para quien no es admin,
   con las guardas de plata puestas. Ya contesta la primera pregunta de Diego.
2. **US2 es lo que Diego llamó "el reporte"**, y va en la misma entrega: sin
   ella, el feature no contesta "cuántos paquetes este mes". El MVP es un corte
   de seguridad, no un punto de entrega.
3. **US3** al final. Con el volumen de hoy es el que menos dice, y el que más va
   a ganar con el tiempo (spec, US3).
