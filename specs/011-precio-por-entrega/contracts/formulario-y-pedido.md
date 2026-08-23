# Contrato: el formulario y el pedido, después de la inversión

**Feature**: `011-precio-por-entrega` | **Fecha**: 2026-08-22

Dos superficies con contrato: lo que cada sección del formulario promete, y lo
que el servicio acepta y rechaza.

---

## 1. Las dos secciones del formulario

El orden se mantiene **retiro → entrega** (FR-002a). Lo que cambia es qué hace
cada una.

### 1.1 *De dónde lo retiramos* — modo `oportunista`

| Aspecto | Comportamiento |
|---|---|
| Autocompletado | Ayuda, no puerta. Lo tipeado vale aunque no esté en el índice. |
| Mapa | **No hay.** |
| Punto | Se resuelve en silencio **sólo si el cruce es inequívoco**. Nunca se muestra. |
| Calle homónima | **No se pregunta.** Se guarda sin punto (research D2). |
| Sin resolver | El pedido sigue, sin punto y **sin decir nada** (FR-015). |
| Fuera del área | Si resolvió y cae fuera de toda zona: **avisa y no deja confirmar** (FR-011). |
| Precargado del perfil | Usa el punto **guardado**, no el resuelto (FR-016). Ese punto no se revalida ni se descarta (FR-017). |

### 1.2 *A dónde llevamos el paquete* — modo `exigente`

| Aspecto | Comportamiento |
|---|---|
| Autocompletado | **Obligatorio** elegir de las sugerencias. |
| Mapa | **Sí**, debajo de los campos, con el punto. |
| Punto | Confinado a la cuadra declarada; moverlo puede cambiar de zona y eso se muestra. |
| Calle homónima | Se muestran los candidatos. **Nunca se toma el primero.** |
| Sin resolver | **No hay precio y no se puede confirmar.** |
| Fuera de toda zona | Sin precio, sin pedido, encamina al contacto directo. **Nunca la zona más cercana.** |

### 1.3 El precio

- Sale de `resolverZona(entrega.direccion.punto)` y **de ningún otro lado**.
- Se muestra apenas la entrega resuelve, **sin importar si el retiro está
  completo** (FR-002a). Es lo que mantiene viva la cotización pública sin cuenta.
- Se calcula en el navegador, sin red (FR-004).

---

## 2. `POST /pedidos`

La forma del cuerpo **no cambia** (research D3). Cambian las reglas.

### Acepta

| Caso | Resultado |
|---|---|
| `entrega.punto` presente y `retiro.punto` presente | Creado |
| `entrega.punto` presente y `retiro.punto` **ausente** | Creado. Es el caso de FR-015 y **no es un error**. |

### Rechaza

| Caso | Respuesta |
|---|---|
| `entrega.punto` ausente | `400` — *falta el punto de entrega* |

**El servicio sigue sin resolver zonas** (FR-010): no comprueba que `precio` y
`zona_id` correspondan al punto. Esa sigue siendo una propiedad del navegador,
y la razón sigue siendo que cotizar tiene que funcionar con el servicio caído.

---

## 3. `GET /pedidos` — lo que devuelve

Sin cambios de forma. Un pedido puede venir ahora con:

- `entrega.punto` presente — todo pedido creado desde `011`.
- `entrega.punto` ausente — todo pedido anterior.
- `retiro.punto` ausente — cuando el texto no resolvió.

**Quien consume esto tiene que tolerar las tres.** En particular la pantalla de
historial de `010` y el camino de repetición.

---

## 4. Repetir un pedido — la tabla de casos

Sobre `/pedido?repetir=<id>`, extendiendo la de `010`:

| Caso | Qué pasa |
|---|---|
| Pedido con `entrega.punto`, zona resuelve | Precarga completa y precio de hoy; aviso de reajuste si cambió |
| Pedido con `entrega.punto`, zona **ya no** resuelve | Precarga, **sin precio y sin confirmar**, encamina al contacto |
| Pedido **sin** `entrega.punto` (anterior a `011`) | Precarga todo lo demás, la entrega queda **como texto sin resolver**, y hay que completar la esquina para ver precio. Aviso que lo explique. **Nunca una pantalla rota** (FR-013). |
| Pedido sin `retiro.punto` | Precarga el retiro como texto. No se avisa nada: es un caso normal. |

---

## 5. Lo que este contrato prohíbe

- Mostrar un precio derivado del punto de retiro, en cualquier pantalla.
- Rechazar un pedido por falta de punto de retiro.
- Elegir un candidato de esquina automáticamente cuando hay más de uno, en
  cualquiera de las dos secciones.
- Que el servicio calcule o corrija un precio.
- Que `web/lib/api.ts` entre en el grafo de imports del formulario (research D8).
