# Requirements Document

## Introduction

Launch analytics extends the production analytics worker and dashboard to track metrics that validate whether the app delivers real value. This includes a new client-side event for organic sharing, launch-specific KPIs on the server dashboard, and phase-based filtering to separate pre-release testing data from warm and cold cohort usage.

**Context:** The app is preparing for public launch. Success criteria are defined in `docs/launch-plan.md`: 70%+ activation within 48h, 3+ card completions/user/week, 40% D7 retention, 25% D30 retention.

## Requirements

### Requirement 1: Share Tapped Analytics Event

**User Story:** As the app operator, I want to know when users open the share sheet, so I can measure organic sharing intent as a signal of product value.

#### Acceptance Criteria

1. THE App SHALL log a `share_tapped` event when the user taps "Share with a Friend" in Settings.
2. THE `share_tapped` event SHALL conform to the existing `AnalyticsEventBase` structure (anonymous_user_id, session_id, event_type, timestamp, platform, os_version, app_version).
3. THE `share_tapped` event SHALL NOT include any additional properties (the action itself is the signal).
4. THE event SHALL be logged after the share sheet is presented (fire-and-forget, not blocking the share flow).
5. THE event SHALL respect the existing opt-out mechanism (discarded if user has opted out of analytics).

### Requirement 2: Launch Success KPIs

**User Story:** As the app operator, I want the analytics dashboard to display launch-specific success metrics with clear targets, so I can quickly assess whether the app is delivering value.

#### Acceptance Criteria

1. THE dashboard SHALL display a "Launch Success Metrics" section with the following KPIs:
   - **Activation Rate**: Percentage of users who completed at least one tool within 48 hours of their first `app_opened` event. Target: 70%.
   - **Weekly Engagement**: Average tool completions per user per week, computed over the most recent 14-day window. Target: 3+/week.
   - **D7 Retention**: Percentage of D0 users who returned within 7 days. Target: 40%.
   - **D30 Retention**: Percentage of D0 users who returned within 30 days. Target: 25%.
   - **Share Taps**: Total count of `share_tapped` events.
   - **Wallet Growth**: Count of returning users (days_since_install > 0) who have added new cards.
2. EACH metric card SHALL show a color-coded left border: green if at or above target, amber if within 70% of target, red if below 70% of target.
3. EACH metric card (for those with targets) SHALL display the target value for reference.
4. THE KPIs SHALL be computed server-side in the `/kpis` endpoint and included in the response payload under a `launch` key.

### Requirement 3: Phase Milestone Filtering

**User Story:** As the app operator, I want to filter dashboard data by launch phase (Pre-Release, Warm Launch, Cold Acquisition), so I can compare cohort behavior without time-window data being mixed together.

#### Acceptance Criteria

1. THE analytics worker SHALL accept three milestone date environment variables: `MILESTONE_RELEASE`, `MILESTONE_WARM_END`, `MILESTONE_COLD_START` (ISO 8601 format, UTC).
2. THE dashboard SHALL display a phase filter bar with buttons: "All Time", "Pre-Release", "Warm Launch", "Cold Acquisition".
3. PHASE buttons SHALL be disabled (non-clickable) when their corresponding milestone dates are not configured (empty string).
4. WHEN a phase button is clicked, THE dashboard SHALL refetch KPIs filtered to that phase's time window:
   - **Pre-Release**: All events before `MILESTONE_RELEASE`
   - **Warm Launch**: Events from `MILESTONE_RELEASE` to `MILESTONE_WARM_END` (or `MILESTONE_COLD_START` if warm_end not set)
   - **Cold Acquisition**: Events from `MILESTONE_COLD_START` onward
   - **All Time**: No date filtering (default)
5. THE `/kpis` endpoint SHALL accept optional `from` and `to` query parameters and apply them as timestamp filters to ALL queries.
6. THE dashboard SHALL display the configured milestone dates inline for reference.
7. A `GET /milestones` endpoint SHALL return the current milestone configuration (requires dashboard auth).
8. THE milestone dates SHALL be configurable via `wrangler.toml` `[vars]` section without requiring code changes.

### Requirement 4: Internal User Exclusion

**User Story:** As the app operator, I want to exclude my own device(s) from KPI calculations, so that my testing usage doesn't skew the metrics for real users.

#### Acceptance Criteria

1. THE analytics worker SHALL accept an `EXCLUDED_USER_IDS` environment variable containing a comma-separated list of anonymous_user_id values.
2. WHEN `EXCLUDED_USER_IDS` is configured, ALL KPI queries SHALL exclude events from those user IDs.
3. THE exclusion SHALL support multiple IDs (for multiple test devices).
4. THE exclusion SHALL apply to both the main KPI grid and the launch success metrics.
5. THE exclusion SHALL apply regardless of phase filter selection.
6. EVENTS from excluded users SHALL still be stored (not rejected at ingestion) — only excluded from KPI computation.

### Requirement 5: Copyable User ID in Dev Event Viewer

**User Story:** As the app operator, I want to see and copy my full anonymous_user_id from the dev event viewer, so I can add it to the exclusion list.

#### Acceptance Criteria

1. THE dev event viewer SHALL display the full anonymous_user_id without truncation.
2. THE user ID and session ID SHALL be tappable to copy to the device clipboard.
3. A confirmation alert SHALL appear when an ID is copied.
4. THE IDs SHALL be selectable text (long-press to select).
