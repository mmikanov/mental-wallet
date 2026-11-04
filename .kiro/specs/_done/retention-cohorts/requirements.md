# Requirements Document

## Introduction

The analytics dashboard's D7/D30 "retention" cards are not true cohort retention. They are computed by bucketing `app_opened` events by each event's `days_since_install` property, then dividing the count of opens tagged day 1-30 (D30 bucket) by the count of opens tagged day 0 (D0 bucket), all within the selected phase window. The numerator and denominator can be entirely different users, so the ratio does not answer the real question retention is supposed to answer: "of the users who installed N days ago, how many came back on/after day N."

This surfaced as a concrete bug: selecting the few-hour Cold Acquisition phase showed 14.3% D30 retention, because a returning user who installed weeks earlier opened the app during that window and their event (tagged e.g. `days_since_install = 20`) landed in the D30 bucket. As an interim mitigation we already (a) suppress D7/D30 to "n/a" when the selected phase window is shorter than the bucket horizon, and (b) added an explanatory note clarifying these are not cohort metrics. This spec replaces the interim metric with a real cohort-based retention calculation.

**Priority: medium.** Retention is a headline launch KPI; the current number is misleading if used for decisions. Do this before retention drives any go/no-go call.

## Key Finding: No App Changes Required

A true cohort metric is computable server-side from data the app already sends. Each `app_opened` event carries:
- `timestamp` (when the open happened)
- `properties.days_since_install` (an integer computed client-side from a locally stored, write-once `first_open_date`)

From these, the worker can derive each user's install date (earliest `app_opened`, or equivalently `timestamp - days_since_install`) and determine whether that same user had an `app_opened` on/after a later day boundary. No new client event, no app release, no store review. The rework is entirely within `analytics-worker/`.

### Data caveats (must be handled by the design)

- `days_since_install` is device-local and clamped to >= 0. If a device clock is wrong it can be off, but it is the only install-age signal available.
- `first_open_date` is cleared on in-app data reset, so a user who resets looks like a fresh install (acceptable, treat as a new cohort member).
- Historical events created before device-column/retention support may lack `days_since_install`; those users cannot be placed in a cohort and must be excluded from cohort math (not counted as churned).
- Excluded internal users (`EXCLUDED_USER_IDS`) must be excluded from cohort math, same as other KPIs.

## Requirements

### Requirement 1: Cohort-Based Retention Definition

**User Story:** As the operator, I want D-N retention to mean "of users who installed in the cohort window, the share who returned on/after day N," so the number is trustworthy for decisions.

#### Acceptance Criteria

1.1 THE system SHALL define a user's install day as the day of their earliest `app_opened` event (derived from `timestamp` and/or `days_since_install`).

1.2 THE system SHALL define a user as "retained at day N" IF that user has at least one `app_opened` event whose `days_since_install` is >= N (equivalently, an open on or after the Nth day since their install).

1.3 THE D-N retention percentage SHALL be `(users in cohort who are retained at day N) / (users in cohort who are eligible to have reached day N) * 100`.

1.4 A user SHALL be counted in the D-N denominator only IF enough calendar time has elapsed since their install for day N to be reachable (i.e. `today - install_day >= N`). Users too new to have reached day N SHALL be excluded from both numerator and denominator for that horizon (they are "not yet due," not "churned").

1.5 Users whose events lack `days_since_install` SHALL be excluded from cohort math entirely.

1.6 Internal excluded users (`EXCLUDED_USER_IDS`) SHALL be excluded from cohort math.

### Requirement 2: Cohort Window Tied to the Phase Filter

**User Story:** As the operator, I want the retention cards to respect the phase filter in a way that makes sense for cohorts, so switching phases gives meaningful comparisons.

#### Acceptance Criteria

2.1 WHEN a phase filter is active THE cohort SHALL be defined by users whose INSTALL day falls within the selected phase window (not by which opens fall in the window).

2.2 THE retention "return" events (the check for an open at day >= N) SHALL be evaluated across all of the user's history, NOT restricted to the phase window, so a user who installed in the window and returned later is correctly counted as retained.

