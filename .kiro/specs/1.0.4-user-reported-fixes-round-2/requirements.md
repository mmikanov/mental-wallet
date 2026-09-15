# Requirements Document

## Introduction

A second batch of small, user-reported fixes gathered from feedback after the
`1.0.4-user-reported-fixes` round shipped. Like that batch, these are independent items each
of which can be fixed and shipped on its own; they are grouped here only so the work is
organized and verifiable.

This spec covers **only the three reported items below**:

- **Bug 1 — Library "Preview" is hard to find.** In the Library Browser, the only visible
  preview affordance is a muted gray "Preview" word at the right edge of each card row (the
  whole row is tappable to preview). Users didn't notice it and had to be told where to look.
  Make preview an obvious secondary button next to "Add to wallet".
- **Bug 2 — Reminders keep firing for archived tools.** Setting a reminder on a tool, then
  archiving the tool, leaves the scheduled OS notifications firing. Tapping the notification
  deep-links to the wallet, but the card is archived so the wallet opens with nothing focused.
  Archiving must stop the notifications while PRESERVING the reminder definition, so restoring
  the tool re-arms the reminder.
- **Bug 3 — Box Breathing doesn't say nose vs mouth.** The Box Breathing steps say "Breathe
  IN / OUT" without telling the user whether to breathe through the nose or mouth. Make it
  clear.

Stack context (per steering): React Native 0.81 / Expo SDK 54 (New Architecture), bare
workflow, React Navigation 7, Zustand 5, SQLite via `expo-sqlite`, local notifications via
`expo-notifications`. Reminders are per-card rows in the `reminders` table; each row's
`notification_id` holds a JSON array of scheduled OS notification identifiers (one per
scheduled weekday, or one for daily).

### Bug inventory (source of truth for scope)

- **Bug 1 — Preview discoverability (Library Browser).** `LibraryBrowserScreen.tsx`
  `renderCard` makes the entire row a `TouchableOpacity` that opens the preview
  (`handleOpenPreview`), and the only visible cue is `styles.previewHintIcon` (11px, `#AEAEB2`
  gray text reading "Preview") at the row's right edge. The "Add to wallet" action is a real
  button (`getButtonStyle()` / `handlePress`) inside the row's content column.
- **Bug 2 — Archived-card reminders (real bug).** `cardService.archive(id)` flips
  `reminders.is_active = 0` via raw SQL but never cancels the scheduled OS notifications (it
  does not call `reminderService.disableForCard`, which is the function that both cancels the
  OS notifications AND flips `is_active`). `cardService.restore(id)` does not touch reminders
  at all. `reconcileRemindersOnLaunch()` only reschedules `is_active = 1` rows. Net effect: the
  OS keeps firing the archived tool's reminder, and restoring never re-arms it.
- **Bug 3 — Box Breathing copy.** The instruction text lives in
  `curatedLibrary.ts` → `lib-box-breathing` → `controls[0].config.body`
  ("1. Breathe IN for 4 seconds ..."). A second copy of the phrasing is the `A11Y_LABEL` in
  `src/components/controls/BoxBreathingAnimation.tsx`. Neither mentions nose vs mouth.

## Requirements

### Requirement 1: Make "Preview" an obvious secondary button (Bug 1)

**User Story:** As a user browsing the Library, I want an obvious way to preview a tool before
adding it, so that I don't have to hunt for a faint link.

#### Acceptance Criteria

1. EACH Library Browser card row SHALL present a clearly visible **Preview** control styled as
   a secondary button, placed next to the primary "Add to wallet" (or "In wallet" / "Restore")
   button, rather than only a muted "Preview" text hint at the row edge.
2. THE Preview button SHALL be visually subordinate to the primary action (secondary/outline
   style), so "Add to wallet" remains the primary call to action.
3. TAPPING the Preview button SHALL open the same `CardPreviewSheet` that the row tap opens
   today (via `handleOpenPreview`), with no change to the preview content.
4. THE existing whole-row tap MAY continue to open the preview (so nothing regresses for users
   who already tap the row), OR the row tap behavior MAY be adjusted so the explicit buttons
   are the primary interaction; either way, the primary "Add to wallet" button SHALL NOT
   trigger a preview, and the Preview button SHALL NOT add the card.
5. THE Preview button SHALL have an accessibility role of button and a label naming the tool
   (e.g. "Preview <title>"), and SHALL meet the app's minimum touch-target size.
6. THE change SHALL apply to the standard Library Browser rows. Admin-mode rows SHALL keep
   their existing admin action buttons (Edit/Export/Delete) working; the Preview button SHALL
   coexist with them without breaking that layout.
7. THE muted `previewHintIcon` text affordance SHALL be removed or replaced by the button so
   there are not two competing preview cues.

### Requirement 2: Archiving a tool stops its reminders but preserves them for restore (Bug 2)

**User Story:** As a user who set a reminder on a tool and then archived that tool, I want the
reminders to stop, so that I'm not nudged to use a tool that's no longer in my wallet; and if I
later restore the tool, I want its reminder to come back so I don't have to set it up again.

#### Acceptance Criteria

1. WHEN a tool with an active reminder is archived, THE app SHALL cancel all of that tool's
   scheduled OS notifications, so no further reminder notifications fire for the archived tool.
2. THE reminder DEFINITION SHALL be preserved across archiving (its time and frequency), so it
   is not lost. Archiving SHALL mark the reminder inactive (not delete it) and record enough to
   re-arm it on restore.
