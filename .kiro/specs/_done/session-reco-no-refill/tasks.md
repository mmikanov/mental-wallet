# Implementation Plan

## Overview

Fix four bugs sequentially — one at a time — using the exploration → preservation → fix → verify cycle for each. Each bug is fully resolved before moving to the next.

## Tasks

- [x] 1. Bug 1: Write bug condition exploration test for No-Refill
  - **Property 1: Bug Condition** - Recommendation Refill After Add-to-Wallet
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the no-refill bug exists
  - **Scoped PBT Approach**: Scope the property to add-to-wallet actions on library cards while recommendations are visible
  - Test that `handleAddToWallet` does NOT call `fetchRecommendations()` after adding a library tool while recommendations are visible
  - Generate arbitrary library card IDs from the recommendation list and assert no re-fetch occurs
  - On unfixed code, `fetchRecommendations` IS called — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples: `fetchRecommendations` is invoked after add-to-wallet, introducing new card IDs
  - Mark task complete when test is written, run, and failure is documented
  - _Bug_Condition: isBugCondition1(input) where input.action = "addToWallet" AND input.source = "library" AND input.recommendationsVisible = true_
  - _Requirements: 1.1, 1.2_

- [x] 2. Bug 1: Write preservation property tests for No-Refill (BEFORE implementing fix)
  - **Property 2: Preservation** - Initial Fetch, Selection-Change Re-fetch, Wallet Persistence
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `handleShowMeTools` calls `fetchRecommendations` (initial fetch works)
  - Observe on UNFIXED code: changing emotion/context/time and re-tapping "Show me tools" triggers a fresh fetch
  - Observe on UNFIXED code: `handleAddToWallet` persists card to wallet DB, copies tags, reloads wallet store
  - Observe on UNFIXED code: tapping an already-added library tool navigates to its wallet version via `addedToWalletMapping`
  - Write property-based tests with fast-check 3:
    - For all non-add-to-wallet actions during a session (emotion select, context toggle, time select, show-me-tools), verify fetchRecommendations is called only on show-me-tools
    - For all library card IDs NOT in the current recommendation list, verify `handleAddToWallet` rejects gracefully
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Bug 1: Implement the No-Refill fix
  - [x] 3.1 Remove fetchRecommendations from handleAddToWallet in SessionLauncherContent.tsx
    - Delete the `fetchRecommendations()` call at the end of the try block (~line 175) in `handleAddToWallet`
    - Remove `fetchRecommendations` from the `useCallback` dependency array of `handleAddToWallet`
    - Keep all other logic intact: card creation, tag persistence, `addedToWalletIds` update, `addedToWalletMapping` update, `recordToolAdded`, wallet store reload
    - The "Added ✓" UI state is already driven by `addedToWalletIds` — no additional UI change needed
    - _Bug_Condition: isBugCondition1(input) where input.action = "addToWallet" AND input.source = "library" AND input.recommendationsVisible = true_
    - _Expected_Behavior: recsAfter.cardIds ⊆ recsBefore.cardIds AND noNewCardsIntroduced_
    - _Preservation: Initial fetch, selection-change re-fetch, wallet persistence, and ID mapping navigation unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 Verify bug condition exploration test now passes
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - When this test passes, it confirms the no-refill bug is resolved
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_
  - [x] 3.3 Verify preservation tests still pass
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 4. Bug 1: Checkpoint — all No-Refill tests green
  - Ensure exploration test (task 1) passes after fix
  - Ensure preservation tests (task 2) still pass after fix
  - Run `npm test -- --testPathPattern="session.*no.?refill|SessionLauncher"` to confirm no regressions in related tests

- [x] 5. Bug 2: Write bug condition exploration test for Scroll Position
  - **Property 1: Bug Condition** - ScrollToEnd Instead of ScrollTo Container Top
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate the scroll bug exists
  - Test that the auto-scroll useEffect calls `scrollTo({ y: measuredY })` instead of `scrollToEnd` when recommendations appear and content overflows
  - On unfixed code, `scrollToEnd` is called — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - _Bug_Condition: isBugCondition2(input) where recommendations != null AND previousRecommendations = null AND contentHeight > viewportHeight_
  - _Requirements: 1.3, 1.4_

