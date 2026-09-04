# Requirements Document

## Introduction

The **analytics worker dashboard** is the operator-facing (not user-facing) launch-metrics dashboard served by the Cloudflare Worker in `analytics-worker/`. It ingests anonymous events from production app builds into D1 (SQLite) and renders an HTML dashboard of launch KPIs at `GET /dashboard?secret=<DASHBOARD_SECRET>`. This is entirely separate from the in-app, user-facing `analytics-dashboard` spec (which is `AnalyticsDashboardScreen.tsx` over the local wallet DB).

This spec documents the dashboard **as-built** after a round of fixes and enhancements made in this session, so the behavior is captured somewhere durable. It is primarily an as-built record; the one piece of forward-looking work (true cohort retention) is split into its own `retention-cohorts` spec and only referenced here.

**Note on the pseudo-retention:** the D7/D30 retention shown here is an interim metric (bucketing opens by per-event `days_since_install`), mitigated but not corrected. The correct cohort metric is specced separately in `.kiro/specs/retention-cohorts/`.

## Architecture Context

- `analytics-worker/src/index.ts` — Worker: event ingest (`POST /events`), KPIs (`/kpis`), detail drill-downs (`/details/*`), milestones (`/milestones`), dashboard HTML route (`/dashboard`).
- `analytics-worker/src/dashboard.ts` — the dashboard HTML + client JS (served as a string).
- `analytics-worker/wrangler.toml` — `[vars]` hold milestone dates and `EXCLUDED_USER_IDS`; `DASHBOARD_SECRET` is a Worker secret.
- D1 table `events` with columns incl. `timestamp`, `properties` (JSON), `platform`, `os_version`, `app_version`, `country`.
- Deploy: `cd analytics-worker && npx wrangler deploy`. Migrations: `npx wrangler d1 execute analytics-db --remote --file=...`.

## Requirements

### Requirement 1: Phase Filter Applies Everywhere

**User Story:** As the operator, I want the phase filter to scope the whole dashboard consistently, so drill-downs and summary cards never disagree.

#### Acceptance Criteria

1.1 THE dashboard SHALL provide phase filter buttons: All Time, Pre-Release, Post-Release, Warm Launch, Cold Acquisition.

1.2 THE summary KPI cards SHALL query `/kpis` with the active phase's `from`/`to` params.

1.3 THE drill-down detail views (`/details/*`) SHALL apply the SAME `from`/`to` params as the summary cards. (Previously the drill-downs ignored the phase and showed all-time data.)

1.4 ALL six detail endpoints (users, onboarding, modes, tools, outcomes, platforms) SHALL apply the date filter and the `EXCLUDED_USER_IDS` exclusion, mirroring `handleKpis`.

### Requirement 2: Phase Definitions and Clarity

**User Story:** As the operator, I want to know exactly what date range each phase queries.

#### Acceptance Criteria

2.1 THE phase ranges (inclusive-start, exclusive-end) SHALL be:
  - Pre-Release: `(-inf, MILESTONE_RELEASE)`
  - Post-Release: `[MILESTONE_RELEASE, now)` (covers Warm + Cold combined)
  - Warm Launch: `[MILESTONE_RELEASE, MILESTONE_WARM_END)` (or `MILESTONE_COLD_START` if warm end unset)
  - Cold Acquisition: `[MILESTONE_COLD_START, now)`
  - All Time: no filter

2.2 THE phase buttons SHALL carry descriptive labels indicating direction (e.g. "before release", "release to now", "release to warm end", "after cold start").

2.3 THE dashboard SHALL show the exact active queried range as a line (e.g. "Showing: <from> -> <to>"), derived from a single source of truth shared with the query params.

2.4 A phase button SHALL be enabled only when its required milestone(s) are set; Post-Release and Warm require `MILESTONE_RELEASE`, Cold requires `MILESTONE_COLD_START`.

