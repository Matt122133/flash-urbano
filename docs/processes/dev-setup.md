---
owner: flash-urbano
status: living
last_reviewed: 2026-08-01
update_trigger: on-toolchain-change
---

# Developer setup

Local toolchain, day-to-day commands, and the one mechanical harness sensor.
The harness model is described in [harness.md](harness.md).

## Toolchain

- **Web app** (`web/`): Node.js 20.9+ (repo built with Node 22), Next.js 16
  (App Router, Turbopack by default), TypeScript 5, Tailwind CSS 4. Installed
  via `create-next-app`; no separate linter/formatter install needed —
  `eslint` and `eslint-config-next` ship as devDependencies.
- **Harness scripts** (`scripts/harness/`): stdlib Python >= 3.9, no
  installs. On Windows without a real `python3.exe` on `PATH`, add a shim
  (see `docs/HARNESS-TODO.md`).

## Common commands

All web commands run from `web/`.

| Purpose | Command |
|---|---|
| Install deps | `npm install` |
| Run locally | `npm run dev` (http://localhost:3000) |
| Build | `npm run build` |
| Start (prod build) | `npm run start` |
| Lint | `npm run lint` |
| Tests | none yet — not requested for the `001-web-mvp` milestone (see `specs/001-web-mvp/plan.md`) |

## Despliegue (GitHub Pages)

La web se publica como sitio **estático** en GitHub Pages, vía
`.github/workflows/deploy-pages.yml`, en cada push a `mvp-flash-urbano` o
`master` que toque `web/`. URL:
`https://matt122133.github.io/flash-urbano/`.

**Habilitación única, a mano:** Settings → Pages → Build and deployment →
Source: **GitHub Actions**. Sin ese paso el job de deploy falla aunque el
build esté verde.

Reproducir el build de Pages en local:

    cd web
    GITHUB_PAGES=true npm run build      # genera web/out/

Sin esa variable, `npm run build` se comporta como siempre (sin `out/`, sin
`basePath`). La config vive en `web/next.config.ts`.

Tres cosas que rompen y ya están resueltas — no deshacerlas sin entender por
qué están:

1. **`basePath`.** El sitio vive en `…github.io/flash-urbano/`, no en la raíz
   del dominio. Sin `basePath` todos los links y chunks apuntarían a `/` y
   darían 404.
2. **`asset()` en `web/lib/asset.ts`.** Next **no** le agrega el `basePath` a
   los archivos de `public/` cuando las imágenes van sin optimizar, así que el
   logo y el mapa salían como `/logo.png` en vez de `/flash-urbano/logo.png`.
   Toda imagen nueva que salga de `public/` tiene que ir envuelta en
   `asset("/archivo.png")`.
3. **`images.unoptimized`.** `/_next/image` necesita un servidor Node, que en
   Pages no existe. Las imágenes se sirven tal cual, sin redimensionar.

`trailingSlash: true` hace que el export genere `<ruta>/index.html`, que es lo
que sirve cualquier hosting estático sin reglas de reescritura.

**El sitio lleva `noindex`** mientras sea una preview (ver
`web/app/layout.tsx`): tiene teléfono y email de contacto ficticios. Quitarlo
recién cuando los datos de contacto sean reales.

## Plan-coverage check

The one mechanical sensor in this harness. It enforces the hard constraint
"no edits outside the active plan's `covers:`" (`AGENTS.md` § Hard constraints)
at commit time.

The reference implementation lives at
`scripts/harness/check_plan_coverage.py` (stdlib Python >= 3.9, no installs).
Wiring it into pre-commit is a **convention this harness sets up where it
can, not a guarantee** — a repo's existing hook manager (husky, lefthook,
`.pre-commit-config.yaml`, plain `.githooks/`) always takes precedence over
the harness owning `core.hooksPath`. Check whether it's actually wired in
*this* clone:

    python3 scripts/harness/check_plan_coverage.py --doctor

`WIRED` means the line below is already called from your active pre-commit
hook. `UNWIRED` means it isn't — see `docs/HARNESS-TODO.md` for the fix that
applies to this repo's hook manager. The line itself, if you're wiring it by
hand:

    python3 "$(git rev-parse --show-toplevel)/scripts/harness/check_plan_coverage.py"

If this repo has no hook manager of its own, the harness set one up at
`.githooks/pre-commit` and ran `git config core.hooksPath .githooks` for you;
that only needs re-running per clone if `core.hooksPath` doesn't persist in
your git config location of choice:

    git config core.hooksPath .githooks

What the check does:

- Reads staged added, copied, modified, and deleted files from the git index.
- Always allows anything under `docs/`, `specs/`, or `scripts/harness/`, plus
  root anchors `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `SECURITY.md`,
  `README.md`, and `.harness-version`.
- Requires every other staged file to prefix-match a `covers:` entry from the
  single active `specs/<feature>/plan.md`. A trailing `/` covers a directory.
- Fails if more than one `specs/*/plan.md` is `status: active`.
- Prints remediation and exits non-zero on uncovered files.
- Bypasses only this check with `HARNESS_BYPASS="<reason>" git commit ...`.

Verify the sensor and the loop engine after wiring:

    python3 scripts/harness/check_plan_coverage.py --selftest
    python3 scripts/harness/speckit_gate.py selftest

## Adding stack lanes to pre-commit

The plan-coverage step is stack-neutral by design — it's a single line, not a
config format, so it drops into any hook manager. Add lanes for this repo's
stack (format, vet/lint, test on affected packages) before the plan-coverage
line, in whichever file is your active pre-commit hook (`--doctor` above
tells you which one). Keep them fast — they run on every commit.

## GitHub MCP server

`/speckit-taskstoissues` (converts `tasks.md` into GitHub issues) needs the
GitHub MCP server configured — it has no `gh` CLI fallback. If the harness
scaffold wrote `.mcp.json` for you (Docker-based, official GitHub MCP server
image), you still need to:

1. Create a personal access token with `repo` scope. If the org requires SSO,
   authorize the token for it (github.com → Settings → Developer settings →
   Personal access tokens → Configure SSO).
2. Export it in your shell profile — never commit it, never put it in
   `.mcp.json` itself:

       export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...

3. Using Codex instead of / in addition to Claude Code? Codex reads MCP
   servers from `~/.codex/config.toml` (user-global, not part of this repo —
   the harness doesn't write it). Add:

       [mcp_servers.github]
       command = "docker"
       args = ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"]

       [mcp_servers.github.env]
       GITHUB_PERSONAL_ACCESS_TOKEN = "${GITHUB_PERSONAL_ACCESS_TOKEN}"

If `docs/HARNESS-TODO.md` flags Docker as missing, install it first — the
server runs as a container, not a native binary.

## Skipping checks

Skip only plan-coverage for exceptional commits:

    HARNESS_BYPASS="<reason>" git commit -m "..."

Skip the whole hook only when necessary:

    git commit --no-verify

If a check is routinely too slow or wrong, fix the check. Do not route around it
as normal workflow.
