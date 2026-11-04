# Design Document — 1.0.6 Bug Fixes

## Overview

This design covers the four 1.0.6 bug fixes defined in `requirements.md`. They span three
independently-deployable surfaces — the React Native app, the marketing website build
(`website/build-content.js` + static pages), and the Cloudflare messaging worker
(`messaging-worker/`) — so the design is organized **per bug**, each with its concrete
mechanism, the files it touches, the data/shape changes, and an honest per-bug testing
strategy that separates what is unit-testable from what can only be confirmed on a real
device or a real send.

The spec is a bugfix spec, so `tasks.md` will follow the per-bug sequential cycle required by
the `workflow` steering rule (exploration test → preservation test → fix → checkpoint, one
bug fully done before the next). To make that shape possible, each section below names the
**layer a regression test must cover** and whether the fix is provable by automated tests or
requires an on-device / real-run pass.

Two bugs make a decision the requirements explicitly defer to design, and both are made here,
not left open:

- **Bug 1 (in-app rendering):** the app will **render tips natively** (a new native
  tip-detail screen) and reach the full body by adding `body` + `cta` to the shared published
  content index. It will stop delegating the tip to the website in an in-app browser. The CTA
  becomes a native `navigation.navigate(...)`. Rationale and the body-format choice (store
  **raw markdown** in the index, render with a lightweight markdown renderer) are in §Bug 1.
- **Bug 4 (unsubscribed → "waiting"):** the fix **adds an explicit `unsubscribed` status**
  distinct from `waiting` (rather than silently filtering opted-out people out of the
  considered set), so the operator still sees that the person exists but is correctly labeled.
  Rationale in §Bug 4.

Nothing in this design changes **who receives email** (Bug 4 and Bug 1 are both consent- and
audience-neutral — Req 1.7, 4.3), and nothing changes tip wording or the drip sequence
(out of scope).

## Requirements Traceability

| Requirement | Where addressed |
|---|---|
| 1.1 content consistent on all three surfaces | §Bug 1 — Single Source → Three Surfaces |
| 1.2 email includes full body | §Bug 1 — Email (worker) |
| 1.3 in-app view includes CTA | §Bug 1 — In-App Native Tip Detail |
| 1.4 only context differs | §Bug 1 — Single Source → Three Surfaces |
| 1.5 authored once, single source | §Bug 1 — Single Source → Three Surfaces |
| 1.6 documented per-surface exception | §Bug 1 — Deliberate Per-Surface Exceptions |
| 1.7 email compliance/consent preserved | §Bug 1 — Email (worker) |
| 1.8 in-app CTA navigates directly | §Bug 1 — In-App Native Tip Detail |
| 1.9 in-app CTA = native navigation, not web link | §Bug 1 — In-App Native Tip Detail & §Bug 2 |
| 1.10 in-app tip rendered within the app | §Bug 1 — In-App Native Tip Detail |
| 2.1 CTA opens Create Tool, not Add Tool | §Bug 2 — The `create-tool` Route |
| 2.2 existing add-tool link unchanged | §Bug 2 — The `create-tool` Route |
| 2.3 not-installed fallback for create-tool | §Bug 2 — Website Fallback Copy |
| 2.4 fix works from email, website, and in-app | §Bug 2 — The `create-tool` Route & §Bug 1 |
| 3B.1 archived tool's reminders stop firing | §Bug 3 — Instrumentation Plan & Conditional Fixes |
| 3B.2 reminder definition preserved | §Bug 3 (preserved by current archive path; confirmed) |
| 3B.3 restore re-arms reminder, no regression | §Bug 3 — Regression Coverage |
| 3B.4 establish on-device cause before fixing | §Bug 3 — Instrumentation Plan |
| 3B.5 regression test at the real layer | §Bug 3 — Regression Coverage |
| 4.1 unsubscribed not reported "waiting" | §Bug 4 — Classification Change |
| 4.2 exclude-vs-label decision recorded | §Bug 4 — Decision: Explicit `unsubscribed` Status |
| 4.3 reporting-only, does not change sends | §Bug 4 — Scope of the Change |
| 4.4 sent/waiting/finished unchanged for subscribers | §Bug 4 — Classification Change |
| V.1 all three surfaces match (verify) | §Bug 1 — Testing Strategy |
| V.2 create-tool opens builder (verify) | §Bug 2 — Testing Strategy |
| V.3 route layer tested, device open is the caveat | §Bug 2 — Testing Strategy |
| V.4 archived-reminder confirmed on-device | §Bug 3 — Testing Strategy |
| V.5 unsubscribed-not-waiting unit-tested | §Bug 4 — Testing Strategy |

