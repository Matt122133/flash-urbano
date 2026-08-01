# Flash Urbano Constitution

## Core Principles

### I. Visual-first MVP
Every phase of this project ships something the client (Diego) can see and
react to before deeper investment goes into it. The web app for customers
comes before the Android admin app, and within the web app, the package
creation flow (the core value proposition) comes before secondary sections
(Sobre Nosotros, Contacto, Reseñas). Reseñas is explicitly deferred to last
per the client brief. Prefer a working, visually presentable slice over a
complete but invisible backend.

### II. Self-service data entry is the core value
The entire premise of this project is moving package intake from Diego
manually transcribing WhatsApp messages to customers entering their own
data (name, phone, composed address, package type/description, pickup and
delivery windows, who retrieves it). Any design or technical decision that
makes self-service entry slower, more confusing, or optional undermines the
product's reason to exist. The package creation form is the single
highest-priority surface in the web app.

### III. Simplicity over infrastructure (YAGNI)
This is a single-operator courier business, not a multi-tenant platform.
No premature scaling, multi-region infra, microservices, or speculative
abstractions. Start with the simplest stack that satisfies the client brief
(guest + Google-login order creation, an admin view, basic route support)
and only add complexity when a real, stated requirement demands it.

### IV. Mobile-first, low-friction UI
Customers will overwhelmingly fill out the order form from a phone, often
right after a WhatsApp conversation. Forms, navigation, and the address
composition fields (calle, número, apto, esquina, cooperativa) must work
cleanly on small screens with minimal typing and clear validation.

### V. Price and logistics stay manual for now
Per the client's answers: pricing is variable, depends on address, has no
fixed cost, and there is no cap on daily deliveries — Diego prices and
accepts jobs manually. The MVP does not attempt automatic pricing or
capacity limits; it only captures the data needed for him to decide and
plan a route.

## Scope boundaries

Two surfaces, built in this order:

1. **Customer web app** — guest or Google-login order creation, address
   capture, package type/description, payment method, pickup/delivery
   windows, retriever info; Sobre Nosotros (hours, delivery zone map,
   historical volume); Contacto (WhatsApp, email); Reseñas (last, deferred).
2. **Admin Android app** — view packages created via the web, filter/select
   which to carry each day, generate an economical route from the admin's
   position, and give feedback at each lifecycle stage (Creación →
   Aceptación/Recepción → Confirmación → Entrega), plus a dashboard with
   daily totals and historical stats.

No physical storefront exists; the business is pickup-and-delivery only —
nothing in the product should assume a walk-in location.

## Development workflow

This repo runs the harness (see `AGENTS.md`, `docs/processes/harness.md`) as
a governance layer over spec-kit. Every feature goes through Brief → Decide →
Plan → Execute; no code without an active, analyzed `specs/<feature>/plan.md`;
no edits outside that plan's `covers:`; not done until `verify:` is green.
Given Principle I (visual-first), plans for early milestones should scope
tightly to a demonstrable slice rather than the full feature surface at once.

## Governance

This constitution supersedes ad hoc practices and client-doc reinterpretation.
Amendments require updating this file plus a matching entry in
`docs/decisions/` when the change reverses a prior decision. `AGENTS.md` and
the spec-kit plan template's Constitution Check defer to this document as the
highest authority in the repo.

**Version**: 1.0.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-01
