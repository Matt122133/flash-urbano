---
owner: flash-urbano
status: living
last_reviewed: 2026-08-08
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
- **Backend service** (`backend/`): Go 1.26+. Nothing beyond the toolchain —
  see `specs/006-backend-auth/research.md` D5 for why there is no HTTP
  framework.
- **Harness scripts** (`scripts/harness/`): stdlib Python >= 3.9, no
  installs. On Windows without a real `python3.exe` on `PATH`, add a shim
  (see `docs/HARNESS-TODO.md`).

### Installing Go on Windows without administrator rights

`winget install GoLang.Go` fails with *no applicable installer* when run
unelevated: Go publishes no user-scope installer, and a machine-scope MSI needs
UAC. The way that works without administrator rights is the official zip:

1. Read the current version from `https://go.dev/VERSION?m=text`.
2. Take the matching `sha256` from `https://go.dev/dl/?mode=json&include=all`
   and **verify the downloaded zip against it before extracting**. This is a
   compiler; do not skip this step.
3. Extract to a user-writable directory. This clone used
   `C:\Users\<user>\golang`, which yields `…\golang\go`.

   Do **not** extract to `C:\Users\<user>\Go`: Windows paths are
   case-insensitive, so it collides with the default `GOPATH` at
   `C:\Users\<user>\go`.
4. Append `…\golang\go\bin` and `…\go\bin` (for `go install`ed tools) to the
   **user** `PATH`. Use `[Environment]::SetEnvironmentVariable("Path", …, "User")`
   after reading the existing value — not `setx`, which truncates at 1024
   characters.

Terminals opened before the change keep the old `PATH`; open a new one.

## Common commands

All web commands run from `web/`.

| Purpose | Command |
|---|---|
| Install deps | `npm install` |
| Run locally | `npm run dev` (http://localhost:3000) |
| Build | `npm run build` |
| Start (prod build) | `npm run start` |
| Lint | `npm run lint` |
| Tests | `npm test` (Vitest). Added in `002`; this row used to say "none yet" |

Backend commands run from `backend/`: `go vet ./...`, `go test ./...`,
`go build ./...`.

## Probar desde un teléfono de la red local

Este repo exige verificación manual **en un teléfono** — es donde el producto se
usa y donde `006` y `007` encontraron lo que ninguna prueba veía. Llegar ahí tiene
cuatro trampas que no producen ningún mensaje de error útil. Escrito el
2026-08-14, después de perder una hora con la tercera.

**`npm run dev` no sirve.** Next bloquea a propósito los assets de desarrollo
pedidos desde un origen que no sea `localhost` (`allowedDevOrigins`). El síntoma
engaña: la página carga pero **no hidrata**, así que se queda congelada en el
estado inicial del componente y parece un cuelgue del sitio.

Se sirve el export estático, construido apuntando a la IP de la máquina en la LAN:

```bash
cd web
GITHUB_PAGES=true NEXT_PUBLIC_API_URL=http://<ip-lan>:8080 npm run build
```

Esa IP tiene que estar en `CORS_ORIGENES` de `backend/.env`
(`http://<ip-lan>:3000`) — **y conviene sacarla al terminar**. El backend se
levanta con `backend/dev.sh`. Después se sirve `web/out` con cualquier servidor
estático que maneje el `trailingSlash` del export: `/pedido/` es una carpeta con
su `index.html`, así que hay que entrar **con la barra final**.

Las cuatro trampas:

1. **El firewall de Windows puede tener reglas de entrada de tipo *Block* por
   programa.** En la máquina de desarrollo actual hay dos para `python.exe`, así
   que `python -m http.server` levanta perfecto, contesta `200` desde la propia
   máquina, y es **inalcanzable desde el teléfono**. Node no las tiene. Agregar
   una regla de *Allow* para el puerto **no arregla nada**: en Windows Firewall el
   bloqueo gana sobre el permiso.
2. **Google no acepta una IP como origen autorizado.** Los orígenes JavaScript
   del cliente OAuth están en [`google-oauth.md`](google-oauth.md) y la consola no
   admite direcciones IP. Desde la LAN hay que entrar por **código de mail**. No
   debilita las verificaciones de la puerta: lo que miden es la puerta y la
   reanudación, no cuál de los dos ingresos se usó — pero **hay que escribirlo en
   la tarea** en vez de tildarla como si hubiera sido con Google.
3. **`http://` no es contexto seguro, y ahí faltan APIs del navegador.** Costó una
   hora: `crypto.randomUUID()` es `undefined` fuera de contexto seguro, tiraba, y
   el botón de confirmar **no hacía nada**. Ya está arreglado (`claveDeIntento` en
   `web/lib/pedido.ts` tiene respaldo) pero la clase sigue viva. **Si algo anda en
   la computadora y no en el teléfono, sospechar de esto antes que del teléfono.**
4. **Windows tiene tomada `web/out` mientras un servidor la sirve**, así que
   `npm run build` falla con `EBUSY` al intentar borrarla. Cortar el servidor
   antes de reconstruir.

Y una que no es trampa sino cuenta pendiente: **las verificaciones que necesitan
una credencial no las puede correr un agente.** `sesiones.token_hash` guarda el
hash, así que el token sólo existe en el navegador —`localStorage`, clave
`flashurbano.sesion`, campo `credencial`—. Cualquier tarea que diga "comprobalo
con `curl` contra `/admin/pedidos`" es de una persona con el navegador abierto.

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

**El `noindex` ya no está.** Se quitó en `004`, cuando el cliente confirmó el
WhatsApp y el email reales. El sitio es indexable desde entonces — cosa que
importa porque el formulario de pedido todavía no le llega a nadie.

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
