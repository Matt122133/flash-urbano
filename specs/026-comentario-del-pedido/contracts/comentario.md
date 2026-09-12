# Contrato: el comentario en el servicio y en las pantallas

**Fase 1** de [plan.md](plan.md). Lo que cada superficie tiene que cumplir para
que las otras dos puedan confiar.

## 1. El servicio

### 1.1 Crear un pedido — `POST /pedidos`

El cuerpo gana **un campo opcional** en la raíz:

```jsonc
{
  // … todo lo que ya manda hoy, sin cambios …
  "comentario": "Tocar timbre del 2. El portón de adelante no abre."
}
```

- **Opcional**: la clave puede no venir. Un cuerpo idéntico al de hoy sigue
  siendo válido y crea un pedido sin comentario.
- **Tope 280 caracteres.** Más largo → `400`, con el mismo formato de error de
  validación que ya usan los demás campos.
- **Sólo espacios en blanco → se guarda sin comentario.** El servicio recorta
  los extremos; si lo que queda es vacío, guarda `NULL`. No es un error.
- **Los saltos de línea de adentro se conservan.**

### 1.2 Editar un pedido — el camino de `022`

Mismo campo, misma validación, **misma regla de cuándo se puede**: sólo mientras
el pedido está pendiente. Un `comentario` explícitamente vacío o `null` borra el
que había.

### 1.3 Leer pedidos — `GET /pedidos` y `GET /admin/pedidos`

Cada pedido gana:

```jsonc
{ "comentario": "Tocar timbre del 2." }
```

**La clave se omite cuando no hay comentario** (`omitempty`), igual que
`Direccion.punto`. El cliente Kotlin ya está escrito para esa forma y el archivo
lo documenta; mandar `"comentario": null` sería una tercera forma que nadie pidió.

### 1.4 `GET /admin/tablero` — **no cambia**

`internal/tablero` no lee la columna y no se toca. Una prueba ya sostiene que
ese paquete no importa `internal/pedidos`.

---

## 2. La web

### 2.1 El formulario

- Campo de texto multilínea rotulado **"Comentario"**, **opcional**.
- **Texto de ayuda debajo** que diga quién lo lee y para qué sirve, con ejemplos
  del tipo *"tocar timbre del 2"*, *"retirar por la puerta de atrás"*. La
  etiqueta sola no lo dice, así que la ayuda es lo único que encauza el uso
  (FR-001a).
- **La ayuda tiene que avisar que el comentario puede salir impreso en la
  etiqueta del paquete** (research D2): lo va a ver quien manipule el paquete.
- Contador visible al acercarse al tope; no deja escribir más de 280.
- **El formulario sigue sin depender del servicio.** La guarda de
  `cotizar-abierto.test.ts` no puede ponerse en rojo: se puede tocar el *tipo*
  en `lib/api.ts`, nunca meter una *llamada* en el camino del formulario.

### 2.2 El resumen de confirmación

Muestra el comentario **sólo si hay uno**. Sin comentario: nada, ni etiqueta ni
hueco (FR-009).

### 2.3 *Mis pedidos*

Ídem: el comentario aparece en la tarjeta del pedido cuando existe. El botón de
editar de `022` permite cambiarlo mientras el pedido esté pendiente.

### 2.4 La etiqueta impresa

- El comentario sale en la etiqueta, en un bloque propio y legible.
- **Sin comentario, la etiqueta sale exactamente como hoy**: ni un renglón
  corrido.
- **Ningún importe, como siempre** (Principio V). Si el cliente escribe un
  número con `$` dentro de su comentario, eso es texto del cliente y no un
  precio del producto: la guarda no lo trata como violación (research D7).

---

## 3. La app del repartidor

### 3.1 Dónde aparece

**Dentro de la tarjeta del pedido**, como un bloque propio, visualmente
distinto de las direcciones y los teléfonos, y **sólo en los pedidos que lo
tienen**.

**No se crea pantalla de detalle y no se pliega nada.** El contrato §4.2 de
`012` dice que la tarjeta muestra todo sin desplegar y que no se toca, con el
motivo escrito: Diego no puede tener que tocar para leer algo parado en una
puerta. Ver research D1 — **esto se aparta de la letra de D1 del spec y es lo
primero que hay que mirar al aprobar el plan**.

### 3.2 Compatibilidad hacia atrás

- El campo se declara **opcional con `null` por defecto**, como
  `Direccion.punto`.
- Una versión vieja de la app **no se rompe** con el campo nuevo:
  `ignoreUnknownKeys` ya está puesto y el archivo explica que es justamente para
  esto (research D3). O sea que **el servicio se puede desplegar antes que el
  APK**.

### 3.3 Lo que no cambia

La tarjeta sigue mostrando, sin desplegar: código, retiro, entrega, tamaño y
cantidad, los dos teléfonos, y un solo botón grande. El comentario se suma a esa
lista; no reemplaza ni reordena nada.
