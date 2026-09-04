# Design Document

## Overview

As-built design of the analytics worker dashboard after this session's changes. The Worker (`analytics-worker/src/index.ts`) ingests events into D1 and exposes JSON endpoints; the dashboard HTML+JS (`analytics-worker/src/dashboard.ts`) renders KPIs and drill-downs. All rendering is client-side JS embedded in the served HTML string; all data comes from authenticated JSON endpoints.

## Phase Filter (client + server)

### Single source of truth: `getActiveRange()` (dashboard.ts)

Returns `{ from, to }` (either may be null) for the current phase:

| Phase | from | to |
|-------|------|-----|
| all | null | null |
| pre-release | null | `MILESTONE_RELEASE` |
| post-release | `MILESTONE_RELEASE` | null (=> now) |
| warm | `MILESTONE_RELEASE` | `MILESTONE_WARM_END` or `MILESTONE_COLD_START` |
| cold | `MILESTONE_COLD_START` | null (=> now) |

- `getPhaseParams()` derives the `&from=/&to=` query string from `getActiveRange()`.
- `updatePhaseRange()` renders the "Showing: <from> -> <to>" line from the same helper, so the displayed range always equals the queried range.
- Milestones are fetched from `/milestones` and gate which buttons are enabled (`updatePhaseButtons`).

### Server date filter

- `handleKpis` parses `from`/`to` from `url.searchParams`, builds a `dateFilter` (`AND timestamp >= ?` / `AND timestamp < ?`) plus `EXCLUDED_USER_IDS` exclusion, and applies it via the `withFilter()` helper to every KPI query.
- `buildDetailFilter(request, env)` is the shared equivalent for drill-downs: it returns `{ clause, params, query }` where `clause` is the ` AND ...` fragment and `query(sql)` binds params (tolerating empty params for local D1). Applied in all six `handleDetail*` handlers.
  - Handlers with a single WHERE append `${clause}`.
  - `handleDetailUsers` uses `WHERE 1=1${clause}`.
  - Handlers with multiple queries / sub-selects (onboarding counts, platforms) repeat `${clause}` per query and bind the params the matching number of times, in SQL text order.

## Milestone Timestamp Display

`updatePhaseDates()` renders each milestone with `fmtDate()` (which is `new Date(ts).toLocaleString()`), showing full local date+time instead of a `.slice(0,10)` date-only. `MILESTONE_WARM_END = ...T19:00:00Z` displays as 3:00 PM EDT for an ET viewer.

## User Detail Enrichment (Unique Users drill-down)

`handleDetailUsers` returns, per user, the latest non-null `platform`, `os_version`, and `country` via correlated subqueries against the user's own events ordered by `timestamp DESC LIMIT 1`. Each subquery repeats the filter `${clause}`, so the filter appears 4x (platform, os, country, outer) and params are bound 4x in that order. The client table renders Platform / OS Version / Country columns (missing => "-").

### Country capture (ingest)

`handlePostEvents` reads `country = (request as Request & { cf?: { country?: string } }).cf?.country || null` once per request (all events in a batch share it) and inserts it into the new `country` column. Migration `0003_add_country_column.sql` adds the nullable column + index. IP-based, country-level, populates only for events received after deploy.

## Active vs New Users

- **Active Unique Users** = `COUNT(DISTINCT anonymous_user_id)` over the phase-filtered events (existing `usersResult`). Not additive across phases (a user active in two phases counts in both).
- **New Unique Users** = users whose first-ever event falls in the phase window. SQL:

```sql
SELECT COUNT(*) FROM (
  SELECT anonymous_user_id
  FROM events [WHERE anonymous_user_id NOT IN (<excluded>)]
  GROUP BY anonymous_user_id
  HAVING 1=1 [AND MIN(timestamp) >= ?] [AND MIN(timestamp) < ?]
)
```

The aggregation runs over ALL history (so first-touch is the true first event), and `HAVING MIN(timestamp)` places each user in exactly one phase. This partitions users, so per-phase counts are additive. Verified against prod: Pre 28 + Warm 5 + Cold 13 = 46 = All Time distinct; Pre 28 + Post 18 = 46.

`/kpis` exposes both `uniqueUsers` (active) and `newUsers` (first-touch).

## Retention Suppression (interim)

`phaseWindowDays()` computes the selected window length in days:
- `all` => Infinity.
- missing `from` => Infinity (Pre-Release / All Time reach into the past).
- missing `to` => measure to `Date.now()` (open-ended Post-Release / Cold end at now).
- negative/degenerate => 0 (treated as too short).

`retentionValue(pct, horizon)` (cards) and `retentionCount(count, horizon)` (table rows) return "n/a" when `phaseWindowDays() < horizon`, else the value. Card border/target color is neutralized when suppressed. The section note explains these are not cohort metrics.

This is the interim heuristic. The `retention-cohorts` spec replaces the underlying metric with a real install-day cohort and moves the n/a decision server-side.

## Endpoints Summary

| Route | Auth | Purpose |
|-------|------|---------|
| POST /events | none (CORS) | Ingest batch; stores platform/os/app_version/country |
| GET /kpis | secret | Summary KPIs incl. launch block, uniqueUsers, newUsers |
| GET /details/{users,onboarding,modes,tools,outcomes,platforms} | secret | Phase-filtered drill-downs |
| GET /milestones | secret | Milestone dates + excluded ids |
| GET /dashboard | secret | Dashboard HTML |
| GET/DELETE /events | secret | Raw events / clear-all |

## Testing / Verification (as done this session)

- `npx tsc --noEmit` in `analytics-worker/` after each change (clean).
- Ingest verified via a throwaway `POST /events` (accepted), then the test user deleted with a scoped `DELETE`.
- New-users additivity verified with a direct `d1 execute --remote` query.
- Live dashboard spot-checked for phase behavior and n/a suppression.