---

## Bug 1 — A Tip Renders the Same Content Everywhere

### Root cause (confirmed in code)

A tip is authored once in `content/tips/<slug>.md`: frontmatter (`title, summary, slug, type,
topics, heroImage, cta{label,url}, publishedAt, version`) plus a markdown **body**.
`website/build-content.js` already parses the full body (`parseTip` → `tip.body`) and uses it
to render the website article page (`renderArticle` → `marked.parse(tip.body)`). But the
machine-readable index it emits, `website/content/index.json`, is built body-less:

```js
const index = tips.map((t) => ({ slug, title, summary, type, topics, heroImage, cta, url, publishedAt }));
// no body
```

Both body-less consumers read that same index:

- **The drip email** (`messaging-worker`): `fetchTipIndex` parses `/content/index.json` into
  `ContentIndexEntry` (`slug, title, summary, heroImage, cta` — body intentionally absent per
  its comment) → `TipPayload`. Notably, `sendTipEmail` **already renders a body when present**
  (`tip.body` → split into `<p>` paragraphs, plus plain-text). The email is thin only because
  the index never carries the body, so `TipPayload.body` is always `undefined`.
- **The in-app feed** (`src/services/tipsService.ts` → `src/screens/TipsFeedScreen.tsx`):
  `getTips()` parses the same index into `Tip` (no body), and `TipsFeedScreen.openTip` calls
  `WebBrowser.openBrowserAsync(resolveTipUrl(tip))` — it opens the **website article in an
  in-app browser** and never renders a body or a CTA itself.

So "make the three surfaces consistent" requires (a) putting the body into the shared index so
it reaches email and app, and (b) replacing the app's in-app-browser delegation with a native
render that includes the CTA.

### Single Source → Three Surfaces (Req 1.1, 1.4, 1.5)

Keep the single authored source (`content/tips/<slug>.md`). Make the full content flow from it
by **adding `body` (and ensuring `cta`) to the generated `content/index.json`**. The website
build is the one place that already has the parsed body, so it is the right producer.

**Body format in the index — decision: store raw markdown, not pre-rendered HTML.** Two options:

- **(A) raw markdown** (chosen): the index carries `body` as the raw markdown string. The
  website already converts markdown → HTML with `marked` at build time for its article page;
  the email already treats the body as plain-ish text (paragraph split, fully escaped — it
  deliberately does **not** inject rich HTML, per its comment and the `email-inline-media`
  spec); and the app can render markdown natively with a lightweight renderer. Each surface
  renders from the same source string in the way that fits its medium.
- **(B) pre-rendered HTML** (rejected): would suit the website trivially but forces the email
  (which intentionally avoids rich HTML) and the native app (which cannot mount arbitrary
  HTML without a WebView — the very thing Bug 1 is removing) to parse/strip HTML. It also
  bloats the index with markup.

Raw markdown keeps the index a clean content payload and lets each surface own its rendering.
Payload size: bodies are a few short paragraphs of text; adding them to the index is a modest
increase (the index is already fetched whole by both the worker and the app, and the app
caches it to a file). This is acceptable and far smaller than the alternative of each surface
fetching per-tip HTML.

**Files touched:**

- `website/build-content.js` — add `body: t.body` (and keep `cta`) to the `index` mapping.
  No change to `renderArticle` (the website article is already correct and is the reference
  rendering).

### Email (worker) (Req 1.2, 1.7)

The worker side needs almost no new rendering — only to **carry the body through**:

- `messaging-worker/src/index.ts`: extend `ContentIndexEntry` with `body?: string`, and have
  `fetchTipIndex`'s `parseTip` map `body` into the `TipPayload` (the existing `parseTip`
  already accepts `body` from a request body; apply the same to the index entry). Once
  `TipPayload.body` is populated, `sendTipEmail`'s existing body rendering produces the full
  email with no further change.
