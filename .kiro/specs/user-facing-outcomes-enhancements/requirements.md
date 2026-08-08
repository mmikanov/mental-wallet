# User-Facing Outcomes — Future Enhancements

## Introduction

This spec tracks potential future enhancements to the post-use outcome check-in system. The core functionality is already implemented:

**Already implemented (not in scope here):**
- Outcome prompt UI after card completion (5 chips: calmer, clearer, hopeful, same, worse)
- Outcome responses persisted to local SQLite (`outcome_responses` table)
- Settings toggle to enable/disable the prompt
- Analytics event logging on selection
- Correlation engine reads outcomes and computes effectiveness scores
- Outcome trend charts on per-tool insights screen (DualAxisChart with positive outcome rate line)
- "Felt better ⓘ" explainer tooltip in chart legend

**Future enhancements below — implement based on user feedback and usage data.**

## Requirements

### Requirement 1: Prompt Frequency Control

**User Story:** As a user, I want the outcome prompt to appear at a reasonable frequency, so that I'm not fatigued by being asked every single time I complete a tool.

#### Acceptance Criteria

1. WHEN a card has 2 or more total prior completions, THE App SHALL display the Outcome_Prompt only if at least 5 completions of that card have occurred since the last Outcome_Prompt was shown for that card.
2. IF the Outcome_Prompt has already been displayed for a given card on the current calendar day, THEN THE App SHALL suppress the Outcome_Prompt for any additional completions of that card on the same day.
3. Cards with fewer than 2 total prior completions SHALL always show the prompt (exempt from frequency rules) to bootstrap outcome data early.

### Requirement 2: Per-Tool Outcome Summary on Card

**User Story:** As a user, I want to see a quick summary of how a tool usually makes me feel, visible on the card itself.

#### Acceptance Criteria

1. WHEN a card has 3 or more Outcome_Response records, THE App SHALL display a concise insight on the focused card view: "You said this helped you feel [dominant_category] [count] out of [total] times."
2. IF a card has fewer than 3 Outcome_Response records, THE App SHALL display "We're still learning how this works for you."
3. WHEN the percentage of a single positive outcome category exceeds 50% of total responses for a card with 5+ records, THE App SHALL display an Outcome_Badge on the card in the wallet stack: "Often calming" / "Often clarifying" / "Often hopeful".
4. Users SHALL be able to hide Outcome_Badges via a Settings toggle (default: visible).

### Requirement 3: Aggregated Outcome Rankings

**User Story:** As a user, I want to see which tools work best across my collection for specific feelings, so that I can prioritize the most effective ones.

#### Acceptance Criteria

1. THE App SHALL display on the Wallet Insights screen sections like "Tools that most often help you feel calmer", listing up to 5 cards ranked by their outcome percentage for that category (minimum 3 outcome responses per card).
2. THE App SHALL show separate sections for each positive category: calmer, clearer, hopeful.
3. WHEN Emotion_Session data is available for a given emotion, THE App SHALL display a "Tools that most often help when you feel [emotion]" section ranked by positive outcome rate for that emotion.
4. IF fewer than 3 total Outcome_Response records exist across all cards, THE App SHALL display an empty state with a friendly message.

### Requirement 4: "Why We Ask" Explainer

**User Story:** As a user, I want to understand why the app asks about my experience, so that I feel comfortable participating.

#### Acceptance Criteria

1. THE Outcome_Prompt SHALL include a "Why we ask" link that opens a brief modal explaining the purpose of outcome collection (max 200 words, 8th-grade reading level).
2. THE explanation SHALL emphasize that responses are private, optional, and used only to personalize the user's own insights.

### Requirement 5: Skip Affordance

**User Story:** As a user, I want a visible way to skip the outcome prompt without feeling pressured to respond.

#### Acceptance Criteria

1. THE Outcome_Prompt SHALL include a visible "Skip" affordance (44×44pt minimum tap target).
2. THE prompt preamble SHALL include framing language like "optional" or "no right answer".
3. THE skip affordance SHALL have equal or greater visual prominence than the outcome chips.

### Requirement 6: Emotion Label Association

**User Story:** As a user, I want my outcome responses to be associated with the emotion I was working on, so insights can show which tools help with specific feelings.

#### Acceptance Criteria

1. WHEN a card completion occurs within an active Emotion_Session, THE App SHALL store the triggering emotion label with the Outcome_Response.
2. WHEN not in an Emotion_Session, THE App SHALL store null for the emotion label.
3. THE App SHALL support querying Outcome_Response records by emotion label.

### Requirement 7: Delete Outcome Data

**User Story:** As a user, I want to be able to delete all my outcome data for privacy reasons.

#### Acceptance Criteria

1. THE Settings screen SHALL provide a "Delete All Outcome Data" option.
2. Tapping it SHALL show a confirmation dialog before proceeding.
3. On confirmation, THE App SHALL atomically delete all outcome_responses rows and refresh any visible insights.

## Out of Scope (decided against)

- Post-Completion Prompt Preference (outcome_only / mood_only / both) — over-engineered for current usage patterns
- Onboarding Feedback Preference Step — adds friction to onboarding without proven value
- Outcome badges as primary navigation signal — may cause anxiety about "performance"
