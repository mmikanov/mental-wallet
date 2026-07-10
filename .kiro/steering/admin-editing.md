# Admin Library Tool Editing

## Architecture

### Static vs Override Cards
- **Static cards** live in `src/data/curatedLibrary.ts` as a typed array (`CURATED_LIBRARY`). They are read-only at runtime.
- **Override cards** are DB rows with the same ID as a static card. They're created via `createStaticOverride()` when an admin first edits a static card.
- The merged library (`getMergedLibrary`) replaces static cards with their override version when one exists.
- Admin-created cards use IDs prefixed with `admin-lib-`.

### Draft Detection
- A card is considered "draft" (shows the Draft badge in admin mode) if its DB state **differs** from its static original.
- The comparison includes: shell fields (title, description, icon, background, category), controls (type, position, config, isRequired), AND rationale metadata.
- **Key rule**: If the admin edits a field and then reverts it to match the static original exactly, the Draft badge must disappear. Diffs are always computed against the static source of truth.
- Rationale is compared field-by-field: approach, inANutshell, howItWorks, evidenceLevel, researchSummary (JSON stringified).

### Override Lifecycle
- Overrides are created on first admin edit of a static card (`createStaticOverride`).
- Overrides persist until explicitly deleted by the admin (via the Delete action in the library).
- **Never auto-delete overrides** — the old auto-cleanup pattern (deleting overrides that match their static original) caused data loss for rationale-only edits. Overrides are now preserved indefinitely.
- After the admin exports a card and updates `curatedLibrary.ts` in the codebase, the override becomes redundant. The admin should manually delete it via the UI.
- **Stale detection**: When `curatedLibrary.ts` is updated but a DB override still has old rationale data, the card shows a red "Stale" badge. This tells the admin to delete the override so the latest static data takes effect. Stale = DB rationale differs from static rationale (any field including learnMoreLinks).

## CardCreatorScreen Flow

### Step Count
- Regular users: **3 steps** (Shell → Controls → Preview & Save)
- Admin mode: **4 steps** (Shell → Controls → Preview → Rationale & Save)
- The step indicator and header dynamically show the correct total.
- If admin mode is toggled off while on Step 4, clamp to Step 3.

### Step 3 Behavior (Admin)
- In admin mode, Step 3's button says "Next: Rationale" instead of "Save"
- Pressing it advances to Step 4 (does not save yet)

### Step 4 (Admin Only)
- Contains `RationaleFormSection` with fields: approach, inANutshell, howItWorks, evidenceLevel, researchSummary, learnMoreLinks
- Save button at the bottom persists all data (shell, controls, emotion tags, AND rationale)

### Rationale Persistence
- Rationale is stored in 6 nullable columns on the `cards` table: `rationale_approach`, `rationale_in_a_nutshell`, `rationale_how_it_works`, `rationale_evidence_level`, `rationale_research_summary` (JSON), `rationale_learn_more_links` (JSON)
- On save, rationale is written via a separate `UPDATE` after the controls transaction completes.
- Use a **ref** (`rationaleDataRef`) to avoid stale closure issues in `useCallback` chains. The ref is synced with state on every render.

### Loading Rationale on Edit
- `loadRationaleForCard(cardId, curatedCard?)` checks DB first. If DB rationale columns are NULL, falls back to the static `curatedCard.rationale`.
- This ensures the form is pre-populated correctly whether the admin previously saved rationale to DB or not.

## State Update Batching
- In `loadMergedLibrary`, all state updates (`setLibraryCards`, `setOverrideIds`, `setDirtyOverrideIds`) must happen **together** after all async work completes.
- Setting `setLibraryCards` early (before dirty computation finishes) causes intermediate renders where the Draft badge is missing.
- Rule: compute everything first, then batch all `setState` calls at the end.

## Export Service
- `serializeToCuratedDefinition` reads rationale from DB. If DB columns are NULL, it falls back to `CURATED_LIBRARY` static rationale.
- `validateExportReadiness` blocks export if any required rationale field is missing.
- The export output includes the `rationale: { ... }` block in the TypeScript literal.

## Key Lessons / Pitfalls
1. **Never auto-delete override rows** — rationale-only edits are invisible to shell/controls comparison.
2. **Batch state updates** — intermediate renders cause UI flicker and missing badges.
3. **Use refs for form data in save callbacks** — `useCallback` closures capture stale state; refs always give the latest value.
4. **Compare against static source of truth** — Draft status is determined by diff, not by mere existence of DB data.
5. **Admin mode is Zustand-based** — it persists across screen navigations within a session but resets on screen blur for CardCreator. The Library screen has its own triple-tap activation.
6. **`createStaticOverride` is idempotent-ish** — it tries INSERT, swallows duplicate key errors. The existing row (with any rationale data) is preserved.
