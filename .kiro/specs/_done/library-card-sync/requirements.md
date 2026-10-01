# Requirements Document

**Feature:** Library Card Sync (Phase 1)

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

**This spec is Phase 1** and is designed to ship on its own: keep the copy model, but add a way
to detect that a wallet/archived card is out of date versus the current library definition, show
the user an "update available" affordance, and let them apply the update **in place** —
preserving all history. Small, safe, and solves the immediate problem with user agency (opt-in
per card).

The longer-term **reference model** (membership + live content + overrides, with automatic
propagation and no per-card update step) is the north-star successor and lives in its own spec:
`library-card-reference-model` (Phase 2). The two share the same goal (users benefit from curated
improvements without losing history) and the same version/detection building blocks; Phase 2 can
supersede this flow when there is appetite for that migration. This spec does not depend on
Phase 2 and should not wait for it.

**Scope also includes the built-in Daily Check-in tool.** The 🌱 check-in tool is seeded by
`kpiService.ts` during onboarding rather than added from the library, but it carries
`source_library_id = 'lib-personal-kpi'`, so the same version marker + detection + in-place
update mechanism is intended to apply to it. Wherever this spec says "library card," read it as
"any wallet card with a `source_library_id`," which includes the check-in tool. (The original
spec assumed the check-in tool was already covered by the general mechanism, but its definition
lives outside the curated library so detection could not actually see it; the specific mechanism
that closes that gap — and how the tool's personalized label is preserved on update — is defined
in Requirements 6 and 7.)

**First content change that will exercise this (from the `1.0.5-fixes` spec).** 1.0.5 converts
several single-line note/reflective fields to multi-line (`text_area`), including the check-in
tool's "Anything you want to note?" field. Those changes ship to **new** copies in 1.0.5 only;
they are the first concrete edit that should bump a curated card's `version` (Req 1) and drive
the "update available" flow so **existing** copies can opt in — the motivating first use case
for this spec.

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

### Requirement 1: Version marker on curated cards

**User Story:** As the app author, I want a curated card to carry a version only once I change
it, so that the app can tell an installed copy is out of date — without me having to stamp a
version on every card that never changed.

**Model (null-aware, opt-in versioning):** a curated card is **unversioned** (no `version`)
until the first time its user-visible content changes; that first change sets `version: 1`, and
each subsequent change bumps it by 1. A wallet copy stores whatever version the curated card had
when the copy was made (which may be **none**). "Outdated" is asserted **only** when the curated
side now carries a numbered version that is ahead of the copy. This means untouched cards never
generate update prompts, and a card only "starts having versions" in the app release that first
changes it — existing installs' copies of it become outdated at exactly that point, not before.

#### Acceptance Criteria

1. `CuratedCardDefinition` SHALL gain an **optional** `version` integer. A card that has never
   changed since versioning was introduced SHALL have **no** `version` (absent/null). THE first
   change to a card's user-visible content (shell, controls, or rationale) SHALL set
   `version: 1`; each subsequent change SHALL bump it by 1.
2. WHEN a wallet card is created from a curated definition, THE app SHALL persist the curated
   card's **current** version on the wallet card (a new nullable `source_library_version`
   column). IF the curated card is unversioned at add-time, the stored value SHALL be null.
3. A wallet/archived card SHALL be considered **outdated** IF AND ONLY IF all of the following
   hold: it has a `source_library_id`; a curated card with that id still exists; that curated
   card's `version` is **non-null**; AND the copy's stored `source_library_version` is either
   null OR less than the curated card's `version`. (A null copy-version means "predates this
   card's versioning" — it is outdated only when the curated side is now versioned.)
4. THE following SHALL be treated as **not updatable** (never show "update available"),
   degrading gracefully:
   a. a card with no `source_library_id` (older pre-`source_library_id` copies, `my_tool`,
      community) — there is no link to a curated definition to compare against;
   b. a card whose curated definition is **unversioned** (never changed) — even though the copy
      may have a null version, there is nothing newer to offer, so no prompt appears;
   c. a card whose curated definition no longer exists (removed in a later release).
5. A null `source_library_version` on the copy SHALL NOT by itself mean "up to date." It means
   the copy predates this card's versioning; whether it is outdated depends solely on whether the
   curated side is now versioned (Req 1.3). This is what lets existing installs pick up a card's
   **first** change after they update to a build that made that change.
6. A steering rule SHALL require setting/bumping a curated card's `version` whenever its content
   changes (paired with the existing admin export workflow), so detection never silently misses
   an edit. Cards left unchanged SHALL be left unversioned (do not mass-assign `version: 1`).

### Requirement 2: Surface "update available" on an outdated card

