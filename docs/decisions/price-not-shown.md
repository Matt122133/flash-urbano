---
id: price-not-shown
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-30
update_trigger: on-pricing-rule-change
---

# ADR price-not-shown — The product stops showing the price; the operator quotes it himself

## Status

Accepted. **Reverses Principle V of the constitution for the third time**
(`.specify/memory/constitution.md`), moving it from 4.0.0 to 5.0.0 — MAJOR,
because a principle is redefined and code written against the old text becomes
non-compliant rather than incomplete.

Supersedes, **on the question of showing the price only**, both
[ADR zone-based-automatic-pricing](zone-based-automatic-pricing.md) and
[ADR pricing-from-delivery-zone](pricing-from-delivery-zone.md). What survives
from both is everything they decided about **resolving a zone**: the point, the
five polygons, the refusal to guess, the ban on falling back to the nearest
zone. What dies is the last step each of them existed to reach — putting a
number on the screen.

Authorizes `specs/013-precio-fuera-de-vista/`. That spec must not be planned
until this ADR and the constitution amendment are both in place.

## Context

On 2026-08-30 the repo owner relayed a decision the client (Diego) had reached
after thinking it over: **he does not want the subject of price to appear
anywhere in the product.** He sells, and he settles the price with each
customer himself, by his own channel. The site's job narrows to intake — people
load their orders there — and the money is agreed elsewhere.

This is the third time Principle V has been rewritten, and the first time it is
rewritten **away from automation rather than toward it**. Both prior ADRs argued
for the opposite of this one, and neither was wrong at the time: they were
reading a map the client had drawn with prices written on it. The map still has
prices on it. The client simply no longer wants the product to say them.

### What the two prior ADRs assumed, and what changed

`zone-based-automatic-pricing` opened with the observation that the client had
handed over a picture with amounts on it, and concluded that a business which
has already published a price list is a business whose site can quote. That
inference held for four weeks. What it missed is that a price list drawn for
**the operator's own use** is not the same object as a price list published to
customers — and the client had never been asked which one he was handing over.

The pattern is the same one `pricing-from-delivery-zone` named: an artifact of
the client's was read as a specification, in good faith, without asking the
client what it was for. It is worth writing down twice.

### What this is not

It is **not** a discovery that automatic pricing was wrong, broken, or
mispriced. Nothing here says the zone amounts were incorrect or that the
mechanism failed. It is a business decision about who says the number, taken by
the person whose business it is.

## Decision

**No surface of this product shows a price to anyone.** Concretely:

1. **Nothing customer-facing displays an amount** — not the order form, not the
   summary, not the order history, not the map tooltips, not the calls to
   action. And no text justifies an action by appealing to cost.
2. **No substitute message.** Where an amount used to be there is no "we'll
   agree the price by WhatsApp" either. The product is silent on money.
3. **The zone map stays, and changes meaning.** It stops being a price table and
   becomes a statement of coverage: *these are the areas we work, and they are
   not all the same*. The client asked for exactly this. The written zone
   legend stays with it — a map is opaque to anyone who cannot see it.
4. **The zone remains a gate.** Marking the delivery point is still required,
   the point still resolves to one of the five zones, and a point outside all of
   them still produces no order and routes to direct contact. Never the nearest
   zone.
5. **The data is kept.** The price is still computed in the browser, still
   travels with the order, and is still stored. No migration drops a column.
   The reason is reversal: the repo owner asked for this explicitly so the
   decision can be undone cheaply.
6. **The Android app shows no amount.** It never did — the field is parsed and
   never drawn — so this is a non-regression requirement, not a removal.

## Alternatives considered

**Show a range or a "from $X".** Rejected. The client's objection is to the
subject appearing at all, not to the precision of the number. A range is still a
figure he would have to argue against on the phone, and it is worse than a firm
price at the thing a firm price was good at.

**Delete the price from the data too.** Rejected by the repo owner, who asked
for the field to survive so the decision can be rolled back. The cost is
recorded under Consequences and accepted knowingly. Weight on the same side: a
destructive migration in service of a three-day-old product decision is a bad
trade even when the decision turns out to be permanent.

**Drop the zone gate along with the price.** Rejected. The zones were binding
*because* they set the amount, so it is a fair question whether they still bind
anything. They do: the map tells a visitor where this business works, and
accepting an order from outside it would make that a lie. The gate now protects
a promise instead of a payment.

**Show the price only to logged-in customers.** Rejected. It addresses the wrong
concern — the client does not want the number shown to a smaller audience, he
wants to be the one who says it.

**Do it as a quick edit, without touching the constitution.** Rejected, and it
is the reason this document exists. The constitution states that the site
resolves the price without human intervention and shows it *as the price, not an
estimate*. Leaving that sentence standing while the code contradicts it turns
the highest-authority document in the repo into decoration, and the next agent
to read it would build against a rule nobody follows.

## Consequences

**The public half of the value proposition disappears.** The constitution's own
scope boundaries argue that "putting a door in front of the price would
contradict Principle II and cost the business the visitor who was only asking
how much." That reasoning does not become false — it becomes moot, because
there is nothing left on the public side of the door. A visitor without an
account can now fill in a form and not confirm it, and leaves with no number.
**Whether that costs conversions is a real risk and it is the client's to
take**; the site cannot both keep his pricing private and answer the visitor who
only wanted to know how much.

**The order form now asks before it gives.** A person types two addresses, picks
a corner on a map, and gets no figure in return. The confirmation that the
address landed inside the coverage area is what remains of the reward, and it is
why the form still names the resolved zone: without it the product speaks only
to say no.

**A stored number that nobody reads can drift from reality.** From the day this
ships, `precio` records what the old rule *would* have charged, not what Diego
charges. Anyone who later reads that column for revenue, reporting, or a
dashboard will be reading a fiction. This is the price of keeping the rollback
cheap, and it is accepted deliberately. **If the column is ever read for
anything, that is a new decision, not a defect.**

**The tie-break between overlapping zones loses its meaning but keeps its job.**
When two polygons claim a point, the cheaper zone wins. Nothing visible depends
on that any more, but it still decides which `zona_id` is stored. It is left
exactly as it is: changing it would alter stored data, and this decision is
about display.

**The guard that keeps quoting available with the service down survives its own
rationale.** `cotizar-abierto.test.ts` exists so the price could be seen with
the backend dead. There is no price to see now, but the form must still load and
work up to the moment of confirming, so the guard stays — with its reason
restated.

**Reversal is cheap and deliberately so.** Restoring the price is re-adding
display, not recomputing history.

### Trigger to revisit

If Diego reports that customers ask the price before ordering and abandon the
form, or asks for the site to quote again, this decision is reopened — and the
data needed to honour that will already be there.
