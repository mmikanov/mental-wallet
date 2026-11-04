# Implementation Plan — Messaging Drip Automation

Build order: first the two changes to existing campaign behavior (re-key dedupe, generalize
the guard into an N-day gap), each verified before anything new is layered on; then the
sequence model and derived advancement (built from scratch, no seed); then the daily cron,
pause, run-state/status, and preview; then the time-travel test harness (relative-age
sequence-derived test cohort with create/reset); finally build the live sequence by hand +
ops docs + live verification.

All work is in `messaging-worker/`. Typecheck before every deploy:
`cd messaging-worker && npm run typecheck`. Run each migration before deploying code that
depends on it: `npx wrangler d1 execute messaging-db --local/--remote --file=...`.

Verified data baseline (from production): `tip_sends` has 47 rows, 0 NULL `campaign_id`, and
each of the 5 tips maps to exactly one campaign — so the re-key is behavior-preserving on
current data (see design §Change 1).

Legend: each task lists the requirements it satisfies and how to verify it. Tests use the
worker's test setup; prefer unit tests over an injected clock (see Phase 4) so sequence logic
is provable without real time.

---

## Phase 1 — Change existing behavior: per-campaign dedupe (Requirement 4)

- [ ] **1. Re-key `tip_sends` from tip to campaign (migration `0004`).**
  - `messaging-worker/migrations/0004_rekey_tip_sends_to_campaign.sql`: rebuild the table — create `tip_sends_new` with `campaign_id TEXT NOT NULL` and `UNIQUE (campaign_id, email)`, keep `tip_slug` as an audit column, copy all rows, drop old, rename, recreate indexes on `campaign_id` and `email`.
  - No NULL-handling / sentinel needed (0 NULL rows today).
  - _Verify:_ run against local D1; `SELECT COUNT(*)` is still 47; the new unique constraint exists; a manual insert of a duplicate `(campaign_id, email)` is rejected while the same email under a different `campaign_id` is accepted. Do NOT run `--remote` until Task 2 is ready to deploy with it.
  - _Requirements: 4.1, 4.4_

- [ ] **2. Switch campaign send logic from tip-keyed to campaign-keyed.**
  - In `messaging-worker/src/index.ts`: change `selectAudience` `notYetClause` to filter `WHERE campaign_id = ?` (bind `campaign.id`); move the send-time `already` re-check, the `pending`/`sent`/`failed` writes, and the `ON CONFLICT` target to `(campaign_id, email)`; rename `tipSendCounts` → `campaignSendCounts(campaign_id)`; change `resend_all` clear-at-start to delete by `campaign_id`; change the Resend idempotency key from `${tip_slug}:${email}` to `${campaign_id}:${email}`.
  - _Verify:_ unit tests — same campaign never sends to a recipient twice; the SAME tip delivered by TWO different campaigns sends to the same recipient twice (the key new behavior, Req 4.2/4.3). Existing single-campaign-per-tip dedupe still holds. Typecheck passes.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] **3. Deploy Phase 1 and sanity-check. (BACK UP FIRST.)**
  - **Back up remote `tip_sends` BEFORE running `0004` on remote** — `0004` rebuilds the table (copy → drop → rename), so take a restore point first: export the remote DB (or at least `SELECT * FROM tip_sends`) to a timestamped file under `messaging-worker/backups/` (gitignored). Confirm the export has the expected 47 rows.
  - Run `0004` on remote D1 (the single new migration file only — NOT the full `db:migrate:remote` chain, since `0004` drops `tip_sends`). Confirm `SELECT COUNT(*) FROM tip_sends` is still 47 after. Then `npm run deploy`.
  - _Verify:_ `/health` ok; row count preserved (47); an existing campaign's dry-run shows the same audience as before (behavior-preserving on current data); creating a second campaign for an already-sent tip now shows those recipients as eligible again.
  - _Requirements: 4.x_

  > Note: if the production deploy is batched (all migrations 0004–0008 + one deploy at the
  > end), the backup-before-`0004` and the row-count check still apply — do them as the first
  > step of that batched remote migration.

