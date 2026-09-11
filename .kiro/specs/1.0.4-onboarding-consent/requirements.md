# Requirements Document — Onboarding Explicit Consent (1.0.4)

## Introduction

The onboarding WelcomeScreen (`src/screens/onboarding/WelcomeScreen.tsx`) already shows a
disclaimer as **passive text** ("This app is a personal wellness tool. It is not a
replacement for professional mental health care or a crisis service..."), and it silently
calls an `acknowledgeDisclaimer()` store action when the user taps **Continue** or **Skip
intro**. There is **no explicit acknowledgment action** by the user.

For a mental-health app this is worth strengthening: the user should make an **explicit,
recorded acknowledgment** that the app is a wellness tool and not a substitute for
professional care or a crisis service, before entering the app. This also strengthens the
app-store-review and liability posture.

Scope: a single onboarding screen change plus the persisted acknowledgment flag. Small,
self-contained, no dependencies on the other 1.0.4 specs.

**Decisions (from product):**
- The consent is a **checkbox the user must tick** (stronger, clearer record than a button
  label alone).
- It lives on the **existing WelcomeScreen** (convert the passive disclaimer into an
  explicit acknowledgment); no new dedicated step.

## Requirements

### Requirement 1: Explicit consent checkbox gates entry

**User Story:** As a new user, I want to explicitly acknowledge that this app is a wellness
tool and not professional care or a crisis service, so that I understand what the app is
before I start using it.

#### Acceptance Criteria

1. THE WelcomeScreen SHALL present a **checkbox** the user must tick to acknowledge the
   disclaimer, with clear label copy conveying: the app is a personal wellness tool, it is
   not a replacement for professional mental health care or a crisis service, and if in
   crisis to contact a crisis helpline or emergency services.
2. THE primary action (**Continue**) SHALL be **disabled until the checkbox is ticked**, and
   enabled once ticked.
3. THE **Skip intro** path SHALL also require the checkbox to be ticked before proceeding
   (both paths currently call `acknowledgeDisclaimer()`; the acknowledgment must be explicit
   for both, so a user cannot bypass consent via Skip).
4. WHEN the user ticks the checkbox and proceeds (Continue or Skip), THE app SHALL record the
   acknowledgment via the existing persisted mechanism (`acknowledgeDisclaimer()` in the
   onboarding store / SQLite settings), so it is not asked again on subsequent launches.
5. THE checkbox SHALL be accessible: a real checkbox role/state for screen readers
   (`accessibilityRole="checkbox"` + `accessibilityState.checked`), a label read by
   assistive tech, and a touch target of at least 44×44.
6. THE disabled Continue state SHALL be conveyed to assistive tech
   (`accessibilityState.disabled`) and visually (e.g. reduced-emphasis styling), so it's
   clear why it can't be tapped yet.

### Requirement 2: Preserve existing onboarding behavior

**User Story:** As a returning or skipping user, I want the rest of onboarding to behave
exactly as before, so that only the consent gate is added.

#### Acceptance Criteria

1. ONCE the checkbox is ticked, **Continue** SHALL proceed to the existing next step
   (PrivacyNotice) unchanged, and **Skip intro** SHALL perform its existing seed-and-enter
   behavior unchanged (seed starter cards, default KPI, complete onboarding, reset to
   MainTabs).
2. THE change SHALL NOT alter the disclaimer's substance, the value proposition, the
   micro-reassurance items, or any downstream onboarding step.
3. THE acknowledgment SHALL be a one-time gate: users who have already completed onboarding
   (existing installs upgrading to 1.0.4) SHALL NOT be forced back through it, since they
   never re-enter onboarding. (No retroactive re-consent; this applies to the onboarding
   flow going forward.)
4. IF persisting the acknowledgment fails, THE app SHALL still let the user proceed (matching
   today's fail-open behavior where `acknowledgeDisclaimer()` errors are caught and
   swallowed), so a storage hiccup never traps the user in onboarding.

## Out of Scope

- Re-consenting existing users who already finished onboarding (they won't see this screen).
- A separate legal/Terms screen or versioned consent tracking (this is a single wellness
  disclaimer acknowledgment, not a full ToS-acceptance system).
- Any change to the Privacy Notice / Privacy Explanation steps (separate screens).

## Notes / Traceability (implementation anchors)

- `src/screens/onboarding/WelcomeScreen.tsx` — add the checkbox; gate `handleContinue` and
  `handleSkip` on `isChecked`; disabled styling + a11y for Continue.
- `src/stores/onboardingStore.ts` — existing `acknowledgeDisclaimer()` persisted action
  (reuse; no new persistence needed beyond what exists).
- Reference checkbox pattern: the app already renders checkboxes elsewhere (e.g. the
  `checkbox` control renderer) for visual/a11y consistency.

## Open Questions (design)

- Exact checkbox label wording (fold the existing disclaimer text into a tickable
  acknowledgment, e.g. "I understand this app is a wellness tool, not a substitute for
  professional care or a crisis service").
- Whether "Skip intro" should remain visually secondary but still gated, or whether the
  ticked state should visibly enable both actions together (likely: one checkbox enables
  both).
