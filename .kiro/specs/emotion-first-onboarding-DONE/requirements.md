# Requirements Document

## Introduction

Emotion-First Onboarding & "Start from How I Feel" Sessions enables users to begin their Mental Health Wallet experience from their current emotional state rather than browsing tools directly. The feature introduces a mode choice during onboarding, a persistent "Start from how I feel" card in the wallet, an emotion picker with optional context refinement, and a focused session view that recommends relevant tools based on the selected emotion, context, and available time.

## Glossary

- **Onboarding_Mode_Choice**: The screen presented during onboarding that lets the user select between wallet-first and emotion-first as their default start experience
- **Start_Mode**: The persisted user preference indicating whether the app opens to the wallet view or the emotion-first flow on launch; valid values are "wallet", "emotion", or "last_used"
- **Session_Launcher_Card**: A special non-deletable card in the wallet with type "session_launcher" that initiates the emotion-first session flow when tapped
- **Emotion_Picker**: The UI component displaying selectable emotion chips that the user taps to indicate their current emotional state
- **Context_Chips**: Optional selectable labels indicating the user's current situational context (e.g., "At work/school", "Alone at home")
- **Time_Chips**: Optional selectable labels indicating the user's available time for a session (e.g., "~1–2 minutes", "~5–10 minutes")
- **Emotion_Session**: A tracked interaction that begins when the user selects an emotion and ends when the user taps "End session" or closes the session view
- **Session_View**: The screen anchored to the Session_Launcher_Card that displays tool recommendations grouped by source (wallet tools and suggested library tools)
- **Emotion_Tag**: A metadata association between a tool card and one or more emotions, used for recommendation matching
- **Wallet_Screen**: The main stacked card interface displaying the user's personal tool collection
- **Curated_Library**: The pre-defined collection of mental health tool cards available for users to add to their wallet
- **Settings_Screen**: The app settings interface where users can modify preferences including Start_Mode

## Requirements

### Requirement 1: Onboarding Mode Choice

**User Story:** As a new user, I want to choose whether to start from my wallet or from how I feel, so that the app matches my preferred way of engaging with mental health tools.

#### Acceptance Criteria

1. WHEN the existing onboarding flow completes Intent Selection (user selects an intent and Starter_Cards are seeded) and no Start_Mode value exists in the local database, THE Onboarding_Mode_Choice SHALL display a screen with the prompt "How would you like to start?" and two options: "Open my wallet of tools" and "Start from how I feel right now."
2. WHEN the user selects "Open my wallet of tools," THE Onboarding_Mode_Choice SHALL persist Start_Mode as "wallet" in the local database and navigate to the Wallet_Screen with the standard stacked card view (where the Micro_Tutorial will trigger as defined in the onboarding spec).
3. WHEN the user selects "Start from how I feel right now," THE Onboarding_Mode_Choice SHALL persist Start_Mode as "emotion" in the local database and navigate to the Wallet_Screen with the Session_Launcher_Card scrolled into view and visually highlighted. THE Micro_Tutorial SHALL be deferred — it SHALL NOT trigger on this first wallet visit and SHALL instead trigger the next time the user lands on the Wallet_Screen without an active emotion session.
4. THE Onboarding_Mode_Choice screen SHALL display reassurance text: "You can always change this in Settings."
5. THE Onboarding_Mode_Choice screen SHALL present exactly one decision with no additional questions or form fields.
6. IF Start_Mode already exists in the local database, THEN THE app SHALL skip the Onboarding_Mode_Choice screen and proceed to the appropriate launch destination based on the persisted Start_Mode value.
7. THE Onboarding_Mode_Choice screen SHALL NOT provide a back navigation action — the user must select one of the two options to proceed.
8. IF persisting Start_Mode to the local database fails, THEN THE Onboarding_Mode_Choice SHALL display an error message indicating the preference could not be saved and allow the user to retry the selection.
9. WHEN the user uses "Skip Intro" from the Welcome screen (as defined in the onboarding spec), THE app SHALL default Start_Mode to "wallet" and skip the Onboarding_Mode_Choice screen, proceeding directly to the Wallet_Screen.

