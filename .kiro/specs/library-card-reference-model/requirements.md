# Requirements Document

**Feature:** Library Card Reference Model (Phase 2)

## Introduction

This is the **north-star / Phase 2** successor to the `library-card-sync` spec. Phase 1
(`library-card-sync`) keeps the current copy-on-add model and adds versioning + an opt-in,
in-place "update available" flow so users can pull curated improvements without losing history.
Phase 2 replaces that copy model entirely with a **reference model**, so curated improvements
propagate automatically and there is no per-card "update" step at all.

**Why this exists as its own spec:** it is a substantial architectural migration with a wide
blast radius (card assembly, wallet store, reminders, completions/`control_values`, every card
display surface). It is expected to ship well after Phase 1 (and after the 1.0.x line). Splitting
it out keeps Phase 1 clean and shippable while the end-state stays designed rather than
discovered later.

**Relationship to Phase 1:** Phase 2 reuses Phase 1's version/detection concepts but supersedes
its user-facing "update available" flow — under the reference model, updates become automatic
(with, at most, a lightweight "what changed" note). Ship Phase 2 only when there is appetite for
the migration and its blast radius.

**Prerequisite reading:** the `library-card-sync` (Phase 1) spec, especially its
"Background: how it works today (verified)" section, which documents the current copy-on-add
model, the id-attached history, and the `control_values` cascade trap. That background applies
equally here and is not duplicated in full.

Stack context (per steering): React Native 0.81 / Expo SDK 54, bare workflow, Zustand 5, SQLite
via `expo-sqlite`. There is **no OTA** — curated cards ship with the app binary, so any of this
only takes effect in a build the user installs.

## Requirements

### Requirement 1: Library cards are referenced, not copied

**User Story:** As a user, I want curated tools to always reflect the latest version everywhere
they appear (library, wallet, archive), so that improvements reach me automatically without any
"update" step.

#### Acceptance Criteria

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

### Requirement 2: History survives the reference migration

**User Story:** As an existing user, I want my current wallet, history, streaks, reminders, and
custom backgrounds intact after the app moves to the reference model, so that upgrading costs me
nothing.

#### Acceptance Criteria

1. A one-time migration SHALL convert existing copied library/app wallet cards into membership +
   overrides, preserving `total_uses`, `current_streak`, `last_used_at`, order, archived state,
   reminders, custom backgrounds, and historical completions/analytics associations.
2. Completion history and per-completion values SHALL remain queryable after the migration
   (design decides whether history keys on the curated id or a stable membership id, and how
   `control_values` are addressed when controls no longer have per-copy DB rows).
3. The migration SHALL be safe and reversible enough to ship confidently (idempotent, guarded,
   verified on realistic data), consistent with the app's existing migration approach.

### Requirement 3: Update agency in the reference model

**User Story:** As a user who relies on a tool daily, I don't want its steps to change under me
without any awareness.

#### Acceptance Criteria

1. THE design SHALL address whether referenced-card updates are fully silent or still surface a
   lightweight "this tool was updated" note, so a habit-forming tool doesn't change with zero
   signal. (Product decision recorded in design; the reference model defaults to automatic, but
   a non-blocking "what changed" note is the likely compromise.)

## Out of Scope

- Phase 1 itself (versioning + opt-in in-place update on the copy model) — that is the separate
  `library-card-sync` spec, which this supersedes once shipped.
- OTA content delivery. All content ships with the app binary.
- Letting users edit the content (controls) of library cards (they remain read-only aside from
  the existing custom-background personalization).
- Community-submission syncing (community cards are user/third-party content, not curated).
- Any change to `my_tool` (user-created) cards' storage — they stay full stored copies.

## Dependency

- Depends conceptually on Phase 1 (`library-card-sync`) having established the curated card
  `version` marker and the detection concepts. Phase 2 replaces the copy model with
  references + membership + overrides and makes updates automatic, superseding Phase 1's
  per-card "update available" flow.

## Traceability (implementation anchors)

- Copy-on-add to replace: `src/screens/LibraryBrowserScreen.tsx` `handleAddToWallet` /
  `handlePreviewAddToWallet`; `src/services/cardService.ts` `create`.
- Wallet assembly (merge referenced library cards + stored custom cards into one ordered list):
  `src/services/cardService.ts` (`getAll`), `src/stores/walletStore.ts`.
- Live content source: `src/data/curatedLibrary.ts` (`CURATED_LIBRARY`); curated lookup by
  `sourceLibraryId` already exists in `FocusedCardView.tsx`.
- Overrides layer (custom background today): `background_overlays` table in
  `src/data/migrations.ts`; potentially reminders via `src/services/reminderService.ts`.
- History tables that must survive the migration: `completions`, `control_values`, `reminders`,
  `emotion_tags`, `card_context_tags`, `card_time_tags`, plus loose `card_id` refs in
  `outcome_responses` and `duration_records`.
- Every card display surface (per the card-display-surfaces steering) must render referenced
  content correctly.
