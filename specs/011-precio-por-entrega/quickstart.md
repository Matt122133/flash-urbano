# Quickstart: El precio sale de la entrega

**Feature**: `011-precio-por-entrega` | **Fecha**: 2026-08-22

**Este archivo es la verificación de `011`.** Como en `010`, el `verify:` del
plan no ejercita las pantallas: prueba que compila, que el lint pasa y que lo
puro de `lib/` hace lo que dice. Lo que prueba el feature es lo de abajo,
ejecutado por una persona **en un teléfono**.

`011` arrastra además **tres pasos que `010` dejó sin correr** — M2, M3 y M4 de
su quickstart — porque no dependen de qué punto decide el precio y siguen sin
verificarse. Están abajo como H1, H2 y H3.

---

## Antes de empezar

### Levantar todo

```bash
cd backend && ./dev.sh          # base + servicio
cd web && npm run dev           # sólo para escritorio
```

Para el teléfono no alcanza `npm run dev`: ver
[`docs/processes/dev-setup.md`](../../docs/processes/dev-setup.md). La IP de la
LAN **cambia** (es DHCP): confirmarla antes de construir, porque queda embebida
en el bundle.

### La base local se vacía, y es parte del procedimiento

La migración `0004` agrega `entrega_punto` **`NOT NULL` sin default**, así que
**va a fallar** contra la base local con sus pedidos de prueba. Eso es correcto
(research D5). Antes de migrar:

```bash
docker exec flash-pg-dev psql -U postgres -d flash_dev -c "TRUNCATE pedidos;"
```

**No hay nada que rescatar**: los pedidos viejos tienen precio calculado con la
regla vieja. Conservarlos sería conservar precios que ya no significan nada.

### Los datos que hacen falta

Con **una** cuenta alcanza para casi todo; H3 necesita dos.

- Una dirección de entrega en **zona 1** ($150) y otra en **zona 5** ($350), para
  poder ver que el precio cambia con el destino y no con el origen.
- Una dirección de retiro sobre una **calle homónima** (D2), y otra con una calle
  **que no exista en el índice** (D6 del quickstart, M5 acá).

---

## El `verify:` del plan

```bash
(cd web && npm run lint && npm test && npm run build) && (cd backend && go vet ./... && go test ./...)
```

Los paréntesis no son adorno: sin ellos el `cd` se acumula y correrlo dos veces
en la misma terminal falla por una razón que no tiene nada que ver con el código.

**Las dos mitades**, porque este feature toca las dos superficies. Y ojo con la
trampa que `backend/README.md` documenta: **las pruebas que necesitan Postgres se
saltean solas sin `TEST_DATABASE_URL`**, así que "todo verde" no dice nada sobre
la migración a menos que se haya mirado el conteo de skips.

### La guarda que no se toca

```bash
cd web && npx vitest run lib/cotizar-abierto.test.ts
```

Tiene que pasar **sin haber tocado `ENTRADAS` ni `PROHIBIDOS`** (research D8). Si
se puso en rojo, el defecto está en el cambio.

---

## Verificación manual

Los pasos ⚠ producen el caso malo a propósito.

### M1 — El precio sale del destino (US1, SC-001)

1. Retiro en **zona 1**, entrega en **zona 5** → el precio es **$350**.
2. Invertir las dos direcciones → el precio es **$150**.

**Es el feature entero en dos pasos.** Antes de `011` los dos casos daban lo
mismo, y ese "lo mismo" era el precio equivocado en uno de los dos.

**Y el conteo, que es lo que verifica SC-005**: anotar cuántos campos y cuántos
toques cuesta llegar del formulario vacío al precio, **antes y después** del
cambio. Tiene que dar igual o menos. Lo que se resolvió en una dirección se dejó
de resolver en la otra, así que si el número subió, algo quedó pedido dos veces.

### M2 — El retiro perdió el mapa y no perdió el punto (FR-003, FR-012)

- La sección de retiro **no muestra mapa**, y no pide elegir nada.
- Después de confirmar, en la base: el pedido tiene `retiro_punto` con
  coordenadas, sin que nadie las haya marcado.

```sql
SELECT codigo, retiro_punto IS NULL AS sin_punto_retiro,
       ST_Y(entrega_punto::geometry) AS lat_entrega
FROM pedidos ORDER BY creado_en DESC LIMIT 3;
```

### M3 — ⚠ Cotizar sin cuenta y con el servicio apagado (FR-004, SC-002)

Cerrar sesión, **detener el backend**, entrar a `/pedido`, completar **sólo la
entrega**.

- Aparece el precio.
- **No hizo falta tocar el retiro para verlo** (FR-002a).

Si esto falla, se rompió la cotización pública y es lo más grave que este feature
puede romper.

### M4 — ⚠ Entrega fuera de toda zona (FR-005)

Una entrega que resuelve a un punto fuera de las cinco zonas.

