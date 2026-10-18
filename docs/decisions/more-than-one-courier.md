---
id: more-than-one-courier
owner: flash-urbano
status: accepted
last_reviewed: 2026-10-18
update_trigger: on-courier-role-or-assignment-change
---

# ADR more-than-one-courier — The courier role lives in configuration, and an order's courier is fixed when it is delivered

## Status

Accepted. Amends the constitution from 6.2.0 to **6.3.0 (MINOR)**: Principle III
stops saying "single-operator", and the *Scope boundaries* describe the Android
app as the couriers' and add a per-courier cut to the tablero. No principle is
reversed and Principle V is untouched.

Authorizes `specs/031-repartidores/`.

Fires the `on-second-courier-or-delivery-failure` trigger of
[ADR push-as-the-only-alert](push-as-the-only-alert.md). The push channel stays
the only automatic alert; what changes is **who** it reaches: a courier receives
the notice of an order handed to them, and the edit and withdrawal notices of
the orders they hold. The new-order notice still goes to administrators only.

## Context

On 2026-10-18 the repo owner relayed that the client is adding a second person
to deliver packages. The client wants to hand orders to that person from the
app, and at month's end to know which orders they delivered, because he pays
per package delivered. The payment itself stays off this product.

Until now the product assumed one person in the street: every order was the
operator's, and the app was his tool.

## Decision

1. **The courier role is configuration.** A new optional environment variable,
   `REPARTIDOR_EMAILS`, with the same normalization as `ADMIN_EMAILS`. A mail in
   both lists is an administrator. Empty or absent means no couriers, and the
   service starts exactly as before. Adding or removing a courier is a
   configuration change and a redeploy, never SQL.
2. **An order's courier is a nullable mail on the order**
   (`pedidos.repartidor_email`), with no foreign key — the courier may never
   have signed in, so there may be no `usuarios` row to point at. Null means
   "the administrators'". Every order is born null, and the orders that existed
   before stay null without a single row being rewritten.
3. **The courier is fixed when the order is delivered.** The assignment update
   refuses an order in `entrega`, so the column itself is the frozen record; no
   second column. Undoing the delivery unfreezes it.
4. **The effective owner is computed when read.** An undelivered order whose
   mail is no longer a configured courier reads as the administrators', so
   removing a courier never strands orders and never needs a cleanup write. A
   delivered order keeps its courier regardless, so a month already paid does
   not change.
5. **The same routes, scoped by role.** The courier uses the `/admin/pedidos`
   routes the app already calls, and the service narrows them to the caller's
   orders; another courier's order answers 404, the same as an order that does
   not exist. The response only gains keys, so the app installed today keeps
   working against the new service.

## Alternatives considered

- **A `type` column on `usuarios` (`admin` / `delivery` / `client`).** The repo
  owner's first proposal. Rejected: it reverses FR-022 of `006` — today no
  database edit can grant a permission, and with that column any row edit
  would. It would also turn adding a courier into SQL against production, and
  administrators would end up defined in two places.
- **Recording who delivered, separately from who was assigned.** Rejected by
  the owner: each person sees only their own orders, so only the assignee can
  mark the delivery, and the assignment already says who carried it. Fixing the
  assignment at delivery gives the payment report a stable answer without a new
  fact.
- **Clearing the column when a courier is removed from configuration.**
  Rejected: a mass write at startup, against a table with data — the class of
  change that took production down in `0004`. Computing the owner on read costs
  one function and a table test.
- **Separate `/repartidor/...` routes.** Rejected: duplicated handlers for
  identical actions, and an app version that would have to switch routes.

## Consequences

- The per-courier report cuts by **delivery date** and the per-customer one by
  **pickup date**. That difference is deliberate and is stated on screen.
- An administrator who marks a courier's order as delivered credits it to that
  courier. If that is wrong, the administrator unassigns it first.
- A courier who once signed in to the web appears in the tablero's customer
  list as an account with no orders, like any account.
- The UI says "Devolver a Diego": the one proper name on an app screen, because
  the app is only ever seen by the business's own people.
