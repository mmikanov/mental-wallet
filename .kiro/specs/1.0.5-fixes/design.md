# Design Document — 1.0.5 Fixes

> Requirements live in `requirements.md` (product language). This document carries the technical detail.

## Scope

Three defects for 1.0.5:

1. **Bug 1 — Android deep links fail on a physical device** (two sub-cases: 1a HTTPS App Links, 1b reminder taps).
2. **Bug 2 — Insights "Practice time" always 0** (duration tracking was built but never wired in) + the latent `timed_out` CHECK-constraint bug + a plain-language disclosure note.
3. **Bug 3 — Duplicate "1m" label** on the Outcome Trends graph's minute axis.

Each bug is independent. Bugs 2 and 3 are pure-JS and shippable now; Bug 1 is native/on-device and requires a physical-device pass plus an instrumentation step before any speculative fix.

---

## Bug 1 — Android deep links (physical device)

### Current wiring (verified)

- `src/navigation/linking.ts` registers two prefixes: `mentalwallet://` and `https://mentalhealthwallet.productsforgood.co/app`. Notification taps are converted into `mentalwallet://wallet?focusCardId=<cardId>` in both `getInitialURL` (cold start, via `Notifications.getLastNotificationResponseAsync()`) and `subscribe` (warm, via `addNotificationResponseReceivedListener`). Wired into `NavigationContainer` in `App.tsx`.
- `android/app/src/main/AndroidManifest.xml` already contains both the custom-scheme (`mentalwallet`) intent filter and the `autoVerify="true"` HTTPS App Link filter (`host=mentalhealthwallet.productsforgood.co`, `pathPrefix=/app`). The manifest is hand-maintained (bare workflow).
- `website/.well-known/assetlinks.json` exists with `package_name com.mentalwallet.app` and two SHA-256 fingerprints. This is a website deliverable served by the Cloudflare worker, not shipped in the app.
- Reminder payload (`src/services/reminderService.ts` `buildNotificationConfigs`): `data: { type: 'card_reminder', cardId }` where `cardId` is the per-install `cards.id`.

### Why it fails on real Android but worked on emulator / iOS

- **1a (HTTPS):** Android App Link `autoVerify` only succeeds if the live `assetlinks.json` lists the SHA-256 of the signing key the installed build was actually signed with. A Play-Store install is signed with **Google Play's app-signing key**; the emulator side-load used the local/EAS key. If Play's app-signing SHA-256 is not among the two fingerprints in the deployed file, verification silently fails and Android routes the link to the browser. This is the leading hypothesis and cannot be confirmed from the repo.
- **1b (reminder tap):** depends only on the `mentalwallet://` scheme + the notification-response handler firing on-device with `data.cardId` intact — independent of `assetlinks.json`. If it fails on the device but worked on the emulator, the break is in on-device notification-response delivery, not native config.

### Approach: instrument first, then fix (per debugging steering)

**Step 1 — Diagnose on the physical, Play-signed build (no code fix yet):**

- 1a evidence:
  - `adb shell pm get-app-links com.mentalwallet.app` → record per-domain verification state (`verified` vs `legacy_failure`/`none`).
  - `curl -sSL https://mentalhealthwallet.productsforgood.co/.well-known/assetlinks.json` → confirm it is live, served as `application/json`, no redirect, and which fingerprints it lists.
  - In **Play Console → Setup → App signing**, read the **App signing key certificate** SHA-256. Compare against the deployed file.
- 1b evidence:
  - Add a temporary `if (__DEV__) console.log('[dl] …', …)` in `linking.ts` at: (a) `getInitialURL` right after `getLastNotificationResponseAsync()` (log whether a response exists and `data.type`/`data.cardId`), and (b) inside the `addNotificationResponseReceivedListener` callback in `subscribe` (log fired + `data`). Run a dev/preview build on the device, tap a reminder cold and warm, capture Logcat.

**Step 2 — Fix 1a (if diagnosis confirms fingerprint mismatch):**

- Add Play's app-signing SHA-256 to the live `assetlinks.json` (keep the upload/EAS key fingerprint too), redeploy the worker, and update the repo copy `website/.well-known/assetlinks.json` to match. Confirm `_headers` still pins `Content-Type: application/json`.
- Re-verify: reinstall from the track (or `adb shell pm verify-app-links --re-verify com.mentalwallet.app`, then `pm get-app-links`) → expect `verified`; tapping `…/app/checkin` opens the app on the KPI check-in card, no browser.
- The `mentalwallet://` scheme remains the reliable local fallback (independent of verification).

**Step 3 — Fix 1b (driven by the log, not a guess):**

