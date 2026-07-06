# Requirements Document

## Introduction

This feature introduces four UX enhancements to the Mental Health Wallet card system: library card previews before adding to the wallet, reminder information displayed on focused cards, reminder icons on stacked cards, and third-party app branding support for cards. Together these improvements give users better insight into cards before adoption, surface reminder context at-a-glance, and enable branded integrations from external apps.

## Glossary

- **Library_Browser**: The screen where users browse curated cards grouped by category before adding them to their wallet.
- **Card_Preview**: A read-only modal or sheet that displays a card's full visual appearance (shell, controls layout) without allowing interaction with controls.
- **Focused_Card**: The expanded card state occupying ~65% of screen height when a user taps a card in the stacked wallet view.
- **Stacked_Card**: A card rendered in the Apple Wallet-style overlapping layout, showing only its top ~60px (icon, title, category dot).
- **Reminder_Indicator**: A visual icon on a stacked card that communicates a reminder is configured for that card.
- **Third_Party_Card**: A card whose origin is a third-party application, carrying brand identity (logo, colors, background imagery).
- **Card_Shell**: The universal visual wrapper of a card consisting of title, description, icon, and background.
- **Icon_Customization_System**: The system that resolves and renders card icons based on `iconType` (library, emoji, custom_image) and `iconValue`.

## Requirements

### Requirement 1: Library Card Preview

**User Story:** As a user browsing the library, I want to preview a card's full appearance before deciding to add it to my wallet, so that I can make informed decisions about which tools to adopt.

#### Acceptance Criteria

1. WHEN a user taps a card item in the Library_Browser, THE Card_Preview SHALL display a read-only rendering of the card showing its shell (icon, title, description, background) and a visual layout of its controls in their defined position order.
2. WHILE the Card_Preview is displayed, THE Card_Preview SHALL render all controls in a non-interactive state where no user input is accepted.
3. WHILE the Card_Preview is displayed, THE Card_Preview SHALL show an "Add to wallet" action that allows the user to add the previewed card to their wallet.
4. WHEN the user activates the "Add to wallet" action from the Card_Preview, THE Library_Browser SHALL add the card to the wallet using the same logic as the existing "Add to wallet" button, display a loading state on the action during the operation, and upon success update the action to show the "In wallet" indicator.
5. WHILE the Card_Preview is displayed, THE Card_Preview SHALL show a dismiss action that closes the preview and returns to the Library_Browser.
6. IF the previewed card already exists in the user's wallet, THEN THE Card_Preview SHALL display a non-interactive "In wallet" indicator instead of the "Add to wallet" action.
7. IF the previewed card is archived, THEN THE Card_Preview SHALL display a "Restore from archive" action instead of the "Add to wallet" action.
8. WHEN the Card_Preview is dismissed, THE Library_Browser SHALL preserve its prior state including the selected category filter, search query, sort mode, and scroll position.
9. IF the "Add to wallet" or "Restore from archive" operation fails, THEN THE Card_Preview SHALL display an error message indicating the failure and keep the original action available for retry.

### Requirement 2: Reminder Display on Focused Card

**User Story:** As a user viewing a focused card, I want to see the configured reminder information on the card, so that I can quickly verify when my next reminder will fire without navigating to a separate screen.

#### Acceptance Criteria

1. WHILE a card is in the Focused_Card state and has a reminder with isActive set to true, THE Focused_Card SHALL display the reminder time and frequency in a single line on the card, formatted as the time followed by a middle-dot separator ("·") followed by the frequency label.
2. WHILE a card is in the Focused_Card state and has no reminder configured or has a reminder with isActive set to false, THE Focused_Card SHALL NOT display any reminder information section.
3. WHEN a reminder is configured with a "daily" frequency, THE Focused_Card SHALL display the frequency label as "Daily" (e.g., "09:00 · Daily").
4. WHEN a reminder is configured with a "3x_week" frequency, THE Focused_Card SHALL display the frequency label as the selected day abbreviations in calendar order from Monday to Sunday, separated by commas (e.g., "09:00 · Mon, Wed, Fri").
5. WHEN a reminder is configured with a "custom" frequency, THE Focused_Card SHALL display the frequency label as the selected day abbreviations in calendar order from Monday to Sunday, separated by commas.
6. THE Focused_Card SHALL display the reminder time in 24-hour HH:mm format matching the stored reminder time value.
7. THE Focused_Card SHALL position the reminder information below the stats row and above the expand action, using a bell icon as a visual prefix.
8. THE Focused_Card SHALL use the following three-letter day abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun.

### Requirement 3: Reminder Icon on Stacked Cards

**User Story:** As a user viewing my wallet stack, I want to see at a glance which cards have reminders set, so that I can identify my scheduled tools without tapping into each card.

#### Acceptance Criteria

1. WHILE a Stacked_Card has an active reminder configured, THE Stacked_Card SHALL display a Reminder_Indicator bell icon in the top-right corner of the card's top row, positioned to the left of the category color dot.
2. WHILE a Stacked_Card has no active reminder configured, THE Stacked_Card SHALL NOT display a Reminder_Indicator.
3. THE Stacked_Card SHALL position the Reminder_Indicator within the top 60 points of the card so that the indicator remains visible when cards overlap in the stacked layout.
4. THE Reminder_Indicator SHALL render at a minimum size of 16×16 points and SHALL meet a contrast ratio of at least 3:1 against both light and dark card backgrounds.
5. THE Reminder_Indicator SHALL be non-interactive (display only) and SHALL include an accessibility label of "Reminder set" for screen reader users.
6. WHEN a reminder is added to or removed from a Stacked_Card, THE Stacked_Card SHALL update the visibility of the Reminder_Indicator without requiring the user to reload the wallet view.

### Requirement 4: Third-Party App Card Branding

**User Story:** As a user with cards from third-party apps, I want those cards to display their source app's logo and brand colors, so that I can visually identify which app each card originated from.

#### Acceptance Criteria

1. THE Icon_Customization_System SHALL support a "third_party" icon type that renders a brand logo image from a provided HTTPS URI or bundled asset path, scaled to fit the standard icon position dimensions while preserving aspect ratio.
2. IF a Third_Party_Card specifies a brand background color as a valid hex color string, THEN THE Card_Shell SHALL use the specified color as the card background.
3. IF a Third_Party_Card specifies a brand background image URI, THEN THE Card_Shell SHALL render the image as the card background.
4. IF a Third_Party_Card specifies both a brand logo and a brand background, THEN THE Card_Shell SHALL render both the logo in the icon position and the brand background.
5. IF a Third_Party_Card's brand logo URI fails to load within 10 seconds or returns a network or HTTP error, THEN THE Card_Shell SHALL fall back to displaying the card's emoji icon value.
6. IF a Third_Party_Card's background image URI fails to load within 10 seconds or returns a network or HTTP error, THEN THE Card_Shell SHALL fall back to the card's configured background color.
7. THE Icon_Customization_System SHALL validate that third-party icon URIs use HTTPS protocol or reference a local asset path.
8. IF a third-party icon URI fails validation because it does not use HTTPS and is not a local asset path, THEN THE Icon_Customization_System SHALL reject the card configuration and display an error message indicating the URI must use HTTPS or reference a local asset.
