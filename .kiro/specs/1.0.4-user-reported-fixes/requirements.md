# Requirements Document

## Introduction

A batch of small, user-reported bug fixes gathered after the **1.0.3** release. These are
independent defects surfaced by early users (RTL Android layout, an Android store-link
mistake, onboarding clarity/navigation gaps, and a wallet visibility problem on Android).
They are grouped here as a single "post-1.0.3 fixes" spec so the work is organized and
verifiable, but each bug is self-contained and can be fixed and shipped independently.

This spec covers **only the four reported bugs below**. The separate initiative to make
tips/reminders "more alive" with images/video/animation is intentionally out of scope here
and will be tracked in its own spec.

Stack context (per steering): React Native 0.81 / Expo SDK 54 (New Architecture), bare
workflow (committed `ios/` and `android/`), React Navigation 7, Reanimated 4, Zustand 5,
SQLite via `expo-sqlite`. The app UI is English-only and stores onboarding/UI "hasSeen"
flags as a JSON blob in the SQLite `settings` table via the onboarding Zustand store.

### Bug inventory (source of truth for scope)

- **Bug 1 — RTL layout breaks on Android.** On right-to-left devices (e.g. Hebrew) the
  Android app mirrors its layout and aligns content to the right, looking broken. The UI is
  English-only and has no RTL handling today; `AndroidManifest.xml` currently declares
  `android:supportsRtl="true"` and no `I18nManager` lock exists.
- **Bug 2 — Android "Open app" opens the Apple App Store.** For third-party app cards, when
  the app isn't installed, the "Open app" button falls back to a hardcoded
  `apps.apple.com` URL regardless of platform (confirmed with Wysa). The correct Android
  package (`playStoreId`) already exists in the card data but is not used by the button.
- **Bug 3 — Onboarding KPI clarity + missing Back.** On the personal KPI step, users are
  unsure how many options they may choose (it is single-select, but the only hint is easy
  to miss). Additionally, at least one linear onboarding step (Privacy Notice) has no Back
  control, so users cannot step backward.
- **Bug 4 — Collapsed cards hard to notice on Android.** When one card is focused, the
  collapsed stack of other cards sits as a short strip at the very bottom; Android users
  often don't notice it. We want the collapsed stack to be more visible on Android and a
  one-time hint pointing out where the other cards are.

## Requirements

### Requirement 1: Force LTR layout so RTL devices render correctly (Bug 1)

**User Story:** As a user whose phone is set to a right-to-left language (e.g. Hebrew), I
want the app to display in its normal left-to-right layout, so that the interface is not
mirrored or misaligned.

#### Acceptance Criteria

1. THE app SHALL render in left-to-right (LTR) layout on all devices regardless of the
   device's language/locale direction, because the app UI is English-only.
2. THE app SHALL disable runtime RTL via `I18nManager` (`allowRTL(false)`, and
   `forceRTL(false)` when `isRTL` is currently true) applied as early as possible at app
   startup (module load in the app entry, before the UI renders).
3. THE Android native layout direction SHALL NOT be mirrored: `AndroidManifest.xml` SHALL
   set `android:supportsRtl="false"` on the `<application>` element (currently `"true"`).
4. WHEN a user with a Hebrew (or other RTL) device opens the app, THE wallet, onboarding,
   headers, and card layouts SHALL appear identical in direction to an LTR device (no
   right-alignment or mirrored rows).
5. THE fix SHALL NOT introduce any translation/localization; it only locks layout
   direction. Existing physical `left/right` styles need NOT be migrated to logical
   `start/end`.
6. THE LTR lock SHALL NOT restrict what text users can enter: users SHALL still be able to
   type and store non-Latin / RTL-script content (e.g. Hebrew) in any text field —
   including the custom KPI text, text-input controls, and tool title/description/control
   labels created in the Card Creator — and that content SHALL persist and display
   correctly (Unicode bidi rendering within a line is unaffected by the layout lock).
7. Free-text inputs that hold user-authored content (custom KPI text, text-input controls,
   and Card Creator title/description/control-label fields) SHALL align to their own content
   direction (e.g. `textAlign="auto"` / `writingDirection="auto"`), so Hebrew text aligns
   right within the field while the overall app chrome remains LTR. This SHALL NOT change the
   app's global LTR layout or affect fixed UI labels.

### Requirement 2: Android "Open app" uses the correct platform store (Bug 2)

