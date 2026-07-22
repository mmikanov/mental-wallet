# Requirements Document

## Introduction

Per-Tool Outcome Trends adds a dual-axis chart to the per-tool insights panel showing weekly average Daily_Check_In_Score alongside weekly total practice time for a specific tool. This gives users a visual timeline of how their check-in scores and practice intensity for a particular tool have evolved week-over-week, answering "How has my relationship with this tool changed over time?"

The chart reuses the existing DualAxisChart component (already used on the wallet-level Insights screen for aggregate data) and is powered by a new method on the CorrelationEngine that computes per-tool weekly aggregates. It is positioned between the Engagement section and the Correlation Disclaimer, wrapped in a section card with a title and summary text. No tier-gating applies — the chart renders whenever at least 2 weeks of per-tool data exist.

Dependencies: Requires the Usage-Outcome Insights spec (duration tracking, correlation engine, tier infrastructure) and the per-tool-insights spec (ToolInsightsScreen layout) to be implemented.

## Glossary

- **App**: The Mental Health Wallet application.
- **ToolInsightsScreen**: The per-tool insights panel accessible from the focused card's kebab menu via "View insights", displaying correlation, engagement, and disclaimer sections for a specific card.
- **DualAxisChart**: An existing reusable component that renders a View-based dot-and-line overlay showing weekly average KPI score alongside weekly total active duration, with accessible descriptions and a legend.
- **OutcomeTrendsSection**: The new section card wrapper housing the per-tool DualAxisChart, its title, and summary text.
- **CorrelationEngine**: The internal computation module that calculates Tool_Outcome_Correlation values and related weekly aggregates from duration, frequency, and Daily_Check_In_Score data.
- **Per_Tool_Weekly_Data**: A computed result containing arrays of weekly average Daily_Check_In_Score values and weekly total Active_Duration (in minutes) scoped to a single tool's usage days, along with an overall trend classification and summary text.
- **Weekly_Bucket**: A Monday-through-Sunday calendar week used to group both check-in scores and duration records for chart display.
- **Tool_Associated_Day**: A calendar day D on which the tool was used, or the day immediately before use (D−1), consistent with the existing correlation logic in Requirement 3.1 of the Usage-Outcome Insights spec.
- **Daily_Bucket**: A single calendar day used to group check-in scores and duration records for chart display when viewing the 7-day time period.
- **Bucket_Granularity**: The time resolution used for grouping chart data — either "daily" (one bucket per calendar day) or "weekly" (one bucket per Monday-through-Sunday week), determined by the selected time period.

## Requirements

### Requirement 1: Per-Tool Weekly Data Computation

**User Story:** As a user, I want the app to compute weekly aggregates of my check-in scores and practice time for a specific tool, so that the data can be visualized as a trend chart on the tool's insights panel.

#### Acceptance Criteria

1. THE CorrelationEngine SHALL provide a method that accepts a card_id and computes Per_Tool_Weekly_Data by: (a) identifying all Tool_Associated_Days for that card across the full data history, (b) fetching Daily_Check_In_Score records on those days, (c) fetching completed Duration_Records for that card, and (d) grouping both into Monday-through-Sunday Weekly_Buckets.
2. THE CorrelationEngine SHALL compute the weekly average Daily_Check_In_Score for each Weekly_Bucket by averaging all Daily_Check_In_Score values recorded on Tool_Associated_Days that fall within that bucket. IF a Weekly_Bucket contains no Tool_Associated_Days with check-in scores, THE CorrelationEngine SHALL exclude that bucket from the output arrays.
3. THE CorrelationEngine SHALL compute the weekly total Active_Duration for each Weekly_Bucket by summing all completed Duration_Records for the specified card that fall within that bucket, expressed in minutes (rounded to two decimal places). IF a Weekly_Bucket has no Duration_Records for the card, THE CorrelationEngine SHALL use 0 for that bucket's duration value.
4. THE CorrelationEngine SHALL only include Weekly_Buckets where at least one Tool_Associated_Day exists with a Daily_Check_In_Score entry, ensuring chart data points always have a meaningful score axis value.
5. THE CorrelationEngine SHALL determine the overall trend from the Per_Tool_Weekly_Data by comparing the average Daily_Check_In_Score of the last 2 completed weeks against the average of all prior weeks: "positive" if the recent average exceeds the prior average by 0.3 or more, "negative" if it falls below by 0.3 or more, and "neutral" otherwise.
6. THE CorrelationEngine SHALL generate a plain-language summary text describing the trend relationship (e.g., "Your check-in scores tend to be higher in weeks where you practice this tool more" for positive, "Your scores and practice time have stayed fairly steady" for neutral, "Your check-in scores have dipped recently on weeks you use this tool" for negative).

### Requirement 2: Outcome Trends Section Display

**User Story:** As a user, I want to see a visual chart of my weekly check-in scores and practice time for a specific tool, so that I can spot trends in how this tool relates to my wellbeing over time.

#### Acceptance Criteria

