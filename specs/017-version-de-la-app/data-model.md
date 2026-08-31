# Data Model: Qué versión tiene el teléfono

**Feature**: `017-version-de-la-app` | **Fecha**: 2026-08-31

Un solo cambio de esquema: **dos columnas nullable en `sesiones`**. No hay tabla
nueva y no se toca ninguna otra tabla.

---

## Migración `0007_version_de_la_app.sql`

```sql
ALTER TABLE sesiones
    ADD COLUMN version_app       text,
    ADD COLUMN version_vista_en  timestamptz;
```

**Las dos son nullable, y tienen que serlo.** Toda sesión que exista antes de
esta migración nunca declaró una versión, y no hay ningún valor honesto que
inventarle: `NULL` significa *"esta sesión todavía no dijo qué versión usa"*, y
un `''` o un `'desconocida'` serían una afirmación falsa. Las sesiones del
**sitio web** también quedan en `NULL` para siempre, y eso es correcto: el
navegador no es la app y no tiene versión que declarar.

**Sin `DEFAULT`.** Un `DEFAULT` haría que una sesión recién creada afirme una
versión antes de que la app haya hablado.

**Sin índice.** La consulta que esto habilita —cuál es la versión de las
sesiones vivas— corre sobre una tabla con una fila por ingreso de un operador.
Un índice acá sería estructura para un problema que no existe.

### Por qué en `sesiones` y no en `usuarios`

Una sesión es un teléfono con una credencial; un usuario puede tener varias.
Poner la versión en `usuarios` obligaría a que dos sesiones del mismo mail se
pisen la una a la otra, y la respuesta a *"¿qué está corriendo?"* dependería de
cuál habló último sin dejar rastro de que eran dos.

### Qué pasa cuando la sesión se revoca

Nada especial. La fila sobrevive con `revocada_en` puesto —el procedimiento de
`docs/processes/app-repartidor.md` usa `UPDATE` y no `DELETE` justamente para no
borrar la evidencia— y con ella queda **qué versión estaba corriendo el teléfono
que se perdió**, que es información útil y no un problema.

---

## Campos

| Campo | Tipo | Nulo | Qué es |
|---|---|---|---|
| `version_app` | `text` | sí | Lo último que la app declaró, ya validado. Ej. `0.2.0`, o `0.2.0+3-gc3eb8fe` si fue un binario de trabajo. |
| `version_vista_en` | `timestamptz` | sí | Cuándo llegó esa declaración. Sin esto, una versión vieja no se distingue de un teléfono que dejó de usarse. |

### Validación antes de escribir

Lo que llega es texto de un cliente (research D6). Antes de guardarlo:

- Se recorta a un largo máximo acotado. Sin tope, un cliente cualquiera escribe
  lo que quiera en la base.
- Se descarta lo que no tenga forma de versión. Un valor descartado se trata
  como *no declarada*: se deja lo que había, no se escribe basura.
- **`NULL` o vacío no pisan lo anterior.** Es lo que protege el dato cuando la
  misma persona usa el sitio web con otra sesión, y lo que hace que un pedido
  sin cabecera no borre lo que la app ya había dicho (research D5).

---

## La consulta que este modelo existe para permitir

```sql
SELECT u.email, s.version_app, s.version_vista_en
FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
WHERE s.revocada_en IS NULL
  AND s.expira_en > now()
  AND s.version_app IS NOT NULL
ORDER BY s.version_vista_en DESC;
```

Es SC-006 vuelto una consulta: qué versión está en uso, sin preguntarle nada a
Diego. Va al runbook junto al procedimiento de cortar sesiones, que ya vive en
`docs/processes/app-repartidor.md` y ya explica cómo llegar a la consola de
Postgres de Railway.
