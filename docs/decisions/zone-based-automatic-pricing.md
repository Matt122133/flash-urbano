---
id: zone-based-automatic-pricing
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-02
update_trigger: on-pricing-rule-change
---

# ADR zone-based-automatic-pricing — The site quotes the price itself, from the pickup zone

## Status

Accepted. **Reverses Principle V of the constitution**
(`.specify/memory/constitution.md`), which forbade automatic pricing. The
constitution moves from 1.0.0 to 2.0.0 — a MAJOR bump, because a principle is
redefined rather than clarified.

Authorizes `specs/002-mapa-zonas-precio/`. That spec must not be planned until
this ADR and the constitution amendment are both in place.

## Context

Principle V ("Price and logistics stay manual for now") was written on
2026-08-01 from the client's own answers during requirements gathering:

> pricing is variable, depends on address, has no fixed cost, and there is no
> cap on daily deliveries — Diego prices and accepts jobs manually.

That was an accurate reading of what was known at the time, and it justified a
real constraint: the MVP captured order data and left pricing to the operator.

**The premise has since changed.** The client had in fact already defined a
five-zone pricing scheme, on a Google Maps screenshot he supplied
(`web/design-source/mapa-costos-original.jpeg`): five zones, **a fixed price
for each** — $150, $200, $250, $250, $350 — and, written along each dividing
line, **the named street that forms it**: Ruta 102, Ruta 5, Cno. Ramírez /
La Teja, Av. Aparicio Saravia, Av. Garzón, Av. José Belloni, Irigoyen,
Cno. Maldonado, Cno. Carrasco, Av. de las Américas / Ruta 101.

The client's own artifact contradicts the "no fixed cost" premise Principle V
rested on. Price is not arbitrary; it is a function of pickup zone, and the
client had decided that function before anyone asked him to. What was missing
was never the rule — it was a machine-readable form of it.

That form now exists. On 2026-08-02 those boundaries were traced as polygons
over Google My Maps, following the streets the client named, and exported to
KML (`web/design-source/zonas-flash-urbano.kml`). **The client validated the
result.**

Two further facts make automation viable now, where it was not on 2026-08-01:

- The zones exist as **geometry with real coordinates**, not as a picture. The
  milestone 001 map was an image produced by flood-filling that same
  screenshot; it ignored the street names written on it and inferred
  boundaries from ink, so its limits were the system's guess and were published
  as non-binding reference. Verification of the KML: five polygons, all closed,
  no overlaps (67,600 sampled points; 2 land in two zones, consistent with
  shared edges). Geometry that closes and does not overlap is what makes "which
  zone is this point in" a question with exactly one answer.
- The remaining half of Principle V — manual **logistics** — is untouched.
  Capacity, acceptance, and routing stay with the operator.

Leaving Principle V as written would block the single change with the clearest
line to Principle II (self-service is the core value): today a customer fills
the form and then waits for a price over WhatsApp, which is precisely the
manual round-trip this project exists to remove.

## Decision

**The site computes and displays the price itself. It is the price, not an
estimate.**

- **The pickup zone determines the price.** The customer marks the pickup point
  on a map; a point-in-polygon test resolves the zone. The delivery address is
  captured for the operator but does not affect the price and is not validated
  against the zones.
- **Flat amount per zone.** Not multiplied by package count, not adjusted by
  size. That is what the client's map says; anything else would be a rule
  nobody has defined.
- **Zone boundaries become binding for charging.** This is the substantive
  change. Under milestone 001 the map was decorative and its boundaries were
  explicitly non-binding. They are now the basis on which money changes hands.
- **The named streets are the authority; the polygons are a transcription.**
  Where a polygon departs from the street the client named, the polygon is
  wrong. The street list is recorded as versioned text in
  `specs/002-mapa-zonas-precio/spec.md` § Límites de zona, because until now it
  existed only as pixels inside a JPEG — unverifiable, unquotable in a billing
  dispute, and lost with the file.
- **A point outside all five zones yields no price** and, because marking the
  location is required to submit, blocks the order and routes the customer to
  direct contact. Nearest-zone fallback is forbidden — guessing a zone means
  guessing a price.
- **Logistics stay manual.** No capacity limits, no automatic acceptance, no
  route generation. Only pricing is automated.

**No release gate on boundary validation.** An earlier draft of this ADR
carried one, on the belief that the boundaries were an unconfirmed
interpretation. They are not: the client defined the zones, the prices and the
dividing streets, and validated the traced result. What remains is narrower and
belongs to the feature, not here — confirming visually that each polygon
segment actually runs along the street it is supposed to, since a segment off
by one block changes what a customer is charged.

## Consequences

- Principle V of the constitution is rewritten; the constitution goes to 2.0.0.
  Its scope narrows from "price and logistics" to logistics alone.
- `specs/001-web-mvp/spec.md` § Assumptions is superseded on one point: the
  zone map is no longer published as non-binding reference. That spec stays
  `completed` and is not rewritten — this ADR is the record of the change.
- The zone boundaries become a **data asset with financial consequences**.
  They must stay versioned, regenerable from the client's original file, and
  changeable without touching code. A pricing error is now a repo change, not
  a conversation.
- A wrong boundary is no longer cosmetic. Zone 5 carries the largest exposure —
  it is the most expensive zone, and its polygon is the sparsest (24 vertices
  against 74–125), because Av. de las Américas / Ruta 101 are long straight
  arterials that need few points. Sparse for a good reason, but still the first
  boundary worth checking.
- Boundary streets have width; polygons are lines. A point marked on Av.
  Aparicio Saravia can fall on either side, and $50 turns on it. Accepted: the
  customer marks where the package is, not the centreline of an avenue.
- Charging by pickup zone means a long trip out of a cheap zone is priced as
  cheap: pickup in Zone 1 with delivery in Zone 5 costs $150. Accepted
  deliberately for simplicity and because it matches the real flow — the
  customer files the order standing where the package is. If the operator
  reports losing money on long trips, that is a new decision, not a defect.
- The client can no longer quietly price per job. If he wants to keep that
  freedom for some orders, the site's quote and his invoice will disagree in
  front of the customer. This is the trade-off being accepted.
- Should the client later reinstate variable pricing, this ADR is superseded
  rather than edited, per the repo's ADR convention.

## Notes

Alternative considered and rejected: **show the zone price as a non-binding
reference** ("referencia $250, te confirmamos"). It would have avoided amending
the constitution at all, since the operator would keep the final say. Rejected
by the repo owner: a price the customer cannot rely on leaves the WhatsApp
round-trip in place, which is the thing being removed.

That choice was made while the boundaries were still believed to be
unvalidated, which was the main argument for hedging. They turned out to be
validated, so the decision holds on firmer ground than it was made on — worth
recording, because the reasoning in the transcript is more cautious than the
facts warranted.