### Requirement 2: Subsequent Launch Behavior

**User Story:** As a returning user, I want the app to open in my preferred mode automatically, so that I reach my tools or emotion-first flow without extra taps.

#### Acceptance Criteria

1. WHEN a returning user launches the app with Start_Mode set to "wallet," THE app SHALL navigate directly to the Wallet_Screen with the standard stacked card view and no card initially focused.
2. WHEN a returning user launches the app with Start_Mode set to "emotion," THE app SHALL navigate to the Wallet_Screen with the Session_Launcher_Card scrolled into view and visually highlighted (e.g., elevated or pulsed) for 1 second to draw attention.
3. WHEN a returning user launches the app with Start_Mode set to "last_used," THE app SHALL read the last recorded mode from the local database and navigate using that mode. IF no last recorded mode exists (e.g., first launch after selecting "last_used"), THEN THE app SHALL default to "wallet" behavior.
4. THE app SHALL read Start_Mode from the local database on each launch and apply the corresponding navigation behavior.
5. IF Start_Mode is missing or contains an invalid value in the local database, THEN THE app SHALL default to "wallet" behavior and persist "wallet" as the Start_Mode.
6. WHEN a session ends (via "End session" tap or navigation away), THE app SHALL record the current mode ("wallet" or "emotion") as the last used mode in the local database for use by the "last_used" setting.

### Requirement 3: Start Mode Settings Control

**User Story:** As a user, I want to change my start preference in Settings at any time, so that I can adapt the app to my evolving needs.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a "Start experience" preference control with three mutually exclusive options: "Start in my wallet" (maps to Start_Mode "wallet"), "Start from how I feel" (maps to Start_Mode "emotion"), and "Start where I left off" (maps to Start_Mode "last_used"), with the currently persisted Start_Mode value shown as selected.
2. WHEN the user selects a new start experience option, THE Settings_Screen SHALL persist the updated Start_Mode to the local database before any subsequent navigation away from the Settings_Screen, and SHALL update the control to visually reflect the new selection.
3. IF the database write fails, times out, or returns an ambiguous status when persisting Start_Mode, THEN THE Settings_Screen SHALL revert the control to the previous selection and display an error message indicating the preference was not saved.
4. WHEN the user changes Start_Mode in Settings, THE app SHALL apply the new preference on the next launch without requiring an app restart.

### Requirement 4: Session Launcher Card

**User Story:** As a user, I want a dedicated card in my wallet that lets me start an emotion-based session at any time, so that the emotion-first flow is always accessible from my main view.

#### Acceptance Criteria

