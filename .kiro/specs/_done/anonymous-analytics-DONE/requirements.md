# Requirements Document

## Introduction

Anonymous Usage Analytics enables measurement of key product KPIs (onboarding completion, session flows, tool usage, outcomes, and referrals) without requiring users to create an account. The system uses locally-generated anonymous identifiers and privacy-first event tracking to support product decisions while respecting the trust expectations of a mental health app. Users retain full control over their participation through opt-out and data-reset controls.

## Glossary

- **Anonymous_User_ID**: A random UUID v4 generated via expo-crypto on first app launch and stored in expo-secure-store. It serves as the sole persistent identifier for analytics events and contains no personally identifiable information.
- **Session_ID**: A random UUID v4 generated via expo-crypto each time the App is opened (brought to foreground from terminated state). It groups all analytics events occurring within a single usage session.
- **Analytics_Event**: A structured record capturing a user action or system event, containing Anonymous_User_ID, Session_ID, timestamp, event_type, and contextual properties specific to the event type.
- **Event_Queue**: A local SQLite table that stores Analytics_Events before they are transmitted to the backend. Events remain in the queue until successfully acknowledged by the Analytics_Backend.
- **Analytics_Backend**: The remote server endpoint that receives batched Analytics_Events over HTTPS for aggregation and analysis. The specific hosting provider and storage technology are deferred decisions; the client treats it as a configurable base URL.
- **Analytics_Opt_In**: A boolean preference (default: true) stored locally that controls whether behavioral Analytics_Events are collected and transmitted.
- **App**: The Mental Health Wallet application.
- **Batch_Payload**: A JSON array of Analytics_Events grouped for transmission to the Analytics_Backend in a single HTTPS request.
- **Retention_Day**: A calendar day (UTC) on which the App is opened by a given Anonymous_User_ID, used to compute D1/D7/D30 return rates from app_opened events.

## Requirements

### Requirement 1: Anonymous User Identifier Generation and Storage

**User Story:** As a product team member, I want every app user to have a stable anonymous identifier from first launch, so that I can track usage patterns over time without collecting personal information.

#### Acceptance Criteria

1. WHEN the App is launched for the first time on a device (no existing Anonymous_User_ID in secure storage), THE App SHALL generate a UUID v4 via expo-crypto and persist it in expo-secure-store under the key `anonymous_user_id` before any analytics event is dispatched.
2. WHEN the App is launched and an Anonymous_User_ID already exists in expo-secure-store, THE App SHALL retrieve and use the existing Anonymous_User_ID without generating a new one.
3. THE Anonymous_User_ID SHALL be a valid UUID v4 string (8-4-4-4-12 hexadecimal format with version 4 variant bits).
4. IF reading or writing the Anonymous_User_ID from expo-secure-store fails on any launch, THEN THE App SHALL generate a new Anonymous_User_ID, attempt to persist it once, and use the generated ID for the current session regardless of whether the persistence attempt succeeds or fails. IF UUID generation produces an invalid format, THE App SHALL retry generation once; if still invalid, THE App SHALL block analytics event dispatch until a valid UUID is generated.
5. THE App SHALL NOT include the user's device ID, advertising ID, email, name, phone number, IP address, or any other direct identifier in the Anonymous_User_ID or alongside it in analytics events.
6. THE App SHALL make the Anonymous_User_ID available to the analytics service within 5 seconds of app launch; THE App SHALL NOT dispatch any analytics event until the Anonymous_User_ID is resolved.

### Requirement 2: Session Identifier Management

**User Story:** As a product analyst, I want each app session to have a unique identifier, so that I can analyze user behavior within and across sessions.

#### Acceptance Criteria

