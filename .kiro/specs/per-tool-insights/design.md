# Design Document

## Overview

A screen (`ToolInsightsScreen.tsx`) accessible from the kebab menu's "View insights" option. Displays per-tool correlation insights, engagement stats, outcome trends, and a correlation disclaimer. Uses `correlationEngine` for trend computation and `durationService` for engagement data.

## Architecture

### Data Pipeline

1. `correlationEngine.computeToolOutcomeTrend(cardId, startDate, granularity)` fetches:
   - Completions for the card (from `completions` table)
   - KPI records filtered to Tool_Associated_Days (from `kpi_records` table)
   - Duration records (from `duration_records` table)
   - Outcome responses (from `outcome_responses` table)

2. Data is bucketed by day or week depending on granularity (daily for 7d or short ranges, weekly otherwise).

3. Returns a `WalletCorrelationResult` containing:
   - `weeklyAvgScore[]` — average KPI score per bucket
   - `weeklyTotalDurationMin[]` — total practice time per bucket (minutes)
   - `weeklyPositiveOutcomeRate?: (number | null)[]` — proportion of positive outcomes per bucket (0–1, null = no data)
   - `overallTrend` — positive/neutral/negative based on score direction
   - `summaryText` — human-readable trend description

### Positive Outcome Rate Calculation

For each time bucket:
- Count outcome_responses where `category` is in `['calmer', 'clear', 'hopeful']`
- Divide by total outcome_responses in that bucket
- Result is 0–1; `null` when no responses exist for the bucket

## Components and Interfaces

### Screen: ToolInsightsScreen

- Receives `cardId` as route param
- Time period selector (7d, 30d, 90d, all — availability gated by tier)
- Section order:
  1. DailyCheckInImpact — correlation insight card
  2. EngagementSection — duration stats (avg, total, sessions count)
  3. PerToolOutcomeTrendsSection — multi-line chart
  4. CorrelationDisclaimer — at bottom

### PerToolOutcomeTrendsSection

- Wrapper component rendering the DualAxisChart with section title and summary text
- Hidden when data is null or fewer than 2 buckets

### DualAxisChart

- Custom View-based line chart (no third-party library)
- Three data series rendered as dots + connecting lines:
  - Indigo (#6366F1): KPI check-in score (1–10 scale)
  - Green (#10B981): Practice time (dynamic range in minutes)
  - Amber (#F59E0B): Positive outcome rate (0–1 scale, only when data exists)
- Adaptive x-axis labels (relative week/day labels ending in "Now"/"Today")
- Y-axis labels for score (left) and duration (right)
- Legend with tappable "Felt better ⓘ" item that toggles an explainer tooltip
- Accessible description via `accessibilityLabel` on the chart wrapper

### Kebab Menu Integration

- "View insights" option on all cards' kebab menus (both "My tool" and "Library"/"Community")

## Data Models

No new tables. Queries existing `completions`, `kpi_records`, `duration_records`, and `outcome_responses` tables.

## Testing Strategy

- Unit test: DualAxisChart renders correctly with/without outcome data
- Unit test: PerToolOutcomeTrendsSection shows/hides based on data sufficiency
- Unit test: ToolInsightsScreen renders sections in correct order
- Unit test: correlationEngine.computeToolOutcomeTrend returns outcome rate data