- The greeting, signature ("Cheers, Moshe / Products for Good"), and the compliance wrapper
  (List-Unsubscribe header via `sendViaResend`, and the Manage-preferences / Unsubscribe
  footer) are untouched — they already wrap `sendTipEmail`. This satisfies Req 1.7 (consent
  and compliance preserved; who receives a tip is unchanged).

Edge cases: a tip with no body (older/short tips) → `body` stays `undefined` → email renders
title + summary + CTA exactly as today (graceful, no regression). A malformed index entry is
already dropped by `parseTip`.

### In-App Native Tip Detail (Req 1.3, 1.8, 1.9, 1.10) — the big decision

**Decision: render the tip natively in the app and make the CTA a native navigation call.**
Stop opening the tip's website article in an in-app browser.

Why this is forced, not optional: today the app opens the tip's web page in
`SFSafariViewController` (iOS) / Chrome Custom Tabs (Android). A CTA on that web page is a
Universal/App Link back into the app. When the reader is **already inside the app**, the
in-app browser does **not** hand that link back to the presenting app — it falls through to
the `/app/*` not-installed fallback web page, a dead end (same class of failure as Bug 2's
mis-route, but triggered from inside the app). So a working in-app CTA cannot live on a web
page shown in an in-app browser; the tip must be rendered **within the app** so its CTA can be
an in-process `navigation.navigate(...)`.

**New screen: `TipDetailScreen`** (`src/screens/TipDetailScreen.tsx`), pushed onto the root
stack.

- **Route:** add `TipDetail: { slug: string }` to `RootStackParamList` (`src/navigation/types.ts`)
  and register it in `RootNavigator.tsx` as a push screen (same pattern as `Tips`,
  `UsageHistory`). It receives the tapped tip's `slug`; `TipsFeedScreen` already holds the full
  `Tip` list, so the detail screen can look the tip up from the in-memory list passed via a
  param or re-read from `tipsService`. **Decision: pass the whole `Tip` object as the route
  param** (`TipDetail: { tip: Tip }`) to avoid a second fetch and a not-found path — the feed
  already has it in hand. (`slug` alone would require re-resolving; passing the object is
  simpler and the object is small and serializable.)
- **Rendering:** title, hero image (when `heroImage` is set), body, and a native CTA button.
  - **Body renderer — decision: add `react-native-markdown-display`.** The app currently has
    **no** markdown renderer (confirmed: not in `package.json`), and the body is authored in
    markdown. Options considered: (a) a minimal hand-rolled block renderer that splits on blank
    lines into `<Text>` paragraphs (no new dep, but drops lists/bold/links/the inline
    `<figure class="tip-media">` media the bodies use); (b) `react-native-markdown-display`, a
    maintained, widely-used pure-JS markdown→RN renderer with no native module (so it needs **no**
    native rebuild of its own and works under the New Architecture). Chosen: **(b)**, because tip
    bodies use real markdown structure (headings, bold, lists) and we want parity with the
    website rendering; a hand-rolled renderer would reintroduce the "thinner in one place"
    inconsistency this bug exists to remove. The dependency is added with a pinned version and
    is JS-only. Raw HTML embedded in a body (the `<figure class="tip-media">` GIF block the
    website shows inline) is **not** rendered natively — see Deliberate Per-Surface Exceptions.
  - **CTA button:** a native button labeled from `tip.cta.label` that calls the app's own
    navigation, mapping `tip.cta.url`'s route to an in-app destination (see "CTA route
    mapping" below). It never opens a URL in a browser.
- **`TipsFeedScreen` change:** `openTip` changes from `WebBrowser.openBrowserAsync(...)` to
  `navigation.navigate('TipDetail', { tip })`. `resolveTipUrl` and the `expo-web-browser`
  import are removed from this screen (keep the `tip_opened` analytics event). The feed list UI
  is otherwise unchanged.

