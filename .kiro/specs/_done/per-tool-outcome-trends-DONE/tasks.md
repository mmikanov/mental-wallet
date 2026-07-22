# Implementation Plan: Per-Tool Outcome Trends

## Overview

Add a per-tool Outcome Trends chart to the ToolInsightsScreen showing weekly average Daily_Check_In_Score alongside weekly total practice time for a specific tool. The implementation adds a `computeToolOutcomeTrend` method to the existing CorrelationEngine, creates a new `OutcomeTrendsSection` component, and integrates it between the EngagementSection and CorrelationDisclaimer.

## Tasks

- [x] 1. Add `computeToolOutcomeTrend` method to CorrelationEngine
  - [x] 1.1 Add `computeToolOutcomeTrend` to the `CorrelationEngine` interface and implement the method in `createCorrelationEngine()`
    - Add the method signature to the `CorrelationEngine` interface in `src/services/correlationEngine.ts`
    - Implement the full algorithm: fetch completions for cardId (full history, no date filter), build Tool_Associated_Days set (D and D−1), fetch KPI records on those days, fetch completed duration_records for cardId, group into Mon-Sun Weekly_Buckets via `getWeekKey()`, compute weekly avg score + weekly total duration (minutes, 2dp), filter out buckets with no KPI scores, sort chronologically, return `null` if fewer than 2 qualifying buckets
    - Reuse existing internal helpers: `toDateString`, `getPreviousDay`, `getWeekKey`, `groupByWeek`
    - Return type: `WalletCorrelationResult | null` (existing interface already matches)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Implement `determinePerToolTrend` and `generatePerToolSummaryText` helper functions
    - Add `determinePerToolTrend(weeklyAvgScore: number[])` — compares average of last 2 weekly scores vs all prior weeks, ±0.3 threshold; when only 2 weeks exist, compare second to first
    - Add `generatePerToolSummaryText(trend)` — returns plain-language summary for positive/neutral/negative trends
    - Wire these into `computeToolOutcomeTrend` to populate `overallTrend` and `summaryText` fields
    - _Requirements: 1.5, 1.6_

  - [x] 1.3 Write property tests for `computeToolOutcomeTrend` logic
    - **Property 1: Weekly Bucket Inclusion Invariant** — every output bucket has at least one Tool_Associated_Day with a KPI score
    - **Property 2: Weekly Average Score Correctness** — output avg equals arithmetic mean of scores in that bucket
    - **Property 3: Weekly Duration Total Correctness** — output duration equals sum(active_duration_sec)/60 rounded to 2dp, or 0 if no records
    - **Property 4: Trend Classification Correctness** — trend matches ±0.3 threshold rule comparing last 2 vs prior
    - **Property 5: Card-Scoped Data Isolation** — only records matching the specified cardId contribute
    - **Property 6: Completed-Only Duration Filtering** — only `end_status = 'completed'` records contribute to duration
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3**

