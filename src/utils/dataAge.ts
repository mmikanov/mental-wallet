/**
 * Data age utilities for the Insights Period Availability feature.
 *
 * Provides:
 * - `computeDataAge` — queries the DB for the earliest record date and
 *   returns the number of whole days since that date.
 * - `getDisabledPeriods` — pure function mapping data age to the set of
 *   time periods that should be disabled in TimePeriodSelector.
 * - `formatTrackingLabel` — pure function formatting "X days of tracking"
 *   strings with correct singular/plural handling.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1–2.7, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4
 */

import { getDatabase } from '@/data/database';
import type { TimePeriod } from '@/services/tierEvaluator';

// --- Types ---

export interface DataAgeResult {
  /** Number of whole days since the earliest record. 0 if no records exist. */
  dataAge: number;
  /** The earliest record date, or null if no records exist. */
  earliestDate: Date | null;
}

// --- Constants ---

/** Day-count thresholds for each bounded period. "all" has no threshold. */
const PERIOD_THRESHOLDS: Record<Exclude<TimePeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

// --- Functions ---

/**
 * Computes the user's data age by finding the earliest record across
 * the `kpi_records` and `completions` tables.
 *
 * @param now - Optional override for "current date" (useful in tests).
 * @returns `{ dataAge, earliestDate }`. Falls back to `{ dataAge: 0, earliestDate: null }`
 *          if there are no records or the DB call fails.
 */
export async function computeDataAge(now?: Date): Promise<DataAgeResult> {
  try {
    const db = await getDatabase();

    const row = await db.getFirstAsync<{ earliest: string | null }>(`
      SELECT MIN(earliest_date) AS earliest FROM (
        SELECT MIN(recorded_at)  AS earliest_date FROM kpi_records
        UNION ALL
        SELECT MIN(completed_at) AS earliest_date FROM completions
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
  } catch {
    console.warn('[dataAge] computeDataAge failed; returning fallback.');
    return { dataAge: 0, earliestDate: null };
  }
}

/**
 * Determines which time periods should be disabled based on data age.
 * `'all'` (All Time) is never disabled regardless of data age.
 *
 * @param dataAge - Number of whole days of tracking data.
 * @returns Array of `TimePeriod` values that should be disabled.
 */
export function getDisabledPeriods(dataAge: number): TimePeriod[] {
  const disabled: TimePeriod[] = [];

  for (const [period, threshold] of Object.entries(PERIOD_THRESHOLDS) as [
    Exclude<TimePeriod, 'all'>,
    number,
  ][]) {
    if (dataAge < threshold) {
      disabled.push(period);
    }
  }

  return disabled;
}

/**
 * Formats the "X days of tracking" label string.
 *
 * @param dataAge - Number of whole days of tracking.
 * @returns `null` when `dataAge` is 0 (label should not be shown),
 *          `"1 day of tracking"` when `dataAge` is 1,
 *          or `"${dataAge} days of tracking"` for all other positive values.
 */
export function formatTrackingLabel(dataAge: number): string | null {
  if (dataAge <= 0) {
    return null;
  }

  const unit = dataAge === 1 ? 'day' : 'days';
  return `${dataAge} ${unit} of tracking`;
}
