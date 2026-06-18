# Implementation Plan: Mental Health Wallet

## Overview

This plan implements the Mental Health Wallet React Native (Expo) application using a local-first architecture with SQLite/SQLCipher for encrypted storage, Zustand for state management, React Navigation for routing, and Reanimated 3 for animations. Tasks are ordered to build foundational layers first (data, services) then progress through UI, interactions, analytics, and polish.

## Tasks

- [ ] 1. Project setup and core infrastructure
  - [ ] 1.1 Initialize Expo project and install dependencies
    - Initialize a new Expo managed workflow project with TypeScript template
    - Install core dependencies: expo-sqlite, zustand, @tanstack/react-query, @react-navigation/native, @react-navigation/stack, @react-navigation/bottom-tabs, react-native-reanimated, react-native-gesture-handler, expo-notifications, expo-local-authentication, expo-secure-store, expo-crypto, expo-file-system, expo-image-picker, @shopify/flash-list, uuid
    - Install dev dependencies: jest, @testing-library/react-native, fast-check, detox
    - Configure TypeScript paths, ESLint, and Prettier
    - _Requirements: 24.1, 24.3_

  - [ ] 1.2 Define TypeScript types and interfaces
    - Create `src/types/index.ts` with all type definitions: Card, Control, ControlConfig variants, Completion, ControlValue, MoodLog, Reminder, Badge, Submission, Category, enums (OriginBadge, ControlType, MoodContext, TimePeriod, SubmissionStatus, BadgeType, ReminderFrequencyType)
    - Create `src/types/services.ts` with service interfaces: CardService, CompletionService, MoodService, AnalyticsEngine, ReminderService, NotificationService, AuthLockService
    - _Requirements: 5.1, 5.2, 6.1_

  - [ ] 1.3 Set up SQLite database with encryption
    - Create `src/data/database.ts` with SQLCipher initialization using expo-sqlite
    - Generate encryption key on first launch via expo-crypto and store in expo-secure-store
    - Create `src/data/migrations.ts` with the full schema (cards, controls, completions, control_values, mood_logs, reminders, badges, submissions, categories, settings, crisis_resources tables with all indexes)
    - Seed categories table with the 6 categories: Grounding & Calming, Cognitive Reframing, Body & Sensory, Daily Check-In & Journaling, Self-Compassion & Reminders, Lightweight Connection
    - Seed crisis_resources table with default resources (988 Suicide & Crisis Lifeline)
    - _Requirements: 23.1, 9.1, 22.2_

  - [ ] 1.4 Set up navigation structure
    - Create `src/navigation/RootNavigator.tsx` with stack navigator (AuthGate, Disclaimer, MainTabs, Library Browser modal, Card Creator modal, Analytics, Archive, Settings)
    - Create `src/navigation/MainTabNavigator.tsx` with bottom tab navigator containing the Wallet tab
    - Configure deep link handling for notification taps
    - _Requirements: 22.1, 14.5_