2.3 WHEN "All Time" is selected THE cohort SHALL be all users with a derivable install day.

2.4 IF a phase window is so recent that no user in it could have reached day N THEN the D-N card SHALL show "n/a (cohort too recent)" rather than 0% or a misleading value.

### Requirement 3: Dashboard Presentation

**User Story:** As the operator, I want the retention cards and table to clearly present cohort retention with enough context to interpret them.

#### Acceptance Criteria

3.1 THE D7 and D30 cards SHALL display the cohort percentage per Requirement 1, or "n/a" per 1.4/2.4.

3.2 EACH card SHALL show the cohort size (denominator) it was computed from, so a percentage over a tiny cohort is not over-read.

3.3 THE retention section note SHALL be updated to describe the cohort definition (install-day cohort, retained = returned on/after day N) and SHALL remove the interim "not a tracked install cohort" caveat once the cohort metric is live.

3.4 THE color/target thresholds (D7 >= 40%, D30 >= 25%) MAY be retained, but SHALL only be applied when a real percentage is shown (not for "n/a").

### Requirement 4: Correctness Verification

**User Story:** As a developer, I want the cohort math verified against known inputs so I trust the numbers.

#### Acceptance Criteria

4.1 THE cohort calculation SHALL be covered by tests using synthetic event sets with known expected D7/D30 values (including edge cases: user too new to be due, user who reset, user with missing `days_since_install`, excluded user).

4.2 THE tests SHALL run under the project's Jest setup (or the worker's test runner if separate) and pass before deploy.

4.3 THE before/after retention numbers SHALL be sanity-checked on the live dashboard after deploy (e.g. All Time D7/D30 should be plausible and stable across refreshes).

### Requirement 5: Backward Compatibility and Migration

**User Story:** As the operator, I don't want the rework to break existing dashboard behavior or require data loss.

#### Acceptance Criteria

5.1 THE rework SHALL NOT require deleting or rewriting existing events.

5.2 THE existing raw "Retention (unique users by days since install)" table MAY remain as a secondary, clearly-labeled diagnostic view, OR be replaced by a cohort table; the design SHALL choose and justify one.

5.3 THE `/kpis` response shape change SHALL be additive where possible; if `retentionD7Pct`/`retentionD30Pct` semantics change, the dashboard SHALL be updated in the same deploy so client and server stay consistent.

## Out of Scope

- Any client/app change (no new events, no app release). If a future, more precise metric needs a dedicated `install` or `session_start` event, that is a separate spec.
- Retention horizons beyond D7/D30 (e.g. D1, D14, D90) unless trivially free from the same query.
- Per-cohort time-series charts / cohort triangle visualization (nice-to-have, separate spec).
- Changing the phase filter definitions themselves (All Time / Pre-Release / Post-Release / Warm / Cold are already defined).

## Notes

- The interim mitigations (n/a suppression for short windows + explanatory note) are already deployed. This spec supersedes the interim metric; when the cohort metric ships, revisit whether the short-window suppression is still needed (it likely is, but keyed on "cohort too recent to reach day N" rather than raw window length).
- All work is in `analytics-worker/` (`src/index.ts` handleKpis retention queries + `src/dashboard.ts` render). Deploy sequence: run tests, `npx wrangler deploy`, sanity-check live, then commit/push.
- `days_since_install` origin: `src/services/analyticsRetention.ts` (`getDaysSinceInstall`, write-once `first_open_date`). This is the only install-age signal; the design must rely on it, not invent a new one.
- The as-built state of the whole analytics worker dashboard (phase filters, drill-down filtering, active vs new users, interim retention suppression) is documented in `.kiro/specs/_done/launch-analytics-enhancements-DONE/`. Notably, first-touch cohorts are ALREADY implemented there for the "New Unique Users" KPI (per-user `MIN(timestamp)` + `HAVING` on the phase window). The cohort retention work SHOULD reuse that same install-day definition so users are cohorted consistently across both KPIs.