**User Story:** As a user with a library card in my wallet, I want to know when the app has an
improved version of that tool, so that I can choose to get the update.

#### Acceptance Criteria

1. WHEN a wallet card is outdated (Req 1.3), THE focused card view SHALL show a clear,
   non-intrusive "Update available" affordance (e.g. a pill near the origin badge).
2. THE affordance SHALL be discoverable the first time the user opens/focuses the card after the
   app updated, and SHALL NOT block normal use of the card.
3. TAPPING the affordance SHALL open a confirmation that reassures the user their history is kept
   (plain language: "updating keeps all your history — your streak, past entries, reminder, and
   custom background stay"), with what actually changed on this specific tool conveyed by the
   per-tool summary (see Requirement 8.5), and SHALL offer **Update** and **Not now**.
4. "Not now" SHALL dismiss without updating; the affordance MAY reappear on a later open (the
   card is still outdated) but SHALL NOT nag repeatedly within a session.
5. THE affordance SHALL only appear for cards that are actually updatable (has
   `source_library_id`, curated card still exists, and is outdated) — never for `my_tool`,
   community, or cards whose library definition was removed.
6. THE Archive SHALL NOT surface the "update available" affordance. The Archive screen only
   lists archived cards with Restore and Delete actions and has no card detail/focus view
   where the affordance could appear, so no archive-specific UI is needed. An archived card
   that is outdated SHALL simply have the update become available in the normal way (Req 2.1)
   once it is **restored** to the wallet. Restoring SHALL NOT lose history, and SHALL NOT
   silently apply the update — the user still opts in from the wallet after restore.

### Requirement 3: Apply the update in place, preserving all history

**User Story:** As a user who taps Update, I want the tool refreshed to the latest version while
keeping my streak, usage history, reminder, and custom background, so that I lose nothing.

#### Acceptance Criteria

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

### Requirement 4: Update available surfaces are consistent

**User Story:** As a user, I want the update state to be accurate wherever a card is shown, so it
isn't confusing.

#### Acceptance Criteria

1. Per the card-display-surfaces steering, the "update available" state and the applied result
   SHALL be reflected on the relevant surfaces (at minimum FocusedCardView; the library browser
   MAY indicate a wallet card is outdated). Surfaces where it doesn't fit (collapsed stack,
   compact rows) MAY omit it.
2. After an update is applied, all surfaces SHALL reflect the new content immediately (reload the
   wallet/card state), with no stale copy shown.

### Requirement 5: Developer option to re-arm the update flow (for testing)

**User Story:** As a developer, I want to reset a card to its pre-update state/version, so I can
re-test the "update available" → apply flow repeatedly on one install instead of only once.

**Background:** Once a card is updated, its stored `source_library_version` is set to current
(Req 3.6), so it no longer shows "update available." Without a reset, the update flow can only be
exercised once per install per card, which makes iterating on the feature painful. We do not
retain historical curated definitions, so "previous state" is reconstructed from what's available
rather than from a stored snapshot.

#### Acceptance Criteria

1. A **developer-only** control (behind the existing `__DEV__` Developer section in Settings,
   consistent with the current dev reset actions) SHALL let the developer re-arm the update flow.
2. Re-arming SHALL put an eligible card back into the **outdated** state (Req 1.3) so the "update
   available" affordance appears again — at minimum by resetting the card's stored
   `source_library_version` to null (or below the current curated version).
3. WHERE feasible, re-arming SHALL also restore the card's **content** to a prior state so that
   re-applying the update produces a real, visible change again (not just a no-op refresh). The
   exact "prior state" source is a design decision (e.g. re-add from a pinned older definition, or
   a targeted downgrade of the fields the update changed); if a faithful content downgrade isn't
   feasible, re-arming the version marker alone is acceptable and SHALL be documented as such.
4. THE developer control SHALL scope clearly — either re-arm a specific card or all updatable
   cards — and SHALL state which it does.
5. Re-arming SHALL preserve the card's history and stats (it is a test aid, not a data wipe):
   `total_uses`, `current_streak`, `completions`/`control_values`, reminders, and custom
   background SHALL NOT be destroyed by re-arming.
6. THIS control SHALL NOT ship in production UI — it SHALL be gated to `__DEV__` (or an
   equivalent hidden developer entry point) so end users never see it.
7. Re-arming SHALL also cover the built-in check-in tool: it SHALL put the check-in tool back
   into the outdated state (reset version marker plus the targeted content downgrade of the note
   field) so the check-in update flow can be re-tested, while preserving the check-in tool's
   usage history and stats and the user's personalized "how are you doing with…" label.

### Requirement 6: The built-in check-in tool participates in the update flow