- [x] 6. Bug 2: Write preservation property tests for Scroll Position (BEFORE implementing fix)
  - **Property 2: Preservation** - Manual Scrolling and Viewport-Fitting Content
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: manual user scrolling is unrestricted (no snap-back or forced repositioning)
  - Observe on UNFIXED code: content that fits within a single viewport does not trigger any auto-scroll
  - Write property-based tests with fast-check 3:
    - For all scroll events initiated by user gesture (not auto-scroll), verify no forced repositioning occurs
    - For all recommendation-appear events where content fits viewport (contentHeight <= viewportHeight), verify no scroll method is called
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.5, 3.6_

- [x] 7. Bug 2: Implement the Scroll Position fix
  - [x] 7.1 Replace scrollToEnd with scrollTo in SessionLauncherContent.tsx
    - Add `const recoContainerY = useRef<number>(0)` to store measured Y offset
    - Add `onLayout` callback on the recommendations container `<View>`: `onLayout={(e) => { recoContainerY.current = e.nativeEvent.layout.y; }}`
    - Replace `scrollViewRef.current?.scrollToEnd({ animated: true })` with `scrollViewRef.current?.scrollTo({ y: recoContainerY.current, animated: true })`
    - _Bug_Condition: isBugCondition2(input) where recommendations != null AND previousRecommendations = null AND contentHeight > viewportHeight_
    - _Expected_Behavior: scrollPosition = recoContainerY (top of "From your wallet" or "Suggested tools to try" heading)_
    - _Preservation: Manual scrolling unrestricted, viewport-fitting content has no forced scroll_
    - _Requirements: 2.3, 2.4, 3.5, 3.6_
  - [x] 7.2 Verify bug condition exploration test now passes
    - **IMPORTANT**: Re-run the SAME test from task 5 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.3, 2.4_
  - [x] 7.3 Verify preservation tests still pass
    - **IMPORTANT**: Re-run the SAME tests from task 6 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 8. Bug 2: Checkpoint — all Scroll Position tests green
  - Ensure exploration test (task 5) passes after fix
  - Ensure preservation tests (task 6) still pass after fix
  - Run `npm test -- --testPathPattern="SessionLauncher"` to confirm no regressions

- [x] 9. Bug 3: Write bug condition exploration test for Onboarding Race Condition
  - **Property 1: Bug Condition** - focusCard Called from Highlight useEffect
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate the race condition bug exists
  - Test that when `highlightSessionCard=true`, `tutorialComplete=true`, and `tutorial.isActive=false`, the highlight useEffect does NOT call `focusCard(SESSION_LAUNCHER_CARD_ID)`
  - On unfixed code, `focusCard` IS called — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - _Bug_Condition: isBugCondition3(input) where route.params.highlightSessionCard = true AND tutorialComplete = true AND tutorial.isActive = false_
  - _Requirements: 1.5, 1.6_

- [x] 10. Bug 3: Write preservation property tests for Onboarding Race Condition (BEFORE implementing fix)
  - **Property 2: Preservation** - Explicit User Tap Focus and Micro-Tutorial Flow
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: explicit user tap to focus session launcher card calls `focusCard` and renders SessionLauncherContent
  - Observe on UNFIXED code: returning users (no `highlightSessionCard` param) see normal collapsed wallet stack
  - Observe on UNFIXED code: micro-tutorial tooltip flow works without interference
  - Write property-based tests with fast-check 3:
    - For all wallet render events where `highlightSessionCard` param is absent or false, verify `focusCard` is NOT called by the highlight effect
    - For all explicit user tap events on the session launcher card, verify `focusCard` IS called and SessionLauncherContent renders
    - For all states where `tutorial.isActive=true`, verify highlight effect does not fire
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.7, 3.8, 3.9_

