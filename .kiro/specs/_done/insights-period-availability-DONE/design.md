# Design Document: Insights Period Availability

## Architecture Overview

This feature adds two capabilities to the existing insights screens:

1. **Disabled period pills** — Time period options in `TimePeriodSelector` that exceed the user's actual data history are visually dimmed and non-interactive.
2. **Tracking label** — A "X days of tracking" indicator displayed in the header of both insights screens.

Both capabilities depend on a shared **Data_Age** computation that queries the earliest record across `kpi_records` and `completions` tables.

### Design Principles

- The data-age computation is a pure utility function (easily testable, reusable).
- The disabled-periods derivation is a pure function of data-age (no side effects).
- The `TimePeriodSelector` component remains stateless — it receives `disabledPeriods` as a prop and handles rendering/interaction logic internally.
- Each screen is responsible for querying data age on mount/refresh and passing the result downstream.

---

## Components

### 1. `computeDataAge` Utility Function

**Location:** `src/utils/dataAge.ts`

A shared utility that queries the database for the earliest record date and computes data age.

```typescript
import { getDatabase } from '@/data/database';

export interface DataAgeResult {
  /** Number of whole days since earliest record. 0 if no records exist. */
  dataAge: number;
  /** The earliest record date, or null if no records exist. */
  earliestDate: Date | null;
}

/**
 * Computes the user's data age by finding the earliest record
 * across kpi_records and completions tables.
 *
 * @param now - Optional override for current date (for testing).
 * @returns DataAgeResult with the computed age in whole days.
 */
export async function computeDataAge(now?: Date): Promise<DataAgeResult> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ earliest: string | null }>(`
    SELECT MIN(earliest_date) as earliest FROM (
      SELECT MIN(recorded_at) as earliest_date FROM kpi_records
      UNION ALL
      SELECT MIN(completed_at) as earliest_date FROM completions
    )
  `);

  if (!row?.earliest) {
    return { dataAge: 0, earliestDate: null };
  }

  const earliestDate = new Date(row.earliest);
  const currentDate = now ?? new Date();
  const diffMs = currentDate.getTime() - earliestDate.getTime();
  const dataAge = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  return { dataAge, earliestDate };
}
```

### 2. `getDisabledPeriods` Pure Function

**Location:** `src/utils/dataAge.ts` (same file, exported)

A pure function that derives which periods should be disabled based on data age.

```typescript
import type { TimePeriod } from '@/services/tierEvaluator';

/** Period day thresholds. "all" has no threshold (always enabled). */
const PERIOD_THRESHOLDS: Record<Exclude<TimePeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/**
 * Determines which time periods should be disabled based on data age.
 * "All time" is never disabled.
 *
 * @param dataAge - Number of whole days of tracking data.
 * @returns Array of TimePeriod values that should be disabled.
 */
export function getDisabledPeriods(dataAge: number): TimePeriod[] {
  const disabled: TimePeriod[] = [];

  for (const [period, threshold] of Object.entries(PERIOD_THRESHOLDS)) {
    if (dataAge < threshold) {
      disabled.push(period as TimePeriod);
    }
  }

  return disabled;
}
```

### 3. `formatTrackingLabel` Pure Function

**Location:** `src/utils/dataAge.ts` (same file, exported)

Formats the tracking label with proper singular/plural handling.

```typescript
/**
 * Formats the tracking label string.
 * Returns null if dataAge is 0 (no label should be shown).
 *
 * @param dataAge - Number of whole days of tracking.
 * @returns Formatted string like "X days of tracking" or null.
 */
export function formatTrackingLabel(dataAge: number): string | null {
  if (dataAge <= 0) {
    return null;
  }

  const unit = dataAge === 1 ? 'day' : 'days';
  return `${dataAge} ${unit} of tracking`;
}
```

### 4. Updated `TimePeriodSelector` Component

**Location:** `src/components/insights/TimePeriodSelector.tsx`

Add an optional `disabledPeriods` prop. Disabled segments get:
- `opacity: 0.4` style
- No `onPress` handler (replaced with a non-interactive `View` or a no-op)
- `accessibilityState={{ disabled: true }}` on the segment

```typescript
export interface TimePeriodSelectorProps {
  availablePeriods: TimePeriod[];
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  /** Periods that are visually dimmed and non-interactive. */
  disabledPeriods?: TimePeriod[];
}

export function TimePeriodSelector({
  availablePeriods,
  selectedPeriod,
  onPeriodChange,
  disabledPeriods = [],
}: TimePeriodSelectorProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {availablePeriods.map((period) => {
        const isSelected = period === selectedPeriod;
        const isDisabled = disabledPeriods.includes(period);

        return (
          <TouchableOpacity
            key={period}
            style={[
              styles.segment,
              isSelected && !isDisabled && styles.segmentSelected,
              isDisabled && styles.segmentDisabled,
            ]}
            onPress={isDisabled ? undefined : () => onPeriodChange(period)}
            disabled={isDisabled}
            accessibilityRole="tab"
            accessibilityState={{
              selected: isSelected && !isDisabled,
              disabled: isDisabled,
            }}
            accessibilityLabel={PERIOD_LABELS[period]}
            testID={`period-segment-${period}`}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
            activeOpacity={isDisabled ? 1 : 0.7}
          >
            <Text
              style={[
                styles.label,
                isSelected && !isDisabled && styles.labelSelected,
                isDisabled && styles.labelDisabled,
              ]}
            >
              {PERIOD_LABELS[period]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Additional styles:
// segmentDisabled: { opacity: 0.4 }
// labelDisabled: { color: '#666666' }
```

