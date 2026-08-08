---
id: backend-persistence-stack
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-08
update_trigger: on-hosting-or-datastore-change
---

# ADR backend-persistence-stack — Static site on Pages, Go API and Postgres on Railway

## Status

Accepted as **direction**, 2026-08-06. **Deliberately not in effect yet.**

Read this before acting on anything below. **The site stays on GitHub Pages**,
because Pages is free, the client watches his wallet, and the current job is
still letting Diego look at the product and ask for corrections before anyone
starts paying for hosting. Nothing here is implemented today.

What this document is for: so the code written in the meantime knows where it is
going, and so the next spec does not restart the discussion from zero.

**The trigger that puts it in effect**: the decision to persist orders for real.
Until then `output: "export"`, the `GITHUB_PAGES` branch of `next.config.ts` and
`.github/workflows/deploy-pages.yml` stay exactly as they are.

Does **not** reverse any principle of the constitution. Principle III
(simplicity over infrastructure) forbids *premature* infrastructure, and this
ADR is explicit that the moment has not arrived — it names the stack for when it
does. **It does raise a conflict with the constitution's Scope boundaries over
guest ordering**; see *The client's constraint on who can order*, below. That
conflict is flagged here and resolved in the backend spec, not in this document.

Pays the `Medium` row opened in [`tech-debt-tracker.md`](../tech-debt-tracker.md)
on 2026-08-04, which recorded that the backend direction was agreed but
unwritten. Paid by the writing, not by the building.

**This document was revised the same day it was written.** The first version
chose TypeScript on Vercel with Neon. It was rewritten in place rather than
superseded, because it had never taken effect and a superseded ADR that never
applied is noise. The reasoning that changed is recorded in *Notes*.

## Context

Four milestones have shipped with **no backend at all**. The customer web app is
a static export served from GitHub Pages: no server, no database, no auth.

The reason to change is specific. **The order form goes nowhere.** A customer
fills it in, sees a summary screen, and that is the end: nothing is transmitted,
nothing is stored, Diego learns nothing. Principle II — moving intake off
WhatsApp transcription — is unfulfilled while the data has nowhere to land.
`004` sharpened this by removing the `noindex`.

Three things constrain the choice, and all three come from the repo owner rather
than from the code:

- **Cost is the client's, and he watches it.** Free beats cheap, cheap beats
  convenient.
- **The repo owner has production experience with Railway.** For a project this
  size, familiarity with the platform is worth more than any marginal technical
  fit of an unfamiliar one.
- **The repo owner writes Go professionally**; his team is migrating to it.

The Android admin app is phase 2 and does not exist, so persistence without a
reader would be a write-only database: orders would move from being lost on a
summary screen to being lost in a table.

## Decision

**The site stays a static export on GitHub Pages. A separate Go service and a
Postgres database with PostGIS run on Railway.**

- **The frontend does not move.** `web/` stays a Next static export on Pages.
  The build config and the Pages workflow are untouched. Anything built before
  the trigger must keep working as a static export.
- **The backend is a separate Go service on Railway.** Not a Next API route —
  there is no server on Pages to host one.
- **Database: Postgres with the PostGIS extension, on Railway**, alongside the
  API.
- **The architecture is split, and that is the substantive change.** Until now
  there was one artifact. There are now two, on different origins, and the
  consequences of that are the real content of this decision — see below.
- **Language: Go.** The earlier draft chose TypeScript, on the argument that a
  second language means a second service and a second deploy. **That argument
  died with the hosting choice**: the second service exists either way now, so
  Go's main cost was already being paid for another reason. What remains in
  TypeScript's favour is sharing types between form and API, which is real but
  no longer decisive. **The reason for Go is professional, not pedagogical** —
  the repo owner's team is migrating to Go, so he will write better Go than
  TypeScript here and has people to ask. Recorded explicitly because "chosen to
  learn it" and "chosen because it is the better tool for this author" are
  different decisions that age differently.
- **Types are synced by hand, not generated.** The API will have on the order of
  five endpoints. A Go `struct` and a TypeScript `interface` can drift, and
  nothing will catch it — but standing up code generation for five endpoints is
  more machinery than problem. Revisit if the surface grows past roughly twenty.
- **The pickup point is stored as PostGIS geometry from day one**, not as two
  floats. Adding the column correctly now is nearly free; migrating a table of
  real orders is not.
- **No routing engine now.** PostGIS answers distance and containment, not
  routes. Travel time and itinerary are `pgRouting` or a separate engine, they
  consume the street network `003` already built, and they belong to the Android
  app's spec.
