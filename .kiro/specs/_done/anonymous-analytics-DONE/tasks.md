# Implementation Plan: Anonymous Analytics

## Overview

Implement a privacy-first, offline-resilient analytics system that generates anonymous identifiers locally, logs structured events to a SQLite queue, and transmits them in batches to a configurable backend. Users retain full control via opt-out and data-reset controls in Settings. The implementation is layered: types first, then data layer, services (identity → session → event logger → transmitter), Zustand store, UI (settings + onboarding), and finally instrumentation wiring.

## Tasks

- [x] 1. Define analytics types and database migration
  - [x] 1.1 Create analytics TypeScript types
    - Create `src/types/analytics.ts` with all event types, base interfaces, `QueuedEvent`, `TransmitterConfig`, `AnalyticsEventType` union, and discriminated union `AnalyticsEvent`
    - Include `AnalyticsStoreState` interface
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

  - [x] 1.2 Add analytics event queue database migration
    - Add `runAnalyticsMigration` function in `src/data/migrations.ts` that creates the `analytics_event_queue` table with columns: `id` (TEXT PRIMARY KEY), `payload` (TEXT NOT NULL), `created_at` (TEXT NOT NULL), `status` (TEXT NOT NULL DEFAULT 'pending' with CHECK constraint)
    - Create index `idx_analytics_queue_status_created` on `(status, created_at)`
    - Call the new migration from the existing `runMigrations` function
    - _Requirements: 4.1, 4.2_

  - [x] 1.3 Create event queue repository
    - Create `src/data/analyticsEventQueue.ts` implementing: `insertEvent`, `getPendingEvents(limit)`, `markAsSending(ids)`, `markAsPending(ids)`, `deleteEvents(ids)`, `deleteAllEvents`, `deleteBehavioralPendingEvents`, `resetSendingToPending`, `getQueueSize`, `evictOldestIfFull(maxSize)`
    - Use `getDatabase()` from existing data layer for all operations
    - _Requirements: 4.1, 4.2, 4.5, 4.9, 4.11, 5.3_

