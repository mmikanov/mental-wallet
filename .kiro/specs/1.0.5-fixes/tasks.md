# Implementation Plan — 1.0.5 Fixes

Structured **per-bug sequentially** (per workflow steering): complete one bug fully before the next. Each bug is a self-contained cycle — exploration test (fails on unfixed code) → preservation test (baseline that must not change) → fix + verify → checkpoint. UI/copy and native-only items note where a failing-test seam doesn't apply and use reproduce/verify instead.

Order: **Bug 3 → Bug 2 → Bug 1.** Rationale: Bug 3 is small, pure-JS, and independent; Bug 2 is pure-JS and shippable; Bug 1 is native/on-device and gated on a physical-device pass, so it goes last and doesn't block the JS work.

---

## Bug 3 — Duplicate minute-axis label (pure-JS, do first)

- [x] 3.1 (Exploration) Add a unit test for the duration-axis label generation in `DualAxisChart` that reproduces the bug: with all-zero duration data (`durationMax=1, durationMin=0`), assert the three tick labels are NOT all-distinct today (top and midpoint both `1m`). Confirms the bug on unfixed code.
  - _Requirements: 8.1, 8.2_
- [x] 3.2 (Preservation) Add a test capturing correct behavior for a normal multi-minute range (distinct labels), so the fix doesn't regress normal charts.
  - _Requirements: 8.3, 8.4_
- [x] 3.3 (Fix) In `src/components/insights/DualAxisChart.tsx`, dedupe the right-axis (duration) ticks: if the midpoint label equals the top or bottom label, render the midpoint as empty. Scope strictly to the duration labels; leave the left score axis (`10/5/1`) and the "Felt better" series untouched.
  - _Requirements: 8.1, 8.2, 8.3, 8.5_
- [x] 3.4 (Verify) Run the label tests for all three cases (zero, tiny <2 min, normal); `npm run typecheck` clean. Visually confirm both Insights surfaces (per-tool and wallet-level) via the same shared chart.
  - _Requirements: 8.4, 8.5_
- [x] 3.5 (Checkpoint) Bug 3 green and self-contained.

---

## Bug 2 — Wire up duration tracking (+ timed_out fix + disclosure)

### Cycle A — `timed_out` CHECK constraint

- [x] 2.1 (Exploration) Add a test that persisting a `duration_records` row with `end_status='timed_out'` FAILS against the current schema (CHECK allows only `completed`/`collapsed`). Confirms the latent bug.
  - _Requirements: 5.1_
- [x] 2.2 (Preservation) Add/confirm a test that existing `completed` and `collapsed` rows still persist and existing rows survive a migration.
  - _Requirements: 5.3_
- [x] 2.3 (Fix) Add `runDurationEndStatusCheckMigration(db)` in `src/data/migrations.ts` following the `runControlTypeCheckMigration` rebuild pattern (idempotency guard on the table DDL; rebuild table with `CHECK(end_status IN ('completed','collapsed','timed_out'))`; copy rows; recreate both indexes; FK off/on; rollback on error). Register it in `runMigrations` after `runDurationRecordsMigration`. Update `DURATION_RECORDS_SCHEMA_SQL` to the three-value CHECK for fresh installs.
  - _Requirements: 5.1, 5.2, 5.3_
- [x] 2.4 (Verify) Re-run 2.1 (now passes — `timed_out` persists), 2.2 (still green), and a migration-idempotency test (running twice is a no-op, rows preserved).
  - _Requirements: 5.1, 5.3, 5.4_
- [x] 2.5 (Checkpoint) Cycle A green.

### Cycle B — wire the tracker into the app lifecycle

- [x] 2.6 (Exploration) Add a test asserting that expanding a card starts tracking and completing it persists a `completed` duration record — failing today because nothing calls `startTracking`/`stopTracking` (no production caller exists).
  - _Requirements: 4.1, 4.2, 4.6_
- [x] 2.7 (Preservation) Capture baselines that must not change: the < 3s discard rule still drops short sessions; switching cards doesn't double-count; the graph query still reads only `end_status='completed'` (no query change).
  - _Requirements: 4.5, 4.7, 5.4_
