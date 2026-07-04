# Implementation Plan

## Overview

Add an origin badge (Library / My Tool / Community) to archived cards in `ArchiveScreen.tsx`. This is a UI-only fix — add a colored tag in the `cardMeta` row after the category tag, with accessible labeling.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Origin Badge Missing for All Archived Cards
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the origin badge is never rendered
  - **Scoped PBT Approach**: Use fast-check to generate cards with `originBadge` in `['library', 'my_tool', 'community']` and assert the rendered output contains the correct badge text
  - Create test file at `src/screens/__tests__/ArchiveScreen.originBadge.test.tsx`
  - Mock navigation, database, and cardService dependencies
  - Generate cards using `fc.record({ originBadge: fc.constantFrom('library', 'my_tool', 'community'), ... })` with all required Card fields
  - For each generated card, render the ArchiveScreen with that card in the mock DB response
  - Assert `queryByText('Library')` / `queryByText('My Tool')` / `queryByText('Community')` returns a non-null element matching the card's `originBadge` value
  - Assert an element with `accessibilityLabel` matching `"Origin: Library"` / `"Origin: My Tool"` / `"Origin: Community"` exists
  - Run test on UNFIXED code with `npm test -- --testPathPattern=ArchiveScreen.originBadge`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the badge is absent)
  - Document counterexamples found (e.g., "queryByText('Library') returns null for card with originBadge='library'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Card Layout and Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Add preservation tests in the same test file `src/screens/__tests__/ArchiveScreen.originBadge.test.tsx`
  - Observe on UNFIXED code: card title renders, category tag renders, last-used text renders, restore button exists, delete button exists
  - Write property-based test: for all generated Card objects (varying categoryId, title, lastUsedAt, originBadge), the rendered output contains:
    - The card's title text
    - The category label from `getCategoryLabel(card.categoryId)`
    - A "Restore to Wallet" button with correct accessibility label
    - A "Delete" button with correct accessibility label
  - Use `fc.record(...)` to generate diverse card configs covering all categoryId values and null/non-null lastUsedAt
  - Also test empty state: when archivedCards is empty, the "No archived cards" message displays
  - Run tests on UNFIXED code with `npm test -- --testPathPattern=ArchiveScreen.originBadge`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Implement origin badge fix in ArchiveScreen

  - [x] 3.1 Add origin label and color mappings and render the badge
    - Add `getOriginLabel` helper: `'library' → "Library"`, `'my_tool' → "My Tool"`, `'community' → "Community"`
    - Add `getOriginColors` helper returning `{ bg, text }` per origin:
      - `'library'` → `{ bg: '#E5E5EA', text: '#636366' }`
      - `'my_tool'` → `{ bg: '#D4EDDA', text: '#155724' }`
      - `'community'` → `{ bg: '#E8D5F5', text: '#6A1B9A' }`
    - In `renderCardItem`, inside the `cardMeta` View, after the `categoryTag` View, add:
      ```tsx
      {item.originBadge && (
        <View
          style={[styles.originBadge, { backgroundColor: getOriginColors(item.originBadge).bg }]}
          accessibilityLabel={`Origin: ${getOriginLabel(item.originBadge)}`}
        >
          <Text style={[styles.originBadgeText, { color: getOriginColors(item.originBadge).text }]}>
            {getOriginLabel(item.originBadge)}
          </Text>
        </View>
      )}
      ```
    - Add StyleSheet entries:
      - `originBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }`
      - `originBadgeText: { fontSize: 10, fontWeight: '600' }`
    - _Bug_Condition: isBugCondition(input) where input.screen = 'Archive' AND card.originBadge IN ['library', 'community', 'my_tool'] AND badge not rendered_
    - _Expected_Behavior: Render colored badge with correct label and accessibility annotation_
    - _Preservation: Existing cardMeta row structure (category tag, last-used text) unchanged; no DOM removals_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Origin Badge Renders for All Archived Cards
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (badge with correct label is present)
    - Run `npm test -- --testPathPattern=ArchiveScreen.originBadge`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Card Layout and Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run `npm test -- --testPathPattern=ArchiveScreen.originBadge`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run type check: `npm run typecheck`
  - Ensure no new TypeScript errors or lint warnings introduced
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "tasks": ["1", "2"] },
    { "tasks": ["3.1"] },
    { "tasks": ["3.2", "3.3"] },
    { "tasks": ["4"] }
  ]
}
```

## Notes

- Single file change: `src/screens/ArchiveScreen.tsx`
- Test file: `src/screens/__tests__/ArchiveScreen.originBadge.test.tsx`
- No new dependencies, services, or data layer changes needed
- Style pattern matches existing `libraryBadge` from LibraryBrowserScreen
