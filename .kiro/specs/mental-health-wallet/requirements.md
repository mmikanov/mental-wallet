# Requirements Document

## Introduction

Mental Health Wallet is a mobile-first application that unifies scattered mental health coping tools into a personalized, habit-forming toolkit. Users collect "cards" (coping tools, exercises, reminders, trackers) from a curated community library or create their own. The app uses a stacked card interaction (inspired by Apple Wallet) combined with reminders, habit tracking, and mood analytics to help users discover which tools work best for them. The MVP targets general consumers (ages 18–55) interested in self-help and mental wellness.

## Glossary

- **Wallet**: The main app screen displaying the user's collection of cards in a reverse-stacked, interactive layout.
- **Card**: A discrete mental health tool or exercise stored in the Wallet, composed of a Card_Shell plus an ordered list of Controls.
- **Card_Shell**: The four mandatory fields every card must have: Title, Description, Icon, and Background (a color/gradient or uploaded image).
- **Control**: A configurable UI element (field type) used in cards (e.g., text input, mood slider, static text block, checkbox, link button). Cards are composed of one or more Controls.
- **Template**: A pre-configured combination of Controls for common use cases (e.g., Affirmation, Instruction, Check-In, Journaling, Mood Tracker). Templates are starting points that users can modify.
- **Link_Button_Control**: A Control type that opens external apps (via deep link) or websites (via URL) and logs the activation.
- **Focused_Card**: A card that is currently selected and displayed in full view on the Wallet screen.
- **Expanded_Card**: A Focused_Card that has grown vertically to show full tool content and input fields without navigating to a new screen.
- **Stacked_View**: The default Wallet layout where cards are arranged bottom-to-top with only the top edges visible.
- **Curated_Library**: A hand-selected collection of 18–21 mental health tools created by the editorial team.
- **Community_Card**: A tool submitted by a user and approved through moderation for public discovery.
- **Origin_Badge**: A visual indicator on cards showing the source ("Library", "Community", or "My tool") and determining editability.
- **Custom_Tool**: A card built by a user by composing Controls, as opposed to adding a pre-made card from the Curated_Library.
- **Link_Tool**: A card whose primary purpose is launching external apps or websites, built using a Link_Button_Control.
- **Streak**: Consecutive days a user has completed a specific card (resets if a day is skipped).
- **Badge**: A gamification reward earned for consistent practice, variety, or milestones.
- **Mood_Log**: A user's self-reported mood value (integer 1–10) recorded before or after using a card.
- **Archive**: A hidden collection of cards the user has chosen to remove from the active Wallet but may restore later.
- **Moderation_Queue**: The review pipeline where user-submitted cards await curator approval before publication.
- **Kebab_Menu**: The three-dot icon menu providing contextual actions for a card or the Wallet.
- **App**: The Mental Health Wallet mobile application.

## Requirements

### Requirement 1: Wallet Stacked Card Layout

**User Story:** As a user, I want to see all my coping tools in a stacked card layout, so that I can quickly identify and access any tool at a glance.

#### Acceptance Criteria

1. THE App SHALL render the Wallet in a reverse-stacked card layout with the bottom card closest to the header and subsequent cards offset above showing only their top edge.
2. WHEN a Card is displayed in the Stacked_View, THE App SHALL show the Card Title, Icon, Category color tag, and Background for each visible card edge, with each card edge providing a minimum tap target of 44×44 points.
3. WHEN the number of cards exceeds the visible screen area, THE App SHALL allow vertical scrolling of the stack and display partial card edges to indicate additional cards exist below the visible area.
4. THE App SHALL render the Stacked_View with a "My Wallet" header and a Kebab_Menu at the top of the screen.
5. IF the Wallet contains zero cards, THEN THE App SHALL display an empty state with a message prompting the user to add their first tool and a prominent "Add tool" button linking to the library browser.

### Requirement 2: Card Focus Interaction

**User Story:** As a user, I want to tap a card to bring it into full view, so that I can see its details and take action on it.

#### Acceptance Criteria

