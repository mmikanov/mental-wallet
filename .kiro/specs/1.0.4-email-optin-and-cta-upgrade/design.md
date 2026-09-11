# Design Document — In-App Email Opt-In & Tip CTA Upgrade (1.0.4)

## Overview

Two communication-growth pieces:

1. **In-app email opt-in** — a privacy-preserving, link-out subscribe path. The app collects
   NO email; it opens the website subscribe page in an in-app browser. Two entry points: a
   permanent Settings row, and a one-time contextual prompt fired after the user has felt
   value (a completion milestone).
2. **Tip CTA upgrade** — once the deep-link routes + Universal Links ship (sibling spec
   `1.0.4-deep-linking`), point each tip's article CTA at the precise Universal Link (which
   opens the app when installed, falls back to the store/web when not), replacing the current
   interim dual-store button.

Requirement 1 is independent of the routes and can ship anytime. Requirement 2 **depends on
`1.0.4-deep-linking` Req 3 & 4 being live** (the `/app/...` Universal Links must resolve).

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
| learn-more-evidence | `.../app/learn-more-tour` | See why a tool works |
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
the OS opens the URL in the browser, landing on the website's `/app/...` page, which should
offer the store (that fallback page is a `1.0.4-deep-linking` website deliverable). Update
`website/app-cta.js`: it no longer needs to rewrite the href to a store (the Universal Link +
web fallback page handle it). Either remove `app-cta.js` and the `app-cta` class usage, or
repurpose it to only add a store link on the fallback page. Simplest: drop the client-side
rewrite; the href is now the real Universal Link.

### 2d. Build + deploy (Req 2.5)

Change is limited to `content/tips/*.md` (cta URLs/labels) + `renderArticle` + `app-cta.js`,
then a content rebuild and website deploy. No messaging-worker change.

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
- `website/app-cta.js` — drop/repurpose the store rewrite.

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
| 2.3 store as fallback | Universal Link + web fallback page (deep-linking spec) |
| 2.4 copy matches destination | per-tip label + URL mapping |
| 2.5 content + build only | tips md + build-content + app-cta, rebuild/deploy |

## Open items to confirm

- Website has a `/subscribe` page (and optional `/subscribe/manage`) live before the Settings
  row ships. If not, that page is a prerequisite (website task).
- Req 2 is BLOCKED until `1.0.4-deep-linking` Req 3/4 (Universal Links + routes + web
  fallback pages) are live. Sequence Req 2 last in the 1.0.4 train.
