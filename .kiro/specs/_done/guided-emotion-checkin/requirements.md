# Requirements Document

## Introduction

Users often open the emotion session flow knowing "something is off" but unable to pick a specific emotion from the existing 6-option set (stressed, overwhelmed, anxious, sad, angry, numb). This feature expands the emotion picker to 12 emotions by adding 6 new feelings (lonely, ashamed/embarrassed, guilty, hopeless/discouraged, calm/okay, curious/interested) and introduces a guided check-in path for users who can't identify their emotion directly. The check-in uses plain-language questions about body energy, pleasantness, thought patterns, and social context to derive a feeling from the full set of 12. The guided check-in takes 30–60 seconds and results in a pre-selected emotion chip plus a soft-language label on the picker.

## Glossary

- **Guided_Checkin**: A 4-question flow that helps users identify a feeling when they cannot select one directly. Accessed via the "I'm not sure how I feel" entry point on the emotion picker.
- **Body_Energy_Level**: The user's self-reported physical energy, selected from: very_low, low, medium, high, very_high.
- **Pleasantness**: The user's overall felt quality, selected from: unpleasant, mixed, pleasant.
- **Thought_Pattern**: The dominant thinking mode, selected from: racing, stuck_worries, stuck_mistakes, blank, numb, curious_interested, okay.
- **Social_Context**: The user's current situational context, selected from: alone_at_home, at_work, with_family, with_friends.
- **Derived_Feeling**: The emotion label computed from the mapping rules after the user answers all 4 Guided_Checkin questions. One of the 12 emotions in the Full_Emotion_Set.
- **Full_Emotion_Set**: All 12 emotions displayed on the emotion picker, all directly selectable by the user: stressed, overwhelmed, anxious, sad, angry, numb, lonely, ashamed, guilty, hopeless, calm, curious.
- **Mapping_Engine**: The pure function that accepts Guided_Checkin responses, computes a score for each of the 12 feelings using the Scoring Table, and returns the highest-scoring feeling as the Derived_Feeling.
- **Soft_Label**: The user-facing phrasing of the Derived_Feeling, presented in gentle language (e.g., "It sounds more like lonely right now").
- **Checkin_Record**: An anonymous record of a completed Guided_Checkin capturing responses, Derived_Feeling, whether the user changed the suggestion, and timestamp.
- **App**: The Mental Health Wallet application.
- **Session_Store**: The existing Zustand store managing emotion session state.

## Requirements

### Requirement 1: Expanded Emotion Picker with Guided Check-in Entry Point

**User Story:** As a user, I want to see all available emotions (including nuanced ones) on the emotion picker so I can directly select how I feel, and I want a fallback option to help me identify my emotion if I'm unsure.

#### Acceptance Criteria

1. THE App SHALL display 12 emotion chips on the emotion picker screen: stressed, overwhelmed, anxious, sad, angry, numb, lonely, ashamed, guilty, hopeless, calm, curious.
2. THE emotion chips SHALL be arranged in a visually grouped layout (e.g., two rows of 6, or a wrap layout) that allows all 12 to be visible without scrolling on standard screen sizes.
3. THE App SHALL display an "I'm not sure how I feel" button below the emotion chips, separated by at least 12 points of vertical spacing.
4. THE "I'm not sure how I feel" button SHALL render as a full-width text button (not a chip) with no border-radius exceeding 8 points, ensuring it is visually distinguishable from the emotion chips while remaining secondary in emphasis.
5. WHEN the user taps any emotion chip, THE App SHALL select that emotion and allow the user to proceed to the context selection step of the standard session flow.
6. WHEN the user taps the "I'm not sure how I feel" button, THE App SHALL navigate to the first Guided_Checkin question screen, preserving the emotion picker in the back stack.
7. THE "I'm not sure how I feel" button SHALL have a minimum tap target of 44×44 points.
8. THE "I'm not sure how I feel" button SHALL be accessible via screen reader with an accessibility label of "I'm not sure how I feel. Start guided check-in."

