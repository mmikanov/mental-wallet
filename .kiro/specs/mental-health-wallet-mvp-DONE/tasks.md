# Implementation Plan: Mental Health Wallet MVP

## Overview

This plan implements the Mental Health Wallet MVP using React Native/Expo with SQLite/SQLCipher for encrypted local storage, Zustand for state management, React Navigation for routing, and Reanimated 3 for card animations. The implementation progresses from data layer → core UI → card interactions → features → polish, ensuring each step builds on prior work with no orphaned code.

## Tasks

- [x] 1. Project scaffolding and data layer
  - [x] 1.1 Initialize Expo project and install core dependencies
    - Create Expo managed project with TypeScript template
    - Install: expo-sqlite, zustand, react-navigation (native-stack, bottom-tabs), react-native-reanimated, react-native-gesture-handler, expo-secure-store, expo-notifications, expo-crypto, expo-image-picker, @shopify/flash-list, fast-check (dev)
    - Configure babel plugin for Reanimated, gesture handler setup
    - _Requirements: 17.1, 17.3_

  - [x] 1.2 Implement database initialization and encryption
    - Create `src/data/database.ts` with SQLCipher initialization
    - Generate encryption key via `expo-crypto.getRandomBytesAsync(32)` on first launch
    - Store key in platform keychain via `expo-secure-store`
    - Create all tables from design schema (categories, cards, controls, completions, control_values, reminders, settings, crisis_resources)
    - Seed categories (Grounding & Calming, Cognitive Reframing, Body & Sensory, Daily Check-In & Journaling, Self-Compassion & Reminders, Lightweight Connection)
    - Seed crisis resources (988 Lifeline + IASP directory)
    - _Requirements: 16.1, 15.2, 15.3_

  - [x] 1.3 Define TypeScript types and interfaces
    - Create `src/types/` with Card, Control, ControlConfig variants, Completion, ControlValue, Reminder, Category, OriginBadge types
    - Create service interfaces: CardService, CompletionService, ReminderService, NotificationService
    - Create validation result types and error types
    - _Requirements: 5.1, 5.2, 6.1_

- [x] 2. Service layer — Card and Completion logic
  - [x] 2.1 Implement CardService
    - Create `src/services/cardService.ts` implementing getAll, getById, create, update, reorder, archive, restore, duplicate, delete
    - Implement `validateShell` enforcing non-empty/non-whitespace Title (≤80), Description (≤300), Icon, Background
    - Implement `validateControls` enforcing 1–10 controls per card
    - JOIN query to load cards with controls in single read
    - _Requirements: 5.1, 5.6, 5.7, 7.7, 9.2, 9.3, 9.4, 14.1_

  - [x] 2.2 ~~Write property test: Card Shell Completeness (Property 1)~~ — Moved to `property-tests` spec (task 2.1)

  - [x] 2.3 ~~Write property test: Control Count Invariant (Property 2)~~ — Moved to `property-tests` spec (task 2.2)

  - [x] 2.4 Implement CompletionService
    - Create `src/services/completionService.ts` implementing record, getByCard (paginated), deleteEntry, getStreakInfo, updateStreak
    - Record completion + control_values in single transaction
    - Implement streak calculation: +1 if last used yesterday, unchanged if today, reset to 1 otherwise
    - Implement `resetStaleStreaks` for app-open check
    - _Requirements: 5.5, 13.1, 13.2, 13.3, 11.1_

  - [x] 2.5 ~~Write property test: Streak Monotonicity (Property 3)~~ — Moved to `property-tests` spec (task 3.1)

  - [x] 2.6 ~~Write property test: Archive Data Preservation (Property 4)~~ — Moved to `property-tests` spec (task 4.1)

- [x] 3. Checkpoint — data layer verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Zustand stores
  - [x] 4.1 Implement WalletStore
    - Create `src/stores/walletStore.ts` with cards, cardOrder, focusedCardId, isExpanded, isReorderMode state
    - Implement actions: loadCards, focusCard, expandCard, collapseCard, returnToStack, enterReorderMode, commitReorder, cancelReorder
    - Wire to CardService for persistence
    - Call resetStaleStreaks on loadCards
    - _Requirements: 1.1, 2.1, 2.6, 3.1, 3.4, 4.1, 4.4, 4.5, 4.6_

  - [x] 4.2 Implement CompletionStore
    - Create `src/stores/completionStore.ts` with currentInputValues state
    - Implement: setControlValue, submitCompletion (calls CompletionService.record + streak update), clearInputs
    - Preserve unsaved inputs when switching cards (Requirement 3.5)
    - _Requirements: 3.5, 3.6, 5.5_

