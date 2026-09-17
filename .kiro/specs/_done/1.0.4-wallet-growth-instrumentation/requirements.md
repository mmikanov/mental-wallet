# Requirements — Wallet Growth Instrumentation (1.0.4)

## Overview

Connected changes:

1. **App (requires a 1.0.4 build):** emit a `tool_added` analytics event when a user adds a
   tool to their wallet from the **emotion session** ("Start from how I feel") suggestions —
   which is currently un-instrumented — and tag every `tool_added` event with a `source` (and
   `entry_point`) so we can tell library adds apart from emotion-session adds, and list-adds apart
   from preview-adds.
2. **App (also 1.0.4):** add a new `tool_preview_opened` event so we can see when a user opens a
   card's full preview without necessarily adding it — the step between "saw a suggestion" and
   "added." The event ships now (it's the build-gated part); its dashboard visualization is a
   deliberate fast-follow once data exists.
3. **Analytics dashboard (Cloudflare Worker, deploys independently):** redefine the "Wallet
   Growth" Launch Success Metric so it counts **all** ways a tool enters a wallet — library
   add, emotion-session add, and creating a custom tool — update its description to say so, and
   make the card clickable to open a drill-down table showing which user added which tool and
   **where** (library / emotion session / created).

## Background (verified in code)

- `tool_added` is emitted from exactly two sites, both in `src/screens/LibraryBrowserScreen.tsx`
  (`handleAddToWallet` ~L431, `handlePreviewAddToWallet` ~L527). Both set
  `origin_badge` to `'library'` or `'app'`. Neither carries a `source`.
- The emotion-session add path — `SessionLauncherContent.handleAddToWallet`
  (`src/components/session/SessionLauncherContent.tsx` ~L254–318) — calls the local
  `recordToolAdded()` only and **never** calls `logEvent`. So emotion-session adds are invisible
  to analytics today.
- Custom tool creation emits a **separate** event, `tool_created`
  (`src/screens/CardCreatorScreen.tsx` ~L610), with `origin_badge: 'my_tool'`. The analytics
  worker has **zero** references to `tool_created` — it is emitted but never read.
- The dashboard "Wallet Growth" card counts distinct users who fired `tool_added` **and** had an
  `app_opened` with `days_since_install > 0` (the "returning user" gate). It is **not**
  clickable today (no `showDetail` handler). Query lives in `analytics-worker/src/index.ts`
  (~L424–465); card markup in `analytics-worker/src/dashboard.ts` (~L563–568).
- `logEvent(eventType, properties?)` constrains property values to `string | number` — booleans
  must be encoded as 0/1. Events must be listed in `VALID_EVENT_TYPES`
  (`src/services/analyticsEventLogger.ts`) or they are silently dropped.

## Decisions (resolved in this spec; revisit with operator if needed)

- **D1 — Custom tools count via the existing `tool_created` event, NOT a re-emitted `tool_added`.**
  The dashboard KPI and drill-down UNION `tool_added` + `tool_created`. This avoids double-counting
  and preserves `tool_created`'s existing meaning. (Alternative considered: also emit `tool_added`
  on create — rejected because it would double-count against `tool_created` and muddy that event.)
- **D2 — Drop the "returning user" gate from Wallet Growth.** The metric becomes "users who added
  a tool by any means, in the phase window," counted over `tool_added` ∪ `tool_created`. Rationale:
  the request is "ALL wallet adds"; the `days_since_install > 0` gate is what made the old number
  (3) misleadingly small, and it conflated "growth" with "returning." Retention already has its own
  cards. (If the operator wants to keep a returning-only variant, it can be a second card later.)
- **D3 — Two separate dimensions, not one overloaded `source`.** The "where" and the "which
  affordance" are distinct and have different backfill stories, so they get distinct properties:
  - `source` = the **surface**: `'library_browser' | 'emotion_session'`. Coarse, and fully
    reconstructable for history (every legacy `tool_added` is a Library Browser add).
  - `entry_point` = the **affordance within the surface**: `'list' | 'preview'`. Fine, and
    genuinely unknowable for history in BOTH surfaces — it only exists from 1.0.4 forward.