### Requirement 2: Guided Check-in Question Flow

**User Story:** As a user in the guided check-in, I want to answer simple plain-language questions about my body and mind, so that the app can help me identify what I'm feeling without requiring emotion vocabulary.

#### Acceptance Criteria

1. THE Guided_Checkin SHALL present exactly 4 questions in a fixed order: Body Energy (question 1), Pleasantness (question 2), Thought Pattern (question 3), Social Context (question 4).
2. WHEN question 1 is displayed, THE App SHALL show the prompt "Right now, my body feels…" with exactly 5 selectable options rendered as tappable buttons in top-to-bottom order: "Very low energy", "Low energy", "Medium energy", "High energy", "Very high energy".
3. WHEN question 2 is displayed, THE App SHALL show the prompt "Overall, this feels…" with exactly 3 selectable options in top-to-bottom order: "Mostly unpleasant", "Mixed", "Mostly pleasant".
4. WHEN question 3 is displayed, THE App SHALL show the prompt "My mind is mostly…" with exactly 7 selectable options in top-to-bottom order: "Racing", "Stuck on worries", "Stuck on mistakes", "Blank", "Numb", "Curious / interested", "Okay / steady".
5. WHEN question 4 is displayed, THE App SHALL show the prompt "Where are you right now?" with exactly 4 selectable options in top-to-bottom order: "Alone at home", "At work", "With family", "With friends".
6. WHEN the user selects an option on any question, THE App SHALL visually highlight the selected option for 200–400 milliseconds and then advance to the next question without requiring a separate "Next" button tap.
7. THE App SHALL display a progress indicator showing which question the user is on (e.g., step 2 of 4).
15. THE App SHALL display a contextual icon above the question prompt on each step to visually reinforce the question topic: a body/energy icon for Body Energy (question 1), a spectrum/mood icon for Pleasantness (question 2), a mind/thought icon for Thought Pattern (question 3), and a location/people icon for Social Context (question 4). Icons SHALL be decorative (not interactive) and marked with `accessibilityElementsHidden` so they are skipped by screen readers.
8. THE App SHALL provide a back navigation affordance on questions 2, 3, and 4 that returns the user to the previous question with their prior selection visually highlighted. WHEN the user selects a different option after navigating back, THE App SHALL apply the same highlight-then-advance behavior as the initial selection.
9. THE App SHALL provide a dismiss affordance (close button) on all 4 questions that returns the user to the emotion picker without starting a session. The dismiss affordance SHALL be positioned consistently across all steps (e.g., top-right corner).
10. WHEN the user selects an option on question 4 (the final question), THE App SHALL return the user to the emotion picker with the Derived_Feeling pre-selected as described in Requirement 4.
11. Each selectable option across all 4 questions SHALL have a minimum tap target of 44 points in height.
12. THE App SHALL complete the full 4-question flow in a single scrollable or paginated view without requiring the user to leave the session launcher context.
13. WHILE a question transition is in progress (between user tap and the next question being displayed), THE App SHALL ignore additional option taps to prevent duplicate selections.
14. WHEN the user navigates back to a previous question, THE App SHALL clear any responses recorded for questions after the displayed question (subsequent answers are discarded so the user must re-answer forward).

### Requirement 3: Emotion Mapping Engine

**User Story:** As a developer, I want a deterministic pure function that maps check-in responses to a derived feeling using a scoring model, so that the mapping logic is testable, tunable, and produces nuanced results without rigid priority shadowing.

#### Acceptance Criteria

