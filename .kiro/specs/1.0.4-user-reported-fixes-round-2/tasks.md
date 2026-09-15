# Implementation Plan

Second round of post-1.0.4 user-reported fixes. Structured **per-bug sequentially** — each bug
is a self-contained cycle completed fully before starting the next. Bugs are independent and
each is shippable on its own.

Cycle shape per the workflow steering: for the bug with a real logic seam (Bug 2) each cycle is
exploration test (confirm the bug on unfixed code) → preservation test (capture baseline that
must not change) → fix + verify → checkpoint. Bugs 1 and 3 are UI/copy with no meaningful
failing-test seam, so their cycles are reproduce/baseline → change → verify → checkpoint, with
tests only where cheap (e.g. the Box Breathing guard/consistency test).

Testing note: primary gate is `npm run typecheck` clean for touched files, the noted unit tests
passing, and manual on-device verification. Clean up any temp artifacts.

---

## Bug 2 — Archiving cancels reminders; restore re-arms them (Req 2)

> Sequenced first because it is the substantive fix and benefits most from the test-first cycle.

- [ ] 2.1 Exploration test — confirm the bug on unfixed code
  - Add a unit test (reminderService/cardService seam, mocking `notificationService`) asserting
    the DESIRED behavior so it FAILS today: archiving a card with an active reminder cancels its
    OS notifications (expect `cancelScheduled` called for each stored id) and, on restore,
    reschedules (expect `scheduleLocal` called again) with the reminder row ending `is_active=1`.
    Confirm it fails against current `cardService.archive`/`restore` (archive doesn't cancel;
    restore doesn't re-arm).
  - _Req: 2.1, 2.3_
- [ ] 2.2 Preservation test — baseline that must not change
  - Add/confirm tests capturing behavior we must preserve: `setCardReminder` still schedules and
    stores the JSON `notification_id` array; `reconcileRemindersOnLaunch` reschedules an
    `is_active=1` reminder with missing OS ids AND does NOT reschedule an `is_active=0` reminder
    (locks Req 2.6). These pass on unfixed code and must still pass after the fix.
  - _Req: 2.5, 2.6_
- [ ] 2.3 Add `reactivateForCard` to reminderService
  - New `reactivateForCard(cardId): Promise<Reminder|null>` — inverse of `disableForCard`: find
    the preserved inactive reminder for the card, reschedule via the existing
    `buildNotificationConfigs` + `notificationService.scheduleLocal` path (as `scheduleNotification`
    does), write the new `notification_id`, set `is_active=1`, return the reminder (null if none).
    Do not double-schedule if an active reminder already exists for the card.
  - _Req: 2.3, 2.4, 2.5_
- [ ] 2.4 Wire archive + restore in cardService
  - `archive(id)`: after the card transaction, `await reminderService.disableForCard(id)` to
    cancel OS notifications + mark inactive; remove the raw `UPDATE reminders SET is_active=0`
    (single source of truth) unless a dependency requires it inside the transaction. Do NOT wrap
    notification I/O in the SQLite transaction.
  - `restore(id)`: after the card transaction, `await reminderService.reactivateForCard(id)`.
  - Confirm delete path (already-archived cards) leaves no orphaned OS notifications (archive
    already cancelled them; add a defensive cancel only if a gap is found).
  - _Req: 2.1, 2.2, 2.3, 2.4, 2.8_
- [ ] 2.5 Verify fix + checkpoint
  - Exploration test (2.1) now passes; preservation tests (2.2) still pass; `npm run typecheck`
    clean for `cardService.ts` / `reminderService.ts`.
  - MANUAL on device: set a near-future reminder on a tool → archive it → notification does NOT
    fire and no reminder shows; restore the tool → reminder fires again at the next scheduled
    time and shows restored in ReminderConfig. Archive→delete leaves nothing scheduled.
  - _Req: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8_

---

## Bug 1 — Make "Preview" an obvious secondary button (Req 1)

- [ ] 1.1 Baseline
  - Confirm in the Library Browser that the only visible preview cue is the muted
    `previewHintIcon` text and the whole row is the tap target; "Add to wallet" is the inner
    button. Capture a before screenshot.
  - _Req: 1.1_
- [ ] 1.2 Add the Preview secondary button + remove the muted hint
  - In `renderCard`, place a secondary/outline **Preview** button next to the primary action
    button (new `cardActions` row + `previewButton`/`previewButtonText` styles). Wire
    `onPress={() => handleOpenPreview(item)}`, `accessibilityRole="button"`,
    `accessibilityLabel={`Preview ${item.title}`}`, 44×44 min target. Remove the
    `previewHint`/`previewHintIcon` block. Ensure the primary button never opens the preview and
    Preview never adds; resolve any nested-touchable bubbling (prefer explicit buttons + a
    non-touchable row if taps bubble on Android). Keep admin `adminActions` intact.
  - _Req: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
- [ ] 1.3 Verify + checkpoint
  - `npm run typecheck` clean for `LibraryBrowserScreen.tsx`.
  - MANUAL (both platforms): Preview button visible + subordinate to Add; tapping Preview opens
    the sheet; tapping Add adds and does not preview; admin rows still show Edit/Export/Delete;
    screen reader reads "Preview <title>".
  - _Req: 1.1, 1.2, 1.3, 1.4, 1.6_

---

## Bug 3 — Clarify nose vs mouth in Box Breathing (Req 3)

- [ ] 3.1 Baseline
  - Confirm the Box Breathing steps (`lib-box-breathing` `controls[0].config.body`) and the
    pacer `A11Y_LABEL` say "Breathe IN/OUT" with no nose/mouth guidance.
  - _Req: 3.1_
- [ ] 3.2 Update the copy in both synchronized places
  - `curatedLibrary.ts` `lib-box-breathing` `controls[0].config.body`: add nose/mouth guidance
    (proposed: inhale through the nose, exhale through the mouth), keeping 4-4-4-4 + 4 cycles.
  - `BoxBreathingAnimation.tsx` `A11Y_LABEL`: mirror the same guidance so spoken + written agree.
  - Do not change the control structure (keep `breathing_animation`), timing, category, or
    rationale.
  - _Req: 3.1, 3.2, 3.3, 3.4, 3.5_
- [ ] 3.3 Verify + checkpoint
  - `boxBreathingVisual.test.ts` still passes; optionally add an assertion that both the step
    body and `A11Y_LABEL` contain "nose" and "mouth" (guards against future drift).
  - `npm run typecheck` clean for touched files.
  - MANUAL: add a fresh Box Breathing card from the library → steps clearly state nose/mouth;
    VoiceOver on the pacer reads the matching guidance.
  - _Req: 3.1, 3.2, 3.3, 3.6_

---

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["2.1", "2.2"] },
    { "wave": 2, "tasks": ["2.3"] },
    { "wave": 3, "tasks": ["2.4"] },
    { "wave": 4, "tasks": ["2.5"] },
    { "wave": 5, "tasks": ["1.1", "1.2"] },
    { "wave": 6, "tasks": ["1.3"] },
    { "wave": 7, "tasks": ["3.1", "3.2"] },
    { "wave": 8, "tasks": ["3.3"] }
  ],
  "notes": "Per the workflow steering, bugs are done ONE AT A TIME, not in parallel. Bug 2 first (waves 1-4) as a full test-first cycle: exploration test + preservation test (wave 1), then reactivateForCard (wave 2), then wire archive/restore (wave 3), then verify+checkpoint (wave 4). Bug 1 next (waves 5-6): baseline+build the Preview button, then verify. Bug 3 last (waves 7-8): baseline+copy update in both places, then verify. Each bug is independently shippable; all three are website-independent app/content changes that ride the next app build (Bug 3 is curated-content only, no OTA, so it affects newly added wallet copies)."
}
```
