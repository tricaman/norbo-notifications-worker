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
                                      TokenStore (Redis) → cleanup stale tokens
```

## Job Flow

1. BullMQ dequeues job from `notif` queue.
2. Processor validates payload with Zod schema (fail immediately on invalid).
3. `TokenStore.getTokensForUser(recipientId)` fetches FCM tokens from Redis set `push_tokens:{userId}`.
4. For each token: call `sendDataMessage(token, data)`.
5. If FCM returns 404/410 (unregistered token): `TokenStore.removeToken(userId, token)`.
6. Return typed result `{ sent: number, total: number }`.

## File Map

| File | Responsibility |
|------|---------------|
| `src/main.ts` | BullMQ Worker bootstrap, graceful shutdown |
| `src/config.ts` | Zod env validation, fail-fast |
| `src/logger.ts` | Pino logger instance |
| `src/processor.ts` | Job processing logic, Zod validation |
| `src/firebase.ts` | Firebase Admin SDK init, `sendDataMessage()` |
| `src/token-store.ts` | Redis-backed push token lookup and cleanup |

## Job Payload Contract

Must match norbo-api `NotificationsService` and dit-ping `notif.Publisher` exactly:

```typescript
interface PingNotifJobData {
  pingId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  ttlSeconds: number;
  createdAt: string; // ISO 8601
}
```

## Redis Keys (read/write)

| Pattern | Access | Purpose |
|---------|--------|---------|
| `push_tokens:{userId}` | READ + SREM | FCM token set, written by norbo-api |
| `bull:notif:*` | BullMQ internal | Job queue — never access directly |

## Concurrency

- `WORKER_CONCURRENCY` env var controls parallel job processing (default: 10).
- Each job is independent — no shared mutable state between jobs.
- Graceful shutdown: `worker.close()` waits for in-flight jobs to finish.
