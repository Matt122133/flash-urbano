---
id: separate-staging-environment
owner: flash-urbano
status: accepted
last_reviewed: 2026-09-13
update_trigger: on-supersession
---

# ADR separate-staging-environment — Two isolated environments, not two schemas in one database

## Status

Accepted.

## Context

Until now this project has had **one place where the product actually runs**,
and it is the one customers use. Anything the automated tests cannot see — that
an order is created end to end, that the printed label comes out right, that the
app fetches the list — has been checked against the production database and
cleaned up afterwards.

That is not hypothetical. On 2026-09-12 test orders had to be **deleted from the
production database** before showing Diego the tablero, with a runbook written
for the occasion (`docs/processes/railway-despliegue.md`). `026` closed with the
same manoeuvre: a real order was created carrying a comment so that quickstart
Q10 had a positive control, then deleted. Manual cleanup is the symptom; the
cause is that there is nowhere else to test.

The repo owner asked for a staging environment, scoped explicitly: **for him to
test without dirtying production**, not for the client to preview. The initial
constraint he stated was cost — he wanted two real environments but assumed they
were too expensive, and proposed one database with two Postgres schemas instead.

Three options were on the table:

1. **Two schemas in one database.** One Railway environment, one Postgres, a
   second Go service, separated by `search_path`.
2. **Two databases in one Postgres instance.**
3. **Two Railway environments**, each with its own Go service and its own
   Postgres.

### What the schema option actually costs

The schema option looked cheapest and is the one that was nearly chosen. Reading
the code changed that:

- **Nothing in the codebase qualifies a schema.** All SQL is unqualified, and
  `backend/internal/db/db.go:22` builds the pool with a bare
  `pgxpool.ParseConfig(url)`. Separation would hang entirely on a `search_path`
  carried in a connection string.
- **The failure is silent.** Postgres accepts a `search_path` naming a
  non-existent schema without error — it just skips it. With `public` in the
  list, a mistyped or uncreated `staging` schema sends every query to
  **production, and they succeed**. Compare a wrong `DATABASE_URL`, which
  usually fails loudly on an unreachable host or database.
- **PostGIS pushes toward exactly that dangerous form.**
  `0001_esquema_inicial.sql:12` runs `CREATE EXTENSION IF NOT EXISTS postgis`
  and tables use `geography(Point, 4326)`. The extension lives in `public`, so
  `search_path=staging` alone fails to resolve the type. The obvious fix is
  `search_path=staging,public` — the dangerous form. The safe fix is to move
  PostGIS into its own `extensions` schema, which means **the staging work would
  have to modify production once**.
- The migration advisory lock (`backend/internal/db/migrate.go`,
  `pg_advisory_lock(60062026)`) is database-wide, so staging and production
  startups would serialise on it. Harmless but real.

### What the numbers say

The cost premise was measured rather than assumed, on 2026-09-13, by querying
Railway's `usage` API. The returned values carry no unit; the unit was fixed by
anchoring against a known quantity — disk reported `333.57` over an exact
24-hour window, and the volume holds 233 MB, giving `333.57 / 1440 min =
0.2317 GB`. So the unit is **GB-minutes**, and everything else converts.

| Measured (24 h, 2026-09-13) | Average | Cost/month |
|---|---|---|
| `postgis` RAM | 41 MB | US$0.41 |
| `flash-urbano` RAM | 14 MB | US$0.13 |
| Volume | 233 MB | US$0.04 |
| CPU, both services | ~0 | ~US$0.00 |
| **Total** | | **≈ US$0.58** |

The Hobby plan is US$5/month **including US$5 of usage**. Actual consumption is
about 12% of the included credit. Duplicating the whole stack adds roughly
US$0.55/month, for a total near US$1.15 — still inside the credit, so the
out-of-pocket difference between the cheap option and the correct one is
**zero**. Railway does not cap environments on Hobby; the only limit was cost,
and the cost was not there.

Rates used: RAM US$10/GB/month, CPU US$20/vCPU/month, volume US$0.15/GB/month,
billed on consumption.

## Decision

**Two real Railway environments, `production` and `staging`, each with its own Go
service and its own Postgres+PostGIS database.**

The deciding argument is not price — price merely removed the objection. It is
that **Railway's private network is isolated per environment** ("Each
environment has its own isolated network"), and the production database has no
public proxy. A staging service in a separate environment therefore has **no
route at all** to the production database. The isolation is structural, not a
correctly-typed string.

Consequent decisions, recorded here because they follow from the same reasoning:

- **The staging database starts empty.** Production data is not copied. This
  repo is public and its history is permanent; a copy would put real customer
  data in a second place for no benefit that an empty database does not provide.
- **The staging service is not connected to the code repository.** It deploys
  only on demand, from the owner's working copy, with whatever branch he
  chooses. A connected service would redeploy on every push to whatever branch
  it tracked, which makes "manual" untrue and creates a path by which a push
  aimed at production moves staging.
- **There is no staging website.** The site is published from one repository to
  one host, so a second deployed site is disproportionate. The staging web runs
  locally, which costs nothing and needs no change to Google OAuth, because
  `localhost:3000` is already an authorised origin.
- **Staging sends real e-mail, through the same path as production, from a
  different sender.** An environment switch selecting the existing fake sender
  was rejected: it would branch the authentication path, and it would stop
  staging from exercising the real one.

## Consequences

- **MUST NOT** copy production data into staging, by any route.
- **MUST NOT** connect the staging service to the code repository.
- **MUST** keep the production site's backend URL guarded by an automated
  check. This is the one genuinely new risk the decision creates: the site takes
  its API URL from a build-time variable (`web/lib/api.ts:30`), so a build
  published with the staging URL would send **real customers' orders into the
  test database**, silently, until someone noticed orders were missing. A note
  in a document does not discharge this; the check needs a case proving it would
  catch the crossing.
- **Accepted risk: stale staging.** Nothing updates it automatically, so it can
  sit on weeks-old code and produce results that mean nothing. Mitigated by use
  rather than mechanism — deploy immediately before testing — plus a documented
  way to read which version staging is running.
- **Accepted risk: the staging service is reachable from the internet**, because
  that is how the local browser reaches it. No access control of its own is
  added. What stands behind it is an empty, disposable database, a single
  administrator, and a browser origin restricted to one machine.
- PostGIS **stays in `public`**, and the **production database is not touched at
  all** — the worst cost of the schema option, avoided entirely.
- The production **service** does change, in one small way: the health response
  gains a field naming the environment it belongs to, so that pointing a browser
  at the wrong backend is discoverable in one request rather than by noticing
  missing data later. It is read from the platform's own environment variable
  with a safe default, and **cannot prevent the service from starting** — a
  required variable too many is a known way to leave production down. This is a
  deliberate narrowing of "production is not modified": the database is not, the
  code gains one field.
- The migration advisory lock keeps its fixed key. Separate databases mean the
  two environments never contend for it.
- **Cost must be re-measured, not assumed, if usage grows.** The figures above
  come from a 24-hour window on a system with very little traffic, extrapolated
  to a month. They are an estimate, not an invoice.

## Notes

The premise that two environments were unaffordable was the repo owner's, stated
as the reason for preferring schemas, and it was wrong by roughly a factor of
nine in headroom. It is recorded here because the cheap option was close to
being built, and the thing that stopped it was measuring instead of accepting a
plausible constraint.

Related: [ADR backend-persistence-stack](backend-persistence-stack.md) for why
the database is a pinned PostGIS image rather than Railway's template.
