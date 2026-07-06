# Requirements Document

## Introduction

The Curator Admin Panel enables the sole admin/developer to create, edit, and delete library-grade tools directly from the app's UI, eliminating the need to hand-edit the static `curatedLibrary.ts` array. The feature reuses the existing Card Creator screen with an admin-only toggle that switches the origin badge from "my_tool" to "library". Admin-created library cards are persisted in the local database for testing and previewing, and can be exported in the `CuratedCardDefinition` format for inclusion in the static curated array before the next app release. This ensures all users receive new library cards through normal app updates.

## Glossary

- **Card_Creator**: The existing 3-step screen (`CardCreatorScreen.tsx`) used to create and edit cards with shell fields and controls
- **Admin_Toggle**: A hidden developer-only UI element that switches the card creator between personal ("my_tool") and library mode
- **Library_Card**: A card with `origin_badge = 'library'` that appears in the Library Browser for all users to add to their wallet
- **Admin_Library_Card**: A library card created or overridden via the Admin Panel and persisted in the database (as opposed to the static curated array)
- **Library_Browser**: The screen (`LibraryBrowserScreen.tsx`) displaying curated tools grouped by category with search and filter
- **Static_Library**: The hardcoded `CURATED_LIBRARY` array in `curatedLibrary.ts` containing the 20 hand-selected cards
- **Static_Override**: A DB-persisted copy of a Static_Library card created when the admin edits an existing static card; suppresses the original static version in the Library Browser
- **Admin_Mode**: A dev-only state activated via a hidden gesture, enabling admin capabilities in the Card Creator and Library Browser

## Requirements

### Requirement 1: Admin Mode Activation

**User Story:** As the sole admin/developer, I want a hidden mechanism to activate admin mode, so that library card management is inaccessible to regular users.

#### Acceptance Criteria

1. WHEN the admin performs a triple-tap on the Card Creator screen header title, THE Card_Creator SHALL activate Admin_Mode
2. WHEN the admin performs a triple-tap on the Library Browser screen header title, THE Library_Browser SHALL activate Admin_Mode
3. WHILE Admin_Mode is active, THE Card_Creator SHALL display an "Admin: Library Tool" indicator in the header area
4. THE Admin_Toggle SHALL remain hidden from users who do not perform the triple-tap gesture
5. WHEN the admin navigates away from the Card Creator, THE Admin_Mode SHALL reset to inactive on the next screen visit
6. IF the triple-tap gesture is performed while Admin_Mode is already active, THEN THE screen SHALL deactivate Admin_Mode and revert to normal mode

### Requirement 2: Library Card Creation via Admin Mode

**User Story:** As the admin, I want to create library-grade cards through the same Card Creator flow, so that I can add new tools to the curated library without editing code.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE Card_Creator SHALL save the card with `origin_badge` set to "library" instead of "my_tool"
2. WHILE Admin_Mode is active, THE Card_Creator SHALL persist the card to the database with all shell fields (title, description, icon, background, category) and controls
3. WHEN an Admin_Library_Card is saved, THE Card_Creator SHALL assign a unique ID prefixed with "admin-lib-" followed by a UUID
4. WHEN an Admin_Library_Card is saved, THE Card_Creator SHALL set `allow_background_customization` to true
5. WHEN an Admin_Library_Card is saved successfully, THE Card_Creator SHALL navigate back and display a confirmation message indicating the library tool was created

### Requirement 3: Library Browser Integration

**User Story:** As the admin, I want admin-created library cards to appear in the Library Browser alongside the existing curated cards, so that users can discover and add them to their wallet.

#### Acceptance Criteria

1. THE Library_Browser SHALL display Admin_Library_Cards alongside Static_Library cards in the same category-grouped layout
2. WHEN the Library Browser loads, THE Library_Browser SHALL query Admin_Library_Cards and Static_Overrides from the database and merge them with the Static_Library array
3. WHEN a Static_Override exists for a Static_Library card, THE Library_Browser SHALL display the override version and suppress the original static version
4. WHEN a suppression record exists for a Static_Library card, THE Library_Browser SHALL hide that static card from the library
5. THE Library_Browser SHALL apply the same search filter to all library cards (matching title, description, or category name)
6. THE Library_Browser SHALL apply the same category filter to all library cards
7. THE Library_Browser SHALL display all library cards with the same "Library" badge and category tag regardless of source
8. WHEN a user taps "Add to wallet" on an Admin_Library_Card or Static_Override, THE Library_Browser SHALL add it to the wallet with `origin_badge` set to "library" and `source_library_id` referencing the library card ID

