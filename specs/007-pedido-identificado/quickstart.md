# Quickstart: El pedido se crea identificado y se guarda

**Feature**: `007-pedido-identificado` | **Fecha**: 2026-08-12

Cómo comprobar que el feature funciona. Lo automático primero, y después lo que
sólo se ve a mano — que acá es la mitad importante, porque **la puerta y la
reanudación viven en un navegador y ninguna prueba de este repo renderiza
React**.

---

## Antes de empezar

Las pruebas de Go contra Postgres **se saltan solas sin `TEST_DATABASE_URL`**, y
entonces "todo verde" no dice nada sobre la base. Hace falta Postgres **con
PostGIS** — el pelado no sirve, `0001` hace `CREATE EXTENSION postgis`:

```bash
docker run -d --name flash-pg-test \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=flash_test \
  -p 55432:5432 postgis/postgis:17-3.5
```

**Contar los saltos, no confiar en el verde.** Si al final `go test` dice
`(cached)` o no reporta las pruebas de `pedidos`, la base nunca se tocó:

```bash
TEST_DATABASE_URL='postgres://postgres:test@localhost:55432/flash_test?sslmode=disable' \
  go test ./... -p 1 -v 2>&1 | grep -c SKIP     # tiene que dar 0
```

`-p 1` es obligatorio: las pruebas comparten una sola base y la de migraciones
la vacía entera.

---

## El `verify:` del plan

```bash
(cd backend && go vet ./... && go test ./... -p 1 && go build ./...) \
  && (cd web && npm run lint && npm test && npm run build)
```

Verde no alcanza para dar el feature por hecho: faltan las verificaciones
manuales de abajo. Verde **rojo** sí alcanza para saber que no lo está.

---

## Verificación automática

### La guarda de FR-001 sigue siendo verdad — y sigue midiendo algo

Es lo primero que hay que mirar en este feature, porque es lo que más fácil se
rompe:

```bash
cd web && npx vitest run lib/cotizar-abierto.test.ts
```

Tiene que pasar **sin haber cambiado `ENTRADAS` ni `PROHIBIDOS`**. Si para
ponerla en verde hubo que sacar `components/pedido-form.tsx` de las entradas, el
feature violó FR-004 y la prueba dejó de proteger nada.

**El control positivo nuevo** es igual de importante: afirma que
`components/pedido/crear-pedido.tsx` **sí** alcanza `lib/api.ts`. Sin él, borrar
el envío entero deja la guarda verde.

**La prueba fuerte, que hay que hacer una vez a mano**: agregar
`import { pedir } from "@/lib/api";` en `pedido-form.tsx`, correr la prueba, ver
que **falla**, y deshacerlo. Una guarda negativa que nadie vio fallar no está
demostrada.

### El resto

```bash
cd backend && go test ./internal/pedidos/... -p 1 -v
```

Lo que esas pruebas tienen que cubrir, y por qué cada una:

| Prueba | Qué demuestra |
|---|---|
| Crear un pedido y releerlo | FR-011, y que el punto sobrevive el viaje a PostGIS |
| Misma `Idempotency-Key` dos veces | FR-016: un pedido, y la segunda devuelve `200` con el mismo |
| **Dos pedidos idénticos con claves distintas** | **SC-005a — el control positivo.** Sin esto, "deja un solo pedido" lo satisface una implementación que descarta pedidos buenos |
| Sin `Idempotency-Key` | `400`, no un pedido creado en silencio |
| `POST /pedidos` sin credencial | `401` (FR-010, SC-004) |
| `GET /pedidos` con dos usuarios | Cada uno ve los suyos y sólo los suyos (FR-017) |
| `GET /admin/pedidos` como no-admin | `403` |
| Fecha de retiro de ayer | `400` |
| **Fecha de hoy a las 22:00 hora de Montevideo** | Que la validación use `America/Montevideo` y no la del proceso. Sin este caso, el bug aparece sólo de noche |
| Migrar desde vacío | SC-011, incluida `0003` |

---

## Verificación manual

Lo que ninguna prueba de este repo puede hacer. **Todo en un teléfono**, no
sólo en el escritorio: es donde el producto se usa y donde `006` predijo —y
encontró— los problemas.

### M1 — Cotizar sigue abierto, con el servicio apagado (SC-001)

Con el backend **detenido**, en una ventana privada:

1. Entrar a `/pedido`. Escribir calle y esquina.
2. Ver el punto en el mapa y el precio.

No puede aparecer ningún error, ni pedirse identificación en ningún momento.
Mirar la pestaña de red: **cero llamadas fallidas**. Si hay una en rojo, FR-001
está roto aunque la pantalla se vea bien.

### M2 — La puerta y la reanudación (SC-003)

Con el backend arriba, **sin sesión**:

1. Llenar el formulario **entero**. Arrastrar el pin dentro de la cuadra a una
   posición reconocible.
2. Tocar *Confirmar pedido* **una sola vez**.
3. Se abre el diálogo **sobre la misma pantalla** — la URL no cambia.
4. Ingresar con Google.
5. El diálogo se cierra, se ve que está enviando, y se aterriza en la
   confirmación con el código `FU-####`.

Lo que hay que comprobar además de que funcione:

