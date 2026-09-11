# Research: El tablero de Diego

Phase 0 de `/speckit-plan`. Cada decisión tiene lo que se eligió, por qué, y lo
que se descartó. No quedó ningún `NEEDS CLARIFICATION`: las tres preguntas de
producto se cerraron en el spec (§ Clarifications, 2026-09-10 y 2026-09-11).

---

## D1 — El servicio devuelve hechos; la web cuenta

**Decisión**: `GET /admin/tablero` devuelve **una fila mínima por pedido** —
cuándo se cargó, cuántos paquetes lleva y de qué cuenta es— más la lista de
cuentas. El agrupado por día, semana o mes, el filtro por cliente y el total se
calculan **en el navegador**, en un módulo puro de `web/lib/`.

**Por qué**:

- **Es la única forma de que la lógica que puede fallar tenga una prueba que
  corra siempre.** Lo delicado de este feature es dónde empieza el día en
  Montevideo (SC-006), qué día empieza la semana, y que las filas sumen el
  total. En `web/lib/` eso se prueba con vitest en cada `verify:`. En SQL solo
  se probaría contra Postgres, y **las pruebas de base se saltan solas** sin
  `TEST_DATABASE_URL` (`AGENTS.md`, `backend/README.md`): el verde no diría
  nada.
- **FR-010 sale gratis.** Cambiar de corte o sacar el filtro no hace una
  request: es recalcular sobre lo que ya llegó. No hay un "cargando" entre
  corte y corte, ni un estado de error por cambiar de mes a semana.
- **El servicio queda sin reglas de negocio nuevas.** Dos `SELECT` sin
  `GROUP BY`, sin `date_trunc` y sin zona horaria.

**Lo que cuesta**: la respuesta crece una fila por pedido. A ~100 bytes por fila
—el instante, un UUID y las claves—, 10.000 pedidos son ~1 MB sin comprimir.
**Hoy son una docena.** El umbral se anota en el
tracker al cerrar; pasar a agregar en SQL es cambiar el cuerpo de la respuesta,
no la pantalla.

**Descartado**:

- **Agregar en SQL** (`date_trunc` con `AT TIME ZONE 'America/Montevideo'`,
  `?corte=` y `?cliente=` como parámetros). Es lo canónico y escala mejor, pero
  pone la zona horaria y el inicio de semana donde solo los ve una prueba que
  se saltea, y convierte cada cambio de corte en una request que puede fallar.
  Principio III: a este volumen no compra nada.
- **Reusar `GET /admin/pedidos`** y contar en la web. Ya existe y ya está
  autorizado, pero trae **el pedido entero**: nombres, teléfonos, direcciones,
  la cédula de quien recibió (`ParaAdmin`, `016`) y la columna `precio`. Un
  tablero que cuenta no tiene por qué recibir nada de eso, y con `precio` en la
  respuesta FR-013 dependería de que nadie lo lea en el navegador en vez de que
  no llegue.

---

## D2 — Paquete propio: `backend/internal/tablero`

**Decisión**: el endpoint vive en un paquete nuevo, `internal/tablero`, que lee
la tabla `pedidos` con su propia consulta y **no importa `internal/pedidos`**.

**Por qué**: FR-013 y FR-014 son una prohibición sobre el **dato**, y la forma
fuerte de cumplirla es que el código del tablero **no pueda nombrar** la
columna. Eso se puede afirmar sobre un paquete entero —escaneando sus fuentes
(D9)— solo si el paquete nunca la necesita. `internal/pedidos` la necesita: su
constante `columnas` la lista, y el tipo `Pedido` tiene el campo `Precio`.
Poner el tablero ahí obligaría a una guarda sobre *un string* dentro de un
paquete que sí nombra el precio, y la primera persona que reuse `columnas` "para
no repetir" la pasa en verde.

`ARCHITECTURE.md` ya lo pide así: los paquetes se agrupan **por dominio**, y
contar para mirar es un dominio distinto de tomar y mover pedidos, aunque lea la
misma tabla.

