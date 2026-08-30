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
(identified order creation, an admin view, basic route support)
and only add complexity when a real, stated requirement demands it.

### IV. Mobile-first, low-friction UI
Customers will overwhelmingly fill out the order form from a phone, often
right after a WhatsApp conversation. Forms, navigation, and the address
composition fields (calle, número, apto, esquina, cooperativa) must work
cleanly on small screens with minimal typing and clear validation.

### V. The site takes the order; the price is the operator's
**The product does not say what a shipment costs.** No surface shows an amount
to anyone, and no text justifies an action, an obligation, or a refusal by
appealing to cost. There is no substitute message either: the product is silent
on money, not apologetic about it. Pricing is agreed between Diego and the
customer, off this product and by his own channel.

What the site does with a zone is decide **whether the shipment is taken at
all**. The customer resolves the delivery address to a point, the site
determines which of the five zones it falls in, and a point outside every zone
yields no order; it routes to direct contact. The pickup address is written, not
marked: its point is resolved silently and may be absent. Never guess a zone,
and never fall back to the nearest one — the map tells people where this
business works, and taking an order from outside it makes that a lie.

The zone boundaries stay **binding**, no longer for charging but for coverage,
so they remain a data asset and not a picture: versioned, regenerable from the
client's own file, and changeable without touching code. Boundaries the client
has not confirmed MUST NOT reach production.

The amount each zone would have cost **is still computed and stored with every
order**, so this decision can be reversed cheaply. **Nothing reads it, and
nothing may**: from the day it stopped being shown it records what the old rule
would have charged, not what Diego charges. Reading that column for revenue,
reporting, or a dashboard is reading a fiction. If it is ever read for anything,
that is a new decision, not a defect.

Logistics remain manual, as the client's answers describe: no capacity limits,
no automatic acceptance, no route generation. There is no cap on daily
deliveries — Diego accepts jobs and plans routes himself. **Nothing is
automated for the customer's benefit any more except the coverage check.**

Amended three times, and the third reverses the direction of the first two.
[ADR zone-based-automatic-pricing](../../docs/decisions/zone-based-automatic-pricing.md)
reversed this principle's original form ("price and logistics stay manual") on
the evidence of the client's own zone map, and records the alternative that was
rejected. [ADR pricing-from-delivery-zone](../../docs/decisions/pricing-from-delivery-zone.md)
then moved the measured end of the trip from pickup to delivery, on the client's
own correction — his zones were always about where the package goes.
[ADR price-not-shown](../../docs/decisions/price-not-shown.md) then took the
number off the screen entirely, on the client's decision that he quotes his own
work. **Both earlier ADRs survive on how a zone is resolved and die on what is
done with the result.** Neither was wrong when written: they read a price list
the client had drawn for his own use as one he meant to publish, and nobody had
asked him which it was.

## Scope boundaries

**No package is created without an identified customer.** Anyone can open the
form, write their addresses and mark a delivery point without an account, and
that must keep working with the service down — but **confirming an order
requires being logged in**. This is the client's own rule, and it is what the
whole identity feature exists to serve: an order that nobody can be held to is
an order Diego cannot work with.

**The public half of this split used to carry a reward, and no longer does.**
Until 5.0.0 the argument was "the quote is public, the order is not" — a visitor
who only wanted to know how much got an answer without registering, and putting
a door in front of that would have contradicted Principle II. That reasoning did
not become false; it became moot, because Principle V removed the number from
the public side of the door. What is left open is the form itself, up to the
moment of confirming. **Whether asking a visitor to give their addresses before
they learn anything about cost loses business is a real risk, and it is the
client's to take** — the site cannot both keep his pricing private and answer
the visitor who only wanted to know how much.

Two surfaces, built in this order:

1. **Customer web app** — **identified order creation** (see the rule below);
   pickup address
   (written; its point resolved silently and never shown) and delivery address
   (written plus a point marked on the map); **confirmation that the delivery
   point falls inside the coverage area**, named by zone and without an amount;
   package type/description, quantity; the pickup
   window; the name and phone number of whoever receives the package; Sobre
   Nosotros (hours, delivery zone map **without prices**, historical volume);
   Contacto (WhatsApp, email); Reseñas (last, deferred).

   Four things this list used to name and deliberately no longer does, on the
   client's own instruction: **the price** (5.0.0 — he quotes his own work; see
   Principle V), **payment method** (never confirmed — the options
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

**Version**: 5.0.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-30

### Amendment history

- **5.0.0** (2026-08-30) — **The product stops showing the price.** The client
  decided he quotes his own work, by his own channel, and does not want the
  subject to appear anywhere in the product. The site narrows to intake.

  **MAJOR, and it reverses the direction of the two amendments before it.**
  2.0.0 and 4.0.0 both moved toward automatic quoting; this one takes the number
  off the screen. Code written against the old text — a form that shows a firm
  amount, a legend that lists prices per zone, an order card that reports what
  was charged — becomes non-compliant, not merely incomplete.

  **What does not change**: the delivery point is still required and still
  resolves to one of the five zones; a point outside every zone still yields no
  order and routes to direct contact; guessing a zone or falling back to the
  nearest one is still forbidden; the boundaries are still a versioned data
  asset. **What changes is that the resolved zone decides admission instead of
  money.**

  **What this obliges**: `013` removes every amount and every appeal to cost
  from the customer-facing surfaces, keeps the zone map as a coverage statement
  with its written legend intact, and **keeps the price in the data** — computed,
  sent and stored — so the decision can be reversed. That stored number becomes
  a fiction the moment it ships, and Principle V now forbids reading it.

  **What this costs**: the public half of the value proposition. 3.0.0 argued
  that the quote is public and the order is not, precisely so a visitor who only
  wanted to know how much would get an answer. That argument is now moot rather
  than wrong, and the *Scope boundaries* say so in full.

  See [ADR price-not-shown](../../docs/decisions/price-not-shown.md), which
  records the four alternatives rejected and the trigger to revisit.

- **4.0.0** (2026-08-22) — **The price comes from the delivery zone, not the
  pickup zone.** The client said on 2026-08-22 that his zones and prices were
  always about where the package goes; the site had been charging by pickup
  since 2.0.0. Both sides describe it as a communication failure, not a defect
  introduced by anyone.

  **MAJOR: a principle is redefined, not narrowed.** Every order whose pickup
  and delivery fall in different zones was charged the wrong amount — an order
  leaving Zone 1 for Zone 5 cost $150 instead of $350 — so code written against
  the old text becomes non-compliant, not merely incomplete. The exposure is
  zero only because nothing has been ordered in production yet.

  **What does not change**: the site still quotes by itself, from a zone, as a
  firm price and not an estimate; the amount is still flat per zone; a point
  outside every zone still yields no price and no order; guessing a zone or
  falling back to the nearest one is still forbidden. **What changes is which
  end of the trip is measured**, and with it which address gets the map.

  **What this obliges**: `011` moves the map and the crossing resolution to the
  delivery section; the pickup keeps a silently resolved point that checks the
  service area and feeds the future route planner, but stops being required —
  so **the Android app must tolerate a pickup without coordinates**. `010`'s
  repeat-an-order flow changes with it.

  See [ADR pricing-from-delivery-zone](../../docs/decisions/pricing-from-delivery-zone.md),
  which also records why the prior ADR anticipated this and named its trigger.

- **3.0.0** (2026-08-11) — **No package is created without an identified
  customer.** The scope boundaries said "guest **or** Google-login order
  creation"; the client removed guest ordering when he answered who may place an
  order, and this document had been contradicting that answer since. Pricing
  stays open to anyone: the quote is public, the order is not.

  **MAJOR, and the first one — because a rule was reversed, not narrowed.**
  Every previous amendment moved scope while leaving the principles intact.
  This one retires a capability the document explicitly granted, and code
  written against the old text —a form that accepts an order from an anonymous
  visitor— becomes non-compliant rather than merely incomplete. Calling it MINOR
  would hide exactly the kind of change this version number exists to announce.

  Principle II (self-service is the core value) is **not** reversed: quoting
  without an account is still required, and `006` protects it with an automated
  guard. What changes is the last step, not the visit.

  **What this obliges:** `007` must put the door in front of order confirmation,
  and the copy of `/pedido` —which today reads *"Podés cargarlo como invitado,
  sin necesidad de crear una cuenta"*— becomes false and must change with it.
  `006` deliberately did not touch the form (FR-007b): the door and the order
  that actually gets saved have to ship together, or registering buys the
  customer nothing. No ADR: this is the client adjusting his own brief, and the
  reasoning lives here.

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