### Requirement 4: Edit Library Cards

**User Story:** As the admin, I want to edit any library card (including static curated cards), so that I can fix mistakes or update tool content without editing code.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE Library_Browser SHALL display an "Edit" affordance on every library card (both Admin_Library_Cards and Static_Library cards)
2. WHEN the admin taps "Edit" on an Admin_Library_Card, THE Card_Creator SHALL open in edit mode pre-populated with the card's shell fields and controls
3. WHEN the admin taps "Edit" on a Static_Library card, THE Card_Creator SHALL create a Static_Override by cloning the card to the database and opening it in edit mode
4. WHEN the admin saves edits to any library card, THE Card_Creator SHALL update the card record in the database (including control changes such as isRequired flag modifications)
5. WHEN an Admin_Library_Card or Static_Override is updated, THE Library_Browser SHALL reflect the changes on the next load
6. WHEN a library card is edited, THE Card_Creator SHALL leave existing wallet copies (previously added by users) unchanged; wallet copies are independent snapshots and do not sync with the source library card
7. WHEN a library card is opened for admin editing, THE Card_Creator SHALL pre-populate emotion tags from the database or from the static CuratedCardDefinition

### Requirement 5: Delete Library Cards

**User Story:** As the admin, I want to delete any library card, so that I can remove tools that are no longer relevant.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE Library_Browser SHALL display a "Delete" affordance on every library card (both Admin_Library_Cards and Static_Library cards)
2. WHEN the admin taps "Delete" on a library card, THE Library_Browser SHALL show a confirmation dialog before proceeding
3. WHEN the admin confirms deletion of an Admin_Library_Card, THE Library_Browser SHALL remove the card record from the database
4. WHEN the admin confirms deletion of a Static_Override, THE Library_Browser SHALL remove the override record from the database, restoring the original Static_Library version
5. WHEN the admin confirms deletion of a Static_Library card (with no override), THE Library_Browser SHALL persist a suppression record that hides the static card from the library
6. IF users have already added the deleted library card to their wallet, THEN THE Library_Browser SHALL leave existing wallet copies intact (orphaned copies remain functional)

### Requirement 6: Export Library Cards for Release

**User Story:** As the admin, I want to export library cards in the `CuratedCardDefinition` format, so that I can update the static curated array and distribute new or edited tools to all users via the next app release.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE Library_Browser SHALL display an "Export" affordance on each Admin_Library_Card and Static_Override
2. WHEN the admin taps "Export" on a library card, THE Library_Browser SHALL serialize the card (including all controls) into the `CuratedCardDefinition` TypeScript format
3. WHEN the export is generated, THE Library_Browser SHALL copy the serialized output to the device clipboard
4. WHEN the export is copied to clipboard, THE Library_Browser SHALL display a confirmation message indicating the card definition was copied
5. THE exported format SHALL include all fields required by `CuratedCardDefinition`: id, title, description, iconType, iconValue, backgroundType, backgroundValue, categoryId, allowBackgroundCustomization, controls array, and tag arrays
6. THE export workflow SHALL serve as the distribution mechanism: exported cards are added to the Static_Library array in `curatedLibrary.ts` and delivered to all users through the next App Store release

### Requirement 7: Database Persistence for Admin Library Cards

**User Story:** As the admin, I want admin-created and overridden library cards stored in the database, so that they persist across app restarts and are queryable alongside user cards.

#### Acceptance Criteria

