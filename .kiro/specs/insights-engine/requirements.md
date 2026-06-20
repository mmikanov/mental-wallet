# Requirements Document

## Introduction

The insights engine generates actionable messages based on usage patterns. It surfaces weekly summaries, streak encouragements, tool effectiveness callouts, and re-engagement suggestions to keep users informed and motivated.

**Dependency:** Requires the `mood-logging` and `analytics-dashboard` specs to be implemented first.

## Requirements

### Requirement 1: Insights and Recommendations

**User Story:** As a user, I want the app to surface simple actionable insights, so that I can make informed decisions about my tool usage.

#### Acceptance Criteria

1. THE App SHALL display insights in a dedicated section accessible from the analytics dashboard.
2. THE App SHALL generate a weekly tool use summary (total tools used + total completions for past 7 days).
3. WHEN a card's streak reaches 3, 7, or 30 days, THE App SHALL generate a streak encouragement insight.
4. WHEN a card has 3+ before-and-after mood pairs, THE App SHALL generate a tool effectiveness insight showing average mood improvement.
5. WHEN a card has not been used in 10+ days and is not archived, THE App SHALL generate a re-engagement suggestion (max 3 shown at a time).