- [x] 11. Bug 3: Implement the Highlight Race Condition fix
  - [x] 11.1 Replace focusCard with scroll-to approach in WalletScreen.tsx
    - Remove `focusCard(SESSION_LAUNCHER_CARD_ID)` from the highlight useEffect
    - Add scroll-to logic: use the session launcher card's index in `cards` array to compute approximate scroll position, or measure layout and call `scrollTo` on the wallet ScrollView/FlatList ref
    - Keep `setIsHighlighting(true)` and the 1-second `setTimeout(() => setIsHighlighting(false), 1000)` pattern intact for visual border glow
    - Remove `focusCard` from the useEffect dependency array
    - _Bug_Condition: isBugCondition3(input) where route.params.highlightSessionCard = true AND tutorialComplete = true AND tutorial.isActive = false_
    - _Expected_Behavior: focusedCardId remains null, card is NOT expanded, highlightVisualApplied = true, scrolledToSessionCard = true_
    - _Preservation: Explicit user taps to focus/expand cards unchanged, micro-tutorial flow unaffected, returning users see normal collapsed stack_
    - _Requirements: 2.5, 2.6, 2.7, 3.7, 3.8, 3.9_
  - [x] 11.2 Verify bug condition exploration test now passes
    - **IMPORTANT**: Re-run the SAME test from task 9 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.5, 2.6, 2.7_
  - [x] 11.3 Verify preservation tests still pass
    - **IMPORTANT**: Re-run the SAME tests from task 10 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 12. Bug 3: Checkpoint — all Onboarding Race Condition tests green
  - Ensure exploration test (task 9) passes after fix
  - Ensure preservation tests (task 10) still pass after fix
  - Run `npm test -- --testPathPattern="WalletScreen"` to confirm no regressions

- [x] 13. Bug 4: Write bug condition exploration test for Redundant Seeding
  - **Property 1: Bug Condition** - lib-daily-mood Present in Routine and Default Seed Arrays
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate the seeding bug exists
  - Test that `INTENT_OPTIONS` for "routine" does NOT include `lib-daily-mood` and `DEFAULT_STARTER_CARD_IDS` does NOT include `lib-daily-mood`
  - Additionally assert: "routine" includes `lib-gratitude-three` and default includes `lib-box-breathing`
  - On unfixed code, both contain `lib-daily-mood` — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - _Bug_Condition: isBugCondition4(input) where intentId = "routine" OR (intentId = null AND usesDefaultFallback = true)_
  - _Requirements: 1.7, 1.8_

