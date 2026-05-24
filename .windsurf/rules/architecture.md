---
trigger: model_decision
description: "Full architecture of dit-worker: job flow, provider pattern, token cleanup. Read before structural changes."
---

> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Architecture — dit-worker

## Overview

dit-worker is a standalone BullMQ consumer. No HTTP server. Single process.

```
Redis (bull:notif:*) → BullMQ Worker → Processor → Firebase Admin SDK → FCM/APNs
                                           ↓
                                      DbProvider (Postgres) → soft-invalidate stale tokens
```

## Job Flow

1. BullMQ dequeues job from `notif` queue.
2. Processor validates payload with Zod schema (invalid → log and discard, do not retry).
3. `DbProvider.getTokensForUser(userId)` fetches active rows from `push_tokens` where `"invalidatedAt" IS NULL`.
4. For each token: call `sendToDevice(token, params)` (data-only FCM message).
5. If FCM returns 404/410 (unregistered token): `DbProvider.invalidateToken(tokenId)` sets `"invalidatedAt" = NOW()`. Never hard-delete — that belongs to norbo-api's logout flow.
6. Log `{ sent, total }` for observability.

## File Map

| File                           | Responsibility                                        |
| ------------------------------ | ----------------------------------------------------- |
| `src/main.ts`                  | BullMQ Worker bootstrap, graceful shutdown            |
| `src/config.ts`                | Zod env validation, fail-fast                         |
| `src/logger.ts`                | Pino logger instance                                  |
| `src/processor.ts`             | Job processing logic, Zod validation                  |
| `src/firebase.ts`              | Firebase Admin SDK init, `sendToDevice()`             |
| `src/providers/db.provider.ts` | Postgres-backed push token lookup and soft-invalidate |
| `src/schema/job.schema.ts`     | Zod schema for `notif` job payload                    |

## Job Payload Contract

Canonical schema lives in `src/schema/job.schema.ts` (`NotifJobSchema`).
The worker is domain-agnostic: the producer chooses title/body/data,
the worker only resolves push tokens for `userId` and forwards.

```typescript
interface NotifJobPayload {
  userId: string; // recipient — used to look up tokens
  title: string;
  body?: string; // defaults to ""
  sound?: string; // without extension; APNs only
  category?: string; // iOS notification category id
  data?: Record<string, string>; // forwarded as-is to FCM data payload
}
```

## External resources (read/write)

| Resource                         | Access                                   | Purpose                                                       |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| Postgres `push_tokens`           | READ active rows, UPDATE `invalidatedAt` | Token lookup + soft-invalidate. Source of truth in norbo-api. |
| Redis `bull:<BULL_QUEUE_NAME>:*` | BullMQ internal                          | Job queue — never access directly                             |
| FCM / APNs (Firebase Admin)      | WRITE (send)                             | Data-only message delivery                                    |

## Concurrency

- `WORKER_CONCURRENCY` env var controls parallel job processing (default: 10).
- Each job is independent — no shared mutable state between jobs.
- Graceful shutdown: `worker.close()` waits for in-flight jobs to finish.
