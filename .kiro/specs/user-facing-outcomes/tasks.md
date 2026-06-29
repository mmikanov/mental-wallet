# Implementation Plan: User-Facing Outcomes

## Overview

This plan implements the "What Worked for Me" feature — a post-completion outcome feedback system with per-tool insights, aggregated patterns, and user-configurable prompt frequency. Implementation proceeds from data layer up through services, stores, and UI, with property-based tests validating core correctness properties at each layer.

## Tasks

- [ ] 1. Database schema and type definitions
  - [ ] 1.1 Add outcome tables migration
    - Add `outcome_responses` and `outcome_prompt_log` tables to `src/data/migrations.ts`
    - Include all indexes (card_id, category, created_at, emotion_label partial)
    - Add 7 new settings keys with defaults to a seed or migration step
    - _Requirements: 3.1, 3.2, 2.5_

  - [ ] 1.2 Define outcome type definitions
    - Add `OutcomeCategory`, `OutcomeResponse`, `PostCompletionPreference`, `PromptFrequencyConfig`, `CardOutcomeSummary`, `RankedCard` types to `src/types/index.ts`
    - Add `OutcomeService`, `PromptFrequencyService`, `InsightService` interfaces to `src/types/services.ts`
    - _Requirements: 3.1, 3.5, 4.1, 5.2_

- [ ] 2. Implement OutcomeService
  - [ ] 2.1 Create OutcomeService implementation
    - Create `src/services/outcomeService.ts`
    - Implement `record()` with UUID generation via expo-crypto, retry-once logic on failure, silent discard on second failure
    - Implement `getByCard()`, `getByCategory()`, `getByDateRange()`, `getByEmotionLabel()` queries — all returning newest first
    - Implement `deleteAll()` with atomic transaction and rollback on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.6_

  - [ ]* 2.2 Write property test: Outcome recording round-trip
    - **Property 1: Outcome recording round-trip**
    - **Validates: Requirements 1.3, 3.1, 3.2**
    - Create `src/services/__tests__/outcomeService.property.test.ts`
    - Generate random card IDs (UUID), random category from the 5 values, random nullable emotion strings
    - Assert stored record has valid UUID id, correct card_id, category, emotion_label, and created_at within 1s of current time

  - [ ]* 2.3 Write property test: Outcome query filter correctness
    - **Property 3: Outcome query filter correctness**
    - **Validates: Requirements 3.5**
    - In `src/services/__tests__/outcomeService.property.test.ts`
    - Generate random sets of 0–50 outcome records with varied card IDs, categories, dates, emotions
    - Assert query results match filter criteria exactly, ordered by created_at descending, null emotion_label excluded from emotion queries

- [ ] 3. Implement PromptFrequencyService
  - [ ] 3.1 Create PromptFrequencyService implementation
    - Create `src/services/promptFrequencyService.ts`
    - Implement `shouldShowPrompt(cardId)` with logic: check outcomePromptEnabled, initial threshold, daily limit, interval rule
    - Implement `getConfig()` reading from settings table with fallback to defaults
    - Implement `recordPromptShown(cardId)` inserting into outcome_prompt_log
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Write property test: Prompt frequency decision correctness
    - **Property 2: Prompt frequency decision correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6, 6.3**
    - Create `src/services/__tests__/promptFrequencyService.property.test.ts`
    - Generate random completion counts (0–100), random dates, random config values (1–20), random enabled/disabled
    - Assert all 5 decision rules hold for every generated scenario

