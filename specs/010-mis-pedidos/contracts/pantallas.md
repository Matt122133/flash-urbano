# Contrato — 010 Mis pedidos

`007` puso su contrato en `contracts/pedidos.md` porque agregaba endpoints. `010`
**no agrega ninguno**: su superficie es de pantalla, y lo único con forma de
contrato es la URL que las une. Eso es lo que está acá.

## 1. La URL de repetición

```text
/pedido?repetir=<id del pedido>
```

- `<id>` es el `id` uuid que devuelve `GET /pedidos`. **No** el código `FU-0042`:
  el código es para la persona, el id para la máquina, y exponer el código acá
  invitaría a tipear uno ajeno a mano.
- **Es un enlace normal.** Se puede copiar, recargar, abrir en otra pestaña.
  Todas esas cosas tienen que funcionar; si algo se rompe al recargar, el
  contrato no se cumplió.
- **No lleva ningún dato del pedido.** Ni direcciones, ni teléfonos, ni el
  destinatario. Un uuid solo no dice nada de nadie (FR-021).
- **No autoriza nada.** El pedido se resuelve pidiendo `GET /pedidos` con la
  credencial de quien está adentro y buscando ese id en **su propia** lista. Un
  id de otra persona simplemente no aparece, y cae en el caso "no encontrado" —
  no hay que escribir ninguna comprobación de dueño, y ese es justamente el
  punto: la que ya existe en el servicio es la que decide (FR-007).

### Respuestas de la pantalla ante cada caso

| Caso | Qué hace `/pedido` |
|---|---|
| `?repetir=` con id propio y válido | Precarga entera desde el pedido; el perfil no interviene (FR-013b) |
| `?repetir=` con id que no está en la lista | Avisa que no encontró ese pedido y **deja el formulario vacío y usable** |
| `?repetir=` sin sesión | El mismo camino de siempre: se pide ingresar; al volver, se resuelve la precarga |
| `?repetir=` y el servicio no responde | Avisa que no pudo traer el pedido y deja el formulario vacío y usable |
| Sin `?repetir=` | Todo igual que hoy: precarga del perfil (`007`), sin cambios |

**Regla que atraviesa la tabla**: un `?repetir=` que falla **nunca** deja la
pantalla a medio cargar ni bloqueada. Degrada a "formulario vacío", que es una
pantalla que sirve.

## 2. Lo que la sección de *Mi cuenta* muestra

Contrato de contenido, no de maquetado.

**Tarjeta (siempre visible)** — código, fecha de **retiro**, estado, precio
cobrado, y la calle de entrega. Nada más: es lo que tiene que poder recorrerse de
un vistazo en un teléfono.

**Detalle (al desplegar)** — dirección de retiro completa, dirección de entrega
completa, tamaño y cantidad de paquetes, nombre y teléfono de quien recibe,
cuándo se cargó el pedido, y el botón *Repetir*.

**Estados, traducidos** (FR-006):

| Guardado | Se muestra |
|---|---|
| `creacion` | Pendiente |
| `aceptacion` | Aceptado |
| `entrega` | Entregado |

Hoy, en producción, **todos** dicen "Pendiente": nada mueve esa columna hasta que
exista la app Android. Si aparece un valor que no está en la tabla, se muestra el
valor crudo antes que romper la pantalla o inventar una traducción.

**Cuántos** — los 5 más recientes, y "Ver todos" para el resto de lo ya traído.

**Los tres estados de la sección que no son una lista**:

| Situación | Qué se ve |
|---|---|
| Sin sesión | Nada de la sección: `/perfil` muestra lo de hoy (FR-008) |
| Sin pedidos | Un texto que lo dice y un enlace a crear el primero (FR-010) |
| El servicio no responde | Un texto que lo dice y un botón de reintentar, **sin tocar el resto de Mi cuenta** (FR-009) |

## 3. Lo que este feature promete NO tocar

Es parte del contrato porque es lo que se puede romper sin darse cuenta:

- **`web/components/pedido-form.tsx` no se edita.** La fecha y la hora ya llegan
  vacías si `inicial` no las trae (FR-014), y todo lo precargado ya es editable
  (FR-013a). Si el plan termina necesitando editar ese archivo, hay que frenar:
  es una de las entradas de `web/lib/cotizar-abierto.test.ts`, la guarda de
  FR-022.
- **El servicio no se toca.** Ni `backend/`, ni migraciones, ni rutas.
- **`web/components/sesion/rehidratar-retiro.ts` no se edita**, se usa. No está
  en `covers:` a propósito.
