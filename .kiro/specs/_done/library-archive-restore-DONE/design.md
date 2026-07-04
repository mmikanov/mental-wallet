# Library Archive Restore Bugfix Design

## Overview

The Library Browser screen fails to detect archived instances of library cards when determining button state. It only checks active (non-archived) cards loaded via `useWalletStore`, which calls `cardService.getAll()` — a query filtered to `is_archived = 0`. When a library card has been archived, the browser shows "Add to wallet" and creates a brand new card instance, discarding history and producing duplicates in the archive over time.

The fix introduces an archived-card lookup by `source_library_id` in the Library Browser, changes the button label/action to "Restore from archive" when an archived instance exists, and invokes `cardService.restore()` on the existing instance rather than creating a new one.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a library card has an archived instance in the database, but the Library Browser does not detect it
- **Property (P)**: The desired behavior — the Library Browser shows "Restore from archive" and unarchives the existing instance (preserving history)
- **Preservation**: Existing behaviors that must remain unchanged — "Add to wallet" for never-added cards, "In wallet" for active cards, mouse/tap interactions for all other buttons
- **`source_library_id`**: Column on the `cards` table linking a wallet card instance to the curated library card definition (`CuratedCardDefinition.id`)
- **`LibraryBrowserScreen`**: The screen at `src/screens/LibraryBrowserScreen.tsx` that renders the curated library with action buttons
- **`cardService.restore(id)`**: Existing method in `src/services/cardService.ts` that unarchives a card, restoring it to the wallet with history intact
- **`walletStore.loadCards()`**: Zustand action that reloads active cards from the database into memory

## Bug Details

### Bug Condition

The bug manifests when a user views a library card in the Library Browser after having previously added and then archived that card. The screen's duplicate-detection logic only queries active cards (via `useWalletStore.cards`, which is populated by `cardService.getAll()` filtering `is_archived = 0`). It also matches by title instead of by `source_library_id`, making it fragile even for active cards.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { libraryCardId: string, walletCards: Card[], database: Database }
  OUTPUT: boolean
  
  LET archivedInstance = database.query(
    "SELECT id FROM cards WHERE source_library_id = ? AND is_archived = 1",
    [input.libraryCardId]
  )
  
  RETURN archivedInstance EXISTS
         AND input.walletCards.none(c => c.sourceLibraryId === input.libraryCardId)
         AND buttonShown === "Add to wallet"
END FUNCTION
```

### Examples

- **Archived card shown as "Add to wallet"**: User adds "5-4-3-2-1 Grounding" (lib-grounding-54321), archives it, then opens Library Browser → sees "Add to wallet" instead of "Restore from archive"
- **Duplicate creation**: User taps "Add to wallet" on the above card → a second card instance is created with a new ID, zero usage history, and no streak data
- **Accumulating duplicates**: User repeats archive → add → archive cycle 3 times → 3 archived instances of the same library card exist in the database
- **Edge case — card with no sourceLibraryId**: Older cards added before `source_library_id` migration may lack this field; they should fall back to title matching for backward compatibility

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Library cards that have never been added to the wallet continue to show "Add to wallet" and create a new instance when tapped
- Library cards currently active (non-archived) in the wallet continue to show "In wallet" with the button disabled
- The Archive screen's "Restore to Wallet" button continues to restore cards with full history
- Non-library cards (origin `my_tool` or `community`) are unaffected by Library Browser logic
- The `cardService.create()` method continues to work unchanged when called from other contexts (e.g., session launcher)

**Scope:**
All inputs that do NOT involve a library card with an existing archived instance should be completely unaffected by this fix. This includes:
- Library cards never added to wallet (new additions)
- Library cards currently active in wallet (disabled state)
- Any non-library-origin cards
- Archive screen restore flow

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Incomplete Query Scope**: `useWalletStore.cards` only contains active cards (`is_archived = 0`). The Library Browser never queries the database for archived instances, so it cannot detect them.

2. **Missing `sourceLibraryId` in Card Creation**: In `LibraryBrowserScreen.handleAddToWallet()`, the call to `cardService.create()` does not pass the library card's `id` as the `sourceLibraryId` parameter. This means even if we query by `source_library_id`, older cards won't match.

3. **Title-Based Matching Instead of ID-Based**: The current duplicate check uses `c.title === card.title && c.originBadge === 'library'`, which is fragile (titles could theoretically change in library updates) and doesn't work for archived cards since they aren't in the `cards` array.

4. **No Restore Action Path**: Even if detection worked, the Library Browser has no code path to call `cardService.restore()` — it only has "Add to wallet" (`create`) and "In wallet" (disabled) states.

## Correctness Properties

Property 1: Bug Condition - Archived Library Cards Show Restore Button

_For any_ library card displayed in the Library Browser where an archived instance with matching `source_library_id` (or matching title + origin for legacy cards) exists in the database, the Library Browser SHALL display "Restore from archive" and, when tapped, call `cardService.restore()` on the existing archived instance — preserving the original card ID, usage history, streak data, and all controls.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Archived Library Card Behavior

_For any_ library card displayed in the Library Browser where NO archived instance exists in the database, the Library Browser SHALL produce the same behavior as the original code: "Add to wallet" for never-added cards (creating a new instance) and "In wallet" (disabled) for currently-active cards.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/screens/LibraryBrowserScreen.tsx`

