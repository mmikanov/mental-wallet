# Bugfix Requirements Document

## Introduction

This document covers six bugs — three in the emotion session flow, one in onboarding seeding configuration, and two in the onboarding intent selection back-navigation flow:

1. **No-Refill Bug**: When a user adds a library-suggested tool to their wallet during an emotion session, the recommendation list is re-fetched, causing a new suggestion to appear in the "Suggested tools to try" section. This is confusing and overwhelming — the initial recommendations are already the strongest matches (sorted by context relevance score), so backfilling a new tool after one is added undermines that curation. The fix ensures recommendations remain frozen after the initial fetch, and an added tool simply shows "Added ✓" in place rather than triggering a refill.

2. **Scroll Position Bug**: When recommendations appear after tapping "Show me tools", the page auto-scrolls to the bottom of the results instead of the top of the "From your wallet" section. If there are wallet tools and library suggestions, the user sees the "Suggested tools to try" section first and cannot see their existing wallet tools without scrolling back up. The fix ensures auto-scroll lands at the top of the recommendations container (the "From your wallet" section), not the bottom of the page.

3. **Onboarding Race Condition Bug**: When a new user completes onboarding and selects "emotion" mode on ModeChoiceScreen, the session launcher card sometimes auto-opens or shows the emotion session as active due to a race condition between the micro-tutorial auto-start useEffect and the highlightSessionCard useEffect in WalletScreen. If the tutorial completes quickly (user taps through or skips), the highlight effect re-evaluates with `tutorialComplete: true` and calls `focusCard(SESSION_LAUNCHER_CARD_ID)`, which can expand the card and render SessionLauncherContent — making it appear as if the session is active. The fix ensures that the highlight effect cannot expand the session card or trigger active-session rendering, and that during the onboarding/tutorial flow no code path can accidentally start or display an active session.

4. **Redundant Daily Mood Check-In Seeding Bug**: The `lib-daily-mood` card ("Daily Mood Check-In") is still included in two onboarding seeding paths — the "routine" intent and the default fallback — but it is now redundant because the app has a dedicated Daily Check-in feature (the personal KPI card opened from the FAB). Seeding a separate mood-only card alongside the KPI-based daily check-in confuses users. The fix replaces `lib-daily-mood` with `lib-gratitude-three` ("Three Good Things") in the "routine" intent and with `lib-box-breathing` ("Box Breathing") in the default fallback.

5. **Intent Selection Locked After Back-Navigation Bug**: On the IntentSelectionScreen ("What brings you here?"), when a user selects an intent, the component sets `isTransitioning = true` and all buttons become disabled. It then seeds cards and navigates to KpiSelectionScreen. Since it's a native stack, IntentSelectionScreen stays mounted. When the user navigates back from KpiSelection, IntentSelectionScreen is still in `isTransitioning = true` state — all buttons remain disabled and the user cannot change their selection or continue. The fix uses `useFocusEffect` or a navigation listener to reset `isTransitioning` to `false` when the screen regains focus.

6. **Duplicate Seeded Cards After Re-Selection Bug**: When a user selects an intent on IntentSelectionScreen, cards are seeded immediately via `onboardingService.seedStarterCards(intentId)`. If the user goes back from KpiSelection and selects a different intent (or the same one again), the seeding runs again — resulting in duplicate cards in the wallet. The fix ensures that when re-seeding occurs, previously seeded starter cards are cleaned up before inserting new ones, so the wallet only contains cards from the last selection.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user adds a library tool to their wallet via the "Add to wallet" action THEN the system re-fetches recommendations, causing a new (lower-ranked) suggestion to appear in the "Suggested tools to try" section

1.2 WHEN a user adds multiple library tools to their wallet in the same session THEN the system re-fetches recommendations each time, progressively showing weaker matches that were not part of the original top-3 results

1.3 WHEN recommendations appear after tapping "Show me tools" and both wallet tools and library suggestions are present THEN the system auto-scrolls to the bottom of the page, showing the "Suggested tools to try" section instead of the "From your wallet" section