3. WHEN an archived tool that had a reminder is restored to the wallet, THE app SHALL re-arm
   that reminder: reschedule the OS notifications from the preserved time/frequency and mark
   the reminder active again, so it resumes reminding the user.
4. WHEN an archived tool did NOT have a reminder, restoring it SHALL NOT create one.
5. THE re-armed reminder SHALL reflect the current "discreet notifications" setting and the
   tool's current title at restore time (reminder bodies are built from those at schedule
   time), consistent with how reminders are scheduled elsewhere.
6. THE launch reconciliation (`reconcileRemindersOnLaunch`) SHALL remain correct: it SHALL NOT
   reschedule notifications for reminders that belong to archived tools (archived reminders are
   inactive and must stay silent until restore).
7. WHEN a reminder notification is tapped for a tool that is archived or missing, THE app SHALL
   continue to degrade gracefully (open the wallet without error), as it does today. (After
   this fix such taps should be rare, since archived tools no longer fire.)
8. Permanently deleting an archived tool SHALL continue to remove its reminder (the existing
   `ON DELETE CASCADE` on `reminders.card_id`), with no orphaned scheduled notifications left
   behind.

### Requirement 3: Clarify nose vs mouth breathing in Box Breathing (Bug 3)

**User Story:** As a user doing the Box Breathing exercise, I want to know whether to breathe
through my nose or mouth, so that I can follow the exercise with confidence.

#### Acceptance Criteria

1. THE Box Breathing step instructions SHALL state how to breathe (through the nose and/or
   mouth) for the inhale and exhale, in plain language, without changing the 4-4-4-4 timing or
   the number of cycles.
2. THE clarification SHALL be applied to the curated card's instruction copy
   (`curatedLibrary.ts` → `lib-box-breathing` → `controls[0].config.body`).
3. THE accessibility label of the breathing pacer animation (`BoxBreathingAnimation.tsx`
   `A11Y_LABEL`) SHALL be updated to match, so the spoken guidance and the written steps agree.
4. THE guidance SHALL be a reasonable, commonly recommended default for box breathing (e.g.
   inhale through the nose, exhale through the nose or mouth) stated as gentle guidance, not a
   medical instruction, consistent with the app's non-clinical tone.
5. THE change SHALL be copy-only: it SHALL NOT alter the card's controls structure (the
   `breathing_animation` control SHALL remain), timing, category, rationale, or evidence.
6. It is understood and acceptable that, because curated cards ship with the app build (no OTA)
   and wallet copies are snapshotted when added, only newly added copies of Box Breathing get
   the clarified text; existing wallet copies keep their old text. No migration of existing
   wallet copies is required.

## Out of Scope

- Any redesign of the Library Browser beyond adding the Preview secondary button (Bug 1 is a
  targeted discoverability fix).
- Changing the reminder data model or scheduling engine beyond what's needed to cancel on
  archive and re-arm on restore (Bug 2 reuses the existing `reminders` table and
  `reminderService`/`notificationService`).
- Retroactively updating Box Breathing copy in tools already sitting in users' wallets (no OTA;
  Bug 3 updates the curated source only).
- Adding new breathing patterns, nose/mouth toggles, or configurability to Box Breathing.

## Notes / Traceability (implementation anchors)

- Bug 1: `src/screens/LibraryBrowserScreen.tsx` `renderCard` (row `TouchableOpacity` +
  `handleOpenPreview`; the Add-to-wallet `TouchableOpacity` via `getButtonStyle()`/`handlePress`;
  the muted `previewHint`/`previewHintIcon` styles). Preview sheet already wired via
  `CardPreviewSheet` + `handleOpenPreview`/`handleDismissPreview`.
- Bug 2: `src/services/cardService.ts` `archive(id)` (flips `reminders.is_active=0` via raw SQL,
  does NOT cancel OS notifications) and `restore(id)` (ignores reminders); `src/services/
  reminderService.ts` `disableForCard(cardId)` (already cancels OS notifications + flips
  is_active — the correct helper archive should use), `scheduleNotification(reminder)`
  (re-arm path), `reconcileRemindersOnLaunch()` (only `is_active=1`), `mapRowToReminder`,
  `parseNotificationIds`/`cancelNotificationIds`; `src/services/notificationService.ts`
  `scheduleLocal`/`cancelScheduled`; `reminders` schema in `src/data/migrations.ts`
  (`notification_id` = JSON array, `ON DELETE CASCADE`); deep-link degradation in
  `src/screens/WalletScreen.tsx` (focus resolver skips archived cards). Restore is triggered
  from `src/screens/ArchiveScreen.tsx` `handleRestore` and `LibraryBrowserScreen.tsx`
  `handleRestoreFromArchive` / `handlePreviewRestore`; archive from `WalletScreen.tsx`
  `handleArchive`. NOTE: screens call `cardService` directly (no walletStore wrapper), so the
  archive/restore reminder behavior should live in `cardService` (or a small coordinating
  helper it calls) to cover all trigger sites at once.
- Bug 3: `src/data/curatedLibrary.ts` `lib-box-breathing` `controls[0].config.body`;
  `src/components/controls/BoxBreathingAnimation.tsx` `A11Y_LABEL`. Guard test
  `src/data/__tests__/boxBreathingVisual.test.ts` requires the `breathing_animation` control to
  remain.
