# Bugfix Requirements Document

## Introduction

This document collects cross-platform visual and behavioral bugs found during testing. Issues are recorded as discovered, then fixed as a batch.

## Bug Analysis

---

### Bug 1: Card Content Bleeds Above Next Card Edge in Stacked View

### Current Behavior (Defect)

1.1 WHEN a card in the stacked wallet view has content taller than the peek height (e.g., Headspace card with third_party icon + reminder bell indicator) THEN the card's description text or extra elements are visible above the edge of the card stacked below it

1.2 WHEN the Headspace card (or any card with a reminder indicator and third_party icon type) is in the stack THEN its content overflows the 60px peek area, causing visual bleed into the card above

### Expected Behavior (Correct)

2.1 WHEN cards are displayed in the stacked wallet view THEN each card's content SHALL be clipped to its peek area (top ~60px), with no content bleeding above or below the card edge boundaries

2.2 WHEN a card has extra elements (reminder indicator, description text) THEN the card edge component SHALL clip overflow so only the title row (icon + title + category dot) is visible in the stacked state

### Status

**Won't Fix** — overflow:hidden clips shadows; alternative approaches also degrade visual quality. Minor cosmetic issue, not worth the tradeoff.

---

### Bug 2: Third-Party App Icons Not Shown in Reorder Mode

### Current Behavior (Defect)

3.1 WHEN the user enters "Reorder Cards" mode and a third-party app card (e.g., Headspace) is in the wallet THEN the card's row shows a generic fallback emoji (📋) instead of the app's logo

3.2 WHEN `renderCardIcon` is called in the reorder list for third_party icon type cards THEN the `sourceId` prop is likely not passed, so the bundled logo lookup via `getAppLogoSource` returns null and the fallback emoji is displayed

### Expected Behavior (Correct)

4.1 WHEN the user enters "Reorder Cards" mode and a third-party app card is in the wallet THEN the card's row SHALL display the bundled app logo (same as in the stacked view and focused view)

### Status

**Fixed** — renderCardIcon with sourceId now used in ReorderMode.tsx

---

### Bug 3: Seeding Insights Mock Data Fails — Missing `duration_records` Table

### Current Behavior (Defect)

5.1 WHEN a developer taps "Seed Mock Data" in Settings (Developer section) THEN the app shows "Seeding Failed" with error: `no such table: duration_records`

5.2 WHEN the insights mock data seeder attempts to insert duration records THEN the query is rejected because the `duration_records` table does not exist in the database schema

### Expected Behavior (Correct)

6.1 WHEN a developer taps "Seed Mock Data" THEN the seeder SHALL successfully insert all mock data including duration records without errors

6.2 WHEN the app's database migrations run THEN a `duration_records` table SHALL be created (if the insights feature requires it) OR the mock data seeder SHALL not reference a table that doesn't exist

### Status

**Fixed** — added duration_records migration; also fixed pickOutcomeCategory typo

---

### Bug 4: "Reset My App Data" Fails to Navigate — 'Disclaimer' Route Not Found

### Current Behavior (Defect)

7.1 WHEN the user taps "Reset my app data" in Settings and confirms the action THEN the data is deleted but navigation fails with: `The action 'RESET' with payload {"index":0,"routes":[{"name":"Disclaimer"}]} was not handled by any navigator`

7.2 WHEN `confirmDeleteAllData` in SettingsScreen.tsx (line 138) dispatches a navigation reset to `'Disclaimer'` THEN the navigator cannot find that route because the screen is named differently (likely `'Onboarding'` at the root level)

### Expected Behavior (Correct)

8.1 WHEN the user confirms "Reset my app data" THEN the app SHALL delete all data AND navigate back to the onboarding/first-launch flow (disclaimer screen as the first step)

8.2 WHEN data reset completes THEN the navigation SHALL reset to the correct root route that presents the disclaimer/onboarding flow

### Status

**Fixed** — changed 'Disclaimer' to 'Onboarding' in navigation reset (also fixes Bug 8)

---

### Bug 5: Export Data Fails on Both Platforms

### Current Behavior (Defect)

9.1 WHEN the user taps "Export my data" in Settings (in any format — JSON or CSV) THEN the app shows "Export Failed — Unable to export your data. Please try again."

