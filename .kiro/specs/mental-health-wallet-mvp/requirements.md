# Requirements Document

## Introduction

Mental Health Wallet is a mobile-first application that unifies scattered mental health coping tools into a personalized, habit-forming toolkit. Users collect "cards" (coping tools, exercises, reminders, trackers) from a curated community library or create their own. The app uses a stacked card interaction (inspired by Apple Wallet) combined with reminders, habit tracking, and mood analytics to help users discover which tools work best for them. The MVP targets general consumers (ages 18–55) interested in self-help and mental wellness. This document covers the MVP scope focused on the core card interaction loop, basic library, reminders, streaks, and essential safety features.

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
- **Curated_Library**: A hand-selected collection of 10–12 mental health tools created by the editorial team.
- **Origin_Badge**: A visual indicator on cards showing the source ("Library", "Community", or "My tool") and determining editability.
- **Custom_Tool**: A card built by a user by composing Controls, as opposed to adding a pre-made card from the Curated_Library.
- **Link_Tool**: A card whose primary purpose is launching external apps or websites, built using a Link_Button_Control.
- **Streak**: Consecutive days a user has completed a specific card (resets if a day is skipped).
- **Archive**: A hidden collection of cards the user has chosen to remove from the active Wallet but may restore later.
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

### Requirement 8: Curated Library

**User Story:** As a user, I want to browse a library of professionally curated coping tools, so that I can discover effective techniques without creating them myself.

#### Acceptance Criteria

1. THE App SHALL include a Curated_Library of 10–12 hand-selected cards organized across categories: Grounding & Calming, Cognitive Reframing, Body & Sensory, Daily Check-In & Journaling, Self-Compassion & Reminders, and Lightweight Connection.
2. WHEN a user taps "Add tool" from the Wallet, THE App SHALL open a library browser showing cards grouped by category with each card displaying its title, icon, short description, category tag, and Origin_Badge, with categories displayed in the order listed in criterion 1.
3. THE App SHALL provide category filters allowing users to view only cards from a selected category.
4. WHEN a user taps "Add to wallet" on a library card, THE App SHALL add a copy of that card to the top of the user's Wallet stack.
5. THE App SHALL mark all Curated_Library cards with a "Library" Origin_Badge indicating read-only status.
6. IF a user taps "Add to wallet" on a library card that already exists in their Wallet, THEN THE App SHALL display a message indicating the card is already in the Wallet and not add a duplicate copy.

### Requirement 9: Origin Badges and Editability

**User Story:** As a user, I want to know which tools I can edit and which are read-only, so that I understand my options for customization.

#### Acceptance Criteria

1. THE App SHALL display an Origin_Badge on every card indicating its source: "Library" for curated tools, "Community" for user-submitted approved tools, or "My tool" for user-created tools.
2. IF a card has the Origin_Badge "My tool", THEN THE App SHALL allow the user to edit the card's Card_Shell fields (Title, Description, Icon, Background), Controls (add, remove, reorder, modify), and category tag.
3. IF a card has the Origin_Badge "Library" or "Community", THEN THE App SHALL hide edit actions from the card's Kebab_Menu and disable modification of the card's Card_Shell fields, Controls, and category tag.
4. WHEN a user taps "Duplicate tool" on a "Library" or "Community" card, THE App SHALL create an editable copy containing the original card's Card_Shell fields, Controls, and category tag, marked with the "My tool" Origin_Badge, without carrying over usage history, Streak, or Badge data.
5. IF a user attempts to modify a "Library" or "Community" card through any interaction path, THEN THE App SHALL display a message indicating the card is read-only and offer a "Duplicate tool" action to create an editable copy.

### Requirement 10: Kebab Menu Actions

**User Story:** As a user, I want contextual actions available for each card, so that I can manage, customize, and track my tools.

#### Acceptance Criteria

1. WHILE a "My tool" card is in Focused_Card or Expanded_Card state, WHEN the user taps the Kebab_Menu icon, THE App SHALL display the following options in order: Edit, Duplicate tool, View usage history, Set reminder, and Archive card.
2. WHILE a "Library" or "Community" card is in Focused_Card or Expanded_Card state, WHEN the user taps the Kebab_Menu icon, THE App SHALL display the following options in order: Duplicate tool, View usage history, Set reminder, and Archive card.
3. WHEN the user selects "Duplicate tool", THE App SHALL create a copy of the card including all Card_Shell fields and Controls, named "[Original Name] - Copy", with Origin_Badge set to "My tool", with usage statistics (total uses, Streak, last used date) reset to zero, and place the copy at the top of the Wallet stack.
4. IF the user selects "Edit" on a card that is not marked with Origin_Badge "My tool", THEN THE App SHALL not display the "Edit" option in the Kebab_Menu for that card.

### Requirement 11: Usage History

**User Story:** As a user, I want to view the history of my card completions, so that I can review past entries and track my practice over time.

#### Acceptance Criteria

1. WHEN a user selects "View usage history" from the Kebab_Menu, THE App SHALL display a scrollable list of all completions for that card ordered from newest to oldest, with each entry showing: timestamp, all input Control values, any associated Mood_Log values, and text content.
2. THE App SHALL allow the user to delete an individual history entry by swiping or tapping a delete action, with a confirmation prompt before permanent removal.
3. IF a card has zero completions, THEN THE App SHALL display an empty state message indicating no usage history exists yet.

### Requirement 12: Reminders

**User Story:** As a user, I want to set reminders for my coping tools, so that I build consistent mental health habits.

#### Acceptance Criteria

