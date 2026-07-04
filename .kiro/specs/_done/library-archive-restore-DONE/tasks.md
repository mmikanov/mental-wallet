# Implementation Plan

## Overview

This plan fixes the bug where the Library Browser shows "Add to wallet" for archived library cards instead of "Restore from archive". The implementation follows the exploratory bugfix workflow: first write tests to confirm the bug exists and capture baseline behavior, then implement the fix, then verify all tests pass.

The fix introduces an archived-card lookup by `source_library_id`, adds three-state button logic ("Restore from archive" / "In wallet" / "Add to wallet"), a `handleRestoreFromArchive` handler, and backward compatibility via title fallback for pre-migration cards.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Archived Library Cards Show "Add to wallet" Instead of "Restore from archive"
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — a library card with `source_library_id` set and `is_archived = 1` in the database, where the Library Browser's button-state logic is evaluated
  - Test file: `src/screens/__tests__/LibraryBrowserScreen.bugCondition.test.ts`
  - Extract the button-state determination logic into a testable helper function (e.g., `getLibraryCardButtonState(libraryCardId, activeCards, archivedLibraryCards)`)
  - Using fast-check, generate arbitrary library card IDs and database states where an archived instance exists with matching `source_library_id`
  - Assert: for all such inputs, button label === "Restore from archive"
  - Assert: tapping the button calls `cardService.restore(archivedInstanceId)` (not `cardService.create()`)
  - Assert: after restore, card retains original ID, `totalUses`, `currentStreak`, and `lastUsedAt`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because the current code returns "Add to wallet" for archived cards)
  - Document counterexamples found (e.g., `getButtonState('lib-grounding-54321', [], new Map([['lib-grounding-54321', 'card-abc']]))` returns "Add to wallet" instead of "Restore from archive")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Archived Library Card Button States Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/screens/__tests__/LibraryBrowserScreen.preservation.test.ts`
  - Observe on UNFIXED code: for a library card never added to wallet, button shows "Add to wallet" and tapping calls `cardService.create()`
  - Observe on UNFIXED code: for a library card currently active in wallet (matched by title + originBadge), button shows "In wallet" (disabled)
  - Observe on UNFIXED code: non-library cards (origin `my_tool` or `community`) are never affected by library browser logic
  - Using fast-check, generate random sets of library card IDs and wallet states where NO archived instance exists:
    - Property A: For all library cards with no wallet instance at all, button state === "Add to wallet"
    - Property B: For all library cards with an active (non-archived) wallet instance matching by `sourceLibraryId` or title+origin, button state === "In wallet" (disabled)
    - Property C: For all non-library-origin cards in any state, library browser button logic never references them
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for archived library cards showing "Add to wallet" instead of "Restore from archive"

  - [x] 3.1 Extract button-state helper function
    - Create a pure/testable helper `getLibraryCardButtonState(libraryCardId: string, activeCards: Card[], archivedLibraryCards: Map<string, string>): { label: string; disabled: boolean; action: 'add' | 'restore' | 'none' }`
    - Logic: if `archivedLibraryCards.has(libraryCardId)` → return `{ label: "Restore from archive", disabled: false, action: "restore" }`
    - Else if activeCards has card with `sourceLibraryId === libraryCardId` OR (for legacy) `title === libraryCard.title && originBadge === 'library'` → return `{ label: "In wallet", disabled: true, action: "none" }`
    - Else → return `{ label: "Add to wallet", disabled: false, action: "add" }`
    - _Bug_Condition: isBugCondition(input) where archivedInstance EXISTS AND walletCards.none(c => c.sourceLibraryId === libraryCardId) AND buttonShown === "Add to wallet"_
    - _Expected_Behavior: button label === "Restore from archive" when archived instance exists_
    - _Preservation: non-archived cases produce same results as original code_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.2 Add archived-card lookup query to LibraryBrowserScreen
    - On screen mount (and after add/restore), query database: `SELECT source_library_id, id FROM cards WHERE origin_badge = 'library' AND is_archived = 1 AND source_library_id IS NOT NULL`
    - Also query for legacy cards (no `source_library_id`): `SELECT title, id FROM cards WHERE origin_badge = 'library' AND is_archived = 1 AND source_library_id IS NULL`
    - Store result in local state as `archivedLibraryCards: Map<string, string>` (key = sourceLibraryId or title, value = card.id)
    - Refresh this map after any add or restore action
    - _Bug_Condition: This query is the missing piece — unfixed code never queries archived cards_
    - _Expected_Behavior: archivedLibraryCards map correctly populated with all archived library instances_
    - _Requirements: 1.1, 2.1_

  - [x] 3.3 Implement handleRestoreFromArchive handler
    - Create `handleRestoreFromArchive(libraryCard: CuratedCardDefinition)` in LibraryBrowserScreen
    - Look up archived card ID from `archivedLibraryCards` map using `libraryCard.id` (or title fallback for legacy)
    - Call `cardService.restore(archivedCardId)`
    - Call `loadCards()` to refresh wallet store
    - Refresh the archived cards map (remove restored entry)
    - Show success alert: `"${card.title}" has been restored to your wallet.`
    - Handle errors with alert: "Failed to restore card. Please try again."
    - _Expected_Behavior: cardService.restore() called with correct archived instance ID, history preserved_
    - _Preservation: Does not affect cardService.create() path or Archive screen restore flow_
    - _Requirements: 2.2, 2.3_

  - [x] 3.4 Update renderItem to use three-state button logic
    - Replace the current two-state (`isAlreadyInWallet`) check with the extracted helper function
    - Wire "Restore from archive" button to `handleRestoreFromArchive`
    - Wire "Add to wallet" button to existing `handleAddToWallet`
    - "In wallet" remains disabled as before
    - Style the restore button distinctly (e.g., different background color or icon) to differentiate from "Add to wallet"
    - Update accessibility labels: "Restore {title} from archive", "Add {title} to wallet", "{title} already in wallet"
    - _Bug_Condition: renderItem currently only checks active cards for "In wallet" state_
    - _Expected_Behavior: Three states rendered correctly based on helper function output_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.5 Pass sourceLibraryId when creating cards from library
    - In `handleAddToWallet`, pass `card.id` as the `sourceLibraryId` parameter to `cardService.create()`
    - This ensures future archive lookups work by `source_library_id` column
    - Existing `cardService.create()` already accepts `sourceLibraryId` as the 5th parameter
    - _Expected_Behavior: New library cards stored with source_library_id linking back to CuratedCardDefinition.id_
    - _Preservation: cardService.create() API unchanged; other callers unaffected_
    - _Requirements: 2.1, 2.3_

  - [x] 3.6 Add backward compatibility via title fallback for pre-migration cards
    - When querying archived cards, include cards with `source_library_id IS NULL` and match by `title + origin_badge = 'library'`
    - In `getLibraryCardButtonState`, check both `sourceLibraryId` match AND title-based fallback
    - This handles cards added before the `source_library_id` column was populated
    - _Preservation: Legacy cards without sourceLibraryId still detected as archived instances_
    - _Requirements: 2.1, 3.1_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Archived Library Cards Show "Restore from archive"
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Archived Library Card Button States Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run type check: `npm run typecheck`
  - Verify bug condition test (Property 1) passes
  - Verify preservation tests (Property 2) pass
  - Verify no other tests regressed
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- The `cardService.restore(id)` method already exists and handles unarchiving with history preservation — no new service method needed
- The `source_library_id` column already exists on the `cards` table and is accepted by `cardService.create()` — the bug is that `LibraryBrowserScreen` never passes it
- Property-based tests use fast-check 3 as configured in the project
- The button-state helper is extracted as a pure function to make it easily testable without rendering React components
- Legacy cards (pre-migration) without `source_library_id` use title + originBadge matching as a fallback

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3"] },
    { "id": 2, "tasks": ["4"] }
  ]
}
```