1. THE Mapping_Engine SHALL accept a structured input containing body_energy (Body_Energy_Level), pleasantness (Pleasantness), thought_pattern (Thought_Pattern), and context (Social_Context) and return a MappingResult containing one or more top-scoring feelings.
2. THE Mapping_Engine SHALL use a score-based matching algorithm: for each of the 12 feelings, compute an additive score by summing weights from the Scoring Table based on the user's selected values for each of the 4 inputs.
3. WHEN exactly one feeling has the highest total score, THE Mapping_Engine SHALL return that feeling as the single Derived_Feeling.
4. WHEN multiple feelings are tied for the highest score, THE Mapping_Engine SHALL return all tied feelings in its result so the UI can present them as options for the user to choose between.
5. IF all feeling scores are very low (all scores ≤ 2), THEN THE Mapping_Engine SHALL return "stressed" as a fallback.
6. THE Mapping_Engine SHALL be implemented as a pure function with no side effects, no database access, and no network calls.
7. THE Mapping_Engine SHALL produce a valid result (one or more feelings) for every valid combination of Body_Energy_Level (5 values), Pleasantness (3 values), Thought_Pattern (7 values), and Social_Context (4 values) inputs — totalling 420 combinations — with no undefined or error outputs for valid inputs (total function property).
8. IF any input field contains a value not defined in the corresponding glossary enum (Body_Energy_Level, Pleasantness, Thought_Pattern, or Social_Context), THEN THE Mapping_Engine SHALL throw a synchronous error indicating which field received an invalid value, without returning a result.
9. THE scoring weights SHALL be defined as a declarative data structure (a table of weights per feeling per input option) that can be modified or extended without changes to the engine's scoring logic.

#### Scoring Table

Each feeling has a weight (0, 1, or 2) for each possible input value. For a given set of user answers, the engine sums the 4 weights (one per input dimension) to produce a total score for each feeling. The feeling with the highest total wins.

Legend: +2 = strong match, +1 = moderate match, 0 = neutral / no effect.

**Hopeless**
- Body energy: very_low → +2; low → +1
- Pleasantness: unpleasant → +2; mixed → 0; pleasant → 0
- Thought: blank → +2; stuck_mistakes → +2; numb → +1
- Context: any → 0

**Guilty**
- Body energy: low → +1; medium → +1
- Pleasantness: unpleasant → +2
- Thought: stuck_mistakes → +2
- Context: with_family → +1; with_friends → +1; at_work → +1; alone_at_home → 0

**Ashamed**
- Body energy: medium → +1; high → +1
- Pleasantness: unpleasant → +2
- Thought: stuck_mistakes → +2
- Context: at_work → +1; with_family → +1; with_friends → +1

**Lonely**
- Body energy: low → +1; medium → +1
- Pleasantness: unpleasant → +2
- Thought: blank → +2; numb → +2; stuck_worries → +1
- Context: alone_at_home → +2; with_family → +1; with_friends → +1

**Angry**
- Body energy: high → +2; very_high → +2
- Pleasantness: unpleasant → +2
- Thought: stuck_mistakes → +1; racing → +1
- Context: any → 0

**Anxious**
- Body energy: high → +2; very_high → +2
- Pleasantness: unpleasant → +2
- Thought: racing → +2; stuck_worries → +2
- Context: at_work → +1; alone_at_home → +1

**Overwhelmed**
- Body energy: medium → +1; high → +1
- Pleasantness: unpleasant → +1
- Thought: racing → +2; stuck_worries → +1
- Context: at_work → +1; with_family → +1

**Stressed**
- Body energy: medium → +1; high → +1
- Pleasantness: unpleasant → +1; mixed → +1
- Thought: stuck_worries → +1; okay → +1
- Context: at_work → +2; alone_at_home → +1; with_family → +1; with_friends → +1

**Numb**
- Body energy: very_low → +2; low → +1
- Pleasantness: unpleasant → +1; mixed → +1
- Thought: numb → +2; blank → +1
- Context: any → 0

**Sad**
- Body energy: low → +2; very_low → +1
- Pleasantness: unpleasant → +2
- Thought: blank → +2; numb → +1
- Context: alone_at_home → +1

