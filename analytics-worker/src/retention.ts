/**
 * Cohort-based retention helper.
 *
 * Replaces the old pseudo-retention (bucketing app_opened events by per-event
 * days_since_install and dividing by the day-0 head count). Here retention is a true
 * install-day cohort metric:
 *
 *   - A user's install day is the date of their earliest `app_opened` event.
 *   - A user is "retained at day N" iff they ever opened on or after day N, i.e.
 *     MAX(days_since_install) >= N.
 *   - A user is "eligible for day N" iff enough calendar time has passed since their
 *     install for day N to be reachable, i.e. age_days >= N. Users too new to have
 *     reached day N are excluded from BOTH numerator and denominator (not counted as
 *     churned).
 *   - retention(N) = retained / eligible, or null when there is no eligible cohort.
 *
 * This function is pure (no D1, no network) so it can be unit-tested directly.
 *
 * Requirements: 1.2, 1.3, 1.4, 2.4
 */

/** One aggregated row per user, produced by the per-user SQL aggregation in handleKpis. */
export interface CohortUserRow {
  anonymous_user_id: string;
  /** ISO timestamp of the user's earliest app_opened event (install anchor). */
  first_open_ts: string;
  /** MAX(days_since_install) over the user's app_opened events. */
  max_dsi: number;
  /** COUNT of the user's app_opened events (diagnostic; not used in the math). */
  opens: number;
}

/** Result for a single horizon N. */
export interface HorizonResult {
  /** Retention percentage (0-100), or null when the eligible cohort is empty ("n/a"). */
  pct: number | null;
  /** The eligible denominator the percentage was computed from. */
  cohort: number;
}

/** Map of horizon (e.g. 7, 30) to its result. */
export type CohortRetention = Record<number, HorizonResult>;

/**
 * Number of whole UTC calendar days between two ISO timestamps (floor).
 * Uses the date portion only, so partial days do not inflate age.
 */
function ageInDays(firstOpenTs: string, todayISO: string): number {
  // Normalize both to UTC midnight of their calendar date.
  const first = new Date(firstOpenTs);
  const today = new Date(todayISO);
  const firstMid = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  const todayMid = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diffMs = todayMid - firstMid;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Compute cohort retention for the given users and horizons.
 *
 * @param userRows  one row per user (already filtered to the cohort — e.g. install day
 *                  within the phase window — and already excluding users without a
 *                  days_since_install signal and excluded internal ids).
 * @param todayISO  server "now" as an ISO string; used to compute each user's age.
 * @param horizons  the day horizons to compute (e.g. [7, 30]).
 */
export function computeCohortRetention(
  userRows: CohortUserRow[],
  todayISO: string,
  horizons: number[]
): CohortRetention {
  const result: CohortRetention = {};

  for (const n of horizons) {
    // Eligible: had enough time to reach day N (Req 1.4).
    const eligible = userRows.filter((u) => ageInDays(u.first_open_ts, todayISO) >= n);
    // Retained: among eligible, actually returned on/after day N (Req 1.2).
    const retained = eligible.filter((u) => u.max_dsi >= n);

    result[n] = {
      pct: eligible.length > 0 ? (retained.length / eligible.length) * 100 : null,
      cohort: eligible.length,
    };
  }

  return result;
}
