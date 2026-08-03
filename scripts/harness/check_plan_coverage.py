#!/usr/bin/env python3
"""Plan-coverage check for spec-kit plans.

Refuses a commit whose staged source files are not authorized by the single
active ``specs/<feature>/plan.md``. The check reads plans from the git index,
not the worktree, so an unstaged edit to ``covers:`` cannot authorize a commit.

Stdlib only. Bypass only this check with:

    HARNESS_BYPASS="<reason>" git commit ...
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ALWAYS_ALLOWED_ROOT = {
    "AGENTS.md",
    "CLAUDE.md",
    "ARCHITECTURE.md",
    "SECURITY.md",
    "README.md",
    ".harness-version",
}
ALWAYS_ALLOWED_PREFIXES = ("docs/", "scripts/harness/", "specs/")


def _git(args: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> str:
    # `text=True` sin `encoding` decodifica con el codec del sistema, que en
    # Windows es cp1252. Cualquier plan con acentos hace explotar el hilo lector,
    # `stdout` vuelve None y el sensor crashea con exit 1 — o sea que rechaza
    # todo commit. Los artefactos de este repo estan en espanol, asi que hay que
    # forzar UTF-8.
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    ).stdout


def repo_root(cwd: Path | None = None) -> Path:
    return Path(_git(["rev-parse", "--show-toplevel"], cwd=cwd).strip())


def read_staged(path: str) -> str:
    return _git(["show", f":{path}"])


def staged_files() -> list[str]:
    # --no-renames: a `git mv` must not escape covers: by hiding as an R
    # classification. With rename detection off, git reports the move as a
    # plain delete (old path) + add (new path), so both endpoints land in
    # this list and both must be authorized by `covers:`.
    out = _git(["diff", "--cached", "--name-only", "--no-renames", "--diff-filter=ACMDT"])
    return [line.strip() for line in out.splitlines() if line.strip()]


def staged_plan_files() -> list[str]:
    out = _git(["ls-files", "--cached", "--", "specs/*/plan.md"])
    return [line.strip() for line in out.splitlines() if line.strip()]


def frontmatter(text: str) -> list[str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    try:
        end = lines.index("---", 1)
    except ValueError:
        return []
    return lines[1:end]


def normalize(path: str) -> str:
    hash_idx = path.find(" #")
    if hash_idx != -1:
        path = path[:hash_idx]
    path = path.strip().strip("'\"")
    if path.startswith("./"):
        path = path[2:]
    return path


def parse_scalar(text: str, key: str) -> str:
    prefix = f"{key}:"
    for line in frontmatter(text):
        stripped = line.strip()
        if stripped.startswith(prefix):
            return normalize(stripped[len(prefix):].strip())
    return ""


def parse_covers(text: str) -> list[str]:
    fm = frontmatter(text)
    covers: list[str] = []
    in_covers = False
    for line in fm:
        stripped = line.strip()
        if not in_covers:
            if stripped.startswith("covers:"):
                inline = stripped[len("covers:"):].strip()
                if inline and inline != "[]":
                    items = inline.strip("[]").split(",")
                    return [normalize(item) for item in items if normalize(item)]
                in_covers = inline == ""
            continue
        if stripped.startswith("- "):
            covers.append(stripped[2:].strip())
        elif stripped and not line.startswith((" ", "\t")):
            break
    return [normalize(path) for path in covers if normalize(path)]


def covered(path: str, prefixes: list[str]) -> bool:
    for prefix in prefixes:
        if prefix.endswith("/"):
            if path == prefix.rstrip("/") or path.startswith(prefix):
                return True
        elif path == prefix or path.startswith(prefix + "/"):
            return True
    return False


def active_plans() -> dict[str, list[str]]:
    active: dict[str, list[str]] = {}
    for plan in staged_plan_files():
        content = read_staged(plan)
        if parse_scalar(content, "status") == "active":
            active[plan] = parse_covers(content)
    return active


def check() -> int:
    bypass = os.environ.get("HARNESS_BYPASS")
    if bypass:
        print(f"-> plan-coverage: BYPASSED - reason: {bypass}", file=sys.stderr)
        return 0

    files = staged_files()
    plans = active_plans()
    if len(plans) > 1:
        print("plan-coverage: more than one active spec-kit plan:", file=sys.stderr)
        for plan in plans:
            print(f"    {plan}", file=sys.stderr)
        print("  fix: keep exactly one specs/<feature>/plan.md at status: active", file=sys.stderr)
        return 1

    to_check = [
        path
        for path in files
        if not path.startswith(ALWAYS_ALLOWED_PREFIXES) and path not in ALWAYS_ALLOWED_ROOT
    ]
    if not to_check:
        return 0

    if not plans:
        print("plan-coverage: no active plan; promote a plan to `status: active` or use HARNESS_BYPASS", file=sys.stderr)
        print("  uncovered staged files:", file=sys.stderr)
        for path in to_check:
            print(f"    {path}", file=sys.stderr)
        return 1

    plan_path, prefixes = next(iter(plans.items()))
    uncovered = [path for path in to_check if not covered(path, prefixes)]
    if not uncovered:
        return 0

    print(f"plan-coverage: staged files not authorized by {plan_path} covers:", file=sys.stderr)
    for path in uncovered:
        print(f"    {path}", file=sys.stderr)
    print(f"  covered prefixes: {prefixes or '(none)'}", file=sys.stderr)
    print("  fix: extend covers:, log to docs/tech-debt-tracker.md, or drop the change", file=sys.stderr)
    print('  bypass: HARNESS_BYPASS="<reason>" git commit ...', file=sys.stderr)
    return 1


SENSOR_NAME = "check_plan_coverage.py"


def hooks_path_config(root: Path) -> str:
    result = subprocess.run(
        ["git", "config", "--get", "core.hooksPath"],
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.stdout.strip()


def effective_hook_dir(root: Path) -> Path:
    configured = hooks_path_config(root)
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else root / path
    return root / ".git" / "hooks"


def doctor() -> int:
    root = repo_root()
    hook_dir = effective_hook_dir(root)
    pre_commit = hook_dir / "pre-commit"

    if not pre_commit.exists():
        print(f"doctor: UNWIRED - no pre-commit hook at {pre_commit}", file=sys.stderr)
        print(f"  fix: wire {SENSOR_NAME} into your pre-commit hook, e.g.:", file=sys.stderr)
        print(f'    python3 "$(git rev-parse --show-toplevel)/scripts/harness/{SENSOR_NAME}"', file=sys.stderr)
        return 1

    if SENSOR_NAME not in pre_commit.read_text(encoding="utf-8", errors="ignore"):
        print(f"doctor: UNWIRED - {pre_commit} does not call {SENSOR_NAME}", file=sys.stderr)
        print(f"  fix: add this line to {pre_commit}:", file=sys.stderr)
        print(f'    python3 "$(git rev-parse --show-toplevel)/scripts/harness/{SENSOR_NAME}"', file=sys.stderr)
        return 1

    print(f"doctor: WIRED - {pre_commit} calls {SENSOR_NAME}")
    return 0


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def run_case(
    repo: Path,
    name: str,
    expect: int,
    env: dict[str, str] | None = None,
    args: list[str] | None = None,
) -> bool:
    result = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), *(args or [])],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    ok = result.returncode == expect
    print(f"{name}: {'PASS' if ok else 'FAIL'}")
    if not ok:
        print(result.stdout, end="")
        print(result.stderr, end="", file=sys.stderr)
    return ok


def selftest() -> int:
    if not shutil.which("git"):
        print("selftest: git not found", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="plan-coverage-") as tmp:
        repo = Path(tmp)
        _git(["init"], cwd=repo)
        _git(["config", "user.email", "selftest@example.invalid"], cwd=repo)
        _git(["config", "user.name", "Self Test"], cwd=repo)
        _git(["config", "commit.gpgsign", "false"], cwd=repo)

        write(repo / "specs/001-demo/plan.md", """---