- If the log shows the response handler is not firing / `data` missing on Android, address that specific gap. Likely candidates (decide based on the log): notification channel/`data` payload survival on Android, or the response-listener registration timing relative to `NavigationContainer` mount. Do **not** ship a second speculative change without a log confirming the first didn't work.
- Add a regression test at the layer that was broken — e.g. the pure mapping "notification `data` → `mentalwallet://wallet?focusCardId=<id>`" extracted as a testable helper — rather than only the already-green route-parsing path.

**Step 4 — Cleanup:** remove all temporary `[dl]` logs (grep the tag) before committing.

### Verification (on-device only — hand to operator)

- 1a: `…/app/checkin` opens the app on the check-in card, cold and warm, on the Play-signed build.
- 1b: tapping a tool's reminder opens that tool, cold (app killed) and warm (backgrounded).
- Custom scheme `mentalwallet://checkin` still works as the local fallback.

---

## Bug 2 — Wire up duration tracking so "Practice time" records

### Current state (verified)

- The tracker is fully built and unit-tested but **never invoked**: `src/utils/activeDurationTracker.ts` (`initialize`/`teardown`, AppState listener + 15-min timeout), `src/stores/durationTrackingStore.ts` (`startTracking`/`stopTracking`/`handleAppBackground`/`handleAppForeground`), `src/services/durationService.ts` (`persist`, discards < 3s). Grep of `src/` (excluding tests) finds no production caller. `App.tsx` doesn't import them.
- The graph query `computeToolOutcomeTrend` (in `src/services/correlationEngine.ts`) already filters duration to `end_status = 'completed'` in both the daily and weekly branches — so timed-out and collapsed sessions are **already excluded** from "Practice time" with no query change needed (this satisfies requirement 5.4).
- The `duration_records` CHECK constraint (`src/data/migrations.ts`, `DURATION_RECORDS_SCHEMA_SQL`) allows only `('completed', 'collapsed')`. The store persists `'timed_out'` on auto-end → that insert would be rejected.

### Chokepoints for start/stop (verified in walletStore / ExpandedContent)

The lifecycle lives in `src/stores/walletStore.ts` (`focusCard`, `expandCard`, `collapseCard`, `returnToStack`; flags `focusedCardId`, `isExpanded`). Completion is recorded in `src/components/wallet/ExpandedContent.tsx` (`handleSubmit`, `handleLinkOnlyAutoComplete` → `submitCompletion` → then `collapseCard`).

**Decision — drive tracking from `walletStore` actions (single chokepoint), with a completion flag to disambiguate:**

- `expandCard()` — every entry into active use funnels here (arrow tap, primary action, deep link, tutorial). Call `startTracking(focusedCardId)` here. This is the "enter active use" point.
- `returnToStack()` — full dismiss. If a session is tracking, `stopTracking('collapsed')`.
- `collapseCard()` — the wrinkle: it's called BOTH on a genuine collapse AND right after a completion. To avoid mislabeling a completed session as "collapsed":
  - Record the completion result first: the completion handlers call `stopTracking('completed')` **before** they call `collapseCard()`.
  - `collapseCard()` calls `stopTracking('collapsed')` only if a session is still active (i.e. the completion path already stopped it, so collapse becomes a no-op for tracking).
  - `stopTracking` already early-returns when `!isTracking`, so a double-call is safe; the ordering (complete-then-collapse) guarantees the correct label.

**Where the completion `stopTracking('completed')` call goes:** in `ExpandedContent` `handleSubmit` (after `submitCompletion` succeeds, non-KPI path) and `handleLinkOnlyAutoComplete` (after `submitCompletion` succeeds), before the existing `collapseCard()`/timeout. Rationale for the component layer: completion is already handled there, and it distinguishes "completed" from "collapsed" cleanly. Use the store directly (`useDurationTrackingStore.getState().stopTracking('completed')`).

Note on the KPI card: KPI check-ins go through `useKpiStore.recordKpi`, not `submitCompletion`. Treat a KPI check-in as a completion too (call `stopTracking('completed')` on that success path) so KPI practice time isn't mislabeled.

**Switching cards:** `startTracking` abandons any prior in-progress session (per the store contract), so focusing a new card and expanding it won't double-count — matches requirement 4.7.

### App root init

Add, alongside the existing effects in `App.tsx`:

```
useEffect(() => {
  const tracker = createActiveDurationTracker();
  tracker.initialize();
  return () => tracker.teardown();
}, []);
```

Background/foreground pause-resume and the 15-min timeout then work as designed (the tracker's AppState listener drives the store's `handleAppBackground`/`handleAppForeground`). Background time is not counted.

### Fix 5 — allow `timed_out` (Option A, chosen)

Chosen: **migrate the CHECK constraint to allow `'timed_out'`** (rather than mapping it to `'completed'`), so auto-ended sessions are saved and remain distinguishable from clean completions — useful signal, and it keeps the door open to counting/analyzing them later. Since the graph query filters to `end_status='completed'`, saved `timed_out` rows are captured but not shown in "Practice time" (requirement 5.4).

