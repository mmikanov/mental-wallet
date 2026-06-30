# Implementation Plan: Onboarding

## Overview

Progressive onboarding flow replacing the standalone DisclaimerScreen with a multi-stage experience: Welcome → Intent Selection → Wallet with Micro-Tutorial and First Action Checklist. Uses React Native with Expo SDK 54, TypeScript, Zustand for state, SQLite for persistence, and React Navigation native-stack for the nested onboarding navigator.

## Tasks

- [x] 1. Data layer and configuration
  - [x] 1.1 Add new curated library cards ("Name It to Tame It" and "Evening Gratitude")
    - Add two new `CuratedCardDefinition` entries to `src/data/curatedLibrary.ts`: `lib-name-it-tame-it` (category: grounding-calming) and `lib-evening-gratitude` (category: daily-checkin-journaling)
    - Each card needs appropriate controls (static_text instructions + optional text_input reflection)
    - "Win of the Day" (`lib-win-of-day`) already exists — no change needed for it
    - _Requirements: 3.9_

  - [x] 1.2 Create onboarding configuration file (`src/data/onboardingConfig.ts`)
    - Define `IntentId` type union: `'overwhelm' | 'routine' | 'organize' | 'explore'`
    - Define `StarterCardMapping` interface with `intentId`, `label`, `description`, `cardIds`
    - Export `INTENT_OPTIONS` array with all 4 intent mappings and their card ID arrays per the design
    - Export `DEFAULT_STARTER_CARD_IDS` array for the skip/default path
    - All referenced card IDs must exist in `CURATED_LIBRARY`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8_

  - [x] 1.3 Create the Zustand onboarding store (`src/stores/onboardingStore.ts`)
    - Define `OnboardingState` interface with fields: `disclaimerAcknowledged`, `onboardingScreensComplete`, `selectedIntent`, `tutorialComplete`, `checklist` (object with `openTool`, `tryExercise`, `addTool`), `checklistSessionCount`, `bannerDismissed`
    - Implement derived getters: `isChecklistVisible` (tutorial complete AND not all items done AND sessionCount < 3), `isChecklistComplete`
    - Implement actions: `acknowledgeDisclaimer`, `completeOnboardingScreens`, `completeTutorial`, `markChecklistItem`, `dismissChecklist`, `dismissBanner`, `incrementSessionCount`, `loadState`
    - Persist state as JSON to settings table under key `'onboarding_state'`
    - On `acknowledgeDisclaimer`, also write the legacy `'disclaimer_acknowledged'` key with value `'true'` for backward compatibility
    - Each action persists immediately after state update
    - _Requirements: 7.1, 7.2, 7.3, 8.2_

  - [x] 1.4 Create the onboarding service (`src/services/onboardingService.ts`)
    - Implement `seedStarterCards(intentId: IntentId | null)`: look up card IDs from config (or defaults if null), find matching `CuratedCardDefinition` entries, call `cardService.create()` for each with origin `'library'`
    - Wrap seeding in a transaction; rollback on failure
    - Implement `saveState` and `loadState` for settings table JSON persistence
    - Implement `writeLegacyDisclaimerFlag` to write `'disclaimer_acknowledged' = 'true'`
    - Handle missing card IDs gracefully (skip with warning, proceed with remaining valid cards)
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.2_

  - [x]* 1.5 Write property tests for onboarding data layer
    - **Property 1: Intent-to-cards mapping correctness** — for any valid intent (including null/default), seeded card IDs match the configured `cardIds` in onboardingConfig
    - **Validates: Requirements 2.2, 3.2, 3.3, 3.4, 3.5, 3.6**
    - **Property 2: Seeded cards always have origin "library"** — all cards persisted during seeding have `originBadge === 'library'`
    - **Validates: Requirements 3.7**
    - **Property 3: Starter config referential integrity** — every card ID in every intent mapping exists in `CURATED_LIBRARY`
    - **Validates: Requirements 3.9**

