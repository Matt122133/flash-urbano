---
owner: flash-urbano
status: living
last_reviewed: 2026-08-11
update_trigger: on-module-change
---

# Architecture

Top-level map of this tool. The single source of truth for how the code is
organised; read it before writing code you might later have to unwind.

For agent guidance and the workflow, see [`AGENTS.md`](AGENTS.md) and
[`docs/processes/harness.md`](docs/processes/harness.md).

## Overview

Flash Urbano is a package pickup/delivery business run by a single operator
(Diego). This repo holds **three deployed surfaces**:

- **`web/`** — the customer-facing web app (Next.js, static export) at
  `https://flashurbano.uy`, where clients create pickup/delivery orders
  themselves instead of coordinating by WhatsApp. **It does not show prices**:
  since `013` the operator quotes his own work off this product — see
  [ADR price-not-shown](docs/decisions/price-not-shown.md).
- **`backend/`** — a Go HTTP service on Railway, with Postgres + PostGIS. It
  holds identity: who is asking, and what they saved.
- **`android/`** — since `012`, the Kotlin/Compose app Diego uses in the street
  to see the day's orders and move them along. **Not published to any store**:
  the APK is built here and installed by hand, one phone. See
  [`docs/processes/app-repartidor.md`](docs/processes/app-repartidor.md).

**`android/` shares no code with the other two.** It talks to the service over
HTTP with the same session credential the site uses — same `Authorization`
header, same `sesiones` table — and that is the whole coupling. It is a separate
Gradle build that the root `verify:` invokes as its third leg; nothing in `web/`
or `backend/` imports from it, and it imports nothing from them. What it does
depend on is the **shape of the JSON** `GET /admin/pedidos` returns, which is
why its model tolerates missing fields and ignores unknown ones: a field added
to the Go struct must not require reinstalling an APK on somebody else's phone.

