# Design Document — Channel Attribution

## Overview

This design implements passive channel attribution for Mental Health Wallet: learning which
marketing channel led to each install, with no user-facing question, and breaking results
down by channel on the analytics dashboard. It is piece **1b** of the measurement foundation
in `docs/gtm-icp-discovery-plan.md`, and a prerequisite for the ICP-discovery experiments.

The capability spans three places:

1. **Links + landing page** — per-channel tagged links, and the marketing site forwarding an
   incoming tag through to the store badges (`website/`).
2. **App (client)** — reading the channel tag once after install (Android: Play Install
   Referrer; iOS: coarser), persisting it on-device write-once, and stamping it onto every
   analytics event (`src/services/`, `src/stores/analyticsStore.ts`).
3. **Analytics worker + dashboard** — ingesting the channel on events, and adding a
   per-channel breakdown and a channel filter (`analytics-worker/`).

The design deliberately reuses existing machinery wherever possible: the anonymous
`anonymous_user_id` (SecureStore), the write-once local-settings pattern used for
`first_open_date`, the event `properties` JSON blob, and the dashboard's existing orthogonal
filter model (phase window + active/new cohort).

## Requirements Traceability

| Requirement | Where addressed |
|---|---|
| 1 — Per-channel links | §Links & Tag Scheme |
| 2 — Landing page carries tag to store | §Landing-Page Tag Forwarding |
| 3 — Organic / untagged group | §Channel Resolution & the Organic Bucket |
| 4 — Passive Android attribution | §Client: Reading & Storing the Tag (Android) |
| 5 — Coarser iPhone attribution | §Client: Reading & Storing the Tag (iOS) |
| 6 — Channel breakdown on dashboard | §Worker: Ingestion & §Dashboard: Breakdown and Filter |
| 7 — No user-facing question/friction | §Client (write-once, no UI) |
| 8 — Privacy preserved | §Privacy & Data Model |
| 9 — Known limits stated plainly | §Known Limits |
| 10 — Success verification | §Testing Strategy |

## Key Decision: Where the Channel Lives on the Data

**Decision: stamp the channel as a property on every analytics event (denormalized).**

The channel is conceptually an immutable per-user attribute, so three shapes were considered:

- **A — stamp it on every event** (chosen). The channel rides in the existing `properties`
  JSON on every event. Querying is "just another `WHERE`/`json_extract` filter on the
  `events` table," identical to how `platform` and the phase window already filter. The cost
  is redundancy (the same label repeated per event), which is negligible at this data scale
  (low thousands of events).
- **B — record once on first open only.** Cleaner storage, but pushes a per-user resolution
  subquery into every channel-aware query (resolve "which users are channel X" from their
  first-open event, then filter), heavier param-binding, and a fragility: if that one event
  is missing the user has no channel anywhere.
- **C — a separate per-user `install_source` table/column.** Most "correct" relationally,
  but the biggest change to the worker (new table, new write path, a join on every channel
  query) and it erodes the "events table is the whole story" simplicity.

**Rationale for A:** denormalizing is the right call when the duplicated value is stable and
read often — exactly this case. It minimizes worker changes (the channel filter becomes a
`json_extract(properties,'$.channel')` predicate reusing the existing `withFilter` /
`buildCohortClause` / `buildDetailFilter` plumbing), and it is robust to late-starting or
edge-case events because any event emitted after the tag is known carries it. The redundancy
is free here. B and C are documented so the tradeoff is on record; revisit only if event
volume grows by orders of magnitude.

The channel is attached to events **from the moment the tag is known on-device**. Events
emitted before the tag resolves (see sequencing below) carry no channel and resolve to the
organic/untagged bucket for that user only if the tag never arrives.

## Links & Tag Scheme

- A **channel** is identified by a short, stable label (e.g. `reddit`, `linkedin`,
  `therapist`, `organic`). The operator maintains the list of labels in
  `docs/outreach-templates.md` (alongside the existing ASO/channel notes) so names stay
  consistent across experiments. (Requirement 1.3.)
