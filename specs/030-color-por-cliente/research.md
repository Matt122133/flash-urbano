# Research: El color de cada cliente en la tarjeta

## D1 — Dónde vive el color: en la cuenta, y se lee con un JOIN

**Decision**: una columna `color` en `usuarios`, nulable. Los pedidos la leen
con un `JOIN usuarios` en `desdePedidos`, a un campo **no exportado** de
`Pedido`, que sólo `ParaAdmin` expone, como `colorCliente`.

**Rationale**:
- El color es de la cuenta (FR-001) y el pedido ya guarda `usuario_id`. No se
  copia el color a cada pedido: si alguien cambia a mano el color de una cuenta
  (historia 3), cambian también todos sus pedidos, viejos y nuevos. El spec lo
  pide en *Edge Cases*.
- **`ParaAdmin` y no `Pedido`**, por FR-014. Es el mismo mecanismo que `016`
  armó para la cédula: lo que sólo ve Diego no puede filtrarse al cliente por
  accidente, y `respuesta_cliente_test.go` ya falla si `GET /pedidos` suma una
  clave que no debe. El color se agrega a esa guarda.
- **No se agrega a `Usuario`** (`GET /yo`). Nadie en la web lo necesita, y
  sumarlo a `columnas` de usuarios lo haría viajar al navegador.

**Alternatives considered**:
- *Copiar el color a `pedidos` al crear*: evita el JOIN, pero congela el color
  y hace que la operación manual de la historia 3 no alcance a los pedidos que
  ya existen, que son justo los que se confundieron.
- *Un endpoint aparte con el color de cada cuenta*: dos pedidos HTTP y la app
  cruzando datos. Más código para lo mismo.

## D2 — La lista curada: siete colores, y por qué no diez

**Decision**: la lista, en este orden (el orden importa: las primeras cuentas
reciben los más separados):

| # | Hex       | Nombre   | Contraste sobre blanco |
|---|-----------|----------|------------------------|
| 1 | `#c026d3` | fucsia   | 4.71 |
| 2 | `#0891b2` | cian     | 3.68 |
| 3 | `#65a30d` | lima     | 3.09 |
| 4 | `#7c3aed` | violeta  | 5.70 |
| 5 | `#db2777` | rosa     | 4.60 |
| 6 | `#8a7a00` | oliva    | 4.32 |
| 7 | `#86198f` | ciruela  | 8.24 |

**Rationale** (calculado, no estimado; se midió en OKLab, que es un espacio
donde la distancia se parece a la diferencia que ve el ojo):
- **Reglas** que cumple cada color, y que la prueba del paquete verifica para
  que un color agregado a mano no las rompa:
  - contraste de al menos **3:1 contra `#ffffff`**, el mínimo de WCAG para
    elementos gráficos que no son texto;
  - croma de al menos **0.08**, porque un gris se leería como "deshabilitado";
  - tono fuera de las **ventanas reservadas** (en grados OKLCH): rojo y
    naranja **10–75** (incluye el marrón, que es naranja oscuro), verde
    **135–165** y azul **250–280**;
  - distancia de al menos **0.12** a cada color de `Paleta.kt` que tiene un
    significado: `AZUL`, `AZUL_OSCURO`, `NARANJA`, `VERDE` y `ERROR`.
- **Se excluye el verde, que el spec no nombraba.** `Paleta.VERDE` es el de
  "entregado", y lo usan el tilde de "LO RECIBIÓ" y los íconos de teléfono. Una
  franja verde se leería como un estado. FR-003 se amplió para decirlo.
- **Con esas reglas entran siete, no diez.** Con diez, la pareja más cercana
  queda a 0.056 (dos cianes que no se distinguen). Con estos siete, la pareja
  más cercana (lima y oliva) queda a 0.120.
- Fucsia, cian y lima, los tres primeros, son los tres tonos más distintos
  entre sí. Van a las tres cuentas reales (D6).

## D3 — Cuando la lista se agota: el color más lejano, generado

**Decision**: una función pura en Go, `Elegir(asignados []string) string`.
1. Devuelve el primer color de la lista que no esté en `asignados`.
2. Si están todos, recorre una **grilla fija de candidatos en OKLCH** (L de 0.45
   a 0.65, C de 0.10 a 0.22 y H cada 5°). Descarta los que no entran en sRGB y
   los que no cumplen las reglas de D2, y devuelve el que **maximiza la
   distancia mínima** a todos los asignados y a los colores reservados. Los
   empates se resuelven por el orden de la grilla, así que la función es
   determinista y se puede probar.
3. Nunca devuelve un color que ya esté en `asignados`.

**Rationale**: es lo que Mateo pidió al principio, *"una función que verifique
los colores que ya hay y genere colores medio distintos"*, sin sortear.
Simulado con la grilla (342 candidatos válidos), la distancia mínima a lo ya
asignado baja así: 0.23 en el segundo color, 0.15 en el sexto, 0.12 en el
undécimo, 0.10 en el decimosexto y 0.08 en el decimoctavo. **No se repite
nunca, pero a partir de unos 16 clientes los colores nuevos se parecen a alguno
ya asignado.** El spec lo dejó escrito como costo.

**Alternatives considered**:
- *Sortear un hex*: produce colores que no se distinguen o que chocan con los
  reservados. Es el motivo de la lista.
- *Girar el tono por el ángulo áureo*: es determinista y barato, pero ignora
  los colores asignados a mano (historia 3) y las ventanas reservadas. Habría
  que corregirlo igual.
- *Guardar un "usado" por color*: descartado en el clarify.

## D4 — Cuándo se asigna, y cómo no se repite con dos registros a la vez

