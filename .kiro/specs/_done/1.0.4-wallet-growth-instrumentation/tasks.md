# Tasks — Wallet Growth Instrumentation (1.0.4)

Two independent tracks. **Track B (worker)** can ship first and works on existing data. **Track A
(app)** needs the 1.0.4 build to reach users before its new `source` values appear.

## Task Dependency Graph

- **Wave 1 (parallel):** Track A app edits (A1→A2→A3→A-check) and Track B worker edits (B1→B2→B3)
  are independent — different codebases, different deploy paths. Within each track the steps are
  sequential.
- **Wave 2:** Track B verify + deploy (B4), then the B5 backfill — both can happen immediately, do
  not wait on Track A. B5 is order-independent vs B4 (read-time CASE covers either state).
- **Wave 3:** Track A verify (A4) — requires a real 1.0.4 build; gated on the app build/release.
- **Wave 4:** Docs (C1) after both tracks are settled.

---

## Track A — App (part of the 1.0.4 build)

- [x] **A1. Extend the `tool_added` event type with `source` + `entry_point`**
  - In `src/types/analytics.ts`, add `source?: 'library_browser' | 'emotion_session'` and
    `entry_point?: 'list' | 'preview'` to `ToolAddedEvent.properties`. Leave `tool_created` and
    `VALID_EVENT_TYPES` unchanged.
  - _Requirements: 1.2_

- [x] **A2. Tag Library Browser adds with `source` + `entry_point`**
  - In `src/screens/LibraryBrowserScreen.tsx`, add `source: 'library_browser'` to both `tool_added`
    payloads, plus `entry_point: 'list'` in `handleAddToWallet` (~L431) and `entry_point: 'preview'`
    in `handlePreviewAddToWallet` (~L527).
  - _Requirements: 1.1, 1.3_

- [x] **A3. Emit `tool_added` for emotion-session adds, with `entry_point` threaded from callers**
  - In `src/components/session/SessionLauncherContent.tsx`, widen `handleAddToWallet` to
    `(cardId, entryPoint: 'list' | 'preview')` and, inside the `try` after the successful `create` /
    `recordToolAdded` (before the `catch`), add:
    `void logEvent('tool_added', { card_id: libraryCard.id, card_category: libraryCard.categoryId, origin_badge: 'library', source: 'emotion_session', entry_point: entryPoint })`.
    Confirm it sits after the duplicate/exists early-returns so it only fires once on success.
    `logEvent` is already imported — no new import.
  - In `src/components/session/ToolPreviewCard.tsx`: widen `onAddToWallet` prop to
    `(cardId, entryPoint) => void` and call `onAddToWallet?.(cardId, 'list')` (~L108).
  - In `src/components/session/LibraryToolPreview.tsx`: widen `onAddToWallet` prop to
    `(cardId, entryPoint) => void` and call `onAddToWallet(card.id, 'preview')` (~L114).
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] **A4. Add the `tool_preview_opened` event + emit it at both preview surfaces**
  - In `src/types/analytics.ts`: add `'tool_preview_opened'` to the `AnalyticsEventType` union and a
    `ToolPreviewOpenedEvent` type with properties `{ card_id, card_category, source: 'library_browser'
    | 'emotion_session' }` (no `entry_point`). Add it to the `AnalyticsEvent` union.
  - In `src/services/analyticsEventLogger.ts`: add `'tool_preview_opened'` to `VALID_EVENT_TYPES`.
  - In `src/screens/LibraryBrowserScreen.tsx` `handleOpenPreview` (~L374): emit
    `logEvent('tool_preview_opened', { card_id: card.id, card_category: card.categoryId, source: 'library_browser' })`.
  - In `src/components/session/SessionLauncherContent.tsx`, the `setPreviewingCard(libraryCard)`
    branch of `handleOpenTool` (~L230): emit
    `logEvent('tool_preview_opened', { card_id: libraryCard.id, card_category: libraryCard.categoryId, source: 'emotion_session' })`.
    Only in the inline-preview branch, not the "already in wallet → navigate" branch.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] **A-check. Typecheck the app**
  - Run `npm run typecheck` (`tsc --noEmit`) and confirm no new errors from the type + prop-signature
    changes (the widened `onAddToWallet` prop touches both child components and the callback; the new
    event type touches the union).
  - _Requirements: 8.1_

- [x] **A5. On-device verification (gated on the 1.0.4 build — cannot be done from this repo)**
  - On a real 1.0.4 build: (a) start an emotion session, add a suggested tool from the list →
    expect `tool_added` with `source: emotion_session, entry_point: list`; add one from the preview →
    `entry_point: preview`. (b) In the Library Browser, add from the list vs the preview sheet →
    expect `source: library_browser` with the matching `entry_point`. (c) Open a card preview in
    both surfaces WITHOUT adding → expect `tool_preview_opened` with the matching `source`. Confirm
    via the dev event viewer or the worker `/events` endpoint once the build ships.
  - This is the honest boundary: A1–A4 are unit-verifiable; A5 is on-device only.
  - _Requirements: 2.1, 3.3, 3.4, 8.3_