- [x] 5. Navigation and app shell
  - [x] 5.1 Set up navigation structure
    - Create Root Stack Navigator (first-launch disclaimer → main tabs → modals)
    - Create MainTab Navigator with single Wallet tab (MVP)
    - Create Modal stacks: LibraryBrowser, CardCreator, Archive, Settings
    - Configure deep link handling for notification taps (card_reminder → FocusedCard)
    - _Requirements: 2.1, 12.4, 15.1_

  - [x] 5.2 Implement first-launch disclaimer screen
    - Display "Mental Health Wallet is not a replacement for therapy or professional mental health care"
    - Require acknowledgment before proceeding to wallet
    - Store acknowledgment in settings table
    - _Requirements: 15.1_

- [x] 6. Wallet UI — Stacked View
  - [x] 6.1 Implement StackedCardList component
    - Create `src/components/wallet/StackedCardList.tsx` using FlashList
    - Render CardEdge components showing title, icon, category color tag, background
    - Each card edge minimum 44×44pt tap target
    - Implement vertical scrolling when cards exceed screen
    - Show partial edges to indicate more cards below
    - _Requirements: 1.1, 1.2, 1.3, 17.1, 17.3_

  - [x] 6.2 Implement WalletHeader and EmptyWalletState
    - WalletHeader: "My Wallet" title + kebab menu icon
    - EmptyWalletState: message + "Add tool" button linking to library browser
    - Kebab menu options: Archive, Settings
    - _Requirements: 1.4, 1.5_

- [x] 7. Wallet UI — Focus and Expand interactions
  - [x] 7.1 Implement FocusedCardView with animations
    - Animate tapped card to centered position within 300ms using Reanimated shared values
    - Slide other cards into collapsed bottom stack
    - Display: Title, Description, OriginBadge, Category, total uses, streak, last used, primary action button, kebab menu
    - _Requirements: 2.1, 2.2, 2.3, 13.4, 17.1_

  - [x] 7.2 Implement collapsed stack and card switching
    - Show collapsed stack at bottom (top edge of topmost card visible)
    - Tap collapsed stack → fan out up to 5 card tops
    - Tap fanned card → transition to focused state, return previous card to stack
    - Swipe down on focused card → return to stacked view
    - _Requirements: 2.4, 2.5, 2.6, 3.2_

  - [x] 7.3 Implement ExpandedCardView with ControlRenderer
    - Tap focused card / "Expand" button → expand vertically downward
    - Scrollable content within card, header and bottom stack fixed
    - Create ControlRenderer iterating controls, rendering appropriate component per type
    - Implement all 10 control components: StaticText, TextInput, TextArea, MoodSlider, ChoiceButtons, Checkbox, Counter, DateTimeStamp, ImageAttachment, LinkButton
    - Swipe down / collapse button → return to focused state preserving input data
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.4 Implement completion submission and validation
    - "Save"/"Complete" button triggers submitCompletion
    - Validate required controls are filled; highlight incomplete fields with inline errors
    - On success: record completion, update stats display, clear inputs
    - Auto-include "Mark as done" for static-only cards
    - _Requirements: 3.6, 3.7, 5.3, 5.4, 5.5, 5.8_

- [x] 8. Card reorder mode
  - [x] 8.1 Implement reorder mode with drag-and-drop
    - Long-press (500ms) on any card → enter reorder mode (vertical list + drag handles + "Done" button)
    - Skip if fewer than 2 cards
    - Drag card up/down with visual elevation on dragged card
    - Drop or tap "Done" → persist new order via CardService.reorder
    - Tap outside → discard changes, exit to stacked view with original order
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 9. Checkpoint — core wallet interactions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Card creation flow
  - [x] 10.1 Implement Step 1 — Card Shell editor
    - Title input (max 80 chars), Description input (max 300 chars)
    - Icon picker (searchable library, emoji, image upload)
    - Background picker (color picker with presets, gradient options, image upload with 750×500 min / 10MB max validation)
    - Block "Next" if any shell field is empty; show inline errors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 5.6, 5.7_

  - [x] 10.2 Implement Step 2 — Controls editor
    - Ordered list of added controls with drag handles for reordering
    - "Add block" button showing available control types
    - Each control has type-specific config UI (labels, placeholders, options, URL validation for link buttons)
    - Enforce max 10 controls
    - _Requirements: 7.5, 7.7, 6.1, 6.4, 6.8_

  - [x] 10.3 Implement Step 3 — Preview and Save
    - Full interactive preview of card as it will appear in wallet
    - User can interact with controls to verify behavior
    - Save → add card with "My tool" badge at top of stack
    - _Requirements: 7.6, 7.8_

  - [x] 10.4 Implement edit flow and unsaved changes guard
    - "Edit" from kebab menu → open creation flow pre-populated with card data
    - Save updates card preserving usage history
    - Navigate away without saving → confirmation prompt
    - _Requirements: 7.9, 7.10, 9.2_