1. WHEN the App transitions from a terminated state to the foreground, THE App SHALL generate a new Session_ID (UUID v4 via expo-crypto), record the current UTC timestamp as the session start time, and associate the Session_ID with the corresponding `app_opened` event and all subsequent Analytics_Events until the session ends.
2. WHEN the App transitions to the background, THE App SHALL record the current UTC timestamp as the background entry time in memory.
3. WHEN the App returns from background to foreground and the elapsed time since the background entry timestamp is 30 minutes (1,800,000 milliseconds) or more, THE App SHALL generate a new Session_ID, record a new session start time, and log a new `app_opened` event.
4. WHEN the App returns from background to foreground and the elapsed time since the background entry timestamp is less than 30 minutes (less than 1,800,000 milliseconds), THE App SHALL continue using the existing Session_ID without generating a new one.
5. THE Session_ID SHALL be stored in memory only and SHALL NOT be persisted to disk or secure storage, regardless of whether other system components (such as crash reporting or analytics frameworks) automatically persist app state.
6. IF generating a Session_ID via expo-crypto fails, THEN THE App SHALL fall back to a pseudo-random UUID v4 generated via `Math.random` and use it for the current session, so that event logging is not blocked.

### Requirement 3: Event Schema and Logging

**User Story:** As a product team member, I want a consistent event schema covering key user actions, so that I can compute onboarding, engagement, outcome, and referral KPIs from a single data model.

#### Acceptance Criteria

1. THE App SHALL support logging the following event types and no others: `app_opened`, `onboarding_step_viewed`, `onboarding_completed`, `start_mode_selected`, `session_started`, `tool_added`, `tool_archived`, `tool_unarchived`, `tool_created`, `tool_copied`, `tool_opened`, `tool_completed`, `tool_history_viewed`, `reminder_set`, `reminder_deleted`, `outcome_response`, `external_resource_opened`, and `session_ended`.
2. WHEN an Analytics_Event is logged, THE App SHALL include the following base fields: `anonymous_user_id` (TEXT, valid UUID v4), `session_id` (TEXT, valid UUID v4), `event_type` (TEXT, one of the enumerated event types from criterion 1), and `timestamp` (TEXT, UTC ISO 8601 format `YYYY-MM-DDTHH:mm:ss.sssZ` with exactly millisecond precision).
3. WHEN an `onboarding_step_viewed` event is logged, THE App SHALL include a `step_name` property (TEXT, max 100 characters) containing the programmatic screen identifier of the onboarding screen viewed.
4. WHEN a `start_mode_selected` event is logged, THE App SHALL include a `mode` property with value `wallet_first` or `emotion_first`.
5. WHEN a `tool_added` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT) properties.
6. WHEN a `tool_archived` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT) properties.
7. WHEN a `tool_unarchived` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT) properties.
8. WHEN a `tool_created` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters — the newly created card's unique ID), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT, value `my_tool`) properties.
9. WHEN a `tool_copied` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT) properties.
10. WHEN a `tool_opened` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters — the card's source_library_id for library cards, or the card's unique ID for user-created cards), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT, one of `library`, `community`, or `my_tool`) properties.
11. WHEN a `tool_completed` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), `origin_badge` (TEXT, one of `library`, `community`, or `my_tool`), and `duration_ms` (integer, minimum 0, maximum 86,400,000 — time from the most recent `tool_opened` event with the same `card_id` in the current session to the `tool_completed` event, in milliseconds) properties.
12. WHEN a `tool_history_viewed` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters), `card_category` (TEXT, max 100 characters), and `origin_badge` (TEXT) properties.
13. WHEN a `reminder_set` event is logged, THE App SHALL include `card_id` (TEXT, max 100 characters) and `frequency` (TEXT, one of `daily`, `3x_week`, or `custom`) properties.
14. WHEN a `reminder_deleted` event is logged, THE App SHALL include a `card_id` (TEXT, max 100 characters) property.
15. WHEN an `outcome_response` event is logged, THE App SHALL include a `response` property with one of the values: `calmer`, `clearer`, `hopeful`, `same`, or `worse`.
16. WHEN an `external_resource_opened` event is logged, THE App SHALL include a `resource_url` property (TEXT, max 500 characters) containing the URL or deep-link of the external resource, and a `resource_name` property (TEXT, max 200 characters) containing the display name of the external app or online source.
17. WHEN a `session_ended` event is logged, THE App SHALL include a `session_duration_ms` property (integer, minimum 0, maximum 86,400,000 — elapsed milliseconds since the `app_opened` event that started the current Session_ID). THE App MAY additionally include the following optional properties: `emotion` (TEXT, the final emotion selected during the session), `contexts` (TEXT, comma-separated context tags selected during the session), and `time` (TEXT, the time tag selected during the session).
18. THE App SHALL NOT include free-text journal content, detailed notes, GPS coordinates, contact list data, advertising identifiers, or any content typed by the user into card controls within any Analytics_Event.
19. FOR ALL Analytics_Events, parsing the event JSON and then serializing it back to JSON SHALL produce a semantically equivalent object (identical keys, identical value types, identical values regardless of key order), ensuring no data corruption occurs in the serialization pipeline.
20. IF a `tool_completed` event is logged and no matching `tool_opened` event with the same `card_id` exists in the current session, THEN THE App SHALL log the `tool_completed` event with `duration_ms` set to 0.
21. IF a `session_ended` event is logged and no `app_opened` event exists for the current Session_ID, THEN THE App SHALL log the `session_ended` event with `session_duration_ms` set to 0.
22. WHEN an Analytics_Event is logged, THE App SHALL silently discard the event without crashing or notifying the user IF any required base field (`anonymous_user_id`, `session_id`, `event_type`, `timestamp`) is missing or invalid.
23. THE `session_started` event SHALL be logged only on the first emotion selection within a session. If the user changes their emotion within the same session, no additional `session_started` event SHALL be logged.

