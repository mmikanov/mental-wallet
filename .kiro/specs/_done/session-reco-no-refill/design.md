# Session Reco No-Refill Bugfix Design

## Overview

This design addresses six related bugs in the emotion session flow, onboarding seeding configuration, and onboarding intent selection navigation. The fix strategy is minimal and targeted: remove a refetch call, change a scroll target, decouple card highlighting from card focusing, swap two seeding IDs, reset transition state on screen re-focus, and clean up previously seeded cards before re-seeding. Each change preserves all existing behavior outside the specific bug condition.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each respective bug — an add-to-wallet action during recommendations, a recommendation-appear event, a post-tutorial highlight effect firing, an onboarding seeding event using a path that includes `lib-daily-mood`, a back-navigation to IntentSelectionScreen while `isTransitioning` is true, or a re-selection of an intent after cards were already seeded
- **Property (P)**: The desired correct behavior for each bug condition — frozen recommendations, scroll to container top, non-expanding highlight, updated seed card IDs, reset transition state on re-focus, and cleanup of previously seeded cards before re-seeding
- **Preservation**: All non-affected interactions must remain unchanged — initial fetches, manual scrolling, explicit user card expansion, other intent seed sets, forward-transition button disabling, and first-time seeding without cleanup
- **SessionLauncherContent**: The component in `src/components/session/SessionLauncherContent.tsx` that renders the emotion picker, context/time chips, and recommendation results inside the expanded session launcher card
- **focusCard**: The walletStore action that sets `focusedCardId`, pulling a card out of the stack into "focused" view — this is the problematic call in the highlight effect
- **fetchRecommendations**: The sessionStore action that queries the recommendation service and updates the `recommendations` state — this is the call that causes the refill bug
- **onLayout**: React Native's layout measurement callback that provides `{ x, y, width, height }` relative to the parent container
- **isTransitioning**: A boolean state in `IntentSelectionScreen` that disables all intent option buttons during the seed-and-navigate transition — the problematic state that never resets on back-navigation
- **useFocusEffect**: A React Navigation hook from `@react-navigation/native` that fires a callback every time a screen gains focus (including when returning via back-navigation)
- **clearStarterCards**: A new method to be added to `onboardingService` that removes all previously seeded starter cards from the wallet before re-seeding

## Bug Details

### Bug Condition 1 — No-Refill

The bug manifests when a user adds a library-suggested tool to their wallet during an active emotion session. The `handleAddToWallet` callback calls `fetchRecommendations()` at the end, causing the recommendation list to refresh with new (lower-ranked) suggestions replacing the one just added.

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type AddToWalletAction
  OUTPUT: boolean
  
  RETURN input.action = "addToWallet"
    AND input.source = "library"
    AND input.recommendationsVisible = true
    AND input.triggeredFromSessionLauncherContent = true
END FUNCTION
```

### Bug Condition 2 — Scroll Position

The bug manifests when recommendations appear after tapping "Show me tools". The auto-scroll useEffect calls `scrollViewRef.current?.scrollToEnd({ animated: true })`, which jumps to the absolute bottom of the ScrollView content rather than the top of the recommendations container.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type RecommendationAppearEvent
  OUTPUT: boolean
  
  RETURN input.recommendations != null
    AND input.previousRecommendations = null
    AND input.scrollViewContentHeight > input.scrollViewViewportHeight
END FUNCTION
```

### Bug Condition 3 — Onboarding Race Condition

The bug manifests when the `highlightSessionCard` useEffect in WalletScreen fires after tutorial completion and calls `focusCard(SESSION_LAUNCHER_CARD_ID)`. This pulls the session launcher card into "focused" state, which — combined with other UI logic — can render SessionLauncherContent and make the session appear active.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type WalletScreenRenderEvent
  OUTPUT: boolean
  
  RETURN input.route.params.highlightSessionCard = true
    AND input.tutorialComplete = true
    AND input.tutorial.isActive = false
    AND input.cards contains SESSION_LAUNCHER_CARD_ID
    AND input.highlightHandled.current = false
