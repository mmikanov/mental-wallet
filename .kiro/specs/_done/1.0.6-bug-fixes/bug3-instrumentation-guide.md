> **RESOLVED:** verified not reproducible on-device on current code; no fix needed; instrumentation
> removed. Two clean real-iPhone runs showed archiving a tool with a reminder correctly cancels the
> OS notification + inactivates the reminder, no reconcile re-arm on relaunch, and the notification
> did not fire. A service-layer regression test (`reminderService.disableForCard` cancel +
> inactivate, plus restore re-arm) now guards against regression. This guide is kept as a historical
> record of how the on-device cause was ruled out.

# Bug 3 — Instrumentation & On-Device Repro Guide

**Bug:** A tool that has a reminder keeps firing its notification *after the tool is archived*.
Still reproducible on a real 1.0.5 iPhone.

**Status:** This is the **instrument-first** step (task 3.1). The code now carries temporary
`__DEV__` diagnostic logs tagged `[arch]`. **No fix has been written yet** — the fix (task 3.2)
is chosen from what these logs show on your device. Per Req 3B.4, we establish the on-device
cause *before* changing behavior.

> All diagnostics are `if (__DEV__) console.log(...)` and are prefixed `[arch]`. They print only
> in a dev build and will be removed in task 3.2 (grep `[arch]`). They do **not** change any
> behavior — the archive transaction, the cancel + inactivate logic, the silent catch, and the
> launch reconcile all run exactly as before; these lines only observe.

---

## 1. Build a dev build that includes these logs

This is a bare RN / Expo project, and the behavior under test is an **OS-scheduled repeating
notification** — so it **must be a real device** (the iOS Simulator does not run repeating local
notifications reliably). Use your normal dev build workflow:

- **iOS (real iPhone):**
  ```
  npx expo run:ios --device
  ```
  (or build/run the `ios/` project from Xcode onto the attached iPhone). A plain Expo Go / JS
  reload is **not** enough if anything native changed — do a real dev build.
- **Android (real device/emulator):**
  ```
  npx expo run:android
  ```

**Rule out a stale build FIRST (this is candidate cause #4).** As soon as the app launches, you
must see:

```
[arch] build-marker 1.0.6-bug3
```

in the logs. If that line is **absent**, the running app does **not** contain the
instrumentation — stop, rebuild, and do not trust any further observation until you see it. A
stale build is the first thing to eliminate.

---

## 2. Reproduce the bug

1. Open the app on the real device.
2. Pick a tool and **set a reminder** on it. **Choose a time a few minutes in the future** so the
   notification will actually fire soon (e.g. if it's 3:00, set 3:03). Note the exact time.
3. **Archive that tool** (swipe/menu → Archive).
4. **(a) Read the archive-time logs immediately** — see §4. The `[arch] archive→...`,
   `[arch] activeReminders ...`, `[arch] OS scheduled before/after ...`, `[arch] cancelling ...`,
   and `[arch] is_active→0 updated rows=...` lines all print during the archive.
5. **(b) Watch the clock.** At the reminder time, observe whether the notification **still
   fires** even though the tool is archived. Note yes/no.
6. **Relaunch the app** (fully quit and reopen). On launch, `reconcileRemindersOnLaunch` runs and
   prints `[arch] reconcile reminder ...` lines — read those (§4). This tells us whether reconcile
   is re-arming the archived reminder.

---

## 3. How to read the logs

Keep a log stream open while you do §2. Filter for the `[arch]` tag.

- **iOS:**
  ```
  npx react-native log-ios | grep "\[arch\]"
  ```
  or watch the **Metro** terminal output, or the **Xcode** console (Window → Devices &
  Simulators / the run console).
- **Android:**
  ```
  npx react-native log-android | grep "\[arch\]"
  ```
  or `adb logcat | grep "\[arch\]"`, or the Metro output.

---

## 4. What the logs mean → which root cause

Read the lines in this order. The decision tree mirrors design §Bug 3.

| What you see in the `[arch]` logs | What it means | Root cause |
|---|---|---|
| `build-marker 1.0.6-bug3` is **absent** at launch | The running app predates/omits the instrumentation | **#4 stale build** — rebuild and start over before trusting anything |
| `archive→disableForCard start id=…` **never prints** | The disable call isn't even running after archive | archive path not reaching disable (investigate ordering) |
| `disableForCard THREW: …` prints | The disable step threw and was silently swallowed | **#1 silent failure** |
| `is_active→0 updated rows=0` | The "mark inactive" write did not update the row | **#1 silent failure** — the row stays active |
| `OS scheduled before=[…]` does **not** contain the stored `activeReminders ids=` values | The OS scheduled different identifiers than we stored, so cancel targets the wrong ids | **#2 stored ≠ scheduled** |
| `cancel FAILED id=…` prints | A cancel call rejected (and was swallowed) | **#1 / #2** |
| `OS scheduled after=[…]` **still contains** the reminder's identifiers | The notification survived cancellation | **#2 / #3** — the real OS notification is still live |
| On relaunch: `reconcile reminder id=… active=1 … missing=true` for the archived card | Reconcile is re-arming it, which also means the row is still `active=1` | **#3 reconcile re-arm** (folds back to **#1** — the inactive write didn't stick) |
| `OS scheduled before`/`after` differ correctly, `is_active→0 updated rows=1`, and reconcile shows nothing for the card, **yet the notification still fired** | Service layer did everything right; the surviving fire is a repeating-trigger/OS semantics issue | **#3 repeating-notification semantics** |

(Cause #1 = silent failure / inactive write didn't commit; #2 = stored ids ≠ OS-scheduled ids;
#3 = reconcile re-arm or repeating-trigger semantics; #4 = stale build.)

---

## 5. What to report back to Kiro

Copy the **full `[arch]` log lines**, in order, from:

1. **App launch** — including the `build-marker` line (to prove the build is current).
2. **One archive repro** — every `[arch]` line printed while you archived the tool (start,
   activeReminders, OS scheduled before, cancelling/cancel FAILED, OS scheduled after,
   is_active→0 updated rows).
3. **The relaunch** — every `[arch] reconcile reminder …` line.

Also say plainly: **did the notification actually fire at the reminder time after archiving?**
(yes/no, and roughly when).

With that, the gated fix (task 3.2) can be chosen from the decision tree above and the
regression test (task 3.3) placed at the layer the logs implicate.

---

## 6. Honest trust level

The unit suite can only prove the service cancels + inactivates with a mocked notification
module. Whether the **real OS repeating notification** stops is **device-only** and can be
confirmed solely by the manual observation in §2 step 5 / §5. Don't treat green unit tests as
proof the bug is fixed; the on-device pass (V.4) is required.