- [x] 2. Checkpoint - Ensure data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Navigation and onboarding screens
  - [x] 3.1 Update navigation types (`src/navigation/types.ts`)
    - Replace `Disclaimer: undefined` with `Onboarding: undefined` in `RootStackParamList`
    - _Requirements: 8.1_

  - [x] 3.2 Create the OnboardingNavigator (`src/navigation/OnboardingNavigator.tsx`)
    - Define `OnboardingStackParamList` with `Welcome` and `IntentSelection` routes
    - Use `createNativeStackNavigator` with `headerShown: false`
    - Disable gesture/back-swipe on the Welcome screen (`gestureEnabled: false`)
    - _Requirements: 1.6, 2.5_

  - [x] 3.3 Create the WelcomeScreen (`src/screens/onboarding/WelcomeScreen.tsx`)
    - Display headline, value proposition subtext, and embedded disclaimer text
    - Include micro-reassurance text: not a crisis service, user stays in control, questions can be left blank
    - "Continue" button: calls `onboardingStore.acknowledgeDisclaimer()` and navigates to IntentSelection
    - "Skip intro" link: calls `acknowledgeDisclaimer()`, calls `onboardingService.seedStarterCards(null)`, calls `completeOnboardingScreens(null)`, navigates to MainTabs via `navigation.reset()`
    - Add accessibility labels on all interactive elements
    - Ensure WCAG 2.1 AA contrast ratios
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.4 Create the IntentSelectionScreen (`src/screens/onboarding/IntentSelectionScreen.tsx`)
    - Render 4 large tappable cards from `INTENT_OPTIONS` config
    - Single-selection enforcement (one option at a time)
    - On selection: call `onboardingService.seedStarterCards(intentId)`, call `onboardingStore.completeOnboardingScreens(intentId)`, navigate to MainTabs via `navigation.reset()`
    - Show encouraging micro-copy after selection (e.g., "Great choice — we'll set you up with tools for that.")
    - Support back navigation to Welcome screen
    - Display one decision only — no additional questions or fields
    - Add accessibility labels on all interactive elements
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.3, 9.4, 9.5_

  - [x] 3.5 Update RootNavigator (`src/navigation/RootNavigator.tsx`)
    - Replace the `Disclaimer` route with `Onboarding` route using `OnboardingNavigator`
    - Update initial route logic: check both `disclaimerAcknowledged` AND `onboardingScreensComplete` from the onboarding store
    - If `disclaimer_acknowledged` is set but no `onboarding_state` exists (legacy user), navigate directly to MainTabs
    - Remove the import of `DisclaimerScreen`
    - _Requirements: 1.5, 7.2, 8.1, 8.3_

  - [x]* 3.6 Write property test for state-to-route resolution
    - **Property 7: State-to-route resolution** — for any valid combination of onboarding flags, the resolved initial route is deterministic: Welcome if disclaimer not acknowledged; IntentSelection if disclaimer acknowledged but screens not complete; WalletScreen if screens complete
    - **Validates: Requirements 7.2**

- [x] 4. Checkpoint - Ensure navigation and screens work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Micro-Tutorial system
  - [x] 5.1 Create the TooltipOverlay component (`src/components/onboarding/TooltipOverlay.tsx`)
    - Implement props: `visible`, `targetLayout`, `text`, `position` (above/below), `skipLabel`, `onTargetPress`, `onSkip`
    - Render full-screen overlay with semi-transparent backdrop (opacity 0.5)
    - Create spotlight cutout around target element (use multiple rect approach or SVG mask)
    - Position tooltip bubble relative to target with directional arrow
    - Use `react-native-reanimated` for fade-in/fade-out animations
    - Include "Skip tips" text button
    - Use `pointerEvents="box-none"` for pass-through outside spotlight
    - Add accessibility labels
    - _Requirements: 5.1, 5.4, 9.5_

  - [x] 5.2 Create the useMicroTutorial hook (`src/hooks/useMicroTutorial.ts`)
    - Implement state machine with states: `idle`, `tooltip_frontmost_card`, `tooltip_action_button`, `complete`
    - Expose: `currentStep`, `isActive`, `tooltipText`, `targetRef`, `advance()`, `skip()`, `start()`
    - Transitions: `idle` → `tooltip_frontmost_card` (on `start()`); → `tooltip_action_button` (on card tap); → `complete` (on action button tap or skip)
    - On reaching `complete`, call `onboardingStore.completeTutorial()`
    - Tooltip texts: "This is your current tool. Tap it to open." and "Try it out! Tap here to complete the exercise."
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 5.3 Create the OnboardingBanner component (`src/components/onboarding/OnboardingBanner.tsx`)
    - Display non-modal info banner: "We added a few tools to get you started. You can add your own later."
    - Include dismiss X button
    - Auto-dismiss when user navigates away or micro-tutorial begins
    - Call `onboardingStore.dismissBanner()` on dismiss
    - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 5.4 Write property test for tutorial state machine
    - **Property 4: Tutorial dismissal activates checklist** — dismissing the tutorial (skip or completing guided actions) results in `tutorialComplete === true` and `isChecklistVisible === true`
    - **Validates: Requirements 5.3, 5.5**

