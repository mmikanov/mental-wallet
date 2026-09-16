# Design — Wallet Growth Instrumentation (1.0.4)

## Architecture at a glance

Two independently-shippable halves that meet at the `events` table:

```
APP (1.0.4 build)                          WORKER (deploy anytime)
─────────────────                          ───────────────────────
tool_added  {..., source}   ──POST /events──▶  events (D1)
tool_created {...}                                │
                                                  ├─ /kpis → launch.usersWhoAddedTools
                                                  │    = COUNT(DISTINCT user) over
                                                  │      tool_added ∪ tool_created
                                                  └─ /details/wallet-growth → per-add rows
                                                       (user, card, source, ts)
```

The worker half works on **existing** data immediately (custom-tool `tool_created` history is
already in D1; legacy `tool_added` maps to `source = library`). The app half only starts producing
`source: 'emotion_session'` / `'library_browser'` once the 1.0.4 build reaches users.

## Part A — App changes

### A1. Event type (`src/types/analytics.ts`)

Extend `ToolAddedEvent.properties` with two optional dimensions — `source` (surface) and
`entry_point` (affordance):

```ts
export type ToolAddedEvent = AnalyticsEventBase & {
  event_type: 'tool_added';
  properties: {
    card_id: string;
    card_category: string;
    origin_badge: string;
    source?: 'library_browser' | 'emotion_session';
    entry_point?: 'list' | 'preview';
  };
};
```

Both are optional so historical/legacy events (and the type) remain valid. `tool_created` is left
unchanged. No change to `VALID_EVENT_TYPES` (both event types are already allowlisted). Property
values stay `string` — no boolean encoding needed.

### A2. Library Browser adds (`src/screens/LibraryBrowserScreen.tsx`)

Add `source: 'library_browser'` plus the affordance-specific `entry_point` to both existing
`tool_added` calls. These are already two distinct functions, so no plumbing is needed:

- `handleAddToWallet` (~L431) — the list-row add → `entry_point: 'list'`
- `handlePreviewAddToWallet` (~L527) — the preview-sheet add → `entry_point: 'preview'`

```ts
// handleAddToWallet
void logEvent('tool_added', {
  card_id: card.id,
  card_category: card.categoryId,
  origin_badge: originBadge,
  source: 'library_browser',
  entry_point: 'list',
});

// handlePreviewAddToWallet
void logEvent('tool_added', {
  card_id: card.id,
  card_category: card.categoryId,
  origin_badge: originBadge,
  source: 'library_browser',
  entry_point: 'preview',
});
```

No other change. `origin_badge` still distinguishes `library` vs `app` (external app cards).

### A3. Emotion-session adds (`src/components/session/SessionLauncherContent.tsx` + 2 child components)

`handleAddToWallet` (~L254–318) already resolves the full card via
`const libraryCard = CURATED_LIBRARY.find((c) => c.id === cardId)` and creates it with origin
`'library'`. Two changes:

**1. Widen the callback to carry the affordance.** Change the signature from
`handleAddToWallet(cardId)` to `handleAddToWallet(cardId, entryPoint: 'list' | 'preview')`, and emit
inside the `try`, after the successful `create` / `recordToolAdded(...)`:

```ts
const handleAddToWallet = useCallback(
  async (cardId: string, entryPoint: 'list' | 'preview') => {
    const libraryCard = CURATED_LIBRARY.find((c) => c.id === cardId);
    if (!libraryCard) return;
    if (addedToWalletIds.has(cardId)) return;              // dup guard (no event)
    // ...existing already-in-wallet guard (no event)...
    try {
      // ...existing create + tag persistence + setAddedToWalletIds + recordToolAdded...
      void logEvent('tool_added', {
        card_id: libraryCard.id,
        card_category: libraryCard.categoryId,
        origin_badge: 'library',
        source: 'emotion_session',
        entry_point: entryPoint,
      });
      await useWalletStore.getState().loadCards();
    } catch {
      // abort — no event
    }
  },
  [addedToWalletIds]
);
```

**2. Thread `entry_point` from the two callers** (both currently call `onAddToWallet(card.id)`):

