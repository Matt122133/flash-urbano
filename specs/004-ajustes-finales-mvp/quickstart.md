# Phase 1 — Cómo se valida que anda

Dos mitades. Lo automatizable lo cubre `verify:`; el resto es el formulario, que
no tiene pruebas y se prueba a mano. Los pasos manuales no son opcionales: la
mitad de este feature es interfaz, y hay al menos un defecto conocido
(research R5) que ninguna prueba automática de este repo habría atrapado.

## Prerrequisitos

```bash
cd web
npm install
```

## Automático — el comando de `verify:`

```bash
cd web && npm run lint && npm test && npm run build
```

Es el gate: el plan no está hecho hasta que esto está verde.

### Qué tiene que probar `npm test` que hoy no prueba

- **La zona más barata gana aunque no sea la primera de la lista.** Dos
  polígonos sintéticos superpuestos, el caro primero. Si esta prueba no falla
  con la implementación vieja ("la primera que contenga"), está mal escrita.
- **Empate de precio resuelto por `id` más bajo**, y estable entre corridas.
- **El punto fuera de toda zona sigue dando `null`**, no la más cercana.
- **El retiro en un día que ya pasó se rechaza**, y hoy mismo se acepta.
- **Cruce de fin de mes** en la comparación de la fecha de retiro.

### Qué tiene que dejar de probar

Los trece casos de `fechas.test.ts` sobre margen mínimo y orden entre retiro y
entrega. **Se borran, no se comentan ni se saltean con `it.skip`**: su sujeto
dejó de existir. Un `skip` acá es una prueba que alguien va a intentar revivir
en seis meses sin saber por qué estaba apagada.

Chequeo rápido de que no quedó residuo:

```bash
cd web
grep -rn "paymentMethod\|clientType\|deliveryDate\|deliveryTime\|recieverName\|recieverCI\|MARGEN_MINIMO" lib/ components/ app/
```

Sin resultados. Si aparece algo, es un campo que se sacó a medias.

Y que el número de WhatsApp siga teniendo un solo lugar de definición (FR-019):

```bash
cd web
grep -rn "59892171791\|092 171 791" lib/ components/ app/
```

Un solo archivo: `app/contacto/page.tsx`. `pedido-form.tsx` enlaza a `/contacto`
en vez de repetir el número, justamente para no tener que acordarse de dos
lugares el día que cambie.

## Manual — el formulario

```bash
cd web && npm run dev
```

Abrir `http://localhost:3000/flash-urbano/pedido` **en viewport de teléfono**
(Principio IV: es desde donde se va a usar).

1. **La sección "¿Quién envía?" tiene dos campos y nada más.** No hay par de
   botones particular/empresa.
2. **La sección de retiro no menciona la forma de pago** ni en el encabezado ni
   adentro, y tiene solo fecha y hora de retiro.

2b. **"¿Qué envías?" muestra el selector de tamaño directamente.** Sin los dos
   botones de "Tamaño predefinido" / "Describir el paquete", y sin ningún campo
   de texto libre para el paquete. Dejarlo sin elegir e intentar enviar tiene que
   mostrar el mensaje de tamaño.
3. **El aviso de 24 horas está visible** en esa sección, con texto fijo.
4. **La sección "¿Quién recibe el paquete?" tiene un solo campo**: el teléfono.
5. **El error del teléfono del destinatario SE VE.** Dejarlo vacío, intentar
   enviar, y confirmar que aparece un mensaje **junto al campo**. Después
   escribir `123` y confirmar que aparece el de teléfono inválido. Este paso es
   el que existe por research R5 — el campo anterior bloqueaba el envío sin
   decir nada durante dos features enteros.
6. **Un pedido completo se envía.** Cargar todo, confirmar, y revisar el
   resumen: sin forma de pago, sin fecha ni hora de entrega, sin nombre ni
   cédula de quien recibe; con el teléfono del destinatario y el compromiso de
   24 horas. **Contar los campos obligatorios mientras se completa: tienen que
   ser 12**, sin contar la cantidad de paquetes, que viene con 1 puesto. Es la
   métrica de SC-001 y se verifica contando, no estimando.

6b. **Todos los errores se ven, no solo el del campo nuevo.** Con el formulario
   **vacío**, tocar "Confirmar pedido" y recorrer la pantalla de arriba abajo:
   cada campo que bloquea el envío tiene que mostrar su mensaje debajo. Es un
   pase de ojos, no una auditoría, y existe porque SC-004 afirma esto de todo el
   formulario mientras que el paso 5 solo cubre un campo. El precedente está en
   research R5: una clave mal escrita dejó un mensaje invisible durante dos
   features enteros, y nadie lo notó porque nadie miró la lista completa.
7. **Dos pedidos con fechas de retiro distintas muestran el mismo texto de 24
   horas.** Es la comprobación de FR-009a: si el texto cambia entre uno y otro,
   alguien calculó un momento de entrega.
8. **La fecha de retiro sigue avisando temprano.** Poner una fecha de ayer y
   salir del campo: el mensaje aparece sin necesidad de enviar.

## Manual — contacto e indexación

1. `http://localhost:3000/flash-urbano/contacto`: el número **se lee en
   pantalla** como `092 171 791`.
2. Tocar la tarjeta de WhatsApp abre `wa.me/59892171791` con el mensaje
   sugerido. En escritorio alcanza con verificar el `href`.
3. En cualquier página, ver el HTML entregado y confirmar que **no hay**
   `<meta name="robots" content="noindex">`:

   ```bash
   cd web && npm run build
   grep -rn "noindex" out/ .next/server/app/ 2>/dev/null
   ```

   Sin resultados.

## Al cerrar

- `docs/tech-debt-tracker.md`: pasar a `Resolved` la fila `High` del límite de
  zona y la fila `Medium` del error que nunca se mostraba. Agregar la fila nueva
  por el copy obsoleto de `/pedido` (ver Riesgos en el plan).
- `.specify/memory/constitution.md`: la línea de *Scope boundaries* corregida,
  versión `2.1.0`, y la entrada en el historial de enmiendas.
- `specs/004-ajustes-finales-mvp/plan.md`: `status: completed`.
