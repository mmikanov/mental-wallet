# Design Document — Messaging Drip Automation

## Overview

This design turns the manual campaign-sending flow into an automatic daily drip: a fixed,
ordered list of campaigns that every subscriber moves through one at a time, run by a daily
schedule, with preview/pause and a time-travel test harness. It is piece **1c** of the
measurement foundation in `docs/gtm-icp-discovery-plan.md`.

All work is in `messaging-worker/` (Cloudflare Worker + D1 `messaging-db`, sends via Resend).
It both **extends** the existing campaign machinery and **changes** two of its existing
behaviors:

1. **Re-key dedupe from tip to campaign** (Requirement 4) — so a tip can intentionally recur
   via a different campaign.
2. **Generalize the same-day guard into an N-day gap** with a default/minimum of 1
   (Requirement 5) — the existing "no two emails in one day" becomes the N=1 case.

On top of that it adds: a **sequence** (ordered campaigns), **per-subscriber advancement**
(received-based, evaluated live), a **daily Cron Trigger**, **pause**, and a
**controllable-"today" test harness**.

The design deliberately reuses the existing send path (`sendTipEmail`, individual non-BCC
sends, Resend idempotency key), consent enforcement (scope columns + mid-run re-check), and
the chunked execute model.

## Requirements Traceability

| Requirement | Where addressed |
|---|---|
| 1 — Fixed ordered sequence | §Sequence Model, §Advancement (received-based) |
| 2 — Automatic daily sending | §Daily Run (Cron) |
| 3 — Preview & pause | §Preview, §Pause |
| 4 — Per-campaign uniqueness | §Change 1: Re-key Dedupe to Campaign |
| 5 — N-day gap + carry-over | §Change 2: Generalize Guard to N-Day Gap, §Advancement |
| 6 — Consent (reuse) | §Reused Unchanged |
| 7 — Operator edits sequence / builds from scratch / empty sends nothing | §Sequence Model (data-driven), §Sequence admin endpoints |
| 8 — Edit mid-flight (live, received-based) | §Advancement, §Why No Snapshot, §Concurrency |
| 9 — Scope (tips now, reminders parked) | §Scope & Parked Work |
| 10 — Testing the sequence (relative-age testers, derived batch, create/reset) | §Test Harness (Controllable "Today") |
| 11 — Success verification | §Testing Strategy |
| 12 — Daily operator summary email | §Daily Operator Summary Email |
| UI spec Req 6 — run-state for the schedule indicator | §Run-state signal |

## Current State (what exists today)

- **`campaigns`** (migration `0002`): `id, name, tip_slug, scope, mode (new_only|resend_all),
  status, timestamps`. One campaign = one tip + scope.
- **`tip_sends`** (migration `0003`): `UNIQUE (tip_slug, email)` — dedupe is **tip-keyed**.
  Comment explicitly says this is so "already received this tip" survives campaign deletion.
- **`selectAudience(env, campaign, limit)`** builds eligibility: opted-in to the scope,
  `notYetClause` (no `sent`/`pending` `tip_sends` row for the tip), and `SAME_DAY_CLAUSE`
  (`AND s.email NOT IN (SELECT email FROM tip_sends WHERE status='sent' AND substr(sent_at,1,10)=?)`),
  ordered by `created_at`.
- **`handleExecuteCampaign`** (`POST /campaigns/:id/execute`) runs one chunk in `dry-run` or
  `production`; writes `pending` before send, `sent`/`failed` after; re-checks consent and
  same-day at send time; `resend_all` clears the tip's history once at run start.
- **Routing** is a `fetch` handler only. **No `scheduled` handler and no cron** in
  `wrangler.toml` yet.
- **`subscribers`** (migration `0001`): `scope_tips`, `scope_reminders`, `created_at`, etc.

## Data Model Changes

### Change 1: Re-key dedupe to campaign (Requirement 4)

Replace the tip-keyed uniqueness with campaign-keyed, so the same tip can be sent by multiple
campaigns.

