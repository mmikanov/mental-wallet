# Requirements Document

## Introduction

Mood logging is the foundation for the app's analytics and insights features. It captures self-reported mood values (1–10) at multiple points: before card use, after completion, and as a standalone daily check-in. This data enables mood trend calculation and tool effectiveness rankings.

## Glossary

- **Mood_Log**: A user's self-reported mood value (integer 1–10) with timestamp, context label, and optional card association.
- **TimePeriod**: A selectable analytics window: last 7 days, last 30 days, this year, or all time.
- **Tool_Effectiveness**: Average mood improvement (post-use minus pre-use) for a card with ≥3 before/after mood pairs.

## Requirements

### Requirement 1: Mood Logging and Mood Analytics

**User Story:** As a user, I want to log my mood at flexible points, so that the app can build accurate correlations between tool usage and my emotional state.

#### Acceptance Criteria

1. THE App SHALL support Mood_Log capture at multiple points: before card use, after card completion, and as a standalone daily check-in.
2. THE App SHALL provide a daily mood check-in setting (enable/disable) which, when enabled, requires at least one Mood_Log entry per day.
3. WHILE the daily mood check-in is enabled and no Mood_Log has been recorded today, WHEN the user opens the app, THE App SHALL display a mood slider prompt (1–10 with emoji anchors) before showing the Wallet.
4. WHEN a user taps the primary action button to begin using a card, THE App SHALL display a dismissable pre-use mood slider.
5. WHEN a user completes a card, THE App SHALL display a dismissable post-completion mood slider.
6. THE App SHALL store each Mood_Log with the associated card ID (if linked), timestamp, and context label (before_use, after_use, or standalone).
7. IF fewer than 3 Mood_Log entries exist for a selected time period, THEN THE App SHALL display an empty state with a message indicating more entries are needed.
8. WHEN 3 or more entries exist, THE App SHALL display a mood trend chart with selectable time periods and a trend indicator (improving/declining/stable per ±0.5 threshold).
9. THE App SHALL calculate and display tool effectiveness as "Average mood after using [Tool Name]" for cards with 3+ post-use entries, ranked by mood improvement (post-use minus pre-use average).
10. THE App SHALL use before-and-after Mood_Log pairs and standalone daily logs to display mood change values per tool and overall mood trends.
