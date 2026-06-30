# Archive Origin Badge Bugfix Design

## Overview

The Archive screen renders card items without any visual indicator of their origin type (`originBadge` field). Users cannot tell whether an archived card came from the curated library, the community, or was self-created. The fix adds a small colored tag in the `cardMeta` row — next to the existing category tag — that displays the origin type with distinct coloring per origin. This is a UI-only change confined to `ArchiveScreen.tsx`.

## Glossary

- **Bug_Condition (C)**: Any archived card rendered in the Archive screen — the origin badge is never shown regardless of origin type
- **Property (P)**: Each card displays a colored origin tag matching its `originBadge` value ("Library", "My Tool", or "Community")
- **Preservation**: Existing layout, restore/delete functionality, empty state, and category/last-used metadata must remain unchanged
- **originBadge**: Field on `Card` of type `'library' | 'community' | 'my_tool'` indicating card provenance
- **cardMeta**: The flexbox row in `renderCardItem` that contains the category tag and last-used text

## Bug Details

### Bug Condition

The bug manifests for every card rendered in the Archive screen. The `renderCardItem` function builds a `cardMeta` row containing only the category tag and last-used text, never referencing the card's `originBadge` field. There is no conditional — the badge is simply absent from the JSX.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { card: Card, screen: ScreenName }
  OUTPUT: boolean

  RETURN input.screen = 'Archive'
         AND input.card.isArchived = true
         AND input.card.originBadge IN ['library', 'community', 'my_tool']
         AND originBadgeElement NOT rendered for input.card
END FUNCTION
```

### Examples

- Card with `originBadge = 'library'` renders in Archive → no "Library" tag shown (expected: blue-gray "Library" tag visible)
- Card with `originBadge = 'my_tool'` renders in Archive → no "My Tool" tag shown (expected: green "My Tool" tag visible)
- Card with `originBadge = 'community'` renders in Archive → no "Community" tag shown (expected: purple "Community" tag visible)
- Card with missing/undefined `originBadge` (edge case) → should not crash; gracefully omit badge or show fallback

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Card title, icon, category tag, and last-used date continue to display as before
- "Restore to Wallet" button restores the card and removes it from the list
- "Delete" button shows confirmation dialog and permanently deletes on confirm
- Empty state message displays when no archived cards exist
- Sorting by `archived_at DESC` remains unchanged
- Touch target sizes for action buttons remain ≥ 44pt

**Scope:**
All functionality unrelated to displaying the origin badge is completely unaffected. This includes:
- Database queries (no schema or query changes)
- Navigation behavior
- Card service calls (restore, delete)
- Loading and error states

## Hypothesized Root Cause

Based on the code analysis, the root cause is straightforward:

1. **Missing JSX element**: The `renderCardItem` function in `ArchiveScreen.tsx` never renders an origin badge component. The `cardMeta` View only contains `categoryTag` and `lastUsed` text — there is no reference to `item.originBadge`.

2. **No mapping function**: There is no helper to convert the `originBadge` enum value to a display label or color. The Library Browser has a hard-coded "Library" badge but no reusable utility.

3. **No styles defined**: The `StyleSheet` in `ArchiveScreen.tsx` has no styles for an origin badge element.

This is not a logic error or data issue — it is simply an unimplemented UI element.

## Correctness Properties

Property 1: Bug Condition - Origin Badge Renders for All Archived Cards

_For any_ archived card displayed in the Archive screen where `originBadge` is one of `'library'`, `'community'`, or `'my_tool'`, the fixed `renderCardItem` function SHALL render a visible badge element within the `cardMeta` row displaying the correct human-readable label ("Library", "My Tool", or "Community") with the corresponding color scheme.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing Card Layout and Functionality Unchanged

_For any_ interaction with the Archive screen that does not involve reading the origin badge (restore actions, delete actions, empty state display, category tag, last-used date), the fixed code SHALL produce exactly the same behavior and visual output as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `src/screens/ArchiveScreen.tsx`

**Function**: `renderCardItem`

**Specific Changes**:

1. **Add origin label mapping**: Create a helper function or inline map that converts `originBadge` values to display labels:
   - `'library'` → `"Library"`
   - `'my_tool'` → `"My Tool"`
   - `'community'` → `"Community"`

2. **Add origin color mapping**: Define background and text colors per origin type:
   - `'library'` → background `#E5E5EA`, text `#636366` (matches existing Library Browser pattern)
   - `'my_tool'` → background `#D4EDDA`, text `#155724` (green tones for user-created)
   - `'community'` → background `#E8D5F5`, text `#6A1B9A` (purple tones for community)