- **Tag parameter:** channel links carry the channel in a URL query parameter. We standardize
  on `utm_source` (the Android Play Install Referrer and web analytics both understand it;
  `utm_campaign` MAY be used for a finer experiment id). Internally the resolved value is
  called `channel`.
- **Two link forms per channel** (both acceptable; the landing-page form is the primary one):
  - **Landing-page form (primary):** `https://mentalhealthwallet.productsforgood.co/?utm_source=<channel>`
    — points at the marketing site, which forwards the tag to the store (next section). This
    is the form the operator shares, because most channels send people to the page first.
  - **Store-direct form (secondary):** the store link with the tag baked in — Android
    `https://play.google.com/store/apps/details?id=com.mentalwallet.app&referrer=utm_source%3D<channel>`;
    iOS App Store link with a campaign token (`ct=<channel>`). Used when a channel links
    straight to a store.

## Landing-Page Tag Forwarding

Covers Requirement 2 (the common "site first, then download" path).

Today the store badges are **plain, untagged** links, in two files:

- `website/index.html` — hero section (lines ~49–55) and bottom CTA (lines ~138–144).
- `website/app-fallback.html` — the `#store-badges` block (lines ~96–102).

**Mechanism (static site, no build step — matches the existing `website/` deploy model):**

1. Add a small script (extend the existing inline pattern in `app-fallback.html`, or add a
   function in `website/script.js`) that, on page load, reads `utm_source` (and optional
   `utm_campaign`) from `location.search`.
2. If present, it rewrites each store badge `href` to append the tag in the form each store
   understands:
   - **Google Play badge:** append `&referrer=` with a URL-encoded `utm_source=<channel>`
     (and `utm_campaign` if set). This is what the Play Install Referrer API later returns.
   - **App Store badge:** append the campaign token parameters (`ct=<channel>`, optional
     `pt=`), which surface in App Store Connect source analytics.
3. The rewrite is invisible — no layout or copy change (Requirement 2.3). If no tag is
   present, the badges keep their current plain URLs and the install is organic
   (Requirement 3.3).

The tag is also persisted in a first-party cookie / `localStorage` on the site so a visitor
who browses a few pages before tapping the badge still gets the tag forwarded. (Session
persistence detail; the tag itself is not personal data — it is a channel label.)

A single landing-page link is therefore sufficient to run a channel; the operator is not
required to hand out store-direct links for the site-first path (Requirement 2.4).

## Client: Reading & Storing the Tag

### Android (clean path — Requirement 4)

- **Read once:** after install and first launch, read the install referrer via the Play
  Install Referrer API. In the Expo/React Native stack this requires a library that wraps
  `com.android.installreferrer` (e.g. a community `react-native-play-install-referrer`-style
  module) added via a config plugin. **This requires a new native build** — see Constraints.
- Parse `utm_source` out of the returned referrer string → the `channel` value.
- **Persist write-once on-device**, mirroring `first_open_date`: store under a new key
  (e.g. `install_channel`) using the same write-once discipline as
  `getDaysSinceInstall()` in `src/services/analyticsRetention.ts` (which uses
  `INSERT OR IGNORE` into the local `settings` table) — or SecureStore alongside
  `anonymous_user_id`. Never overwrite once set.

### iOS (coarser path — Requirement 5)

- iOS has no install-referrer equivalent, so there is **no reliable device-side channel** for
  the general link case. The attribution signal for iOS is:
  - **App Store Connect source analytics** + the **campaign token** (`ct`) on the store link
    (store-console side, not in our DB), and
  - **time-window separation** (run one channel per window; the existing phase filter
    separates them).
- The design does **not** attempt Apple Search Ads `AdServices` attribution (that is paid-ad
  specific and out of scope).
- Consequence: iOS events generally carry **no `channel` property**, so iOS installs appear
  in the dashboard's organic/untagged bucket *within the analytics DB*, and the operator
  reads iOS channel performance from App Store Connect + the time window instead. The
  dashboard copy must state this plainly (Requirement 5.3) so iOS organic ≠ "truly organic."