- New migration `0004_rekey_tip_sends_to_campaign.sql`:
  - The send record becomes keyed by **campaign + email** instead of **tip + email**.
    Concretely: make `campaign_id` NOT NULL and add `UNIQUE (campaign_id, email)`; keep
    `tip_slug` as an audit/informational column. Because SQLite can't easily alter a UNIQUE
    constraint in place, this is a table rebuild: create `tip_sends_new` with the new
    constraint, copy all rows, drop old, rename. Keep indexes on `campaign_id` and `email`.
  - **Verified against production data (low risk):** `tip_sends` currently has 47 rows, **0
    with NULL `campaign_id`**, and every tip maps to exactly **one** campaign (5 tips, 5
    campaigns, one `(tip_slug, campaign_id)` pair each). So the re-key needs **no**
    NULL-handling and **no** sentinel: every existing row already has a `campaign_id` to copy.
    And because each tip has exactly one campaign today, the old `(tip_slug, email)` and the
    new `(campaign_id, email)` uniqueness are **equivalent on current data** — the rebuild
    cannot collide or merge rows. The change is therefore **behavior-preserving on existing
    data** and only *enables* the future case of one tip sent by multiple campaigns.
  - Rename is semantic only; the table name `tip_sends` MAY be retained to minimize code
    churn (a `campaign_sends` rename is optional cosmetic cleanup, deferred).
- Code changes in `messaging-worker/src/index.ts`:
  - `selectAudience` `notYetClause`: change the dedupe subquery from
    `WHERE tip_slug = ?` to `WHERE campaign_id = ?` (bind `campaign.id`, not
    `campaign.tip_slug`).
  - Send-time idempotency re-check (`already`), the `pending`/`sent`/`failed` writes, and the
    `ON CONFLICT` target all move from `(tip_slug, email)` to `(campaign_id, email)`.
  - `tipSendCounts` becomes `campaignSendCounts(campaign_id)`.
  - `resend_all` clear-at-start deletes by `campaign_id`, not `tip_slug`.
  - Resend idempotency key changes from `${tip_slug}:${email}` to `${campaign_id}:${email}`
    so repeating a tip via a new campaign is not collapsed by Resend's own dedupe.
- **Consequence (documented):** the old guarantee "a new campaign for the same tip can't
  re-trigger it" is intentionally removed — that is exactly Requirement 4.2/4.3. Campaign
  deletion no longer needs to preserve a tip-level block; send history is per-campaign and may
  be removed with the campaign (or retained for audit — decided in tasks).

### Change 2: Generalize the same-day guard into an N-day gap (Requirement 5)

- Add a `gap_days` column to `campaigns` (migration `0005_add_campaign_gap_days.sql`),
  `INTEGER NOT NULL DEFAULT 1`, with a stored/validated **minimum of 1** (Req 5.3). A gap of 1
  reproduces today's same-day behavior exactly.
- Generalize `SAME_DAY_CLAUSE` into a gap clause. Today it excludes anyone with a `sent` row
  dated **today**; the generalization excludes anyone with a `sent` row within the last
  `gap_days` days:
  ```
  AND s.email NOT IN (
    SELECT email FROM tip_sends
    WHERE status = 'sent' AND sent_at >= ?   -- cutoff = start of (today - (gap_days - 1)) in UTC
  )
  ```
  For `gap_days = 1` the cutoff is start-of-today, identical to the current guard. The cutoff
  is computed in UTC to match how `sent_at` is stored and how `utcToday()` already works.