1.4 WHEN recommendations appear after tapping "Show me tools" and only library suggestions are present (no wallet tools) THEN the system auto-scrolls past the recommendations container top, landing at the bottom of the list

1.5 WHEN a new user completes onboarding, selects "emotion" mode, and the micro-tutorial completes quickly (user taps through or skips) THEN the highlightSessionCard useEffect re-evaluates with `tutorialComplete: true`, calls `focusCard(SESSION_LAUNCHER_CARD_ID)`, and the session launcher card expands showing SessionLauncherContent — making the emotion session appear active without explicit user action

1.6 WHEN a new user completes onboarding with "emotion" mode and the highlight effect fires while card expansion logic is active THEN the system may render the emotion picker UI inside the expanded session launcher card, giving the false impression that a session is in progress

1.7 WHEN a new user selects the "routine" intent during onboarding THEN the system seeds `['lib-daily-mood', 'lib-win-of-day', 'lib-evening-gratitude']`, including the redundant `lib-daily-mood` card that overlaps with the dedicated Daily Check-in (personal KPI) feature

1.8 WHEN a new user completes onboarding without selecting any intent (default fallback path) THEN the system seeds `['lib-grounding-54321', 'lib-daily-mood', 'lib-self-compassion-pause']`, including the redundant `lib-daily-mood` card that overlaps with the dedicated Daily Check-in (personal KPI) feature

1.9 WHEN a user selects an intent on IntentSelectionScreen and the component sets `isTransitioning = true`, then navigates to KpiSelectionScreen, and the user navigates back THEN the system keeps `isTransitioning = true` because IntentSelectionScreen remains mounted on the native stack with no mechanism to reset state on re-focus — all intent buttons remain disabled and the user cannot select a different option or continue

1.10 WHEN a user navigates back to IntentSelectionScreen after the component has already set `isTransitioning = true` THEN the system does not use `useFocusEffect` or any navigation listener to detect re-focus — the disabled state persists indefinitely until the app is restarted

1.11 WHEN a user selects an intent on IntentSelectionScreen and cards are seeded via `onboardingService.seedStarterCards(intentId)`, then navigates back from KpiSelection and selects a different intent THEN the system seeds cards for the new intent WITHOUT removing previously seeded cards, resulting in duplicate cards from both selections in the wallet

1.12 WHEN a user navigates back and re-selects the same intent on IntentSelectionScreen THEN the system calls `seedStarterCards(intentId)` again unconditionally, inserting the same cards a second time and creating duplicates in the wallet

### Expected Behavior (Correct)

2.1 WHEN a user adds a library tool to their wallet via the "Add to wallet" action THEN the system SHALL keep the recommendation list frozen (no re-fetch) and display "Added ✓" on the added tool's card in its current position within the "Suggested tools to try" section

2.2 WHEN a user adds multiple library tools to their wallet in the same session THEN the system SHALL continue to display the original recommendation set without introducing any new suggestions, showing "Added ✓" on each added tool

2.3 WHEN recommendations appear after tapping "Show me tools" and wallet tools are present THEN the system SHALL auto-scroll to the top of the "From your wallet" section so the user sees their existing wallet tools first

2.4 WHEN recommendations appear after tapping "Show me tools" and no wallet tools are present (only library suggestions) THEN the system SHALL auto-scroll to the top of the recommendations container (the "Suggested tools to try" heading)

2.5 WHEN a new user completes onboarding with "emotion" mode and `tutorialComplete` is false THEN the system SHALL NOT open, expand, or focus the session launcher card in any way that renders SessionLauncherContent or shows the session as active

2.6 WHEN the micro-tutorial completes and the highlightSessionCard param is set THEN the system SHALL scroll to the session launcher card and apply a brief visual highlight (border glow) WITHOUT expanding the card or triggering SessionLauncherContent rendering

2.7 WHEN the highlightSessionCard effect fires after tutorial completion THEN the system SHALL only apply a visual highlight animation — the session SHALL only become active when the user explicitly taps and expands the session launcher card and selects an emotion

