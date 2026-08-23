# Data Model: La app de Diego

**Feature**: `012-app-repartidor` | **Fecha**: 2026-08-23

Este feature agrega **una** entidad y cambia **una** columna. Todo lo demás ya
existe; lo que cambia es que empieza a usarse.

---

## 1. `pedidos.estado` — la columna que nadie escribía

**No cambia de forma.** Es texto con `CHECK` sobre los tres valores, y hoy
**siempre vale `creacion`** porque no hay código que la mueva
(`pedido.go:44`).

Lo que cambia: **empieza a moverse**, y en las dos direcciones (FR-004).

| | Antes | Después |
|---|---|---|
| Valores posibles | los tres | los tres |
| Valores que ocurren | `creacion` | los tres |
| Quién la escribe | nadie | el servicio, a pedido de la app |
| Dirección | — | cualquiera, incluida hacia atrás |

**`actualizado_en` deja de ser decorativo**: hasta ahora sólo cambiaba al editar
el pedido, cosa que no pasa nunca.

---

## 2. `pedidos_estados` — la entidad nueva

Una fila por cambio. Es lo único que este feature agrega al modelo.

| Columna | Tipo | Por qué |
|---|---|---|
| `id` | `uuid` | — |
| `pedido_id` | `uuid NOT NULL` → `pedidos(id)` | A qué pedido pertenece |
| `estado` | `text NOT NULL` con el mismo `CHECK` | A qué estado pasó |
| `ocurrido_en` | `timestamptz NOT NULL DEFAULT now()` | Cuándo |

**Lo que NO lleva, y cada omisión tiene su motivo:**

- **No lleva `estado_anterior`.** Es derivable de la fila previa, y guardarlo
  invita a que las dos versiones se contradigan.
- **No lleva quién lo hizo.** Hoy hay **un** administrador. Agregar la columna
  ahora sería adivinar la forma de un requisito que no existe; el día que haya
  dos repartidores, esta tabla es justamente donde se agrega — y desde ese día en
  adelante, no hacia atrás.
- **No lleva ubicación.** Sería el dato más valioso para una disputa —"lo marqué
  entregado en esta esquina"— y **está fuera del alcance a propósito**: pedir
  permiso de ubicación es una conversación con el cliente que este feature no
  tuvo.

**No se purga.** `rastro` se borra a los 90 días porque son datos personales que
crecen rápido; esto son tres filas por pedido y es exactamente el dato que se
quiere tener cuando alguien reclama meses después.

**No se rellena hacia atrás.** Los pedidos que ya existen no reciben una fila de
"creación" inventada: el historial empieza cuando empieza. Un pedido sin ninguna
fila significa "es anterior a esto", que es la verdad.

---

## 3. `sesiones.expira_en` — el que ahora se mueve

**No cambia de forma.** Cambia **cuándo se escribe**: hoy sólo al crear la
sesión; después de este feature, también al usarla, si le queda menos de la mitad
de vida (research D7).

**Consecuencia que hay que tener presente**: validar una sesión deja de ser una
operación de sólo lectura. El umbral existe para que eso ocurra una vez cada dos
semanas y no en cada petición.

---

## 4. Lo que la app tiene en memoria

La app **no tiene base de datos**. Lo que mantiene mientras está abierta:

- **La lista de pedidos** tal como vino del servicio, agrupada por estado.
- **La credencial**, en `DataStore` — lo único que sobrevive a cerrar la app.

**No guarda pedidos entre sesiones.** Es la decisión de "no funciona sin señal"
(FR-008) y también lo que hace que un teléfono perdido no sea un archivo de datos
de clientes: sin credencial válida, no hay lista.

---

## 5. Lo que la app tiene que tolerar al leer un pedido

Tres formas, todas legítimas, todas presentes hoy en producción o mañana:

| Caso | De dónde sale |
|---|---|
| Sin `retiro.punto` | El texto no resolvió, o la calle es homónima (FR-014/015 de `011`) |
| Sin `entrega.punto` | Pedido anterior a `011` |
| Estado con un valor desconocido | La lista de estados puede crecer; el servicio lo guarda como texto a propósito |

**Los tres se muestran, ninguno rompe la pantalla.** Es la misma regla que `010`
aplicó al historial de la web (FR-006 de aquel feature).