**Qué sí importa**: `internal/usuarios` (para `DeContexto`, igual que
`pedidos`), `internal/httpx` y `internal/db`. Quién es administrador lo recibe
como función (`cfg.EsAdmin`), igual que `pedidos` y `usuarios`: no hay columna de
admin y no debe haberla (FR-022 de `006`).

**Descartado**: un método `Tablero()` en `pedidos.Repositorio`. Más corto, y deja
FR-014 como una guarda frágil (arriba).

---

## D3 — La zona horaria se resuelve en el navegador, con nombre explícito

**Decisión**: el servicio manda el instante de carga en RFC 3339 (UTC, tal como
`creado_en` lo guarda). `web/lib/tablero.ts` lo convierte a **fecha de
Montevideo** con `Intl.DateTimeFormat` y `timeZone: "America/Montevideo"`
**explícito**: nunca la zona del navegador.

**Por qué**:

- La prueba de SC-006 (un pedido de las 22:00 de Montevideo cuenta ese día)
  queda en vitest y corre en cada `verify:` (D1).
- **No se escribe `-03:00` a mano.** Uruguay no tiene horario de verano desde
  2015, pero si vuelve, Intl lo resuelve con la base IANA y un desplazamiento
  fijo se equivocaría una hora durante meses sin que nada falle.
- **Nunca la zona del navegador**: `web/lib/fechas.ts` usa la del navegador para
  el "hoy" del formulario, y está bien ahí. Acá no: FR-007 pide Montevideo, y el
  navegador de quien mire puede estar en otro lado. Es la misma trampa que
  `backend/internal/pedidos/handlers.go` documenta sobre Railway corriendo en
  UTC.

**Descartado**: `AT TIME ZONE` en SQL. Correcto, pero probado solo contra
Postgres (D1).

---

## D4 — Semana de lunes a domingo, y cada fila dice sus dos extremos

**Decisión**:

| Corte | Clave | Cómo se lee |
|---|---|---|
| Día | `2026-09-10` | jue 10 sep 2026 |
| Semana | el lunes: `2026-09-07` | lun 7 sep – dom 13 sep 2026 |
| Mes | `2026-09` | septiembre 2026 |

La semana empieza el **lunes** (ISO 8601, y como se cuenta en Uruguay). La fila
de la semana nombra **los dos extremos** porque "semana 37" o "semana del 7" dejan
dudas justo donde FR-006 pide que no las haya.

**Los nombres de días y meses están escritos a mano** en el módulo, en vez de
salir de `Intl` con `es-UY`. Lo que `Intl` devuelve para un locale depende de los
datos ICU de cada motor, y así la prueba afirma un texto exacto que no cambia
entre Node y el navegador.

**Descartado**: semana de domingo a sábado (convención de EE. UU.); semana ISO
numerada (nadie cuenta semanas por número).

---

## D5 — Los períodos sin actividad se muestran, en cero

**Decisión**: el corte va **desde el período del primer pedido hasta el
período actual**, sin huecos. Un período sin pedidos es una fila con dos ceros.
Se ordena **del más nuevo al más viejo**, así que el período en curso es la
primera fila: "este mes" es lo primero que Diego lee (SC-001).

Con un cliente elegido, **el rango es el mismo** que sin filtro. Las filas no
aparecen ni desaparecen al filtrar: cambian sus números. Un cliente sin pedidos
ve la misma grilla en cero, más el texto de FR-011.

**Por qué**: el escenario 3 de la US2 admite "en cero o no se muestra, pero
nunca se saltea sin que se note". Un hueco entre "agosto" y "octubre" solo lo
nota quien ya sabe que falta septiembre. Una fila en cero se explica sola.

**Lo que cuesta**: el corte por día crece una fila por día, ~365 por año. Es una
tabla, se desplaza, y a la escala de hoy son ~30 filas. Si molesta, acotar el
corte por día a los últimos N días es un cambio del módulo puro, con su prueba.

**Descartado**: mostrar solo los períodos con actividad. Es más corto, y con el
volumen de hoy la mayoría de los días no tiene pedidos: la tabla parecería
completa y le faltarían días.

---

## D6 — Clientes: todas las cuentas, con nombre y mail

