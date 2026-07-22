# Design Document: Per-Tool Outcome Trends

## Overview

This feature adds a per-tool Outcome Trends chart to the ToolInsightsScreen. It shows weekly average Daily_Check_In_Score alongside weekly total practice time for a specific tool, giving users a visual timeline of how their check-in scores and practice intensity for that tool have evolved week-over-week.

The implementation adds one new method (`computeToolOutcomeTrend`) to the existing CorrelationEngine, one new section component (`OutcomeTrendsSection`), and integrates them into the ToolInsightsScreen between the EngagementSection and CorrelationDisclaimer.

## Architecture

### Component Diagram

```
ToolInsightsScreen
├── DailyCheckInImpact
├── EngagementSection
├── PerToolOutcomeTrendsSection  ← NEW
│   ├── Section title ("Outcome Trends")
│   ├── DualAxisChart (reused, existing component)
│   └── Summary text
└── CorrelationDisclaimer
```

### Data Flow

```
ToolInsightsScreen (mount)
  │
  ├─ correlationEngine.computeToolOutcomeTrend(cardId)
  │     │
  │     ├─ Query completions for cardId (full history)
  │     ├─ Build Tool_Associated_Days set (D and D−1)
  │     ├─ Query KPI records on Tool_Associated_Days
  │     ├─ Query duration_records for cardId (completed only, full history)
  │     ├─ Group into Mon-Sun Weekly_Buckets via getWeekKey()
  │     ├─ Compute weekly avg score + weekly total duration (min)
  │     ├─ Filter out buckets with no KPI scores
  │     ├─ Determine overall trend (last 2 weeks vs prior)
  │     └─ Generate summary text
  │
  └─ OutcomeTrendsSection receives WalletCorrelationResult
       └─ DualAxisChart renders dot-and-line overlay
```

## Components

### 1. `computeToolOutcomeTrend` — New Method on CorrelationEngine

**Location:** `src/services/correlationEngine.ts`

**Signature:**

```typescript
computeToolOutcomeTrend(cardId: string, startDate?: string): Promise<WalletCorrelationResult | null>;
```

**Return type:** Reuses `WalletCorrelationResult` (already exported) which contains:

```typescript
interface WalletCorrelationResult {
  weeklyAvgScore: number[];
  weeklyTotalDurationMin: number[];
  overallTrend: 'positive' | 'neutral' | 'negative';
  summaryText: string;
}
```

Returns `null` when fewer than 2 Weekly_Buckets qualify (the section hides itself).

**Interface update:** Add to the `CorrelationEngine` interface:

```typescript
export interface CorrelationEngine {
  // ... existing methods ...

  /** Compute per-tool weekly outcome trend data for the dual-axis chart. */
  computeToolOutcomeTrend(cardId: string, startDate?: string): Promise<WalletCorrelationResult | null>;
}
```

**Algorithm:**

1. Fetch completions for `cardId`. If `startDate` is provided, only include completions on or after that date; otherwise use full history.
2. Build the Tool_Associated_Days set: for each completion day D, include both D and D−1.
3. Fetch all KPI records where `recorded_at` date is in Tool_Associated_Days.
4. Fetch `duration_records` for `cardId` with `end_status = 'completed'`. If `startDate` is provided, only include records on or after that date; otherwise use full history.
5. Group KPI scores into Weekly_Buckets using `getWeekKey()` (existing helper).
6. Group duration records into Weekly_Buckets using `getWeekKey()`.
7. For each bucket that has at least one KPI score entry:
   - Compute average score (sum of scores / count).
   - Compute total duration in minutes (sum of `active_duration_sec` / 60, rounded to 2dp).
   - If the bucket has no duration records, use 0.
8. Sort buckets chronologically. Produce parallel arrays `weeklyAvgScore` and `weeklyTotalDurationMin`.
9. If fewer than 2 qualifying buckets exist, return `null`.
10. Determine `overallTrend` using the per-tool trend logic: average of last 2 buckets vs average of all prior buckets, ±0.3 threshold.
11. Generate `summaryText` based on trend direction.

**Reused internal helpers:**
- `toDateString(isoTimestamp)` — extract YYYY-MM-DD
- `getPreviousDay(dateStr)` — compute D−1
- `getWeekKey(isoTimestamp)` — get ISO week key for grouping
- `groupByWeek(entries)` — group `{value, date}[]` into `Record<string, number[]>`

**New internal helper:**

```typescript
/**
 * Determine per-tool trend by comparing last 2 weekly scores vs all prior.
 * Positive: recent avg exceeds prior avg by 0.3+
 * Negative: recent avg falls below prior avg by 0.3+
 * Neutral: within ±0.3
 */
function determinePerToolTrend(
  weeklyAvgScore: number[]
): 'positive' | 'neutral' | 'negative' {
  if (weeklyAvgScore.length < 2) {
    return 'neutral';
  }

  const last2 = weeklyAvgScore.slice(-2);
  const prior = weeklyAvgScore.slice(0, -2);

  if (prior.length === 0) {
    // Only 2 weeks — compare second to first
    const diff = last2[1] - last2[0];
    if (diff >= 0.3) return 'positive';
    if (diff <= -0.3) return 'negative';
    return 'neutral';
  }

  const recentAvg = last2.reduce((s, v) => s + v, 0) / last2.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  const diff = recentAvg - priorAvg;

  if (diff >= 0.3) return 'positive';
  if (diff <= -0.3) return 'negative';
  return 'neutral';
}
```

