---
id: speckit-harness-integration
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-01
update_trigger: on-harness-change
---

# ADR speckit-harness-integration — Spec-kit as artifact pipeline, harness as governance layer

## Status

Accepted. Amends [ADR harness-design](harness-design.md) on the literal
vendor-neutrality rule and on where the active plan artifact lives.

## Context

The organization mandates GitHub spec-kit across repositories to standardize
feature specification, planning, task generation, and unattended implementation
loops. This repository adds a harness that governs agent work through Brief,
Decide, Plan, and Execute phases, with two hard controls:

- `covers:` bounds the files an approved plan may touch.
- `verify:` defines the command that proves the change works.

Spec-kit contributes useful artifacts and inferential checks, but it does not
bound file scope, does not execute a feature's verification command during
convergence, and would otherwise generate a plan and authorize it in the same
act. Running both systems independently would create two plan artifacts and no
clear authority.

## Decision

Spec-kit is the artifact pipeline. The harness is the governance layer over it.

Spec-kit owns:

- `spec.md`, the feature brief.
- `/speckit-clarify` and `/speckit-analyze`, the inferential sensors that catch
  ambiguity and inconsistency before implementation.
- `/speckit-implement` and `/speckit-converge`, the unattended loop engine.

The harness owns:

- `covers:`, because spec-kit has no scope-bounding control.
- `verify:`, because converge does not run the codebase's proof command.
- The human approval gate: `/speckit-plan` emits `status: draft`, and only a
  separate human-reviewed promotion to `status: active` authorizes edits.

The single active plan artifact is `specs/<feature>/plan.md`. It carries
`ticket:`, `status:`, `covers:`, `verify:`, and `analyzed:` frontmatter, added
to `.specify/templates/plan-template.md` by the harness.

Spec-kit generated skills under `.claude/skills/speckit-*` and
`.agents/skills/speckit-*` are committed as generated integration artifacts.
They are not hand-edited. Harness-authored hook skills live once under
`.agents/skills/` and are symlinked into `.claude/skills/`.

The constitution is supreme, not owned by the harness. `.specify/memory/constitution.md`
is the highest-authority document, owned by the team via `/speckit-constitution`.
The harness governs *process* (`covers:`/`verify:`/gate/loop), which is
orthogonal to the constitution's *principles*; `AGENTS.md` defers to the
constitution and the plan Constitution Check reads from it. The harness never
authors, overwrites, or deletes it.

The harness therefore edits exactly one spec-kit file —
`.specify/templates/plan-template.md` (frontmatter + a Constitution Check that
points at the constitution). Everything else it adds lives alongside spec-kit
(`.specify/extensions.yml`, the `harness-*` skills, `scripts/harness/`,
`docs/`), connected through spec-kit's native hook mechanism.

### Feature resolution precedence

`resolve_feature_dir` in `speckit_gate.py` follows spec-kit's own resolution
order — `SPECIFY_FEATURE_DIRECTORY` env var, then `.specify/feature.json`,
then a single `status: active` plan as a fallback for repos that haven't run
`specify` yet. spec-kit decides which feature is "current"; the harness does
not override that. What the harness adds on top is independent of that
selection: `gate` still requires exactly one active plan across `specs/`,
even when `feature.json` resolves unambiguously to one of several — because
the pre-commit sensor (Decision, below) reads active plans from the git index
on its own and will reject a commit with more than one, regardless of what
`feature.json` says. `gate` failing early on the same condition keeps it from
approving what the sensor is about to block.

### Spec-kit-first: provisioning over duplicating

Where spec-kit already ships a native command for something, the harness
provisions what that command needs rather than shipping a parallel
implementation of the same capability. The harness is a layer *on* spec-kit;
duplicating spec-kit's own commands works against that, not for it.

This repo's harness (1.0.0) initially shipped `tasks_to_issues.sh`, a
`gh`-based script that converts `tasks.md` into GitHub issues. spec-kit
already generates `/speckit-taskstoissues` for exactly this, but that command
is written against the GitHub MCP server's `list_issues` / `create_issue`
tools with no `gh` fallback — and no repo had that server configured, so the
native command was present but inert. The fix is not a better dedup script;
it's making the native command's prerequisite actually available: the
scaffold provisions a local, Docker-run GitHub MCP server (`.mcp.json`, token
by environment reference, never committed) and `tasks_to_issues.sh` is
retired. `gh` remains the right interface for everything that isn't a
spec-kit command — it's plain CLI, needs no per-agent MCP config, and the
harness's other scripts (`wt_fanout.sh`) still shell out to `git`/`gh`
directly. The distinction is narrow: for the one capability spec-kit already
owns, use spec-kit's path; do not maintain a second one beside it.

## Consequences

- `docs/PLANS.md` is a style contract for `specs/<feature>/plan.md`.
- The pre-commit coverage sensor reads active spec-kit plans from
  `specs/*/plan.md` in the git index and rejects zero or multiple active plans
  whenever staged source files need coverage.
- Hook instructions in `.specify/extensions.yml` are soft controls: agents must
  read and obey them, but there is no runtime enforcement. The pre-commit
  coverage check remains the hard control.
- `/speckit-constitution` step 4 and `/speckit-implement` step 4 are
  neutralized by policy rather than by editing generated skills, because both
  can create drift or write outside the active plan's `covers:`.
- The scaffold provisions a GitHub MCP server (Docker-based) when
  `/speckit-taskstoissues` would otherwise be inert; the harness ships no
  parallel `gh`-based issue-creation script.