- [x] 6. First Action Checklist
  - [x] 6.1 Create the FirstActionChecklist component (`src/components/onboarding/FirstActionChecklist.tsx`)
    - Render inline checklist with 3 items: "Open your first tool", "Try the exercise (about 60 seconds)", "Add one tool you already know"
    - Each item shows done/not-done state
    - Tapping item 1 focuses the frontmost card; item 2 expands the focused card; item 3 opens Library Browser
    - Show completion celebration when all 3 items done, then auto-dismiss
    - Show positive reinforcement message on item 2 completion: "Nice! You've just used your first tool."
    - Dismiss permanently after 3 sessions with incomplete items
    - Add accessibility labels
    - _Requirements: 6.1, 6.2, 6.6, 6.7, 9.5_

  - [x] 6.2 Integrate onboarding overlays into WalletScreen (`src/screens/WalletScreen.tsx`)
    - Import and render `OnboardingBanner`, `TooltipOverlay`, and `FirstActionChecklist` conditionally based on onboarding store state
    - Wire `useMicroTutorial` hook: measure frontmost card and action button layouts via `onLayout` / refs, pass to `TooltipOverlay`
    - Auto-mark checklist items by subscribing to wallet store events:
      - `openTool`: when `focusedCardId` transitions from null to a value
      - `tryExercise`: when a completion is recorded (subscribe to completionStore)
      - `addTool`: when card count increases
    - Call `onboardingStore.incrementSessionCount()` on wallet mount when checklist is visible
    - Sequence: Banner → Micro-Tutorial (sequential) → Checklist appears after tutorial dismissed
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.4, 6.3, 6.4, 6.5, 6.8_

  - [x]* 6.3 Write property tests for checklist auto-marking
    - **Property 5: Wallet events auto-mark corresponding checklist items** — focusing a card marks `openTool`, recording a completion marks `tryExercise`, adding a card marks `addTool`; each transition only affects the corresponding item
    - **Validates: Requirements 6.3, 6.4, 6.5**

- [x] 7. Checkpoint - Ensure micro-tutorial and checklist work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. State persistence and edge cases
  - [x] 8.1 Implement onboarding state persistence and resume logic
    - Call `onboardingStore.loadState()` early in app initialization (in RootNavigator or App.tsx)
    - Handle JSON parse errors: reset to defaults (disclaimer NOT acknowledged)
    - Handle legacy user case: `disclaimer_acknowledged` set but no `onboarding_state` → treat as fully complete
    - Retry once silently on DB write failures; proceed with in-memory state if retry fails
    - _Requirements: 7.1, 7.2, 7.3, 8.3_

  - [x]* 8.2 Write property tests for state persistence
    - **Property 6: Onboarding state serialization round-trip** — serialize/deserialize produces equivalent state
    - **Validates: Requirements 7.1, 6.8**
    - **Property 8: Stage completion independence** — any single stage completion action only changes the targeted flag(s), all others remain unchanged
    - **Validates: Requirements 7.3**
    - **Property 9: Legacy disclaimer flag consistency** — any path that sets `disclaimerAcknowledged` to true also results in `'disclaimer_acknowledged' = 'true'` in settings
    - **Validates: Requirements 8.2**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `DisclaimerScreen` file can be left in place (dead code) or deleted — removing the route is sufficient
- The `TooltipOverlay` uses react-native-reanimated (already in the project) for animations
- Card seeding reuses the existing `cardService.create()` API — no new DB schema needed
- Onboarding state is a single JSON blob in the existing `settings` table — no migration required

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "3.1"] },
    { "id": 2, "tasks": ["1.5", "3.2", "5.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "5.2", "5.3"] },
    { "id": 4, "tasks": ["3.5", "3.6", "5.4"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2"] }
  ]
}
```
