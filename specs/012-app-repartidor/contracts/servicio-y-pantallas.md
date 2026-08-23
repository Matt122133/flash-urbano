# Contrato: el servicio y las pantallas de la app

**Feature**: `012-app-repartidor` | **Fecha**: 2026-08-23

---

## 1. `PATCH /admin/pedidos/{id}/estado` — el camino nuevo

```json
{ "estado": "aceptacion" }
```

### Acepta

| Caso | Resultado |
|---|---|
| Uno de los tres estados, hacia adelante | `200` con el pedido actualizado |
| Uno de los tres estados, **hacia atrás** | `200`. Es FR-004, no un error |
| **El estado que el pedido ya tiene** | `200`, sin cambiar nada y **sin agregar una fila al historial**. Es FR-009 |

### Rechaza

| Caso | Respuesta |
|---|---|
| Un valor que no es uno de los tres | `400` — *ese estado no existe* |
| Sin credencial, o con una que no está en `ADMIN_EMAILS` | Lo mismo que hoy responde `GET /admin/pedidos` |
| Un `id` que no existe | `404` |

**Nota sobre la idempotencia**: se manda el estado **destino**, no una
transición. Es lo que hace que tocar dos veces "entregado" —cosa que pasa con
guantes y sol de frente— sea inofensivo.

---

## 2. `GET /admin/pedidos` — lo que ya existe

**No cambia de forma.** La app consume lo que ya devuelve.

Lo que la app **tiene que tolerar** (data-model §5): pedidos sin punto de retiro,
sin punto de entrega, y con un estado que no conoce.

---

## 3. La sesión

**No cambia de forma.** Cambia que **se renueva al usarse** si le queda menos de
la mitad de vida (research D7).

Para la app eso significa: guarda la credencial una vez y no vuelve a pensar en
el tema. Lo único que tiene que manejar es el caso de que un día el servicio
conteste que la sesión no vale — ahí vuelve a la pantalla de ingreso, **sin
perder nada** (US3-3).

---

## 4. Las pantallas

### 4.1 Ingreso — se ve una vez en la vida

Mail → código → adentro. Reusa `/auth/codigo` tal cual.

**No aparece nunca más** mientras la sesión se renueve.

### 4.2 Principal — el trabajo pendiente

**Dos secciones, en este orden**: **Pendientes** y **Tomados** (FR-013).

Cada pedido muestra, sin desplegar nada:

- El **código** (`FU-####`).
- **De dónde retira** y **a dónde lleva**.
- **Tamaño y cantidad**.
- **Los dos teléfonos**: quien envía y quien recibe (FR-015), tocables para
  llamar.

Y **un solo botón grande**:

| Sección | Botón | Pasa a |
|---|---|---|
| Pendientes | *Ya lo tengo* | Tomados |
| Tomados | *Entregado* | Entregados |

**Un toque por pedido. Sin selección múltiple** — los paquetes se levantan de a
uno (FR-012).

### 4.3 Entregados — su propia sección

Fuera de la pantalla principal. Es la única lista que crece sin límite, y sirve
para consultar, no para trabajar.

### 4.4 Deshacer

Desde el pedido se puede volver al estado anterior (FR-004). **No es el botón
principal**: el principal avanza, y volver atrás es una acción secundaria, para
que no se toque sin querer justo lo que se quería evitar.

---

## 5. Los estados de la pantalla que no son una lista

| Situación | Qué se ve |
|---|---|
| Sin señal al abrir | Que no se pudo traer, y un botón de reintentar. **Nunca una lista vacía** — parecería que no hay trabajo |
| Sin señal al mover un pedido | Que no se pudo, y **el pedido queda donde estaba**. Nunca se muestra el cambio como hecho (FR-008) |
| Sin pedidos de verdad | Que no hay nada pendiente. Es distinto de lo anterior y tiene que leerse distinto |
| La sesión venció | La pantalla de ingreso, con el motivo dicho |

---

## 6. Lo que este contrato prohíbe

- Leer o escribir pedidos **sin credencial**, por cualquier vía.
- Mostrar un cambio de estado como aplicado **antes** de que el servicio lo
  confirme.
- Guardar pedidos en el teléfono entre sesiones.
- Que el APK de producción acepte conexiones **sin cifrar** (research D5).
- Elegir por Diego: la app **no** decide un orden de visita ni sugiere una ruta.
  Eso es el feature que todavía no existe.
