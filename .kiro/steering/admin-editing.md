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

## Operator Workflow: Shipping a Card Edit to Users

Admin edits create DB overrides that only affect *your* device. To ship changes to all users:

### Steps

1. **Edit in admin mode** — Triple-tap Library title → find card → Edit → make changes (shell, controls, rationale, affiliate toggle, etc.) → Save
2. **Verify** — Preview the card in the library to confirm it looks right
3. **Export** — In admin mode, tap Export on the card → TypeScript literal copied to clipboard
4. **Paste into code** — Replace the card's entry in the appropriate source file:
   - Native library cards: `src/data/curatedLibrary.ts`
   - External app cards: `src/data/externalAppCards.ts`
5. **Bump the card's `version`** — In the same edit, set or increment the card's `version` (see "Card Versioning" below). Skipping this means existing users never get offered the improvement.
6. **Delete the DB override** — In admin mode, tap Delete → "Revert to Original" (removes the DB copy so the updated static definition takes effect)
7. **Verify again** — Confirm the card now loads from the static file (no Draft/Stale badge)
8. **Build and deploy** — `eas build` → submit to App Store / Play Store

### Affiliate Link Workflow

1. Sign up for the affiliate network → get your tracking URL
2. Admin edit the card → Step 2 (Controls) → put affiliate URL in **Fallback URL** field
3. Toggle **"Affiliate link"** switch ON (appears below fallback URL in admin mode)
4. Save → the card now shows FTC disclosure text
5. Export → paste into code → delete override → deploy

### Important Notes

- There is NO over-the-air (OTA) card update mechanism — changes ship with app builds
- Cards already in a user's wallet retain their DB copy from when they were added. Updating the static definition does NOT retroactively update wallet copies.
- The Draft badge means the DB override differs from the static source
- The Stale badge means the static source was updated but the DB override still has old data — delete the override to pick up the new static version

## Card Versioning — bump `version` whenever a curated card's content changes

**The rule:** Any change to a curated card's **user-visible content** must set or bump that
card's `version` in the curated source, in the same edit that makes the change.

User-visible content means:
- **Shell fields**: title, description, icon, background, category
- **Controls**: type, config, `isRequired`, position (adding, removing, reordering, or retyping a control all count)
- **Rationale metadata**: approach, in-a-nutshell, how-it-works, evidence level, research summary, learn-more links

How to set the number:
- **First-ever content change to a card** → set `version: 1`.
- **Each subsequent content change** → increment by 1 (`1` → `2` → `3`, …).
- **Cards whose content has NOT changed** since versioning was introduced stay **unversioned** — they have no `version` field at all. **Do NOT mass-assign `version: 1` to every card.** Only touch the cards you actually changed.

This applies to every curated card with a `source_library_id`, including the built-in Daily
Check-in tool (`lib-personal-kpi`) and external app cards in `externalAppCards.ts`.

### Also update the developer re-arm tool in the same change

Whenever you change a curated card's content and bump its `version`, you must ALSO update the
developer re-arm tool (`src/services/devReArmLibrarySync.ts`) so it can reproduce the
pre-change state for testing. Concretely: add or adjust the `WIDENED_CONTROLS` entries (or the
equivalent downgrade) so re-arm reverses your new change — e.g. for a single-line → multi-line
widening, add the `{ sourceLibraryId, position }` pair for each field you widened; for other
kinds of change, add whatever in-place downgrade reproduces the old content. This lets the
"Update available" flow be re-tested end-to-end on one install.

**Why:** the app stores NO historical curated definitions, so the dev re-arm's downgrade list
is the only record of "what the previous version looked like." If it isn't updated alongside
the content change, re-arm nulls the stored version but can't revert the content — so
re-applying the update is a silent no-op and `summarizeUpdate` shows the generic "We've
improved this tool." fallback with no visible change (the exact bug this note prevents).

### Why this matters

Users who added a card keep a frozen copy of it (see "Cards already in a user's wallet retain
their DB copy" above). The Library Card Sync "Update available" flow is the only way an
already-added card picks up a curated improvement without the user losing their history. That
flow keys entirely off `version`:

- **Forgetting to bump** → the app can't tell the user's copy is behind, so the "Update
  available" affordance never appears and users are silently stuck on the old content — the exact
  problem this feature exists to solve.
- **Spuriously bumping** (bumping when nothing user-visible changed) → users get nagged with an
  "Update available" prompt that, when applied, is a no-op refresh. It erodes trust in the prompt.

So the bump has to track real content changes precisely: bump when (and only when) the content
changed.

### Where it lives in code (context, not the rule)

The rule itself is a process rule — the numbers above are what you follow. For reference, the
mechanism is: `version?: number` on `CuratedCardDefinition` (`src/data/curatedLibrary.ts`),
`librarySyncService.evaluateOutdated` (decides a wallet copy is behind), and
`cardService.updateFromLibrary` (applies the update in place, preserving history). Detection
relies on the version number being correct — there is no content-diff fallback, which is why the
manual bump is mandatory.

### Tie-in with the export workflow

This is step 5 of "Operator Workflow: Shipping a Card Edit to Users" above. When you export an
edited card and paste it into `curatedLibrary.ts` (or `externalAppCards.ts`), bump that card's
`version` in the same edit before you delete the DB override and build. There is no OTA — the
bump only reaches users in an installed build, so it must ship with the content change it
describes.
