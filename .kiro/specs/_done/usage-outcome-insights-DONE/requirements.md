# Requirements Document

## Introduction

Usage-Outcome Insights introduces two new analytical dimensions to the Mental Health Wallet: duration tracking (how long a user actively engages with a tool) and daily check-in correlation (how tool usage patterns relate to changes in the user's self-reported Personal KPI scores over time). Together, these dimensions answer a key question the existing specs do not address: "Are my tool usage habits actually improving my day-to-day wellbeing on the dimension I care about?"

Existing specs handle immediate post-use signals (mood before/after, qualitative outcome chips), per-tool usage charts, and wallet-level aggregate data. This spec bridges the gap by measuring engagement depth (duration) and connecting tool usage patterns — which tools, how often, how long — to longitudinal changes in the user's Personal KPI score (the outcome they chose during onboarding, e.g., "Feeling calmer", "Sleeping better"). It also provides a "best tools for you" ranking based on actual outcome correlation rather than usage frequency alone.

Dependencies: Requires Personal KPI (KPI card and records) and per-tool-insights (usage chart infrastructure) specs to be implemented first.

## Glossary

- **Duration_Record**: A stored measurement of the elapsed time between a user expanding/opening a card and completing or closing that card, representing active engagement time with a tool.
- **Active_Duration**: The portion of a Duration_Record during which the app remained in the foreground and the card remained expanded, excluding time when the app was backgrounded or the device was locked.
- **Daily_Check_In_Score**: The numeric value (1–10) recorded by the user via the Personal KPI card (accessed through the KPI FAB) on a given calendar day. The label reflects the user's chosen outcome focus (e.g., "Feeling calmer", "Sleeping better").
- **Score_Delta**: The difference between the average Daily_Check_In_Score in a recent period and a baseline period, used to measure improvement or decline.
- **Tool_Outcome_Correlation**: A computed metric representing the statistical relationship between usage of a specific tool (frequency and duration) and subsequent changes in Daily_Check_In_Score.
- **Best_Tools_Ranking**: An ordered list of tools ranked by their Tool_Outcome_Correlation strength, indicating which tools are most associated with improvement in the user's Personal KPI scores.
- **App_Usage_Pattern**: An aggregate view of how frequently and for how long the user engages with tools across the entire wallet over a given period.
- **Correlation_Engine**: The internal computation module that calculates Tool_Outcome_Correlation values from duration, frequency, and Daily_Check_In_Score data.
- **Insight_Tier**: One of three progressive confidence levels that determine which insights are displayed: "Nascent" (earliest data, activity summaries only), "Preliminary" (early patterns with hedged language), and "Confident" (full correlation insights). Each tier has its own data thresholds.
- **Nascent_Threshold**: The minimum data required for the Nascent tier: at least 3 Daily_Check_In_Score entries and at least 3 completed tool uses.
- **Preliminary_Threshold**: The minimum data required for the Preliminary tier: at least 7 Daily_Check_In_Score entries and at least 5 completed tool uses across at least 2 distinct tools.
- **Confident_Threshold**: The minimum data required for the Confident tier (full insights): at least 14 Daily_Check_In_Score entries and at least 10 completed tool uses across at least 2 distinct tools.
- **Engagement_CTA**: A contextual call-to-action displayed within insight screens that encourages the user to practice more tools or check in, optionally deep-linking to a specific tool or the wallet screen.
- **Insights_Card**: A UI element displayed on the insights screens that communicates a specific correlation finding or recommendation to the user.
- **Background_Timeout**: The maximum duration (default: 15 minutes) the app will wait while backgrounded before auto-ending an active card session and persisting the Duration_Record.
- **Outcome_Effectiveness_Score**: A per-tool metric combining the Outcome_Response data (from the user-facing-outcomes spec) with the Tool_Outcome_Correlation. Measures whether a tool produces positive felt shifts (calmer, clear, hopeful) versus neutral/negative outcomes (same, worse) across its uses.
- **Tools_To_Reconsider**: A list of tools that show consistent evidence of not helping — both low Outcome_Effectiveness_Score AND neutral-to-negative Tool_Outcome_Correlation — surfaced gently to help users declutter their wallet.
- **App**: The Mental Health Wallet application.

## Surface Summary

| Surface | Section (top → bottom) | What it shows | Req |
|---------|------------------------|---------------|-----|
| **Per-Tool Insights Panel** | 1. Daily Check-In Impact | Correlation between this tool's usage and KPI score changes (positive/neutral/negative framing) | 4 |
| | 2. Engagement | Average duration, duration trend (more/less/consistent) | 2 |
| | 3. Usage Chart | Existing frequency bar chart with time period selector | (per-tool-insights spec) |
| | 4. Mood Trend | Existing mood trend section | (mood-logging spec) |
| | Practice now CTA | Encouragement + link to open this card if insufficient data | 4.8 |
| **Wallet-Level Insights Screen** | 1. Best Tools for You | Ranked list of tools most correlated with KPI improvement | 6 |
| | 2. Engagement messaging | "More active this week" / "Quieter week" reinforcement | 5.7 |
| | 3. Outcome Trends | KPI score trend line, activity summary, dual-axis chart (Confident tier) | 5.2–5.6, 5.8 |
| | 4. Try something different | Suggestion of recently-unused tools with direct links | 6.10 |
| | 5. Tools to reconsider | Gently surfaced tools that aren't helping, with archive option | 13 |
| | Tier progression teaser | What unlocks at the next tier + Engagement CTAs back to wallet/tools | 5.10 |

**In short:** Per-tool answers "Is *this* tool working for me?" — Wallet-level answers "Is my *overall practice* working, and which tools should I prioritize?"

**Explainability layer:** Both screens include ⓘ tooltips on key metrics and a "How this works" help page accessible from the wallet-level header (Req 11).

## Requirements

### Requirement 1: Duration Tracking

**User Story:** As a user, I want the app to track how long I spend on each tool, so that I can understand my engagement patterns and the app can correlate engagement depth with outcomes.

#### Acceptance Criteria

1. WHEN a user expands a card into its active/expanded state, THE App SHALL begin recording Active_Duration by storing a start timestamp.
2. WHEN the user completes the card (triggers the completion event) or manually collapses the card, THE App SHALL stop recording Active_Duration and persist a Duration_Record containing: card_id, start timestamp (UTC ISO 8601), end timestamp (UTC ISO 8601), computed Active_Duration in whole seconds, and an end status indicating whether the session ended via "completed", "collapsed", or "timed_out".
3. WHILE the app is backgrounded or the device screen is locked during an active card session, THE App SHALL pause the Active_Duration timer and resume it when the app returns to the foreground within the Background_Timeout period with the same card still expanded.
4. IF the app remains backgrounded for longer than the Background_Timeout (15 minutes), THEN THE App SHALL auto-end the card session by persisting a Duration_Record with the end timestamp set to the moment the app was backgrounded, the Active_Duration accumulated up to that point, and an end status of "timed_out".
5. IF the app is terminated or crashes while a card session is active, THEN THE App SHALL discard the incomplete Duration_Record without persisting partial data. Note: on iOS, this is implicit — since Duration_Records are only persisted on explicit end events (completion, collapse, or timeout), a crash simply means no record is written.
6. IF the computed Active_Duration is less than 3 seconds, THEN THE App SHALL discard the Duration_Record as an accidental interaction and not persist it.
7. THE App SHALL store Duration_Records in the local SQLite database and support querying by card_id, by date range, and by end status (completed, collapsed, or timed_out).
8. THE App SHALL NOT display a visible timer or countdown to the user during tool engagement, to avoid creating time pressure or performance anxiety.

### Requirement 2: Duration Insights Display

**User Story:** As a user, I want to see how long I typically spend on each tool, so that I can understand my engagement habits.

#### Acceptance Criteria

1. WHEN a user opens the per-tool insights panel for a card that has 3 or more Duration_Records with completion status, THE App SHALL display the average Active_Duration for that card formatted as minutes and seconds (e.g., "Average time: 4m 32s").
2. WHEN a user opens the per-tool insights panel for a card that has 5 or more Duration_Records with completion status, THE App SHALL display a duration trend indicator: "spending more time" if the average Active_Duration of the most recent 5 completed sessions exceeds the overall average by 15% or more, "spending less time" if it is 15% or more below, or "consistent" otherwise. IF the card has fewer than 5 Duration_Records with completion status, THE App SHALL not display the trend indicator (only the average from AC 2.1 is shown).
3. IF a card has fewer than 3 Duration_Records with completion status within the selected time period, THEN THE App SHALL display a contextual empty state message:
   - IF the card has historical Duration_Records (in any time period) but none in the selected period, THE App SHALL display: "You haven't used this tool recently. Come back to it when you're ready — it'll be here."
   - IF the card has no historical Duration_Records at all, THE App SHALL display: "Use this tool a few more times to see your engagement patterns."
4. THE App SHALL display duration insights within the per-tool insights panel (accessible from the focused card's kebab menu via the existing "View insights" item) as a new "Engagement" section (see Requirement 10 for positioning).

### Requirement 3: Daily Check-In Correlation Computation

**User Story:** As a user, I want the app to analyze how my tool usage relates to my Personal KPI scores, so that I can see whether my practice habits are making a difference.

#### Acceptance Criteria

1. THE Correlation_Engine SHALL compute Tool_Outcome_Correlation for each tool by comparing the user's average Daily_Check_In_Score on days when that tool was used AND the day immediately before use (capturing the pattern of reaching for tools after harder days) against the average Daily_Check_In_Score on all other days within the selected time period. Specifically: if a tool was used on day D, days D and D−1 are counted as "tool-associated days" for that tool.
2. THE Correlation_Engine SHALL weight each tool session's contribution to Tool_Outcome_Correlation by its Active_Duration relative to the card's average Active_Duration, using a proportional ratio: weight = session_duration / card_average_duration (clamped to a minimum of 0.5 and maximum of 2.0). Sessions without duration data (e.g., recorded before duration tracking existed) SHALL use a weight of 1.0. This formula is explainable to users as: "Sessions where you spent more time count a bit more toward your pattern — the idea is that deeper engagement matters more than a quick tap."
3. THE Correlation_Engine SHALL use three progressive Insight_Tiers to determine which insights are available, each gated by its own data threshold:
   - **Nascent** (Nascent_Threshold): at least 3 Daily_Check_In_Score entries AND at least 3 completed tool uses. Enables: check-in score trend line, tool usage activity summary, and duration stats per tool.
   - **Preliminary** (Preliminary_Threshold): at least 7 Daily_Check_In_Score entries AND at least 5 completed tool uses across at least 2 distinct tools. Enables: early correlation patterns with hedged language (e.g., "Early pattern — still gathering data") and a preliminary Best Tools ranking.
   - **Confident** (Confident_Threshold): at least 14 Daily_Check_In_Score entries AND at least 10 completed tool uses across at least 2 distinct tools. Enables: full correlation insights, the dual-axis chart, and the final Best Tools ranking without hedging.
4. THE Correlation_Engine SHALL evaluate the user's current Insight_Tier each time an insights screen is opened and display the highest tier the user qualifies for.
5. IF the user does not yet meet the Nascent_Threshold, THEN THE App SHALL display a warm onboarding message with a progress indicator showing how many check-ins and tool uses remain (e.g., "Check in 2 more days and use 1 more tool to start seeing your patterns") and an Engagement_CTA linking to the wallet.
6. THE Correlation_Engine SHALL recompute Tool_Outcome_Correlation values each time the user opens an insights screen that displays correlation data, using the most recent available data.
7. THE Correlation_Engine SHALL compute correlation for the following time periods: last 7 days (Nascent/Preliminary tiers only), last 30 days, last 90 days, and all time. The default view SHALL be the shortest period for which the user meets at least the Nascent_Threshold.
8. WHEN displaying Preliminary-tier correlation insights, THE App SHALL append a qualifier such as "Early pattern" or "Based on limited data" to indicate lower confidence, and SHALL NOT present these with the same visual weight as Confident-tier insights.
9. IF the user has changed their Personal KPI label during the selected time period, THE Correlation_Engine SHALL detect the change and THE App SHALL display a notice on any insights screen that uses data spanning the change (e.g., "You changed your focus from 'Sleeping better' to 'Feeling calmer' on [date]. Your earlier scores are included."). THE App SHALL offer the user a choice to either include all historical data (treating all scores as equivalent on the 1–10 scale regardless of label) or use only data recorded since the most recent KPI change. The user's choice SHALL persist across sessions until changed.

### Requirement 4: Tool-Level Outcome Correlation Display

**User Story:** As a user, I want to see whether a specific tool correlates with improvement in my Personal KPI scores, so that I can make informed decisions about which tools to keep using.

#### Acceptance Criteria

1. WHEN a user opens the per-tool insights panel for a card that has Tool_Outcome_Correlation data available, THE App SHALL display an Insights_Card in a "Daily Check-In Impact" section showing the computed correlation in plain language (e.g., "On days you use this tool, your check-in tends to be about 0.8 points higher"). Display requires BOTH: the user's global Insight_Tier is at Preliminary or Confident, AND this specific card has at least 3 completed uses (Preliminary) or 5 completed uses (Confident) within the selected time period.
2. WHEN the Tool_Outcome_Correlation for a card indicates a positive relationship (Score_Delta of +0.3 or more), THE App SHALL display the insight with an upward trend indicator and supportive language (e.g., "This tool seems to be a good fit for you").
3. WHEN the Tool_Outcome_Correlation for a card indicates a neutral relationship (Score_Delta between -0.3 and +0.3), THE App SHALL display the insight with neutral framing (e.g., "Your check-in scores are similar whether or not you use this tool — it may help in ways not captured by a number").
4. WHEN the Tool_Outcome_Correlation for a card indicates a negative relationship (Score_Delta of -0.3 or less), THE App SHALL display the insight with gentle, non-judgmental framing (e.g., "Your check-in tends to be a bit lower on days you use this — this might mean you reach for it on harder days, which is okay").
5. THE App SHALL display the "Daily Check-In Impact" section within the per-tool insights panel (accessible from the focused card's kebab menu). See Requirement 10 for positioning.
6. THE App SHALL allow the user to switch between time periods (7 days, 30 days, 90 days, all time) for the correlation display, consistent with the Correlation_Engine computation periods and the user's current Insight_Tier.
7. WHEN the user is at the Preliminary tier, THE App SHALL display correlation data for this card with a "Based on limited data" qualifier and lighter visual treatment compared to Confident-tier presentation.
8. WHEN the user's global Insight_Tier is below Preliminary, OR the specific card has fewer than 3 completed uses within the selected time period, THE App SHALL display an encouraging message (e.g., "Use this tool a few more times and we'll show how it relates to your check-in scores") with a tappable "Practice now" Engagement_CTA that opens this card in focused view.

### Requirement 5: App-Level Outcome Correlation

**User Story:** As a user, I want to see how my overall tool usage habits relate to changes in my Personal KPI scores, so that I can understand whether using the app is helping me on the dimension I care about.

#### Acceptance Criteria

1. THE App SHALL provide an "Outcome Trends" screen accessible from the wallet header kebab menu (⋮) via an "Insights" menu item, that displays app-level insights progressively based on the user's current Insight_Tier. The visual section order is: Best Tools (Req 6) → Engagement messaging → Outcome Trends → Try Something Different (see Surface Summary and wireframes for layout).
2. **Nascent tier (3+ check-ins, 3+ tool uses):** THE App SHALL display a Personal KPI score trend line (even if only 3–6 data points), a simple activity summary (total tools used this period, total practice sessions), and a "Your journey so far" framing that celebrates early engagement.
3. **Nascent tier:** THE App SHALL display an Engagement_CTA beneath the trend line encouraging continued use (e.g., "Keep it up — a few more days and we'll start spotting patterns for you") with a tappable link to return to the wallet.
4. **Preliminary tier (7+ check-ins, 5+ tool uses across 2+ tools):** THE App SHALL display a summary insight showing the relationship between tool usage frequency and Daily_Check_In_Score trend, formatted with hedged language (e.g., "Early signs: days you practice tend to have slightly higher check-in scores"). This section SHALL be visually distinguished as preliminary (e.g., lighter styling or an "Early pattern" label).
5. **Preliminary tier:** THE App SHALL display a "Tools you've been using" section listing the user's most-used tools with tap targets that navigate directly to each tool's focused view in the wallet, encouraging continued practice.
6. **Confident tier (14+ check-ins, 10+ tool uses across 2+ tools):** THE App SHALL display the full summary insight showing the relationship between total weekly tool usage (frequency and cumulative Active_Duration) and the user's average weekly Daily_Check_In_Score trend, formatted as a confident plain-language observation (e.g., "Weeks where you practiced more tended to have higher check-in scores").
7. **All tiers — Engagement Messaging:** THE App SHALL display an engagement message in the Engagement Messaging slot (see Req 10) appropriate to the user's current tier:
   - **Nascent tier:** A simple activity count for the current week (e.g., "You've practiced 4 times this week") with a supportive tone.
   - **Preliminary tier:** A comparison to the user's own recent average (e.g., "You've used your tools 6 times this week — that's more than last week") or, if activity is equal or lower, a neutral observation (e.g., "3 sessions this week so far — every bit counts").
   - **Confident tier:** The full rolling-average comparison as defined in AC 5.7 and 5.8 (positive reinforcement when above 4-week average, gentle observation when 30%+ below).
8. **Confident tier:** THE App SHALL display a simple line chart overlay showing weekly average Daily_Check_In_Score alongside weekly total Active_Duration (dual-axis), for the selected time period (30 days, 90 days, all time).
9. THE App SHALL allow the user to switch between available time periods. At the Nascent tier, only "Last 7 days" and "All time" SHALL be available. At Preliminary, "Last 7 days", "Last 30 days", and "All time". At Confident, all periods (7 days, 30 days, 90 days, all time).
10. EACH Insight_Tier's display SHALL include a brief note indicating what unlocks at the next tier (e.g., at Nascent: "Check in a few more times to unlock early patterns"; at Preliminary: "A couple more weeks of data will unlock full insights and your Best Tools ranking").

### Requirement 6: Best Tools for You Ranking

**User Story:** As a user, I want to see which tools are most associated with improvement in my daily outcomes, so that I can prioritize the tools that work best for me.

#### Acceptance Criteria

1. THE App SHALL display a "Best Tools for You" section on the app-level Insights screen (accessible from the wallet header kebab menu) that ranks tools by their Tool_Outcome_Correlation strength (highest positive Score_Delta first).
2. **Preliminary tier:** THE App SHALL display a preliminary ranking (up to 3 tools) with an "Early pattern" badge, using hedged labels (e.g., "Might be linked to higher check-in days — keep using to confirm"). Each tool entry SHALL be tappable to navigate to the tool's focused view in the wallet for immediate practice.
3. **Confident tier:** THE App SHALL display up to 5 tools in the Best_Tools_Ranking, each showing: the tool name, the correlation direction (positive, neutral), and a confident descriptive label (e.g., "Linked to +1.2 higher check-in days").
4. THE App SHALL exclude tools with negative Tool_Outcome_Correlation from the Best_Tools_Ranking display.
5. **Preliminary tier:** THE App SHALL exclude tools with fewer than 3 completed uses within the selected time period from the preliminary ranking.
6. **Confident tier:** THE App SHALL exclude tools with fewer than 5 completed uses within the selected time period from the Best_Tools_Ranking.
7. IF two or more tools share the same Score_Delta value (rounded to one decimal place), THEN THE App SHALL break ties by average Active_Duration descending (tools the user spends more time on ranked higher), then by tool title alphabetically ascending.
8. WHEN the user taps a tool in the Best_Tools_Ranking (Confident tier), THE App SHALL navigate to that tool's per-tool insights panel showing the full correlation and duration data. THE per-tool insights panel SHALL provide a back navigation affordance that returns the user to the app-level Insights screen.
9. **Nascent tier and below:** THE App SHALL display a "Building your ranking" empty state with a progress indicator (e.g., "Use 2 more tools to start seeing which ones help most") and an Engagement_CTA with a tappable "Explore your tools" link that navigates to the wallet.
10. IF the user has tools in their wallet that they have not used recently (no completion in the last 7 days), THE App SHALL display a "Try something different" suggestion below the ranking with 1–2 unused tool names as tappable links that navigate directly to each tool's focused view in the wallet. Selection logic: prefer tools with the highest historical total_uses (most familiar but neglected); if all unused tools have equal total_uses (or zero), prefer by recency — most recently used first, then most recently added. IF all tools in the wallet have been used within the last 7 days, THE App SHALL hide this section entirely.
11. THE App SHALL allow the user to switch between time periods (7 days, 30 days, 90 days, all time) for the Best_Tools_Ranking, consistent with the available periods for the user's current Insight_Tier.

### Requirement 7: Data Privacy and Transparency

**User Story:** As a user, I want to understand how my data is used and have control over it, so that I feel safe and informed.

#### Acceptance Criteria

1. THE App SHALL store all Duration_Records and Tool_Outcome_Correlation computations exclusively in the local SQLite database on the user's device, with no transmission to external servers.
2. THE App SHALL display a brief informational note on the first insights screen visit that includes duration or correlation data, explaining in one sentence that all analysis happens on-device and no data leaves the phone.
3. THE App SHALL include Duration_Records in the existing "Delete All Data" app reset flow, removing them alongside other user data.

### Requirement 8: Correlation Disclaimers

**User Story:** As a user, I want to understand that correlation insights are patterns rather than proven causes, so that I do not over-interpret the data.

#### Acceptance Criteria

1. THE App SHALL display a disclaimer on every screen that shows Tool_Outcome_Correlation data, stating that patterns reflect associations and do not prove that a tool caused improvement or decline.
2. THE App SHALL use language such as "tends to", "seems to", "associated with", and "linked to" in all correlation insight text, and SHALL NOT use causal language such as "caused", "resulted in", "made you feel", "fixed", or "improved your score".
3. THE App SHALL display the mental health disclaimer (as required by existing app standards) inline immediately following any Tool_Outcome_Correlation insight that shows a negative relationship (Score_Delta of -0.3 or less), reinforcing the "reaching for tools on tough days" message from AC 8.4. The disclaimer SHALL NOT appear at the top of sections that show only positive or neutral correlations.
4. WHEN a Tool_Outcome_Correlation shows a negative relationship, THE App SHALL explicitly note that using a tool on harder days is a healthy coping strategy and does not mean the tool is unhelpful, using language such as "reaching for tools on tough days is a sign of good self-care".

### Requirement 9: Accessibility

**User Story:** As a user with accessibility needs, I want all duration and correlation insights to be fully accessible, so that I can benefit from this feature using assistive technology.

#### Acceptance Criteria

1. THE App SHALL ensure all chart elements (line charts, dual-axis overlays) provide accessible descriptions that convey the trend information in text form (e.g., "Line chart showing weekly check-in score trending upward over 4 weeks alongside increasing practice time").
2. THE App SHALL ensure the Best_Tools_Ranking list is navigable via screen reader in ranked order, with each item announcing the tool name, rank position, and correlation descriptor.
3. THE App SHALL ensure all duration values and correlation descriptors are announced in full words by screen readers (e.g., "four minutes thirty-two seconds" not "4m 32s", "linked to one point two higher check-in days" not "+1.2").
4. THE App SHALL ensure all interactive elements within the Outcome Trends and Best Tools for You sections (time period selectors, tool tap targets, toggle controls) meet a minimum tap target size of 44x44 points.
5. THE App SHALL ensure the dual-axis chart provides a text summary accessible via screen reader that describes the general trend relationship without requiring the user to interpret visual axes.

### Requirement 10: Section Ordering and Layout Logic

**User Story:** As a user, I want the most actionable insights presented first so that I immediately know what to do, with supporting detail available below for when I want to dig deeper.

#### Design Principle

Insight screens are ordered by **actionability**: content that tells the user what to do or confirms what's working appears first; explanatory charts and historical data appear lower for users who want depth. This mirrors how users approach the screen: "What should I do?" before "What happened?"

#### Acceptance Criteria — Per-Tool Insights Panel

1. THE App SHALL render per-tool insights sections in the following fixed order from top to bottom:
   1. **Daily Check-In Impact** (Req 4) — the correlation insight answering "Is this tool working for me?"
   2. **Engagement** (Req 2) — duration stats providing supporting context on practice depth
   3. **Usage Chart** (per-tool-insights spec) — frequency history for reference
   4. **Mood Trend** (mood-logging spec) — supplementary post-use mood data
   5. **Disclaimer** (Req 8) — positioned at the bottom, below all data sections
2. IF the user does not yet qualify for a section's data (e.g., Nascent tier for Daily Check-In Impact), THEN THE App SHALL display that section's encouraging empty state with Engagement_CTA in the same position — the section is never hidden, only its content changes.
3. THE time period selector for Daily Check-In Impact SHALL be scoped to that section only and SHALL NOT affect the Usage Chart or Mood Trend time periods (each section manages its own selector independently).

#### Acceptance Criteria — Wallet-Level Insights Screen

4. THE App SHALL render wallet-level insights sections in the following fixed order from top to bottom:
   1. **Best Tools for You** (Req 6) — the most actionable section: which tools to prioritize
   2. **Engagement Messaging** (Req 5.7) — positive reinforcement about this week's activity
   3. **Outcome Trends** (Req 5.2–5.6, 5.8) — KPI trend line, activity summary, and dual-axis chart
   4. **Try Something Different** (Req 6.10) — suggestion of unused tools with deep links. This is the one section that may be hidden entirely if all tools were used in the last 7 days.
   5. **Tools to Reconsider** (Req 13) — gently surfaced tools that aren't helping, with archive option. Hidden if no tools qualify.
   6. **Disclaimer** (Req 8) — positioned at the bottom, below all data sections
   7. **Crisis Resources link** — always last
5. IF the user is at a tier where a section is not yet available (e.g., Best Tools not available at Nascent), THEN THE App SHALL display that section's tier-appropriate empty state (progress indicator + Engagement_CTA) in the same position — sections are never reordered or hidden based on tier.
6. THE tier progression teaser (Req 5.10) SHALL appear inline beneath the lowest section that has real data, directly above the first empty-state section, so the user understands what comes next without scrolling past empty placeholders.
7. WHEN multiple sections share a time period selector, THE App SHALL use a single unified selector at the top of the screen (below the header) that controls all sections simultaneously. Individual sections SHALL NOT have their own period selectors on this screen.

### Requirement 11: Explainability and Help

**User Story:** As a user, I want to understand how my insights are calculated and what the numbers mean, so that I can trust the information and make informed decisions about my practice.

#### Design Principle

Users should never see a metric they can't understand. Every insight element should be self-explanatory through its label and framing, with deeper explanation available on demand via tooltips (inline) and a dedicated help page (comprehensive). The tone is conversational, not technical — "here's what we looked at" not "the algorithm computes a weighted mean."

#### Acceptance Criteria — Inline Tooltips

1. THE App SHALL display a small help icon (ⓘ, minimum 44×44pt tap target) next to each of the following insight elements: the Score_Delta value in Daily Check-In Impact, the duration trend indicator in the Engagement section, and the correlation descriptor in Best Tools for You entries.
2. WHEN the user taps a help icon, THE App SHALL display a tooltip overlay (or bottom sheet on small screens) containing a 1–2 sentence plain-language explanation of how that specific value is calculated. The tooltip SHALL be dismissible by tapping outside it or tapping a close affordance.
3. THE following explanations SHALL be used (or equivalently simple phrasing):
   - **Score_Delta**: "We compare your check-in scores on days you used this tool (and the day before) to days you didn't. The difference is shown here."
   - **Duration trend**: "We compare your last 5 sessions to your overall average. If you're spending 15% more or less time, we note the trend."
   - **Best Tools correlation**: "Tools are ranked by how much higher your check-in scores tend to be on days you use them. Longer sessions count a bit more."
   - **Duration weighting**: "Sessions where you spent more time count a bit more toward your pattern — deeper engagement matters more than a quick tap."
   - **Effectiveness pattern**: "We combine two signals: how your daily check-in relates to using this tool, and how you usually feel right after using it. Together, they tell us whether this tool is helping."
   - **Tools to reconsider**: "We look at two things: whether your check-in scores tend to be different on days you use a tool, and whether you usually feel better right after using it. Tools here scored low on both."
4. WHEN the user is at the Preliminary tier, tooltips SHALL include an additional note: "This is based on limited data — the pattern may shift as you keep using your tools."

#### Acceptance Criteria — Help Page

5. THE App SHALL provide a "How this works" link accessible from the wallet-level Insights screen header (next to the time period selector or in the screen's kebab menu). Tapping it SHALL navigate to a dedicated help page.
6. THE help page SHALL contain the following sections in order:
   1. **What we measure** — brief explanation of check-in scores, tool usage tracking (frequency + duration), and post-use outcome responses
   2. **How patterns are found** — plain-language description of the correlation method: "We look at your check-in scores on days you used each tool (and the day before) and compare them to days you didn't. This helps spot which tools are linked to better days."
   3. **How we know if a tool helps in the moment** — explanation of outcome integration: "After you use a tool, we sometimes ask how you feel. Over time, this tells us whether a tool usually helps you feel better right away — even on hard days."
   4. **Why some sessions count more** — explanation of duration weighting: "When you spend more time with a tool, that session counts a bit more. The idea is that a focused 5-minute session matters more than an accidental 10-second tap."
   5. **What the tiers mean** — explanation of Nascent/Preliminary/Confident with the specific thresholds and what each unlocks
   6. **Tools to reconsider** — explanation: "If a tool isn't linked to better check-in days AND you usually don't feel different after using it, we'll gently suggest you might want to try something else. You can always keep it if you want to."
   7. **Important: patterns, not proof** — reiteration that correlation is not causation, in accessible language: "These patterns show what tends to happen together — they don't prove that one thing caused another. Many factors affect how you feel day to day."
   8. **Your data stays on your device** — privacy reassurance
7. THE help page SHALL be scrollable, use the app's standard typography and spacing, and provide a back navigation affordance to return to the Insights screen.
8. THE help page content SHALL be accessible via screen reader with proper heading hierarchy (each section as a heading level).

#### Acceptance Criteria — Contextual First-Time Hints

9. THE FIRST TIME a user reaches each Insight_Tier (Nascent, Preliminary, Confident), THE App SHALL display a one-time contextual hint (dismissible banner or coach mark) that briefly explains what's new at this tier and points to the "How this works" link for full details. Examples:
   - Nascent: "We're tracking your journey. Tap ⓘ on any insight to learn how it's calculated."
   - Preliminary: "Early patterns are appearing! These are based on limited data — they'll get more reliable as you continue."
   - Confident: "You now have full insights based on 2+ weeks of data. Tap 'How this works' to learn more about what you're seeing."
10. EACH first-time hint SHALL be shown only once per tier and SHALL persist its dismissed state in local storage so it does not reappear.

### Requirement 12: Outcome-Enhanced Correlation

**User Story:** As a user, I want my post-use outcome responses ("I feel calmer", "I feel the same", etc.) to be factored into my tool insights, so that the app can distinguish between tools I reach for on hard days that actually help versus tools that don't shift how I feel.

#### Dependency

This requirement integrates data from the user-facing-outcomes spec (Outcome_Response records). The Outcome_Prompt is shown after each tool completion (excluding the KPI check-in card) and is controlled by a "Post-use check-in" toggle in Settings → Insights section (default: ON). The prompt asks the user to select how they feel (calmer, clearer, hopeful, same, worse) and persists the response as an Outcome_Response record.

#### Acceptance Criteria

1. THE Correlation_Engine SHALL compute an Outcome_Effectiveness_Score for each tool that has 5 or more Outcome_Response records, defined as: (count of Positive_Outcome responses) / (total Outcome_Response count). Positive_Outcome includes categories: calmer, clear, hopeful. The score ranges from 0.0 (never helps) to 1.0 (always helps).
2. THE Correlation_Engine SHALL combine Tool_Outcome_Correlation (check-in-based, Req 3) and Outcome_Effectiveness_Score (per-use-based) to classify each tool into one of four effectiveness patterns:
   - **Helpful on hard days**: negative or neutral Tool_Outcome_Correlation (Score_Delta ≤ +0.3) AND high Outcome_Effectiveness_Score (≥ 0.6). Interpretation: user reaches for it when struggling, and it helps in the moment.
   - **Reliable booster**: positive Tool_Outcome_Correlation (Score_Delta > +0.3) AND high Outcome_Effectiveness_Score (≥ 0.6). Interpretation: linked to better days and the user feels it helps.
   - **Comfort tool**: negative or neutral Tool_Outcome_Correlation AND moderate Outcome_Effectiveness_Score (0.3–0.6). Interpretation: used on hard days, sometimes helps, sometimes doesn't.
   - **Not helping**: neutral or negative Tool_Outcome_Correlation (Score_Delta ≤ +0.3) AND low Outcome_Effectiveness_Score (< 0.3). Interpretation: neither linked to better days nor producing felt improvement.
3. WHEN a tool is classified as "Helpful on hard days," THE App SHALL display this pattern on the per-tool insights panel with supportive framing (e.g., "You tend to reach for this on harder days, and it usually helps you feel better afterward. That's exactly what it's for.").
4. WHEN a tool is classified as "Not helping," THE App SHALL display this pattern on the per-tool insights panel with gentle, non-judgmental framing (e.g., "When you use this tool, you usually don't feel much different afterward. It might be worth trying something else — or this tool might help in ways that are hard to capture.").
5. THE App SHALL display the effectiveness pattern classification on the per-tool insights panel within the "Daily Check-In Impact" section, below the Score_Delta insight and above the time period selector. It SHALL only appear when Outcome_Effectiveness_Score data is available (5+ outcome responses for the card).
6. IF the user has disabled the Outcome_Prompt via Settings, THE App SHALL compute Outcome_Effectiveness_Score using whatever historical Outcome_Response data exists but SHALL NOT display the effectiveness pattern if fewer than 5 Outcome_Response records exist for a card. THE App SHALL display a note: "Enable post-use check-ins in Settings to get more detailed insights about this tool."
7. THE Correlation_Engine SHALL recompute Outcome_Effectiveness_Score each time the per-tool insights panel or wallet-level insights screen is opened, using all available Outcome_Response data within the selected time period.
8. THE App SHALL provide a "Post-use check-in" toggle in the Settings screen (within the Insights section) that allows the user to enable or disable the Outcome_Prompt shown after tool completion. The default value SHALL be ON (enabled). WHEN disabled, no Outcome_Prompt SHALL appear after completing a tool, but existing Outcome_Response data SHALL still be used for Outcome_Effectiveness_Score computation.

### Requirement 13: Tools to Reconsider

**User Story:** As a user, I want to see which tools in my wallet aren't helping me, so that I can declutter and focus on what works.

#### Acceptance Criteria

1. THE App SHALL display a "Tools to reconsider" section on the wallet-level Insights screen (see Req 10 for positioning) that gently surfaces tools classified as "Not helping" (Req 12.2) with at least 8 completed uses and 5 Outcome_Response records within the selected time period.
2. THE App SHALL display up to 3 tools in the "Tools to reconsider" section, each showing: the tool name, a brief plain-language observation (e.g., "Used 12 times — you usually don't feel much different afterward"), and an "Archive" action button.
3. THE App SHALL frame the section header and content with gentle, non-prescriptive language. The section header SHALL be "Tools to reconsider" (not "bad tools", "ineffective tools", or similar). The introductory text SHALL read something like: "These tools haven't been shifting how you feel. That's okay — you might want to make room for ones that work better for you."
4. WHEN the user taps the "Archive" action on a tool in this section, THE App SHALL archive that card using the existing archive flow (same behavior as archiving from the wallet) and remove it from the "Tools to reconsider" list immediately.
5. THE App SHALL provide a "Keep" dismissal option for each tool. WHEN the user taps "Keep", THE App SHALL remove that tool from the "Tools to reconsider" list for the current time period and SHALL NOT resurface it until the next time period boundary (e.g., if viewing "Last 30 days", the tool is suppressed until 30 new days of data are available).
6. IF no tools qualify for the "Tools to reconsider" section (none classified as "Not helping" with sufficient data), THE App SHALL hide this section entirely — no empty state is shown.
7. THE "Tools to reconsider" section SHALL only appear at the Confident tier (requires 14+ check-ins and 10+ tool uses). At Nascent and Preliminary tiers, this section is not shown.
8. THE App SHALL NOT include the user's KPI card (lib-personal-kpi) in the "Tools to reconsider" section, regardless of its effectiveness classification.
9. THE App SHALL display a tooltip (ⓘ) on the section header. WHEN tapped, it SHALL explain: "We look at two things: whether your check-in scores tend to be different on days you use a tool, and whether you usually feel better right after using it. Tools here scored low on both."

### Requirement 14: Archived Tool Data Handling

**User Story:** As a user, I want insights to reflect my current active toolkit by default, so that recommendations and trends are relevant to what I'm actually using — with the option to include archived tool data if I choose.

#### Acceptance Criteria

1. BY DEFAULT, THE Correlation_Engine SHALL exclude completions, Duration_Records, and Outcome_Responses associated with archived cards when computing wallet-level insights (Best_Tools_Ranking, Outcome Trends chart, engagement messaging, Tools to Reconsider, Try Something Different).
2. THE App SHALL provide a toggle in the Settings screen labeled "Include archived tools in insights" with a default value of OFF (excluded).
3. WHEN the "Include archived tools in insights" setting is ON, THE Correlation_Engine SHALL include completions, Duration_Records, and Outcome_Responses from archived cards in all wallet-level insight computations.
4. WHEN the setting is ON and an archived tool appears in a ranked list (Best_Tools_Ranking or Tools to Reconsider), THE App SHALL display an "Archived" badge next to the tool's name to indicate it is no longer in the active wallet.
5. WHEN a user restores a card from the archive to the wallet, THE App SHALL immediately include that card's historical data in insights computations on the next screen load or refresh, regardless of the archived tools setting.
6. WHEN a user permanently deletes a card from the archive, THE App SHALL remove all associated Duration_Records, completions, and Outcome_Responses via the existing CASCADE delete behavior, effectively removing that tool's data from all future insight computations.
7. THE App SHALL persist the "Include archived tools in insights" preference in the local settings table, surviving app restarts.
8. Daily_Check_In_Score records (kpi_records) SHALL always be included in insights computations regardless of the archived tools setting, as they are not associated with any specific tool.

### Requirement 15: Developer Mock Data Tool (Dev Builds Only)

**User Story:** As a developer, I want to populate the database with realistic mock insights data, so that I can test the insights screens without waiting real days to accumulate organic data.

#### Acceptance Criteria

1. THE App SHALL provide a "Seed Insights Mock Data" button in the Settings screen Developer section (visible only in dev builds via `__DEV__` guard) that generates mock KPI records, completions, control values, Duration_Records, and Outcome_Responses across all active non-archived wallet cards.
2. WHEN the developer triggers mock data generation with a specified number of days N, THE tool SHALL generate data spanning N calendar days back from the current date. WHEN no number is specified, THE tool SHALL use a random value between 30 and 100 days.
3. THE tool SHALL generate KPI records covering approximately 60–85% of the specified days with a slight upward trend (starting around 4–5, ending around 6–7, with ±1 random variance), simulating realistic check-in patterns with natural gaps.
4. THE tool SHALL generate completions and Duration_Records for each active card, with per-card "personality" patterns: some cards correlated with good KPI days (positive personality), some with bad KPI days (negative personality), and some random (neutral), creating visible correlation differences across tools.
5. THE tool SHALL generate Outcome_Response records for approximately 70% of completions, with the category distribution weighted by the card's personality: positive-personality cards produce mostly "calmer"/"clear"/"hopeful" outcomes, negative-personality cards produce mostly "same"/"worse" outcomes.
6. THE tool SHALL generate control_values for each completion matching the card's actual controls (mood_slider, text_input, checkbox, choice_buttons), using the card's control configuration from the database.
7. WHEN the developer specifies 0 days, THE tool SHALL clear all existing mock data (kpi_records, completions, control_values, duration_records, outcome_responses) without generating new data, effectively resetting the insights state.
8. THE tool SHALL clear all existing insights-related data before generating new mock data to prevent accumulation across multiple seeding operations.
9. THE tool SHALL wrap all database inserts in a single transaction for performance and atomicity — either all data is inserted or none is (on failure, rollback).
10. WHEN mock data generation completes successfully, THE tool SHALL display an alert summarizing what was created: number of cards, days generated, KPI record count, completion count, control value count, duration record count, and outcome response count.
11. THE tool SHALL accept numeric input via a text field, validate it (reject non-numeric or negative values), and show appropriate error messages for invalid input.
12. THE tool SHALL only generate data for active wallet cards (excluding archived cards and the Session Launcher card).

### Requirement 16: Insights Analytics Events

**User Story:** As a product owner, I want anonymous analytics on insights screen usage, so that I can understand how often users engage with their insights and which screens they visit.

#### Acceptance Criteria

1. WHEN a user opens the Wallet-Level Insights screen, THE App SHALL fire an `insights_viewed` analytics event with the property `screen` set to `'wallet_insights'`.
2. WHEN a user opens a Per-Tool Insights panel, THE App SHALL fire an `insights_viewed` analytics event with properties `screen` set to `'tool_insights'` and `card_id` set to the viewed card's ID.
3. WHEN a user opens the Insights Help page ("How this works"), THE App SHALL fire an `insights_viewed` analytics event with the property `screen` set to `'insights_help'`.
4. THE `insights_viewed` event SHALL respect the user's analytics opt-in preference — no event is logged when the user has opted out.
5. THE `insights_viewed` event SHALL NOT include any personally identifiable information. The `card_id` property uses the card's internal database ID (UUID), not the card title or user-entered content.