**Curious**
- Body energy: medium → +2; high → +2
- Pleasantness: mixed → +2; pleasant → +2
- Thought: curious_interested → +2
- Context: any → 0

**Calm**
- Body energy: low → +1; medium → +1
- Pleasantness: mixed → +2; pleasant → +2
- Thought: okay → +2
- Context: any → 0

#### Scoring Table (machine-readable CSV)

```
feeling,body_very_low,body_low,body_medium,body_high,body_very_high,pleasant_unpleasant,pleasant_mixed,pleasant_pleasant,thought_racing,thought_stuck_worries,thought_stuck_mistakes,thought_blank,thought_numb,thought_curious_interested,thought_okay,ctx_alone_at_home,ctx_at_work,ctx_with_family,ctx_with_friends
hopeless,2,1,0,0,0,2,0,0,0,0,2,2,1,0,0,0,0,0,0
guilty,0,1,1,0,0,2,0,0,0,0,2,0,0,0,0,0,1,1,1
ashamed,0,0,1,1,0,2,0,0,0,0,2,0,0,0,0,0,1,1,1
lonely,0,1,1,0,0,2,0,0,0,1,0,2,2,0,0,2,0,1,1
angry,0,0,0,2,2,2,0,0,1,0,1,0,0,0,0,0,0,0,0
anxious,0,0,0,2,2,2,0,0,2,2,0,0,0,0,0,1,1,0,0
overwhelmed,0,0,1,1,0,1,0,0,2,1,0,0,0,0,0,0,1,1,0
stressed,0,0,1,1,0,1,1,0,0,1,0,0,0,0,1,1,2,1,1
numb,2,1,0,0,0,1,1,0,0,0,0,1,2,0,0,0,0,0,0
sad,1,2,0,0,0,2,0,0,0,0,0,2,1,0,0,1,0,0,0
curious,0,0,2,2,0,0,2,2,0,0,0,0,0,2,0,0,0,0,0
calm,0,1,1,0,0,0,2,2,0,0,0,0,0,0,2,0,0,0,0
```

### Requirement 4: Guided Check-in Result and Emotion Selection

**User Story:** As a user who completed the guided check-in, I want to see the result within the check-in flow as a final step, so I can confirm it, choose between tied options, or try again.

#### Acceptance Criteria

1. WHEN the Mapping_Engine returns a single top-scoring feeling, THE App SHALL display a result screen (the "5th step" within the guided check-in flow) showing the Derived_Feeling prominently with its emoji and display name, followed by the Soft_Label message and the normalizing message.
2. WHEN the Mapping_Engine returns multiple tied feelings, THE App SHALL display a result screen that presents all tied feelings as selectable options (chips or buttons), accompanied by a prompt such as "This could be a few things — which feels closest?" The user MUST tap one to proceed.
3. THE result screen Soft_Label SHALL use the format "It sounds like you might be feeling [feeling] right now" where [feeling] is the top-scoring Derived_Feeling value in lowercase (for single results), or be omitted when multiple tied options are presented.
4. THE result screen SHALL display a normalizing message: "It's okay if this isn't perfect — we're just using it as a starting point."
5. THE result screen SHALL provide a "Use this feeling" button (for single results) or the feeling options themselves (for ties) that, when tapped, accept the feeling and return the user to the emotion picker with that emotion pre-selected and the session started.
6. THE result screen SHALL provide a "Try again" option that restarts the guided check-in from step 1, clearing all previous answers.
7. THE result screen SHALL retain the close button (X) that dismisses the entire guided check-in and returns the user to the emotion picker without any emotion selection.
8. THE Soft_Label and normalizing message SHALL only appear on the result screen within the guided check-in flow — they SHALL NOT appear on the emotion picker screen itself.

#### Tool Recommendation Table

The following table defines which tools are recommended for each of the 6 new emotions. These recommendations are surfaced by the existing session recommendation engine after the user completes the full session flow (emotion → context → time → tools).

