# Implementation Plan — Messaging Drip Admin UI

A single operator-only HTML page served by the messaging worker (inline CSS + vanilla JS, no
build step), gated by the existing `ADMIN_SECRET`, that drives the drip's admin endpoints. It
adds no sending logic — it is a presentation layer over `messaging-drip-automation`.

**Prerequisite:** `messaging-drip-automation` must be implemented first — this UI calls its
endpoints (sequence CRUD, `GET /drip/status`, `POST /drip/preview`, `POST /drip/pause|resume`,
`POST /drip/simulate`, `POST /drip/test/create`, `POST /drip/test/reset`). Build this spec only
after those exist.

Pattern to follow: the analytics worker's `handleDashboard` + `DASHBOARD_HTML` (single HTML
string with `__DASHBOARD_SECRET__` substituted, served on an admin route). All work is in
`messaging-worker/`. Typecheck before deploy: `cd messaging-worker && npm run typecheck`.

Legend: each task lists the requirements it satisfies and how to verify it. Most verification is
manual/visual on the served page (it's browser UI over a worker); pure JS helpers are
unit-tested where practical.

> **Status:** Shipped and live. Phases 1-6 were implemented and deployed; Phase 7 captures the
> post-launch additions made through hands-on operator testing (campaign create/edit, short
> campaign id, picker filtering, Eastern-time + paused/empty-sequence status clarity, subscriber
> history, simulation/safety refinements, panel renames). The page is served at `GET /admin` by
> the messaging worker and the implementation lives in `messaging-worker/src/adminPage.ts`
> (`ADMIN_HTML`) + `handleAdminPage` in `src/index.ts`, with pure helpers in
> `src/adminHelpers.ts`.

---

## Phase 1 — Served, secret-gated page shell

- [x] **1. Add the `GET /admin` route serving a secret-gated HTML shell.**
  - In `messaging-worker/src/index.ts`, add a route that returns a single HTML string constant (a new `src/adminPage.ts` exporting `ADMIN_HTML`, mirroring analytics `dashboard.ts`), substituting the secret in so the page can authenticate its `fetch` calls. Reject/!ok when the secret is missing or wrong (same `ADMIN_SECRET` check used by other admin routes).
  - Include the shared `api(path, opts)` fetch helper (adds the secret, parses JSON, surfaces errors) and an empty panel layout (Status / Sequence / Preview / Testing) so later tasks fill panels without re-plumbing.
  - _Verify:_ opening `/admin?secret=<ADMIN_SECRET>` returns the page; opening without/with a wrong secret is denied (Req 1.1). Typecheck passes.
  - _Requirements: 1.1, 1.2, 1.3, 1.4 (extensible panel shell)_

## Phase 2 — Status bar: pause/resume + schedule status

- [x] **2. Status bar wired to `GET /drip/status`, with pause/resume.**
  - Poll `GET /drip/status` on load and on a 15-30s timer; render a paused/running badge, a next-run countdown from `nextRunAt`, and a "running now" indicator when `running` is true. Make the paused state visually obvious.
  - Wire Pause / Resume buttons to `POST /drip/pause` / `POST /drip/resume`, then refresh status.
  - Add a subtle "a run is in progress — you may want to hold off editing" hint near the edit controls when `running` is true (informational only; does not disable editing).
  - _Verify (manual):_ badge reflects paused vs running; countdown updates without refresh (Req 6.4); pause then resume flips the state; the running hint appears when a run is in progress.
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

## Phase 3 — Sequence view + editing (auto-save)

- [x] **3. Render the sequence as an ordered list.**
  - Fetch the sequence (drip sequence-list endpoint) and render one row per step: position, campaign + its tip, scope, `gap_days`, enabled/disabled indicator; a header with step count / order at a glance.
  - _Verify (manual):_ the displayed list matches the sequence the drip would run (Req 9.1); enabled vs disabled is clear.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] **4. Sequence editing with auto-save, build-from-scratch, and empty state.**
  - Reorder (up/down or drag) → reorder endpoint; Add (pick an existing campaign, insert/append) → add endpoint; Remove/disable per row → remove/disable endpoint; inline `gap_days` input (UI clamp to min 1).
  - Each change fires its endpoint immediately (no Save button) and then re-fetches so the view reflects the server state (auto-save, Req 3.4). On error, show it and re-fetch so the UI never drifts.
  - Empty sequence → a friendly empty state with an "Add the first step" affordance (Req 3.5, 3.6).
  - _Verify (manual):_ build a sequence from empty by adding steps; reorder/gap-change/remove each take effect immediately and the view updates without a manual refresh; the empty state shows when there are no steps; an error (e.g. gap < 1 rejected server-side) is surfaced and the view re-syncs.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