### Stamping the channel onto events

- Events are emitted via `logEvent(...)` (`src/services/analyticsEventLogger`), driven from
  `src/stores/analyticsStore.ts` (e.g. `logEvent('app_opened', { days_since_install })`).
- Add the stored `channel` to the common event-property construction so it rides in
  `properties` on **every** event once known (the denormalized decision above). The cleanest
  seam is where device/common properties are assembled for each event, so no individual
  call site needs to change.
- **Sequencing:** the referrer read is async and may not complete before the very first
  `app_opened`. Acceptable: the channel attaches from the next event onward, and the
  dashboard's per-channel breakdown is keyed on the user having *any* event with the channel
  (see worker resolution). No need to block or delay the first event.

## Worker: Ingestion

- The ingest path (`POST /events`, `handleEvents` in `analytics-worker/src/index.ts`) already
  stores the full `properties` JSON (`INSERT INTO events (... properties ...)`). Since the
  channel rides inside `properties`, **no schema migration is strictly required** to store
  it.
- **Recommended (performance + query clarity):** add a dedicated nullable `channel` column
  via a new migration (`0005_add_channel_column.sql`), populated at ingest by extracting
  `properties.channel` (mirroring how `platform`/`os_version`/`app_version` were promoted to
  columns in `0002`). Add an index `idx_events_channel`. This keeps channel filtering as a
  first-class column predicate (fast, and consistent with the existing `platform` filter)
  rather than repeated `json_extract`. Historical rows get `NULL` → organic/untagged.

## Channel Resolution & the Organic Bucket

- A user's channel = the channel on their events. Because it is write-once on-device and
  stamped consistently, all of a user's tagged events carry the same value; take any
  non-null channel for the user (e.g. via the same first-touch/`MIN(timestamp)` pattern used
  for the New Users cohort if a canonical pick is needed).
- **Organic / untagged** = users with no `channel` on any event (Requirement 3.1). This is a
  real, labeled group in the breakdown (Requirement 3.2, 6.5), not a hidden default. Note it
  also contains all iOS link-driven installs (per the iOS section) — the dashboard copy says
  so.

## Dashboard: Breakdown and Filter

Covers Requirement 6. Two surfaces, following the analytics-dashboard steering (every KPI and
every `/details/*` endpoint must respect every global filter):

### Channel filter (third orthogonal filter)

- Add `channel` as a third filter alongside the existing phase (`from`/`to`) and cohort
  (`active`/`new`) filters.
- **Frontend (`dashboard.ts`):** add a channel selector; serialize it in `getPhaseParams()`
  (the single place that builds the query string) as `&channel=<label>`.
- **Backend (`index.ts`):** thread `channel` through `handleKpis` (via the `withFilter` /
  `dateFilter` mechanism) and `buildDetailFilter`, as an additional predicate
  (`AND channel = ?`, or `AND json_extract(properties,'$.channel') = ?` if no column is
  added). A special value selects the organic/untagged group (`channel IS NULL`). Respect the
  param-binding discipline (clause repeated N times ⇒ params repeated N times).
- This makes **every existing metric** scopable to one channel (Requirement 6.3), and the
  channel filter composes with phase + cohort (Requirement 6.4) — e.g. "reddit, within the
  Wave-1 window, new users."

### Per-channel breakdown view

- A new section/card group showing one row per channel (plus organic/untagged) with:
  installs (new users), activation, wallet growth, and **cohort** retention
  (Requirement 6.1).
- **Retention uses the cohort metric from `.kiro/specs/retention-cohorts/`**, not the legacy
  bucket figure (Requirement 6.2) — this is why that spec is a prerequisite.
- **Small-sample honesty (Requirement 6.6):** show the raw count next to every percentage;
  reuse the retention-cohorts "n/a / cohort too small-or-recent" suppression so a channel with
  a handful of installs doesn't display a fragile percentage as if solid.
- Served either as an extension of `/kpis` (a `byChannel` array) or a new
  `/details/channels` drill-down endpoint; the latter keeps `/kpis` lean and matches the
  existing drill-down pattern (`handleDetailPlatforms` is the closest template).

