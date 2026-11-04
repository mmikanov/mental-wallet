# Tech Debt & Follow-Ups

A running list of known debt, deferred improvements, and parked items surfaced during the
measurement-foundation work and the 1.0.6 release cycle. Each item notes **what**, **why it
matters**, and a rough **effort/priority**. Nothing here blocks the current release; these are
things to pick up deliberately.

_Last updated: 2026-11 (post-1.0.6 submission)._

---

## Analytics worker / dashboard

### 1. Per-channel retention uses a windowed aggregation, not first-open cohort parity
- **What:** In `handleDetailChannels`, the per-channel D7/D30 retention applies the phase window
  to the aggregation rather than filtering on each user's first-open timestamp the way the
  headline cohort-retention metric does.
- **Why it matters:** Under a selected phase window, per-channel retention can under-report
  slightly vs. the headline number. Directionally safe and equal for All-Time; a cosmetic/parity
  gap, not a correctness bug.
- **Effort:** Small (align the query to the headline cohort approach). **Priority:** Low.
- **Source:** channel-attribution design review (non-blocking nit).

### 2. `"(not set)"` channel value is its own bucket, not folded into organic
- **What:** Some Play installs report the install referrer as the literal string `"(not set)"`
  (distinct from `null`/organic and from `google-play`). It shows as its own row in the channel
  breakdown.
- **Why it matters:** It's effectively untagged traffic, so arguably belongs in the
  organic/untagged bucket; as-is it fragments the breakdown slightly.
- **Effort:** One line (map `"(not set)"` → organic in the resolved-channel logic).
  **Priority:** Low. **Decision pending:** confirm we want it folded vs. kept visible.
- **Source:** surfaced in live data during 1.0.6 attribution testing.

### 3. Stress-test generator can write to production analytics
- **What:** `src/services/analyticsStressTest.ts` (a `__DEV__` synthetic-event generator) enqueues
  events through the normal transmitter, which in a dev build points at whatever analytics
  endpoint is configured — potentially production.
- **Why it matters:** Synthetic/test events can leak into the production analytics DB and pollute
  real metrics. (We investigated a data anomaly partly because of this risk.)
- **Effort:** Small (guard the stress test so it refuses to enqueue unless pointed at a non-prod
  endpoint, or hard-require an explicit opt-in flag). **Priority:** Medium.
- **Source:** analytics data-anomaly investigation during 1.0.6 testing.

### 4. Device-clock trust / event-time hardening (partially addressed)
- **What:** The dashboard now **excludes** events whose device `timestamp` is >1 day ahead of
  `received_at` from metrics (clock-skew guard). But the underlying analytics still **store** the
  device-reported time verbatim, and only the >+1-day-future case is filtered.
- **Why it matters:** Far-past skew, or smaller forward skew, still isn't normalized. A fuller fix
  would prefer/clamp to `received_at` when the device time is implausible, at ingest time, so the
  stored data is clean rather than filtered at read time.
- **Effort:** Medium (ingest-time normalization + migration decision for existing rows).
  **Priority:** Low-Medium.
- **Source:** 1.0.6 attribution testing (clock-skewed real-device events).

### 5. `EXCLUDED_USER_IDS` is a manual, redeploy-to-change mechanism
- **What:** Excluding your own test-device users from metrics requires editing `wrangler.toml`
  and redeploying (or deleting rows). There's no lightweight "mark this install as internal" path.
- **Why it matters:** Ongoing internal testing keeps minting fresh anonymous ids that inflate
  real-user counts; cleanup is manual each time.
- **Effort:** Medium. **Priority:** Low (deletion/exclusion works; just not ergonomic).

---

## Mobile app

### 6. No in-app version display
- **What:** The app shows its version nowhere in-app (no Settings/About line). Confirming which
  build is running requires Android system settings or App Store Connect.
- **Why it matters:** Makes QA/debugging and "which version are you on?" support harder than it
  should be. (Came up directly when verifying the 1.0.6 internal build.)
- **Effort:** Small (add a "Version X.Y.Z (build)" line to Settings via `expo-constants` /
  `expo-application`). **Priority:** Medium. **Operator explicitly wants this in a future build.**
- **Source:** 1.0.6 Android internal-testing verification.