### 5. WalletInsightsScreen Integration

On mount (and on refresh), the screen:
1. Calls `computeDataAge()` to get the data age.
2. Calls `getDisabledPeriods(dataAge)` to determine disabled periods.
3. Passes `disabledPeriods` to `TimePeriodSelector`.
4. Formats the tracking label via `formatTrackingLabel(dataAge)` and renders it below the "Insights" title as a subtitle (e.g., "331 days of tracking").

The header title display becomes:
```typescript
<Text style={styles.headerTitle}>Insights</Text>
{trackingLabel && (
  <Text style={styles.trackingLabel}>{trackingLabel}</Text>
)}
```

Note: The tracking label appears as a subtitle below the "Insights" title when data age > 0. When data age = 0, only the title is shown.

### 6. ToolInsightsScreen Integration

Same pattern as WalletInsightsScreen:
1. Calls `computeDataAge()` on mount.
2. Passes `disabledPeriods` to `TimePeriodSelector`.
3. Appends tracking label to the header subtitle: `{cardTitle} · X days of tracking`.

When data age is 0, only the card title is shown in the subtitle.

---

## Data Model

No new database tables or migrations are needed. The feature queries existing tables:

- **`kpi_records`** — `MIN(recorded_at)` gives earliest KPI record date.
- **`completions`** — `MIN(completed_at)` gives earliest completion date.

The query uses `UNION ALL` + outer `MIN` to find the global earliest date in a single round-trip.

---

## Interfaces

```typescript
// src/utils/dataAge.ts — Exported interface
export interface DataAgeResult {
  dataAge: number;
  earliestDate: Date | null;
}

// src/utils/dataAge.ts — Exported functions
export async function computeDataAge(now?: Date): Promise<DataAgeResult>;
export function getDisabledPeriods(dataAge: number): TimePeriod[];
export function formatTrackingLabel(dataAge: number): string | null;

// src/components/insights/TimePeriodSelector.tsx — Updated props
export interface TimePeriodSelectorProps {
  availablePeriods: TimePeriod[];
  selectedPeriod: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  disabledPeriods?: TimePeriod[];
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Database query fails in `computeDataAge` | Return `{ dataAge: 0, earliestDate: null }`. Log warning. No disabled periods, no tracking label. |
| `disabledPeriods` prop is omitted/empty | `TimePeriodSelector` behaves exactly as before (all periods interactive). Backward compatible. |
| Currently selected period becomes disabled | The screen logic should auto-select "All time" (always enabled) if the current selection is in the disabled list. |

---

## Performance Considerations

- `computeDataAge` runs a single lightweight SQL query with `MIN` aggregations — O(1) index-backed lookups on `idx_kpi_records_recorded_at` and `idx_completions_date`.
- Called once per screen mount/refresh, not on every render.
- `getDisabledPeriods` and `formatTrackingLabel` are trivial O(1) pure functions.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Data age equals floor-days from the earlier of two earliest dates

*For any* pair of earliest KPI record date and earliest completion date (both potentially null), `computeDataAge` SHALL return a `dataAge` equal to `Math.floor((now - min(earliestKpi, earliestCompletion)) / oneDay)`, or 0 if both dates are null.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Disabled periods are exactly those whose threshold exceeds data age, and "all" is never disabled

*For any* non-negative integer `dataAge`, `getDisabledPeriods(dataAge)` SHALL return a list containing period `p` if and only if `dataAge < threshold(p)`, where `threshold('7d') = 7`, `threshold('30d') = 30`, `threshold('90d') = 90`. The period `'all'` SHALL never appear in the returned list.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

### Property 3: Disabled segments do not trigger period change callback

*For any* `TimePeriodSelector` rendered with a non-empty `disabledPeriods` list, pressing a disabled segment SHALL NOT invoke the `onPeriodChange` callback.

**Validates: Requirements 3.3, 3.5**

### Property 4: Tracking label formatting is correct for all data ages

*For any* `dataAge > 0`, `formatTrackingLabel(dataAge)` SHALL return `"1 day of tracking"` when `dataAge === 1`, and `"{dataAge} days of tracking"` otherwise. *For* `dataAge === 0`, it SHALL return `null`.

**Validates: Requirements 4.2, 4.3, 4.4, 5.2, 5.3, 5.4**
