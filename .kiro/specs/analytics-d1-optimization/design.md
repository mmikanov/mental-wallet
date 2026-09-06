# Design Document

## Overview

Reduce D1 rows read by the analytics dashboard while returning identical KPI/detail values.
The dominant lever, a **short-TTL cache of the computed `/kpis` payload**, keyed by the
active filters, so repeated refreshes and multiple open tabs reuse one computation instead
of re-scanning the `events` table. A secondary lever is **query/index tuning** for the few
aggregations that can't use existing indexes. The dashboard refresh-cadence fix and the D1
health indicator (Requirement 4) are already shipped; this spec covers the remaining
per-call cost (Requirements 1-3) and will re-tune the health indicator afterward.

Scope: `analytics-worker/` only (`src/index.ts`, `src/dashboard.ts`, `migrations/`). No
change to which KPIs are shown or how they're defined; the phase (`from`/`to`) and cohort
(`active`/`new`) filter model and exact values must be preserved.

## Current state (measured / verified)

- Each `/kpis` request runs **17 SQL statements** against `events` (two parallel batches):
  simple `event_type` counts (index-usable via `idx_events_type_timestamp`), several
  `json_extract(properties, ...)` GROUP BYs (NOT index-usable: mode split, outcomes,
  retention buckets, and the wallet-growth `days_since_install > 0` predicate), plus the
  activation self-JOIN (streams raw `tool_completed` rows, 48h window computed in JS) and
  the new-users / cohort subqueries (GROUP BY user over all history).
- `/details/*` endpoints each re-scan on click; `/details/users` is heaviest (outer
  GROUP BY + three correlated per-user subqueries).
- **No caching exists** anywhere in the worker (no Cache API, KV, in-memory, or
  `Cache-Control`); the `fetch` handler doesn't even accept `ctx`.
- Existing indexes: `idx_events_type_timestamp`, `idx_events_user`, `idx_events_platform`,
  `idx_events_app_version`, `idx_events_country`. No index on any `properties`/`json_extract`
  expression.
- Measured baseline after the refresh fix: ~186k rows read/day (~3.7% of the 5M cap),
  ~510 rows read per query. Healthy today; per-query cost rises as the table grows.

## Design

### Lever 1 (primary): short-TTL cache of `/kpis`

Cache the fully-computed `kpis` JSON so repeated requests with the same filters don't
recompute the 17 statements.

- **Cache key:** `kpis` + `from` + `to` + `cohort` (the only request inputs that change the
  result). Include a component that changes when `EXCLUDED_USER_IDS` changes (e.g. hash it
  into the key) since that env var affects every query.
- **Mechanism options (decide in implementation):**
  - **Cloudflare Cache API** (`caches.default`) keyed by a synthetic request URL, written
    with `ctx.waitUntil`. Requires adding `ctx: ExecutionContext` to the `fetch` signature.
    Edge-local, zero extra bindings, good fit.
  - **KV** with `expirationTtl`. Simple, but adds a binding and eventual-consistency nuance.
  - A tiny **in-memory** map in the isolate is NOT sufficient alone (isolates are
    short-lived and per-instance) but can layer on top.
  - Recommended: **Cache API** for `/kpis` (and optionally `/details/*`).
- **TTL:** short (e.g. 60-300s) — bounded staleness is acceptable for operational
  monitoring (Requirement 2.3). A manual "Refresh now" can bypass/refresh the cache.
- **Correctness guards:**
  - Never let two different phase/cohort selections share a cache entry (key covers them).
  - `weeklyEngagement` / `activeUsers14d` depend on a "now − 14 days" cutoff computed at
    request time, so their correctness only holds within the TTL window; a short TTL keeps
    this acceptable. Document it.
  - New event ingest (`POST /events`) makes cached values slightly stale until TTL expiry —
    acceptable for monitoring; note it. (No active invalidation on write required at this
    scale; TTL bounds it.)
- **Invalidation:** primarily TTL. Optionally bust on `EXCLUDED_USER_IDS` change (key
  component) and expose a cache-bypass query param for the manual refresh button.

### Lever 2 (secondary): reduce rows read per computation

