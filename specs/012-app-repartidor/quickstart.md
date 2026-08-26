# Quickstart: La app de Diego

**Feature**: `012-app-repartidor` | **Fecha**: 2026-08-23

**Este archivo es la verificación de `012`.** El `verify:` compila las tres
superficies y corre lo que se puede probar sin dispositivo; **no prueba que la
app se pueda usar**. Eso es lo de abajo.

Y acá hay **dos niveles**, cosa que no pasaba en los features anteriores:

1. **En el emulador** — se maneja desde la sesión con `adb`, así que el agente
   puede llegar hasta acá solo.
2. **En el teléfono de Diego** — no lo reemplaza nada. Es donde se descubre que
   un botón no se alcanza con el pulgar o que la lista no se lee al sol.

---

## Antes de empezar

### El dato que hay que conseguir primero

**¿Qué versión de Android tiene el teléfono de Diego?** (Ajustes → Acerca del
teléfono.) El APK exige **8.0 o superior**. Si fuera anterior, no instala, y
enterarse con él esperando es la peor forma de saberlo.

### Levantar el servicio

```bash
cd backend && ./dev.sh
```

El emulador ve la máquina como **`10.0.2.2`**, no como `localhost`. La
compilación de depuración ya apunta ahí.

### La base

La migración `0005` agrega la tabla del historial. Entra sobre una base con
datos sin problema — **a diferencia de `0004`, no exige nada** (research D9).

---

## El `verify:` del plan

```bash
cd web && npm run lint && npm test && npm run build && cd ../backend && go vet ./... && go test ./... && cd ../android && .\gradlew.bat assembleDebug testDebugUnitTest
```

**Las tres mitades.** Dos trampas conocidas:

- **Las pruebas de Go contra Postgres se saltean solas sin `TEST_DATABASE_URL`**
  y el verde no significa nada. Ver `docs/processes/harness.md`.
- **La primera corrida de Gradle descarga dependencias** y tarda varios minutos.
  Eso no es que esté colgado.
- **`.\gradlew.bat`, y ni `./gradlew` ni `gradlew.bat` a secas**, aunque todos los
  tutoriales digan lo primero: el harness corre el `verify:` con `shell=True`, o sea **`cmd.exe`**, y
  ahí `./` no es sintaxis válida. Es el mismo tropiezo que rompió el gate el
  2026-08-22 con los paréntesis; ver `docs/processes/harness.md`.

---

## Verificación en el emulador

Los pasos ⚠ producen el caso malo a propósito.

### E1 — La app se instala y muestra los pedidos (US1)

1. Crear dos o tres pedidos desde la web local.
2. Instalar y abrir la app en el emulador.
3. Ingresar con el mail de administración, una vez.

- Se ven los pedidos, con **código, las dos direcciones, tamaño y los dos
  teléfonos** (FR-015).
- Están agrupados en **Pendientes** y **Tomados**.

### E2 — ⚠ Un pedido sin puntos no rompe nada (FR-002)

Crear un pedido con un retiro que **no resuelva** —una calle inventada— y otro
con una calle **homónima** (Valencia × Zaragoza sirve).

- Los dos aparecen en la app, con su dirección escrita.
- **Ninguno rompe la pantalla.**

Y el caso del pedido anterior a `011`, que hay que fabricar a mano porque ya no
se puede crear:

```sql
UPDATE pedidos SET entrega_punto = NULL WHERE codigo = 'FU-00XX';
```

### E3 — Mover un pedido, y que se vea en la web (US2, SC-002)

1. En la app, tocar *Ya lo tengo* en un pedido pendiente → pasa a **Tomados**.
2. Tocar *Entregado* → sale de la pantalla principal.
3. **Abrir *Mis pedidos* en la web con la cuenta que lo creó**: dice
   **Entregado**, no "Pendiente".

**Este paso es el feature entero.** Es la primera vez que las dos superficies se
hablan.

### E4 — El historial queda escrito (FR-014)

```sql
SELECT p.codigo, e.estado, e.ocurrido_en
FROM pedidos_estados e JOIN pedidos p ON p.id = e.pedido_id
ORDER BY e.ocurrido_en;
```

- Hay una fila por cada toque.
- **No hay pantalla que lo muestre**, y está bien: es a propósito.

### E5 — ⚠ Deshacer (FR-004)

Revertir un pedido entregado.

- Vuelve a **Tomados**.
- En el historial quedan **las dos** filas: la entrega y la vuelta. El estado
  actual no borra lo que pasó.

### E6 — ⚠ Tocar dos veces (FR-009)

Tocar *Entregado* dos veces seguidas.

- El pedido queda entregado, una sola vez.
- **El historial NO tiene dos filas iguales.**

### E7 — ⚠ Sin señal (FR-008)

Poner el emulador en modo avión (`adb shell svc data disable` o desde los
ajustes).

- **Al abrir**: dice que no pudo traer los pedidos y ofrece reintentar. **No
  muestra una lista vacía** como si no hubiera trabajo.
- **Al mover un pedido**: dice que no pudo, y **el pedido queda donde estaba**.
  Nunca se ve el cambio como hecho.
- Al volver la señal, reintentar funciona.

### E8 — ⚠ Sin ingreso no se ve nada (FR-006, SC-006)

Con la app cerrada, desde la máquina:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/admin/pedidos
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:8080/admin/pedidos/<id>/estado -d '{"estado":"entrega"}'
```

**Los dos tienen que rechazar.** Si alguno contesta con datos, el feature
publicó el nombre, la dirección y el teléfono de todos los destinatarios.

### E9 — La sesión no se cae sola (US3, FR-007)

Difícil de probar en minutos, así que se comprueba en la base:

```sql
SELECT expira_en FROM sesiones ORDER BY creado_en DESC LIMIT 1;
```

Usar la app, esperar, volver a usarla: **`expira_en` tiene que haberse movido
hacia adelante** en algún momento, no quedarse fijo.

---

## Verificación en el teléfono de Diego

**Nada de lo anterior reemplaza esto**, y es donde aparecen los defectos que
importan.

### T1 — Instala y anda

El APK se pasa por el medio que sea y se instala. **Requiere habilitar
"instalar aplicaciones desconocidas"** en el teléfono, una vez.

### T2 — Se usa con una mano

Con el teléfono en una mano, como estaría con un paquete en la otra:

- ¿Se llega al botón con el pulgar?
- ¿Se distingue *Ya lo tengo* de *Entregado* sin leer con atención?
- ¿Se puede tocar sin abrir el pedido equivocado?

### T3 — Se lee afuera

Salir a la calle con el teléfono. **Con sol de frente, ¿se lee?**

### T4 — Un pedido de verdad, de punta a punta

Que Diego haga un envío real con la app: lo toma cuando lo levanta, lo marca
cuando lo entrega. Y que la persona que lo envió mire *Mis pedidos*.

**Esto cierra algo que está pendiente desde el 2026-08-11**: ver un pedido real
contra producción.

---

## Antes de dar el plan por cerrado

- [ ] `verify:` verde en las **tres** superficies, con `TEST_DATABASE_URL` puesto.
- [ ] E1 a E9 en el emulador, con los cinco ⚠ hechos de verdad.
- [ ] T1 a T4 **en el teléfono de Diego**.
- [ ] El procedimiento para cortarle la sesión a un teléfono perdido, escrito en
      el repo (FR-016).
- [ ] Cómo se genera el APK, escrito en el repo (FR-011).