- `src/components/session/ToolPreviewCard.tsx` — prop type widens
  `onAddToWallet?: (cardId: string, entryPoint: 'list' | 'preview') => void`; the button calls
  `onAddToWallet?.(cardId, 'list')` (~L108).
- `src/components/session/LibraryToolPreview.tsx` — prop type widens
  `onAddToWallet: (cardId: string, entryPoint: 'list' | 'preview') => void`; the button calls
  `onAddToWallet(card.id, 'preview')` (~L114).
- In `SessionLauncherContent`, the `<LibraryToolPreview onAddToWallet={handleAddToWallet} />` and
  `<ToolPreviewCard onAddToWallet={handleAddToWallet} />` wiring stays as-is (same function
  reference) — the callers now supply the second arg.

`logEvent` is already imported in `SessionLauncherContent` (used for `guided_checkin_started/completed`),
so no new import.

**Placement note:** the callback swallows failures in a bare `catch {}`. The `logEvent` must be
inside the `try` after `create` resolves, NOT in a `finally`, so a failed add does not log a phantom
growth event (Req 2.3).

### A4. New `tool_preview_opened` event (Req 3)

**Type + allowlist.** Add the event type and its payload to `src/types/analytics.ts`:

```ts
// add to the AnalyticsEventType union
| 'tool_preview_opened'

// new discriminated member
export type ToolPreviewOpenedEvent = AnalyticsEventBase & {
  event_type: 'tool_preview_opened';
  properties: {
    card_id: string;
    card_category: string;
    source: 'library_browser' | 'emotion_session';
  };
};
```

Add `'tool_preview_opened'` to `VALID_EVENT_TYPES` in `src/services/analyticsEventLogger.ts` (else
`logEvent` drops it). No `entry_point` — a preview open has no list/preview sub-affordance; it IS the
preview.

**Emission site 1 — Library Browser** (`src/screens/LibraryBrowserScreen.tsx`, `handleOpenPreview`
~L374):

```ts
const handleOpenPreview = useCallback((card: CuratedCardDefinition) => {
  setPreviewCard(card);
  setPreviewVisible(true);
  void logEvent('tool_preview_opened', {
    card_id: card.id,
    card_category: card.categoryId,
    source: 'library_browser',
  });
}, []);
```

**Emission site 2 — emotion session** (`src/components/session/SessionLauncherContent.tsx`, the
`setPreviewingCard(libraryCard)` branch of `handleOpenTool` ~L228–232). Fire only in the branch that
actually opens the inline preview (not the "already in wallet → navigate" branch):

```ts
} else {
  // Not in wallet — show inline preview
  const libraryCard = CURATED_LIBRARY.find((c) => c.id === cardId);
  if (libraryCard) {
    setPreviewingCard(libraryCard);
    void logEvent('tool_preview_opened', {
      card_id: libraryCard.id,
      card_category: libraryCard.categoryId,
      source: 'emotion_session',
    });
  }
}
```

No de-dupe: each preview open is a legitimate signal (Req 3.5). This event is NOT read by any worker
KPI/endpoint in this spec — it just starts accumulating in D1 for a future preview→add conversion
view (Req 3.6, 3.7).

## Part B — Worker changes (`analytics-worker/`)

### B1. Redefine the KPI (`src/index.ts`, inside `handleKpis`)

Replace the Wallet Growth IIFE (~L424–465) with a query that counts distinct users appearing in
**either** add event, dropping the `app_opened / days_since_install > 0` self-join (decision D2).
Because it's a single-table count over the `events` table with the unqualified `anonymous_user_id`,
it can use the standard `withFilter` helper instead of the hand-rolled `e1`/`e2` filters:

```ts
const walletGrowthFilter = withFilter(
  "WHERE event_type IN ('tool_added', 'tool_created')"
);
// ...in the Promise.all:
query(
  `SELECT COUNT(DISTINCT anonymous_user_id) as users_who_added FROM events ${walletGrowthFilter.where}`,
  walletGrowthFilter.params
).first<{ users_who_added: number }>(),
```

`withFilter` already appends date + exclusion + the main cohort clause (`cohortMain`), so phase and
`cohort=new` toggles keep working. `usersWhoAddedTools` assignment (~L526) and the `launch` object
(~L555–566) are unchanged in shape — only the query behind `walletGrowthResult` changes.

