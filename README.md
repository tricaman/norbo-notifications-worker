# norbo-notifications-worker

Generic FCM / APNs push notifications worker for the **norbo** product.
Consumes the `notif` BullMQ queue, looks up push tokens in PostgreSQL,
delivers via Firebase Admin SDK.

After the `dit → norbo` cleanup the worker is intentionally
domain-agnostic. The producer (currently a future norbo-api module —
not implemented yet) controls title, body, and any custom data via the
job payload. The worker just resolves tokens and dispatches.

## Stack

- BullMQ 5 + ioredis
- Firebase Admin SDK 13
- `postgres` (raw queries — no ORM, the worker only reads
  `push_tokens` and deletes stale rows)
- pino + pino-pretty
- Zod for payload validation

## Job payload

```ts
{
  userId: string;
  title: string;
  body?: string;
  sound?: string;             // APNs only, without extension
  category?: string;          // iOS category id
  data?: Record<string, string>; // forwarded to FCM data payload
}
```

See `src/schema/job.schema.ts` for the canonical Zod schema.

## Local development

```bash
pnpm install
cp .env.example .env  # fill FIREBASE_SERVICE_ACCOUNT_JSON
pnpm start:dev        # tsx watch
```

The worker expects `push_tokens` rows in PostgreSQL with at least
`id`, `userId`, `token`, `platform`. Schema ownership lives in
norbo-api once the push-tokens module is reintroduced.

## Build / run

```bash
pnpm build   # tsc → dist/
pnpm start   # node dist/main.js
pnpm lint    # tsc --noEmit
```

## Status

The producer side (norbo-api notifications module) was removed during
the `dit → norbo` cleanup and has not been reintroduced. This worker
builds and starts but currently has no upstream traffic. It stays in
the repo so the FCM/APNs infrastructure is ready when the next norbo
feature needs push notifications.
