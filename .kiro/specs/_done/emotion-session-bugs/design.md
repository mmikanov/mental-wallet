# Emotion Session Bugs — Bugfix Design

## Overview

This design addresses three bugs in the emotion session launcher that degrade UX when interacting with recommended library tools during a session:

1. **Scroll position lost** — Closing a library tool preview returns the user to the top of the session view instead of the recommendations section.
2. **Added-to-wallet state lost** — The "Added ✓" indicator resets when `SessionLauncherContent` unmounts/remounts because it's stored in local React state instead of the Zustand session store.
3. **Crisis link doesn't navigate** — Tapping "In crisis? Get support →" in the rationale sheet opened from `LibraryToolPreview` closes the sheet but doesn't navigate to the Crisis Resources screen.

All three fixes are minimal, targeted changes within the session component tree. No architectural changes are required.

## Glossary

- **Bug_Condition (C)**: The set of inputs/states that trigger the defective behavior for each bug
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing behavior that must remain unchanged after the fix
- **SessionLauncherContent**: Component at `src/components/session/SessionLauncherContent.tsx` that manages the expanded session launcher card UI — emotion picker, context/time selection, recommendations, and library tool preview
- **LibraryToolPreview**: Component at `src/components/session/LibraryToolPreview.tsx` that renders an inline preview of a library tool during a session
- **sessionStore**: Zustand store at `src/stores/sessionStore.ts` managing session lifecycle state (emotion, contexts, time, recommendations, tools used/added)
- **previewingCard**: Local state in `SessionLauncherContent` that tracks which library card is being previewed inline
- **addedToWalletIds**: Local state (`Set<string>`) tracking which library tool IDs have been added to the wallet during the current session
- **addedToWalletMapping**: Local state (`Map<string, string>`) mapping library card IDs to their newly created wallet card IDs
- **recoContainerY**: Ref storing the measured Y offset of the recommendations container for scroll targeting
- **RationaleSheet**: Bottom sheet component at `src/components/rationale/RationaleSheet.tsx` showing evidence and research behind a tool

## Bug Details

### Bug 1: Scroll Position Lost After Preview

