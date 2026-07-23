# Requirements Document

## Introduction

Per-tool insights provide users with detailed analytics about individual card effectiveness. Accessible from the kebab menu, the insights panel shows usage charts, correlation data, engagement stats, outcome trends, and effectiveness data to help users understand which tools help them most.

**Dependency:** Requires the `mood-logging` spec to be implemented first.

## Requirements

### Requirement 1: Per-Tool Insights

**User Story:** As a user, I want to see insights about each tool's effectiveness, so that I can understand which tools help me most.

#### Acceptance Criteria

1. WHEN a user selects "View insights" from the Kebab_Menu, THE App SHALL display a per-tool insights panel showing: a usage chart for the selected time period, current Streak, total uses, last used date, and average mood after use (if Mood_Log data exists).
2. THE App SHALL allow the user to switch between time period views (last 7 days, last 30 days, this year, all time) for usage charts and mood data.
3. WHEN a card has 3 or more Mood_Log entries for the selected time period, THE App SHALL display mood trend information (improving/declining/stable based on ±0.5 threshold) and average mood change value.
4. IF a card has fewer than 3 Mood_Log entries for the selected time period, THEN THE App SHALL display the insights panel without mood trend data and show a message indicating more entries are needed.

### Requirement 2: Outcome Trends Chart

**User Story:** As a user, I want to see how my post-use check-in responses relate to my daily check-in score and practice time, so that I can understand the impact of individual tools on my wellbeing.

#### Acceptance Criteria

1. THE App SHALL display an "Outcome Trends" section on the per-tool insights screen containing a multi-line chart with up to three data series: daily check-in score (indigo), practice time (green), and positive outcome rate (amber).
2. THE positive outcome rate line SHALL represent the proportion of post-use check-in responses for the tool that were positive (calmer, clearer, or hopeful) within each time bucket (day or week), expressed as a value between 0 and 1.
3. THE positive outcome rate line SHALL only be displayed when at least one time bucket contains outcome response data for the tool. WHEN no outcome data exists, THE App SHALL render the chart with only the check-in score and practice time lines.
4. FOR time buckets where no post-use check-in response was recorded, THE chart SHALL show a gap in the positive outcome rate line (no dot or connecting line) rather than rendering a zero value.
5. THE chart legend SHALL include a "Felt better ⓘ" entry (in amber) that, when tapped, toggles a tooltip explaining the metric. The tooltip SHALL read: "The percentage of times you reported feeling calmer, clearer, or more hopeful after using this tool. Based on your post-use check-in responses."
6. THE tooltip SHALL be dismissible by tapping the legend item again, and SHALL use warm amber styling (background #FFFBEB, border #FDE68A, text #92400E) consistent with the outcome line color.
7. THE chart SHALL support both daily and weekly granularity, matching the granularity used by the check-in score and practice time lines for the selected time period.
8. THE positive outcome rate line SHALL use the same adaptive dot sizing as the other series (smaller dots for charts with more than 12 data points).
