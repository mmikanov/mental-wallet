# Implementation Plan: Emotion-First Onboarding

## Overview

This plan implements the emotion-first onboarding and session flow for the Mental Health Wallet app. The implementation proceeds in layers: types and schema first, then services, then stores, then UI components, and finally integration/wiring. Each task builds incrementally on the previous work so there is no orphaned code.

## Tasks

- [x] 1. Define types and extend database schema
  - [x] 1.1 Add new domain types to src/types/index.ts
    - Add `EmotionType`, `ContextType`, `TimeType`, `StartMode`, `CardType` type aliases
    - Add `EmotionTag`, `CardContextTag`, `CardTimeTag` interfaces
    - Add `EmotionSessionRecord` interface
    - _Requirements: 5.1, 5.6, 6.2, 6.4, 8.1, 8.4, 11.4_

  - [x] 1.2 Add database migration for emotion tables and card_type column
    - Add `card_type` column to cards table (ALTER TABLE with DEFAULT 'standard')
    - Create `emotion_tags` table with card_id, emotion, and unique constraint
    - Create `card_context_tags` table with composite primary key
    - Create `card_time_tags` table with composite primary key
    - Create `emotion_sessions` table with all required fields
    - Add indexes for efficient querying
    - _Requirements: 8.1, 8.2, 8.4, 11.4, 11.5_

  - [x] 1.3 Extend CuratedCardDefinition with emotion/context/time tag fields
    - Add optional `emotionTags?: EmotionType[]`, `contextTags?: ContextType[]`, `timeTags?: TimeType[]` to `CuratedCardDefinition` interface in `src/data/curatedLibrary.ts`
    - Populate initial emotion tag mappings for all 11 curated cards per Requirement 8.5
    - Populate context associations per Requirement 8.6
    - Populate time associations per Requirement 8.7
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7_

  - [x] 1.4 Seed the Session Launcher Card and emotion tag data
    - Add Session Launcher Card definition to seed data (id: 'session-launcher', type: 'session_launcher')
    - Seed emotion_tags rows for all curated library cards when they are added to the wallet
    - Seed card_context_tags and card_time_tags for curated cards
    - Position Session Launcher Card below Starter_Cards in initial stack
    - _Requirements: 4.1, 4.2, 5.6, 8.5, 8.6, 8.7_

- [x] 2. Implement emotion tag and session services
  - [x] 2.1 Create emotionTagService (src/services/emotionTagService.ts)
    - Implement `getTagsForCard(cardId): Promise<EmotionTag[]>`
    - Implement `getCardIdsByEmotion(emotion): Promise<string[]>`
    - Implement `setTagsForCard(cardId, emotions): Promise<void>` (upsert logic)
    - Implement `getContextTags(cardId): Promise<ContextType[]>`
    - Implement `getTimeTags(cardId): Promise<TimeType[]>`
    - Validate emotion tag count (1–4 per card) and context tag count (≤4)
    - _Requirements: 8.1, 8.4, 9.3, 9.4, 9.6_

  - [x]* 2.2 Write property tests for emotionTagService
    - **Property 10: Curated card emotion tag count constraint** — for any tag set of length 1–4, persisting succeeds; for length 0 or >4, it is rejected
    - **Property 11: Card tag cardinality constraints** — for any card, context tags ≤ 4 and time tags ≤ 1
    - **Property 13: Emotion tag save/edit round-trip** — for any valid subset of emotions, save then read returns exact same set
    - **Validates: Requirements 8.1, 8.4, 9.3, 9.4**

  - [x] 2.3 Create emotionSessionService (src/services/emotionSessionService.ts)
    - Implement `create(emotion): Promise<EmotionSessionRecord>` — creates session, closes any unterminated session first
    - Implement `addToolUsed(sessionId, cardId): Promise<void>` — appends to tool_card_ids JSON array
    - Implement `endSession(sessionId): Promise<void>` — sets ended_at timestamp
    - Implement `endUnterminatedSessions(): Promise<void>` — closes any sessions with null ended_at
    - Implement `getActive(): Promise<EmotionSessionRecord | null>`
    - Implement `updateSelections(sessionId, contexts, time): Promise<void>`
    - Use transactions for multi-step operations
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x]* 2.4 Write property tests for emotionSessionService
    - **Property 14: Session tool list append-only** — for any sequence of tool IDs, each is appended and no previous entries are lost
    - **Property 16: EmotionSession record completeness** — for any created session, all required fields are non-null
    - **Property 17: Previous unterminated session is closed on new session start** — creating a new session closes any open session first
    - **Validates: Requirements 10.2, 11.4, 11.7**

  - [x] 2.5 Create recommendationService (src/services/recommendationService.ts)
    - Implement `getRecommendations(emotion, contexts, time, walletCardIds): Promise<RecommendationResult>`
    - Filter by exact emotion match on emotion_tags
    - Rank by context relevance (count of matching context tags)
    - Exclude tools without matching time tag when time is selected
    - Limit each section to 3 tools, sort by contextScore DESC then title ASC
    - Implement fallback logic when no tools match (most broadly tagged tools)
    - Query wallet cards from DB, library cards from CURATED_LIBRARY in-memory
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x]* 2.6 Write property tests for recommendationService
    - **Property 8: Recommendation engine correctness** — every returned tool has the selected emotion; context-matching tools rank higher; time filtering excludes non-matching; max 3 per section; alphabetical tiebreaker
    - **Property 9: Fallback recommendations when no matches** — returns up to 3 broadly-tagged tools preferring non-wallet tools
    - **Property 12: Library-to-wallet emotion tag retention** — adding a library card preserves its emotion tags
    - **Validates: Requirements 7.3, 7.6, 7.7, 8.3, 8.8, 9.5**

