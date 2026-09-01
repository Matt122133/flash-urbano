---
id: push-as-the-only-alert
owner: flash-urbano
status: accepted
last_reviewed: 2026-08-31
update_trigger: on-second-courier-or-delivery-failure
---

# ADR push-as-the-only-alert — A push notification is the only automatic alert, and it rides on Google's delivery

## Status

Accepted. Authorizes `specs/018-aviso-de-pedido-nuevo/`.

Reverses no principle. It **closes** the `High` row of 2026-08-14 in
[`../tech-debt-tracker.md`](../tech-debt-tracker.md), which has been the declared
blocker for promoting the site since it was written.

## Context

Since `007` an order is really persisted. Nothing has ever told Diego about it.
The order sits in a table until he remembers to open the app and pull to refresh
(`android/.../pantallas/Principal.kt:132`), so the delay between an order
arriving and the operator knowing is exactly however long he takes to look, and
nothing bounds it.

The 2026-08-14 row recorded this and named three ways out, from cheapest to
most: a fixed routine of checking by hand, an email to Diego on order creation,
or the Android app. It also said the app was the plan. **The app now exists** —
built in `012`, installed on Diego's phone since 2026-08-31 — so the row's own
text is stale. The gap did not close; it changed shape. The app exists and does
not wake up.

Two things about the setting matter for what follows. The business is **one
operator with one phone**, doing tens of orders a week. And the site is **not
promoted yet**, which is the only reason a three-week-old `High` row has cost
nothing so far.

## Decision

**One automatic alert channel: a push notification to the app. Nothing else.**

Three parts, each of which could have gone the other way:

1. **Email is deliberately not used.** The repo owner ruled on 2026-08-31 that
   the mailbox is for **customer enquiries**, and that pouring automated alerts
   into it degrades the channel it is reserved for. Cost was not the reason —
   the `correo` package built in `006` makes it a few lines.

2. **There is no second channel, and the fallback is not one.** If the push does
   not arrive, the order is still in the database and the app shows it when
   opened, exactly as today. The push **accelerates a path that already works**;
   it is not a single point of failure for the order itself.

3. **Delivery is Firebase Cloud Messaging**, which makes Google the first
   dependency of the Android app — until now it carried OkHttp, Compose and
   DataStore and nothing else — and adds a second secret to the service.

Two implementation choices are load-bearing enough to belong in the decision
rather than in the plan:

- **The service talks to FCM over plain HTTP with `golang.org/x/oauth2/google`,
  not through the Firebase Admin SDK.** Measured on 2026-08-31 with two throwaway
  modules: the SDK pulls **76 modules** (Firestore, Cloud Storage, IAM,
  monitoring, translate, gRPC) into a service that has **three** direct
  dependencies; the chosen path pulls **2**, one of which was already there as an
  indirect. Principle III is not a slogan here — it is the difference between
  those two numbers.
- **The FCM credential is optional at startup.** `config.Cargar()` refuses to
  boot when a mandatory variable is missing, by design. This one is read outside
  that list: if it is absent the service starts and records that alerts are off.
  A service that refuses to come up because an accessory feature lacks a
  credential is a service that is down, and that has already happened once in
  this project.

## Alternatives rejected

- **Email to the operator.** Ruled out by the owner, above. Would have worked
  today, with no new dependency and no new secret.
- **WhatsApp.** It is the channel the business actually lives in, and the one the
  product exists to replace for intake (Principle II). The API also requires a
  Business account and approved templates: much more setup than FCM for a
  message to a single person.
- **The app polling in the background** (WorkManager). No Google dependency, but
  the minimum interval is fifteen minutes, the OS defers it further under battery
  saving, and it drains a phone that spends the day in a pocket — to deliver an
  alert later and less reliably than the mechanism the OS already runs.
- **The Firebase Admin SDK for Go.** See the measurement above.
- **A self-hosted push path** (WebSocket held open by the app, or a self-signed
  UnifiedPush setup). Trades a dependency we do not control for a piece of
  infrastructure we would have to keep alive, on one phone, for one user.

## Consequences

**What gets better.** The only `High` row blocking promotion of the site closes.
The operator finds out in seconds instead of whenever he next remembers, without
being asked and without anyone writing to him.

**What we take on.**

- **A dependency whose delivery we cannot audit.** Google decides whether and
  when the message lands. Doze, battery saving, and — the real killer on this
  hardware — Samsung's One UI putting rarely-used apps to sleep can silently
  swallow it. This is why the install runbook, not the code, carries the
  requirement to mark the app as never sleeping, and why the app must say on
  screen when it is in a state where alerts cannot arrive.
- **A second secret with a second set of rules.** `google-services.json` is
  versioned (it ships inside a publicly downloadable APK anyway); the service
  account credential never enters the repo. Confusing the two is a leak.
- **A device address in the database.** `017` had closed the opposite door: its
  FR-011 says the app declares nothing about the phone beyond its version, on
  the argument that data which is not needed is not stored. A push token **is**
  needed, and there is no way around it. The criterion survives even though the
  list changed: the token and nothing else — no model, no Android version, no
  phone number, no location.
- **Silence has to be visible.** With no second channel, an alert that never
  arrives is indistinguishable from no orders. The app must say when the
  permission is denied; the parts that cannot be detected must be in the runbook.

**What stays the same.** The customer's experience does not change at all. The
order is created exactly as before, and confirming it never waits on an alert.

## Trigger to revisit

- **A second courier.** Everything here assumes one phone and one recipient.
  Routing alerts to a fleet is a different problem, not a bigger one.
- **Delivery failing in practice.** If Diego reports missing alerts after the
  runbook's two settings are in place, the assumption that a third party's
  delivery is good enough is what failed, and the email that was rejected here
  becomes the obvious fallback to reconsider.
- **Alerts beyond a new order.** State changes, cancellations. Deliberately out
  of scope: alerting on everything trains the operator to ignore alerts.