- **No se volvió a escribir ni un campo.**
- **No se tocó confirmar dos veces.**
- El pin quedó donde se lo había arrastrado.

### M3 — El borrador no queda escrito en el navegador (SC-003a)

Inmediatamente después de M2, en la consola:

```js
Object.keys(localStorage); Object.keys(sessionStorage);
```

No puede aparecer el borrador del formulario. En particular, **el nombre y el
teléfono de quien recibe** — un tercero que no consintió nada — no pueden quedar
escritos en el disco de un teléfono que puede ser compartido. Es FR-006a, y es
la razón por la que se eligió el diálogo.

### M4 — Desistir no crea nada (FR-008)

Llenar el formulario, tocar confirmar, **cerrar el diálogo sin ingresar**.

- Lo cargado sigue ahí.
- Se puede seguir cotizando.
- **`GET /admin/pedidos` no muestra ningún pedido nuevo.** Que la pantalla no
  diga nada no prueba que no se creó.

### M5 — La precarga, y que no pise lo tipeado (SC-006, SC-007)

Con un perfil que tenga dirección de retiro guardada:

1. Abrir `/pedido`: nombre, teléfono y dirección vienen cargados, con el punto en
   el mapa. Contar los campos que hay que escribir: **cero** para esos tres.
2. Cargar el pedido y confirmar.
3. Entrar a `/perfil`: **no cambió nada**.

Y la otra dirección, que es la que se rompe:

4. **Sin sesión**, escribir en el formulario una dirección **distinta** de la
   guardada, confirmar, e ingresar desde el diálogo.
5. El pedido sale con **la que se escribió**. Si la precarga pisó lo tipeado al
   identificarse, FR-007 está roto — y es el caso que sólo existe desde que la
   puerta está a mitad de formulario.

### M6 — El copy (SC-012)

Leer `/pedido` entera y la pantalla de confirmación, texto por texto:

- No dice que se puede pedir como invitado (FR-027).
- No dice que hay que marcar el punto en el mapa (FR-028).
- **No promete un contacto que nadie va a hacer** (FR-029). Ésta es la que se
  olvida: la frase *"Nos pondremos en contacto para confirmar el retiro"* está
  viva en producción hoy y el feature no está hecho mientras siga ahí.

### M7 — El servicio caído al confirmar (SC-013)

Con sesión iniciada y el formulario lleno, **detener el backend** y confirmar:

- El mensaje dice que el pedido **no** se creó.
- Lo cargado sigue en pantalla.
- Al levantar el servicio, confirmar de nuevo funciona y deja **un** pedido.

### M8 — Fuera de zona (SC-009)

Un punto de retiro fuera de las cinco zonas: no hay precio, no se puede
confirmar, y se deriva a contacto directo. Igual que hoy al cotizar.

### M9 — El `.gitignore` (SC-014)

```bash
git check-ignore -v backend/.env backend/.env.local
git check-ignore -v backend/.env.example   # NO tiene que estar ignorado
```

La primera linea tiene que responder que las dos rutas estan ignoradas, **y por
que regla**: la salida nombra el archivo y el numero de linea, asi que se ve si
la proteccion viene del `.gitignore` de la RAIZ —lo que queremos, porque vale en
todas las ramas— o del de `backend/`. La segunda tiene que salir vacia (codigo
1): `.env.example` esta versionado a proposito, es la documentacion de que
variables hacen falta.

> **NO crear un `backend/.env` de prueba para comprobar esto.** La version
> anterior de este paso decia `printf 'SECRETO=x' > backend/.env`, y **eso pisa
> el `.env` real de quien lo corra** — un archivo que no esta en git y que por lo
> tanto no se puede recuperar.
>
> Paso de verdad el 2026-08-12: el agente siguio este mismo paso y destruyo el
> `.env` local, con la clave de Resend adentro. Reconstruir el resto fue posible
> —el Client ID estaba en `web/.env.local`, la base y el remitente en la
> documentacion— pero la clave hubo que sacarla de nuevo del panel.
>
> `git check-ignore` responde exactamente la misma pregunta sin escribir nada.

Si igual se quiere la prueba de punta a punta —que un `git add -A` no lo
levante— hay que hacerla con un nombre que **no exista**, por ejemplo
`backend/.env.prueba`, que cae bajo el mismo patron `.env.*`.

---

## Lo que queda sin verificar, y hay que decirlo

- **Que Diego se entere de un pedido.** No se verifica porque no se construyó:
  el aviso vive en la app Android. Mientras tanto los pedidos se leen con
  `GET /admin/pedidos`. Está declarado en el spec como *el hueco que deja el
  diferimiento*.
- **Que el punto guardado siga siendo el correcto meses después.** La
  revalidación contra la cuadra corre en el navegador (research D7), pero nada
  detecta que una regeneración del índice de calles movió las esquinas. Sigue
  necesitando el fixture de esquinas confirmadas a mano que pide SC-002 de `003`
  desde el 2026-08-04.
- **La reanudación en Safari de iPhone**, más allá de M2. `006` encontró que el
  modo de falla predecible es que un navegador se comporte distinto. Correr M2
  entero en Safari además de en Chrome de Android.
