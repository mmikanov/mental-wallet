# Requirements Document

## Introduction

Add visibility into the Emotion Session ("Start from how I feel") flow to the production **analytics worker** dashboard (`analytics-worker/`, the Cloudflare Worker admin dashboard — NOT the in-app user-facing analytics-dashboard spec).

The operator wants to know how many people are trying the Emotion Session and what they select inside it (emotion / contexts / time). A later phase will add tracking for tools added to the wallet from the emotion-session suggestions, which is not currently emitted by the app.

## Scope split

- **Phase 1 (implement now):** Everything computable from events the app already sends — a top-level "Emotion Sessions" card and a click-through drill-down. No app changes.
- **Phase 2 (future, needs an app release):** Track adds from emotion-session suggestions and surface them on the dashboard.

## What the app already emits (Phase 1 data source)

- **`session_started`** — the canonical "an emotion session was started" signal. Emitted once per session from `sessionStore.selectEmotion()` (guarded by `!isSessionActive`) and ONLY for the emotion flow, regardless of entry point (onboarding choice, saved default start mode, manual launch of the session card, guided check-in). Carries no properties. This is what the card/drill-down counts.
- `session_ended` with `properties.emotion` / `properties.contexts` / `properties.time` — the only event that records WHAT the user picked (populated only for emotion sessions; `contexts` is a comma-joined string). Used for the emotion/context breakdowns. **Caveat:** `session_ended` is currently over-fired — `RootNavigator`'s AppState listener calls `endSession()` on both `background` and `inactive` transitions, and `endSession()` has no re-entrancy guard, so one session can emit several `session_ended` events. Breakdowns from it should be read as proportions until the app bug (Requirement 5) is fixed.
- `start_mode_selected` (mode=`emotion_first`) — NOT used for session counting. It is an onboarding-only event, fired once per user when they first pick a start mode on the ModeChoiceScreen, so it does not correspond to sessions and undercounts real usage.

Tools opened *inside* a session are stored on-device only and are out of scope.

## Requirements

### Requirement 1: Emotion Sessions KPI card

**User Story:** As the operator, I want a dashboard card showing how many users tried the Emotion Session, so I can gauge adoption of the emotion-first flow.

#### Acceptance Criteria

1. THE dashboard SHALL display an "Emotion Sessions" card whose value is the count of unique users with at least one `session_started` event.
2. THE card SHALL show a supporting detail line with the total number of `session_started` events (sessions started, not just unique users).
3. THE card's numbers SHALL respect the active Phase filter (from/to) exactly like the other cards.
4. THE card's numbers SHALL respect the active Users cohort filter (Active vs New) exactly like the other cards.
5. WHEN there are no `session_started` events in the window, THE card SHALL display 0 without error.

### Requirement 2: Emotion Sessions drill-down

**User Story:** As the operator, I want to click the card and see who tried it and what they picked, so I can understand how the feature is used.

#### Acceptance Criteria

1. WHEN the operator clicks the Emotion Sessions card, THE dashboard SHALL open a detail panel below (same pattern as the other drill-downs) via a `/details/emotion-sessions` endpoint.
2. THE detail panel SHALL include a per-user table keyed on `session_started`: user ID (shortened), number of sessions started, first seen, last seen.
3. THE detail panel SHALL include an "Emotions selected" breakdown: each distinct `session_ended.properties.emotion` value with its count and percentage, accompanied by a note that these come from `session_ended` and are inflated by the duplicate-firing bug (read as proportions).
4. THE detail panel SHALL include a "Contexts selected" breakdown, splitting the comma-joined `contexts` string into individual context values with counts.
5. THE drill-down SHALL respect the active Phase filter and the active Users cohort filter (including a per-panel cohort override, consistent with the existing users drill-down behavior).
6. WHEN there is no data in the window, THE panel SHALL render empty tables/labels without error.

### Requirement 3: Consistency with existing dashboard conventions

#### Acceptance Criteria

1. THE new endpoint SHALL require the `DASHBOARD_SECRET` like all other read endpoints.
2. THE new queries SHALL reuse the shared phase/cohort/exclusion filter helpers (`buildDetailFilter` on the worker, `getPhaseParams` on the frontend) rather than hand-rolling filtering.
3. THE change SHALL be limited to `analytics-worker/src/index.ts` and `analytics-worker/src/dashboard.ts` (plus this spec). No app or migration changes.

## Future Requirements (Phase 2 — NOT implemented now)

### Requirement 4 (future): Track adds from emotion-session suggestions

**User Story:** As the operator, I want to know when a user adds a tool to their wallet from the emotion-session suggestions, so I can measure whether the suggestions drive wallet growth.

#### Notes / Acceptance Criteria (for when this is built)

1. THE app SHALL emit a `tool_added` analytics event when a tool is added from the emotion-session suggestions. Both suggestion entry points — the suggestion list (`ToolPreviewCard`) and the preview (`LibraryToolPreview`) — funnel through the single `SessionLauncherContent.handleAddToWallet` callback, so one `logEvent` call there covers both.
2. THE `tool_added` event SHALL carry a `source` property (e.g. `'emotion_session'` vs `'library_browser'`) so adds can be attributed. The two existing `LibraryBrowserScreen` call sites SHALL be updated to send `source: 'library_browser'`.
3. (Optional) To distinguish list-add from preview-add, an `entry_point` property (`'list' | 'preview'`) SHALL be threaded from the two callers.
4. THE dashboard SHALL surface adds-from-suggestions (count and/or a per-source breakdown) once the event is flowing.
5. This requires an app store release before data exists; historical periods will read zero.

### Requirement 5 (future, app bug): Stop `session_ended` from firing multiple times per session

**User Story:** As the operator, I want each emotion session to produce exactly one `session_ended` event, so the emotion/context breakdowns reflect real session counts.

#### Notes / Acceptance Criteria (for when this is built)

1. **Root cause:** `RootNavigator`'s `AppState` `change` listener calls `sessionStore.endSession()` on BOTH `background` and `inactive` transitions. On iOS, `inactive` fires transiently (Control Center, app switcher, permission prompts, call banners). `endSession()` fires `logEvent('session_ended', ...)` before it resets `isSessionActive`/`selectedEmotion` (state is cleared only after several `await`s at the end), so re-entrant calls emit duplicate `session_ended`-with-emotion events for one session.
2. THE app SHALL add a re-entrancy guard so `endSession()` fires `session_ended` at most once per session — e.g. flip `isSessionActive`/clear session identity synchronously at the top before any `await`, or gate on a separate `isEnding` flag.
3. THE AppState listener SHOULD only end the session on `background`, not `inactive`, so transient foreground interruptions don't end (and re-log) a session.
4. Requires an app release. After it ships, the dashboard's `session_ended`-based emotion/context breakdowns become trustworthy as absolute counts, and the "read as proportions" note can be removed.
