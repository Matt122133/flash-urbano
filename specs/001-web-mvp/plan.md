---
ticket: none
status: active
covers:
  - web/
  - specs/001-web-mvp/
  - .github/
verify: cd web && npm run build
analyzed: 2026-08-01
---

<!--
Harness frontmatter:
- ticket: known Jira key, or none when there is no ticket.
- status: draft until a human promotes the analyzed plan to active.
- covers: repository-relative path prefixes this feature may edit.
- verify: command that proves the feature works; run until green.
- analyzed: date the /speckit-analyze report was read before promotion.

Promotion note: this plan skipped a separate interactive /speckit-clarify and
/speckit-analyze pass because the client's requirements doc already resolved
the open questions that mattered (pricing model, delivery cap, no physical
location) and the remaining ambiguity is flagged inline in spec.md
(FR-007, payment methods). The user asked to apply the harness setup and move
straight into a visual MVP; promotion to `active` reflects that explicit
instruction. Treat this note as the `analyzed:` record for this plan.
-->

# Implementation Plan: Web MVP — sitio de clientes de Flash Urbano

**Branch**: `001-web-mvp` | **Date**: 2026-08-01 | **Spec**: `specs/001-web-mvp/spec.md`

**Input**: Feature specification from `specs/001-web-mvp/spec.md`

## Summary

Construir el sitio web público de Flash Urbano: un formulario de creación de
pedido/paquete (P1, la funcionalidad central), y las secciones Sobre
Nosotros, Contacto (P2) y un placeholder de Reseñas (P3). Sin backend real
todavía — el formulario valida y confirma en el cliente. Prioridad: que Diego
tenga algo visual y navegable para dar el primer feedback.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 20+

**Primary Dependencies**: Next.js 14 (App Router), React 18, Tailwind CSS

**Storage**: N/A en este milestone (ver spec.md § Assumptions — persistencia
real es un milestone siguiente)

**Testing**: Manual (visual/responsive check en esta etapa); sin suite
automatizada todavía — no se pidió en el spec

**Target Platform**: Web, mobile-first (navegadores modernos, ≥360px)

**Project Type**: Web app (frontend-only en este milestone; carpeta `web/`)

**Performance Goals**: N/A para este milestone — priorizar time-to-visual
sobre optimización

**Constraints**: Sin OAuth real, sin base de datos.

**Despliegue** (agregado sobre la marcha el 2026-08-01, a pedido del cliente
interno, para poder mostrarle el MVP a Diego por link): GitHub Pages, sitio
estático, publicado por GitHub Actions desde `.github/workflows/deploy-pages.yml`.
Esto amplió el `covers:` de este plan con `.github/`. Implica `output: "export"`
más `basePath` — activado solo cuando el workflow define `GITHUB_PAGES=true`,
así el desarrollo local no cambia. Detalle y trampas en
`docs/processes/dev-setup.md` § Despliegue.

**Scale/Scope**: Un solo operador (Diego); sin requisitos de escala

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution compliance: honra Principio I (visual-first: se construye el
  slice visible antes que backend/auth reales), Principio II (el formulario
  de pedido es la superficie #1), Principio III (Next.js + Tailwind, sin
  infra extra), Principio IV (mobile-first explícito en Technical Context),
  Principio V (no se automatiza precio/capacidad).
- Plan-bounded change (harness): `covers: web/, specs/001-web-mvp/` — todo el
  código de esta feature vive bajo `web/`.
- Verified before done (harness): `verify: cd web && npm run build` — el
  build de Next.js debe pasar sin errores de tipo ni de lint bloqueante.

## Project Structure

### Documentation (this feature)

```text
specs/001-web-mvp/
├── plan.md              # This file
└── spec.md              # Feature spec
```

(No `tasks.md` separado; las tareas están en la sección siguiente por ser un
milestone chico de un solo story principal.)

### Source Code (repository root)

```text
web/
├── app/
│   ├── layout.tsx            # Layout raíz, nav + footer
│   ├── page.tsx               # Home
│   ├── pedido/page.tsx        # US1 - formulario de creación de pedido
│   ├── sobre-nosotros/page.tsx  # US2
│   ├── contacto/page.tsx      # US3
│   └── resenas/page.tsx       # US4 - placeholder
├── components/
│   ├── nav-bar.tsx
│   ├── footer.tsx
│   └── pedido-form.tsx        # Formulario US1, con validación
├── public/                    # Assets estáticos (ilustración de zona, etc.)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

**Structure Decision**: Proyecto Next.js único bajo `web/` (no hay backend
separado en este milestone, así que no aplica el layout `backend/` +
`frontend/`). Cuando se agregue persistencia real, ese milestone decide si
suma `app/api/` (rutas de Next.js) o un backend aparte — decisión diferida a
su propio plan.

## Complexity Tracking

*(vacío — el Constitution Check no tiene violaciones que justificar)*
