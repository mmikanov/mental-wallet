# Tech Debt & Future Improvements

A running list of known refactors and improvements that are safe to defer. These are not
bugs — the app works — but addressing them reduces future maintenance risk. Add new items
at the top of the relevant section with a short rationale and the files involved.

---

## ESLint was never installed — 470 issues surfaced on first-ever lint run

**Type:** Tooling gap / code hygiene backlog
**Priority:** Low–Medium (not blocking; mostly warnings. 2 real React-hooks errors worth a look.)
**Discovered:** 2026-10-01, during `library-card-sync`. The repo had a `lint` script (`eslint .`)
in `package.json` from early on, but **ESLint and its config were never actually installed** — so
`npm run lint` only ever errored (`eslint: command not found`) / hung trying to `npx`-download it.
It had therefore never run in ~2 months of development, and no code had ever been linted.

**What was done now:** ran `npx expo lint`, which installed `eslint@^9` + `eslint-config-expo@~10`
(added to `devDependencies`) and created `eslint.config.js` (Expo flat config). `npm run lint`
now works.

**First full run:** `✖ 470 problems (46 errors, 424 warnings)`.

By area:
- app source (`src/`, `App.tsx`): 163
- tests (`__tests__`, `*.test.*`): 288
- scripts / tooling / workers / website: 19

By rule (top offenders):
| count | sev | rule | nature |
|------:|-----|------|--------|
| 146 | warn | `import/first` | imports after non-import statements — almost all from the test pattern `jest.mock(...)` before `import` (intentional in those suites) |
| 87 | warn | `@typescript-eslint/no-require-imports` | `require(...)` calls (lazy requires, jest mocks, Node scripts) |
| 78 | warn | `@typescript-eslint/no-unused-vars` | unused imports/vars/args |
| 55 | warn | `@typescript-eslint/array-type` | `T[]` vs `Array<T>` style preference |
| 36 | **error** | `react/no-unescaped-entities` | unescaped `'`/`"`/`—` in JSX text — cosmetic, auto-fixable |
| 30 | warn | `react-hooks/exhaustive-deps` | missing/extra hook deps — worth triaging case by case |
| 21 | **error** | `import/no-duplicates` | same module imported twice (merge-able) |
| 7 | **error** | `no-undef` | all `__dirname` in CommonJS Node scripts (`scripts/`, `tools/`, `website/`) — a config-scoping issue, **not real bugs**: those files need a Node/CommonJS env in the eslint config |
| 7 | **error** | `react-hooks/rules-of-hooks` + others | see "genuine issues" below |

**Auto-fixable:** 203 of 470 messages are fixable with `eslint . --fix` (the entity-escaping,
duplicate-imports, array-type, and many import-order ones). A `--fix` pass would clear roughly
half with no behavior change.

**Genuine issues worth a real look (not just style):**
- **`src/components/wallet/ThirdPartyIcon.tsx:91,145` — `react-hooks/rules-of-hooks`**: two
  `useEffect`s called **conditionally**. This is a real React correctness smell (hook call order
  can change between renders) and should be reviewed/fixed deliberately, not auto-fixed.
- **`react-hooks/exhaustive-deps` (30)**: each is a potential stale-closure/missed-update bug;
  triage individually — some are intentional and just need an eslint-disable with a reason.
- The 7 `no-undef` are **false alarms** from the config not marking the Node-script files as a
  CommonJS/Node environment — fix the config, not the code.

**Impact on the recent `library-card-sync` work:** 20 warnings across 6 of our files, **zero
errors**. Breakdown: 11 `no-require-imports` + 3 `import/first` (both from the deliberate
`jest.mock(...)`-before-import test pattern we used), 4 `import/no-duplicates`, 2 unused-vars.
Nothing functional; safe to clean up in the general pass.

**Proposed approach (deferrable):**
1. Scope the config so Node scripts (`scripts/`, `tools/`, `website/`, `*-worker/`) get a
   Node/CommonJS env — clears the 7 `no-undef` and many `no-require-imports` with no code change.