Only pursue what meaningfully cuts reads without changing results:

- **Indexing:** the `event_type`-filtered counts already use `idx_events_type_timestamp`.
  The non-index-usable work is the `json_extract` GROUP BYs. SQLite supports **expression
  indexes** (e.g. `CREATE INDEX ... ON events (json_extract(properties,'$.mode'))`), which
  could help the mode/outcome/retention groupings — evaluate whether D1 supports and
  benefits from these before adding (measure with `EXPLAIN QUERY PLAN`).
- **Activation JOIN:** currently returns all `tool_completed` rows and computes the 48h
  window in JS. Consider bounding rows returned or moving the 48h comparison into SQL to
  transfer fewer rows. Verify identical results.
- **Do not** change KPI definitions or filter semantics.

Indexing/query changes are additive migrations (new `migrations/000N_*.sql`), run before
deploying dependent code.

### Lever 3 (optional): cache `/details/*`

Same Cache-API approach keyed by `detail-type + from + to + cohort`. Lower priority since
details are fetched only on click, but `/details/users` is heavy enough to be worth caching.

### Requirement 4 (D1 health indicator): already implemented — how, and what changes later

**Implemented (2026-09-06), against the CURRENT query approach:**
- `handleKpis` runs one extra unfiltered `SELECT COUNT(*) FROM events` and returns it as
  `kpis.totalEventsAllTime` (independent of all filters; a bare count is negligible).
- `src/dashboard.ts` renders a green/amber/red pill on the Total Events card via
  `renderD1Health(totalEventsAllTime)`, driven by configurable constants
  `D1_HEALTH_CAUTION_EVENTS` (50k) and `D1_HEALTH_WARNING_EVENTS` (150k).
- The thresholds are **event-count proxies** for read-budget risk, calibrated to today's
  ~510 rows-read-per-query cost with NO caching.

**What changes when Levers 1-3 land:**
- Caching sharply reduces effective rows-read per dashboard session (many requests served
  from cache), so the *same event count* becomes much safer. The thresholds should be
  **raised** (or the indicator reframed) once caching is in, otherwise it will warn far
  earlier than necessary.
- Indexing lowers per-query row cost, also relaxing the relationship between event count
  and reads.
- Action on implementing this spec: **re-calibrate `D1_HEALTH_CAUTION_EVENTS` /
  `D1_HEALTH_WARNING_EVENTS`** against the new measured rows-read-per-session, and update
  the tooltip/help text if the guidance changes. Consider whether the proxy should shift
  from "total events" toward "events per active phase window" if caching makes table size a
  weaker predictor of reads.

## Testing strategy

- **Correctness (must hold):** for a set of filter selections (all-time; each phase;
  active vs new cohort; with/without excluded users), the cached and optimized `/kpis`
  return values **identical** to the pre-change implementation. Capture current outputs
  first, diff after.
- **Cache behavior:** first request computes (cache miss), immediate repeat is a hit (no D1
  read); different `from`/`to`/`cohort` is a distinct entry; entry expires after TTL;
  manual refresh bypasses.
- **Read reduction:** measure D1 `rows_read` for a simulated dashboard session (open +
  several refreshes + a couple of drill-downs) before vs after; confirm a material drop.
- **Indexing:** `EXPLAIN QUERY PLAN` before/after on the targeted queries; confirm the new
  index is used and results are unchanged.
- **Filter integrity:** confirm phase/cohort/exclusion still respected on `/kpis` and every
  `/details/*` (per the analytics-dashboard steering).
- **Health indicator:** re-verify the pill after threshold re-calibration.
- Typecheck (`npx tsc --noEmit`) and run any new migration (`--local` then `--remote`)
  before deploying dependent code.

## Explainability & docs

- Per the insights-explainability steering: if any KPI is only re-shaped (not redefined),
  no tooltip/help changes are required — confirm this holds. If the health-indicator
  guidance text changes on re-calibration, update it in the same change.
- Update `docs/deployment/analytics-worker.md` (and the analytics-dashboard steering if
  needed) to describe the caching mechanism, TTL, cache-bypass, and any new index/migration.