1. WHEN a user taps a visible card edge in the Stacked_View, THE App SHALL animate the tapped card to a fully visible centered position below the "My Wallet" header within 300 milliseconds.
2. WHEN a card enters Focused_Card state, THE App SHALL slide all other cards into a collapsed stack at the bottom of the screen with only the top edge of the topmost collapsed card visible.
3. WHEN the Focused_Card is displayed, THE App SHALL show the Title, Description, Origin_Badge, Category tag, total uses count, current Streak count, last used date, earned Badges, and primary action button.
4. WHEN a user taps the collapsed bottom stack, THE App SHALL fan out up to 5 card tops (or all remaining cards if fewer than 5 exist) allowing the user to select a different card to bring into focus.
5. WHEN a user selects a card from the fanned-out collapsed stack, THE App SHALL transition that card to the Focused_Card state and return the previously focused card to the collapsed stack.
6. WHEN a user swipes down on the Focused_Card or taps the area above the collapsed stack outside the card, THE App SHALL return to the Stacked_View with all cards visible in their stacked positions.

### Requirement 3: Card Expansion

**User Story:** As a user, I want to expand a focused card to see full tool content and interact with it, so that I can complete the exercise without leaving the Wallet screen.

#### Acceptance Criteria

1. WHEN a user taps the Focused_Card or the "Expand" button, THE App SHALL expand the card vertically downward to show full tool instructions, input fields, and sub-actions.
2. WHILE the Expanded_Card is displayed, THE App SHALL keep the collapsed bottom stack visible and tappable for switching between tools.
3. WHEN the Expanded_Card content exceeds the visible area, THE App SHALL allow vertical scrolling within the card while the header and bottom stack remain fixed.
4. WHEN a user swipes down or taps the collapse button on the Expanded_Card, THE App SHALL return the card to the Focused_Card state, preserving any data the user has entered in input Controls.
5. WHEN a user switches to a different card via the collapsed bottom stack while the current card is expanded, THE App SHALL preserve any unsaved input data in the previously expanded card so the user can return and resume.
6. WHEN a user completes all required inputs in the Expanded_Card and taps "Save" or "Complete", THE App SHALL log a completion entry containing the card ID, timestamp, and values for every input Control in that card.
7. IF a user taps the primary action button but one or more required input Controls are empty, THEN THE App SHALL highlight the incomplete fields and display an inline error message without discarding existing input.

### Requirement 4: Card Reorder

**User Story:** As a user, I want to reorder my cards, so that I can prioritize the tools I use most often.

#### Acceptance Criteria

1. WHEN a user long-presses any card in the Stacked_View or Focused_Card view for at least 500 milliseconds, THE App SHALL enter reorder mode showing all Wallet cards in a vertical list layout with a drag handle on each card and a "Done" button at the top.
2. IF the user's Wallet contains fewer than 2 cards, THEN THE App SHALL not enter reorder mode on long-press.
3. WHILE in reorder mode, THE App SHALL allow the user to drag a card up or down to change its position in the list, displaying a visual elevation on the dragged card to indicate it is being moved.
4. WHEN the user drops a card into a new position or taps "Done", THE App SHALL persist the new card order locally and rebuild the stack in the updated sequence.
5. WHEN the user taps outside the reordering list, THE App SHALL discard any uncommitted position changes, exit reorder mode, and return to the Stacked_View with the original card order preserved.
6. WHEN the user taps "Done", THE App SHALL exit reorder mode and return to the Stacked_View reflecting the persisted card order.

### Requirement 5: Universal Card Model

**User Story:** As a user, I want every card to share a consistent structure built from reusable field types, so that all tools work the same way regardless of their purpose.

#### Acceptance Criteria

1. THE App SHALL require every Card to have a Card_Shell consisting of Title (maximum 80 characters), Description (maximum 300 characters), Icon, and Background (either a color/gradient or an uploaded image) as mandatory fields.
2. THE App SHALL model every Card as a Card_Shell plus an ordered list of one or more Controls (field types) that define the card's content and interactions.
3. THE App SHALL require every Card to include at least one primary action button (e.g., "Start", "Complete", "Save entry", "Mark as done").
4. WHEN a Card contains only static content Controls (static text block and link button) and no user-input Controls (text input, text area, mood slider, choice buttons, checkbox, counter, image attachment, or date/time stamp), THE App SHALL auto-include a "Mark as done" button as the primary action.
5. WHEN a user taps the primary action button on a Card, THE App SHALL record a completion entry containing the card ID, timestamp, and the current value of every user-input Control in that card.
6. WHEN a Card is created or edited, THE App SHALL validate that all four Card_Shell fields contain non-empty, non-whitespace-only values before allowing the save operation.
7. IF a Card_Shell validation fails during a save attempt, THEN THE App SHALL prevent the save, highlight the invalid fields, and display an inline error message indicating which fields require input.
8. WHEN a Card contains at least one user-input Control, THE App SHALL derive the primary action button label from the card's purpose (e.g., "Save entry" for form-based cards, "Complete" for instruction-based cards) unless the user has specified a custom label.