2. Run `eslint . --fix` for the ~203 auto-fixable style issues; review the diff (should be
   behavior-preserving).
3. Fix the 2 `ThirdPartyIcon.tsx` conditional-hook errors by hand.
4. Triage `exhaustive-deps` (30) and remaining `no-unused-vars` (78) incrementally.
5. Decide a baseline policy: either get to zero and add lint to CI, or set `--max-warnings` and
   gate only on errors to prevent backsliding while the warning backlog is burned down.

**Files:** project-wide; config at `eslint.config.js`; script at `package.json` `"lint"`.

**Risk if deferred:** Low for correctness (type-checking + tests already cover the important
classes of bugs), but the longer it sits the more the warning count grows and the harder it is to
adopt lint-in-CI. The one item not to defer indefinitely is the `ThirdPartyIcon.tsx` conditional
hooks — that's a latent React bug, not a style nit.

---

## react-native-webview has no Jest mock — blocks ExpandedContent (and any WebView-reaching) suites at import time

**Type:** Bug / test infrastructure
**Priority:** Medium (blocks coverage on affected suites)
**Discovered:** During the `1.0.5-fixes` work (Bug 2, wiring duration tracking into
`ExpandedContent.tsx`). `src/components/wallet/__tests__/ExpandedContent.test.ts` fails to
LOAD — not an assertion failure, an import-time crash — so the suite provides no coverage.

**Root cause:** the import graph `ExpandedContent -> ControlRenderer -> DisplayMediaControl ->
PlatformEmbed -> react-native-webview` reaches `src/components/media/PlatformEmbed.tsx:22`
(`import { WebView } from 'react-native-webview'`). Under jest-expo there is no mock for
`react-native-webview` (checked: not in `jest.config.js`, jest setup, or `__mocks__`), so its
native `RNCWebViewModule` TurboModule is unavailable and the module throws when the suite is
loaded. This is the same class of problem as the `expo-file-system` item below (a native module
resolved at import time with no jest stub).

**Proposed fix:** add a jest mock for `react-native-webview` (a stub `WebView` component +
`WebViewNavigation` type) in the jest setup or a `__mocks__/react-native-webview.js`, so any
suite whose import graph touches `PlatformEmbed` can load. Prefer the shared mock so the many
media/preview/wallet suites all benefit.

**Files:**
- `jest.config.js` / jest setup (add the mock) — or a `__mocks__/react-native-webview.js`
- Import chain: `src/components/media/PlatformEmbed.tsx` (the `react-native-webview` import)
- Affected suite (example): `src/components/wallet/__tests__/ExpandedContent.test.ts`

**Risk if deferred:** Medium — `ExpandedContent` (and other WebView-reaching component suites)
can't run, so regressions in those components — including the duration-tracking `stopTracking`
wiring just added to `ExpandedContent` in 1.0.5 — are guarded only by the typechecker, not a
running test.

---

## Curated-library rationale tests drift from `curatedLibrary.ts` content (3 failing assertions)

**Type:** Bug / test-vs-data drift
**Priority:** Medium (real red tests; masks genuine rationale regressions)
**Discovered:** During the `1.0.5-fixes` work — confirmed PRE-EXISTING and unrelated to the
three bugs in that spec (nothing in 1.0.5 touched `curatedLibrary.ts` or these tests). Surfaced
because the run exercised the full Jest suite.