1. THE Database SHALL store Admin_Library_Cards in the existing `cards` table with `origin_badge = 'library'`
2. THE Database SHALL distinguish Admin_Library_Cards from user-added library copies by using the "admin-lib-" ID prefix
3. THE Database SHALL store Admin_Library_Cards and Static_Overrides with `stack_position = -1` to exclude them from the wallet stack ordering
4. WHEN an Admin_Library_Card is queried for the Library Browser, THE Database SHALL return all cards matching the "admin-lib-" ID prefix with `stack_position = -1`, regardless of `is_archived` status
5. THE Database SHALL support the `icon_type = 'third_party'` value in the cards table CHECK constraint for URL-based icons
6. THE Database SHALL store Static_Overrides in the existing `cards` table using the same ID as the original static card they replace
7. THE Database SHALL store suppression records for deleted static cards in a `suppressed_library_cards` table with the suppressed card's ID and a timestamp
8. WHEN wallet operations shift card positions, THE Database SHALL NOT modify cards with `stack_position = -1` (library-only cards are excluded from position shifts)

### Requirement 8: Auto-Cleanup of Stale Overrides

**User Story:** As the admin, I want stale database overrides to be automatically cleaned up after I export a card and update the static code, so that the workflow is seamless without manual revert steps.

#### Acceptance Criteria

1. WHEN `getMergedLibrary()` detects a Static_Override whose shell fields AND controls match the current Static_Library version exactly, THE system SHALL automatically delete the override from the database
2. THE comparison SHALL include title, description, iconType, iconValue, backgroundType, backgroundValue, categoryId, and all control fields (type, position, isRequired, config)
3. THE auto-cleanup SHALL be transparent to the user — no confirmation dialog or notification

### Requirement 9: Draft Badge Indicator

**User Story:** As the admin, I want a visual indicator showing which library cards have unpublished local changes, so that I can track what needs to be exported.

#### Acceptance Criteria

1. WHILE Admin_Mode is active, THE Library_Browser SHALL display a "Draft" badge on Admin_Library_Cards (admin-lib-* prefix)
2. WHILE Admin_Mode is active, THE Library_Browser SHALL display a "Draft" badge on Static_Overrides that differ from their static original (comparing shell fields AND controls)
3. THE Library_Browser SHALL NOT display a "Draft" badge on Static_Overrides that are identical to their static original (no meaningful changes)
4. THE "Draft" badge SHALL only be visible when Admin_Mode is active

### Requirement 10: Promote Personal Tool to Library

**User Story:** As the admin, I want to promote a personal tool to a library tool, so that I can move tools I created for myself into the curated library.

#### Acceptance Criteria

1. WHEN the admin activates Admin_Mode while editing an existing personal tool (origin_badge = 'my_tool'), THE Card_Creator SHALL prompt whether to save as a library tool on save
2. IF the admin chooses "Save to Library", THE Card_Creator SHALL create a new Admin_Library_Card with the card's current content and delete the original personal card from the wallet
3. IF the admin chooses "Keep as Personal", THE Card_Creator SHALL save normally as a personal tool update

### Requirement 11: Cancel on All Steps

**User Story:** As the admin/user, I want to cancel the card editor from any step, so that I don't have to navigate back to step 1 to exit.

#### Acceptance Criteria

1. THE Card_Creator SHALL display a red "Cancel" button on the right side of the header on ALL steps (1, 2, and 3)
2. ON steps 2 and 3, THE Card_Creator SHALL display a "← Back" button on the left to return to the previous step
3. ON step 1, THE Card_Creator SHALL show an empty left side (no Back button)
4. WHEN Cancel is tapped with unsaved changes, THE Card_Creator SHALL show a "Discard changes?" confirmation dialog

### Requirement 12: Third-Party Icon Caching

**User Story:** As the admin, I want URL-based icons to be cached locally after the first download, so that they render instantly without network delays on subsequent views.

#### Acceptance Criteria

1. WHEN a third-party icon URL is rendered for the first time, THE ThirdPartyIcon component SHALL download the image and cache it to the local filesystem
2. ON subsequent renders of the same URL, THE ThirdPartyIcon component SHALL load the icon from the local cache without making a network request
3. THE icon cache SHALL use the expo-file-system `File` and `Directory` classes (SDK 54 API)
4. IF the download fails or times out, THE ThirdPartyIcon component SHALL display a fallback emoji
