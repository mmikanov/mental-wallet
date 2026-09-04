---
inclusion: fileMatch
fileMatchPattern: '**/analytics-worker/**'
---

# Analytics Dashboard (Cloudflare Worker)

The production analytics backend is a Cloudflare Worker with D1 (SQLite) storage. It ingests events from production app builds and serves an HTML dashboard. It is a separate project from the React Native app — its own `package.json`, `tsconfig.json`, and `node_modules` under `analytics-worker/`.

## Files

- `analytics-worker/src/index.ts` — the Worker: routing, event ingestion, KPI computation, detail drill-down endpoints, milestones.
- `analytics-worker/src/dashboard.ts` — the entire dashboard UI as a single exported HTML string constant (`DASHBOARD_HTML`) with inline CSS and vanilla JS. No build step, no framework.
- `analytics-worker/migrations/*.sql` — D1 schema migrations (numbered, run in order).
- `analytics-worker/wrangler.toml` — bindings + `[vars]` (milestone dates, excluded user IDs).

## Routes (index.ts)

- `POST /events` — ingest batch (no auth, CORS enabled). Coarse country comes from `request.cf.country`.
- `GET /events` — raw events JSON (auth). `DELETE /events` — clear all (auth).
- `GET /dashboard` — serves `DASHBOARD_HTML` with `__DASHBOARD_SECRET__` substituted in.
- `GET /kpis` — all top-level KPIs computed server-side.
- `GET /details/{users|onboarding|modes|tools|outcomes|platforms}` — drill-down tables.
- `GET /milestones` — phase dates + excluded IDs for the dashboard filters.
- `GET /health` — `{status:"ok"}`.

Auth: every read endpoint checks `?secret=` or `Authorization: Bearer <secret>` against `DASHBOARD_SECRET`.

## Filtering model (important)

Two orthogonal filters flow from the dashboard to the backend as query params, and BOTH must be respected by `/kpis` and every `/details/*` endpoint:

1. **Phase filter** (`from` / `to` ISO timestamps) — selects a date window. Driven by milestone dates (`MILESTONE_RELEASE`, `MILESTONE_WARM_END`, `MILESTONE_COLD_START`). See `docs/deployment/analytics-worker.md` for how buttons map to windows.
2. **Cohort filter** (`cohort=active|new`) — Active (default) = any user with activity in the window; New = the acquisition cohort, users whose FIRST-EVER event falls inside the window.

### How cohort=new is implemented

When `cohort=new`, every query gets an extra restriction:

```sql
AND <col> IN (
  SELECT anonymous_user_id FROM events [WHERE anonymous_user_id NOT IN (<excluded>)]
  GROUP BY anonymous_user_id
  HAVING MIN(timestamp) >= ? [AND MIN(timestamp) < ?]
)
```

- The cohort subquery is bounded ONLY by from/to (in the HAVING) and the exclusion list — NEVER by the outer window's `timestamp` filter — because first-touch must be measured over ALL history.
- Simple queries in `handleKpis` get it via `dateFilter`/`dateParams` (unqualified `anonymous_user_id`), which flows through the `withFilter` helper.
- Table-qualified queries (activation JOIN, wallet growth) build their own filters, so they use `buildCohortClause('<alias>.anonymous_user_id')` to get the correctly-qualified fragment + params.
- Detail endpoints use the shared `buildDetailFilter`, which appends the same cohort clause to its `clause`/`params`.
- The `newUsers` KPI count itself is independent (always the acquisition cohort) and is NOT changed by the cohort toggle.

### Param binding discipline

