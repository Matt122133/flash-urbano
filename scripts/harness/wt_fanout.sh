#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: wt_fanout.sh {start|collect|status|--selftest}" >&2
}

root_dir() {
  git rev-parse --show-toplevel
}

plan_value() {
  local file=$1 key=$2
  awk -v key="$key:" '
    NR == 1 && $0 == "---" { in_fm=1; next }
    in_fm && $0 == "---" { exit }
    in_fm && index($0, key) == 1 {
      sub(key, "", $0)
      gsub(/^[ \t"'\''"]+|[ \t"'\''"]+$/, "", $0)
      print $0
      exit
    }
  ' "$file"
}

feature_dir() {
  local root=$1
  if [ -f "$root/.specify/feature.json" ]; then
    python3 - "$root" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
data = json.loads((root / ".specify/feature.json").read_text())
feature = data.get("feature_directory")
if feature:
    path = pathlib.Path(feature)
    print(path if path.is_absolute() else root / path)
PY
    return
  fi

  local matches=()
  while IFS= read -r plan; do
    if [ "$(plan_value "$plan" status)" = "active" ]; then
      matches+=("$(dirname "$plan")")
    fi
  done < <(find "$root/specs" -mindepth 2 -maxdepth 2 -name plan.md 2>/dev/null | sort)

  if [ "${#matches[@]}" -ne 1 ]; then
    echo "expected one active specs/*/plan.md, found ${#matches[@]}" >&2
    return 1
  fi
  echo "${matches[0]}"
}

require_active_plan() {
  local feature=$1
  if [ "$(plan_value "$feature/plan.md" status)" != "active" ]; then
    echo "fan-out requires plan.md at status: active" >&2
    exit 1
  fi
}

current_parallel_tasks() {
  local tasks=$1
  awk '
    /^## Phase / { phase += 1 }
    /^- \[ \] T[0-9][0-9][0-9]/ {
      if (first == 0) first = phase
      if (phase == first && $0 ~ /\[P\]/) print
    }
  ' "$tasks" | sed -E 's/^- \[ \] (T[0-9]{3}).*/\1/'
}

start_worktrees() {
  local root feature repo branch task path task_branch
  root=$(root_dir)
  feature=$(feature_dir "$root")
  require_active_plan "$feature"
  branch=$(git -C "$root" branch --show-current)
  repo=$(basename "$root")
  if [ -z "$branch" ]; then
    echo "cannot fan out from detached HEAD" >&2
    exit 1
  fi

  while IFS= read -r task; do
    [ -n "$task" ] || continue
    path="$(dirname "$root")/${repo}-wt-${task}"
    task_branch="wt/${branch}/${task}"
    git -C "$root" worktree add "$path" -b "$task_branch" "$branch" >/dev/null
    echo "$task $path $task_branch"
  done < <(current_parallel_tasks "$feature/tasks.md")
}

worktree_for_branch() {
  local branch=$1
  git worktree list --porcelain | awk -v branch="refs/heads/$branch" '
    /^worktree / { path=$2 }
    /^branch / && $2 == branch { print path; exit }
  '
}

collect_worktrees() {
  local root feature branch task_branch task path
  root=$(root_dir)
  feature=$(feature_dir "$root")
  require_active_plan "$feature"
  branch=$(git -C "$root" branch --show-current)
  if [ -z "$branch" ]; then
    echo "cannot collect from detached HEAD" >&2
    exit 1
  fi

  while IFS= read -r task_branch; do
    [ -n "$task_branch" ] || continue
    task=${task_branch##*/}
    path=$(worktree_for_branch "$task_branch")
    if ! git -C "$root" merge --no-ff --no-edit "$task_branch"; then
      echo "conflict while collecting $task from $task_branch" >&2
      [ -n "$path" ] && echo "left worktree in place: $path" >&2
      exit 1
    fi
    if [ -n "$path" ]; then
      git -C "$root" worktree remove "$path"
    fi
    git -C "$root" branch -d "$task_branch" >/dev/null
    echo "$task collected"
  done < <(git -C "$root" branch --format='%(refname:short)' | grep -E "^wt/${branch}/T[0-9]{3}$" || true)
}

status_worktrees() {
  local root feature branch task_branch task path state
  root=$(root_dir)
  feature=$(feature_dir "$root")
  branch=$(git -C "$root" branch --show-current)
  while IFS= read -r task_branch; do
    [ -n "$task_branch" ] || continue
    task=${task_branch##*/}
    path=$(worktree_for_branch "$task_branch")
    if grep -Eq "^- \[ \] ${task}\b" "$feature/tasks.md"; then
      state=unchecked
    else
      state=checked-or-missing
    fi
    echo "$task ${path:-no-worktree} $state"
  done < <(git -C "$root" branch --format='%(refname:short)' | grep -E "^wt/${branch}/T[0-9]{3}$" || true)
}

selftest() {
  local tmp root
  tmp=$(mktemp -d)
  root="$tmp/repo"
  mkdir "$root"
  git -C "$root" init >/dev/null
  git -C "$root" config user.email selftest@example.invalid
  git -C "$root" config user.name "Self Test"
  git -C "$root" config commit.gpgsign false
  mkdir -p "$root/specs/001-demo"
  cat > "$root/specs/001-demo/plan.md" <<'EOF'
---
status: active
---
# Plan
EOF
  cat > "$root/specs/001-demo/tasks.md" <<'EOF'
## Phase 1: Setup
- [ ] T001 [P] Touch a.txt
- [ ] T002 [P] Touch b.txt
EOF
  touch "$root/README.md"
  git -C "$root" add .
  git -C "$root" commit -m init >/dev/null
  (cd "$root" && "$OLDPWD/scripts/harness/wt_fanout.sh" start) >/dev/null
  echo "one" > "$tmp/repo-wt-T001/a.txt"
  git -C "$tmp/repo-wt-T001" add a.txt
  git -C "$tmp/repo-wt-T001" commit -m T001 >/dev/null
  echo "two" > "$tmp/repo-wt-T002/b.txt"
  git -C "$tmp/repo-wt-T002" add b.txt
  git -C "$tmp/repo-wt-T002" commit -m T002 >/dev/null
  (cd "$root" && "$OLDPWD/scripts/harness/wt_fanout.sh" collect) >/dev/null
  test -f "$root/a.txt"
  test -f "$root/b.txt"
  test ! -d "$tmp/repo-wt-T001"
  test ! -d "$tmp/repo-wt-T002"
  rm -rf "$tmp"
  echo "wt-fanout-selftest: PASS"
}

case "${1:-}" in
  start) start_worktrees ;;
  collect) collect_worktrees ;;
  status) status_worktrees ;;
  --selftest) selftest ;;
  *) usage; exit 2 ;;
esac