### Requirement 4: Local Event Storage and Batch Transmission

**User Story:** As a user with intermittent connectivity, I want analytics events to be queued locally and sent in batches, so that no data is lost when I'm offline and my battery life is preserved.

#### Acceptance Criteria

1. WHEN an Analytics_Event is logged, THE App SHALL insert it into the Event_Queue (local SQLite table) before attempting any network transmission.
2. THE Event_Queue table SHALL store each event with columns: `id` (TEXT PRIMARY KEY, UUID v4), `payload` (TEXT NOT NULL, JSON-serialized event), `created_at` (TEXT NOT NULL, UTC ISO 8601), and `status` (TEXT NOT NULL, one of `pending`, `sending`, `failed`).
3. WHEN the Event_Queue contains 10 or more pending events, THE App SHALL initiate a batch transmission to the Analytics_Backend.
4. WHEN 60 seconds have elapsed since the last batch transmission and the Event_Queue contains at least 1 pending event, THE App SHALL initiate a batch transmission regardless of queue size.
5. WHEN a batch transmission is initiated, THE App SHALL select a maximum of 50 pending events (ordered by `created_at` ascending), mark the selected events as `sending`, transmit them as a Batch_Payload via HTTPS POST, and upon receiving HTTP 2xx acknowledgment, delete the acknowledged events from the Event_Queue.
6. IF a batch transmission fails (network error or non-2xx response), THEN THE App SHALL mark the affected events back to `pending` status and retry after a minimum of 120 seconds using exponential backoff (doubling the interval on each consecutive failure, capped at 15 minutes).
7. WHEN the App detects that the device is offline (no network connectivity), THE App SHALL continue queuing events locally and SHALL NOT attempt transmission until connectivity is restored.
8. WHEN network connectivity is restored after an offline period, THE App SHALL initiate a batch transmission within 10 seconds if pending events exist in the Event_Queue.
9. THE App SHALL limit the Event_Queue to a maximum of 1000 events (including events in all statuses: `pending`, `sending`, `failed`). IF the queue reaches 1000 events and a new event is logged, THEN THE App SHALL delete the single oldest `pending` event to make room for the new one.
10. THE Batch_Payload SHALL be transmitted over HTTPS with TLS 1.2 or higher.
11. WHEN the App launches, IF any events in the Event_Queue have status `sending` (indicating a crash or force-quit during a previous transmission), THEN THE App SHALL reset those events to `pending` status before initiating any new batch transmission.

### Requirement 5: User Opt-Out Control

**User Story:** As a privacy-conscious user, I want to turn off anonymous usage data collection, so that I control what information leaves my device.

#### Acceptance Criteria