**CTA route mapping (shared with Bug 2).** The tip's `cta.url` is a Universal Link like
`https://.../app/create-tool`. In the app we must turn that into a native navigation action,
**not** feed it to `Linking.openURL` (which could bounce back out). Add a small pure helper,
e.g. `tipCtaToNavigation(url): { screen: keyof RootStackParamList; params?: object } | null`,
that extracts the `/app/<route>` path and maps it to the same screen the deep-link table
resolves (`create-tool` → `CardCreator`, `add-tool` → `LibraryBrowser`, `wallet`/`checkin`/
`how-i-feel`/`learn-more-tour` → `MainTabs`/`Wallet` with the corresponding param, etc.). The
CTA button calls `navigation.navigate(mapped.screen, mapped.params)`. This helper is pure and
unit-testable, and it is the in-app counterpart to `linking.ts`'s `getStateFromPath`. If a CTA
URL is external/non-`/app` or unmapped, fall back to opening it with `Linking.openURL` (rare;
keeps a sane default).

**Files touched (app):** `src/screens/TipsFeedScreen.tsx` (navigate instead of browser),
`src/screens/TipDetailScreen.tsx` (new), `src/navigation/types.ts` (+`TipDetail` route),
`src/navigation/RootNavigator.tsx` (register screen), `src/types/tips.ts` (+`body?: string` on
`Tip`), `src/services/tipsService.ts` (`parseTip` maps `body`), a new
`src/services/tipCtaNavigation.ts` (the pure CTA→nav mapper), and `package.json`
(+`react-native-markdown-display`, pinned).

### Deliberate Per-Surface Exceptions (Req 1.6)

The only intentional difference beyond the surrounding context:

- **Website shows an inline animated `<figure class="tip-media">` GIF in the body and then
  suppresses the top hero** when the body contains inline media (existing `bodyHasInlineMedia`
  logic in `renderArticle`). The **email and app** cannot run that inline HTML figure, so they
  show the `heroImage` (a still/GIF) at the top instead. Net effect: all three show the same
  hero media; only its placement (inline vs. top) differs, driven by medium capability. This is
  a documented, deliberate exception, not an accidental omission. The native app renderer
  therefore renders the body's prose/markdown but does **not** attempt to render embedded raw
  HTML figure blocks; the hero at the top carries that media.

### Testing Strategy — Bug 1

- **Website build (unit, Node):** run `build-content.js` over a fixture tip and assert the
  emitted `content/index.json` entry now contains `body` and `cta`. Unit-provable.
- **Worker (unit, `node:test`):** feed a `ContentIndexEntry` with a `body` through
  `parseTip`/the index map and assert `TipPayload.body` is populated and `sendTipEmail`'s body
  rendering emits the paragraphs. The assembly layer is unit-provable; the actual delivered
  email is confirmed by a real send (V.1).
- **App (unit, Jest):** assert `tipsService.parseTip` carries `body` through; assert
  `tipCtaToNavigation` maps `/app/create-tool` → `{ screen: 'CardCreator' }` and the other
  routes; assert `TipsFeedScreen` navigates to `TipDetail` (not the browser) on tap. Render
  `TipDetailScreen` with a fixture tip and assert title/hero/body/CTA are present.
- **On-device / real-run caveat (honest):** that the three surfaces truly match for a given
  tip (V.1) is confirmed by sending a real drip email and opening the same tip in a device
  build and on the website. The in-app CTA actually opening the Create Tool screen is on-device
  (it's native navigation, so it is far more reliable than the old browser path, but the full
  cold path is still a device check). Unit tests cover content assembly + route mapping, not
  the rendered pixels or the real email.

---

## Bug 2 — The "Create your own tool" Deep Link Opens the Wrong Screen

### Root cause (confirmed in code)

`src/navigation/linking.ts` has **no** `create-tool` route. The `add-tool` route resolves to
`LibraryBrowser` (the library), and the tip `content/tips/add-your-own-tool.md` points its CTA
at `https://.../app/add-tool`. So "Create your own tool" lands on the library browser. The
Create Tool builder is `CardCreatorScreen`, route name `CardCreator` in `RootStackParamList`;
the wallet menu opens it in new-tool mode with **no params** (`WalletScreen.handleCreateToolPress`
→ `navigation.navigate('CardCreator')`). So the correct destination is `CardCreator` with no
params.

### The `create-tool` Route (Req 2.1, 2.2, 2.4)

Add a `create-tool` route that resolves to `CardCreator` (new-tool mode, no params), for both
transports (`mentalwallet://create-tool` and `https://.../app/create-tool`):

