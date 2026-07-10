# Card Display Surfaces

All places where a tool/card is displayed to users or admins. When adding new card metadata (like rationale), updating card rendering, or changing card content, ALL relevant surfaces must be updated.

## User-Facing Surfaces

### 1. Wallet — FocusedCardView
- **File**: `src/components/wallet/FocusedCardView.tsx`
- **Context**: Main wallet screen, card is tapped and expanded
- **Shows**: Icon, title, description, origin badge, stats, controls (when expanded)
- **Rationale**: "Learn more" inline in description text (via `RationaleEntryPoint`). Looks up rationale from `CURATED_LIBRARY` using `card.sourceLibraryId`.
- **Notes**: Hidden when expanded into active use. Uses `useMemo` to find curated card definition.

### 2. Library Browser — CardPreviewSheet
- **File**: `src/components/wallet/CardPreviewSheet.tsx`
- **Context**: User taps a card in the Library Browser to preview before adding
- **Shows**: Full card shell, controls (read-only), "Add to wallet" / "In wallet" button
- **Rationale**: "Learn more" inline in description text. Reads `card.rationale?.inANutshell` directly from the `CuratedCardDefinition` prop.
- **Notes**: Receives `CuratedCardDefinition` from `getMergedLibrary` results.

### 3. Emotion Session — LibraryToolPreview
- **File**: `src/components/session/LibraryToolPreview.tsx`
- **Context**: User taps a recommended tool during an emotion session to preview/try it
- **Shows**: Card shell, controls (interactive), "Add to my wallet" button
- **Rationale**: "Learn more" inline in description text. Reads from `card.rationale` directly.
- **Notes**: Receives full `CuratedCardDefinition` including rationale.

### 4. Emotion Session — ToolPreviewCard (compact)
- **File**: `src/components/session/ToolPreviewCard.tsx`
- **Context**: Compact card row in the session recommendation list ("From your wallet" / "Suggested tools to try")
- **Shows**: Icon, title, truncated description, "Add to wallet" link
- **Rationale**: NOT shown here (too compact). "Learn more" only appears when the user taps to open `LibraryToolPreview`.
- **Notes**: Receives minimal props from `ToolRecommendation` interface (no rationale data needed).

### 5. Wallet — Stacked/Collapsed Cards
- **File**: `src/components/wallet/StackedCardList.tsx` (or similar)
- **Context**: Cards shown as a stack in the wallet, only top edge visible
- **Shows**: Title, icon hint, background color
- **Rationale**: NOT shown (no room)

### 6. Archive Screen
- **File**: `src/screens/ArchiveScreen.tsx`
- **Context**: Archived cards list
- **Shows**: Title, description, last used date
- **Rationale**: NOT shown

## Admin-Only Surfaces

### 7. Library Browser — Admin Card List
- **File**: `src/screens/LibraryBrowserScreen.tsx`
- **Context**: Admin mode in Library Browser (triple-tap activated)
- **Shows**: Card title, description, category, Edit/Export/Delete buttons, Draft badge, Stale badge
- **Notes**: Draft badge logic compares DB override against static source (shell + controls + rationale). Stale badge detects when static source was updated after override was saved.

### 8. CardCreatorScreen — Steps 1-3 (Shell, Controls, Preview)
- **File**: `src/screens/CardCreatorScreen.tsx`, `src/components/creator/Step1Shell.tsx`, `Step2Controls.tsx`, `Step3Preview.tsx`
- **Context**: Creating or editing a card (user or admin)
- **Notes**: In admin mode, Step 3 button says "Next: Rationale" instead of "Save".

### 9. CardCreatorScreen — Step 4 (Rationale, Admin only)
- **File**: `src/components/creator/Step4Rationale.tsx`, `src/components/creator/RationaleFormSection.tsx`
- **Context**: Admin editing rationale metadata for library cards
- **Shows**: Approach picker, in-a-nutshell, how-it-works, evidence level, research summary, learn more links
- **Notes**: Only visible in admin mode (4 steps total vs 3 for regular users).

### 10. RationaleSheet (Bottom Sheet Modal)
- **File**: `src/components/rationale/RationaleSheet.tsx`
- **Context**: Opened from any "Learn more" link in the description
- **Shows**: Title, "In a nutshell", "How it works", evidence badge, "What we know from research" bullets, crisis resources callout (distress cards), "Further reading" links
- **Notes**: Scroll-based content. Dismiss via handle swipe, close button, or backdrop tap.

## Data Flow Summary

### How rationale reaches each surface:
1. **FocusedCardView** → `CURATED_LIBRARY.find(c => c.id === card.sourceLibraryId)?.rationale`
2. **CardPreviewSheet** → `card.rationale` (from `CuratedCardDefinition` prop, via `getMergedLibrary`)
3. **LibraryToolPreview** → `card.rationale` (from `CuratedCardDefinition` prop, via `SessionLauncherContent` state)
4. **Admin edit (Step 4)** → DB columns on `cards` table, loaded by `loadRationaleForCard`, falls back to static `CURATED_LIBRARY`
5. **Export** → DB columns, falls back to `CURATED_LIBRARY` static rationale

### Key type: `CuratedCardDefinition`
- Defined in `src/data/curatedLibrary.ts`
- Includes optional `rationale?: RationaleMetadata`
- When adding new metadata fields to cards, extend this type AND update `cardToCuratedDefinition` in `adminCardService.ts`

## Checklist for Adding New Card Metadata

When introducing a new field to cards:
1. Add to `CuratedCardDefinition` interface
2. Add to `RationaleMetadata` type (if rationale-related) or create new type
3. Populate in `CURATED_LIBRARY` static data
4. Add DB migration columns
5. Update `cardToCuratedDefinition` to carry the field from static source
6. Update `loadRationaleForCard` to load from DB with static fallback
7. Update `serializeToCuratedDefinition` for export
8. Update `validateExportReadiness` if the field is required for export
9. Update Draft detection (dirty check in `LibraryBrowserScreen`)
10. Update Stale detection if the field can diverge between DB and static
11. Add to admin form (Step 4 or wherever appropriate)
12. Add to each display surface where it should be visible
13. Update the admin-editing steering doc
