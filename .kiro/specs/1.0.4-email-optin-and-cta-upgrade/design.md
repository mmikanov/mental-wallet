# Design Document — In-App Email Opt-In & Tip CTA Upgrade (1.0.4)

## Overview

Three communication-growth pieces:

1. **In-app email opt-in** — a privacy-preserving, link-out subscribe path. The app collects
   NO email; it opens the website subscribe page in an in-app browser. Two entry points: a
   permanent Settings row, and a one-time contextual prompt fired after the user has felt
   value (a completion milestone).
2. **Tip CTA upgrade** — once the deep-link routes + Universal Links ship (sibling spec
   `1.0.4-deep-linking`), point each tip's article CTA at the precise Universal Link (which
   opens the app when installed, falls back to the store/web when not), replacing the current
   interim dual-store button.
3. **`/app/*` not-installed fallback page** — a single smart web page that catches every
   `/app/*` deep link when the app is not installed, personalizes its message from the path,
   and offers the store. It is the "web fallback page" Req 2 depends on, owned here so it is no
   longer an unowned prerequisite.

Requirement 1 is independent of the routes and can ship anytime. Requirements 2 and 3 **depend
on `1.0.4-deep-linking` Req 3 & 4 being live** (the `/app/...` Universal Links must resolve), and
Req 2 additionally depends on Req 3 (the fallback page) so not-installed recipients don't 404.

## Privacy posture (must not regress)

The app currently collects no PII (Privacy Policy: anonymous analytics only). This design
keeps it that way: the opt-in **links out** to
`https://mentalhealthwallet.productsforgood.co/subscribe`, which handles the email + consent.
The app stores only a local boolean ("prompt already seen"), no email, no identifier. No
Privacy Policy or App Store / Play data-label change is required. This is called out because
adding any in-app email field would change the store disclosures.

## Current state (verified)

- **Settings link-out pattern:** `SettingsScreen` rows are hand-written JSX. External links
  are a `TouchableOpacity` (`styles.menuItem`) whose `onPress` calls
  `WebBrowser.openBrowserAsync(URL)` directly (Privacy Policy, Terms rows in the "Privacy &
  Data" section). `expo-web-browser` already imported.
- **URL constants:** `src/config/appInfo.ts` holds `SITE_ORIGIN`, `PRIVACY_POLICY_URL`,
  `TERMS_OF_SERVICE_URL`, store URLs. `SUBSCRIBE_URL` belongs here.
- **One-time-flag persistence:** two patterns exist. (a) the onboarding Zustand JSON blob
  (`PersistedState` + `getPersistedFields` + `loadState`, e.g. `bannerDismissed`,
  `collapsedStackHintSeen`); (b) the lighter discrete-key `settingsService`
  (`get/setDiscreetNotifications`, etc., one `settings` row = `'true'`/`'false'`). Either works;
  see decision below.
- **Completion signal + milestone:** there is **no global "total completions" counter** and no
  event bus. Per-card `cards.totalUses` is the authoritative counter (incremented in
  `completionService.updateStreakInternal`). The single funnel for a normal completion is
  `ExpandedContent.handleSubmit` → `submitCompletion` → `loadCards()`; that handler already
  branches into the outcome prompt. This is the natural place to check "has the user hit the
  value milestone?".
- **Reusable prompt UI:** `OnboardingBanner` is a self-contained inline banner (`{ visible,
  onDismiss }`, Reanimated fade, emoji + text + ✕, `accessibilityRole="alert"`). Best reuse for
  a lightweight one-time prompt (add a CTA button). No generic Modal wrapper exists.
- **Tip CTA (web):** each `content/tips/*.md` has a nested `cta: { label, url }` in
  frontmatter. `website/build-content.js` `renderArticle()` currently **ignores `cta.url`** and
  hardcodes `href="/#hero"` with class `app-cta`; `website/app-cta.js` rewrites that href to the
  platform store by user-agent (the interim dual-store behavior). The machine-readable
  `index.json` DOES carry the real `cta.url` (used by the in-app tips feed).

## Requirement 1: In-app email opt-in (link-out)

### 1a. Constant + Settings row (Req 1.2)

- Add `SUBSCRIBE_URL = `${SITE_ORIGIN}/subscribe`` (and, if the site has one,
  `SUBSCRIBE_MANAGE_URL` for opt-out/preferences) to `src/config/appInfo.ts`.
- Add an "Email updates" row in the Settings "Privacy & Data" section (next to Privacy/Terms),
  mirroring the Terms row exactly: `TouchableOpacity` (`styles.menuItem`), icon `✉️`,
  `menuItemText` "Email updates", chevron, `onPress={() => WebBrowser.openBrowserAsync(
  SUBSCRIBE_URL, { presentationStyle: PAGE_SHEET, ... })}` (match the TipsFeed styled sheet so
  it stays in-app, Req 1.8). Optional subtitle: "Occasional tips and reminders, opt out
  anytime." This is the always-available path (Req 1.2, 1.4).

### 1b. Contextual one-time prompt (Req 1.3–1.7)

- **Trigger (Req 1.3, open question resolved):** fire after the user's **3rd tool completion**
  (not the 2nd, to be safely past the onboarding micro-tutorial's first guided completion, and
  clearly "this is helping" rather than "just tried it once"). NOT during onboarding (Req 1.6).
  Measure via the sum of `cards.totalUses` right after `loadCards()` in
  `ExpandedContent.handleSubmit` (the completion just recorded is included). Alternative signal
  "first outcome check-in" was considered; total-completions is simpler and doesn't depend on
  the outcome-prompt setting being on.
- **Gate:** only when `emailOptInPromptSeen === false`. Fire once, ever. Do not show in the
  same breath as the outcome prompt, if the outcome prompt is showing, defer the opt-in to the
  next eligible completion (avoid stacking two prompts).
- **UI:** reuse the `OnboardingBanner` pattern as a new lightweight `EmailOptInPrompt`
  (inline banner or small bottom card) with plain framing (Req 1.5): "Want occasional tips and
  optional reminders by email? Change or stop anytime." Two actions: **Subscribe** (opens
  `SUBSCRIBE_URL` in the in-app browser, then marks seen) and **Not now / ✕** (marks seen,
  never shown again, Req 1.4). Dismissible, non-blocking.
