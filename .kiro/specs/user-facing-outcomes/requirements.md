# Requirements Document

## Introduction

User-Facing Outcomes ("What Worked for Me") gives users simple, understandable signals about whether individual tools helped them feel better in specific ways (calmer, clearer, more hopeful) after each use. Unlike broad mood scores that fluctuate due to many external factors, outcome signals are lightweight per-tool assessments that answer "Did this tool help me right now?" The collected outcomes power per-tool and per-emotion pattern summaries, reinforcing the product's value proposition of helping users find and refine the tools that work for them.

This feature complements the existing mood-logging system by providing a qualitative, low-friction alternative focused on immediate felt shifts rather than numeric mood values.

## Glossary

- **Outcome_Prompt**: A dismissible UI prompt shown after tool completion that asks the user to select a single outcome category describing how they feel.
- **Outcome_Response**: A stored record of the user's selected outcome category for a specific tool use, including tool ID, timestamp, and optional session context.
- **Outcome_Category**: One of five predefined felt-shift labels: calmer, clear, hopeful, same, worse.
- **Positive_Outcome**: An Outcome_Response with category calmer, clear, or hopeful.
- **Neutral_Outcome**: An Outcome_Response with category same.
- **Negative_Outcome**: An Outcome_Response with category worse.
- **Emotion_Session**: A card usage session that was initiated from an emotion-first entry point (e.g., user selected "I feel overwhelmed" before choosing a tool).
- **Post_Completion_Prompt_Preference**: A user-configurable setting that determines which feedback prompt(s) appear after card completion. Valid values are: outcome_only, mood_only, both.
- **Onboarding_Flow**: The sequence of introductory screens presented to a user during first launch or new account setup, before they reach the main wallet interface.
- **Feedback_Preference_Step**: A specific step within the Onboarding_Flow that educates the user about outcome tracking and asks them to choose their Post_Completion_Prompt_Preference.
- **Prompt_Frequency_Config**: A configurable set of rules governing how often the Outcome_Prompt is shown per tool to avoid fatigue.
- **Outcome_Badge**: A subtle label displayed on a card in the wallet view indicating the tool's dominant positive outcome (e.g., "Often calming").
- **Insights_Screen**: A dedicated section where aggregated outcome patterns are displayed to the user.
- **App**: The Mental Health Wallet application.

## Requirements

### Requirement 1: Outcome Prompt Display

**User Story:** As a user, I want to be asked how I feel after completing a tool, so that the app can learn which tools help me.

#### Acceptance Criteria

1. WHEN a user triggers a card completion event, THE App SHALL display the Outcome_Prompt within 500 milliseconds, showing the question text "Right now, after using this tool…" and exactly five selectable chips: "I feel calmer", "I feel more clear", "I feel more hopeful", "I feel the same", "I feel worse".
2. THE Outcome_Prompt SHALL include a visible "Skip" affordance (text link or close icon) that allows the user to dismiss the prompt without selecting an outcome, with a minimum tap target of 44×44 points.
3. WHEN the user taps one of the five Outcome_Category chips, THE App SHALL log an Outcome_Response record containing the card_id, the selected category value, and a timestamp, then return the user to the normal post-completion flow.
4. WHEN the user taps the "Skip" affordance, THE App SHALL dismiss the Outcome_Prompt without logging an Outcome_Response and return the user to the normal post-completion flow.
5. WHEN a card completion event occurs on a card that contains a post-completion mood slider control, THE App SHALL display only the prompt(s) specified by the user's Post_Completion_Prompt_Preference setting: if set to "outcome_only" THE App SHALL display only the Outcome_Prompt, if set to "mood_only" THE App SHALL display only the mood slider prompt, and if set to "both" THE App SHALL display the Outcome_Prompt first and the mood slider prompt second.
6. IF the user navigates away from the Outcome_Prompt or the app is backgrounded before a chip or "Skip" is tapped, THEN THE App SHALL dismiss the Outcome_Prompt without logging an Outcome_Response.
7. WHEN the Outcome_Prompt is displayed, THE App SHALL ensure each chip and the Skip affordance are reachable via screen reader focus order and announced with their label text.
8. WHEN a card completion event is triggered successfully, THE App SHALL immediately hide the card's input controls and save button from the expanded view, displaying only the completion confirmation message and (if applicable) the Outcome_Prompt. The user SHALL NOT be able to re-submit the tool without first collapsing and re-expanding the card.