## Phase 4 — Preview the next run

- [x] **5. "Preview next run" panel.**
  - A button calls `POST /drip/preview` (dry-run) and renders per subscriber (or a capped/summary view) the next campaign, or waiting / finished. Clearly label it a dry run — nothing sent. No confirmation (safe action).
  - _Verify (manual):_ preview output matches calling `/drip/preview` directly with the same state (Req 9.2); the "no emails sent" labeling is clear.
  - _Requirements: 4.1, 4.2_

## Phase 5 — Testing panel (time-travel + test cohort)

- [x] **6. Test cohort controls: create (replace) and reset (keep), presented distinctly.**
  - "Create test users" → `POST /drip/test/create` (worker derives ages from the current sequence and REPLACES the prior cohort). "Reset test users" → `POST /drip/test/reset` (keeps the cohort + ages, clears their send history). Show the two as visually distinct actions, each with a one-line explanation of the difference, and make clear both affect only test subscribers.
  - Display the resulting test cohort (testers + their derived relative ages) after a create/reset.
  - _Verify (manual):_ create builds a fresh cohort and clearly replaces any prior one; reset keeps the same testers; both are labeled test-only; the two actions are not confusable.
  - _Requirements: 7.4, 7.5, 7.6_

- [x] **7. Simulation runner with per-day results grid + mode toggle.**
  - Inputs: start date, number of days; a "full sequence" option (step until complete) and a few-days option. Calls `POST /drip/simulate` and renders a per-day table (rows = simulated days, cells = each test subscriber's campaign / waiting / finished).
  - Mode toggle: no-send (dry-run, default/safe) vs send-to-test (production, worker restricts to test subscribers). Always label the active mode.
  - _Verify (manual):_ a full-sequence run shows every enabled campaign in order across the derived cohort; a few-days run matches the per-day expectation; the grid only reflects `/drip/simulate` output (no client-side recompute, Req 7.7); the active mode is always clear.
  - _Requirements: 7.1, 7.2, 7.3, 7.7_

## Phase 6 — Safety, errors, deploy, verification

- [x] **8. Safety model: classify actions, confirm real sends, surface errors.**
  - Visually separate safe actions (view, preview, no-send simulation, pause/resume, sequence edits, create/reset test cohort) from sending actions. Any action that delivers real email — the send-to-test simulation now, and any future real-subscriber send — requires an explicit confirm dialog before the call fires.
  - Ensure the `api()` helper surfaces every non-OK response as a readable message in the relevant panel (no silent failures).
  - _Verify (manual):_ send-to-test prompts a confirmation before sending; a forced endpoint error renders a readable message; safe actions do not prompt.
  - _Requirements: 8.1, 8.2, 8.3, 9.3_

- [x] **9. Unit-test the pure page helpers.**
  - Extract and unit-test any non-trivial pure JS: next-run countdown formatting from `nextRunAt`, and building the per-day simulation grid from a `/drip/simulate` response. (Same Node test-runner approach as the analytics worker's `retention.test.ts` if practical.)
  - _Verify:_ helper tests pass; typecheck passes.
  - _Requirements: 9.1, 9.2 (display fidelity of the pure transforms)_

- [x] **10. Deploy and verify on the live page; update ops docs.**
  - `cd messaging-worker && npm run deploy`. Open `/admin?secret=<ADMIN_SECRET>` and exercise each panel against the test-subscriber data: status, build/edit sequence, preview, create/reset cohort, run a full-sequence simulation (dry-run), then a send-to-test with confirmation.
  - Update `messaging-worker/README.md` and `docs/deployment/messaging-operations.md` with the `/admin` URL and a short description of the panels (the curl commands remain valid alongside it).
  - _Verify (manual, honest caveat):_ as browser UI served by a worker, correctness is confirmed by opening the live page and exercising each panel — not solely by unit tests. Confirm auth is required, the sequence/preview/simulation match the underlying endpoints, and real-send is gated by confirmation.
  - _Requirements: 1.1, 9.1, 9.2, 9.3_

## Phase 7 — Post-launch additions (built after the first version shipped)

These were added through hands-on operator testing after Phases 1-6 shipped. Each was
implemented, typechecked, tested (where unit-testable), deployed, and committed. Verification for
the browser-interaction parts is at the typecheck/test + code-review level plus the served-page
markup; the live click-through needs the operator's admin secret (honest caveat per steering).

- [x] **11. Reorder robustness + actions-cell alignment.**
  - Rewrote the move up/down handler to send an absolute target position; the worker now rebuilds the ordering deterministically (park at high temporary positions, then renumber 1..N) to avoid the `UNIQUE(position)` collision that made the buttons silently do nothing. Fixed the actions cell row-height alignment (dropped the flex `row` class for an `actions-cell` with `white-space:nowrap`).
  - _Verified:_ end-to-end on `wrangler dev` — move-up, move-down, and mid-list moves reorder positions contiguously with no collision; typecheck + tests green.
  - _Requirements: 3.1, 2 (table layout)_

- [x] **12. Create and edit campaigns from the screen (Req 10).**
  - **Create:** New Campaign panel posts `{ name, tip_slug, scope }` to `POST /campaigns`; tip dropdown from `GET /drip/tip-slugs` (shared `tipSlugsCache`); gap deliberately removed from this form (gap is a per-step sequencing knob). **Edit:** per-row inline editor PATCHes `/campaigns/<campaign_id>` with the changed fields; step keeps referencing the same campaign (membership/order unchanged).
  - **Sent-content lock allowing rename (Req 10.3):** worker guards only tip/scope/mode when status is `sent`/`sending`; name stays editable. UI disables the Tip/Scope dropdowns with a note on a sent campaign and sends only `{ name }`. Added `campaign_status` to the sequence payload so the UI can tell.
  - **No stale labels (Req 10.5):** a successful edit calls `refreshSequence()`, which re-renders both the sequence and the add picker, so a rename updates everywhere without reload.
  - _Verified:_ end-to-end on `wrangler dev` — PATCH `{name,tip_slug,scope}` updates a not-yet-sent campaign and the sequence reflects it; a sent campaign returns `409` for content changes and succeeds for a name-only change; typecheck + tests green.
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] **13. Short campaign id in each sequence row (Req 2.4).**
  - Each row shows the first 8 chars of `campaign_id` in parentheses, muted, next to the name (campaign id, not step id).
  - _Verified:_ served-page markup; typecheck green.
  - _Requirements: 2.4_

- [x] **14. Add-step picker excludes campaigns already in the sequence (Req 3.7).**
  - `loadCampaignOptions(seqSteps?)` builds an exclusion set from the current steps and filters `GET /campaigns`; `refreshSequence` passes its fetched steps in (no double fetch), the empty branch offers all, and startup calls only `refreshSequence` to avoid an unfiltered flash. Adding a step removes it from the picker; removing adds it back.
  - _Verified:_ served-page markup contains the filter; typecheck + tests green.
  - _Requirements: 3.7_

- [x] **15. Clearer, state-aware next-run status: Eastern time, paused caveat, empty-sequence hint (Req 6.5-6.7).**
  - `fmtEastern` renders next-run/last-run in `America/New_York` (DST-aware) with the zone label; the paused line no longer implies an imminent run (shows the would-be time once resumed); an empty-sequence hint appears when the sequence has no steps.
  - _Verified:_ typecheck + tests green; served-page markup.
  - _Requirements: 6.1, 6.5, 6.6, 6.7_

- [x] **16. Subscriber history panel (Req 11).**
  - Lookup by email calls `GET /drip/subscriber-history`, which merges subscription events (`subscriber_events` log via `logSubscriberEvent`, with a one-time backfill) and sends into a date-ordered, read-only timeline.
  - _Verified:_ remote migration applied; endpoint returns the merged timeline; typecheck + tests green.
  - _Requirements: 11.1, 11.2, 11.3_

- [x] **17. Simulation + safety refinements from operator testing.**
  - Signup-date-aware simulation (skip pre-signup days; default start = earliest tester signup); per-day "sends that day" summary grouped by campaign; `campaign_name` carried in plan entries; Reset clears the prior sim view and shows a success banner; test subscribers (`is_test = 1`) excluded from every real-send path and the dry-run preview.
  - _Verified:_ typecheck + tests green; exercised via simulate on `wrangler dev`.
  - _Requirements: 7.1, 7.2, 7.3, 8.1_

- [x] **18. Panel renames for clarity.**
  - Status panel heading → "Drip Status"; Testing panel heading → "Drip Testing (time-travel)".
  - _Requirements: 2, 7 (clarity)_

---

## Notes

- **Depends on `messaging-drip-automation`** for every endpoint it calls; build this only after
  that ships. If a needed endpoint (e.g. `GET /drip/status`) is missing, it belongs in the drip
  spec, not here.
- **No new sending behavior (Req 1.3):** every action is a call to an existing drip endpoint;
  the page never emails anyone directly. Consent/dedupe/gap/schedule stay in the worker.
- **Extensible shell (Req 1.4):** panels are independent, so standalone-campaign / one-off-send /
  subscriber-management panels can be added later without reworking the shell.
- **Verification honesty (per workflow steering):** this is browser UI; the substantive logic is
  the drip worker's (already unit-tested in that spec). This spec's verification is mostly visual
  on the served page plus unit tests for the pure display helpers. Do not claim UI correctness is
  proven by unit tests alone.