9.2 WHEN the export service attempts to gather and serialize the user's data THEN the operation fails silently with a generic error message (no specific cause shown to the user)

### Expected Behavior (Correct)

10.1 WHEN the user taps "Export my data" and selects a format THEN the app SHALL successfully serialize the data, write it to a temporary file, and present the system share sheet

10.2 WHEN an export fails THEN the error message SHOULD indicate the specific cause to aid debugging (at least in dev builds)

### Status

**Fixed** — `file.text = content` (no-op property assignment) replaced with `file.write(content)` (correct API). Works on both platforms now.

---

### Bug 6: Emoji Icons Clipped in Emotion Session Recommendations and Card Previews

### Current Behavior (Defect)

11.1 WHEN the emotion session shows recommended tools in the "Suggested tools to try" list THEN the emoji icons next to tool descriptions appear slightly cut off (top/bottom clipped)

11.2 WHEN the user taps a recommended tool to preview it during an emotion session THEN the card shell's emoji icon also appears clipped

11.3 THE clipping is more visible on Android but also occurs on iOS — the icon container has insufficient height or padding for emoji rendering at the given font size

### Expected Behavior (Correct)

12.1 WHEN emoji icons are rendered in the recommendation list or card preview THEN they SHALL display fully without any clipping on both platforms

12.2 THE icon container SHALL have sufficient height and no restrictive overflow clipping to accommodate emoji rendering differences across platforms

### Status

**Fixed** — ToolPreviewCard iconContainer expanded from 24x24 to 32x32 with overflow:visible. LibraryToolPreview already had overflow:visible.

---

### Bug 7: Scroll Not Restored to Recommendations After Closing Tool Preview in Emotion Session

### Current Behavior (Defect)

13.1 WHEN the user is in an emotion session with recommendations visible, previews a suggested tool, and taps "← Back to session" THEN the session view scrolls to the top (emotion picker) instead of the recommendations section

13.2 THE initial auto-scroll to recommendations (when first shown) works correctly, but the scroll restoration after closing a preview does not fire

### Expected Behavior (Correct)

14.1 WHEN the user closes a tool preview via "← Back to session" THEN the session view SHALL scroll back to the recommendations section (same position they were browsing from)

### Relationship to Previous Fix

This was previously addressed in the `emotion-session-bugs` spec (Bug 1) with a `wasPreviewingRef` approach. The fix is either not triggering or the scroll target is incorrect. Needs re-investigation.

### Status

**Fixed** — added scrollTo in handleClosePreview with 150ms delay

---

### Bug 8: KPI FAB (Daily Check-in Sprout) Missing After Data Reset

### Current Behavior (Defect)

15.1 WHEN the user deletes all app data via "Delete All Data" in Settings and the app reloads THEN the KPI FAB (sprout icon, bottom-right) is missing from the wallet screen

15.2 THE KPI card is only created during KPI selection in onboarding, but after data reset the onboarding flow is not properly re-triggered (see Bug 4), so KPI selection is skipped and the KPI card is never re-created

### Expected Behavior (Correct)

16.1 WHEN the user deletes all app data THEN the app SHALL reset to the full onboarding flow including KPI selection, resulting in the KPI card being created and the FAB appearing on the wallet screen

16.2 ALTERNATIVELY, if the data reset is meant to preserve the user's KPI choice, the reset flow SHALL re-seed the KPI card from the stored preference

### Relationship to Previous Bug

Likely a consequence of Bug 4 (failed navigation to onboarding after data reset). Fixing Bug 4 may resolve this automatically.

### Status

**Fixed** — resolved by Bug 4 fix (correct navigation to Onboarding re-triggers KPI setup)

---

### Bug 9: KPI Badge Not Shown When User Has Never Done a Check-In

### Current Behavior (Defect)

17.1 WHEN the user has installed the app more than 1 day ago but has never done a KPI check-in THEN the DaysSinceBadge on the KPI FAB does not display any number

17.2 WHEN `loadLastCheckIn` queries `kpi_records` and finds no rows THEN `lastCheckInDate` is set to `null`, and `computeDaysElapsed(null)` returns `null`, causing `DaysSinceBadge` to render nothing

