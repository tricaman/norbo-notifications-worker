---
trigger: model_decision
description: "ADR log for dit-worker. Read before proposing alternatives to established choices."
---

> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Architecture Decision Records — dit-worker

## ADR-001 — Data-only FCM messages

**Date:** 2026-04-05
**Decision:** Always send data-only FCM messages, never notification-type messages.
**Rationale:** Data-only messages give full control to the client. Notifee on the mobile side handles rendering, action buttons, sound, and vibration. Notification-type messages are rendered by the OS with limited customisation.
**Consequence:** The `data` payload is a flat `Record<string, string>`. All values must be strings (FCM requirement). The mobile client must register a Notifee background handler to display notifications from data messages.

## ADR-002 — Standalone process, not embedded in NestJS

**Date:** 2026-04-05
**Decision:** dit-worker is a standalone Node.js process, not a NestJS module inside norbo-api.
**Rationale:** Fault isolation — an FCM outage or rate-limit storm must not degrade the REST API. Independent scaling — worker replicas scale based on queue depth, not HTTP traffic. Simpler deployment — worker image has no HTTP dependencies.
**Consequence:** dit-worker has its own `package.json`, `tsconfig.json`, `Dockerfile`. It shares no runtime code with norbo-api. The only contract is the BullMQ job payload schema (validated by Zod on both sides).

## ADR-003 — Postgres `push_tokens` as the single source of truth

**Date:** 2026-05-24
**Decision:** Push tokens are read directly from PostgreSQL (`push_tokens` table) via the `postgres` driver. The earlier Redis cache (set `push_tokens:{userId}`) has been removed.
**Rationale:** Maintaining a Redis cache duplicated state and required norbo-api to keep two stores in sync — a recurring source of drift. Postgres reads are fast enough at our volumes (one indexed lookup per job, `WHERE "userId" = $1 AND "invalidatedAt" IS NULL`), and removing the cache eliminates a whole class of consistency bugs.
**Consequence:** dit-worker depends on Postgres (`DATABASE_URL`). Schema ownership stays in norbo-api; the worker only ever reads `id, token, platform` and writes `invalidatedAt`. If the schema changes, norbo-api must coordinate.

## ADR-004 — Soft-invalidate stale tokens, never hard-delete

**Date:** 2026-05-24
**Decision:** On FCM `registration-token-not-registered` / `invalid-registration-token`, the worker sets `push_tokens."invalidatedAt" = NOW()` instead of deleting the row.
**Rationale:** A "dead" token from FCM's point of view may belong to a device that the user logs back into later (re-registering the same token). Hard-deleting loses the row before norbo-api can reset it, and also destroys audit history. Hard deletes remain owned by norbo-api's explicit logout flow.
**Consequence:** `getTokensForUser` must filter `WHERE "invalidatedAt" IS NULL`. norbo-api's upsert-on-login path must reset `invalidatedAt = NULL` when the same `(userId, token)` re-registers, otherwise revived tokens stay invisible to the worker.
