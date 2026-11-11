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
- `GET /details/{users|onboarding|modes|tools|outcomes|platforms}` — drill-down tables. `GET /details/users` returns `{ users, total, capped, limit, sort }` (not a bare array): one row per user with `platform/os_version/country/latest_version` (latest in-window event), `first_platform/first_version` (the user's FIRST-EVER counted event = the version they joined on), `event_count`, `first_seen`, `last_seen`. Optional `?sort=<key>&dir=asc|desc`; `sort` is looked up in a whitelist (`SORT_KEYS` in `src/usersQuery.ts`), never put in SQL, unknown values fall back to Events desc. Sorting happens in the Worker over the FULL set and then the `USERS_LIMIT` (1000) cap is applied, so a capped list is still the true top-N. Query/merge/sort live in `src/usersQuery.ts`. `GET /details/releases` — release reference table (ignores phase/cohort/channel).
- `GET /details/user-events?user=<anonymous_user_id>` — per-user event timeline. Returns ONE user's events ordered by `timestamp` ASC (the chronological sequence), each row with `timestamp`, `event_type`, `session_id`, `platform`, `app_version`, `channel`, `country` (2-letter Cloudflare code stamped per upload batch; the dashboard maps it to a name), and the raw `properties` JSON string. **Auth required** (via `memoized`, auth checked first). **Unfiltered on purpose**: it applies NEITHER the global phase/cohort/channel filters NOR the clock-skew/release read-time exclusions — it is a raw per-user forensic view, so the operator sees the user's FULL recorded history with no gaps. Capped at `USER_EVENTS_LIMIT` (2000) rows to bound reads. `user` is a positional bind param (never interpolated). The lookup rides `idx_events_user (anonymous_user_id, timestamp)`, so it is a per-user range scan, not a full-table scan — measured locally on seeded Miniflare D1 (3k events / 150 users) at `rows_read = 21` for a 20-event user. Query + cap live in `src/userEvents.ts` (shared by the handler and `src/user-events.test.ts`). Opened from the dashboard by clicking a row in the Users detail table (`showUserEvents()`).
- `GET /milestones` — phase dates + excluded IDs for the dashboard filters.
- `GET /health` — `{status:"ok"}`.

Auth: every read endpoint checks `?secret=` or `Authorization: Bearer <secret>` against `DASHBOARD_SECRET`.

## Filtering model (important)

Global filters flow from the dashboard to the backend as query params, and ALL must be respected by `/kpis` and every `/details/*` endpoint:

1. **Phase filter** (`from` / `to` ISO timestamps) — selects a date window. Driven by milestone dates (`MILESTONE_RELEASE`, `MILESTONE_WARM_END`, `MILESTONE_COLD_START`). See `docs/deployment/analytics-worker.md` for how buttons map to windows.
2. **Cohort filter** (`cohort=active|new`) — Active (default) = any user with activity in the window; New = the acquisition cohort, users whose FIRST-EVER event falls inside the window.
3. **Channel filter** (`channel=<label>|organic`). In **Active** mode it is a per-EVENT predicate (`channel = ?` / `IS NULL`). In **New** mode, and for the `newUsers` KPI and cohort retention, it is applied at USER level using the user's RESOLVED channel (`MAX(channel)` over all their counted events, NULL only if every event is untagged => organic), the same attribution as the Channel Breakdown (904fbe4). The install event is always untagged (the tag appears on later events), so a per-event predicate on the acquisition cohort would drop the install and never match the card. In New mode the per-event predicate is therefore skipped.
4. **Joined in version** (`joinVersion=<platform>:<version>`, e.g. `ios:1.0.5`). Users whose FIRST-EVER counted event was on that platform + app_version (join-version cohort; NOT the user's latest version, NOT a release-date window). Strict shape `^[a-z]+:\d+(\.\d+)*$` via `parseJoinVersion`; anything else is ignored; values are bound params. Works in both Users modes: Active = users active in the window who joined on V; New = joined on V AND first event in the window. Picker options come from the release table (`/details/releases`, loaded once): `status === 'live'` rows only (never-released sentinel, scheduled and not-recorded versions are not offered), grouped by OS, newest first, labelled with the go-live date. "First event" ignores events the metrics exclude (skew / pre-live release traffic), so a tester event before go-live does not make someone a "joiner" of a tester build.

All user-level restrictions (cohort window, join version, resolved channel) are built by ONE module, `src/userFilters.ts` (`buildUserRestrictions` for the `/kpis` filters + `/details/*` filter + retention, `buildNewUsersCount` for the `newUsers` KPI), so the New Unique Users card and the drill-down opened from it use the same subqueries and always agree on the count. The first-event subquery uses SQLite's bare-column-with-single-MIN rule (`MIN(timestamp)` is its only min/max aggregate) to read platform/app_version from the earliest row; the channel check (`MAX(channel)`) is a separate subquery for that reason. Params are emitted in textual order; tests assert `?` count == params length for every combination.

### Read-time exclusions (clock-skew + release)

Besides the filters above, metrics apply two fixed read-time exclusions, built by one shared helper (`metricsExclusionExpr(releases, alias?)` in `src/releases.ts`; the release rows come from `loadReleases(env.DB)`, read once per request and cached 60s) at every place the clock-skew predicate appears (`handleKpis` filters, activation JOIN, cohort subqueries, cohort retention SQL, `buildDetailFilter`):

- **Clock-skew**: drop events whose device timestamp is more than a day ahead of `received_at`.
- **Release**: drop events whose `received_at` is earlier than the `live_at` recorded for their (platform, app_version) in `version_releases`. No row = included; NULL `received_at`/`platform`/`app_version` = included. Nothing is deleted.

Neither applies to raw `GET /events` or the all-time D1-health total. Neither uses bind params, so param arrays are unaffected. Any new self-built metric query MUST use `metricsExclusionExpr(releases, alias)`. The release part is emitted as literal per-release conditions (whitelist-validated values), NOT a subquery. The `/details/releases` table is intentionally unfiltered. Operator steps: `docs/deployment/analytics-worker.md`.

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
- The `newUsers` KPI count itself is independent of the cohort toggle (always the acquisition cohort) but DOES honor the Channel filter (resolved channel) and the Joined-in-version filter. It was previously ignoring the channel, so the card stayed put when a channel was picked. Cost: with a channel it adds a second per-user scan (~2x reads of the card query).
- Cohort retention (D7/D30 cards) previously ignored the Channel filter too; it now scopes by resolved channel and join version (its install-day window is still applied in JS).
- Known remaining inconsistency (product call, not changed): in **Active** mode the channel filter is per-event, so e.g. `channel=organic` still matches nearly every user (their untagged install event) while the Channel Breakdown/`newUsers` use the resolved channel. Moving Active mode to user-level resolved attribution would make every card agree with the breakdown but would change what Total Events / Active Users mean under a channel.

### Param binding discipline

D1 uses positional `?` params. When a filter clause appears N times in one SQL string (e.g. `handleDetailUsers` embeds the light `lookupClause` in 4 per-user lookups + `clause` in the outer WHERE; `buildDetailFilter` returns both `clause/params` and `lookupClause/lookupParams`), the params array must be repeated N times in the SAME order. `handleKpis` uses `withFilter(baseWhere)` which returns `{ where, params }`; always pass the matching `params` for each query. Empty-param queries must skip `.bind()` (there's a `query()` helper that handles this for local D1 compatibility).

## D1 read budget (free tier: 5M row reads/day, account-wide)

- **No correlated subqueries in per-row predicates.** A subquery that references the outer row is re-run per event row and multiplies `rows_read` (this is what blew the budget: ~3k reads became ~46k per query). Load small reference tables once in the Worker and inline validated literals instead.
- Users drill-down measured locally (Miniflare, 3k events / 150 users, `scripts/measure-users-rows-read.mjs`): active cohort 3,600 -> 3,900 reads (adds first/latest version lookups); cohort=new 15,899 -> 7,199 (the per-user lookups no longer repeat the cohort IN-subqueries). `newUsers` KPI: 3,000 -> 3,000 without a channel, 6,000 with one. A set-based rewrite (extra GROUP BY scans or window functions) was measured and rejected (9,000 and 24,000 reads).
- **Check `meta.rows_read` locally before deploying** any query change (Miniflare D1 with ~3k seeded events; wrangler CLI `--json` does not print rows_read, use `Miniflare.getD1Database()`). Never run `--remote` to measure.
- `GET /kpis` and `GET /details/*` are memoised in-isolate (4 min, keyed by full URL; auth first). `?refresh=1` bypasses; only the manual Refresh button sends it. Do not add new fetches to `refresh()`/`render()` that ignore this; filter-independent data should load once.
- Index changes (`CREATE INDEX`) read the whole table; apply only when the daily budget allows. See `docs/tech-debt.md` item 14.

## Dashboard UI (dashboard.ts)

- Pure string HTML — edit via `str_replace` inside the template. Note the JS lives inside a `\`...\`` template literal, so app-level `${...}` for KPI values is escaped as `\${...}`.
- State: `currentPhase`, `currentCohort` (defaults to `'active'`), `currentChannel`, `currentJoinVersion` ('' or `platform:version`; `setJoinVersion()` mirrors `setChannel()`; the "Joined in version" `<select>` is populated by `populateJoinVersionSelect()` from the release table load and is shown in the "Showing:" line). `getPhaseParams(cohortOverride?)` is the single place that serializes both filters into the query string appended to `/kpis` and `/details/*` fetches — new global filters go here. The optional `cohortOverride` lets one drill-down request a different cohort without changing the global filter.
- `setPhase()` / `setCohort()` update state then call `refresh()`. `setCohort()` also clears any per-panel override so an explicit global change takes over an open drill-down.
- Clickable KPI cards call `showDetail(type, cohortOverride?)` which fetches `/details/<type>` and renders a table into `#detail-panel`. `activeDetail` + `activeDetailCohort` are re-opened after each refresh.
- Users table sorting: every header is clickable (`sortUsersBy(key)`); same column toggles asc/desc, a new column starts at `usersDefaultDir` (Events/dates/versions desc, text asc). State lives in the `usersSort` JS variable (default Events desc, arrow in the header, `aria-sort`), so it survives the auto-refresh re-open (`showDetail` sends `&sort=&dir=`). If the list is not capped the browser sorts the loaded rows with `sortUsersRows`; if `capped` it re-requests so the server sorts the full set. The browser sort code is the string `USERS_SORT_JS` in `src/usersTableClient.ts` (interpolated into `DASHBOARD_HTML`) so tests run the exact shipped code and check parity with the server comparators. Versions compare numerically per segment (1.0.10 > 1.0.9), timestamps as instants, missing values sort last in both directions. Columns include First version (join) and Latest version, rendered as the version number only (platform has its own column; `versionLabel`) or an em dash for NULL. Country is shown as the English NAME (`countryName` via `Intl.DisplayNames`; XX -> Unknown, T1 -> Tor network, null -> em dash; browser copy in `USERS_SORT_JS`, server copy in `src/countryName.ts`, parity-tested) and the Country column sorts by that name on both browser and server.
- The New Unique Users card calls `showDetailNewUsers()`, which opens the users table with a `'new'` cohort override for that panel only — it does NOT change the global Users filter.
- In the Users detail table every row is clickable (`showUserEvents(encodeURIComponent(anonymous_user_id))`); it fetches `/details/user-events` and renders that user's chronological timeline (step #, timestamp, country name, event_type + device meta, session, pretty-printed properties) with a "Back to user list" button that re-opens the users table preserving its cohort override. The timeline fetch sends only `secret` + `user` (NOT `getPhaseParams`), because the endpoint is deliberately unfiltered. Raw `properties` are run through an `escapeHtml` helper before injection.

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
- **Adding a tool from emotion-session suggestions is now tracked (as of the 1.0.4 build).** The emotion-session add path — `SessionLauncherContent.handleAddToWallet` — emits `logEvent('tool_added', { card_id, card_category, origin_badge, source: 'emotion_session', entry_point })`. Both suggestion entry points (the list via `ToolPreviewCard` → `entry_point: 'list'`, and the `LibraryToolPreview` preview → `entry_point: 'preview'`) funnel through that one callback. The two `LibraryBrowserScreen` call sites now also send `source: 'library_browser'` with the matching `entry_point`. Historical `tool_added` rows (pre-1.0.4) have no `source`; a one-time backfill (`migrations/0004_backfill_tool_added_source.sql`) stamps them `library_browser`, and the dashboard read-time CASE maps any remaining NULL to `library`. `entry_point` is absent on all pre-1.0.4 rows by design (the dimension did not exist) and renders as "—".
- **Wallet Growth KPI now unions `tool_added` + `tool_created`** (distinct users, any add path — library, emotion session, or custom-created) and no longer requires a returning-user gate (`days_since_install > 0`). Drill-down: `GET /details/wallet-growth` returns one row per add with a resolved `source` (`library` / `emotion_session` / `created`) and `entry_point`. The `tool_preview_opened` event (added in 1.0.4, emitted from both preview surfaces with a `source`) is collected but NOT yet surfaced on any dashboard card — reserved for a future preview→add conversion view.
- **Still requires the 1.0.4 app release before the new `source`/`entry_point` values and `tool_preview_opened` flow;** historical periods read zero for those. The KPI union and backfill work on existing data immediately.