### Expected Behavior (Correct)

18.1 WHEN the user has never done a KPI check-in but the KPI card exists in their wallet THEN the badge SHALL show the number of days since the KPI card was created (added during onboarding) as the reference point

18.2 WHEN the user completes their first KPI check-in THEN the badge SHALL switch to using `lastCheckInDate` as the reference point (standard behavior)

### Status

**Fixed** — loadLastCheckIn/refreshDaysElapsed fall back to KPI card created_at when no kpi_records exist. Banner text adapts: "X days since you added the app — how are you feeling today?" (never checked in) vs "It's been X days since your last check-in" (returning user). Uses `card.totalUses > 0` as reliable hasEverCheckedIn check.

---

### Bug 10: KPI FAB Disappears After Rearranging Cards

### Current Behavior (Defect)

19.1 WHEN the user rearranges cards in the wallet (enters reorder mode, moves cards, taps "Done") THEN the KPI Daily Check-in FAB (sprout icon) disappears from the wallet screen

### Expected Behavior (Correct)

20.1 WHEN the user rearranges cards and exits reorder mode THEN the KPI FAB SHALL remain visible in its normal position (bottom-right corner)

### Status

**Fixed** — commitReorder now preserves cards not in the reorder list (KPI card was being dropped)

---

### Enhancement 11: Privacy Details Accessible from Settings

### Current Behavior

19.1 The Privacy Details screen (event types breakdown, what's collected, how to opt out) is only accessible during onboarding via the "Learn more" link on the privacy notice step

### Expected Behavior

20.1 The "Help improve the app" toggle description in Settings SHALL include a "Learn more" link that navigates to the Privacy Details screen

### Implementation Notes

- Add `PrivacyExplanation` as a route in `RootNavigator`
- Add tappable "Learn more" link in the toggle's subtitle text in SettingsScreen
- Reuse existing `PrivacyExplanationScreen` component (already handles back navigation)

### Status

**Fixed** — implemented in ux-enhancements-v1.0 spec (Task 3: Privacy Details from Settings)

---

### Bonus: Removed LayoutAnimation Warning on New Architecture

### Current Behavior (Defect)

21.1 WHEN the app starts on Android THEN a console warning appears: "setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture"

### Fix Applied

Removed the `UIManager.setLayoutAnimationEnabledExperimental(true)` call from WalletScreen.tsx — unnecessary with New Architecture (Expo SDK 54 / RN 0.81). LayoutAnimation works natively without it.

### Status

**Fixed**

---


---

### Bug 12: Third-Party App Icon Shows Raw URL Text When Card Is First in Suggestion List

### Current Behavior (Defect)

22.1 WHEN BetterHelp (or another third_party icon card) is the FIRST item in the "Suggested tools to try" list during an emotion session THEN the icon area displays "htt" (raw URL text) instead of the bundled app logo

22.2 WHEN the same BetterHelp card appears further down the list (not first) THEN the bundled logo renders correctly

22.3 THE issue appears to be position-dependent — only the first item in the suggestion list fails to resolve the local asset, suggesting a race condition or rendering order issue in the icon component

### Expected Behavior (Correct)

23.1 WHEN a third_party icon card appears in any position of the suggestion list THEN the bundled app logo SHALL display correctly, regardless of list position

23.2 THE icon rendering SHALL not show raw URL text under any circumstances — if the image fails to load, the emoji fallback (not the URL) should be displayed

### Investigation Notes

- `renderCardIcon` delegates to `ThirdPartyIcon` for `third_party` type
- `ThirdPartyIcon` likely has a fallback mechanism that shows the `uri` prop as text before the local image resolves
- When the component is first in a FlatList/map, it may mount before the asset reference is resolved
- The `getAppLogoSource` registry lookup should be synchronous (bundled `require()`), so the issue may be in `ThirdPartyIcon`'s state/loading logic

### Status

**Fixed** — `getFallbackRecommendations` was missing `iconType` in returned objects. When undefined, ToolPreviewCard defaulted to 'emoji', rendering the URL as text. Added `iconType: card.iconType` to the fallback map.

<!-- Add additional cross-platform bugs below as they are discovered -->