- [x] 2. Checkpoint - Ensure CorrelationEngine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create `OutcomeTrendsSection` component
  - [x] 3.1 Create `src/components/insights/OutcomeTrendsSection.tsx`
    - Accept `OutcomeTrendsSectionProps` with `data: WalletCorrelationResult | null`
    - Return `null` when `data` is null or `data.weeklyAvgScore.length < 2`
    - Render card container matching EngagementSection styling (padding 16, marginHorizontal 16, marginVertical 8, backgroundColor #F9FAFB, borderRadius 12, borderWidth 1, borderColor #E5E7EB)
    - Render section title "Outcome Trends" (16px, semi-bold, color #111827)
    - Render `DualAxisChart` passing `weeklyAvgScore`, `weeklyTotalDurationMin`, `overallTrend`, `summaryText`
    - Render summary text below chart (14px, color #374151, lineHeight 20)
    - Add accessibility: `accessibilityRole="summary"`, `accessibilityLabel` combining title and summaryText
    - Summary text must be a standalone `<Text>` element with no `numberOfLines` (no truncation)
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3_

  - [x] 3.2 Write unit tests for `OutcomeTrendsSection`
    - **Property 7: Section Hidden When Insufficient Data** — renders nothing when data is null or weeklyAvgScore.length < 2
    - Test that DualAxisChart receives correct props
    - Test accessibility attributes
    - **Validates: Requirements 2.7, 4.1, 4.2, 4.3**

- [x] 4. Integrate into ToolInsightsScreen
  - [x] 4.1 Wire `OutcomeTrendsSection` into `src/screens/ToolInsightsScreen.tsx`
    - Import `OutcomeTrendsSection` and `WalletCorrelationResult`
    - Add state: `const [outcomeTrend, setOutcomeTrend] = useState<WalletCorrelationResult | null>(null)`
    - In `loadInsightsData`, call `correlationEngine.computeToolOutcomeTrend(cardId)` and set state (catch errors, leave as null if it throws — log a warning)
    - Insert `<OutcomeTrendsSection data={outcomeTrend} />` between `EngagementSection` and `CorrelationDisclaimer` in the ScrollView JSX
    - No tier gating — section renders whenever data has 2+ qualifying buckets
    - No time period filter — method uses full history
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Write integration test for section ordering and conditional rendering
    - Verify OutcomeTrendsSection appears between EngagementSection and CorrelationDisclaimer
    - Verify section is hidden when computeToolOutcomeTrend returns null
    - _Requirements: 2.2, 2.7_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Adaptive Bucket Granularity
  - [x] 6.1 Add `granularity` parameter to `computeToolOutcomeTrend`
    - Update the method signature: `computeToolOutcomeTrend(cardId: string, startDate?: string, granularity?: 'daily' | 'weekly')`
    - Update the interface definition in `correlationEngine.ts`
    - Default `granularity` to `'weekly'` when not provided (backward compatible)
    - When `granularity === 'daily'`: group records by calendar date (`toDateString()`) instead of `getWeekKey()`
    - Generate all dates in the range (startDate to now) as bucket keys
    - For each date: use the KPI score directly (no averaging), sum Duration_Records for that day
    - For dates with no KPI score: use 0
    - Minimum 2 buckets to return data (same as weekly)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 6.2 Add `granularity` parameter to `computeWalletCorrelation`
    - Update the method signature: `computeWalletCorrelation(timePeriod: TimePeriod, granularity?: 'daily' | 'weekly')`
    - When `granularity === 'daily'`: group by date instead of week
    - Default to `'weekly'`
    - _Requirements: 5.7_

  - [x] 6.3 Add `granularity` and `rangeStartDate` fields to `WalletCorrelationResult`
    - Add optional fields: `granularity?: 'daily' | 'weekly'` and `rangeStartDate?: string`
    - Populate them from the computation methods
    - _Requirements: 5.5, 5.7_

  - [x] 6.4 Update DualAxisChart to support daily x-axis labels
    - Add optional `granularity` and `rangeStartDate` props to `DualAxisChartProps`
    - When `granularity === 'daily'`: generate x-axis labels as abbreviated day names ("Mon", "Tue", etc.) derived from `rangeStartDate` + index
    - When `granularity === 'weekly'` (default): use existing `getWeekLabels()` logic
    - Update `buildAccessibleDescription` to say "over N days" instead of "over N weeks" for daily
    - _Requirements: 5.5, 5.8_

  - [x] 6.5 Update ToolInsightsScreen to pass granularity
    - Derive granularity from selected period and data age: `const granularity = impactTimePeriod === '7d' || (impactTimePeriod === 'all' && dataAge <= 14) ? 'daily' : 'weekly'`
    - Pass to `computeToolOutcomeTrend(cardId, startDate, granularity)`
    - Pass granularity and rangeStartDate from the result to `PerToolOutcomeTrendsSection` → `DualAxisChart`
    - _Requirements: 5.7_

  - [x] 6.6 Update WalletInsightsScreen to pass granularity
    - Derive granularity from selected period and data age: `const granularity = timePeriod === '7d' || (timePeriod === 'all' && dataAge <= 14) ? 'daily' : 'weekly'`
    - Pass to `computeWalletCorrelation(timePeriod, granularity)` in `loadWalletInsights`
    - Pass granularity and rangeStartDate to `OutcomeTrendsSection` → `DualAxisChart`
    - _Requirements: 5.7_

  - [x] 6.7 Write property test for daily bucket granularity (Property 8)
    - **Property 8: Daily bucket granularity produces one bucket per calendar day**
    - For any 7-day range with data, verify output array length equals number of calendar days in range
    - Verify score values match raw KPI scores (no averaging)
    - Verify duration values are daily sums
    - _Requirements: 5.1, 5.3, 5.4, 5.6_

  - [x] 6.8 Write unit tests for adaptive granularity
    - Test: 7d period produces daily buckets with day-name labels
    - Test: 30d period produces weekly buckets with week labels (unchanged)
    - Test: DualAxisChart renders correct label format for daily vs weekly
    - Test: accessible description uses "days" for daily and "weeks" for weekly
    - _Requirements: 5.1, 5.2, 5.5, 5.8_

- [x] 7. Final checkpoint — Adaptive granularity
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `WalletCorrelationResult` interface already exists and matches the needed shape — no new types required
- The DualAxisChart component is reused as-is with no prop changes
- `computeToolOutcomeTrend` uses full data history (no time period filter) and no tier gating
- Internal helpers (`toDateString`, `getPreviousDay`, `getWeekKey`, `groupByWeek`) are already implemented in `correlationEngine.ts` — they just need to be called from the new method
- Granularity auto-selects 'daily' for "All time" when the user's total data age is ≤ 14 days, ensuring short-history users see meaningful day-by-day charts instead of sparse 1-2 point weekly views
- The EngagementSection shows contextual empty state messaging: "You haven't used this tool recently" when historical data exists but not in the selected period, vs "Use this tool a few more times" for truly new tools
- DualAxisChart x-axis label width is 32px with `numberOfLines={1}` to prevent month-format labels (e.g., "-5mo") from wrapping

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6", "6.7", "6.8"] }
  ]
}
```