- [x] 11. Curated Library
  - [x] 11.1 Seed curated library data and implement browser
    - Create 10–12 curated cards across 6 categories as seed data
    - Implement library browser: cards grouped by category, showing title, icon, description, category tag, "Library" badge
    - Category filter tabs
    - "Add to wallet" button → copy card to top of stack
    - Block duplicate adds with message
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 12. Origin badges, kebab menu, and duplicate
  - [x] 12.1 Implement origin badge display and editability rules
    - Display badge on all cards (Library / Community / My tool)
    - Show "Edit" in kebab only for "My tool" cards
    - Hide edit actions and block modifications for Library/Community cards
    - Show read-only message + offer "Duplicate tool" if modification attempted
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [x] 12.2 Implement kebab menu actions and duplicate logic
    - My tool menu: Edit, Duplicate tool, View usage history, Set reminder, Archive card
    - Library/Community menu: Duplicate tool, View usage history, Set reminder, Archive card
    - Duplicate: copy shell + controls, title + " - Copy", badge = "my_tool", stats zeroed, placed at top
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 12.3 ~~Write property test: Origin Badge Editability (Property 5)~~ — Moved to `property-tests` spec (task 5.1)

  - [x] 12.4 ~~Write property test: Duplicate Independence (Property 6)~~ — Moved to `property-tests` spec (task 5.2)

- [x] 13. Usage history and reminders
  - [x] 13.1 Implement usage history view
    - Scrollable list of completions (newest first) showing timestamp, control values, mood values
    - Swipe-to-delete with confirmation prompt
    - Empty state for cards with zero completions
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 13.2 Implement per-card reminders with notifications
    - Create `src/services/reminderService.ts` and `src/services/notificationService.ts`
    - Reminder config: time of day + frequency (daily, 3x/week with day selection, custom days)
    - Request notification permissions with explainer screen
    - Schedule local notifications via expo-notifications
    - Notification tap → navigate to focused card
    - Edit/delete existing reminders
    - Archive card → disable reminders
    - On app launch: reconcile scheduled notifications with active reminders
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 13.3 ~~Write property test: Reminder-Archive Consistency (Property 7)~~ — Moved to `property-tests` spec (task 6.1)

- [x] 14. Archive and restore
  - [x] 14.1 Implement archive view and restore/delete flow
    - Access from wallet kebab menu
    - List archived cards sorted by most recently archived (title, icon, category, last used)
    - "Restore to wallet" → return to previous position or top of stack
    - "Delete" → confirmation prompt → permanent removal of card + all related data
    - Cancel deletion → retain card unchanged
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 15. Checkpoint — feature completeness
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Settings, data export, and crisis resources
  - [x] 16.1 Implement settings screen
    - Mental health disclaimer display
    - Crisis resources link (accessible within 2 taps from any screen)
    - Export data option
    - Delete all data option
    - _Requirements: 15.4, 15.2_

  - [x] 16.2 Implement data export and deletion
    - Export: generate JSON or CSV file of all personal data, present system share sheet
    - Delete: confirmation prompt → wipe all data + reset app to initial state
    - _Requirements: 16.2, 16.3_

  - [x] 16.3 Implement crisis resources screen
    - Display 988 Lifeline + IASP directory link
    - Show disclaimer text alongside crisis resource links
    - Geolocation-aware (fallback to US 988 if location unavailable)
    - _Requirements: 15.2, 15.3, 15.5_

- [x] 17. Performance optimization and accessibility
  - [x] 17.1 Optimize list rendering and animations
    - FlashList configuration for 50+ card wallets
    - Ensure all card interactions respond within 300ms
    - Lazy-load controls only when expanded
    - Image thumbnails (200px) for stack view, full images on expand
    - Background image resize to max 1500px width before storage
    - _Requirements: 17.1_

  - [x] 17.2 Implement accessibility compliance
    - Minimum contrast ratio 4.5:1 for all text
    - Minimum tap targets 44×44 points
    - VoiceOver/TalkBack labels on all interactive elements
    - Dynamic Type / system font scaling support
    - Screen reader announcements for card state transitions
    - _Requirements: 17.3_

  - [x] 17.3 Implement link button error handling
    - Open target URL via system handler, log activation
    - If target app not installed → attempt fallback URL
    - If no fallback → display "Couldn't open this app" message with edit suggestion
    - _Requirements: 6.5, 6.6, 6.7_

- [x] 18. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Property-based test tasks have been moved to the `property-tests` spec
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural break points
- Property tests use fast-check with minimum 100 iterations per property
- All database writes use transactions to prevent partial state
- The curated library content (10–12 cards) should be authored as part of task 11.1

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5", "2.6", "4.1", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4", "8.1"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["10.2"] },
    { "id": 10, "tasks": ["10.3", "10.4"] },
    { "id": 11, "tasks": ["11.1", "12.1", "12.2"] },
    { "id": 12, "tasks": ["12.3", "12.4", "13.1", "13.2"] },
    { "id": 13, "tasks": ["13.3", "14.1"] },
    { "id": 14, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 15, "tasks": ["17.1", "17.2", "17.3"] }
  ]
}
```