- **D3a — Physical backfill of `source` on existing rows (operator preference: keep the DB clean).**
  A one-time D1 `UPDATE` stamps `source = 'library_browser'` into the `properties` JSON of every
  existing `tool_added` row that lacks it. `entry_point` is deliberately NOT written on historical
  rows — there is no truthful value; its absence on pre-1.0.4 rows is a real fact ("this dimension
  didn't exist yet"), not a data gap. `tool_created` rows are NOT touched (they keep their own
  event identity; the dashboard maps them to `created`). Low risk: single operator, brand-new app,
  additive JSON edit. A dry-run SELECT precedes the UPDATE.
- **D4 — Both emotion-session adds AND library adds reuse the `tool_added` event** (not a new event
  type), differentiated by `source` + `entry_point`. Keeps one add event with two dimensions rather
  than proliferating event types.

## Requirements

### Requirement 1 — Tag library adds with a source

**User story:** As the operator, I want existing library/app adds tagged with their source, so the
dashboard can attribute them correctly.

#### Acceptance Criteria
1. WHEN a user adds a tool from the Library Browser THEN the `tool_added` event SHALL include
   `source: 'library_browser'` plus an `entry_point`, in addition to the existing `card_id`,
   `card_category`, and `origin_badge`. Specifically:
   - `handleAddToWallet` (the list-row add) → `entry_point: 'list'`
   - `handlePreviewAddToWallet` (the preview-sheet add) → `entry_point: 'preview'`
2. The `ToolAddedEvent` type in `src/types/analytics.ts` SHALL be extended so `properties`
   includes optional `source?: 'library_browser' | 'emotion_session'` and
   `entry_point?: 'list' | 'preview'`.
3. No behavioral change to the add flow itself (persistence, alerts, duplicate guards) — the only
   change is the two added properties.

### Requirement 2 — Emit a tool_added event for emotion-session adds

**User story:** As the operator, I want to know when a user adds a tool from the emotion-session
suggestions, so I can measure whether the session drives wallet growth and tell it apart from
library adds.

#### Acceptance Criteria
1. WHEN a user adds a tool to their wallet from within an emotion session THEN the app SHALL emit
   `logEvent('tool_added', { card_id, card_category, origin_badge, source: 'emotion_session', entry_point })`
   with the `entry_point` reflecting which affordance was used:
   - `ToolPreviewCard`'s "Add to wallet" in the suggestion list → `entry_point: 'list'`
   - `LibraryToolPreview`'s "Add to my wallet" preview button → `entry_point: 'preview'`
2. Both affordances currently funnel through the SAME `SessionLauncherContent.handleAddToWallet(cardId)`.
   To distinguish them, `handleAddToWallet` SHALL accept a second argument
   (`entryPoint: 'list' | 'preview'`), and each caller SHALL pass its value:
   - `ToolPreviewCard`'s `onAddToWallet` invocation → `'list'`
   - `LibraryToolPreview`'s `onAddToWallet` invocation → `'preview'`
   This requires threading the value through the `onAddToWallet` prop of both child components (the
   prop signature widens from `(cardId) => void` to `(cardId, entryPoint) => void`).
3. The event SHALL fire only on a **successful** add (inside the `try`, after `cardService.create`
   resolves), never on the early-return duplicate/exists guards, and never in the `catch`.
4. The event SHALL NOT fire twice for the same card in the same session (the existing
   `addedToWalletIds` guard already prevents re-entry; the event sits after that guard).
5. `card_id`, `card_category`, and `origin_badge` SHALL be taken from the resolved
   `CURATED_LIBRARY` card (`libraryCard.id`, `libraryCard.categoryId`, `'library'`) — the same
   values the add already uses.

### Requirement 3 — Track when a user opens a card preview