2.8 WHEN a new user selects the "routine" intent during onboarding THEN the system SHALL seed `['lib-gratitude-three', 'lib-win-of-day', 'lib-evening-gratitude']`, replacing the redundant `lib-daily-mood` with `lib-gratitude-three` ("Three Good Things")

2.9 WHEN a new user completes onboarding without selecting any intent (default fallback path) THEN the system SHALL seed `['lib-grounding-54321', 'lib-box-breathing', 'lib-self-compassion-pause']`, replacing the redundant `lib-daily-mood` with `lib-box-breathing` ("Box Breathing")

2.10 WHEN a user navigates back to IntentSelectionScreen from KpiSelectionScreen THEN the system SHALL reset `isTransitioning` to `false` so that all intent option buttons become tappable again

2.11 WHEN a user navigates back to IntentSelectionScreen after previously selecting an intent THEN the system SHALL allow the user to select a different intent option (or the same one) and proceed through the flow normally, exactly as if it were the first selection

2.12 WHEN a user re-selects an intent on IntentSelectionScreen after navigating back THEN the system SHALL remove any previously seeded starter cards before seeding cards for the newly selected intent, ensuring the wallet contains only cards from the last selection

2.13 WHEN a user re-selects the same intent on IntentSelectionScreen after navigating back THEN the system SHALL detect that the same cards already exist and either skip re-seeding or clean up and re-seed, resulting in no duplicate cards in the wallet

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user taps "Show me tools" for the first time in a session THEN the system SHALL CONTINUE TO fetch and display up to 3 wallet tools and up to 3 library tools sorted by context relevance score

3.2 WHEN a user changes their emotion, context, or time selections and taps "Show me tools" again THEN the system SHALL CONTINUE TO re-fetch recommendations reflecting the updated selections

3.3 WHEN a user adds a library tool to their wallet THEN the system SHALL CONTINUE TO persist the card to the wallet database, copy emotion/context/time tags, and reload the wallet store

3.4 WHEN a user taps a library tool that was already added to the wallet THEN the system SHALL CONTINUE TO navigate to the wallet version of that card using the ID mapping

3.5 WHEN recommendations appear and the results fit within a single viewport (no scrolling needed) THEN the system SHALL CONTINUE TO display all results without any forced scroll

3.6 WHEN the user manually scrolls the recommendations list THEN the system SHALL CONTINUE TO allow free scrolling without snapping or forced repositioning

3.7 WHEN a returning user (tutorial already completed, no highlightSessionCard param) opens the wallet THEN the system SHALL CONTINUE TO display the session launcher card in its default collapsed state without any automatic highlighting or focusing

3.8 WHEN the user explicitly taps the session launcher card to expand it and selects an emotion THEN the system SHALL CONTINUE TO start the emotion session normally with full SessionLauncherContent rendering

3.9 WHEN the micro-tutorial is active (tooltip sequence in progress) THEN the system SHALL CONTINUE TO show tooltip overlays on the frontmost card and action button without interference from the highlight effect

3.10 WHEN a new user selects the "overwhelm" or "organize" or "explore" intent during onboarding THEN the system SHALL CONTINUE TO seed the same card sets as before (no changes to those intents)

3.11 WHEN a user browses the curated library THEN the system SHALL CONTINUE TO display `lib-daily-mood` ("Daily Mood Check-In") as an available card that can be manually added to the wallet

3.12 WHEN any intent is selected during onboarding THEN the system SHALL CONTINUE TO seed exactly 3 cards for intents that previously seeded 3 cards (the count does not change)

3.13 WHEN IntentSelectionScreen is first navigated to (fresh mount, not a back-navigation) THEN the system SHALL CONTINUE TO display all intent options as enabled with no pre-selected state

3.14 WHEN a user selects an intent and the component is actively transitioning (seeding + navigating) THEN the system SHALL CONTINUE TO disable all buttons during the transition to prevent double-taps

3.15 WHEN a user selects an intent for the first time (no prior selection has been seeded) THEN the system SHALL CONTINUE TO seed cards immediately upon selection without requiring cleanup of previous cards