Follow the existing `runControlTypeCheckMigration` rebuild pattern (SQLite can't ALTER a CHECK in place):

- New migration `runDurationEndStatusCheckMigration(db)` in `src/data/migrations.ts`, registered in `runMigrations` **after** `runDurationRecordsMigration`.
- Idempotency guard: read `SELECT sql FROM sqlite_master WHERE type='table' AND name='duration_records'`; return early if the table is absent or its DDL already includes `'timed_out'`.
- Rebuild: `PRAGMA foreign_keys=OFF` → `BEGIN` → create `duration_records_new` with `CHECK(end_status IN ('completed','collapsed','timed_out'))` → `INSERT ... SELECT` all rows → `DROP` old → `RENAME` → recreate both indexes (`idx_duration_records_card`, `idx_duration_records_ended_at`) → `COMMIT` → `PRAGMA foreign_keys=ON`; `ROLLBACK` + FK re-enable on error. Preserves existing rows (requirement 5.3).
- Also update `DURATION_RECORDS_SCHEMA_SQL` so fresh installs get the three-value CHECK directly.

### Requirement 6 — disclosure note

Add a short caption near the chart in both surfaces:

- Per-tool: `src/components/insights/PerToolOutcomeTrendsSection.tsx`, just after `<DualAxisChart>` (mirror `styles.summaryText`).
- Wallet-level: `src/components/insights/OutcomeTrendsSection.tsx`, inside the `contentCard` view after `<DualAxisChart>`.

Copy (draft, finalize in tasks): *"Practice time counts time you spend using a tool in the app. It doesn't include time in other apps or external media."* Small, muted caption text; not a dialog. Extract into a shared small component or constant to keep the two copies identical.

### Explainability (requirement 7)

No methodology change (no formula/threshold/tier changes), so the insights-explainability steering's tooltip/help/tier/wireframe update chain is not triggered. Still: read the existing "Practice time" tooltip/help text and confirm it doesn't imply a different data source now that the line is populated; adjust wording only if needed.

---

## Bug 3 — Duplicate minute-axis label

### Root cause (verified)

`src/components/insights/DualAxisChart.tsx` renders three right-axis (duration) ticks via `formatDurationAxisLabel`: `formatDurationAxisLabel(durationMax)`, `formatDurationAxisLabel((durationMax+durationMin)/2)`, `formatDurationAxisLabel(durationMin)`. With `durationMin = Math.min(...,0)=0` and `durationMax = Math.max(...,1)=1`, the top tick = `1m`, the midpoint = `0.5 → Math.round → 1 → 1m`, and the bottom = `0`. Top and middle both render `1m`. `formatDurationAxisLabel(minutes)`: `rounded = Math.round(minutes); return rounded === 0 ? '0' : `${rounded}m``.

### Fix

Make the three ticks distinct regardless of range, scoped to the duration (right) axis only:

- Compute the three tick values, format them, and if adjacent labels collide, collapse the duplicate — e.g. when `durationMax <= 1`, show a single top label (`1m`) and blank/omit the midpoint, or widen the top so max is at least 2 when data is degenerate. Simplest robust approach: dedupe by value — if `formatDurationAxisLabel(mid) === formatDurationAxisLabel(max)` or `=== formatDurationAxisLabel(min)`, render the midpoint as empty string. This guarantees no repeated visible label in the zero/tiny cases while leaving normal multi-minute ranges unchanged.
- Do not touch the left score axis (`10/5/1`) or the "Felt better" series.
- Holds independently of Bug 2: with all-zero data (max=1, min=0, mid→1) the dedupe blanks the midpoint, so no `1m`/`1m`.

Applies automatically to both surfaces since both render the same `DualAxisChart`.

### Tests

Unit-test the label generation for: all-zero (max=1,min=0), tiny non-zero (e.g. total < 2 min), and normal (e.g. spanning several minutes) — assert no two visible labels are equal.

---

## Testing & verification summary

- **Bug 1:** on-device only; unit regression test on the notification-`data`→URL mapping. State plainly that App Links + reminder delivery are verified on the physical Play-signed build, not in CI.
- **Bug 2:** unit tests for the `timed_out` migration (row persists; idempotent; existing rows preserved) and the start/stop wiring (expand→start, complete→'completed', collapse/return→'collapsed', switch-card no double count). On-device pass: use a tool for a bit, finish it, confirm the Practice time line shows non-zero. Duration is only provable at the DB/store level in CI; the expand→record loop needs a device/simulator pass.
- **Bug 3:** unit tests on label generation (above). Visual check on both Insights surfaces.
- Per project convention: `npm run typecheck` clean for touched files and relevant Jest suites green. Remove any temporary diagnostics.