2.5 WHEN warm end and cold start are set to the same timestamp THE Warm and Cold phases SHALL be contiguous (no gap, no overlap).

### Requirement 3: Milestone Timestamps

**User Story:** As the operator, I want to see the full timestamp of each milestone, not just the date.

#### Acceptance Criteria

3.1 THE milestone line SHALL render each milestone with full date and time in the viewer's local timezone (via `toLocaleString`), not a date-only slice.

### Requirement 4: User Detail Enrichment

**User Story:** As the operator, I want to see device and coarse-location context per user.

#### Acceptance Criteria

4.1 THE Unique Users drill-down SHALL show each user's Platform and OS Version (most recent non-null value per user), respecting the active phase filter.

4.2 THE Unique Users drill-down SHALL show each user's Country, derived server-side at ingest from Cloudflare's `request.cf.country` (IP-based, country-level).

4.3 THE country capture SHALL require NO app changes; existing rows (pre-migration) MAY be NULL and SHALL display as "-".

### Requirement 5: Active vs New Users

**User Story:** As the operator, I want to distinguish users active in a phase from users acquired in a phase, because active counts are not additive across phases.

#### Acceptance Criteria

5.1 THE dashboard SHALL show an "Active Unique Users" card = distinct users with ANY event in the phase window (not additive across phases; the card SHALL say so).

5.2 THE dashboard SHALL show a "New Unique Users" card = users whose FIRST-EVER event (install / first touch) falls in the phase window, computed via per-user `MIN(timestamp)` + `HAVING`, excluding `EXCLUDED_USER_IDS`.

5.3 THE New Unique Users counts SHALL be additive across a partition of phases (verified: Pre + Warm + Cold == Pre + Post == All Time distinct users).

### Requirement 6: Retention Suppression for Short Windows (Interim)

**User Story:** As the operator, I don't want misleading D7/D30 numbers for phases too short to support them.

#### Acceptance Criteria

6.1 THE D7 and D30 retention CARDS SHALL show "n/a" when the selected phase window is shorter than 7 and 30 days respectively.

6.2 THE D7 and D30 rows in the bottom Retention TABLE SHALL apply the same n/a suppression.

6.3 THE window length SHALL treat a missing `to` bound as "now" (open-ended phases like Post-Release and Cold Acquisition end at the current time, NOT infinity); only a missing `from` (All Time / Pre-Release reaching into the past) counts as long enough. A degenerate/negative window SHALL be treated as too short (n/a).

6.4 THE retention section SHALL carry a note explaining that these buckets are NOT a tracked install cohort and why short windows show n/a.

6.5 THIS suppression is interim; the correct cohort metric is specced in `retention-cohorts` and, when shipped, the n/a decision SHALL move server-side ("cohort too recent to reach day N").

### Requirement 7: Safety and Deploy Hygiene

#### Acceptance Criteria

7.1 THE dashboard/events endpoints (`/dashboard`, `/events`, `/kpis`, `/details/*`, `/milestones`) SHALL require `DASHBOARD_SECRET` (query param or Bearer header); `POST /events` is unauthenticated (CORS-enabled ingest).

7.2 SCHEMA changes SHALL be additive migrations (nullable columns) run against `--remote` BEFORE deploying dependent code.

7.3 NO secrets SHALL be committed; `wrangler.toml` vars (milestones, excluded ids) are non-secret and MAY be committed.

## Out of Scope

- True cohort retention (see `retention-cohorts`).
- Client-side (in-app) location capture; only Cloudflare edge country is used.
- The in-app user-facing analytics dashboard (`analytics-dashboard` spec).
- Cohort time-series / triangle visualizations.

## Notes

- Phase-filter mapping table is also documented in `docs/deployment/analytics-worker.md`; keep both in sync.
- `days_since_install` origin: `src/services/analyticsRetention.ts` (write-once `first_open_date`).
- Weekly Engagement is additionally capped to the last 14 days on top of the phase filter, so older phases can read low/zero.