3.16 WHEN KpiSelectionScreen is reached after intent selection THEN the system SHALL CONTINUE TO function normally regardless of whether the user previously navigated back from it

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AddToWalletAction
  OUTPUT: boolean
  
  // Returns true when a library tool is added to wallet while recommendations are displayed
  RETURN X.action = "addToWallet" 
    AND X.source = "library" 
    AND X.recommendationsVisible = true
END FUNCTION
```

## Property Specification

```pascal
// Property: Fix Checking — No Refill After Add
FOR ALL X WHERE isBugCondition(X) DO
  recsBefore ← getDisplayedLibraryRecommendations()
  performAddToWallet(X.cardId)
  recsAfter ← getDisplayedLibraryRecommendations()
  
  ASSERT recsAfter.cardIds ⊆ recsBefore.cardIds
    AND |recsAfter| <= |recsBefore|
    AND noNewCardsIntroduced(recsBefore, recsAfter)
END FOR
```

## Preservation Goal

```pascal
// Property: Preservation Checking — Normal recommendation fetches unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that the initial "Show me tools" fetch, selection-change re-fetches, and all other non-add-to-wallet flows continue to behave identically to the current implementation.

---

## Bug Condition 2 — Scroll Position

```pascal
FUNCTION isBugCondition2(X)
  INPUT: X of type RecommendationAppearEvent
  OUTPUT: boolean
  
  // Returns true when recommendations become visible (triggering auto-scroll)
  RETURN X.recommendations != null
    AND X.previousRecommendations = null
    AND X.scrollViewContentHeight > X.scrollViewViewportHeight
END FUNCTION
```

## Property Specification 2

```pascal
// Property: Fix Checking — Scroll to Top of Recommendations
FOR ALL X WHERE isBugCondition2(X) DO
  scrollPosition ← getScrollPositionAfterAutoScroll(X)
  recoContainerY ← getRecommendationsContainerYOffset(X)
  
  ASSERT scrollPosition = recoContainerY
    AND userSeesWalletToolsFirst(X) IF X.recommendations.walletTools.length > 0
    AND userSeesLibraryToolsFirst(X) IF X.recommendations.walletTools.length = 0
END FOR
```

## Preservation Goal 2

```pascal
// Property: Preservation Checking — Non-scroll behaviors unchanged
FOR ALL X WHERE NOT isBugCondition2(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that manual user scrolling, viewport-fitting content (no auto-scroll needed), and all non-recommendation-appearance interactions behave identically to the current implementation.

---

## Bug Condition 3 — Onboarding Race Condition with Emotion Session

```pascal
FUNCTION isBugCondition3(X)
  INPUT: X of type WalletScreenRenderEvent
  OUTPUT: boolean
  
  // Returns true when the highlight effect fires on a fresh onboarding user
  // who selected "emotion" mode, creating a race with tutorial completion
  RETURN X.route.params.highlightSessionCard = true
    AND X.tutorialComplete = true
    AND X.tutorialJustCompleted = true
    AND X.cards contains SESSION_LAUNCHER_CARD_ID
END FUNCTION
```

## Property Specification 3

```pascal
// Property: Fix Checking — Highlight must not expand or activate session
FOR ALL X WHERE isBugCondition3(X) DO
  stateAfterHighlight ← applyHighlightEffect(X)
  
  ASSERT stateAfterHighlight.sessionCard.isExpanded = false
    AND stateAfterHighlight.isSessionActive = false
    AND stateAfterHighlight.sessionLauncherContentRendered = false
    AND stateAfterHighlight.highlightVisualApplied = true
    AND stateAfterHighlight.scrolledToSessionCard = true
