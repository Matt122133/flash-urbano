# Contrato — `016` Quién recibió el paquete

Lo que cambia del contrato HTTP. Todo lo demás de `007` y `012` sigue igual.

## 1. `PATCH /admin/pedidos/{id}/estado` — acepta quién recibió

Solo para una dirección administradora, con la misma guarda de siempre.

**Cuerpo, hoy:**

```json
{ "estado": "entrega" }
```

**Cuerpo, desde `016`:**

```json
{
  "estado": "entrega",
  "receptor": {
    "nombre": "Susana Pérez",
    "documento": "1.234.567-8"
  }
}
```

Reglas:

- `receptor` es **opcional en el cuerpo** y solo se interpreta cuando
  `estado` es `entrega`. Mandarlo con otro estado **no es un error**: se ignora.
  Rechazarlo obligaría a la app a saber en qué transición está para armar el
  cuerpo, y ese conocimiento ya lo tiene el servicio.
- Cuando `estado` es `entrega`, **`receptor.nombre` es obligatorio**. La app
  siempre lo tiene: o lo escribió Diego, o es el destinatario del pedido, que la
  app copia al aceptar la propuesta de un toque.
- `receptor.documento` es **opcional y puede venir vacío**. Si quien recibe no
  da la cédula, la entrega se registra igual (FR-006).
- El documento se guarda **tal como llega**, sin validar ni normalizar
  (research D5).

**400** si `estado` es `entrega` y no viene `receptor.nombre`.

## 2. `GET /pedidos` — el cliente ve el nombre, nunca el documento

Cada pedido gana **un** campo:

```json
{
  "id": "…",
  "codigo": "FU-0007",
  "estado": "entrega",
  "recibioNombre": "Susana Pérez"
}
```

- `recibioNombre` está **solo si el pedido fue entregado y se registró quién
  recibió**. Un pedido anterior a `016`, o que no está entregado, no trae el
  campo.
- **`recibioDocumento` NO EXISTE en esta respuesta**, en ninguna forma y por
  ningún camino. No es un campo vacío ni nulo: no está.

Esta es la única regla del feature que se rompe en silencio, y por eso tiene una
prueba propia (FR-010) cuyo trabajo entero es fallar si esa cadena aparece acá.

## 3. `GET /admin/pedidos` — Diego ve las dos cosas

```json
{
  "id": "…",
  "codigo": "FU-0007",
  "estado": "entrega",
  "recibioNombre": "Susana Pérez",
  "recibioDocumento": "1.234.567-8"
}
```

Mismas condiciones de presencia que arriba: los dos campos aparecen solo si hay
qué mostrar.

## 4. Lo que este contrato NO cambia

- El historial de estados **sigue sin exponerse** (FR-014 de `012`). Lo único
  que sale de esa tabla es quién recibió, pegado al pedido.
- `POST /pedidos` no cambia: la cédula **no vuelve** al formulario web.
- Los códigos de estado, la autorización y el resto de los campos siguen como
  los dejaron `007` y `012`.
