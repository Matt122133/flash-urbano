# Research — `016` Quién recibió el paquete

Fase 0. Seis decisiones con su alternativa descartada.

## D1 — El corte entre las dos respuestas, que es el riesgo central

**Hoy `GET /pedidos` y `GET /admin/pedidos` devuelven exactamente la misma
forma.** Los dos handlers terminan en
`httpx.JSON(w, http.StatusOK, respuestaLista{Pedidos: lista})` con el mismo
`[]Pedido`. O sea que **agregarle un campo a `Pedido` se lo agrega a los dos**,
y la cédula llegaría al cliente en el mismo commit que la guarda, sin que nadie
lo escriba ni lo note.

Tres formas de partirlas:

| | Cómo | Por qué no |
|---|---|---|
| **Blanquear al salir** | un campo en `Pedido`, y `Mios` lo vacía antes de escribir | **Lo seguro queda como excepción.** El próximo campo sensible se filtra por defecto, porque el default es exponer |
| **`MarshalJSON` con bandera** | un `struct` que se serializa distinto según el contexto | Funciona y es opaco: la respuesta deja de leerse en el tipo y pasa a depender de quién lo llamó |
| **Dos tipos** ✅ | `Pedido` es lo del cliente; el admin usa un tipo propio que lo embebe y suma la cédula | **Lo seguro es el default.** Exponer la cédula obliga a nombrar el tipo del admin: es una decisión explícita, no un olvido |

**Decisión: dos tipos.** El principio que lo ordena, y que vale más que este
feature: **la forma segura tiene que ser la que sale por descuido.** Si mañana
alguien agrega otro dato sensible al pedido, cae del lado del cliente solo si lo
escribe ahí a propósito.

**Y la guarda que lo sostiene** (FR-010): una prueba que serializa la respuesta
del cliente con una cédula conocida adentro del dato y afirma que **esa cadena
no aparece**. Con su control positivo obligatorio: la del admin **sí** tiene que
contenerla, o la prueba estaría pasando porque no encuentra nada en ninguna
parte.

## D2 — En `pedidos_estados`, y por qué no en `pedidos`

**Decisión**: migración `0006`, dos columnas **nullable** en `pedidos_estados`:
quién recibió y su documento.

**Por el modelo**: quién recibió pertenece al **evento** de entrega, no al
pedido. Un pedido que se entrega, se deshace y se vuelve a entregar tiene dos
receptores distintos, y esa tabla ya guarda una fila por movimiento.

**Y por el riesgo**: no se toca `pedidos`. El 2026-08-12 una migración de esa
tabla tumbó producción — entraba `entrega_punto` como `NOT NULL` creyendo que
estaba vacía, y no lo estaba. **Esta no tiene ese defecto** (son nullable, que
no exigen nada de las filas que ya están), pero sigue siendo una migración sobre
la base con los pedidos reales de Diego, y se trata como tal.

**Alternativa descartada**: dos columnas en `pedidos`. Se leería sin join, y a
cambio reescribiría el receptor en cada re-entrega, perdiendo el anterior. Es
más simple de consultar y **más pobre de recordar**, en la tabla donde no
conviene equivocarse.

## D3 — Leerlo sin que la lista se vuelva cara

La tarjeta necesita quién recibió, y eso ahora vive en otra tabla.

**Decisión**: la consulta que arma la lista trae el receptor del **último**
cambio a `entrega` de cada pedido, en la misma consulta. Un `LEFT JOIN LATERAL`
contra `pedidos_estados`, que ya tiene el índice `(pedido_id, ocurrido_en)` que
`012` creó exactamente para esta forma de leer.

**Sin `N+1`**: una consulta por lista, no una por pedido. La lista de admin ya
está anotada en el tracker como sin paginar — no hay que empeorarla.

**Alternativa descartada**: un segundo viaje a la base desde el handler. Más
fácil de escribir y convierte una lista de 500 pedidos en 501 consultas.

## D4 — Dos toques, y de dónde sale el nombre propuesto

El caso mayoritario es que recibe quien figura en el pedido. **Si eso cuesta
escribir un nombre, el feature empeora la app**: Diego está parado en una puerta
con las manos ocupadas.

**Decisión**: la hoja propone al destinatario del pedido como un botón grande —
*"Lo recibió Ana Cabrera"*— y el camino de escribir otro nombre queda abajo,
separado. Aceptar la propuesta manda el nombre del destinatario tal como está
guardado en el pedido, **no una marca de "el mismo"**.

**Por qué el nombre y no una bandera**: dentro de seis meses, leer el historial
tiene que contestar *quién recibió* sin tener que ir a buscar cómo se llamaba el
destinatario del pedido en ese momento — que además pudo cambiar.

## D5 — La cédula se guarda como Diego la escribe

**Decisión**: sin validar dígito verificador, sin normalizar puntos ni guiones.
Se guarda el texto.

**Por qué**: es un respaldo que Diego anota en la calle, no una clave. Una
validación que rechaza `1234567-8` porque esperaba `1.234.567-8` le traba una
entrega **que ya ocurrió**, por un problema de tipeo, con la persona esperando.

**Lo que eso cuesta, dicho**: no se va a poder buscar por cédula sin normalizar
después. Nadie lo pidió, y el día que haga falta se normaliza con los datos a la
vista en vez de adivinando el formato hoy.

## D6 — `verify:` vuelve a las tres patas, con su trampa

Este feature toca `backend/` (migración y endpoint), `android/` (la hoja) y
`web/` (mostrar el nombre). Es el primero desde `012` que toca las tres.

**Decisión**:
`cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest`

**Dos trampas que `AGENTS.md` ya tiene escritas y que este feature vuelve a
pisar**:

1. **`.\gradlew.bat`**, con barra invertida. `verify:` corre en `cmd`, donde
   `./` es inválido, y un `cmd` lanzado desde una shell tipo MSYS hereda
   `NoDefaultCurrentDirectoryInExePath`, así que el nombre pelado tampoco
   resuelve.
2. **Las pruebas de Go contra Postgres se saltean solas sin
   `TEST_DATABASE_URL`.** En este feature eso importa más que nunca: **la guarda
   de FR-010 y la migración nueva viven ahí**. Un verde con skips diría
   literalmente nada sobre lo único que este feature tiene que garantizar. Hay
   que mirar el conteo de skips, no el color.
