# Implementation Plan: Insights Period Availability

## Overview

Add data-age-based period disabling and tracking labels to the insights screens. A shared utility computes data age from the earliest DB record, derives which periods to disable, and formats a tracking label. The `TimePeriodSelector` gains a `disabledPeriods` prop for dimmed/non-interactive segments. Both `WalletInsightsScreen` and `ToolInsightsScreen` integrate the utility and pass results to the selector and header.

## Tasks

- [x] 1. Create data age utility module
  - [x] 1.1 Create `src/utils/dataAge.ts` with `computeDataAge`, `getDisabledPeriods`, and `formatTrackingLabel`
    - Implement `computeDataAge` — async function querying `MIN(recorded_at)` from `kpi_records` and `MIN(completed_at)` from `completions` using UNION ALL, returning `{ dataAge, earliestDate }`
    - Implement `getDisabledPeriods` — pure function mapping data age to disabled `TimePeriod[]` based on thresholds (7, 30, 90); `'all'` never disabled
    - Implement `formatTrackingLabel` — pure function returning `null` for 0, singular "1 day of tracking", or plural "X days of tracking"
    - Wrap DB call in try/catch, return `{ dataAge: 0, earliestDate: null }` on failure
    - _Requirements: 1.1, 1.2, 1.3, 2.1–2.7, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4_

  - [x] 1.2 Write property tests for `getDisabledPeriods` and `formatTrackingLabel` in `src/utils/__tests__/dataAge.test.ts`
    - **Property 2: Disabled periods are exactly those whose threshold exceeds data age, and "all" is never disabled**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
    - Use fast-check to generate arbitrary non-negative integers and assert the threshold invariant

  - [x] 1.3 Write property tests for `formatTrackingLabel` in `src/utils/__tests__/dataAge.test.ts`
    - **Property 4: Tracking label formatting is correct for all data ages**
    - **Validates: Requirements 4.2, 4.3, 4.4, 5.2, 5.3, 5.4**
    - Use fast-check to generate non-negative integers; assert null for 0, singular for 1, plural format otherwise

- [x] 2. Update `TimePeriodSelector` with disabled periods support
  - [x] 2.1 Add `disabledPeriods` prop and disabled rendering logic to `src/components/insights/TimePeriodSelector.tsx`
    - Add optional `disabledPeriods?: TimePeriod[]` to `TimePeriodSelectorProps`
    - For disabled segments: apply `opacity: 0.4` style, set `disabled={true}` on `TouchableOpacity`, pass `undefined` to `onPress`, set `accessibilityState={{ disabled: true }}`, use `activeOpacity={1}` to suppress press feedback
    - Add `segmentDisabled` and `labelDisabled` style entries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Write unit tests for `TimePeriodSelector` disabled behavior
    - **Property 3: Disabled segments do not trigger period change callback**
    - **Validates: Requirements 3.3, 3.5**
    - Render component with `disabledPeriods` containing a period, simulate press on that segment, assert `onPeriodChange` was NOT called

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate data age into insights screens
  - [x] 4.1 Integrate `computeDataAge`, disabled periods, and tracking label into `src/screens/WalletInsightsScreen.tsx`
    - Call `computeDataAge()` on mount and on refresh; store `dataAge` in local state
    - Derive `disabledPeriods` via `getDisabledPeriods(dataAge)` and pass to `TimePeriodSelector`
    - If currently selected period is in disabled list, auto-select `'all'`
    - Format tracking label via `formatTrackingLabel(dataAge)`; render as subtitle "Insights · X days of tracking" below header title when non-null
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.3_

  - [x] 4.2 Integrate `computeDataAge`, disabled periods, and tracking label into `src/screens/ToolInsightsScreen.tsx`
    - Call `computeDataAge()` on mount; store `dataAge` in local state
    - Derive `disabledPeriods` via `getDisabledPeriods(dataAge)` and pass to `TimePeriodSelector`
    - If currently selected period is in disabled list, auto-select `'all'`
    - Append tracking label to header subtitle: `{cardTitle} · X days of tracking` when non-null; show only `cardTitle` when null
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.2, 6.3_

- [x] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The language used is TypeScript (React Native / Expo project)
- `computeDataAge` accepts an optional `now` parameter for deterministic testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.2"] }
  ]
}
```