- [ ] 2. Data layer services
  - [ ] 2.1 Implement Card Service
    - Create `src/services/CardService.ts` implementing the CardService interface
    - Implement CRUD operations: getAll, getById, create, update, delete
    - Implement reorder (batch position update in single transaction)
    - Implement archive/restore (preserve data, toggle is_archived, store previous_stack_position)
    - Implement duplicate (deep copy with reset stats, "- Copy" title suffix, origin_badge set to "my_tool")
    - Implement validateShell (non-empty/non-whitespace title ≤80 chars, description ≤300 chars, icon non-empty, background non-empty)
    - Implement validateControls (1–10 controls, type-specific validation for each control config)
    - _Requirements: 5.1, 5.6, 5.7, 7.7, 10.4, 11.3, 19.1_

  - [ ]* 2.2 Write property test: Card Shell Validation (Property 2)
    - **Property 2: Card Shell Validation**
    - Generate random combinations of title, description, icon, background values (including empty, whitespace-only, over-length)
    - Assert validation rejects if and only if at least one field is empty/whitespace, and correctly identifies invalid fields
    - **Validates: Requirements 5.6, 5.7, 7.3**

  - [ ]* 2.3 Write property test: Control Count Invariant
    - **Property (from design correctness properties): Control Count Invariant**
    - Generate cards with 0, 1–10, and 11+ controls
    - Assert creation succeeds only for 1–10 controls
    - **Validates: Requirements 7.7**

  - [ ] 2.4 Implement Completion Service
    - Create `src/services/CompletionService.ts` implementing the CompletionService interface
    - Implement record() with transactional write (completion + control_values + mood_log)
    - Validate required controls have values before persisting
    - Implement getByCard with pagination (20 items per page, newest first)
    - Implement deleteEntry with cascade to control_values
    - Implement streak calculation logic (updateStreak, getStreakInfo) using calendar-day comparison in device timezone
    - _Requirements: 5.5, 3.6, 12.1, 15.2, 15.3_

  - [ ]* 2.5 Write property test: Streak Calculation (Property 3)
    - **Property 3: Streak Calculation**
    - Generate random chronologically ordered sequences of completion timestamps
    - Assert streak transitions follow only: 0→1 (first use/after gap), N→N+1 (consecutive day), N→N (same day), N→0 (missed day)
    - **Validates: Requirements 15.2, 15.3**

  - [ ]* 2.6 Write property test: Completion Entry Integrity (Property 1)
    - **Property 1: Completion Recording Round-Trip**
    - Generate cards with random control combinations and valid input values
    - Record completion then read back; assert exact card ID, valid timestamp, and all control values match
    - **Validates: Requirements 3.6, 5.5**

  - [ ] 2.7 Implement Mood Service
    - Create `src/services/MoodService.ts` implementing the MoodService interface
    - Implement logMood with validation (value 1–10, valid context label)
    - Implement getMoodsByCard and getMoodsForPeriod with date filtering
    - Implement calculateTrend: split logs chronologically, compare averages of halves, threshold ±0.5
    - Implement calculateToolEffectiveness: match before/after pairs by completionId, compute average improvement
    - Implement hasDailyCheckIn for current date
    - _Requirements: 17.1, 17.6, 17.8, 17.9, 13.3_

  - [ ]* 2.8 Write property test: Mood Range Invariant (Property 4 from first correctness section)
    - **Property: Mood Range Invariant**
    - Generate mood log entries with values in and outside range 1–10
    - Assert only values 1–10 are persisted
    - **Validates: Requirements 17.4, 17.5**

  - [ ]* 2.9 Write property test: Mood Trend Classification (Property 4)
    - **Property 4: Mood Trend Classification**
    - Generate sets of 3+ mood log values
    - Assert trend is "improving" iff avg(recent_half) - avg(earlier_half) > 0.5, "declining" iff < -0.5, "stable" otherwise
    - For N<3, assert no trend computed
    - **Validates: Requirements 13.3, 17.8**

  - [ ]* 2.10 Write property test: Tool Effectiveness Calculation (Property 5)
    - **Property 5: Tool Effectiveness Calculation and Ranking**
    - Generate cards with 3+ before/after mood pairs
    - Assert effectiveness equals avg(post) - avg(pre), and ranking is descending by improvement
    - **Validates: Requirements 17.9, 25.4**

- [ ] 3. Checkpoint - Core data layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. State management stores
  - [ ] 4.1 Implement Zustand stores
    - Create `src/stores/walletStore.ts` (WalletStore: cards, cardOrder, focusedCardId, isExpanded, isReorderMode, all actions)
    - Create `src/stores/completionStore.ts` (CompletionStore: currentInputValues, setControlValue, submitCompletion, clearInputs)
    - Create `src/stores/moodStore.ts` (MoodStore: mood prompt visibility flags, submitMoodLog, dismissMoodPrompt)
    - Create `src/stores/analyticsStore.ts` (AnalyticsStore: selectedPeriod, walletStats, setPeriod, loadWalletStats)
    - Create `src/stores/authStore.ts` (AuthStore: isAuthenticated, lockEnabled, failedAttempts, lockedUntil, authenticate, checkLockStatus)
    - Wire stores to their respective services
    - _Requirements: 2.1, 2.6, 3.4, 3.5, 4.1, 17.1_

  - [ ]* 4.2 Write unit tests for Zustand stores
    - Test wallet store: focusCard, expandCard, collapseCard, returnToStack, enterReorderMode, commitReorder
    - Test completion store: setControlValue preserves other values, clearInputs resets all
    - Test mood store: prompt lifecycle (show → submit/dismiss)
    - _Requirements: 2.1, 3.4, 3.5_