- In `linking.ts` `config.screens`, add `CardCreator: 'create-tool'` alongside the existing
  `LibraryBrowser: 'add-tool'`. No `getStateFromPath` special-case is needed because, like
  `add-tool`, it is a bare path with no verb-to-param translation — the default parser handles
  it, and the `initialRouteName: 'MainTabs'` base already ensures the modal/pushed screen has a
  wallet under it (same reasoning as the existing comment for cold-opened screens).
- `add-tool` → `LibraryBrowser` is left exactly as-is (Req 2.2).

**Point the tip CTA at it (Req 2.4):** change `content/tips/add-your-own-tool.md` frontmatter
`cta.url` from `.../app/add-tool` to `.../app/create-tool`. Because this edits a tip's
user-visible content, **bump that tip's `version`** (frontmatter `version: 3` → `4`) per the
card/content-versioning convention. (This is the *tip content* version — the number the
website build and the drip read — **not** the app marketing version.) The website build and the
worker pick up the new CTA URL automatically from the single source. The in-app CTA (Bug 1)
maps `create-tool` → `CardCreator` via `tipCtaToNavigation`, so all three surfaces send the
reader to Create Tool.

**Update the reference table** in `docs/deployment/deep-links.md`: add a `create-tool` →
Card creator row to the Routes table, and move `add-your-own-tool` to `create-tool` in the Tip
CTA mapping table (leave `add-your-own-app` on `add-tool`).

### Website Fallback Copy (Req 2.3)

Add a `create-tool` entry to the route→copy map in `website/app-fallback.html`'s `ROUTE_COPY`
(e.g. headline "Create your own tool", sub "Get the app to build a custom coping tool from
scratch."), keeping it in sync with the `deep-links.md` route list (that file is the canonical
list per its own note). An un-mapped route would silently fall back to the generic "Open your
wallet" copy, so this entry is what makes the not-installed experience say the right thing.

### Testing Strategy — Bug 2

- **Route parsing (unit, Jest)** — the pattern is `src/navigation/__tests__/linking.test.ts`.
  Add: `create-tool` resolves to `CardCreator`; `/app/create-tool` resolves to `CardCreator`;
  a trailing-slash `create-tool/` tolerated (Android normalization); and `add-tool` still
  resolves to `LibraryBrowser` (preservation). Unit-provable.
- **CTA mapping (unit, Jest):** `tipCtaToNavigation('.../app/create-tool')` →
  `{ screen: 'CardCreator' }` (shared with Bug 1).