1. THE App SHALL display a "Help improve the app with anonymous usage data" toggle in the Settings screen with a subtitle of no more than 40 words, written at or below an 8th-grade reading level (Flesch-Kincaid), explaining the categories of data collected (event types and session timing) and stating that no personal identifiers are included.
2. THE Analytics_Opt_In preference SHALL default to true (opted in) on fresh installations.
3. WHEN the user sets Analytics_Opt_In to false, THE App SHALL stop logging behavioral Analytics_Events (all event types listed in Requirement 3 except `app_opened` and `session_ended`) before the next event would be logged, SHALL NOT transmit any pending behavioral events from the Event_Queue, and SHALL delete all pending behavioral events (events with event_type other than `app_opened` or `session_ended`) from the Event_Queue.
4. WHILE Analytics_Opt_In is false, THE App SHALL continue logging only `app_opened` and `session_ended` events with no contextual properties beyond the base fields defined in Requirement 3 criterion 2 (anonymous_user_id, session_id, event_type, timestamp).
5. WHEN the user sets Analytics_Opt_In back to true, THE App SHALL resume logging all behavioral Analytics_Events from that point forward and SHALL NOT retroactively transmit or recreate any events that occurred during the opted-out period.
6. WHEN Analytics_Opt_In is toggled, THE App SHALL persist the new preference value to local storage within 1 second and apply the change to event logging behavior without requiring an app restart.
7. IF persisting the Analytics_Opt_In preference to local storage fails, THEN THE App SHALL apply the new preference value in memory for the current session, retry persistence on next app launch, and display an inline error message indicating the preference may not persist across restarts.
8. THE App SHALL NOT delete previously transmitted events from the Analytics_Backend when a user opts out — the opt-out controls future collection only.

### Requirement 6: Data Reset Control

**User Story:** As a user who wants a fresh start, I want to erase all my analytics data and get a new anonymous identity, so that my past usage cannot be linked to my future usage.

#### Acceptance Criteria

1. THE App SHALL provide a "Reset my app data" control in the Settings screen, placed in a separate section from the analytics opt-out toggle with at least 16 points of vertical spacing between them, and with a minimum tap target of 44×44 points.
2. WHEN the user taps "Reset my app data", THE App SHALL display a confirmation dialog explaining that the action will delete locally stored anonymous usage data and generate a new anonymous identity, and that this action cannot be undone. The dialog SHALL present exactly two actions: a confirm button and a cancel button.
3. WHEN the user confirms the reset action, THE App SHALL perform all of the following in order: (a) cancel any in-progress batch transmission and discard acknowledgments for events in `sending` status, (b) delete the existing Anonymous_User_ID from expo-secure-store, (c) delete all records from the Event_Queue table regardless of their status, (d) delete the `first_open_date` value from local storage, (e) delete the `identity_link_consent` value from local storage, (f) clear the analytics session state from memory, and (g) generate a new Anonymous_User_ID and Session_ID immediately (as per Requirement 1 and Requirement 2) so the app is usable without a restart.
4. WHEN the reset action completes successfully, THE App SHALL set `first_open_date` to the current UTC calendar date for the new Anonymous_User_ID, and THE App SHALL log an `app_opened` event using the new Anonymous_User_ID and new Session_ID with `days_since_install` equal to 0.
5. IF the user cancels the confirmation dialog, THEN THE App SHALL dismiss the dialog, take no action, and return to the Settings screen with all data intact.
6. THE App SHALL NOT transmit any pending events from the Event_Queue after the user confirms reset. IF a batch transmission is in progress at the time of reset, THEN THE App SHALL cancel the request and discard any subsequent acknowledgment from the Analytics_Backend for that batch.
7. WHEN the user confirms the reset action, THE App SHALL preserve the current Analytics_Opt_In preference value unchanged — the reset applies to identity and event data only, not to the user's opt-in/opt-out choice.
8. IF deletion of the Anonymous_User_ID from expo-secure-store fails, THEN THE App SHALL still proceed with generating a new Anonymous_User_ID (overwriting the stored value) and complete the remaining reset steps, ensuring the user is not blocked from resetting.
9. WHEN the reset action completes, THE App SHALL display a confirmation message indicating that the reset was successful and a new anonymous identity has been generated. The message SHALL be displayed for at least 3 seconds or until the user dismisses it.

### Requirement 7: Account Linking with Consent

