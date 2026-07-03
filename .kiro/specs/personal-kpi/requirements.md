# Requirements Document

## Introduction

Personal KPI replaces the generic mood-logging system with a user-defined personal success indicator. Instead of a universal 1–10 mood slider, each user picks what "getting better" means to them personally — such as feeling calmer, sleeping better, or being more present. This choice happens during onboarding, and a seeded wallet card allows them to periodically record how they're doing on their chosen focus. The collected data lays the foundation for future insights without burdening the user with clinical-feeling prompts or blocking workflows.

## Glossary

- **Personal_KPI**: The user's self-selected definition of personal progress, chosen from a predefined list or entered as custom text (max 50 characters).
- **KPI_Option**: One of the predefined personal progress labels available during selection: "Feeling calmer", "Sleeping better", "Being more present", "Having more energy", "Feeling more connected", "Managing stress better", or "Other (custom)".
- **KPI_Selection_Step**: The onboarding screen where the user chooses their Personal_KPI from the list of KPI_Options.
- **KPI_Card**: A seeded wallet card (library origin, id `lib-personal-kpi`) that uses the user's chosen Personal_KPI as its label and contains a mood_slider control and an optional note field. The card is NOT displayed in the wallet stack; it is accessed via the KPI_FAB.
- **KPI_FAB**: A floating action button (🌱 sprout icon) positioned at the bottom-right of the wallet screen. It appears when the card stack is visible and hides when a card is focused. Tapping it opens the KPI_Card in focused view.
- **KPI_Record**: A single recorded entry capturing the user's self-reported value (integer 1–10), timestamp (UTC ISO 8601), and optional brief note (max 200 characters).
- **Onboarding_Flow**: The existing sequence of introductory screens: Welcome → Intent Selection → (new) KPI Selection → Wallet with micro-tutorial.
- **App**: The Mental Health Wallet application.
- **KPI_Store**: The Zustand store managing the user's Personal_KPI selection and KPI_Record persistence state.

## Requirements

### Requirement 1: KPI Selection During Onboarding

**User Story:** As a new user, I want to tell the app what "getting better" means to me personally, so that my check-in experience feels relevant and meaningful from the start.

#### Acceptance Criteria

1. WHEN the user completes the Intent Selection step during onboarding, THE App SHALL display the KPI_Selection_Step before advancing to the Wallet_Screen.
2. THE KPI_Selection_Step SHALL display a warm introductory question (e.g., "What does feeling better look like for you?") followed by exactly 7 selectable KPI_Options rendered as tappable choice buttons: "Feeling calmer", "Sleeping better", "Being more present", "Having more energy", "Feeling more connected", "Managing stress better", and "Other (write your own)".
3. WHEN the user selects one of the first 6 predefined KPI_Options, THE App SHALL persist that label as the Personal_KPI in the settings table and advance to the next onboarding step.
4. WHEN the user selects the "Other (write your own)" option, THE App SHALL display a text input field (max 50 characters, placeholder: "What matters most to you…") and a "Continue" button. THE "Continue" button SHALL remain disabled until the text input contains at least 2 non-whitespace characters. WHEN the user enters valid text and taps "Continue", THE App SHALL trim leading and trailing whitespace, persist the trimmed text as the Personal_KPI, and advance to the next onboarding step.
5. THE KPI_Selection_Step SHALL provide a visible "Skip" affordance (minimum tap target 44×44 points). WHEN the user taps "Skip", THE App SHALL set the Personal_KPI to "Feeling good overall" as a default and advance to the next onboarding step.
6. IF the user exits or backgrounds the App during the KPI_Selection_Step without completing a selection, THEN THE App SHALL present the KPI_Selection_Step again on the next launch until the user either makes a selection or explicitly skips.
7. THE KPI_Selection_Step SHALL allow the user to select exactly one option at a time, deselecting any previous choice when a new option is tapped.
8. THE KPI_Selection_Step SHALL support back navigation to the Intent Selection screen. WHEN the user navigates back and then returns to the KPI_Selection_Step, THE App SHALL reset the selection state (no option pre-selected).

### Requirement 2: KPI Card Seeding and FAB Access

**User Story:** As a new user who has chosen my personal focus, I want a quick way to check in on my progress without it cluttering my wallet, so that the check-in is always accessible but doesn't overwhelm me.