- [x] 2.8 (Fix — init) In `App.tsx`, add a mount effect that calls `createActiveDurationTracker().initialize()` and tears it down on unmount, alongside the existing effects.
  - _Requirements: 4.1, 4.3 (background/foreground pause-resume)_
- [x] 2.9 (Fix — start) In `src/stores/walletStore.ts`, call `startTracking(focusedCardId)` from `expandCard()` (the single entry-into-active-use chokepoint).
  - _Requirements: 4.2_
- [x] 2.10 (Fix — stop/completed) In `src/components/wallet/ExpandedContent.tsx`, call `stopTracking('completed')` on the successful completion paths (`handleSubmit` non-KPI, `handleLinkOnlyAutoComplete`) BEFORE the existing `collapseCard()`. Also call it on the KPI check-in success path (`recordKpi`) so KPI sessions aren't mislabeled.
  - _Requirements: 4.2, 4.6_
- [x] 2.11 (Fix — stop/collapsed) In `walletStore.ts`, call `stopTracking('collapsed')` from `returnToStack()` and from `collapseCard()` only if a session is still active (completion already stopped it, so this becomes a no-op after completes). Rely on `stopTracking`'s `!isTracking` early-return for safety.
  - _Requirements: 4.2 (closed-without-finishing), 4.7_
- [x] 2.12 (Verify) Re-run 2.6 (now passes) and 2.7 (still green). Add coverage: expand→complete → one `completed` row; expand→collapse without completing → one `collapsed` row; expand→return-to-stack → `collapsed`; expand card A then expand card B → no double-count. `npm run typecheck` clean.
  - _Requirements: 4.2, 4.6, 4.7_
- [x] 2.13 (Checkpoint — on-device note) State plainly: unit-verified at the store/DB layer. The real expand→record→graph loop and the background/foreground pause + 15-min timeout must be confirmed on a device/simulator — use a tool for a measurable time, finish it, confirm the Practice time line is non-zero. This can't be proven in CI.
  - _Requirements: 4.3, 4.4, 4.6_

### Cycle C — disclosure note (Requirement 6)

- [x] 2.14 (Fix) Add a short, muted caption near the chart on BOTH surfaces — `PerToolOutcomeTrendsSection.tsx` (after `<DualAxisChart>`) and `OutcomeTrendsSection.tsx` (inside `contentCard`, after `<DualAxisChart>`). Extract the copy into a shared constant/component so both read identically. Draft: "Practice time counts time you spend using a tool in the app. It doesn't include time in other apps or external media."
  - _Requirements: 6.1, 6.2, 6.3_
- [x] 2.15 (Verify) Confirm the note renders on both Insights pages, is unobtrusive (caption, not a dialog), and is accessible. Sanity-check the existing "Practice time" tooltip/help text still matches the now-populated line; adjust wording only if it implied a different source (no methodology change — explainability update chain not triggered).
  - _Requirements: 6.1, 6.2, 7.1, 7.2_
- [x] 2.16 (Checkpoint) Bug 2 complete (Cycles A–C green; on-device pass noted as pending).

---

## Bug 1 — Android deep links on a physical device (native/on-device, do last)

> Per the debugging steering: instrument and get device ground truth BEFORE any code fix. Do not ship a second speculative fix for the same symptom without a log showing the first guess was wrong.

### Cycle A — diagnose (no code fix)

> **Investigation outcome (see `bug1-investigation-findings.md`):** 1b works on-device
> (warm + cold). 1a is NOT a repo-fixable config defect — the manifest + `assetlinks.json`
> are provably correct (Google's Digital Asset Links API returns the right statements for
> the Play signing key), and nothing in 1.0.5 changes 1a vs 1.0.4. Decision: ship 1.0.5 for
> Bugs 2 & 3; re-check 1a auto-verification on a clean **production**-track install after release.

### Cycle A — diagnose (no code fix)

- [x] 1.1 (1a evidence) Gathered on the Play-signed (internal-track) build: `pm get-app-links` → domain state `1024` (unverified); `assetlinks.json` is live, `application/json`, no redirect; lists app-signing key `C4:72:E2:FF:…` (matches Play Console) + upload key `16:85:BA:DC:…`. Google's Digital Asset Links API returns both statements correctly. Config confirmed CORRECT — the requirements' fingerprint-mismatch hypothesis (Req 1.2) is disproven.
  - _Requirements: 1.1, 1.2_
