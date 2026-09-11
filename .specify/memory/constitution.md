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

### V. The site takes the order; the price is behind the login
**The product tells an identified customer what their shipment costs, and tells
nobody else.** A person with an active session, once their delivery point
resolves inside a zone, sees that zone's amount **in the same block that names
the zone**, in the order form. That block is the only place in this product —
site, app, or paper — where an amount ever appears.

**The amount belongs to the zone, not to the order.** It appears only alongside
the zone's name: no standalone price line, no total, no figure in a
pre-confirmation summary or on a confirmation screen. **No zone named, no
amount.**

Everything outside that one block stays silent on money, exactly as it was: no
amount on the home page, on Sobre Nosotros, on the zone map or its tooltips and
legend, in *Mis pedidos*, on the printable label, or anywhere in Diego's app —
**and none of that changes for a customer who is signed in**. The session opens
the order form, not the site. No text justifies an action, an obligation, or a
refusal by appealing to cost; a delivery point outside the five zones is refused
on coverage, never on price.

**There is no substitute message for the visitor who has not signed in.** Where
the identified customer sees an amount, the visitor sees the coverage
confirmation naming the zone, and nothing more: no invitation to sign in and see
the price, no blurred figure, no mention that a number exists. The product does
not advertise what is behind the door. Pricing beyond the zone table — urgent
work, anything unusual — is still agreed between Diego and the customer, off
this product and by his own channel.

**Every amount shown is recalculated from the delivery zone at the moment it is
shown.** Nothing displayed to anyone is ever read back from a stored order.

Because the zone amounts are now quoted to customers, they are a **promise**:
editing one is a customer-facing change, not an internal data edit, and the
amounts in the generated zone module MUST be the ones the client charges today.

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

The amount is **still computed and stored with every order**. **Nothing reads it,
and nothing may** — and 6.0.0 did not lift one word of this. The column records
what the rule of the day would have charged, not what Diego charges: for orders
created before 2026-08-22 it was computed from the **pickup** zone, so it was
never the price of that shipment under today's rules. Reading it for revenue,
reporting, a dashboard, **or to show a customer what one of their own past
orders cost**, is reading a fiction. If it is ever read for anything, that is a
new decision, not a defect. The price a customer sees in the order form is not
this column; it is recalculated.

Logistics remain manual, as the client's answers describe: no capacity limits,
no automatic acceptance, no route generation. There is no cap on daily
deliveries — Diego accepts jobs and plans routes himself. **Nothing is
automated for the customer's benefit any more except the coverage check.**

Amended four times: the third reversed the direction of the first two, and the
fourth put back half of the third.
[ADR price-behind-the-login](../../docs/decisions/price-behind-the-login.md) is
the most recent, and it corrects an alternative `price-not-shown` had considered
and rejected **on an inference about the client's motive rather than on anything
he said**. That rejected paragraph is deliberately left standing in that ADR: it
is the clearest record this repo has of how these amendments keep getting
bought.
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

**The reward moved to the inside of the door; it did not come back to the
outside.** Until 5.0.0 the argument was "the quote is public, the order is not"
— a visitor who only wanted to know how much got an answer without registering,
and putting a door in front of that would have contradicted Principle II. 5.0.0
removed the number from both sides of the door; **6.0.0 puts it back on the
inside only**. What is open to a visitor without an account is still the whole
form, up to the moment of confirming, and it must keep working with the service
down — but the amount is not part of what they get.

**Whether asking a visitor to give their addresses before they learn anything
about cost loses business is a real risk, and it is the client's to take** — he
has now taken it twice, in 5.0.0 and again in 6.0.0, the second time with the
option of a "sign in to see the price" teaser explicitly on the table and
declined. The site does not tell the anonymous visitor what they are missing.

Two surfaces, built in this order:

1. **Customer web app** — **identified order creation** (see the rule below);
   pickup address
   (written; its point resolved silently and never shown) and delivery address
   (written plus a point marked on the map); **confirmation that the delivery
   point falls inside the coverage area**, named by zone — **with the zone's
   amount if the customer is signed in, and without it if they are not**
   (6.0.0);
   how many packages; the pickup **date**; the name and phone number of whoever
   receives the package; Sobre
   Nosotros (hours, delivery zone map **without prices, for everyone**,
   historical volume);
   Contacto (WhatsApp, email); Reseñas (last, deferred). And, **for
   administrators only**, the operator's **tablero**: how many orders are
   registered, how many orders and packages per day, week or month, and the same
   narrowed to one customer account (6.1.0). It counts; it never shows an
   amount, and it does not read the stored `precio` (Principle V). It lives on
   the web and not in the app because it is read sitting at a computer, not in
   the street.

   Six things this list used to name and deliberately no longer does, on the
   client's own instruction: **the price on the public surface** (5.0.0 — and
   6.0.0 returned it to the order form for signed-in customers only, nowhere
   else; see Principle V), **the package size** and **the pickup time** (5.1.0 — he uses
   neither today, and the pickup time in particular moves out of the site and
   into a conversation he holds himself, where the price can move with it),
   **payment method** (never confirmed — the options
   shown were placeholder), **the delivery window** (replaced by a fixed
   commitment to deliver within 24 hours of pickup, which the site states and
   does not enforce), and **the recipient's ID document** (a sensitive number
   collected at order time that nothing used; captured in the Android app at
   delivery if it is needed at all).

   **The package size and the pickup time are in pause, not retired.** The
   client said he will use both again, so the code stays in place, commented,
   with what disabled it and what to uncomment. Until then the site sends a
   fixed value for each, and **those two stored columns record that fixed value
   rather than anything anyone chose** — the same caveat Principle V places on
   `precio`, and the same prohibition: they are not to be read.

   The recipient's **name** left this list on 2026-08-06 and came back the same
   day, once the client clarified. Without it the courier arrives at a door with
   a phone number and no idea who to ask for. The ID did not come back.