- [ ] 5. Wallet UI - Stacked card layout
  - [ ] 5.1 Implement card edge component and stacked view
    - Create `src/components/wallet/CardEdge.tsx` showing title, icon, category color tag, and background with 44×44pt minimum tap target
    - Create `src/components/wallet/StackedCardList.tsx` using FlashList with reverse-stacked layout (bottom card closest to header, subsequent cards offset above)
    - Create `src/components/wallet/WalletHeader.tsx` with "My Wallet" title and kebab menu icon
    - Create `src/screens/WalletScreen.tsx` composing header, stacked list, and empty state
    - Implement empty state with message and "Add tool" button linking to library browser
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 5.2 Implement card focus interaction with animations
    - Create `src/components/wallet/FocusedCardView.tsx` with animated transition (spring animation, ≤300ms)
    - Implement tap-to-focus: animate selected card to centered position, collapse other cards to bottom stack
    - Create `src/components/wallet/CollapsedStack.tsx` showing top edge of collapsed cards
    - Implement fan-out on tap of collapsed stack (up to 5 card tops)
    - Implement swipe-down or tap-outside to return to stacked view
    - Use Reanimated 3 shared values and worklets for all transitions (UI thread animations)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 24.1_

  - [ ] 5.3 Implement focused card detail display
    - Display Title, Description, Origin_Badge, Category tag, total uses, current Streak, last used date, earned Badges, and primary action button in FocusedCardView
    - Create `src/components/wallet/StatsRow.tsx` for usage statistics
    - Create `src/components/wallet/BadgeRow.tsx` for earned badge icons
    - Create `src/components/wallet/PrimaryActionButton.tsx` with dynamic label logic (auto "Mark as done" for static-only cards, derived/custom labels for input cards)
    - _Requirements: 2.3, 5.3, 5.4, 5.8, 15.4_

  - [ ]* 5.4 Write property test: Auto-Action Button for Static-Only Cards (Property 16)
    - **Property 16: Auto-Action Button for Static-Only Cards**
    - Generate cards with various control type combinations
    - Assert "Mark as done" is auto-included for static-only cards; input cards get derived/custom label
    - **Validates: Requirements 5.3, 5.4, 5.8**

- [ ] 6. Card expansion and completion flow
  - [ ] 6.1 Implement card expansion
    - Create `src/components/wallet/ExpandedContent.tsx` with scrollable control area (header and bottom stack remain fixed)
    - Animate vertical expansion downward from focused state
    - Implement collapse (swipe-down or button) returning to focused state while preserving input data
    - Implement input preservation when switching cards via collapsed stack
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.2 Write property test: Input Preservation Across Card State Changes (Property 12)
    - **Property 12: Input Preservation Across Card State Changes**
    - Generate control values, simulate collapse and card switch operations
    - Assert all values preserved exactly after returning to card
    - **Validates: Requirements 3.4, 3.5**

  - [ ] 6.3 Implement Control renderer components
    - Create `src/components/controls/ControlRenderer.tsx` that iterates controls and renders appropriate component
    - Create individual control components: StaticTextControl (with rich text: bold, italics, lists, font size), TextInputControl (max 200 chars), TextAreaControl, MoodSliderControl (1–10 with emoji anchors), ChoiceButtonsControl (single select, max 8 options), CheckboxControl, CounterControl, DateTimeStampControl, ImageAttachmentControl (max 20MB, JPEG/PNG), LinkButtonControl
    - Wire each control to completionStore.setControlValue
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 6.4 Implement link button behavior
    - Handle link activation: open URL via system handler (Linking.openURL)
    - Implement fallback URL logic if primary deep link fails (app not installed)
    - Display error message if no fallback and primary fails
    - Log link activation in completion
    - _Requirements: 6.5, 6.6, 6.7_

  - [ ]* 6.5 Write property test: URL Scheme Validation (Property 14)
    - **Property 14: URL Scheme Validation**
    - Generate random strings; assert validation accepts only https://, http://, or non-empty custom scheme containing "://"
    - **Validates: Requirements 6.8**

  - [ ] 6.6 Implement completion recording
    - Implement "Save"/"Complete" tap handler: validate required inputs, record completion via CompletionService (card ID, timestamp, all control values in transaction)
    - Highlight incomplete required fields with inline error messages on validation failure
    - Update card stats (totalUses, currentStreak, lastUsedAt) after successful completion
    - Trigger badge evaluation after completion
    - _Requirements: 3.6, 3.7, 5.5, 15.2_