**They are separate origins, and that is the source of most of the risk here.**
Every authenticated call crosses CORS; the session credential travels in an
`Authorization` header and never in a cookie, deliberately, so the login does
not depend on cross-origin cookie behaviour (notably Safari's). See
[`docs/decisions/backend-persistence-stack.md`](docs/decisions/backend-persistence-stack.md).

Since `006`, the repo **does** talk to external systems: Google Identity
Services (sign-in), Resend (the access-code email), OpenStreetMap tiles, and
its own database.

**One boundary worth stating up front, because it constrains everything:**
pricing a shipment must keep working with the service down. The quote is
computed in the browser from data the site already ships, so `web/lib/api.ts`
must never appear in the import graph of the order form — there is a test that
guards it (`web/lib/cotizar-abierto.test.ts`).

## Top-level layout

```text
web/                  # Customer web app (Next.js 16, App Router)
backend/              # Go HTTP service: identity, sessions, profile
android/              # Diego's app (Kotlin + Compose); installed by hand, no store
specs/                # Spec-kit feature specs and plans (001-web-mvp, ...)
docs/                 # Harness docs: decisions, processes, trackers
scripts/harness/       # Plan-coverage sensor + gate/loop engine (Python)
.specify/              # Spec-kit engine (templates, memory/constitution, scripts)
.agents/skills/         # Harness hook skills (canonical copies)
.claude/skills/          # Agent-facing skills (speckit-* generated + harness-* copies)
```

## Module pattern

Inside `web/`, the App Router convention applies: each route is a folder
under `app/` with a `page.tsx`. Shared UI lives in `components/` at the
`web/` root (not nested per-route) since the app is still small enough that
one flat component folder is easier to navigate than a per-feature split.

```text
web/app/<route>/page.tsx   # One page per route folder
web/components/            # Shared, reusable components (NavBar, Footer, forms)
web/lib/                   # Non-UI modules: generated data and pure logic
```

Inside `backend/`, the layout is the standard Go one: `cmd/api/` is the only
executable and does the wiring; everything else lives under `internal/` and is
grouped **by domain, not by layer** — `auth/` (both login paths and sessions),
`usuarios/` (the profile), `correo/` (sending mail), `rastro/` (the audit
trail), `db/`, `httpx/`, `config/`. Migrations are embedded in the binary
(`migrations/`), so deploying and migrating are the same act.

```text
backend/cmd/api/main.go    # Wiring: config, pool, migrations, routes, janitor
backend/internal/<dominio>/ # One package per domain, not per layer
backend/migrations/*.sql   # Forward-only, embedded, applied at boot
```

Inside `web/lib/`, generated data and hand-written logic are kept in separate
files. `zonas.ts` is emitted by `design-source/build-zonas.js` from the client's
KML and is never edited by hand; `zona-lookup.ts` is the code that queries it.
The split exists so a corrected zone boundary can be regenerated without
touching the logic or its tests.

The same split applies to the street index, with one difference that matters:
**generated data big enough to hurt the bundle lives in `web/public/`, not in
`web/lib/`.** `public/calles-mvd.json` is ~1.3 MB (0.47 MB over the wire) and is
fetched on demand the first time someone touches an address field, so a visitor
who only reads `/contacto` never pays for it. `lib/direcciones.ts` is the code
that queries it. Zones went the other way — five polygons are small, and
in-bundle means that deciding whether an address is covered never depends on a
request succeeding — and without that answer there is no order.

## Dependency direction

`app/*/page.tsx` imports from `components/`; `components/` never imports
from `app/`.

The service is a **sibling**, not a layer inside `web/`: the two deploy
separately and the site is a static export, so it has no server of its own to
host one. The only way `web/` reaches the service is `web/lib/api.ts`; nothing
else should call `fetch` against it.

Inside `backend/`, `cmd/api` imports `internal/*` and never the reverse, and
`internal/*` packages do not import each other except where the domain
genuinely depends on it (`auth` uses `usuarios` to find or create the person
behind a credential). `internal/usuarios` deliberately does **not** import
`config`: it receives a predicate for "is this address an administrator",
which is what keeps that answer out of the database (FR-022).

## Entry point and bootstrap

`web/app/layout.tsx` is the root layout: it loads fonts, wraps every page in
`NavBar` + `Footer`, and sets the site-wide `<html>`/`<body>` shell and
default metadata. Each `app/<route>/page.tsx` is a Server Component by
default; components that need interactivity (forms, nav toggle) are marked
`"use client"` explicitly (`components/pedido-form.tsx`,
`components/nav-bar.tsx`).

## Current hotspots

- `web/components/pedido-form.tsx` — the package-creation form (US1 in
  `specs/001-web-mvp/spec.md`); the highest-priority surface per the
  constitution's Principle II. Client-side validation and the field set live
  here; if the client's brief changes, this is usually the file to touch.

  **Two fields are commented out rather than deleted** — package size and pickup
  time, paused by `014` on 2026-08-30 because the client said he will use them
  again. Each block names what to uncomment, and **the validation lines live in a
  different part of the file**, which is the half people miss. The site sends
  `chico` and `16:00` in their place from `components/pedido/crear-pedido.tsx`,
  so the service and its `NOT NULL` columns needed no change; reinstating the
  fields means reverting those two literals too.

  **The delivery section is the one that locates and decides admission; the
  pickup is written.** That is the inversion `011` made: the map, the mandatory
  crossing
  resolution and the candidate list hang off *a dónde llevamos el paquete*,
  while the pickup resolves a point silently, never shows it, and may end up
  without one. The two behaviours are the two modes of
  `components/bloque-direccion.tsx` — `exigente` and `oportunista` — **named
  after what they do and not after which address uses them**, precisely because
  that mapping has already flipped once.

  **It does not, and must not, import `lib/api.ts` or `lib/sesion.ts`.** Since
  `007` the form confirms an order against the service, but it does so through
  an `onConfirmar` prop — the composition in
  `web/components/pedido/crear-pedido.tsx` is what actually talks to the
  service. This looks like ceremony and is not: this file is one of the
  `ENTRADAS` of `web/lib/cotizar-abierto.test.ts`, the guard that proves the
  form works with the backend down (FR-001, FR-002). An import of the API
  client here turns that guard red, correctly — it would be a form that can end
  up needing the network before the last step. **If you find yourself "simplifying"
  this by importing the client directly, the guard will stop you; the guard is
  right.** Reasoning in `specs/007-pedido-identificado/research.md` D1.

  The guard has a **positive control** asserting that `crear-pedido.tsx` *does*
  reach `lib/api.ts`. Without it, deleting the whole send would leave the guard
  green.

- `web/components/pedido/` — the composition layer for `/pedido`: the piece
  allowed to import the API client, plus the login dialog that opens over the
  form. The dialog does **not** navigate, which is what keeps the draft —
  including the recipient's name and phone, a third party's data — out of
  browser storage (FR-006a).

  Since `010` this folder also holds **the order history** (`historial.tsx`,
  `tarjeta-pedido.tsx`), even though it renders inside `/perfil`: what places a
  component here is the domain — orders — and the permission to talk to the
  service, not which screen it appears on. `crear-pedido.tsx` gained a second
  preload path, the one for `/pedido?repetir=<id>`, and it is **mutually
  exclusive** with the profile one on purpose: two sources writing over the same
  form is the shape of the defect this very file already produced once (the
  2026-08-14 row in the tech-debt tracker).

  **None of those three screens has an automated test**, by a decision recorded
  on 2026-08-22. Read `specs/010-mis-pedidos/quickstart.md` before touching
  them: it is the entire verification they have.

- `web/app/pedido/page.tsx` — since `010` it wraps the composition in a
  `<Suspense>`, and **the header goes in the `fallback` too**. That is not
  decoration: reading `?repetir=` with `useSearchParams` pushes the whole subtree
  below the boundary to the client, and without the header in the fallback the
  `h1` disappears from the prerendered HTML — the one a search engine reads, and
  the site has been indexable since `004`. Without the `<Suspense>` the **build
  fails outright**; in development it works fine, which is the trap.

- `web/lib/repetir.ts` — the pure half of repeating an order: mapping what was
  saved onto the form's fields, and revalidating the saved delivery point. It
  used to decide whether the price had been readjusted too; that went with the
  price in `013`. It
  lives in `lib/` rather than in the component so it can be tested in the `node`
  environment the repo already has — it is the only part of `010` with an
  automated net. Its test includes a guard that it never reaches `components/`,
  with a positive control.

- `android/app/src/main/java/uy/flashurbano/repartidor/ui/tema/` — the app's
  colour scheme, added by `015`. **Before it existed the app rendered in Material
  3's reference purple**, which is what the client meant by "medio fea". Two
  things to know before touching it: dynamic colour (Material You) is turned
  **off on purpose** — it derives the palette from the phone's wallpaper, which
  is how the brand disappeared in the first place; and **every colour role is
  declared, including ones nothing uses yet**. That is not tidiness: an
  undeclared role is not a missing value, it is the reference purple waiting for
  someone to use the component that reads it. It bit twice during `015`, in
  `surfaceContainer` (the navigation bar) and `inversePrimary` (the snackbar
  action), and neither was visible to the automated test.

- `android/app/src/test/.../ui/tema/ContrasteTest.kt` — computes the WCAG
  contrast ratio of every text/background pair in the theme and fails below
  4.5:1. It caught two real defects before they reached a screen: white on the
  brand orange (2.80:1) and the muted grey on the app background (4.42:1 — it
  passed on white and failed on grey). **Read its stated limit before trusting
  it**: it tests the palette, not that a screen uses those colours.

- `android/.../pantallas/BarraDestinos.kt` — the bottom navigation added by
  `015`. Three sibling lists, no `androidx.navigation`: they share one
  ViewModel and the same loaded data. **"Back" now exits the app from any tab**,
  which is what a navigation bar does on Android; the `BackHandler` that used to
  return from Entregados went with the screen.

- `backend/internal/pedidos/` — orders. Two things worth knowing before
  touching it: the order **copies** profile data rather than referencing it, so
  someone moving house does not rewrite where a courier went six months ago;
  and the service **does not resolve zones**, so it stores the point and the
  declared price. That second one is a deliberate, recorded tradeoff — see the
  `Medium` row of 2026-08-12 in `docs/tech-debt-tracker.md` before "fixing" it.

  **Since `016` the two list endpoints no longer return the same shape.**
  `GET /pedidos` returns `Pedido`; `GET /admin/pedidos` returns `ParaAdmin`,
  which embeds it and adds the receiver's ID number. The customer's type is the
  default **on purpose**: exposing something sensitive should require naming the
  admin type, so the next sensitive field lands on the customer side only if
  someone writes it there deliberately. The document itself rides in an
  unexported field that `encoding/json` cannot serialise, so the compiler — not
  a convention — is what keeps it in.

  **The stored `precio` is no longer shown to anyone and must not be read.**
  Since `013` it records what the old rule would have charged, not what the
  operator charges; it is kept only so the decision can be reversed cheaply.
  Principle V, version 5.0.0, forbids reading it for revenue, reporting or a
  dashboard.
- `web/lib/etiqueta.ts` + `web/lib/etiqueta-pdf.ts` — la etiqueta imprimible
  que `020` agrega al confirmar un pedido y a cada tarjeta de *Mis pedidos*.
  **Que sean dos archivos no es organizacion, es lo que hace verificable el
  requisito que importa.** `etiqueta.ts` es puro y decide *que dice* la hoja;
  `etiqueta-pdf.ts` la dibuja con jsPDF. La prohibicion central —que la etiqueta
  no muestre **ningun importe**, Principio V— se afirma sobre la estructura, que
  es texto inspeccionable, en vez de raspar bytes de un PDF comprimido.

  Dos cosas mas que se deshacen facil sin querer. **`etiqueta.ts` describe la
  forma del pedido guardado en vez de importarla de `lib/api.ts`**
  (`PedidoParaEtiqueta`): TypeScript es estructural, asi que no se pierde nada, y
  a cambio la guarda del grafo de imports queda sin excepciones —esa guarda toma
  de mas a proposito y marcaria hasta un `import type`, que se borra al
  compilar—. Y **`etiqueta-pdf.ts` se importa siempre de forma dinamica**, al
  tocar el boton: arrastra jsPDF, 108 KB comprimidos medidos, y un import
  estatico se los cobra a todo el que abre `/pedido` o `/perfil`.

  La zona sale del punto de entrega guardado y **se omite entera cuando no hay
  punto** —un pedido anterior a `011`—: nunca se deduce de la direccion escrita.

- `web/lib/silueta-camion.ts` — **generado**, nunca editado a mano. Regenerar con
  `design-source/build-silueta.js`. Es la silueta del camion de la marca,
  embebida como data URI para que dibujar la etiqueta no dependa de una request.
  **El logo a color no se puede usar sobre papel**: esta hecho para fondo azul y
  la mitad de sus elementos son blancos. Ver `web/design-source/README.md`.

- `backend/internal/pedidos` — **desde `022` el cliente puede corregir o dar de
  baja un pedido propio, y solo mientras Diego no lo tomo.** Dos cosas de ese
  feature se deshacen facil sin querer:

  **La autorizacion y la ventana viven en el `WHERE`**, no en un `if` del
  handler: `Editar()` y `Eliminar()` acotan por id, dueño **y estado** en la
  misma sentencia y deciden por filas afectadas. Convertirlo en "leer, comprobar
  en Go, escribir" parece mas legible y **reintroduce la carrera**: entre la
  lectura y la escritura Diego puede tomar el pedido, y el guardado pisa un
  trabajo en curso. Los tres motivos de rechazo —no existe, no es tuyo, ya lo
  tomaron— colapsan en un solo error a proposito: distinguirlos le confirma a un
  desconocido que el pedido existe.

  **La baja BORRA la fila, y se puede solo por esa ventana.**
  `pedidos_estados.pedido_id` es `ON DELETE RESTRICT` y ese historial se escribe
  unicamente cuando Diego mueve el estado, asi que un pendiente no tiene nada que
  lo retenga. Si alguna vez ese `DELETE` chocara contra el `RESTRICT`, **no hay
  que aflojar la restriccion**: es la señal de que la ventana se abrio de mas.
  Esa coincidencia es tambien lo que evito inventar un estado `anulado` y, con
  el, una version nueva de la app.

- `web/components/pedido/crear-pedido.tsx` — **desde `022` tiene TRES fuentes de
  precarga** —el perfil, `?repetir=` y `?editar=`— y siguen siendo **mutuamente
  excluyentes**, decididas una sola vez. La tercera es la peligrosa: las otras
  dos arrancan un pedido nuevo y esta termina guardando sobre uno existente, asi
  que **el modo de guardado viaja con la precarga** (`editando`) en vez de
  deducirse volviendo a leer la URL. Dos lecturas que discrepan guardan sobre el
  pedido equivocado, y en pantalla no se ve nada raro. Es la forma, con mas
  superficie, del defecto que este mismo hook produjo el 2026-08-14.

- `web/lib/zona-lookup.ts` — resolves which delivery zone a marked point falls
  in, and therefore **whether the order can be taken at all**. **Since `011` the
  point it is asked about is the DELIVERY point, not the pickup one**
  (`docs/decisions/pricing-from-delivery-zone.md`); the module itself did not
  change, only who calls it with what. The only module in the repo
  with unit tests (`zona-lookup.test.ts`), because it is the only one where a
  bug costs money rather than looks. Its tie-break on shared borders is
  deliberate and documented; do not "improve" it into a nearest-zone fallback.
- `web/lib/zonas.ts` — **generated**, never hand-edited. Regenerate with
  `design-source/build-zonas.js`; see `web/design-source/README.md`.
- `web/lib/direcciones.ts` — resolves an address from a street/corner pair, and
  computes how far the pin may be dragged from it. That drag bound is not a UX
  nicety: the pin decides the zone, so an unbounded pin lets someone declare a
  delivery in one place and expect it in another. Tested for the same reason
  `zona-lookup.ts` is. Its search
  normalisation must stay in step with `design-source/build-calles.js`.
- `web/public/calles-mvd.json` — **generated**, never hand-edited, and not
  imported: it is fetched at runtime. Regenerate with
  `design-source/build-calles.js`, which needs source data that does **not**
  live in this repo; see `web/design-source/README.md`.
- `web/components/campo-autocompletado.tsx` — the hand-rolled accessible
  combobox. It replaced the free-text address fields, so if its keyboard and
  screen-reader support breaks, people who could order before cannot.
- `web/components/mapa-zonas.tsx` — the Leaflet map, shared by `/pedido` and
  `/sobre-nosotros`. Must stay client-only (`ssr: false` via
  `mapa-zonas-dinamico.tsx`) because Leaflet touches `window` on import.
- `web/app/layout.tsx` + `web/components/nav-bar.tsx` — the site shell.
  Adding a new top-level section means updating the `LINKS` array here too.
- `backend/internal/auth/` — the trust boundary of the whole repo. `google.go`
  verifies an ID token against Google's JWKS; `codigo.go` issues and consumes
  the six-digit email codes (slow hashing, five attempts, single use);
  `sesion.go` mints and revokes the credential everything else relies on. A bug
  here is not a wrong pixel — it is someone reading another person's data.
- `backend/internal/usuarios/handlers.go` — the profile. Note that **who is an
  administrator is computed from configuration, never read from a column**
  (FR-022); there is a test asserting the table has no such column, because if
  it existed there would be somewhere to write it.
- `backend/migrations/` — forward-only and embedded. A migration that has
  shipped is never edited; the next one corrects it.
- `docs/decisions/`, `AGENTS.md`, `.specify/memory/constitution.md` — not
  code, but load-bearing for how any future change in this repo should be
  approached.

## Adding a new module

1. If it's a new top-level web section (like Reseñas), add
   `web/app/<route>/page.tsx` and register it in `NavBar`'s `LINKS`.
2. If it's a new backend capability, add a package under `backend/internal/`
   named after the **domain**, wire it in `cmd/api/main.go`, and — if it needs
   schema — add the next numbered migration rather than editing a shipped one.
   Anything that runs on a timer hangs off the janitor in `internal/db`, or it
   will silently never run.
3. If it introduces a new external dependency or a new trust boundary, write an
   ADR first (`docs/decisions/<slug>.md`) — it's a genuine architectural
   fork per Principle III (simplicity/YAGNI) in the constitution, not a
   routine addition.
4. Any new feature goes through the harness phases (Brief → Decide → Plan →
   Execute) per `AGENTS.md`; scaffold its `specs/<feature>/` directory before
   writing code.
