> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# norbo-notifications-worker

This worker owns: consuming the `notif` BullMQ queue, delivering FCM
(Android) and APNs (iOS) push notifications. Nothing else.

## Hard constraints

- No HTTP server. No business logic. No DB writes except `DELETE
  push_tokens` on FCM 404/410 errors.
- Always data-only FCM messages. Never notification-type messages.
  Notifee renders client-side.
- Validate every job with Zod **before** processing. Failed validation
  → log and discard (do not retry — payloads cannot self-heal).
- On stale token (`messaging/registration-token-not-registered` or
  `messaging/invalid-registration-token`): delete the row from
  `push_tokens` and continue.
- English only: code, comments, logs, commit messages.

## Job contract

The producer (currently norbo-api, but anything that pushes to the
`notif` BullMQ queue qualifies) must publish jobs that match
`NotifJobSchema` in `src/schema/job.schema.ts`:

```ts
{
  userId: string,           // recipient — used to look up tokens
  title: string,
  body?: string,
  sound?: string,           // without extension; APNs only
  category?: string,        // iOS notification category id
  data?: Record<string,string> // forwarded as-is to FCM data payload
}
```

The worker does **not** interpret `data`. The mobile client (Notifee)
decides how to render the notification (channel, action buttons, …).

## Producer integration notes

When norbo-api regains a notifications module it must:

- Reuse the `notif` queue name and the BullMQ default options used by
  this worker (no per-job retry overrides without coordination).
- Stick to the schema above. Any new field must be added here first
  and a Zod validator update must ship before producers depend on it.

Until then this worker is dormant infra: it builds and starts, but
without a producer it just listens on an empty queue.