status: draft
covers:
  - internal/
verify: go test ./...
---
# Plan
""")
        write(repo / "internal/demo.go", "package internal\n")
        _git(["add", "."], cwd=repo)

        ok = True
        ok = run_case(repo, "draft-blocks", 1) and ok

        write(repo / "specs/001-demo/plan.md", """---
status: active
covers:
  - internal/
verify: go test ./...
---
# Plan
""")
        _git(["add", "specs/001-demo/plan.md"], cwd=repo)
        ok = run_case(repo, "active-allows", 0) and ok

        write(repo / "specs/002-other/plan.md", """---
status: active
covers:
  - internal/
verify: go test ./...
---
# Plan
""")
        _git(["add", "specs/002-other/plan.md"], cwd=repo)
        ok = run_case(repo, "two-active-aborts", 1) and ok

        _git(["commit", "-m", "active plans"], cwd=repo)
        write(repo / "internal/demo.go", "package internal\n\nconst Demo = 1\n")
        _git(["add", "internal/demo.go"], cwd=repo)
        _git(["reset", "--", "internal/demo.go"], cwd=repo)
        ok = run_case(repo, "two-active-aborts-specs-only", 1) and ok

        env = os.environ.copy()
        env["HARNESS_BYPASS"] = "selftest"
        ok = run_case(repo, "bypass-works", 0, env=env) and ok

        # Back to a single active plan for the rename cases below.
        write(repo / "specs/002-other/plan.md", """---
status: draft
covers:
  - internal/
verify: go test ./...
---
# Plan
""")
        _git(["add", "specs/002-other/plan.md"], cwd=repo)
        _git(["commit", "-m", "demote second plan"], cwd=repo)

        (repo / "other").mkdir(parents=True, exist_ok=True)
        _git(["mv", "internal/demo.go", "other/demo.go"], cwd=repo)
        ok = run_case(repo, "git-mv-outside-covers-blocks", 1) and ok
        _git(["reset", "--hard"], cwd=repo)

        ok = run_case(repo, "doctor-unwired-fresh-repo", 1, args=["--doctor"]) and ok

        hooks_dir = repo / ".git" / "hooks"
        hooks_dir.mkdir(parents=True, exist_ok=True)
        write(hooks_dir / "pre-commit", f'#!/bin/sh\npython3 scripts/harness/{SENSOR_NAME}\n')
        ok = run_case(repo, "doctor-wired-git-hooks", 0, args=["--doctor"]) and ok

        return 0 if ok else 1


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        return selftest()
    if len(sys.argv) == 2 and sys.argv[1] == "--doctor":
        return doctor()
    if len(sys.argv) != 1:
        print("usage: check_plan_coverage.py [--selftest|--doctor]", file=sys.stderr)
        return 2
    return check()


if __name__ == "__main__":
    sys.exit(main())