3. **Insert badge JSX in cardMeta row**: Add a `<View>` + `<Text>` element after the category tag inside the `cardMeta` View, using the mapped label and colors for `item.originBadge`.

4. **Add accessibility label**: Include `accessibilityLabel={`Origin: ${label}`}` on the badge View so screen readers announce the origin type.

5. **Add StyleSheet entries**: Define `originBadge` and `originBadgeText` styles matching the existing `libraryBadge` pattern from LibraryBrowserScreen (paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: '600').

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the badge is absent in unfixed code, then verify the fix renders correctly and does not break existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the origin badge is missing from rendered output.

**Test Plan**: Write component render tests using React Native Testing Library that render `ArchiveScreen` with mock data containing each `originBadge` value. Assert the badge text is present. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Library Badge Test**: Render card with `originBadge = 'library'`, query for "Library" text in cardMeta (will fail on unfixed code)
2. **My Tool Badge Test**: Render card with `originBadge = 'my_tool'`, query for "My Tool" text (will fail on unfixed code)
3. **Community Badge Test**: Render card with `originBadge = 'community'`, query for "Community" text (will fail on unfixed code)
4. **Accessibility Test**: Query for accessibility label containing origin info (will fail on unfixed code)

**Expected Counterexamples**:
- `queryByText('Library')` returns null when rendering a library-origin card
- No element with `accessibilityLabel` matching "Origin:" pattern exists

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function renders the correct origin badge.

**Pseudocode:**
```
FOR ALL card WHERE card.isArchived AND card.originBadge IN ['library', 'community', 'my_tool'] DO
  rendered := renderCardItem_fixed(card)
  ASSERT rendered contains badge with label = LABEL_MAP[card.originBadge]
  ASSERT badge has correct backgroundColor = COLOR_MAP[card.originBadge].bg
  ASSERT badge has accessibilityLabel containing origin type
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (i.e., all non-badge UI elements), the fixed function produces the same result as the original.

**Pseudocode:**
```
FOR ALL card WHERE card.isArchived DO
  ASSERT renderCardItem_fixed(card) contains card.title
  ASSERT renderCardItem_fixed(card) contains getCategoryLabel(card.categoryId)
  ASSERT renderCardItem_fixed(card) contains formatLastUsed(card.lastUsedAt)
  ASSERT restore button exists with correct accessibilityLabel
  ASSERT delete button exists with correct accessibilityLabel
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many card configurations automatically across the input domain
- It catches edge cases (unusual categoryId values, null lastUsedAt, etc.)
- It provides strong guarantees that the existing layout is unchanged for all card variants

**Test Plan**: Observe rendering behavior on UNFIXED code for category tags, last-used text, and action buttons, then write property-based tests capturing that behavior continues after the fix.

**Test Cases**:
1. **Title Preservation**: Verify card titles render correctly for all generated card configs after fix
2. **Category Tag Preservation**: Verify category tag continues to display for all categoryId values
3. **Action Button Preservation**: Verify restore and delete buttons remain functional after fix
4. **Empty State Preservation**: Verify empty state still shows when archivedCards is empty

### Unit Tests

- Test `originBadge` → label mapping for all three values
- Test `originBadge` → color mapping returns correct bg/text colors
- Test badge renders inside `cardMeta` row (correct position in layout hierarchy)
- Test edge case: card with unexpected `originBadge` value does not crash

### Property-Based Tests

- Generate random `Card` objects with valid `originBadge` values and verify the correct label/color combination is always rendered
- Generate random card lists and verify the category tag, last-used text, and action buttons remain present alongside the new badge
- Generate cards with all combinations of `categoryId` × `originBadge` and verify no layout conflicts

### Integration Tests

- Test full Archive screen with mixed-origin cards and verify all badges display correctly
- Test restore flow still works after badge addition
- Test delete flow still works after badge addition
- Test screen reader announces origin badges with correct labels
