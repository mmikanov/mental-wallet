# Implementation Plan — Channel Attribution

Build order follows the design's deploy sequence: make the data pipeline and dashboard ready
first (worker), then the landing-page forwarding, then the app build that actually reads the
tag on Android. This way, when the app ships, tagged Android installs attribute immediately.

Prerequisite: `.kiro/specs/retention-cohorts/` must be implemented first — the per-channel
breakdown's retention column (Req 6.2) depends on the cohort retention metric it introduces.

Legend: each task lists the requirements it satisfies and how to verify it. Tests use the
project's existing runners (Jest for the app; the worker's test setup for `analytics-worker/`).

---

> **Status (2026-10-06):** Phases 1-3 are **done, deployed, and live** (worker, dashboard,
> landing page, operator doc). Phases 4-5 (the Android app build that reads the Play Install
> Referrer, and on-device/App-Store-Connect verification) are **NOT done** — they require a
> native EAS build + a real device and are an operator-driven app release. Until that ships,
> every install reads as organic/untagged (expected and backward-compatible). See the
> per-phase checkboxes below and the "What is NOT yet done" note at the end.

## Phase 1 — Worker: ingest, store, and expose channel

- [x] **1. Add the `channel` column and index (migration).**
  - Create `analytics-worker/migrations/0005_add_channel_column.sql`: `ALTER TABLE events ADD COLUMN channel TEXT;` and `CREATE INDEX IF NOT EXISTS idx_events_channel ON events (channel);` (mirrors `0002` promoting platform/os/app_version).
  - Historical rows get `NULL` → organic/untagged (no backfill needed).
  - _Verify:_ run migration against local D1 (`wrangler d1 execute analytics-db --local --file=...`); confirm the column + index exist. Do NOT run `--remote` until the ingest code (Task 2) is ready to deploy with it.
  - _Requirements: 3.1, 6.1 (data substrate)_

- [x] **2. Promote `properties.channel` to the `channel` column at ingest.**
  - In `handleEvents` (`analytics-worker/src/index.ts`), extract `properties.channel` and bind it into the existing `INSERT INTO events (... channel ...)` statement (add the column to the INSERT), the same way `platform`/`os_version`/`app_version` are pulled from the event today.
  - Keep storing the full `properties` JSON unchanged (channel also stays inside it — denormalized per the design decision; the column is the fast query path).
  - _Verify:_ unit test ingesting synthetic events with and without `properties.channel`; assert the column is populated when present and `NULL` when absent. `cd analytics-worker && npx tsc --noEmit -p tsconfig.json` passes.
  - _Requirements: 3.1, Key Decision (denormalized channel)_

- [x] **3. Add `channel` as a third global filter in the worker.**
  - Thread a `channel` query param through `handleKpis` (via the `dateFilter`/`withFilter` mechanism) and `buildDetailFilter`, as an additional predicate `AND channel = ?`. A reserved value (e.g. `organic`) maps to `channel IS NULL`.
  - Follow the param-binding discipline: when the clause repeats N times in one SQL string, repeat its param N times in order (see `handleDetailUsers`).
  - _Verify:_ unit tests — a `channel=reddit` filter scopes KPI counts to only reddit events; `channel=organic` returns only untagged users; the channel filter composes with `from`/`to` and `cohort=new`. Typecheck passes.
  - _Requirements: 6.3, 6.4_

- [x] **4. Add the per-channel breakdown data.**
  - Add a `/details/channels` drill-down endpoint (closest template: `handleDetailPlatforms`) returning one row per channel plus an organic/untagged row, each with: new installs, activation, wallet growth, and cohort retention (reuse the retention-cohorts cohort calculation for the retention figure). Include the raw denominator/count alongside each rate.
  - Respect phase (`from`/`to`) and cohort (`active`/`new`) filters like every other endpoint.
  - _Verify:_ unit tests over synthetic multi-channel event sets with known expected per-channel installs/activation/retention, including: an organic (untagged) group, a channel too small to read (returns count + suppressed/"n/a" rate per Req 6.6), and correct behavior under a phase window. Typecheck passes.
  - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [x] **5. Deploy the worker and sanity-check.** _(DONE 2026-10-06)_
  - Run migration `0005` against remote D1, then `cd analytics-worker && npm run deploy`.
  - **As built:** migration `0005` applied to remote `analytics-db` (verified: `channel` column + `idx_events_channel` index present). Worker deployed, Version ID `366bae18`. `/health` → 200; `/details/channels` is secret-gated (401 without secret), confirming it is wired into the router. Pre-app-release, every row reads organic (expected).
  - _Verify:_ `/health` ok; existing KPIs unchanged (channel is additive); `/details/channels` returns an all-organic breakdown (nothing is tagged yet, which is expected pre-app-release). This confirms the pipeline is ready and backward-compatible.
  - _Requirements: 8.2 (analytics stays anonymous/additive)_