## Privacy & Data Model

- The channel is a non-personal **label** (e.g. `reddit`), attached to the already-anonymous
  `anonymous_user_id`. No email, name, or identity (Requirement 8.1).
- It stays in the **anonymous analytics** store (`analytics-worker` D1). It is **not** written
  to the messaging worker (the only store holding PII) — the privacy boundary is preserved
  (Requirement 8.2).
- No new user-facing UI, question, or onboarding change (Requirement 7): the only app change
  is a background referrer read + a property on events.

## Known Limits (Requirement 9)

- **Reinstall looks like a new person.** `anonymous_user_id` and the stored channel are
  per-install; a reinstall mints a fresh id and re-reads the referrer. So attribution is
  **directional, not exact** (9.1).
- **Group-level signal, not per-user truth.** Read it to compare how channels behave, not to
  assert any single user's precise origin (9.2).
- **iOS is coarser.** iOS link installs land in the analytics organic bucket; real iOS
  channel performance is read from App Store Connect + time windows. State this on the
  dashboard so iOS organic is not misread.
- **Android needs a new build.** See Constraints.

## Constraints & Rollout

- **An Android app release is required** for device-side attribution: the Play Install
  Referrer read is native and only takes effect in a new build; existing installs never
  backfill a channel (they stay organic/untagged). Follow the release checklist
  (version bump, etc.) when this ships.
- **Landing-page and worker changes are independent of the app release** and can ship first
  (static site deploy via `website/ npm run deploy`; worker via
  `analytics-worker/ npm run deploy`, running any new migration before deploying dependent
  code).
- **Deploy order:** (1) worker migration + ingest/column + dashboard filter/breakdown,
  (2) landing-page forwarding, (3) app build with the referrer read. Steps 1–2 make the
  pipeline ready so that when 3 ships, tagged Android installs attribute immediately.

## Testing Strategy

Covers Requirement 10.

- **Landing-page forwarding (unit/manual):** load the page with `?utm_source=reddit`, assert
  both store badge `hrefs` are rewritten with the correct `referrer`/`ct` tag; load with no
  param, assert badges stay plain (organic). (10.2, 3.3.)
- **Worker (unit, Jest/worker runner):** ingest synthetic events with and without a channel;
  assert the channel filter scopes KPIs correctly; assert untagged events land in the
  organic bucket; assert the per-channel breakdown separates channels and respects phase +
  cohort filters. Reuse the retention-cohorts test fixtures for the cohort-retention column.
  (10.1, 10.3, 6.x.)
- **Client (unit):** mock the referrer read; assert write-once persistence (second read never
  overwrites), assert the channel is attached to event properties once known, assert no
  channel attaches when the referrer is empty. (4, 7.)
- **End-to-end (manual, on-device — the honest caveat):** a true tagged-install → attributed
  path can only be confirmed on a real Android build/device (and iOS via App Store Connect),
  because the Play Install Referrer is a native install-time signal. Unit tests prove the
  parsing/stamping/query layers; the install-time delivery is verified on-device with a test
  internal-track build using a tagged link. State this clearly in the task's verification —
  do not claim on-device attribution is proven by unit tests alone.
- **Time-window separation (manual):** run two channels in separate windows; confirm the
  dashboard phase filter keeps them distinguishable. (10.4.)

## Out of Scope (from requirements)

- Paid-ad attribution SDKs / ad-network measurement (incl. Apple Search Ads AdServices).
- Any user-facing question or self-reported source.
- Cross-device identity.

## Open Questions for Tasks

- Whether to promote `channel` to a dedicated column (recommended) vs. query it from
  `properties` JSON — decide in tasks based on how much the per-channel breakdown queries.
- Exact iOS campaign-token scheme (`ct`/`pt` values) and whether any lightweight device-side
  iOS signal is worth capturing, or iOS relies entirely on App Store Connect + windows.
- Breakdown delivery shape: extend `/kpis` with a `byChannel` array vs. a new
  `/details/channels` endpoint.