- [x] 1.2 (1b evidence) Added temporary `[dl]` logs in `src/navigation/linking.ts` (getInitialURL + subscribe) plus a `__DEV__` "Fire test reminder" button. On-device logs: handler fires, `data.cardId` arrives, URL resolves to `mentalwallet://wallet?focusCardId=<id>`. App opened the correct tool warm + cold. Logs since removed.
  - _Requirements: 1.3_
- [x] 1.3 (Checkpoint) Answers recorded: domain is NOT auto-verified (`1024`) on an internal-track install even though the file/fingerprint/manifest are all correct; the notification handler DOES fire on-device with `data.cardId`. See `bug1-investigation-findings.md`.

### Cycle B — 1a (HTTPS App Links) — no repo fix needed

- [~] 1.4 (Fix) N/A — the fingerprint was NOT missing (app-signing key `C4:72:E2:FF:…` is already in `assetlinks.json`, confirmed via Google's API). No file fix applies. Separately made a low-risk, correct-practice header change (`website/_headers` now serves the association files with `Cache-Control: public, max-age=3600` instead of the Workers-Assets `max-age=0, must-revalidate` default); deployed + edge-confirmed, but it did NOT resolve the `1024`. `_headers` still pins `Content-Type: application/json`. Repo copy of `assetlinks.json` already matches live.
  - _Requirements: 2.1, 2.2_
- [~] 1.5 (Verify — on device) Partially: on a clean reinstall + reboot (internal track, single device) the domain stayed `1024` and the link opened the browser; once link handling was MANUALLY enabled, `…/app/checkin` opened the app on the check-in card (routing chain proven correct). `mentalwallet://checkin` custom-scheme fallback works. **Auto-verification on a clean production install remains unverified** (couldn't be tested on a single internal-track device) — deferred to post-release production check.
  - _Requirements: 2.3, 2.4, 2.5_
- [~] 1.6 (Checkpoint) 1a routing proven correct; config proven correct; **auto-verify pending a production-track check post-release** (not conclusively verifiable on a single internal-track device with a polluted verifier state).

### Cycle C — 1b (reminder tap) — verified

- [x] 1.7 (Fix) No behavioral fix was warranted (the 1.2 evidence showed the mapping layer already works). Completed the non-speculative part: extracted the notification-`data`→`mentalwallet://wallet?focusCardId=<id>` mapping into the pure, exported `reminderNotificationDataToUrl` helper in `src/navigation/linking.ts` (shared by getInitialURL + subscribe), making it testable. No guessed behavioral change shipped (per debugging steering).
  - _Requirements: 3.1, 3.2_
- [x] 1.8 (Regression test) Unit-test the mapping/helper at the layer that was broken (not just route parsing): given a `card_reminder` notification `data`, it produces the correct deep-link URL; malformed/absent data degrades gracefully. (`src/navigation/__tests__/linking.reminderMapping.test.ts`, 18 cases.)
  - _Requirements: 3.3_
- [x] 1.9 (Verify — on device) Tapped a tool's reminder cold (app killed) and warm (backgrounded) → opened that tool. Temporary `[dl]` logs removed (grep-confirmed zero remain). The `__DEV__` "Fire test reminder" button (`DevTestReminderButton`) added as a test aid was removed during R.2 prep.
  - _Requirements: 3.1, 3.2, 3.4, 1.4_
- [x] 1.10 (Checkpoint) 1b verified on-device; `[dl]` diagnostics removed and the `__DEV__` test-reminder button removed.

---

## Release wrap (when all three are done)

- [x] R.1 Finalize the 1.0.5 "What's New" copy in `docs/store-listing-copy.md` (Apple copy must not mention Android — per steering). Version already bumped to 1.0.5 across the four native files + package.json via `npm run set-version`.
- [ ] R.2 Commit the 1.0.5 fixes together with the pending version bump + `scripts/set-version.js` + release-checklist steering change.
- [ ] R.3 Follow the release checklist (build, submit, set store release notes, tag `v1.0.5` on the built commit).