END FOR
```

## Preservation Goal 3

```pascal
// Property: Preservation Checking — Explicit user interaction unchanged
FOR ALL X WHERE NOT isBugCondition3(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that returning users (tutorial already complete, no highlightSessionCard param), explicit user card taps/expansions, and the micro-tutorial tooltip flow all behave identically to the current implementation. The fix is purely defensive — it separates "scroll-to and visually highlight" from "focus/expand" so that no automatic code path can render the session as active.

---

## Bug Condition 4 — Redundant Daily Mood Check-In in Seeding

```pascal
FUNCTION isBugCondition4(X)
  INPUT: X of type OnboardingSeedingEvent
  OUTPUT: boolean
  
  // Returns true when seeding uses a path that includes lib-daily-mood
  RETURN (X.intentId = "routine")
    OR (X.intentId = null AND X.usesDefaultFallback = true)
END FUNCTION
```

## Property Specification 4

```pascal
// Property: Fix Checking — lib-daily-mood removed from seeding
FOR ALL X WHERE isBugCondition4(X) DO
  seededCards ← getSeedCardIds'(X)
  
  ASSERT "lib-daily-mood" NOT IN seededCards
    AND (X.intentId = "routine" IMPLIES "lib-gratitude-three" IN seededCards)
    AND (X.usesDefaultFallback = true IMPLIES "lib-box-breathing" IN seededCards)
    AND |seededCards| = 3
END FOR
```

## Preservation Goal 4

```pascal
// Property: Preservation Checking — Other intents and library availability unchanged
FOR ALL X WHERE NOT isBugCondition4(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that the "overwhelm", "organize", and "explore" intents continue to seed their existing card sets unchanged, the `lib-daily-mood` card remains available in the curated library for manual addition, and the total count of seeded cards per intent is preserved.

---

## Bug Condition 5 — Intent Selection Locked After Back-Navigation

```pascal
FUNCTION isBugCondition5(X)
  INPUT: X of type IntentSelectionScreenFocusEvent
  OUTPUT: boolean
  
  // Returns true when IntentSelectionScreen regains focus after user navigated back
  // from KpiSelectionScreen while isTransitioning was still true
  RETURN X.screenName = "IntentSelection"
    AND X.focusType = "re-focus" 
    AND X.previousScreen = "KpiSelection"
    AND X.isTransitioning = true
END FUNCTION
```

## Property Specification 5

```pascal
// Property: Fix Checking — isTransitioning resets on re-focus
FOR ALL X WHERE isBugCondition5(X) DO
  stateAfterFocus ← applyFocusEffect(X)
  
  ASSERT stateAfterFocus.isTransitioning = false
    AND stateAfterFocus.allButtonsEnabled = true
    AND stateAfterFocus.userCanSelectIntent = true
END FOR
```

## Preservation Goal 5

```pascal
// Property: Preservation Checking — Active transition behavior unchanged
FOR ALL X WHERE NOT isBugCondition5(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that during an active transition (after tap, before navigation completes), buttons remain disabled to prevent double-taps. The fix only resets `isTransitioning` when the screen regains focus via back-navigation, not during normal forward transitions.

---

## Bug Condition 6 — Duplicate Seeded Cards After Re-Selection

```pascal
FUNCTION isBugCondition6(X)
  INPUT: X of type IntentSelectionEvent
  OUTPUT: boolean
  
  // Returns true when the user selects an intent after having already seeded cards
  // from a previous selection (i.e., re-selection after back-navigation)
  RETURN X.screenName = "IntentSelection"
    AND X.action = "selectIntent"
    AND X.previouslySeededIntentId != null
END FUNCTION
```

## Property Specification 6

```pascal
// Property: Fix Checking — No duplicate cards after re-selection
FOR ALL X WHERE isBugCondition6(X) DO
  walletAfterReSelection ← getWalletCards'(X)
  expectedCards ← getStarterCardsForIntent(X.intentId)
  
  ASSERT noDuplicateCardIds(walletAfterReSelection)
    AND starterCardsInWallet(walletAfterReSelection) = expectedCards
    AND cardsFromPreviousIntent(X.previouslySeededIntentId) NOT IN walletAfterReSelection
END FOR
```

## Preservation Goal 6

```pascal
// Property: Preservation Checking — First-time seeding unchanged
FOR ALL X WHERE NOT isBugCondition6(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This ensures that first-time intent selection (no prior seeded cards) continues to seed cards normally without any cleanup step, and that the seeding logic itself (card definitions, count, tags) remains unchanged. The fix only adds cleanup/deduplication logic when a previous seeding has already occurred.
