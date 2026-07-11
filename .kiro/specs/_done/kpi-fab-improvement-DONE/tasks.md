# Implementation Plan: KPI FAB Days-Since Badge

## Overview

Add a red notification badge to the existing KPI FAB showing days since last check-in, an explanation banner inside the focused Daily Check-in card, and admin testing tools for badge verification. Implementation follows: pure utility functions → property tests → store extension → presentation components → integration layers.

## Tasks

- [x] 1. Create all pure utility functions
  - [x] 1.1 Create `src/utils/kpiBadgeUtils.ts` with all pure functions
    - Implement `computeDaysElapsed(lastCheckInDateUtc: string | null, now?: Date): number | null` — converts UTC ISO timestamp to local date, computes calendar day difference, returns null for null input, clamps to >= 0
    - Implement `formatBadgeText(daysElapsed: number): string` — returns string number for 1–99, returns "99+" for > 99
    - Implement `getBadgeFontSize(daysElapsed: number): number` — returns 12 for single digit, 10 for multi-digit
    - Implement `getBadgeWidth(daysElapsed: number): number` — returns 20 for single digit, 22 for two digits, 28 for "99+"
    - Implement `getAccessibilityLabel(daysElapsed: number | null): string` — appends days count when >= 1, returns base label otherwise
    - Implement `formatExplanationMessage(daysElapsed: number | null): string | null` — returns message with singular/plural "day(s)" when >= 1, returns null for 0 or null
    - Implement `validateDaysAgoInput(input: string): string | null` — returns error message for invalid inputs (0, negative, non-numeric, empty, decimals), returns null for valid positive integers
    - Implement `computeFakeRecordTimestamp(daysAgo: number, now?: Date): string` — produces UTC ISO timestamp set to `daysAgo` days before reference date
    - _Requirements: 2.1, 3.2, 3.4, 3.5, 6.1, 6.2, 7.1, 7.2, 7.5, 8.2, 8.5_

- [x] 2. Write property tests for all pure functions
  - [x] 2.1 Write property tests for `computeDaysElapsed`
    - **Property 1: Calendar day computation is correct**
    - Use fast-check to generate random valid UTC ISO 8601 timestamps and reference dates
    - Assert result is never negative, equals expected calendar day difference in local time
    - **Validates: Requirements 2.1**

  - [x] 2.2 Write property tests for `formatBadgeText` and `getBadgeFontSize`
    - **Property 3: Badge text formatting and capping**
    - Use fast-check to generate integers 1–999
    - Assert formatBadgeText returns string for 1–99 and "99+" for > 99
    - Assert getBadgeFontSize returns 12 for 1–9 and 10 for >= 10
    - **Validates: Requirements 3.4, 3.5**

  - [x] 2.3 Write property tests for `getBadgeWidth` and `getAccessibilityLabel`
    - **Property 4: Badge minimum sizing** — assert getBadgeWidth always returns >= 20 for any positive integer
    - **Property 5: Accessibility label correctness** — assert label includes count when >= 1, equals base when null/0
    - **Validates: Requirements 3.2, 6.1, 6.2**

  - [x] 2.4 Write property tests for `formatExplanationMessage`
    - **Property 6: Explanation message formatting and visibility**
    - Use fast-check to generate integers 1–999 and assert non-null string with correct singular/plural and numeric count
    - Assert returns null for 0 and null inputs
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

  - [x] 2.5 Write property tests for `validateDaysAgoInput`
    - **Property 7: Admin days-ago input validation**
    - Use fast-check to generate invalid inputs (0, negatives, non-numeric strings, decimals, empty) and assert non-null error
    - Generate valid positive integers and assert null return
    - **Validates: Requirements 8.5**

  - [x] 2.6 Write property tests for `computeFakeRecordTimestamp`
    - **Property 8: Fake record timestamp computation**
    - Use fast-check to generate positive integers and reference dates
    - Assert the calendar day difference between the resulting timestamp and the reference date equals exactly `daysAgo`
    - **Validates: Requirements 8.2**

