# Design: Version Release Tracking

## Data
Migration `analytics-worker/migrations/0006_create_version_releases.sql`: `version_releases(platform, app_version, live_at, note, created_at, updated_at)`, PK `(platform, app_version)`. `live_at` is ISO-8601 UTC. Appended to `db:migrate:local` / `db:migrate:remote`.

## Predicate (`src/releases.ts`)
**Current approach (D1 read-amplification fix):** the Worker reads `version_releases` ONCE (`loadReleases(db)`, ~12 rows, cached per isolate for 60s) and passes the rows to `releaseExclusionExpr(releases, alias?)`, which inlines one literal condition per release, AND-ed together:
```sql
NOT COALESCE(p = 'android' AND v = '1.0.6' AND r IS NOT NULL
             AND julianday(r) < julianday('2026-11-04T14:30:00Z'), 0)
```
No valid rows => `1=1`. `p/v/r` = `platform/app_version/received_at`, alias-qualified when an alias is passed. Still no bind params, so existing param arrays are untouched. Semantics are unchanged: no row => included; NULL platform/app_version/received_at => included (the `COALESCE(..., 0)` is required: a NULL comparison would otherwise make `NOT NULL` drop the row); the `9999-12-31T00:00:00Z` sentinel => everything for that version excluded. `julianday` keeps `...:00Z` vs `...:00.000Z` comparisons correct.

Values are inlined, so rows are whitelist-validated (`isSafeReleaseRow`): platform `[a-z]+`, version `[0-9]+(.[0-9]+)*`, live_at ISO-8601 timestamp. Invalid rows are skipped (never escaped-and-inlined). Tests cover injection strings and prove equivalence with the old predicate on sample rows via SQLite.

**Why it changed:** the original predicate was `(p, v) NOT IN (SELECT vr.platform, vr.app_version FROM version_releases vr WHERE julianday(r) < julianday(vr.live_at))`, which depends on the outer row's `received_at`, so SQLite re-ran it per event row. Rows read multiplied by the size of `version_releases`: on 3k events and 12 release rows, `COUNT(*)` went from ~3k to ~46k reads and the cohort=new query to ~75k. A dashboard load (~25 queries) exhausted the 5M/day free-tier budget. Measured locally after the fix: `COUNT(*)` 3,000 reads, cohort=new 5,021 (see `docs/tech-debt.md` item on D1 read amplification for the table).

`metricsExclusionExpr(releases, alias?)` = clock-skew expr AND release expr. It replaces every inline skew predicate in `index.ts`: both cohort subqueries, `dateFilter` (`withFilter`), `newUsersSql`, activation JOIN (`events` / `tc`), cohort-retention SQL, `buildDetailFilter` (now async: it loads the releases). Not applied to `handleGetEvents` or the all-time health count.

## Response caching
`GET /kpis` and `GET /details/*` are memoised in-isolate for 4 minutes, keyed by the full URL (minus `refresh`); auth is checked before the cache. `?refresh=1` bypasses it and also drops the 60s release cache. The dashboard "Refresh now" button sends it; auto-refresh (now every 30 minutes) and filter changes do not. The Cache API is unavailable on `*.workers.dev`, so this is best-effort memory only.

## Endpoint
`GET /details/releases` (auth, next to `/details/channels`): events grouped by (platform, app_version) LEFT JOIN `version_releases`, with first/last seen, users, events, `hidden_pre_live_events`; merged with all release rows by `summarizeReleases(seen, releases, nowISO)` (status `live | scheduled | not_recorded`, newest first via `compareVersions`). Ignores phase/cohort/channel; applies only the internal-user exclusion list. Counts are raw; hidden shows what metrics skip.

## Dashboard
"Releases" section after the channel breakdown (page bottom), own fetch (no filter params), Eastern time via `Intl.DateTimeFormat`, UTC in `title`, HTML-escaped, errors caught locally.

## Ops
Docs: `docs/deployment/analytics-worker.md`, `.kiro/steering/release-checklist.md`, `.kiro/steering/analytics-dashboard.md`.