- **Persistence (Req 1.4):** add `emailOptInPromptSeen` as a discrete `settingsService` key
  (`email_opt_in_prompt_seen`, `get/setEmailOptInPromptSeen`), the lightest option, no store
  wiring, matches `discreet_notifications`. Set it to `true` on either action (Subscribe or
  dismiss). Persisted in the `settings` table, survives restarts. Also clear it in the dev
  "reset app" path for parity (it lives in the settings table which the reset wipes, so this is
  automatic if reset clears `settings`; confirm).
- **Where it renders:** the prompt is wallet-level UI, not per-card. Cleanest: a small piece of
  state/among WalletScreen (or a dedicated `useEmailOptInPrompt` hook) that (1) on a completion
  event checks eligibility, (2) shows the banner over the wallet. Because `ExpandedContent` is
  where the completion happens but collapses back to the wallet, the hook should check
  eligibility after collapse (e.g. WalletScreen observes `cards` totalUses change, or the
  completion store exposes a "last completion" tick). Simplest concrete wiring: after
  `loadCards()` the wallet's `cards` update, a WalletScreen effect computes the total and, if
  the milestone is newly crossed and not seen, shows the prompt. Guard with a ref so it fires
  once per crossing.
- **Req 1.7 (non-openers):** inherent, the prompt only fires on app use. No push, no
  workaround. Documented as acceptable.

## Requirement 2: Upgrade tip CTAs (after routes ship)

**Hard dependency:** the `/app/...` Universal/App Links from `1.0.4-deep-linking` must be live
(association files served, routes resolving). Until then, leave the interim dual-store CTA.

### 2a. Point each tip's `cta.url` at its Universal Link (Req 2.1, 2.4)

Update `cta.url` in each `content/tips/*.md` from the current App Store URL to the precise
Universal Link per the requirements' mapping table:

| Tip | `cta.url` (Universal Link) | Label intent |
|---|---|---|
| welcome | `.../app/wallet` | Open the wallet |
| emotion-based-session | `.../app/how-i-feel` | Start from how I feel |
| feeling-anxious | `.../app/how-i-feel` | Start from how I feel |
| outcome-capture | `.../app/wallet` | Use a tool |
| personal-kpi-check-in | `.../app/checkin` | Daily seedling check-in |
| discover-third-party-apps | `.../app/add-tool?filter=apps` | Browse mental health apps |
| learn-more-evidence | `.../app/learn-more-tour` | See why a tool works (opens top card; its Learn more link is visible) |
| come-back-reset | `.../app/wallet` | Open the wallet |
| add-your-own-app | `.../app/add-tool` | Add your own |
| add-your-own-tool | `.../app/add-tool` (Create Tool lives in the library/creator) | Create a tool |
| reorder-tools | `.../app/wallet` | Open the wallet |
| archive-restore-tools | `.../app/wallet` | Open the wallet |

Two DISTINCT destinations (do not conflate):
- `/app/how-i-feel` → the **"Start from how I feel" card** (the `session-launcher` card, emotion
  picker → recommendations). This is what the emotion-session tips want.
- `/app/checkin` → the **seedling 🌱 daily KPI check-in card** (`lib-personal-kpi`). Only the
  `personal-kpi-check-in` tip wants this.

(`.../` = `https://mentalhealthwallet.productsforgood.co`.) Labels already exist in frontmatter;
adjust copy so it matches the destination (Req 2.4).

### 2b. Render a single real CTA using `cta.url` (Req 2.2, 2.5)

In `website/build-content.js` `renderArticle()`: stop hardcoding `href="/#hero"`; use
`tip.cta.url` (the Universal Link) as the href. Keep a single button (revert the interim
dual-store treatment).

### 2c. Store as the not-installed fallback (Req 2.3)

The Universal Link handles the installed case (OS opens the app). For the not-installed case,
the OS opens the URL in the browser, landing on the website's `/app/...` page, which offers the
store. That page is now designed and owned by **Requirement 3 below** (previously it was an
unowned "deep-linking spec deliverable"). Update `website/app-cta.js`: it no longer needs to
rewrite the article CTA href to a store (the Universal Link + the Req 3 fallback page handle
installed vs not-installed). Simplest: drop the client-side rewrite on the article pages; the
article href is now the real Universal Link. The store hand-off logic (platform detection)
moves to / is reused by the Req 3 fallback page.

### 2d. Build + deploy (Req 2.5)

Change is limited to `content/tips/*.md` (cta URLs/labels) + `renderArticle` + `app-cta.js`,
then a content rebuild and website deploy. No messaging-worker change.

## Requirement 3: `/app/*` not-installed fallback page

**Problem.** The tip CTAs (Req 2) point at `https://.../app/<route>` Universal/App Links. When
the app is installed, the OS intercepts the link and the web server is never hit. When it is
NOT installed, the browser loads `/app/<route>` from the marketing site — which today 404s
(the Cloudflare Worker serves static files from `website/` and there is nothing under `app/`).
Req 3 makes any `/app/*` path serve one helpful, path-aware page instead.

### 3a. Single smart page (Req 3.1, 3.2, 3.7)

- **One file:** `website/app/index.html`, built to match the site chrome (reuse the same
  `<nav>`/`<footer>`/`styles.css` as the hand-written pages and `build-content.js` output).
