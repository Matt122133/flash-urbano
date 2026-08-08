# Flash Urbano Constitution

## Core Principles

### I. Visual-first MVP
Every phase of this project ships something the client (Diego) can see and
react to before deeper investment goes into it. The web app for customers
comes before the Android admin app, and within the web app, the package
creation flow (the core value proposition) comes before secondary sections
(Sobre Nosotros, Contacto, Reseñas). Reseñas is explicitly deferred to last
per the client brief. Prefer a working, visually presentable slice over a
complete but invisible backend.

### II. Self-service data entry is the core value
The entire premise of this project is moving package intake from Diego
manually transcribing WhatsApp messages to customers entering their own
data (name, phone, composed address, package type/description, pickup and
delivery windows, who retrieves it). Any design or technical decision that
makes self-service entry slower, more confusing, or optional undermines the
product's reason to exist. The package creation form is the single
highest-priority surface in the web app.

### III. Simplicity over infrastructure (YAGNI)
This is a single-operator courier business, not a multi-tenant platform.
No premature scaling, multi-region infra, microservices, or speculative
abstractions. Start with the simplest stack that satisfies the client brief
(guest + Google-login order creation, an admin view, basic route support)
and only add complexity when a real, stated requirement demands it.

### IV. Mobile-first, low-friction UI
Customers will overwhelmingly fill out the order form from a phone, often
right after a WhatsApp conversation. Forms, navigation, and the address
composition fields (calle, número, apto, esquina, cooperativa) must work
cleanly on small screens with minimal typing and clear validation.

### V. The site quotes; logistics stay manual
Pricing is a function of the pickup zone, and the site resolves it without
human intervention: the customer marks the pickup point, the site determines
which of the five delivery zones it falls in, and shows the price of that
zone — as the price, not an estimate. The amount is flat per zone; it is not
multiplied by package count or adjusted by size. A point outside every zone
yields no price and no order; it routes to direct contact. Never guess a zone,
and never fall back to the nearest one — guessing a zone means guessing a
price.

This makes the zone boundaries **binding for charging**, so they are a data
asset, not a picture: versioned, regenerable from the client's own file, and
changeable without touching code. Boundaries the client has not confirmed
MUST NOT reach production.

Logistics remain manual, as the client's answers describe: no capacity limits,
no automatic acceptance, no route generation. There is no cap on daily
deliveries — Diego accepts jobs and plans routes himself. Only pricing is
automated.

Amended by [ADR zone-based-automatic-pricing](../../docs/decisions/zone-based-automatic-pricing.md),
which reverses this principle's original form ("price and logistics stay
manual") on the evidence of the client's own zone map, and records the
alternative that was rejected.

## Scope boundaries

Two surfaces, built in this order:

1. **Customer web app** — guest or Google-login order creation; pickup address
   (written plus a point marked on the map) and delivery address; the zone
   price shown from that point; package type/description, quantity; the pickup
   window; the name and phone number of whoever receives the package; Sobre
   Nosotros (hours, delivery zone map, historical volume); Contacto (WhatsApp,
   email); Reseñas (last, deferred).

   Three things this list used to name and deliberately no longer does, on the
   client's own instruction: **payment method** (never confirmed — the options
   shown were placeholder), **the delivery window** (replaced by a fixed
   commitment to deliver within 24 hours of pickup, which the site states and
   does not enforce), and **the recipient's ID document** (a sensitive number
   collected at order time that nothing used; captured in the Android app at
   delivery if it is needed at all).

   The recipient's **name** left this list on 2026-08-06 and came back the same
   day, once the client clarified. Without it the courier arrives at a door with
   a phone number and no idea who to ask for. The ID did not come back.
2. **Admin Android app** — view packages created via the web, filter/select
   which to carry each day, generate an economical route from the admin's
   position, and give feedback at each lifecycle stage (Creación →
   Aceptación/Recepción → Confirmación → Entrega), plus a dashboard with
   daily totals and historical stats.

No physical storefront exists; the business is pickup-and-delivery only —
nothing in the product should assume a walk-in location.

## Development workflow

This repo runs the harness (see `AGENTS.md`, `docs/processes/harness.md`) as
a governance layer over spec-kit. Every feature goes through Brief → Decide →
Plan → Execute; no code without an active, analyzed `specs/<feature>/plan.md`;
no edits outside that plan's `covers:`; not done until `verify:` is green.
Given Principle I (visual-first), plans for early milestones should scope
tightly to a demonstrable slice rather than the full feature surface at once.

## Governance

This constitution supersedes ad hoc practices and client-doc reinterpretation.
Amendments require updating this file plus a matching entry in
`docs/decisions/` when the change reverses a prior decision. `AGENTS.md` and
the spec-kit plan template's Constitution Check defer to this document as the
highest authority in the repo.

**Version**: 2.2.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-06

### Amendment history

- **2.2.0** (2026-08-06) — The recipient's **name** returns to the order form,
  before the phone number. 2.1.0 removed it together with the ID document, on
  the reading that both are captured in the Android app at delivery; the client
  clarified the same day that the name is needed when the order is placed. The
  **ID document stays out**. MINOR for the same reason as 2.1.0 — scope moves,
  no principle is reversed, and it is the client adjusting his own brief. No
  ADR. See `specs/005-nombre-destinatario/`.
- **2.1.0** (2026-08-06) — Scope boundaries narrowed for the customer web app:
  payment method, the delivery window, and the recipient's name/ID leave the
  order form; a recipient phone number and a fixed 24-hour delivery commitment
  take their place. MINOR, not MAJOR: **no principle is reversed** — the change
  is the client narrowing his own brief, which is the source this list was
  derived from in the first place, and Principles II, III and IV all come out
  reinforced (fewer required fields on the highest-priority surface, less code,
  less typing on a phone). **No ADR**: governance requires one when a change
  reverses a prior decision, and this corrects a list against its own source.
  See `specs/004-ajustes-finales-mvp/`.
- **2.0.0** (2026-08-02) — Principle V redefined: the site now quotes the price
  automatically from the pickup zone; logistics stay manual. MAJOR because a
  principle is reversed, not clarified. See
  [ADR zone-based-automatic-pricing](../../docs/decisions/zone-based-automatic-pricing.md).
- **1.0.0** (2026-08-01) — Ratified.
