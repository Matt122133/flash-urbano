---
owner: flash-urbano
status: living
last_reviewed: 2026-08-01
update_trigger: on-module-change
---

# Architecture

Top-level map of this tool. The single source of truth for how the code is
organised; read it before writing code you might later have to unwind.

For agent guidance and the workflow, see [`AGENTS.md`](AGENTS.md) and
[`docs/processes/harness.md`](docs/processes/harness.md).

## Overview

Flash Urbano is a package pickup/delivery business run by a single operator
(Diego). This repo currently holds one surface: a customer-facing web app
(`web/`) where clients create pickup/delivery orders themselves instead of
coordinating by WhatsApp. It talks to no external systems yet — no auth
provider, no database, no payment gateway (see `specs/001-web-mvp/spec.md`
§ Assumptions for what's deliberately deferred). A planned second surface,
the Android admin app for Diego, is out of scope until its own spec/plan.

## Top-level layout

```text
web/                  # Customer web app (Next.js 16, App Router)
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

Inside `web/lib/`, generated data and hand-written logic are kept in separate
files. `zonas.ts` is emitted by `design-source/build-zonas.js` from the client's
KML and is never edited by hand; `zona-lookup.ts` is the code that queries it.
The split exists so a corrected zone boundary can be regenerated without
touching the logic or its tests.

## Dependency direction

`app/*/page.tsx` imports from `components/`; `components/` never imports
from `app/`. There is no backend/service layer yet — see Overview. When one
is added (real persistence, auth), it should live under `web/app/api/` or a
sibling `backend/` per `specs/<feature>/plan.md`'s own Structure Decision,
not be retrofitted into `components/`.

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
- `web/lib/zona-lookup.ts` — resolves which delivery zone a marked point falls
  in, and therefore what the customer is charged. The only module in the repo
  with unit tests (`zona-lookup.test.ts`), because it is the only one where a
  bug costs money rather than looks. Its tie-break on shared borders is
  deliberate and documented; do not "improve" it into a nearest-zone fallback.
- `web/lib/zonas.ts` — **generated**, never hand-edited. Regenerate with
  `design-source/build-zonas.js`; see `web/design-source/README.md`.
- `web/components/mapa-zonas.tsx` — the Leaflet map, shared by `/pedido` and
  `/sobre-nosotros`. Must stay client-only (`ssr: false` via
  `mapa-zonas-dinamico.tsx`) because Leaflet touches `window` on import.
- `web/app/layout.tsx` + `web/components/nav-bar.tsx` — the site shell.
  Adding a new top-level section means updating the `LINKS` array here too.
- `docs/decisions/`, `AGENTS.md`, `.specify/memory/constitution.md` — not
  code, but load-bearing for how any future change in this repo should be
  approached.

## Adding a new module

1. If it's a new top-level web section (like Reseñas), add
   `web/app/<route>/page.tsx` and register it in `NavBar`'s `LINKS`.
2. If it introduces real backend/persistence for the first time, write an
   ADR first (`docs/decisions/<slug>.md`) — it's a genuine architectural
   fork per Principle III (simplicity/YAGNI) in the constitution, not a
   routine addition.
3. Any new feature goes through the harness phases (Brief → Decide → Plan →
   Execute) per `AGENTS.md`; scaffold its `specs/<feature>/` directory before
   writing code.