#### Acceptance Criteria

1. WHEN the user completes the KPI_Selection_Step (including via Skip), THE App SHALL seed the KPI_Card into the database with origin badge "library" and a mood_slider label matching the chosen Personal_KPI. The KPI_Card SHALL NOT appear in the wallet card stack.
2. IF a card with source_library_id `lib-personal-kpi` already exists in the user's wallet, THEN THE App SHALL NOT create a duplicate KPI_Card.
3. THE KPI_Card SHALL use the user's chosen Personal_KPI text as the mood_slider control label (e.g., if the user chose "Sleeping better", the slider label reads "Sleeping better").
4. THE KPI_Card SHALL contain exactly two controls in order: a mood_slider control (position 0, required, integer range 1–10, with minLabel "Not great" and maxLabel "Really good") and a text_input control (position 1, not required, label "Anything you want to note?", placeholder "A word or thought…", maxLength 200 characters).
5. THE KPI_Card SHALL have a fixed card definition with source_library_id `lib-personal-kpi`, title "My Check-In", description "A moment to check in with yourself on what matters to you.", icon type "emoji", icon value "🌱", background type "color", background value "#E8F5E9", and category "daily-checkin-journaling".
6. WHEN the user uses Skip_Intro from the Welcome screen (bypassing both Intent Selection and KPI Selection), THE App SHALL seed the KPI_Card with the default Personal_KPI label "Feeling good overall". IF a KPI_Card already exists in the wallet, THE App SHALL leave the existing card unchanged.
7. THE KPI_Card SHALL support the existing per-card reminder system — the user can configure reminders on the KPI_Card using the same flow as any other wallet card.
8. THE App SHALL display a KPI_FAB (🌱 sprout emoji, 56×56pt green circle) at the bottom-right of the wallet screen. The FAB SHALL be visible only when the card stack is fully shown (no card focused, not in reorder mode) and a KPI_Card exists in the database.
9. THE KPI_FAB SHALL animate in with a spring scale+fade when the stack becomes visible, and animate out when a card is focused.
10. WHEN the user taps the KPI_FAB, THE App SHALL focus the KPI_Card using the same focused card view as any other card. The remaining stack cards SHALL appear in the collapsed stack below.
11. WHEN the KPI_Card is focused, THE App SHALL display a personalized title "Daily check-in" and a description derived from the user's Personal_KPI (e.g., "Checking in on your calm" for "Feeling calmer"). An ⓘ icon SHALL appear inline at the end of the description.
12. WHEN the user taps the ⓘ icon on the focused KPI_Card, THE App SHALL display an inline tooltip below the description reading "This is based on what you chose during setup. You can change it in Settings" where "change it in Settings" is a tappable link navigating to the KpiChange screen. Tapping the ⓘ icon again SHALL dismiss the tooltip.
13. WHEN the user dismisses the KPI_Card (swipe down or tap collapsed stack), THE App SHALL return to the stack view and the KPI_FAB SHALL reappear.

### Requirement 3: KPI Recording via Card Completion

**User Story:** As a user, I want to record how I'm doing on my personal focus by completing my check-in card, so that I can build a history of my progress over time.

#### Acceptance Criteria

1. WHEN the user completes the KPI_Card, THE App SHALL store a KPI_Record in the local SQLite database containing: a unique ID (generated via expo-crypto UUID), the slider value (integer 1–10), the timestamp (UTC ISO 8601), and the note text (nullable, max 200 characters).
2. THE App SHALL store KPI_Records in a dedicated `kpi_records` table, separate from the generic completions table, to support efficient querying for future insights.
3. WHEN the KPI_Card completion is saved, THE App SHALL also record it in the standard completions table with the card ID (`lib-personal-kpi`) and the control values (slider value and note), maintaining compatibility with streak counting and usage statistics on the card.
4. WHEN the user completes the KPI_Card, THE App SHALL persist the KPI_Record within 500 milliseconds measured from the moment the user taps the submit action to the moment the database write is confirmed.
5. IF the database write for the KPI_Record fails, THEN THE App SHALL retry the write exactly once. IF the retry also fails, THEN THE App SHALL log the failure silently and continue without displaying an error to the user. The standard completion record SHALL still be persisted independently. IF the standard completion write fails independently, THEN THE App SHALL NOT block or roll back a successful KPI_Record write.
6. THE App SHALL support querying KPI_Records by date range (inclusive start and end dates) with results returned in reverse chronological order (newest first), paginated with a default page size of 50 records.
7. WHEN the user has not moved the slider from its default position and taps the submit action, THE App SHALL record the KPI_Record using whatever value the slider currently displays (default: 5).

