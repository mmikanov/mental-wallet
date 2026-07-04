# Design Document

## Overview

Extends the existing `LibraryBrowserScreen.tsx` with a search input and sort toggle. The curated library data in `src/data/curatedLibrary.ts` is expanded with additional cards.

## Architecture

No new services needed. Search and sort are client-side operations on the in-memory curated library array. The existing category filter remains and stacks with search.

## Components and Interfaces

### UI Changes

- Add `SearchInput` component at top of LibraryBrowserScreen (debounced, triggers after 1 char)
- Add sort toggle: "By Category" (default) | "Newest First"
- Existing `EmptyState` component reused for no-results scenario

### Search Logic

```typescript
function searchLibrary(cards: LibraryCard[], query: string): LibraryCard[] {
  const q = query.toLowerCase();
  return cards.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.categoryName.toLowerCase().includes(q)
  );
}
```

## Data Models

No schema changes. Additional curated cards follow the existing `CuratedCardDefinition` format in `curatedLibrary.ts`.

## Testing Strategy

- Unit test: search returns correct subset for partial matches (case-insensitive)
- Unit test: empty query returns all cards
- Unit test: sort by newest orders by `createdAt` descending
