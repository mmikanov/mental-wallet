# Implementation Plan — 1.0.6 Bug Fixes

Build order follows the design's Deploy/Rollout section and the recommended bug order below.
Each bug is implemented as a **self-contained sequential cycle** per the `workflow` steering
rule for bugfix specs: an **exploration test** that reproduces the bug on the unfixed code (it
FAILS), a **preservation test** that captures the baseline that must not regress (it PASSES on
unfixed code), the **fix** (exploration now passes, preservation still passes), then a green
**checkpoint**. One bug is finished before the next begins — the waves at the end reflect
one-bug-at-a-time, not phase-across-bugs.

## Recommended bug order (and why)

1. **Bug 4 — unsubscribed → "waiting"** first. Pure worker logic, fully unit-testable, no
   device/real-send needed, lowest risk, and ships independently of the app build (worker
   deploy). Nothing else depends on it, so it's the cleanest place to start.
2. **Bug 2 — the `create-tool` deep-link route** next. Small, deterministic route change. Its
   in-app CTA mapper (`tipCtaToNavigation`) is **shared with Bug 1**, so establishing the
   `create-tool` → `CardCreator` route first means Bug 1's CTA wiring has a real destination to
   map to.
3. **Bug 1 — a tip renders the same content everywhere** next. Largest change (new native
   screen + new markdown dependency + website-index/email/app changes). It consumes the
   `create-tool` route from Bug 2 for its CTA mapping, so it comes after Bug 2.
4. **Bug 3 — archived tool's reminder still fires** last. Instrumentation-first and partially
   **operator-gated**: the concrete fix is chosen on-device from a log table, so it cannot be
   fully closed in-repo. Doing it last keeps the operator's device round-trip off the critical
   path of the other three.

## Prerequisites / environment

- **App** (Bugs 1, 2, 3): Jest via `jest-expo`, tests colocated in `__tests__/`, `@/` → `src/`.
  Run `npm test` (optionally a path filter) and `npm run typecheck` (`tsc --noEmit`).
- **Worker** (Bugs 1, 4): tests via `node --test --experimental-strip-types "src/**/*.test.ts"`
  (`npm test` in `messaging-worker/`); typecheck `npx tsc --noEmit -p tsconfig.json` in
  `messaging-worker/`.
- **Website** (Bugs 1, 2): no automated test runner is configured; the build is
  `npm run build:content` in `website/` (produces `website/content/index.json` and the article
  HTML). Verification of the website build helper is a Node-run assertion over the generated
  `index.json` (see Bug 1 Task 1.1) plus a visual check of a built article page.

## Deploy vehicles (from design §Deploy / Rollout)

- **Rides the 1.0.6 app store build** (reaches users only via an `eas build`): Bug 1 in-app
  native tip detail + the markdown dependency + `TipsFeedScreen` change; Bug 2's `linking.ts`
  `create-tool` route; Bug 3's reminder fix.
- **Deploys independently (no app build):**
  - **Website** (`website/ npm run build:content` + deploy): Bug 1's `index.json` `body` field;
    Bug 2's `app-fallback.html` `create-tool` copy + the tip CTA URL and `version` bump in
    `content/tips/add-your-own-tool.md`.
  - **Messaging worker** (`messaging-worker/ npm run deploy`): Bug 1's `ContentIndexEntry.body`
    pass-through (full email body) and all of Bug 4 (reporting fix).
- **Recommended deploy order:** website → worker → app build. Steps 1–2 make the content and
  the operator summary correct immediately; the app build completes the in-app surface. No step
  regresses the others (an older app simply keeps opening the web article until updated).

Legend: each task lists the requirements it satisfies and how to verify it, and marks
**UNIT-PROVABLE** vs. **ON-DEVICE / REAL-SEND** (the honest caveat per the `workflow` steering
rule — device/real-send behavior is NOT claimed proven by unit tests).

---

## Bug 4 — An Unsubscribed Person Is Reported as "Waiting" (worker, unit-provable)

Root cause (confirmed): in `messaging-worker/src/index.ts`, `resolveNextForSubscriber` returns
`{ kind: 'waiting', campaign }` when `!scopeOptedIn`, so an opted-out person is folded into
`waiting` in `runDripPass` and in `buildDripSummary` (`dripSummary.ts`). Decision (design §Bug 4):
add an explicit `unsubscribed` status, worker-local; `drip.ts` `resolveNextStep` stays unchanged.

- [x] **4.1 Exploration test — an unsubscribed subscriber is classified "waiting" (FAILS on unfixed code).**
  - In `messaging-worker/src/dripSummary.test.ts`, add a test that builds a plan containing a
    `status: 'unsubscribed'` entry and asserts `buildDripSummary` renders an "Unsubscribed"
    total line and does NOT count that person under "Waiting". On the unfixed code this FAILS to
    typecheck/compile (the `'unsubscribed'` literal isn't in `SummaryPlanEntry.status` /
    `SummaryCounts`), which is the exploration signal that the status doesn't exist yet.
  - Files: `messaging-worker/src/dripSummary.test.ts`
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test` — the new test fails to build/
    run against unfixed code (confirms the gap). _Requirements: 4.1, 4.2, V.5_

- [x] **4.2 Preservation test — subscribed waiting/finished/sent still classify exactly as today (PASSES on unfixed code).**
  - In `messaging-worker/src/dripSummary.test.ts`, add a test over a plan of only
    still-subscribed entries (`sent`/`waiting`/`finished`) asserting the existing Totals
    (Delivered/Failed/Waiting/Finished/Total considered) and the per-campaign grouping are
    unchanged. This must pass on the current code and keep passing after the fix.
  - Files: `messaging-worker/src/dripSummary.test.ts`
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test` — this test passes now.
    _Requirements: 4.4_

