# Implementation Plan: Guided Emotion Check-in

## Overview

This plan implements the guided emotion check-in feature in layers: types and configuration first, then the pure mapping engine (with property-based tests), database migrations, state management, UI components, and finally integration wiring. Each task builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Foundation: Types, config, and emotion type expansion
  - [x] 1.1 Create check-in domain types
    - Create `src/types/checkin.ts` with `BodyEnergyLevel`, `Pleasantness`, `ThoughtPattern`, `SocialContext`, `CheckinRecord`, `CheckinQuestion`, `CheckinOption`, `MappingInput`, `MappingResult`, `MappingRule`, and `CheckinAnswers` types
    - _Requirements: 3.1, 3.8, 9.1_

  - [x] 1.2 Extend EmotionType union to 12 values
    - Modify `src/types/index.ts` to add `'lonely' | 'ashamed' | 'guilty' | 'hopeless' | 'calm' | 'curious'` to the `EmotionType` union
    - _Requirements: 5.1, 5.5_

  - [x] 1.3 Create emotion configuration module
    - Create `src/data/emotionConfig.ts` with the `EMOTION_OPTIONS` array (12 entries with type, label, icon), `getEmotionDisplayName()` function, and `formatSoftLabel()` function
    - The soft label format: "It sounds like you might be feeling [label] right now"
    - _Requirements: 5.4, 4.2, 7.3_

  - [x] 1.4 Add analytics event types for guided check-in
    - Update `src/types/analytics.ts` to add `'guided_checkin_started'` and `'guided_checkin_completed'` to the analytics event type union
    - _Requirements: 6.5, 6.6_

- [x] 2. Mapping engine: Pure logic and property-based tests (priority-based — superseded by task 14)
  - [x] 2.1 Implement the mapping engine
  - [x] 2.2 Write property test: Total Function (Property 1)
  - [x] 2.3 Write property test: Deterministic Priority (Property 2)
  - [x] 2.4 Write property test: Referential Transparency (Property 3)
  - [x] 2.5 Write property test: Invalid Input Rejection (Property 4)
  - [x] 2.6 Write property test: Catch-All Correctness (Property 5)
  - [x] 2.7 Write property tests: Soft Label and Display Name (Properties 6, 7, 8)

- [x] 3. Checkpoint — Mapping engine tests pass

- [x] 4. Database migrations
  - [x] 4.1 Add `guided_checkin_records` table migration
  - [x] 4.2 Add `checkin_id` column to `emotion_sessions` table
  - [x] 4.3 Rebuild `emotion_tags` CHECK constraint for 12 emotions
  - [x] 4.4 Rebuild `emotion_sessions` CHECK constraint for 12 emotions

- [x] 5. Checkin record service and tool recommendations
  - [x] 5.1 Implement checkin record service
  - [x] 5.2 Update emotion session service to support `checkin_id`
  - [x] 5.3 Add new emotion tool recommendations to curated library

- [x] 6. Check-in store (Zustand state machine)
  - [x] 6.1 Implement the check-in store
  - [x] 6.2 Write property test: Back-navigation clears forward answers (Property 9)
  - [x] 6.3 Write unit tests for check-in store

- [x] 7. Checkpoint — Store and services pass tests

- [x] 8. UI components: Expanded emotion picker
  - [x] 8.1 Expand EmotionPicker to 12 chips with "not sure" button
  - [x] 8.2 Implement GuidedCheckinResult overlay

- [x] 9. UI components: Guided check-in flow
  - [x] 9.1 Implement CheckinProgressIndicator
  - [x] 9.2 Implement CheckinQuestionScreen
  - [x] 9.3 Implement GuidedCheckinFlow container

- [x] 10. Integration: Wire everything together
  - [x] 10.1 Integrate check-in flow into SessionLauncherContent
  - [x] 10.2 Wire analytics events and record persistence
  - [x] 10.3 Update card creator emotion tag picker to show all 12

- [x] 11. Checkpoint — Full integration tests pass

- [x] 12. Integration and accessibility tests
  - [x] 12.1 Write unit tests for EmotionPicker expansion
  - [x] 12.2 Write unit tests for GuidedCheckinFlow
  - [x] 12.3 Write unit tests for checkin record service
  - [x] 12.4 Write unit tests for database migrations

- [x] 13. Final checkpoint — All tests green

---

## Score-Based Rewrite (supersedes priority-based mapping engine)

The mapping engine switches from priority-based rules to a score-based system (SCORING_TABLE), the result screen now handles tied feelings inline within GuidedCheckinFlow, and the checkinStore changes from `derivedFeeling: EmotionType | null` to `topFeelings: EmotionType[]`.

