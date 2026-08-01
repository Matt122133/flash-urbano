---
owner: flash-urbano
status: stable
last_reviewed: 2026-08-01
update_trigger: on-harness-change
---

# Harness - Operating Manual

The day-to-day manual for how work gets done in this repo with a coding agent.
The why lives in [ADR harness-design](../decisions/harness-design.md) and
[ADR speckit-harness-integration](../decisions/speckit-harness-integration.md).

## Operating principle

**If it is not in the repo, it does not exist.**

Anything the agent must reason over must live as versioned markdown, code, or
schema inside this repo. When a piece of context is load-bearing, capture it
here first. When you finish a session, ask "did I leave anything only in the
chat?" — if yes, move it into the repo or mark it non-authoritative.

## Session bootstrap

Every session starts the same way:

1. Read `AGENTS.md`.
2. Read `docs/README.md`.
3. Scan `specs/*/plan.md` for `status: active`; hold its `covers:` prefixes in
   working context.
4. Scan `docs/decisions/`.
5. Read `ARCHITECTURE.md` before touching code.

## The Workflow

The harness governs spec-kit's artifact pipeline.

| # | Phase | Command(s) | Artifact |
|---|---|---|---|
| 1 | Brief | `/speckit-specify`, `/speckit-clarify` | `specs/<feature>/spec.md` |
| 2 | Decide | manual ADR when warranted | `docs/decisions/<slug>.md` |
| 3 | Plan | `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze` | `specs/<feature>/plan.md`, `tasks.md` |
| 4 | Execute | `/speckit-implement`, `verify:`, `/speckit-converge` | code, tests, docs |

The attended half ends at the human gate: a person reads the analyze output,
fills `analyzed:`, and promotes `plan.md` from `status: draft` to
`status: active`. The unattended half starts only after that gate.

## Hooks

`.specify/extensions.yml` registers five mandatory hooks:

- `before_plan` -> `/speckit-clarify`: no ambiguous spec reaches planning.
- `after_tasks` -> `/speckit-analyze`: inconsistencies surface before the
  human gate.
- `before_implement` -> `/harness-gate`: implementation requires an active,
  analyzed plan and `tasks.md`.
- `after_implement` -> `/harness-verify`: every implementation pass runs the
  plan's `verify:` command.
- `after_converge` -> `/harness-loop`: the loop prints `continue`,
  `stop-converged`, or `stop-cap`.

These hooks are soft controls because skills execute them by instruction. The
hard control is `scripts/harness/check_plan_coverage.py` at pre-commit *when
wired* — `python3 scripts/harness/check_plan_coverage.py --doctor` reports
whether this clone's active hook actually calls it. See [harness-design.md §
Sensor attachment].

## Loop Termination

`scripts/harness/speckit_gate.py loop` maintains
`specs/<feature>/.loop-state.json` and caps unattended execution at five
iterations.

- `continue` means unchecked tasks remain, or verification is still failing,
  and the cap has not been reached.
- `stop-converged` means no unchecked tasks remain and `verify:` is green.
- `stop-cap` means iteration 5 was reached. The command prints remaining
  unchecked tasks for a partial PR comment.

## Phase Gates

| To enter | Required |
|---|---|
| Decide | The feature brief exists in `spec.md` |
| Plan | Ambiguity reviewed by `/speckit-clarify` |
| Execute | One `plan.md` is `active`, `analyzed:` is filled, `tasks.md` exists |
| Done | All tasks complete, `verify:` green, plan set to `completed` |

Do not skip gates under time pressure.

## Session Exit

When the user signals "we're done" / "close out" / "ttyl", before responding:

1. **Build/verify** — if code was touched, run the plan's `verify:` (or the
   build command in `dev-setup.md`). A regression blocks; report it.
2. **Plan state** — the active plan's Progress reflects reality. Split any
   partially-done step into done / remaining.
3. **Doc coherence** — every new/edited doc is indexed in `docs/README.md`.
4. **Chat-sweep** — move any load-bearing knowledge still living only in the
   chat into the repo: rejected options → Decision Log; surprises or follow-up
   work → `docs/tech-debt-tracker.md`; a cross-plan principle → a new ADR.

## Steering Loop

The harness is maintained, not built once. Whenever the agent gets something
wrong — bad plan, wrong code, skipped phase, reinvented an existing helper —
ask one question: **guide missing, or sensor missing?**

- **Missing guide** — the agent didn't know the right thing to do. Fix:
  extend `AGENTS.md`, an ADR, `ARCHITECTURE.md`, or the plan template.
- **Missing sensor** — the agent did the wrong thing and nothing caught it.
  Fix: add a test, a lint rule, or a pre-commit check.

**Never answer "just prompt harder."** A repeat failure is a harness bug.
Every steering pass lands either a guide update or a sensor addition.
