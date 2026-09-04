# Implementation Plan

As-built record of the analytics worker dashboard changes shipped this session. All items are complete and deployed to the live Worker (`https://mental-wallet-analytics.mentalwallet.workers.dev`) and pushed to `main`. Each change followed: edit -> `npx tsc --noEmit` -> `npx wrangler deploy` -> verify -> commit/push.

- [x] 1. Show full milestone timestamps
  - `updatePhaseDates()` uses `fmtDate()` (`toLocaleString`) instead of `.slice(0,10)`.
  - _Requirements: 3.1_

- [x] 2. Apply phase filter to drill-down details
  - Client: `fetchDetail` appends `getPhaseParams()`.
  - Server: added `buildDetailFilter()` and applied `from`/`to` + `EXCLUDED_USER_IDS` to all six `handleDetail*` handlers (onboarding sub-selects and platforms multi-query bind params the correct number of times).
  - _Requirements: 1.3, 1.4_

- [x] 3. Clarify phase labels and show active range
  - Descriptive button labels; `getActiveRange()` as single source of truth; "Showing: <from> -> <to>" line via `updatePhaseRange()`; `getPhaseParams()` refactored to derive from `getActiveRange()`.
  - _Requirements: 2.2, 2.3_

- [x] 4. Enable Cold Acquisition (set cold start = warm end)
  - `wrangler.toml`: `MILESTONE_COLD_START = "2026-09-03T19:00:00Z"` (matches warm end -> contiguous).
  - _Requirements: 2.4, 2.5_

- [x] 5. Platform + OS Version in Unique Users table
  - `handleDetailUsers` correlated subqueries for latest non-null platform/os_version; client columns added.
  - _Requirements: 4.1_

- [x] 6. Country capture + column
  - Migration `0003_add_country_column.sql` (nullable + index), run against `--remote`.
  - Ingest reads `request.cf.country`; `handleDetailUsers` adds latest-country subquery; client Country column. `package.json` migrate scripts updated to include 0003.
  - _Requirements: 4.2, 4.3, 7.2_

- [x] 7. Retention n/a suppression for short windows (cards)
  - `phaseWindowDays()`, `retentionValue()`; D7 n/a when window < 7, D30 when < 30; neutral border/target when suppressed; section note added.
  - _Requirements: 6.1, 6.4_

- [x] 8. Add Post-Release phase filter
  - Button + `getActiveRange()` case (`from = release`, no `to`) + enable-on-release; doc phase table updated in `docs/deployment/analytics-worker.md`.
  - _Requirements: 1.1, 2.1_

- [x] 9. Fix n/a suppression for open-ended phases
  - `phaseWindowDays()` treats missing `to` as `now` (Post-Release, Cold), missing `from` as long (All Time, Pre-Release), negative window as too short.
  - _Requirements: 6.3_

- [x] 10. Active vs New Unique Users
  - Renamed existing card to "Active Unique Users" (with not-additive note); added "New Unique Users" (first-touch cohort via per-user `MIN(timestamp)` + `HAVING`); `/kpis` exposes `newUsers`. Additivity verified against prod.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 11. Retention table n/a suppression
  - `retentionCount()` applies the same D7 (<7) / D30 (<30) n/a suppression to the bottom Retention table rows.
  - _Requirements: 6.2_

## Follow-up (separate spec)

- [ ] True cohort retention — tracked in `.kiro/specs/retention-cohorts/` (supersedes the interim suppression; moves the n/a decision server-side).
  - _Requirements: 6.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1","2","3","4","5","6","7","8","9","10","11"] }
  ]
}
```