### Requirement 4: KPI Modification After Onboarding

**User Story:** As a user whose priorities have shifted, I want to change what I'm focusing on, so that my check-in card stays relevant to my current life.

#### Acceptance Criteria

1. THE App SHALL provide a "What I'm focusing on" option in the Settings screen that displays the user's current Personal_KPI text and a chevron indicating it is tappable, with a minimum tap target of 44×44 points.
2. WHEN the user taps the "What I'm focusing on" setting, THE App SHALL display the same KPI_Option list used during onboarding (the 7 options including "Other") with the current selection highlighted, and a way to dismiss or navigate back without making a change.
3. WHEN the user selects a predefined KPI_Option different from their current Personal_KPI, THE App SHALL immediately persist the new Personal_KPI value and update the KPI_Card's mood_slider label to reflect the new choice before returning the user to the Settings screen.
4. WHEN the user selects "Other (write your own)", THE App SHALL display a text input field (max 50 characters, non-empty after trimming whitespace) pre-filled with the current custom text if the existing Personal_KPI is custom, and a "Save" button. WHEN the user enters valid text and taps "Save", THE App SHALL persist the custom text as the new Personal_KPI and update the KPI_Card's mood_slider label.
5. IF the user selects the same KPI_Option they already have, THEN THE App SHALL return to the Settings screen without creating a change history record.
6. WHEN the Personal_KPI is changed, THE App SHALL NOT delete or modify existing KPI_Records — all historical data is preserved regardless of label changes.
7. WHEN the Personal_KPI is changed to a different value, THE App SHALL append a record to the change history containing the previous value, the new value, and the timestamp (UTC ISO 8601) to support future insights that may need to distinguish between KPI periods.
8. IF the user dismisses or navigates back from the KPI_Option list without selecting a new option, THEN THE App SHALL retain the current Personal_KPI unchanged and return to the Settings screen.

### Requirement 5: Data Schema and Storage

**User Story:** As a developer, I want KPI data stored in a well-structured local schema, so that future insights features can efficiently query and aggregate the records.

#### Acceptance Criteria

1. THE App SHALL create a `kpi_records` table via database migration with columns: `id` (TEXT PRIMARY KEY), `value` (INTEGER NOT NULL, CHECK value >= 1 AND value <= 10), `note` (TEXT, nullable, max 200 characters), `kpi_label` (TEXT NOT NULL, max 50 characters — the Personal_KPI label at time of recording), and `recorded_at` (TEXT NOT NULL, UTC ISO 8601 timestamp).
2. THE App SHALL create an index on `kpi_records(recorded_at)` for efficient date-range queries.
3. THE App SHALL store the user's current Personal_KPI selection in the settings table under the key `personal_kpi` as a plain text value (max 50 characters).
4. THE App SHALL store KPI change history in the settings table under the key `personal_kpi_history` as a JSON array of objects, each containing `previous_value` (TEXT), `new_value` (TEXT), and `changed_at` (TEXT, UTC ISO 8601 timestamp) fields.
5. WHEN a KPI_Record is created, THE App SHALL populate the `kpi_label` column with the user's current Personal_KPI value at the time of recording, ensuring historical records remain meaningful even if the user later changes their focus.
6. IF the database migration for the `kpi_records` table fails on app launch, THEN THE App SHALL retry the migration exactly once. IF the retry also fails, THEN THE App SHALL prevent KPI recording functionality and log the failure silently without crashing. The retry limit resets on each app restart, allowing additional attempts on subsequent launches.

### Requirement 6: Tone and Language

**User Story:** As a user, I want the check-in experience to feel supportive and personal, so that I look forward to using it rather than feeling measured or judged.

#### Acceptance Criteria

