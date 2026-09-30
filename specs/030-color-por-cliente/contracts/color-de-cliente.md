# Contrato: el color del cliente

## 1. `GET /admin/pedidos` (sólo administradores)

Cada elemento de `pedidos` suma **una** clave opcional:

```json
{ "id": "…", "codigo": "FU-0055", "…": "…", "colorCliente": "#c026d3" }
```

- Presente sólo si la cuenta que creó el pedido tiene color. **Sin color, la
  clave no viene** (no llega `null` ni `""`).
- Formato: `#` más seis dígitos hex en minúscula.

## 2. `PATCH /admin/pedidos/{id}/estado` (sólo administradores)

La respuesta `{"pedido": …}` pasa de `Pedido` a `ParaAdmin`. Trae
`colorCliente` con la misma regla que el punto 1, y además `recibioDocumento`
(research D7).

## 3. Lo que NO cambia

- `GET /pedidos`, `POST /pedidos`, `PATCH /pedidos/{id}` (lo que ve el
  cliente): **no traen `colorCliente`** (FR-014). Lo sostiene
  `respuesta_cliente_test.go`.
- `GET /yo` y `PUT /yo`: no traen el color.
- `GET /admin/tablero` y `GET /admin/reporte`: sin cambios.

## 4. La tarjeta (app)

| `colorCliente` | Tarjeta |
|---|---|
| ausente | idéntica a hoy |
| `#rrggbb` válido | franja de 6 dp de ese color en el borde izquierdo, del alto entero |
| cualquier otra cosa | idéntica a hoy (no se cae y no pinta nada) |

La franja no cambia ninguna medida de la tarjeta, y convive con el borde de la
tarjeta destacada.
