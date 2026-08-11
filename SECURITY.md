---
owner: flash-urbano
status: living
last_reviewed: 2026-08-11
update_trigger: on-trust-boundary-change
---

# Security

Security posture for flash-urbano. Read before touching auth, secrets, or
trust boundaries.

Until `006` this repo had none of the three: the site was a static export with
no server, no database and no credentials. It now has all of them, **and the
repository is public**, so the rules below are load-bearing rather than
aspirational.

## Reporting

There is no public security contact yet, because there is no public security
surface worth one: the product has a single operator and no third-party
integrators. Report anything found to the repository owner directly, privately,
before opening an issue — the repo is public and an issue is a disclosure.

**If a session credential or an API key is exposed, revoking comes first and
diagnosis second.** Sessions: revoked by the owner logging out, or by deleting
the row in `sesiones`. Resend keys: rotated in its dashboard, then updated in
Railway. Google's client ID is public by design and needs no rotation.

## Secrets

**Secrets live only in the deployment environment.** Railway holds the six
required variables; nothing real is ever committed. `config.Cargar()` refuses to
start if one is missing, so a misconfigured deploy fails loudly at boot instead
of quietly at the first login.

Two of them are named `NEXT_PUBLIC_*` and are **not** secrets, deliberately:
they end up inside the JavaScript any visitor can read, so treating them as
secret would be lying to ourselves. They are repository *variables*, not
*secrets*, and the workflow comment says so.

**The known gap, and it is real:** `.env*` is ignored by `backend/.gitignore`,
which only exists on the `backend-auth` branch. Standing on another branch, a
`git add -A` picks up `backend/.env`. It has never reached a commit, but the
protection depends on which branch you are standing on — see the `High` row of
2026-08-11 in [`docs/tech-debt-tracker.md`](docs/tech-debt-tracker.md). Until
that moves to the root `.gitignore`, **stage explicit paths, never `-A`**.

## Dependency scanning

`npm audit` is expected to report zero on `web/`; `web/package.json` carries
`overrides` for exactly that reason, and they should be removed once Next ships
the patched transitive versions. On `backend/`, `govulncheck` is **not wired
yet** — the dependency surface is four direct modules, but "small" is a reason
to check it cheaply, not a reason to skip it. Worth adding when CI is touched.

## Auth and trust boundaries

**The boundary is the service.** `web/` is a static export served from a CDN:
nothing it does can be trusted, and none of its checks are security controls —
they are courtesy. Every decision that matters is re-made in `backend/`.

What authenticates a caller:

- **Google**: an ID token verified against Google's JWKS, checking `aud`, `iss`
  and expiry. **No scopes are requested**, so this is authentication and not
  authorization — which is why Google's "Testing" publishing status does not
  gate it (see [`docs/processes/google-oauth.md`](docs/processes/google-oauth.md)).
- **Email code**: six digits from a cryptographic source, stored under **slow
  hashing** (bcrypt, cost 12 — not a fast digest: a million possible values is
  reversible in seconds under SHA-256), ten minutes of life, five attempts,
  single use.
- **Afterwards**: our own opaque session token, 256 bits, stored as a SHA-256
  digest. Fast hashing is correct *there* precisely because the input is not
  guessable, and it is verified on every request.

Rules the code must not cross:

- **Identity comes from the credential, never from the request body.** `PUT /yo`
  has no identifier field at all, and unknown JSON fields are rejected rather
  than ignored.
- **Being an administrator is computed from configuration and has no column.**
  There is no path from the API to become one, and a test asserts the table has
  no such column — if it existed, there would be somewhere to write it.
- **Responses must not reveal whether an address is registered.** `POST
  /auth/codigo` answers `204` no matter what: user or no user, rate-limited or
  not, provider up or down. Wrong, expired and exhausted codes are one message.
  The accepted cost is that a provider failure is invisible from outside; it is
  logged instead.
- **Rate limits are counted per address and per connection origin**, and the
  origin comes from the **last** `X-Forwarded-For` entry — the one the trusted
  proxy appended. Trusting the first lets anyone bypass the limit by editing a
  string.
- **The audit trail never stores the code or the credential.** There is no
  column for either, and that is deliberate.

Where input is validated: at the handler, before touching the database, and
again by the schema (`CHECK` constraints on the audit trail's enums, `email =
lower(email)`). Coordinates are range-checked; that the saved point falls inside
the declared block is **not** asserted at save time and must be re-verified when
it is used to charge (FR-019b) — that is `007`.

**The weakest link, stated plainly:** the session credential lives in
`localStorage`, and the site's CSP carries `'unsafe-inline'` in `script-src`
because a static export on GitHub Pages cannot do nonces. The CSP therefore
limits `connect-src` — an injected script could read the credential but not ship
it to an attacker's server — but it does not prevent execution. See the `Medium`
row of 2026-08-10 in the tech-debt tracker.