**Decisión**: el selector lista **todas las cuentas**, tengan pedidos o no,
ordenadas por nombre. Cada opción muestra **nombre y mail**. Si el alta quedó a
medias y la cuenta no tiene nombre (`usuarios.nombre` es nulable), se muestra
solo el mail.

**Por qué**:

- **El mail es lo que distingue a dos clientes con el mismo nombre** (escenario
  4 de la US3). Es único en la tabla y es la identidad con la que la persona
  entró.
- **Incluir las cuentas sin pedidos** es lo que hace alcanzable el escenario 3
  de la US3 y FR-011. Listar solo las que tienen pedidos haría que ese caso no
  pudiera pasar, lo cual no es lo mismo que resolverlo.
- **Incluidas las administradoras** (FR-004b): el tablero no trata distinto a
  ninguna cuenta.

**Privacidad**: los mails de todas las cuentas llegan al navegador de un
administrador. Es un dato que Diego ya puede ver hoy de otra forma —la app le
muestra nombre y teléfono de cada remitente— y no sale del lado admin. Lo que
**no** viaja: teléfono, dirección guardada, nada de los pedidos más allá de D1.

---

## D7 — Autorización: la misma de `/admin/pedidos`, y la web no es la guarda

**Decisión**: `GET /admin/tablero` se monta con `conSesion` y el handler
responde **403** a quien no está en `ADMIN_EMAILS`, exactamente como
`pedidos.Todos`. Sin credencial, el middleware ya responde 401.

La web **no llama al servicio** si la cuenta no es administradora: `/yo` ya
devuelve `esAdmin` desde `006`, y el tipo `Usuario` de la web gana ese campo
(opcional, porque el servicio lo omite con `omitempty`). Pero **eso es cortesía,
no seguridad**: la negativa real la da el servicio, y SC-004 se prueba contra el
servicio, no contra la pantalla.