- [ ] 4. Implement InsightService
  - [ ] 4.1 Create InsightService implementation
    - Create `src/services/insightService.ts`
    - Implement `getCardSummary(cardId)` computing counts, dominant category (tie-break by fixed order), positive percentage, badge eligibility
    - Implement `getTopCardsByCategory()` and `getTopCardsByEmotion()` with ranking, tie-breaking (percentage desc, count desc, title asc), limit 5
    - Implement `getTotalResponseCount()` and `computeBadgeEligibility()`
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.2 Write property test: Dominant category computation
    - **Property 5: Dominant category computation**
    - **Validates: Requirements 4.1, 4.2**
    - Create `src/services/__tests__/insightService.property.test.ts`
    - Generate random arrays of 3–100 outcomes with categories drawn from the 5 values
    - Assert dominant is highest count, ties broken by order: calmer, clear, hopeful, same, worse

  - [ ]* 4.3 Write property test: Badge eligibility computation
    - **Property 6: Badge eligibility computation**
    - **Validates: Requirements 4.5, 4.6**
    - In `src/services/__tests__/insightService.property.test.ts`
    - Generate random arrays of 5–100 outcomes, verify badge eligibility rules (single positive category >50% with 5+ responses)

  - [ ]* 4.4 Write property test: Category ranking correctness
    - **Property 7: Category ranking correctness**
    - **Validates: Requirements 5.2, 5.3, 5.5**
    - In `src/services/__tests__/insightService.property.test.ts`
    - Generate 2–20 cards each with 0–50 outcomes, verify ranking for each positive category

  - [ ]* 4.5 Write property test: Emotion-specific ranking correctness
    - **Property 8: Emotion-specific ranking correctness**
    - **Validates: Requirements 5.4, 5.5**
    - In `src/services/__tests__/insightService.property.test.ts`
    - Generate cards with emotion-tagged outcomes, verify emotion-specific positive outcome rate ranking

  - [ ]* 4.6 Write property test: Generated text content constraints
    - **Property 9: Generated text content constraints**
    - **Validates: Requirements 8.1, 8.3**
    - In `src/services/__tests__/insightService.property.test.ts`
    - Feed random outcome distributions to text/badge generation, verify absence of forbidden words and presence of hedging qualifier

- [ ] 5. Checkpoint — Core services verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Zustand stores
  - [ ] 6.1 Create PreferencesStore
    - Create `src/stores/preferencesStore.ts`
    - Implement `loadPreferences()` reading from settings table, `setPostCompletionPreference()`, `setOutcomePromptEnabled()`, `setBadgesVisible()`, `completeOnboardingFeedback()`
    - All setters persist to settings table immediately
    - _Requirements: 6.2, 6.3, 6.4, 9.1, 9.2, 9.3_

  - [ ] 6.2 Create OutcomeStore
    - Create `src/stores/outcomeStore.ts`
    - Implement `showPrompt()`, `selectCategory()` (calls OutcomeService.record + dismiss), `dismiss()`
    - Manage `isPromptVisible`, `activeCardId`, `activeEmotionLabel` state
    - _Requirements: 1.3, 1.4, 1.6_

  - [ ] 6.3 Create prompt selection logic
    - Create `src/utils/promptSelection.ts`
    - Implement function that determines which prompts to show based on PostCompletionPreference, card mood slider presence, and outcomePromptEnabled state
    - _Requirements: 1.5, 9.4, 9.5, 9.6, 9.7, 9.9_

  - [ ]* 6.4 Write property test: Prompt selection logic
    - **Property 4: Prompt selection logic**
    - **Validates: Requirements 1.5, 9.4, 9.5, 9.6, 9.7, 9.9**
    - Create `src/utils/__tests__/promptSelection.property.test.ts`
    - Generate random preference values, random card configs (with/without mood slider), random enabled state
    - Assert all 6 prompt selection rules hold

- [ ] 7. Integrate outcome prompt into completion flow
  - [ ] 7.1 Wire outcome prompt trigger into CompletionStore
    - Modify `src/stores/completionStore.ts` to call PromptFrequencyService.shouldShowPrompt after successful completion
    - If prompt should show, call OutcomeStore.showPrompt with cardId and emotionLabel from session context
    - Use prompt selection logic to determine prompt sequence
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [ ] 8. Implement UI components
  - [ ] 8.1 Create OutcomeChip component
    - Create `src/components/outcome/OutcomeChip.tsx`
    - Render chip with icon + label, minimum 44×44pt tap target
    - Support selected state, accessible label with sentiment (e.g., "I feel calmer, positive outcome")
    - _Requirements: 1.1, 7.1, 7.2_

  - [ ] 8.2 Create OutcomePrompt component
    - Create `src/components/outcome/OutcomePrompt.tsx`
    - Display question text "Right now, after using this tool…" with 5 OutcomeChip components
    - Include Skip affordance (44×44pt minimum), "Why we ask" link
    - Connect to OutcomeStore: selectCategory on chip tap, dismiss on skip
    - Auto-dismiss on app background (AppState listener)
    - Screen reader focus order: question → chips (calmer, clear, hopeful, same, worse) → "Why we ask" → skip
    - Include micro-copy with "optional" or "no right answer" framing
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 6.1, 7.3, 8.2_

  - [ ] 8.3 Create WhyWeAskModal component
    - Create `src/components/outcome/WhyWeAskModal.tsx`
    - Dismissible modal with ≤200 words at ≤8th grade reading level explaining outcome collection purpose
    - _Requirements: 6.1_

  - [ ] 8.4 Create OutcomeBadge component
    - Create `src/components/outcome/OutcomeBadge.tsx`
    - Render subtle badge label ("Often calming", "Often clarifying", "Often hopeful")
    - Announce badge text as part of card accessibility label
    - Respect badges_visible preference (hide when disabled)
    - _Requirements: 4.5, 4.7, 7.4, 8.1_

  - [ ] 8.5 Create CardOutcomeInsight component
    - Create `src/components/outcome/CardOutcomeInsight.tsx`
    - Display per-card insight: "You said this helped you feel [category] [count] out of [total] times." for cards with 3+ responses
    - Display "We're still learning how this works for you." for <3 responses
    - Recompute on each card detail view open
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.4_