## Phase 2 — Change existing behavior: N-day gap (Requirement 5)

- [ ] **4. Add `gap_days` to campaigns (migration `0005`).**
  - `0005_add_campaign_gap_days.sql`: `ALTER TABLE campaigns ADD COLUMN gap_days INTEGER NOT NULL DEFAULT 1;`
  - _Verify:_ local migration; existing campaigns read `gap_days = 1`.
  - _Requirements: 5.1, 5.3_

- [ ] **5. Generalize the same-day guard into the N-day gap clause.**
  - Replace `SAME_DAY_CLAUSE` with a gap clause that excludes recipients with a `sent` row since a cutoff = start of `(today - (gap_days - 1))` in UTC. Compute the cutoff from `gap_days` (default/min 1 ⇒ cutoff = start-of-today, identical to current behavior). Apply it in all three current sites: the eligibility count, the dry-run preview, and the send-time re-check.
  - Validate/clamp `gap_days` to a minimum of 1 on campaign create/update so it can never be set below 1 (Req 5.3).
  - _Verify:_ unit tests — `gap_days=1` reproduces the no-same-day behavior; `gap_days=7` excludes anyone emailed in the last 7 days and they remain eligible once the gap passes (5.4); create/update rejects or clamps `gap_days < 1`. Typecheck passes.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] **6. Deploy Phase 2.**
  - Run `0005` remote, `npm run deploy`.
  - _Verify:_ existing campaigns behave exactly as before (gap 1); a campaign set to gap 7 defers recently-emailed recipients in a dry-run.
  - _Requirements: 5.x_

## Phase 3 — Sequence model + derived advancement (Requirements 1, 7, 8)

- [ ] **7. Create the sequence table (migration `0006`).**
  - `0006_create_sequence_steps.sql`: `sequence_steps (id TEXT PK, campaign_id TEXT NOT NULL, position INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at, updated_at)` with a uniqueness/order rule on `position`. Index on `position`.
  - _Verify:_ local migration; table + index exist.
  - _Requirements: 1.1, 7.1, 7.2_

- [ ] **8. Implement derived next-campaign resolution (received-based).**
  - Add a function that, for a given subscriber and an evaluation date, returns their next campaign = the earliest `enabled` step in the current `sequence_steps` order whose `campaign_id` they have NOT received (no `sent` row) AND for which they are eligible (opted into the campaign's scope and the campaign's `gap_days` satisfied). Returns a `next` campaign, or a `waiting` / `finished` state.
  - This is the single source of advancement; the carry-over (Req 5.5) and one-at-a-time ordering (Req 1.4) fall out of "earliest unreceived enabled step."
  - _Verify:_ unit tests on synthetic subscribers + sequence (with injected date from Phase 4, or a date param now): welcome-first; one-at-a-time; a subscriber owing step 3 is never offered step 4; a gap-deferred subscriber stays due for the same step; `finished` when all enabled steps received.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.5, 8.2_

- [ ] **9. Sequence-edit operations (build from scratch + live, received-based edits).**
  - Add admin endpoints to build and edit `sequence_steps`: add a step (campaign + position), remove/disable a step, reorder (change positions), set a campaign's `gap_days` — no code change needed to tune the flow (Req 7). Removal unlinks the step but leaves the campaign + its send history intact.
  - Create-from-scratch (Req 7.4): the sequence starts empty; "add the first step" is the create path — no separate seed/populate action (seeding is out of scope).
  - Empty-sequence handling (Req 7.5): resolution over zero enabled steps yields "finished/nothing due" for everyone and the pass sends nothing — no error.
  - No per-subscriber snapshot is created or migrated; resolution (Task 8) reads the live sequence each time.
  - _Verify:_ unit tests — build a sequence from empty by adding steps; an empty sequence resolves to nothing-due with no error; after reorder, next campaign follows the new order with no duplicate of an already-received campaign; inserting a step earlier than a subscriber's frontier makes it their next campaign (may re-engage a finished subscriber, 8.4); removing a step skips it and preserves the campaign (8.5); a gap change takes effect on the next evaluation, forward-only (8.6).
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.3, 8.4, 8.5, 8.6, 8.7_