END FUNCTION
```

### Bug Condition 4 — Redundant Seeding

The bug manifests when onboarding seeds the user's wallet with card sets that include `lib-daily-mood`, which is now redundant with the dedicated Daily Check-in (personal KPI) feature.

**Formal Specification:**
```
FUNCTION isBugCondition4(input)
  INPUT: input of type OnboardingSeedingEvent
  OUTPUT: boolean
  
  RETURN (input.intentId = "routine")
    OR (input.intentId = null AND input.usesDefaultFallback = true)
END FUNCTION
```

### Bug Condition 5 — Intent Selection Locked After Back-Navigation

The bug manifests when a user selects an intent on IntentSelectionScreen, which sets `isTransitioning = true` and navigates to KpiSelectionScreen. Since IntentSelectionScreen is on a native stack, it stays mounted. When the user navigates back, `isTransitioning` remains `true` — all buttons stay disabled and the user cannot select a different intent or continue.

**Formal Specification:**
```
FUNCTION isBugCondition5(input)
  INPUT: input of type ScreenFocusEvent
  OUTPUT: boolean
  
  RETURN input.screenName = "IntentSelection"
    AND input.focusType = "re-focus"
    AND input.isTransitioning = true
    AND input.navigatedBackFrom = "KpiSelection"
END FUNCTION
```

### Bug Condition 6 — Duplicate Seeded Cards After Re-Selection

The bug manifests when a user navigates back to IntentSelectionScreen and selects an intent again (same or different). `handleSelect` calls `onboardingService.seedStarterCards(intentId)` unconditionally — there is no cleanup of previously seeded cards, so re-selecting seeds a second batch, resulting in duplicate cards in the wallet.

**Formal Specification:**
```
FUNCTION isBugCondition6(input)
  INPUT: input of type IntentSelectionAction
  OUTPUT: boolean
  
  RETURN input.screenName = "IntentSelection"
    AND input.action = "selectIntent"
    AND input.previouslySeededCards.length > 0
