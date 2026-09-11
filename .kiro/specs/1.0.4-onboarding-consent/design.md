# Design — Onboarding Explicit Consent (1.0.4)

## Overview

Convert the passive disclaimer on `WelcomeScreen` into an **explicit, tickable consent gate**
that links to the existing Terms of Service and Privacy Policy, records the acknowledgment
(with the accepted consent version) via the existing persisted onboarding store, and gates
both **Continue** and **Skip intro**. The whole change is one screen + one small store field
+ one committed constants file. No new native code, no migration, no new screen.

The protective value comes from **reproducibility of the shown terms per app version** (a
committed `CONSENT_VERSION` + copy constant, tracked by git/release history), not from any
per-user record. The app stays anonymous.

## Current state (verified)

- `src/screens/onboarding/WelcomeScreen.tsx`: shows a static disclaimer `<Text>`; both
  `handleContinue` (→ `PrivacyNotice`) and `handleSkip` (→ seed + reset to `MainTabs`)
  call `acknowledgeDisclaimer()` silently, with errors caught and swallowed (fail-open).
- `src/stores/onboardingStore.ts`: `disclaimerAcknowledged: boolean` in a typed
  `PersistedState`, persisted as a JSON blob in SQLite `settings` under key
  `onboarding_state`; `acknowledgeDisclaimer()` sets it true and persists. A legacy-migration
  path sets `disclaimerAcknowledged: true` for pre-existing installs (so upgraders are not
  re-onboarded).
- `src/config/appInfo.ts`: already exports `TERMS_OF_SERVICE_URL`
  (`.../terms`) and `PRIVACY_POLICY_URL` (`.../privacy`), plus `APP_NAME`.
- `expo-web-browser` (`WebBrowser.openBrowserAsync`) is the established in-app-browser pattern
  (used in `SettingsScreen` and `PrivacyExplanationScreen`) for opening those URLs without
  leaving the app / losing screen state.
- `logEvent(...)` is the anonymous analytics logger used throughout onboarding.
- Data resets: `exportService.deleteAllData()` runs `DELETE FROM settings` and Settings
  routes to `Onboarding`; the dev `Reset Onboarding` / `Reset Entire App` paths set
  `disclaimerAcknowledged: false` and reset to `Onboarding`. So clearing the ack always routes
  back through Welcome — the consent invariant already holds structurally.

## Design

### 1. Consent constants (new committed file)

`src/constants/consent.ts` (new):

```ts
// Bump when the consent/disclaimer copy changes materially. The app's git history +
// release tags map each release to the exact terms shown — this is the audit trail
// (no per-user record needed).
export const CONSENT_VERSION = '2026-09-11'; // date-based id; bump on material change

// The exact acknowledgment copy shown on WelcomeScreen. Single source of truth so the
// shown terms are reproducible per release.
export const CONSENT_LABEL =
  "I understand this app is a personal wellness tool, not medical, therapeutic, or " +
  "professional advice, and using it creates no provider relationship. It is not a " +
  "replacement for professional mental health care or a crisis service. If I'm in crisis, " +
  "I'll contact a crisis helpline or emergency services. I agree to the Terms of Service " +
  "and acknowledge the Privacy Policy.";
```

- Wording is the intent; **final copy pending attorney review** (Req note). Keeping it in one
  constant makes review + versioning trivial.
- `CONSENT_VERSION` is a simple string (date-based). Material copy change → bump.

### 2. Store: record the accepted version (small, backward-compatible)

`src/stores/onboardingStore.ts`:

- Add `acknowledgedConsentVersion: string | null` to `PersistedState` (default `null`), and
  load it with `?? null` in the parse path (mirrors existing optional-field handling, so old
  persisted blobs deserialize cleanly).
- Change `acknowledgeDisclaimer()` to accept the version:
  `acknowledgeDisclaimer(version: string)` → sets `disclaimerAcknowledged: true` and
  `acknowledgedConsentVersion: version`, then persists. (Callers pass `CONSENT_VERSION`.)
- Expose `acknowledgedConsentVersion` on the store state for potential future
  "re-consent on version bump" logic (not used to force re-consent in 1.0.4 — see Req 4.3).
- The legacy-migration path stays as-is (`disclaimerAcknowledged: true`), and simply leaves
  `acknowledgedConsentVersion: null` for legacy users — they are NOT forced to re-consent
  (Req 4.3 / 5.3).

### 3. WelcomeScreen: the consent gate

`src/screens/onboarding/WelcomeScreen.tsx`:

- Local state: `const [consentChecked, setConsentChecked] = useState(false)`.
- Replace the static disclaimer `<Text>` with a **checkbox row**:
  - A pressable checkbox (reuse the app's checkbox visual/a11y pattern) with
    `accessibilityRole="checkbox"` and `accessibilityState={{ checked: consentChecked }}`,
    44×44 min target.
  - The `CONSENT_LABEL` text next to it, with **inline tappable "Terms of Service" and
    "Privacy Policy"** links that call `WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL)` /
    `(PRIVACY_POLICY_URL)` (in-app browser keeps onboarding state and doesn't reset the
    checkbox — Req 2.3).
- **Gate the actions:**
  - `Continue`: `disabled={!consentChecked}`, with disabled styling +
    `accessibilityState={{ disabled: !consentChecked }}` (Req 1.2, 1.6). On press, call
    `acknowledgeDisclaimer(CONSENT_VERSION)` then navigate to `PrivacyNotice` (unchanged
    downstream).
  - `Skip intro`: also gated on `consentChecked` (disable it, or guard the handler so it
    no-ops until checked) so consent can't be bypassed (Req 1.3). On press, call
    `acknowledgeDisclaimer(CONSENT_VERSION)` then run the existing seed-and-enter flow
    unchanged (Req 5.1).
- **Fail-open preserved:** keep the existing try/catch around `acknowledgeDisclaimer` so a
  persistence error still lets the user proceed (Req 5.4). (The checkbox gate is UI-side; the
  only thing that can fail is persistence, which stays non-blocking.)
- **Optional anonymous event (Req 3.4):** on acknowledge, `void logEvent('consent_accepted',
  { consent_version: CONSENT_VERSION })` inside a try/catch (analytics never disrupts
  onboarding; no identity attached). Include only if we decide to ship it for 1.0.4.

### 4. Consent invariant across resets (verify, mostly no-op)

No new code needed; verify and document that `deleteAllData()` (clears `settings`) and the
reset paths route back to `Onboarding`, so a user who clears the ack re-passes the gate
(Req 4.1, 4.2). Add a test asserting the store's `disclaimerAcknowledged` returns to `false`
after a settings wipe / reset (so the gate re-engages).

## Data / persistence

- No DB migration: `PersistedState` is a JSON blob; adding an optional field is
  forward/backward compatible (old blobs load with `acknowledgedConsentVersion: null`).
- No new SQLite columns, no new tables. No PII. Everything local.

## Accessibility

- Checkbox: `accessibilityRole="checkbox"`, `accessibilityState.checked`, labelled; 44×44.
- Links: `accessibilityRole="link"`.
- Continue disabled state exposed via `accessibilityState.disabled` and visually distinct.

## Testing

- **Store unit test:** `acknowledgeDisclaimer(version)` sets `disclaimerAcknowledged: true`
  and `acknowledgedConsentVersion: version` and persists; old persisted blob without the field
  loads with `null`; after a settings wipe the flag is `false` again (invariant).
- **Screen behavior (manual + light RTL test where feasible):**
  - Continue disabled until checkbox ticked; enabled after.
  - Skip intro gated the same way.
  - Ticking + Continue → PrivacyNotice; ticking + Skip → seeds + MainTabs.
  - ToS / Privacy links open the in-app browser and return without resetting the checkbox.
  - Persistence-failure path still proceeds (fail-open).
- **Manual, existing-user upgrade:** an already-onboarded install upgrading to 1.0.4 is NOT
  sent back to Welcome (legacy migration + `onboardingScreensComplete` unchanged).
- **Typecheck** clean for the edited files.

## Out of scope (per requirements)

- Attorney-vetted final wording (copy intent only here).
- Forcing existing users to re-consent on a `CONSENT_VERSION` bump.
- A per-user consent audit log or any transmitted consent record.

## Files touched

- `src/constants/consent.ts` (new) — `CONSENT_VERSION` + `CONSENT_LABEL`.
- `src/screens/onboarding/WelcomeScreen.tsx` — checkbox gate, ToS/Privacy links, gated
  Continue/Skip, optional event.
- `src/stores/onboardingStore.ts` — `acknowledgedConsentVersion` field +
  `acknowledgeDisclaimer(version)` signature.
- `src/config/appInfo.ts` — reused as-is (`TERMS_OF_SERVICE_URL`, `PRIVACY_POLICY_URL`); no
  change expected.
- Tests: `src/stores/__tests__/onboardingStore.consent.test.ts` (new).