## Phase 4 — Controllable "today" (foundation for cron, preview, and tests)

- [ ] **10. Thread an evaluation date (`now`) through the drip pass.**
  - Replace direct `new Date()` / `utcToday()` reads in the drip resolution + gap clause with a `now` value passed in. Default to real now in production; allow an explicit `asOf` for admin/test calls. The gap cutoff and "received" checks all derive from this `now`.
  - _Verify:_ unit tests pass an `asOf` and assert eligibility/gap results shift with the simulated date; production path (no `asOf`) uses real now.
  - _Requirements: 10.1 (foundation for all of Req 10)_

## Phase 5 — Daily automation, pause, preview (Requirements 2, 3)

- [ ] **11. Add the drip pass (run one day) over the whole eligible base.**
  - Implement the pass: walk `sequence_steps` in ascending position; for each step's campaign, send (via the existing chunked `production` path — `pending`→send→`sent`/`failed`, consent re-check, idempotency key) to subscribers for whom this step is their earliest unreceived eligible step. A subscriber sent earlier in the same pass is excluded from later steps by the just-written `sent` row + the gap clause (≥1 ⇒ at most one email per subscriber per pass).
  - Empty sequence (Req 7.5): a pass with no enabled steps sends nothing and does not error.
  - _Verify:_ unit tests over a synthetic base + sequence with injected `asOf`: each subscriber gets exactly their one due campaign; no one exceeds one email in a pass; ordering/carry-over honored; an empty sequence is a no-op.
  - _Requirements: 2.2, 2.3, 2.4, 5.5, 1.4, 7.5_