- [x] 14. Bug 4: Write preservation property tests for Redundant Seeding (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Intents Unchanged, Library Availability, Card Count
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: "overwhelm", "organize", "explore" intents seed their existing card sets unchanged
  - Observe on UNFIXED code: `lib-daily-mood` is available in the curated library for manual addition
  - Observe on UNFIXED code: each intent seeds exactly 3 cards
  - Write property-based tests with fast-check 3:
    - For all intent IDs in ["overwhelm", "organize", "explore"], verify card sets match current config exactly and each set has length 3
    - Verify `lib-daily-mood` exists in `CURATED_LIBRARY` (it should remain available for manual addition)
    - For all intents that previously seeded 3 cards, verify count remains 3
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.10, 3.11, 3.12_

- [x] 15. Bug 4: Implement the Seeding fix
  - [x] 15.1 Replace lib-daily-mood in onboardingConfig.ts
    - Change "routine" intent `cardIds` from `['lib-daily-mood', 'lib-win-of-day', 'lib-evening-gratitude']` to `['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude']`
    - Change `DEFAULT_STARTER_CARD_IDS` from `['lib-grounding-54321', 'lib-daily-mood', 'lib-self-compassion-pause']` to `['lib-grounding-54321', 'lib-box-breathing', 'lib-self-compassion-pause']`
    - Do NOT remove `lib-daily-mood` from the curated library — it remains available for manual addition
    - _Bug_Condition: isBugCondition4(input) where intentId = "routine" OR (intentId = null AND usesDefaultFallback = true)_
    - _Expected_Behavior: "lib-daily-mood" NOT IN seededCards AND |seededCards| = 3 AND routine includes "lib-gratitude-three" AND default includes "lib-box-breathing"_
    - _Preservation: "overwhelm", "organize", "explore" intents unchanged, lib-daily-mood remains in curated library_
    - _Requirements: 2.8, 2.9, 3.10, 3.11, 3.12_
  - [x] 15.2 Verify bug condition exploration test now passes
    - **IMPORTANT**: Re-run the SAME test from task 13 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.8, 2.9_
  - [x] 15.3 Verify preservation tests still pass
    - **IMPORTANT**: Re-run the SAME tests from task 14 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [x] 16. Bug 4: Checkpoint — all Redundant Seeding tests green
  - Ensure exploration test (task 13) passes after fix
  - Ensure preservation tests (task 14) still pass after fix
  - Run `npm test -- --testPathPattern="onboarding"` to confirm no regressions

- [x] 17. Final checkpoint — run full test suite + typecheck
  - Run full test suite: `npm test`
  - Run type check: `npm run typecheck`
  - Ensure all property-based tests (bug condition + preservation) pass across all 4 bugs
  - Ensure no other existing tests have regressed

- [x] 18. Bug 5: Write bug condition exploration test for Intent Selection Locked
  - **Property 1: Bug Condition** - Intent Selection Locked After Back-Navigation
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the intent-locked bug exists
  - **Scoped PBT Approach**: Scope the property to screen re-focus events after back-navigation from KpiSelection while `isTransitioning = true`
  - Test that when IntentSelectionScreen regains focus (after user navigated back from KpiSelectionScreen), `isTransitioning` resets to `false` and all intent buttons become enabled
  - Use fast-check to generate arbitrary `IntentId` values for the initial selection, then simulate back-navigation re-focus
  - On unfixed code, `isTransitioning` remains `true` — all buttons stay disabled — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples: after selecting any intent and navigating back, `isTransitioning` stays `true` and buttons remain disabled
  - Mark task complete when test is written, run, and failure is documented
  - _Bug_Condition: isBugCondition5(input) where input.screenName = "IntentSelection" AND input.focusType = "re-focus" AND input.isTransitioning = true AND input.navigatedBackFrom = "KpiSelection"_
  - _Requirements: 1.9, 1.10_

- [x] 19. Bug 5: Write preservation property tests for Intent Selection Locked (BEFORE implementing fix)
  - **Property 2: Preservation** - Forward Transition Button Disabling and Fresh Mount State
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: during an active forward-transition (after intent tap, before navigation completes), all buttons are disabled (`isTransitioning = true`) to prevent double-taps
  - Observe on UNFIXED code: fresh mount of IntentSelectionScreen shows all options enabled with no pre-selected state (`isTransitioning = false`)
  - Observe on UNFIXED code: KpiSelectionScreen functions normally after intent selection regardless of prior back-navigation
  - Write property-based tests with fast-check 3:
    - For all intent selections on a fresh mount (no prior navigation), verify `isTransitioning` becomes `true` immediately after selection (buttons disabled during transition)
    - For all fresh mounts of IntentSelectionScreen, verify `isTransitioning` starts as `false` and all buttons are enabled
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.13, 3.14, 3.16_

- [x] 20. Bug 5: Implement the Intent Selection Locked fix

  - [x] 20.1 Add useFocusEffect to reset isTransitioning in IntentSelectionScreen.tsx
    - Import `useFocusEffect` from `@react-navigation/native` and `useCallback` from React
    - Add `useFocusEffect` hook that resets `isTransitioning` to `false` whenever the screen regains focus:
      ```tsx
      useFocusEffect(
        useCallback(() => {
          setIsTransitioning(false);
        }, [])
      );
      ```
    - This handles back-navigation without affecting forward transitions (since `handleSelect` sets `isTransitioning = true` again immediately on the next tap)
    - _Bug_Condition: isBugCondition5(input) where input.screenName = "IntentSelection" AND input.focusType = "re-focus" AND input.isTransitioning = true_
    - _Expected_Behavior: stateAfterFocus.isTransitioning = false AND stateAfterFocus.allButtonsEnabled = true_
    - _Preservation: Forward-transition button disabling unchanged, fresh mount state unchanged, KpiSelection unaffected_
    - _Requirements: 2.10, 2.11, 3.13, 3.14, 3.16_

  - [x] 20.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Intent Selection Resets on Back-Navigation
    - **IMPORTANT**: Re-run the SAME test from task 18 — do NOT write a new test
    - The test from task 18 encodes the expected behavior
    - When this test passes, it confirms `isTransitioning` resets on re-focus
    - Run bug condition exploration test from step 18
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.10, 2.11_

  - [x] 20.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Forward Transition Button Disabling and Fresh Mount State
    - **IMPORTANT**: Re-run the SAME tests from task 19 — do NOT write new tests
    - Run preservation property tests from step 19
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 21. Bug 5: Checkpoint — all Intent Selection Locked tests green
  - Ensure exploration test (task 18) passes after fix
  - Ensure preservation tests (task 19) still pass after fix
  - Run `npm test -- --testPathPattern="IntentSelection"` to confirm no regressions

- [x] 22. Bug 6: Write bug condition exploration test for Duplicate Seeded Cards
  - **Property 1: Bug Condition** - Duplicate Cards After Re-Selection
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the duplicate-cards bug exists
  - **Scoped PBT Approach**: Scope the property to re-selection scenarios where a previous intent was already seeded
  - Test that after selecting an intent (seeding cards), then selecting a different intent (or the same one again), the wallet contains ONLY cards from the last selection with no duplicates
  - Use fast-check to generate pairs of arbitrary `IntentId` values (first selection, then re-selection) and verify:
    - `noDuplicateCardIds(walletCards)` — no card appears twice
    - `starterCardsInWallet(walletCards) = getStarterCardsForIntent(secondIntentId)` — only last intent's cards present
    - Cards from the first intent are NOT in the wallet after re-selection
  - On unfixed code, both sets of cards exist (6 total) — test FAILS (confirms bug)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples: selecting "routine" then "explore" yields 6 cards instead of 3; selecting "routine" twice yields 6 duplicate cards
  - Mark task complete when test is written, run, and failure is documented
  - _Bug_Condition: isBugCondition6(input) where input.screenName = "IntentSelection" AND input.action = "selectIntent" AND input.previouslySeededCards.length > 0_
  - _Requirements: 1.11, 1.12_

- [x] 23. Bug 6: Write preservation property tests for Duplicate Seeded Cards (BEFORE implementing fix)
  - **Property 2: Preservation** - First-Time Seeding Unchanged and KpiSelection Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: first-time intent selection (no prior seeded cards) seeds exactly 3 cards immediately without any cleanup
  - Observe on UNFIXED code: `seedStarterCards` with any valid `IntentId` creates cards correctly (correct IDs, correct count)
  - Observe on UNFIXED code: KpiSelectionScreen functions normally after intent selection
  - Write property-based tests with fast-check 3:
    - For all first-time intent selections (empty wallet, no prior seeding), verify exactly 3 cards are seeded matching the intent's `cardIds` from config
    - For all valid `IntentId` values, verify `seedStarterCards` creates cards with correct `source_library_id` values
    - Verify that calling `clearStarterCards` on an empty wallet does not throw or cause errors (defensive test for the new method)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.15, 3.16_

- [x] 24. Bug 6: Implement the Duplicate Seeded Cards fix

  - [x] 24.1 Add clearStarterCards method to onboardingService.ts
    - Add `clearStarterCards(): Promise<void>` to the `OnboardingService` interface
    - Implement `clearStarterCards` in `createOnboardingService()`:
      - Collect all possible starter card IDs from ALL `INTENT_OPTIONS` cardIds arrays + `DEFAULT_STARTER_CARD_IDS` into a `Set<string>`
      - Delete from DB all cards WHERE `source_library_id IN (...)` using the collected IDs
    - Implementation:
      ```typescript
      async clearStarterCards(): Promise<void> {
        const db = await getDatabase();
        const allStarterIds = new Set<string>([
          ...DEFAULT_STARTER_CARD_IDS,
          ...INTENT_OPTIONS.flatMap((opt) => opt.cardIds),
        ]);
        const placeholders = [...allStarterIds].map(() => '?').join(',');
        await db.runAsync(
          `DELETE FROM cards WHERE source_library_id IN (${placeholders})`,
          [...allStarterIds]
        );
      }
      ```
    - _Requirements: 2.12, 2.13_

  - [x] 24.2 Call clearStarterCards before seedStarterCards in IntentSelectionScreen.tsx
    - In `handleSelect`, call `onboardingService.clearStarterCards()` BEFORE `onboardingService.seedStarterCards(intentId)`:
      ```tsx
      const onboardingService = createOnboardingService();
      await onboardingService.clearStarterCards();
      await onboardingService.seedStarterCards(intentId);
      ```
    - This ensures any previously seeded cards are removed before the new set is inserted
    - _Bug_Condition: isBugCondition6(input) where input.previouslySeededCards.length > 0_
    - _Expected_Behavior: noDuplicateCardIds(walletAfter) AND starterCardsInWallet = getStarterCardsForIntent(intentId) AND cardsFromPreviousIntent NOT IN walletAfter_
    - _Preservation: First-time seeding unaffected (clearStarterCards on empty wallet is a no-op), KpiSelection unaffected_
    - _Requirements: 2.12, 2.13, 3.15, 3.16_

  - [x] 24.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Duplicate Cards After Re-Selection
    - **IMPORTANT**: Re-run the SAME test from task 22 — do NOT write a new test
    - The test from task 22 encodes the expected behavior
    - When this test passes, it confirms duplicate cards are eliminated on re-selection
    - Run bug condition exploration test from step 22
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.12, 2.13_

  - [x] 24.4 Verify preservation tests still pass
    - **Property 2: Preservation** - First-Time Seeding Unchanged and KpiSelection Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 23 — do NOT write new tests
    - Run preservation property tests from step 23
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 25. Bug 6: Checkpoint — all Duplicate Seeded Cards tests green
  - Ensure exploration test (task 22) passes after fix
  - Ensure preservation tests (task 23) still pass after fix
  - Run `npm test -- --testPathPattern="IntentSelection|onboarding"` to confirm no regressions

- [x] 26. Final checkpoint — run full test suite + typecheck (bugs 5 & 6)
  - Run full test suite: `npm test`
  - Run type check: `npm run typecheck`
  - Ensure all property-based tests (bug condition + preservation) pass across bugs 5 and 6
  - Ensure no other existing tests have regressed (including bugs 1–4 tests)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5"] },
    { "id": 6, "tasks": ["6"] },
    { "id": 7, "tasks": ["7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3"] },
    { "id": 9, "tasks": ["8"] },
    { "id": 10, "tasks": ["9"] },
    { "id": 11, "tasks": ["10"] },
    { "id": 12, "tasks": ["11.1"] },
    { "id": 13, "tasks": ["11.2", "11.3"] },
    { "id": 14, "tasks": ["12"] },
    { "id": 15, "tasks": ["13"] },
    { "id": 16, "tasks": ["14"] },
    { "id": 17, "tasks": ["15.1"] },
    { "id": 18, "tasks": ["15.2", "15.3"] },
    { "id": 19, "tasks": ["16"] },
    { "id": 20, "tasks": ["17"] },
    { "id": 21, "tasks": ["18"] },
    { "id": 22, "tasks": ["19"] },
    { "id": 23, "tasks": ["20.1"] },
    { "id": 24, "tasks": ["20.2", "20.3"] },
    { "id": 25, "tasks": ["21"] },
    { "id": 26, "tasks": ["22"] },
    { "id": 27, "tasks": ["23"] },
    { "id": 28, "tasks": ["24.1", "24.2"] },
    { "id": 29, "tasks": ["24.3", "24.4"] },
    { "id": 30, "tasks": ["25"] },
    { "id": 31, "tasks": ["26"] }
  ]
}
```

## Notes

- **Test Framework**: Jest via jest-expo preset with fast-check 3 for property-based tests
- **Path Alias**: `@/*` maps to `src/*`
- **Files Modified**: `src/components/session/SessionLauncherContent.tsx`, `src/screens/WalletScreen.tsx`, `src/data/onboardingConfig.ts`, `src/screens/onboarding/IntentSelectionScreen.tsx`, `src/screens/onboarding/KpiSelectionScreen.tsx`, `src/services/onboardingService.ts`, `src/types/analytics.ts`, `src/services/analyticsEventLogger.ts`
- **Test Files Created**: Tests should live in `src/components/session/__tests__/`, `src/data/__tests__/`, `src/screens/onboarding/__tests__/`, and `src/services/__tests__/` adjacent to source code
- Each bug's exploration test intentionally FAILS on unfixed code — this is expected and confirms the bug exists
- Each bug's preservation tests must PASS on unfixed code — this confirms they capture real baseline behavior
- After each bug's implementation, both exploration and preservation tests should pass for that bug
- Bugs are fixed sequentially: complete one bug fully before starting the next
