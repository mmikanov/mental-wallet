# Design: Version Release Tracking

## Data
Migration `analytics-worker/migrations/0006_create_version_releases.sql`: `version_releases(platform, app_version, live_at, note, created_at, updated_at)`, PK `(platform, app_version)`. `live_at` is ISO-8601 UTC. Appended to `db:migrate:local` / `db:migrate:remote`.

## Predicate (`src/releases.ts`)
`releaseExclusionExpr(alias?)`:
```sql
(p IS NULL OR v IS NULL OR r IS NULL OR (p, v) NOT IN (
  SELECT vr.platform, vr.app_version FROM version_releases vr
  WHERE julianday(r) < julianday(vr.live_at)))
```
`p/v/r` = `platform/app_version/received_at`, alias-qualified when an alias is passed. The row-value sits in the OUTER scope because an unqualified `platform` inside a subquery over `version_releases` would bind to the release row. `received_at` is not a `version_releases` column, so it correlates to the event row. No bind params. `julianday` keeps `...:00Z` vs `...:00.000Z` comparisons correct.

`metricsExclusionExpr(alias?)` = clock-skew expr AND release expr. It replaces every inline skew predicate in `index.ts`: both cohort subqueries, `dateFilter` (`withFilter`), `newUsersSql`, activation JOIN (`events` / `tc`), cohort-retention SQL, `buildDetailFilter`. Not applied to `handleGetEvents` or the all-time health count.

## Endpoint
`GET /details/releases` (auth, next to `/details/channels`): events grouped by (platform, app_version) LEFT JOIN `version_releases`, with first/last seen, users, events, `hidden_pre_live_events`; merged with all release rows by `summarizeReleases(seen, releases, nowISO)` (status `live | scheduled | not_recorded`, newest first via `compareVersions`). Ignores phase/cohort/channel; applies only the internal-user exclusion list. Counts are raw; hidden shows what metrics skip.

## Dashboard
"Releases" section after the channel breakdown (page bottom), own fetch (no filter params), Eastern time via `Intl.DateTimeFormat`, UTC in `title`, HTML-escaped, errors caught locally.

## Ops
Docs: `docs/deployment/analytics-worker.md`, `.kiro/steering/release-checklist.md`, `.kiro/steering/analytics-dashboard.md`.