- [ ] 7. Checkpoint - Core wallet interaction
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Card creation and editing
  - [ ] 8.1 Implement card creation flow (3 steps)
    - Create `src/screens/CardCreatorScreen.tsx` with step navigation (Back/Next buttons, data preserved across steps)
    - Step 1 (`src/components/creator/Step1Shell.tsx`): Title input (max 80), Description input (max 300), Icon picker (searchable library, emoji, or image upload), Background picker (color picker with gradient presets, or image upload with 750×500px min / 10MB max validation)
    - Step 2 (`src/components/creator/Step2Controls.tsx`): Ordered list with drag handles, "Add block" button showing control type picker, max 10 controls enforced
    - Step 3 (`src/components/creator/Step3Preview.tsx`): Full interactive preview of the card with working controls
    - Implement validation gate between steps (Step 1 → 2 requires valid shell)
    - Implement unsaved changes confirmation on exit
    - On save: persist card with origin_badge "my_tool", add to top of wallet stack
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.10_

  - [ ] 8.2 Implement card editing flow
    - Open creation flow pre-populated with existing card data when "Edit" selected from kebab menu
    - Preserve usage history and statistics on save
    - Only allow editing for cards with origin_badge "my_tool"
    - _Requirements: 7.9, 10.2, 10.3_

  - [ ]* 8.3 Write property test: Origin Badge Determines Editability (Property 7)
    - **Property 7: Origin Badge Determines Editability**
    - Generate cards with each origin badge; attempt all update operations
    - Assert edits succeed only for "my_tool"; blocked for "library" and "community"
    - **Validates: Requirements 10.2, 10.3, 11.4**

  - [ ] 8.4 Implement card templates
    - Create `src/data/templates.ts` defining 5 templates: Affirmation/Reminder, Simple Instruction, Mini-Form/Check-In, Journaling/Reflection, Mood Tracker
    - Each template pre-populates Card_Shell (default title/description/icon/background) and Controls
    - Show template selection before creation flow (or "Start from scratch")
    - Template-based cards allow full modification of all fields and controls
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9. Curated library browser
  - [ ] 9.1 Implement library browser screen
    - Create `src/screens/LibraryBrowserScreen.tsx` with category-grouped card display
    - Create `src/data/curatedLibrary.ts` with 18–21 curated cards across 6 categories
    - Display each card with title, icon, short description, category tag, and "Library" Origin_Badge
    - Implement "Add to wallet" button (copies card to top of stack)
    - Prevent duplicate adds (show message if card already in wallet)
    - _Requirements: 9.1, 9.2, 9.6, 9.7, 9.8_

  - [ ] 9.2 Implement library search and filtering
    - Implement search: partial text match against title, description, or category name (case-insensitive, triggers after 1 character)
    - Implement category filter (single category selection)
    - Implement sort option: category-grouped (default) or newest-to-oldest
    - Display empty state when no results match
    - _Requirements: 9.3, 9.4, 9.5, 9.9_

  - [ ]* 9.3 Write property test: Library Search Returns Matching Cards (Property 9)
    - **Property 9: Library Search Returns Matching Cards**
    - Generate search queries and card sets; assert results include all and only cards whose title/description/category contains the query as case-insensitive substring
    - **Validates: Requirements 9.3**

  - [ ]* 9.4 Write property test: Category Filter Returns Correct Subset (Property 10)
    - **Property 10: Category Filter Returns Correct Subset**
    - Generate category selections and card sets; assert filtered results contain all and only matching cards
    - **Validates: Requirements 9.4**