- Apply the gap clause in the same three places the same-day guard is used today: the count,
  the dry-run preview, and the send-time re-check (so preview matches reality and concurrent
  campaigns can't violate the gap).

### New: the sequence (Requirement 1, 7, 8)

- New table `sequence_steps` (migration `0006_create_sequence_steps.sql`):
  `id, campaign_id (FK/ref to campaigns.id), position INTEGER, enabled INTEGER DEFAULT 1,
  created_at, updated_at`, with `UNIQUE (position)` (or a normalized ordering the operator can
  edit). This is the **single, data-driven** definition of the drip order — editing it changes
  order/membership without a code change (Req 7). `gap_days` lives on the campaign (Change 2),
  so a step references a campaign and inherits its gap; the operator can also set the gap per
  campaign (Req 5.2).
- The sequence is **global** (one shared order for all subscribers). There is exactly ONE
  sequence (multiple parallel sequences are out of scope).
- **Built from scratch, no seed mechanism (Req 7.4, and seed is out of scope).** The sequence
  starts empty and the operator adds steps one at a time via admin endpoints (and, later, the
  admin UI). There is deliberately **no** seed script / batch "populate the recommended
  sequence" action — the sequence is only a few steps, so it is built by hand. The editorial
  order in `docs/message-release-plan.md` is a reference the operator follows while adding
  steps, not something the code auto-loads.
- **Empty-sequence handling (Req 7.5):** when there are no (enabled) steps, the daily run and
  the resolution simply treat every subscriber as having nothing due and send nothing — no
  error. This is the natural result of "earliest unreceived enabled step" over an empty set.

#### Sequence admin endpoints (Req 7)

CRUD over `sequence_steps`, all admin-only, so the operator (and later the UI) can build and
edit the single sequence without a code change:
- add a step (campaign + position), remove/disable a step, reorder (change positions), and
  set a campaign's `gap_days`.
- Create-from-scratch is just "add the first step to an empty table." No separate "create
  sequence" entity is needed — the one global sequence always exists conceptually; it is just
  empty until steps are added.

### Per-subscriber position: derived, not stored (Requirement 8)

Rather than storing a per-subscriber "current step" (which would need updating and could drift
when the sequence is edited), position is **derived** from the campaign send history, which is
the received-based model Requirement 8 specifies:

> A subscriber's next campaign = the earliest `enabled` step in the current `sequence_steps`
> order whose `campaign_id` the subscriber has **not** received (no `sent` row in `tip_sends`
> for that `campaign_id`), **and** which the subscriber is eligible for (opted into the
> campaign's scope, and the campaign's `gap_days` is satisfied).

This makes every mid-flight edit "just work" (Req 8.1–8.6): reorder, insert, remove, and
gap-change all change the derived result on the next run with no snapshot to maintain. See
§Why No Snapshot.

## Advancement & the Carry-Over Gap (Requirements 1.4, 5.5, 8)

The daily run, per subscriber, resolves the single next campaign as above. The **carry-over**
(Req 5.5) falls out of "earliest unreceived step": if a subscriber hasn't received step 3
(because its gap deferred them), step 4 is never their earliest-unreceived step, so they can't
jump ahead. A deferral on step 3 therefore holds up everything downstream automatically — no
special logic needed.

"At most one campaign per subscriber per day" is the `gap_days >= 1` floor: once a subscriber
is sent step K today, the gap clause excludes them from any other campaign dated today, so a
single daily run gives each subscriber at most one email.

## Daily Run (Cron) (Requirement 2)

- Add a **Cron Trigger** in `wrangler.toml` (`[triggers] crons = ["0 14 * * *"]` — one run/day
  at a fixed UTC hour; exact hour decided in tasks) and a **`scheduled(event, env, ctx)`**
  handler alongside the existing `fetch` handler.
- The scheduled handler runs the **drip pass**:
  1. If paused (see §Pause), do nothing.
  2. For the current `sequence_steps` order, walk steps in order; for each step's campaign,
     select eligible subscribers (reusing the generalized `selectAudience` with the
     campaign's `gap_days`) who have not received that campaign — but only those for whom this
     step is their *earliest* unreceived step (so a later step never sends to someone still
     owing an earlier one). Implementation: process steps in ascending position; a subscriber
     sent earlier in this same pass is excluded from later steps by the just-written `sent`
     row + the gap clause.
  3. Send via the existing chunked `production` path (`pending` → send → `sent`/`failed`,
     consent re-check, idempotency key). Chunk/pace as the manual runner does to respect
     Resend limits and D1 row limits.
- Reuse, don't fork: the per-recipient send is the existing `sendTipEmail` + `tip_sends`
  write; the scheduled pass is essentially "run the eligible campaigns in order, once each,
  for their earliest-owing subscribers."
- **Empty sequence (Req 7.5):** if there are no enabled steps, the pass is a no-op (sends
  nothing, no error).

### Run-state signal (for the admin UI's schedule indicator — UI spec Req 6)

The admin UI needs to show "next run time" and "a run is in progress right now" so the
operator can avoid editing mid-run (concurrency is handled by awareness, not a lock — see
§Concurrency). To support that, the drip exposes run state:

- Persist a small `drip_state` record with at least: `paused` (bool), `running_since`
  (timestamp, set when a scheduled pass starts, cleared when it finishes), and `last_run_at`.
- The scheduled handler sets `running_since` at the start of the pass and clears it at the end
  (also on error, so a crashed pass doesn't leave the flag stuck — clear in a `finally`).
- An admin `GET /drip/status` returns `{ paused, running, lastRunAt, nextRunAt }`. `nextRunAt`
  is derived from the known cron schedule (a fixed daily UTC hour); `running` is
  `running_since != null`. The UI polls this to render the countdown and the "running now"
  state (UI Req 6.1, 6.2, 6.4).

## Daily Operator Summary Email (Requirement 12)

After a production run finishes, the worker emails the operator a summary of that run.

- **Where it fires:** inside `executeDailyDrip` (the production run wrapper), after the run
  succeeds and `last_run_at` is updated, as a separate best-effort step. It is NOT reached from
  the preview, simulate, or paused paths — paused returns `{ ran: false }` before the summary
  call, and preview/simulate never enter `executeDailyDrip` (Req 12.1, 12.6).
- **Inputs:** the run's own `result` from `runDripPass` — `{ plan, sent, failed, waiting,
  finished }`. A delivered email is a plan entry with `status === 'next'` and `sent === 'sent'`;
  a failed send is `status === 'next'` with `sent === 'failed'` (Req 12.2, 12.4).
- **Pure builder:** `src/dripSummary.ts` exports `buildDripSummary(plan, lastCampaignId, counts,
  dateIso) → { subject, html, text }`. It is deliberately pure (no DB/network/env) so it is
  unit-tested in isolation (`src/dripSummary.test.ts`). It groups delivered emails by campaign
  (name + tip slug), lists recipients, computes the final-campaign callout, lists failed sends,
  and formats the date in US Eastern (`America/New_York`, DST-aware) to match the admin screen
  (Req 12.9).
- **Final-campaign callout (Req 12.3):** the "last campaign" is the campaign of the last
  **enabled** step (highest position among enabled steps) — matching the frontier the real drip
  advances subscribers across, so a disabled trailing step doesn't mis-key the callout. Any
  delivered entry carrying that campaign is listed in a distinct section; if none did, the
  summary says so explicitly.
- **Zero-send day (Req 12.5):** when nothing was delivered, the summary still sends with a short
  "ran — 0 emails sent, X waiting, Y finished" line (the per-campaign section is omitted).
- **Recipient & config (Req 12.7):** sent only to the operator, via a configurable
  `OPERATOR_EMAIL` var (`wrangler.toml [vars]`, defaulted to the operator's address). If unset/
  empty at runtime, the summary is skipped (logged) and the run is unaffected. Delivery reuses
  the worker's existing Resend send path (`sendViaResend`) with the app's normal sender identity;
  the unsubscribe header uses the site's preferences URL derived from `SITE_ORIGIN`.
- **Best-effort isolation (Req 12.8):** the build+send is wrapped in its own `try/catch` that
  logs and swallows any error, so a summary failure can never disturb `last_run_at` /
  `running_since` bookkeeping or re-trigger the run. It is additive — the subscriber send loop
  is untouched.

## Preview (Requirement 3.1, 3.2, 10)

- A **dry-run drip pass**: the same resolution as the daily run but sends nothing; returns, per
  subscriber (capped like the existing preview), which campaign they would receive next — or a
  `waiting` (gap not met / owes an earlier step not yet eligible) or `finished` (received all
  enabled steps) state (Req 3.2, 9.1).
- Exposed as an admin endpoint (e.g. `POST /drip/preview` with `mode: 'dry-run'`), mirroring the
  existing execute dry-run shape.

## Pause (Requirement 3.3)

- The `paused` flag on the `drip_state` record (same record as the run-state signal above).
  The scheduled handler checks it first and no-ops when paused. Admin endpoints
  `POST /drip/pause` and `POST /drip/resume`. Pausing never un-sends; resuming continues from
  the live-derived position (no catch-up burst beyond one-per-day, because the gap still
  applies).

## Concurrency: editing while a run is in progress (Requirement 8 + UI spec Req 6)

Decision: **do nothing special** (no auto-pause, no lock, no per-run snapshot). The drip runs
once a day for seconds-to-minutes, so the overlap window with an operator edit is tiny, and
because advancement is received-based with per-campaign uniqueness, the worst case of a
mid-run edit is purely cosmetic and self-healing: some subscribers in that one pass may be
evaluated against the pre-edit order and some against the post-edit order, but nothing is
double-sent, skipped permanently, or corrupted, and the next day's run re-derives cleanly.

Instead of preventing it in the backend, the **admin UI makes the risk visible** (UI spec
Req 6): it shows the next scheduled run and whether a run is in progress (from
`GET /drip/status`), so the operator can choose to hold off editing during a run. Editing is
never blocked, and a run in progress is never interrupted.

## Test Harness: Controllable "Today" (Requirement 10)

The one capability that unlocks all of Requirement 10 is **injectable "now."**

- **Thread an evaluation date through the pass.** Replace direct `new Date()` / `utcToday()`
  reads in the drip pass and the gap clause with a `now` passed in (defaulting to real now in
  production). The admin drip endpoints accept an optional `asOf` date; the scheduled handler
  always uses real now.
- **Step forward N days (Req 10.2, 10.3):** an admin test endpoint (e.g.
  `POST /drip/simulate`) accepts `{ startDate, days, mode }` and runs the pass once per
  simulated day (`startDate`, `startDate+1`, …), returning, per simulated day, which campaign
  each test subscriber would get. Stepping until no subscriber is `waiting`/due = **full
  sequence** test (10.3); stepping a few days = **few-days** test.
- **No-send vs send-to-test (Req 10.4, 10.5):**
  - `mode: 'dry-run'` → pure simulation, no emails, returns the per-day plan.
  - `mode: 'production'` restricted to **test subscribers only** → actually sends (so emails
    can be seen to render), but the harness refuses to touch non-test subscribers.
- **Isolated test subscribers (Req 10.6):** mark test subscribers (e.g. an
  `is_test INTEGER DEFAULT 0` column on `subscribers`, or a reserved email domain like
  `@drip-test.local`). All test actions operate ONLY on test subscribers and never touch or
  advance real subscribers' derived position.
- **Relative-age test subscribers (Req 10.7):** a test subscriber's signup is set by a
  relative age ("joined N days ago"), implemented by backdating its `created_at` to
  `now - N days`. Because advancement/gaps key off `created_at` and `tip_sends`, a backdated
  test subscriber behaves exactly like a real one of that age.
- **Sequence-derived batch create (Req 10.8):** `POST /drip/test/create` generates a batch of
  test subscribers whose relative ages are **derived from the current sequence** — the
  cumulative day-offsets implied by the steps' order and `gap_days`, so each tester lands at a
  meaningful point in the flow (plus a brand-new day-0 tester and one past the end). The
  derivation walks the enabled steps, accumulating each step's `gap_days` to get the age at
  which a tester would be due for that step. (Exact age set and whether to add day-0 /
  past-end testers is pinned in tasks.)
- **Two distinct test-data actions (Req 10.9):**
  - `POST /drip/test/create` — **replaces** the entire test cohort: delete all existing test
    subscribers AND all their `tip_sends` (and any test-only run state), then insert the newly
    derived set. Always yields a clean cohort with no leftovers.
  - `POST /drip/test/reset` — **keeps** the existing test subscribers and their backdated
    signup ages, but clears their `tip_sends` so their sequence position returns to the start,
    allowing the same cohort to be re-tested.
  - Both affect only test subscribers (never real ones).
- **Fidelity (Req 10.10):** the simulation uses the exact same resolution + gap + uniqueness +
  carry-over code as the real pass (only `now` and the test-subscriber filter differ), so a
  passing simulation is meaningful.

## Why No Snapshot (Requirement 8)

Because next-campaign is derived live from (a) the current `sequence_steps` order and (b) the
subscriber's actual received campaigns, there is no stored per-subscriber path to migrate when
the operator edits the sequence. Reorder → the "earliest unreceived enabled step" changes
accordingly. Insert earlier → it becomes someone's earliest-unreceived step and is sent (may
re-engage a finished subscriber, Req 8.4). Remove → it's no longer an enabled step, so it's
skipped; the campaign + its send history remain (Req 8.5). Gap change → evaluated live on the
next pass, forward-only (Req 8.6). This is the intentionally simplest behavior (Req 8.7).

## Reused Unchanged

- Consent: scope columns (`scope_tips`/`scope_reminders`) + the mid-run fresh re-check in the
  send loop (Req 6). Unsubscribe already flips the scope flags, which the eligibility query
  honors (Req 6.2).
- Per-recipient individual send via `sendTipEmail`; Resend idempotency key (re-keyed to
  campaign); `pending`-before-send at-most-once semantics.
- The chunked execute model and its pacing.

## Scope & Parked Work (Requirement 9)

- The sequence covers the educational **tips** scope now. The behavior-triggered **reminders**
  come-back nudge is **parked** — it needs a last-app-activity signal the messaging worker does
  not have (that lives, anonymously, in the analytics worker). Recorded as a follow-up, not
  silently dropped (Req 9.3). The `reminders` scope and gap machinery remain compatible for
  when it's built.

## Deploy & Operations

- Migrations run before dependent code: `0004` re-key, `0005` gap, `0006` sequence_steps,
  `0007` drip_state (paused / running_since / last_run_at), `0008` subscribers.is_test (if the
  column approach is chosen): `npx wrangler d1 execute messaging-db --local/--remote --file=...`.
- Deploy: `cd messaging-worker && npm run deploy` (adds the `scheduled` handler + cron).
- **No seed step** — the sequence is built from scratch via the admin endpoints / UI (seeding
  is out of scope). The operator adds the few steps by hand, following the editorial order in
  `docs/message-release-plan.md`.
- Update `messaging-worker/README.md` and `docs/deployment/messaging-operations.md` with the
  new drip/preview/pause/status/simulate/test-create/test-reset commands and the per-campaign
  (not per-tip) dedupe + gap behavior.
- Typecheck before deploy: `cd messaging-worker && npm run typecheck`.

## Testing Strategy (Requirement 11)

- **Unit (worker runner):** on synthetic subscribers + a synthetic sequence, assert, using an
  injected `asOf`:
  - order & welcome-first (1.x); one-at-a-time advancement, no jumping ahead (1.4, 8.2).
  - per-campaign uniqueness: same tip in two campaigns sends twice; same campaign never twice
    (4.x).
  - gap: `gap_days` defers correctly; default/min 1 reproduces no-same-day; deferred subscriber
    stays due, carry-over holds up downstream (5.x, 9.3).
  - mid-flight edits: reorder/insert/remove/gap-change produce the expected next campaign with
    no duplicates (8.x).
  - consent/unsubscribe honored (6.x).
- **Simulation tests (Req 10):** step-forward over N days on isolated test subscribers; assert
  the full-sequence run delivers every enabled campaign in order and the few-days run matches
  expected per-day output. Assert the test-cohort actions: `test/create` derives relative ages
  from the current sequence and **replaces** the prior cohort (old test subscribers + their
  `tip_sends` gone); `test/reset` **keeps** the cohort and ages but clears their `tip_sends` so
  position restarts; both leave real subscribers untouched.
- **Empty-sequence test (Req 7.5):** a pass over an empty sequence sends nothing and does not
  error.
- **Migration test:** verify the `0004` rebuild copies all existing rows (47 today, all with a
  `campaign_id`) and enforces the new `(campaign_id, email)` uniqueness. Since every tip maps
  to exactly one campaign today, dedupe outcomes are unchanged on current data; add a test
  proving the new case works — the same tip in two different campaigns produces two sends to
  the same recipient.
- **Runtime-only (honest caveat, per workflow steering):** that the **Cron Trigger actually
  fires daily** in production can only be confirmed by observing one real scheduled run (worker
  logs / new `tip_sends` rows the next day). All sequence *logic* is proven ahead of time by the
  injected-`asOf` simulation; the daily firing is the one thing verified live. State this
  plainly in the task; do not claim the cron cadence is proven by unit tests.

## Open Questions for Tasks

- Keep the table name `tip_sends` vs. rename to `campaign_sends` (cosmetic; affects churn).
- Cron time of day (UTC hour) and chunk size/pacing for the scheduled pass.
- Test-subscriber marking: `is_test` column vs. reserved email domain.
- The exact sequence-derived age set for `test/create` (one tester per step boundary; whether
  to also add a brand-new day-0 tester and one past the end).
- Whether preview/simulate/status/test-* live under `/drip/*` endpoints vs. extending existing
  campaign routes.
