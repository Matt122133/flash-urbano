# Quickstart: El tablero de Diego

Lo que el `verify:` no puede ver. **El plan no está hecho hasta que esto se
corrió**, y lo que quede sin correr se anota en el tracker, no se tilda.

Contratos: [contracts/tablero.md](contracts/tablero.md). Invariantes del
cálculo: [data-model.md](data-model.md).

## Preparación

1. **Docker Desktop levantado.** Sin él no corren las pruebas de base, y el
   postgres nativo del 5432 **no** es una alternativa: es otra base.
2. Las pruebas de Go van contra **`flash-pg-test` (55432)**, nunca contra
   `flash-pg-dev` (55433). El arnés de pruebas borra usuarios.
3. `backend/.env` con **tu mail en `ADMIN_EMAILS`**, y el backend local con
   `backend/dev.sh`. Si ignora un cambio del `.env`, mirar quién tiene el 8080
   antes de tocar nada.
4. El sitio con `cd web && npm run dev`, después de mirar **quién tiene el
   3000**.
5. Dos cuentas a mano: la tuya (admin) y una común (otro mail, por código).

Para comparar contra la base, `psql` sobre la de desarrollo:

```bash
docker exec -it flash-pg-dev psql -U postgres -d flash_dev
```

## Q1 — El `verify:` con cero SKIP

```bash
cd backend && TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable' \
  go test ./... -p 1 -v 2>&1 | grep -c -- '--- SKIP'
```

**Esperado**: `0`. Con un número mayor, el verde no dice nada sobre la base
(`AGENTS.md`).

## Q2 — Las guardas se ponen en rojo (FR-014, SC-007)

Romper a propósito, de a uno, y revertir después de cada uno:

| Rotura | Guarda que tiene que ponerse en rojo |
|---|---|
| Agregar `, precio` al `SELECT` de `internal/tablero` | escaneo de fuentes de Go |
| `import _ ".../internal/pedidos"` en `internal/tablero` | la de imports |
| Un `<span>$ 150</span>` en `components/tablero/` | `web/lib/sin-precio-a-la-vista.test.ts` |
| Mover el componente a una carpeta fuera de `components/` | el control positivo de la misma guarda |
| El rótulo del total cambiado a "Pedidos históricos" | `web/lib/tablero.test.ts` (FR-004a) |

**Esperado**: las cinco en rojo, y verdes al revertir.

## Q3 — El total coincide con la base (US1, SC-002)

Entrar como admin, ir a **Tablero** desde la navegación.

```sql
SELECT count(*) FROM pedidos;
```

**Esperado**: el número de *Pedidos registrados* es exactamente ese. El rótulo
**no dice "histórico"** (FR-004a).

## Q4 — Los tres cortes coinciden con la base (US2, SC-002)

Cálculo independiente, en SQL, para comparar fila por fila:

```sql
-- mes; para semana cambiar 'month' por 'week' (lunes), para día por 'day'
SELECT date_trunc('month', creado_en AT TIME ZONE 'America/Montevideo')::date AS desde,
       count(*) AS pedidos, sum(cantidad) AS paquetes
FROM pedidos GROUP BY 1 ORDER BY 1 DESC;
```

**Esperado**, en los tres cortes:

- Cada período con pedidos tiene los mismos dos números que el SQL.
- Los períodos que el SQL no lista aparecen **en cero**, sin huecos, del actual
  al del primer pedido (D5).
- La primera fila es el período en curso.
- Las filas suman el total de Q3.
- La aclaración de que se corta por fecha de carga está a la vista (FR-006a).

## Q5 — Paquetes no es pedidos (SC-002a)

Si ningún período tiene un pedido de más de un paquete, cargar uno con
cantidad 3 desde el sitio.

**Esperado**: en ese período la columna *Paquetes* es **mayor** que *Pedidos*.

## Q6 — Las 22:00 de Montevideo (SC-006)

```sql
UPDATE pedidos SET creado_en = '2026-09-10 22:30:00-03'
WHERE codigo = (SELECT codigo FROM pedidos ORDER BY creado_en DESC LIMIT 1);
```

