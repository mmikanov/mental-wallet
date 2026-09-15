# Design Document

## Overview

Three independent user-reported fixes:

1. **Library Preview button (Bug 1)** — replace the faint "Preview" text hint with a visible
   secondary button next to "Add to wallet" in each Library Browser row.
2. **Archived-tool reminders (Bug 2)** — archiving a tool must cancel its scheduled OS
   notifications while preserving the reminder definition; restoring the tool re-arms it.
3. **Box Breathing nose/mouth clarity (Bug 3)** — copy-only update to the curated card's step
   text and the pacer's accessibility label.

Bugs 1 and 3 are low-risk and localized. Bug 2 is the substantive one: it touches the
archive/restore data flow and the reminder/notification services, so most of this document is
about getting that right without regressing scheduling or the launch reconciliation.

## Current state (verified)

- **Library rows:** `LibraryBrowserScreen.tsx` `renderCard` makes the entire row a
  `TouchableOpacity` with `onPress={() => handleOpenPreview(item)}`. The only visible preview
  cue is `<Text style={styles.previewHintIcon}>Preview</Text>` (11px, `#AEAEB2`) in a
  `styles.previewHint` view at the row's right edge. "Add to wallet" is a real inner
  `TouchableOpacity` (`getButtonStyle()`/`getButtonLabel()`/`handlePress`), whose label/state
  come from `getLibraryCardButtonState(...)` (add / in-wallet / restore). `CardPreviewSheet` is
  already wired via `handleOpenPreview`/`handleDismissPreview` and `previewButtonState`.
- **Reminders model:** `reminders` table (`src/data/migrations.ts`): `id, card_id REFERENCES
  cards(id) ON DELETE CASCADE, type, time, frequency (JSON), is_active, notification_id,
  created_at`. `notification_id` holds a **JSON array** of OS identifiers (one per scheduled
  weekday, or one for daily); `parseNotificationIds` tolerates array or legacy single string.
- **reminderService:** `disableForCard(cardId)` loads active reminders for the card, cancels
  their OS notifications (`cancelNotificationIds`), then `UPDATE reminders SET is_active = 0
  WHERE card_id = ?`. `scheduleNotification(reminder)` reschedules from a reminder row and
  writes the new `notification_id`. `reconcileRemindersOnLaunch()` reschedules only
  `is_active = 1` rows whose stored IDs are missing from the OS schedule. `mapRowToReminder`
  maps a DB row to a `Reminder`.
- **notificationService:** `scheduleLocal(config)` → OS identifier; `cancelScheduled(id)`.
- **cardService.archive(id):** transaction that sets `is_archived=1` (+ `archived_at`,
  `previous_stack_position`, `stack_position=-1`), then `UPDATE reminders SET is_active = 0
  WHERE card_id = ?` (raw SQL — **does NOT cancel OS notifications**), then reindexes. The
  doc-comment claims it disables reminders, but only the DB flag flips.
- **cardService.restore(id):** transaction that clears `is_archived`/`archived_at`/
  `previous_stack_position` and re-inserts into the stack. **Does not touch `reminders`.**
- **Triggers:** archive from `WalletScreen.handleArchive`; restore from
  `ArchiveScreen.handleRestore` and `LibraryBrowserScreen.handleRestoreFromArchive` /
  `handlePreviewRestore`. All call `cardService` directly (no walletStore wrapper), so fixing
  this in `cardService` covers every trigger.
- **Box Breathing:** `curatedLibrary.ts` `lib-box-breathing` `controls[0].config.body` =
  `"1. Breathe IN for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT for 4 seconds\n4. HOLD
  for 4 seconds\n\nRepeat 4 cycles."`. `BoxBreathingAnimation.tsx` `A11Y_LABEL` repeats the
  phrasing. `boxBreathingVisual.test.ts` guards that the `breathing_animation` control stays.

## Requirement 1: Library Preview secondary button

### Approach

In `renderCard`, add a **Preview** secondary button in the same action area as the primary
button, and remove the muted `previewHintIcon` cue so there's one clear preview affordance.

