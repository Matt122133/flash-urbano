---
owner: flash-urbano
status: stable
last_reviewed: 2026-08-01
update_trigger: on-harness-change
---

# Spec-kit Loop Runbook

This is the operator path for one feature.

## Attended Half

1. Create the spec:

   ```bash
   /speckit-specify <feature brief>
   /speckit-clarify
   ```

2. Generate the plan and tasks:

   ```bash
   /speckit-plan
   /speckit-tasks
   /speckit-analyze
   ```

3. Read the analyze output. If it is acceptable, edit
   `specs/<feature>/plan.md`:

   ```yaml
   status: active
   analyzed: <date>
   covers:
     - <path/prefix/>
   verify: <command that proves this feature works>
   ```

The gate requires `status: active`, a non-empty `analyzed:`, and `tasks.md`.

## Parallel Fan-out

For unchecked `[P]` tasks in the current phase:

```bash
scripts/harness/wt_fanout.sh start
```

Each worktree is created at `../<repo>-wt-<TASKID>` on branch
`wt/<feature-branch>/<TASKID>`.

After agents finish their task branches:

```bash
scripts/harness/wt_fanout.sh collect
```

If a conflict occurs, stop and fix `tasks.md`; a conflict means the `[P]`
marking was wrong.

Inspect live worktrees:

```bash
scripts/harness/wt_fanout.sh status
```

## Unattended Loop

Run:

```bash
/speckit-implement
/speckit-converge
```

Hooks run `verify:` after implementation and `harness-loop` after convergence.
The loop output means:

- `continue`: run another implement/converge pass.
- `stop-converged`: no unchecked tasks remain and `verify:` is green.
- `stop-cap`: stop after five passes. Open a partial PR and paste the printed
  remaining-work block as a PR comment.

## Issues

To turn `tasks.md` into GitHub issues, use spec-kit's own command:

```bash
/speckit-taskstoissues
```

It deduplicates against existing issues via the GitHub MCP server and assigns
issues to `@me`. Requires the GitHub MCP server (see `docs/processes/dev-setup.md`
§ GitHub MCP server).
