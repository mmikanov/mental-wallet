# Implementation Plan

Cohort-based retention rework, entirely within `analytics-worker/`. No app or DB migration changes. Follow the deploy sequence in design.md: implement, type-check, test, deploy, sanity-check, commit.

- [ ] 1. Extract a pure, testable cohort helper
  - Create `analytics-worker/src/retention.ts` exporting `computeCohortRetention(userRows, todayISO, horizons)`.
  - Input `userRows`: `{ anonymous_user_id, first_open_ts, max_dsi, opens }[]`; `horizons`: e.g. `[7, 30]`.
  - For each horizon N: compute `cohort`, `eligible` (`age_days >= N`), `retained` (`max_dsi >= N`), and `pct = eligible>0 ? retained/eligible*100 : null`.
  - Return `{ [N]: { pct: number|null, cohort: number } }` (cohort = eligible denominator).
  - _Requirements: 1.2, 1.3, 1.4, 2.4_

- [ ] 2. Unit-test the cohort helper (write tests, confirm they fail before wiring real data)
  - Cases: two users installed 40d ago both retained at D30 -> 100%/cohort 2; user installed 3d ago -> excluded from D7 eligible; day-0-only user installed 10d ago -> counts against D7; empty input -> all null; verify cohort sizes.
  - _Requirements: 4.1, 4.2_

- [ ] 3. Add the per-user aggregation query to `handleKpis`
  - SQL: `SELECT anonymous_user_id, MIN(timestamp) AS first_open_ts, MAX(CAST(json_extract(properties,'$.days_since_install') AS INTEGER)) AS max_dsi, COUNT(*) AS opens FROM events WHERE event_type='app_opened' AND json_extract(properties,'$.days_since_install') IS NOT NULL AND anonymous_user_id NOT IN (<excluded>) GROUP BY anonymous_user_id`.
  - Run over FULL history (no timestamp date filter) so returns are not truncated.
  - Exclude `EXCLUDED_USER_IDS`.
  - _Requirements: 1.1, 1.5, 1.6, 2.2_

- [ ] 4. Apply cohort membership by install day within the phase window (Option A)
  - In JS, filter the aggregated user rows to those whose `first_open_ts` is within the active `[from, to)` phase window; for All Time, keep all.
  - Pass the filtered rows to `computeCohortRetention`.
  - _Requirements: 2.1, 2.3_

- [ ] 5. Wire cohort results into the `/kpis` launch block
  - Set `retentionD7Pct`/`retentionD30Pct` to the cohort pct (number or null) and add `retentionD7Cohort`/`retentionD30Cohort` (eligible denominator).
  - Keep the change additive; update the response type/shape.
  - _Requirements: 3.1, 3.2, 5.3_

- [ ] 6. Update dashboard rendering for cohort cards
  - Render `pct(value)` when number, "n/a" when null; drive the n/a decision off `=== null` (server-owned), not client `phaseWindowDays()`.
  - Show cohort size in the card detail line (e.g. "Cohort: N users").
  - Apply target-color thresholds only when a real number is shown.
  - _Requirements: 3.1, 3.2, 3.4, 2.4_

- [ ] 7. Update the retention section note and raw table label
  - Rewrite the note to describe the install-day cohort definition (retained = returned on/after day N); remove the interim "not a tracked install cohort" caveat.
  - Relabel the existing raw table as "Opens by days-since-install (diagnostic)" and keep it visually separate (Req 5.2 decision: keep as diagnostic).
  - _Requirements: 3.3, 5.2_

- [ ] 8. Remove now-redundant interim suppression (careful)
  - Remove/replace the client `phaseWindowDays()`-based D7/D30 suppression now that the server returns null for too-recent cohorts. Keep the helper only if still used elsewhere.
  - _Requirements: 2.4, 3.4_

- [ ] 9. Type-check, test, and verify
  - `npx tsc --noEmit` in `analytics-worker/`; run the cohort tests green.
  - _Requirements: 4.2_

- [ ] 10. Deploy and sanity-check live
  - `npx wrangler deploy`; on the live dashboard confirm All Time D7/D30 are plausible and stable across refreshes, and that short phases (e.g. Cold Acquisition) show "n/a (cohort too recent)".
  - _Requirements: 4.3_

- [ ] 11. Commit and push
  - Commit `analytics-worker/src/retention.ts`, its test, `src/index.ts`, `src/dashboard.ts`, and mark tasks complete. No secrets. Push to `main`.
  - _Requirements: 5.1, 5.3_