## Phase 2 — Dashboard: channel filter + breakdown UI

- [x] **6. Add the channel filter control to the dashboard.**
  - In `analytics-worker/src/dashboard.ts`, add a channel selector (populated from the channels present in the data, plus an "Organic / untagged" entry and an "All channels" default). Serialize it in `getPhaseParams()` as `&channel=<label>` so it flows to `/kpis` and every `/details/*` fetch (single source of truth for query params).
  - _Verify:_ selecting a channel re-renders all metric cards scoped to that channel; "All channels" restores the unscoped view; channel + phase + active/new combine correctly. Visual check in the live dashboard after deploy.
  - _Requirements: 6.3, 6.4_

- [x] **7. Add the per-channel breakdown section to the dashboard.**
  - Render a section (one row/card per channel + organic) showing installs, activation, wallet growth, and cohort retention, with the raw count shown next to each percentage and the small-sample suppression applied (Req 6.6). Clearly label the organic/untagged entry (Req 6.5).
  - Add dashboard copy stating plainly: iOS link installs appear under organic here (real iOS channel data lives in App Store Connect), and attribution is directional, not exact (Req 5.3, 9.1, 9.2).
  - _Verify:_ breakdown renders from `/details/channels`; organic row is distinct; small channels show count + "n/a"/suppressed rate rather than a fragile percentage. Visual check live.
  - _Requirements: 6.1, 6.2, 6.5, 6.6, 5.3, 9.1, 9.2_

- [x] **8. Deploy the dashboard.** _(DONE 2026-10-06 — shipped in the same worker deploy, `366bae18`)_
  - `cd analytics-worker && npm run deploy`.
  - **As built:** the dashboard is part of the analytics worker, so it shipped with the Task 5 deploy (`366bae18`). Live rendering of the selector/breakdown against real data is operator-verifiable on `/dashboard?secret=…` (needs the dashboard secret) — unit/typecheck/inner-JS-syntax proven here, live visual check is the honest caveat.
  - _Verify:_ dashboard loads; channel filter + breakdown appear and read correctly against current (all-organic) data.
  - _Requirements: 6.x_

## Phase 3 — Landing page: forward the tag to the store

- [x] **9. Forward an incoming channel tag to the store badges.**
  - Add a small inline script (extend the existing `app-fallback.html` inline pattern, or add to `website/script.js` and include it on `index.html`) that on load reads `utm_source` (+ optional `utm_campaign`) from `location.search` and, if present, rewrites each store badge `href`:
    - Google Play badge → append `&referrer=` with URL-encoded `utm_source=<channel>` (what the Play Install Referrer later returns).
    - App Store badge → append campaign token params (`ct=<channel>`, optional `pt=`).
  - Persist the tag in `localStorage`/first-party cookie so a multi-page visit still forwards it on a later badge tap.
  - Apply to all three badge locations: `website/index.html` hero (~L49–55) and CTA (~L138–144), and `website/app-fallback.html` `#store-badges` (~L96–102).
  - No visual/copy change; if no tag is present, badges keep their current plain URLs.
  - _Verify:_ load the page with `?utm_source=reddit` → both badge hrefs carry the correct `referrer`/`ct`; load with no param → badges unchanged (organic). Open the generated page directly in a browser (no network needed) to confirm. Then `cd website && npm run deploy` and re-verify on the live URL.
  - **As built (DONE 2026-10-06):** `website/script.js` (`forwardChannelTag()`, used by `index.html`) + an inline script in `app-fallback.html`; rewrites Google Play `referrer` and App Store `ct`, persists the tag in `localStorage` across a visit. Deployed (Version ID `f391bbf1`); live site serves the forwarding script and the store badges. 6 dependency-free unit tests green. A follow-up `.assetsignore` was added so the test file isn't served publicly (commit `5864b39`). The JS href-rewrite is browser-runtime, so a true tagged click-through is the operator's live check.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_