**FR-003**: la página `/tablero` es un export estático, así que existe para
cualquiera que escriba la URL, y eso no se puede evitar ni hace falta. Lo que
una cuenta común ve es un texto genérico ("Esta sección es solo para la
administración"), sin números, sin nombres de clientes, sin llamar al servicio.
Es lo mismo que revela hoy el 403 de `/admin/pedidos`. Se marca `noindex`.

---

## D8 — Sin sesión, se entra ahí mismo

**Decisión**: sin sesión, `/tablero` muestra `PanelIngreso` en el lugar, y al
quedar adentro la página se vuelve el tablero sin navegar.

**Por qué**: FR-002 pide encaminar a iniciar sesión. `/ingresar` **devuelve al
inicio** al terminar (`web/app/ingresar/page.tsx`), así que mandar ahí
obligaría a Diego a volver a escribir la URL del tablero después de entrar.
`PanelIngreso` ya está hecho para usarse en más de un lugar: su `onListo` es una
prop justamente por eso (lo usa `/pedido` en el diálogo). Acá `onListo` no hace
nada: el cambio de sesión ya re-renderiza la página.

---

## D9 — Las guardas de FR-014, con su control positivo

FR-014 pide una prueba que falle si el feature empieza a leer `precio` o a
mostrar un monto. Son **cuatro** guardas, porque el dato cruza cuatro fronteras,
y cada una trae el caso que demuestra que sabría detectarlo (ver la memoria del
proyecto, *guarda negativa, control positivo*: en `023` una guarda pasaba en
verde con la implementación rota).

| Frontera | Guarda | Control positivo |
|---|---|---|
| La consulta | Una prueba de Go escanea **los identificadores y strings** de las fuentes no-test de `internal/tablero` —sin comentarios, con `go/scanner`— buscando `precio`, `monto`, `importe` y `costo`. | La misma función aplicada a un fuente sintético con `SELECT precio FROM pedidos` tiene que encontrarlo. |
| El paquete | Otra prueba lee los `import` de `internal/tablero` con `go/parser` y falla si aparece `internal/pedidos`, que es donde vive el campo `Precio`. | La misma función, sobre un fuente sintético que lo importa, lo encuentra. |
| La respuesta | El JSON serializado de una respuesta con datos no tiene ninguna clave de plata. | — (el tipo no tiene el campo: la prueba es la afirmación de que sigue sin tenerlo) |
| La pantalla | La guarda de `013`/`024` (`web/lib/sin-precio-a-la-vista.test.ts`) **ya escanea** `app/` y `components/`, así que cubre `app/tablero/` y `components/tablero/` sin cambios. Se le agrega que esos dos caminos **estén entre los archivos escaneados**. | Sin ese agregado, mover el tablero a otra carpeta dejaría la guarda en verde sin mirarlo. Además, `web/lib/tablero.test.ts` escanea `lib/tablero.ts`, que la guarda de `013` no mira porque en `lib/` el precio tiene que seguir viviendo. |

Y la versión fuerte y barata, que va a `tasks.md` como paso explícito: **romper
la implementación a propósito** (agregar `precio` al `SELECT`) y ver cada guarda
en rojo antes de dar el feature por terminado.

**Los comentarios quedan fuera del escaneo**, igual que en la guarda de `013`:
explicar por qué el precio no está es información útil, y prohibirlo empujaría
a borrar la explicación junto con el código.

---

## D10 — El copy vive en `lib/`, para que FR-004a y FR-006a tengan prueba

**Decisión**: los textos que el spec regula —el rótulo del total, la aclaración
de que puede bajar, la de que el corte es por fecha de carga, y los dos vacíos—
son **constantes exportadas** de `web/lib/tablero.ts`. La pantalla las usa, no
las reescribe.

**Por qué**: FR-004a prohíbe la palabra "histórico", y en este repo **nada
renderiza React en una prueba** (research D3 de `024`). Una constante en `lib/`
sí se puede afirmar: la prueba verifica que ningún texto del tablero contiene
`/hist[oó]ric/i` —con control positivo sobre un texto que sí la tiene— y que el
rótulo del corte menciona la fecha de carga.

Textos propuestos (se ajustan en la implementación; la prueba no fija la
redacción, fija lo prohibido y lo obligatorio):

- Total: **"Pedidos registrados"**, con la bajada *"Los que hay hoy en el
  sistema. Si un cliente da de baja uno, deja de contarse."*
- Corte: *"Cada pedido cuenta en el día en que se cargó, no en el del
  retiro."*
- Sin pedidos: *"Todavía no hay pedidos cargados."*
- Cliente sin pedidos: *"Este cliente todavía no cargó ningún pedido."*
- Error: *"No pudimos traer los números. Probá de nuevo en un rato."*

---

## D11 — Estado de la vista: en el componente, no en la URL

**Decisión**: el corte elegido y el cliente elegido son estado del componente.
Al abrir, **mes** y **todos los clientes**.

**Por qué**: FR-010 solo pide que sacar el filtro no pierda el corte, y eso lo
cumple el estado. Llevarlo a la URL —como hizo `/perfil` en `023`— obliga a un
límite de `Suspense` por `useSearchParams`, y su ganancia (que recargar conserve
la elección) nadie la pidió. Principio III. Si Diego lo extraña, es el patrón que
`/perfil` ya documenta.

---

## D12 — Dónde se entra: un enlace en la navegación, solo para administración

**Decisión**: `nav-bar.tsx` muestra **"Tablero"** junto a *Mi cuenta* cuando
`usuario.esAdmin` es true. Para nadie más.

**Descartado**: no poner enlace y que Diego guarde la URL. Es lo más angosto,
pero depende de que se acuerde de una dirección, y SC-001 pide que conteste
"abriendo una pantalla".

---

## Lo que queda fuera del código y decide si el feature funciona

- **`ADMIN_EMAILS` en Railway con el mail de Diego** (spec, *Dependencias*). Se
  mira antes de dar el plan por hecho: el panel de Railway o `railway variables`.
- **Pedidos de prueba en producción** (FR-004b). Se cuentan, así que se
  limpian en la base. **Ojo**: la baja de `022` solo borra pedidos
  **pendientes**. Uno que Diego ya movió tiene filas en `pedidos_estados` con
  `ON DELETE RESTRICT`, y borrarlo exige borrar primero su historial desde la
  consola de Railway. Eso es una operación sobre datos de producción, **la
  decide Mateo pedido por pedido**, y el quickstart la trata como un paso manual,
  no como parte del `verify:`.