**Symptoms (in `src/data/__tests__/curatedLibrary.rationale.grounding.test.ts` and
`...rationale.property.test.ts`):**
- `lib-grounding-54321 has correct approach` — expects a specific `approach`, receives
  `"somatic techniques"` (the static data and the test's `EXPECTED_APPROACHES` map disagree).
- `learnMoreLinks use credible domains only` — a `learnMoreLinks` entry's `title.length`
  exceeds the 100-char cap the test enforces (received 115 for `lib-box-breathing`/`lib-pmr`,
  121 for `lib-name-it-tame-it`), and at least one link's hostname is not in the test's
  `CREDIBLE_DOMAINS` allow-list.
- Property 9 (`every card rationale passes validateRationaleMetadata`) also flags a card.

**Root cause:** the rationale content in `src/data/curatedLibrary.ts` (approach value, link
titles, link domains) has diverged from the constraints these tests assert. Either the data was
edited without updating the tests, or the tests encode rules the data was never trimmed to meet.
Needs a decision per assertion: fix the data (shorten titles to <=100, use an allow-listed
domain, correct the approach) OR update the test's expectations if the rule/expected value is
stale.

**Files:**
- `src/data/curatedLibrary.ts` (rationale for `lib-grounding-54321`, `lib-box-breathing`
  (L146), `lib-pmr` (L209), `lib-name-it-tame-it` (L261) — approach, `learnMoreLinks` titles/URLs)
- `src/data/__tests__/curatedLibrary.rationale.grounding.test.ts` (`EXPECTED_APPROACHES`,
  `CREDIBLE_DOMAINS`, the <=100 title-length rule)
- `src/data/__tests__/curatedLibrary.rationale.property.test.ts` (Property 9)

**Risk if deferred:** Medium — these suites are red, so a real future rationale regression
(bad domain, over-long title, wrong approach) is indistinguishable from the existing failures
and would slip through. Also note the admin-editing/export flow validates rationale
(`validateExportReadiness`), so drift here can affect what an admin can export.

---

## expo-file-system mock breaks ~1/5 of the Jest suite at import time

**Type:** Bug / test infrastructure
**Priority:** Medium (blocks real coverage on affected suites)
**Discovered:** During the `1.0.4-wallet-growth-instrumentation` work — running `npx jest`
showed 21 of 158 suites failing (28 tests) with `TypeError: Cannot read properties of
undefined (reading 'cache')`. Confirmed pre-existing: the identical `21 failed / 28 failed`
result reproduces on a clean tree (with all feature changes stashed), so it is unrelated to
that feature.

**Root cause:** `src/components/wallet/ThirdPartyIcon.tsx:27` runs
`new Directory(Paths.cache, 'icon-cache')` at module load. Under jest-expo, `Paths` (from the
new `expo-file-system` API) is not mocked, so `Paths.cache` is `undefined` and the `new
Directory(...)` throws **at import time**. Any suite whose import graph reaches
`ThirdPartyIcon` (via `renderCardIcon` → `CardPreviewSheet`, `LibraryToolPreview`,
`ArchiveScreen`, `SessionView`, `ToolPreviewCard`, etc.) fails to even load — before any test
assertion runs. This means those suites currently provide **no** coverage, and code paths that
happen to touch them (e.g. the widened `onAddToWallet` signature) are only guarded by the
typechecker, not by a running test.

**Proposed fix:** add a jest mock for the `expo-file-system` `Paths`/`Directory` API (in the
jest setup or `__mocks__`) that returns a stub cache dir, OR lazily construct `ICON_CACHE_DIR`
inside the function that needs it instead of at module top-level, so importing the component
never throws. Prefer the mock so component tests exercise the real module.

**Files:**
- `jest.config.js` / jest setup (add the mock) — or `src/components/wallet/ThirdPartyIcon.tsx`
  (defer the `new Directory(...)` off module load)
- Affected suites (examples): `src/components/session/__tests__/SessionLauncherContent.walletState.test.tsx`,
  `ToolPreviewCard.test.ts`, `SessionView.test.tsx`, `CardPreviewSheet.test.tsx`,
  `LibraryToolPreview.crisisNav.test.tsx`, `ArchiveScreen.originBadge.test.tsx`, and ~15 others.

**Risk if deferred:** Medium — a fifth of the suite silently doesn't run, so regressions in
those components (including the session add/preview flows just instrumented) won't be caught by
CI until the mock is fixed.

---

## Onboarding state reset should use a shared default (avoid per-field drift)

**Type:** Refactor / maintainability
**Priority:** Low
**Discovered:** During post-1.0.3 fixes (Bug 4b — the new `collapsedStackHintSeen` flag was
not reset by the developer "Reset Onboarding" action because the reset hardcoded each field).

**Problem:** The developer reset handlers in `src/screens/SettingsScreen.tsx`
(`handleResetOnboarding` and `handleResetEntireApp`) reset the Zustand onboarding store by
listing every field explicitly in `useOnboardingStore.setState({ ... })`. `src/stores/onboardingStore.ts`
also defines a `DEFAULT_STATE` object separately. Whenever a new onboarding flag is added to
the store, it must be manually added in **three** places (the store's `DEFAULT_STATE`, and
both reset handlers). Forgetting the reset handlers means the flag persists in memory after a
reset — exactly the bug that surfaced with `collapsedStackHintSeen`.

**Proposed fix:** Export a single canonical default from the store (e.g. `DEFAULT_STATE` plus
its derived fields, or a `resetOnboardingState()` action on the store) and have both
`SettingsScreen` handlers call that instead of re-listing fields inline. New flags then only
need to be added in one place.

**Files:**
- `src/stores/onboardingStore.ts` (export a default/reset)
- `src/screens/SettingsScreen.tsx` (`handleResetOnboarding`, `handleResetEntireApp`)

**Risk if deferred:** Low but recurring — each new onboarding flag risks the same
reset-doesn't-clear-it bug until the reset paths are consolidated.

---

## Duplicated tip-frontmatter parser + web-only-block strip across send scripts

**Type:** Refactor / DRY
**Priority:** Low
**Discovered:** During tip media work (adding email GIF + stripping the website-only
`<figure class="tip-anim">` from email bodies).

**Problem:** `messaging-worker/scripts/send-tip.ts` and `messaging-worker/scripts/run-campaign.ts`
each carry their own copy of the tip frontmatter parser (`parseTipFile`) and now also their
own copy of `stripWebOnlyBlocks()`. A third, slightly different parser exists in
`website/build-content.js`. Any change to the tip schema or to what counts as "web-only"
markup must be made in multiple places, which is error-prone.

**Proposed fix:** Extract a single shared tip-parsing/normalization helper (frontmatter parse
+ `stripWebOnlyBlocks`) used by both messaging scripts (and ideally aligned with the website
build's parser). Keep the "strip web-only blocks before email" rule in exactly one place.

**Files:**
- `messaging-worker/scripts/send-tip.ts`
- `messaging-worker/scripts/run-campaign.ts`
- `website/build-content.js` (parser alignment, optional)

**Risk if deferred:** Low but recurring — schema/markup changes can silently diverge between
the single-send and campaign paths (e.g. a new web-only block type stripped in one but not the
other).

---

## Email body renders as plain text (no inline media/formatting)

**Type:** Feature / limitation (spec'd)
**Priority:** Medium (when inline email media is wanted)
**Discovered:** Wiring the welcome tip — the website shows an inline animation, but the email
can only show media via the top `heroImage` GIF; inline HTML in the body is escaped to text,
so we strip it for email.

**Status:** Requirements written — see `.kiro/specs/email-inline-media/requirements.md`.

**Summary:** `messaging-worker/src/index.ts` renders the tip body with `escapeHtml` (plain
text) and hardcodes `heroImage` at the top. The interim `stripWebOnlyBlocks()` keeps email
bodies clean, but authors can't place media mid-email. The spec covers rendering the body as
sanitized HTML so a single authored tip can position media anywhere in both web and email.

---

## Email links should match the sending domain (deliverability polish)

**Type:** Improvement / email deliverability
**Priority:** Low
**Discovered:** First real tip email batch — Resend's "Insights" flagged: "Ensure link URLs
match sending domain. Mismatched URLs can trigger spam filters." The flagged link was the
App Store URL (`https://apps.apple.com/app/mental-health-wallet/id6800036822`).

**Assessment:** Low risk as-is. The mismatched link is the Apple App Store — a highly
trusted domain — and it's the obvious CTA for an app's email, so it's unlikely to hurt
placement. Sending domain (`productsforgood.co`) auth (SPF/DKIM/DMARC), list quality, and
complaint rate matter far more. We chose to ship the batch without changing this.

**Proposed improvement (when convenient):** Route email store links through our own domain so
the link domain matches the sender. The website tip articles already do this — the article
CTA uses `/#hero` + `app-cta.js` to redirect to the right store per platform. The email CTA
and any in-body store links, however, use the raw `apps.apple.com` / Play Store URLs. Point
the email CTA at a `https://mentalhealthwallet.productsforgood.co/…` download/redirect URL
(reusing the same per-platform redirect logic) so all links share the sending domain. This
removes the Resend warning and is marginally better for deliverability.

**Files:**
- `messaging-worker/src/index.ts` (tip email CTA + any store links)
- `content/tips/*.md` (tip `cta.url` values point directly at stores today)
- `website/app-cta.js` (existing per-platform redirect logic to reuse)

**Risk if deferred:** Low — a cosmetic Resend warning; no known deliverability problem for a
trusted store link.

---

## Campaign retries a non-transient failure forever (infinite chunk loop)

**Type:** Bug / robustness
**Priority:** Medium-High (can stall a real batch)
**Discovered:** First real "Welcome wave" batch. Chunk 1 sent 5 recipients fine but 1
recipient (the operator's own address) failed with a Resend `409 invalid_idempotent_request`.
Every subsequent chunk retried that same recipient, failed identically, and `remaining`
never dropped below 1 — an effectively infinite loop (chunk 2..16+ all `sent=0 failed=1
remaining=1`) until the run was manually stopped.

**Root cause:** The campaign loop treats a recipient as "done" only when their `tip_sends`
row is `sent`/`pending`, and it retries `failed` rows on the next chunk. That's correct for
*transient* failures, but a 409 idempotency collision (see item below) is **not transient**
within 24h, so the recipient can never move out of `failed` and the batch spins forever.

**Proposed fix:**
- Treat certain failures as **terminal** (don't retry within the run): e.g. 409
  idempotency collisions, hard bounces, invalid-address — mark a terminal state (e.g.
  `failed_permanent`) that the audience/remaining query excludes.
- Add a **max-attempts / backoff** per recipient, and detect **no-progress chunks** (if a
  chunk yields `sent=0` and `remaining` is unchanged, stop and report rather than loop).
- Surface a clear end-of-run summary instead of looping.

**Files:** `messaging-worker/src/index.ts` (campaign execute loop + `selectAudience`
`notYetClause`; the `tip_sends` status handling).

**Interim workaround:** if a batch gets stuck on one recipient, stop the run and either mark
that recipient's `tip_sends` row `sent` (if they actually got it) or delete it, then re-run.

---

## Idempotency key ignores body/version — editing a tip and re-sending within 24h fails

**Type:** Bug / operability
**Priority:** Medium
**Discovered:** Same batch. The worker sends Resend an `Idempotency-Key` of
`${tip_slug}:${email}` (e.g. `welcome:me@…`). Resend caches that key for 24h. After we edited
the welcome email (paragraph-rendering fix) and re-sent to the same address, Resend returned
`409 invalid_idempotent_request` ("same key, modified body"). Note this is enforced on
**Resend's servers**, independent of our `tip_sends` table — deleting the D1 row does NOT
clear it.

**Root cause:** the idempotency key is stable across content changes (no body hash / version
/ campaign component), so a legitimately *edited* re-send within 24h looks like a conflicting
duplicate.

**Proposed fix:** include a content/version discriminator in the key, e.g.
`${tip_slug}:${version}:${email}` or `${tip_slug}:${bodyHash}:${email}` (tip frontmatter
already has a `version` field). An edited resend then gets a fresh key and is accepted, while
true accidental duplicates (same content) still dedupe. Pairs with the terminal-failure fix
above so a 409 doesn't loop.

**Files:** `messaging-worker/src/index.ts` (`send-test` idempotency key ~L448 and campaign
loop `idempotencyKey` ~L985); tip `version` in `content/tips/*.md` frontmatter.

**Operator note:** during iteration, re-send edited tips to yourself **without `--record`**
(no idempotency key is sent), or use a fresh `+alias`, or wait ~24h for the key to expire.