- [ ] 9. Checkpoint — UI components and stores verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement InsightsScreen and navigation
  - [ ] 10.1 Create InsightsScreen
    - Create `src/screens/InsightsScreen.tsx`
    - Display aggregated sections: "Tools that most often help you feel calmer/more clear/more hopeful"
    - Display emotion-specific sections when Emotion_Session data is available
    - Show empty state "Keep using your tools — insights will appear after a few more sessions." when <3 total responses
    - Tapping a card navigates to card detail view
    - Recalculate on screen open
    - Ensure all text is accessible and navigable by screen readers in visual order
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.5_

  - [ ] 10.2 Add Insights tab to navigation
    - Update `MainTabParamList` in `src/navigation/types.ts` to add `Insights: undefined`
    - Update `src/navigation/MainTabNavigator.tsx` to show bottom tab bar, add Insights tab with InsightsScreen
    - _Requirements: 5.1_

- [ ] 11. Implement settings and onboarding
  - [ ] 11.1 Create FeedbackPreferenceSelector component
    - Create `src/components/settings/FeedbackPreferenceSelector.tsx`
    - Display 3 options with descriptions: "Outcome prompt only" / "Mood slider only" / "Both (outcome then mood)"
    - Connect to PreferencesStore.setPostCompletionPreference
    - _Requirements: 9.1, 9.8_

  - [ ] 11.2 Add outcome settings to Settings screen
    - Add to existing `src/screens/SettingsScreen.tsx`: outcome prompt enable/disable toggle, badge visibility toggle, "Delete All Outcome Data" with confirmation dialog, "Post-Completion Feedback" preference selector
    - Wire toggles to PreferencesStore, deletion to OutcomeService.deleteAll()
    - _Requirements: 4.7, 6.2, 6.3, 6.5, 6.6, 9.1_

  - [ ] 11.3 Create OnboardingFeedbackStep component
    - Create `src/components/onboarding/OnboardingFeedbackStep.tsx`
    - Educational message (≤80 words, ≤8th grade) communicating: app helps understand tool impact, everyone defines "what helped" differently, app will ask brief questions
    - Warm language, no clinical terms or "data"/"metrics"/"tracking"/"analytics"
    - Display 3 preference options with descriptions
    - Skip affordance (44×44pt) that sets default "outcome_only"
    - Auto-dismiss on background retains default and re-presents on next launch
    - All elements accessible via screen reader in visual order
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [ ] 12. Wire OutcomeBadge into wallet card display
  - [ ] 12.1 Integrate OutcomeBadge into card wallet view
    - Add OutcomeBadge rendering to the existing card display component in the wallet
    - Call InsightService.computeBadgeEligibility to determine which cards get badges
    - Respect badges_visible preference from PreferencesStore
    - Announce badge as part of card accessibility label
    - _Requirements: 4.5, 4.7, 7.4_

  - [ ] 12.2 Integrate CardOutcomeInsight into card detail view
    - Add CardOutcomeInsight component to the card detail screen
    - Fetch and display per-card summary on detail view open
    - _Requirements: 4.1, 4.3, 4.4_

- [ ] 13. Final checkpoint — Full integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The existing CompletionService and CompletionStore are modified minimally (task 7.1) to trigger the outcome flow
- All services follow the existing pattern: pure functions with database access via `getDatabase()`
- All stores follow the existing Zustand pattern with factory functions for testability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "7.1"] },
    { "id": 5, "tasks": ["8.1", "8.3", "8.4", "8.5"] },
    { "id": 6, "tasks": ["8.2", "10.1", "11.1"] },
    { "id": 7, "tasks": ["10.2", "11.2", "11.3"] },
    { "id": 8, "tasks": ["12.1", "12.2"] }
  ]
}
```