- Wrap the primary action button and the new Preview button in a small row container (e.g.
  `styles.cardActions`, `flexDirection: 'row'`, gap). The primary button keeps its existing
  `getButtonStyle()`/`handlePress`; the Preview button gets a new secondary/outline style
  (`styles.previewButton` + `styles.previewButtonText`) so it reads as subordinate.
- Preview button: `onPress={() => handleOpenPreview(item)}`, `accessibilityRole="button"`,
  `accessibilityLabel={`Preview ${item.title}`}`, min 44×44 touch target.
- **Row tap:** keep the row's existing `onPress={handleOpenPreview}` so long-time users who tap
  the row still get the preview (Req 1.4 allows this). The inner buttons already `stopPropagation`
  effectively because they're separate `TouchableOpacity`s handling their own press; verify the
  primary button press does not also bubble to open the preview (it currently sits inside the
  row `TouchableOpacity`, so confirm nested-touchable behavior on both platforms — if taps
  bubble, guard by moving the actions out of the row's touchable or stopping propagation).
- Remove the `previewHint`/`previewHintIcon` block (Req 1.7). Keep the styles or delete them if
  unused elsewhere.
- Admin mode: leave the existing `adminActions` row (Edit/Export/Delete) intact below; the
  Preview button lives with the primary action, so both coexist (Req 1.6).

### Risk / edge

The nested-touchable bubbling is the one thing to verify on-device: tapping "Add to wallet"
must not also fire the row's preview. If RN bubbles the press on Android, the cleanest fix is to
make the row NON-touchable and rely on the explicit Preview button (Req 1.4 permits this) — that
also removes any ambiguity. Decide during implementation based on observed behavior; prefer the
explicit-buttons layout if there's any doubt.

## Requirement 2: Archive cancels reminders, restore re-arms them

### Core design

Fix `cardService.archive` and `cardService.restore` so the reminder lifecycle is correct, and
add a small re-arm helper to `reminderService`. Keep the reminder DEFINITION row across archive
(mark inactive, don't delete) so restore can rebuild the schedule.

**Transaction boundary (important).** `archive`/`restore` currently wrap card writes in a DB
transaction. OS notification scheduling/cancellation is async and must NOT happen inside an open
SQLite transaction. So the sequence is: do the notification work and the reminder-row flag
either through `reminderService` (which manages both) **before/after** the card transaction, not
nested inside it. Concretely:

**archive(id):**
1. (unchanged) card transaction: set `is_archived=1`, positions, reindex. Keep flipping
   `reminders.is_active = 0` here is acceptable, but it must be paired with cancelling the OS
   notifications. To avoid drift, do the reminder handling in ONE place:
2. Replace the raw `UPDATE reminders SET is_active = 0` with a call to
   `reminderService.disableForCard(cardId)` performed **outside** the card transaction (before
   or after it), because `disableForCard` both cancels the OS notifications and flips
   `is_active`. Recommended order: run the card transaction first (so the card is archived even
   if notification cancellation hiccups), then `await reminderService.disableForCard(id)`.
   `disableForCard` is idempotent-ish (no active reminder → no-op).
3. Net: the reminder row stays in the table with `is_active = 0` and its (now-cancelled)
   `notification_id`; the definition (time/frequency) is preserved (Req 2.1, 2.2).

**restore(id):**
1. (unchanged) card transaction: clear archived flags, re-insert into stack.
2. After the transaction, look up the card's PRESERVED reminder (the most recent inactive
   reminder for that `card_id`) and, if present, re-arm it via a new
   `reminderService.reactivateForCard(cardId)`:
   - Load the inactive reminder row for the card (`SELECT * FROM reminders WHERE card_id = ?
     ORDER BY created_at DESC LIMIT 1`, or specifically `is_active = 0`).
   - Reschedule from its `time`/`frequency` (reuse `scheduleNotification`'s logic, which builds
     configs, schedules, and writes the new `notification_id`), then `UPDATE ... SET is_active =
     1` for that row. Reschedule uses the CURRENT discreet setting and current card title
     (Req 2.5) because `scheduleNotification` re-reads both.
   - If the card has no reminder row, do nothing (Req 2.4).
3. Guard against duplicates: if for any reason an active reminder already exists for the card,
   don't double-schedule (cancel/replace or skip).

**New reminderService method:** `reactivateForCard(cardId: string): Promise<Reminder | null>`
— the inverse of `disableForCard`. Finds the preserved (inactive) reminder, reschedules its
notifications, sets `is_active = 1`, returns it (or null if none). Reuses `buildNotificationConfigs`
+ `notificationService.scheduleLocal` (the same path `scheduleNotification` uses), and
`mapRowToReminder`.

### Why not do it inside the card transaction

`disableForCard`/`reactivateForCard` perform `await` on `expo-notifications` between DB writes.
An open `BEGIN TRANSACTION` on the shared connection spanning those awaits risks holding the
transaction across async notification I/O and interleaving with other queries. Doing the card
row changes in their own short transaction, then the reminder/notification work separately, is
safer and matches how `setCardReminder` already treats scheduling (schedule, then write) rather
than wrapping notifications in a card transaction.

### Launch reconciliation (Req 2.6)

`reconcileRemindersOnLaunch()` already filters `WHERE is_active = 1`, so a preserved archived
reminder (`is_active = 0`) is correctly skipped and stays silent until restore. No change
needed, but this is called out as a requirement so a future refactor doesn't break it. Add a
test to lock it in.

### Delete path (Req 2.8)

Permanent delete relies on `reminders.card_id ... ON DELETE CASCADE`. That removes the reminder
row, but a cancelled-or-not OS notification could linger if delete doesn't cancel it. Since
archive now cancels the OS notifications (step above) and delete only applies to already-archived
cards (ArchiveScreen), by the time a card is deleted its notifications are already cancelled. Add
a defensive `disableForCard` (or cancel) in the delete path only if we find a gap; otherwise the
archive-time cancel covers it. Verify no orphaned scheduled notifications remain after
archive→delete.

### Notification tap degradation (Req 2.7)

Unchanged: `WalletScreen`'s deep-link resolver already finds the card only if `!c.isArchived`
and otherwise lands on the wallet with nothing focused, no error. After this fix, archived tools
won't fire, so such taps should be rare (only a notification already delivered to the tray
before archive).