- [x] 14. Update types for score-based mapping
  - [x] 14.1 Update `src/types/checkin.ts` — MappingResult and ScoringWeights
    - Change `MappingResult` from `{ derivedFeeling: EmotionType }` to `{ topFeelings: EmotionType[]; scores: Record<EmotionType, number> }`
    - Remove the `MappingRule` type (no longer used)
    - Add `ScoringWeights` interface with all 19 weight keys: `body_very_low`, `body_low`, `body_medium`, `body_high`, `body_very_high`, `pleasant_unpleasant`, `pleasant_mixed`, `pleasant_pleasant`, `thought_racing`, `thought_stuck_worries`, `thought_stuck_mistakes`, `thought_blank`, `thought_numb`, `thought_curious_interested`, `thought_okay`, `ctx_alone_at_home`, `ctx_at_work`, `ctx_with_family`, `ctx_with_friends`
    - Export `ScoringWeights` for use by mappingEngine
    - _Requirements: 3.1, 3.2, 3.9_

- [x] 15. Rewrite mapping engine to score-based system
  - [x] 15.1 Rewrite `src/services/mappingEngine.ts` — SCORING_TABLE + score algorithm
    - Remove all `MAPPING_RULES` array, `matchesRule`, `matchesCondition` functions
    - Implement `SCORING_TABLE: Record<EmotionType, ScoringWeights>` with all 12 feelings' weights from the design doc CSV
    - Implement `deriveFeeling(input: MappingInput): MappingResult`:
      - Validate inputs (throw on invalid enum values with field name)
      - For each of the 12 feelings, compute additive score by summing weights from SCORING_TABLE keyed by `body_${input.bodyEnergy}`, `pleasant_${input.pleasantness}`, `thought_${input.thoughtPattern}`, `ctx_${input.context}`
      - Find the maximum score across all 12 feelings
      - If maxScore ≤ 2, return `{ topFeelings: ['stressed'], scores }`
      - Otherwise collect all feelings tied at maxScore into `topFeelings`
      - Return `{ topFeelings, scores }`
    - Keep input validation function that throws synchronous Error with field name
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 16. Rewrite mapping engine property tests
  - [x] 16.1 Write property test: Total Function (Property 1)
    - **Property 1: Total Function — all 420 combinations produce valid output**
    - Rewrite `src/services/__tests__/mappingEngine.test.ts` from scratch
    - Generate all valid input combinations via `fc.constantFrom` for each enum
    - Assert `deriveFeeling` returns `topFeelings` as non-empty array where every element is one of the 12 valid EmotionType values, and `scores` contains all 12 keys with numeric values
    - **Validates: Requirements 3.1, 3.7**

  - [x] 16.2 Write property test: Highest Score Wins (Property 2)
    - **Property 2: Highest score wins**
    - For generated valid inputs, manually compute all 12 scores from SCORING_TABLE, find the max, assert `topFeelings` contains exactly those feelings matching the max score and no others
    - **Validates: Requirements 3.2, 3.3**

  - [x] 16.3 Write property test: Referential Transparency (Property 3)
    - **Property 3: Referential transparency — same input same output**
    - Call `deriveFeeling` twice with same generated input, assert identical `topFeelings` arrays (same elements in same order) and identical `scores` records
    - **Validates: Requirements 3.6**

  - [x] 16.4 Write property test: Invalid Input Rejection (Property 4)
    - **Property 4: Invalid input rejection**
    - Generate inputs where at least one field contains a non-enum string value
    - Assert `deriveFeeling` throws an Error whose message identifies the invalid field name
    - **Validates: Requirements 3.8**

  - [x] 16.5 Write property test: Fallback When All Scores ≤ 2 (Property 5)
    - **Property 5: Fallback when all scores ≤ 2**
    - For inputs where manually-computed max score ≤ 2, assert result is `topFeelings: ['stressed']`
    - For inputs where max score > 2, assert "stressed" only appears in `topFeelings` if it actually has the max score
    - **Validates: Requirements 3.5**

  - [x] 16.6 Write property test: All 12 Emotions Reachable (Property 6)
    - **Property 6: All 12 emotions are reachable**
    - Exhaustively test all 420 combinations, collect all emotions appearing in any `topFeelings` result, assert all 12 are present
    - **Validates: Requirements 3.7**

  - [x] 16.7 Write property tests: Soft Label, Banned Terms, Display Names (Properties 7, 8, 9)
    - **Property 7: Soft label format compliance**
    - For each of 12 emotions, assert `formatSoftLabel` output matches template "It sounds like you might be feeling {lowercase label} right now"
    - **Property 8: No banned clinical terms**
    - Enumerate all user-facing string constants in check-in flow, assert none contain banned words from Requirement 7.1
    - **Property 9: Display name completeness**
    - For every EmotionType, assert `getEmotionDisplayName` returns a non-empty string
    - **Validates: Requirements 4.3, 7.1, 7.3, 5.4**

  - [x] 16.8 Write property test: Back-Navigation Clears Forward Answers (Property 10)
    - **Property 10: Back-navigation clears forward answers**
    - Generate random answer sequences and back-navigation points in checkinStore
    - Assert navigating back to step M clears answers for steps M+1 through 4 and retains answers for step M and earlier
    - **Validates: Requirements 2.14**