END FUNCTION
```

### Examples

- **No-Refill**: User sees 3 library suggestions ["Box Breathing", "Grounding 5-4-3-2-1", "Name It Tame It"]. Taps "Add to wallet" on "Box Breathing". Expected: list stays frozen, "Box Breathing" shows "Added ✓". Actual: list refetches, "Box Breathing" disappears, a weaker 4th-ranked suggestion appears.
- **Scroll Position**: User taps "Show me tools" with 2 wallet tools + 3 library tools. Expected: auto-scroll to the "From your wallet" heading. Actual: scrolls to the very bottom showing the last library suggestion.
- **Race Condition**: New user picks "emotion" mode, taps through tutorial quickly. Expected: session launcher card stays collapsed with a brief highlight glow. Actual: card enters focused state and may render the emotion picker.
- **Redundant Seeding**: User selects "routine" intent. Expected: seeds `['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude']`. Actual: seeds `['lib-daily-mood', 'lib-win-of-day', 'lib-evening-gratitude']`.
- **Intent Locked**: User selects "routine" intent → navigates to KpiSelection → taps back. Expected: all 4 intent buttons are enabled and tappable. Actual: all buttons remain disabled (`isTransitioning = true`), user is stuck.
- **Duplicate Cards**: User selects "routine" intent (seeds 3 cards) → navigates to KpiSelection → taps back → selects "explore" intent. Expected: wallet contains only 3 cards from "explore". Actual: wallet contains 6 cards — 3 from "routine" + 3 from "explore".
- **Same Intent Re-Selection**: User selects "routine" → back → selects "routine" again. Expected: wallet still contains exactly 3 "routine" cards. Actual: wallet contains 6 duplicate cards.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The initial "Show me tools" fetch continues to query the recommendation service with current emotion/context/time selections
- Re-fetches still occur when the user changes emotion, context, or time selections and taps "Show me tools" again
- Adding a library tool still persists it to the wallet database, copies tags, and reloads the wallet store
- Tapping a library tool that was already added still navigates to its wallet version using the ID mapping
- Manual user scrolling within the session launcher remains unrestricted
- Content that fits in a single viewport does not trigger any auto-scroll
- Returning users (no `highlightSessionCard` param) see the normal collapsed wallet stack
- Explicit user taps to focus and expand the session launcher card continue to render SessionLauncherContent
- The micro-tutorial tooltip flow works without interference from the highlight effect
- The "overwhelm", "organize", and "explore" intents seed their existing card sets unchanged
- `lib-daily-mood` remains available in the curated library for manual addition
- Each intent continues to seed exactly 3 cards
- During an active forward-transition (after tap, before navigation completes), buttons remain disabled to prevent double-taps
- First-time intent selection (no prior seeded cards) continues to seed immediately without any cleanup step
- KpiSelectionScreen continues to function normally regardless of prior back-navigation
- Fresh mount of IntentSelectionScreen shows all options enabled with no pre-selected state

**Scope:**
All inputs that do NOT match any of the six bug conditions should be completely unaffected by these fixes. This includes mouse/tap interactions with recommendation cards, all non-add-to-wallet actions during a session, non-recommendation scroll interactions, all onboarding intents other than "routine" and default fallback for seeding config, forward transitions on IntentSelectionScreen, and first-time intent selections with no prior seeding.

## Hypothesized Root Cause

Based on code analysis, the root causes are confirmed:

1. **No-Refill — Explicit `fetchRecommendations()` call**: In `SessionLauncherContent.tsx` line ~175, `handleAddToWallet` calls `fetchRecommendations()` after successfully adding a card. This was originally intended to move the tool from "Suggested" to "From your wallet", but the side effect is that the recommendation service re-ranks all remaining library tools and may introduce new ones.

2. **Scroll Position — `scrollToEnd` usage**: In `SessionLauncherContent.tsx` line ~62, the auto-scroll useEffect calls `scrollViewRef.current?.scrollToEnd({ animated: true })`. This scrolls to the absolute bottom of the ScrollView content. The correct behavior is to scroll to the Y offset of the recommendations container (the "From your wallet" or "Suggested tools to try" heading).

3. **Onboarding Race — `focusCard` in highlight effect**: In `WalletScreen.tsx` line ~188, the highlight useEffect calls `focusCard(SESSION_LAUNCHER_CARD_ID)` to "scroll to" the card. But `focusCard` in the walletStore sets `focusedCardId`, which pulls the card into focused view. The FocusedCardView component checks if the focused card is the session launcher and, if expanded, renders SessionLauncherContent. The race condition occurs because the tutorial completes before the highlight fires, and `focusCard` puts the card in a state where a subsequent auto-expand or user misinterpretation triggers session rendering.

4. **Redundant Seeding — Stale config data**: In `onboardingConfig.ts`, the "routine" intent still lists `lib-daily-mood` from before the dedicated Daily Check-in feature was implemented. Similarly, `DEFAULT_STARTER_CARD_IDS` includes `lib-daily-mood`.

5. **Intent Locked — Missing state reset on re-focus**: In `IntentSelectionScreen.tsx`, `handleSelect` sets `isTransitioning = true` and never resets it. Since IntentSelectionScreen stays mounted on the native stack when KpiSelectionScreen is pushed, navigating back leaves `isTransitioning` permanently `true`. There is no `useFocusEffect` or navigation listener to detect when the screen regains focus and reset the transition state.

6. **Duplicate Cards — Unconditional seeding without cleanup**: In `IntentSelectionScreen.tsx`, `handleSelect` calls `onboardingService.seedStarterCards(intentId)` unconditionally. There is no mechanism to remove previously seeded starter cards before inserting new ones, so each selection appends cards without deduplication.

## Correctness Properties

Property 1: Bug Condition - Recommendations Remain Frozen After Add-to-Wallet

_For any_ add-to-wallet action performed on a library tool while recommendations are displayed, the fixed `handleAddToWallet` function SHALL NOT call `fetchRecommendations()`, and the displayed recommendation list SHALL contain only a subset of the original recommendations (with added tools showing "Added ✓" status) and SHALL NOT introduce any new card IDs.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Scroll Position Targets Recommendations Container Top

_For any_ recommendation-appear event where content overflows the viewport, the fixed auto-scroll logic SHALL scroll to the measured Y offset of the recommendations container (the "From your wallet" section if wallet tools exist, otherwise the "Suggested tools to try" section), NOT to the end of the ScrollView.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - Highlight Does Not Focus/Expand Session Card

_For any_ post-tutorial highlight event where `highlightSessionCard` param is true and the tutorial is complete, the fixed highlight useEffect SHALL scroll to the session launcher card's position and apply a visual highlight border WITHOUT calling `focusCard()`, and SHALL NOT set `focusedCardId` or render SessionLauncherContent.

**Validates: Requirements 2.5, 2.6, 2.7**

Property 4: Bug Condition - Correct Replacement Cards in Seeding

_For any_ onboarding seeding event where `intentId = "routine"` or default fallback is used, the fixed configuration SHALL NOT include `lib-daily-mood` in the seeded card IDs, SHALL include `lib-gratitude-three` for "routine" intent, SHALL include `lib-box-breathing` for default fallback, and SHALL seed exactly 3 cards.

**Validates: Requirements 2.8, 2.9**

Property 5: Preservation - Non-Bug Interactions Unchanged

_For any_ input where none of the six bug conditions hold (non-add-to-wallet actions, non-recommendation-appear events, non-highlight-effect renders, non-routine/default seeding, forward transitions on IntentSelectionScreen, first-time seedings without prior cards), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for initial fetches, manual scrolling, explicit card focusing, other onboarding intents, forward-transition button disabling, and first-time seeding.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16**

Property 6: Bug Condition - Intent Selection Resets on Back-Navigation

_For any_ screen focus event where IntentSelectionScreen regains focus after the user navigated back from KpiSelectionScreen while `isTransitioning` was true, the fixed component SHALL reset `isTransitioning` to `false` so that all intent option buttons become enabled and tappable, allowing the user to select a different intent or re-select the same one.

**Validates: Requirements 2.10, 2.11**

Property 7: Bug Condition - No Duplicate Cards After Re-Selection

_For any_ intent selection action where the user has previously seeded starter cards (via a prior selection), the fixed `handleSelect` function SHALL clear all previously seeded starter cards from the wallet before seeding cards for the newly selected intent, ensuring the wallet contains only cards from the last selection with no duplicates.

**Validates: Requirements 2.12, 2.13**

## Fix Implementation

### Changes Required

**File**: `src/components/session/SessionLauncherContent.tsx`

**Function**: `handleAddToWallet`

**Specific Changes**:
1. **Remove `fetchRecommendations()` call**: Delete the `fetchRecommendations()` call at the end of the try block (line ~175). After adding a tool, only update local state (`addedToWalletIds`, `addedToWalletMapping`) and reload the wallet store. The recommendations stay frozen as originally fetched.

2. **Remove `fetchRecommendations` from dependency array**: Remove `fetchRecommendations` from the `useCallback` dependency array of `handleAddToWallet`.

**Function**: Auto-scroll `useEffect`

**Specific Changes**:
3. **Add `onLayout` measurement for recommendations container**: Add a `useRef` to store the measured Y offset of the recommendations container `<View>`. Attach an `onLayout` callback to the recommendations container that stores the `nativeEvent.layout.y` value.

4. **Replace `scrollToEnd` with `scrollTo`**: Change the auto-scroll useEffect from:
   ```typescript
   scrollViewRef.current?.scrollToEnd({ animated: true });
   ```
   to:
   ```typescript
   scrollViewRef.current?.scrollTo({ y: recoContainerY.current, animated: true });
   ```
   where `recoContainerY` is the measured Y offset from `onLayout`.

---

**File**: `src/screens/WalletScreen.tsx`

**Function**: `highlightSessionCard` useEffect

**Specific Changes**:
5. **Remove `focusCard(SESSION_LAUNCHER_CARD_ID)` call**: Replace the call to `focusCard` with a non-expanding scroll approach. Use `scrollTo` on the wallet's ScrollView/FlatList ref to scroll to the session launcher card's position without changing `focusedCardId`.

6. **Scroll to card position without focusing**: Use the card's index in the `cards` array to compute its approximate scroll position, or measure the card's layout position and scroll to it. The card stays in the stacked list — it is not pulled into focused view.

7. **Keep visual highlight only**: The `setIsHighlighting(true)` / `setTimeout` pattern stays intact — it applies a brief visual border glow. Remove `focusCard` from the useEffect's dependency array.

---

**File**: `src/data/onboardingConfig.ts`

**Specific Changes**:
8. **Replace `lib-daily-mood` in "routine" intent**: Change `cardIds` for the "routine" intent from `['lib-daily-mood', 'lib-win-of-day', 'lib-evening-gratitude']` to `['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude']`.

9. **Replace `lib-daily-mood` in DEFAULT_STARTER_CARD_IDS**: Change from `['lib-grounding-54321', 'lib-daily-mood', 'lib-self-compassion-pause']` to `['lib-grounding-54321', 'lib-box-breathing', 'lib-self-compassion-pause']`.

---

**File**: `src/screens/onboarding/IntentSelectionScreen.tsx`

**Function**: Component body (Bug 5 fix)

**Specific Changes**:
10. **Add `useFocusEffect` import**: Import `useFocusEffect` from `@react-navigation/native` and `useCallback` from React.

11. **Add `useFocusEffect` to reset `isTransitioning` and log analytics**: Inside the component, add a `useFocusEffect` hook that resets `isTransitioning` to `false` and logs the `onboarding_step_viewed` event whenever the screen regains focus. This replaces the previous `useEffect([], ...)` which only fired on mount (and therefore missed back-navigation re-visits):
    ```typescript
    useFocusEffect(
      useCallback(() => {
        setIsTransitioning(false);
        try {
          void logEvent('onboarding_step_viewed', { step_name: 'intent_selection' });
        } catch {
          // Analytics must never disrupt onboarding
        }
      }, [])
    );
    ```

12. **Add `onboarding_intent_selected` event**: In `handleSelect`, log `onboarding_intent_selected` with `{ intent_id: intentId }` immediately after setting `isTransitioning = true`. This captures which intent the user selected (useful for understanding back-navigation and re-selection patterns).

13. **Register new event types**: Add `onboarding_intent_selected` and `onboarding_kpi_selected` to the `AnalyticsEventType` union in `src/types/analytics.ts` and the `VALID_EVENT_TYPES` array in `src/services/analyticsEventLogger.ts`.

---

**File**: `src/services/onboardingService.ts`

**Function**: New method `clearStarterCards` (Bug 6 fix)

**Specific Changes**:
12. **Add `clearStarterCards()` method to the service interface and implementation**: This method collects all possible starter card IDs from all `INTENT_OPTIONS` card arrays plus `DEFAULT_STARTER_CARD_IDS`, then deletes from the wallet database all cards WHERE `source_library_id IN (...)`. This removes any previously seeded onboarding cards regardless of which intent originally seeded them.

13. **Implementation of `clearStarterCards`**:
    ```typescript
    async clearStarterCards(): Promise<void> {
      const db = await getDatabase();
      
      // Collect all possible starter card IDs across all intents + defaults
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

---

**File**: `src/screens/onboarding/IntentSelectionScreen.tsx`

**Function**: `handleSelect` (Bug 6 fix)

**Specific Changes**:
14. **Call `clearStarterCards()` before `seedStarterCards()`**: In `handleSelect`, call `onboardingService.clearStarterCards()` before calling `onboardingService.seedStarterCards(intentId)`. This ensures any previously seeded cards are removed before the new set is inserted:
    ```typescript
    const onboardingService = createOnboardingService();
    await onboardingService.clearStarterCards();
    await onboardingService.seedStarterCards(intentId);
    ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that exercise each bug condition on the UNFIXED code to observe the defective behavior.

**Test Cases**:
1. **No-Refill Test**: Call `handleAddToWallet` with a valid library card ID while recommendations are displayed. Assert that `fetchRecommendations` is called — this will PASS on unfixed code (confirming the bug exists).
2. **Scroll Position Test**: Trigger the auto-scroll useEffect by setting `recommendations` to a non-null value. Assert that `scrollToEnd` is called — this will PASS on unfixed code (confirming the bug exists).
3. **Highlight Focus Test**: Simulate the highlight useEffect firing with `highlightSessionCard=true`, `tutorialComplete=true`, `tutorial.isActive=false`. Assert that `focusCard` is called — this will PASS on unfixed code (confirming the bug exists).
4. **Seeding Config Test**: Assert that `INTENT_OPTIONS` for "routine" includes `lib-daily-mood` and `DEFAULT_STARTER_CARD_IDS` includes `lib-daily-mood` — this will PASS on unfixed code (confirming the bug exists).
5. **Intent Locked Test**: Simulate `handleSelect` to set `isTransitioning = true`, then simulate screen re-focus (as if user navigated back). Assert that `isTransitioning` remains `true` and buttons are disabled — this will PASS on unfixed code (confirming the bug exists).
6. **Duplicate Cards Test**: Call `seedStarterCards('routine')` once, then call `seedStarterCards('explore')` without clearing. Query wallet cards and assert that cards from both intents exist (6 total) — this will PASS on unfixed code (confirming the bug exists).

**Expected Counterexamples**:
- `fetchRecommendations` is invoked after add-to-wallet, introducing new card IDs
- `scrollToEnd` is called instead of `scrollTo` with a measured offset
- `focusCard(SESSION_LAUNCHER_CARD_ID)` is called from the highlight effect
- `lib-daily-mood` appears in "routine" and default seed arrays
- `isTransitioning` stays `true` after back-navigation, locking all buttons
- Duplicate cards accumulate in the wallet after re-selection without cleanup

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
// Bug 1 — No-Refill
FOR ALL input WHERE isBugCondition1(input) DO
  recsBefore := getDisplayedRecommendations()
  handleAddToWallet_fixed(input.cardId)
  recsAfter := getDisplayedRecommendations()
  ASSERT recsAfter.cardIds ⊆ recsBefore.cardIds
    AND noNewCardsIntroduced(recsBefore, recsAfter)
    AND addedToWalletIds.has(input.cardId)
END FOR

// Bug 2 — Scroll Position
FOR ALL input WHERE isBugCondition2(input) DO
  scrollPosition := getScrollPositionAfterAutoScroll(input)
  recoContainerY := getMeasuredRecommendationsContainerY(input)
  ASSERT scrollPosition = recoContainerY
END FOR

// Bug 3 — Highlight
FOR ALL input WHERE isBugCondition3(input) DO
  stateAfter := applyHighlightEffect_fixed(input)
  ASSERT stateAfter.focusedCardId = null
    AND stateAfter.isExpanded = false
    AND stateAfter.highlightVisualApplied = true
END FOR

// Bug 4 — Seeding
FOR ALL input WHERE isBugCondition4(input) DO
  seededCards := getSeedCardIds_fixed(input)
  ASSERT "lib-daily-mood" NOT IN seededCards
    AND |seededCards| = 3
    AND (input.intentId = "routine" IMPLIES "lib-gratitude-three" IN seededCards)
    AND (input.usesDefaultFallback IMPLIES "lib-box-breathing" IN seededCards)
END FOR

// Bug 5 — Intent Locked
FOR ALL input WHERE isBugCondition5(input) DO
  stateAfterFocus := applyFocusEffect_fixed(input)
  ASSERT stateAfterFocus.isTransitioning = false
    AND stateAfterFocus.allButtonsEnabled = true
    AND stateAfterFocus.userCanSelectIntent = true
END FOR

// Bug 6 — Duplicate Cards
FOR ALL input WHERE isBugCondition6(input) DO
  walletAfter := performIntentSelection_fixed(input)
  expectedCards := getStarterCardsForIntent(input.intentId)
  ASSERT noDuplicateCardIds(walletAfter)
    AND starterCardsInWallet(walletAfter) = expectedCards
    AND cardsFromPreviousIntent(input.previouslySeededIntentId) NOT IN walletAfter
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition1(input) 
                AND NOT isBugCondition2(input)
                AND NOT isBugCondition3(input)
                AND NOT isBugCondition4(input)
                AND NOT isBugCondition5(input)
                AND NOT isBugCondition6(input) DO
  ASSERT F(input) = F'(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bug interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Initial Fetch Preservation**: Verify that tapping "Show me tools" (first time, no prior recommendations) still calls `fetchRecommendations` and renders results
2. **Selection Change Preservation**: Verify that changing emotion/context/time and re-tapping "Show me tools" still triggers a fresh fetch
3. **Wallet Persistence Preservation**: Verify that `handleAddToWallet` still persists the card to wallet DB, copies tags, and reloads wallet store
4. **Manual Scroll Preservation**: Verify that user-initiated scrolling is unrestricted (no snap-back or forced repositioning)
5. **Explicit Focus Preservation**: Verify that tapping the session launcher card still calls `focusCard` and subsequent expand renders SessionLauncherContent
6. **Other Intents Preservation**: Verify that "overwhelm", "organize", "explore" intents seed the same card arrays as before
7. **Forward Transition Preservation**: Verify that during an active forward-transition (after intent tap, before navigation completes), all buttons remain disabled to prevent double-taps
8. **First-Time Seeding Preservation**: Verify that first-time intent selection (no prior seeded cards) seeds immediately without calling `clearStarterCards` cleanup logic affecting anything
9. **KpiSelection Preservation**: Verify that KpiSelectionScreen continues to function normally regardless of whether the user previously navigated back from it

### Unit Tests

- Test that `handleAddToWallet` does NOT call `fetchRecommendations` after the fix
- Test that `handleAddToWallet` still updates `addedToWalletIds` and `addedToWalletMapping`
- Test that auto-scroll calls `scrollTo` with the measured Y offset (not `scrollToEnd`)
- Test that the highlight useEffect does NOT call `focusCard`
- Test that the highlight useEffect applies `setIsHighlighting(true)` and clears after 1s
- Test that `INTENT_OPTIONS[1].cardIds` equals `['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude']`
- Test that `DEFAULT_STARTER_CARD_IDS` equals `['lib-grounding-54321', 'lib-box-breathing', 'lib-self-compassion-pause']`
- Test that `useFocusEffect` callback resets `isTransitioning` to `false` when screen regains focus
- Test that after `useFocusEffect` fires, all intent buttons have `disabled={false}`
- Test that `clearStarterCards` removes all cards with `source_library_id` matching any starter card ID
- Test that `clearStarterCards` followed by `seedStarterCards` results in exactly 3 cards (no duplicates)
- Test that `clearStarterCards` on an empty wallet (first-time) does not throw or cause issues

### Property-Based Tests

- Generate random sequences of add-to-wallet actions during an active session and verify the recommendation list never grows or introduces new card IDs (fast-check arbitraries over subsets of library card IDs)
- Generate random onboarding intent selections (including null/default) and verify that `lib-daily-mood` never appears in the seeded set, while card count is always 3
- Generate random `highlightSessionCard` param combinations with varying `tutorialComplete` and `tutorial.isActive` states, and verify `focusedCardId` is never set by the highlight effect alone
- Generate random sequences of intent selections (1–5 selections with back-navigations interleaved) and verify the wallet never contains duplicate `source_library_id` values and always contains exactly 3 starter cards matching the last selection
- Generate random `isTransitioning` states combined with focus events and verify that `isTransitioning` is always `false` after a re-focus event, regardless of what it was before

### Integration Tests

- Full session flow: select emotion → tap "Show me tools" → add a library tool → verify list stays frozen with "Added ✓"
- Scroll verification: trigger recommendations with enough content to overflow → verify scroll position lands at recommendations container top
- Onboarding flow: complete onboarding with "emotion" mode → tap through tutorial → verify session launcher card stays collapsed with highlight glow
- Seeding verification: complete onboarding with "routine" intent → verify wallet contains `lib-gratitude-three` instead of `lib-daily-mood`
- Intent back-navigation flow: select intent → navigate to KpiSelection → tap back → verify all intent buttons are enabled and tappable
- Re-selection deduplication flow: select "routine" intent → navigate to KpiSelection → tap back → select "explore" intent → verify wallet contains only 3 "explore" cards with no "routine" cards remaining
