#!/usr/bin/env python3
"""Local spec-kit gates for the ms-search harness."""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def repo_root() -> Path:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return Path(result.stdout.strip())
    return Path.cwd()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def frontmatter(text: str) -> list[str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []
    try:
        end = lines.index("---", 1)
    except ValueError:
        return []
    return lines[1:end]


def scalar(text: str, key: str) -> str:
    prefix = f"{key}:"
    for line in frontmatter(text):
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped[len(prefix):].strip().strip("'\"")
    return ""


def active_plan_dirs(root: Path) -> list[Path]:
    dirs: list[Path] = []
    for plan in sorted((root / "specs").glob("*/plan.md")):
        if scalar(read_text(plan), "status") == "active":
            dirs.append(plan.parent)
    return dirs


def feature_from_json(root: Path) -> Path | None:
    feature_json = root / ".specify/feature.json"
    if not feature_json.exists():
        return None
    try:
        data = json.loads(read_text(feature_json))
    except json.JSONDecodeError as exc:
        raise SystemExit(f".specify/feature.json is invalid JSON: {exc}") from exc
    feature_dir = data.get("feature_directory")
    if not feature_dir:
        return None
    path = Path(feature_dir)
    if not path.is_absolute():
        path = root / path
    return path


def feature_from_env(root: Path) -> Path | None:
    env_dir = os.environ.get("SPECIFY_FEATURE_DIRECTORY")
    if not env_dir:
        return None
    path = Path(env_dir)
    return path if path.is_absolute() else root / path


def resolve_feature_dir(root: Path) -> Path:
    # Precedence matches spec-kit's own resolution order (.specify/scripts/bash/common.sh):
    # SPECIFY_FEATURE_DIRECTORY env var, then .specify/feature.json, then a single
    # status: active plan. spec-kit is the source of truth for "which feature";
    # the harness only adds the last fallback for repos that haven't run specify yet.
    from_env = feature_from_env(root)
    if from_env is not None:
        if (from_env / "plan.md").exists():
            return from_env
        raise SystemExit(f"SPECIFY_FEATURE_DIRECTORY has no plan.md: {from_env}")

    from_json = feature_from_json(root)
    if from_json is not None:
        if (from_json / "plan.md").exists():
            return from_json
        raise SystemExit(f"feature_directory has no plan.md: {from_json}")

    active = active_plan_dirs(root)
    if len(active) == 1:
        return active[0]
    if not active:
        raise SystemExit("no active feature: set .specify/feature.json or promote one specs/*/plan.md to status: active")
    names = "\n".join(f"  - {path}" for path in active)
    raise SystemExit(f"multiple active features; set .specify/feature.json:\n{names}")


def plan_text(feature_dir: Path) -> str:
    plan = feature_dir / "plan.md"
    if not plan.exists():
        raise SystemExit(f"missing plan.md: {plan}")
    return read_text(plan)


def verify_command(feature_dir: Path) -> str:
    command = scalar(plan_text(feature_dir), "verify")
    if not command or command.startswith("<"):
        raise SystemExit(f"missing verify: in {feature_dir / 'plan.md'}")
    return command


def run_verify(feature_dir: Path, stream: bool) -> int:
    command = verify_command(feature_dir)
    if stream:
        return subprocess.run(command, cwd=repo_root(), shell=True).returncode
    result = subprocess.run(
        command,
        cwd=repo_root(),
        shell=True,
        capture_output=True,
        text=True,
    )
    return result.returncode


def wiring_warning() -> None:
    """Non-blocking check: is the plan-coverage sensor actually wired into pre-commit?

    feature.json / SPECIFY_FEATURE_DIRECTORY can resolve a single feature even
    when the mechanical sensor that would otherwise enforce it is disconnected
    (e.g. a hook manager like husky overwrote core.hooksPath). This never fails
    the gate — it only surfaces the disconnect so it isn't silently invisible.
    """
    sensor = Path(__file__).resolve().parent / "check_plan_coverage.py"
    if not sensor.exists():
        return
    result = subprocess.run(
        [sys.executable, str(sensor), "--doctor"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(
            "warning: plan-coverage sensor is not wired into pre-commit "
            "(run: python3 scripts/harness/check_plan_coverage.py --doctor)",
            file=sys.stderr,
        )


def gate() -> int:
    root = repo_root()
    wiring_warning()
    feature_dir = resolve_feature_dir(root)
    active = active_plan_dirs(root)
    text = plan_text(feature_dir)
    failures: list[str] = []
    if len(active) > 1:
        names = "\n".join(f"  - {path.relative_to(root)}" for path in active)
        failures.append(f"more than one active specs/*/plan.md (pre-commit will reject this):\n{names}")
    if scalar(text, "status") != "active":
        failures.append("plan.md must be `status: active`")
    if not scalar(text, "analyzed"):
        failures.append("plan.md must fill `analyzed:` with the review date")
    if not (feature_dir / "tasks.md").exists():
        failures.append("tasks.md must exist in the feature directory")

    if failures:
        print("harness gate failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        print("fix: run /speckit-tasks and /speckit-analyze, then promote the plan", file=sys.stderr)
        return 1

    print(f"harness gate passed: {feature_dir.relative_to(root)}")
    return 0


def gate_lite() -> int:
    root = repo_root()
    wiring_warning()
    active = active_plan_dirs(root)
    if len(active) != 1:
        if not active:
            print("harness lite gate failed:", file=sys.stderr)
            print("  - exactly one active specs/*/plan.md is required", file=sys.stderr)
            return 1
        names = "\n".join(f"  - {path.relative_to(root)}" for path in active)
        print("harness lite gate failed:", file=sys.stderr)
        print("  - multiple active specs/*/plan.md files found:", file=sys.stderr)
        print(names, file=sys.stderr)
        return 1

    feature_dir = active[0]
    text = plan_text(feature_dir)
    failures: list[str] = []
    if scalar(text, "status") != "active":
        failures.append("plan.md must be `status: active`")
    if not scalar(text, "analyzed"):
        failures.append("plan.md must fill `analyzed:` with the review date")
    verify = scalar(text, "verify")
    if not verify or verify.startswith("<"):
        failures.append("plan.md must fill a real `verify:` command")

    if failures:
        print("harness lite gate failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"harness lite gate passed: {feature_dir.relative_to(root)}")
    return 0


TASK_RE = re.compile(r"^\s*-\s+\[\s\]\s+(T\d{3})\s+(.*)$")


def unchecked_tasks(feature_dir: Path) -> list[tuple[str, str]]:
    tasks = feature_dir / "tasks.md"
    if not tasks.exists():
        raise SystemExit(f"missing tasks.md: {tasks}")
    unchecked: list[tuple[str, str]] = []
    for line in read_text(tasks).splitlines():
        match = TASK_RE.match(line)
        if match:
            task_id, description = match.groups()
            unchecked.append((task_id, description.strip()))
    return unchecked


def loop() -> int:
    root = repo_root()
    feature_dir = resolve_feature_dir(root)
    state_path = feature_dir / ".loop-state.json"
    try:
        state = json.loads(read_text(state_path)) if state_path.exists() else {}
    except json.JSONDecodeError:
        state = {}
    iteration = int(state.get("iteration", 0)) + 1
    state_path.write_text(json.dumps({"iteration": iteration}, indent=2) + "\n", encoding="utf-8")

    remaining = unchecked_tasks(feature_dir)
    verify_green = False
    if not remaining:
        verify_green = run_verify(feature_dir, stream=False) == 0

    if not remaining and verify_green:
        print("stop-converged")
        return 0
    if iteration >= 5:
        print("stop-cap")
        print()
        print("Remaining work - resume with `/speckit-implement`")
        if remaining:
            for task_id, description in remaining:
                print(f"- {task_id}: {description}")
        else:
            print("- No unchecked tasks remain, but `verify:` is still failing.")
        return 0

    print("continue")
    return 0


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def init_git_repo(path: Path) -> None:
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True, text=True)
    subprocess.run(["git", "config", "user.email", "selftest@example.invalid"], cwd=path, check=True)
    subprocess.run(["git", "config", "user.name", "Self Test"], cwd=path, check=True)


def run_self_case(
    root: Path, args: list[str], env: dict[str, str] | None = None
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), *args],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
    )


def expect(name: str, actual: bool) -> bool:
    print(f"{name}: {'PASS' if actual else 'FAIL'}")
    return actual


def selftest() -> int:
    if not shutil.which("git"):
        print("selftest: git not found", file=sys.stderr)
        return 1

    ok = True
    with tempfile.TemporaryDirectory(prefix="speckit-gate-") as tmp:
        root = Path(tmp)
        init_git_repo(root)
        feature = root / "specs/001-demo"
        write(feature / "plan.md", """---
status: draft
analyzed:
verify: true
---
# Plan
""")
        write(feature / "tasks.md", "- [ ] T001 Do one thing\n")
        result = run_self_case(root, ["gate"])
        ok = expect("gate-draft-blocks", result.returncode == 1) and ok

        write(feature / "plan.md", """---
status: active
analyzed:
verify: true
---
# Plan
""")
        result = run_self_case(root, ["gate"])
        ok = expect("gate-missing-analyzed-blocks", result.returncode == 1) and ok

        write(feature / "plan.md", """---
status: active
analyzed: 2026-07-21
verify: true
---
# Plan
""")
        result = run_self_case(root, ["gate"])
        ok = expect("gate-active-allows", result.returncode == 0) and ok

        (feature / "tasks.md").unlink()
        result = run_self_case(root, ["gate-lite"])
        ok = expect("gate-lite-active-analyzed-verify-allows-without-tasks", result.returncode == 0) and ok

        write(feature / "plan.md", """---
status: active
analyzed:
verify: true
---
# Plan
""")
        result = run_self_case(root, ["gate-lite"])
        ok = expect("gate-lite-missing-analyzed-blocks", result.returncode == 1) and ok

        write(feature / "plan.md", """---
status: active
analyzed: 2026-07-21
verify: true
---
# Plan
""")
        write(feature / "tasks.md", "- [ ] T001 Do one thing\n")
        result = run_self_case(root, ["loop"])
        ok = expect("loop-continue", result.stdout.strip() == "continue") and ok

        write(feature / "tasks.md", "- [x] T001 Do one thing\n")
        result = run_self_case(root, ["loop"])
        ok = expect("loop-stop-converged", result.stdout.strip() == "stop-converged") and ok

        write(feature / "plan.md", """---
status: active
analyzed: 2026-07-21
verify: false
---
# Plan
""")
        write(feature / "tasks.md", "- [ ] T001 Do one thing\n")
        write(feature / ".loop-state.json", '{"iteration": 4}\n')
        result = run_self_case(root, ["loop"])
        ok = expect("loop-stop-cap", result.stdout.startswith("stop-cap\n")) and ok

        # feature.json resolves unambiguously, but a second active plan exists
        # elsewhere: gate must still fail, because pre-commit's plan-coverage
        # sensor (which reads the index independently) will reject the commit.
        write(feature / "plan.md", """---
status: active
analyzed: 2026-07-21
verify: true
---
# Plan
""")
        write(feature / "tasks.md", "- [ ] T001 Do one thing\n")
        write(root / "specs/002-other/plan.md", """---
status: active
analyzed: 2026-07-21
verify: true
---
# Plan
""")
        write(root / ".specify/feature.json", json.dumps({"feature_directory": "specs/001-demo"}) + "\n")
        result = run_self_case(root, ["gate"])
        ok = expect("gate-feature-json-resolves-but-two-active-blocks", result.returncode == 1) and ok

        # SPECIFY_FEATURE_DIRECTORY takes precedence over feature.json (matches
        # spec-kit's own resolution order). Demote the second plan first so
        # only the uniqueness check doesn't interfere with this case.
        write(root / "specs/002-other/plan.md", """---
status: draft
analyzed: 2026-07-21
verify: true
---
# Plan
""")
        write(root / ".specify/feature.json", json.dumps({"feature_directory": "specs/002-other"}) + "\n")
        env = os.environ.copy()
        env["SPECIFY_FEATURE_DIRECTORY"] = "specs/001-demo"
        result = run_self_case(root, ["gate"], env=env)
        ok = expect("gate-env-var-wins-over-feature-json", result.returncode == 0) and ok

    return 0 if ok else 1


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"gate", "gate-lite", "verify", "loop", "selftest"}:
        print("usage: speckit_gate.py {gate|gate-lite|verify|loop|selftest}", file=sys.stderr)
        return 2
    command = sys.argv[1]
    if command == "selftest":
        return selftest()
    if command == "gate":
        return gate()
    if command == "gate-lite":
        return gate_lite()
    feature_dir = resolve_feature_dir(repo_root())
    if command == "verify":
        return run_verify(feature_dir, stream=True)
    if command == "loop":
        return loop()
    return 2


if __name__ == "__main__":
    sys.exit(main())