- **The price is computed twice, on purpose, and the two computations have
  different jobs.**
  - **The displayed price stays in the client bundle.** `web/lib/zonas.ts` and
    `zona-lookup.ts` are not moved into the database or behind the API.
    Quoting must not depend on a request succeeding — that property was bought
    deliberately in `002` and this ADR does not spend it. It is also what lets
    an unregistered visitor get a quote without an account.
  - **The charged price is decided by the server**, recomputed from the pickup
    point, ignoring any price or zone the request carries. Not an optimisation —
    nothing about it is faster. It is the control that makes the price a price:
    the request is assembled by someone else's browser and can be replayed with
    `curl` carrying `"precio": 1`. `003` already spent real work bounding the
    map pin so the charge could not be gamed by dragging toward a cheaper zone;
    a server that accepts whatever price it is handed would make that control
    decorative.
- **PostGIS is not used for pricing.** Putting the polygons in the database
  would turn "which zone is this point in" into a SQL round trip to answer a
  question that is thirty lines of point-in-polygon. The Go service gets the
  zones as **generated source**, the same way `web/` does. PostGIS earns its
  place for the Android app's proximity ordering, which is real geometry work —
  and that is why the point is stored as geometry from day one.
- **One generator, two outputs.** `web/design-source/build-zonas.js` is extended
  to emit both `web/lib/zonas.ts` and its Go equivalent under `backend/`, from
  the same KML in the same run, so the two cannot drift apart — they are born
  together. A shared fixture of points and expected zones, read by both the
  Vitest and the Go test suites, catches it if they ever do. A disagreement
  between the two implementations is a pricing bug, and it should surface in a
  test run rather than in an invoice.
- **A minimal admin view ships with the persistence.** Not the Android app: no
  route generation, no lifecycle states, no dashboard. The smallest thing that
  makes stored orders readable by the person they are for.

### The client's constraint on who can order

**Diego does not want just anyone creating an order.** This surfaced on
2026-08-06 and it makes his note in the requirements document legible for the
first time. That note reads:

> NO QUISIERA QUE TENGAN UN USUARIO Y CONTRASEÑA (ESTO NO ANTES DE UNA REUNIÓN Y
> YO DARLE EL USUARIO)

Read together, the working interpretation is that **ordering requires being a
client Diego already knows**, and that he grants access himself after meeting
someone — rather than anyone on the internet filing a job for him to do.

This has a consequence that has to be said plainly: **it conflicts with the
constitution.** The Scope boundaries currently specify "guest or Google-login
order creation", and guest ordering is exactly what this removes. Resolving it
means amending the constitution, which is a decision for the repo owner and is
**not taken in this ADR**.

### How that constraint is met

Settled with the repo owner on 2026-08-06 and **confirmed by the client on
2026-08-08**: quoting stays open to anyone, and creating an order requires being
signed in — with Google or with an account in our own system. No anonymous
orders, and no manual approval by Diego. This is no longer an interpretation.

- **Quoting is open; ordering requires an account.** Anyone can enter a street
  and corner, see the point on the map, and see the price, with no account at
  all. Confirming the order is what requires signing in. The wall moves to the
  moment where registering makes sense to the person, and the site keeps working
  as a sales tool for someone who is only comparing prices. It costs nothing to
  implement, because the quote is computed in the browser and never touches the
  API.
- **Sign-up is self-service.** Diego does not approve anyone. "Random" is read
  as *anonymous and untraceable*, not as *unknown to Diego* — and a real Google
  account or a verified email address answers that.
- **Two ways in, no passwords.** Google sign-in, plus a **six-digit code sent by
  email** for anyone who does not use Google. Passwords are excluded on the
  client's explicit instruction, and a "temporary password to change later" was
  considered and rejected: it reintroduces credential storage, recovery flows
  and a change-password screen, still depends on email arriving, and buys
  nothing the code does not already give.
- **The code, concretely**: six digits, valid ten minutes, five attempts before
  it is invalidated, rate-limited per address and per IP, generated with a
  cryptographically secure source and stored hashed. The session it produces
  lasts weeks, so a regular customer asks for a code once and effectively never
  again.
- **Not a cookie.** The API issues its own session token after verifying either
  Google's token or the emailed code, and the browser sends it in a header. This
  is what sidesteps the cross-origin cookie problem the split architecture
  creates — no `SameSite=None`, nothing for Safari to block.
- **Admin access is an environment variable** holding Diego's address, not a
  flag someone has to set by hand in the database. It avoids the question of who
  creates the first administrator.

**A custom domain is a prerequisite for the emailed code**, and this is the one
item that costs the client money. Mail claiming to come from a `@gmail.com`
address cannot be sent through a third-party provider — Google's own
authentication rules reject it — so the options are sending through Gmail's SMTP
with the business's own mailbox, or owning a domain. Owning one is better on
every axis: the codes reach the inbox, the site stops living at
`matt122133.github.io/flash-urbano`, and GitHub Pages serves a custom domain for
free over HTTPS, so it changes nothing about the current hosting.

Product decisions taken in the same conversation, recorded here because they
shape the schema and there is no spec yet to hold them:

- **Three lifecycle states**: `creacion` → `aceptacion` → `entrega`. Not a
  native Postgres enum but a text column with a `CHECK` constraint, precisely
  because the client has not settled them — redefining the list has to be one
  line of migration.
- **No cancellations** for now. States move forward only.
- **The profile mirrors the form.** A signed-in customer's name, phone and
  pickup address live on their user record and pre-fill the form, so nobody
  retypes the same address every time. **The profile pre-fills; the order
  copies.** An order must never read its address through a foreign key to a row
  the user can later edit, or a customer moving house silently rewrites where
  Diego went six months ago.
- **A short human-readable order code** (`FU-0142`) alongside the UUID, from a
  database sequence. Diego refers to orders over WhatsApp and a UUID is unusable
  for that.
- **Nobody home at pickup is handled by Diego calling.** No state, no automatic
  behaviour, nothing for the system to do.

## Consequences

- **Cost is driven by uptime, not by traffic, and that is the answer to the
  throughput worry.** All read traffic — browsing, the zone map, the 0.47 MB
  street index — stays on Pages and never reaches Railway. The API sees only
  writes. At a generous 100 packages a day the backend fields roughly 16,000
  requests a month, about one every three minutes, consuming a few minutes of
  CPU. The database sitting powered on for 730 hours a month costs
  incomparably more. Order volume could grow tenfold without moving the bill.
- **Storage is not a near-term concern either.** An order is text: roughly 1 KB
  with indexes. A hundred a day is about 36 MB a year, and Postgres aggregates
  over hundreds of thousands of rows without effort — ten years of operation is
  a small table. **What will eventually fill the database is images**, if the
  Android app ever stores delivery-proof photos. Those belong in object storage,
  not in Postgres. If the database ever grows strangely, that is the reason to
  check first.
- **This decision is cheap to revise, and that is deliberate.** Railway plans
  scale with a click, and Postgres is portable — `pg_dump` moves it anywhere.
  **The expensive-to-change decision is the data model**, not the host: a table
  with real orders in it gets migrated, not redesigned. Care spent on the schema
  is better spent than care on the plan tier.
- **Cross-origin authentication is the real cost of the split**, and the thing
  most likely to burn a day. The site is on `github.io`, the API on a Railway
  domain: different origins. CORS is routine. Session cookies are not — crossing
  origins requires `SameSite=None; Secure`, and browsers keep tightening on
  that, Safari hardest. A login that works in desktop Chrome and fails on
  Diego's phone is the predictable failure. This must be designed up front, not
  discovered.
- **The repo is public.** The database URL and any auth secret live in Railway
  environment variables and never in the tree. `SECURITY.md` describes a repo
  with no trust boundary; it acquires one here and needs rewriting at
  implementation time.
- **Migrations become a permanent obligation.** Until now a bad data shape was
  fixed by regenerating a file. Once real orders exist, schema changes are
  migrations with a forward path.
- **Nothing changes today, and that has a cost worth stating.** While the site
  stays static, the order form remains a dead end: a customer can fill it in and
  nobody receives anything, on a site that is publicly indexable since `004`. An
  accepted trade while Diego is reviewing rather than taking real orders — it
  stops being acceptable the moment the site is promoted to actual customers.
  Whoever reads this next should check which phase the project is in.
- **`004`'s removal of the recipient's name and ID looks better in hindsight.**
  Had it stayed, the first database would have stored national ID numbers on day
  one, for no use.
- Should hosting or the datastore change, this ADR is superseded rather than
  edited, per [ADR adr-slug-canonical](adr-slug-canonical.md). That clause
  applies from the moment it takes effect.

## Notes

**What changed between the two versions of this ADR, and why.** The first draft
chose TypeScript in the same Next app, on Vercel, with Neon Postgres. Three
corrections, in order of weight:

1. **Vercel's free tier is for non-commercial use.** Flash Urbano is a client's
   business. The recommendation was presented as "free" and was not, for this
   case — the honest comparison was Vercel Pro against Railway's paid tier, and
   Railway wins it.
2. **Keeping Pages was the repo owner's call**, on the grounds that the client
   watches costs and the product is still in review. It is also the reason the
   architecture is split, which nothing in the first draft accounted for.
3. **The Go argument inverted.** It was rejected for costing a second service;
   the hosting decision makes that second service unavoidable, so the objection
   no longer holds.

**Alternative considered and rejected: ship the smallest thing that gets the
order to Diego** — the form posting to email or WhatsApp, no database, no users.
It resolves the dead end in days and keeps the static hosting intact. Rejected
by the repo owner on 2026-08-06 in favour of building persistence properly.
Recorded because it was the recommendation, and because it remains the fallback
if the backend work stretches out while the site is live.

**Alternative considered and rejected: Supabase**, which bundles Postgres,
PostGIS and authentication. Not chosen: the repo owner's Railway experience is
worth more here than a bundled auth answer, especially given the auth
requirements are not yet clarified.