### Requirement 2: Prompt Frequency Control

**User Story:** As a user, I want the outcome prompt to appear at a reasonable frequency, so that I am not fatigued by being asked every single time.

#### Acceptance Criteria

1. WHEN a completion is recorded for a card that has fewer than 2 total prior completions AND the Post_Completion_Prompt_Preference includes the Outcome_Prompt (value is "outcome_only" or "both"), THE App SHALL display the Outcome_Prompt regardless of other frequency rules.
2. WHEN a completion is recorded for a card that has 2 or more total prior completions, THE App SHALL display the Outcome_Prompt only if at least 5 completions of that card have occurred since the last Outcome_Prompt was shown for that card.
3. IF the Outcome_Prompt has already been displayed for a given card on the current calendar day (determined by the device's local timezone), THEN THE App SHALL suppress the Outcome_Prompt for any additional completions of that card on the same day, except when criterion 1 applies (cards with fewer than 2 prior completions are exempt from the daily limit).
4. WHEN both criterion 2 (interval rule) and criterion 3 (daily limit rule) apply to a card that has already passed the initial prompt threshold, THE App SHALL suppress the Outcome_Prompt if either rule indicates suppression.
5. THE App SHALL store the Prompt_Frequency_Config values in the settings table with the following keys and default values: initial_prompt_count (default: 2), prompt_interval (default: 5), daily_prompt_limit (default: 1).
6. WHEN the Prompt_Frequency_Config values are modified in the settings table, THE App SHALL apply the updated values starting from the very next completion recorded after the modification, without requiring an app restart.

### Requirement 3: Outcome Data Storage

**User Story:** As a user, I want my outcome responses to be stored reliably, so that the app can show me patterns over time.

#### Acceptance Criteria

1. THE App SHALL store each Outcome_Response with: a unique ID (generated via expo-crypto UUID), the associated card ID, the selected Outcome_Category (calmer, clear, hopeful, same, worse), and a UTC timestamp in ISO 8601 format.
2. WHEN the card completion occurred within an Emotion_Session, THE App SHALL additionally store the triggering emotion label (as recorded in the Emotion_Session record) with the Outcome_Response. WHEN the card completion did not occur within an Emotion_Session, THE App SHALL store a null value for the emotion label field.
3. WHEN the user taps an Outcome_Category chip, THE App SHALL persist the Outcome_Response record to the local SQLite database within 500 milliseconds of the tap event.
4. IF the database write fails, THEN THE App SHALL retry the write exactly once. IF the retry succeeds, THEN THE App SHALL preserve the Outcome_Response as if the initial write had succeeded. IF the retry also fails, THEN THE App SHALL discard the Outcome_Response without displaying an error message or interrupting the user flow.
5. THE App SHALL support querying Outcome_Response records by card ID, by Outcome_Category, by date range (inclusive start date to inclusive end date), and by emotion label. All query results SHALL be returned in reverse chronological order (newest first). WHEN querying by emotion label, records with a null emotion label SHALL be excluded from results.

### Requirement 4: Per-Tool Outcome Insights

**User Story:** As a user, I want to see a summary of outcomes for each tool, so that I can understand which tools help me most.

#### Acceptance Criteria

1. WHEN a card has 3 or more Outcome_Response records, THE App SHALL display a concise insight on the card detail view in the format: "You said this helped you feel [dominant_category] [count] out of [total] times." where dominant_category is the Outcome_Category with the highest count among all five categories.
2. IF two or more Outcome_Category values are tied for highest count on a card, THEN THE App SHALL select the category appearing first in the order: calmer, clear, hopeful, same, worse.
3. IF a card has fewer than 3 Outcome_Response records, THEN THE App SHALL display the message "We're still learning how this works for you." on the card detail view instead of computed insights.
4. THE App SHALL recompute per-tool summary statistics (count of each Outcome_Category, percentage of Positive_Outcome responses, percentage of Neutral_Outcome and Negative_Outcome responses) each time the card detail view is opened.
5. THE App SHALL always compute Outcome_Badge eligibility for each card regardless of the badge visibility setting. WHEN the percentage of a single Positive_Outcome category exceeds 50% of total responses for a card with 5 or more Outcome_Response records, THE App SHALL display an Outcome_Badge on the card in the wallet view: "Often calming" for calmer, "Often clarifying" for clear, "Often hopeful" for hopeful — provided the badge visibility toggle is enabled.
6. IF multiple Positive_Outcome categories each exceed 50% (which cannot occur simultaneously), or if no single category exceeds 50%, THEN THE App SHALL not display an Outcome_Badge for that card.
7. THE App SHALL allow users to hide all Outcome_Badge display via a toggle in the Settings screen, defaulting to visible. WHEN badge visibility is disabled, THE App SHALL continue computing badge eligibility in the background so that badges appear immediately when the user re-enables visibility.

### Requirement 5: Aggregated Insights Screen

**User Story:** As a user, I want to see which tools work best across my collection, so that I can prioritize and reorder my wallet.

#### Acceptance Criteria

1. THE App SHALL provide an Insights_Screen accessible from the main navigation that displays aggregated outcome patterns, recalculated each time the screen is opened.
2. THE App SHALL display a "Tools that most often help you feel calmer" section listing up to 5 cards ranked by their calmer-outcome percentage (calmer Outcome_Response count divided by total Outcome_Response count for that card), provided each listed card has 3 or more Outcome_Response records.
3. THE App SHALL display a "Tools that most often help you feel more clear" section and a "Tools that most often help you feel more hopeful" section, each listing up to 5 cards ranked by their respective outcome percentage, provided each listed card has 3 or more Outcome_Response records.
4. WHEN Emotion_Session data is available for a given emotion with 3 or more Outcome_Response records across at least one card, THE App SHALL display a "Tools that most often help when you feel [emotion]" section listing up to 5 cards ranked by Positive_Outcome rate for that emotion, provided each listed card has 3 or more Outcome_Response records associated with that emotion. IF no individual cards meet the per-card threshold for that emotion, THEN THE App SHALL hide the emotion section entirely.
5. IF two or more cards share the same outcome percentage within a ranked section, THEN THE App SHALL order the tied cards by total Outcome_Response count descending, then by card title alphabetically ascending.
6. WHEN the user taps a card in the Insights_Screen, THE App SHALL navigate to that card's detail view in the wallet.
7. IF fewer than 3 total Outcome_Response records exist across all cards, THEN THE App SHALL display an empty state on the Insights_Screen with the message "Keep using your tools — insights will appear after a few more sessions."

### Requirement 6: Privacy and User Control

**User Story:** As a user, I want to control my outcome data and understand why it is collected, so that I feel safe using the feature.

#### Acceptance Criteria

1. THE App SHALL provide a "Why we ask" informational link accessible from the Outcome_Prompt that, when tapped, displays a dismissible explanatory screen or modal describing the purpose of outcome collection in no more than 200 words at or below an 8th-grade reading level.
2. THE App SHALL provide a toggle in the Settings screen to enable or disable Outcome_Prompt display entirely, defaulting to enabled.
3. WHEN the user disables the Outcome_Prompt via Settings, THE App SHALL stop showing the prompt on all subsequent completions without deleting existing Outcome_Response data, effective immediately with no app restart required.
4. WHEN the user re-enables the Outcome_Prompt via Settings, THE App SHALL resume showing the prompt according to the existing Prompt_Frequency_Config rules, continuing from the prior completion count (not resetting the frequency counter).
5. THE App SHALL provide a "Delete All Outcome Data" option in the Settings screen that, when tapped, presents a confirmation dialog requiring explicit user approval before proceeding.
6. WHEN the user confirms deletion via the confirmation dialog, THE App SHALL atomically remove all Outcome_Response records from the local database, remove all Outcome_Badge labels from cards in the wallet view, and revert the Insights_Screen to its empty state as defined in Requirement 5 criterion 7. IF any step of the deletion operation fails, THEN THE App SHALL roll back the entire operation and display a brief error message to the user.

### Requirement 7: Accessibility

**User Story:** As a user with accessibility needs, I want the outcome prompt and insights to be fully accessible, so that I can use the feature with assistive technology.

#### Acceptance Criteria

1. THE App SHALL assign accessible labels to each Outcome_Category chip that convey both the label text and the sentiment (e.g., accessibility label "I feel calmer, positive outcome") and SHALL communicate the selected state to assistive technology when a chip is chosen.
2. THE App SHALL ensure that Outcome_Category chips are distinguishable by shape, label text, and optional icon — not by color alone — and SHALL render each chip with a minimum touch target size of 44×44 points.
3. WHEN the Outcome_Prompt is displayed, THE App SHALL move focus to the question text element so that screen reader users are notified of the prompt's appearance, and all Outcome_Prompt elements SHALL be navigable in the following order: question text, then chips in the sequence calmer, clear, hopeful, same, worse, then "Why we ask" link, then skip affordance.
4. WHEN a card with an Outcome_Badge receives focus, THE App SHALL announce the badge text (e.g., "Often calming") as part of the card's accessibility label so that screen reader users perceive the badge without additional navigation.
5. THE App SHALL ensure all text content on the Insights_Screen, including section headings, ranked tool lists, and empty-state messages, is readable and navigable by screen readers in the visual display order.

### Requirement 8: Tone and Copy

**User Story:** As a user, I want the outcome language to feel supportive and low-pressure, so that I don't feel judged by my responses.

#### Acceptance Criteria

1. THE App SHALL use hedging qualifiers (e.g., "a bit", "often", "tends to") in all Outcome_Badge labels and Insights_Screen summary text, and SHALL NOT use absolute language (e.g., "always", "never", "completely", "dramatically", "transformed") when describing outcome patterns.
2. THE App SHALL display introductory micro-copy on the Outcome_Prompt that frames the interaction as optional and non-evaluative, including the word "optional" or "no right answer" in the prompt preamble, and SHALL display the skip affordance with equal or greater visual prominence than the Outcome_Category chips.
3. THE App SHALL NOT use the words "score", "grade", "pass", "fail", "success", "failure", "performance", or "rating" in any user-facing text related to outcomes, badges, or insights.
4. IF the App displays insight text referencing a Negative_Outcome (category "worse") or Neutral_Outcome (category "same"), THEN THE App SHALL frame the text as informational observation without blame (e.g., "Sometimes this one doesn't shift things — that's okay") and MAY offer a gentle, optional suggestion to explore other tools while maintaining supportive framing (e.g., "You might also try one of these" rather than "This tool isn't working for you").

### Requirement 9: Post-Completion Prompt Preference

**User Story:** As a user, I want to choose which feedback prompt appears after I complete a tool, so that I can use the approach that feels right for me without being asked twice.

#### Acceptance Criteria

1. THE App SHALL provide a "Post-Completion Feedback" preference in the Settings screen that allows the user to select one of three options: "Outcome prompt only", "Mood slider only", or "Both (outcome then mood)". The Post_Completion_Prompt_Preference MAY be initially set during the Onboarding_Flow (see Requirement 10) and changed at any time in Settings.
2. THE App SHALL default the Post_Completion_Prompt_Preference to "outcome_only" for new installations and for users who have not previously configured this setting or who skipped the Feedback_Preference_Step during onboarding.
3. WHEN the user changes the Post_Completion_Prompt_Preference in Settings, THE App SHALL apply the updated preference starting from the very next card completion event, without requiring an app restart.
4. WHEN the Post_Completion_Prompt_Preference is set to "outcome_only", THE App SHALL suppress the mood slider prompt on cards that contain a post-completion mood slider control and display only the Outcome_Prompt after completion.
5. WHEN the Post_Completion_Prompt_Preference is set to "mood_only", THE App SHALL suppress the Outcome_Prompt on cards that contain a post-completion mood slider control and display only the mood slider prompt after completion.
6. WHEN the Post_Completion_Prompt_Preference is set to "both", THE App SHALL display the Outcome_Prompt first followed by the mood slider prompt second after completion on cards that contain a post-completion mood slider control.
7. WHEN a card does not contain a post-completion mood slider control, THE App SHALL display only the Outcome_Prompt regardless of the Post_Completion_Prompt_Preference value, subject to Prompt_Frequency_Config rules.
8. THE App SHALL display a brief explanation beneath the preference selector describing each option: "Outcome prompt only" as "A quick one-tap check-in about how you feel", "Mood slider only" as "The familiar mood slider you already know", and "Both" as "See both prompts in sequence after each tool".
9. WHEN the user disables the Outcome_Prompt via the existing toggle in Settings (Requirement 6 criterion 2), THE App SHALL override the Post_Completion_Prompt_Preference to behave as "mood_only" for cards with a mood slider, and suppress all post-completion prompts for cards without a mood slider, until the Outcome_Prompt is re-enabled.

### Requirement 10: Onboarding Feedback Preference Step

**User Story:** As a new user, I want the app to explain why it asks about my experience after using tools and let me choose my preferred feedback style during setup, so that I understand the purpose from the start and feel the experience is tailored to me.

#### Acceptance Criteria

1. WHEN a user launches the App for the first time or completes new account setup, THE App SHALL include the Feedback_Preference_Step as part of the Onboarding_Flow before the user reaches the main wallet interface.
2. THE App SHALL display an educational message on the Feedback_Preference_Step that communicates three concepts in sequence: (a) the App helps users understand how their tools impact their mental health over time, (b) each person experiences and defines "what helped" differently, and (c) the App will ask brief questions after tool use to learn what works for the user personally. The message SHALL use warm, inviting language that emphasizes personalization and SHALL NOT use clinical terminology, data-heavy framing, or words such as "data", "metrics", "tracking", or "analytics".
3. WHEN the educational message has been presented, THE App SHALL display the three Post_Completion_Prompt_Preference options ("Outcome prompt only", "Mood slider only", "Both (outcome then mood)") as selectable choices with the same brief descriptions defined in Requirement 9 criterion 8.
4. WHEN the user selects one of the three preference options on the Feedback_Preference_Step, THE App SHALL persist that selection as the Post_Completion_Prompt_Preference value, effective immediately for all subsequent card completions.
5. THE App SHALL provide a visible "Skip" affordance on the Feedback_Preference_Step with a minimum tap target of 44×44 points. WHEN the user taps the "Skip" affordance, THE App SHALL set the Post_Completion_Prompt_Preference to "outcome_only" and advance to the next onboarding step.
6. IF the user exits or backgrounds the App during the Feedback_Preference_Step without making a selection or tapping "Skip", THEN THE App SHALL retain the default Post_Completion_Prompt_Preference value of "outcome_only" and SHALL present the Feedback_Preference_Step again on the next launch until the user either makes a selection or explicitly skips the step.
7. THE App SHALL ensure the educational message on the Feedback_Preference_Step is written at or below an 8th-grade reading level and contains no more than 80 words.
8. THE App SHALL ensure all elements of the Feedback_Preference_Step (educational message, preference options, skip affordance) are accessible via screen reader in visual display order and that each preference option communicates its selected state to assistive technology.
