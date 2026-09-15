# Requirements Document — Library Card Sync

## Introduction

Curated library cards are **snapshotted into the wallet when a user adds them**. A wallet card
is a full copy of the curated definition at add-time (its own `cards` row + `controls` rows,
linked back only by a `source_library_id` string). There is no live link to the evolving
library definition and no version marker.

**The problem:** when we improve a curated card in a new app version (e.g. the Box Breathing
nose/mouth clarification), users who already have that card get **nothing** — their wallet copy
is frozen at whatever it was when they added it, and they aren't told an improvement exists. The
only way to "update" today is archive → delete → re-add, which **destroys the card's history**
(completions, streaks, per-control values, reminders, custom background). This is a general
problem that affects every future curated-content improvement, not just Box Breathing.

This spec is **phased** on purpose:

- **Phase 1 (incremental, ships first):** keep the copy model, but add a way to detect that a
  wallet/archived card is out of date versus the current library definition, show the user an
  "update available" affordance, and let them apply the update **in place** — preserving all
  history. Small, safe, and solves the immediate problem with user agency (opt-in per card).
- **Phase 2 (north-star, later):** move library cards to a **reference model** — the wallet
  stores *membership* (which library cards are in the wallet/archived, their order, and any
  per-user overrides like a custom background or reminder), and card *content* is read live from
  the curated library. Library edits then propagate automatically to wallet and archive with no
  update step. This is the cleaner long-term architecture but a substantial migration.

The two phases share the same goal (users benefit from curated improvements without losing
history) and the same detection/diff building blocks. Phase 1 is a stepping-stone that delivers
value immediately; Phase 2 can supersede it when we're ready to invest in the migration.

Stack context (per steering): React Native 0.81 / Expo SDK 54, bare workflow, Zustand 5, SQLite
via `expo-sqlite`. There is **no OTA** — curated cards ship with the app binary, so any of this
only takes effect in a build the user installs.

## Background: how it works today (verified)

- **Add = snapshot.** `LibraryBrowserScreen.handleAddToWallet` / `handlePreviewAddToWallet` call
  `cardService.create(shell, controls, originBadge, categoryId, sourceLibraryId=card.id)`. The
  wallet card gets a fresh random UUID; each control gets a fresh random UUID. The only link back
  to the curated definition is `cards.source_library_id` (nullable; added via migration).
- **No version / hash / updatedAt** on `CuratedCardDefinition` (`src/data/curatedLibrary.ts`).
  The only stable identifier is the string `id` (e.g. `lib-box-breathing`).
- **Wallet library/app cards are read-only** for content (`CardKebabMenu`: `isEditable` is only
  `my_tool`). The single allowed user modification is a **custom background** stored separately
  in `background_overlays` (gated by `allowBackgroundCustomization`).
- **History is attached to ids.** `completions`, `reminders`, `emotion_tags`,
  `card_context_tags`, `card_time_tags`, `background_overlays` reference `cards(id)` (ON DELETE
  CASCADE). `control_values` reference `controls(id)` AND `completions(id)` (ON DELETE CASCADE).
  `total_uses` / `current_streak` / `last_used_at` live on the `cards` row. `outcome_responses`
  and `duration_records` store `card_id` loosely (no FK).
- **Control replacement today is delete-and-reinsert** (`CardCreatorScreen.performSave`:
  `DELETE FROM controls WHERE card_id=?` then re-insert with fresh UUIDs). Applied to a card with
  history, this **cascades and destroys `control_values`** tied to the old control ids — the key
  data-integrity trap for any in-place update.
- **Existing diff logic** (admin Draft/Stale in `LibraryBrowserScreen.loadMergedLibrary` and
  `adminCardService.isOverrideMatchingStatic`) compares a DB row to the static definition, but
  keys on **id-equality with the static id**, which is only true for admin override rows. Wallet
  copies have random UUIDs, so that logic can't be reused as-is; detection must go through
  `source_library_id`.

## Requirements

### Phase 1 — Detect + apply library updates in place (keeps the copy model)

#### Requirement 1: Version marker on curated cards

**User Story:** As the app author, I want each curated card to carry a version I bump when I
change it, so that the app can reliably tell an installed copy is out of date.

##### Acceptance Criteria

1. `CuratedCardDefinition` SHALL gain a `version` integer (starting at 1). It is bumped by 1
   whenever the curated card's user-visible content (shell, controls, or rationale) is edited.
2. WHEN a wallet card is created from a curated definition, THE app SHALL persist the curated
   card's current `version` on the wallet card (a new nullable `source_library_version` column),
   so a later comparison knows what version the copy was made from.
