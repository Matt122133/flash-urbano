---
id: adr-slug-canonical
owner: flash-urbano
status: accepted
last_reviewed: 2026-05-29
update_trigger: on-supersession
---

# ADR adr-slug-canonical — ADR slugs as the canonical identifier

## Status

Accepted.

## Context

ADRs need a stable identifier. Numeric prefixes (`001-`, `002-`) drift: when a
decision is scaffolded into an existing repo, it lands at whatever number is
free, so the same decision carries different numbers in different repos, and
prose references like "ADR 003" silently point at the wrong document after any
renumber. Slugs do not drift — they are named once at authorship and survive
every reorganisation.

## Decision

Slugs are the canonical ADR identifier.

- **Filenames** are `docs/decisions/<slug>.md` — no leading number. The slug,
  taken from the file's `id:` frontmatter, is the filename stem.
- **References** use slug form: `ADR <slug>` in prose, `decisions/<slug>.md`
  in markdown links. Numeric forms (`ADR 003`, `decisions/003-<slug>.md`) do
  not appear anywhere.
- Every ADR carries `id: <slug>` in frontmatter alongside the four standard
  keys (`owner`, `status`, `last_reviewed`, `update_trigger`) and follows the
  four-section body: `## Status`, `## Context`, `## Decision`,
  `## Consequences`.
- Sort order in `ls docs/decisions/` is alphabetical by slug. Chronological
  order is recoverable from `last_reviewed:` or
  `git log --diff-filter=A -- docs/decisions/<slug>.md`.

## Consequences

- **MUST** name new ADRs `docs/decisions/<slug>.md`. **MUST NOT** add a numeric
  prefix.
- **MUST** reference ADRs as `ADR <slug>` in prose and `decisions/<slug>.md` in
  links. **MUST NOT** use numeric references.
- The convention is documented, not mechanically checked. Drift can creep back;
  that is an accepted soft trade-off for a small tool.

## Notes

This ADR is the first instance of its own convention: it lives at
`docs/decisions/adr-slug-canonical.md`.
