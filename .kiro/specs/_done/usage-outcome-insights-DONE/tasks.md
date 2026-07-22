# Implementation Plan: Usage-Outcome Insights

## Overview

This plan implements duration tracking and correlation analysis for the Mental Health Wallet. It follows a bottom-up approach: data layer first (migration + service), then computation services, then state management, then UI components, and finally integration and polish. Each task builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Data layer — duration_records table and DurationService
  - [x] 1.1 Create database migration for duration_records table
    - Add `runDurationMigration` to `src/data/migrations.ts`
    - Create table with columns: id, card_id, started_at, ended_at, active_duration_sec, end_status
    - Add indexes on card_id, started_at, and end_status
    - Call from `runMigrations()` using `CREATE TABLE IF NOT EXISTS` for idempotency
    - _Requirements: 1.7_

  - [x] 1.2 Implement DurationService with CRUD and stats
    - Create `src/services/durationService.ts` with the `DurationService` interface
    - Implement `persist()` — discard records with activeDurationSec < 3, generate UUID via expo-crypto
    - Implement `query()` — support filtering by cardId, startDate (inclusive), endDate (inclusive), endStatus
    - Implement `getStats()` — compute average, recent average (last 5 completed), and trend direction (±15% threshold)
    - Implement `getCardAverageDuration()` — average across all completed sessions for a card
    - Implement `deleteAll()` — for data reset flow
    - Export factory `createDurationService()`
    - _Requirements: 1.2, 1.6, 1.7, 2.1, 2.2, 2.3, 7.1, 7.3_

  - [x] 1.3 Write property tests for DurationService (Properties 1, 4, 5, 6)
    - **Property 1: Duration session lifecycle produces valid record**
    - **Property 4: Three-second minimum filter**
    - **Property 5: Duration query filter correctness**
    - **Property 6: Duration stats correctness**
    - Create `src/services/__tests__/durationService.property.test.ts`
    - Use fast-check generators for cardId (uuid), activeDurationSec (nat), endStatus (constantFrom)
    - **Validates: Requirements 1.1, 1.2, 1.6, 1.7, 2.1, 2.2, 2.3**

  - [x] 1.4 Write unit tests for DurationService edge cases
    - Test exact 3-second boundary (accepted), 2-second boundary (rejected)
    - Test valid record structure, empty query results
    - Test stats with exactly 3, 4, 5 records; trend thresholds at 15% boundary
    - Create `src/services/__tests__/durationService.test.ts`
    - _Requirements: 1.6, 2.1, 2.2, 2.3_