| Derived Feeling | Tool 1 | Tool 2 | Tool 3 |
|----------------|--------|--------|--------|
| lonely | Reach Out (lib-reach-out) | Gratitude Message (lib-gratitude-message) | You Are Not Alone (lib-not-alone) |
| ashamed | Self-Compassion Pause (lib-self-compassion-pause) | Kind Inner Voice (lib-kind-inner-voice) | You Are Not Alone (lib-not-alone) |
| guilty | Permission Slip (lib-permission-slip) | Kind Inner Voice (lib-kind-inner-voice) | Win of the Day (lib-win-of-day) |
| hopeless | Three Good Things (lib-three-good-things) | Evening Gratitude (lib-evening-gratitude) | Reach Out (lib-reach-out) |
| calm | Daily Mood Check-In (lib-daily-mood) | Win of the Day (lib-win-of-day) | Evening Gratitude (lib-evening-gratitude) |
| curious | Thought–Feeling–Action (lib-thought-feeling-action) | Daily Mood Check-In (lib-daily-mood) | Three Good Things (lib-three-good-things) |

The tool recommendation mapping SHALL be defined as a declarative data structure that can be modified or extended without changes to the recommendation engine logic.

### Requirement 5: Emotion Type Integration

**User Story:** As a developer, I want the 6 new feelings integrated into the type system and recommendation infrastructure, so that sessions using any of the 12 emotions flow through the same pipelines.

#### Acceptance Criteria

1. THE App SHALL extend the EmotionType union to include the 6 new values: "lonely", "ashamed", "guilty", "hopeless", "calm", "curious".
2. THE App SHALL assign emotion tags to curated library cards for the 6 new emotions, derived from the Tool Recommendation Table in Requirement 4: each card listed for a given feeling gets that feeling added as an emotionTag. At least 1 curated library card SHALL have an emotionTag for each of the 6 new emotion values.
3. WHEN an active session uses one of the 6 new emotions, THE App SHALL persist the emotion value in the EmotionSessionRecord.selectedEmotion field as a plain string in the selected_emotion column, identical in format to how the existing 6 emotions are stored.
4. THE App SHALL map each of the 6 new emotion values to its user-friendly display name ("lonely" → "Lonely", "ashamed" → "Ashamed / Embarrassed", "guilty" → "Guilty", "hopeless" → "Hopeless / Discouraged", "calm" → "Calm / Okay", "curious" → "Curious / Interested") and render that display name wherever session history or usage history screens show the emotion label.
5. THE emotion picker SHALL display all 12 emotions as directly selectable chips with no visual distinction between existing and new emotions.
6. WHEN the recommendation service receives one of the 6 new emotion values, THE App SHALL filter and return matching curated library cards and wallet cards using the same scoring and ranking algorithm applied to existing emotions.
7. THE card creator/editor emotion tag picker (Step 3) SHALL display all 12 emotions as selectable tags, allowing users and admins to associate any card with any of the 12 feelings.

### Requirement 6: Analytics Logging

**User Story:** As a product owner, I want anonymous analytics on guided check-in usage, so that I can tune the mapping rules and understand which derived feelings are most common.

#### Acceptance Criteria