- [x] 3. Extend KPI Zustand store (including admin actions)
  - [x] 3.1 Add `lastCheckInDate` state and `loadLastCheckIn`/`refreshDaysElapsed` actions to `src/stores/kpiStore.ts`
    - Add `lastCheckInDate: string | null` and `lastCheckInLoaded: boolean` to `KpiState` interface
    - Add `loadLastCheckIn()` async action — queries `SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1`, sets state
    - Add `refreshDaysElapsed()` async action — re-queries DB and updates `lastCheckInDate`
    - On DB error, set `lastCheckInDate` to null (safe default, badge hidden)
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Update `recordKpi` flow to set `lastCheckInDate` immediately after insert
    - After successful KPI record insert, update `lastCheckInDate` in the store with the new record's timestamp
    - This avoids an extra DB read and hides the badge immediately
    - _Requirements: 1.4, 5.3_

  - [x] 3.3 Add `createFakeRecord` and `resetAllRecords` admin actions to `src/stores/kpiStore.ts`
    - Implement `createFakeRecord(daysAgo: number)` — uses `computeFakeRecordTimestamp` to generate timestamp, inserts fake row with `expo-crypto` UUID, then calls `loadLastCheckIn` to refresh cache
    - Implement `resetAllRecords()` — deletes all `kpi_records` rows, sets `lastCheckInDate` to null
    - Wrap both in try/catch, show Alert on error
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 3.4 Write unit tests for KPI store extension
    - Test `loadLastCheckIn` sets correct date from DB
    - Test `loadLastCheckIn` sets null when no records exist
    - Test `recordKpi` updates `lastCheckInDate` immediately
    - Test `createFakeRecord` inserts row and refreshes cache
    - Test `resetAllRecords` clears table and nulls state
    - _Requirements: 1.3, 1.4, 5.2, 5.3, 8.3, 8.4_