- [x] **4.3 Fix — add the explicit `unsubscribed` status end to end in the worker.**
  - _As-built:_ added worker-local `unsubscribed` status to `resolveNextForSubscriber`/`runDripPass`/`sendDripSummaryEmail` (`index.ts`) and `SummaryPlanEntry`/`SummaryCounts` + an "Unsubscribed" Totals line in text & HTML (`dripSummary.ts`); `drip.ts` and `adminHelpers.ts` left unchanged by design. All 30 worker tests pass; `tsc --noEmit` clean.
  - `messaging-worker/src/index.ts`:
    - `resolveNextForSubscriber` return type: add `'unsubscribed'` to the inline
      `kind` union; when the frontier step exists but `!scopeOptedIn`, return
      `{ kind: 'unsubscribed', campaign }` instead of `{ kind: 'waiting', campaign }`. The
      missing-campaign case and the within-gap case **stay** `'waiting'` (those people are
      genuinely awaiting).
    - `runDripPass`: add an `unsubscribed` counter and a `status: 'unsubscribed'` plan entry,
      and return `unsubscribed` alongside `sent/failed/skipped/finished/waiting`. **Branch
      ordering:** handle `resolved.kind === 'unsubscribed'` as its own branch placed BEFORE the
      existing `if (resolved.kind === 'waiting' || !resolved.campaign)` branch, so an
      unsubscribed result (which carries a `campaign`) is not swept into `waiting`. The
      `waiting++` branch no longer sees opted-out people.
    - `PlanStatus` type: add `'unsubscribed'` to
      `type PlanStatus = 'next' | 'waiting' | 'finished' | 'not_yet'`.
    - `sendDripSummaryEmail`: thread `unsubscribed` through the inline `result` type and pass
      `unsubscribed: result.unsubscribed` into `buildDripSummary`'s `counts`.
  - `messaging-worker/src/dripSummary.ts`:
    - Add `'unsubscribed'` to `SummaryPlanEntry.status`; add `unsubscribed: number` to
      `SummaryCounts`; render an "Unsubscribed" total line in BOTH the text and HTML Totals
      blocks (and, per the design's open question, optionally a short "Unsubscribed" list
      mirroring the failed-sends block — decide by operator preference; the count is the minimum
      for Req 4.1/4.2). The "Waiting" line now means genuinely-awaiting only.
  - **`resolveNextStep` in `drip.ts` is NOT changed** (design: the kind is worker-local).
  - **`adminHelpers.ts` is NOT changed:** its `SimCell`/`SimPlanEntry` status unions are a
    separate local type for the simulation grid (test cohort only, which never hits the
    opted-out branch), so it does not share the summary type and needs no `unsubscribed` member.
    Note this in the commit so the reviewer nit is addressed explicitly.
  - After the fix, the exploration test (4.1) passes and the preservation test (4.2) still passes.
  - Files: `messaging-worker/src/index.ts`, `messaging-worker/src/dripSummary.ts`
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test` (4.1 + 4.2 + existing
    `drip.test.ts`/`dripSummary.test.ts` all pass) and `npx tsc --noEmit -p tsconfig.json`
    clean. _Requirements: 4.1, 4.2, 4.3, 4.4, V.5_

- [x] **4.4 Checkpoint — Bug 4 green.**
  - Run the full worker suite and typecheck; confirm no regression in `drip.test.ts`,
    `dripSummary.test.ts`, `adminHelpers.test.ts`.
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test && npx tsc --noEmit -p tsconfig.json`
    — all green. _Requirements: 4.1–4.4, V.5_

---

## Bug 2 — The "Create your own tool" Deep Link Opens the Wrong Screen (app route + website/content)

Root cause (confirmed): `src/navigation/linking.ts` has no `create-tool` route; `add-tool` →
`LibraryBrowser`; the tip CTA points at `.../app/add-tool`. Create Tool is `CardCreatorScreen`,
route `CardCreator`, opened with no params.

- [x] **2.1 Exploration test — `create-tool` does not resolve to `CardCreator` (FAILS on unfixed code).**
  - _As-built:_ added `create-tool`, `/app/create-tool`, and trailing-slash `create-tool/` cases asserting the leaf route is `CardCreator`. Confirmed FAILING on unfixed `linking.ts` (unparseable path → undefined state) and PASSING with the fix.
  - In `src/navigation/__tests__/linking.test.ts` (existing pattern), add a test asserting that
    `linking.getStateFromPath('create-tool', options)` (and the `/app/create-tool` Universal-Link
    form, plus a trailing-slash `create-tool/` for Android normalization) resolves to a state
    whose leaf route is `CardCreator`. On unfixed code the default parser has no such screen, so
    this FAILS.
  - Files: `src/navigation/__tests__/linking.test.ts`
  - _Verify (UNIT-PROVABLE):_ `npm test -- linking` — the new case fails on unfixed code.
    _Requirements: 2.1, 2.4, V.3_

- [x] **2.2 Preservation test — `add-tool` still resolves to `LibraryBrowser` (PASSES on unfixed code).**
  - _As-built:_ `add-tool`, `/app/add-tool`, and `add-tool?filter=apps` → `initialFilter: 'apps'` still resolve to `LibraryBrowser`; green before and after the fix.
  - In the same test file, add/confirm a case that `add-tool` (and `/app/add-tool`, and
    `add-tool?filter=apps` → `initialFilter: 'apps'`) still resolves to `LibraryBrowser`. Must
    pass now and after the fix (Req 2.2).
  - Files: `src/navigation/__tests__/linking.test.ts`
  - _Verify (UNIT-PROVABLE):_ `npm test -- linking` — passes now. _Requirements: 2.2_