1. THE Wallet_Screen SHALL contain a Session_Launcher_Card with the title "Start from how I feel" and the subtitle "Tell the app what you're dealing with to get suggested tools."
2. THE Session_Launcher_Card SHALL exist in every user's wallet by default after onboarding completes, positioned below the Starter_Cards in the stack initially (so that the Micro_Tutorial points at a coping tool rather than the session launcher).
3. THE Session_Launcher_Card SHALL be reorderable within the card stack using the same reorder mechanism as other cards.
4. THE Session_Launcher_Card SHALL be archivable using the same archive mechanism as other cards, allowing the user to remove the card from the active wallet view.
5. THE Session_Launcher_Card SHALL be restorable from the archive using the same restore mechanism as other cards.
6. THE Session_Launcher_Card SHALL NOT be permanently deletable from the archive. THE archive/delete logic SHALL check the card type before allowing permanent deletion and SHALL prevent deletion of cards with type "session_launcher."
7. WHEN the user taps the Session_Launcher_Card, THE card SHALL expand and display the Emotion_Picker as its content — the entire session flow (Emotion_Picker, context/time refinement, and Session_View recommendations) SHALL render visually within the expanded Session_Launcher_Card. This expanded behavior is unique to the session_launcher card type and differs from the standard card expansion (which shows tool instructions and controls).
8. THE Session_Launcher_Card SHALL be visually distinguishable from other cards (e.g., unique icon or accent color) so the user can identify it at a glance in the card stack. THE Session_Launcher_Card SHALL be background-customizable (`allowBackgroundCustomization: true`) like other library cards.
9. WHEN the user taps outside the expanded Session_Launcher_Card or uses a collapse gesture, THE card SHALL collapse back to its stacked state, discarding any unsaved selections (if no session was started).
10. THE Session_Launcher_Card SHALL be included in the wallet card count for purposes of the empty wallet state. IF all cards (including the Session_Launcher_Card) are archived, THEN THE empty wallet state SHALL trigger.
11. WHEN the user is viewing a wallet tool during an active Emotion_Session AND the Session_Launcher_Card is NOT focused, THE app SHALL display a floating "Session active · Tap to return" banner. WHEN the user taps the banner, THE app SHALL return the user to the Session_Launcher_Card expanded view with the active session state preserved.

### Requirement 5: Emotion Picker

**User Story:** As a user, I want to select my current emotion from a set of relatable options, so that the app can suggest tools relevant to what I am experiencing.

#### Acceptance Criteria

1. WHEN the Emotion_Picker is displayed, THE Emotion_Picker SHALL show the prompt "How are you feeling right now?" with selectable emotion chips defined by the Session_Launcher_Card's control configuration. The initial set of emotion chips SHALL be: "Stressed," "Overwhelmed," "Anxious," "Sad/low," "Angry," and "Numb."
2. WHEN the user selects an emotion chip, THE Emotion_Picker SHALL visually distinguish the selected chip from unselected chips (e.g., contrasting background or border) and enable the "Show me tools" action so the user can proceed to view recommendations within the same expanded card view.
3. THE Emotion_Picker SHALL allow selection of exactly one emotion at a time. WHEN the user taps a different emotion chip while one is already selected, THE Emotion_Picker SHALL deselect the previously selected chip and select the newly tapped chip, keeping the "Show me tools" action enabled throughout the transition without briefly disabling it.
4. WHEN the user taps the currently selected emotion chip, THE Emotion_Picker SHALL deselect it, returning all chips to their unselected state and disabling the "Show me tools" action.
5. THE Emotion_Picker SHALL use "feeling" and "what you're dealing with" language in its prompt and labels. THE Emotion_Picker SHALL NOT use clinical terms including "mood," "affect," "diagnose," or "disorder" in any user-visible text within the picker.
6. THE emotion chip options SHALL be stored as a control configuration on the Session_Launcher_Card (consistent with how other cards define their controls), so that additional emotions can be added over time through the same data layer without code changes.
7. THE Emotion_Picker SHALL expose each emotion chip as an accessible selectable element with its label text as the accessibility label and its selected/unselected state communicated to assistive technologies.

### Requirement 6: Context and Time Refinement

**User Story:** As a user, I want to optionally specify my current context and available time, so that the app can narrow down tool suggestions to what fits my situation.

#### Acceptance Criteria

