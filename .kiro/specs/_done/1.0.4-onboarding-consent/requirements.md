# Requirements Document — Onboarding Explicit Consent (1.0.4)

## Introduction

The onboarding WelcomeScreen (`src/screens/onboarding/WelcomeScreen.tsx`) already shows a
disclaimer as **passive text** ("This app is a personal wellness tool. It is not a
replacement for professional mental health care or a crisis service..."), and it silently
calls an `acknowledgeDisclaimer()` store action when the user taps **Continue** or **Skip
intro**. There is **no explicit acknowledgment action** by the user.

For a mental-health app this is worth strengthening: the user should make an **explicit
acknowledgment** that the app is a wellness tool and not a substitute for professional care
or a crisis service, before entering the app.

### How this actually protects the operator (and what it does NOT rely on)

The app is anonymous and collects no PII, and no per-user consent record is sent anywhere.
That is fine: the protective value of this feature is **not** a per-user, identity-linked
consent log. It is the ability to demonstrate the **system**:

1. **What** the user was shown (the exact disclaimer/label copy),
2. **That** proceeding required an **affirmative action** (tick + tap), and
3. **Which version** of the terms was in effect and when.

All three are provable **without any user data** — via versioned consent copy committed in
the codebase plus release history (git tags / store releases). Therefore this spec
emphasizes **reproducibility of the shown terms per app version**, not storing who consented.

**Layered protection (context, not all in this spec):** the onboarding gate is one layer.
Real protection is layered with the existing **Terms of Service** and **Privacy Policy**
(the ToS carries the "not medical advice / no provider relationship / limitation of
liability" backbone), persistent in-context disclaimers (Insights, About, Crisis Resources),
and prominent crisis resources. This spec makes the onboarding gate explicit and links it to
the ToS/Privacy; it does not replace them.

> **Not legal advice.** The exact disclaimer/label wording and the ToS should be reviewed by
> a qualified attorney before launch. This spec defines the mechanism and the copy intent,
> not legally-vetted final language.

Scope: a single onboarding screen change, the persisted acknowledgment flag, and a committed
consent-version/copy constant. Self-contained; no dependencies on the other 1.0.4 specs.

**Decisions (from product):**
- The consent is a **checkbox the user must tick** (stronger, clearer record than a button
  label alone).
- It lives on the **existing WelcomeScreen** (convert the passive disclaimer into an
  explicit acknowledgment); no new dedicated step.
- A **Terms of Service already exists** (link to it from the checkbox alongside the Privacy
  Policy).

## Requirements

### Requirement 1: Explicit consent checkbox gates entry

**User Story:** As a new user, I want to explicitly acknowledge that this app is a wellness
tool and not professional care or a crisis service, so that I understand what the app is
before I start using it.

#### Acceptance Criteria

1. THE WelcomeScreen SHALL present a **checkbox** the user must tick to acknowledge the
   disclaimer. The label copy SHALL affirm, clearly and prominently: the app is a personal
   wellness tool; it is **not medical, therapeutic, or professional advice** and **creates no
   provider/patient relationship**; it is **not a replacement for professional mental health
   care or a crisis service**; users should consult a qualified professional for care; and if
   in crisis, contact a crisis helpline or emergency services.
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

### Requirement 2: Link to Terms of Service and Privacy Policy

**User Story:** As a user acknowledging the disclaimer, I want to be able to read the full
Terms of Service and Privacy Policy, so that my acknowledgment is informed and the operator
can point to the terms I accepted.

#### Acceptance Criteria

1. THE consent area SHALL include tappable links to the **Terms of Service** and the
   **Privacy Policy** (the existing documents), opening them so the user can read them.
2. THE checkbox label SHALL make clear that ticking acknowledges the disclaimer AND
   agreement to the linked Terms of Service (and acknowledgment of the Privacy Policy).
3. Opening the links SHALL NOT lose the user's place in onboarding (e.g. open in an in-app
   browser or a screen they can back out of), and SHALL NOT reset the checkbox state.

### Requirement 3: Versioned, reproducible consent copy

**User Story:** As the operator, I want to be able to show exactly what a user was asked to
agree to in the app version they used, so that I can respond to any future complaint without
needing any personal data about the user.

#### Acceptance Criteria

1. THE exact consent/disclaimer copy SHALL be defined in a **committed source constant** (not
   inlined ad hoc), alongside a **`CONSENT_VERSION`** identifier, so the shown terms are
   reproducible per release from the codebase and git history.
2. WHEN the consent copy changes materially, THE `CONSENT_VERSION` SHALL be bumped, so each
   app release maps to a known consent version (the audit trail is: git history + release
   tags, no per-user data).
3. THE persisted acknowledgment MAY store the `CONSENT_VERSION` that was accepted (anonymous,
   local only), so the app can tell whether the user accepted the current version. (This is a
   local convenience, not a transmitted record.)
4. OPTIONALLY, THE app MAY emit an **anonymous analytics event** (e.g. `consent_accepted`
   with `consent_version`) carrying NO user identity, to provide an aggregate "N users
   accepted version X" signal. This SHALL follow the app's existing anonymous-analytics
   rules and SHALL NOT link consent to any individual.

### Requirement 4: Consent invariant across data resets

**User Story:** As the operator, I want it to be impossible for a user to be inside the app
without having acknowledged the current consent, even after they delete or reset their data,
so that the gate can't be bypassed.

#### Acceptance Criteria

1. "Delete All Data" (`exportService.deleteAllData()` → `DELETE FROM settings`) and the
   developer/reset paths (Reset Onboarding, Reset Entire App) SHALL, as they already do,
   clear the acknowledgment and route the user back to **Onboarding**, so re-entry requires
   re-acknowledging the current consent. This re-collection on reset is the intended behavior.
2. THE invariant SHALL hold: **entering the main app always requires the current consent to
   be acknowledged**; any flow that clears the acknowledgment SHALL route back through the
   consent gate rather than leaving the user in the app un-acknowledged.
3. IF `CONSENT_VERSION` has been bumped since a user last acknowledged (e.g. after an app
   update with new terms), THE design SHALL decide and document whether re-acknowledgment is
   required. Default for 1.0.4: existing onboarded users are NOT forced to re-consent on a
   version bump (no retroactive re-consent); new/reset users get the current version. (Revisit
   if terms change materially.)

### Requirement 5: Preserve existing onboarding behavior

**User Story:** As a returning or skipping user, I want the rest of onboarding to behave
exactly as before, so that only the consent gate is added.

#### Acceptance Criteria

1. ONCE the checkbox is ticked, **Continue** SHALL proceed to the existing next step
   (PrivacyNotice) unchanged, and **Skip intro** SHALL perform its existing seed-and-enter
   behavior unchanged (seed starter cards, default KPI, complete onboarding, reset to
   MainTabs).
2. THE change SHALL NOT alter the value proposition, the micro-reassurance items, or any
   downstream onboarding step (beyond making the disclaimer an explicit, linked acknowledgment).
3. THE acknowledgment SHALL be a one-time gate for a given install/version: users who have
   already completed onboarding (existing installs upgrading to 1.0.4) SHALL NOT be forced
   back through it, since they never re-enter onboarding (see Req 4.3 for version bumps).
4. IF persisting the acknowledgment fails, THE app SHALL still let the user proceed (matching
   today's fail-open behavior where `acknowledgeDisclaimer()` errors are caught and
   swallowed), so a storage hiccup never traps the user in onboarding.

## Out of Scope

- Retroactively re-consenting existing users who already finished onboarding (Req 4.3).
- A full versioned per-user consent-tracking / audit-log system (explicitly not needed given
  the anonymous model; reproducibility comes from versioned copy + release history).
- Writing or legally vetting the ToS or the final disclaimer wording (attorney review is a
  launch task, not a code task; this spec defines intent + links).
- Any change to the Privacy Notice / Privacy Explanation onboarding steps beyond the links.

## Notes / Traceability (implementation anchors)

- `src/screens/onboarding/WelcomeScreen.tsx` — add the checkbox + ToS/Privacy links; gate
  `handleContinue` and `handleSkip` on `isChecked`; disabled styling + a11y for Continue.
- `src/stores/onboardingStore.ts` — existing `acknowledgeDisclaimer()` persisted action
  (reuse; optionally store the accepted `CONSENT_VERSION`).
- New committed constant (location TBD in design, e.g. `src/constants/consent.ts`) —
  `CONSENT_VERSION` + the exact disclaimer/label copy.
- `src/services/exportService.ts` `deleteAllData()` and SettingsScreen reset paths — already
  clear settings + route to Onboarding (Req 4); verify the invariant holds.
- Reference checkbox pattern: the app already renders checkboxes elsewhere (e.g. the
  `checkbox` control renderer) for visual/a11y consistency.
- ToS / Privacy Policy URLs: reuse the app's existing links (confirm where they live —
  About screen / Privacy screens / website).

## Open Questions (design)

- Exact checkbox label wording (attorney-reviewable), folding the disclaimer + ToS agreement
  into one tickable acknowledgment.
- Where `CONSENT_VERSION` + copy live, and whether to store the accepted version in settings.
- Whether to emit the optional anonymous `consent_accepted` event (Req 3.4) for 1.0.4 or
  defer it.
- Confirm the canonical ToS and Privacy Policy URLs to link.