1. WHEN a user opens the per-tool insights panel for a card that has Per_Tool_Weekly_Data spanning at least 2 Weekly_Buckets, THE App SHALL display the OutcomeTrendsSection containing: a section title ("Outcome Trends"), the DualAxisChart component, and a summary text below the chart.
2. THE App SHALL render the OutcomeTrendsSection between the EngagementSection and the CorrelationDisclaimer in the per-tool insights panel section order.
3. THE App SHALL pass the Per_Tool_Weekly_Data arrays (weeklyAvgScore, weeklyTotalDurationMin), the overallTrend classification, and the summaryText to the DualAxisChart component without modification to its existing props interface.
4. THE App SHALL wrap the OutcomeTrendsSection in a card container styled consistently with the EngagementSection (matching padding, background color, border radius, and border).
5. THE App SHALL display the section title "Outcome Trends" using the same typography and spacing as other section titles in the per-tool insights panel (16px, semi-bold, color #111827).
6. THE App SHALL display the summary text below the DualAxisChart using body text styling (14px, color #374151, line-height 20) to explain the observed trend in plain language.
7. IF the card has Per_Tool_Weekly_Data spanning fewer than 2 Weekly_Buckets, THEN THE App SHALL hide the OutcomeTrendsSection entirely — no empty state or placeholder is rendered.

### Requirement 3: Data Scoping and Filtering

**User Story:** As a user, I want the outcome trends chart to reflect only my usage of this specific tool, so that I get an accurate picture of how this tool relates to my check-in scores over time.

#### Acceptance Criteria

1. THE CorrelationEngine SHALL scope all Duration_Record queries for Per_Tool_Weekly_Data to the specified card_id only, excluding duration data from other cards.
2. THE CorrelationEngine SHALL scope Tool_Associated_Day identification to completions of the specified card_id only, consistent with the D and D−1 association logic defined in Requirement 3.1 of the Usage-Outcome Insights spec.
3. THE CorrelationEngine SHALL include Duration_Records with end_status of "completed" only (excluding "collapsed" and "timed_out" records) when computing weekly total Active_Duration for the chart.
4. THE CorrelationEngine SHALL accept an optional start date parameter when computing Per_Tool_Weekly_Data. WHEN a start date is provided, THE CorrelationEngine SHALL include only completions and Duration_Records on or after that date. WHEN no start date is provided, THE CorrelationEngine SHALL use the full available data history.

### Requirement 4: Accessibility

**User Story:** As a user with accessibility needs, I want the per-tool outcome trends chart to be fully accessible, so that I can understand the trend information using assistive technology.

#### Acceptance Criteria

1. THE App SHALL ensure the DualAxisChart within the OutcomeTrendsSection provides an accessible description (via accessibilityLabel on the chart wrapper) that conveys the trend information in text form, consistent with the existing DualAxisChart accessibility behavior (Requirement 9.1, 9.5 of the Usage-Outcome Insights spec).
2. THE App SHALL ensure the OutcomeTrendsSection container has an accessibilityRole of "summary" and an accessibilityLabel that includes the section title and summary text (e.g., "Outcome Trends. Your check-in scores tend to be higher in weeks where you practice this tool more.").
3. THE App SHALL ensure the summary text below the chart is readable by screen readers as a standalone text element with no truncation.

### Requirement 5: Adaptive Bucket Granularity

**User Story:** As a user viewing a 7-day period, I want the Outcome Trends chart to show daily data points rather than weekly aggregates, so that I can see meaningful day-by-day patterns within that short window.

#### Acceptance Criteria

1. WHEN the selected time period is "7d", OR WHEN the selected time period is "all" and the user's total data age is 14 days or fewer, THE CorrelationEngine SHALL group data into Daily_Buckets (one bucket per calendar day) instead of Weekly_Buckets for the Outcome Trends computation.
2. WHEN the selected time period is "30d" or "90d", OR WHEN the selected time period is "all" and the user's total data age exceeds 14 days, THE CorrelationEngine SHALL group data into Weekly_Buckets (Monday-through-Sunday) as before.
3. FOR daily granularity, THE CorrelationEngine SHALL compute each day's check-in score as the single Daily_Check_In_Score recorded on that Tool_Associated_Day (no averaging needed since there is at most one score per day). IF no score was recorded on a Tool_Associated_Day, THEN that day SHALL have a score value of 0 (indicating no data).
4. FOR daily granularity, THE CorrelationEngine SHALL compute each day's practice time as the total Active_Duration of all completed Duration_Records for the specified card on that calendar day, expressed in minutes.
5. THE DualAxisChart SHALL adapt its x-axis labels based on the bucket granularity: for daily buckets, labels SHALL show abbreviated day names or short date formats (e.g., "Mon", "Tue" or "7/14", "7/15"); for weekly buckets, labels SHALL continue to show the existing relative week format ("-3w", "-2w", "Now").
6. THE minimum bucket threshold for displaying the chart SHALL be 2 buckets regardless of granularity — for daily view this means at least 2 days with data, for weekly view at least 2 weeks.
7. THE `computeToolOutcomeTrend` method SHALL accept a `granularity` parameter (or derive it from the time period) to determine whether to produce daily or weekly buckets. THE wallet-level `computeWalletCorrelation` method SHALL also respect this granularity rule for consistency.
8. THE accessible description of the chart SHALL reflect the granularity (e.g., "over 7 days" instead of "over 1 week").
