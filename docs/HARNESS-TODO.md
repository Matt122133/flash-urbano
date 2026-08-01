---
owner: flash-urbano
status: living
last_reviewed: 2026-08-01
update_trigger: on-skeleton-filled
---

# Harness onboarding — skeletons to fill

`init-harness-speckit` scaffolds this repo's harness with a few **skeleton**
files that only the team can fill with repo-specific content. This is a
**non-blocking** checklist: you can spec, plan, and ship features before any of
these are filled. Nothing here gates commits or CI. Fill each as you touch the
relevant area, tick its box, and delete this file once every box is checked.

They exist so a coding agent (or a new dev) starting cold has real repo context
instead of placeholders.

## Checklist

- [x] **`ARCHITECTURE.md`** — filled once `001-web-mvp` gave the repo a real
  code layout to describe (`web/`, App Router convention, hotspots).
- [ ] **`SECURITY.md`** — security posture: reporting, secrets, dependency
  scanning, auth/trust boundaries.
  *Done when:* no `> Fill each section` prompts remain.
- [x] **`docs/processes/dev-setup.md`** — filled with the real `web/` stack
  (Next.js 16 + TypeScript + Tailwind) and command table once `001-web-mvp`
  scaffolded it.
- [x] **`docs/decisions/harness-design.md`** — `{{PROJECT_CONTEXT}}` filled
  during scaffold with a paragraph on Flash Urbano (courier web app + admin
  Android app). Revisit if the project scope changes materially.
- [x] **`.specify/memory/constitution.md`** — filled during scaffold with five
  principles derived from the client brief (visual-first MVP, self-service
  data entry, simplicity/YAGNI, mobile-first UI, manual pricing) plus scope
  boundaries and governance. Revisit via `/speckit-constitution` if the
  client's requirements shift materially.

## Conditional items

The scaffold appends these only when it actually hit the condition — they
won't appear in every repo.

- [x] **Symlinks fell back to copies** — Step 6 tried to symlink the four
  `harness-*` skills from `.agents/skills/` into `.claude/skills/`, and Step 9
  tried to symlink `CLAUDE.md` to `AGENTS.md`. On this Windows checkout `ln -s`
  silently created plain copies instead of real symlinks (no
  `SeCreateSymbolicLinkPrivilege` / Developer Mode) — `ln` exits 0 either way,
  so this doesn't surface as an error. If you edit a `harness-*` skill or
  `AGENTS.md`, update both copies by hand (`.agents/skills/<name>/SKILL.md` +
  `.claude/skills/<name>/SKILL.md`; `AGENTS.md` + `CLAUDE.md`), or enable
  Developer Mode / run as admin and recreate the links (delete the copy first,
  then `ln -s ../../.agents/skills/<name> .claude/skills/<name>` /
  `ln -s AGENTS.md CLAUDE.md`).
  *Done when:* both copies are re-synced after edits, or real symlinks are
  restored.
- [x] **`python3` missing on this Windows machine** — the pre-commit hook and
  harness scripts call `python3`, but this checkout only had `python`
  (`python3` hit the Windows Store alias stub). Fixed by adding a shim at
  `C:\Users\USUARIO\bin\python3` (first on `PATH`) that forwards to `python`.
  `check_plan_coverage.py --doctor` confirms `WIRED` and the hook now runs
  clean. This is a per-machine fix, not repo state — a teammate on another
  Windows machine without a real `python3` will need the same shim (or install
  Python via a route that registers `python3.exe`).
  *Done when:* n/a — already fixed on this machine; note for new dev setup.

## When you fill one

Edit the file, delete its prompts/markers, tick its box here. When all boxes are
ticked, delete this file — its job is done.
