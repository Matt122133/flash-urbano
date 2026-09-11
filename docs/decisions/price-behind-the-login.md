---
id: price-behind-the-login
owner: flash-urbano
status: accepted
last_reviewed: 2026-09-10
update_trigger: on-pricing-rule-change
---

# ADR price-behind-the-login — The identified customer sees the price; the anonymous visitor still does not

## Status

Accepted. **Amends Principle V of the constitution for the fourth time**
(`.specify/memory/constitution.md`), moving it from 5.1.0 to 6.0.0 — MAJOR,
because a principle is redefined and code written against the old text ("no
surface shows an amount to anyone", and a test that enforces it) becomes
non-compliant rather than incomplete.

**Amends [ADR price-not-shown](price-not-shown.md) rather than superseding it.**
That ADR decided two separable things, and only one of them falls:

- *The anonymous visitor gets no number.* **Survives, and is the whole point of
  this decision.**
- *Nobody at all gets a number.* **Falls.**

Everything both earlier pricing ADRs decided about **resolving a zone** —
[zone-based-automatic-pricing](zone-based-automatic-pricing.md),
[pricing-from-delivery-zone](pricing-from-delivery-zone.md) — is untouched: the
point, the five polygons, the refusal to guess, the ban on the nearest zone, and
the delivery end of the trip as the one that decides.

Authorizes `specs/024-precio-detras-del-login/`. That spec must not be planned
until this ADR and the constitution amendment are both in place.

## Context

On 2026-09-10 the repo owner relayed a correction from the client (Diego),
after a meeting: *once the customer is logged in and has entered the delivery
address, then the price should be shown. What he did not want was the price
being visible without being logged in.*

That sentence reopens a decision that is eleven days old, and it does it in the
most uncomfortable way available: **`price-not-shown` considered this exact
option and rejected it in writing.** The rejection reads:

> **Show the price only to logged-in customers.** Rejected. It addresses the
> wrong concern — the client does not want the number shown to a smaller
> audience, he wants to be the one who says it.

The client has now said the concern *was* the audience.

### The mistake, named plainly

That rejected alternative was not rejected on evidence. It was rejected on an
**inference about the client's motive** — that his objection was to the product
speaking about money at all, rather than to *who gets to hear it for free* — and
the inference was recorded with the same confidence as the parts of the ADR that
came from the client's own words. Nobody asked him which it was.

This repo has now written down the same failure three times, and it deserves to
be stated as a pattern rather than as three separate lessons:

- `pricing-from-delivery-zone`: the client's map was read as a specification of
  *where the price is measured*, without asking.
- `price-not-shown`: the client's price list was read as a document *meant to be
  published*, without asking.
- This one: the client's objection was read as a *reason*, without asking.

Each time, an artifact or an utterance of the client's was extended one step
past what he actually said, in good faith, and the extension was written down as
established. **The correction always costs a MAJOR amendment**, because by then
the inference has been built into a principle.

### What this is not

It is **not** a reversal of `013` and it should not be described as one. `013`
closed the door and threw away what was on the other side of it. This puts back
what was on the other side. The door — the login — stays exactly where `013`,
`006` and `007` put it, and the public surface of the site stays exactly as
`013` left it: no amounts, for anyone, ever.

It is also **not** a return to public quoting. The constitution's scope
boundaries argued in 1.0.0 that "putting a door in front of the price would
contradict Principle II and cost the business the visitor who was only asking
how much". That argument stays dead. The visitor who only wants to know how much
still leaves with nothing, and **that is the client's deliberate choice**, taken
twice now.

## Decision

**A customer with an active session sees the price of their shipment in the
order form, and nobody else sees a price anywhere.** Concretely:

1. **The amount is a property of the zone, and appears only where the zone is
   named.** It goes inside the block that confirms coverage — today
   `ResultadoZona` in the order form, beside the map where the delivery point is
   marked — and nowhere else: no standalone price line, no total, no figure in a
   pre-confirmation summary or on the confirmation screen, and no other screen
   of the site, the Android app, or anything printed. **No zone named, no
   amount.** The client's instruction was literal — *the price is shown only
   with the zone, nothing more* — and it is stricter than "in the order form",
   deliberately: a total or a summary line is how a price quietly becomes part
   of the transaction rather than a fact about the coverage area.
2. **Session is the gate.** No session, no amount. When a session ends or
   expires with the form open, the amount leaves the screen.
3. **The delivery point is the trigger.** The amount appears only once the
   delivery point resolves inside one of the five zones. Entering the pickup
   address produces no amount — the pickup end does not decide the price and
   must not appear to.
4. **No substitute message for the anonymous visitor.** Where the identified
   customer sees an amount, the visitor sees what `013` put there: the coverage
   confirmation naming the zone, and nothing else. **Rule 2 of `price-not-shown`
   survives unchanged.** No "log in to see the price", no blurred figure.
5. **Every amount shown is recalculated, never read from storage.** The number
   comes from the delivery zone at the moment it is displayed.
6. **The stored `precio` column stays unreadable.** Principle V's prohibition on
   reading it — for a customer's own past order, for revenue, for reporting, for
   a dashboard — is **not** lifted by this decision and is deliberately left
   standing word for word.
7. **The public surface is untouched.** Home, Sobre Nosotros, the zone map and
   its legend and tooltips show no amounts **even to a logged-in customer**. The
   login opens the order form, not the site.
8. **The Android app shows no amount.** It never has; this remains a
   non-regression requirement.

### The condition this rests on

The repo owner confirmed on 2026-09-10 that **the zone amounts in the generator
are the ones Diego charges today**. This is load-bearing. Between 2026-08-30 and
this decision the site showed nothing, so nothing forced those numbers to stay
true; from the day this ships, they are a promise made to a customer.

**Consequence to accept up front: changing a zone price stops being an internal
data edit and becomes a customer-facing change.** Regenerating the zone module
now alters what people are quoted.

## Alternatives considered

**Leave it as it is and let Diego keep quoting by hand.** Rejected by the
client, who asked for the change. Worth recording that the cost of the current
state is real: he answers "how much" by message, one customer at a time, which
is the manual transcription burden this product exists to remove.

**Show the price to everyone again — a full revert of `013`.** Rejected. It is
the half of `013` the client still wants, and he has now said so twice in
eleven days. A full revert would also be the third whipsaw of this principle in
five weeks on the strength of one sentence.

**Tell the anonymous visitor that a price exists — "log in to see how much".**
Rejected, and it was a genuine call. It would make the price an argument for
registering, which plausibly serves the business. It was rejected because it
revokes rule 2 of `price-not-shown` ("no substitute message... the product is
silent on money, not apologetic about it") for a benefit nobody has measured,
and because a blurred or teased number is a worse version of the same idea: to
blur it, the number has to reach the browser, where anyone can read it. **The
repo owner chose the conservative option knowing this.** If registrations matter
more than the silence later, this is the cheapest thing on the list to revisit.

**Show the customer the stored price of their own past orders in *Mis
pedidos*.** Rejected, and this is the sharpest of the four. It reads as an
obvious courtesy — *let people see what their own shipments cost* — and it is a
trap. That column records what the old rule would have charged; for orders
created before 2026-08-22 it was computed from the **pickup** zone, so the
stored number was never the price of that shipment under today's rules. Showing
it would put a figure in front of a customer that they did not pay. Keeping the
column unread is also what keeps this amendment narrow.

**Put the amount on the printable label from `020`.** Rejected. The label is
printed and travels taped to the package, through the hands of whoever handles
it. An amount there is visible to people who never logged in, which dismantles
the exact boundary this decision exists to draw. If Diego later wants a price on
the label, that is a new decision — and a smaller one, because the number is
already computed.

**Do it as a quick edit, without touching the constitution.** Rejected, and it
is the reason this document exists. Principle V currently reads "No surface
shows an amount to anyone", and a test in the repo enforces that sentence. The
change was described as a quick one, and it is — in code. The paperwork is the
work, because the alternative is a highest-authority document that contradicts
the running product.

## Consequences

**The login stops being purely administrative.** Until now the session existed
so Diego would know whose package he is collecting (`006`, `007`). It is now
also what stands between a visitor and the price. That is a product change, not
a screen change, and it should be understood as one: **the incentive to register
has changed**, even though — by rule 4 — the product never says so out loud.

**The zone prices become a promise.** See *The condition this rests on*. From
now on, editing a zone amount changes what customers are quoted.

**The tie-break between overlapping zones becomes visible again.** When two
polygons claim a point, the cheaper zone wins. That rule has had no visible
effect since `013`; it does again, for logged-in customers. It is not being
changed — changing it would alter stored data — but a customer can now observe
its result.

**The `013` guard changes job instead of dying.** `web/lib/sin-precio-a-la-vista.test.ts`
enforces "no amount reaches `app/` or `components/`". That is now false by
design in exactly one place. **It is redefined, not deleted**: it must still
fail if an amount appears on a public surface, and a second guard must fail if
an amount is reachable without a session. Deleting it would leave the half of
this decision the client actually asked for with no automated protection at all
— which is precisely the half a future agent, reading only "show the price",
would break.

**A sentence in this repo's own history is now wrong, and stays visible.**
`price-not-shown`'s rejection of "show the price only to logged-in customers"
is left in place, with a pointer to this ADR. Editing it out would erase the
most useful thing either document records: that the inference was made, and
what it cost.

**Reversal is cheap in both directions.** The number is computed in the browser
either way; showing or hiding it is display. What is not cheap is the
principle's credibility — this is its fourth rewrite, and the second driven by
guessing at a motive instead of asking.

### Trigger to revisit

- If Diego says the zone amounts no longer match what he charges, **this
  decision is unsafe until they do** — the site would be quoting a price he will
  not honour.
- If he asks for the price on the label, in *Mis pedidos*, or in Diego's
  dashboard, each is a separate decision; the third one in particular collides
  with Principle V's prohibition on reading the stored column and would need its
  own amendment.
- If registrations turn out to matter more than the silence, rule 4 (no
  substitute message) is the cheapest thing here to reopen.
