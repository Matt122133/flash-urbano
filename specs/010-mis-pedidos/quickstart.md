# Quickstart: Mis pedidos — el historial y el botón de repetir

**Feature**: `010-mis-pedidos` | **Fecha**: 2026-08-22

**Este archivo es la verificación de `010`, no un complemento de ella.** Se
decidió el 2026-08-22 no montar entorno de pruebas de interfaz, y este feature es
interfaz de punta a punta: el `verify:` del plan **no ejercita ni una línea de
las pantallas nuevas**. Lo que las prueba es lo de abajo, ejecutado por una
persona.

Los pasos están escritos para producir **el caso malo a propósito**, no para
recorrer el camino feliz. Un quickstart que sólo abre la pantalla y ve que hay
algo no verifica nada de lo que este feature promete.

---

## Antes de empezar

### Lo que hay que tener corriendo

El servicio, con la base local (ver [`backend/README.md`](../../backend/README.md)
— `go run ./cmd/api` a secas **no arranca**: faltan las variables obligatorias):

```bash
cd backend && go run ./cmd/api
```

El sitio, apuntando a ese servicio:

```bash
cd web && npm run dev
```

**Para probar desde el teléfono no alcanza con `npm run dev`** — Next bloquea los
assets cross-origin y la página no hidrata, entre otras tres trampas. Los pasos
están en [`docs/processes/dev-setup.md`](../../docs/processes/dev-setup.md).
Léelo antes, no después de perder una hora.

### Los datos que hacen falta

Con **dos cuentas distintas** (dos direcciones de mail sirven; el ingreso por
código no necesita Google):

- **Cuenta A**: crear **tres** pedidos, con direcciones de entrega distintas para
  poder distinguirlos de un vistazo. Que al menos uno tenga apartamento y
  cooperativa marcada, y otro no tenga número: son los campos nulables, y son los
  que rompen un detalle mal armado.
- **Cuenta B**: crear **un** pedido, y anotar su `id`. El `id` no se ve en la
  pantalla; sale de la consola:

```js
// con la sesión de B abierta, en la consola del navegador
const { credencial } = JSON.parse(localStorage.getItem("flashurbano.sesion"));
const r = await fetch("http://localhost:8080/pedidos", {
  headers: { Authorization: `Bearer ${credencial}` },
});
console.table((await r.json()).pedidos.map(({ codigo, id }) => ({ codigo, id })));
```

> La clave `flashurbano.sesion` sale de `web/lib/sesion.ts`; el puerto, de `PORT`
> del servicio (`8080` por defecto).
> **Un agente no puede hacer este paso**: `sesiones.token_hash` guarda el hash, así
> que la credencial sólo existe en el navegador. Ver
> [`docs/processes/dev-setup.md`](../../docs/processes/dev-setup.md).

---

## El `verify:` del plan

```bash
cd web && npm run lint && npm test && npm run build
```

**No incluye el backend a propósito**: `010` no toca `backend/`. Si en algún
momento aparece un cambio ahí, el `verify:` de este plan quedó corto y hay que
frenar.

**Qué significa verde**: compila, pasa el lint, `web/lib/repetir.ts` hace lo que
dice, y no se rompió nada de lo que ya se probaba. **Qué no significa**: que el
historial se vea, que la tarjeta despliegue, o que repetir precargue algo.

### La guarda que más fácil se rompe

```bash
cd web && npx vitest run lib/cotizar-abierto.test.ts
```

Tiene que pasar **sin haber tocado `ENTRADAS` ni `PROHIBIDOS`**. `010` no debería
editar `web/components/pedido-form.tsx`; si esta prueba se puso en rojo y se
"arregló" sacando ese archivo de las entradas, se rompió FR-022 y el sitio quedó
con el precio dependiendo de que el servicio conteste.

---

## Verificación manual

Todo esto **en un teléfono**, no sólo en el escritorio (Principio IV). Los pasos
marcados con ⚠ son los que producen un caso malo a propósito: si se saltean, el
requisito que verifican queda sin nada detrás.

### M1 — El historial existe y dice la verdad (US1-1, US1-2)

Con la cuenta A, entrar a *Mi cuenta*.

- Aparecen los **tres** pedidos, **el más reciente arriba**.
- Cada tarjeta muestra código, fecha de **retiro** (no la de creación), estado,
  precio y a dónde iba.
- Los códigos coinciden con los que se vieron al confirmar cada pedido. **Este
  es el agujero que `007` dejó anotado**: si el código de la tarjeta no es el que
  la persona vio, el feature no sirvió para lo que existe.