### 7. Per-channel subreddit split is lost on iOS
- **What:** Reddit links share `utm_source=reddit` with the subreddit in `utm_campaign`. The Play
  referrer carries the campaign (so Android can split by subreddit), but the iOS App Store `ct`
  token only carries the channel label, not the subreddit.
- **Why it matters:** On iOS you can see "reddit" but not which subreddit. Acceptable for now
  (iOS attribution is coarser by design), but a gap if per-subreddit iOS reads become important.
- **Effort:** Medium (decide whether to push subreddit into the `ct` token and how to read it
  back from App Store Connect). **Priority:** Low.
- **Source:** channel-attribution launch-link preparation.

### 8. iOS channel attribution is console-only (accepted tradeoff, documented)
- **What:** iOS has no device-side install referrer; iOS link-installs appear as organic in the
  app's own dashboard, and real iOS channel data lives in App Store Connect source analytics.
- **Why it matters:** Not a bug — an accepted platform limitation — but worth remembering that
  iOS channel reads require the App Store Connect console + time-window separation, not the app's
  dashboard.
- **Effort:** N/A (documented tradeoff). **Priority:** Awareness only.

---

## Store / release hygiene

### 9. Live store descriptions are hand-edited and can drift from the repo
- **What:** The App Store / Google Play **descriptions** are edited by hand in each console and
  are NOT pulled from the repo. The repo's `docs/store-listing-copy.md` is the source of truth,
  but the live listings can lag (e.g. the "no data collection" → "only anonymous usage stats"
  privacy correction must be applied in the consoles on the next release).
- **Why it matters:** Risk of inaccurate/inconsistent live copy, including privacy claims that
  App Review scrutinizes.
- **Effort:** Process (the release checklist now reminds to re-paste the description if changed).
  **Priority:** Medium — verify the live descriptions are updated with the 1.0.6 privacy wording.
- **Source:** release-checklist steering addition during 1.0.6.

### 10. Android production track publishes at 100% with no staged-rollout gate
- **What:** The Play `production` submit profile pushes to 100% immediately.
- **Why it matters:** No safety ramp for a real public launch; a bad build reaches everyone at once.
- **Effort:** Small (switch to a staged rollout % or a testing track, then promote).
  **Priority:** Medium before the real cold-acquisition launch.
- **Source:** app-deployment docs / release-checklist.

### 11. Optional App Store product-page assets not provided (Header / Search Results)
- **What:** Apple's newer product-page **Header** and **Search Results** creative assets
  (image/video) are optional and currently unset; Apple falls back to screenshots/app previews.
- **Why it matters:** A branding/ASO polish opportunity (and A/B-testable via Product Page
  Optimization), not a functional gap.
- **Effort:** Medium (design work from Apple's templates). **Priority:** Low (post-launch marketing).
- **Source:** 1.0.6 App Store submission.

---

## Broader / known pre-existing

### 12. Repo-wide pre-existing TypeScript errors
- **What:** `npm run typecheck` reports a baseline of pre-existing errors (walletStore, kpiStore,
  sessionStore, some worker files) unrelated to recent feature work. New work has been kept from
  adding to this baseline, but the baseline itself remains.
- **Why it matters:** Noise that makes it harder to spot new type regressions; a clean typecheck
  is a better safety net.
- **Effort:** Medium-Large (burn down the baseline). **Priority:** Low-Medium.
- **Source:** observed throughout the 1.0.6 work.

### 13. ESLint backlog
- **What:** ESLint (expo config) was set up earlier; a lint backlog was recorded as tech debt at
  that time and has not been fully burned down.
- **Why it matters:** Standard lint hygiene.
- **Effort:** Medium. **Priority:** Low.
- **Source:** earlier lint setup (pre-1.0.6).

---

## Deferred specs (written, not implemented)

These are tracked as specs, not debt per se, but listed here for visibility:

- **`attribution-dashboard-enhancements`** — requirements written; design/tasks not done. Covers
  side-by-side channel comparison, one-clear-retention-number, small-sample honesty, and reading
  the install-source data well. Natural next step now that channel attribution is live.
- **`prebuild-migration`** — move to Expo prebuild so `app.json` is the single source of truth and
  the 4-file version sync goes away. Would simplify the release process (ties to item 9 and the
  version-bump workflow).
