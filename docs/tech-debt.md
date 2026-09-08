# Tech Debt & Future Improvements

A running list of known refactors and improvements that are safe to defer. These are not
bugs — the app works — but addressing them reduces future maintenance risk. Add new items
at the top of the relevant section with a short rationale and the files involved.

---

## Onboarding state reset should use a shared default (avoid per-field drift)

**Type:** Refactor / maintainability
**Priority:** Low
**Discovered:** During post-1.0.3 fixes (Bug 4b — the new `collapsedStackHintSeen` flag was
not reset by the developer "Reset Onboarding" action because the reset hardcoded each field).

**Problem:** The developer reset handlers in `src/screens/SettingsScreen.tsx`
(`handleResetOnboarding` and `handleResetEntireApp`) reset the Zustand onboarding store by
listing every field explicitly in `useOnboardingStore.setState({ ... })`. `src/stores/onboardingStore.ts`
also defines a `DEFAULT_STATE` object separately. Whenever a new onboarding flag is added to
the store, it must be manually added in **three** places (the store's `DEFAULT_STATE`, and
both reset handlers). Forgetting the reset handlers means the flag persists in memory after a
reset — exactly the bug that surfaced with `collapsedStackHintSeen`.

**Proposed fix:** Export a single canonical default from the store (e.g. `DEFAULT_STATE` plus
its derived fields, or a `resetOnboardingState()` action on the store) and have both
`SettingsScreen` handlers call that instead of re-listing fields inline. New flags then only
need to be added in one place.

**Files:**
- `src/stores/onboardingStore.ts` (export a default/reset)
- `src/screens/SettingsScreen.tsx` (`handleResetOnboarding`, `handleResetEntireApp`)

**Risk if deferred:** Low but recurring — each new onboarding flag risks the same
reset-doesn't-clear-it bug until the reset paths are consolidated.