- [ ] 10. Kebab menu, origin badges, and card management
  - [ ] 10.1 Implement kebab menu with contextual actions
    - Create `src/components/wallet/KebabMenu.tsx` with context-aware options
    - "My tool" cards: Edit, Duplicate tool, View usage history, View insights, Set reminder, Archive card, Submit to library
    - "Library"/"Community" cards: Duplicate tool, View usage history, View insights, Set reminder, Archive card
    - Create wallet-level kebab menu: Analytics dashboard, Archive, Settings, Global reminder
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ] 10.2 Implement duplicate and origin badge display
    - Implement duplicate action: copy all shell/controls, title + " - Copy", origin_badge = "my_tool", reset stats to zero, place at top of stack
    - Display origin badge on all cards (Library, Community, My tool)
    - Show read-only message + "Duplicate tool" offer when attempting to edit Library/Community cards
    - _Requirements: 10.1, 10.4, 10.5, 11.3_

  - [ ]* 10.3 Write property test: Duplicate Creates Independent Copy (Property 13)
    - **Property 13: Duplicate Creates Independent Copy with Reset Stats**
    - Generate cards with various stats; duplicate and verify title " - Copy", origin "my_tool", same shell/controls, stats reset to zero
    - **Validates: Requirements 10.4, 11.3**

- [ ] 11. Card reorder mode
  - [ ] 11.1 Implement reorder mode
    - Create `src/components/wallet/ReorderMode.tsx` with vertical list layout showing drag handles and "Done" button
    - Enter on long-press (≥500ms) with ≥2 cards in wallet
    - Drag-and-drop with visual elevation on dragged card
    - Persist new order on drop or "Done" tap (single transaction)
    - Discard uncommitted changes on tap outside
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 11.2 Write property test: Card Reorder Persistence (Property 11)
    - **Property 11: Card Reorder Persistence**
    - Generate valid card permutations; persist reorder and read back; assert exact order matches
    - **Validates: Requirements 4.4**

- [ ] 12. Checkpoint - UI and interactions complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Mood logging system
  - [ ] 13.1 Implement mood slider prompts
    - Create `src/components/mood/MoodSliderPrompt.tsx` (dismissable overlay with 1–10 slider and emoji anchors)
    - Implement pre-use mood prompt: show when user taps primary action to begin card use
    - Implement post-completion mood prompt: show after completion is recorded
    - Implement daily check-in prompt: show on app open if enabled and no mood logged today
    - Store each mood log with card ID, completion ID (if linked), timestamp, and context label
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

  - [ ]* 13.2 Write property test: Mood Log Storage Integrity (Property 15)
    - **Property 15: Mood Log Storage Integrity**
    - Generate valid mood values (1–10), card IDs, and context labels; save and read back
    - Assert exact value, correct card ID, valid timestamp, correct context label
    - **Validates: Requirements 6.3, 17.6**

- [ ] 14. Usage history and per-tool insights
  - [ ] 14.1 Implement usage history view
    - Create `src/screens/UsageHistoryScreen.tsx` showing scrollable list of completions (newest first)
    - Display timestamp, all input control values, associated mood log values, text content per entry
    - Implement swipe-to-delete with confirmation prompt
    - Display empty state for cards with zero completions
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 14.2 Write property test: Usage History Sort Order (Property 22)
    - **Property 22: Usage History Sort Order**
    - Generate completion sets; assert display is descending by timestamp with no missing or duplicated entries
    - **Validates: Requirements 12.1**

  - [ ] 14.3 Implement per-tool insights panel
    - Create `src/screens/ToolInsightsScreen.tsx` with usage chart, streak, total uses, last used, avg mood after use
    - Implement time period switcher (7 days, 30 days, this year, all time)
    - Display mood trend with indicator (improving/declining/stable) when ≥3 mood entries
    - Show "more entries needed" message when <3 mood entries
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 15. Reminders and notifications
  - [ ] 15.1 Implement reminder service and notification scheduling
    - Create `src/services/ReminderService.ts` and `src/services/NotificationService.ts`
    - Implement per-card reminder: configure time + frequency (daily, 3x/week, custom days)
    - Implement global "Daily wellness check-in" reminder (suggests least-used card in past 14 days)
    - Handle notification permission flow (check → explain → request → guide to settings if denied)
    - Schedule local notifications via expo-notifications
    - Store notification IDs for cancellation/updates
    - Reconcile scheduled notifications on app launch (handle timezone changes, reinstalls)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.6_

  - [ ] 15.2 Implement notification tap navigation
    - Handle notification tap: parse deep link payload `{ type: 'card_reminder', cardId }` and navigate to FocusedCardView
    - Implement edit/delete existing reminders from kebab menu
    - Auto-disable reminders when card is archived
    - _Requirements: 14.5, 14.6, 14.7_

  - [ ]* 15.3 Write property test: Reminder-Archive Consistency (Property 8/10)
    - **Property 8: Archive Preserves Data and Disables Reminders**
    - Archive cards with active reminders; verify all associated reminders set to inactive
    - Verify all completion records, mood logs, streak history remain unchanged
    - **Validates: Requirements 19.1, 14.7**