3. THE version SHALL be the source of truth for "is this copy out of date": a wallet/archived
   card is **outdated** when its stored `source_library_version` is less than the current
   `version` of the curated card with the same `source_library_id`.
4. WHEN a wallet card has no `source_library_id` (older copies, `my_tool`, community), THE app
   SHALL treat it as **not updatable** (no false "update available"), degrading gracefully.
5. A steering rule SHALL require bumping a curated card's `version` whenever its content changes
   (paired with the existing admin export workflow), so detection never silently misses an edit.

#### Requirement 2: Surface "update available" on an outdated card

**User Story:** As a user with a library card in my wallet, I want to know when the app has an
improved version of that tool, so that I can choose to get the update.

##### Acceptance Criteria

1. WHEN a wallet card is outdated (Req 1.3), THE focused card view SHALL show a clear,
   non-intrusive "Update available" affordance (e.g. a pill near the origin badge).
2. THE affordance SHALL be discoverable the first time the user opens/focuses the card after the
   app updated, and SHALL NOT block normal use of the card.
3. TAPPING the affordance SHALL open a summary of what updating does (plain language: "we've
   improved this tool; updating keeps all your history") and offer **Update** and **Not now**.
4. "Not now" SHALL dismiss without updating; the affordance MAY reappear on a later open (the
   card is still outdated) but SHALL NOT nag repeatedly within a session.
5. THE affordance SHALL only appear for cards that are actually updatable (has
   `source_library_id`, curated card still exists, and is outdated) — never for `my_tool`,
   community, or cards whose library definition was removed.
6. Archived outdated cards MAY show the affordance when viewed in the Archive, or MAY defer the
   update until restore; the chosen behavior SHALL be explicit and SHALL NOT lose history.

#### Requirement 3: Apply the update in place, preserving all history

**User Story:** As a user who taps Update, I want the tool refreshed to the latest version while
keeping my streak, usage history, reminder, and custom background, so that I lose nothing.

##### Acceptance Criteria

1. Applying an update SHALL refresh the wallet card's content (shell fields, controls, category,
   and rationale linkage) to the current curated definition, in place on the **same `cards.id`**.
2. THE card's stats SHALL be preserved: `total_uses`, `current_streak`, `last_used_at`,
   `stack_position`, `created_at`. Applying an update SHALL NOT reset the streak or usage count.
3. Historical completion data SHALL be preserved: existing `completions` and their
   `control_values` SHALL NOT be deleted or orphaned by the control refresh. (The naive
   delete-and-reinsert-controls pattern is explicitly disallowed here because
   `control_values.control_id` cascades — see design for the history-preserving strategy.)
4. THE user's **custom background** (`background_overlays`) SHALL be preserved across the update.
5. THE card's **reminder** SHALL be preserved across the update (time/frequency and active
   state), rescheduling if the update changes anything that affects notification content
   (e.g. title), consistent with how reminders are managed elsewhere.
6. AFTER applying, THE card's stored `source_library_version` SHALL be set to the current curated
   version, so it is no longer flagged outdated.
7. IF applying an update fails, THE card SHALL be left in its previous, consistent state (no
   partial refresh), and the user SHALL be informed.
8. Applying an update SHALL be idempotent-safe: applying when already current is a no-op.

#### Requirement 4: Update available surfaces are consistent

**User Story:** As a user, I want the update state to be accurate wherever a card is shown, so it
isn't confusing.

##### Acceptance Criteria

1. Per the card-display-surfaces steering, the "update available" state and the applied result
   SHALL be reflected on the relevant surfaces (at minimum FocusedCardView; the library browser
   MAY indicate a wallet card is outdated). Surfaces where it doesn't fit (collapsed stack,
   compact rows) MAY omit it.
2. After an update is applied, all surfaces SHALL reflect the new content immediately (reload the
   wallet/card state), with no stale copy shown.

### Phase 2 — Reference model (north-star; automatic propagation)

> Phase 2 is the target architecture, captured here so the better end-state is designed, not
> discovered later. It can supersede Phase 1. It is a substantial migration and is expected to
> ship well after Phase 1 (and after 1.0.x).

#### Requirement 5: Library cards are referenced, not copied

**User Story:** As a user, I want curated tools to always reflect the latest version everywhere
they appear (library, wallet, archive), so that improvements reach me automatically without any
"update" step.

##### Acceptance Criteria

1. FOR library/app-origin cards, the wallet SHALL store **membership** (that the card is in the
   wallet or archived, its stack position, added/archived timestamps) keyed by the curated
   `source_library_id`, NOT a full content copy.
