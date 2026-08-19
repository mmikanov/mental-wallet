# Design Document

## Overview

Three changes to the analytics system supporting launch validation:

1. **Client-side**: New `share_tapped` event type wired to the existing "Share with a Friend" button
2. **Worker**: Launch KPI computations added to the `/kpis` endpoint
3. **Worker**: Phase filtering via date-range query params and milestone configuration

## Architecture

### Client-Side Event (share_tapped)

Follows the existing event pipeline: type definition → event logger validation list → log call at the interaction point.

```
User taps "Share with a Friend"
  → appActionsService.shareApp()
    → Share.share() presents native share sheet
    → logEvent('share_tapped') fires (non-blocking void call)
      → analyticsEventLogger validates, enriches, inserts into SQLite queue
        → analyticsBatchTransmitter flushes to worker on next cycle
```

No new infrastructure needed — uses the exact same path as all other events.

### Server-Side Launch KPIs

Added to `handleKpis()` in `analytics-worker/src/index.ts`. Four new SQL queries run in parallel with existing KPI queries:

| KPI | SQL Approach |
|-----|--------------|
| Activation Rate | JOIN first `app_opened` per user with `tool_completed` events within +2 days |
| Weekly Engagement | COUNT completions / DISTINCT users in last 14 days, divided by 2 weeks |
| Share Taps | Simple COUNT where event_type = 'share_tapped' |
| Wallet Growth | DISTINCT users with `tool_added` who also have `app_opened` with days_since_install > 0 |

D7/D30 retention percentages are derived from the existing retention bucket data (D7 users / D0 users * 100).

Response schema addition:
```typescript
{
  // ... existing fields
  launch: {
    activationRate: number;      // percentage
    activatedUsers: number;      // absolute
    totalUsers: number;          // denominator
    weeklyEngagement: number;    // avg completions/user/week
    activeUsers14d: number;      // users active in last 14d
    retentionD7Pct: number;      // percentage
    retentionD30Pct: number;     // percentage
    shareTaps: number;           // total count
    usersWhoAddedTools: number;  // returning users who added cards
  }
}
```

### Phase Milestone Filtering

**Configuration**: Three env vars in `wrangler.toml` under `[vars]`:
- `MILESTONE_RELEASE` — when the app goes live
- `MILESTONE_WARM_END` — when warm-only window closes
- `MILESTONE_COLD_START` — when cold acquisition begins

**API**: `/kpis` accepts optional `?from=<ISO>&to=<ISO>` params. When present, ALL SQL queries are filtered by `timestamp >= from AND timestamp < to`. The `withFilter()` helper constructs parameterized WHERE clauses to avoid SQL injection.

**Dashboard**: Phase buttons invoke `setPhase()` which maps the phase name to the appropriate from/to dates from the `/milestones` response, then refetches KPIs with those params.

**New endpoint**: `GET /milestones` returns `{ release, warmEnd, coldStart }` (null if not set). Requires auth.

## Components and Interfaces

### Modified Files

| File | Change |
|------|--------|
| `src/types/analytics.ts` | Add `share_tapped` to `AnalyticsEventType`, add `ShareTappedEvent` type, add to `AnalyticsEvent` union |
| `src/services/analyticsEventLogger.ts` | Add `share_tapped` to `VALID_EVENT_TYPES` |
| `src/services/appActionsService.ts` | Import `logEvent`, call it in `shareApp()` |
| `analytics-worker/src/index.ts` | Extend `Env` interface, add date filtering to `handleKpis`, add `/milestones` route, add user exclusion |
| `analytics-worker/src/dashboard.ts` | Add phase filter CSS/HTML/JS, add launch metrics section to render |
| `analytics-worker/wrangler.toml` | Add `[vars]` with milestone env vars and `EXCLUDED_USER_IDS` |
| `src/screens/DevEventViewerScreen.tsx` | Make User ID / Session ID full-width, tappable to copy to clipboard |

### Dashboard UI Addition

The "Launch Success Metrics" section renders as a grid of 6 cards below the existing KPI grid and above the retention table. Each card with a target shows:
- Metric name (header)
- Value (large number)
- Context detail (supporting text)
- Target reference (small text)
- Color-coded left border (green ≥ target, amber ≥ 70% of target, red < 70%)

The phase filter bar renders between the status bar and the content, with:
- "Phase:" label
- Four buttons (All Time, Pre-Release, Warm Launch, Cold Acquisition)
- Inline date display showing configured milestone dates

## Data Models

No new database tables or migrations. All computations use existing `events` table columns:
- `event_type` (the new 'share_tapped' value)
- `timestamp` (for date filtering)
- `anonymous_user_id` (for per-user aggregation)
- `properties` JSON (for `days_since_install`, `card_id`, etc.)

## Testing Strategy

### Client-side (share_tapped)
- Verify `share_tapped` is in `VALID_EVENT_TYPES` (compile-time via TypeScript)
- Verify `shareApp()` calls `logEvent('share_tapped')` after presenting share sheet
- Verify event is discarded when user has opted out

### Server-side (launch KPIs)
- Verify `/kpis` response includes `launch` object with all fields
- Verify activation rate calculation: user with tool_completed within 48h of first app_opened counts as activated
- Verify weekly engagement divides by 2 (14 days = 2 weeks)
- Verify D7/D30 retention percentages computed as (bucket / D0) * 100

### Phase filtering
- Verify `/kpis?from=X&to=Y` filters results to that window
- Verify `/milestones` returns configured dates
- Verify empty milestone vars return null (not empty string)
- Verify phase buttons disabled when corresponding dates not set

## Deployment Steps

1. Deploy analytics worker: `cd analytics-worker && wrangler deploy`
2. Ship app build (includes `share_tapped` event)
3. When app is approved and live, set milestone dates:
   - Edit `wrangler.toml` with actual dates, redeploy
   - Or use `wrangler secret put` for each milestone var
4. Copy your anonymous_user_id from the dev event viewer (tap to copy)
5. Add it to `EXCLUDED_USER_IDS` in `wrangler.toml` and redeploy
