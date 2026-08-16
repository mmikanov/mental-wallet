# Implementation Plan

## Overview

Six UX enhancements for v1.0 addressing safety visibility, privacy access, card content improvements, keyboard behavior, and notification privacy. Tasks are ordered by priority: safety-critical changes first, then navigation/data improvements, then complex platform-specific work, and finally low-priority quality-of-life features.

## Tasks

- [x] 1. Add crisis link to all rationale sheets (#3)
  - [x] 1.1: In `src/components/rationale/RationaleSheet.tsx`, remove the `{isDistressRelated && (...)}` condition wrapping the crisis callout — always render it
  - [x] 1.2: Verify crisis link appears on a non-distress card (e.g., "Three Good Things") on both platforms
  - [x] 1.3: Verify tapping the link navigates to Crisis Resources screen
  - _Priority: Highest — safety impact_

- [x] 2. Move crisis resources to top of Settings (#2)
  - [x] 2.1: In `src/screens/SettingsScreen.tsx`, move the Safety section JSX block (🆘 Crisis Resources) to immediately after the header/scroll start (above Start Experience)
  - [x] 2.2: Verify it appears at the top of Settings without scrolling on both platforms
  - _Priority: High_

- [x] 3. Privacy Details accessible from Settings (#6)
  - [x] 3.1: Add `PrivacyExplanation: undefined` to `RootStackParamList` in `src/navigation/types.ts`
  - [x] 3.2: Add `<Stack.Screen name="PrivacyExplanation" component={PrivacyExplanationScreen} />` to `src/navigation/RootNavigator.tsx`
  - [x] 3.3: In `src/screens/SettingsScreen.tsx`, add a tappable "Learn more" link in the "Help improve the app" toggle subtitle that navigates to `'PrivacyExplanation'`
  - [x] 3.4: Update `PrivacyExplanationScreen.tsx` navigation type to support being accessed from root stack (may need `useNavigation<any>()` or a union type)
  - [x] 3.5: Verify navigating to Privacy Details from Settings and back works on both platforms
  - _Priority: Medium_

- [x] 4. Mindful Walking — add walk length (#4)
  - [x] 4.1: In `src/data/curatedLibrary.ts`, find `lib-mindful-walking` and add a `choice_buttons` control at position 1 with options: "~5 min", "~10 min", "15+ min" (label: "How long was your walk?", isRequired: false)
  - [x] 4.2: Move existing checkbox control from position 1 to position 2
  - [x] 4.3: Verify the card renders correctly in the library preview and when added to wallet
  - _Priority: Medium_

- [x] 5. Keyboard avoidance for expanded cards (#1)
  - [x] 5.1: Add `KeyboardAvoidingView` import to `src/components/wallet/FocusedCardView.tsx`
  - [x] 5.2: Wrap the expanded card content (when `isExpanded = true`) in `KeyboardAvoidingView` with behavior `'padding'` on iOS and `'height'` on Android
  - [x] 5.3: Test with a card that has text_input controls near the bottom (e.g., "Three Good Things" with 3 fields)
  - [x] 5.4: Verify keyboard doesn't cover the active input on both iOS and Android
  - [x] 5.5: Verify the SessionLauncherContent (emotion session) also avoids keyboard when text inputs are focused
  - [x] 5.6: If `KeyboardAvoidingView` conflicts with Android `GHScrollView`, consider using `react-native-keyboard-aware-scroll-view` as alternative
  - _Priority: Medium-Low (complex, needs platform testing)_

- [x] 6. Discreet reminders (#5)
  - [x] 6.1: Add `getDiscreetNotifications` / `setDiscreetNotifications` to `src/services/settingsService.ts` (reads/writes `discreet_notifications` key from settings table, default: false)
  - [x] 6.2: In `src/services/reminderService.ts` `buildNotificationConfigs`, check the setting — when true, set body to `"Time for your practice"` (generic, no tool name)
  - [x] 6.3: Add a "Discreet notifications" toggle in `src/screens/SettingsScreen.tsx` (under Privacy & Data section or near reminders). Subtitle: "Hide tool names from notification text"
  - [x] 6.4: Verify notification text is generic when toggle is ON
  - [x] 6.5: Verify notification text includes tool name when toggle is OFF (existing behavior)
  - _Priority: Low_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3", "4"] },
    { "id": 2, "tasks": ["5"] },
    { "id": 3, "tasks": ["6"] }
  ]
}
```

## Notes

- Tasks 1 and 2 are independent one-line/reorder changes — can be done in parallel
- Task 3 requires navigation wiring (3 files)
- Task 4 is data-only (only affects new installs/card additions)
- Task 5 is the most complex and may require multiple iterations
- Task 6 is lowest priority and can be deferred to post-v1.0 if needed
