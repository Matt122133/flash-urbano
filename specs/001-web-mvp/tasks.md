---

description: "Task list for 001-web-mvp"
---

# Tasks: Web MVP — sitio de clientes de Flash Urbano

**Input**: `specs/001-web-mvp/plan.md`, `specs/001-web-mvp/spec.md`

**Tests**: No se pidieron tests automatizados en el spec; verificación es
manual/visual para este milestone (ver plan.md § Testing).

## Phase 1: Setup

- [x] T001 Scaffold Next.js 14 + TypeScript + Tailwind project at `web/`
- [x] T002 [P] Configure base layout (`web/app/layout.tsx`) with nav + footer
- [x] T003 [P] Set up shared design tokens (colors, type) in `web/app/globals.css` / `tailwind.config.ts`

## Phase 2: Foundational

- [x] T004 Build `NavBar` component (`web/components/nav-bar.tsx`) linking Home, Pedido, Sobre Nosotros, Contacto, Reseñas
- [x] T005 Build `Footer` component (`web/components/footer.tsx`)
- [x] T006 Build Home page (`web/app/page.tsx`) — hero + CTA to Pedido

**Checkpoint**: Shell del sitio navegable antes de construir cada sección.

---

## Phase 3: User Story 1 - Crear pedido/paquete (P1) 🎯 MVP

**Goal**: Formulario completo de creación de pedido con validación y
confirmación (FR-001 a FR-013).

- [x] T007 [US1] Build `PedidoForm` component (`web/components/pedido-form.tsx`) with all fields from spec.md § Key Entities
- [x] T008 [US1] Wire client-side validation (required fields, phone format) per FR-012
- [x] T009 [US1] Build confirmation state (post-submit summary) per FR-013
- [x] T010 [US1] Build `web/app/pedido/page.tsx` using `PedidoForm`
- [x] T011 [US1] Verify mobile layout (375px) has no horizontal scroll or clipped controls (SC-004)

**Checkpoint**: US1 funcional de punta a punta, independiente del resto.

---

## Phase 4: User Story 2 - Sobre Nosotros (P2)

- [x] T012 [US2] Build `web/app/sobre-nosotros/page.tsx` with hours, delivery-zone visual, historical packages figure (FR-014)

## Phase 5: User Story 3 - Contacto (P2)

- [x] T013 [US3] Build `web/app/contacto/page.tsx` with `wa.me` link and email (FR-015)

## Phase 6: User Story 4 - Reseñas placeholder (P3)

- [x] T014 [US4] Build `web/app/resenas/page.tsx` "próximamente" placeholder (FR-016)

---

## Phase 7: Polish

- [x] T015 [P] Pass `npm run build` clean (plan.md `verify:`)
- [ ] T016 Manual pass in a real browser at mobile + desktop widths with the dev server running

---

## Notes

- Tasks marked `[P]` touch different files with no dependencies on each
  other within their phase.
- T016 is left unchecked deliberately — it needs a human (or a browser tool)
  actually looking at the running site, not just a green build.
