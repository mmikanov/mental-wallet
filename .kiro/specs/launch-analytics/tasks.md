# Tasks

## Task 1: Add share_tapped event type to analytics system

- [x] Add `'share_tapped'` to `AnalyticsEventType` union in `src/types/analytics.ts`
- [x] Add `ShareTappedEvent` discriminated type (extends `AnalyticsEventBase`, no properties)
- [x] Add `ShareTappedEvent` to `AnalyticsEvent` union
- [x] Add `'share_tapped'` to `VALID_EVENT_TYPES` array in `src/services/analyticsEventLogger.ts`
- _Requirements: 1.1, 1.2, 1.3, 1.5_

## Task 2: Wire share_tapped event to Share with a Friend button

- [x] Import `logEvent` from `@/services/analyticsEventLogger` in `src/services/appActionsService.ts`
- [x] Call `void logEvent('share_tapped')` in `shareApp()` after `Share.share()` completes
- [x] Verify non-blocking: uses `void` (fire-and-forget)
- _Requirements: 1.1, 1.4_

## Task 3: Add launch KPI computations to /kpis endpoint

- [x] Add activation rate query (tool_completed within 48h of first app_opened, per user)
- [x] Add weekly engagement query (completions / users / 2 over 14-day window)
- [x] Add share taps count query
- [x] Add wallet growth query (returning users who added cards)
- [x] Compute D7/D30 retention as percentages (bucket / D0 * 100)
- [x] Include all results under `launch` key in KPI response
- _Requirements: 2.1, 2.4_

## Task 4: Add Launch Success Metrics section to dashboard HTML

- [x] Add 6-card grid section titled "Launch Success Metrics" in dashboard render function
- [x] Display activation rate, weekly engagement, D7 retention, D30 retention, share taps, wallet growth
- [x] Add color-coded left border logic (green/amber/red vs targets)
- [x] Show target reference text on each metric card
- _Requirements: 2.1, 2.2, 2.3_

## Task 5: Add phase milestone configuration

- [x] Add `MILESTONE_RELEASE`, `MILESTONE_WARM_END`, `MILESTONE_COLD_START` to `[vars]` in `wrangler.toml`
- [x] Extend `Env` interface with the three milestone string fields
- [x] Add `GET /milestones` endpoint returning configured dates (auth-protected)
- _Requirements: 3.1, 3.7, 3.8_

## Task 6: Add date-range filtering to /kpis endpoint

- [x] Accept optional `from` and `to` query params in `handleKpis`
- [x] Build parameterized WHERE clauses using `withFilter()` helper
- [x] Apply date filter to all existing KPI queries (total events, users, onboarding, modes, tools, outcomes, retention, platforms)
- [x] Apply date filter to all launch KPI queries (activation, engagement, share taps, wallet growth)
- _Requirements: 3.5_

## Task 7: Add phase filter UI to dashboard

- [x] Add CSS for `.phase-filter` bar and `.phase-btn` styles
- [x] Add phase filter HTML with 4 buttons (All Time, Pre-Release, Warm Launch, Cold Acquisition)
- [x] Fetch milestones on dashboard load via `fetchMilestones()`
- [x] Enable/disable phase buttons based on which milestones are configured
- [x] Map phase selection to from/to params via `getPhaseParams()`
- [x] Refetch KPIs with phase filter on button click
- [x] Display configured milestone dates inline
- _Requirements: 3.2, 3.3, 3.4, 3.6_

## Task 8: Internal user exclusion from KPIs

- [x] Add `EXCLUDED_USER_IDS` env var to `wrangler.toml` `[vars]`
- [x] Add `EXCLUDED_USER_IDS` to `Env` interface
- [x] Parse comma-separated IDs and add `AND anonymous_user_id NOT IN (...)` to all KPI queries via the existing `dateFilter`/`dateParams` mechanism
- _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

## Task 9: Copyable full User ID in dev event viewer

- [x] Import `expo-clipboard`
- [x] Remove `numberOfLines={1}` from User ID and Session ID text
- [x] Wrap IDs in `TouchableOpacity` that copies to clipboard on press
- [x] Show confirmation Alert on copy
- [x] Add `selectable` prop to Text for long-press selection
- [x] Adjust styles: remove `maxWidth: '65%'` constraint, add `flexShrink: 1`
- _Requirements: 5.1, 5.2, 5.3, 5.4_

## Task 10: Verify and deploy

- [ ] Run `npx tsc --noEmit` in analytics-worker (must pass)
- [ ] Verify app type-check passes without new errors
- [ ] Deploy worker: `cd analytics-worker && wrangler deploy`
- [ ] Verify dashboard loads with new launch metrics section
- [ ] Verify phase buttons are disabled (no dates configured yet)
- [ ] Set milestone dates when app goes live
- _Requirements: All_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "5"] },
    { "id": 2, "tasks": ["4", "6", "8", "9"] },
    { "id": 3, "tasks": ["7"] },
    { "id": 4, "tasks": ["10"] }
  ]
}
```
