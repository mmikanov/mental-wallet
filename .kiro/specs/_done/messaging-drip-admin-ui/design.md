# Design Document — Messaging Drip Admin UI

## Overview

A private, operator-only web screen for viewing, editing, testing, and controlling the
messaging drip. It is a **thin frontend over the messaging worker's existing drip endpoints**
(built by `messaging-drip-automation`); it adds no new sending logic of its own
(Req 1.3). Its main value is making the drip easy to **test** visually — build a sequence, see
the next run, and time-travel a derived test cohort through the whole flow — instead of by
`curl`.

The design follows the pattern already proven by the analytics worker: a single self-contained
HTML page (inline CSS + vanilla JS, no build step, no framework) served by the worker on an
admin route and gated by the existing `ADMIN_SECRET`. All data comes from the drip's admin
endpoints over `fetch`.

Dependency: `messaging-drip-automation` must provide the endpoints this screen calls (sequence
CRUD, `GET /drip/status`, `POST /drip/preview`, `POST /drip/pause|resume`,
`POST /drip/simulate`, `POST /drip/test/create`, `POST /drip/test/reset`). This spec is
buildable only once those exist.

## Requirements Traceability

| Requirement | Where addressed |
|---|---|
| 1 — Private operator access | §Hosting & Auth |
| 2 — View the sequence (incl. short campaign id, 2.4) | §Sequence View |
| 3 — Edit the sequence (auto-save, build from scratch, empty state, picker filtering 3.7) | §Sequence Editing |
| 4 — Preview the next run | §Preview |
| 5 — Pause / resume | §Status & Controls |
| 6 — Schedule status (next run / running now, paused clarity 6.5, Eastern time 6.6, empty-seq hint 6.7) | §Status & Controls |
| 7 — Visual time-travel testing + test cohort | §Testing Panel |
| 8 — Safety & clarity | §Safety Model |
| 9 — Success verification | §Testing Strategy |
| 10 — Create & edit campaigns (incl. sent-content lock allowing rename) | §Campaign Management |
| 11 — Subscriber history | §Subscriber History |

## Hosting & Auth (Requirement 1)

- **Served by the messaging worker**, mirroring the analytics worker's `handleDashboard`: a new
  route (e.g. `GET /admin`) returns a single HTML string constant with the secret substituted
  in, so the page can make authenticated calls. (The analytics worker does exactly this:
  `DASHBOARD_HTML.replace('__DASHBOARD_SECRET__', secret)`.)
- **Auth = the existing `ADMIN_SECRET`.** The page is opened as `/admin?secret=<ADMIN_SECRET>`;
  the same secret already protects every admin drip endpoint, so the page simply forwards it on
  each `fetch`. Without a valid secret, the route and the endpoints it calls both return 401
  (Req 1.1). The page is not linked anywhere public and is not reachable by subscribers
  (Req 1.2) — same privacy posture as the analytics dashboard.
- **No new send path (Req 1.3):** every action the page takes is a call to an existing drip
  endpoint; the page never emails anyone itself. Consent, dedupe, gap, and the daily schedule
  all remain the worker's responsibility.
- **Extensible shell (Req 1.4):** structure the page as a set of panels (Sequence, Status,
  Preview, Testing) so additional panels (standalone campaign, one-off send, subscriber
  management) can be added later without rework. Nothing in the design assumes drip is the only
  thing the page will ever show.

## Page Structure

A single page with clearly separated panels, top to bottom:

1. **Drip Status bar** (Req 5, 6) — paused/running badge, next-run line (Eastern time + countdown + paused/empty-sequence caveats), pause/resume/refresh. Panel heading is "Drip Status".
2. **New Campaign panel** (Req 10.1) — name + tip dropdown + scope dropdown + "Create campaign".
3. **Sequence panel** (Req 2, 3) — the ordered step list with inline edit controls, per-row Edit (Req 10.2/10.3), and the "add a campaign" picker (filtered per Req 3.7).
4. **Preview panel** (Req 4) — "preview next run" button + result table.
5. **Subscriber History panel** (Req 11) — email lookup + merged timeline.
6. **Drip Testing panel** (Req 7) — create/reset test cohort, run simulation, per-day results. Panel heading is "Drip Testing (time-travel)".