### Requirement 6: Control Types (Field Types)

**User Story:** As a user, I want a rich set of field types available for any card, so that I can compose tools that capture exactly the information I need.

#### Acceptance Criteria

1. THE App SHALL provide the following Control types usable in any Card: static text block, single-line text input (maximum 200 characters), multi-line text area, mood slider (range 1–10), choice buttons (single select, maximum 8 options), checkbox/toggle, counter/numeric input, date/time auto-stamp, image attachment (maximum 20 MB per image, JPEG or PNG format), and link button.
2. WHEN a user adds a static text block Control, THE App SHALL support an optional title, rich-text body (bold, italics, bullet/numbered list), and font size selection (Small, Medium, Large with Medium as default).
3. WHEN a user adds a mood slider Control, THE App SHALL store the captured integer value (1–10) as a Mood_Log entry associated with the current card completion and integrate it into the mood analytics system.
4. WHEN a user adds a link button Control, THE App SHALL require a label and a target URL (deep link or https:// URL).
5. WHEN a link button Control is activated, THE App SHALL open the target URL using the appropriate system handler and log that the link was opened.
6. IF a link button Control activation fails because the target app is not installed, THEN THE App SHALL attempt to open a web URL fallback if one is configured.
7. IF a link button Control activation fails and no fallback URL exists, THEN THE App SHALL display a message: "Couldn't open this app. It may not be installed. You can edit this tool to change the link."
8. WHEN a user adds a link button Control, THE App SHALL validate that the target URL starts with an allowed scheme (https://, http://, or a non-empty custom scheme containing "://") and reject invalid URLs with an inline error message before allowing the Control to be saved.

### Requirement 7: Card Creation and Editing

**User Story:** As a user, I want a guided creation flow to build my own cards from available field types, so that I can easily compose and preview personalized coping tools.

#### Acceptance Criteria

1. WHEN a user selects "Create new tool", THE App SHALL present a multi-step creation flow: Step 1 (basic card info with Card_Shell fields), Step 2 (add and arrange Controls), Step 3 (preview), with "Back" and "Next" navigation buttons allowing movement between steps without losing entered data.
2. WHILE in Step 1, THE App SHALL require Title (maximum 80 characters) and Description (maximum 300 characters), and provide an Icon picker (searchable icon library or image upload) and a Background option (interactive color picker with preset gradient options, or image upload from the user's photo library or camera).
3. IF the user attempts to proceed from Step 1 without populating all four Card_Shell fields (Title, Description, Icon, Background), THEN THE App SHALL prevent navigation to Step 2 and indicate which required fields are missing.
4. WHEN a user uploads a background image, THE App SHALL display recommended image dimensions and accept images meeting a minimum resolution of 750×500 pixels and a maximum file size of 10 MB for optimal card rendering.
5. WHILE in Step 2, THE App SHALL display an ordered list of Controls with visible drag handles for reordering, and an "Add block" button that shows available Control types.
6. WHILE in Step 3, THE App SHALL render a full interactive preview of the card as it will appear in the Wallet, allowing the user to interact with Controls (tap buttons, use sliders, enter text) to verify the tool functions as intended before saving.
7. THE App SHALL enforce a maximum of 10 Controls per Card.
8. WHEN the user saves the Card, THE App SHALL add it to the Wallet with an Origin_Badge of "My tool".
9. WHEN a user selects "Edit" from the Kebab_Menu on a "My tool" card, THE App SHALL open the same multi-step creation flow pre-populated with the card's existing data, and upon saving, THE App SHALL update the card in the Wallet while preserving all usage history and statistics.
10. IF the user exits the creation or editing flow before saving (by navigating away or closing the flow), THEN THE App SHALL display a confirmation prompt warning that unsaved changes will be lost.

### Requirement 8: Card Templates

**User Story:** As a user, I want pre-configured card templates for common use cases, so that I can quickly add tools without building them from scratch.

#### Acceptance Criteria

1. THE App SHALL provide pre-configured templates that are pre-assembled combinations of Controls, including: Affirmation/Reminder (static text block with primary action), Simple Instruction (numbered static text blocks with optional timer and reflection input), Mini-Form/Check-In (mood slider and text inputs), Journaling/Reflection (prompt text with multi-line text area), and Mood Tracker (mood slider with optional context text inputs).
2. WHEN a user selects "Create new tool", THE App SHALL offer the option to start from a template or start from scratch before entering the multi-step creation flow.
3. WHEN a user selects a template, THE App SHALL pre-populate the Card with the template's default Controls and placeholder Card_Shell values (a default Title matching the template name, a default Description, a default Icon, and a default Background) which the user can then modify in the creation flow starting at Step 1.
4. WHILE editing a template-based card, THE App SHALL allow the user to modify, reorder, add, or remove any pre-populated Controls and Card_Shell fields, subject to the same validation rules as manually composed cards (including the maximum of 10 Controls per Card).
5. THE App SHALL treat template-based cards identically to manually composed cards for data storage, analytics, and display purposes.

### Requirement 9: Curated Library

**User Story:** As a user, I want to browse a library of professionally curated coping tools, so that I can discover effective techniques without creating them myself.

#### Acceptance Criteria

1. THE App SHALL include a Curated_Library of 18–21 hand-selected cards organized across categories: Grounding & Calming, Cognitive Reframing, Body & Sensory, Daily Check-In & Journaling, Self-Compassion & Reminders, and Lightweight Connection.
2. WHEN a user taps "Add tool" from the Wallet, THE App SHALL open a library browser showing cards grouped by category with each card displaying its title, icon, short description, category tag, and Origin_Badge, with categories displayed in the order listed in criterion 1.
3. THE App SHALL provide a search function that matches library cards by partial text match against card title, description, or category name, beginning after the user has entered at least 1 character.
4. THE App SHALL provide category filters allowing users to view only cards from a selected category.
5. THE App SHALL display library cards in category-grouped order by default, and provide a sort option to order library cards from newest to oldest so users can discover recently added tools.
6. WHEN a user taps "Add to wallet" on a library card, THE App SHALL add a copy of that card to the top of the user's Wallet stack.
7. THE App SHALL mark all Curated_Library cards with a "Library" Origin_Badge indicating read-only status.
8. IF a user taps "Add to wallet" on a library card that already exists in their Wallet, THEN THE App SHALL display a message indicating the card is already in the Wallet and not add a duplicate copy.
9. IF a search query or category filter returns no matching cards, THEN THE App SHALL display an empty state message indicating no results were found.

### Requirement 10: Origin Badges and Editability

**User Story:** As a user, I want to know which tools I can edit and which are read-only, so that I understand my options for customization.

#### Acceptance Criteria

1. THE App SHALL display an Origin_Badge on every card indicating its source: "Library" for curated tools, "Community" for user-submitted approved tools, or "My tool" for user-created tools.
2. IF a card has the Origin_Badge "My tool", THEN THE App SHALL allow the user to edit the card's Card_Shell fields (Title, Description, Icon, Background), Controls (add, remove, reorder, modify), and category tag.
3. IF a card has the Origin_Badge "Library" or "Community", THEN THE App SHALL hide edit actions from the card's Kebab_Menu and disable modification of the card's Card_Shell fields, Controls, and category tag.
4. WHEN a user taps "Duplicate tool" on a "Library" or "Community" card, THE App SHALL create an editable copy containing the original card's Card_Shell fields, Controls, and category tag, marked with the "My tool" Origin_Badge, without carrying over usage history, Streak, or Badge data.
5. IF a user attempts to modify a "Library" or "Community" card through any interaction path, THEN THE App SHALL display a message indicating the card is read-only and offer a "Duplicate tool" action to create an editable copy.

### Requirement 11: Kebab Menu Actions

**User Story:** As a user, I want contextual actions available for each card, so that I can manage, customize, and track my tools.

#### Acceptance Criteria

1. WHILE a "My tool" card is in Focused_Card or Expanded_Card state, WHEN the user taps the Kebab_Menu icon, THE App SHALL display the following options in order: Edit, Duplicate tool, View usage history, View insights, Set reminder, Archive card, and Submit to library.
2. WHILE a "Library" or "Community" card is in Focused_Card or Expanded_Card state, WHEN the user taps the Kebab_Menu icon, THE App SHALL display the following options in order: Duplicate tool, View usage history, View insights, Set reminder, and Archive card.
3. WHEN the user selects "Duplicate tool", THE App SHALL create a copy of the card including all Card_Shell fields and Controls, named "[Original Name] - Copy", with Origin_Badge set to "My tool", with usage statistics (total uses, Streak, last used date) reset to zero, and place the copy at the top of the Wallet stack.
4. IF the user selects "Edit" on a card that is not marked with Origin_Badge "My tool", THEN THE App SHALL not display the "Edit" option in the Kebab_Menu for that card.

### Requirement 12: Usage History

**User Story:** As a user, I want to view the history of my card completions, so that I can review past entries and track my practice over time.

#### Acceptance Criteria

1. WHEN a user selects "View usage history" from the Kebab_Menu, THE App SHALL display a scrollable list of all completions for that card ordered from newest to oldest, with each entry showing: timestamp, all input Control values, any associated Mood_Log values, and text content.
2. THE App SHALL allow the user to delete an individual history entry by swiping or tapping a delete action, with a confirmation prompt before permanent removal.
3. IF a card has zero completions, THEN THE App SHALL display an empty state message indicating no usage history exists yet.

### Requirement 13: Per-Tool Insights

**User Story:** As a user, I want to see insights about each tool's effectiveness, so that I can understand which tools help me most.

#### Acceptance Criteria

1. WHEN a user selects "View insights" from the Kebab_Menu, THE App SHALL display a per-tool insights panel showing: a usage chart for the selected time period, current Streak, total uses, last used date, and average mood after use (if Mood_Log data exists).
2. THE App SHALL allow the user to switch between time period views (last 7 days, last 30 days, this year, all time) for usage charts and mood data.
3. WHEN a card has 3 or more Mood_Log entries for the selected time period, THE App SHALL display mood trend information (improving if recent average exceeds earlier average by more than 0.5 points, declining if lower by more than 0.5 points, stable otherwise) and average mood change value.
4. IF a card has fewer than 3 Mood_Log entries for the selected time period, THEN THE App SHALL display the insights panel without mood trend data and show a message indicating more mood entries are needed for trend analysis.

### Requirement 14: Reminders

**User Story:** As a user, I want to set reminders for my coping tools, so that I build consistent mental health habits.

#### Acceptance Criteria

1. WHEN a user selects "Set reminder" from the Kebab_Menu, THE App SHALL allow configuration of a per-card reminder with a specific time of day and frequency options: daily, 3 times per week (user selects which days), or custom schedule (user selects specific days of the week).
2. WHEN a user sets a global reminder from the Wallet Kebab_Menu, THE App SHALL configure a "Daily wellness check-in" notification at the user-selected time that suggests a random tool or the least-used card in the past 14 days.
3. IF the user has not granted notification permissions, THEN THE App SHALL request notification permission before saving the reminder, and display a message explaining why notifications are needed.
4. WHEN a reminder triggers, THE App SHALL deliver a push notification containing the card name and a contextual message (e.g., "Time for your [Tool Name] practice").
5. WHEN a user taps a reminder notification, THE App SHALL open the app directly to the Focused_Card view of the associated card.
6. THE App SHALL allow users to edit or delete existing reminders from the "Set reminder" Kebab_Menu option, showing current reminder configuration if one is already set.
7. WHEN a card is archived, THE App SHALL automatically disable all reminders associated with that card.

### Requirement 15: Habit Tracking and Streaks

**User Story:** As a user, I want my usage tracked with streaks, so that I stay motivated to practice consistently.

#### Acceptance Criteria

1. WHEN a Card is added to the Wallet, THE App SHALL initialize that card's total uses to zero, current Streak to zero, and last used date to empty.
2. WHEN a user completes a Card, THE App SHALL increment that card's total uses by one, record the current date/time as the last used date, and: set the current Streak to one if no completion was recorded on the previous calendar day, leave the Streak unchanged if a completion was already recorded on the current calendar day, or increment the Streak by one if the previous completion was recorded on the immediately preceding calendar day.
3. IF a card has no recorded completion for an entire calendar day (midnight-to-midnight in the device's local timezone) following its last completion date, THEN THE App SHALL reset that card's current Streak to zero.
4. THE App SHALL display the current Streak, total uses, and last used date on the Focused_Card view.

### Requirement 16: Badges and Achievements

**User Story:** As a user, I want to earn badges for consistent practice and variety, so that I feel rewarded for building healthy habits.

#### Acceptance Criteria

1. THE App SHALL award Streak Badges when a user achieves 7-day and 30-day consecutive streaks on any single card, evaluated at the time of each card completion.
2. THE App SHALL award Variety Badges when a user completes at least one card in 5 different categories ("Tried 5 Different Tools") and when a user has completed at least one card in every available category ("Completed Every Category").
3. THE App SHALL award Consistency Badges when a user reaches the following cumulative usage milestones: 10 uses of any single card, 50 total uses across all cards, and 100 total uses across all cards.
4. WHEN a Badge is earned, THE App SHALL display an in-app notification or animation acknowledging the new Badge at the time it is awarded.
5. THE App SHALL display earned Badges as icons on the Focused_Card view (showing only badges related to that card) and on a dedicated achievements page accessible from the Wallet Kebab_Menu (showing all earned badges).
6. WHEN a user taps a Badge on the achievements page, THE App SHALL offer a "Share this achievement" action that generates a pre-filled social media post containing the badge name, a congratulatory message, and the hashtag #MentalHealthWallet.

### Requirement 17: Mood Logging and Mood Analytics

**User Story:** As a user, I want to log my mood at flexible points during my day, so that the app can build accurate correlations between tool usage and my emotional state.

#### Acceptance Criteria

1. THE App SHALL support Mood_Log capture at multiple points in the user workflow: before card use, after card completion, and as a standalone daily check-in.
2. THE App SHALL provide a daily mood check-in setting that the user can enable or disable, which when enabled requires at least one Mood_Log entry per day.
3. WHILE the daily mood check-in setting is enabled and no Mood_Log has been recorded for the current day, WHEN the user opens the app, THE App SHALL display a mood slider prompt (1–10 with emoji anchors) before showing the Wallet.
4. WHEN a user taps the primary action button on a Focused_Card or Expanded_Card to begin using a card, THE App SHALL display a dismissable pre-use mood slider (1–10 with emoji anchors) allowing the user to log their mood before starting the exercise.
5. WHEN a user completes a card, THE App SHALL display a dismissable post-completion mood slider (1–10 with emoji anchors) for mood logging.
6. THE App SHALL store each Mood_Log with the associated card ID (if linked to a card use), timestamp, and context label (before use, after use, or standalone).
7. IF fewer than 3 Mood_Log entries exist for a selected time period, THEN THE App SHALL display the mood trend chart in an empty state with a message indicating more entries are needed.
8. WHEN 3 or more Mood_Log entries exist for the selected time period, THE App SHALL display a mood trend chart with selectable time periods (last 7 days, last 30 days, this year, all time) and a trend indicator calculated as: "improving" if the average mood of the most recent half of entries exceeds the earlier half by more than 0.5 points, "declining" if it is lower by more than 0.5 points, and "stable" otherwise.
9. THE App SHALL calculate and display tool effectiveness as "Average mood after using [Tool Name]" for each card that has 3 or more post-use Mood_Log entries, and rank tools by mood improvement defined as the difference between average post-use mood and average pre-use mood for that tool.
10. THE App SHALL use before-and-after Mood_Log pairs (pre-use and post-use logs linked to the same card completion) and standalone daily logs to display mood change values per tool and overall mood trends over time.

### Requirement 18: Wallet-Level Analytics Dashboard

**User Story:** As a user, I want a dashboard summarizing my overall tool usage across the entire Wallet, so that I can see my practice habits and identify areas for improvement.

#### Acceptance Criteria

1. THE App SHALL provide a Wallet-level analytics dashboard accessible from the Wallet Kebab_Menu showing: total tools in Wallet, total completions for the selected time period, most-used tools (top 3 by completion count), and tools not used in the last 14 days.
2. THE App SHALL allow the user to switch between time period views (last 7 days, last 30 days, this year, all time) for wallet-level usage data, with "last 7 days" as the default view.
3. THE App SHALL display mood analytics (trend chart, tool effectiveness ranking, and mood correlation data) as a section within the Wallet-level analytics dashboard, subject to the minimum data thresholds defined in Requirement 17.
4. IF the user has zero completions for the selected time period, THEN THE App SHALL display an empty state message encouraging the user to start using tools.

### Requirement 19: Archive and Restore

**User Story:** As a user, I want to archive cards I no longer actively use and restore them later, so that I keep my Wallet focused without losing data.

#### Acceptance Criteria

1. WHEN a user selects "Archive card" from the Kebab_Menu, THE App SHALL hide the card from the active Wallet while preserving all data, statistics, and Streak history, and SHALL disable any active reminders associated with that card.
2. WHEN a user accesses the Archive from the Wallet Kebab_Menu, THE App SHALL display all archived cards sorted by most recently archived first, showing each card's Title, Icon, Category tag, and last-used date.
3. WHEN a user taps "Restore to wallet" on an archived card, THE App SHALL return the card to the active Wallet at its previous stack position if that position still exists, or at the top of the stack if the previous position is no longer valid (e.g., stack was reordered or reduced in size).
4. WHEN a user taps "Delete" on an archived card, THE App SHALL display a confirmation prompt stating that the card and all associated data will be permanently removed.
5. WHEN the user confirms the deletion prompt, THE App SHALL permanently remove the card and all associated data (usage history, statistics, and Mood_Log entries linked to that card).
6. IF the user dismisses or cancels the deletion confirmation prompt, THEN THE App SHALL retain the archived card unchanged.

### Requirement 20: User Submissions and Moderation

**User Story:** As a user, I want to submit my custom tools to the community library, so that others can benefit from techniques that work for me.

#### Acceptance Criteria

1. WHEN a user selects "Submit to library" from the Kebab_Menu on a "My tool" card, THE App SHALL pre-fill the submission form with the card's existing title, description, and category, and require the user to review and complete all required metadata: title (maximum 60 characters), description (maximum 200 characters), category, "When to use" guidance (maximum 300 characters), and tool type.
2. WHEN submitting a tool, THE App SHALL display submission guidelines including: the tool must not duplicate an existing library or community tool in both title and core technique, must not violate privacy policies, and must not contain harmful or inappropriate content.
3. THE App SHALL require the user to confirm acknowledgment of the submission guidelines via a checkbox before the submit action becomes available.
4. WHEN submitting a tool, THE App SHALL ask the user whether to publish anonymously or with attribution (displaying their name or username as a credit on the published card).
5. WHEN a user chooses attributed publishing, THE App SHALL display the user's name or username on the Community_Card as creator credit.
6. WHEN a user chooses anonymous publishing, THE App SHALL publish the Community_Card without any identifying information about the creator.
7. WHEN the submission is complete, THE App SHALL place the card into the Moderation_Queue for curator review and display a "Pending Review" status on the submitted card's Kebab_Menu.
8. WHEN a curator approves a submitted card, THE App SHALL make the card visible in the Curated_Library within 5 minutes with a "Community" Origin_Badge and notify the submitting user that their tool was approved.
9. WHEN a curator rejects a submitted card, THE App SHALL notify the user with the rejection reason and optional feedback text (maximum 500 characters), and change the submission status to "Rejected".
10. IF a user's submission has been rejected, THEN THE App SHALL allow the user to revise and resubmit the tool from the Kebab_Menu.

### Requirement 21: Curator Admin Panel

**User Story:** As a curator, I want a moderation dashboard to review community submissions and manage the library, so that I can maintain quality and grow the available tools.

#### Acceptance Criteria

1. THE App SHALL provide an admin dashboard displaying the Moderation_Queue with submission metadata (title, submitter, date, type, category, and card preview showing the Card_Shell and the first 3 Controls).
2. THE App SHALL provide filters (by type, category, date range, and status) and sort options (newest, oldest) for the Moderation_Queue.
3. WHEN a curator views a submission, THE App SHALL display existing Library and Community cards that share the same category as the submission, so curators can assess uniqueness.
4. THE App SHALL provide Approve, Request Changes, and Reject actions for each submission with a feedback text field (maximum 500 characters).
5. WHEN a curator selects "Request Changes," THE App SHALL notify the submitter with the feedback text and return the submission to the user for revision, removing it from the active Moderation_Queue until resubmitted.
6. THE App SHALL display moderation statistics: submissions this week (Monday through Sunday), approval rate (percentage of approved out of total decided), top category by submission count, average time from submission to decision, and count of submissions pending longer than 5 days (flagged as overdue).
7. THE App SHALL provide curators with the ability to create new Library cards using the same card creation interface available to users (Card_Shell and Controls), and publish them immediately with a "Library" Origin_Badge.

### Requirement 22: Mental Health Safeguards

**User Story:** As a user, I want clear disclaimers and crisis resources, so that I understand the app's limitations and can access help in emergencies.

#### Acceptance Criteria

1. WHEN the user launches the App for the first time, THE App SHALL display a disclaimer stating "Mental Health Wallet is not a replacement for therapy or professional mental health care" and require the user to acknowledge it before accessing the main wallet screen.
2. THE App SHALL provide crisis resource links (988 Suicide & Crisis Lifeline for US users and geolocation-aware local crisis hotlines) accessible from the main menu within 2 taps from any screen.
3. IF the App cannot determine the user's location for local crisis hotlines, THEN THE App SHALL display the US 988 Suicide & Crisis Lifeline as the default resource alongside a link to the International Association for Suicide Prevention crisis centre directory.
4. THE App SHALL display the mental health disclaimer in the settings screen and at the top of any analytics view.
5. THE App SHALL display the crisis disclaimer text "If you are in crisis, please contact [local hotline] or call 988 (US Suicide & Crisis Lifeline)" alongside the crisis resource links on the crisis resources screen.

### Requirement 23: Data Privacy and Security

**User Story:** As a user, I want my mental health data stored securely and privately on my device, so that I trust the app with sensitive personal information.

#### Acceptance Criteria

1. THE App SHALL store all user data (cards, entries, mood logs, statistics) locally on the device using encrypted storage.
2. THE App SHALL provide an optional app lock using Face ID or a 4-to-6-digit PIN authentication.
3. WHEN app lock is enabled and the app returns to the foreground after being backgrounded or closed, THE App SHALL require successful Face ID or PIN authentication before granting access to any app content.
4. IF a user enters an incorrect PIN 5 consecutive times, THEN THE App SHALL impose a 60-second lockout period before allowing another authentication attempt.
5. WHEN a user selects "Export data" from the settings screen, THE App SHALL generate a file containing all personal data (cards, entries, mood logs, statistics) in the user's chosen format (JSON or CSV) and present the system share sheet for the user to save or send the file.
6. WHEN a user selects the data deletion option, THE App SHALL display a confirmation prompt requiring the user to confirm before permanently removing all personal data and resetting the app to its initial state.

### Requirement 24: Performance and Accessibility

**User Story:** As a user, I want the app to perform smoothly with many cards and be accessible, so that I have a reliable and inclusive experience.

#### Acceptance Criteria

1. THE App SHALL render the Stacked_View and respond to card interactions (tap, focus, expand) within 300 milliseconds when the Wallet contains 50 or more cards.
2. THE App SHALL maintain a crash-free session rate of 99.9% or higher measured over any rolling 7-day period.
3. THE App SHALL comply with WCAG 2.1 AA accessibility baseline standards including: minimum contrast ratio of 4.5:1 for text, minimum tap target size of 44×44 points, support for VoiceOver (iOS) and TalkBack (Android) screen readers with meaningful labels on all interactive elements, and support for Dynamic Type / system font scaling.
4. THE App SHALL deliver push notifications with a delivery rate exceeding 90% measured over any rolling 7-day period across all users with notifications enabled.

### Requirement 25: Insights and Recommendations

**User Story:** As a user, I want the app to surface simple actionable insights, so that I can make informed decisions about my tool usage.

#### Acceptance Criteria

1. THE App SHALL display insights in a dedicated insights section accessible from the Wallet-level analytics dashboard.
2. THE App SHALL generate a weekly tool use summary insight showing the total number of tools used and total completions for the past 7 days.
3. WHEN a card's current Streak reaches 3, 7, or 30 consecutive days, THE App SHALL generate a streak encouragement insight acknowledging the milestone for that card.
4. WHEN a card has 3 or more Mood_Log entries with before-and-after pairs within a given time period, THE App SHALL generate a tool effectiveness insight showing the average mood improvement value for that card (e.g., "Box Breathing has improved your mood by an average of +1.5 points").
5. WHEN a card has not been used in 10 or more days and is not archived, THE App SHALL generate a re-engagement suggestion for that card, displaying a maximum of 3 re-engagement suggestions at any time.
