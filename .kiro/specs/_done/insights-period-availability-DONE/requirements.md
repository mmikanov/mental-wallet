# Requirements Document

## Introduction

This feature disables time period options in the TimePeriodSelector that exceed the user's actual data age, and displays a "X days of tracking" label in the insights header area on both WalletInsightsScreen and ToolInsightsScreen. Periods are greyed out (visually dimmed, non-interactive) when the user has fewer days of data than the period represents. "All time" is always enabled regardless of data age.

## Glossary

- **TimePeriodSelector**: The segmented control component (`src/components/insights/TimePeriodSelector.tsx`) that renders available time period options as tappable pills.
- **Data_Age**: The number of days elapsed since the user's earliest KPI record or completion record, whichever came first.
- **Disabled_Period**: A time period option that is visually dimmed and does not respond to taps because the user's Data_Age is less than the period's day count.
- **WalletInsightsScreen**: The top-level wallet insights screen (`src/screens/WalletInsightsScreen.tsx`).
- **ToolInsightsScreen**: The per-tool insights screen (`src/screens/ToolInsightsScreen.tsx`).
- **Tracking_Label**: A text element displaying "X days of tracking" where X is the user's Data_Age.

## Requirements

### Requirement 1: Data Age Computation

**User Story:** As a user, I want the app to know how long I've been tracking, so that time periods beyond my tracking history are correctly identified.

#### Acceptance Criteria

1. WHEN the WalletInsightsScreen or ToolInsightsScreen loads, THE system SHALL compute Data_Age as the number of whole days between the current date and the earliest record date found across the `kpi_records` and `completions` tables.
2. IF no records exist in either `kpi_records` or `completions`, THEN THE system SHALL treat Data_Age as 0.
3. THE system SHALL use the earlier of the earliest `kpi_records.recorded_at` and the earliest `completions.completed_at` as the start date for Data_Age.

### Requirement 2: Disabled Periods Determination

**User Story:** As a user, I want periods that exceed my data history to be unavailable, so that I don't select a range with no meaningful data.

#### Acceptance Criteria

1. WHEN Data_Age is less than 7, THE system SHALL include "7d" in the disabled periods list.
2. WHEN Data_Age is less than 30, THE system SHALL include "30d" in the disabled periods list.
3. WHEN Data_Age is less than 90, THE system SHALL include "90d" in the disabled periods list.
4. THE system SHALL keep "All time" enabled regardless of Data_Age.
5. WHEN Data_Age is 7 or greater, THE system SHALL enable "7d" (exclude it from the disabled periods list).
6. WHEN Data_Age is 30 or greater, THE system SHALL enable "30d" (exclude it from the disabled periods list).
7. WHEN Data_Age is 90 or greater, THE system SHALL enable "90d" (exclude it from the disabled periods list).

### Requirement 3: TimePeriodSelector Disabled Visual Treatment

**User Story:** As a user, I want disabled period options to be visually dimmed, so that I can immediately tell which periods are unavailable.

#### Acceptance Criteria

1. THE TimePeriodSelector SHALL accept a `disabledPeriods` prop of type `TimePeriod[]`.
2. WHILE a period is included in `disabledPeriods`, THE TimePeriodSelector SHALL render that period's label with reduced opacity (visually dimmed).
3. WHILE a period is included in `disabledPeriods`, THE TimePeriodSelector SHALL ignore tap events on that period segment entirely.
4. WHILE a period is included in `disabledPeriods`, THE TimePeriodSelector SHALL set `accessibilityState.disabled` to `true` on that segment.
5. THE TimePeriodSelector SHALL not provide any tap feedback (no press animation, no highlight) for disabled periods.

### Requirement 4: Tracking Label on WalletInsightsScreen

**User Story:** As a user viewing wallet insights, I want to see how many days I've been tracking, so that I understand the scope of my data.

#### Acceptance Criteria

1. THE WalletInsightsScreen SHALL display the Tracking_Label below the "Insights" title in the header area.
2. THE Tracking_Label SHALL read "X days of tracking" where X is the computed Data_Age.
3. IF Data_Age is 0, THEN THE WalletInsightsScreen SHALL not display the Tracking_Label.
4. WHEN Data_Age is 1, THE Tracking_Label SHALL read "1 day of tracking" (singular form).

### Requirement 5: Tracking Label on ToolInsightsScreen

**User Story:** As a user viewing per-tool insights, I want to see how many days I've been tracking alongside the tool card title, so that I have context for the data shown.

#### Acceptance Criteria

1. THE ToolInsightsScreen SHALL display the Tracking_Label in the header subtitle area alongside the card title.
2. WHEN both card title and Tracking_Label are present, THE ToolInsightsScreen SHALL display the card title followed by " · X days of tracking" in the subtitle.
3. IF Data_Age is 0, THEN THE ToolInsightsScreen SHALL display only the card title without the tracking label portion.
4. WHEN Data_Age is 1, THE Tracking_Label SHALL use "1 day of tracking" (singular form).

### Requirement 6: Passing Disabled Periods to TimePeriodSelector

**User Story:** As a user, I want both insights screens to correctly communicate disabled periods to the selector, so that the visual state is accurate on both screens.

#### Acceptance Criteria

1. WHEN WalletInsightsScreen renders the TimePeriodSelector, THE WalletInsightsScreen SHALL pass the computed disabled periods via the `disabledPeriods` prop.
2. WHEN ToolInsightsScreen renders the TimePeriodSelector, THE ToolInsightsScreen SHALL pass the computed disabled periods via the `disabledPeriods` prop.
3. WHEN Data_Age changes (due to new records being created), THE system SHALL recompute the disabled periods on the next screen load or refresh.