- [x] 4. Create DaysSinceBadge component
  - [x] 4.1 Create `src/components/wallet/DaysSinceBadge.tsx`
    - Accept `daysElapsed: number | null` prop
    - Render nothing when null or 0
    - Render red (#FF3B30) circle with white (#FFFFFF) bold number when >= 1
    - Use `getBadgeWidth`, `getBadgeFontSize`, `formatBadgeText` from kpiBadgeUtils
    - Position absolute, top: -4, right: -4
    - Set `pointerEvents: 'none'`, `accessibilityElementsHidden: true`, `importantForAccessibility: 'no'`
    - Add spring scale-up animation (0 → 1 via `withSpring({ damping: 12, stiffness: 180 })`) when transitioning from hidden to visible
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 6.3_

  - [x] 4.2 Write unit tests for DaysSinceBadge
    - Test renders nothing when daysElapsed is null
    - Test renders nothing when daysElapsed is 0
    - Test renders badge with correct text when daysElapsed >= 1
    - Test badge shows "99+" when daysElapsed > 99
    - Test badge has pointerEvents: 'none'
    - _Requirements: 1.1, 1.2, 1.3, 3.5, 4.4_

- [x] 5. Create BadgeExplanationBanner component
  - [x] 5.1 Create `src/components/wallet/BadgeExplanationBanner.tsx`
    - Accept `daysElapsedSnapshot: number | null` and `checkInCompleted: boolean` props
    - Render nothing when `daysElapsedSnapshot` is null or 0, or `checkInCompleted` is true
    - Render warm-toned banner (#FFF3E0 background, #5D4037 text, rounded corners)
    - Use `formatExplanationMessage` to generate the display text
    - 14pt text, centered, 12pt vertical padding, 16pt horizontal padding, 12pt bottom margin
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.2 Write unit tests for BadgeExplanationBanner
    - Test renders nothing when daysElapsedSnapshot is null
    - Test renders nothing when daysElapsedSnapshot is 0
    - Test renders nothing when checkInCompleted is true
    - Test renders correct message with singular "day" for 1
    - Test renders correct message with plural "days" for >= 2
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

- [x] 6. Create AdminKpiBadgeTools component
  - [x] 6.1 Create `src/components/settings/AdminKpiBadgeTools.tsx`
    - Section header: "🧪 KPI Badge Testing"
    - "Days ago" numeric text input with "Create Record" button
    - Inline validation error text using `validateDaysAgoInput`
    - "Reset All KPI Records" destructive button (red text) with confirmation Alert
    - On "Create Record" press: validate → call `kpiStore.createFakeRecord(daysAgo)`
    - On "Reset All" confirm: call `kpiStore.resetAllRecords()`
    - Wrap in bordered View for visual separation from normal settings
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 6.2 Write unit tests for AdminKpiBadgeTools
    - Test validation error shows for invalid input (0, empty, decimals)
    - Test create button calls store action with correct daysAgo
    - Test reset button shows confirmation alert
    - _Requirements: 8.5, 8.2, 8.4_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate badge into KpiFab (midnight + foreground refresh)
  - [x] 8.1 Create `useMidnightRefresh` hook and integrate into KpiFab in `src/screens/WalletScreen.tsx`
    - Implement `useMidnightRefresh(onMidnight: () => void)` — computes ms until next midnight, sets timeout, cleans up on unmount
    - Wire to `refreshDaysElapsed` from kpiStore
    - _Requirements: 2.2_

  - [x] 8.2 Add AppState foreground handler to KpiFab
    - Listen for AppState change to 'active', call `refreshDaysElapsed`
    - Clean up subscription on unmount
    - _Requirements: 2.3_

  - [x] 8.3 Integrate DaysSinceBadge and accessibility into KpiFab component
    - Call `loadLastCheckIn` on mount
    - Compute `daysElapsed` using `computeDaysElapsed(lastCheckInDate, new Date())`
    - Render `DaysSinceBadge` as child of the FAB's `Animated.View` (inherits FAB animation)
    - Update FAB's `accessibilityLabel` using `getAccessibilityLabel(daysElapsed)`
    - Badge animates with FAB (show/hide) as it's a child element
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 6.1, 6.2_

  - [x] 8.4 Write unit tests for KpiFab integration
    - Test FAB accessibility label includes days count when badge visible
    - Test FAB accessibility label is base text when badge hidden
    - Test AppState 'active' triggers refresh
    - _Requirements: 2.3, 6.1, 6.2_

- [x] 9. Integrate BadgeExplanationBanner into FocusedCardView
  - [x] 9.1 Add snapshot flow and render BadgeExplanationBanner in `src/components/wallet/FocusedCardView.tsx`
    - Capture `daysElapsed` snapshot when KPI FAB opens the Daily Check-in card (pass as prop or via state)
    - Conditionally render `BadgeExplanationBanner` as first child inside the card's scrollable content area
    - Only render when the focused card is the Daily Check-in card (match by `card.sourceLibraryId`)
    - Pass `checkInCompleted` flag (set true after `recordKpi` completes) to hide banner after check-in
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.2 Write unit tests for FocusedCardView banner integration
    - Test banner renders when daysElapsedSnapshot >= 1
    - Test banner does not render for non-KPI cards
    - Test banner hides after check-in completion
    - _Requirements: 7.1, 7.3, 7.4_

- [x] 10. Integrate AdminKpiBadgeTools into SettingsScreen
  - [x] 10.1 Conditionally render `AdminKpiBadgeTools` in `src/screens/SettingsScreen.tsx`
    - Import `useAdminStore` and `AdminKpiBadgeTools`
    - Render `AdminKpiBadgeTools` at the bottom of the Settings scroll area, only when `isAdminMode` is true
    - Component is completely absent from the tree when admin mode is inactive
    - _Requirements: 8.1, 8.6_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `KpiFab` function in `WalletScreen.tsx` is modified in-place (not extracted to a separate file)
- No schema migrations needed — reads from existing `kpi_records` table with existing index
- Admin tools use `useAdminStore` which already exists in the codebase (triple-tap activation on Library Browser)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1", "5.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "5.2", "6.2"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 7, "tasks": ["8.4", "9.1", "10.1"] },
    { "id": 8, "tasks": ["9.2"] }
  ]
}
```
