# Contrato — El formulario de pedido

La interfaz que este producto le ofrece a quien lo usa. No hay API: el
formulario **es** el contrato de cara al usuario, y este feature lo cambia.

## Secciones, después del cambio

| # | Sección | Contenido |
|---|---|---|
| 1 | ¿Quién envía? | Nombre y teléfono. **Sin** elección particular/empresa. |
| 2 | ¿De dónde retiramos el paquete? | Calle, esquina, número, apto, cooperativa; mapa con el punto; zona y precio. Sin cambios. |
| 3 | ¿A dónde lo llevamos? | Calle, número, esquina. Sin cambios. |
| 4 | ¿Qué envías? | **Solo el tamaño** (chico/mediano/grande) y la cantidad. Sin la elección de modo y sin el campo de descripción libre. |
| 5 | Retiro | Fecha y hora de retiro, **más el aviso fijo de 24 horas**. Sin forma de pago y sin fechas de entrega. El encabezado deja de decir "Fechas y forma de pago". |
| 6 | ¿Quién recibe el paquete? | **Solo el teléfono.** Sin nombre y sin cédula. |

## Reglas de validación

Cada regla que bloquea el envío **tiene que mostrar su mensaje junto al campo**.
Un formulario que se niega a enviarse sin decir por qué es un formulario roto,
aunque técnicamente valide bien. (FR-014, y ver research R5 para el precedente
que motiva esta línea.)

| Campo | Regla | Cuándo |
|---|---|---|
| Nombre | no vacío | al enviar |
| Teléfono de quien envía | no vacío; ≥8 dígitos | al enviar |
| Calle / esquina / número de retiro | completos y con cruce resuelto y único | al enviar |
| Punto de retiro | existe, cae dentro de una zona y dentro de la cuadra declarada | al enviar |
| Calle / número / esquina de entrega | no vacíos | al enviar |
| Tamaño del paquete | elegido | al enviar |
| Cantidad | entero ≥ 1 | al enviar |
| Fecha de retiro | no vacía; **no anterior a hoy** | al salir del campo y al enviar |
| Hora de retiro | no vacía | al enviar |
| **Teléfono de quien recibe** | **no vacío; ≥8 dígitos** | **al enviar** |

Reglas que **desaparecen**: forma de pago obligatoria; fecha y hora de entrega
obligatorias; entrega no anterior al retiro; margen mínimo de 2 horas entre
retiro y entrega; nombre y cédula de quien recibe; descripción del paquete
obligatoria cuando el modo era "libre".

La revisión al salir del campo (`onBlur`) queda solo sobre la fecha de retiro.
Existía para no obligar a subir por todo el formulario a enterarse de una
incoherencia entre cuatro campos; con un solo campo temporal, la parte que sigue
teniendo sentido es avisar temprano que la fecha ya pasó.

## Aviso de 24 horas

Texto fijo, **idéntico en todo pedido**, presente en dos lugares: la sección de
retiro y el resumen de confirmación. No se calcula ningún momento de entrega a
partir del retiro ni de nada más (FR-009a).

Es una promesa comercial que el sitio **comunica y no verifica**: no hay backend
y el pedido no le llega automáticamente a nadie. Quien la cumple es el operador.

## Resumen de confirmación

Filas después del cambio: Cliente (solo el nombre), Teléfono, Dirección de
retiro, Dirección de entrega, Zona y precio, Paquete, Retiro, **Compromiso de
entrega en 24 horas**, **Teléfono de quien recibe**.

Filas que se van: Forma de pago, Entrega (fecha y hora), Recibe el paquete
(nombre y CI). Y la fila Cliente deja de mostrar `(particular)` / `(empresa)`.
