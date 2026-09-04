# Design Document

## Overview

Replace the current pseudo-retention (bucketing `app_opened` events by per-event `days_since_install`) with a true cohort metric computed entirely in the analytics worker from existing event data. A user's install day is derived from their `app_opened` history; retention at day N means that same user returned on or after day N. The cohort is defined by install day within the active phase window, while the "did they return" check spans the user's full history.

No app changes. All work is in `analytics-worker/src/index.ts` (KPI queries) and `analytics-worker/src/dashboard.ts` (rendering + note).

## Data Model (existing, unchanged)

`events` rows relevant here:
- `anonymous_user_id` TEXT
- `event_type` TEXT (we use `app_opened`)
- `timestamp` TEXT (ISO 8601)
- `properties` TEXT (JSON), for `app_opened` contains `{ "days_since_install": <int >= 0> }`

Per-user derived values:
- `install_day` = `date(MIN(timestamp))` over the user's `app_opened` events. (We can cross-check against `days_since_install`, but the earliest open's date is the simplest robust anchor. `days_since_install` on the earliest open should be ~0; if not, the earliest open still bounds install day from above, which is good enough.)
- `max_days_since_install` = `MAX(days_since_install)` over the user's `app_opened` events. This is the cheapest "did they reach day N" signal: a user is **retained at day N** iff `max_days_since_install >= N`.
- `age_days` = `today - install_day` = how many days the user has had to reach later horizons. Used for denominator eligibility.

### Why `MAX(days_since_install)` is the core trick

We do not need to compare timestamps across days in SQL (which is awkward with ISO strings). Each `app_opened` already carries how many days after install it occurred. So:
- retained at day N  <=>  the user ever opened on day N or later  <=>  `MAX(days_since_install) >= N`.
- eligible for day N  <=>  the user's install is at least N days in the past  <=>  `age_days >= N`.

Both are simple aggregates over the user's `app_opened` rows.

## Cohort Computation

### Step 1: Per-user aggregation (SQL, in the worker)

Within the active phase filter applied to **install day** (see Step 2), produce one row per user:

```sql
SELECT
  anonymous_user_id,
  MIN(timestamp) AS first_open_ts,
  MAX(CAST(json_extract(properties, '$.days_since_install') AS INTEGER)) AS max_dsi,
  COUNT(*) AS opens
FROM events
WHERE event_type = 'app_opened'
  AND json_extract(properties, '$.days_since_install') IS NOT NULL   -- Req 1.5
  AND anonymous_user_id NOT IN (<excluded>)                          -- Req 1.6
GROUP BY anonymous_user_id
```

Users with no non-null `days_since_install` drop out via the WHERE (Req 1.5).

### Step 2: Cohort membership by install day within the phase window (Req 2.1)

The phase filter currently constrains event `timestamp`. For cohorts we instead constrain the **install day**, i.e. the user's `first_open_ts`. Approach: compute per-user aggregates over the user's full `app_opened` history (so returns are not truncated, Req 2.2), then filter the resulting rows by `first_open_ts` against the phase `from`/`to`.

Two implementation options:

- **Option A (JS filter):** Run the Step 1 aggregation with NO date filter (full history), return rows, then in JS keep users whose `first_open_ts` is within `[from, to)`. Simple, correct, and the user count is small (hundreds), so returning all users is fine.
- **Option B (SQL HAVING):** Add `HAVING MIN(timestamp) >= ? AND MIN(timestamp) < ?` to filter cohort membership in SQL. Fewer rows returned.

**Chosen: Option A** for clarity and because it keeps the "return spans full history" semantics obviously correct (the aggregation is over all history; only membership is filtered). Revisit if the users table grows large enough that transferring all user rows matters (not a concern at launch scale).

### Step 3: Horizon math in JS (Req 1.2-1.4, 2.4)

`today` = server "now" (UTC date). For each horizon N in {7, 30}:

```
cohort   = users whose install_day is within the phase window (or all, for All Time)
eligible = cohort users with age_days >= N          // had time to reach day N (Req 1.4)
retained = eligible users with max_dsi >= N          // actually returned at day N+ (Req 1.2)
pct      = eligible.length > 0 ? retained.length / eligible.length * 100 : null
```

- If `eligible.length === 0` -> `pct = null` -> card shows "n/a (cohort too recent)" (Req 2.4).
- `age_days` uses `install_day` (date granularity), computed as floor((today - install_day) in days).

Note the denominator is **eligible**, not the whole cohort: brand-new users who cannot yet have reached day N are excluded so they don't drag the percentage down (Req 1.4). This is standard cohort-retention practice.

### `/kpis` response additions (Req 5.3)

Extend the `launch` block (additive where possible). Replace the meaning of the existing fields and add cohort context:

```ts
launch: {
  // ...existing...
  retentionD7Pct: number | null,     // now cohort-based; null => n/a
  retentionD30Pct: number | null,    // now cohort-based; null => n/a
  retentionD7Cohort: number,         // eligible denominator (Req 3.2)
  retentionD30Cohort: number,
}
```

Using `null` for "n/a" lets the client distinguish "no eligible cohort" from a real 0%.

## Dashboard Changes (`dashboard.ts`)

- D7/D30 cards: render `pct(value)` when the value is a number, else "n/a". Show cohort size in the detail line, e.g. `Cohort: 42 users` (Req 3.2). Apply target-color thresholds only when a number is shown (Req 3.4).
- The interim client-side `phaseWindowDays()` suppression can be removed for D7/D30 once the server returns `null` for too-recent cohorts, since the server now owns that decision (Req 2.4). Keep `retentionValue`-style rendering but drive it off `=== null` instead of window length.
- Update the retention section note (Req 3.3) to describe the cohort definition and drop the "not a tracked install cohort" caveat.
- Decide the raw table's fate (Req 5.2): keep it, relabeled "Opens by days-since-install (diagnostic)", clearly separated from the cohort cards, so the raw signal is still visible without being mistaken for retention.

## Edge Cases

| Case | Handling |
|------|----------|
| User too new to reach day N | Excluded from eligible denominator (Req 1.4); not counted as churned. |
| User reset app data | `first_open_date` cleared, so they re-enter as a new install/cohort member. Acceptable. |
| Event missing `days_since_install` | User excluded from cohort math (Req 1.5) via WHERE filter. |
| Excluded internal user | Filtered out (Req 1.6). |
| Device clock skew | `days_since_install` is clamped >= 0 client-side; we accept the signal as-is. |
| Empty cohort / eligible set | `pct = null` -> "n/a". |
| All Time | Cohort = all users with derivable install day (Req 2.3). |

## Testing Strategy (Req 4)

Unit-test the pure cohort function (extract the JS horizon math into a testable helper, e.g. `computeCohortRetention(userRows, todayISO, horizons)`), independent of D1:

- Two users installed 40 days ago, both returned at day 30 -> D30 = 100%, cohort 2.
- One user installed 3 days ago (not eligible for D7) -> excluded from D7 denominator; D7 n/a if they are the only user.
- User with only day-0 opens, installed 10 days ago -> eligible for D7, not retained -> counts against D7.
- User missing `days_since_install` -> excluded entirely.
- Excluded user id -> excluded.
- Empty input -> all horizons null.

Run via existing Jest (`jest-expo`) if the helper lives somewhere importable, or a small standalone test in `analytics-worker/`. Prefer extracting the helper so it is testable without a live D1.

## Deploy Sequence

1. Implement worker query + helper + tests; `npx tsc --noEmit` in `analytics-worker/`.
2. Run tests; fix until green.
3. `npx wrangler deploy`.
4. Sanity-check live dashboard (All Time D7/D30 plausible and stable; short phases show n/a).
5. Commit + push (`src/index.ts`, `src/dashboard.ts`, tests, and this spec's task updates).

No migration needed (Req 5.1); all data already present.
