# Requirements Document

## Introduction

The analytics dashboard reads far more D1 rows than its query count would suggest
(observed: ~4.6M `rows_read` from ~14.5k queries in a single day, nearing the 5M/day
free-tier cap). The cause is that the KPI and detail queries in `analytics-worker` run
table-scanning aggregations (`COUNT`, `GROUP BY`, JOINs, `json_extract` groupings) that
re-execute on every dashboard load/refresh. As the `events` table grows, each dashboard
session reads progressively more rows.

This spec captures, at a high level, what a fix must achieve. It is **requirements only** —
design and tasks are deferred. No user-facing analytics behavior should change; this is a
cost/efficiency optimization of how the same numbers are produced.

Scope: the `analytics-worker` (`src/index.ts`, D1 `analytics-db`, migrations). Out of
scope: the messaging worker, the app's event emission, and any change to which KPIs are
shown or how they are defined.

Note: per the insights-explainability and analytics-dashboard steering, any change here
must preserve exact KPI values and respect the existing phase (`from`/`to`) and cohort
(`active`/`new`) filter model. If a computation is only re-shaped (not redefined), no
explainability/tooltip/help content should need updating — but this must be confirmed
during design.

## Requirements

### Requirement 1: Reduce D1 rows read per dashboard session

**User Story:** As the operator, I want the analytics dashboard to consume far fewer D1
rows read, so that normal use does not approach the daily free-tier cap.

#### Acceptance Criteria

1. THE analytics dashboard SHALL produce the same KPI and detail values as today while
   reading materially fewer D1 rows per session.
2. WHEN the dashboard is refreshed repeatedly within a short window, THE system SHALL NOT
   re-scan the full `events` table on every refresh (e.g. via caching of computed results
   and/or query/index improvements).
3. THE optimization SHALL keep the app's event ingestion path (writes) unaffected.

### Requirement 2: Preserve correctness of KPIs and filters

**User Story:** As the operator, I want the numbers to stay correct after optimization, so
that I can trust the dashboard.

#### Acceptance Criteria

1. THE optimized queries SHALL return values identical to the current implementation for
   the same data and the same filter selections.
2. THE phase filter (`from`/`to`) and cohort filter (`active`/`new`) SHALL continue to be
   respected by `/kpis` and every `/details/*` endpoint.
3. IF results are cached, THEN staleness SHALL be bounded and acceptable for operational
   monitoring (a short TTL), and the caching SHALL not cause different phases/cohorts to
   return each other's data.

### Requirement 3: Stay within free-tier limits under normal use

**User Story:** As the operator, I want to keep using the free tier for as long as
reasonable, so that I avoid unnecessary cost.

#### Acceptance Criteria

1. Under normal dashboard usage, THE account's daily D1 `rows_read` SHALL remain
   comfortably below the free-tier cap.
2. THE approach SHALL degrade gracefully if a limit is ever hit (the app and messaging
   worker are unaffected; only the dashboard is impacted), and this expectation SHALL be
   documented.

### Requirement 4: Explainability and documentation consistency

**User Story:** As the operator, I want docs and explainability content to stay accurate
after the change.

#### Acceptance Criteria

1. IF any KPI computation is redefined (not merely re-shaped), THEN the explainability
   artifacts required by the insights-explainability steering SHALL be updated in the same
   change.
2. THE analytics-worker documentation SHALL be updated to describe any new caching, index,
   or summary-table mechanism introduced.

## Findings (from investigation)

Traced what the dashboard actually queries on refresh (`analytics-worker/src/dashboard.ts`):

- **`/kpis` is the hot path.** Every auto-refresh calls `fetchKPIs()` → a single `/kpis`
  request, which runs ~15 aggregations in one handler (total events, distinct users, the
  new-users subquery, mode split, tool opened/completed, outcomes, retention buckets,
  platform split, plus the activation JOIN and wallet-growth subqueries). Several are
  full-table scans, so one `/kpis` call reads a large slice of the `events` table.
- **Detail endpoints (`/details/*`) are NOT fetched on refresh.** They run only on click
  (`showDetail`). The one exception: `render()` re-opens an already-open detail panel after
  a refresh, so if a panel is open, a refresh costs `/kpis` + that one panel's query. It
  never pre-fetches all drill-downs.
- **Root cause of the overnight drain** was frequency × cost: the dashboard auto-refreshed
  every 30s and kept firing while the tab sat open/backgrounded overnight, so `/kpis`
  (expensive) ran ~2 times/minute all night. Mitigated already by moving to a configurable
  5-minute interval that pauses when the tab is hidden (`REFRESH_INTERVAL_MS`). This spec
  addresses the remaining per-call cost.

**Priority lever:** optimizing/caching **`/kpis`** is the single highest-value change,
since it's the endpoint every refresh (and every open tab) hits. A short-TTL cache of
`/kpis` keyed by the active phase+cohort params would let repeated refreshes and multiple
tabs reuse one computation instead of re-scanning. Do this before optimizing the
`/details/*` endpoints.

## Implemented mitigation (already shipped)

The dashboard's auto-refresh was the dominant driver of `rows_read` and has been fixed in
`analytics-worker/src/dashboard.ts` (deployed):

- Auto-refresh interval is now a single config constant `REFRESH_INTERVAL_MS` (set to
  5 minutes), replacing the previous hard-coded 30 seconds.
- Auto-refresh is **visibility-aware**: it pauses entirely when the browser tab is hidden
  and resumes (refreshing once if the interval elapsed) when the tab becomes visible again.
  This eliminates the overnight-drain scenario (a forgotten open tab polling all night).
- A manual **"Refresh now"** button and a live countdown ("Next auto-refresh in …") were
  added; the countdown ticker updates the display with no network calls.

This addresses frequency (Requirement 1.2 in part). The remaining per-call cost of `/kpis`
(the hot path) is still to be optimized (caching/indexing) — see Findings above.

## Open Questions (for design phase)

- Caching vs. indexing vs. a precomputed summary table (or a combination) — which gives
  the best cost reduction for the least complexity.
- Whether a short-TTL cache of `/kpis` (and `/details/*`) is sufficient on its own.
- Whether new indexes can meaningfully cut `rows_read` for the `json_extract` groupings
  and the activation/wallet-growth JOINs.
- Cache key must include the phase (`from`/`to`) and cohort params so different filter
  selections don't return each other's cached data.