- [x] 3. Implement settings and card service extensions
  - [x] 3.1 Create settingsService for Start_Mode (src/services/settingsService.ts)
    - Implement `getStartMode(): Promise<StartMode>` — reads from settings table, defaults to 'wallet' if missing/invalid
    - Implement `setStartMode(mode: StartMode): Promise<void>` — persists to settings table
    - Implement `getLastUsedMode(): Promise<'wallet' | 'emotion'>` — reads last_used_mode key
    - Implement `setLastUsedMode(mode: 'wallet' | 'emotion'): Promise<void>`
    - Validate and sanitize invalid values to 'wallet'
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x]* 3.2 Write property tests for settingsService
    - **Property 1: Invalid Start_Mode resolves to "wallet"** — for any non-valid string, reading start mode returns 'wallet'
    - **Property 2: Start_Mode persistence round-trip** — for any valid StartMode, write then read returns same value
    - **Validates: Requirements 2.5, 3.2**

  - [x] 3.3 Extend cardService to block deletion of session_launcher cards
    - Modify `delete()` method to check `card_type` column before allowing permanent deletion
    - Throw an error if card_type is 'session_launcher'
    - Ensure archive and restore still work for session_launcher cards
    - _Requirements: 4.4, 4.5, 4.6_

  - [x]* 3.4 Write property tests for cardService session_launcher protection
    - **Property 3: Session_launcher cards are non-deletable** — for any card with card_type 'session_launcher', delete operation is rejected
    - **Property 15: No duplicate wallet cards from "Add to wallet"** — adding an already-present card does not create duplicates
    - **Validates: Requirements 4.6, 10.6**

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create session store and integrate services
  - [x] 5.1 Create sessionStore (src/stores/sessionStore.ts)
    - Implement state: `isSessionActive`, `selectedEmotion`, `selectedContexts`, `selectedTime`, `recommendations`, `currentSessionId`, `toolsUsedInSession`
    - Implement `selectEmotion(emotion)` — creates session via emotionSessionService, sets state
    - Implement `deselectEmotion()` — clears emotion selection
    - Implement `toggleContext(context)` — toggles context chip in/out of selectedContexts array
    - Implement `selectTime(time)` — sets or clears time selection (single-select with deselect)
    - Implement `fetchRecommendations()` — calls recommendationService, sets recommendations
    - Implement `openTool(cardId)` — appends to toolsUsedInSession, calls emotionSessionService.addToolUsed
    - Implement `endSession()` — calls emotionSessionService.endSession, clears state, records last_used_mode
    - Implement `dismissWithoutSession()` — clears state without persisting session
    - Implement `restoreUnterminatedSession()` — called on app launch to close stale sessions
    - _Requirements: 4.7, 4.9, 5.2, 5.3, 5.4, 6.3, 6.5, 6.6, 6.7, 7.1, 7.2, 10.2, 11.1, 11.2, 11.3, 12.3_

  - [x]* 5.2 Write property tests for sessionStore
    - **Property 4: Collapse discards all unsaved session selections** — dismissWithoutSession clears all selections and creates no DB record
    - **Property 5: Emotion single-selection invariant** — at most one emotion selected at any time; "Show me tools" enabled iff exactly one selected
    - **Property 6: Context chips toggle independently** — toggling one context does not affect others; multiple can be selected
    - **Property 7: Time chips single-select with deselect** — at most one time chip selected; re-tapping deselects
    - **Validates: Requirements 4.9, 5.2, 5.3, 5.4, 6.3, 6.5, 12.3**