- [x] **2.3 Fix — add the `create-tool` route and point the tip CTA + fallback copy at it.**
  - _As-built:_ added `CardCreator: 'create-tool'` to `config.screens`; repointed the tip CTA to `/app/create-tool` and bumped tip-content `version` 3→4 (content/bookkeeping only; nothing asserts it at runtime); added a `create-tool` `ROUTE_COPY` entry to `app-fallback.html` and `create-tool`/Tip-CTA rows to `deep-links.md`; rebuilt `website/content/index.json` (CTA now ends `/app/create-tool`). `npm test -- linking` 51/51 green; linking files typecheck-clean. `add-tool` → `LibraryBrowser` unchanged.
  - `src/navigation/linking.ts`: in `config.screens`, add `CardCreator: 'create-tool'` alongside
    `LibraryBrowser: 'add-tool'`. No `getStateFromPath` special-case is needed (bare path, no
    verb→param translation; `initialRouteName: 'MainTabs'` already provides the wallet base). The
    `default` branch of the existing `switch` handles it via `defaultGetStateFromPath`.
  - `content/tips/add-your-own-tool.md`: change frontmatter `cta.url` from
    `https://mentalhealthwallet.productsforgood.co/app/add-tool` to `.../app/create-tool`, and
    bump the tip-content `version` `3` → `4` (this is the TIP content version read by the website
    build/drip — NOT the app marketing version). Note in the commit that this `version` bump is a
    content/bookkeeping convention; nothing in the `index.json` path asserts it at runtime
    (addresses the reviewer nit).
  - `website/app-fallback.html`: add a `create-tool` entry to `ROUTE_COPY` (e.g. headline
    "Create your own tool", sub "Get the app to build a custom coping tool from scratch."),
    keeping it in sync with the `deep-links.md` route list; without it an unknown route falls back
    to the generic "Open your wallet" copy.
  - `docs/deployment/deep-links.md`: add a `create-tool` → Card creator row to the Routes table,
    and move `add-your-own-tool`'s Tip-CTA mapping to `create-tool` (leave `add-your-own-app` on
    `add-tool`).
  - After the fix, 2.1 passes and 2.2 still passes.
  - Files: `src/navigation/linking.ts`, `content/tips/add-your-own-tool.md`,
    `website/app-fallback.html`, `docs/deployment/deep-links.md`
  - _Verify (UNIT-PROVABLE for routing):_ `npm test -- linking` (2.1 + 2.2 pass) and
    `npm run typecheck` clean. Rebuild the site (`cd website && npm run build:content`) and
    confirm the regenerated `content/index.json` entry for `add-your-own-tool` now has
    `cta.url` ending `/app/create-tool`.
  - _Verify (ON-DEVICE, honest caveat — V.3):_ actually opening Create Tool from a tapped email
    CTA / cold app start / Universal Link requires a real device build (iOS Universal Links don't
    work on the Simulator; the custom scheme needs a real native binary). State this in the task;
    the route-resolution layer is unit-proven, the device open is not.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, V.2, V.3_

- [x] **2.4 Checkpoint — Bug 2 green.**
  - _As-built:_ `npm test -- linking` 51/51 pass; `npm run typecheck` clean for navigation/linking files (pre-existing unrelated store/session errors untouched by this change); rebuilt site carries the `/app/create-tool` CTA and the `create-tool` fallback copy. On-device open of Create Tool (email CTA / cold start / Universal Link) remains the operator's device check on the 1.0.6 build (V.3 — unit-proven at the route layer only).
  - Run the navigation tests + typecheck; confirm the site rebuild carries the new CTA URL and
    the fallback copy renders for `create-tool`.
  - _Verify (UNIT-PROVABLE):_ `npm test -- linking && npm run typecheck`; `cd website && npm run build:content`.
    _Requirements: 2.1–2.4, V.2_

---

## Bug 1 — A Tip Renders the Same Content Everywhere (website + worker + app)

Decision (design §Bug 1): put the raw-markdown `body` into the shared `content/index.json` so it
reaches email and app; render the in-app tip **natively** (new `TipDetailScreen` +
`react-native-markdown-display`), replacing the in-app-browser delegation; make the in-app CTA a
native `navigation.navigate(...)` via a pure `tipCtaToNavigation` mapper (shared with Bug 2's
`create-tool` → `CardCreator`). Do Bug 1 AFTER Bug 2 so the mapper has a real route to resolve.

### Website — the single source now emits the body

- [x] **1.1 Exploration + fix — add `body` (and keep `cta`) to the generated `content/index.json`.**
  - _As-built:_ added `body: t.body` to the `index` mapping in `website/build-content.js` (renderArticle untouched). Rebuilt; `content/index.json` now carries a non-empty `body` on all 12 tips and `cta`. Node assertion for slug `add-your-own-tool`: `body len=1509`, `cta.url=.../app/create-tool`. The regenerated `tips/add-your-own-tool.html` also picked up the committed Wave-2 CTA (`add-tool`→`create-tool`).
  - Exploration/baseline: with a Node assertion over the output of `website/build-content.js`
    (the project has no website test runner — a small throwaway `node -e` script or a check in
    CI), confirm the current `index.json` entry has NO `body` (the bug), then add it.
  - `website/build-content.js`: in the `const index = tips.map((t) => ({ ... }))` mapping, add
    `body: t.body` (the full parsed markdown; `t.body` is already available — it feeds
    `renderArticle`). `cta: t.cta` is already present. Do NOT change `renderArticle` (the website
    article is the reference rendering and is already correct).
  - Files: `website/build-content.js`
  - _Verify (UNIT-PROVABLE):_ run `cd website && npm run build:content`, then assert (e.g.
    `node -e "const a=require('./content/index.json'); const t=a.find(x=>x.slug==='add-your-own-tool'); if(!t.body) process.exit(1)"`) that the entry now carries a non-empty `body` and a `cta`.
    _Requirements: 1.1, 1.4, 1.5_

