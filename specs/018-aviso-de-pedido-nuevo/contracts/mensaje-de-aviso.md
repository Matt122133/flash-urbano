# Contrato: el mensaje del aviso

Qué manda el servicio cuando entra un pedido, y qué hace la app con eso.

## Cuándo se manda

Exactamente una vez por pedido **nuevo**: en `POST /pedidos`, y sólo cuando la
creación devuelve `esNuevo = true`. Un reintento del navegador con la misma
clave de idempotencia **no** produce un segundo aviso (FR-003).

Se manda **después** de responderle al cliente, con un contexto propio y con
plazo. El cliente no espera por esto ni ve ningún error suyo (FR-009).

## Qué se manda

Mensaje híbrido: un bloque que dibuja el sistema y un bloque de datos que lee la
app.

```jsonc
{
  "message": {
    "token": "<sesiones.push_token del destinatario>",
    "notification": {
      "title": "Pedido nuevo FU-0142",
      "body":  "Entrega en Av. Brasil"
    },
    "data": {
      "pedido": "FU-0142"
    },
    "android": {
      "priority": "HIGH",
      "ttl": "86400s",
      "notification": { "channel_id": "pedidos-nuevos" }
    }
  }
}
```

### El texto visible, renglón por renglón

- **Título**: `Pedido nuevo ` + el código del pedido.
- **Cuerpo**: `Entrega en ` + **la calle de entrega, sin número y sin esquina**.

**Lo que está prohibido que aparezca** (FR-005): el número de puerta, la
esquina, el nombre o el teléfono de cualquiera de las dos puntas, y **cualquier
importe o referencia a lo que cuesta el envío** — el producto no habla de plata
en ninguna superficie (Principio V), y la columna `precio` no se lee ni para
esto ni para nada.

La esquina queda afuera por una razón concreta: el punto de entrega **se
resuelve del cruce**, así que mostrar calle y esquina es mostrar la dirección
con otro nombre.

### Los parámetros que no son texto

| Campo | Valor | Por qué |
|---|---|---|
| `ttl` | `86400s` | FR-017: un aviso guardado más de 24 horas se descarta en vez de entregarse tarde. Es el horizonte que el negocio ya se puso. |
| `priority` | `HIGH` | Es lo que hace que llegue con el teléfono en reposo, que es el caso principal (US1). |
| `channel_id` | `pedidos-nuevos` | Canal de importancia alta. Suena y aparece encima, **y respeta el No molestar del sistema** — FR-006 sin escribir una franja horaria. |
| `data.pedido` | el código | Es lo que hace que tocar el aviso abra la lista en ese pedido (FR-004). |

## Quién lo recibe

Los tokens de las **sesiones vivas de una dirección administradora** — la
consulta está en [`../data-model.md`](../data-model.md). Un cliente nunca recibe
uno, y una sesión revocada deja de recibirlos porque desaparece del conjunto
(FR-007).

**Son varios, no uno** (FR-018): hoy hay dos teléfonos con sesión
administradora. La API HTTP v1 manda **un mensaje por token**, así que el envío
recorre el conjunto. **Un destinatario que falla no corta el recorrido**: se
registra, se sigue con el siguiente, y el resultado de cada uno se evalúa
aparte —un token muerto se borra sin tocar el de al lado.

## Qué hace la app al recibirlo

| Estado de la app | Qué pasa |
|---|---|
| Cerrada o en segundo plano | Lo dibuja el sistema desde el bloque `notification`. Tocarlo abre la app en la lista, en ese pedido, leyendo `data.pedido`. |
| En primer plano | El sistema **no** lo dibuja: lo recibe la app, que muestra el renglón *"1 pedido nuevo — tocá para actualizar"*. **La lista no se reordena sola** (FR-016). |

## Qué pasa cuando falla

| Respuesta del proveedor | Qué hace el servicio |
|---|---|
| Éxito | Nada más. No se escribe en la base. |
| Token vencido o desconocido (`UNREGISTERED`, `INVALID_ARGUMENT` sobre el token) | Se borra ese `push_token` de la fila. No se reintenta (FR-013). |
| Error transitorio o servicio caído | Se registra **con el código del pedido** (FR-014) y se deja ahí. No hay cola propia: el pedido está en la lista, que es la red de reserva declarada. |
| Sin credencial configurada | No se intenta nada. El servicio arrancó igual y ya dejó anotado que no manda avisos (FR-010). |

**En ninguno de esos casos se toca el pedido.** El pedido ya está guardado y el
cliente ya recibió su código.