- [x] **10. Document the channel tag scheme for the operator.**
  - In `docs/outreach-templates.md`, add a short "Channel tags & links" section: the canonical channel labels, the landing-page link form (`...productsforgood.co/?utm_source=<channel>`), and the store-direct forms. Keep labels stable across experiments.
  - _Verify:_ the doc lists each first-wave channel (reddit, linkedin, therapist, organic) with its ready-to-share link.
  - _Requirements: 1.1, 1.2, 1.3_

## Phase 4 — App: read the tag on Android and stamp it on events

- [x] **11. Add the write-once channel storage helper (app).** _(DONE 2026-10-07, commit `c52e01f`)_
  - Add a service (e.g. `src/services/analyticsChannel.ts`) that stores/reads the resolved `channel` write-once, mirroring `getDaysSinceInstall()` in `src/services/analyticsRetention.ts` (local `settings` table via `INSERT OR IGNORE`, or SecureStore alongside `anonymous_user_id`). Never overwrite once set.
  - **As built:** `src/services/analyticsChannel.ts` — `getStoredChannel()` / `setChannelOnce()`, write-once in the SQLite `settings` table (key `install_channel`) via `INSERT OR IGNORE`, mirroring `analyticsRetention.ts`. Blank input ignored, never overwrites, never throws. Unit test `src/services/__tests__/analyticsChannel.test.ts` covers all cases — passing.
  - _Verify:_ unit test — first write sets the value; a second write with a different value does NOT overwrite; reading when unset returns null/none.
  - _Requirements: 4 (persistence), 7 (no overwrite surprises)_

- [x] **12. Read the Play Install Referrer on Android and resolve the channel.** _(DONE at the logic level 2026-10-07, commit `c52e01f` — native read STUBBED, see note)_
  - Add the install-referrer native module + Expo config plugin (a `react-native-play-install-referrer`-style wrapper around `com.android.installreferrer`). On first launch (Android only), read the referrer once, parse `utm_source`, and pass it to the write-once helper. iOS: no-op (no reliable device-side signal — by design).
  - **As built:** `src/services/installReferrer.ts` — Android-guarded `readInstallReferrer()` (iOS/other = no-op) + a pure `parseChannelFromReferrer()` for `utm_source` (handles URL-encoding, extra params, and a missing `utm_source`). `resolveInstallChannelOnce()` is wired into `analyticsStore.initialize()`, Android-guarded and NON-BLOCKING (fire-and-forget) so it never delays the first `app_opened`. Parse/store logic is unit-tested.
  - **⚠️ Native read is a documented STUB.** The actual native call into `com.android.installreferrer` is a stub body in `installReferrer.ts` (marked with a comment) — it returns null until the operator adds the real native module. The parse/store/stamp logic around it is real and tested. Making the native read real is **Task 14** (operator: add `react-native-play-install-referrer` + its Expo config plugin, swap only the stub body, native rebuild). Install-time delivery is NOT unit-provable; it is verified on-device in **Task 15**.
  - _Verify:_ unit test with a mocked referrer string asserts `utm_source` is parsed and stored once; empty/absent referrer stores nothing (stays organic). NOTE: real install-time delivery is NOT provable by unit tests — see Task 15.
  - _Requirements: 4.1, 5 (iOS no-op)_

- [x] **13. Stamp the stored channel onto every analytics event.** _(DONE 2026-10-07, commits `c52e01f` + `61d9e19`)_
  - Attach the stored `channel` in the common event-property construction used by `logEvent` (`src/services/analyticsEventLogger`) / `src/stores/analyticsStore.ts`, so it rides in `properties` on every event once known. Do not change individual call sites.
  - **As built:** `analyticsEventLogger.ts` caches the channel in module state (`setLoggerChannel`) and stamps `properties.channel` in the common assembly. **Opt-out fix (`61d9e19`):** the stamp is gated on **opt-in directly** (`if (optIn && cachedChannel && properties !== undefined)`), not just `properties !== undefined` — review caught that `session_ended` re-populates `properties` (with `session_duration_ms`) AFTER the opt-out strip, which would have leaked the channel on an opted-out session (Req 8). Regression test added. Non-blocking startup also proven by a test that hangs the resolution promise and confirms `app_opened` still logs.
  - _Verify:_ unit test — once a channel is stored, emitted events include `properties.channel`; when none is stored, events carry no channel. Full app test suite + `npm run typecheck` pass. **Verified:** `analyticsChannel` + `analyticsEventLogger` suites pass; typecheck adds zero new errors; the one failing `analyticsStore` test is a pre-existing, unrelated transmitter-config assertion.
  - _Requirements: 4.2, 7.1, 7.2, 8.1_

