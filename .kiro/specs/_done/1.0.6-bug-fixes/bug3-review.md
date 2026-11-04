# Bug 3 Close-out Review (1.0.6-bug-fixes, Wave 4, tasks 3.2–3.4)

Commit reviewed: `7f39ecd` "fix: close Bug 3 … revert instrumentation, add regression tests"
Verdict: **APPROVED**

## Scope

No behavioral fix. The bug ("an archived tool's reminder still fires") was verified NOT
reproducible on a real iPhone on current code. The work is: remove the temporary `[arch]`
instrumentation (restore baseline), add regression/preservation tests, and update spec docs.

## Required-fact verification

1. **Service files back to pre-instrumentation baseline — PASS.**
   `git diff 3311ddc~1 -- src/services/cardService.ts src/services/reminderService.ts` returns
   EMPTY (0 lines). The `HEAD~1..HEAD` diff on these two files is a pure revert: archive catch
   restored to silent `catch {}` in cardService.ts; `logArch` parameter removed from
   `cancelNotificationIds`; the `__DEV__`-only `getAllScheduledNotificationsAsync` reads,
   build-marker, and all per-id logs removed from reminderService.ts.

2. **No `[arch]`/`logArch` tokens under src/ — PASS.**
   `grep -rn "\[arch\]" src/` → no matches (exit 1). `grep -rn "logArch" src/` → no matches
   (exit 1). Matches the recorded commit output.

3. **Regression test asserts BOTH halves + preservation covers re-arm without double-schedule —
   PASS.**
   In `reminderService.archiveRestore.test.ts` the "Bug 3 regression" block:
   - `disableForCard`: asserts `cancelScheduledNotificationAsync` was called with each of the
     three stored ids AND exactly `storedIds.length` times (every stored id cancelled, no more/
     fewer) — this is the OS-cancel half, not just inactivation. Also asserts the
     `UPDATE reminders SET is_active = 0 WHERE card_id = ?` call ran with `['card-1']`.
     Mock wiring matches the code path: `disableForCard` reads rows via `getAllAsync` and
     `cancelNotificationIds` iterates parsed ids into `cancelScheduled`.
   - `reactivateForCard`: re-arms the preserved inactive reminder scheduling exactly one OS
     notification (`scheduleNotificationAsync` called times(1) — no double-schedule), flips the
     row to `is_active = 1`, returns an active reminder. A second preservation test confirms an
     already-active reminder is returned untouched with `scheduleNotificationAsync` never called.

4. **Only net-new non-doc code is the tests — PASS.**
   Commit `name-status` touches exactly five files: the two service files (empty vs baseline,
   i.e. net-zero code), the test file (net-new tests), and `tasks.md` + the instrumentation
   guide (docs). No stray behavioral edits.

5. **Docs updated; guide not deleted; no unrelated files staged — PASS.**
   `tasks.md` checks off `3.2`/`3.3`/`3.4` with the no-behavioral-fix as-built notes and V.4
   closure. `bug3-instrumentation-guide.md` gains a RESOLVED note at the top and is retained
   (modified, not deleted). Numerous untracked files exist in the working tree (`.agents/…`,
   other specs, worker configs) but they are NOT part of this commit — only the five expected
   files were committed.

## Recorded verification (not re-run)

Per commit message: `npm test -- reminderService` → 8/8 pass; `npm run typecheck` → no new
errors in the touched files; the two grep checks and the baseline diff returned as required.
Trust level is stated honestly in the test docblock and tasks.md: the unit suite proves the
service cancels + inactivates with a mocked notification module; the OS-level repeating-stop was
verified on-device (V.4), not by this suite.

## Findings

None. All required facts confirmed from the diff and recorded output.