- [x] 2. Duration tracking — ActiveDurationTracker and DurationTrackingStore
  - [x] 2.1 Implement DurationTrackingStore (Zustand)
    - Create `src/stores/durationTrackingStore.ts`
    - State: isTracking, activeCardId, startTimestamp, accumulatedSec, backgroundedAt
    - Actions: startTracking(cardId), stopTracking(endStatus), handleAppBackground(), handleAppForeground()
    - `stopTracking` calls DurationService.persist() and resets state
    - Handle background timeout logic (15-minute threshold)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement ActiveDurationTracker utility
    - Create `src/utils/activeDurationTracker.ts`
    - Register/unregister AppState listener ('change' event)
    - On 'background': call store.handleAppBackground()
    - On 'active': call store.handleAppForeground() (check if > 15 min elapsed → trigger timeout)
    - Manage 15-minute setTimeout for background timeout
    - Export `createActiveDurationTracker()` factory
    - _Requirements: 1.3, 1.4_

  - [x] 2.3 Write property tests for duration tracking (Properties 2, 3)
    - **Property 2: Duration pause/resume preserves accumulated time**
    - **Property 3: Background timeout auto-ends with correct metadata**
    - Create `src/services/__tests__/durationTracking.property.test.ts`
    - Use fast-check generators for accumulatedSec and backgroundDurationSec
    - **Validates: Requirements 1.3, 1.4**

  - [x] 2.4 Write unit tests for DurationTrackingStore
    - Test start → immediate stop (< 3s discarded), start → background → kill (no record)
    - Test double-start overwrites previous session
    - Test background → foreground within 15 min (resume), background > 15 min (timeout)
    - Create `src/stores/__tests__/durationTrackingStore.test.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Checkpoint — Duration layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. TierEvaluator service
  - [x] 4.1 Implement TierEvaluator service
    - Create `src/services/tierEvaluator.ts`
    - Define `InsightTier` type and `TIER_THRESHOLDS` constants
    - Implement `evaluate()` — query kpi_records count, completions count, distinct card_id count
    - Return highest qualifying tier + progress toward next tier (checkInsNeeded, toolUsesNeeded, distinctToolsNeeded)
    - Implement `cardQualifiesForCorrelation(cardId, tier, timePeriod)` — check per-card minimum uses
    - Export `createTierEvaluator()` factory
    - _Requirements: 3.3, 3.4, 3.5_

  - [x] 4.2 Write property test for TierEvaluator (Property 7)
    - **Property 7: Tier evaluation correctness**
    - Create `src/services/__tests__/tierEvaluator.property.test.ts`
    - Generate random (checkInCount, toolUseCount, distinctToolCount) tuples
    - Verify correct tier classification for all combinations
    - **Validates: Requirements 3.3, 3.4**

  - [x] 4.3 Write unit tests for TierEvaluator boundary cases
    - Test exactly at each threshold (3/3/1, 7/5/2, 14/10/2) and one below each
    - Test zero values, negative values treated as 0
    - Create `src/services/__tests__/tierEvaluator.test.ts`
    - _Requirements: 3.3, 3.4_

- [x] 5. CorrelationEngine service
  - [x] 5.1 Implement CorrelationEngine — core Score_Delta computation
    - Create `src/services/correlationEngine.ts`
    - Implement `computeSingleToolCorrelation(cardId, timePeriod)`:
      - Fetch KPI records, completions, duration records for the time period
      - Build tool-associated day set (D and D−1 for each completion day D)
      - Partition KPI records into tool-day vs other-day
      - Apply duration weighting: weight = clamp(sessionDuration / cardAvgDuration, 0.5, 2.0)
      - Compute Score_Delta = weightedAvg(tool-day) - simpleAvg(other-day)
      - Classify direction: positive (>=+0.3), negative (<=-0.3), neutral (between)
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 5.2 Implement CorrelationEngine — Outcome_Effectiveness_Score and patterns
    - Add OES computation: count(positive outcomes) / count(all outcomes) for cards with >= 5 responses
    - Implement effectiveness pattern classification (helpful_on_hard_days, reliable_booster, comfort_tool, not_helping)
    - Implement `computeToolCorrelations(timePeriod)` — batch computation for all qualifying tools
    - _Requirements: 12.1, 12.2, 12.7_

  - [x] 5.3 Implement CorrelationEngine — wallet-level and ranking methods
    - Implement `computeWalletCorrelation(timePeriod)` — weekly averages for dual-axis chart
    - Implement `getBestTools(tier, timePeriod)` — filter, sort by Score_Delta, tiebreak by duration then title, limit by tier
    - Implement `getToolsToReconsider(timePeriod)` — filter 'not_helping' tools with >= 8 uses and >= 5 outcomes, exclude KPI card
    - Implement `detectKpiLabelChange(timePeriod)` — check settings for label history within period
    - _Requirements: 5.6, 5.8, 6.1, 6.4, 6.5, 6.6, 6.7, 13.1, 13.7, 13.8, 3.9_

  - [x] 5.4 Write property tests for CorrelationEngine (Properties 8, 9, 10, 11)
    - **Property 8: Score_Delta computation with duration weighting**
    - **Property 9: Duration weight clamping**
    - **Property 10: Correlation direction classification**
    - **Property 11: Time period date boundaries**
    - Create `src/services/__tests__/correlationEngine.property.test.ts` and `src/services/__tests__/timePeriod.property.test.ts`
    - Custom generators for KPI records, completions, duration records
    - **Validates: Requirements 3.1, 3.2, 3.7, 4.2, 4.3, 4.4, 5.9**

  - [x] 5.5 Write property tests for Best Tools and Try Something Different (Properties 13, 14)
    - **Property 13: Best Tools ranking correctness**
    - **Property 14: "Try Something Different" selection**
    - Create `src/services/__tests__/bestToolsRanking.property.test.ts`
    - Generate arrays of tool correlation results and verify filter/sort/limit rules
    - **Validates: Requirements 6.1, 6.4, 6.5, 6.6, 6.7, 6.10**

  - [x] 5.6 Write property tests for OES and effectiveness patterns (Properties 15, 16)
    - **Property 15: Outcome_Effectiveness_Score computation**
    - **Property 16: Effectiveness pattern classification**
    - Create `src/services/__tests__/outcomeEffectiveness.property.test.ts`
    - Generate outcome response arrays and Score_Delta values, verify classification
    - **Validates: Requirements 12.1, 12.2**

  - [x] 5.7 Write property test for Tools to Reconsider (Property 17)
    - **Property 17: Tools to Reconsider qualification**
    - Create `src/services/__tests__/toolsToReconsider.property.test.ts`
    - Generate tool qualification tuples and verify all 6 conditions
    - **Validates: Requirements 13.1, 13.7, 13.8**

  - [x] 5.8 Write unit tests for CorrelationEngine edge cases
    - Test: single KPI day, all days tool-associated, tool used every day, no comparison possible
    - Test: division by zero (cardAvgDuration = 0), no outcome responses, exactly at OES thresholds
    - Test: KPI label change detection, multiple changes in period
    - Create `src/services/__tests__/correlationEngine.test.ts`
    - _Requirements: 3.1, 3.2, 3.9, 12.1, 12.2_

- [x] 6. Checkpoint — Service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Engagement messaging and insight text
  - [x] 7.1 Implement engagement messaging logic
    - Create helper function(s) in `src/services/correlationEngine.ts` or a dedicated `src/utils/engagementMessaging.ts`
    - Implement tier-specific messaging: nascent (simple count), preliminary (comparison to previous week), confident (4-week rolling average)
    - _Requirements: 5.7_

  - [x] 7.2 Write property test for engagement messaging (Property 12)
    - **Property 12: Engagement messaging logic**
    - Create `src/services/__tests__/engagementMessaging.property.test.ts`
    - Generate currentWeek, prevWeek, rollingAvg values combined with tier
    - **Validates: Requirements 5.7**

  - [x] 7.3 Write property test for insight text language constraints (Property 18)
    - **Property 18: Insight text language constraints**
    - Create `src/services/__tests__/insightText.property.test.ts`
    - Generate random tool names and Score_Delta values, verify produced text against forbidden word list
    - **Validates: Requirements 8.1, 8.2**

- [x] 8. InsightsStore (Zustand)
  - [x] 8.1 Implement InsightsStore
    - Create `src/stores/insightsStore.ts`
    - State: tierProgress, isLoading, timePeriod, walletCorrelation, bestTools, toolsToReconsider, kpiLabelChange, includePreChangeData, dismissedToolIds, tierHintsDismissed, privacyNoteShown
    - Implement `loadWalletInsights()` — call TierEvaluator, CorrelationEngine methods based on tier
    - Implement `setTimePeriod(period)` — update period and trigger recomputation
    - Implement `setIncludePreChangeData(include)` — persist to settings, reload
    - Implement `dismissTool(cardId)` — add to dismissed list, persist to settings
    - Implement `dismissTierHint(tier)` — persist to settings
    - Implement `markPrivacyNoteShown()` — persist to settings
    - _Requirements: 3.4, 3.6, 3.7, 3.9, 5.1, 5.9, 7.2, 11.9, 11.10, 13.5_

  - [x] 8.2 Write unit tests for InsightsStore
    - Test: loadWalletInsights at each tier, time period switching, dismiss/keep tool flows
    - Test: KPI label change preference persistence, tier hint state
    - Create `src/stores/__tests__/insightsStore.test.ts`
    - _Requirements: 3.4, 3.6, 5.9, 13.5_

- [x] 9. Integrate duration tracking into card expand/collapse/complete flows
  - [x] 9.1 Wire DurationTrackingStore into card interaction lifecycle
    - Integrate `startTracking(cardId)` when a card enters expanded/active state (in FocusedCardView or relevant component)
    - Integrate `stopTracking('completed')` in completion flow (CompletionService or completion handler)
    - Integrate `stopTracking('collapsed')` when card collapses or user navigates away
    - Initialize ActiveDurationTracker in App.tsx (or root component) on mount, teardown on unmount
    - Ensure no visible timer is shown to users (Req 1.8)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.8_

  - [x] 9.2 Integrate duration records into "Delete All Data" flow
    - Call `durationService.deleteAll()` in the existing data reset/delete flow
    - _Requirements: 7.3_

- [x] 10. Checkpoint — State and integration layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Shared UI components
  - [x] 11.1 Implement TimePeriodSelector component
    - Create `src/components/insights/TimePeriodSelector.tsx`
    - Segmented control with options based on tier: nascent (7d, all), preliminary (7d, 30d, all), confident (7d, 30d, 90d, all)
    - Accept `availablePeriods`, `selectedPeriod`, `onPeriodChange` props
    - Ensure 44×44pt minimum tap targets
    - _Requirements: 4.6, 5.9, 9.4_

  - [x] 11.2 Implement InsightTooltip component
    - Create `src/components/insights/InsightTooltip.tsx`
    - Reusable tooltip/bottom-sheet for explainability text
    - ⓘ icon with 44×44pt tap target
    - Dismissible by tap outside or close affordance
    - Accept `explanation` prop (string content)
    - Add "Based on limited data" qualifier when `isPreliminary` prop is true
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 9.4_

  - [x] 11.3 Implement TierHintBanner component
    - Create `src/components/insights/TierHintBanner.tsx`
    - Dismissible banner/coach mark with tier-specific text
    - Show once per tier, persist dismissed state via InsightsStore
    - _Requirements: 11.9, 11.10_

  - [x] 11.4 Implement CorrelationDisclaimer component
    - Create `src/components/insights/CorrelationDisclaimer.tsx`
    - Shared disclaimer text: patterns reflect associations, not causation
    - Conditional mental health crisis disclaimer for negative correlations
    - Include "reaching for tools on tough days is healthy" framing for negative correlations
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.5 Implement DualAxisChart component
    - Create `src/components/insights/DualAxisChart.tsx`
    - Simple line chart overlay: weekly avg KPI score + weekly total active duration
    - Provide accessible text description for screen readers
    - Include text summary of trend relationship
    - _Requirements: 5.8, 9.1, 9.5_

  - [x] 11.6 Implement TierProgressCard component
    - Create `src/components/insights/TierProgressCard.tsx`
    - Progress indicator showing data needed for next tier
    - Engagement CTA with tappable link to wallet
    - _Requirements: 3.5, 5.10, 6.9_

- [x] 12. Per-tool insights extensions
  - [x] 12.1 Implement DailyCheckInImpact section component
    - Create `src/components/insights/DailyCheckInImpact.tsx`
    - Display Score_Delta in plain language with direction indicator (positive/neutral/negative)
    - Show effectiveness pattern when available (helpful_on_hard_days, reliable_booster, etc.)
    - Show hedged "Based on limited data" qualifier at Preliminary tier
    - Show encouraging empty state with "Practice now" CTA when insufficient data
    - Include InsightTooltip for Score_Delta explanation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 12.3, 12.4, 12.5, 12.6_

  - [x] 12.2 Implement EngagementSection component
    - Create `src/components/insights/EngagementSection.tsx`
    - Display average Active_Duration formatted as "Xm Ys"
    - Display duration trend indicator (more/less/consistent) with tooltip
    - Show encouraging empty state when fewer than 3 completed records
    - Ensure screen reader announces durations in full words
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 9.3_

  - [x] 12.3 Integrate new sections into existing ToolInsightsScreen
    - Add DailyCheckInImpact as section 1 (top)
    - Add EngagementSection as section 2
    - Existing UsageChart remains section 3, MoodTrend section 4
    - Add CorrelationDisclaimer at bottom
    - Add per-section TimePeriodSelector scoped to DailyCheckInImpact only
    - Show sections in fixed order — never hide, show empty states instead
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 13. Wallet-level Insights screen
  - [x] 13.1 Implement BestToolsSection component
    - Create `src/components/insights/BestToolsSection.tsx`
    - Display ranked tools with correlation descriptors (hedged at Preliminary, confident at Confident)
    - Tappable tool entries navigating to per-tool insights
    - Empty state with progress indicator and "Explore your tools" CTA at Nascent/below
    - Exclude tools with negative Score_Delta
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.8, 6.9, 9.2_

  - [x] 13.2 Implement EngagementMessage component
    - Create `src/components/insights/EngagementMessage.tsx`
    - Display tier-appropriate weekly activity message
    - _Requirements: 5.7_

  - [x] 13.3 Implement OutcomeTrendsSection component
    - Create `src/components/insights/OutcomeTrendsSection.tsx`
    - Nascent: KPI trend line + simple activity summary + "Your journey so far" framing + CTA
    - Preliminary: summary insight with hedged language + "Tools you've been using" list
    - Confident: full summary + DualAxisChart overlay
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.8_

  - [x] 13.4 Implement TrySomethingDifferent component
    - Create `src/components/insights/TrySomethingDifferent.tsx`
    - Show 1–2 unused tools (no completion in last 7 days) with tappable deep links
    - Selection: prefer highest total_uses, then most recently used, then most recently added
    - Hide entirely if all tools used within last 7 days
    - _Requirements: 6.10_

  - [x] 13.5 Implement ToolsToReconsider component
    - Create `src/components/insights/ToolsToReconsider.tsx`
    - Show up to 3 tools classified as "not_helping" with >= 8 uses and >= 5 outcomes
    - Each entry: tool name, plain-language observation, "Archive" and "Keep" buttons
    - "Archive" triggers existing archive flow, "Keep" dismisses for current period
    - Include section tooltip (ⓘ) with explanation
    - Only show at Confident tier, hide if no tools qualify
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [x] 13.6 Implement WalletInsightsScreen
    - Create `src/screens/WalletInsightsScreen.tsx`
    - Compose sections in fixed order: BestTools → EngagementMessage → OutcomeTrends → TrySomethingDifferent → ToolsToReconsider → Disclaimer → Crisis Resources link
    - Unified TimePeriodSelector at top controlling all sections
    - Display KPI label change notice when detected (include/exclude toggle)
    - Show TierHintBanner on first visit to each tier
    - Show first-visit privacy note (one-time)
    - TierProgressCard inline between last data section and first empty section
    - Loading state and pull-to-refresh
    - _Requirements: 5.1, 5.9, 5.10, 7.2, 10.4, 10.5, 10.6, 10.7, 3.9_

- [x] 14. Explainability — InsightsHelpScreen
  - [x] 14.1 Implement InsightsHelpScreen
    - Create `src/screens/InsightsHelpScreen.tsx`
    - Sections in order: What we measure, How patterns are found, How we know if a tool helps in the moment, Why some sessions count more, What the tiers mean, Tools to reconsider, Important: patterns not proof, Your data stays on your device
    - Scrollable with standard typography
    - Proper heading hierarchy for screen reader (accessibilityRole="header")
    - Back navigation to Insights screen
    - _Requirements: 11.5, 11.6, 11.7, 11.8_

- [x] 15. Navigation wiring
  - [x] 15.1 Add navigation routes and kebab menu entry
    - Add `WalletInsights` and `InsightsHelp` to `RootStackParamList` in navigation types
    - Register routes in `RootNavigator.tsx`
    - Add "Insights" item to wallet header kebab menu (⋮) navigating to WalletInsightsScreen
    - Add "How this works" link in WalletInsightsScreen header navigating to InsightsHelpScreen
    - Implement back navigation from per-tool insights → wallet insights when navigated from Best Tools
    - _Requirements: 5.1, 6.8, 11.5_

- [x] 16. Checkpoint — UI layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Accessibility pass
  - [x] 17.1 Add accessibility labels and descriptions
    - Add accessible descriptions to DualAxisChart (trend summary in text form)
    - Ensure BestToolsRanking is navigable in ranked order with tool name, rank, and descriptor announced
    - Ensure duration values announced in full words (accessibilityLabel with spelled-out format)
    - Ensure correlation descriptors announced in full words (e.g., "plus one point two")
    - Ensure all tap targets (TimePeriodSelector, tool links, toggle controls) are 44×44pt minimum
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 18. Data privacy integration
  - [x] 18.1 Implement first-visit privacy note and data deletion
    - Show one-time informational note on first insights visit: "All analysis happens on-device — no data leaves your phone"
    - Persist shown state via InsightsStore.markPrivacyNoteShown()
    - Verify duration_records included in "Delete All Data" flow (wired in 9.2)
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 19. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Archived Tool Data Handling
  - [x] 20.1 Add "Include archived tools in insights" setting
    - Add `insights_include_archived_tools` key to the settings table with default value `"false"`
    - Create or update a helper in `src/services/settingsService.ts`: `getIncludeArchivedTools(): Promise<boolean>` and `setIncludeArchivedTools(include: boolean): Promise<void>`
    - _Requirements: 14.2, 14.7_

  - [x] 20.2 Add Settings screen toggle for "Include archived tools in insights"
    - Add a toggle row in the Settings screen (within the Insights section or a new "Insights" settings group)
    - Label: "Include archived tools in insights"
    - Wire to `getIncludeArchivedTools` / `setIncludeArchivedTools`
    - Default: OFF
    - _Requirements: 14.2, 14.7_

  - [x] 20.3 Filter archived cards in CorrelationEngine queries
    - In `computeToolCorrelations`, `computeWalletCorrelation`, `getBestTools`, `getToolsToReconsider`: add a JOIN or WHERE clause that excludes completions/durations for cards where `cards.is_archived = 1`, UNLESS the include-archived setting is ON
    - Read the setting value at the start of each method (or accept it as a parameter from the caller)
    - KPI records (kpi_records) remain unfiltered regardless of setting
    - _Requirements: 14.1, 14.3, 14.8_

  - [x] 20.4 Filter archived cards in TierEvaluator
    - In `evaluate()`: when computing `toolUseCount` and `distinctToolCount`, exclude completions for archived cards (unless setting is ON)
    - `checkInCount` (kpi_records) remains unfiltered
    - _Requirements: 14.1, 14.8_

  - [x] 20.5 Filter archived cards in engagement messaging
    - In `getEngagementData()` or wherever current-week completion count is computed: exclude completions for archived cards (unless setting is ON)
    - _Requirements: 14.1_

  - [x] 20.6 Add "Archived" badge to ranked list entries
    - In `BestToolsSection` and `ToolsToReconsider`: when the setting is ON and a tool in the list has `is_archived = 1`, display an "Archived" badge next to the tool name
    - Badge style: light gray background, small font, similar to existing origin badges
    - _Requirements: 14.4_

  - [x] 20.7 Write tests for archived tool filtering
    - Unit test: CorrelationEngine excludes archived card completions when setting is OFF
    - Unit test: CorrelationEngine includes archived card completions when setting is ON
    - Unit test: TierEvaluator excludes archived card completions when setting is OFF
    - Unit test: KPI records always included regardless of setting
    - Unit test: Restored card (is_archived = 0) data is included regardless of setting
    - _Requirements: 14.1, 14.3, 14.5, 14.8_

- [x] 21. Checkpoint — Archived tool handling
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (18 total)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations follow existing project patterns (factory functions, Zustand stores, expo-sqlite)
- All correlation text must use hedging language ("tends to", "seems to") — never causal language (Req 8)
- Explainability artifacts (tooltips, help page) must stay in sync with any logic changes per workspace rules

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "4.1"] },
    { "id": 3, "tasks": ["2.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.4", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "5.5", "5.6", "5.7", "5.8", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 9, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 10, "tasks": ["12.1", "12.2"] },
    { "id": 11, "tasks": ["12.3", "13.1", "13.2", "13.3", "13.4", "13.5"] },
    { "id": 12, "tasks": ["13.6", "14.1"] },
    { "id": 13, "tasks": ["15.1"] },
    { "id": 14, "tasks": ["17.1", "18.1"] },
    { "id": 15, "tasks": ["20.1"] },
    { "id": 16, "tasks": ["20.2", "20.3", "20.4", "20.5"] },
    { "id": 17, "tasks": ["20.6", "20.7"] }
  ]
}
```