This also **simplifies** the code: the previous IIFE with dual `e1/e2` filter-building and
`buildCohortClause` calls goes away, replaced by one `withFilter` line.

### B2. New detail endpoint (`src/index.ts`)

Add `handleDetailWalletGrowth` following the `handleDetailTools` template (auth →
`buildDetailFilter` → single query → CORS JSON). Resolve `source` in SQL with a CASE so legacy rows
and `tool_created` map correctly (decision D3):

```ts
async function handleDetailWalletGrowth(request: Request, env: Env): Promise<Response> {
  if (!isAuthorized(request, env)) return unauthorizedResponse();
  const { clause, query } = buildDetailFilter(request, env);
  const result = await query(`
    SELECT
      anonymous_user_id,
      json_extract(properties, '$.card_id') as card_id,
      json_extract(properties, '$.card_category') as card_category,
      CASE
        WHEN event_type = 'tool_created' THEN 'created'
        WHEN json_extract(properties, '$.source') = 'emotion_session' THEN 'emotion_session'
        ELSE 'library'
      END as source,
      json_extract(properties, '$.entry_point') as entry_point,
      timestamp
    FROM events
    WHERE event_type IN ('tool_added', 'tool_created')${clause}
    ORDER BY timestamp DESC
    LIMIT 200
  `).all();
  return corsResponse(JSON.stringify(result.results), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
```

`clause` appears once, so the auto-binding `query()` helper is sufficient (no manual param
repetition). Register the route alongside the others (~L915–938):

```ts
if (path === '/details/wallet-growth' && request.method === 'GET') {
  return handleDetailWalletGrowth(request, env);
}
```

### B3. Dashboard card + drill-down (`src/dashboard.ts`)

**Make the card clickable and rewrite its copy** (~L563–568). Note `${...}` is escaped as `\${...}`
inside the template literal:

```html
<div class="card" onclick="showDetail('wallet-growth')">
  <h3>Wallet Growth</h3>
  <div class="value">\${num(kpis.launch.usersWhoAddedTools)}</div>
  <div class="detail">Unique users who added a tool — from the library, an emotion session, or by creating their own. Click for the per-add breakdown.</div>
</div>
```

**Add a render block in `showDetail`** (alongside the `type === 'tools'` block, ~L692):

```js
if (type === 'wallet-growth') {
  const rows = Array.isArray(data) ? data : [];
  function sourceLabel(s) {
    return s === 'emotion_session' ? 'Emotion session'
      : s === 'created' ? 'Created (custom)'
      : 'Library';
  }
  function entryLabel(e) {
    return e === 'list' ? 'List' : e === 'preview' ? 'Preview' : '\u2014'; // — for legacy/created
  }
  var body = rows.length === 0
    ? '<tr><td colspan="6" style="color:#6c757d;">No adds in this window.</td></tr>'
    : rows.map(function(r) {
        return '<tr><td>' + shortId(r.anonymous_user_id) + '</td><td>' + (r.card_id ? r.card_id.slice(0,20) : '-') + '</td><td>' + (r.card_category || '-') + '</td><td>' + sourceLabel(r.source) + '</td><td>' + entryLabel(r.entry_point) + '</td><td>' + fmtDate(r.timestamp) + '</td></tr>';
      }).join('');
  html = '<div class="detail-panel">' +
    '<h3>Wallet Growth — adds (' + rows.length + ') <button class="close-btn" onclick="closeDetail()">Close</button></h3>' +
    '<p style="margin-bottom:12px;color:#6c757d;font-size:0.85rem;">Each row is one tool added to a wallet. Source = where the add happened; Entry Point = which affordance. Entry Point is blank (\u2014) for created tools and for any library add made before the 1.0.4 build (that dimension did not exist yet).</p>' +
    '<table><thead><tr><th>User ID</th><th>Card ID</th><th>Category</th><th>Source</th><th>Entry Point</th><th>Timestamp</th></tr></thead><tbody>' +
    body +
    '</tbody></table></div>';
}
```