---

## Track B — Analytics worker (deploy independently, works on existing data)

- [x] **B1. Redefine the Wallet Growth KPI**
  - In `analytics-worker/src/index.ts` (`handleKpis`), replace the Wallet Growth IIFE (~L424–465)
    with a `withFilter("WHERE event_type IN ('tool_added', 'tool_created')")` count of
    `COUNT(DISTINCT anonymous_user_id) as users_who_added`. Drop the `app_opened /
    days_since_install > 0` self-join. Keep `usersWhoAddedTools` and the `launch` object shape.
  - _Requirements: 4.1, 4.2, 4.3_

- [x] **B2. Add the `/details/wallet-growth` endpoint**
  - Add `handleDetailWalletGrowth(request, env)` following the `handleDetailTools` template: auth →
    `buildDetailFilter` → single query over `WHERE event_type IN ('tool_added','tool_created')${clause}`
    selecting `anonymous_user_id`, `card_id`, `card_category`, a `CASE` that resolves `source`
    (`tool_created`→`created`; `$.source = 'emotion_session'`→`emotion_session`; else `library`),
    the raw `json_extract(properties, '$.entry_point') as entry_point`, and `timestamp`;
    `ORDER BY timestamp DESC LIMIT 200`.
  - Register the route: `if (path === '/details/wallet-growth' && request.method === 'GET') return handleDetailWalletGrowth(request, env);`
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] **B3. Make the dashboard card clickable + rewrite copy + add render block**
  - In `analytics-worker/src/dashboard.ts`: add `onclick="showDetail('wallet-growth')"` to the
    Wallet Growth card (~L563–568) and update its description to the "library, emotion session, or
    created — click for breakdown" copy.
  - Add an `if (type === 'wallet-growth') { ... }` block in `showDetail` rendering columns
    User ID / Card ID / Category / Source / Entry Point / Timestamp, with an empty-state when
    `rows.length === 0`, a source-label helper (`emotion_session`→"Emotion session",
    `created`→"Created (custom)", else "Library"), and an entry-label helper
    (`list`→"List", `preview`→"Preview", else "—").
  - _Requirements: 4.4, 5.1, 5.4, 5.6, 5.7_

- [x] **B4. Typecheck, deploy, verify**
  - `cd analytics-worker && npx tsc --noEmit -p tsconfig.json`, then `npm run deploy`.
  - Load `/dashboard?secret=...`: confirm the Wallet Growth number now includes custom-tool
    creators and all library adders (no longer gated on returning), the card is clickable, and the
    table renders history rows with `Library` / `Created (custom)` sources and "—" entry points. No
    schema migration.
  - _Requirements: 4.1, 8.2_

- [x] **B5. Backfill `source` on historical `tool_added` rows (data edit — operator-approved)**
  - Add `analytics-worker/migrations/0004_backfill_tool_added_source.sql` with the idempotent
    `UPDATE ... SET properties = json_set(properties, '$.source', 'library_browser') WHERE
    event_type = 'tool_added' AND json_extract(properties, '$.source') IS NULL;`
  - FIRST run the dry-run count SELECT interactively to see the blast radius, THEN run the file:
    `wrangler d1 execute analytics-db --remote --file=migrations/0004_backfill_tool_added_source.sql`
  - Does not touch `tool_created`; does not write `entry_point`; idempotent (safe to re-run).
  - Not a hard prerequisite for B4 (read-time CASE already handles NULL) — run before or after.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Track C — Docs / explainability (after both tracks settle)

- [x] **C1. Update docs + steering to the new definition**
  - `.kiro/steering/analytics-dashboard.md`: update the "Known event gaps" note — the
    emotion-session `tool_added` gap is closed; Wallet Growth now unions `tool_added` +
    `tool_created` with `source` + `entry_point` dimensions and no longer requires a returning-user
    gate. Note that `entry_point` is absent by design on all pre-1.0.4 rows.
  - `docs/launch-plan.md`: update the Wallet Growth row to the new definition.
  - `emotion-session-analytics` spec: mark "Requirement 4 (future): Track adds from emotion-session
    suggestions" as implemented / cross-reference this spec.
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

---

## Release checklist touchpoints (Track A only)

- Marketing version is already **1.0.4** in all four places (`app.json`,
  `ios/MentalWallet/Info.plist`, `project.pbxproj` Debug+Release, `android/app/build.gradle`) — no
  bump needed **unless** 1.0.4 was already submitted to a store before this lands, in which case
  bump per the release checklist.
- Add these changes to the "Unreleased"/1.0.4 entry in `docs/store-listing-copy.md` if the release
  notes call out analytics/instrumentation (usually internal-only; may not need user-facing copy).
- No App Review notes needed — no user-visible behavior change.