- [x] 2. Implement identity and session services
  - [x] 2.1 Implement Identity Module
    - Create `src/services/analyticsIdentity.ts` with `resolveAnonymousUserId()` and `resetAnonymousUserId()`
    - Use `expo-crypto.randomUUID()` for UUID v4 generation
    - Store/retrieve from expo-secure-store under key `anonymous_user_id`
    - Handle SecureStore failures: generate new UUID, attempt one persist, use generated ID regardless
    - Handle invalid UUID format: retry once, block analytics dispatch if still invalid
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Implement Session Module
    - Create `src/services/analyticsSession.ts` with `startNewSession()`, `recordBackgroundEntry()`, `handleForegroundReturn()`
    - Session_ID is memory-only (never persisted to disk)
    - 30-minute threshold (1,800,000 ms) for session expiry on foreground return
    - Fallback to Math.random-based UUID if expo-crypto fails
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Write unit tests for Identity Module
    - Test first-launch generation, existing ID retrieval, SecureStore failure recovery, invalid UUID retry
    - Place in `src/services/__tests__/analyticsIdentity.test.ts`
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.4 Write unit tests for Session Module
    - Test cold start session creation, background/foreground transitions, 30-min timeout, crypto fallback
    - Place in `src/services/__tests__/analyticsSession.test.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

- [x] 3. Implement event logger and batch transmitter
  - [x] 3.1 Implement Event Logger
    - Create `src/services/analyticsEventLogger.ts` with `logEvent(eventType, properties?)` function
    - Validate all base fields (UUID format, ISO timestamp, enumerated event type)
    - Silently discard invalid events (no crash, no notification)
    - Respect opt-out: when opted out, only allow `app_opened` and `session_ended` with no contextual properties
    - Compute `duration_ms` for `tool_completed` (0 if no matching `tool_opened` in session)
    - Compute `session_duration_ms` for `session_ended` (0 if no `app_opened` for session)
    - Insert valid events into the event queue via the repository
    - _Requirements: 3.1, 3.2, 3.12, 3.13, 3.14, 3.15, 3.16, 4.1, 5.3, 5.4_

  - [x] 3.2 Implement Batch Transmitter
    - Create `src/services/analyticsBatchTransmitter.ts` with `startTransmitter(config)`, `stopTransmitter()`, `flushNow()`
    - Flush when queue has ≥10 pending events or every 60 seconds
    - Select up to 50 oldest pending events, mark as `sending`, POST to `{baseUrl}/events`
    - On 2xx: delete events from queue; on failure: mark back to `pending`, exponential backoff (120s → cap 15min)
    - Listen for connectivity changes; flush within 10s on reconnect
    - Respect queue max of 1000 events (evict oldest pending when full)
    - On app launch: reset any `sending` events to `pending`
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_

  - [x] 3.3 Write unit tests for Event Logger
    - Test validation (missing fields discarded), opt-out filtering, duration_ms computation, serialization round-trip
    - Place in `src/services/__tests__/analyticsEventLogger.test.ts`
    - _Requirements: 3.13, 3.14, 3.15, 3.16_

  - [x] 3.4 Write unit tests for Batch Transmitter
    - Test flush triggers, exponential backoff calculation, sending→pending recovery, queue size eviction
    - Place in `src/services/__tests__/analyticsBatchTransmitter.test.ts`
    - _Requirements: 4.5, 4.6, 4.9, 4.11_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement analytics store and user controls
  - [x] 5.1 Create Analytics Zustand Store
    - Create `src/stores/analyticsStore.ts` implementing `AnalyticsStoreState` interface
    - `initialize()`: resolve identity, start session, reset sending events, start transmitter
    - `setOptIn(value)`: persist preference, delete behavioral pending events when opting out, stop/start transmitter accordingly
    - `resetData()`: stop transmitter, delete ID from SecureStore, clear event queue, clear first_open_date, clear identity_link_consent, clear session state, generate new ID + session, log fresh `app_opened`
    - Use existing `settings` table for `analytics_opt_in` and `first_open_date` keys
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.3, 6.4, 6.7, 6.8, 9.1, 9.2, 9.3_

  - [x] 5.2 Implement retention metrics (days_since_install)
    - In the analytics store `initialize()` or event logger, compute `days_since_install` for `app_opened` events
    - Set `first_open_date` on first app_opened, never overwrite once set
    - Clamp negative values to 0 (device clock issues)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.3 Write unit tests for Analytics Store
    - Test initialization flow, opt-in/opt-out state transitions, data reset sequence, first_open_date handling
    - Place in `src/stores/__tests__/analyticsStore.test.ts`
    - _Requirements: 5.3, 5.5, 6.3, 6.4, 9.2, 9.4_

- [x] 6. Implement Settings UI for privacy controls
  - [x] 6.1 Add Privacy & Data section to Settings screen
    - Add a "Privacy & Data" section to `src/screens/SettingsScreen.tsx` with a descriptive header (≤20 words)
    - Add analytics toggle: "Help improve the app with anonymous usage data" with subtitle (≤40 words, 8th-grade reading level)
    - Toggle controls `analytics_opt_in` via `analyticsStore.setOptIn()`
    - _Requirements: 5.1, 5.2, 5.6, 8.5_

  - [x] 6.2 Add Data Reset control to Settings screen
    - Add "Reset my app data" button in a separate section from the toggle with ≥16pt vertical spacing, 44×44 min tap target
    - Show confirmation dialog explaining action is irreversible with confirm + cancel buttons
    - On confirm: call `analyticsStore.resetData()`, show success message for ≥3 seconds
    - On cancel: dismiss dialog, no action
    - Preserve current `analytics_opt_in` preference through reset
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 6.3 Add Privacy Policy screen
    - Create `src/screens/PrivacyPolicyScreen.tsx` — scrollable, readable (min 14pt), Dynamic Type support on iOS
    - Store policy as a local asset bundled with the app (not remote)
    - Include all required sections: data controller, what's collected, purpose, retention, third-party sharing, user rights, children's privacy, security, policy updates
    - Include "Last updated" date at top
    - 44×44 min tap targets for all interactive elements
    - Add navigation route to `RootStackParamList`
    - Link from Settings "Privacy & Data" section (below toggle and reset)
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8_

  - [x] 6.4 Write unit tests for Settings Privacy & Data section
    - Test toggle renders with correct default, toggle triggers opt-in/out, reset confirmation flow
    - Place in `src/screens/__tests__/SettingsScreen.analytics.test.tsx`
    - _Requirements: 5.1, 6.1, 6.2, 6.5_

- [x] 7. Implement onboarding privacy notice
  - [x] 7.1 Create Privacy Notice onboarding screen
    - Create a new onboarding screen component for the privacy notice
    - Non-blocking informational screen (not a consent gate, not a modal)
    - Plain-language text (≤60 words, 8th-grade Flesch-Kincaid reading level)
    - "Continue" button with 44×44 min tap target that advances unconditionally
    - "Learn more" link (44×44 tap target) navigating to detailed privacy explanation
    - Insert in onboarding flow after Welcome screen and before KPI Selection step
    - Skip display if user taps "Skip intro" on Welcome screen
    - Back navigation returns to Welcome screen without altering opt-in status
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7_

  - [x] 7.2 Create detailed privacy explanation screen
    - Create screen listing: event types collected, base data fields, what is NOT collected, how to opt out, how to reset
    - Include link to full Privacy Policy screen
    - Navigating back returns to privacy notice in onboarding at same position
    - _Requirements: 8.4, 10.4_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Wire analytics instrumentation and account linking
  - [x] 9.1 Initialize analytics in App.tsx
    - Call `analyticsStore.initialize()` on app mount
    - Register AppState listener for session management (background/foreground transitions)
    - Log initial `app_opened` event with `days_since_install`
    - _Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 9.1_

  - [x] 9.2 Instrument onboarding screens
    - Log `onboarding_step_viewed` with `step_name` at each onboarding screen
    - Log `onboarding_completed` when onboarding finishes
    - _Requirements: 3.3_

  - [x] 9.3 Instrument wallet and session screens
    - Log `start_mode_selected` with `mode` property
    - Log `emotion_selected` with `emotion` property
    - Log `session_started` when emotion session begins
    - Log `session_ended` with `session_duration_ms` when session ends
    - _Requirements: 3.4, 3.5, 3.11_

  - [x] 9.4 Instrument card interactions
    - Log `tool_opened` with `card_id`, `card_category`, `origin_badge` when a card is expanded/opened
    - Log `tool_completed` with `card_id`, `card_category`, `origin_badge`, `duration_ms` on completion
    - Log `tool_created` with `card_id`, `card_category`, `origin_badge: 'my_tool'` on card creation
    - _Requirements: 3.6, 3.7, 3.8, 3.14_

  - [x] 9.5 Instrument outcome and external resource events
    - Log `outcome_response` with `response` property from outcome prompt
    - Log `external_resource_opened` with `resource_url` and `resource_name`
    - _Requirements: 3.9, 3.10_

  - [x] 9.6 Implement account linking with consent
    - On first sign-in (no `identity_link_consent` in SecureStore for current ID): show consent prompt
    - Prompt: ≤80 words, optional linking, one-sentence explanation, two action buttons
    - On accept: transmit `identity_linked` event with `anonymous_user_id` + `account_id`; persist `granted` to SecureStore
    - On decline: no linking event; persist `declined` to SecureStore
    - Retry failed `identity_linked` event via standard batch mechanism
    - Still transmit `identity_linked` even if opt-out is active (identity-management, not behavioral)
    - After data reset + new sign-in: prompt again (prior consent was deleted)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 10. Implement developer tools (dev builds only)
  - [x] 10.1 Create mock analytics backend
    - Create `tools/mock-analytics-server/` with `index.js`, `package.json`, `dashboard.html`, `README.md`
    - POST `/events` endpoint: validate Batch_Payload, persist to `received_events.json`, return 200 on valid / 400 on malformed
    - GET `/events` endpoint: return all received events as JSON array
    - DELETE `/events` endpoint: clear all stored events
    - GET `/dashboard` endpoint: HTML page computing and displaying KPIs (total events, unique users, onboarding completion rate, mode split, tool completion rate, outcome positivity, retention by days_since_install buckets)
    - Configurable PORT (default 3001) and ERROR_RATE (simulates random 500s for retry testing)
    - Add `npm run mock-analytics` script to root package.json
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 10.2 Configure analytics base URL for dev/prod
    - Add configurable analytics base URL to app config
    - Default to `http://localhost:3001` when `__DEV__` is true
    - Production URL left as empty/placeholder for deferred backend decision
    - Wire into `TransmitterConfig.baseUrl` in analytics store initialization
    - _Requirements: 13.8_

  - [x] 10.3 Create Developer Event Viewer screen
    - Create `src/screens/DevEventViewerScreen.tsx` (only registered in navigation when `__DEV__`)
    - Display current Anonymous_User_ID, Session_ID, opt-in status at top
    - Display live reverse-chronological event feed (event_type, timestamp HH:mm:ss.SSS, properties)
    - Display Event_Queue status: total count + breakdown by status
    - Add "Export Queue" button: serialize queue as JSON, trigger system share sheet
    - Add "Clear Queue" button with brief confirmation prompt
    - Real-time updates via Zustand subscription and in-memory event emitter
    - Add triple-tap gesture handler on Settings screen header to navigate to viewer
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 10.4 Implement stress test generator
    - Create `src/services/analyticsStressTest.ts` with `runStressTest(config, onProgress?)`
    - Accept config: userCount (1–100, default 20), eventsPerUser (10–500, default 50), timeSpanDays (1–90, default 30)
    - Generate unique Anonymous_User_IDs per simulated user
    - Produce realistic event distribution: app_opened with varying days_since_install, onboarding events, tool events using real card_ids from curated library, outcome_response with realistic distribution (~60% positive, ~25% same, ~15% worse)
    - Insert all events into Event_Queue with status `pending`
    - Report progress via callback; return StressTestResult (totalEvents, simulatedUsers, queueSize)
    - Add "Stress Test" button to DevEventViewerScreen with config UI (sliders/inputs for the 3 params) and progress indicator
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests validate specific examples and edge cases
- The design does not include a Correctness Properties section, so property-based tests are not included
- All analytics code is non-blocking — failures are silently handled to never disrupt the user's coping tool experience
- The `settings` table already exists in the database — no migration needed for preference storage
- expo-secure-store is already a project dependency
- expo-crypto is already a project dependency
- Developer tools (tasks 10.x) are dev-build-only and should be excluded from production bundles via `__DEV__` guards

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "9.4", "9.5"] },
    { "id": 12, "tasks": ["9.6"] },
    { "id": 13, "tasks": ["10.1", "10.2"] },
    { "id": 14, "tasks": ["10.3", "10.4"] }
  ]
}
```