- **On-device caveat (V.3, honest):** the route-resolution layer is fully unit-tested, but the
  actual open from a tapped email CTA / a cold app start / a Universal Link opening the
  installed app can only be confirmed on a real device/build — iOS Universal Links don't work
  on the Simulator, and the custom scheme needs a real native binary (Expo Go won't own it).
  State this in the task; do not claim the device open is proven by the unit tests.

---

## Bug 3 — An Archived Tool's Reminder Still Fires (Investigate-First)

Per Req 3B.4 this section is an **instrumentation plan**, not a fix. The archive→disable path
*reads* correct, yet the reminder still fires on a real 1.0.5 iPhone, so the real cause must be
established on-device before any code changes. The fix and its regression test land only after
a log confirms which seam fails.

### What the code does today (confirmed)

- `cardService.archive(id)` commits the archive transaction, then — **outside** the
  transaction — lazy-requires `reminderService` and calls `disableForCard(id)` inside a
  `try/catch` that **silently swallows any error** ("Non-fatal" comment).
- `reminderService.disableForCard(cardId)` selects active reminders for the card, calls
  `cancelNotificationIds(reminder.notificationId)` for each, then `UPDATE reminders SET
  is_active = 0 WHERE card_id = ?`.
- `cancelNotificationIds` parses `notification_id` (a JSON **array** string) via
  `parseNotificationIds` and calls `notificationService.cancelScheduled(id)` for each; each
  cancel is itself `.catch(() => {})` (swallowed).
- `notificationService.cancelScheduled(id)` → `Notifications.cancelScheduledNotificationAsync(id)`.
- `reconcileRemindersOnLaunch()` reschedules only reminders with `is_active = 1` whose stored
  ids are missing from the OS — so it should *not* re-arm an archived (inactive) reminder,
  **if** the `is_active = 0` write actually happened.

### Candidate root causes to confirm or eliminate

1. **Silent cancel failure.** `disableForCard` throws (e.g. DB locked, or
   `cancelScheduledNotificationAsync` rejects) and `archive`'s `try/catch` hides it, so
   `is_active` may even stay `1` — leaving the OS notification scheduled and reconcile re-arming
   it.
2. **Stored ids ≠ OS-scheduled ids.** The stored `notification_id` JSON array doesn't match the
   identifiers the OS actually scheduled, so `cancelScheduled` cancels **nothing** and the real
   notification survives. (Could happen if an earlier reschedule/reconcile changed the OS ids
   without updating the row, or a legacy single-string vs array mismatch.)
3. **Launch reconciliation / iOS repeating-notification semantics re-register or retain it.**
   A repeating `WEEKLY`/`DAILY` trigger that wasn't cancelled keeps firing; or reconcile
   re-arms because of (1)'s failed `is_active` write.
4. **Stale build.** The 1.0.5 device may predate the current archive-disable code — the symptom
   could be a shipped-code artifact, not current-code.

### Instrumentation Plan (Req 3B.4) — add temporary `__DEV__` logs

Add `if (__DEV__) console.log(...)` at the exact decision points below. Each log answers one
smallest question. (Per the debugging steering rule: instrument first, one log round beats
three speculative fixes; remove all diagnostics before committing.)

| Where | Log | Smallest question it answers |
|---|---|---|
| `cardService.archive`, start of the `try` after commit | `[arch] archive→disableForCard start id=<id>` | Does the disable call even run after archive? |
| `cardService.archive`, in the `catch` | `[arch] disableForCard THREW: <err>` | Is the swallowed catch hiding a failure? (cause #1) |
| `reminderService.disableForCard`, after the select | `[arch] activeReminders n=<count> ids=<stored notification_id values>` | Is there an active reminder, and what ids are stored? |
| `cancelNotificationIds` / loop | `[arch] cancelling id=<id>` and on each `.catch` `[arch] cancel FAILED id=<id> <err>` | Do cancels run, and do any fail? (cause #1/#2) |
| `disableForCard`, before the UPDATE and after | `[arch] is_active→0 updated rows=<changes>` | Did the inactive write actually commit? (cause #1) |
| At the archive point, read `Notifications.getAllScheduledNotificationsAsync()` and log identifiers | `[arch] OS scheduled before=<ids> after=<ids>` | Do the OS-scheduled identifiers match the stored ids, and did they disappear after cancel? (cause #2/#3 — the key comparison) |
| `reconcileRemindersOnLaunch`, per reminder | `[arch] reconcile reminder id=<id> active=<is_active> stored=<ids> missing=<bool>` | Is reconcile re-arming this reminder on next launch? (cause #3) |
| App start, once | `[arch] build-marker 1.0.6-bug3` | Rule out a stale build (cause #4) before anything else. |

**How to read them on-device:** build a dev/internal build with the markers, reproduce
(set a reminder, archive the card), and read the logs over `npx react-native log-ios` /
Metro / Xcode console (and Android logcat). The `build-marker` line must appear first to prove
the running artifact includes the instrumentation (stale-build hygiene). Because a native
notification behavior is involved, this is **device-only** — it cannot be confirmed on a
simulator reliably for repeating notifications.

### Decision tree → which fix applies

- If `OS scheduled before` ids **do not contain** the stored ids (cause #2): the fix is to
  cancel by the real OS identifiers — e.g. on archive, cancel by matching
  `getAllScheduledNotificationsAsync()` entries whose `data.cardId === id` (cancel by content,
  not by the stored array), and/or correct the id-storage path so stored ids always equal
  scheduled ids. Regression test at `reminderService` (the id-matching layer).
- If `disableForCard THREW` / `is_active→0 updated rows=0` (cause #1): the fix is to stop the
  silent swallow for the *disable* step (surface/log it, and ensure the `is_active=0` write and
  the cancels are ordered so a cancel failure can't skip the inactive write). Regression test
  asserts `is_active` is set and a cancel error is not silently lost.
- If reconcile re-arms an inactive reminder (cause #3): fix reconcile to never reschedule
  `is_active = 0` reminders (it already filters `WHERE is_active = 1`, so this would mean the
  row wasn't actually inactivated — folds back into cause #1), or cancel the repeating trigger
  explicitly. Regression test at `reconcileRemindersOnLaunch`.
- If it's a stale build (cause #4): rebuild current code and re-verify; no code change, but add
  the regression test anyway so the real layer stays covered.

No fix is written in this design; `tasks.md` will carry the instrumentation task first, then a
single conditional fix task keyed off what the logs show.

### Regression Coverage (Req 3B.5, 3B.3)

The regression test lands **at the layer the log identifies** — most likely
`reminderService.disableForCard` (that after archive, the card's reminders are both marked
`is_active = 0` **and** every scheduled OS notification for that card is cancelled, asserting
against a `notificationService` whose `getAllScheduledNotificationsAsync`/`cancelScheduled` are
mockable). It must assert the layer that was actually broken, not only the already-green
"marks inactive" path. A companion test preserves restore behavior (Req 3B.3):
`reactivateForCard` re-arms the preserved reminder after restore. `reminderService` already has
colocated tests under `src/services/__tests__/` to extend.

### Testing Strategy — Bug 3

- **Unit (Jest):** the regression tests above — provable that cancellation + inactivation both
  occur at the service layer with a mocked notification module.
- **On-device (V.4, the honest caveat):** the actual symptom (a real reminder firing after
  archive) and its disappearance after the fix can only be confirmed on a real iPhone, because
  it's an OS-scheduled repeating notification. State plainly: unit tests prove the service
  cancels/inactivates; the on-device "no notification fires after archive, and restore resumes
  it" pass is a manual device check and is required before claiming the bug fixed.

---

## Bug 4 — An Unsubscribed Person Is Reported as "Waiting"

### Root cause (confirmed in code)

In `messaging-worker/src/index.ts`, `resolveNextForSubscriber` computes eligibility for the
subscriber's frontier step and, when the subscriber is **not opted into the campaign's scope**,
returns `{ kind: 'waiting', campaign }`:

```ts
const scopeOptedIn = campaign.scope === 'reminders' ? sub.scope_reminders === 1 : sub.scope_tips === 1;
if (!scopeOptedIn) return { kind: 'waiting', campaign };
```

`runDripPass` then counts that as `waiting++` and pushes a `status: 'waiting'` plan entry, and
`buildDripSummary` (`dripSummary.ts`) renders it under the Waiting total. So an opted-out
(unsubscribed) person is folded into "waiting" even though they are not awaiting anything.
Consent still blocks the real send (this is purely a reporting defect) — the same scope check
prevents emailing them.

### Decision: add an explicit `unsubscribed` status (Req 4.2)

Two options the requirements leave to design:

- **(a) Exclude unsubscribed people from the considered set** before classification. Simplest
  for "waiting," but it makes opted-out people vanish from the summary and from the
  `total considered` count, so the operator loses visibility that they exist at all.
- **(b) Add an explicit `unsubscribed` status** distinct from `waiting` (chosen). The operator
  still sees the person, correctly labeled, and the counts gain an `unsubscribed` line while
  `waiting` becomes "genuinely awaiting" only.

**Chosen: (b).** It directly satisfies Req 4.1 ("not reported as waiting") and Req 4.2 ("shown
under a clearly distinct label") while keeping operator visibility — strictly more informative
than silently dropping them, and it maps cleanly onto the existing status enum and counts. The
scope/consent is already known at classification time (the `scopeOptedIn` check reads the
subscriber row's `scope_tips`/`scope_reminders`), so no extra data is needed.

### Classification Change (Req 4.1, 4.4)

- **`resolveNextForSubscriber`** (`index.ts`): when the frontier step exists but
  `!scopeOptedIn`, return a new kind `{ kind: 'unsubscribed', campaign }` instead of
  `'waiting'`. The gap-not-satisfied case **stays** `'waiting'` (that person genuinely is
  awaiting their next send). This keeps `waiting`/`finished`/`sent` correct and unchanged for
  still-subscribed people (Req 4.4).
- **`drip.ts` `NextStepResult`:** this pure type currently only knows `next | waiting |
  finished`. The scope/consent decision lives in the worker (`resolveNextForSubscriber`), not
  in the pure `resolveNextStep` (whose `isEligible` probe is always-true in the worker, with
  real eligibility applied after). So the new `unsubscribed` kind is introduced at the
  **worker** `resolveNextForSubscriber` return type (and the `runDripPass` switch), not inside
  `resolveNextStep`. `resolveNextStep` is unchanged. *(If preferred during implementation, the
  `NextStepResult` union may add `'unsubscribed'` for symmetry, but it is not required and
  `resolveNextStep` would never emit it — keep the change minimal and worker-local.)*
- **`runDripPass`:** add an `unsubscribed` counter and emit `status: 'unsubscribed'` plan
  entries; return `unsubscribed` alongside `sent/failed/skipped/finished/waiting`. The
  `waiting` count no longer includes opted-out people.
- **`dripSummary.ts`:** extend `SummaryPlanEntry.status` to include `'unsubscribed'`, add
  `unsubscribed` to `SummaryCounts`, and render an "Unsubscribed" total line (and, optionally, a
  short "Unsubscribed" list mirroring the failed-sends block) in both the text and HTML bodies.
  The "Waiting" line now means genuinely-awaiting only.
- `sendDripSummaryEmail` passes the new `unsubscribed` count into `buildDripSummary`'s
  `counts`.

### Scope of the Change (Req 4.3)

Reporting/classification only. The real send path is untouched: `sendTipEmail`/`sendOneDrip`
are only reached on `kind === 'next'`, and the scope check already prevents an opted-out person
from ever being `next`. No change to who receives email, to consent enforcement, or to the
drip sequence.

### Testing Strategy — Bug 4

Pure logic, fully unit-testable (no device, no real send) — this is the strongest-verified bug:

- **`drip`/`dripSummary` unit tests (`node:test`)** — extend `drip.test.ts` /
  `dripSummary.test.ts`:
  - A plan including an `unsubscribed` entry is **not** counted or labeled as `waiting`;
    `buildDripSummary` renders an Unsubscribed total and keeps Waiting for the genuinely-awaiting
    (V.5, Req 4.1/4.2).
  - Still-subscribed `waiting`/`finished`/`sent` entries classify exactly as before
    (Req 4.4 — a preservation test).
- `resolveNextForSubscriber`'s branch is covered by the worker's existing drip-pass test
  harness (it injects subscriber rows + `now`): a subscriber with the scope flag off yields
  `kind: 'unsubscribed'`, not `waiting`, and never a send.

---

## Deploy / Rollout

The four fixes ride different release vehicles — only the app parts need a store build:

- **Rides in the 1.0.6 app build (needs an app store build to reach users):** Bug 1 in-app
  native tip detail + the new markdown dependency + `TipsFeedScreen` change; Bug 2's
  `linking.ts` `create-tool` route; Bug 3's reminder fix. These reach users only via the app
  build — follow the release checklist (version already bumped to 1.0.6 in the four places).
- **Deploys independently of the app build:**
  - **Website** (`website/ build:content` + deploy): Bug 1's `index.json` `body` field and Bug
    2's `app-fallback.html` `create-tool` copy, plus the tip CTA URL + `version` bump in
    `content/tips/add-your-own-tool.md`. Deploying this first makes the body available to the
    email and makes the fallback copy correct **before** the app ships.
  - **Messaging worker** (`messaging-worker/ npm run deploy`): Bug 1's `ContentIndexEntry.body`
    pass-through (email full body) and all of Bug 4 (reporting fix). These are worker-only and
    reach the operator/subscribers on the next daily drip — no app build involved.
- **Deploy order (recommended):** website (body in index + create-tool fallback + tip CTA) →
  worker (email body + Bug 4 summary) → app build (native tip detail + create-tool route + Bug
  3 fix). Steps 1–2 make the content/summary correct immediately; step 3 completes the in-app
  surface. The three surfaces are only fully consistent once the app build ships, but no step
  regresses the others (an older app simply keeps opening the web article until updated).

## Open Questions for Tasks

- Final pinned version of `react-native-markdown-display` and confirmation it builds cleanly
  under Expo SDK 54 / RN 0.81 New Architecture (JS-only, expected fine; verify at task time).
- Whether to also surface a per-recipient "Unsubscribed" **list** in the operator summary
  (mirroring the failed-sends block) or only the count — decide in tasks based on operator
  preference; the count is the minimum to satisfy Req 4.1/4.2.
- Bug 3's concrete fix is intentionally deferred to the post-instrumentation task, chosen by
  the decision tree once the on-device logs identify the failing seam.
