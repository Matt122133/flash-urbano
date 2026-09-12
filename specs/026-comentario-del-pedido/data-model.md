# Data model: El comentario del pedido

**Fase 1** de [plan.md](plan.md). Un solo atributo nuevo, en una sola entidad.

## Pedido (existente) — gana `comentario`

| | |
|---|---|
| **Columna** | `comentario` |
| **Tipo** | `text`, anulable |
| **Default** | ninguno (ausente = `NULL`) |
| **Restricción** | `CHECK (comentario IS NULL OR char_length(comentario) <= 280)` |
| **Migración** | `0009_comentario_del_pedido.sql` |

### Por qué así

- **Anulable y sin default.** "Sin comentario" y "comentario vacío" tienen que
  ser **un solo** estado, o cada pantalla decide por su cuenta si `''` se
  muestra. `NULL` lo dice sin ambigüedad, y FR-009 —un pedido sin indicación se
  ve igual que hoy— se cumple con un chequeo y no con dos.
- **`char_length` y no `length` ni bytes.** El tope es de caracteres: una
  indicación con ñ y tildes no puede valer menos que la misma en ASCII.
- **El `CHECK` vive en la base.** Es la única capa por la que pasan las tres
  superficies y también la carga manual con `psql`. El navegador avisa mientras
  se escribe y el servicio rechaza, pero la garantía está acá.
- **Columna y no tabla aparte.** Uno por pedido, sin autor, sin historial, sin
  hilo. Una tabla agregaría un `JOIN` a cada consulta de `pedidos` a cambio de
  nada (research D4; constitución, Principio III).

### Qué NO cambia

- **`pedidos_estados` no se toca.** El comentario no es un evento del pedido y
  no versiona: editar pisa el valor, como el resto de los campos que `022` deja
  editar.
- **La consulta del tablero no lo lee.** `internal/tablero` nombra sus columnas
  (`SELECT creado_en, cantidad, usuario_id`) y no se toca, así que FR-012 se
  cumple sin trabajo (research D5).
- **El precio no entra en ninguna consulta nueva** (constitución, Principio V).

## Reglas de validación

| Regla | Dónde vive | Qué hace |
|---|---|---|
| Tope de 280 | navegador | contador visible mientras escribe; no deja pasar de 280 |
| Tope de 280 | servicio | rechaza el pedido con un error de validación |
| Tope de 280 | base | `CHECK`; última red |
| Sólo espacios = vacío | **servicio, y sólo ahí** | recorta el texto; si queda vacío guarda `NULL` |
| Se conservan los saltos de línea | servicio | el recorte es de los extremos, no de adentro |

**El recorte vive en un solo lugar a propósito.** Si el navegador recortara y el
servicio también, dos implementaciones de la misma regla se irían separando; y
si sólo recortara el navegador, un pedido cargado por otro medio entraría con
espacios. El servicio es el único punto por el que pasan todos los caminos de
escritura.

## Estados y transiciones

Ninguno nuevo. El comentario se escribe al crear el pedido y se puede editar
**mientras el pedido está pendiente** (`estado = 'creacion'`), exactamente bajo
la regla que `022` ya aplica al resto del pedido — decidido en el clarify del
2026-09-12 tras evaluar soltarla.

```text
pedido pendiente   → comentario editable (se pisa) o borrable (pasa a NULL)
pedido tomado      → comentario de sólo lectura, con el mismo motivo que 022 ya muestra
pedido entregado   → ídem
```

## Pedidos existentes

Los 6 pedidos que hay en producción quedan con `comentario IS NULL` y se
comportan como pedidos sin indicación (FR-010). **La migración no rellena
nada**: no hay valor correcto que inventar, y `NULL` ya significa exactamente lo
que pasó.