- [ ] 16. Habit tracking, streaks, and badges
  - [ ] 16.1 Implement streak display and background reset
    - Display current streak, total uses, and last used date on FocusedCardView (already partially done in 5.3)
    - Implement daily streak reset check on app open (resetStaleStreaks for cards with gap > 1 day)
    - Use device local timezone for calendar-day boundaries
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 16.2 Implement badge evaluation and display
    - Create `src/services/BadgeService.ts` implementing evaluateBadges logic
    - Streak badges: award at exactly 7-day and 30-day streaks per card
    - Consistency badges: 10 uses (per card), 50 and 100 total uses (global)
    - Variety badges: 5 different categories used, all categories used
    - Display in-app celebration animation when badge earned
    - Show card-specific badges on FocusedCardView, all badges on achievements page
    - Implement "Share this achievement" with pre-filled social post and #MentalHealthWallet hashtag
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 16.3 Write property test: Badge Evaluation (Property 6)
    - **Property 6: Badge Evaluation**
    - Generate completion events with varying streak/use counts/categories
    - Assert badges awarded if and only if exact thresholds met (7/30 streak, 10/50/100 uses, 5/all categories)
    - **Validates: Requirements 16.1, 16.2, 16.3**

- [ ] 17. Checkpoint - Analytics and habits
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Wallet-level analytics dashboard
  - [ ] 18.1 Implement analytics dashboard
    - Create `src/screens/AnalyticsDashboardScreen.tsx` accessible from wallet kebab menu
    - Display: total tools in wallet, total completions for period, most-used tools (top 3), tools not used in 14 days
    - Implement time period switcher (7d default, 30d, year, all time)
    - Include mood analytics section (trend chart, tool effectiveness ranking, mood correlation) with minimum data thresholds
    - Display mental health disclaimer at top of analytics view
    - Display empty state if zero completions for period
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 22.4_

  - [ ]* 18.2 Write property test: Wallet Dashboard Statistics (Property 17)
    - **Property 17: Wallet Dashboard Statistics**
    - Generate card/completion sets for various time periods
    - Assert correct total cards, total completions, top 3 by count, and unused-14-days list
    - **Validates: Requirements 18.1**

- [ ] 19. Insights and recommendations
  - [ ] 19.1 Implement insights engine
    - Create `src/services/InsightsService.ts` implementing insights generation
    - Weekly summary: count distinct tools used and total completions for past 7 days
    - Streak encouragement: generate at streak milestones (3, 7, 30)
    - Tool effectiveness insight: show avg mood improvement when ≥3 before/after pairs exist
    - Re-engagement suggestions: cards unused ≥10 days (not archived), max 3 shown
    - Create `src/screens/InsightsScreen.tsx` accessible from analytics dashboard
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

  - [ ]* 19.2 Write property test: Re-engagement Suggestion Logic (Property 18)
    - **Property 18: Re-engagement Suggestion Logic**
    - Generate non-archived cards with varying last-used dates
    - Assert all cards unused ≥10 days identified; max 3 suggestions presented
    - **Validates: Requirements 25.5**

  - [ ]* 19.3 Write property test: Weekly Summary Insight (Property 24)
    - **Property 24: Weekly Summary Insight**
    - Generate 7-day completion records; assert correct count of distinct cards and total completions
    - **Validates: Requirements 25.2, 25.3**

