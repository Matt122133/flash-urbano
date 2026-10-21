# Data Model: Repartidores

## 1. `pedidos.repartidor_email` (migracion `0011_repartidor_del_pedido.sql`)

| Columna | Tipo | Nulo | Regla |
|---|---|---|---|
| `repartidor_email` | `text` | si | `CHECK (repartidor_email = lower(repartidor_email))` |

- **Nulo = de los administradores.** Todo pedido nace asi, y los existentes
  quedan asi sin escritura (FR-007): `ADD COLUMN` nulable y sin default.
- **Sin FK**: el repartidor puede no tener fila en `usuarios` (research D2).
- Indice parcial `ON pedidos (repartidor_email) WHERE repartidor_email IS NOT
  NULL`: la lista del repartidor y el reporte filtran por el.
- Solo hacia adelante, como todas las migraciones del repo. Se prueba contra una
  base **con datos** antes de desplegar.

No cambia ninguna otra tabla. `usuarios` no gana columnas (FR-003).

## 2. Configuracion

| Variable | Obligatoria | Contenido |
|---|---|---|
| `REPARTIDOR_EMAILS` | **no** | mails separados por coma; vacia = sin repartidores |

`EsRepartidor(mail)` = esta en la lista **y** `!EsAdmin(mail)`.

## 3. Responsable efectivo (calculado, no guardado)

```
responsable(p) =
  p.repartidor_email == nulo                            → administradores
  p.estado == entrega                                   → p.repartidor_email
  !esRepartidor(p.repartidor_email)                     → administradores
  en otro caso                                          → p.repartidor_email
```

En el JSON es `responsable`: el mail del repartidor, u omitido para
administradores.

## 4. Transiciones de la asignacion

```
                 asignar(R)              devolver / desasignar
  [admins] ───────────────────▶ [R] ───────────────────────▶ [admins]
      │                          │
      │  entregar                │  entregar
      ▼                          ▼
  [admins, fijo]             [R, fijo]   ── deshacer entrega ──▶ [R]
```

- **Fijo** = `estado = 'entrega'`: el `UPDATE` de asignacion no lo toca.
- `asignar` lo hace solo un administrador; `devolver` el repartidor sobre lo
  suyo, o un administrador sobre cualquiera.
- Asignar al mismo responsable que ya tiene no escribe ni avisa.

## 5. Lo que se lee para el tablero y el reporte

- **Carga** (tablero) gana `repartidor` (solo si entregada y asignada) y
  `entregadoEn` (ultima marca de entrega, solo si sigue entregada).
- **Repartidor** (tablero): `{email, nombre?}`; los configurados ∪ los mails con
  pedidos entregados. `nombre` sale de `usuarios` por mail, si existe.
- **Fila de reporte**: la misma de `029`.
