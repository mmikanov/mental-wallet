# Tasks

## Task 1: Capture a correctness baseline

- [ ] For a matrix of filter selections (all-time; each phase from/to; active vs new
      cohort; with and without `EXCLUDED_USER_IDS`), capture current `/kpis` (and key
      `/details/*`) JSON outputs as golden fixtures to diff against later
- [ ] Verify: fixtures saved; they represent the current, correct values
- _Requirements: 2.1, 2.2_

## Task 2: Add short-TTL cache for /kpis

- [ ] Add `ctx: ExecutionContext` to the worker `fetch` signature; wire the Cache API
      (`caches.default`) for `/kpis`
- [ ] Cache key = path + `from` + `to` + `cohort` + a component derived from
      `EXCLUDED_USER_IDS`; short TTL (start 60-300s); write via `ctx.waitUntil`
- [ ] Add a cache-bypass path for the dashboard's manual "Refresh now"
- [ ] Verify: cache miss computes; immediate repeat is a hit with no D1 read; distinct
      filters are distinct entries; TTL expiry recomputes; bypass works
- _Requirements: 1.1, 1.2, 2.3, 3.1_

## Task 3: Query/index tuning (only what measurably helps)

- [ ] `EXPLAIN QUERY PLAN` the non-index-usable aggregations (json_extract GROUP BYs:
      mode, outcomes, retention; wallet-growth `days_since_install` predicate; activation
      JOIN row transfer)
- [ ] Add expression/index migrations where they measurably cut rows read AND D1 supports
      them; and/or bound the activation JOIN's returned rows / move the 48h check into SQL
- [ ] Run the migration `--local` then `--remote` before deploying dependent code
- [ ] Verify: `EXPLAIN QUERY PLAN` shows index use; results identical to Task 1 fixtures
- _Requirements: 1.1, 1.3, 2.1_

## Task 4: Optionally cache /details/*

- [ ] Apply the same Cache-API approach keyed by `detail-type + from + to + cohort`
      (prioritize `/details/users`)
- [ ] Verify: hit/miss/expiry behavior; values match fixtures; filters respected
- _Requirements: 1.1, 1.2, 2.2_

## Task 5: Re-calibrate the D1 health indicator (Req 4, already shipped)

- [ ] Measure rows-read-per-dashboard-session AFTER caching/indexing
- [ ] Update `D1_HEALTH_CAUTION_EVENTS` / `D1_HEALTH_WARNING_EVENTS` (and the pill's
      tooltip/help text if guidance changes) to reflect the lower per-session read cost;
      consider reframing the proxy if table size is now a weak predictor of reads
- [ ] Verify: pill states reflect the new thresholds
- _Requirements: 4.4, 4.5, 5.1_

## Task 6: Measure, document, verify free-tier headroom

- [ ] Compare D1 `rows_read` for a standard dashboard session before vs after; record the
      improvement (like the baseline note in requirements.md)
- [ ] Update `docs/deployment/analytics-worker.md` + analytics-dashboard steering:
      caching mechanism, TTL, cache-bypass, new indexes/migrations
- [ ] Confirm phase/cohort filter integrity on `/kpis` and every `/details/*`
- [ ] Typecheck; final correctness diff against Task 1 fixtures
- _Requirements: 1.1, 2.2, 3.1, 5.1, 5.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5", "6"] }
  ]
}
```