`fetchDetail('wallet-growth', ...)` already appends `getPhaseParams()` (phase + cohort), so the
drill-down respects the same filters as the card. `showDetail` is re-opened by `refresh()` after
auto-refresh, and `closeDetail()` clears it — both already generic, no change needed.

### B4. No schema migration (but one data backfill — see B5)

`source` and `entry_point` are JSON properties inside the existing `properties` column, not new
columns. No `CREATE`/`ALTER` migration, nothing schema-wise to run before deploy. `POST /events`
already stores arbitrary `properties` verbatim.

### B5. Backfill `source` on historical `tool_added` rows (decision D3a / Req 6)

A one-time data edit stamps `source = 'library_browser'` into existing `tool_added` rows that lack
it. SQLite's `json_set` writes into the JSON blob. Run against remote D1.

**Dry run first (count the blast radius):**

```sql
SELECT COUNT(*) AS to_backfill
FROM events
WHERE event_type = 'tool_added'
  AND json_extract(properties, '$.source') IS NULL;
```

**Then the idempotent update:**

```sql
UPDATE events
SET properties = json_set(properties, '$.source', 'library_browser')
WHERE event_type = 'tool_added'
  AND json_extract(properties, '$.source') IS NULL;
```

- Idempotent: the `IS NULL` guard means re-running is a no-op and post-1.0.4 `emotion_session` rows
  are never clobbered.
- Does NOT touch `tool_created` rows (different `event_type`).
- Does NOT write `entry_point` — no truthful historical value; its absence is intentional and
  documented (Req 6.4).
- Recorded as a committed file under `analytics-worker/migrations/` (e.g.
  `0004_backfill_tool_added_source.sql`) even though it's data, not schema, so it's reproducible and
  auditable. Run with:
  `wrangler d1 execute analytics-db --remote --file=migrations/0004_backfill_tool_added_source.sql`
  (run the dry-run SELECT interactively first).
- Ordering: the read-time `CASE ... ELSE 'library'` in B2 makes the dashboard correct **with or
  without** this backfill, so the backfill is not a hard prerequisite for deploy — it's about
  keeping the raw table clean per operator preference. Safe to run before or after the worker
  deploy.

## Data / correctness notes

- **Double-counting:** unioning `tool_added` and `tool_created` at the **distinct-user** level
  (KPI) cannot double-count a user. The detail table intentionally shows one row per add event
  (a user who added 3 tools shows 3 rows) — that's the desired composition view, and it's labeled
  "adds," not "users."
- **Legacy rows:** pre-1.0.4 `tool_added` rows have no `$.source`; after the B5 backfill they
  physically read `library_browser`, and the read-time CASE maps them to `library` regardless — both
  accurate (that was their only origin before this change). `tool_created` history maps to `created`
  and lights up immediately. `entry_point` stays absent on all these rows (→ "—" in the UI); this is
  a real "dimension didn't exist yet" fact, not missing data.
- **Cohort/new correctness:** the KPI reuses `withFilter` (which carries `cohortMain`), and the
  detail endpoint reuses `buildDetailFilter` (which re-implements the same cohort subquery). Both
  honor `cohort=new` exactly like every other metric — no special-casing.

## Verification & trust level

- **Worker (Req 4, 5, 6):** verifiable now. Typecheck (`npx tsc --noEmit -p tsconfig.json`), deploy,
  then load `/dashboard` and confirm: the number rises to include custom-tool creators and all
  library adders (no longer gated on returning), the card is clickable, and the table renders rows
  with sources (`created` + `library` from history). This is a genuine end-to-end check against real
  D1 data.
- **App (Req 1, 2, 3):** verifiable only at the **unit level** here (types compile; the `logEvent`
  calls are on the correct paths). The actual on-device emission of `source: 'emotion_session'`,
  `source: 'library_browser'`, the `entry_point` values, and the new `tool_preview_opened` event
  cannot be confirmed from this environment — it requires a real 1.0.4 build: add a tool from an
  emotion session and open a preview, then confirm the corresponding events appear (dev event
  viewer, or `/events` on the worker after the build ships). State this plainly rather than
  implying the on-device path is proven.
- Clean up: no temporary diagnostics introduced; nothing to grep out.