- [x] 6. Build UI components for the session flow
  - [x] 6.1 Create EmotionPicker component (src/components/session/EmotionPicker.tsx)
    - Render emotion chips from control configuration (Stressed, Overwhelmed, Anxious, Sad/low, Angry, Numb)
    - Implement single-select behavior with visual distinction for selected chip
    - Display prompt "How are you feeling right now?"
    - Expose accessibility labels and selected state to assistive technologies
    - Use non-clinical language only
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 12.1_

  - [x] 6.2 Create ContextChips component (src/components/session/ContextChips.tsx)
    - Render context chip options with multi-select toggle behavior
    - Labels: "At work/school", "With family", "With friends/social", "Alone at home", "I'm not sure"
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 6.3 Create TimeChips component (src/components/session/TimeChips.tsx)
    - Render time chip options with single-select + deselect behavior
    - Labels: "I have ~1–2 minutes", "I have ~5–10 minutes"
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [x] 6.4 Create ToolPreviewCard component (src/components/session/ToolPreviewCard.tsx)
    - Display card icon, title, and description (truncated to 80 chars)
    - Handle tap to navigate to full card expansion
    - Show "Add to wallet" option for library-sourced tools after returning from tool view
    - _Requirements: 7.1, 10.1, 10.4, 10.5_

  - [x] 6.5 Create SessionView component (src/components/session/SessionView.tsx)
    - Render recommendations in two sections: "From your wallet" and "Suggested tools to try"
    - Display fallback message when no tools match
    - Keep selection controls visible and editable above recommendations
    - Show "End session" button in fixed position (always visible without scrolling)
    - Handle "Show me tools" action (enabled only when emotion is selected)
    - Re-require "Show me tools" tap after selection changes
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 10.3, 11.1_

  - [x] 6.6 Create SessionLauncherContent component (src/components/session/SessionLauncherContent.tsx)
    - Container component for the expanded Session Launcher Card
    - Composes EmotionPicker, ContextChips, TimeChips, and SessionView
    - Handles dismiss affordance ("Not right now" label) that collapses card without session creation
    - Manages transition between picker state and recommendations state
    - _Requirements: 4.7, 4.8, 4.9, 6.1, 12.2, 12.3_

  - [x]* 6.7 Write unit tests for session UI components
    - Test EmotionPicker selection/deselection behavior
    - Test ContextChips multi-select toggle
    - Test TimeChips single-select with deselect
    - Test SessionView section rendering and fallback message
    - Test accessibility labels and states on emotion chips
    - _Requirements: 5.2, 5.3, 5.4, 5.7, 6.3, 6.5, 7.4, 7.5, 7.6_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement onboarding mode choice and launch behavior
  - [x] 8.1 Create ModeChoiceScreen (src/screens/ModeChoiceScreen.tsx)
    - Display "How would you like to start?" prompt
    - Two options: "Open my wallet of tools" and "Start from how I feel right now"
    - Display reassurance text: "You can always change this in Settings."
    - No back navigation — must select an option to proceed
    - Handle error state if persistence fails (show error, allow retry)
    - Persist Start_Mode on selection via settingsService
    - Navigate to Wallet_Screen with appropriate behavior based on selection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_

  - [x] 8.2 Update RootNavigator for mode choice and launch routing
    - Add ModeChoice screen to the native stack
    - Check if Start_Mode exists in DB after disclaimer acknowledged
    - If no Start_Mode → navigate to ModeChoice after onboarding intent selection
    - If Start_Mode exists → apply launch behavior (wallet/emotion/last_used)
    - Handle "Skip Intro" → default Start_Mode to 'wallet', skip ModeChoice
    - Call `endUnterminatedSessions()` on app launch
    - _Requirements: 1.1, 1.6, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 11.3_

  - [x] 8.3 Update WalletScreen for Session Launcher Card highlight behavior
    - When Start_Mode is "emotion" on launch, scroll to Session_Launcher_Card and apply 1-second visual highlight (elevation or pulse animation via Reanimated)
    - Defer Micro_Tutorial when "emotion" mode chosen during onboarding
    - Ensure Session_Launcher_Card renders with unique visual style (accent color, icon)
    - Handle expand/collapse of Session_Launcher_Card with SessionLauncherContent
    - _Requirements: 1.3, 2.2, 4.1, 4.7, 4.8, 4.10_

  - [x]* 8.4 Write unit tests for ModeChoiceScreen and launch routing
    - Test navigation to wallet on "wallet" selection
    - Test navigation with highlight on "emotion" selection
    - Test error handling on persistence failure
    - Test skip behavior defaults to 'wallet'
    - _Requirements: 1.2, 1.3, 1.8, 1.9_