## Requirement 3: Box Breathing nose/mouth copy

Copy-only change in two synchronized places:

- `curatedLibrary.ts` `lib-box-breathing` `controls[0].config.body` — add nose/mouth guidance to
  the inhale and exhale steps. Proposed copy (keeps 4-4-4-4 + 4 cycles, plain/gentle tone):
  `"1. Breathe IN through your nose for 4 seconds\n2. HOLD for 4 seconds\n3. Breathe OUT through
  your mouth for 4 seconds\n4. HOLD for 4 seconds\n\nRepeat 4 cycles."`
- `BoxBreathingAnimation.tsx` `A11Y_LABEL` — mirror it: `"Box breathing pacer. Breathe in
  through your nose for 4 seconds, hold for 4 seconds, breathe out through your mouth for 4
  seconds, hold for 4 seconds. Four cycles, then repeats."`

No control-structure change (the `breathing_animation` control stays, so
`boxBreathingVisual.test.ts` still passes). Per the no-OTA/snapshot reality, only newly added
wallet copies get the new text; existing copies are unchanged (Req 3.6, accepted).

## Files touched

Bug 1:
- `src/screens/LibraryBrowserScreen.tsx` — `renderCard`: add Preview secondary button next to
  the primary action; remove the `previewHint` text; add `cardActions`/`previewButton` styles.

Bug 2:
- `src/services/cardService.ts` — `archive` (use `reminderService.disableForCard` around the
  transaction instead of raw SQL); `restore` (call `reminderService.reactivateForCard` after the
  transaction). Possibly a small defensive change in the delete path.
- `src/services/reminderService.ts` — new `reactivateForCard(cardId)`; no change to
  `disableForCard`, `scheduleNotification`, or `reconcileRemindersOnLaunch` (reuse them).

