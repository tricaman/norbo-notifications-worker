---
trigger: always_on
---

> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Dit Worker — Context

Standalone BullMQ worker. No HTTP. Queue name from env `BULL_QUEUE_NAME`.

- Single responsibility: consume job → validate → fetch active tokens → send FCM/APNs → soft-invalidate stale tokens.
- If you find yourself adding a DB read beyond push_tokens, it belongs in norbo-api or norbo-ping.
- The only DB write is `UPDATE push_tokens SET "invalidatedAt" = NOW()` on FCM 404/410. Never hard-delete.
- Data-only FCM messages always. Notifee renders on the client side.
- Zod validates every job payload at line 1 of processor. No exceptions.
