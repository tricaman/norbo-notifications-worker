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

## ADR-003 — Direct ioredis, not Prisma/pg for token lookup

**Date:** 2026-04-05
**Decision:** Push tokens are read from Redis (set `push_tokens:{userId}`), not from PostgreSQL.
**Rationale:** norbo-api writes tokens to both PostgreSQL (source of truth) and Redis (cache). dit-worker only needs fast reads and occasional deletes. Adding a PostgreSQL dependency would increase complexity and couple the worker to the API's database schema.
**Consequence:** dit-worker depends only on Redis. Token cleanup (SREM) happens in Redis. norbo-api is responsible for keeping Redis and PostgreSQL in sync. If Redis loses data, norbo-api must re-populate the sets.