2. Card **content** (shell, controls, rationale) for a referenced card SHALL be read live from
   the current `CURATED_LIBRARY` at render/use time, so a new app version's edits apply
   automatically to wallet and archive with no user action.
3. Per-user **overrides** on a referenced card (currently: custom background; potentially:
   reminder) SHALL be stored in a sparse overrides layer keyed by `source_library_id` and
   composited over the live content, so personalization survives content updates.
4. `my_tool` and community cards (which have no library definition) SHALL remain full stored
   copies; the wallet assembly SHALL merge referenced library cards and stored custom cards into
   one ordered list.
5. WHEN a curated card is removed from the library in a new version, a referenced card already in
   a user's wallet SHALL degrade gracefully (defined in design: e.g. become a read-only orphaned
   snapshot or be archived), and SHALL NOT crash or vanish silently mid-session.

#### Requirement 6: History survives the reference migration

**User Story:** As an existing user, I want my current wallet, history, streaks, reminders, and
custom backgrounds intact after the app moves to the reference model, so that upgrading costs me
nothing.

##### Acceptance Criteria

1. A one-time migration SHALL convert existing copied library/app wallet cards into membership +
   overrides, preserving `total_uses`, `current_streak`, `last_used_at`, order, archived state,
   reminders, custom backgrounds, and historical completions/analytics associations.
2. Completion history and per-completion values SHALL remain queryable after the migration
   (design decides whether history keys on the curated id or a stable membership id, and how
   `control_values` are addressed when controls no longer have per-copy DB rows).
3. The migration SHALL be safe and reversible enough to ship confidently (idempotent, guarded,
   verified on realistic data), consistent with the app's existing migration approach.

#### Requirement 7: Update agency in the reference model

**User Story:** As a user who relies on a tool daily, I don't want its steps to change under me
without any awareness.

##### Acceptance Criteria

1. THE design SHALL address whether referenced-card updates are fully silent or still surface a
   lightweight "this tool was updated" note, so a habit-forming tool doesn't change with zero
   signal. (Product decision recorded in design; the reference model defaults to automatic, but
   a non-blocking "what changed" note is the likely compromise.)

## Out of Scope

- OTA content delivery. All content ships with the app binary; this spec is about how
  binary-shipped edits reach existing users' cards, not about pushing content between builds.
- Letting users edit the content (controls) of library cards (they remain read-only aside from
  the existing custom-background personalization).
- Community-submission syncing (community cards are user/third-party content, not curated).
- Any change to `my_tool` (user-created) cards' storage — they stay full stored copies in both
  phases.

## Phasing / dependency

- Phase 1 (Req 1–4) is independent and shippable on its own; it keeps the current copy model and
  adds versioning + in-place update. Recommended after the current 1.0.4 release train.
- Phase 2 (Req 5–7) is the architectural end-state; it reuses Phase 1's version/detection concepts
  but replaces the copy model with references + membership + overrides. It supersedes Phase 1's
  "update available" flow (updates become automatic). Ship only when there's appetite for the
  migration and the wider blast radius (card assembly, wallet store, reminders, completions/
  control_values, every display surface).

## Traceability (implementation anchors)

- Copy-on-add: `src/screens/LibraryBrowserScreen.tsx` `handleAddToWallet` / `handlePreviewAddToWallet`;
  `src/services/cardService.ts` `create` (snapshots shell+controls, sets `source_library_id`).
- Version marker: `src/data/curatedLibrary.ts` `CuratedCardDefinition` (add `version`);
  `src/data/migrations.ts` `cards` (add `source_library_version`); `cardService.create` (persist it).
- Detection/diff: reuse the field-by-field comparison style from
  `adminCardService.isOverrideMatchingStatic` and `LibraryBrowserScreen.loadMergedLibrary`, but
  match wallet cards via `source_library_id` (not id-equality). Curated lookup by
  `sourceLibraryId` already exists in `FocusedCardView.tsx`.
- History-preserving update: `src/services/cardService.ts` (new update-from-library method);
  tables from `src/data/migrations.ts` (`completions`, `control_values`, `reminders`,
  `background_overlays`, `emotion_tags`, `card_context_tags`, `card_time_tags`). AVOID the
  delete-and-reinsert-controls pattern in `CardCreatorScreen.performSave` for cards with history.
- Update UI: `src/components/wallet/FocusedCardView.tsx` (origin-badge area; already looks up the
  curated def via `sourceLibraryId`); `src/components/wallet/CardKebabMenu.tsx` (an "Update from
  library" action could live here too).
- Reminders preserved: `src/services/reminderService.ts` (`disableForCard`/`reactivateForCard`/
  `scheduleNotification`).
