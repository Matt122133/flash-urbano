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
(Diego). This repo holds **two deployed surfaces**:

- **`web/`** — the customer-facing web app (Next.js, static export) at
  `https://flashurbano.uy`, where clients price and create pickup/delivery
  orders themselves instead of coordinating by WhatsApp.
- **`backend/`** — a Go HTTP service on Railway, with Postgres + PostGIS. It
  holds identity: who is asking, and what they saved.

**They are separate origins, and that is the source of most of the risk here.**
Every authenticated call crosses CORS; the session credential travels in an
`Authorization` header and never in a cookie, deliberately, so the login does
not depend on cross-origin cookie behaviour (notably Safari's). See
[`docs/decisions/backend-persistence-stack.md`](docs/decisions/backend-persistence-stack.md).

Since `006`, the repo **does** talk to external systems: Google Identity
Services (sign-in), Resend (the access-code email), OpenStreetMap tiles, and
its own database. A planned third surface, the Android admin app for Diego,
is out of scope until its own spec/plan.

**One boundary worth stating up front, because it constrains everything:**
pricing a shipment must keep working with the service down. The quote is
computed in the browser from data the site already ships, so `web/lib/api.ts`
must never appear in the import graph of the order form — there is a test that
guards it (`web/lib/cotizar-abierto.test.ts`).

## Top-level layout

```text
web/                  # Customer web app (Next.js 16, App Router)
backend/              # Go HTTP service: identity, sessions, profile
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
in-bundle means the price never depends on a request succeeding.

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

  **It does not, and must not, import `lib/api.ts` or `lib/sesion.ts`.** Since
  `007` the form confirms an order against the service, but it does so through
  an `onConfirmar` prop — the composition in
  `web/components/pedido/crear-pedido.tsx` is what actually talks to the
  service. This looks like ceremony and is not: this file is one of the
  `ENTRADAS` of `web/lib/cotizar-abierto.test.ts`, the guard that proves
  quoting works with the backend down (FR-001, FR-002). An import of the API
  client here turns that guard red, correctly — it would be a form that can end
  up needing the network to show a price. **If you find yourself "simplifying"
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
  saved onto the form's fields, and deciding whether the price was readjusted. It
  lives in `lib/` rather than in the component so it can be tested in the `node`
  environment the repo already has — it is the only part of `010` with an
  automated net. Its test includes a guard that it never reaches `components/`,
  with a positive control.

- `backend/internal/pedidos/` — orders. Two things worth knowing before
  touching it: the order **copies** profile data rather than referencing it, so
  someone moving house does not rewrite where a courier went six months ago;
  and the service **does not resolve zones**, so it stores the point and the
  declared price. That second one is a deliberate, recorded tradeoff — see the
  `Medium` row of 2026-08-12 in `docs/tech-debt-tracker.md` before "fixing" it.
- `web/lib/zona-lookup.ts` — resolves which delivery zone a marked point falls
  in, and therefore what the customer is charged. The only module in the repo
  with unit tests (`zona-lookup.test.ts`), because it is the only one where a
  bug costs money rather than looks. Its tie-break on shared borders is
  deliberate and documented; do not "improve" it into a nearest-zone fallback.
- `web/lib/zonas.ts` — **generated**, never hand-edited. Regenerate with
  `design-source/build-zonas.js`; see `web/design-source/README.md`.
- `web/lib/direcciones.ts` — resolves an address from a street/corner pair, and
  computes how far the pin may be dragged from it. That drag bound is not a UX
  nicety: the pin decides the price, so an unbounded pin makes the charge
  gameable. Tested for the same reason `zona-lookup.ts` is. Its search
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