**New internal helper:**

```typescript
/**
 * Generate plain-language summary for per-tool outcome trend.
 */
function generatePerToolSummaryText(
  trend: 'positive' | 'neutral' | 'negative'
): string {
  switch (trend) {
    case 'positive':
      return 'Your check-in scores tend to be higher in weeks where you practice this tool more.';
    case 'negative':
      return 'Your check-in scores have dipped recently on weeks you use this tool.';
    case 'neutral':
      return 'Your scores and practice time have stayed fairly steady.';
  }
}
```

### 2. `PerToolOutcomeTrendsSection` — New Section Component

**Location:** `src/components/insights/PerToolOutcomeTrendsSection.tsx`

**Props:**

```typescript
export interface PerToolOutcomeTrendsSectionProps {
  data: WalletCorrelationResult | null;
}
```

**Behavior:**
- If `data` is `null` or `data.weeklyAvgScore.length < 2`, render nothing (return `null`).
- Otherwise, render a card container with:
  - Section title "Outcome Trends" (16px, semi-bold, #111827)
  - `DualAxisChart` with props passed through unchanged
  - Summary text below the chart (14px, #374151, lineHeight 20)

**Styling:** Matches EngagementSection card container:
- `padding: 16`
- `marginHorizontal: 16`
- `marginVertical: 8`
- `backgroundColor: '#F9FAFB'`
- `borderRadius: 12`
- `borderWidth: 1`
- `borderColor: '#E5E7EB'`

**Accessibility:**
- Container: `accessibilityRole="summary"`, `accessibilityLabel` = `"Outcome Trends. {summaryText}"`
- DualAxisChart handles its own accessibility description internally (existing behavior)
- Summary text: standalone `<Text>` element with no `numberOfLines` (no truncation)

### 3. ToolInsightsScreen Integration

**Changes to `src/screens/ToolInsightsScreen.tsx`:**

1. Import `PerToolOutcomeTrendsSection` and `WalletCorrelationResult`.
2. Add state: `const [outcomeTrend, setOutcomeTrend] = useState<WalletCorrelationResult | null>(null);`
3. In `loadInsightsData`, after loading duration stats, call:
   ```typescript
   const trendStartDate = getTimePeriodStartDate(impactTimePeriod);
   const trend = await correlationEngine.computeToolOutcomeTrend(cardId, trendStartDate ?? undefined);
   setOutcomeTrend(trend);
   ```
4. Insert `<PerToolOutcomeTrendsSection data={outcomeTrend} />` between EngagementSection and CorrelationDisclaimer in the JSX.

**Section order after change:**
1. DailyCheckInImpact
2. EngagementSection
3. **PerToolOutcomeTrendsSection** ← new
4. CorrelationDisclaimer

**Time period filtering:** The `computeToolOutcomeTrend` method receives the selected time period's start date (via `getTimePeriodStartDate`), filtering data to the currently visible period. This ensures the chart reflects the same time window as other sections on the screen.

**No tier gating:** The section renders whenever 2+ qualifying weekly buckets exist, regardless of the user's insight tier.

## Data Models

No new database tables or columns. The feature reads from existing tables:

- `completions` — `card_id`, `completed_at` (to identify Tool_Associated_Days)
- `kpi_records` — `value`, `recorded_at` (Daily_Check_In_Score)
- `duration_records` — `card_id`, `active_duration_sec`, `started_at`, `end_status`

All data access uses the existing `getDatabase()` connection.

## Error Handling

- If `computeToolOutcomeTrend` throws, catch in `loadInsightsData` and leave `outcomeTrend` as `null` (section hidden). Log a warning.
- If the method returns `null` (insufficient data), the section simply doesn't render.
- Database query failures within the method are caught and result in a `null` return.

## Performance Considerations

- The method performs 3 database queries (completions, KPI records, duration records). All are indexed by `card_id` and/or `recorded_at`/`started_at`.
- No time-period filter means queries scan the full table for the given card. For typical usage (months of data, not years), this is negligible (<100ms on SQLite).
- The method runs concurrently with other data loading in `loadInsightsData` (can be parallelized with duration stats if desired, though sequential is simpler and sufficient).

## 6. Adaptive Bucket Granularity

### Motivation

When viewing a 7-day period, weekly bucketing produces at most 1–2 data points (a single Mon-Sun week spans the entire window). This makes the chart uninformative or hidden entirely. Daily granularity provides 7 meaningful data points for this short window.

### Granularity Rules

| Time Period | Bucket Granularity | X-axis Label Format | Min Buckets to Show |
|-------------|-------------------|---------------------|---------------------|
| 7d          | Daily             | "Mon", "Tue", etc. or "7/14" | 2 days |
| 30d         | Weekly            | "-3w", "-2w", "Now" | 2 weeks |
| 90d         | Weekly            | "-3w", "-2w", "Now" | 2 weeks |
| all         | Weekly            | "-3w", "-2w", "Now" | 2 weeks |

### Changes to `computeToolOutcomeTrend`

The method signature gains an optional `granularity` parameter:

```typescript
computeToolOutcomeTrend(
  cardId: string,
  startDate?: string,
  granularity?: 'daily' | 'weekly'  // defaults to 'weekly'
): Promise<WalletCorrelationResult | null>;
```

When `granularity === 'daily'`:
1. Instead of calling `groupByWeek()`, group records by their calendar date (`toDateString()`).
2. Generate all dates in the range (start to now) as bucket keys.
3. For each date that is a Tool_Associated_Day with a KPI score: use that score directly (no averaging — max one KPI per day).
4. For each date: sum completed Duration_Records for the card on that date.
5. For dates with no KPI score: use 0 (chart will show a gap/zero).
6. The minimum bucket count to return data is still 2.

The caller (ToolInsightsScreen) derives granularity from the selected period:
```typescript
const granularity = impactTimePeriod === '7d' ? 'daily' : 'weekly';
```

### Changes to `computeWalletCorrelation`

Same granularity logic: when the time period is '7d', use daily bucketing.

### Changes to DualAxisChart

The component needs to support daily x-axis labels. Add an optional `granularity` prop:

```typescript
export interface DualAxisChartProps {
  weeklyAvgScore: number[];
  weeklyTotalDurationMin: number[];
  overallTrend: 'positive' | 'neutral' | 'negative';
  summaryText: string;
  /** Determines x-axis label format. Default 'weekly'. */
  granularity?: 'daily' | 'weekly';
  /** Start date of the range (needed for daily label generation). ISO string. */
  rangeStartDate?: string;
}
```

When `granularity === 'daily'`:
- X-axis labels use abbreviated day names: "Mon", "Tue", "Wed", etc.
- If there are more than 7 points (shouldn't happen for 7d), fall back to short date format "M/D".
- The accessible description says "over N days" instead of "over N weeks".

When `granularity === 'weekly'` (default):
- Current behavior unchanged.

### Changes to WalletCorrelationResult

Add an optional field to carry granularity context to the chart:

```typescript
interface WalletCorrelationResult {
  weeklyAvgScore: number[];
  weeklyTotalDurationMin: number[];
  overallTrend: 'positive' | 'neutral' | 'negative';
  summaryText: string;
  granularity?: 'daily' | 'weekly';  // NEW — for chart labeling
  rangeStartDate?: string;           // NEW — for daily label generation
}
```

### Correctness Property

**Property 8: Daily bucket granularity produces one bucket per calendar day**

For any card with data in a 7-day window, when `granularity === 'daily'`, `computeToolOutcomeTrend` SHALL produce arrays where each entry corresponds to exactly one calendar day in the range. The number of entries SHALL equal the number of calendar days between the start date and today (inclusive), not the number of days with data.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Weekly Bucket Inclusion Invariant

For any card with usage history, every Weekly_Bucket in the output `weeklyAvgScore` array corresponds to a calendar week containing at least one Tool_Associated_Day with a recorded Daily_Check_In_Score. No bucket without a KPI score entry shall appear in the output.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Weekly Average Score Correctness

For any set of Daily_Check_In_Score values grouped into a Weekly_Bucket, the corresponding entry in `weeklyAvgScore` equals the arithmetic mean of all scores recorded on Tool_Associated_Days within that bucket (sum of scores / count of scores).

**Validates: Requirements 1.2**

### Property 3: Weekly Duration Total Correctness

For any set of completed Duration_Records for a card grouped into a Weekly_Bucket, the corresponding entry in `weeklyTotalDurationMin` equals the sum of all `active_duration_sec` values in that bucket divided by 60, rounded to two decimal places. If no Duration_Records exist for that bucket, the value is 0.

**Validates: Requirements 1.3**

### Property 4: Trend Classification Correctness

For any `weeklyAvgScore` array with length >= 2, the `overallTrend` value equals "positive" if the mean of the last 2 entries exceeds the mean of all prior entries by 0.3 or more, "negative" if it falls below by 0.3 or more, and "neutral" otherwise.

**Validates: Requirements 1.5**

### Property 5: Card-Scoped Data Isolation

For any invocation of `computeToolOutcomeTrend(cardId)`, the output `weeklyTotalDurationMin` values reflect only Duration_Records where `card_id` matches the specified cardId, and Tool_Associated_Days are derived only from completions where `card_id` matches the specified cardId.

**Validates: Requirements 3.1, 3.2**

### Property 6: Completed-Only Duration Filtering

For any Duration_Record set, only records with `end_status = 'completed'` contribute to `weeklyTotalDurationMin` values. Records with `end_status` of "collapsed" or "timed_out" are excluded from duration computation.

**Validates: Requirements 3.3**

### Property 7: Section Hidden When Insufficient Data

For any `WalletCorrelationResult` where `weeklyAvgScore.length < 2` (or when `data` is null), the OutcomeTrendsSection component renders nothing — no DOM elements are produced.

**Validates: Requirements 2.7**