D1 uses positional `?` params. When a filter clause appears N times in one SQL string (e.g. `handleDetailUsers` embeds `clause` in 3 correlated subqueries + the outer WHERE), the params array must be repeated N times in the SAME order. `handleKpis` uses `withFilter(baseWhere)` which returns `{ where, params }`; always pass the matching `params` for each query. Empty-param queries must skip `.bind()` (there's a `query()` helper that handles this for local D1 compatibility).

## Dashboard UI (dashboard.ts)

- Pure string HTML — edit via `str_replace` inside the template. Note the JS lives inside a `\`...\`` template literal, so app-level `${...}` for KPI values is escaped as `\${...}`.
- State: `currentPhase`, `currentCohort` (defaults to `'active'`). `getPhaseParams(cohortOverride?)` is the single place that serializes both filters into the query string appended to `/kpis` and `/details/*` fetches — new global filters go here. The optional `cohortOverride` lets one drill-down request a different cohort without changing the global filter.
- `setPhase()` / `setCohort()` update state then call `refresh()`. `setCohort()` also clears any per-panel override so an explicit global change takes over an open drill-down.
- Clickable KPI cards call `showDetail(type, cohortOverride?)` which fetches `/details/<type>` and renders a table into `#detail-panel`. `activeDetail` + `activeDetailCohort` are re-opened after each refresh.
- The New Unique Users card calls `showDetailNewUsers()`, which opens the users table with a `'new'` cohort override for that panel only — it does NOT change the global Users filter.

## When adding a new metric, filter, or drill-down

1. If it's a global filter, add it to `getPhaseParams()` (frontend) AND to both `handleKpis` and `buildDetailFilter` (backend) so KPIs and details stay consistent.
2. Respect the phase (from/to) and cohort filters in any new SQL — reuse `withFilter` / `buildCohortClause` / `buildDetailFilter` rather than hand-rolling.
3. Keep param arrays aligned with clause repetition count.
4. Typecheck before deploying: `cd analytics-worker && npx tsc --noEmit -p tsconfig.json`.

## Deploy

```bash
cd analytics-worker
npm run deploy   # wrangler deploy, ~10s, URL stays the same
```

Live URL: `https://mental-wallet-analytics.mentalwallet.workers.dev` (dashboard at `/dashboard?secret=<DASHBOARD_SECRET>`). Full ops (migrations, secrets, milestones, excluding devices, logs) are in `docs/deployment/analytics-worker.md`. Run any new migration (`wrangler d1 execute analytics-db --remote --file=...`) BEFORE deploying code that depends on it.

## Known event gaps (for future dashboard work)

These are things the dashboard cannot currently show because the app does not emit the event yet. Noted so we don't design cards against data that doesn't exist.

- **Emotion Session ("Start from how I feel"):** there is no dedicated "emotion session started" event. The signals that DO exist:
  - `start_mode_selected` with `properties.mode = 'emotion_first'` — the "tried the emotion session" signal.
  - `session_ended` with `properties.emotion` / `properties.contexts` / `properties.time` — what the user picked (these props are only set for emotion sessions; wallet-first sessions send just `session_duration_ms`).
  - Tools opened *inside* a session are only stored on-device (`emotionSessionService.addToolUsed`), NOT sent as analytics events.
- **Adding a tool from emotion-session suggestions is NOT tracked.** The `tool_added` analytics event is only fired from `LibraryBrowserScreen` (two call sites). The emotion-session add path — `SessionLauncherContent.handleAddToWallet` — only calls the local-state `recordToolAdded()` and never `logEvent('tool_added', ...)`. So Wallet Growth and any add metric currently undercount by omitting suggestion-adds.
  - Both suggestion entry points (the suggestion list via `ToolPreviewCard`, and the `LibraryToolPreview` preview via its `onAddToWallet` prop) funnel through the SAME `handleAddToWallet` callback, so a single `logEvent('tool_added', { card_id, card_category, origin_badge, source: 'emotion_session' })` there instruments both. Add a matching `source: 'library_browser'` to the two `LibraryBrowserScreen` calls to enable a source breakdown. To distinguish list-add vs preview-add specifically, thread an extra `entry_point` prop from the two callers.
  - Requires an app release before data flows; the dashboard card would read zero for historical periods.