**User Story:** As an Android user, when I tap "Open app" for a third-party app I don't have
installed, I want to be taken to the Google Play Store listing, so that I can install the
correct app.

#### Acceptance Criteria

1. WHEN a user taps a third-party app card's "Open app" button on Android AND the app is
   not installed (deep link fails), THE app SHALL open the Google Play Store listing for
   that app (using its Android package / `playStoreId`), NOT the Apple App Store.
2. WHEN the same happens on iOS, THE app SHALL open the Apple App Store listing (using its
   `appStoreId`), preserving current iOS behavior.
3. THE store fallback SHALL be derived per platform from the card's existing `externalApp`
   data (`appStoreId` for iOS, `playStoreId` for Android) rather than a single hardcoded
   store URL.
4. WHEN the deep link succeeds (app installed), THE app SHALL open the app directly as it
   does today; the platform-store step only applies as a fallback.
5. WHEN no platform-appropriate store ID is available for a card, THE app SHALL fall back
   gracefully to the app's web URL (and affiliate URL where applicable) rather than opening
   the wrong platform's store.
6. THE existing affiliate-link behavior and FTC disclosure SHALL be preserved: affiliate
   fallback URLs SHALL continue to take priority over the plain web URL where configured.
7. THE analytics event currently emitted when an external resource/app is opened SHALL
   continue to be emitted.

### Requirement 3: Clarify KPI single-select in onboarding (Bug 3a)

**User Story:** As a user going through onboarding, I want it to be obvious how many options
I can pick for my personal KPI, so that I'm not confused about whether to choose one or
several.

#### Acceptance Criteria

1. THE personal KPI selection step SHALL make it unambiguous that exactly one focus is
   chosen (single-select), via clear, prominent instruction copy near the options (not only
   a small, easily-missed subheading).
2. THE single-select intent SHALL also be conveyed to assistive technology (e.g. an
   accessibility hint indicating one selection).
3. THE existing behavior SHALL be preserved: choosing a predefined option selects exactly
   that one focus, and choosing "Other" reveals the custom text entry.
4. THE clarification SHALL NOT change the set of KPI options, the "I'll decide later"
   default, or where the KPI is stored/used downstream.

### Requirement 4: Add a Back control to onboarding steps missing one (Bug 3b)

**User Story:** As a user in onboarding, I want a Back option on each step (after the first),
so that I can return to the previous step to review or change my answer.

#### Acceptance Criteria

1. EVERY linear onboarding step after the entry point SHALL provide a visible Back control
   that returns to the previous step. This specifically includes the **Privacy Notice**
   step, which currently has none.
2. THE Back control SHALL match the existing onboarding Back pattern used by Intent
   Selection and KPI Selection (top-left "← Back", minimum 44×44 touch target, labelled for
   screen readers, calling `navigation.goBack()`).
3. THE Welcome (entry) step SHALL remain without a Back control (it is the first screen and
   its back gesture is intentionally disabled).
4. WHEN a step is entered as the resumed initial route (no previous screen on the stack),
   THE Back control SHALL not leave the user stranded (it either is not shown or performs a
   safe no-op/forward-consistent action rather than appearing broken).
5. Adding Back controls SHALL NOT alter the forward flow, seeding, or completion behavior of
   onboarding.

### Requirement 5: Make the collapsed card stack more noticeable on Android (Bug 4a)

**User Story:** As an Android user who has focused a card, I want to clearly see that my
other cards are still there at the bottom, so that I know how to get back to them.

#### Acceptance Criteria

1. WHEN a card is focused on Android AND other cards exist, THE collapsed stack at the
   bottom SHALL be visibly taller / more prominent than it is today, so it reads as "more
   cards are here" rather than a thin strip.
2. THE increased prominence SHALL apply on Android specifically (iOS may remain as-is or
   receive the same treatment only if it does not regress the current iOS look).
3. THE collapsed stack SHALL remain tappable to return to the full stacked view, and its
   accessibility label SHALL continue to convey the number of other cards.
4. THE change SHALL NOT overlap or crowd the focused card's primary content/actions on
   common Android screen sizes.

### Requirement 6: First-time hint pointing to the collapsed cards (Bug 4b)

**User Story:** As a user focusing a card for the first time, I want a brief hint showing me
where my other cards went, so that I understand the collapsed stack at the bottom.

#### Acceptance Criteria

1. THE FIRST time a user focuses a card while other cards exist, THE app SHALL show a
   one-time hint (e.g. a spotlight tooltip) pointing at the collapsed stack, explaining that
   the other cards are there and can be tapped to return.