**User Story:** As a user who later creates an account, I want the option to link my anonymous history to my account, so that I don't lose my usage continuity while maintaining control over whether that link is made.

#### Acceptance Criteria

1. WHEN the user creates an account or signs in for the first time (no `identity_link_consent` value exists in expo-secure-store for the current Anonymous_User_ID), THE App SHALL present an explicit consent prompt before completing the sign-in flow, asking whether the user wants to link their anonymous usage history to their new account.
2. THE consent prompt SHALL contain: (a) a statement that linking is optional, (b) a one-sentence explanation that linking associates past anonymous usage data with the account for continuity, (c) a statement that declining does not affect app functionality, and (d) two distinct action buttons for accepting and declining. The prompt text SHALL NOT exceed 80 words excluding button labels.
3. WHEN the user grants consent to link, THE App SHALL transmit a single `identity_linked` event to the Analytics_Backend containing the `anonymous_user_id` (current Anonymous_User_ID) and `account_id` (the newly created or signed-in account identifier) properties in addition to the standard base fields defined in Requirement 3.
4. IF the `identity_linked` event transmission fails (network error or non-2xx response), THEN THE App SHALL enqueue the event in the Event_Queue with `pending` status for retry via the standard batch transmission mechanism (Requirement 4), and SHALL store the linking decision as `granted` immediately without waiting for transmission success.
5. WHEN the user declines the consent to link, THE App SHALL NOT transmit any linking event. Historical events associated with the Anonymous_User_ID SHALL remain usable in aggregate analytics but SHALL NOT be associated with the user's account.
6. WHEN the user makes a linking decision (accept or decline), THE App SHALL persist the value (`granted` or `declined`) to expo-secure-store under the key `identity_link_consent` immediately and SHALL NOT present the consent prompt again for the same Anonymous_User_ID.
7. WHEN the user performs a data reset (Requirement 6) and subsequently creates or signs into an account with a new Anonymous_User_ID, THE App SHALL present the consent prompt again (since the prior `identity_link_consent` value was deleted during reset).
8. IF Analytics_Opt_In is false at the time the user grants linking consent, THEN THE App SHALL still transmit the `identity_linked` event (as it is an identity-management event, not a behavioral analytics event) and enqueue it in the Event_Queue for delivery.

### Requirement 8: Privacy Transparency

**User Story:** As a user of a mental health app, I want clear information about what anonymous data is collected and how to opt out, so that I can trust the app with my wellbeing practice.

#### Acceptance Criteria

1. WHEN the user reaches the onboarding flow for the first time, THE App SHALL display a brief, plain-language notice explaining that anonymous usage data (with no personal identifiers) is collected to improve the app, and that the user can opt out at any time in Settings. The notice SHALL include a visible "Continue" action (minimum tap target 44×44 points) that advances the user to the next onboarding step without requiring any other interaction.
2. THE privacy notice SHALL be displayed as a non-blocking informational screen (not a consent gate and not a modal dialog) during onboarding, appearing after the Welcome screen and before the KPI Selection Step. The user SHALL NOT be required to acknowledge, accept, or dismiss the notice to proceed — tapping "Continue" advances onboarding unconditionally.
3. THE privacy notice text SHALL be written at or below an 8th-grade reading level (Flesch-Kincaid Grade Level) and SHALL NOT exceed 60 words, excluding the "Learn more" link text and the "Continue" button label.
4. THE App SHALL include a "Learn more" link (minimum tap target 44×44 points) in the privacy notice that navigates to a detailed privacy explanation screen listing: the event types collected (as defined in Requirement 3, criterion 1), what base data fields each event contains, that no names, emails, GPS coordinates, or free-text content are collected, how to opt out via the Settings toggle, and how to reset. WHEN the user navigates back from the detailed privacy explanation screen, THE App SHALL return the user to the privacy notice screen in the onboarding flow at the same position.
5. THE Settings screen SHALL include a "Privacy & Data" section that groups the analytics toggle (Requirement 5) and the data reset control (Requirement 6) together under a descriptive header of no more than 20 words explaining that the section controls anonymous usage data.
6. WHEN the user taps "Skip intro" on the Welcome screen (bypassing the full onboarding flow), THE App SHALL NOT display the privacy notice during that session. THE Settings "Privacy & Data" section SHALL remain accessible at all times regardless of whether the user viewed the onboarding privacy notice.
7. IF the user navigates back from the privacy notice screen, THEN THE App SHALL return the user to the Welcome screen without altering Analytics_Opt_In status at any point during the navigation sequence.