1. THE App SHALL NOT use the words "KPI", "metric", "data", "tracking", "score", "performance", or "measurement" in any user-facing text within the KPI_Selection_Step, KPI_Card, the "What I'm focusing on" Settings option, or any reminder notifications associated with the KPI_Card.
2. THE App SHALL use second-person conversational language (e.g., "you", "your") throughout the KPI_Selection_Step and KPI_Card, SHALL NOT use imperative commands (e.g., "Define your goal", "Enter your target"), and SHALL NOT use clinical or diagnostic terminology (e.g., "assess", "evaluate", "diagnose", "symptom").
3. THE KPI_Card description and control labels SHALL use supportive phrasing: the slider anchors "Not great" and "Really good" rather than numeric or clinical labels.
4. THE KPI_Selection_Step SHALL use language at or below an 8th-grade reading level as measured by the Flesch-Kincaid Grade Level formula, and SHALL contain no more than 30 words in the introductory question.
5. THE App SHALL frame the "Skip" option on the KPI_Selection_Step without using urgency language (e.g., "Don't miss out", "Are you sure?"), loss-framing language (e.g., "You'll miss…", "Without this…"), or guilt-inducing language (e.g., "You should really…"). The skip label SHALL be either "I'll decide later" or "Skip".

### Requirement 7: Accessibility

**User Story:** As a user with accessibility needs, I want the KPI selection and check-in card to be fully accessible, so that I can use the feature with assistive technology.

#### Acceptance Criteria

1. THE KPI_Selection_Step SHALL ensure all KPI_Option buttons are reachable via screen reader focus order and announce their label text and selected state to assistive technology.
2. THE KPI_Selection_Step SHALL ensure each KPI_Option button has a minimum tap target of 44 points in both width AND height.
3. WHEN the "Other" option is selected and the text input appears, THE App SHALL move screen reader focus to the text input field.
4. WHEN the user adjusts the KPI_Card's mood_slider control, THE App SHALL announce the current numeric value, the label (Personal_KPI text), and the min/max anchor labels ("Not great" / "Really good") to assistive technology.
5. THE App SHALL ensure all text on the KPI_Selection_Step meets WCAG 2.1 AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text).
6. WHEN a validation error occurs on the custom text input (fewer than 2 non-whitespace characters), THE App SHALL announce the error message to assistive technology via an accessibility live region.

### Requirement 8: Integration with Existing Onboarding

**User Story:** As a developer, I want the KPI selection step to integrate cleanly with the existing onboarding flow, so that the user experience remains cohesive and the implementation reuses existing infrastructure.

#### Acceptance Criteria

1. THE KPI_Selection_Step SHALL be inserted into the Onboarding_Flow after Intent Selection and before the wallet is displayed, making the full flow: Welcome → Intent Selection → KPI Selection → Wallet with micro-tutorial.
2. THE Onboarding_Store SHALL persist a `kpiSelectionComplete` boolean flag (default: false). WHEN the KPI_Selection_Step is completed (via selection or skip), THE App SHALL set this flag to true. THE App SHALL navigate to the Wallet screen only when both `onboardingScreensComplete` and `kpiSelectionComplete` are true.
3. WHEN the user closes the app after completing Intent Selection but before completing KPI Selection, THE App SHALL resume at the KPI_Selection_Step on the next launch without preserving any in-progress custom text input.
4. WHEN a user launches the updated app and the system detects legacy status by computing it from the explicit criteria (existing `disclaimer_acknowledged` flag with no `onboarding_state` JSON, or `onboarding_state` with `onboardingScreensComplete` true but no `kpiSelectionComplete` field), THE App SHALL set `kpiSelectionComplete` to true during state loading, seed the KPI_Card with the default label "Feeling good overall" if no KPI_Card exists, and SHALL NOT display the KPI_Selection_Step.
5. THE KPI_Selection_Step SHALL use the existing `choice_buttons` interaction pattern from the onboarding Intent Selection screen for visual and behavioral consistency.
6. WHEN the user taps "Skip intro" on the Welcome screen (bypassing both Intent Selection and KPI Selection), THE App SHALL set `kpiSelectionComplete` to true, seed the KPI_Card with the default Personal_KPI label "Feeling good overall", and navigate directly to the Wallet screen.
7. WHEN the `completeOnboardingScreens` action is called (Intent Selection completed), THE App SHALL set `onboardingScreensComplete` to true and navigate to the KPI_Selection_Step rather than directly to the Wallet screen.
