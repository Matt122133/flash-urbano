---
id: pricing-from-delivery-zone
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-22
update_trigger: on-pricing-rule-change
---

# ADR pricing-from-delivery-zone — The price comes from the delivery zone, not the pickup zone

## Status

Accepted. **Reverses Principle V of the constitution again**
(`.specify/memory/constitution.md`), on the same point that
[ADR zone-based-automatic-pricing](zone-based-automatic-pricing.md) settled on
2026-08-02: which end of the trip determines the price. The constitution moves
from 3.0.0 to 4.0.0 — MAJOR, because a principle is redefined and code written
against the old text becomes non-compliant rather than merely incomplete.

Authorizes `specs/011-precio-por-entrega/`. That spec must not be planned until
this ADR and the constitution amendment are both in place.

**Superseded on showing the price** by
[ADR price-not-shown](price-not-shown.md) (2026-08-30): the product stops
displaying an amount anywhere, on the client's decision that he quotes his own
work. **What survives is everything this ADR decided about the delivery point** —
that it is the end of the trip the site resolves, that it is required, that the
map belongs to the delivery section, and that the pickup keeps a silently
resolved point. The point still decides; it just decides admission instead of
money.

## Context

On 2026-08-22 the client (Diego) said, in person, that his zones and prices
were always about **where the package goes**. The site charges by the **pickup**
zone. Both the repo owner and the client describe this as a communication
failure between them, not as a defect somebody introduced: the 2026-08-02 ADR
recorded "pricing is a function of pickup zone" in good faith, from a map whose
zones say nothing about which end of a trip they apply to.

**This is not a precision improvement. It is the wrong price.** Every order
whose pickup and delivery fall in different zones has been charged for the
wrong one. An order leaving Zone 1 ($150) for Zone 5 ($350) was charged $150.

The scale of the exposure is currently zero, and that is the only reason this
is cheap to fix: **nothing has been ordered in production yet**. The mispriced
orders are eight local test rows.

### The prior ADR named this exact outcome, and named the trigger

`zone-based-automatic-pricing` § Consequences:

> Charging by pickup zone means a long trip out of a cheap zone is priced as
> cheap: pickup in Zone 1 with delivery in Zone 5 costs $150. Accepted
> deliberately for simplicity and because it matches the real flow — the
> customer files the order standing where the package is. **If the operator
> reports losing money on long trips, that is a new decision, not a defect.**

The operator has now spoken. This ADR is that new decision, arriving through
the door the old one left open. What the old ADR got wrong was not the risk —
it saw it — but the premise underneath: it treated pickup-based pricing as a
deliberate simplification the client had accepted, when the client had never
been asked.

### What that costs, concretely

- The pickup address is the sender's own; the delivery address belongs to a
  third party the sender may know less well — the street and number, but not the
  corner. **Charging by destination moves the hardest input to the place with
  the least information.** This is inherent to the decision, not a side effect
  that can be designed away.
- Deliveries outside the service area will be more common than pickups outside
  it. A refusal that used to be rare becomes ordinary.

Neither is a reason to charge the wrong price.

## Decision

**The delivery point determines the zone and the price.**

- **The delivery section resolves the street crossing, places the point, and
  shows the map**, with the behaviour the pickup section has today: a candidate
  list when the street name is homonymous, and the point confined to the block
  the customer named.
- **The pickup section loses the map but keeps its point.** The point is
  resolved silently from the text, never displayed, and never requested. It no
  longer decides anything about money. It exists for two things: checking that
  the pickup is inside the service area, and giving the operator's future route
  planner real coordinates.
- **A homonymous pickup street is stored without a point, silently.** Taking the
  first of several candidates stays forbidden — Montevideo has roughly fifty
  families of same-named streets in different neighbourhoods, and picking blind
  would place the pickup in the wrong one without anybody noticing — but the
  answer is to store no point rather than to ask. An earlier draft of this ADR
  said the site asks; **corrected on 2026-08-22, before implementation**, once it
  was clear that asking costs friction on the sender's own address and buys
  nothing that an absent point does not already buy. **The delivery side still
  asks**, because that point is what charges.
- **An unresolvable pickup passes through, silently, without a point.** When the
  text matches no crossing at all, the order is created with the pickup as
  written and no coordinates, and the customer is told nothing. The empty point
  is the signal: whoever operates the system can find those rows on request.
- **The pickup area check is therefore best-effort, and is stated as such.** The
  area is enforced where the point resolves and not where it does not.
- **Nothing else about pricing changes.** Flat amount per zone; computed in the
  browser without the service; a point outside every zone yields no price and no
  order and routes to direct contact; nearest-zone fallback stays forbidden;
  where two zones claim the point the cheaper one wins.

## Consequences

- Principle V is rewritten a second time; the constitution goes to 4.0.0. Its
  substance — the site quotes automatically, from a zone, as a firm price, and
  never guesses — is untouched. What changes is which end of the trip is
  measured.
- **`pedidos.retiro_punto` stops being `NOT NULL`**, and its schema comment,
  which argues "no point means no zone, no zone means no price", stops being
  true. A delivery point column is added — **nullable**.

  It went in as `NOT NULL` first, on the belief that production held no orders.
  **It did, and the deploy took the service down on 2026-08-23**: migrations run
  at startup, so the backend could not boot until the column was relaxed. The
  belief was stated by the repo owner and accepted without checking, for a
  condition that gates whether the service starts. Corrected the same day; see
  `docs/processes/dev-setup.md`.

  **The rule itself did not weaken.** A new order still cannot exist without a
  delivery point — that is enforced by the two service guards, which run on what
  gets created. A `NULL` there means "order predating `011`", which the repeat
  flow already handles (FR-013).
- **The Android admin app must tolerate a pickup without coordinates.** It plans
  a route from the operator's position, and some orders will carry only written
  text. Whoever builds it needs to know before they design around a point that
  is always there.
- **`010`'s repeat-an-order flow changes.** `web/lib/repetir.ts` and its 24 tests
  map the pickup point into the form and re-resolve the price from it; both
  halves move to the delivery point.
- The friction of resolving a crossing moves onto the third party's address.
  Mitigations already exist and are reused, not invented: the corner index, the
  candidate list, and the map that shows where the point landed.
- **The boundary-avenue pricing case does not ride along.** Measured the same
  day: the pickup point of order `FU-0005` sits 0.4 m outside the cheaper zone
  and paid $200 instead of $150. The client deprioritised it explicitly — he
  handles those by hand — so it stays in the tech debt tracker with the
  measurements, and this ADR neither fixes it nor blocks on it.
- Orders already created keep their recorded price. Recomputing them would be
  rewriting history for eight test rows.

## Notes

Two alternatives were considered and rejected.

**Price from whichever of the two zones is more expensive.** It would have
protected the operator on long trips without moving the map, since the pickup
already resolves a point. Rejected: it is not what the client's map says, it
would require the customer to resolve *both* addresses precisely to see a price,
and it invents a rule nobody stated. The client defines the zones; he was not
asking for a new pricing formula, he was correcting which address they apply to.

**Keep the map on pickup as well, so the area check is guaranteed.** Rejected by
the repo owner on 2026-08-22, and correctly: two maps on a phone form is the
opposite of Principle IV, and the check the second map would buy is available
without it — the same resolution runs silently, and the residual gap is recorded
as debt with the query that measures it (`WHERE retiro_punto IS NULL`) rather
than paid for with a screen nobody asked for.