### Requirement 9: Retention Metrics Support

**User Story:** As a product analyst, I want to compute D1/D7/D30 retention rates from anonymous event data, so that I can understand whether users are coming back to the app over time.

#### Acceptance Criteria

1. WHEN an `app_opened` event is logged (as defined by the session rules in Requirement 2), THE App SHALL include a `days_since_install` property (integer, minimum value 0, representing the number of UTC calendar days elapsed since the `first_open_date` for the same Anonymous_User_ID).
2. THE App SHALL persist the date of first app open (UTC calendar date, format YYYY-MM-DD) in the local SQLite database under the key `first_open_date`. THE App SHALL set this value on the first `app_opened` event and SHALL NOT overwrite it once set.
3. IF the `first_open_date` value is missing from local storage (e.g., after a data reset or app reinstall), THEN THE App SHALL set `first_open_date` to the current UTC calendar date before logging the `app_opened` event, resetting `days_since_install` to 0.
4. IF the computed `days_since_install` value is negative (e.g., due to device clock set to a date before `first_open_date`), THEN THE App SHALL clamp the value to 0 and log the `app_opened` event with `days_since_install` set to 0.

### Requirement 10: Privacy Policy Page

**User Story:** As a user and as an app store reviewer, I want access to a formal privacy policy that clearly describes the app's data practices, so that I can understand my rights and the app meets distribution requirements.

#### Acceptance Criteria

1. THE App SHALL include a "Privacy Policy" screen accessible from the Settings screen within the "Privacy & Data" section, below the analytics toggle and data reset controls.
2. THE Privacy Policy screen SHALL display a full-length, formal privacy policy document covering at minimum: (a) data controller identity and contact information, (b) what data is collected (anonymous usage events, no PII), (c) purpose of data collection (product improvement), (d) data retention period, (e) third-party data sharing (if any), (f) user rights (opt-out, data reset, deletion), (g) children's privacy (the app is not directed at children under 13), (h) data security measures (encryption in transit and at rest), and (i) policy update notification procedure.
3. THE Privacy Policy screen SHALL be scrollable, render the policy text in a readable font size (minimum 14pt), and support Dynamic Type accessibility scaling on iOS.
4. THE App SHALL include a "Privacy Policy" link in the onboarding "Learn more" detailed privacy explanation screen, allowing users to navigate to the full policy from onboarding.
5. THE Privacy Policy content SHALL include a "Last updated" date at the top of the document.
6. THE Privacy Policy SHALL be stored as a local asset bundled with the app (not fetched from a remote URL) to ensure it is always accessible offline.
7. THE App SHALL expose the Privacy Policy URL as a linkable value in the app.json or app config so it can be referenced in App Store and Google Play store listings.
8. THE Privacy Policy screen SHALL include a minimum tap target of 44×44 points for any interactive elements (links, back navigation).

### Requirement 11: Developer Event Viewer (Dev Builds Only)

**User Story:** As a product manager or developer, I want to see analytics events being logged in real-time within the app, so that I can verify correct instrumentation without external tools.

#### Acceptance Criteria

1. THE App SHALL include a developer event viewer screen accessible only in development builds (`__DEV__ === true`). The screen SHALL NOT be accessible or bundled in production builds.
2. THE developer event viewer SHALL be accessible via a triple-tap gesture on the Settings screen header.
3. THE developer event viewer SHALL display the current Anonymous_User_ID, Session_ID, and analytics opt-in status at the top of the screen.
4. THE developer event viewer SHALL display a scrollable, reverse-chronological list of queue contents (loaded from the Event_Queue on mount), showing for each event: event_type, timestamp (formatted as HH:mm:ss.SSS), and all contextual properties.
5. THE developer event viewer SHALL display the current Event_Queue size and the count of events by status (pending, sending, failed).
6. THE developer event viewer SHALL include an "Export Queue" button that serializes all events currently in the Event_Queue as a JSON array and triggers the system share sheet, allowing the user to copy, save, or send the data.
7. THE developer event viewer SHALL update in real-time as new events are logged (without requiring a manual refresh).
8. THE developer event viewer SHALL include a "Clear Queue" button that deletes all events from the Event_Queue (for testing purposes) with a brief confirmation prompt.

