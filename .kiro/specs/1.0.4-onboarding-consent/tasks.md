# Tasks — Onboarding Explicit Consent (1.0.4)

Small, self-contained. Order: constants → store → screen → invariant/tests → verify.
Each code change is copy/UI/persistence only; no native code, no DB migration.

## Task 1: Consent constants (source of truth)

- [x] 1.1 Add `src/constants/consent.ts`
  - Export `CONSENT_VERSION` (date-based string, e.g. `'2026-09-11'`) and `CONSENT_LABEL`
    (the exact acknowledgment copy). Single source of truth so shown terms are reproducible
    per release. Wording is intent, pending attorney review.
  - _Req: 1.1, 3.1, 3.2_

## Task 2: Store records accepted consent version

- [x] 2.1 Add `acknowledgedConsentVersion` to the onboarding store
  - Add `acknowledgedConsentVersion: string | null` to `PersistedState` (default `null`),
    load with `?? null` in the parse path; expose it on store state. Legacy-migration path
    leaves it `null` (no forced re-consent).
  - _Req: 3.3, 4.3, 5.3_
- [x] 2.2 Change `acknowledgeDisclaimer()` to accept a version
  - Signature `acknowledgeDisclaimer(version: string)`: set `disclaimerAcknowledged: true`
    and `acknowledgedConsentVersion: version`, then persist. Keep persistence failure
    non-fatal (existing retry/warn behavior).
  - _Req: 1.4, 3.3, 5.4_

## Task 3: WelcomeScreen consent gate

- [x] 3.1 Add the consent checkbox + ToS/Privacy links
  - Replace the static disclaimer `<Text>` with a checkbox row: pressable checkbox
    (`accessibilityRole="checkbox"` + `accessibilityState.checked`, 44×44) + `CONSENT_LABEL`
    with inline tappable **Terms of Service** / **Privacy Policy** links that call
    `WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL / PRIVACY_POLICY_URL)`. Local
    `consentChecked` state; links don't reset it.
  - _Req: 1.1, 1.5, 2.1, 2.2, 2.3_
- [x] 3.2 Gate Continue and Skip on the checkbox
  - `Continue` disabled until `consentChecked` (disabled styling +
    `accessibilityState.disabled`); on press call `acknowledgeDisclaimer(CONSENT_VERSION)`
    then navigate to `PrivacyNotice`. `Skip intro` gated identically; on press call
    `acknowledgeDisclaimer(CONSENT_VERSION)` then run the existing seed-and-enter flow.
    Preserve the existing try/catch fail-open around the ack.
  - _Req: 1.2, 1.3, 1.6, 5.1, 5.2, 5.4_
- [ ] 3.3 (Optional) Emit anonymous consent event — DEFERRED
  - `logEvent('consent_accepted', { consent_version })` would require registering a new
    `AnalyticsEventType` (union in `types/analytics.ts` + `VALID_EVENT_TYPES` in the logger +
    the analytics worker's accepted-events schema). Since it's optional (Req 3.4) and the
    version is already recorded locally + reproducible from release history, this was
    intentionally NOT shipped in 1.0.4. Revisit if an aggregate acceptance count is wanted.
  - _Req: 3.4 (deferred)_

## Task 4: Consent invariant across resets

- [x] 4.1 Verify + test the reset invariant
  - Confirm `exportService.deleteAllData()` (clears `settings`) and the Settings reset paths
    route to `Onboarding` and that the store's `disclaimerAcknowledged` returns to `false`
    (so the gate re-engages). No new app code expected; add a store test asserting a
    settings wipe / reset yields `disclaimerAcknowledged === false`.
  - _Req: 4.1, 4.2_

## Task 5: Tests + verification

- [x] 5.1 Store unit tests (`onboardingStore.consent.test.ts`)
  - `acknowledgeDisclaimer(v)` sets `disclaimerAcknowledged: true` +
    `acknowledgedConsentVersion: v` and persists; an old blob without the field loads as
    `null`; post-wipe the flag is `false`.
  - _Req: 3.3, 4.1, 4.2_
- [x] 5.2 Verify + checkpoint
  - `npm run typecheck` clean for `consent.ts`, `onboardingStore.ts`, `WelcomeScreen.tsx`
    (pre-existing unrelated test-file jest-type errors excepted).
  - MANUAL (fresh onboarding): Continue disabled until ticked; Skip gated the same; tick +
    Continue → PrivacyNotice; tick + Skip → seeds + MainTabs; ToS/Privacy links open the
    in-app browser and return without clearing the checkbox; screen-reader reads the
    checkbox role/state and the disabled Continue.
  - MANUAL (upgrade): an already-onboarded install upgrading to 1.0.4 is NOT sent back to
    Welcome.
  - MANUAL (reset): Settings → Delete All Data → app returns to Welcome and requires the
    checkbox again.
  - _Req: 1.2, 1.3, 2.3, 4.1, 5.1, 5.3_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1"] },
    { "wave": 2, "tasks": ["2.1", "2.2"] },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "wave": 4, "tasks": ["4.1"] },
    { "wave": 5, "tasks": ["5.1", "5.2"] }
  ],
  "notes": "1.1 defines the constants used by 2.2/3.x. Store (2.x) before screen (3.x) since the screen calls the new acknowledgeDisclaimer(version) signature. 4.1 is verification of existing reset behavior. 5.x closes out tests + manual checks."
}
```