The page lives in `messaging-worker/src/adminPage.ts` as the exported `ADMIN_HTML` string
(markup + inline CSS + inline `<script>`), served by `handleAdminPage` on `GET /admin` in
`messaging-worker/src/index.ts`. Pure, non-trivial display helpers are mirrored in
`messaging-worker/src/adminHelpers.ts` and unit-tested there.

Vanilla JS: a small `api(path, opts)` helper wraps `fetch` with the secret and JSON handling
and throws `Error(data.error)` on a non-OK response so callers can surface the server's message
verbatim (Req 8.3). Per-section refreshers (`refreshStatus`, `refreshSequence`,
`loadCampaignOptions`, …) re-fetch and re-render; a mutating action calls the relevant
refresher(s) on success (auto-save, Req 3.4).

> Two authoring gotchas in this single-file template, learned during implementation: backticks
> inside the `ADMIN_HTML` template literal break compilation (use string concatenation, not
> nested template literals), and a `**/` sequence inside a block comment breaks the Node
> test-runner's TypeScript stripper (use line comments in the inlined JS).

## Status & Controls (Requirements 5, 6)

- On load and on a timer (every 20s, Req 6.4), `refreshStatus` polls `GET /drip/status` →
  `{ paused, running, lastRunAt, nextRunAt }`.
- Render: a **paused/running** badge (Req 5.1); when `paused`, make it visually obvious
  (Req 5.3); a **"running now"** indicator when `running` is true (Req 6.2).
- **Pause/Resume** buttons call `POST /drip/pause` / `POST /drip/resume`, then `refreshStatus()`
  (Req 5.2).
