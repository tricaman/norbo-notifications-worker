---
trigger: glob
globs: "src/**/*.ts"
---

> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Coding Standards — dit-worker (Node.js + TypeScript)

## TypeScript Patterns

- Strict mode. No `any`. Use `unknown` and narrow with type guards.
- No non-null assertion (`!`). Handle null/undefined explicitly with if-checks or nullish coalescing.
- All async functions: explicit return type annotation.
- Prefer interfaces over type aliases for object shapes.
- Errors: always typed. Never `catch(e: any)`. Use `catch(e: unknown)` and narrow.
- Import order: stdlib → third-party → internal (separated by blank lines).
- Named exports preferred over default exports.

## BullMQ Processor

- Validate payload with Zod (`safeParse`) at the top of the processor. On failure: log `warn` with the issues and `return` — do **not** throw (payloads cannot self-heal, retries are wasted).
- For all other errors (FCM transport, DB), `throw` to let BullMQ manage retry/backoff.
- Log structured data on every job: child logger with `{ jobId }`, then `{ userId }` once resolved, and `{ sent, total }` on completion.
- Processor returns `Promise<void>`. Observability lives in logs, not return values.

## DRY + Single Responsibility

- FCM logic in `src/firebase.ts` only. Processor calls provider, never calls Firebase Admin SDK directly.
- Push-token DB access in `src/providers/db.provider.ts` only. Two operations: `getTokensForUser` (active rows) and `invalidateToken` (soft-invalidate).
- Token cleanup in provider, not in processor.

## Error Handling

- FCM 404 → log warn + soft-invalidate token + continue. Not an error worth retrying.
- FCM 429 → throw to trigger BullMQ retry with backoff.
- APNs 410 → log warn + soft-invalidate token + continue.
- All other errors → throw with context message, let BullMQ retry.
- After 3 retries → BullMQ moves to DLQ. Do not implement custom DLQ logic.