**User story:** As the operator, I want to know when a user opens the full preview of a suggested/
library card (even if they don't add it), so I can see the step between "saw a suggestion" and
"added/completed" and tell a discovery problem apart from a persuasion problem.

#### Acceptance Criteria
1. A new event type `tool_preview_opened` SHALL be added to the `AnalyticsEventType` union
   (`src/types/analytics.ts`) AND to the `VALID_EVENT_TYPES` allowlist
   (`src/services/analyticsEventLogger.ts`) — otherwise `logEvent` silently drops it.
2. Its properties SHALL be `{ card_id: string; card_category: string; source: 'library_browser' |
   'emotion_session' }`. (No `entry_point` — a preview open has no list/preview sub-affordance; it
   IS the preview.)
3. WHEN a user opens the Library Browser preview sheet (`handleOpenPreview`,
   `src/screens/LibraryBrowserScreen.tsx` ~L374) THEN the app SHALL emit `tool_preview_opened` with
   `source: 'library_browser'`.
4. WHEN a user opens the inline library-tool preview during an emotion session (the
   `setPreviewingCard(libraryCard)` branch of `handleOpenTool`,
   `src/components/session/SessionLauncherContent.tsx` ~L230) THEN the app SHALL emit
   `tool_preview_opened` with `source: 'emotion_session'`.
5. The event SHALL fire on the open action only; there is NO requirement to de-dupe repeated opens
   of the same card (each open is a legitimate signal).
6. SCOPE: this requirement adds the EVENT only. No new dashboard card or drill-down for previews is
   in scope for this spec — the event starts collecting data with the 1.0.4 build, and any
   visualization (e.g. a preview→add conversion) is a deliberate fast-follow once data exists. This
   is the build-gated, expensive-to-be-late part; the dashboard read side is not.
7. This event is NOT part of the Wallet Growth KPI or its drill-down (previews are not adds).

### Requirement 4 — Redefine the Wallet Growth KPI to count all adds

**User story:** As the operator, I want the Wallet Growth number to reflect every way a tool enters
a wallet, so it measures real wallet expansion.

#### Acceptance Criteria
1. The Wallet Growth KPI (`kpis.launch.usersWhoAddedTools`) SHALL count distinct users who have
   **either** a `tool_added` event **or** a `tool_created` event within the active phase window,
   respecting the existing phase (`from`/`to`), exclusion, and cohort (`active`/`new`) filters.
2. The KPI SHALL NOT require `days_since_install > 0` (per decision D2).
3. The metric SHALL continue to use the shared filter machinery (`buildCohortClause` for the
   table-qualified query, or `withFilter` for a simple one) so it stays consistent with every
   other KPI under the phase + cohort toggles.
4. The dashboard card description SHALL be updated to make the new meaning explicit, e.g.
   "Unique users who added a tool — from the library, an emotion session, or by creating their
   own. Click for the per-add breakdown."

### Requirement 5 — Wallet Growth drill-down table

**User story:** As the operator, I want to click the Wallet Growth card and see which user added
which tool and where, so I can understand the composition of wallet growth.

#### Acceptance Criteria
1. The Wallet Growth card SHALL be clickable and open the shared `#detail-panel` (like the other
   drill-down cards), via a new `showDetail('wallet-growth')` handler.
2. A new authenticated endpoint `GET /details/wallet-growth` SHALL return one row per add event
   (`tool_added` ∪ `tool_created`) within the active filters, each row including: user id
   (shortened in UI), `card_id`, `card_category`, resolved **source**, resolved **entry_point**,
   and timestamp.
3. Source resolution in the row set SHALL be:
   - `tool_created` rows → `created`
   - `tool_added` rows WHERE `source = 'emotion_session'` → `emotion_session`
   - `tool_added` rows WHERE `source = 'library_browser'` OR `source IS NULL` (legacy) → `library`
     (after the D3a backfill, legacy rows are physically `library_browser`; the `IS NULL` branch
     remains as a defensive fallback).
4. Entry-point resolution SHALL surface `entry_point` (`list` / `preview`) when present, and a
   neutral placeholder (e.g. `—`) when absent — the latter being every pre-1.0.4 row and every
   `tool_created` row. This makes the "new dimension" boundary visible rather than fabricated.
5. The endpoint SHALL respect the phase (`from`/`to`), exclusion, and cohort filters via
   `buildDetailFilter`, matching the pattern of `handleDetailTools`.
6. The drill-down table SHALL render columns: User ID, Card ID, Category, Source, Entry Point,
   Timestamp, ordered by timestamp descending, capped (e.g. LIMIT 200) to protect the dashboard.
7. WHEN there are no add events in the window THEN the table SHALL render an empty state, not an
   error.

### Requirement 6 — Backfill `source` on existing `tool_added` rows (D3a)

**User story:** As the operator, I want the historical `tool_added` rows to physically carry
`source = 'library_browser'`, so the D1 table is self-consistent and I don't have to remember later
why some rows lacked a source.

#### Acceptance Criteria
1. A one-time, idempotent D1 statement SHALL set `source = 'library_browser'` inside the
   `properties` JSON of every `tool_added` row that does not already have a `source`.
2. The statement SHALL be preceded by a **dry-run SELECT** (count of affected rows) so the operator
   can eyeball the blast radius before writing.
3. The statement SHALL NOT modify `tool_created` rows, SHALL NOT add `entry_point` to any historical
   row (no truthful value exists), and SHALL NOT overwrite a `source` that is already set (so
   re-running is safe and post-1.0.4 `emotion_session` rows are never clobbered).
4. It SHALL be run against remote D1 (`wrangler d1 execute ... --remote`) and, being a data edit
   rather than a schema change, SHALL be recorded (committed) as a numbered file under
   `analytics-worker/migrations/` or documented in the analytics ops doc so it is reproducible.
5. This is classified low-risk (single operator, new app, additive JSON edit, dry-run first,
   idempotent), but it IS a write to production data — the operator has explicitly approved it.

### Requirement 7 — Explainability / docs consistency

**User story:** As a future maintainer, I want the docs and steering to match the new behavior.

#### Acceptance Criteria
1. The "Known event gaps" note in `.kiro/steering/analytics-dashboard.md` (which documents the
   emotion-session `tool_added` gap and the Wallet Growth undercount) SHALL be updated to reflect
   that the gap is closed and that Wallet Growth now unions `tool_added` + `tool_created` with
   `source` + `entry_point` dimensions.
2. `docs/launch-plan.md`'s Wallet Growth row (and any store/launch doc that describes it) SHALL be
   updated to the new definition.
3. The `emotion-session-analytics` spec's "Requirement 4 (future): Track adds from emotion-session
   suggestions" SHALL be marked as implemented (or cross-referenced to this spec).
4. Documentation SHALL note explicitly that `entry_point` is absent on all pre-1.0.4 rows by design
   (the dimension did not exist), so future-operator does not read it as missing data.

### Requirement 8 — Release + verification

**User story:** As the operator, I want the app and worker changes shipped correctly and verified
at the honest level.

#### Acceptance Criteria
1. The app changes (Req 1, 2, 3) SHALL be part of the **1.0.4** build. Marketing version is already
   1.0.4 in all four required places (`app.json`, `Info.plist`, `project.pbxproj` Debug+Release,
   `android/app/build.gradle`) — no version bump needed for this change, but if 1.0.4 was already
   submitted to either store before this lands, the version MUST be bumped per the release
   checklist.
2. The worker changes (Req 4, 5) SHALL be typechecked (`cd analytics-worker && npx tsc --noEmit -p
   tsconfig.json`) and deployed via `npm run deploy`. No schema migration is required (`source`/
   `entry_point` are JSON properties, not columns); the Req 6 backfill is a data `UPDATE`, not a
   schema change.
3. Verification honesty: the KPI/endpoint changes and the backfill are verifiable at the query
   level against existing data (custom-tool `tool_created` history already exists; after the
   backfill, legacy `tool_added` physically reads `library_browser`). The emotion-session
   `source: 'emotion_session'` rows, the new library `entry_point` values, and the
   `source: 'library_browser'` tag on NEW rows will only populate after the 1.0.4 build is in
   users' hands. This on-device emission cannot be confirmed from the worker side; it needs a
   manual pass on a real 1.0.4 build (add from an emotion session → expect
   `source: emotion_session`; add from the library list vs preview → expect the matching
   `entry_point`).