- [x] 9. Implement Settings Start Experience control
  - [x] 9.1 Create StartExperienceSetting component (src/components/settings/StartExperienceSetting.tsx)
    - Display three radio-style options: "Start in my wallet", "Start from how I feel", "Start where I left off"
    - Show currently persisted value as selected
    - On selection change, persist via settingsService
    - Revert to previous selection and show error if persistence fails
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 9.2 Integrate StartExperienceSetting into SettingsScreen
    - Add "Start experience" section to existing SettingsScreen
    - Wire up settingsService for reading/writing Start_Mode
    - _Requirements: 3.1_

- [x] 10. Implement Card Creator emotion tagging
  - [x] 10.1 Add emotion tagging section to CardCreatorScreen
    - Display "When does this tool help?" section with emotion chips after controls configuration step
    - Allow multi-select (0–6 emotions)
    - Make section skippable (no emotions = empty array)
    - Persist selected emotions via emotionTagService on card save
    - Show pre-selected emotions in edit mode
    - Allow editing emotion tags on existing user-created cards
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 11. Implement session view interactions and tool navigation
  - [x] 11.1 Implement tool card opening from SessionView
    - Navigate to full expanded card view from session context (sub-screen)
    - Track tool usage in session via sessionStore.openTool
    - Suppress pre-use mood slider during active session (pass session context flag)
    - Preserve Session_View state and scroll position on return
    - _Requirements: 10.1, 10.2, 10.3, 10.7_

  - [x] 11.2 Implement "Add to wallet" flow from SessionView
    - Show "Add to wallet" option for library tools after returning from expanded view
    - Add card to wallet with origin badge "library", persist with emotion/context/time tags
    - Move tool from "Suggested tools to try" to "From your wallet" section in current view
    - Show brief confirmation (toast or inline checkmark)
    - Handle duplicate detection — show message if tool already in wallet
    - Abort entire operation on failure, show error, keep tool in "Suggested" section
    - Use SQLite transaction for atomicity
    - _Requirements: 10.4, 10.5, 10.6_

  - [x] 11.3 Implement session end and lifecycle handling
    - "End session" navigates back to Wallet_Screen, marks session ended
    - Handle navigation away without explicit end (back nav, backgrounding)
    - Record last_used_mode on session end
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 2.6_

  - [x]* 11.4 Write unit tests for session interactions
    - Test tool opening appends to session tool list
    - Test "Add to wallet" success flow and section transfer
    - Test duplicate detection
    - Test session end writes timestamp
    - _Requirements: 10.2, 10.5, 10.6, 11.2_

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Cross-Spec Dependencies (implement these specs first)

| Dependency | Status | Blocks Tasks | Notes |
|------------|--------|--------------|-------|
| `onboarding` spec | ❌ Not implemented | **8.1, 8.2, 8.3, 8.4** | The Mode Choice screen inserts after Intent Selection in the onboarding flow. Without the onboarding navigator, Welcome screen, Intent Selection, Micro-Tutorial, and onboardingStore in place, tasks 8.x have nothing to hook into. **Implement the `onboarding` spec before starting task group 8.** |
| `mood-logging` spec | ❌ Not implemented | 11.1 (partially) | Task 11.1 suppresses the pre-use mood slider during emotion-first sessions. The mood slider *control* exists in cards, but the standalone pre-use prompt (shown before opening any card) is part of the `mood-logging` spec. **Stub the suppression logic now; wire it up once `mood-logging` lands.** |

### What you CAN implement immediately (no blockers):
- Tasks 1–7: Types, schema, services, stores, UI components
- Tasks 9.x: Settings "Start experience" control
- Tasks 10.x: Card Creator emotion tagging
- Tasks 11.2–11.4: "Add to wallet" flow, session end lifecycle

### What to defer until `onboarding` spec is done:
- Tasks 8.1–8.4: ModeChoiceScreen, navigator routing, wallet highlight, Micro-Tutorial deferral

### Future coordination needed (no implementation blocker):
- `library-enhancements` spec: When the library expands to 18–21 cards, add Emotion_Tag mappings for new cards in seed data
- `tool-customization` spec: The Card Creator emotion tagging section (task 10.1) is positioned after controls — coordinate ordering if media controls are also added

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All data operations are local-only (no network calls) per Requirements 12.5, 12.6, 13.3
- The Session Launcher Card uses the existing card expansion pattern but renders custom content (SessionLauncherContent) instead of standard controls

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["2.1", "2.3", "3.1", "3.3"] },
    { "id": 4, "tasks": ["2.2", "2.4", "2.5", "3.2", "3.4"] },
    { "id": 5, "tasks": ["2.6", "5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6"] },
    { "id": 8, "tasks": ["6.7", "8.1", "9.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "9.2", "10.1"] },
    { "id": 10, "tasks": ["8.4", "11.1", "11.2", "11.3"] },
    { "id": 11, "tasks": ["11.4"] }
  ]
}
```