2. **Admin Android app** — view packages created via the web, filter/select
   which to carry each day, generate an economical route from the admin's
   position, and give feedback at each lifecycle stage (Creación →
   Aceptación/Recepción → Confirmación → Entrega). **The dashboard is not part
   of this surface** — it is the web tablero above (6.1.0). What the operator
   sees in the app are his working lists.

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

**Version**: 6.1.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-09-11

### Amendment history

- **6.1.0** (2026-09-11) — **The dashboard moves from the Android app's list to
  the web's, for administrators only.** Since 1.0.0 the *Scope boundaries*
  placed "a dashboard with daily totals and historical stats" inside the admin
  app, copied from the client's original brief. The repo owner said on
  2026-09-11 that it was always meant to live on the web — *"es más fácil el
  manejo"* — and that the text had conflated it with what the operator sees in
  the app, which is a different thing: his working lists.

  **MINOR, not MAJOR.** No principle is reversed and no running code becomes
  non-compliant: nothing had been built in either place. The item moves between
  two lists of the same document. **No ADR**, same reasoning as 2.1.0 and
  5.1.0.

  **What does NOT change**: Principle V, word for word. The tablero counts orders
  and packages and shows no amount; the prohibition on reading the stored
  `precio` column applies to it exactly as it did to the dashboard this list
  used to describe. **A tablero that ever needs money on screen is a MAJOR
  amendment**, and the stored column has to be fixed first. Nor does the word
  *historical* carry over: orders withdrawn under `022` are deleted, so the
  total can go down and the screen may not call it historical. See
  `specs/025-dashboard-de-diego/`.

- **6.0.0** (2026-09-10) — **The price comes back for the customer who signs
  in, and only there.** The client's objection was never that the product speaks
  about money; it was that an anonymous visitor got his price list for free. A
  customer with a session, once their delivery point resolves inside a zone,
  sees that zone's amount in the order form. Nothing else, on any surface,
  shows an amount to anybody.

  **MAJOR.** Principle V is redefined and the running code becomes
  non-compliant, not incomplete: a test in the repo
  (`web/lib/sin-precio-a-la-vista.test.ts`) currently fails the build if an
  amount reaches a customer-facing screen at all. That guard is **redefined, not
  deleted** — it must still fail on a public surface, and a second guard must
  fail if an amount is reachable without a session.

  **This puts back half of 5.0.0, and leaves the other half standing.** The
  public side of the door keeps no number, for anyone, signed in or not, and
  there is **no substitute message** for the visitor: no "sign in to see the
  price", no blurred figure. That option was on the table and was declined.

  **What is deliberately NOT lifted**: the prohibition on reading the stored
  `precio` column. Every amount shown is **recalculated** from the delivery
  zone. A customer cannot even see what one of their own past orders cost —
  that column was computed from the **pickup** zone before 2026-08-22 and was
  never the price of that shipment under today's rules. Diego's dashboard
  inherits nothing from this amendment.

  **What this obliges**: the zone amounts in the generated module become a
  **promise**. Editing one is a customer-facing change. The repo owner confirmed
  on 2026-09-10 that they are what the client charges today; if that stops being
  true, the site is quoting a price he will not honour.

  **ADR**:
  [price-behind-the-login](../../docs/decisions/price-behind-the-login.md),
  which also records the uncomfortable part — `price-not-shown` had considered
  this exact option and rejected it on a **guess about the client's motive**.
  Third time this repo has paid a MAJOR amendment for extending something the
  client said one step further than he said it. See
  `specs/024-precio-detras-del-login/`.

- **5.1.0** (2026-08-30) — **The package size and the pickup time leave the
  order form.** The client uses neither today. The pickup time has a business
  reason worth recording: he passes at a fixed hour and coordinates any other
  slot in person, **where the price can go up** — the same instinct that took
  prices off the site in 5.0.0, applied to the input that drives them.

  **MINOR, not MAJOR.** No principle is reversed: the client is narrowing his
  own brief, which is the source this list was derived from. Principles II and
  IV both come out reinforced — two fewer fields on the highest-priority
  surface, one of them a time picker on a phone. Same reasoning as **2.1.0**,
  which retired payment method and the delivery window. **No ADR**: governance
  requires one when a change reverses a prior decision, and this narrows a list
  against its own source.

  **What this obliges**: `014` comments the two fields out rather than deleting
  them —the client said they come back— and the site sends `chico` and `16:00`
  so the service, its `NOT NULL` columns and the Android app need no change at
  all. See `specs/014-campos-en-pausa/`.

  **What it costs**: `paquete_tamano` and `retiro_hora` join `precio` as columns
  that store a placeholder rather than a fact. Three of them now. If that list
  grows again, the question stops being "can we reverse this cheaply" and starts
  being "what is this table for".

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
