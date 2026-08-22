# Data model — 010 Mis pedidos

## Lo primero, porque cambia el tamaño del feature

**Este feature no agrega ni una columna, ni una migración, ni un endpoint.**
Todo lo que muestra y todo lo que repite ya está guardado desde `007`. Lo que
sigue describe **lo que se lee** y las dos formas nuevas que existen sólo en el
navegador.

Si al implementar aparece un dato que la respuesta no trae, eso invalida el
supuesto del spec y hay que frenar y decidirlo, no inventarlo.

## Lo que ya existe y se lee

`GET /pedidos`, autenticado, devuelve `{ pedidos: [...] }` ordenado por
`creado_en DESC`. Cada pedido trae, con estos nombres
(`backend/internal/pedidos/pedido.go`):

| Campo | Forma | Para qué lo usa `010` |
|---|---|---|
| `id` | uuid | Identifica el pedido a repetir en `/pedido?repetir=<id>` |
| `codigo` | `FU-0042` | Encabeza la tarjeta. Es lo que se perdía al cerrar la pestaña |
| `estado` | `creacion` \| `aceptacion` \| `entrega` | Se muestra traducido (research D8) |
| `remitenteNombre`, `remitenteTelefono` | texto | Se precargan al repetir (FR-013) |
| `retiro` | dirección **con** `punto {lat,lng}` | Detalle, y la precarga que decide el precio |
| `entrega` | dirección **sin** punto | Tarjeta ("a dónde iba") y detalle |
| `paqueteTamano` | `chico` \| `mediano` \| `grande` | Detalle y precarga |
| `cantidad` | entero > 0 | Detalle y precarga |
| `retiroFecha`, `retiroHora` | `YYYY-MM-DD`, `HH:MM` | Fecha de la tarjeta. **No** se precargan (FR-014) |
| `destinatarioNombre`, `destinatarioTelefono` | texto | Detalle y precarga |
| `precio` | entero, pesos | Precio de la tarjeta (FR-005) y comparación del reajuste (FR-015a) |
| `zonaId` | 1..5 | No se muestra. Se guarda porque es la zona que el cliente **vio** |
| `creadoEn` | instante | "Cargado el …" en el detalle |

Cada dirección es `{ calle, esquina, numero, apto, cooperativa, punto? }`, con
`numero` y `apto` **nulables**.

### El tipo del navegador está angosto, y hay que ensancharlo

`web/lib/api.ts` declara `PedidoGuardado` con siete campos —`id`, `codigo`,
`estado`, `precio`, `zonaId`, `retiroFecha`, `retiroHora`, `creadoEn`—. La
respuesta trae todo lo de la tabla de arriba. No es un bug de `007`: era lo único
que la pantalla de confirmación necesitaba. `010` lo ensancha hasta lo que el
servicio realmente devuelve.

**Es una copia a mano de un tipo del backend**, como ya lo es `Usuario` respecto
de `usuarios.Vista`. El ADR aceptó ese acoplamiento para una superficie de este
tamaño. Ensanchar `PedidoGuardado` lo agranda, y por eso conviene que quede dicho
acá: **si el backend cambia la forma de un pedido, este tipo miente en silencio**
—TypeScript no valida lo que llega por la red— y lo que se rompe es una pantalla,
no una compilación.

## Las dos formas nuevas, que viven sólo en el navegador

### `Precarga de repetición`

Lo que sale de un pedido guardado y entra al formulario. **No se persiste en
ningún lado** (FR-021): se arma en memoria al abrir `/pedido?repetir=<id>` y
muere con la pantalla.

- Todo lo del pedido **salvo** `retiroFecha` y `retiroHora`, que van vacíos
  (FR-014), y `precio`/`zonaId`, que no se copian: el precio se resuelve de nuevo
  (FR-015).
- El retiro pasa por `rehidratarRetiro()`, que devuelve además:
  - `ubicable` — el índice de calles resolvió el cruce. En `false` la dirección
    se ve pero el punto no se puede ajustar.
  - `puntoEnLaCuadra` — **el que decide si se puede cobrar**. En `false` el punto
    envejeció y hay que recolocarlo y avisar, como ya hace la precarga del
    perfil.
- La entrega entra como texto, sin cruce resuelto (research D4).

### `Reajuste`

Una comparación, no un dato guardado: el precio de la zona que resuelve el punto
**hoy** contra el `precio` del pedido. Distinto → se muestra el aviso; igual →
no. El monto viejo **no** viaja al aviso (FR-015b).

## Reglas que el modelo tiene que respetar

- **El precio y la zona del pedido viejo no se copian nunca al pedido nuevo.** Se
  leen sólo para mostrarlos en el historial y para decidir el aviso.
- **Nada de esto toca `localStorage` ni `sessionStorage`.** Lo único que hay ahí
  es la credencial de sesión, que ya existía.
- **La clave de idempotencia de un pedido repetido es nueva** (FR-019). Se genera
  con `claveDeIntento()` de `web/lib/pedido.ts`, igual que cualquier envío: la
  clave identifica el intento, no el paquete.
- **El estado nunca se escribe.** `010` sólo lee esa columna (FR-023).