**Functions**: `handleAddToWallet`, `renderItem`, and new helper for archived lookup

**Specific Changes**:

1. **Add Archived Card Lookup**: On screen mount (and after any add/restore action), query the database for all archived cards with `origin_badge = 'library'` and a non-null `source_library_id`. Store these in local state as a `Map<string, string>` mapping `sourceLibraryId → cardId`.

2. **Update Button State Logic**: In `renderItem`, add a third state:
   - If `archivedMap.has(libraryCard.id)` → show "Restore from archive"
   - Else if active card exists with matching `sourceLibraryId` (or title for legacy) → show "In wallet" (disabled)
   - Else → show "Add to wallet"

3. **Add Restore Handler**: Create `handleRestoreFromArchive(libraryCard)` that calls `cardService.restore(archivedCardId)`, reloads the wallet store, and refreshes the archived map.

4. **Pass `sourceLibraryId` on Create**: Update `handleAddToWallet` to pass `card.id` as the `sourceLibraryId` parameter to `cardService.create()`, ensuring future archive lookups work by ID.

5. **Backward Compatibility**: For cards without `source_library_id` (pre-migration), fall back to title + originBadge matching when checking archived cards.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the Library Browser's button-state determination logic against a database containing archived library cards. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Archived Card Not Detected**: Create a card with `source_library_id = 'lib-grounding-54321'` and `is_archived = 1`, then call the button-state logic → button shows "Add to wallet" (will fail on unfixed code — this IS the bug)
2. **Duplicate Creation**: Call `handleAddToWallet` when archived instance exists → new card created instead of restore (will fail on unfixed code)
3. **Missing sourceLibraryId**: Add a card from library, verify `source_library_id` is set → will be null on unfixed code
4. **Multiple Archive Cycles**: Archive and re-add same card 3 times → 3 instances exist (will demonstrate accumulation on unfixed code)

**Expected Counterexamples**:
- Button state returns "Add to wallet" even when archived instance exists in database
- Possible causes: query only checks active cards, no database lookup for archived instances, sourceLibraryId not stored

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getButtonState_fixed(input.libraryCardId, input.database)
  ASSERT result.label === "Restore from archive"
  ASSERT result.onTap() calls cardService.restore(archivedInstanceId)
  ASSERT after restore: card.isArchived === false
  ASSERT after restore: card.totalUses === originalTotalUses
  ASSERT after restore: card.currentStreak === originalStreak
  ASSERT database.count(source_library_id = input.libraryCardId) === 1
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getButtonState_original(input) = getButtonState_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various combinations of active/never-added library cards)
- It catches edge cases that manual unit tests might miss (e.g., cards with null sourceLibraryId, cards with matching titles but different origins)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for never-added and active library cards, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Never-Added Card Preservation**: For library cards with no wallet instance (active or archived), verify "Add to wallet" is shown and `cardService.create()` is called with correct `sourceLibraryId`
2. **Active Card Preservation**: For library cards with an active wallet instance, verify "In wallet" (disabled) is shown
3. **Non-Library Card Preservation**: Verify cards with origin `my_tool` or `community` are never affected by library browser logic
4. **Archive Screen Preservation**: Verify the Archive screen's restore flow continues to work independently

### Unit Tests

- Test `getButtonState()` helper with archived instance → returns "Restore from archive"
- Test `getButtonState()` helper with active instance → returns "In wallet"
- Test `getButtonState()` helper with no instance → returns "Add to wallet"
- Test `getButtonState()` with legacy card (no sourceLibraryId) falling back to title match
- Test `handleRestoreFromArchive()` calls `cardService.restore()` with correct ID
- Test `handleAddToWallet()` passes `sourceLibraryId` to `cardService.create()`

### Property-Based Tests

- Generate random sets of library card IDs and random database states (some archived, some active, some never-added) → verify button state is always correct
- Generate random card configurations and verify no duplicate card instances are ever created when restore path is taken
- Generate inputs with mixed null/non-null `sourceLibraryId` values → verify fallback to title matching works correctly for legacy data

### Integration Tests

- Test full flow: add library card → archive → open library browser → see "Restore from archive" → tap → card restored with history
- Test that after restore, the library browser correctly shows "In wallet" (disabled)
- Test archive → restore → archive → restore cycle never creates duplicates
- Test that wallet store is correctly refreshed after restore from library browser
