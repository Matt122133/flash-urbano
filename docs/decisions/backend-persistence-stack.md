---
id: backend-persistence-stack
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-06
update_trigger: on-hosting-or-datastore-change
---

# ADR backend-persistence-stack — First real backend: Next on Vercel, Postgres with PostGIS on Neon

## Status

Accepted as **direction**, 2026-08-06. **Deliberately not in effect yet.**

Read this part before acting on anything below. The repo owner decided on
2026-08-06 that **the site stays on GitHub Pages for now**, because Pages is
free and the immediate job is still letting Diego look at the product and ask
for corrections before anyone starts paying for hosting. Nothing in this ADR is
implemented today, and **no backend feature is authorized by it yet**.

What this document is for: so that the code being written in the meantime is
written knowing where it is going, and so the next spec does not restart this
discussion from zero.

**The trigger that puts it in effect**: the decision to persist orders for real.
Until that decision is taken, `output: "export"`, the `GITHUB_PAGES` branch of
`next.config.ts` and `.github/workflows/deploy-pages.yml` all stay exactly as
they are.

Does **not** reverse any principle of the constitution. It resolves a question
the constitution left open: Principle III (simplicity over infrastructure)
forbids *premature* infrastructure, and this ADR is explicit that the moment has
not arrived — it names the stack for when it does.

Pays the `Medium` row opened in [`tech-debt-tracker.md`](../tech-debt-tracker.md)
on 2026-08-04, which recorded that the backend direction was agreed but
unwritten. That row is paid by the writing, not by the building.

## Context

Four milestones have shipped with **no backend at all**. The customer web app is
a static export served from GitHub Pages: no server, no database, no auth, no
network calls except the street index fetched as a file. That was a deliberate
reading of Principle III, and it held while the product's job was to be visible
to the client.

It stopped holding for a specific reason. **The order form goes nowhere.** A
customer fills it in, sees a summary screen, and that is the end: nothing is
transmitted, nothing is stored, and Diego learns nothing. The entire premise of
the project — Principle II, moving intake off WhatsApp transcription — is
unfulfilled while the data has nowhere to land. `004` sharpened this by removing
the `noindex`, so the site is now publicly indexable while still being a dead
end.

What the repo owner decided on 2026-08-04, and reaffirmed on 2026-08-06:

- The backend **will exist**, starting with order persistence and users.
- **Postgres with PostGIS**, because the Android admin app has to order
  deliveries by proximity.
- The language stayed open — Go was tempting, TypeScript in the same Next was
  the recommendation.

Two constraints shaped the remaining choices.

**The Android app is phase 2 and does not exist.** Persistence without a reader
is a write-only database: orders would move from being lost on a summary screen
to being lost in a table. Whatever ships here needs a surface where Diego can
see the orders, or it delivers nothing observable and fails Principle I.

**Hosting is the irreversible part.** `next.config.ts` switches to
`output: "export"` under `GITHUB_PAGES=true`, and
`.github/workflows/deploy-pages.yml` publishes `web/out` to Pages on every push
to `master` touching `web/**`. A static export cannot hold a server route, a
session, or a database connection. Adding a backend does not extend that model;
it ends it.

## Decision

**One Next application, TypeScript end to end, deployed on Vercel, talking to a
Postgres database with PostGIS on Neon.**

- **Language: TypeScript, in the existing `web/` Next app.** Not Go. The
  deciding argument is Principle III: a second language means a second service,
  a second deploy, a second dependency set, and a serialization boundary between
  the form and the thing that stores it — for a single-operator courier
  business. Types shared between the order form and the code that persists it
  are worth more here than any property of the language. **Recorded honestly**:
  Go was on the table because the repo owner wants to learn it, which is a
  legitimate reason to choose a language. It was not chosen for this. If it gets
  chosen later, that motive should be written down as the motive rather than
  reconstructed as a technical argument.
- **Hosting: Vercel.** Native Next support with no build configuration, and a
  free tier well beyond what one operator generates.
- **Database: Neon Postgres, with the PostGIS extension enabled from the
  start.**
- **GitHub Pages is retired — but only when the move happens, not now.**
  `output: "export"`, the `GITHUB_PAGES` branch of `next.config.ts`, and
  `.github/workflows/deploy-pages.yml` go away at that point, and the public URL
  changes. **Until then they stay untouched**: Pages is free and it is what
  Diego is looking at while he reviews the product. Anything built in the
  meantime must keep working as a static export.
