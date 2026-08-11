---
owner: flash-urbano
status: stable
last_reviewed: 2026-08-11
update_trigger: on-doc-added
---

# Docs Catalog

Entry point for AI context. Read this before any task requiring repo knowledge.
When you add a doc, add a one-line entry to the matching section.

## Repo-root anchors

Top-level docs that live at the repo root, not under `docs/`.

- [`/AGENTS.md`](../AGENTS.md) — agent entry point: operating principle, hard
  constraints, phase gates, session bootstrap. `CLAUDE.md` symlinks to it.
- [`/ARCHITECTURE.md`](../ARCHITECTURE.md) — code map: layout, module pattern,
  dependency direction, bootstrap, hotspots. **Two deployed surfaces** since
  `006`: `web/` (static site) and `backend/` (Go service on Railway).
- [`/backend/README.md`](../backend/README.md) — cómo correr el servicio en
  local, las variables de entorno obligatorias (nombres, nunca valores), y cómo
  levantar la base de pruebas con Docker para que las pruebas contra Postgres
  **no se salteen solas**.
- [`/SECURITY.md`](../SECURITY.md) — security posture: reporting, dependency
  scanning, secrets, auth, trust boundaries.

## Specs and plans

Spec-kit is the active artifact pipeline. Plan-driven work is authorized by
`specs/<feature>/plan.md`.

- `../specs/` — active and completed feature specs, plans, tasks, and design
  artifacts.
- [`PLANS.md`](PLANS.md) — the plan style contract for `specs/<feature>/plan.md`.

## Decisions (ADRs)

- [`decisions/harness-design.md`](decisions/harness-design.md) — why this
  harness exists and what ships.
- [`decisions/speckit-harness-integration.md`](decisions/speckit-harness-integration.md)
  — spec-kit as artifact pipeline, harness as governance layer.
- [`decisions/adr-slug-canonical.md`](decisions/adr-slug-canonical.md) — ADR
  slugs as the canonical identifier.
- [`decisions/zone-based-automatic-pricing.md`](decisions/zone-based-automatic-pricing.md)
  — the site quotes the price itself from the pickup zone; reverses the
  constitution's Principle V (1.0.0 → 2.0.0).
- [`decisions/backend-persistence-stack.md`](decisions/backend-persistence-stack.md)
  — where the backend goes when it is built: the site stays static on GitHub
  Pages, a separate Go service and Postgres with PostGIS run on Railway.
  **Direction only, not in effect.** Flags a conflict with guest ordering that
  the backend spec must resolve.

## Processes

- [`processes/harness.md`](processes/harness.md) — the operating manual.
- [`processes/speckit-loop.md`](processes/speckit-loop.md) — the per-feature
  loop runbook.
- [`processes/dev-setup.md`](processes/dev-setup.md) — toolchain, commands, and
  the plan-coverage check wiring.
- [`processes/dominio-y-dns.md`](processes/dominio-y-dns.md) — estado de
  `flashurbano.uy`, la delegación coja que hay que arreglar, y qué registro DNS
  hace falta para el mail, para el sitio y para el API.
- [`processes/google-oauth.md`](processes/google-oauth.md) — cómo está dado de
  alta el cliente OAuth del *Ingresar con Google*, dónde vive el Client ID, las
  cuatro trampas, y cómo verificar sin abrir un navegador.
- [`processes/railway-despliegue.md`](processes/railway-despliegue.md) — cómo
  está armado el backend en Railway, qué variables tiene y cuáles son relleno,
  y las cuatro trampas del despliegue.

## Trackers

- [`tech-debt-tracker.md`](tech-debt-tracker.md) — known hazards and deferred
  work.
- [`preguntas-cliente.md`](preguntas-cliente.md) — open questions for the client,
  which of them block the backend spec, and what has already been answered.
- [`HARNESS-TODO.md`](HARNESS-TODO.md) — non-blocking checklist of harness
  skeletons the team still needs to fill (delete once all boxes are ticked).
