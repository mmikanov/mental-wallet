# Requirements Document

## Introduction

Per-tool insights provide users with detailed analytics about individual card effectiveness. Accessible from the kebab menu, the insights panel shows usage charts, mood trends, and effectiveness data to help users understand which tools help them most.

**Dependency:** Requires the `mood-logging` spec to be implemented first.

## Requirements

### Requirement 1: Per-Tool Insights

**User Story:** As a user, I want to see insights about each tool's effectiveness, so that I can understand which tools help me most.

#### Acceptance Criteria

1. WHEN a user selects "View insights" from the Kebab_Menu, THE App SHALL display a per-tool insights panel showing: a usage chart for the selected time period, current Streak, total uses, last used date, and average mood after use (if Mood_Log data exists).
2. THE App SHALL allow the user to switch between time period views (last 7 days, last 30 days, this year, all time) for usage charts and mood data.
3. WHEN a card has 3 or more Mood_Log entries for the selected time period, THE App SHALL display mood trend information (improving/declining/stable based on ±0.5 threshold) and average mood change value.
4. IF a card has fewer than 3 Mood_Log entries for the selected time period, THEN THE App SHALL display the insights panel without mood trend data and show a message indicating more entries are needed.