- **No hay precio, no se puede confirmar**, encamina al contacto directo.
- **No aparece** ninguna zona "más cercana" ni un precio aproximado.

### M5 — ⚠ El retiro que no resuelve pasa en silencio (FR-015)

Escribir un retiro con una calle que no está en el índice, y confirmar.

- **El pedido se crea.** No hubo aviso, ni advertencia, ni nada distinto.
- En la base, `retiro_punto IS NULL` para ese pedido.

Esto es lo que se decidió el 2026-08-22 y es deliberadamente provisorio: la
consulta de arriba es la que lo hace visible cuando Diego pregunte.

### M6 — ⚠ El retiro homónimo no pregunta (research D2)

Un retiro sobre una calle con homónimas en otro barrio.

- **No aparece ninguna lista de candidatos** en la sección de retiro.
- El pedido se crea, con `retiro_punto IS NULL`.
- **La entrega, en cambio, sí muestra los candidatos** cuando su calle es
  homónima, y no toma el primero.

Los dos comportamientos en la misma pantalla, y son distintos a propósito.

### M7 — El retiro fuera del área sí frena (FR-011)

Un retiro que **resuelve** a un punto fuera de las cinco zonas.

- Avisa y **no deja confirmar**.
- Contrastar con M5: ahí no resolvía y pasaba. **Esa diferencia es la que hace
  que FR-011 sea de mejor esfuerzo**, y verla es entender la decisión.

### M8 — Mi cuenta conserva su mapa (FR-016, FR-017)

- *Mi cuenta* → *Mis datos* sigue teniendo mapa y punto ajustable.
- Crear un pedido con el retiro precargado del perfil: el `retiro_punto` guardado
  es **el que se marcó a mano**, no uno deducido.
- ⚠ Un punto guardado que ya no cae en su cuadra **se usa igual y no avisa**
  (FR-017). Antes de `011` se descartaba con un aviso; si ese aviso todavía
  aparece, quedó viva una guarda que dejó de tener sentido.

### M9 — Repetir, en sus cuatro casos (FR-008, FR-013)

La tabla del [contrato](contracts/formulario-y-pedido.md) §4, entera:

1. Pedido con punto de entrega, zona resuelve → precio de hoy, aviso si cambió.
2. Pedido con punto de entrega, zona ya no resuelve → sin precio, sin confirmar.
3. ⚠ **Pedido anterior a `011`** (sin `entrega_punto`) → precarga todo lo demás,
   la entrega queda por completar, con un aviso que lo explique. **Nunca una
   pantalla rota.** Para producir este caso hace falta una fila insertada a mano
   con `entrega_punto` nulo, porque la columna no lo admite: es la única forma de
   probar FR-013 y **hay que hacerla**, no saltearla por incómoda.
4. Pedido sin punto de retiro → precarga como texto, sin avisar nada.

### M10 — Sin `?repetir=` no cambió nada

`/pedido` normal, con y sin sesión, con dirección guardada en el perfil: todo
como antes de `011`, salvo de dónde sale el precio.

---

## Lo que `010` dejó sin correr y se paga acá

### H1 — Teclado y lector de pantalla (era M2 de `010`)

Llegar a una tarjeta del historial con `Tab`, abrirla con `Enter` o `Espacio`,
cerrarla igual; y lo mismo con el conmutador *Mis datos* / *Mis pedidos*. El foco
visible en todo momento, y el cambio de estado anunciado.

### H2 — Los tres estados que no son una lista (era M3 de `010`)

Sin pedidos, sin sesión, y ⚠ con el servicio caído y su botón de reintentar.

### H3 — ⚠ Nadie ve lo ajeno (era M4 de `010`, **SC-004 de `010`**)

Con dos cuentas: que B no vea los pedidos de A, y que abrir `/pedido?repetir=<id
de B>` desde A diga que no encontró el pedido, con el formulario **vacío y
usable**. **Es la única de las tres que cubre un agujero de seguridad**, y sigue
sin verificarse desde que se construyó.

> **Ojo con el número**: `SC-004` quiere decir dos cosas distintas según el
> feature. En `010` es *nadie ve lo ajeno*; en `011` es *repetir termina en un
> precio correcto o en un aviso claro*, y ése se verifica en M9. Citarlos siempre
> con su feature adelante.

---

## Antes de dar el plan por cerrado

- [ ] `verify:` verde en **las dos** superficies, con el conteo de skips mirado.
- [ ] M1 a M10 hechos **en un teléfono**, con el conteo de pasos de M1 anotado.
- [ ] H1, H2 y H3 hechos — la deuda de `010`.
- [ ] Los seis pasos ⚠ hechos de verdad.
- [ ] `git status` limpio de `web/lib/zonas.ts`.
- [ ] La deuda del retiro sin punto sigue anotada, y **con un número**: cuántos
      pedidos de prueba quedaron con `retiro_punto IS NULL`.
