# Tasks

## Task 1: Implement library search and sort

- [ ] Add search input to `LibraryBrowserScreen.tsx` (case-insensitive partial match against title, description, category name; triggers after 1 character)
- [ ] Add sort toggle: category-grouped (default) or newest-to-oldest
- [ ] Display empty state message when search/filter yields no results
- _Requirements: 1.1, 1.2, 1.3_

## Task 2: Expand curated library to full set

- [ ] Add remaining 8–11 curated cards to `src/data/curatedLibrary.ts` to reach 18–21 total across all 6 categories
- [ ] Ensure new cards follow existing CuratedCardDefinition format with proper Controls
- _Requirements: 1.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] }
  ]
}
```