- **The pickup point is stored as PostGIS geometry from day one**, not as two
  floats. Adding the column correctly now is nearly free; migrating a table of
  real orders later is not.
- **No routing engine now.** PostGIS answers distance and containment, not
  routes. Travel time and itinerary are `pgRouting` or a separate engine, they
  consume the same street network `003` already built, and they belong to the
  Android app's own spec.
- **The zone lookup stays in the client bundle.** `web/lib/zonas.ts` and
  `zona-lookup.ts` are not moved into the database. The price must not depend on
  a request succeeding — that property was bought deliberately in `002` and this
  ADR does not spend it. PostGIS exists here for proximity ordering, not for
  pricing.
- **A minimal admin view ships with the persistence**, on the web, protected. It
  is not the Android app: no route generation, no lifecycle states, no
  dashboard. It is the smallest thing that makes the stored orders readable by
  the person they are for.

**Auth is deliberately not decided here.** The client's own note in the
requirements document reads: *"NO QUISIERA QUE TENGAN UN USUARIO Y CONTRASEÑA
(ESTO NO ANTES DE UNA REUNIÓN Y YO DARLE EL USUARIO)"*. That admits at least two
readings — no passwords for customers at all, versus accounts the client grants
by hand after meeting someone — and they lead to different designs. Guessing
would be inventing a requirement. **The backend spec must clarify this with the
client before it plans an auth model**; until then the working assumption is
that customers keep ordering as guests and only the admin view is protected.

## Consequences

- **The deployment model changes for the first time since `001` — when it
  happens.** Pages was free, dead simple, and had no runtime to attack. Vercel
  introduces a server, environment variables, and a database credential.
  `SECURITY.md` needs revisiting at that point: the repo has had no trust
  boundary until now, and it acquires one here.
- **Nothing changes today, and that has a cost worth stating.** While the site
  stays static, the order form remains a dead end: a customer can fill it in and
  nobody receives anything. The site is publicly indexable since `004`. This is
  an accepted, deliberate trade — the product is still in the phase where Diego
  is reviewing it rather than taking real orders — but it stops being acceptable
  the moment the site is promoted to actual customers. Whoever reads this next
  should check which of the two phases the project is in.
- **The repo is public.** Database URLs and any auth secret must live in Vercel
  environment variables and never in the tree. This was a non-issue while there
  were no secrets.
- **A free tier is a business dependency.** Neon suspends idle databases and
  both providers can change their terms. For one operator's order volume this is
  an acceptable risk, taken knowingly; the exit is that Postgres is portable and
  a plain `pg_dump` moves it anywhere.
- **Vendor lock-in is asymmetric and worth naming.** Postgres is portable.
  Vercel-specific features are not, so the spec should stay on standard Next and
  avoid platform-only APIs unless there is a reason to pay that cost.
- **Migrations become a permanent obligation.** Until now a bad data shape was
  fixed by editing a generated file. Once real orders exist, schema changes are
  migrations with a forward path, and "regenerate it" stops being an option.
- **The order form stops being a dead end**, which is the whole point. It also
  means the first real customer data arrives, and with it retention and privacy
  questions the project has never had to answer.
- **`004`'s removal of the recipient's name and ID looks better in hindsight.**
  Had it stayed, the first database would have been storing national ID numbers
  on day one, for no use.
- **The constitution's scope boundaries stay valid** — the customer web app and
  the Android admin app are still the two surfaces, in that order. The minimal
  admin view is a hedge inside surface one, not a third surface, and should be
  described that way in the spec so it does not quietly grow into the Android
  app's job.
- Should hosting or the datastore change, this ADR is superseded rather than
  edited, per [ADR adr-slug-canonical](adr-slug-canonical.md).

## Notes

**Alternative considered and rejected: ship the smallest thing that gets the
order to Diego** — the form posting to email or WhatsApp, no database, no users.
It resolves the dead end in days, it keeps the static hosting intact, and it
would have let the real data shape inform the schema before any schema existed.
Rejected by the repo owner on 2026-08-06 in favour of building the database
directly. Recorded because it was the recommendation, and because if the
persistence work stretches out, this is the fallback that still exists.

**Alternative considered and rejected: Supabase**, which bundles Postgres,
PostGIS and authentication. It would have answered the auth question for free.
Not chosen: auth is the one piece the client has constraints on and nobody has
clarified them yet, so buying a bundled answer before knowing the question is
backwards.