### Requirement 12: Simulated Multi-User Stress Test (Dev Builds Only)

**User Story:** As a product manager, I want to simulate multiple anonymous users generating events, so that I can verify KPI calculations work correctly with realistic multi-user data volumes.

#### Acceptance Criteria

1. THE App SHALL include a stress test tool accessible from the developer event viewer screen, only in development builds (`__DEV__ === true`).
2. THE stress test tool SHALL allow the user to configure: (a) number of simulated users (1–100, default 20), (b) events per user (10–500, default 50), and (c) simulation time span in days (1–90, default 30).
3. WHEN the stress test is executed, THE App SHALL generate synthetic Analytics_Events for each simulated user, each with a unique Anonymous_User_ID, covering a realistic distribution of event types: app_opened (with varying days_since_install), onboarding events, tool_opened/completed, outcome_response, and session_ended.
4. THE synthetic events SHALL use randomized but valid properties (varied emotions, card_ids from the curated library, realistic duration_ms values, and a mix of outcome_response values) to produce meaningful KPI distributions.
5. THE stress test tool SHALL insert all generated events into the Event_Queue with status `pending`, as if they were real events awaiting transmission.
6. THE stress test tool SHALL display a progress indicator during generation and a summary upon completion showing: total events generated, simulated user count, and estimated queue size.
7. WHEN used in conjunction with the mock backend (Requirement 13), the stress test data SHALL be transmittable via the normal batch mechanism so the full pipeline can be validated end-to-end.

### Requirement 13: Mock Analytics Backend (Dev Builds Only)

**User Story:** As a product manager or developer, I want a local mock backend that receives and displays analytics batches, so that I can validate the full event pipeline end-to-end without setting up real infrastructure.

#### Acceptance Criteria

1. THE project SHALL include a standalone mock backend script (Node.js) in a `/tools/mock-analytics-server/` directory that can be started with a single npm command (e.g., `npm run mock-analytics`).
2. THE mock backend SHALL listen on a configurable port (default 3001) and accept POST requests at the `/events` endpoint matching the Batch_Payload format defined in the design document.
3. THE mock backend SHALL respond with HTTP 200 for valid payloads, HTTP 400 for malformed payloads (missing required fields), and optionally simulate failures (HTTP 500) based on a configurable error rate (default 0%, configurable via query parameter or environment variable).
4. THE mock backend SHALL persist received events to a local JSON file (`received_events.json`) appending each batch, so data accumulates across multiple transmissions.
5. THE mock backend SHALL provide a GET `/dashboard` endpoint that returns an HTML page displaying computed KPIs from all received events: (a) total events received, (b) unique anonymous users, (c) onboarding completion rate, (d) mode split (wallet_first vs emotion_first %), (e) tool completion rate per card_id, (f) outcome positivity rate, and (g) retention approximation (unique users by days_since_install buckets: D0, D1, D7, D30). Each KPI card SHALL be clickable, expanding an inline detail panel showing the underlying data (e.g., user list, step breakdowns, per-card completions). Detail panels SHALL persist across the dashboard's auto-refresh cycle until explicitly closed.
6. THE mock backend SHALL provide a GET `/events` endpoint that returns all received events as a JSON array for programmatic inspection.
7. THE mock backend SHALL provide a DELETE `/events` endpoint that clears all stored events (for test reset).
8. THE App SHALL use a configurable analytics base URL (via environment variable or app config) that defaults to `http://localhost:3001` in development builds, so the mock backend is used automatically during local development without code changes.
9. THE App SHALL provide a configurable flush interval control in the Settings → Developer section (dev builds only) with preset options (5s, 30s, 1m, 5m). The development default flush interval SHALL be 5 minutes. Changing the interval SHALL restart the transmitter immediately without requiring an app restart.