### Worker — carry the body into the email (full body)

- [x] **1.2 Exploration test — the email omits the body because the index carries none (FAILS on unfixed code).**
  - _As-built:_ new `messaging-worker/src/sendTip.test.ts` imports `parseTip` + `ContentIndexEntry` from `index.ts` (both now exported) and feeds an index entry typed as `ContentIndexEntry` that includes a `body`. Exploration signal is a typecheck error on unfixed code — `tsc` reported `'body' does not exist in type 'ContentIndexEntry'` at that literal BEFORE the 1.4 fix; after the fix the typecheck is clean and the runtime assertion (`TipPayload.body` populated) passes. To make `index.ts` loadable by `node --test --experimental-strip-types`, its three internal relative imports were given `.ts` extensions (matching the existing `drip.test.ts` convention) and `allowImportingTsExtensions: true` was added to the worker tsconfig; wrangler dry-build + worker `tsc -p` stay clean.
  - In a new `messaging-worker/src/sendTip.test.ts` (or extend an existing worker test), feed a
    `ContentIndexEntry` that INCLUDES a `body` through the `fetchTipIndex`→`parseTip` mapping (call
    `parseTip` directly on an index-shaped object) and assert the resulting `TipPayload.body` is
    populated. On unfixed code `ContentIndexEntry` has no `body` field, so an index entry's `body`
    is dropped at the type/shape boundary — assert the gap (the entry-level body does not survive).
  - Files: `messaging-worker/src/sendTip.test.ts` (new)
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test` — fails on unfixed code.
    _Requirements: 1.2, V.1 (assembly layer only)_

- [x] **1.3 Preservation test — a body-less tip still renders title + summary + CTA (PASSES on unfixed code).**
  - _As-built:_ second test in `sendTip.test.ts` — a body-less `ContentIndexEntry` yields `TipPayload.body === undefined` while title/summary/CTA survive. Green before and after the fix.
  - In the same worker test, assert `parseTip` on an entry with NO `body` yields a `TipPayload`
    with `body === undefined`, and that the email-body rendering logic degrades gracefully (no
    body paragraphs, CTA/summary still present). Passes now and after the fix.
  - Files: `messaging-worker/src/sendTip.test.ts`
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test` — passes now. _Requirements: 1.2, 1.7_

- [x] **1.4 Fix — pass `body` through the worker's content index.**
  - _As-built:_ added `body?: string` to `ContentIndexEntry` and updated its comment (no longer "intentionally absent"). `parseTip` already mapped `body`, so `fetchTipIndex`→`parseTip`→`TipPayload.body`→`sendTipEmail`'s existing body rendering now produces the full email with no change to the send/greeting/signature/compliance path. After the fix: worker `npm test` 32/32 pass; `tsc --noEmit -p tsconfig.json` clean; wrangler dry-build OK. REAL-SEND parity remains an operator check (V.1).
  - `messaging-worker/src/index.ts`: add `body?: string` to the `ContentIndexEntry` interface (and
    update its comment — the body is no longer "intentionally absent"). `parseTip` already maps a
    `body` field, so once `ContentIndexEntry` carries it, `fetchTipIndex`→`parseTip` populates
    `TipPayload.body`, and `sendTipEmail`'s existing body rendering (paragraph split, escaped)
    produces the full email with no further change. Greeting/signature/compliance footer +
    List-Unsubscribe header are untouched (Req 1.7).
  - After the fix, 1.2 passes and 1.3 still passes.
  - Files: `messaging-worker/src/index.ts`
  - _Verify (UNIT-PROVABLE):_ `cd messaging-worker && npm test && npx tsc --noEmit -p tsconfig.json`.
  - _Verify (REAL-SEND, honest caveat — V.1):_ that the delivered email actually shows the full
    body matching the website is confirmed by a real drip send, not by the unit test.
  - _Requirements: 1.1, 1.2, 1.7, V.1_

### App — add the dependency and the shared CTA mapper

- [x] **1.5 Add `react-native-markdown-display` (pinned) and confirm it fits Expo SDK 54 / RN 0.81.**
  - _As-built:_ pinned `react-native-markdown-display@7.0.2` (exact) in `package.json` dependencies; `npm install` OK. Confirmed pure-JS at task time: its deps are `markdown-it`, `css-to-react-native`, `prop-types`, `react-native-fit-image` — no native module to bridge, so New-Architecture / SDK-54 / RN-0.81 safe (no native rebuild of its own). Baseline after install: app `npm run typecheck` shows only the repo's pre-existing errors (walletStore/kpiStore/sessionStore/workers etc.) — no NEW ones — and the Bug-1 tests are green (import added in 1.8).
  - Add `react-native-markdown-display` to `package.json` `dependencies` with a pinned exact
    version (choose the current stable, e.g. `7.0.2` — confirm the exact latest at task time). It
    is pure-JS (no native module), so it needs no native rebuild of its own and works under the
    New Architecture; confirm this from its README/npm at task time before pinning.
  - Files: `package.json` (+ lockfile via install)
  - _Verify (medium-risk — dependency add):_ `npm install` succeeds, `npm run typecheck` clean,
    `npm test` still green (no import added yet, so this is a baseline check). Note in the commit
    the pinned version and that New-Arch/SDK-54 compatibility was confirmed at task time.
  - _Requirements: 1.1 (enables native body rendering)_