- **Path-aware copy:** an inline script reads `location.pathname`, normalizes it (strip leading
  `/app`, strip a trailing slash, ignore the query string), and looks the route up in a small
  `ROUTE_COPY` map (headline + supporting line from the requirements' canonical-copy table).
  Unknown routes and bare `/app` fall back to the generic "Open your wallet" entry. The script
  writes the chosen headline/subtext into the page before paint (kept inline in `<head>`/early
  body so there's no flash of placeholder copy).
- **No build coupling:** this is a static hand-written page, NOT generated by
  `build-content.js` (it isn't a tip). Keeping it separate avoids entangling the tips build with
  the fallback. The `ROUTE_COPY` map is small and colocated, with a comment naming
  `docs/deployment/deep-links.md` as the canonical route list (Req 3.6).

### 3b. Store hand-off (Req 3.3)

Reuse the existing platform detection from `website/app-cta.js` (iOS → App Store, Android →
Play, desktop/unknown → both). Concretely: factor the UA detection + store URLs so both the
article pages and this fallback page share one implementation (either the page includes
`app-cta.js` and targets a button with class `app-cta`, or a tiny shared helper is extracted).
The page always shows a store CTA; that is the not-installed fallback Req 2.3 refers to.

### 3c. Optional scheme attempt (Req 3.4)

On load the page MAY try `window.location = 'mentalwallet://<route>'` once (reconstructing the
route from the path) before showing the store buttons, so an installed user who somehow reaches
the page still gets bounced into the app. This must degrade cleanly: if nothing handles the
scheme, the page stays put and the store CTA is right there. Guard so it fires at most once and
never blocks rendering. If this proves flaky across browsers it can be dropped without
affecting the core fallback (the store CTA is the guarantee).

### 3d. Routing: make `/app/*` serve the page

The one real unknown is how the Cloudflare static-assets Worker resolves `/app/<route>` (a path
with no matching file) to `website/app/index.html`. Options, in order of preference:

1. **Cloudflare `_redirects`** rewrite: `/app/* /app/index.html 200` (a rewrite, not a redirect,
   so the URL stays `/app/checkin` and the script can read the path). Verify this Worker asset
   setup honors `_redirects`.
2. **`not_found_handling`** / SPA-style config in `wrangler.toml` `[assets]` that serves a
   designated page for unmatched paths — only acceptable if it can be scoped so it does NOT
   swallow legitimate 404s elsewhere on the site.
3. **Explicit tiny Worker route** for `/app/*` that returns the page, if neither static-asset
   mechanism fits.

Whichever mechanism, the acceptance is: `/app/checkin`, `/app/how-i-feel`, `/app/wallet`,
`/app/add-tool?filter=apps`, bare `/app`, and a trailing-slash variant all return HTTP 200 with
the fallback page, and existing pages (`/tips/...`, `/privacy.html`, association files under
`/.well-known/`, etc.) are unaffected. The `/.well-known/*` association files in particular MUST
keep their exact current behavior and content type.

### 3e. Deploy + verify

Rebuild is not required for the fallback page itself (hand-written), but the website is deployed
together (`wrangler deploy` from `website/`). Verify on desktop (view the page + store buttons
for several routes) and on a real device (installed → the Universal Link opens the app and never
shows this page; not installed → this page shows with the store CTA). iOS Universal Links need a
real device (Simulator is unreliable), consistent with the deep-linking spec.

## Files touched

App side (Req 1):
- `src/config/appInfo.ts` — `SUBSCRIBE_URL` (+ optional manage URL).
- `src/screens/SettingsScreen.tsx` — "Email updates" row.
- `src/services/settingsService.ts` — `get/setEmailOptInPromptSeen`.
- `src/components/onboarding/EmailOptInPrompt.tsx` (new, modeled on `OnboardingBanner`).
- `src/screens/WalletScreen.tsx` (or a `useEmailOptInPrompt` hook) — milestone check + render.

Website side (Req 2, after routes live):
- `content/tips/*.md` — `cta.url` (+ label copy).
- `website/build-content.js` — `renderArticle` uses `cta.url`.
- `website/app-cta.js` — drop the article-page store rewrite; store/platform logic reused by
  the Req 3 fallback page.

Website side (Req 3, the `/app/*` fallback page):
- `website/app/index.html` (new) — single path-aware fallback page (shared nav/footer/styles,
  `ROUTE_COPY` map, store CTA, optional scheme attempt).
- `website/_redirects` (new) or `website/wrangler.toml` — `/app/*` → `/app/index.html` (200
  rewrite) routing.
- `docs/deployment/deep-links.md` — note that the not-installed fallback for all `/app/*` paths
  is the single `website/app/index.html` page (keeps the route doc accurate).

## Testing strategy

Req 1 (app):
- **Unit:** `settingsService` `get/setEmailOptInPromptSeen` round-trips + default false;
  milestone helper (sum of `totalUses`) crosses at the 3rd completion; prompt gate: shown only
  when not-seen and milestone crossed, and never after either action.
- **Component:** `EmailOptInPrompt` renders, Subscribe calls `openBrowserAsync(SUBSCRIBE_URL)`
  and marks seen; dismiss marks seen; both hide it.
- **MANUAL:** Settings "Email updates" opens the subscribe page in the in-app browser and
  returns cleanly. Complete 3 tools → prompt appears once; dismiss → never again (relaunch to
  confirm persistence); Subscribe → opens page + never again. Confirm it does NOT appear during
  onboarding.

Req 2 (website, after routes live):
- Rebuild content; verify each article page renders ONE CTA whose href is the Universal Link;
  on a device with the app installed the CTA opens the app to the mapped screen; without the
  app it lands on the web fallback with the store. Verify `index.json` still carries `cta`.

Req 3 (website fallback page):
- **Local/HTTP:** every `/app/*` path returns 200 with the page: `/app/checkin`, `/app/how-i-feel`,
  `/app/wallet`, `/app/learn-more-tour`, `/app/add-tool`, `/app/add-tool?filter=apps`, bare
  `/app`, and a trailing-slash variant. Each known route shows its personalized headline; an
  unknown route (`/app/does-not-exist`) shows the generic copy. Existing pages still work
  (`/tips`, `/privacy.html`) and `/.well-known/apple-app-site-association` +
  `/.well-known/assetlinks.json` still return `application/json` unchanged.
- **Platform CTA:** the store button resolves to App Store on iOS UA, Play on Android UA, both
  on desktop (same behavior as the article CTA today).
- **MANUAL on device:** installed → the Universal Link opens the app and this page is NOT shown;
  not installed → this page shows with the store CTA (real device for iOS Universal Links).

## Requirements coverage

| Req | Addressed by |
|---|---|
| 1.1 no PII, link-out | opens `SUBSCRIBE_URL`; only a local boolean stored |
| 1.2 permanent Settings entry | "Email updates" row in Privacy & Data |
| 1.3 contextual prompt after value | fire on 3rd completion (sum of `totalUses`) |
| 1.4 dismiss once + persist | `emailOptInPromptSeen` in settings table |
| 1.5 plain framing + accept opens page | `EmailOptInPrompt` copy + Subscribe → browser |
| 1.6 not in onboarding | milestone is post-onboarding usage |
| 1.7 non-openers not chased | fires only on app use, documented |
| 1.8 in-app browser | `WebBrowser.openBrowserAsync` (PAGE_SHEET) |
| 2.1 precise deep links | `cta.url` → `/app/...` Universal Links |
| 2.2 single real CTA | `renderArticle` uses `cta.url`, drops dual-store |
| 2.3 store as fallback | Universal Link + the Req 3 `/app/*` fallback page |
| 2.4 copy matches destination | per-tip label + URL mapping |
| 2.5 content + build only | tips md + build-content + app-cta, rebuild/deploy |
| 3.1 200 for any `/app/*` | `_redirects` rewrite → `website/app/index.html` |
| 3.2 single path-aware page | one file; inline script reads `location.pathname` → `ROUTE_COPY` |
| 3.3 store hand-off | reuse `app-cta.js` platform detection on the page |
| 3.4 optional scheme attempt | one-shot `mentalwallet://<route>` on load, degrades cleanly |
| 3.5 no PII | static page, no forms |
| 3.6 canonical route list | `ROUTE_COPY` colocated + points at `deep-links.md` |
| 3.7 site look + voice | shared nav/footer/styles; warm, plain copy |

## Open items to confirm

- Website has a `/subscribe` page (and optional `/subscribe/manage`) live before the Settings
  row ships. If not, that page is a prerequisite (website task).
- Req 2 is BLOCKED until `1.0.4-deep-linking` Req 3/4 (Universal Links + routes) are live AND
  Req 3 (the `/app/*` fallback page) is live. Sequence: Req 3 (fallback page) ships with or
  just before Req 2 so no not-installed recipient hits a 404. Both are last in the 1.0.4 train.
- **Cloudflare routing mechanism for `/app/*` (Req 3d):** confirm the static-assets Worker
  honors a `_redirects` `200` rewrite (preferred). If not, fall back to `wrangler.toml`
  not-found handling (scoped) or a tiny explicit `/app/*` Worker route. This is the only
  implementation unknown; resolve it at the start of the Req 3 build.