- Todos dicen **"Pendiente"**. Es lo correcto hoy: nada mueve esa columna hasta
  que exista la app Android. Si alguno dice "Recibido", "En camino" o cualquier
  cosa que afirme una acción de Diego, **eso es FR-006 roto**.

Desplegar uno (US1-2): dirección de retiro completa, entrega completa, tamaño y
cantidad, nombre y teléfono de quien recibe, y cuándo se cargó.

- El que tiene **apartamento y cooperativa** los muestra.
- El que **no tiene número** no muestra un hueco raro, ni "null", ni "undefined".

### M2 — Se opera sin tocar la pantalla (FR-011a)

Sin usar el mouse ni el dedo: llegar a una tarjeta con `Tab`, abrirla con
`Enter` o `Espacio`, cerrarla igual.

- El foco se ve en todo momento.
- Con un lector de pantalla (VoiceOver en el iPhone, TalkBack en Android), al
  abrir y cerrar **se anuncia el cambio de estado**.

Si esto no funciona, quien ya podía pedir en este sitio no puede usar la pantalla
nueva — que es exactamente lo que `003` evitó cuando hizo el combobox accesible a
mano.

### M3 — Los tres estados que no son una lista (US1-3, US1-4, US1-5)

- **Sin pedidos**: con una cuenta recién creada, la sección dice que todavía no
  hay ninguno y ofrece crear el primero. No una lista vacía sin explicación.
- **Sin sesión**: salir y entrar a `/perfil`. Se ve lo de siempre —la invitación
  a ingresar— y **ni rastro** del historial: ni la sección, ni un esqueleto
  cargando, ni un error.
- ⚠ **Servicio caído**: con sesión iniciada, **detener el backend** y recargar
  `/perfil`. La sección dice que no pudo cargar los pedidos y ofrece reintentar.
  **El resto de Mi cuenta no se rompe.** Levantar el backend, tocar reintentar,
  y la lista aparece sin recargar la página.

### M4 — ⚠ Nadie ve lo ajeno (US1-6, SC-004)

Es una guarda negativa y **sin prueba automática no hay control positivo
posible**: lo más parecido es forzar el caso.

1. Con la cuenta B abierta, comprobar que ve **su** pedido y **ninguno** de A.
2. Con la cuenta A, abrir a mano `/pedido?repetir=<id del pedido de B>`.
   - La pantalla dice que **no encontró ese pedido**.
   - El formulario queda **vacío y usable**, no a medio cargar.
   - **Ni un dato de B aparece en ningún lado.** Mirar también la pestaña de red:
     la respuesta de `GET /pedidos` no puede contener el pedido de B.

Si esto último fallara, el problema no está en `010` sino en el servicio, y es
grave: `GET /pedidos` sale de la credencial y no acepta filtro que lo esquive.

### M5 — Repetir precarga todo, y sólo deja el cuándo (US2-1, FR-014)

Con la cuenta A: desplegar un pedido y tocar *Repetir*.

- Se llega al formulario con **remitente, retiro, entrega, paquete, cantidad y
  destinatario** ya cargados, **tal como se guardaron**.
- **Fecha y hora de retiro vacías**, y sin ninguna propuesta por defecto.
- El punto está en el mapa, en la cuadra que corresponde.
- Se ve un precio.

⚠ **Y ahora lo que ninguna prueba de este repo puede ver** (research D2): la
pantalla **no puede parpadear ni montar el formulario dos veces**. El defecto del
2026-08-14 fue exactamente eso y borraba lo tipeado. Para verlo:

1. Recargar `/pedido?repetir=<id>`.
2. Apenas aparezca el formulario, **escribir algo en un campo cualquiera**.
3. Esperar cinco segundos sin tocar nada.
4. Lo escrito **sigue ahí**. Si desapareció o se pisó con el valor precargado, el
   formulario se montó dos veces y hay que frenar.

### M6 — Repetir es repetir, pero se puede cambiar (US2-1a, FR-013a)

Sobre el formulario precargado:

1. Cambiar el **teléfono de contacto** por otro.
2. Completar fecha y hora, confirmar.
3. El pedido creado tiene **el teléfono nuevo**, no el del pedido original.

Comprobarlo en el historial: aparece un pedido nuevo, con **código distinto**, y
el original **sigue ahí intacto** (US2-3).

### M7 — ⚠ El precio de hoy, y el aviso de reajuste (US2-2, 2a, 2b, SC-003)

Este es el paso que verifica que el precio no miente, y **hay que provocarlo**.

