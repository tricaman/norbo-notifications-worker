> LIVING DOCUMENT — update this file whenever you:
> introduce a new pattern, convention, or architectural decision;
> discover a library behaviour that differs from what is written here;
> add a new dependency that has rules worth capturing;
> fix a bug caused by violating a rule that is not yet documented.

# Skill: Add a new push notification provider

## Steps

1. **Create provider file** at `src/providers/<name>.provider.ts` implementing the `sendDataMessage` interface pattern (accepts token + data, returns `{ success, messageId?, unregistered? }`).
2. **Add Zod schema** for any provider-specific config in `src/config.ts` env schema.
3. **Wire into processor** — import in `src/processor.ts`, call via the same interface as the existing FCM provider.
4. **Add unit tests** mocking the provider SDK. Test:
   - Successful delivery → returns `{ success: true, messageId }`
   - Unregistered token (404/410) → returns `{ success: false, unregistered: true }`
   - Rate limit (429) → throws to trigger BullMQ retry
   - Generic failure → throws with context
5. **Add provider env vars** to `.env.example` with documentation links.
6. **Update `.windsurf/rules/architecture.md`** — add the new provider to the file map and update the job flow diagram.
7. **Record decisions** — if a design decision was made, add an ADR to `.windsurf/rules/decisions.md`.