1. THE Session_Launcher_Card expanded view SHALL display the Emotion_Picker, Context_Chips, and Time_Chips together on a single screen (consistent with how other cards display all controls at once).
2. THE Context_Chips SHALL be labeled with the options: "At work/school," "With family," "With friends/social," "Alone at home," and "I'm not sure."
3. THE Context_Chips SHALL allow selection of one or more chips simultaneously (up to all available options). WHEN the user taps a selected Context_Chip, THE chip SHALL deselect (toggle behavior).
4. THE Time_Chips SHALL be labeled with the options: "I have ~1–2 minutes" and "I have ~5–10 minutes."
5. THE Time_Chips SHALL allow selection of at most one chip at a time. WHEN the user selects a Time_Chip while another is already selected, THE previously selected chip SHALL deselect. WHEN the user taps the currently selected Time_Chip, THE chip SHALL deselect, resulting in no time selection.
6. THE Context_Chips and Time_Chips SHALL be optional — the user SHALL be able to proceed to the Session_View by selecting only an emotion.
7. WHEN the user proceeds from the selection screen, THE app SHALL persist the selected emotion, any selected context chips, and any selected time chip to the Emotion_Session object. IF persistence fails, THEN THE app SHALL allow the user to proceed to the Session_View without blocking, and SHALL retry persistence when the session ends.
8. THE Context_Chips and Time_Chips options SHALL be stored as control configurations on the Session_Launcher_Card (consistent with how emotion chips are stored per Requirement 5), so that options can be updated through the data layer without code changes.

### Requirement 7: Emotion-Based Tool Recommendations

**User Story:** As a user, I want to see tools from my wallet and from the library that are relevant to my current emotion, so that I can quickly find something helpful without browsing.

#### Acceptance Criteria

