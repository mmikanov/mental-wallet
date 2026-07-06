# Implementation Plan: Curator Admin Panel

## Overview

Implements a hidden admin mode within the existing Card Creator and Library Browser screens, enabling the admin to create, edit, delete, and export library-grade cards without editing code. The implementation adds a database migration, a Zustand admin store, an admin card service with merge logic, a clipboard export serializer, and UI enhancements to both screens.

## Tasks

- [x] 1. Database migration and type updates
  - [x] 1.1 Add `suppressed_library_cards` table migration and update `icon_type` validation
    - Add a new `runAdminMigration` function in `src/data/migrations.ts`
    - Create `suppressed_library_cards` table (id TEXT PRIMARY KEY, suppressed_at TEXT NOT NULL DEFAULT datetime('now'))
    - Add application-layer validation for `icon_type = 'third_party'` (SQLite cannot alter CHECK constraints in-place)
    - Call `runAdminMigration` from `runMigrations`
    - _Requirements: 7.5, 7.7_

  - [x] 1.2 Update navigation types with admin params
    - Extend `RootStackParamList['CardCreator']` in `src/navigation/types.ts` to include `adminEditCardId?: string` and `adminEditSource?: 'admin' | 'static'`
    - _Requirements: 4.2, 4.3_

- [x] 2. Admin store and service layer
  - [x] 2.1 Create `useAdminStore` Zustand store
    - Create `src/stores/adminStore.ts` with `isAdminMode`, `activateAdmin`, `deactivateAdmin`, `toggleAdmin`, and `resetAdmin` actions
    - Admin mode is ephemeral — no persistence, resets on navigation blur
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 2.2 Implement `adminCardService` with CRUD operations
    - Create `src/services/adminCardService.ts`
    - Implement `createLibraryCard` — generates `admin-lib-{uuid}` ID, sets `origin_badge='library'`, `stack_position=-1`, `allow_background_customization=1`
    - Implement `getAdminLibraryCards` — SELECT cards with ID LIKE 'admin-lib-%' AND `is_archived=0`
    - Implement `getStaticOverrides` — SELECT cards with `origin_badge='library'`, `stack_position=-1`, ID NOT LIKE 'admin-lib-%'
    - Implement `getSuppressedIds` — SELECT from `suppressed_library_cards`
    - Implement `deleteAdminCard`, `deleteStaticOverride`, `suppressStaticCard`, `unsuppressStaticCard`
    - Implement `createStaticOverride` — clone a CuratedCardDefinition into DB with same ID
    - Use SQLite transactions for multi-step writes (card + controls)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.6, 7.7_

  - [x] 2.3 Implement `getMergedLibrary` merge logic in `adminCardService`
    - Read static `CURATED_LIBRARY`, DB admin cards, static overrides, and suppression records
    - Filter out suppressed static cards
    - Replace static cards that have DB overrides (same ID)
    - Append admin-lib-* cards
    - Map DB Card objects to `CuratedCardDefinition` format using `cardToCuratedDefinition`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.4 Write property tests for `adminCardService` (Properties 1–4, 11)
    - **Property 1: Admin card creation preserves all fields with correct conventions**
    - **Property 2: Merged library includes all non-suppressed sources**
    - **Property 3: Static override replaces original in merged library**
    - **Property 4: Suppressed cards are excluded from merged library**
    - **Property 11: Admin card query returns only non-archived admin cards**
    - Create `src/services/__tests__/adminCardService.property.test.ts`
    - Use fast-check 3 with `numRuns: 100` per property
    - **Validates: Requirements 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.5, 7.1, 7.2, 7.3, 7.4**

- [x] 3. Checkpoint - Core data layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Export service extension
  - [x] 4.1 Add `serializeToCuratedDefinition` and `exportToClipboard` to export service
    - Add new functions to `src/services/exportService.ts` (or create a dedicated admin export module)
    - `serializeToCuratedDefinition(card: Card)` — produces a TypeScript literal string matching `CuratedCardDefinition` shape, including all controls, tags
    - `exportToClipboard(card: Card)` — calls serializer then `Clipboard.setStringAsync`
    - Handle clipboard copy failure gracefully with error feedback
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 Write property test for export serialization (Property 10)
    - **Property 10: Export serialization includes all required CuratedCardDefinition fields**
    - **Validates: Requirements 6.2, 6.5**

