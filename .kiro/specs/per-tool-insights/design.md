# Design Document

## Overview

A new screen (`ToolInsightsScreen.tsx`) accessible from the kebab menu's "View insights" option. Uses the MoodService for trend/effectiveness calculations and queries completions for usage chart data.

## Architecture

No new services needed beyond MoodService (from `mood-logging` spec). The screen queries existing CompletionService for usage counts and MoodService for mood analytics.

## Components and Interfaces

### Screen: ToolInsightsScreen

- Receives `cardId` as route param
- Time period selector (7d, 30d, year, all time)
- Usage chart: bar chart showing completions per day/week for selected period
- Stats row: streak, total uses, last used
- Mood section (conditional on ≥3 entries): average mood, trend indicator, mood change value
- Empty state for insufficient mood data

### Kebab Menu Integration

- Add "View insights" option to all cards' kebab menus (both "My tool" and "Library"/"Community")

## Data Models

No new tables. Queries existing `completions` and `mood_logs` tables.

## Testing Strategy

- Unit test: insights screen renders correctly with sufficient mood data
- Unit test: insights screen shows "more entries needed" with <3 mood entries
- Unit test: time period switching re-queries data correctly