1. WHEN the user confirms their selections (by tapping a "Show me tools" action after selecting at least an emotion), THE Session_View SHALL display recommended tools below the selection controls within the expanded Session_Launcher_Card. The selection controls (emotion, context, time) SHALL remain visible and editable above the recommendations. Recommendations SHALL be shown as a scrollable list of card previews (showing each card's icon, title, and a description of at most 80 characters) organized in two labeled sections: "From your wallet" (Section 1) containing 1–3 tools from the user's wallet that have matching Emotion_Tags, and "Suggested tools to try" (Section 2) containing 1–3 tools from the Curated_Library that have matching Emotion_Tags and are not already in the user's wallet.
2. WHEN the user changes any selection (emotion, context, or time) after recommendations are displayed, THE Session_View SHALL require the user to tap the "Show me tools" action again to refresh the recommendations based on the updated selections.
3. THE recommendation engine SHALL filter tools by exact match on the selected emotion (the tool's Emotion_Tags must include the selected emotion), rank matching tools by context relevance (tools with context associations matching any selected Context_Chip are ranked above those without), and exclude tools whose time association does not include the selected Time_Chip when a Time_Chip is selected. IF no Time_Chip is selected, THEN THE recommendation engine SHALL not apply any duration filtering.
4. IF no wallet tools match the selected emotion, THEN THE Session_View SHALL omit the "From your wallet" section and display only "Suggested tools to try."
5. IF no library tools match the selected emotion (excluding tools already in the wallet), THEN THE Session_View SHALL omit the "Suggested tools to try" section.
6. IF no tools from either source match the selected emotion, THEN THE Session_View SHALL display a fallback message: "We don't have a specific match right now. Here are some general tools that might help." followed by up to 3 card previews selected from tools that have the highest number of Emotion_Tag associations (most broadly applicable tools), preferring tools not already in the user's wallet.
7. WHEN multiple tools match the selected emotion within a section, THE Session_View SHALL display them ordered by context relevance first (tools matching selected Context_Chips appear before those that do not), then by alphabetical title order as a tiebreaker, and SHALL display at most 3 tools per section.
8. IF fewer than 3 tools match the selected emotion in either section, THEN THE Session_View SHALL display all matching tools (1 or 2) without padding the section with non-matching tools.

### Requirement 8: Emotion Tagging of Tools

**User Story:** As a product team, I want tools tagged by emotion and context, so that the recommendation engine can match tools to the user's current state.

#### Acceptance Criteria

1. THE Curated_Library SHALL include Emotion_Tag metadata for each card, associating the card with at least 1 and at most 4 emotions from the set: "stressed," "overwhelmed," "anxious," "sad," "angry," and "numb."
2. THE Emotion_Tag associations SHALL be stored in a configurable data source so that tag mappings can be updated without code changes.
3. WHEN a user adds a card from the Curated_Library to their wallet, THE card SHALL retain the Emotion_Tag, context, and time associations from the library definition.
4. THE Emotion_Tag data model SHALL support optional context associations (e.g., "at_work," "alone") and optional time associations (e.g., "~1–2 minutes," "~5–10 minutes") as secondary attributes for finer-grained matching, with a maximum of 4 context values and 1 time value per card.
5. THE existing curated library cards SHALL have the following initial Emotion_Tag mappings:
   - "5-4-3-2-1 Grounding": stressed, overwhelmed, anxious
   - "Box Breathing": stressed, anxious
   - "Progressive Muscle Relaxation": stressed, anxious, angry
   - "Thought – Feeling – Action": anxious, sad, angry
   - "Decatastrophizing": anxious, overwhelmed
   - "Body Scan in 3 Minutes": stressed, overwhelmed, numb
   - "Daily Mood Check-In": sad, numb
   - "Win of the Day": sad, numb
   - "Self-Compassion Pause": sad, overwhelmed, angry
   - "You Are Not Alone": sad, numb, overwhelmed
   - "Reach Out": sad, numb
6. THE existing curated library cards SHALL have the following initial context associations (used as ranking signals, not hard filters):
   - "At work/school": Box Breathing, 5-4-3-2-1 Grounding, Decatastrophizing, Self-Compassion Pause
   - "Alone at home": Progressive Muscle Relaxation, Body Scan in 3 Minutes, Thought – Feeling – Action, Daily Mood Check-In, Win of the Day
   - "With family": Self-Compassion Pause, You Are Not Alone, Reach Out
   - "With friends/social": Reach Out, You Are Not Alone
7. THE existing curated library cards SHALL have the following initial time associations:
   - "~1–2 minutes": Box Breathing, Self-Compassion Pause, You Are Not Alone, Win of the Day, Daily Mood Check-In
   - "~5–10 minutes": 5-4-3-2-1 Grounding, Progressive Muscle Relaxation, Body Scan in 3 Minutes, Thought – Feeling – Action, Decatastrophizing, Reach Out
8. IF a curated library card definition is missing an Emotion_Tag association, THEN THE system SHALL skip that card definition during seed data validation, continue processing all remaining valid cards, and report all validation errors (including which cards lack emotion tags) at the end of the seed loading process. Cards without Emotion_Tags SHALL still function normally in the wallet and library — they simply will not appear in emotion-based session recommendations.
9. WHEN the curated library is expanded beyond the initial 11 tagged cards (e.g., via the library-enhancements spec), THE new cards SHALL have Emotion_Tag mappings added to the seed data configuration. Until tags are defined for a new card, that card SHALL be excluded from emotion-based recommendations but remain available in the library browser and wallet.

### Requirement 9: Custom Tool Emotion Tagging

**User Story:** As a user who creates custom tools, I want to optionally tag my tools with emotions, so that they appear in my emotion-based sessions when relevant.

#### Acceptance Criteria

1. WHEN a user creates a custom tool in the Card Creator, THE Card Creator SHALL display an optional "When does this tool help?" section with selectable emotion chips using the same emotion set as the Emotion_Picker ("Stressed," "Overwhelmed," "Anxious," "Sad," "Angry," "Numb"), allowing the user to select one or more emotions. This section SHALL appear after the controls configuration step and before the final save action, so it does not conflict with other Card Creator additions (e.g., media controls from the tool-customization spec).
2. THE Card Creator's emotion tagging section SHALL be skippable — the user SHALL be able to create a card without selecting any Emotion_Tags, and the card SHALL be saved with an empty Emotion_Tags association.
3. WHEN a user saves a card with one or more Emotion_Tags selected, THE Card Creator SHALL persist the selected Emotion_Tags to the local database as part of the card record.
4. WHEN a user opens a user-created card in edit mode, THE card settings SHALL display the emotion tagging section with any previously assigned Emotion_Tags pre-selected, and SHALL allow the user to add, remove, or change Emotion_Tags.
5. WHEN a user-created card has Emotion_Tags assigned and the user opens a Session_View with a selected emotion, THE recommendation engine SHALL include the card in Session_View results under "From your wallet" if at least one of the card's Emotion_Tags matches the selected emotion. IF a card's Emotion_Tag data is corrupted or inconsistent in the database, THEN THE recommendation engine SHALL exclude that card from results.
6. WHEN a user modifies Emotion_Tags on an existing card, THE Card Creator SHALL persist the updated tags to the local database in the background, allowing the user to continue interacting with the app immediately without blocking on persistence completion.

### Requirement 10: Session View Interactions

**User Story:** As a user, I want to open and use recommended tools directly from the session view, so that I can complete an exercise without navigating away from the session context.

#### Acceptance Criteria

1. WHEN the user taps a tool card preview in the Session_View: (a) IF the tool is a library tool (not in the user's wallet), THE app SHALL open it in an inline preview (LibraryToolPreview) within the session — the tool does NOT need to be added to the wallet first; (b) IF the tool is a wallet tool, THE app SHALL navigate to the wallet card's focused/expanded view. WHEN the user is viewing a wallet tool during an active Emotion_Session and the Session_Launcher_Card is NOT focused, THE app SHALL display a floating "Session active · Tap to return" banner that, when tapped, returns the user to the Session_Launcher_Card expanded view.
2. THE Session_View SHALL allow the user to use multiple tools within the same Emotion_Session without restarting the session, and SHALL append each opened tool's card ID to the Emotion_Session's list of tool card IDs.
3. WHEN the user finishes using a tool and navigates back from the expanded view, THE Session_View SHALL remain in its current state with the same recommendations visible and the same scroll position preserved.
4. THE Session_View SHALL display an "Add to wallet" option for library tools both in the LibraryToolPreview footer AND in the recommendation list next to each tool in the "Suggested tools to try" section. WHEN the user taps "Add to wallet," THE app SHALL add the tool card to the user's wallet with origin badge "library," store a `source_library_id` linking the wallet card back to the library source, persist the card to the database, immediately reload the wallet store so the card appears in the wallet, display a brief confirmation (e.g., toast or inline checkmark), and move the tool from the "Suggested tools to try" section to the "From your wallet" section in the current Session_View.
5. WHEN the "Add to wallet" operation succeeds: THE wallet store SHALL be reloaded so the card appears immediately, THE recommendations SHALL be refreshed so the tool moves from "Suggested tools to try" to "From your wallet," AND a `source_library_id` SHALL be stored on the wallet card for future deduplication between wallet cards and their library source. IF any step in this operation fails (e.g., database persistence fails), THEN THE app SHALL abort the entire operation, leave the tool in the "Suggested tools to try" section, and display an error message.
6. IF the user taps "Add to wallet" for a tool that is already in the user's wallet (e.g., added from a different session), THEN THE app SHALL display a message indicating the tool is already in the wallet and SHALL NOT create a duplicate card.
7. WHEN a card is opened from the Session_View during an active Emotion_Session, THE mood-logging pre-use mood slider SHALL be suppressed for that card use. THE post-completion mood slider SHALL still appear after the user completes the card exercise, providing per-tool mood data without asking the user to re-report their emotional state twice.

### Requirement 11: Session Lifecycle

**User Story:** As a user, I want a clear way to end my emotion-based session, so that I know the session is complete and can return to my wallet.

#### Acceptance Criteria

1. THE Session_View SHALL display an "End session" action button in a fixed position that remains visible without scrolling, regardless of the recommendation list length.
2. WHEN the user taps "End session," THE app SHALL mark the Emotion_Session as ended, record the end timestamp, create a completion record for the Session_Launcher_Card containing the session's emotion, context, time, tools tried (by title), and tools added to wallet, reload the wallet store so the stats panel reflects the new completion, and navigate back to the Wallet_Screen. This completion SHALL appear in the Usage History for the Session_Launcher_Card.
3. WHEN the user navigates away from the Session_View without tapping "End session" (via back navigation, app backgrounding, or app termination), THE app SHALL mark the Emotion_Session as ended with the navigation or backgrounding timestamp. IF the app is terminated before the end timestamp can be written, THEN THE app SHALL detect the unterminated session on next launch and record the end timestamp as the last known backgrounding time or, if unavailable, the session start timestamp plus the elapsed duration of opened tools.
4. THE Emotion_Session object SHALL track: session start timestamp, selected emotion, selected context chips (zero or more), selected time chip (zero or one), list of tool card IDs opened during the session (zero or more), and session end timestamp.
5. WHEN an Emotion_Session starts (upon emotion selection), THE app SHALL create and persist the Emotion_Session record to the local database within 100 milliseconds of the emotion chip tap.
6. IF the Emotion_Session record fails to persist to the local database, THEN THE app SHALL allow the user to continue the session flow without interruption and retry persistence when the session ends.
7. IF a previous Emotion_Session exists without an end timestamp when a new emotion selection occurs, THEN THE app SHALL mark the previous session as ended (using the current timestamp) before creating the new Emotion_Session record.

### Requirement 12: Privacy and Tone

**User Story:** As a user, I want the emotion selection to feel voluntary and non-judgmental, so that I feel comfortable being honest about how I feel.

#### Acceptance Criteria

1. THE Emotion_Picker SHALL use the terms "feeling" and "what you're dealing with" as primary language, and SHALL NOT use clinical terms including "mood," "affect," "diagnose," "disorder," "symptoms," or "treatment" in any user-facing label, prompt, or heading.
2. THE Emotion_Picker SHALL display a visible dismiss affordance (close button or "Not right now" label) that returns the user to the Wallet_Screen without requiring emotion selection. The dismiss affordance SHALL use neutral language and SHALL NOT use guilt-inducing or pressuring phrasing such as "Are you sure?" or "You should try this."
3. WHEN the user dismisses the Emotion_Picker before tapping "Show me tools," THE app SHALL discard any partial selections (emotion, context, or time chips) and SHALL NOT create or persist an Emotion_Session record.
4. THE Session_View SHALL NOT display language that labels the user's emotional state as a problem to fix, a condition to treat, or abnormal. Specifically, phrasing such as "fix your mood," "treat your anxiety," or "what's wrong with you" SHALL NOT appear in any user-facing text.
5. THE app SHALL not transmit emotion selection data to any external server — all Emotion_Session data SHALL remain in the local database.
6. THE app SHALL NOT make any outbound network requests containing Emotion_Session fields (selected emotion, context chips, time chip, or session timestamps).

### Requirement 13: Performance

**User Story:** As a user, I want the emotion-first flow to feel instant and lightweight, so that accessing tools based on my feelings does not add friction.

#### Acceptance Criteria

1. WHEN the user taps the Session_Launcher_Card, THE Emotion_Picker SHALL become fully interactive (all emotion chips visible and tappable) within 220 milliseconds (200ms target + 20ms tolerance) measured on a device meeting the minimum supported hardware baseline (iPhone 12 or equivalent Android device with 4 GB RAM).
2. WHEN the user taps the "Show me tools" action after completing emotion and optional context selection, THE Session_View with recommendation card previews SHALL become fully interactive (all recommended card previews visible and tappable) within 320 milliseconds (300ms target + 20ms tolerance) measured on the same minimum hardware baseline.
3. THE emotion-first flow SHALL NOT require network connectivity — all recommendation logic and data SHALL operate from the local database and in-memory data.
4. IF the local database query fails or returns an error during the emotion-first flow, THEN THE app SHALL display the Session_View with the fallback message defined in Requirement 7 criterion 6 within 300 milliseconds, without crashing or showing an unhandled error state.