1. WHEN the user proceeds from the emotion picker after a Guided_Checkin (either keeping the pre-selected Derived_Feeling or selecting a different emotion), THE App SHALL log a Checkin_Record containing: a unique ID (UUID v4 generated via expo-crypto), the 4 responses (body_energy, pleasantness, thought_pattern, context), the Derived_Feeling, whether the user changed the suggestion (boolean), the final emotion used for the session, and a UTC ISO 8601 timestamp.
2. THE App SHALL persist Checkin_Records in the local SQLite `guided_checkin_records` table and SHALL retain records indefinitely (no automatic purging or expiration). THE App SHALL provide a user-accessible option to clear their local check-in history, with a warning that clearing will reduce the insights available from the tool.
3. THE App SHALL NOT include any personally identifiable information in the Checkin_Record — records contain only the structured responses and derived output.
4. WHEN the user dismisses the Guided_Checkin before completing all 4 questions, THE App SHALL NOT create a Checkin_Record.
5. WHEN the first Guided_Checkin question screen is displayed, THE App SHALL fire an analytics event "guided_checkin_started" with no additional properties.
6. WHEN the user proceeds from the emotion picker after a Guided_Checkin, THE App SHALL fire an analytics event "guided_checkin_completed" with properties: derived_feeling (string), was_changed (boolean — true if the user selected a different emotion than the Derived_Feeling), and final_emotion_used (string).

### Requirement 7: Tone, Language, and UX Guardrails

**User Story:** As a user, I want the guided check-in to feel supportive and non-clinical, so that I'm comfortable exploring difficult feelings without feeling judged or pathologized.

#### Acceptance Criteria

1. THE App SHALL NOT use any of the following clinical or diagnostic terms in user-facing text within the Guided_Checkin flow or result screen: "assess", "evaluate", "diagnose", "diagnosis", "symptom", "disorder", "pathology", "clinical", "screening", "treatment", "patient", "condition", "prognosis", "therapeutic intervention", "mental illness", or "abnormal".
2. THE App SHALL use second-person pronouns ("you", "your", "you're") throughout the Guided_Checkin questions, option labels, and result text. Third-person references ("the user", "one") and first-person-plural ("we") SHALL NOT appear in question prompts or Soft_Labels, except in the normalizing statement specified in criterion 6.
3. THE App SHALL frame the Derived_Feeling label using the fixed tentative format: "It sounds like you might be feeling [feeling] right now." The App SHALL NOT present a Derived_Feeling using definitive phrasing such as "You are feeling…", "Your emotion is…", or "You feel…".
4. THE App SHALL use language between a Flesch-Kincaid Grade Level of 5.0 and 8.0 in all Guided_Checkin question prompts, option labels, and result screen text, avoiding both overly complex and overly simplistic phrasing. Proper nouns and the app name are excluded from the readability calculation.
5. THE App SHALL NOT use language in the Guided_Checkin flow that employs: (a) urgency cues — time-pressure phrasing such as "hurry", "don't wait", "before it's too late", "act now"; (b) loss-framing — implying negative consequences of inaction such as "you'll miss out", "things will get worse if you don't"; or (c) guilt-inducing phrasing — language implying the user is failing or letting others down such as "you should have", "you owe it to", "don't let people down".
6. THE Guided_Checkin result screen SHALL include the normalizing statement "It's okay if this isn't perfect — we're just using it as a starting point." displayed below the Soft_Label and above the recommended tool cards.
7. THE App SHALL NOT display numeric scores, percentages, confidence values, or any quantitative output from the Mapping_Engine to the user anywhere in the Guided_Checkin flow or result screen.
8. THE tone and language constraints in criteria 1–7 SHALL apply to all user-facing text surfaces within the Guided_Checkin flow: question prompts, selectable option labels, progress indicator text, back/dismiss button labels, the result screen Soft_Label, the normalizing message, and any inline error messages displayed during the flow.

### Requirement 8: Accessibility

**User Story:** As a user with accessibility needs, I want the guided check-in to be fully accessible, so that I can navigate it with assistive technology.

#### Acceptance Criteria