- [ ] **12. Add the `drip_state` record: pause + run-state (migration `0007`).**
  - `0007_create_drip_state.sql`: a single-row (or key/value) `drip_state` with `paused` (bool), `running_since` (nullable timestamp), `last_run_at` (nullable timestamp).
  - Add `POST /drip/pause` and `POST /drip/resume` (set/clear `paused`). The pass no-ops when paused; resuming continues from the live-derived position (no catch-up burst beyond one-per-day).
  - The scheduled pass sets `running_since` at start and clears it in a `finally` (so a crash doesn't leave it stuck), and updates `last_run_at` on completion.
  - _Verify:_ unit tests — paused pass sends nothing; resume lets the next pass proceed; pausing never un-sends; `running_since` is set during a pass and cleared after (even on a thrown error).
  - _Requirements: 3.3, and UI spec Req 6 (run-state)_

- [ ] **12b. Add `GET /drip/status` for the admin UI schedule indicator.**
  - Returns `{ paused, running, lastRunAt, nextRunAt }` where `running = running_since != null` and `nextRunAt` is derived from the fixed daily cron hour.
  - _Verify:_ unit test — status reflects paused/running/last-run correctly; `nextRunAt` computes from the cron hour. (This is what the admin UI polls; the UI itself is a separate spec.)
  - _Requirements: UI spec Req 6.1, 6.2, 6.4_

- [ ] **13. Add the daily Cron Trigger + `scheduled` handler.**
  - Add `[triggers] crons = ["0 14 * * *"]` (UTC hour TBD) to `wrangler.toml` and a `scheduled(event, env, ctx)` export alongside `fetch` that runs the drip pass with real `now` (honoring pause).
  - _Verify:_ unit/integration test invoking the `scheduled` handler runs one pass. NOTE: that the cron actually fires daily is runtime-only — see Task 19.
  - _Requirements: 2.1_

- [ ] **14. Add the preview (dry-run drip pass).**
  - `POST /drip/preview` (dry-run): same resolution as the pass, sends nothing; returns per subscriber (capped like the existing preview) their next campaign, or `waiting` / `finished`. Accepts optional `asOf`.
  - _Verify:_ unit test — preview output matches what a real pass would send for the same `asOf`; shows waiting/finished states correctly.
  - _Requirements: 3.1, 3.2, 11.1_

## Phase 6 — Time-travel test harness (Requirement 10)

- [ ] **15. Mark and isolate test subscribers (migration `0008`).**
  - Add a way to flag test subscribers (`is_test INTEGER NOT NULL DEFAULT 0` on `subscribers`, migration `0008`, or a reserved email domain — decide here). All test actions and simulate operate ONLY on test subscribers and never touch real subscribers' derived position.
  - _Verify:_ unit test — test-only operations never affect non-test subscribers' `tip_sends`.
  - _Requirements: 10.6_

- [ ] **16. Add relative-age test-cohort create + reset (two distinct actions).**
  - `POST /drip/test/create`: generate a batch of test subscribers whose relative ages are **derived from the current sequence** — accumulate enabled steps' `gap_days` to get the age at which a tester is due for each step; add a day-0 tester and one past the end (exact set per design). Each tester's age is applied by backdating its `created_at` to `now - N days`. This action **REPLACES** the whole test cohort: delete all existing test subscribers AND their `tip_sends` first, then insert the fresh set (Req 10.9b — clean cohort, no leftovers).
  - `POST /drip/test/reset`: **keep** the existing test subscribers and their backdated ages, but clear their `tip_sends` so their position restarts (Req 10.9a).
  - Both affect only test subscribers.
  - _Verify:_ unit tests — `test/create` derives the expected ages from a given sequence, replaces any prior cohort (old testers + their `tip_sends` gone), and leaves real subscribers untouched; `test/reset` keeps the same testers/ages but clears their `tip_sends`; changing the sequence then calling `test/create` yields a different age set.
  - _Requirements: 10.7, 10.8, 10.9_

- [ ] **17. Add the step-forward simulation endpoint.**
  - `POST /drip/simulate` accepting `{ startDate, days, mode }`: runs the pass once per simulated day (`startDate` … `startDate+days-1`) using the injected `asOf` (Task 10). `mode: 'dry-run'` sends nothing and returns the per-day plan; `mode: 'production'` is allowed ONLY against test subscribers (refuses non-test). Stepping until no one is due = full-sequence test; a few days = few-days test.
  - _Verify:_ unit tests — a full-sequence simulation delivers every enabled campaign in order to the derived test cohort; a 3-day simulation returns the expected campaign per day; production mode refuses to touch non-test subscribers; the simulation uses the same resolution/gap/uniqueness/carry-over as the real pass (10.10).
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.10_

- [ ] **18. Deploy to production (batched option: all migrations + one deploy).**
  - If deploying everything at once (the recommended cadence), this is the single production touch: **back up remote `tip_sends` first** (timestamped export under `messaging-worker/backups/`, confirm 47 rows), then run the NEW migration files individually against remote in order — `0004` (re-key; rebuilds the table), `0005` (gap_days), `0006` (sequence_steps), `0007` (drip_state), `0008` (is_test) — NOT the full `db:migrate:remote` chain (it would re-drop `tip_sends`). Confirm `tip_sends` row count is still 47 after `0004`. Then `npm run deploy`.
  - _Verify:_ endpoints respond; `GET /drip/status` returns paused/running/next-run; a dry-run `/drip/preview` against the real base shows a sensible plan; `test/create` + `/drip/simulate` dry-run walks the full sequence over the derived cohort.
  - _Requirements: 2–10, UI spec Req 6_

## Phase 7 — Build the sequence, docs, and live verification

- [ ] **19. Build the live sequence from the editorial order (by hand, no seed script).**
  - Using the admin sequence-edit endpoints (Task 9), add the steps in the order in `docs/message-release-plan.md` (welcome → emotion-based-session → outcome-capture → personal-kpi-check-in → discover-third-party-apps → learn-more-evidence), creating any missing campaign per tip (scope `tips`, with its `gap_days`). No seed script — the operator adds the few steps by hand (seeding is out of scope).
  - _Verify:_ `/drip/preview` reflects the intended order; `test/create` then a simulate dry-run delivers tips in that order.
  - _Requirements: 1.1, 1.2, 7.4, 9.1_

- [ ] **20. Live verification + ops docs.**
  - Update `messaging-worker/README.md` and `docs/deployment/messaging-operations.md`: per-campaign (not per-tip) dedupe, the `gap_days` parameter (default/min 1), the sequence edit endpoints, preview/pause/status/simulate/test-create/test-reset, building the sequence by hand, and the drip pass.
  - Observe one real scheduled run (worker logs / new `tip_sends` rows next day) to confirm the cron fires daily — the one thing not provable by the simulation.
  - _Verify:_ docs updated; one live daily run observed firing and sending the expected due campaigns to the real `tips` base.
  - _Requirements: 2.1, 11.2, 11.3_

## Phase 8 — Daily operator summary email (Requirement 12) — shipped

- [x] **21. Email the operator a per-run summary after each daily run.**
  - Added a pure builder `messaging-worker/src/dripSummary.ts` (`buildDripSummary(plan, lastCampaignId, counts, dateIso) → { subject, html, text }`) with unit tests in `src/dripSummary.test.ts`. Wired a best-effort `sendDripSummaryEmail` into `executeDailyDrip` after `last_run_at` is updated; added `OPERATOR_EMAIL` to `interface Env` and `wrangler.toml [vars]` (defaulted to the operator's address).
  - Summary content: delivered emails grouped by campaign (name + tip slug) with recipients; run totals (sent/failed/waiting/finished/total); a distinct final-campaign callout keyed off the last **enabled** step (matching the real drip frontier) listing anyone who reached the end, or stating none did; failed sends listed with email + campaign. Date shown in US Eastern. Both HTML (inline styles) and plain-text bodies, sent via the existing `sendViaResend` path.
  - Gating: sent only after a real production run (never from preview/simulate); NOT sent when paused (the run returns before the call); still sent on a zero-send day with a short "ran — 0 sent" note; skipped if `OPERATOR_EMAIL` is unset. Wrapped in its own try/catch so a summary failure can't disturb the run.
  - _Verified:_ `npx tsc --noEmit` clean; `npm test` 28/28 (7 new builder tests: multi-campaign grouping, last-campaign callout present/absent, zero-send day, failed-send listing, Eastern date, empty sequence). Also rendered the builder with a representative plan to eyeball the subject + bodies.
  - _Honest caveat:_ actual on-cron delivery (the email landing in the operator's inbox from the scheduled run) is confirmed only by observing a live daily run — the drip is paused with an empty sequence, so nothing sends until it is resumed with a non-empty sequence and eligible subscribers.
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9_

---

## Notes

- **Verification honesty (per workflow steering):** Phases 1–6 prove ALL sequence logic
  (order, per-campaign uniqueness, gap, carry-over, mid-flight edits, per-day cadence) via
  unit tests over an injected `asOf` and the simulate harness — no waiting real days. The ONLY
  runtime-only fact is that the Cron Trigger fires daily in production (Task 19); do not claim
  the daily cadence is proven by unit tests.
- **Risk is front-loaded and low:** the `0004` re-key is behavior-preserving on current data
  (47 rows, every tip = one campaign), so Phase 1 should not change any existing send outcome —
  verify that explicitly in Task 3 before building on top.
- **Reuse, don't fork:** the per-recipient send, consent re-check, chunking, and Resend
  idempotency are the existing campaign path; the drip pass orchestrates campaigns through it
  rather than reimplementing sending.
- **Deferred:** behavior-triggered `reminders` come-back nudge (needs a last-activity signal
  not available in the messaging worker) — parked per Requirement 9.