- The status bar is the "avoid editing mid-run" affordance (Req 6.3): it only informs; it does
  not disable the editing controls (editing a mid-run is allowed by design — the worker handles
  concurrency by self-healing, per the drip spec's §Concurrency). A subtle hint near the edit
  controls when `running` is true is enough.

### Next-run line, state-aware (Req 6.1, 6.5, 6.6, 6.7)

The next-run line is written to be unambiguous about *whether* and *when* a run happens:

- **Times in US Eastern (Req 6.6).** A `fmtEastern(iso)` helper formats both `nextRunAt` and
  `lastRunAt` with `toLocaleString('en-US', { timeZone: 'America/New_York', …, timeZoneName:
  'short' })`, so the label reads e.g. "Oct 4, 2026, 10:00 AM EDT" and follows daylight saving
  automatically (EST/EDT). It falls back to the default locale string if the runtime lacks tz
  data. The relative countdown (`formatCountdown`) is still shown alongside it.
- **Paused ≠ a run is coming (Req 6.5).** When `paused` is true, the line does not present the
  scheduled time as an imminent run. It reads as "Paused — no sends will go out. When resumed,
  the next daily run would be <Eastern time> (<countdown>)." plus the last-run / "never run yet"
  tail. When not paused it reads "Next run: <Eastern time> (<countdown>)".
- **Empty-sequence hint (Req 6.7).** `refreshStatus` also calls `GET /drip/sequence` and, when
  `count === 0`, shows a hint under the status: resuming won't send anything until a campaign is
  added. The hint auto-hides once the sequence is non-empty. (This is a small extra read on the
  status poll; acceptable at operator-screen traffic.)

## Sequence View (Requirement 2)

- `refreshSequence` fetches `GET /drip/sequence` → `{ count, steps: [{ id, position, enabled,
  campaign_id, campaign_name, campaign_status, tip_slug, scope, gap_days }] }` and renders an
  **ordered list**, one row per step: position, campaign name + its tip, scope (tips/reminders),
  `gap_days`, and an enabled/disabled indicator (Req 2.1, 2.2).
- A small header shows step count and overall order at a glance (Req 2.3).
- **Short campaign id (Req 2.4):** each row shows the first 8 characters of `campaign_id` in
  parentheses, in a muted span next to the name, to disambiguate same-named campaigns. (It is
  the campaign id, not the step id.)
- `campaign_status` was added to the sequence payload so the inline editor can decide whether a
  campaign's content is locked (see §Campaign Management).

## Sequence Editing (Requirement 3)

- **Reorder** (Req 3.1): up/down controls (or drag) that call the reorder endpoint with the new
  positions.
- **Add** (Req 3.2): a picker (`loadCampaignOptions`) lists campaigns from `GET /campaigns`;
  "Add step" calls `POST /drip/sequence/steps` with `{ campaign_id }`.
- **Reorder robustness note:** the move up/down handler sends an absolute target `position` to
  `PATCH /drip/sequence/steps/:id`; the worker rebuilds the ordering deterministically (park
  every step at a high temporary position, then renumber 1..N) to avoid colliding with the
  `UNIQUE(position)` constraint mid-shift — the earlier in-place `position±1` shuffle could
  collide and silently fail, making the buttons appear to do nothing.
- **Remove/disable** (Req 3.2): per-row remove (unlink) or disable toggle.
- **Gap edit** (Req 3.3): an inline number input for `gap_days`, clamped to a minimum of 1 in
  the UI (the worker also enforces this, so the UI clamp is a convenience, not the guarantee).
- **Auto-save (Req 3.4):** each change fires its endpoint immediately — there is no "Save"
  button — and on success the page `refresh()`es so the displayed sequence reflects the new
  state without a manual reload. On failure, show the error and re-fetch so the UI never drifts
  from the server (Req 8.3).
- **Build from scratch (Req 3.5):** adding the first step to an empty sequence is just the Add
  action; no special "create sequence" flow.
- **Empty state (Req 3.6):** when the sequence has no steps, render a friendly empty state with
  an "Add the first step" affordance rather than a blank/broken-looking table.
- **Picker excludes in-sequence campaigns (Req 3.7):** because the worker enforces one campaign
  per sequence (`UNIQUE(campaign_id)`), the add picker must not offer a campaign already in the
  sequence. `loadCampaignOptions(seqSteps?)` builds an exclusion set from the current steps and
  filters `GET /campaigns` against it. `refreshSequence` passes its already-fetched `steps` into
  `loadCampaignOptions(steps)` (avoiding a second sequence fetch), and the empty-sequence branch
  calls `loadCampaignOptions([])` so every campaign is offered. Because every sequence mutation
  (add, remove, move, enable/disable, gap, edit) calls `refreshSequence`, the picker re-syncs
  automatically: an added campaign leaves the list, a removed one returns. The startup path
  calls only `refreshSequence` (not a separate `loadCampaignOptions`) to avoid a brief flash of
  the unfiltered list.

## Preview (Requirement 4)

- A **"Preview next run"** button calls `POST /drip/preview` (dry-run) and renders the result:
  per subscriber (or a readable summary, capped like the worker's preview) the campaign they
  would receive next, or `waiting` / `finished` (Req 4.1).
- The panel is clearly labeled a **dry run — nothing sent** (Req 4.2). This is a safe action
  (no confirmation needed, Req 8.1).

## Campaign Management (Requirement 10)

The screen both **creates** campaigns and **edits** the campaign a sequence step points at. Both
reuse the worker's existing campaign endpoints — no new sending logic (Req 1.3).

- **Create (Req 10.1):** the New Campaign panel posts `{ name, tip_slug, scope }` to
  `POST /campaigns`. The tip dropdown is populated from `GET /drip/tip-slugs` (slugs that have
  content), shared with the edit form via a `tipSlugsCache`. On success, `loadCampaignOptions()`
  re-runs so the new campaign appears in the add picker (it isn't in the sequence, so it passes
  the Req 3.7 filter). The gap is **not** on this form — gap is a per-step sequencing knob set in
  the Sequence table, not a property of creating a campaign.
- **Edit (Req 10.2):** each sequence row has an inline Edit toggle (`openSequenceEditor`) that
  expands an editor row pre-filled from the step payload (`campaign_name`, `tip_slug`, `scope`;
  tip options from the cache). Save sends `PATCH /campaigns/<campaign_id>` with the changed
  fields. Because the step keeps referencing the same `campaign_id`, the step stays in place and
  membership/order is unchanged (Req 10.6). Only one editor is open at a time; clicking Edit
  again closes it.
- **Sent-content lock, name still editable (Req 10.3):** the worker's `handleUpdateCampaign`
  guards only tip/scope/mode (the content that went out) when `status` is `sent` or `sending`,
  and returns `409` with an explanatory message if one of those changes. The **name** is never
  locked — it is an internal label, so renaming a sent campaign is allowed. The UI mirrors this:
  when `campaign_status` is `sent`/`sending` the editor keeps the Name field live but **disables
  the Tip and Scope dropdowns** with a short note, and the Save handler sends only `{ name }` in
  that case (so a disabled-dropdown state can't accidentally submit a locked field). For
  not-yet-sent campaigns it sends `{ name, tip_slug, scope }`.
- **Name uniqueness (Req 10.4):** the worker rejects a name already used by another campaign
  with a `409`; the UI surfaces that message verbatim via the `api()` error path.
- **No stale labels (Req 10.5):** on a successful edit the handler calls `refreshSequence()`,
  which re-renders the sequence AND (via `loadCampaignOptions(steps)`) the add picker, so a
  renamed campaign updates everywhere without a manual reload.

## Subscriber History (Requirement 11)

- A lookup field posts/queries `GET /drip/subscriber-history?email=<address>`, which merges the
  subscriber's subscription events (signup, scope/consent changes, unsubscribe) and their email
  sends into one list ordered by date, so sends are read in the context of consent changes
  (Req 11.2). Subscription events come from a `subscriber_events` log the worker writes
  (`logSubscriberEvent`); historical rows were backfilled when the log was introduced.
- The panel is **read-only** (Req 11.3) — it renders the timeline; it never mutates the
  subscriber.

## Testing Panel (Requirement 7)

This is the core reason the UI exists — make time-travel testing visual.

- **Create test cohort (Req 7.4):** a "Create test users" button calls
  `POST /drip/test/create`. The worker derives the cohort's relative ages from the current
  sequence and **replaces** any prior test cohort (clean set, no leftovers). The UI shows the
  resulting testers (and that they are test-only) and makes the "this replaces the previous
  set" consequence clear before/at the click.
- **Reset test cohort (Req 7.5):** a separate "Reset test users" button calls
  `POST /drip/test/reset` — keeps the same testers and ages, clears their send history. The UI
  presents **create** and **reset** as two visually distinct actions with one-line explanations
  of the difference (Req 7.6).
- **Run simulation (Req 7.1, 7.2):** inputs for a start date and a number of days; a "Run
  simulation" action calls `POST /drip/simulate` and renders a **per-day table** — rows =
  simulated days, cells = which campaign each test subscriber gets that day (or waiting /
  finished). A "full sequence" button steps until the sequence completes; a small-N input gives
  the few-days view. As-built refinements learned from operator testing:
  - **Signup-date aware:** the simulation skips days before a tester's signup and defaults its
    start to the earliest tester signup, so testers enter the flow on their own signup day
    rather than all at day zero.
  - **"Sends that day" summary:** alongside the grid, each day lists who actually receives an
    email that day, grouped by campaign, so the operator can read the real sends at a glance.
  - **Campaign name in results:** plan entries carry `campaign_name` (not just the tip slug) so
    the grid and summary show the human name.
  - **Clear-sim + reset feedback:** running a Reset clears the previous simulation view and
    shows a success banner, so stale grids don't linger and the action's effect is visible.
- **No-send vs send-to-test (Req 7.3):** a mode toggle. `dry-run` = no emails (the default,
  safe); `send-to-test` = `simulate` in production mode (worker restricts it to test
  subscribers). The active mode is always labeled; `send-to-test` is treated as a real-send
  action for safety purposes (Req 8.2) even though it only hits test addresses — a confirmation
  makes the operator aware real emails will be delivered to the test inboxes.
- **Fidelity (Req 7.7):** the UI only displays what `/drip/simulate` returns; it does not
  compute order/gap/uniqueness itself, so what's shown matches a real run by construction.

## Safety Model (Requirement 8)

- **Classify every action** as safe or sending:
  - Safe (no confirmation): view, preview (dry-run), no-send simulation, pause/resume, sequence
    edits, create/reset test cohort (test-only data).
  - Sending (confirmation required, Req 8.2): anything that actually delivers email — the
    send-to-test simulation (real emails to test inboxes) and, if/when added later, a real drip
    send to real subscribers. These get a distinct visual treatment and an explicit confirm
    dialog (Req 8.1, 8.3).
- **Errors (Req 8.3):** the `api()` helper throws `Error(data.error)` on a non-OK response and
  the calling panel surfaces that message; actions never fail silently. Server messages (e.g.
  the sent-content `409`, the duplicate-name `409`) are shown verbatim.
- **Test subscribers isolated from real sends:** test subscribers (`is_test = 1`) are excluded
  from every real-send path and from the dry-run preview, so a test cohort can live alongside
  real subscribers without ever receiving a real daily send or distorting the preview. The
  send-to-test simulation is the only path that targets test addresses, and only test addresses.
- Note: routine sequence edits are intentionally *not* behind a confirmation (they auto-save)
  because they do not send email and are reversible; the daily run only reads the sequence once
  a day and the preview lets the operator check before any real send.

## Reused / Not Reinvented

- The HTML-string-served-by-worker + `?secret=` pattern is lifted directly from the analytics
  worker's `handleDashboard` / `DASHBOARD_HTML`.
- All behavior (sequence, preview, simulate, pause, test cohort) is the drip worker's; the page
  is a presentation layer. No sequence logic, gap math, or cohort derivation is duplicated in
  the browser (Req 1.3, 7.7).

## Deploy & Operations

- The page ships inside the messaging worker (new HTML constant + `GET /admin` route).
  Deploy with the worker: `cd messaging-worker && npm run deploy`.
- Open at `https://mental-wallet-messaging.<subdomain>.workers.dev/admin?secret=<ADMIN_SECRET>`.
- Document the URL and the panels in `messaging-worker/README.md` and
  `docs/deployment/messaging-operations.md` (alongside the existing curl commands, which remain
  valid).

## Testing Strategy (Requirement 9)

- **Endpoint-contract check:** the page only renders what the drip endpoints return, so the
  substantive logic is already covered by the drip spec's tests. The UI's own verification is
  mostly manual/visual on the served page:
  - the sequence shown matches `sequence-list` output (Req 9.1);
  - a preview/simulation shown matches calling the same endpoint directly with the same inputs
    (Req 9.2);
  - a send-to-test (or any real send) is gated by the confirm dialog before the call fires
    (Req 9.3, 8.2);
  - auth: opening `/admin` without the secret is denied (Req 1.1).
- **Where unit-testable:** any non-trivial pure helper in the page JS (e.g. the next-run
  countdown formatting from `nextRunAt`, or building the per-day simulation table from the
  response) can be extracted and unit-tested; the rest is DOM wiring verified by opening the
  page.
- **Honest caveat (per workflow steering):** this is a browser UI served by a worker; its
  correctness is confirmed by opening the live page and exercising each panel against the real
  (test-subscriber) data, not solely by unit tests. State that in the task.

## Resolved Design Decisions (as built)

- **Hosting:** served from the messaging worker at `GET /admin` (not the marketing site), so the
  secret flow is identical to the analytics dashboard and there are no cross-origin calls.
- **Reorder interaction:** up/down buttons (simplest), sending an absolute target position; the
  worker renumbers deterministically to avoid `UNIQUE(position)` collisions (see §Sequence
  Editing).
- **Preview/simulation at scale:** the worker caps preview output and the UI mirrors it; the
  simulation adds a per-day "sends that day" summary grouped by campaign for readability.
- **Times:** shown in US Eastern (America/New_York, DST-aware) plus a relative countdown.

### Still open / parked

- A compact per-subscriber "position in sequence" view in addition to the per-day grid.
- Growing the screen into a general messaging console (standalone campaign send, one-off tip
  send) beyond the campaign create/edit already added (Req 1.4, Req 10).