2. THE hint SHALL appear at most once and SHALL NOT reappear on subsequent focuses once
   seen or dismissed; its "seen" state SHALL be persisted using the app's existing
   onboarding/settings persistence (SQLite `settings` via the onboarding store), and SHALL
   survive app restarts.
3. THE hint SHALL be dismissible (tapping the highlighted area and/or a skip/close action)
   and SHALL not block the user from interacting with the app.
4. THE hint SHALL reuse the app's existing coachmark/tooltip mechanism (`TooltipOverlay`)
   and visual style rather than introducing a new pattern.
5. THE hint SHALL NOT interfere with the existing onboarding micro-tutorial (they must not
   both fire at the same time / fight for the screen); ordering SHALL be sensible (the hint
   is for the focused-card view, distinct from the initial stacked-deck tutorial).
6. THE hint SHALL be shown on **Android only**. On iOS it SHALL NOT appear, since iOS users
   are already familiar with this collapsed-stack interaction from Apple Wallet.

### Requirement 7: Keyboard must not cover the custom KPI input in onboarding (Bug 3c)

**User Story:** As a user choosing "Other (write your own)" for my personal KPI during
onboarding, I want to see the text box and its Continue button while I type, so that the
keyboard doesn't hide what I'm entering.

#### Acceptance Criteria

1. WHEN the user selects "Other (write your own)" on the KPI selection step and the custom
   text input receives focus, THE on-screen keyboard SHALL NOT cover the input or its
   Continue button; both SHALL remain visible while typing.
2. THE screen SHALL use the app's existing keyboard-avoidance pattern (a
   `KeyboardAvoidingView` with `behavior="padding"` on iOS and `"height"` on Android, as
   used elsewhere in the app) and SHALL scroll the custom input into view when it is focused.
3. THE fix SHALL hold whether the input is reached by tapping "Other" (auto-focus) or by
   tapping the field directly, and SHALL behave correctly on both iOS and Android.
4. THE fix SHALL be layout/keyboard-behavior only: it SHALL NOT change the KPI options, the
   single-select behavior, the "I'll decide later" default, validation, or where the KPI is
   stored/used downstream.

## Out of Scope

- Making tips/reminders richer with images, video, or animation (separate spec).
- Any translation/localization or true RTL support of the UI (Bug 1 only locks LTR).
- Redesigning the wallet to match Google Wallet's UX (explicitly declined for now; Bug 4 is
  a targeted visibility improvement, not a redesign).
- Reworking the third-party app link data model beyond using the existing per-platform store
  IDs (Bug 2 uses data that already exists).

## Notes / Traceability (implementation anchors)

- Bug 1: `App.tsx` (entry, add `I18nManager` lock at module load);
  `android/app/src/main/AndroidManifest.xml` (`android:supportsRtl="true"` → `"false"`).
- Bug 2: `src/components/controls/LinkButtonControl.tsx` (buggy fallback path);
  `src/services/deepLinkService.ts` (`getStoreUrl`/`launchExternalApp` — correct
  platform-aware logic that already exists but is not wired to the button);
  `src/data/externalAppCards.ts` (`externalApp.appStoreId` / `playStoreId` per card).
- Bug 3a: `src/screens/onboarding/KpiSelectionScreen.tsx` (single-select; subheading copy).
- Bug 3c: `src/screens/onboarding/KpiSelectionScreen.tsx` (`KeyboardAvoidingView` wrap +
  ScrollView ref + `scrollToEnd` on "Other" select / input focus so the keyboard doesn't
  cover the custom input; pattern mirrors `Step2Controls.tsx` / `FocusedCardView.tsx`).
- Bug 3b: `src/screens/onboarding/PrivacyNoticeScreen.tsx` (missing Back);
  reference pattern in `IntentSelectionScreen.tsx` / `KpiSelectionScreen.tsx`.
- Bug 4a: `src/components/wallet/CollapsedStack.tsx` (`EDGE_HEIGHT`, `TOP_CARD_HEIGHT`);
  `src/screens/WalletScreen.tsx` (`collapsedStackArea` / focused layout).
- Bug 4b: `src/components/onboarding/TooltipOverlay.tsx` (reusable coachmark);
  `src/stores/onboardingStore.ts` (persisted "hasSeen" flag pattern);
  `src/screens/WalletScreen.tsx` (measure/`onLayout` wiring for the tooltip target).
