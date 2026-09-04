# Design Document

## Overview

Add an "Emotion Sessions" card and drill-down to the analytics worker dashboard, computed entirely from events the app already sends. No app changes, no migrations. All work is in `analytics-worker/src/index.ts` (a new KPI + a new detail endpoint) and `analytics-worker/src/dashboard.ts` (card + detail rendering).

Phase 2 (tool-add tracking) is documented in requirements but not implemented here.

## Data model (existing, unchanged)

Relevant `events` rows:
- `session_started` — emitted once per emotion session (`sessionStore.selectEmotion`, guarded by `!isSessionActive`), emotion-flow only, no properties. The canonical per-session signal.
- `session_ended` — for emotion sessions, `properties` carries `emotion` (string), `contexts` (comma-joined string), `time` (string). Wallet-first sessions omit these. Currently over-fired (see requirements Req 5), so used only for the "what they picked" breakdowns, read as proportions.
- `start_mode_selected` — onboarding-only (once per user); NOT used here. Documented so nobody re-bases counts on it.

## KPI: Emotion Sessions

Add two numbers to the `/kpis` response, computed with the existing `withFilter` helper so they inherit phase + cohort + exclusion filtering:

- `emotionSession.users` — `COUNT(DISTINCT anonymous_user_id)` where `event_type = 'session_started'`.
- `emotionSession.sessions` — `COUNT(*)` of `session_started` rows (sessions started).

Implementation:

```ts
const emotionSessionFilter = withFilter("WHERE event_type = 'session_started'");
// in the Promise.all:
query(`SELECT COUNT(DISTINCT anonymous_user_id) as users, COUNT(*) as sessions FROM events ${emotionSessionFilter.where}`, emotionSessionFilter.params).first<{ users: number; sessions: number }>(),
```

Expose on the `kpis` object:

```ts
emotionSession: {
  users: emotionSessionResult?.users || 0,
  sessions: emotionSessionResult?.sessions || 0,
},
```

## Detail endpoint: `/details/emotion-sessions`

New handler `handleDetailEmotionSessions`, registered in the router next to the other `/details/*` routes. Uses `buildDetailFilter(request, env)` to get the shared `{ clause, params, query }` (phase + cohort + exclusion). Returns a single JSON object with three arrays:

```jsonc
{
  "users":    [ { "anonymous_user_id", "sessions_started", "first_seen", "last_seen" } ],
  "emotions": [ { "emotion", "count" } ],
  "contexts": [ { "context", "count" } ]
}
```

### users query

Per-user, over `session_started` events (one clause occurrence, bind `params` once):

```sql
SELECT
  anonymous_user_id,
  COUNT(*) as sessions_started,
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen
FROM events
WHERE event_type = 'session_started'${clause}
GROUP BY anonymous_user_id
ORDER BY sessions_started DESC
LIMIT 200
```

### emotions query

```sql
SELECT json_extract(properties, '$.emotion') as emotion, COUNT(*) as count
FROM events
WHERE event_type = 'session_ended'
  AND json_extract(properties, '$.emotion') IS NOT NULL${clause}
GROUP BY emotion
ORDER BY count DESC
```

### contexts query

`contexts` is a comma-joined string (e.g. `"work,relationships"`), so it can't be grouped directly in SQL without a split. Fetch the raw non-null `contexts` strings (with the filter applied) and split + tally in JS:

```sql
SELECT json_extract(properties, '$.contexts') as contexts
FROM events
WHERE event_type = 'session_ended'
  AND json_extract(properties, '$.contexts') IS NOT NULL${clause}
```

Then in JS: split each on `,`, trim, count into a map, sort desc, emit `[{ context, count }]`.

## Frontend (dashboard.ts)

### Card

Add a new card in the top grid, clickable:

```html
<div class="card" onclick="showDetail('emotion-sessions')">
  <h3>Emotion Sessions</h3>
  <div class="value">${num(kpis.emotionSession.users)}</div>
  <div class="detail">Unique users who started "Start from how I feel". ${num(kpis.emotionSession.sessions)} sessions started. Click for breakdown.</div>
</div>
```

The card + detail inherit phase/cohort automatically because `fetchKPIs`/`fetchDetail` already append `getPhaseParams()`.

### Detail rendering

Add an `if (type === 'emotion-sessions')` branch in `showDetail` that renders three tables from the returned object:
1. Users table: User ID, Sessions Started, First seen, Last seen.
2. Emotions selected: Emotion, Count, Percentage (percentage computed in JS from the sum). Preceded by a note that these come from `session_ended` and are inflated by the duplicate-firing bug (read as proportions).
3. Contexts selected: Context, Count.

Follow the existing detail-panel markup (`.detail-panel`, close button, `shortId`, `fmtDate`). No new fetch wiring needed beyond passing the type through the existing `fetchDetail(type, activeDetailCohort)`.

## Filtering guarantees

- Phase (from/to) + cohort (active/new) + excluded users all flow through `withFilter` (KPI) and `buildDetailFilter` (detail), so the new card and drill-down behave exactly like the existing ones, including the per-panel cohort override on drill-downs.

## Verification

- `cd analytics-worker && npx tsc --noEmit -p tsconfig.json` must pass.
- Deploy with `npm run deploy`; confirm `/health` and eyeball the new card/drill-down on the live dashboard.

## Out of scope (Phase 2 — requires an app release)

- Emitting `tool_added` from `SessionLauncherContent.handleAddToWallet` with a `source` property; updating the two `LibraryBrowserScreen` `tool_added` calls with `source: 'library_browser'`; surfacing an adds-from-suggestions metric. (Requirement 4.)
- Fixing the `session_ended` duplicate-firing bug: add a re-entrancy guard in `sessionStore.endSession()` and limit `RootNavigator`'s AppState listener to `background` (not `inactive`). Once shipped, the `session_ended`-based emotion/context breakdowns become trustworthy as absolute counts and the "read as proportions" note can be removed. (Requirement 5.)