The bug manifests when the user opens a library tool preview (setting `previewingCard` to a card definition), then closes the preview via "← Back to session" (setting `previewingCard` to null). The conditional render in `SessionLauncherContent` swaps between the `LibraryToolPreview` component and the main session ScrollView. On swap-back, React mounts a fresh ScrollView at offset 0. The existing auto-scroll effect only triggers on `recommendations` change (which doesn't change when closing a preview).

**Formal Specification:**
```
FUNCTION isBugCondition_Bug1(state)
  INPUT: state of type { previewingCard: CuratedCardDefinition | null, previousPreviewingCard: CuratedCardDefinition | null, recommendations: RecommendationResult | null }
  OUTPUT: boolean

  RETURN state.previousPreviewingCard !== null
         AND state.previewingCard === null
         AND state.recommendations !== null
END FUNCTION
```

### Bug 2: Added-to-Wallet State Lost on Remount

The bug manifests when the user adds a library tool to their wallet during a session (updating `addedToWalletIds` and `addedToWalletMapping` in local `useState`), then navigates away (e.g., focuses another card), causing `SessionLauncherContent` to unmount. When the user returns to the session launcher, the component remounts with fresh empty state: `new Set()` for `addedToWalletIds` and `new Map()` for `addedToWalletMapping`.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug2(state)
  INPUT: state of type { sessionActive: boolean, componentMounted: boolean, previouslyAddedIds: Set<string> }
  OUTPUT: boolean

  RETURN state.sessionActive === true
         AND state.componentMounted === true
         AND state.previouslyAddedIds.size > 0
         AND localState.addedToWalletIds.size === 0
END FUNCTION
```

### Bug 3: Crisis Support Link Does Not Navigate

The bug manifests when the user taps "In crisis? Get support →" in the `RationaleSheet` opened from `LibraryToolPreview`. The `onCrisisResourcesPress` handler passed to `RationaleSheet` only calls `setRationaleVisible(false)` — it does not close the preview or trigger navigation to the CrisisResources screen.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug3(state)
  INPUT: state of type { isInLibraryToolPreview: boolean, rationaleSheetVisible: boolean, crisisLinkTapped: boolean }
  OUTPUT: boolean

  RETURN state.isInLibraryToolPreview === true
         AND state.rationaleSheetVisible === true
         AND state.crisisLinkTapped === true
END FUNCTION
```

### Examples

- **Bug 1**: User sees 3 recommended tools, taps tool #2 to preview, presses "← Back to session" → sees the emotion picker at the top instead of the recommendations list
- **Bug 2**: User adds "5-4-3-2-1 Grounding" to wallet (button shows "Added ✓"), taps a wallet tool recommendation which focuses that card, returns to session launcher → button shows "Add to wallet" again instead of "Added ✓"
- **Bug 3**: User previews "Deep Breathing" (a distress-related tool), taps "Learn more", taps "In crisis? Get support →" → rationale sheet closes but screen doesn't change; expected: navigates to Crisis Resources screen

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Auto-scroll to recommendations on initial `fetchRecommendations()` completion must continue to work
- Manual scroll position within the session (without previewing) must not be interfered with
- Mouse/touch interactions with tool preview cards (tap to open wallet tool, tap to preview library tool) must remain unchanged
- `endSession()` and `dismissWithoutSession()` must continue to clear all session state
- Existing duplicate detection logic (hiding "Add to wallet" when tool already in wallet) must remain unchanged
- Crisis link navigation from `FocusedCardView` and `CardPreviewSheet` must remain unchanged
- Dismissing the rationale sheet without tapping the crisis link must only close the sheet

**Scope:**
All inputs that do NOT involve the three bug conditions should be completely unaffected by these fixes. This includes:
- Normal session flow without previewing tools
- Opening wallet tools from recommendations (navigates away, not inline preview)
- Adding tools that aren't later unmount/remount-cycled
- Crisis link from non-session surfaces (Library Browser, Focused Wallet Card)

## Hypothesized Root Cause

### Bug 1: Missing Scroll Restoration After Preview Close

1. **Conditional render remounts ScrollView**: When `previewingCard` changes from non-null to null, the entire main session UI (including the ScrollView) is freshly mounted. React doesn't preserve scroll position across unmount/mount cycles.
2. **Auto-scroll effect only triggers on `recommendations` change**: The existing `useEffect` that scrolls to `recoContainerY.current` has `[recommendations]` as its dependency. Closing a preview doesn't change `recommendations`, so the effect doesn't re-fire.
3. **The ref `recoContainerY` loses its value**: Because the recommendations container re-renders from scratch, the `onLayout` callback re-measures, but by then the scroll has already settled at 0.

### Bug 2: State Stored in Local `useState` Instead of Zustand Store

1. **`addedToWalletIds` and `addedToWalletMapping` are component-local state**: They use `useState` inside `SessionLauncherContent`. When the component unmounts (user focuses another card), these values are destroyed.
2. **Session store lacks these fields**: The `sessionStore` already persists `toolsAddedToWallet` (titles only, for the summary) but doesn't store the ID set or the ID mapping needed for UI display.
3. **Remount creates fresh empty state**: On remount, `useState<Set<string>>(new Set())` and `useState<Map<string, string>>(new Map())` produce empty collections.

### Bug 3: Incomplete `onCrisisResourcesPress` Handler

1. **Handler only dismisses the rationale sheet**: In `LibraryToolPreview.tsx` line 111, the handler is `() => setRationaleVisible(false)`. It doesn't close the preview or trigger navigation.
2. **`LibraryToolPreview` has no navigation prop**: Unlike `FocusedCardView` (which uses `useNavigation()`) or `CardPreviewSheet` (which receives `onCrisisResourcesPress` from its parent screen), `LibraryToolPreview` has no mechanism to navigate.
3. **The navigation action must propagate up**: The component needs a callback prop (like `onCrisisResourcesPress`) that the parent (`SessionLauncherContent`) can wire to close the preview and navigate.

## Correctness Properties

Property 1: Bug Condition — Scroll Restores to Recommendations After Preview Close

_For any_ state where a library tool preview was open (`previewingCard !== null`), recommendations exist, and the user closes the preview (setting `previewingCard` to null), the SessionLauncherContent SHALL programmatically scroll the ScrollView to the recommendations container Y offset within a short delay after remount.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Auto-Scroll on Initial Recommendations

_For any_ state where recommendations transition from null to non-null (initial fetch), without a preview having been open, the existing auto-scroll behavior SHALL produce the same scroll-to-recommendations result as before the fix.

**Validates: Requirements 3.1, 3.2**

Property 3: Bug Condition — Added-to-Wallet State Persists Across Remounts

_For any_ session where one or more library tools have been added to the wallet (IDs recorded in session store), and the SessionLauncherContent component remounts while the session is still active, the component SHALL display "Added ✓" for all previously-added tool IDs and SHALL navigate to the wallet card (via ID mapping) when the user taps an already-added tool.

**Validates: Requirements 5.1, 5.2, 5.3**

Property 4: Preservation — Session End Clears Added-to-Wallet State

_For any_ session that ends via `endSession()` or `dismissWithoutSession()`, the added-to-wallet IDs and mapping SHALL be cleared along with all other session state, preserving the existing session cleanup behavior.

**Validates: Requirements 6.1, 6.2**

Property 5: Bug Condition — Crisis Link Navigates from Session Preview

_For any_ state where the user is in a LibraryToolPreview, the rationale sheet is visible, and the user taps the "In crisis? Get support →" link, the system SHALL dismiss the rationale sheet, close the tool preview, AND navigate to the CrisisResources screen.

**Validates: Requirements 8.1, 8.2**

Property 6: Preservation — Crisis Link from Other Surfaces Unchanged

_For any_ state where the user taps the crisis link from the rationale sheet in `FocusedCardView` or `CardPreviewSheet`, the navigation behavior SHALL remain identical to the current implementation (dismiss sheet/preview, navigate to CrisisResources).

**Validates: Requirements 9.1, 9.2, 9.3**

## Fix Implementation

### Changes Required

#### Bug 1: Scroll Restoration After Preview Close

**File**: `src/components/session/SessionLauncherContent.tsx`

**Specific Changes**:
1. **Track preview-was-open state**: Add a ref (`wasPreviewingRef`) that is set to `true` when `previewingCard` transitions from non-null to null.
2. **Extend auto-scroll effect**: Modify the existing `useEffect` that triggers on `recommendations` to also trigger when the preview closes. Add a second `useEffect` (or extend the existing one) that watches a scroll trigger signal and scrolls to `recoContainerY.current` when the preview was just closed.
3. **Re-measure layout before scrolling**: Since the ScrollView remounts, use a small delay (same pattern as existing auto-scroll) to allow `onLayout` to fire and update `recoContainerY.current` before scrolling.

#### Bug 2: Persist Added-to-Wallet State in Session Store

**File**: `src/stores/sessionStore.ts`

**Specific Changes**:
1. **Add `addedToWalletIds` field**: Add `addedToWalletIds: string[]` to the store interface and `INITIAL_STATE`.
2. **Add `addedToWalletMapping` field**: Add `addedToWalletMapping: Record<string, string>` (library card ID → wallet card ID) to the store interface and `INITIAL_STATE`.
3. **Add `recordToolAddedToWallet` action**: Add an action that takes `(libraryCardId: string, walletCardId: string)` and appends to both fields.
4. **Clear on session end**: Ensure `INITIAL_STATE` resets both fields (already handled by spread of `INITIAL_STATE` in `endSession` and `dismissWithoutSession`).

**File**: `src/components/session/SessionLauncherContent.tsx`

**Specific Changes**:
1. **Remove local `addedToWalletIds` and `addedToWalletMapping` useState**: Replace with reads from the session store.
2. **Derive `addedToWalletIds` as a Set from the store array**: `const addedToWalletIds = useMemo(() => new Set(storeAddedIds), [storeAddedIds])`.
3. **Derive `addedToWalletMapping` as a Map from the store record**: `const addedToWalletMapping = useMemo(() => new Map(Object.entries(storeMapping)), [storeMapping])`.
4. **Update `handleAddToWallet`**: Instead of calling `setAddedToWalletIds` and `setAddedToWalletMapping`, call the new store action `recordToolAddedToWallet(cardId, newCard.id)`.

#### Bug 3: Wire Crisis Navigation Through LibraryToolPreview

**File**: `src/components/session/LibraryToolPreview.tsx`

**Specific Changes**:
1. **Add `onCrisisResourcesPress` prop**: Add an optional callback `onCrisisResourcesPress?: () => void` to the `LibraryToolPreviewProps` interface.
2. **Update RationaleSheet handler**: Change from `() => setRationaleVisible(false)` to a handler that calls `setRationaleVisible(false)` then invokes `onCrisisResourcesPress?.()`.

**File**: `src/components/session/SessionLauncherContent.tsx`

**Specific Changes**:
1. **Add `onCrisisResourcesPress` prop**: Add to `SessionLauncherContentProps`.
2. **Create `handleCrisisResourcesPress` callback**: Close the preview (`setPreviewingCard(null)`) and invoke `onCrisisResourcesPress()`.
3. **Pass to LibraryToolPreview**: Wire the new callback to the `LibraryToolPreview` component.

**File**: `src/screens/WalletScreen.tsx`

**Specific Changes**:
1. **Pass navigation callback to SessionLauncherContent**: Add an `onCrisisResourcesPress` prop that calls `navigation.navigate('CrisisResources')`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach per bug: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Bug 1 Test Plan**: Write a test that renders `SessionLauncherContent` with recommendations, sets `previewingCard` to a library card, then simulates closing the preview. Assert that `scrollTo` was called with the recommendations Y offset. Run on unfixed code to confirm failure.

**Bug 2 Test Plan**: Write a test that renders `SessionLauncherContent`, triggers `handleAddToWallet`, then unmounts and remounts the component (simulating navigation away and back). Assert that `addedToWalletIds` still contains the added ID. Run on unfixed code to confirm the state is lost.

**Bug 3 Test Plan**: Write a test that renders `LibraryToolPreview` with a distress-related card, opens the rationale sheet, and simulates pressing the crisis link. Assert that the `onCrisisResourcesPress` prop was called (or that navigation occurred). Run on unfixed code to confirm the navigation doesn't happen.

**Test Cases**:
1. **Bug 1 — Preview close scroll** (will fail on unfixed code): Close preview → assert scrollTo called with recoContainerY
2. **Bug 2 — Remount state** (will fail on unfixed code): Add tool → unmount → remount → assert "Added ✓" displayed
3. **Bug 3 — Crisis navigation** (will fail on unfixed code): Open rationale → tap crisis link → assert navigation callback invoked

**Expected Counterexamples**:
- Bug 1: ScrollView scrollTo is never called after preview close; scroll offset remains 0
- Bug 2: `addedToWalletIds` is empty Set on remount; UI shows "Add to wallet" instead of "Added ✓"
- Bug 3: `onCrisisResourcesPress` prop is not invoked; only `setRationaleVisible(false)` fires

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
-- Bug 1
FOR ALL state WHERE previewClosedWithRecommendations(state) DO
  result := renderSessionLauncherContent_fixed(state)
  ASSERT scrollTo(recoContainerY) called within 150ms
END FOR

-- Bug 2
FOR ALL session WHERE toolsAddedDuringSession(session).size > 0 DO
  unmount(SessionLauncherContent)
  remount(SessionLauncherContent)
  ASSERT displayedAddedIds = sessionStore.addedToWalletIds
  ASSERT addedToWalletMapping = sessionStore.addedToWalletMapping
END FOR

-- Bug 3
FOR ALL state WHERE crisisLinkTappedInSessionPreview(state) DO
  result := handleCrisisPress_fixed(state)
  ASSERT rationaleSheetDismissed(result)
  ASSERT previewClosed(result)
  ASSERT navigatedToCrisisResources(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
-- Bug 1 Preservation
FOR ALL state WHERE NOT previewClosedWithRecommendations(state) DO
  ASSERT scrollBehavior_original(state) = scrollBehavior_fixed(state)
END FOR

-- Bug 2 Preservation
FOR ALL session WHERE sessionEnded(session) DO
  ASSERT sessionStore.addedToWalletIds = []
  ASSERT sessionStore.addedToWalletMapping = {}
END FOR

-- Bug 3 Preservation
FOR ALL state WHERE crisisLinkTappedOutsideSessionPreview(state) DO
  ASSERT crisisNavigation_original(state) = crisisNavigation_fixed(state)
END FOR
```

**Testing Approach**: Property-based testing with fast-check is recommended for Bug 2 preservation checking because:
- It can generate many combinations of add/remove/session-end sequences to verify state consistency
- It catches edge cases like adding the same tool twice, or ending session mid-add
- It provides strong guarantees that the Zustand store correctly resets on session end

**Test Plan**: Observe behavior on unfixed code first for normal session flows, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Auto-scroll preservation**: Verify that initial recommendations still trigger auto-scroll correctly after the fix
2. **Session end clears state**: Verify `endSession()` clears `addedToWalletIds` and `addedToWalletMapping`
3. **Dismiss clears state**: Verify `dismissWithoutSession()` clears all session state
4. **Existing duplicate detection**: Verify tools already in wallet don't show "Add to wallet" button regardless of session state
5. **Non-session crisis link**: Verify `FocusedCardView` and `CardPreviewSheet` crisis navigation is unaffected
6. **Rationale dismiss without crisis**: Verify dismissing the sheet (swipe, close, backdrop) doesn't trigger navigation

### Unit Tests

- Test `sessionStore.recordToolAddedToWallet` correctly appends IDs and mapping
- Test `sessionStore.endSession` resets `addedToWalletIds` and `addedToWalletMapping` to initial values
- Test `LibraryToolPreview` calls `onCrisisResourcesPress` prop when crisis link is tapped
- Test `LibraryToolPreview` dismisses rationale sheet before calling crisis callback
- Test `SessionLauncherContent` scroll effect fires when preview closes and recommendations exist
- Test `SessionLauncherContent` reads added-to-wallet state from store (not local state)

### Property-Based Tests

- Generate random sequences of (addTool, unmount, remount) operations and verify the displayed "Added ✓" state always matches the session store
- Generate random session lifecycle sequences (selectEmotion, addTool, endSession, dismissWithoutSession) and verify INITIAL_STATE invariants hold after end/dismiss
- Generate random card configurations (distress/non-distress emotion tags) and verify crisis link visibility matches `isDistressRelated` computation

### Integration Tests

- Full flow: select emotion → fetch recommendations → preview library tool → close preview → verify scroll position is at recommendations
- Full flow: select emotion → fetch recommendations → add tool → navigate away → return → verify "Added ✓" persists
- Full flow: select emotion → fetch recommendations → preview distress tool → open rationale → tap crisis link → verify navigated to CrisisResources screen
- Full flow: add tool during session → end session → start new session → verify clean state (no stale "Added ✓")