1. WHEN a user selects "Set reminder" from the Kebab_Menu, THE App SHALL allow configuration of a per-card reminder with a specific time of day and frequency options: daily, 3 times per week (user selects which days), or custom schedule (user selects specific days of the week).
2. IF the user has not granted notification permissions, THEN THE App SHALL request notification permission before saving the reminder, and display a message explaining why notifications are needed.
3. WHEN a reminder triggers, THE App SHALL deliver a push notification containing the card name and a contextual message (e.g., "Time for your [Tool Name] practice").
4. WHEN a user taps a reminder notification, THE App SHALL open the app directly to the Focused_Card view of the associated card.
5. THE App SHALL allow users to edit or delete existing reminders from the "Set reminder" Kebab_Menu option, showing current reminder configuration if one is already set.
6. WHEN a card is archived, THE App SHALL automatically disable all reminders associated with that card.

### Requirement 13: Habit Tracking and Streaks

**User Story:** As a user, I want my usage tracked with streaks, so that I stay motivated to practice consistently.

#### Acceptance Criteria

1. WHEN a Card is added to the Wallet, THE App SHALL initialize that card's total uses to zero, current Streak to zero, and last used date to empty.
2. WHEN a user completes a Card, THE App SHALL increment that card's total uses by one, record the current date/time as the last used date, and: set the current Streak to one if no completion was recorded on the previous calendar day, leave the Streak unchanged if a completion was already recorded on the current calendar day, or increment the Streak by one if the previous completion was recorded on the immediately preceding calendar day.
3. IF a card has no recorded completion for an entire calendar day (midnight-to-midnight in the device's local timezone) following its last completion date, THEN THE App SHALL reset that card's current Streak to zero.
4. THE App SHALL display the current Streak, total uses, and last used date on the Focused_Card view.

### Requirement 14: Archive and Restore

**User Story:** As a user, I want to archive cards I no longer actively use and restore them later, so that I keep my Wallet focused without losing data.

#### Acceptance Criteria

1. WHEN a user selects "Archive card" from the Kebab_Menu, THE App SHALL hide the card from the active Wallet while preserving all data, statistics, and Streak history, and SHALL disable any active reminders associated with that card.
2. WHEN a user accesses the Archive from the Wallet Kebab_Menu, THE App SHALL display all archived cards sorted by most recently archived first, showing each card's Title, Icon, Category tag, and last-used date.
3. WHEN a user taps "Restore to wallet" on an archived card, THE App SHALL return the card to the active Wallet at its previous stack position if that position still exists, or at the top of the stack if the previous position is no longer valid (e.g., stack was reordered or reduced in size).
4. WHEN a user taps "Delete" on an archived card, THE App SHALL display a confirmation prompt stating that the card and all associated data will be permanently removed.
5. WHEN the user confirms the deletion prompt, THE App SHALL permanently remove the card and all associated data (usage history, statistics, and Mood_Log entries linked to that card).
6. IF the user dismisses or cancels the deletion confirmation prompt, THEN THE App SHALL retain the archived card unchanged.

### Requirement 15: Mental Health Safeguards

**User Story:** As a user, I want clear disclaimers and crisis resources, so that I understand the app's limitations and can access help in emergencies.

#### Acceptance Criteria

1. WHEN the user launches the App for the first time, THE App SHALL display a disclaimer stating "Mental Health Wallet is not a replacement for therapy or professional mental health care" and require the user to acknowledge it before accessing the main wallet screen.
2. THE App SHALL provide crisis resource links (988 Suicide & Crisis Lifeline for US users and geolocation-aware local crisis hotlines) accessible from the main menu within 2 taps from any screen.
3. IF the App cannot determine the user's location for local crisis hotlines, THEN THE App SHALL display the US 988 Suicide & Crisis Lifeline as the default resource alongside a link to the International Association for Suicide Prevention crisis centre directory.
4. THE App SHALL display the mental health disclaimer in the settings screen and at the top of any analytics view.
5. THE App SHALL display the crisis disclaimer text "If you are in crisis, please contact [local hotline] or call 988 (US Suicide & Crisis Lifeline)" alongside the crisis resource links on the crisis resources screen.

### Requirement 16: Data Privacy and Security

**User Story:** As a user, I want my mental health data stored securely and privately on my device, so that I trust the app with sensitive personal information.

#### Acceptance Criteria

1. THE App SHALL store all user data (cards, entries, mood logs, statistics) locally on the device using encrypted storage.
2. WHEN a user selects "Export data" from the settings screen, THE App SHALL generate a file containing all personal data (cards, entries, mood logs, statistics) in the user's chosen format (JSON or CSV) and present the system share sheet for the user to save or send the file.
3. WHEN a user selects the data deletion option, THE App SHALL display a confirmation prompt requiring the user to confirm before permanently removing all personal data and resetting the app to its initial state.

### Requirement 17: Performance and Accessibility

**User Story:** As a user, I want the app to perform smoothly with many cards and be accessible, so that I have a reliable and inclusive experience.

#### Acceptance Criteria

1. THE App SHALL render the Stacked_View and respond to card interactions (tap, focus, expand) within 300 milliseconds when the Wallet contains 50 or more cards.
2. THE App SHALL maintain a crash-free session rate of 99.9% or higher measured over any rolling 7-day period.
3. THE App SHALL comply with WCAG 2.1 AA accessibility baseline standards including: minimum contrast ratio of 4.5:1 for text, minimum tap target size of 44×44 points, support for VoiceOver (iOS) and TalkBack (Android) screen readers with meaningful labels on all interactive elements, and support for Dynamic Type / system font scaling.
4. THE App SHALL deliver push notifications with a delivery rate exceeding 90% measured over any rolling 7-day period across all users with notifications enabled.
