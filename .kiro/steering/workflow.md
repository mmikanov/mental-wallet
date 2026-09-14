# Workflow Preferences

## Bugfix Specs — Per-Bug Sequential Tasks

When creating implementation tasks for bugfix specs that contain multiple bugs, structure the task list **per-bug sequentially** — not by phase across all bugs.

Each bug should be a self-contained cycle:
1. Exploration test (confirm bug exists on unfixed code — test fails)
2. Preservation test (capture baseline behavior on unfixed code — test passes)
3. Fix + verify (implement fix, re-run exploration test passes, preservation still passes)
4. Checkpoint (confirm everything green for that bug)

Complete one bug fully before starting the next. The Task Dependency Graph waves should reflect this: one bug at a time, not all bugs in parallel.

## Debugging runtime/UI bugs — get ground truth before guessing

Lessons from the deep-linking work (many wasted build/test cycles). When a feature
"doesn't work" at runtime and the cause isn't obvious from reading the code:

1. **Instrument before hypothesizing.** Add a temporary `if (__DEV__) console.log(...)`
   at the decision points (e.g. the param a handler receives, the branch taken, the
   resolved value) and ask the user to run it, BEFORE proposing a fix. One log round
   usually beats three speculative fixes. Do not ship a second speculative fix for the
   same symptom without a log confirming the first guess was wrong.
2. **Two wrong guesses = stop and instrument.** If a fix attempt didn't work, do not try a
   third variation. Add logging and get the actual runtime values first.
3. **State the smallest question the log must answer** (e.g. "is the param arriving?",
   "which render branch runs?", "is `isExpanded` true at render?"). Log exactly that.
4. **Remove all temporary diagnostics before committing.** Grep for the log tags you added.

## Trust levels — say what you actually verified

Be explicit about verification level; never imply more than was checked.

- **Unit tests passing ≠ feature works.** Tests often cover one layer (e.g. route
  parsing) while the bug is in another (delivery, rendering, native config). When a slice
  can only be proven on a real build/device, say so plainly: "verified at the unit level;
  the on-device path (X) still needs a manual pass."
- For any behavior that depends on a **native build** (deep links, notifications,
  Universal/App Links, entitlements, scheme registration) or **on-device only** (iOS
  Universal Links don't work on the Simulator; Android App Links need verification against
  the deployed assetlinks; time-based local notifications are unreliable on simulators),
  state that it cannot be confirmed here and hand the user the exact test command.
- Add a regression test that covers the layer the bug was actually in, not just the layer
  that was already green (the parsing tests were green while delivery/consume-once/render
  were broken).

## Stale-build hygiene (avoid chasing ghosts)

Before diagnosing "it still doesn't work," confirm the running artifact has the fix:

- Native config changes (Info.plist, entitlements, AndroidManifest, app.json) require a
  **native rebuild** — a JS reload / Expo Go will not pick them up. Say this up front.
- JS-only changes need a Metro reload (or `-c` to clear a stale cache). If a fix "didn't
  take," first rule out a stale bundle before re-diagnosing.
- A one-time confirmation log (e.g. a version marker) is a cheap way to prove the running
  build includes the change before spending a cycle debugging.

## Prefer the reliable state over the fragile one

When a target state renders/behaves unreliably (e.g. opening a card already-expanded) but a
simpler adjacent state is proven solid (focused, then user-expands), prefer the reliable
state and flag the richer behavior as a parked follow-up — rather than repeatedly fighting a
timing-sensitive path. Get the user's OK when this deviates from a written requirement.

## Cross-platform / stable-identifier gotchas

- Per-install identifiers (e.g. `cards.id` UUIDs) can't be hardcoded in URLs/config; use
  stable ids (`source_library_id`) or params the app resolves locally.
- Android normalizes/handles URLs differently from iOS (trailing slashes, App Link
  verification, browser fallback on unverified links). Test the actual platform, don't
  assume iOS behavior carries over.
- iOS Simulator and Android emulator each have deep-link/notification limitations; the
  custom scheme is the reliable local test, Universal/App Links need a real device (iOS) or
  verified assetlinks (Android).