- [x] **1.6 Exploration + fix — the pure `tipCtaToNavigation` mapper.**
  - _As-built:_ exploration test created first (`src/services/__tests__/tipCtaNavigation.test.ts`) — failed with "module not found" before the module existed. Added `src/services/tipCtaNavigation.ts`: pure `tipCtaToNavigation(url)` returning `{ screen, params? } | null`. Mirrors linking.ts: strips `mentalwallet://` or `.../app` prefix + leading/trailing slash, then maps `create-tool`→CardCreator, `add-tool`(+`?filter=apps`→`initialFilter`)→LibraryBrowser, `wallet`/`how-i-feel`/`checkin`/`learn-more-tour`→MainTabs/Wallet (nested param shape, matching the app's `navigate('MainTabs', { screen:'Wallet', params:{...} })`); external/unmapped→null. 10/10 tests pass; no new typecheck errors.
  - Exploration test FIRST: create `src/services/__tests__/tipCtaNavigation.test.ts` asserting
    `tipCtaToNavigation('https://.../app/create-tool')` → `{ screen: 'CardCreator' }`,
    `.../app/add-tool` → `{ screen: 'LibraryBrowser' }` (and `?filter=apps` →
    `{ screen: 'LibraryBrowser', params: { initialFilter: 'apps' } }`), `.../app/checkin` /
    `how-i-feel` / `learn-more-tour` → the corresponding `MainTabs`/`Wallet` param shape, and that
    an external/unmapped URL returns `null` (caller falls back to `Linking.openURL`). This FAILS
    until the module exists.
  - Fix: add `src/services/tipCtaNavigation.ts` — a pure function
    `tipCtaToNavigation(url): { screen: keyof RootStackParamList; params?: object } | null` that
    strips the `/app/` (or `mentalwallet://`) prefix + trailing slash (mirroring `linking.ts`'s
    normalization) and maps the route to the same destinations the deep-link table resolves. It is
    the in-app counterpart to `linking.ts`'s `getStateFromPath`; keep the mapping in sync with it.
  - Files: `src/services/tipCtaNavigation.ts` (new), `src/services/__tests__/tipCtaNavigation.test.ts` (new)
  - _Verify (UNIT-PROVABLE):_ `npm test -- tipCtaNavigation` passes; `npm run typecheck` clean.
    _Requirements: 1.8, 1.9, 2.1, 2.4_

### App — native tip detail screen + feed rewire

- [x] **1.7 Add the `body` field to the app's Tip type and carry it through `tipsService`.**
  - _As-built:_ added `body?: string` to `Tip` (`src/types/tips.ts`) and relaxed the "never renders tip bodies" header comment (now documents native TipDetail rendering + the Req 1.6 figure exception). `tipsService.parseTip` reads a non-empty string `r.body` into the returned `Tip` (empty/non-string → undefined); `parseTip` exported for unit testing. New colocated `src/services/__tests__/tipsService.test.ts` (5 tests): body carried through, missing/empty/non-string body tolerated, malformed entry → null. All green; no new typecheck errors.
  - `src/types/tips.ts`: add `body?: string` to the `Tip` interface (and relax the file-header
    comment that says the app "never renders tip bodies").
  - `src/services/tipsService.ts`: in `parseTip`, read `r.body` (string, optional) into the
    returned `Tip`. Add/extend a colocated test (`src/services/__tests__/tipsService*.test.ts`,
    create if none) asserting `parseTip` carries a `body` through and tolerates its absence.
  - Files: `src/types/tips.ts`, `src/services/tipsService.ts`, `src/services/__tests__/tipsService.test.ts`
  - _Verify (UNIT-PROVABLE):_ `npm test -- tipsService && npm run typecheck`. _Requirements: 1.1, 1.5_

- [x] **1.8 Register the `TipDetail` route and build `TipDetailScreen`.**
  - _As-built:_ added `TipDetail: { tip: Tip }` to `RootStackParamList` (+`Tip` import) in `src/navigation/types.ts`; registered `<Stack.Screen name="TipDetail" component={TipDetailScreen} />` as a push screen in `RootNavigator.tsx` (matching `Tips`/`UsageHistory`). New `src/screens/TipDetailScreen.tsx` renders title, hero `Image` (when `heroImage` set, `testID="tip-hero-image"`), body via `react-native-markdown-display` (prose/lists/bold; raw-HTML `<figure class="tip-media">` NOT rendered — hero carries that media, Req 1.6; falls back to summary when no body), and a native CTA button labeled from `tip.cta.label`. CTA calls `tipCtaToNavigation`; non-null → `navigation.navigate(screen, params)` (via a loosely-typed navigate for the dynamic dispatch), else `Linking.openURL`. `SafeAreaView` from `react-native-safe-area-context`. Logs `tip_opened` on CTA press (existing event type). Test `src/screens/__tests__/TipDetailScreen.test.tsx` (4 tests, @testing-library/react-native; markdown mocked to Text): asserts title/hero/full-body/CTA present and that pressing the create-tool CTA calls `navigate('CardCreator', undefined)`. All green; no new typecheck errors.
  - `src/navigation/types.ts`: add `TipDetail: { tip: Tip }` to `RootStackParamList` (pass the
    whole `Tip` object as the param — the feed already holds it; avoids a re-fetch/not-found path).
    Import the `Tip` type.
  - `src/navigation/RootNavigator.tsx`: register `<Stack.Screen name="TipDetail" component={TipDetailScreen} />`
    as a push screen (same pattern as `Tips`/`UsageHistory`).
  - `src/screens/TipDetailScreen.tsx` (new): render title, hero image (when `heroImage` is set),
    the body via `react-native-markdown-display` (renders markdown prose/lists/bold; does NOT render
    embedded raw-HTML `<figure class="tip-media">` blocks — the top hero carries that media, per the
    documented per-surface exception, Req 1.6), and a native CTA button labeled from `tip.cta.label`.
    The CTA calls `tipCtaToNavigation(tip.cta.url)`; on a non-null result it does
    `navigation.navigate(mapped.screen, mapped.params)`, else falls back to `Linking.openURL`. Use
    `SafeAreaView` from `react-native-safe-area-context` (house convention). Keep a `tip_opened`-style
    analytics event if appropriate.
  - Files: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`, `src/screens/TipDetailScreen.tsx` (new)
  - _Verify (UNIT-PROVABLE):_ a `@testing-library/react-native` render test
    (`src/screens/__tests__/TipDetailScreen.test.tsx`, new) with a fixture `Tip` asserts title,
    hero, body text, and CTA button are present, and that pressing the CTA calls `navigation.navigate`
    with `CardCreator` for a `create-tool` CTA. `npm test -- TipDetailScreen && npm run typecheck`.
    _Requirements: 1.1, 1.3, 1.6, 1.8, 1.9, 1.10_

- [x] **1.9 Exploration + fix — rewire `TipsFeedScreen` to open the native detail instead of the in-app browser.**
  - _As-built:_ exploration test created first (`src/screens/__tests__/TipsFeedScreen.test.tsx`) — on unfixed code `navigation.navigate` was called 0 times (tap went to `WebBrowser.openBrowserAsync`), so the "navigates to TipDetail" assertion FAILED (recorded). Fix: `openTip` now `navigation.navigate('TipDetail', { tip })` and logs `tip_opened`; removed the `expo-web-browser`, `resolveTipUrl`, and now-unused `Alert` imports from this screen (grep confirmed `resolveTipUrl` has no other callers; left in `tipsService.ts` per task). Feed list UI unchanged; header comment updated. After the fix the test passes; no new typecheck errors.
  - Exploration test FIRST: in a new `src/screens/__tests__/TipsFeedScreen.test.tsx`, render the
    feed with fixture tips, tap a card, and assert it navigates to `TipDetail` (mock the navigation
    prop). On unfixed code the tap calls `WebBrowser.openBrowserAsync` and does NOT navigate, so the
    assertion FAILS (confirms the bug — no in-app render / no native CTA).
  - Fix: in `src/screens/TipsFeedScreen.tsx`, change `openTip` from
    `WebBrowser.openBrowserAsync(resolveTipUrl(tip))` to `navigation.navigate('TipDetail', { tip })`.
    Remove the `expo-web-browser` import and the now-unused `resolveTipUrl` import from this screen
    (leave `resolveTipUrl` in `tipsService.ts` if other callers exist — grep first; if none, it may
    be removed, but that is optional and out of the bug's scope). Keep the `tip_opened` analytics
    event. The feed list UI is otherwise unchanged.
  - After the fix, the exploration test passes.
  - Files: `src/screens/TipsFeedScreen.tsx`, `src/screens/__tests__/TipsFeedScreen.test.tsx` (new)
  - _Verify (UNIT-PROVABLE):_ `npm test -- TipsFeedScreen && npm run typecheck`. _Requirements: 1.9, 1.10_

- [x] **1.10 Checkpoint — Bug 1 green across all three surfaces (unit layer).**
  - _As-built:_ App — `jest tipsService tipCtaNavigation TipDetailScreen TipsFeedScreen` → 20/20 pass; `linking`+`tips` suites 61/61 (no regression); `npm run typecheck` introduces NO new app `src/` error-bearing files vs. the pre-existing baseline. Worker — `npm test` 32/32, `tsc -p tsconfig.json` clean, `wrangler deploy --dry-run` OK. Website — `npm run build:content` OK; all 12 index entries carry a `body`; `add-your-own-tool` body len 1509 + `cta.url=.../app/create-tool`. ON-DEVICE / REAL-SEND (V.1) NOT proven here: that the SAME tip matches across website + a sent drip email + a device app build, and that the in-app CTA opens Create Tool on a cold native build, needs a real drip send + a device build + the website — unit tests cover content assembly + route mapping + screen render only.
  - Run the app suite (tips/mapper/screens) + typecheck, the worker suite + typecheck, and the
    website build + index assertion.
  - _Verify (UNIT-PROVABLE):_ `npm test -- tips tipCtaNavigation TipDetailScreen TipsFeedScreen`
    and `npm run typecheck`; `cd messaging-worker && npm test && npx tsc --noEmit -p tsconfig.json`;
    `cd website && npm run build:content` + the `body`-present assertion.
  - _Verify (ON-DEVICE / REAL-SEND, honest caveat — V.1):_ that the SAME tip truly matches across
    website, a sent email, and the app build (title/hero/body/CTA), and that the in-app CTA actually
    opens Create Tool, is confirmed by a real drip send + opening the tip on a device build and on
    the website. Unit tests cover content assembly + route mapping + screen render, NOT the rendered
    pixels or the delivered email. State this plainly.
  - _Requirements: 1.1–1.10, V.1_

---

## Bug 3 — An Archived Tool's Reminder Still Fires (instrument first; fix is operator-gated)

Per Req 3B.4 and design §Bug 3, Bug 3 is **instrumentation-before-fix**. The archive→disable
path reads correct (`cardService.archive` → lazy `reminderService.disableForCard` in a
silently-swallowed `try/catch`; `disableForCard` cancels stored notification ids then sets
`is_active = 0`; `reconcileRemindersOnLaunch` only reschedules `is_active = 1` rows), yet the
reminder still fires on a real 1.0.5 iPhone. The concrete fix is chosen on-device from the log
table — so **this bug cannot be fully closed in-repo**; it needs the operator's device log.

- [x] **3.1 OPERATOR instrumentation — add the `__DEV__` log table and hand over the on-device repro.** _(Done: all `[arch]`-tagged `__DEV__` logs are in place in `cardService.archive`/`reminderService.disableForCard`/`reconcileRemindersOnLaunch`, plus the operator repro/log-reading guide at `.kiro/specs/1.0.6-bug-fixes/bug3-instrumentation-guide.md`. The fix (3.2) awaits the operator's device logs.)_
  - Add `if (__DEV__) console.log(...)` at the design's decision points (remove ALL of these
    before the final commit per the debugging steering rule):
    - `cardService.archive` (`src/services/cardService.ts`): a `build-marker` log on first run
      (`[arch] build-marker 1.0.6-bug3` — proves the running artifact includes the instrumentation,
      stale-build hygiene, cause #4), a log at the start of the post-commit `try`
      (`[arch] archive→disableForCard start id=<id>`), and a log in the `catch`
      (`[arch] disableForCard THREW: <err>` — exposes the swallowed failure, cause #1).
    - `reminderService.disableForCard` (`src/services/reminderService.ts`): after the SELECT
      (`[arch] activeReminders n=<count> ids=<stored notification_id>`); in `cancelNotificationIds`
      per id (`[arch] cancelling id=<id>` and on each `.catch` `[arch] cancel FAILED id=<id> <err>`);
      before/after the UPDATE (`[arch] is_active→0 updated rows=<changes>`).
    - At the archive point, read `Notifications.getAllScheduledNotificationsAsync()` and log the
      identifiers before and after cancel (`[arch] OS scheduled before=<ids> after=<ids>` — the key
      comparison, cause #2/#3).
    - `reconcileRemindersOnLaunch`: per reminder
      (`[arch] reconcile reminder id=<id> active=<is_active> stored=<ids> missing=<bool>` — cause #3).
  - **This is an OPERATOR step — the agent cannot run it.** Hand the operator the exact repro: on a
    dev/internal build, set a reminder on a tool, archive the tool, then read the logs over
    `npx react-native log-ios` / Metro / Xcode console (and Android logcat). The `build-marker`
    line MUST appear first. Repeating/OS-notification behavior is device-only (not reliable on a
    simulator). Operator reports back which seam the logs implicate.
  - Files: `src/services/cardService.ts`, `src/services/reminderService.ts` (temporary `__DEV__` logs)
  - _Verify (ON-DEVICE, operator):_ the log table prints on a real device and identifies the failing
    seam per the decision tree. NOT unit-closeable. _Requirements: 3B.4, V.4_

- [x] **3.2 GATED fix — once the logs identify the seam, apply the matching fix from the decision tree.**
  - _As-built: **No behavioral fix required** — verified NOT reproducible on a real iPhone (current
    code). Two clean on-device runs: archiving a tool with a reminder correctly cancels the OS
    notification (stored id was in the OS-scheduled set, cancel removed it) AND marks the reminder
    inactive (`is_active→0 updated rows= 1`), no `disableForCard THREW`, no reconcile re-arm on
    relaunch, and the notification did not fire. All four candidate causes (stored≠scheduled, silent
    failure, reconcile re-arm, stale build) are ruled out. The temporary `[arch]` instrumentation
    added in commit 3311ddc was removed — `src/services/cardService.ts` and
    `src/services/reminderService.ts` were restored byte-for-byte to their pre-instrumentation
    baseline (empty `git diff` vs. `3311ddc~1`), including reverting the archive `catch (err)` back to
    the original silent `catch {}`. `grep -rn "\[arch\]" src/` and `grep -rn "logArch" src/` return
    nothing. This closes V.4 (on-device verification: the archived-tool reminder does not fire)._
  - Chosen only after Task 3.1's device logs. Candidate fixes (design §Bug 3 decision tree):
    - **Stored ids ≠ OS-scheduled ids (cause #2):** cancel by the real OS identifiers — on archive,
      cancel `getAllScheduledNotificationsAsync()` entries whose `data.cardId === id` (cancel by
      content, not only by the stored array), and/or correct the id-storage path so stored ids always
      equal scheduled ids. Fix at `reminderService`.
    - **Swallowed throw / `is_active` not written (cause #1):** stop silently swallowing the
      *disable* step; ensure the `is_active = 0` write and the cancels are ordered so a cancel failure
      cannot skip the inactive write. Fix at `reminderService.disableForCard` (and the `archive`
      catch).
    - **Reconcile re-arms an inactive reminder (cause #3):** ensure reconcile never reschedules
      `is_active = 0` reminders / cancel the repeating trigger explicitly. Fix at
      `reconcileRemindersOnLaunch`.
    - **Stale build (cause #4):** rebuild current code and re-verify; no code change, but still add
      the regression test (Task 3.3) so the layer stays covered.
  - Remove all `__DEV__` diagnostics from Task 3.1 (grep the `[arch]` tag to confirm none remain).
  - Files: `src/services/reminderService.ts` and/or `src/services/cardService.ts` (per the identified cause)
  - _Verify:_ the exact command depends on the chosen fix; at minimum `npm run typecheck` clean and
    Task 3.3's regression test green. The real fix confirmation is ON-DEVICE (V.4). _Requirements:
    3B.1, V.4_

- [x] **3.3 Regression + preservation tests at the confirmed layer.**
  - _As-built: extended `src/services/__tests__/reminderService.archiveRestore.test.ts` with a
    labeled "Bug 3 regression" block. The regression test asserts BOTH halves at the
    `reminderService.disableForCard` layer: every stored OS notification id is cancelled (exactly
    those — `cancelScheduledNotificationAsync` called once per stored id, no more/less) AND the row
    is marked `is_active = 0` for the card. Two preservation tests cover the restore path
    (Req 3B.3): `reactivateForCard` re-arms the preserved inactive reminder scheduling exactly one OS
    notification (no double-schedule), and returns an already-active reminder untouched without
    re-scheduling. `npm test -- reminderService` → 8/8 pass; typecheck shows no new errors in the
    touched files. Honest caveat: this proves the service cancels + inactivates with a mocked
    notification module — the OS-level repeating-notification stop was verified ON-DEVICE (V.4), not
    by this unit suite._
  - Exploration/regression test at the layer the log identifies — most likely
    `reminderService.disableForCard`: after disabling a card's reminders, assert BOTH that the
    reminder is marked `is_active = 0` AND that every scheduled OS notification for that card is
    cancelled (against a mocked `notificationService` whose `getAllScheduledNotificationsAsync` /
    `cancelScheduled` are controllable). This must cover the layer that was actually broken, not only
    the already-green "marks inactive" path. On unfixed code (for the identified cause) it FAILS;
    after Task 3.2 it passes.
  - Preservation test for Req 3B.3: `reactivateForCard` re-arms the preserved (inactive) reminder
    after restore and does not double-schedule — extend the existing
    `src/services/__tests__/reminderService.archiveRestore.test.ts`. Passes before and after the fix.
  - Files: `src/services/__tests__/reminderService.archiveRestore.test.ts` (extend; or a new
    `reminderService.disableForCard.test.ts` if clearer)
  - _Verify (UNIT-PROVABLE at the service layer):_ `npm test -- reminderService && npm run typecheck`.
    Honest caveat: this proves the service cancels + inactivates with a mocked notification module; it
    does NOT prove the OS-level repeating notification stops — that is the on-device pass (V.4).
    _Requirements: 3B.2, 3B.3, 3B.5, V.4_

- [x] **3.4 Checkpoint — Bug 3 green (unit) + operator on-device sign-off DONE.**
  - _As-built: `grep -rn "\[arch\]" src/` → nothing; `grep -rn "logArch" src/` → nothing.
    `npm test -- reminderService` → 8/8 green. `npm run typecheck` introduces no new errors in the
    touched files (`cardService.ts`, `reminderService.ts`, and the test) — the repo's pre-existing
    baseline elsewhere is untouched. `git diff 3311ddc~1 -- src/services/cardService.ts
    src/services/reminderService.ts` is EMPTY — both service files are back to their
    pre-instrumentation baseline, so the only net-new Bug 3 code in the repo is the
    regression/preservation TESTS. **V.4 on-device sign-off is complete:** two clean real-iPhone runs
    confirmed archiving a tool with a reminder stops its notification and no reconcile re-arm
    occurs — the bug is closed as verified-not-reproducible-on-device, with a service-layer
    regression test guarding it._
  - Run the reminder tests + typecheck; confirm no `[arch]` diagnostics remain.
  - _Verify (UNIT-PROVABLE):_ `npm test -- reminderService && npm run typecheck`; grep for `[arch]`
    returns nothing.
  - _Verify (ON-DEVICE, operator — the bug is only truly fixed here):_ on a real iPhone build,
    archiving a tool with a reminder stops its notifications, and restoring resumes them (V.4). This
    cannot be claimed from the unit suite. _Requirements: 3B.1–3B.5, V.4_

---

## Task Dependency Graph / Waves (one bug at a time)

Each bug is a wave; within a wave, explore → preserve → fix → checkpoint run in order. The next
wave does not start until the current bug's checkpoint is green.

```
Wave 1 — Bug 4 (worker, fully unit-provable, ships independently)
  4.1 → 4.2 → 4.3 → 4.4
        (explore)(preserve)(fix)(checkpoint)
        deploy vehicle: messaging-worker

Wave 2 — Bug 2 (app route + website/content; establishes create-tool → CardCreator)
  2.1 → 2.2 → 2.3 → 2.4
        deploy vehicles: website (tip CTA + fallback) · app build (linking.ts)
        ↓ (2.3 creates the create-tool route that Bug 1's CTA mapper targets)

Wave 3 — Bug 1 (website + worker + app; consumes create-tool from Wave 2)
  1.1 (website body) → 1.2/1.3/1.4 (worker body) → 1.5 (dep) → 1.6 (mapper, uses create-tool)
     → 1.7 (Tip type) → 1.8 (TipDetail screen) → 1.9 (feed rewire) → 1.10 (checkpoint)
        deploy vehicles: website (index body) · worker (email body) · app build (native tip detail)

Wave 4 — Bug 3 (instrument-first; operator-gated fix)
  3.1 (OPERATOR on-device logs) → 3.2 (gated fix from decision tree)
     → 3.3 (regression + preservation) → 3.4 (checkpoint; on-device sign-off pending)
        deploy vehicle: app build
```

Cross-wave dependency: **Wave 2 → Wave 3** (Bug 1's `tipCtaToNavigation` maps `create-tool` →
`CardCreator`, which Bug 2 adds). Waves 1 and 4 are independent of the others. No two bugs run in
parallel — the per-bug sequential cycle is mandatory for this bugfix spec.

## Verification honesty summary

- **Fully unit-provable:** Bug 4 (all); Bug 2 route resolution + CTA mapping; Bug 1 website-index
  body, worker body pass-through (assembly), the `tipCtaToNavigation` mapper, `tipsService` body
  parse, and the `TipDetailScreen`/`TipsFeedScreen` render/navigation tests; Bug 3's service-layer
  cancel+inactivate regression test.
- **Needs ON-DEVICE / REAL-SEND (NOT claimed from unit tests):** Bug 1 V.1 three-surface match + the
  in-app CTA actually opening Create Tool (device + real drip send); Bug 2 V.3 device open from a
  real Universal Link / cold start; Bug 3 V.4 the actual OS reminder behavior after archive/restore
  (device-only) — and Bug 3's root-cause instrumentation (Task 3.1) is itself an operator device step.
