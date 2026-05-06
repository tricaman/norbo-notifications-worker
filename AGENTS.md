> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Dit Worker

dit-worker owns: consuming `notif` queue, delivering FCM (Android) and APNs (iOS). Nothing else.

- No HTTP server. No business logic. No DB writes except DELETE push_tokens on 410 errors.
- Always data-only FCM messages. Never notification-type messages. Notifee renders client-side.
- On FCM 404 or APNs 410: delete token from push_tokens then continue. Never retry on bad tokens.
- Validate every job with Zod BEFORE processing. Failed validation → fail immediately, no retry.
- English only: code, comments, logs, commit messages.