- [x] 17. Checkpoint — Mapping engine and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Update checkinStore for topFeelings
  - [x] 18.1 Update `src/stores/checkinStore.ts` — topFeelings + complete keeps isActive
    - Replace `derivedFeeling: EmotionType | null` with `topFeelings: EmotionType[]` (initially empty array)
    - Update `complete()` action: call `deriveFeeling` from mapping engine, set `topFeelings` to the result's `topFeelings` array, and keep `isActive: true` (do NOT set `isActive: false`)
    - Update `reset()` to clear `topFeelings` back to empty array
    - Update `dismiss()` to clear `topFeelings` back to empty array
    - _Requirements: 2.10, 4.1, 4.2_

  - [x] 18.2 Update `src/stores/__tests__/checkinStore.test.ts` — topFeelings assertions
    - Update all assertions referencing `derivedFeeling` to use `topFeelings`
    - Add test: `complete()` sets `topFeelings` to array of 1+ emotions from mapping engine
    - Add test: `complete()` keeps `isActive: true`
    - Add test: tied feelings scenario produces `topFeelings` with multiple entries
    - Update reset/dismiss tests to assert `topFeelings` is empty array
    - _Requirements: 2.10, 4.1, 4.2_

- [x] 19. Update GuidedCheckinFlow result screen for tied feelings
  - [x] 19.1 Update `src/components/session/GuidedCheckinFlow.tsx` — inline result screen
    - The result screen is the 5th step rendered inside GuidedCheckinFlow (after Q4 completes)
    - **Single winner** (topFeelings.length === 1): Show feeling prominently with emoji + display name, soft label ("It sounds like you might be feeling [X] right now"), normalizing message, "Use this feeling" button, "Try again" link, close X
    - **Tied feelings** (topFeelings.length > 1): Show prompt "This could be a few things — which feels closest?" with all tied feelings rendered as selectable chips/buttons. User must tap one to proceed. Show normalizing message. Show "Try again" link and close X. Omit the soft label.
    - "Use this feeling" or tapping a tied chip calls `onAccept(emotion)`
    - "Try again" calls store `startCheckin()` and restarts from step 1
    - Close X calls `onDismiss()`
    - Retain progress indicator hidden on result screen (steps 1-4 only)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 7.3_

  - [x] 19.2 Delete `src/components/session/GuidedCheckinResult.tsx`
    - Remove the standalone result overlay component (result is now inline in GuidedCheckinFlow)
    - Remove any imports of GuidedCheckinResult from other files

- [x] 20. Update SessionLauncherContent and analytics wiring
  - [x] 20.1 Update `src/components/session/SessionLauncherContent.tsx` — analytics for topFeelings
    - Ensure analytics `guided_checkin_completed` event uses `topFeelings[0]` (or the user-picked tied feeling) as `derived_feeling` and correctly sets `was_changed` by comparing the final emotion against the first topFeeling
    - Remove any remaining references to `derivedFeeling` (use `topFeelings` from checkinStore)
    - _Requirements: 4.5, 6.5, 6.6_

  - [x] 20.2 Update `src/services/__tests__/reachability.test.ts` — new MappingResult shape
    - Update any test assertions that reference the old `MappingResult` shape (single `derivedFeeling`) to use the new `{ topFeelings, scores }` shape
    - _Requirements: 3.1_

- [x] 21. Final checkpoint — All tests green after score-based rewrite
  - Ensure all tests pass, ask the user if questions arise.

---

## Post-Implementation Enhancements (completed outside task list)

- [x] 22. Context pre-fill from Guided Check-in Q4 answer
  - Updated `SessionLauncherContent.handleCheckinAccept` to capture the Q4 (Social Context) answer before resetting the checkin store, then set `selectedContexts` to that single value (replacing, not appending)
  - Ensures repeated check-in attempts don't stack multiple contexts
  - _Requirements: 10.1, 10.2_

- [x] 23. Remove "I'm not sure" from session context chips
  - Removed the `'not_sure'` option from `CONTEXT_OPTIONS` in `src/components/session/ContextChips.tsx`
  - Context step now shows 4 options only (at_work, with_family, with_friends, alone_at_home) matching the Guided_Checkin Social Context values
  - _Requirements: 10.3_

## Notes

- Tasks 1–13 are the original implementation (complete) using priority-based rules
- Tasks 14–21 rewrite the mapping engine to score-based evaluation and update dependent code
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The mapping engine is completely rewritten from priority-based rules to additive score-based evaluation
- The result screen is now inline within GuidedCheckinFlow — no separate GuidedCheckinResult component
- The checkinStore.complete() now keeps isActive: true because the result is shown within the flow
- All 10 design properties are covered by property tests in task group 16

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["8.1", "8.2", "9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3"] },
    { "id": 9, "tasks": ["10.1", "10.3"] },
    { "id": 10, "tasks": ["10.2"] },
    { "id": 11, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 12, "tasks": ["14.1"] },
    { "id": 13, "tasks": ["15.1"] },
    { "id": 14, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "16.8"] },
    { "id": 15, "tasks": ["18.1"] },
    { "id": 16, "tasks": ["18.2", "19.1"] },
    { "id": 17, "tasks": ["19.2", "20.1", "20.2"] }
  ]
}
```