- [ ] **14. Build and release the app (per the release checklist).**
  - Bump the marketing version (`npm run set-version -- <next>` — the 4-file sync), commit/push, prepare release notes, `eas build`, submit. Android is the platform that gains device-side attribution; iOS ships the no-op + continues relying on App Store Connect + windows.
  - _Verify:_ build succeeds on both platforms; app launches; no new user-facing UI appeared (Req 7.2). Confirm the running build includes the change with a one-time dev marker before relying on it.
  - _Requirements: 7.1, 7.2 (no friction/UI change)_

## Phase 5 — End-to-end verification

- [ ] **15. On-device Android attribution check (the honest, runtime-only verification).**
  - Using an internal-track build, install via a tagged link (`...&referrer=utm_source%3Dreddit` or the landing-page `?utm_source=reddit` → Play badge) on a real device/emulator that supports the Play Install Referrer. Confirm the install's events arrive with `channel=reddit` and the dashboard breakdown attributes it to reddit; an untagged install lands in organic.
  - State plainly in the task notes: this is the layer unit tests cannot prove (native install-time signal) — it is verified here on-device, not claimed from the unit suite.
  - _Verify:_ dashboard `/details/channels` shows the test install under the correct channel; untagged test install under organic.
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] **16. Time-window separation check (both platforms, incl. iOS).**
  - Run two tagged channels (or one tagged + organic) in separate windows; confirm the dashboard phase filter keeps their results distinguishable. For iOS, confirm the campaign token surfaces in App Store Connect source analytics (store-console side) and that the time window separates iOS results.
  - _Verify:_ phase-filtered dashboard shows each window's channel results separately; App Store Connect shows the iOS campaign token.
  - _Requirements: 10.4, 5.1, 5.2_

---

## What is NOT yet done (as of 2026-10-06)

The data pipeline, dashboard, and landing page are live, and the app-side logic (Tasks 11-13)
is **done, merged, and tested** — BUT **no install carries a channel yet** because (a) the
native install-referrer read is still a stub and (b) no build with this code has shipped.
Remaining work, all operator/app-release-driven:

- ✅ **Task 11 — write-once channel storage** — DONE (`src/services/analyticsChannel.ts`).
- ✅ **Task 12 — parse + store the referrer** — DONE at the logic level; the **native read is a
  documented stub** that returns null until the real module is wired (part of Task 14).
- ✅ **Task 13 — stamp the channel onto events** — DONE (opt-in-gated, non-blocking).
- ⬜ **Task 14 — wire the real native module + build and release the app.** Add
  `react-native-play-install-referrer` + its Expo config plugin, swap the stub body in
  `installReferrer.ts`, then version-bump + `eas build` + submit. **This requires a native EAS
  build and is the only part that puts attribution end-to-end into users' hands.** See the
  step-by-step operator guide in the 1.0.6 release plan (`docs/release-plans/1.0.6.md`).
- ⬜ **Task 15 — on-device Android attribution check** (real device/emulator; the native
  install-time signal cannot be proven by unit tests).
- ⬜ **Task 16 — time-window separation check** on both platforms, incl. confirming the iOS
  campaign token in App Store Connect.

Until a build with the real native module ships, the dashboard correctly shows every install as
organic/untagged.

**Non-blocking fast-follow (reviewer note):** the per-channel D7/D30 retention in
`handleDetailChannels` applies the phase window to the aggregation rather than filtering on
first-open like the headline cohort metric — directionally safe (windowed view only), worth
tidying for exact parity but not required for the shipped Phases 1-3.

---

## Notes

- **Verification honesty (per workflow steering):** Tasks 1–13 are unit-provable (parsing,
  storage, ingest, filtering, breakdown math). The native install-time attribution (Task 15)
  and iOS store-console attribution (Task 16) are **runtime/on-device/console-only** and must
  be verified there, not inferred from green unit tests.
- **Deploy order matters:** Phases 1–3 make the pipeline ready and are backward-compatible
  (everything reads organic until the app ships). Phase 4 is the app release; Phase 5 proves
  the whole path end to end.
- **Prerequisite:** retention-cohorts (for Req 6.2's cohort retention column). If it is not
  yet implemented, Tasks 4/7 can ship the breakdown with installs/activation/wallet-growth
  first and add the cohort-retention column once retention-cohorts lands.
- **Privacy:** nothing here writes to the messaging worker; the channel is a non-personal
  label on anonymous events only.