1. Repetir un pedido y **no confirmar**. Anotar el precio que muestra.
2. Detener `npm run dev`. En `web/lib/zonas.ts`, **cambiar a mano el `precio` de
   la zona de ese pedido** (por ejemplo 150 → 190).
3. Levantar `npm run dev` y volver a `/pedido?repetir=<id>`.
   - El precio que se ve es **el nuevo**.
   - Aparece el **aviso de reajuste** junto al precio.
   - ⚠ **El aviso no dice cuánto salía antes**, y **los dos precios no están
     juntos en pantalla** (FR-015b). Si aparece "antes pagaste $150", está mal:
     esa fue la propuesta que se descartó.
4. Bajar el precio en vez de subirlo (150 → 120) y repetir el paso: **el aviso es
   el mismo**. Si sólo avisa cuando sube, está mal (FR-015c).
5. **Deshacer el cambio de `zonas.ts`.** Es un archivo **generado** y no se
   commitea a mano nunca: `git checkout web/lib/zonas.ts`.
6. Con el precio ya restaurado, repetir el mismo pedido: **no aparece ningún
   aviso** (US2-2b).

> `zonas.ts` se toca sólo en el árbol de trabajo y se revierte. Si este cambio
> llega a un commit, el precio que se le cobra a la gente sale mal.

### M8 — ⚠ El punto que ya no cae en ninguna zona (US2-4, FR-016)

Mismo truco, al revés:

1. En `web/lib/zonas.ts`, mover o vaciar el polígono de la zona del pedido para
   que el punto guardado **no caiga en ninguna**.
2. Repetir ese pedido.
   - La pantalla **lo dice**.
   - **No muestra precio.**
   - **No deja confirmar.**
   - Encamina al contacto directo.
   - **Nunca** aparece la zona más cercana ni un precio "aproximado". Eso sería
     adivinar una zona, que es adivinar un precio (Principio V).
3. `git checkout web/lib/zonas.ts`.

### M9 — La sesión vencida no pierde lo precargado (US2-5)

1. Abrir `/pedido?repetir=<id>` y esperar a que precargue.
2. En la consola, borrar la credencial: `localStorage.clear()`.
3. Completar fecha y hora y tocar *Confirmar*.
   - Se abre el **diálogo de ingreso sobre la misma pantalla** — la URL no
     cambia.
   - Al ingresar, **el envío se reanuda solo**.
   - **No se volvió a escribir ni un campo.**

### M10 — Dos repeticiones deliberadas son dos pedidos (US2-6, FR-019)

Repetir el mismo pedido dos veces, confirmando las dos.

- Se crean **dos** pedidos, con **códigos distintos**.
- Los dos aparecen en el historial.

Esto es el control positivo de la idempotencia: si "no se duplica" se cumpliera
descartando el segundo, la persona se quedaría sin un paquete que quiso mandar.

### M11 — ⚠ El pedido no queda escrito en el disco (FR-021)

Inmediatamente después de M6, en la consola:

```js
Object.keys(localStorage); Object.keys(sessionStorage);
```

Lo único que puede haber es la credencial de sesión. **El nombre y el teléfono de
quien recibe no pueden aparecer**: es dato de un tercero que no consintió nada, y
es la razón por la que la repetición viaja como un uuid en la URL y no como un
borrador guardado.

### M12 — Recargar y compartir la URL (contrato §1)

Con `/pedido?repetir=<id>` abierto: recargar con F5. Todo se precarga igual.
Copiar la URL a otra pestaña de la misma sesión: igual. **Nada se rompe al
recargar** — es lo que decidió que la repetición viaje por la URL y no por
memoria.

### M13 — Sin `?repetir=` no cambió nada

Entrar a `/pedido` normal, con sesión y con dirección guardada en el perfil.

- La precarga del **perfil** funciona como antes de `010`.
- Entrar sin sesión: se puede cotizar sin que nada pida identificarse.

Es la comprobación de que este feature no rompió `007`.

---

## Antes de dar el plan por cerrado

- [ ] `verify:` verde.
- [ ] M1 a M13 hechos **en un teléfono**, no sólo en el escritorio.
- [ ] Los cinco pasos ⚠ hechos de verdad, no salteados por parecer engorrosos.
- [ ] `git status` limpio de `web/lib/zonas.ts` — sin el precio de prueba adentro.
- [ ] La deuda del paginado anotada **con el umbral en números** (FR-024).
- [ ] El agujero de verificación anotado, diciendo **qué pantallas quedaron sin
      prueba automática** (FR-026).