**Decision**: dentro de `GuardarPerfil`, que es el **único** camino de escritura
del perfil (`CompletarAlta` no tiene llamadores), en una transacción:
1. `SELECT perfil_completo ... FOR UPDATE` de la fila;
2. el `UPDATE` del perfil de hoy;
3. **sólo si la fila pasó de `perfil_completo = false` a `true`**:
   `pg_advisory_xact_lock` con una clave fija; leer todos los colores asignados;
   `Elegir`; y `UPDATE usuarios SET color = $2 WHERE id = $1 AND color IS NULL`.

Y en la base, un **índice único parcial** sobre `color` (`WHERE color IS NOT
NULL`).

**Rationale**:
- **La transición `false → true` es exactamente "registrarse"**, y resuelve
  FR-002 y FR-006 con la misma regla. Una cuenta nueva pasa por ella una sola
  vez, en su primer guardado. **Todas las cuentas existentes ya tienen el perfil
  completo** (o nunca lo completaron), así que editar el perfil no les asigna
  color: las cuentas de prueba de hoy quedan sin color para siempre, como pidió
  Mateo, sin tener que marcarlas. Una cuenta vieja que nunca completó el perfil
  y lo completa ahora recibe color: es un registro que recién se termina.
- La regla "si `color` es nulo" habría sido más simple y **estaba mal**: la
  primera cuenta de prueba que editara su perfil habría recibido color, en
  contra de FR-006.
- **El lock serializa la elección** y **el índice la garantiza**. Si el lock
  alguna vez faltara (por ejemplo, otro camino que asigne), el índice rechaza el
  repetido en lugar de guardarlo. FR-004b dice "nunca", y eso lo cumple la base,
  no el cálculo.

**Alternatives considered**:
- *Asignar al crear la fila en el primer ingreso*: gasta colores en cuentas que
  nunca completaron el perfil. El spec lo descartó en *Assumptions*.
- *`SERIALIZABLE` y reintento*: resuelve lo mismo con más código y un bucle.

## D5 — La franja en la tarjeta: dibujada, no maquetada

**Decision**: `TarjetaPedido` dibuja la franja con `Modifier.drawWithContent`
sobre el contenido de la `Card`. Es un rectángulo de **6 dp** de ancho, pegado
al borde izquierdo y del alto entero de la tarjeta, recortado por la forma
redondeada de la `Card`. **No cambia ningún padding ni agrega ningún
elemento.** Sin color, o con un color inválido, no se dibuja nada.

**Rationale**:
- FR-010 (que el alto no crezca) queda cumplido por construcción: dibujar no
  ocupa lugar. Una `Row` con una `Box` de 6 dp obligaría a medir con
  `IntrinsicSize` y a tocar el layout que `015` ajustó al milímetro.
- El contenido empieza a 14 dp del borde, así que una franja de 6 dp no pisa
  texto.
- FR-009: el borde destacado es **un contorno de 2 dp alrededor de toda la
  tarjeta**, y la franja es **un bloque de 6 dp de un solo lado**. Son formas
  distintas. Se confirma en el emulador (quickstart).
- La franja también pasa sobre el borde izquierdo de la franja de acción
  ("Lo tengo"). Se acepta: cortarla ahí haría que la franja midiera distinto en
  cada tarjeta, según tenga acción o no. Si en el teléfono se ve mal, se corta
  en el borde de la sección de datos, sin cambiar nada más.
  **Revisado el 2026-09-30, en el emulador, con Mateo**: pidió que la franja
  llegue sólo hasta el botón ("no le pisaría la parte verde, sólo la blanca").
  Se cambió `drawWithContent` por `drawBehind`. La franja queda detrás del
  contenido; las partes blancas son transparentes y la dejan ver ("Deshacer"
  incluido), y la franja de acción es opaca y la tapa. Se corta sola en el
  borde del botón, sin medir nada.

**El hex se convierte en color con una función pura de Kotlin**,
`colorDeCliente(hex: String?): Long?`. Acepta sólo `#rrggbb` y devuelve `null`
para cualquier otra cosa. Se prueba en la JVM, igual que `ContrasteTest`.

## D6 — Las tres cuentas reales: una operación documentada sin datos

**Decision**: `docs/processes/color-de-clientes.md` explica cómo colorear a mano
una cuenta existente, en staging y en producción, sin dejar datos en el repo:
buscar el `id` en la sesión de base, y ejecutar
`UPDATE usuarios SET color = '<hex>' WHERE id = '<id>' AND color IS NULL`, con
los primeros tres colores de la lista, en orden. **El `id` y el correo no se
escriben en ningún archivo del repo.**

**Rationale**: FR-013 y la regla del repo público. Usar los primeros de la
lista hace que la asignación automática siga desde el cuarto (D3 paso 1), sin
que nadie tenga que acordarse.

## D7 — La app vieja y el servicio viejo

- **App vieja con servicio nuevo**: `json` tiene `ignoreUnknownKeys = true`
  (`Pedido.kt`), así que `colorCliente` se ignora. FR-012 se cumple sin tocar
  nada.
- **App nueva con servicio viejo**: la clave no llega y el campo queda en
  `null`, así que no hay franja. Importa porque el APK puede instalarse antes
  del deploy.
- **`PATCH /admin/pedidos/{id}/estado` hoy devuelve `Pedido`, no `ParaAdmin`**,
  y la app **reemplaza la tarjeta con lo que devuelve** (`RepartidorViewModel`,
  "se reemplaza por lo que devolvio el servicio"). Sin cambiarlo, la franja
  **desaparecería al tocar "Lo tengo"** hasta el próximo refresco. Pasa a
  devolver `ParaAdmin`. Efecto colateral: esa respuesta también trae ahora
  `recibioDocumento`. El endpoint es sólo para administradores, igual que
  `GET /admin/pedidos`, que ya lo trae, así que no se abre nada nuevo.
