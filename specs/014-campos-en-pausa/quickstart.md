# Quickstart — `014` Dos campos en pausa

Lo que `verify:` no puede demostrar. `verify:` prueba que el código compila y
que nada se rompió; **no prueba que los campos no estén, ni que el pedido llegue
con los valores fijos**.

## Nivel 1 — desde la sesión

### Q1. Los dos campos no están, y los otros dos sí

```bash
cd web
npm run dev
```

En `/pedido`:

1. La sección del paquete muestra **cuántos paquetes** y **no** el selector
   chico/mediano/grande.
2. La sección de retiro muestra **la fecha** y **no** el horario.
3. Completar todo y confirmar. **Esperado**: el pedido se crea, y no aparece
   ningún error de validación pidiendo un tamaño o una hora.
4. El resumen posterior no nombra ni el tamaño ni la hora, y sí la fecha.

### Q2. La fecha sigue validando

Elegir una fecha de retiro **pasada**.

**Esperado**: el formulario la rechaza con el mensaje de siempre. Esa validación
no se tocó, y es fácil romperla de rebote al comentar la de al lado.

### Q3. *Mis pedidos* no muestra ninguno de los dos

Con al menos un pedido guardado, abrir el historial.

**Esperado**: la tarjeta dice *"Retiro el 3/9"*, sin hora, y la línea del paquete
dice solo la cantidad. **También en los pedidos viejos**, donde el dato era
verdadero — es el costo aceptado en research D5.

### Q4. Repetir un pedido sigue andando

Repetir un pedido que tenía tamaño `grande` y hora `10:00`.

**Esperado**: el formulario se precarga con lo demás, no pregunta por esos dos, y
el pedido nuevo sale con los valores fijos. El pedido viejo no se modifica.

### Q5. Los bloques comentados se explican solos

Abrir `components/pedido-form.tsx` y leer los dos bloques comentados.

**Esperado**: cada uno dice qué feature lo desactivó, en qué fecha, que fue
decisión del cliente, que **el cliente dijo que vuelve**, y qué hay que
descomentar — incluida la validación, que vive en otro lugar del archivo.

**Si esto falla, falla el feature.** Es SC-004 y SC-005, y es la mitad que nadie
va a revisar en un diff.

## Nivel 2 — contra el servicio, mirando la base

### Q6. El pedido llega con los valores fijos y el servicio lo acepta

Con el backend local levantado, crear un pedido desde el sitio y mirar la fila:

```sql
SELECT id, paquete_tamano, retiro_fecha, retiro_hora
FROM pedidos
ORDER BY creado_en DESC
LIMIT 1;
```

**Esperado**: `paquete_tamano = 'chico'`, `retiro_hora = '16:00'`, y
`retiro_fecha` con el día que la persona eligió.

**Si el servicio devuelve 400**, el sitio dejó de mandar alguno de los dos y este
feature rompió FR-004 — que es exactamente lo que la decisión de no tocar el
backend (research D3) deja como único modo de falla posible.

## Nivel 3 — con el cliente

### Q7. Que Diego lo mire

Que confirme que es lo que pidió, y **que su app le sigue sirviendo**: va a ver
`Tamaño chico` y `16:00` en todos los pedidos. Está aceptado a sabiendas, pero
él no lo vio todavía.