- [ ] 20. Archive and restore
  - [ ] 20.1 Implement archive and restore flow
    - Create `src/screens/ArchiveScreen.tsx` showing archived cards (sorted by most recently archived)
    - Display title, icon, category tag, last-used date for each archived card
    - Implement "Restore to wallet" (return to previous position or top of stack)
    - Implement "Delete" with confirmation prompt and cascade deletion (card + completions + control_values + mood_logs + reminders)
    - Dismissing confirmation retains card unchanged
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ]* 20.2 Write property test: Archive Data Preservation (Property 5 from first correctness section)
    - **Property 5 (from design): Archive Data Preservation**
    - Archive cards with known data; verify all completions, mood logs, stats, badges unchanged after archival
    - **Validates: Requirements 19.1**

  - [ ]* 20.3 Write property test: Cascade Deletion (Property 20)
    - **Property 20: Cascade Deletion**
    - Generate cards with completions, control values, mood logs, reminders; delete card
    - Assert zero orphaned entries referencing deleted card
    - **Validates: Requirements 19.5, 23.6**

- [ ] 21. User submissions and moderation
  - [ ] 21.1 Implement submission flow
    - Create `src/screens/SubmissionScreen.tsx` with pre-filled form (title max 60, description max 200, category, "When to use" max 300, tool type)
    - Display submission guidelines and require acknowledgment checkbox
    - Implement anonymous vs. attributed publishing choice
    - On submit: place in moderation queue, show "Pending Review" status
    - Implement resubmission for rejected cards
    - POST submission to moderation API endpoint
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.10_

  - [ ] 21.2 Implement submission status handling
    - Handle approval notification: make card visible with "Community" badge
    - Handle rejection notification: show rejection reason and feedback
    - Display submission status in kebab menu ("Pending Review", "Approved", "Rejected")
    - _Requirements: 20.8, 20.9_

- [ ] 22. Security and app lock
  - [ ] 22.1 Implement app lock (biometric + PIN)
    - Create `src/services/AuthLockService.ts` implementing AuthLockService interface
    - Implement biometric authentication via expo-local-authentication with PIN fallback
    - Implement PIN setup (4–6 digits, hashed with PBKDF2, stored in secure store)
    - Implement lockout policy: 5 failed PIN attempts → 60-second lockout
    - Trigger authentication when app returns to foreground from background
    - Create `src/screens/AuthGateScreen.tsx` with biometric/PIN UI
    - _Requirements: 23.2, 23.3, 23.4_

  - [ ]* 22.2 Write property test: PIN Lockout Policy (Property 23)
    - **Property 23: PIN Lockout Policy**
    - Generate sequences of PIN attempts; assert lockout at exactly 5 consecutive failures
    - Assert failure count resets on successful authentication
    - **Validates: Requirements 23.4**

  - [ ] 22.3 Implement data export and deletion
    - Create `src/services/ExportService.ts` for data export
    - Implement JSON and CSV export of all personal data (cards, entries, mood logs, statistics)
    - Present system share sheet for file distribution
    - Implement full data deletion with confirmation prompt (remove all data, reset to initial state)
    - _Requirements: 23.5, 23.6_

  - [ ]* 22.4 Write property test: Data Export Completeness (Property 19)
    - **Property 19: Data Export Completeness**
    - Generate user data sets; export as JSON and parse; assert every card, completion, and mood log present
    - **Validates: Requirements 23.5**

