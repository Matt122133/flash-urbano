# Quickstart: El comentario del pedido

**Fase 1** de [plan.md](plan.md). Lo que hay que ver con los ojos, porque el
`verify:` no lo ve.

**Por qué importa más que de costumbre**: esta feature toca la app, y ahí el
`verify:` sólo compila y corre pruebas JVM. En `012` eso dejó pasar dos defectos
—texto de botón cortado y un error crudo de OkHttp en pantalla— con todo verde.

## Antes de empezar

- **Docker Desktop levantado**, o las pruebas Go contra Postgres se saltan solas
  y el verde no dice nada de la base. Nunca contra el Postgres nativo del 5432:
  contesta, y destruiría la base de desarrollo.
- `TEST_DATABASE_URL` puesto, y al correr `verify:` **mirar que no haya `SKIP`**.
- Backend y sitio levantados en local, y un emulador o el teléfono a mano.

## Q1 — El campo existe y es opcional (FR-002)

Cargar un pedido **sin tocar el comentario**. **Esperado**: se crea igual que
hoy, sin un paso nuevo, sin un aviso, sin un campo en rojo.

## Q2 — Una indicación normal, de punta a punta (FR-006, US1)

Cargar un pedido con *"Tocar timbre del 2. El portón de adelante no abre."*
**Esperado**: aparece en el resumen de confirmación, en *Mis pedidos*, en la
etiqueta impresa y en la tarjeta de la app.

## Q3 — Sin comentario no hay hueco (FR-009)

Mirar un pedido **sin** comentario en las cuatro pantallas de Q2. **Esperado**:
ni etiqueta, ni dos puntos sueltos, ni espacio reservado. Tiene que verse
**idéntico a como se veía antes de esta feature**. Vale comparar contra una
captura previa.

## Q4 — Los pedidos que ya existen (FR-010)

Los pedidos que había antes de la migración. **Esperado**: se ven y se operan
igual que siempre, en la web y en la app. Son los de producción, así que esto se
mira también después del deploy.

## Q5 — Tildes, ñ, comillas y tres renglones (SC-004)

Cargar:

```text
Llamar antes: "el portón está trabado"
Preguntar por Ámbar
Retirar por atrás
```

**Esperado**: se lee íntegro y **con sus tres renglones** en las cuatro
pantallas. El renglón del medio es el que caza que alguien haya aplanado los
saltos de línea.

## Q6 — El tope (FR-003)

Escribir hasta pasarse de 280. **Esperado**: el contador avisa antes, y no deja
pasar. Después, con la herramienta que sea, mandarle al servicio un comentario
de 281: **esperado `400`**, no un pedido creado y recortado en silencio.

## Q7 — Sólo espacios (FR-004)

Cargar un pedido con el comentario en **espacios y saltos de línea solamente**.
**Esperado**: el pedido queda **sin** comentario, exactamente como Q3. No un
comentario en blanco que dibuje un bloque vacío.

## Q8 — Editar mientras está pendiente (FR-007, US2)

Con el pedido pendiente, editar el comentario desde *Mis pedidos*. **Esperado**:
queda el texto nuevo, y la app lo muestra actualizado al refrescar. Después
**borrarlo entero**: el pedido queda como Q3.

## Q9 — Ya tomado, ya no se toca (FR-007)

Con un pedido que la app ya movió a *Tomados*, mirarlo desde el perfil.
**Esperado**: no se puede editar el comentario, **y se ve el mismo motivo** que
`022` ya muestra para el resto de los campos. No un botón que falle al tocarlo.

## Q10 — La app vieja no se rompe (FR-011)

**El paso que justifica media feature.** Con el servicio nuevo ya corriendo,
abrir **el APK anterior** —el que Diego tiene hoy— contra él. **Esperado**: la
app funciona igual que siempre e ignora el campo que no conoce.

Si esto falla, el despliegue del servicio **no se puede hacer** antes de que
Diego instale la versión nueva, y eso cambia el orden de todo.

## Q11 — La tarjeta de la app no se rompió (contrato §4.2)

En el teléfono, con un pedido **con** comentario largo y otro **sin**:

- La tarjeta **sigue mostrando todo sin desplegar**: código, retiro, entrega,
  tamaño, cantidad, los dos teléfonos y el botón.
- El comentario se lee como **un bloque aparte**, no como otra línea de
  dirección.
- **Nada de texto cortado** y ningún botón fuera de la pantalla. Es el defecto
  exacto que `012` dejó pasar compilando.
- A 360 px de ancho también.

## Q12 — El tablero sigue contando y nada más (FR-012)

Abrir `/tablero` como admin. **Esperado**: los mismos números de siempre, **y
ningún comentario a la vista**.

## Q13 — El precio sigue sin aparecer (Principio V)

Imprimir la etiqueta de un pedido con comentario. **Esperado**: ningún importe.
**Control positivo**: cargar un pedido cuyo comentario diga `Cobrar $300` e
imprimirlo. Ese `$300` **tiene que salir** —es texto del cliente— y no cuenta
como violación. Si la guarda se pone en rojo por eso, la guarda está mal escrita,
no el producto (research D7).

## Q14 — El formulario sigue andando con el servicio caído

Bajar el backend y cargar un pedido hasta el último paso. **Esperado**: se puede
llenar todo, comentario incluido, y resolver la zona. Recién confirmar necesita
red. Es lo que la guarda de `cotizar-abierto.test.ts` protege; esto es el
control manual de que no se fue por otro lado.

## Después del deploy

- Q4 contra los pedidos reales de producción.
- Publicar el APK con `scripts/publicar-app.sh vX.Y.Z` y que **Diego lo instale**
  — hasta ahí la feature no está entregada.
- Confirmar con Diego que ve el comentario en un pedido de verdad.
