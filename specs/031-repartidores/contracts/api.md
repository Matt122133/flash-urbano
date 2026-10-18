# Contrato HTTP: Repartidores

Todo con `conSesion`. "Admin" = `EsAdmin`, "Rep" = `EsRepartidor`, "Otro" =
ninguno de los dos.

## 1. `GET /admin/pedidos` (cambia)

| Quien | Respuesta |
|---|---|
| Admin | 200, **todos** los pedidos |
| Rep | 200, solo los de `responsable == el` |
| Otro | 403 `no autorizado` (como hoy) |

```json
{
  "rol": "admin",
  "repartidores": [{ "email": "…", "nombre": "…" }],
  "pedidos": [{ "…lo de hoy…": "", "responsable": "rep@x.uy" }]
}
```

- `rol`: `"admin"` | `"repartidor"`.
- `repartidores`: **solo para `admin`**, los configurados hoy (para asignar).
  `nombre` omitido si no tiene cuenta. Para `repartidor` la clave no viaja.
- `responsable` (por pedido): omitido = de los administradores (data-model §3).
- Compatible con la app instalada: solo suma claves.

## 2. `PATCH /admin/pedidos/{id}/estado` (cambia)

Igual que hoy, mas:

| Quien | Pedido | Respuesta |
|---|---|---|
| Admin | cualquiera | como hoy |
| Rep | suyo | como hoy |
| Rep | ajeno o inexistente | 404 `no hay tal pedido` (mismo texto en los dos) |
| Otro | — | 403 |

La respuesta (`{"pedido": …}`) lleva `responsable`.

## 3. `PUT /admin/pedidos/{id}/repartidor` (nueva)

```json
{ "repartidor": "rep@x.uy" }   // asignar
{ "repartidor": null }         // devolver a los administradores
```

| Quien | Cuerpo | Condicion | Respuesta |
|---|---|---|---|
| Admin | mail | `EsRepartidor(mail)` | 200 `{"pedido": …}` |
| Admin | mail | no es repartidor | 400 `ese mail no es de un repartidor` |
| Admin | `null` | — | 200 |
| Rep | `null` | suyo | 200 |
| Rep | mail | — | 403 `no autorizado` |
| Rep | `null` | ajeno o inexistente | 404 `no hay tal pedido` |
| Admin/Rep | — | pedido entregado | 409 `un pedido entregado no cambia de repartidor` |
| Admin | — | inexistente | 404 |
| Otro | — | — | 403 |

- El mail se normaliza antes de comparar.
- **Atomico**: `UPDATE … WHERE id = $1 AND estado <> 'entrega' [AND
  repartidor_email = $yo]`. Cero filas → se relee para distinguir 404 de 409
  **solo** cuando quien llama tiene derecho a saber que el pedido existe (admin,
  o el repartidor sobre lo suyo).
- Si el responsable cambio a un repartidor → `AvisarAsignacion`, despues de
  responder, en segundo plano. Desasignar no avisa.
- Mismo responsable que ya tenia → 200 sin escribir ni avisar.

## 4. `GET /admin/tablero` (cambia, solo Admin)

Cada carga suma:

```json
{ "creadoEn": "…", "cantidad": 2, "clienteId": "…",
  "repartidor": "rep@x.uy", "entregadoEn": "2026-10-03T21:10:00Z" }
```

- `repartidor`: solo si el pedido esta entregado y tiene `repartidor_email`.
- `entregadoEn`: ultima marca de entrega, solo si sigue entregado. UTC.

La respuesta suma `"repartidores": [{ "email", "nombre"? }]`: configurados ∪
mails con entregas fijas, sin administradores.

## 5. `GET /admin/reporte` (cambia, solo Admin)

`?cliente=<id>&desde&hasta` (como hoy) **o** `?repartidor=<mail>&desde&hasta`.

- Los dos, o ninguno → 400 `el reporte es de un cliente o de un repartidor`.
- Con `repartidor`: solo pedidos entregados con ese `repartidor_email`, con la
  ultima entrega dentro de `[desde, hasta]` **en calendario de Montevideo**.
  Orden: fecha de entrega, id.
- Misma forma de fila que hoy. Sin `precio`.
