---
owner: flash-urbano
status: living
last_reviewed: 2026-09-30
update_trigger: on-color-change
---

# Colorear a mano una cuenta de cliente

Desde [`030-color-por-cliente`](../../specs/030-color-por-cliente/plan.md), cada
cuenta tiene un color, y la app de Diego lo dibuja como una franja en el borde
izquierdo de la tarjeta del pedido. Sirve para que dos clientes distintos no se
vean iguales de reojo. El nombre de quien envía sigue siendo lo que resuelve la
duda.

**Una cuenta nueva recibe su color sola**, al terminar de registrarse. Este
documento es para lo otro: **una cuenta que ya existía** y que tiene que tener
color. Hoy son **las tres cuentas reales** que había al desplegar `030`. Las
demás cuentas de ese momento son de prueba y quedan sin color a propósito.

**Ningún dato de clientes va en este repo, tampoco en este documento.** El repo
es público. El `id` y el correo de una cuenta se buscan en la sesión y se usan
en la sesión; no se copian a ningún archivo, commit ni PR.

## Qué color le toca

**El primero de `colores.Lista` que ninguna cuenta tenga**, en el orden de
[`backend/internal/colores/colores.go`](../../backend/internal/colores/colores.go).
Es lo mismo que haría el servicio, y hace que la asignación automática siga
desde el siguiente sin que nadie tenga que acordarse. Para las tres cuentas
reales son los tres primeros: fucsia, cian y lima, los tres tonos más distintos
entre sí.

Los colores ya tomados:

```sql
SELECT color FROM usuarios WHERE color IS NOT NULL ORDER BY color;
```

## El procedimiento

**Primero en staging, después en producción** (`AGENTS.md`). Cómo apuntar a
cada uno está en [`staging.md`](staging.md). La sesión de base es la misma que
usa *Borrar pedidos en producción*, en
[`railway-despliegue.md`](railway-despliegue.md), y valen las mismas notas:
**transacción explícita**, y comprobar desde otra conexión.

1. Buscar el `id` de la cuenta **en la sesión**, por su correo:

   ```sql
   SELECT id, perfil_completo, color FROM usuarios WHERE email = lower('<correo>');
   ```

   Tiene que devolver **una** fila, con `perfil_completo = true` y
   `color` vacío. Si ya tiene color, no hay nada que hacer: el color no se
   cambia (FR-005).

2. Asignar, en una transacción:

   ```sql
   BEGIN;
   UPDATE usuarios SET color = '<hex>' WHERE id = '<id>' AND color IS NULL;
   -- tiene que decir UPDATE 1
   SELECT count(*) FROM usuarios WHERE color = '<hex>';   -- tiene que dar 1
   COMMIT;   -- o ROLLBACK si algún número no es el esperado
   ```

   **La base protege dos errores**: un color repetido choca contra el índice
   único `usuarios_color_unico`, y un hex en mayúsculas o mal escrito choca
   contra el `CHECK` de formato (`#` y seis dígitos en minúscula). Si alguno
   salta, no es un problema del procedimiento: es la base impidiendo un dato
   que la app no podría usar bien.

3. **Comprobarlo donde importa**: abrir la app (emulador si es staging; el
   teléfono si es producción) y ver que **los pedidos que esa cuenta ya tenía**
   aparecen con la franja. El color es de la cuenta, no del pedido, así que los
   pedidos viejos también la muestran.

## Si hubiera que cambiar un color

No hay pantalla para hacerlo, y es a propósito: Diego aprende los colores, y un
color que cambia es peor que ninguno. Si hiciera falta de verdad (dos clientes
que en el teléfono se ven parecidos, por ejemplo), es el mismo `UPDATE` sin el
`AND color IS NULL`, con un color libre, y **hay que avisarle a Diego**.

## Si se agrega un color a la lista

Se agrega una línea a `colores.Lista`. La prueba del paquete rechaza el que no
cumpla las reglas (contraste sobre blanco, que no sea gris, y que no se parezca
al naranja, al azul, al rojo ni al verde de la app), con el motivo. No cambia
ningún color ya asignado, y **no hace falta publicar un APK**: la app recibe el
hex del servicio y lo dibuja.
