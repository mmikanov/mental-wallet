# UX Enhancements v1.0 — Design

## Overview

Six UX improvements for the initial release, identified during user testing. Each is a targeted change to improve usability without major architectural modifications.

---

## 1. Keyboard Covers Bottom Input Fields

### Root Cause

There is no `KeyboardAvoidingView` or equivalent in the expanded card area. `FocusedCardView` renders `ExpandedContent` inside a `ScrollView` constrained to `FOCUSED_CARD_HEIGHT` (~65% of screen). When the keyboard opens for a text input near the bottom, nothing shifts the content up.

### Design

Wrap the `ExpandedContent` area with `KeyboardAvoidingView` (behavior: `'padding'` on iOS, `'height'` on Android). Use the React Native `Keyboard` API to detect keyboard show/hide and automatically scroll the focused input into view.

**Files to modify**:
- `src/components/wallet/FocusedCardView.tsx` — wrap expanded content in `KeyboardAvoidingView`
- May also need `SessionLauncherContent.tsx` since it has its own ScrollView

### Considerations
- On Android with `GHScrollView`, `KeyboardAvoidingView` may need testing
- Alternative: use `react-native-keyboard-aware-scroll-view` library if native approach is unreliable

---

## 2. Move Crisis Resources Higher in Settings

### Current State

Settings sections: Start Experience → Focus → Insights → Privacy & Data → **Safety** (buried) → Support Us → Help & Feedback → About

### Design

Move the Safety section to **position 1** (top of Settings, right after the header). Since this is a mental health app, crisis resources should be immediately visible without scrolling.

**Files to modify**:
- `src/screens/SettingsScreen.tsx` — reorder the JSX sections

---

## 3. Add Crisis Link to ALL Rationale Sheets

### Current State

The "In crisis? Get support →" link only shows when `isDistressRelated` is `true` (card has emotion tags `['anxious', 'angry', 'stressed']`). Cards with tags like `['sad', 'numb', 'lonely']` don't show it.

### Design

Remove the conditional — always show the crisis callout. Any user reading a tool's rationale could be in a vulnerable state.

**Implementation**: Remove the `{isDistressRelated && (...)}` wrapping the crisis callout in `RationaleSheet.tsx`.

**Files to modify**:
- `src/components/rationale/RationaleSheet.tsx` — remove `isDistressRelated` condition

---

## 4. Mindful Walking — Walk Length

### Current State

Card has: static_text instructions + checkbox "Completed mindful walk". No duration capture.

### Design

Add `choice_buttons` at position 1 (between instructions and checkbox):
- Label: "How long was your walk?"
- Options: "~5 min", "~10 min", "15+ min"
- isRequired: false

Move checkbox to position 2.

**Files to modify**:
- `src/data/curatedLibrary.ts` — update `lib-mindful-walking` controls

---

## 5. Discreet Reminders

### Current State

Notification body: `"Time for your ${cardTitle} practice"` — reveals the tool name.

### Design

Add a "Discreet notifications" global toggle in Settings. When ON, body becomes generic: `"Time for your practice"`. When OFF, keeps current behavior showing the tool name.

**Files to modify**:
- `src/services/reminderService.ts` — conditional body text
- `src/screens/SettingsScreen.tsx` — new toggle
- `src/services/settingsService.ts` — get/set for the preference

---

## 6. Privacy Details Accessible from Settings

### Current State

`PrivacyExplanationScreen` is only in `OnboardingNavigator`. Not accessible post-onboarding.

### Design

1. Register `PrivacyExplanation` in `RootNavigator`
2. Add "Learn more" link in the "Help improve the app" toggle subtitle in Settings
3. On tap, navigate to the Privacy Details screen

**Files to modify**:
- `src/navigation/RootNavigator.tsx` — add screen
- `src/navigation/types.ts` — add to `RootStackParamList`
- `src/screens/SettingsScreen.tsx` — add link
- `src/screens/onboarding/PrivacyExplanationScreen.tsx` — minor type adjustment

---

## Implementation Priority

1. **#3** (crisis link on all sheets) — one-line change, high safety impact
2. **#2** (move crisis to top of Settings) — simple JSX reorder
3. **#6** (Privacy Details from Settings) — navigation + UI wiring
4. **#4** (Mindful Walking duration) — data change only
5. **#1** (keyboard avoidance) — most complex, needs platform testing
6. **#5** (discreet reminders) — new setting + logic, lowest priority for v1.0