- [ ] 23. Mental health safeguards
  - [ ] 23.1 Implement disclaimers and crisis resources
    - Create `src/screens/DisclaimerScreen.tsx` shown on first launch with acknowledgment requirement
    - Create `src/screens/CrisisResourcesScreen.tsx` accessible within 2 taps from any screen
    - Implement geolocation-aware crisis hotline display (fallback to US 988 + IASP directory if location unavailable)
    - Display mental health disclaimer in settings and analytics views
    - Display crisis disclaimer text alongside resource links
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 24. Checkpoint - Feature complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 25. Performance optimization and accessibility
  - [ ] 25.1 Implement performance optimizations
    - Use FlashList for all scrollable lists (wallet stack, usage history, library, archive)
    - Implement lazy control rendering (only when card expanded)
    - Optimize card loading: single JOIN query for active cards + controls on app launch
    - Implement image handling: client-side resize to max 1500px, thumbnail generation (200px), content-addressable caching, lazy loading for expanded cards
    - Batch analytics queries with aggregate SQL (SUM, AVG, COUNT with date filters)
    - Limit virtualized list viewport to 50 cards maximum
    - _Requirements: 24.1_

  - [ ] 25.2 Implement accessibility compliance
    - Ensure 4.5:1 minimum contrast ratio for all text
    - Ensure 44×44pt minimum tap targets on all interactive elements
    - Add VoiceOver (iOS) and TalkBack (Android) labels to all interactive elements
    - Support Dynamic Type / system font scaling
    - Test with screen readers and verify meaningful navigation order
    - _Requirements: 24.3_

  - [ ]* 25.3 Write property test: Fanned Stack Count (Property 21)
    - **Property 21: Fanned Stack Count**
    - Generate wallets with N>1 cards and one focused; assert fanned count equals min(N-1, 5)
    - **Validates: Requirements 2.4**

- [ ] 26. Curator admin panel (web app)
  - [ ] 26.1 Set up curator admin web application
    - Create `curator-admin/` directory with React + Vite + TypeScript project
    - Set up Express.js REST API with PostgreSQL connection for moderation queue
    - Define API endpoints: POST /submissions, GET /submissions, POST /submissions/:id/approve, POST /submissions/:id/reject, POST /submissions/:id/request-changes, GET /library/updates
    - _Requirements: 21.1, 21.2_

  - [ ] 26.2 Implement moderation queue UI
    - Create moderation queue list view with filters (status, category, date range) and sort (newest/oldest)
    - Create submission detail view with full card preview (shell + first 3 controls) and similar category cards
    - Implement Approve / Request Changes / Reject actions with feedback text (max 500 chars)
    - Implement library management: create new Library cards using card builder interface
    - Create statistics dashboard: submissions this week, approval rate, top category, avg decision time, overdue count (>5 days)
    - _Requirements: 21.3, 21.4, 21.5, 21.6, 21.7_

- [ ] 27. Final checkpoint - All features complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural breakpoints
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The curator admin panel (task 26) is a separate web application that can be developed in parallel with the mobile app
- All animations must run on the UI thread via Reanimated worklets for 60fps performance
- All multi-step database writes must use SQLite transactions for atomicity
- The app uses local-first architecture — no cloud sync in MVP

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.7"] },
    { "id": 4, "tasks": ["2.5", "2.6", "2.8", "2.9", "2.10", "4.1"] },
    { "id": 5, "tasks": ["4.2", "5.1"] },
    { "id": 6, "tasks": ["5.2", "5.3", "9.1"] },
    { "id": 7, "tasks": ["5.4", "6.1", "9.2", "10.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "9.3", "9.4", "10.2"] },
    { "id": 9, "tasks": ["6.4", "6.5", "10.3", "11.1"] },
    { "id": 10, "tasks": ["6.6", "8.1", "11.2"] },
    { "id": 11, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 12, "tasks": ["13.1", "14.1", "15.1"] },
    { "id": 13, "tasks": ["13.2", "14.2", "14.3", "15.2"] },
    { "id": 14, "tasks": ["15.3", "16.1"] },
    { "id": 15, "tasks": ["16.2", "18.1"] },
    { "id": 16, "tasks": ["16.3", "18.2", "19.1"] },
    { "id": 17, "tasks": ["19.2", "19.3", "20.1"] },
    { "id": 18, "tasks": ["20.2", "20.3", "21.1"] },
    { "id": 19, "tasks": ["21.2", "22.1"] },
    { "id": 20, "tasks": ["22.2", "22.3", "23.1"] },
    { "id": 21, "tasks": ["22.4", "25.1", "25.2"] },
    { "id": 22, "tasks": ["25.3", "26.1"] },
    { "id": 23, "tasks": ["26.2"] }
  ]
}
```