**Esperado**: en el corte por día, ese pedido cuenta el **jue 10 sep**, no el
11 (en UTC ya es el 11 a la 01:30).

## Q7 — El filtro por cliente (US3)

1. Elegir un cliente con pedidos. **Esperado**: total y filas bajan a los de esa
   cuenta; el SQL con `WHERE usuario_id = '…'` da lo mismo.
2. Con el corte en *Semana*, volver a "Todos los clientes". **Esperado**: sigue
   en *Semana* (FR-010), sin recargar.
3. Elegir la cuenta común, que no tiene pedidos. **Esperado**: ceros y el texto
   de FR-011, no una pantalla rota.
4. Homónimos: `UPDATE usuarios SET nombre = '<el mismo nombre que otra cuenta>'
   WHERE email = '<la cuenta común>';` y recargar. **Esperado**: las dos
   opciones se distinguen por el mail (US3-4).

## Q8 — Una baja hace bajar el número (SC-002b)

Con la cuenta común, cargar un pedido y darlo de baja desde *Mis pedidos*.
Recargar el tablero como admin.

**Esperado**: el total subió al cargarlo y **bajó al darlo de baja**, y la
pantalla no parece rota: la bajada del total ya dice que eso pasa.

## Q9 — Ni un peso (SC-003)

Recorrer los tres cortes, con y sin cliente, buscando `$` con Ctrl+F.

**Esperado**: ninguna coincidencia.

## Q10 — Una cuenta común no obtiene nada (SC-004, FR-001, FR-003)

1. Con la cuenta común, abrir `/tablero` a mano. **Esperado**: el texto
   genérico; en DevTools → Network, **ninguna** llamada a `/admin/tablero`.
2. La navegación **no** muestra *Tablero*, ni en escritorio ni en el menú móvil.
3. El camino que la pantalla usa, directo:

   ```bash
   curl -s -i -H "Authorization: Bearer <credencial de la cuenta común>" \
     http://localhost:8080/admin/tablero
   ```

   **Esperado**: `403` y `{"error":"no autorizado"}`. Ni un número, ni un mail.

## Q11 — Sin sesión (FR-002)

Salir y abrir `/tablero`. **Esperado**: el panel de ingreso ahí mismo. Entrar
como admin: la página pasa al tablero **sin navegar a otro lado**.

## Q12 — El servicio no contesta (FR-016)

Como admin, DevTools → Network → *Block request URL* con `*/admin/tablero`, y
recargar.

**Esperado**: el mensaje de error y *Reintentar*. **Ningún cero.** Desbloquear
y tocar *Reintentar*: aparece el tablero.

(Apagar el backend entero **no** prueba esto: sin `/yo` el proveedor no confirma
la sesión y la página cae en el estado sin sesión. Ya pasó en `024`, SC-006.)

## Q13 — Base vacía (SC-005, FR-015)

`flash-pg-dev` es descartable: recrearla, entrar como admin sin cargar nada.

**Esperado**: *Pedidos registrados* en `0`, una fila del período actual en cero,
y el texto de FR-015.

## Q14 — Angosto

La ventana a 360 px. **Esperado**: nada se corta ni se superpone; la tabla
cabe.

## Q15 — Producción (antes de mostrárselo a Diego)

1. **`ADMIN_EMAILS` en Railway incluye el mail de Diego**, no solo el tuyo
   (spec, *Dependencias*). Mirarlo, no suponerlo.
2. **Pedidos de prueba**: listarlos desde la consola del servicio `postgis` en
   Railway (`psql -U postgres -d railway`) y **decidir pedido por pedido** cuáles
   se borran. Uno pendiente se da de baja desde *Mis pedidos*. Uno que Diego ya
   movió tiene historial en `pedidos_estados` (`ON DELETE RESTRICT`) y no se
   borra sin borrar eso antes: es una decisión, no un paso mecánico.
3. Abrir `https://flashurbano.uy/tablero` como admin **desde el navegador**. Las
   pruebas de Go no ven el CORS, y un camino nuevo no está probado hasta que un
   navegador lo llamó (lección de `022`).
4. Comparar el total con `SELECT count(*) FROM pedidos;` en la consola de
   Railway.