1. THE App SHALL ensure all selectable options in the Guided_Checkin questions have a minimum tap target of 44 points in both width and height.
2. THE App SHALL ensure all Guided_Checkin question options are reachable via screen reader focus order, announce their label text, role (button), and selection state ("selected" or "not selected") to assistive technology.
3. WHEN the user selects an option and auto-advances to the next question, THE App SHALL move screen reader focus to the new question prompt after the transition completes.
4. WHEN a new question appears in the Guided_Checkin flow, THE App SHALL announce the progress indicator state in the format "Question [N] of 4" to assistive technology.
5. THE App SHALL ensure all text in the Guided_Checkin flow meets WCAG 2.1 AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text).
6. WHEN the emotion picker is first displayed after a Guided_Checkin, THE App SHALL announce the Soft_Label to screen readers via a live region. THE App SHALL independently announce the normalizing message as a separate live region update regardless of whether the Soft_Label announcement succeeds.
7. THE back navigation and dismiss affordances SHALL be accessible with accessibility labels "Go back to previous question" and "Close guided check-in" respectively, and SHALL have a minimum tap target of 44 points in both width and height.
8. WHEN the user returns to the emotion picker after a Guided_Checkin, THE App SHALL move screen reader focus to the pre-selected emotion chip.
9. THE App SHALL ensure all interactive elements on the emotion picker (emotion chips, continue button, and "I'm not sure how I feel" button) are reachable via screen reader focus order and announce their label text and role to assistive technology.

### Requirement 10: Context Pre-fill from Guided Check-in

**User Story:** As a user who just completed the guided check-in, I want my "Where are you right now?" answer to carry over to the session context step, so I don't have to answer the same question twice.

#### Acceptance Criteria

1. WHEN the user accepts a feeling from the Guided_Checkin result screen, THE App SHALL automatically pre-select the corresponding context chip on the session context step using the user's Q4 (Social Context) answer.
2. THE App SHALL replace (not append to) any previously selected contexts when pre-filling from the Guided_Checkin. If the user completes the Guided_Checkin multiple times within the same session launcher, only the most recent Q4 answer SHALL be pre-selected.
3. THE session context step SHALL display exactly 4 context options: "At work/school", "With family", "With friends/social", "Alone at home". THE "I'm not sure" option SHALL NOT be displayed.
4. THE user SHALL be able to change, add to, or deselect the pre-filled context chip after returning from the Guided_Checkin — the pre-fill is a convenience, not a lock.

### Requirement 9: Performance and Data Schema

**User Story:** As a developer, I want the guided check-in data stored efficiently with proper schema support, so that the feature performs well and supports future analytics queries.

#### Acceptance Criteria

1. THE App SHALL create the `guided_checkin_records` table via a database migration with columns: `id` (TEXT PRIMARY KEY), `body_energy` (TEXT NOT NULL), `pleasantness` (TEXT NOT NULL), `thought_pattern` (TEXT NOT NULL), `context` (TEXT NOT NULL), `derived_feeling` (TEXT NOT NULL), `was_changed` (INTEGER NOT NULL DEFAULT 0), `final_emotion` (TEXT NOT NULL), and `recorded_at` (TEXT NOT NULL, UTC ISO 8601). The migration SHALL use `CREATE TABLE IF NOT EXISTS` for idempotency.
2. THE App SHALL create an index `idx_guided_checkin_recorded_at` on `guided_checkin_records(recorded_at)` for efficient date-range queries.
3. THE Mapping_Engine computation SHALL complete within 10 milliseconds for any valid input combination (pure in-memory computation with no async operations).
4. THE entire Guided_Checkin flow (from tapping "I'm not sure how I feel" through displaying the result) SHALL require no network requests and function fully offline.
5. IF the database write for a Checkin_Record fails, THEN THE App SHALL log the error to the console and continue the session without displaying an error to the user — the session SHALL proceed as if the record was saved successfully.
6. THE App SHALL add a nullable column `checkin_id` (TEXT) to the `emotion_sessions` table via database migration to reference the `guided_checkin_records.id` of the check-in that originated the session. THE App SHALL populate this column when creating a session from a Guided_Checkin and leave it NULL for all other sessions (direct emotion selection or any other session creation method).
7. THE App SHALL generate Checkin_Record IDs using UUID v4 via expo-crypto's `randomUUID()` function.