**User Story:** As a user who has the built-in Daily Check-in tool in my wallet, I want it to
receive curated improvements the same way any other library tool does, so that I benefit from
content fixes (like the multi-line note field) without losing my check-in history.

**Background:** The check-in tool is not added from the library browser — it is created for the
user automatically during onboarding — but it still carries the same kind of library identifier
as curated tools (its identifier is the check-in tool's `source_library_id`). Because its
definition is currently kept in the check-in tool's own setup code rather than alongside the
other curated tools, the update mechanism could not "see" it and therefore never offered it an
update. This requirement closes that gap so the check-in tool is treated like any other
versioned library tool, without changing where the tool appears to users.

#### Acceptance Criteria

1. THE canonical definition of the check-in tool (its content and its version) SHALL live in a
   single shared place, and the tool's initial setup and the update flow SHALL both read from
   that same definition, so the seeded tool and the update mechanism can never drift apart.
2. WHEN the shared check-in definition carries a version that is ahead of a user's copy, THE app
   SHALL detect the user's check-in tool as outdated and offer the update, exactly as it does for
   any other versioned library tool (per Requirement 1.3).
3. WHEN a user applies the update to the check-in tool, THE app SHALL refresh it in place using
   the same shared definition, preserving history in the same way as any other library tool
   (per Requirement 3).
4. ADDING the check-in tool to the update flow SHALL NOT cause it to appear in any listing where
   it does not belong today: it SHALL remain absent from the Library Browser, the tool
   recommendations, onboarding suggestions, and export listings. Bringing the check-in tool into
   the update flow SHALL NOT leak it into those library-driven listing surfaces.

### Requirement 7: The user's personalized check-in content is preserved on update

**User Story:** As a user who has personalized my check-in tool to track a specific goal, I want
an update to fix the tool's structure without erasing my personalization, so that updating never
costs me my custom wording or my history.

**Background:** The check-in tool's mood question is personalized and user-owned — it reads
"how are you doing with: {the goal the user chose}?" and the user can change the tracked goal at
any time. A curated update to the check-in tool (for example, the note field becoming multi-line)
must apply its structural improvement without overwriting that personalized question.

#### Acceptance Criteria

1. WHEN an update is applied to the check-in tool, THE app SHALL NOT overwrite the user's
   personalized mood question with a generic template.
2. AFTER the structural update is applied, THE personalized mood question SHALL be re-derived
   from the user's current tracked goal, so the question always matches the goal the user has set
   at that moment (re-derivation is authoritative — the question is neither replaced with a
   template nor merely carried over as stale text).
3. WHEN an update is applied to the check-in tool, THE version-driven structural changes (such as
   the note field becoming multi-line) SHALL still be applied.
4. WHEN an update is applied to the check-in tool, THE user's tracked-goal setting and its history
   SHALL be preserved, and the check-in tool's completions and streak SHALL be preserved,
   consistent with Requirement 3.

### Requirement 8: Prominent, persistent update notice with a per-card summary

> **This requirement REFINES the presentation described in Requirement 2** (opt-in, non-blocking,
> no-nag), based on real-device testing of the shipped Phase 1 + 1.1 flow. It does **not** change
> Requirement 2's intent. Specifically it supersedes the presentation choice in **Requirement 2.1**
> (which described "a pill near the origin badge"): that pill is replaced by a prominent top banner.
> It also corrects the behavior where the affordance disappeared once the card was expanded — the
> notice must stay visible in the expanded state too. The confirmation's reassurance copy was also
> trimmed: the redundant leading "We've improved this tool." sentence was removed from the sheet
> body because the per-tool "what changed" summary now makes the improvement explicit (the phrase
> remains only as the generic fallback line when no specific change can be described, per 8.5).

**User Story:** As a user with a library tool in my wallet, I want the "update available" notice to
be obvious and to stay visible while I use the tool, and I want the update prompt to tell me what
actually changed on this specific tool, so that I reliably notice the update and can decide whether
it's worth applying.

**Background:** In testing, three problems surfaced with the Phase 1 presentation. First, the small
"update available" pill sat among the other badges (next to the "Library" badge) and looked just
like them, so users didn't notice it. Second, the pill vanished the moment the user expanded the
tool into active use, so it was easy to miss entirely. Third, the update confirmation showed the
same generic wording for every tool and never said what actually changed, so users couldn't judge
whether to update. This requirement makes the notice a prominent banner across the top of the
focused tool, keeps it visible in both the collapsed and expanded states, and gives the
confirmation a plain-language, per-tool summary of what the update changes.

#### Acceptance Criteria

1. WHEN a wallet tool is outdated (Req 1.3), THE focused tool view SHALL present the update notice
   as a prominent banner across the top of the tool (not a small badge among the other badges), so
   the user reliably notices it.
2. THE update notice SHALL remain visible whether the tool is collapsed OR expanded — it SHALL NOT
   disappear when the user expands the tool into active use.
3. WHERE a tool can show more than one top banner at once (for example the Daily Check-in tool's
   "time since your last check-in" notice AND the update notice), THE banners SHALL stack and be
   visually distinguishable by using distinct colors: the update notice SHALL use an informational
   (blue) treatment distinct from the check-in reminder's (amber) treatment, and the update notice
   SHALL appear above the check-in reminder. Both banners SHALL remain visible.
4. WHEN the user taps the update notice banner, THE app SHALL open the update confirmation offering
   **Update** and **Not now**.
5. THE update confirmation SHALL present a plain-language, per-tool summary of what the update
   changes for the specific tool being viewed, derived from the difference between the user's copy
   and the current curated version, so the user can decide whether to update. WHERE a specific
   change cannot be described, THE confirmation SHALL fall back to a clear generic explanation.
6. THE opt-in, non-nagging behavior from Requirement 2 SHALL be preserved: "Not now" dismisses the
   confirmation without updating and SHALL NOT nag repeatedly within a session, while the banner
   SHALL remain visible because the tool is still outdated, so the user can act later.

## Out of Scope

- The **reference model** (membership + live content + overrides, automatic propagation) — that
  is the separate `library-card-reference-model` (Phase 2) spec, which supersedes this flow once
  shipped. This spec deliberately keeps the copy model.
- OTA content delivery. All content ships with the app binary; this spec is about how
  binary-shipped edits reach existing users' cards, not about pushing content between builds.
- Letting users edit the content (controls) of library cards (they remain read-only aside from
  the existing custom-background personalization).
- Community-submission syncing (community cards are user/third-party content, not curated).
- Any change to `my_tool` (user-created) cards' storage — they stay full stored copies.

## Traceability (implementation anchors)

- Copy-on-add: `src/screens/LibraryBrowserScreen.tsx` `handleAddToWallet` / `handlePreviewAddToWallet`;
  `src/services/cardService.ts` `create` (snapshots shell+controls, sets `source_library_id`).
- Version marker: `src/data/curatedLibrary.ts` `CuratedCardDefinition` (add an **optional**
  `version?: number` — present only on cards that have changed; `1` on first change, bump after);
  `src/data/migrations.ts` `cards` (add nullable `source_library_version`); `cardService.create`
  (persist the curated card's current version, which may be null). Also `src/services/kpiService.ts`
  seeds the check-in card with `source_library_id = 'lib-personal-kpi'` and must persist the
  version the same way (null until the check-in card first changes).
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
- Developer re-arm option (Req 5): add to the existing `__DEV__` Developer section in
  `src/screens/SettingsScreen.tsx` (alongside `handleResetOnboarding` / `SeedInsightsButton` /
  `AdminKpiBadgeTools`); resets `cards.source_library_version` (nullable, from the Req 1 migration)
  for the target card(s). Gated to `__DEV__`, never shown in production.

## Glossary

- **Curated tool / library tool** — a hand-authored coping tool the app ships; users add a copy to their wallet.
- **Wallet copy** — the user's own snapshot of a tool, taken when they added it. It keeps its own history (streak, past entries, reminder, custom background) and does not auto-change when we improve the original.
- **Version marker** — a number on a curated tool that we bump only when we change the tool's content. It's how the app tells that a user's copy is behind.
- **Outdated / update available** — a wallet copy whose version is behind the current curated tool's version. The app offers an in-place update that keeps history.
- **Check-in tool** — the built-in Daily Check-in ("how are you doing with your goal?") tool, created automatically during onboarding rather than added from the library, but treated like a library tool for updates (Req 6, 7).
- **Tracked goal / personalized mood question** — the user-chosen goal the check-in tool asks about ("how are you doing with: {goal}?"). It is user-owned and must survive updates (Req 7).
- **Re-arm (developer only)** — a hidden developer action that puts a tool back into the "update available" state so the update flow can be re-tested. It never deletes history (Req 5).
- **Update notice / update banner** — the prominent bar across the top of a focused tool that tells the user an improved version is available. It stays visible whether the tool is collapsed or expanded, uses an informational (blue) look distinct from the amber check-in reminder banner, and opens the update confirmation when tapped (Req 8). It replaces the earlier small "update available" pill.
- **What-changed summary** — the plain-language, per-tool list shown in the update confirmation describing what the update changes for the specific tool being viewed (e.g. "Makes the 'What's on your mind?' field bigger for longer entries"), with a generic fallback when a specific change can't be described (Req 8.5).