Bug 3:
- `src/data/curatedLibrary.ts` — `lib-box-breathing` step body copy.
- `src/components/controls/BoxBreathingAnimation.tsx` — `A11Y_LABEL`.

## Testing strategy

Per the round-1 convention: unit tests where there's a cheap, meaningful seam; manual on-device
for the visual/native behavior.

Bug 1 (mostly manual):
- MANUAL: Library row shows a visible Preview secondary button next to Add-to-wallet; tapping
  Preview opens the sheet; tapping Add adds the card and does NOT open the preview; admin rows
  still show Edit/Export/Delete. VoiceOver/TalkBack reads "Preview <title>".

Bug 2 (unit + manual — this is where tests earn their keep):
- UNIT (`reminderService`): `reactivateForCard` reschedules and flips `is_active=1` for a
  preserved inactive reminder; returns null when the card has no reminder; does not double-
  schedule if an active reminder already exists. Mock `notificationService.scheduleLocal`/
  `cancelScheduled` and assert calls. Pair with a test that `disableForCard` cancels + flips
  (may already be covered).
- UNIT (archive/restore round-trip against a test DB if feasible): archive a card with a
  reminder → reminder row `is_active=0`, `cancelScheduled` called for each stored id; restore →
  `is_active=1`, `scheduleLocal` called again. If a full cardService DB test is too heavy, cover
  the reminderService halves and verify the wiring manually.
- UNIT: `reconcileRemindersOnLaunch` does NOT reschedule an `is_active=0` (archived) reminder.
- MANUAL on device: set a reminder (near-future time) on a tool; archive it; confirm the
  notification does NOT fire at the scheduled time and no reminder appears; restore the tool;
  confirm the reminder fires again at the next scheduled time; confirm ReminderConfig screen
  shows the reminder restored. Archive→delete leaves nothing scheduled.

Bug 3 (unit + manual):
- UNIT: `boxBreathingVisual.test.ts` still passes (control structure intact). Optionally assert
  the step body and `A11Y_LABEL` both contain "nose" and "mouth" so they can't silently drift
  apart again.
- MANUAL: add a fresh Box Breathing card from the library; the steps clearly say nose/mouth;
  VoiceOver on the pacer reads the matching guidance.

## Requirements coverage

| Req | Addressed by |
|---|---|
| 1.1–1.3, 1.5, 1.7 | Preview secondary button next to primary; remove muted hint |
| 1.4 | Row tap may still preview; primary button never previews, preview never adds |
| 1.6 | Admin action row untouched; Preview coexists |
| 2.1 | `archive` calls `reminderService.disableForCard` (cancels OS notifications) |
| 2.2 | Reminder row kept, marked `is_active=0` (definition preserved) |
| 2.3 | `restore` calls new `reactivateForCard` (reschedule + `is_active=1`) |
| 2.4 | `reactivateForCard` no-ops when no reminder row exists |
| 2.5 | Re-arm uses current discreet setting + current title (scheduleNotification path) |
| 2.6 | `reconcileRemindersOnLaunch` still filters `is_active=1` (test-locked) |
| 2.7 | Existing WalletScreen archived-card deep-link degradation unchanged |
| 2.8 | `ON DELETE CASCADE` + archive-time cancel; verify no orphans |
| 3.1–3.5 | Nose/mouth copy in curated body + matching `A11Y_LABEL`; structure unchanged |
| 3.6 | No-OTA/snapshot behavior accepted; no wallet-copy migration |

## Open items to confirm

- Bug 1: nested-touchable press bubbling on Android (row tap vs inner button). Resolve at
  implementation; prefer explicit buttons + non-touchable row if there's any ambiguity.
- Bug 2: whether to keep the `is_active=0` flip inside the card transaction AND call
  `disableForCard` (double work), or remove the raw SQL entirely and rely solely on
  `disableForCard` outside the transaction. Prefer the latter (single source of truth), pending
  a check that nothing else depends on the flip happening inside the archive transaction.
- Bug 3: final nose/mouth wording (inhale nose / exhale mouth is the proposed default) — operator
  copy approval, mirroring how the fallback-page copy was approved.