- [x] 5. Card Creator screen — admin mode UI
  - [x] 5.1 Implement triple-tap gesture on CardCreatorScreen header
    - Add a tap counter with 500ms window on the header title text
    - Three taps within 500ms toggles admin mode via `useAdminStore.toggleAdmin()`
    - Reset admin mode on screen blur (navigation `beforeRemove` or `blur` event)
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [x] 5.2 Add admin mode indicator and modified save logic
    - Show "Admin: Library Tool" indicator banner below header when `isAdminMode === true`
    - When admin mode is active, save calls `adminCardService.createLibraryCard()` instead of `cardService.create()`
    - On successful save, show confirmation message and navigate back
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.3 Support admin edit mode via navigation params
    - Read `adminEditCardId` and `adminEditSource` from route params
    - If `adminEditSource === 'static'`, call `adminCardService.createStaticOverride` then open for editing
    - If `adminEditSource === 'admin'`, load existing admin card for editing
    - Save edits via update logic (reuse existing card update path with correct ID)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 5.4 Write unit tests for triple-tap gesture and admin mode toggle
    - Test timing edge cases (taps outside 500ms window)
    - Test toggle on/off behavior
    - Test reset on navigation blur
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 6. Checkpoint - Card Creator admin mode
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Library Browser screen — admin affordances
  - [x] 7.1 Switch Library Browser data source to `getMergedLibrary`
    - Replace direct `CURATED_LIBRARY` reads with `adminCardService.getMergedLibrary()` call
    - Ensure search filter applies uniformly across all sources (title, description, category name)
    - Ensure category filter applies uniformly
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [x] 7.2 Add Edit/Delete/Export buttons in admin mode
    - Show "Edit", "Delete", and "Export" affordances on each card row when `isAdminMode === true`
    - "Edit" navigates to CardCreator with `adminEditCardId` and `adminEditSource` params
    - "Export" calls `exportService.exportToClipboard()` and shows confirmation toast
    - "Delete" shows confirmation dialog with source-specific messaging
    - _Requirements: 4.1, 5.1, 5.2, 6.1, 6.3, 6.4_

  - [x] 7.3 Implement delete confirmation and source-aware deletion logic
    - Confirmation dialog differentiates admin cards vs static cards vs static overrides
    - Admin card deletion: `adminCardService.deleteAdminCard(id)`
    - Static override deletion: `adminCardService.deleteStaticOverride(id)` (restores original)
    - Static card deletion (no override): `adminCardService.suppressStaticCard(id)`
    - Refresh library list after deletion
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 7.4 Write property tests for search, provenance, update round-trip, wallet independence, and override deletion (Properties 5–9)
    - **Property 5: Search filter applies uniformly across all library card sources**
    - **Property 6: Add-to-wallet preserves library provenance**
    - **Property 7: Update persistence round-trip**
    - **Property 8: Wallet copies are independent of library card mutations**
    - **Property 9: Override deletion restores original static version**
    - Add to `src/services/__tests__/adminCardService.property.test.ts`
    - **Validates: Requirements 3.5, 3.6, 3.8, 4.4, 4.5, 4.6, 5.4, 5.6**

- [x] 8. Final checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (11 total across tasks 2.4, 4.2, and 7.4)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementation uses the existing `@/*` path alias
- Admin mode is ephemeral (Zustand only, no persistence) — no risk of corrupt admin state
- All DB writes use SQLite transactions for atomicity

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2"] },
    { "id": 2, "tasks": ["2.3", "4.1"] },
    { "id": 3, "tasks": ["2.4", "4.2"] },
    { "id": 4, "tasks": ["5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "5.4"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4"] }
  ]
}
```
