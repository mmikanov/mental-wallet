# Tasks — In-App Email Opt-In & Tip CTA Upgrade (1.0.4)

Two tracks. **Track A (email opt-in, Req 1)** is app-side, no external dependency, ships
anytime. **Track B (CTA upgrade + `/app/*` fallback page, Req 2 & 3)** is website-only and is
BLOCKED until `1.0.4-deep-linking` Req 3/4 (Universal Links + `/app/...` routes) are live.
Within Track B the fallback page (Task 6, Req 3) ships with or just before the CTA URL swap so
no not-installed recipient hits a 404 — build the page (6.x), then the CTA renderer + URL swap
(5.1/5.2), then verify/deploy everything together (5.3). Privacy posture: the app stores no
email, only a local "prompt seen" boolean; opt-in is a link-out to the website subscribe page;
the fallback page is a static no-PII page.

## Task 1: Subscribe URL + Settings entry (Req 1.1, 1.2, 1.8)

- [ ] 1.1 Add `SUBSCRIBE_URL` to `src/config/appInfo.ts`
  - `SUBSCRIBE_URL = `${SITE_ORIGIN}/subscribe`` (+ optional `SUBSCRIBE_MANAGE_URL` if the site
    has a preferences page). Confirm the `/subscribe` page is live (website prerequisite).
  - _Req: 1.1_
- [ ] 1.2 Add the "Email updates" row in Settings
  - In the "Privacy & Data" section of `SettingsScreen.tsx`, add a `TouchableOpacity`
    (`styles.menuItem`) mirroring the Terms row: icon `✉️`, text "Email updates", chevron,
    `onPress={() => WebBrowser.openBrowserAsync(SUBSCRIBE_URL, { presentationStyle: PAGE_SHEET,
    controlsColor, toolbarColor })}` (match the TipsFeed styled in-app sheet). Optional subtitle
    "Occasional tips and reminders, opt out anytime." Always-available path (Req 1.4 fallback).
  - _Req: 1.2, 1.8_

## Task 2: Persisted "prompt seen" flag (Req 1.4)

- [ ] 2.1 Add `get/setEmailOptInPromptSeen` to `settingsService`
  - Discrete settings key `email_opt_in_prompt_seen` (`'true'`/`'false'`, default false),
    mirroring `get/setDiscreetNotifications`. Lightest option, no store wiring; lives in the
    `settings` table so the dev "reset app" wipe clears it (confirm reset clears `settings`).
  - _Req: 1.4_

## Task 3: Contextual opt-in prompt (Req 1.3–1.7)

- [ ] 3.1 Add the `EmailOptInPrompt` component
  - New `src/components/onboarding/EmailOptInPrompt.tsx` modeled on `OnboardingBanner`
    (Reanimated fade, `accessibilityRole="alert"`, ✕ dismiss). Plain framing (Req 1.5):
    "Want occasional tips and optional reminders by email? Change or stop anytime." Actions:
    **Subscribe** → `WebBrowser.openBrowserAsync(SUBSCRIBE_URL)` then mark seen; **Not now / ✕**
    → mark seen. Dismissible, non-blocking.
  - _Req: 1.5_
- [ ] 3.2 Milestone trigger + gate wiring
  - Fire after the **3rd tool completion** (past onboarding's first guided completion, clearly
    "this helps"). Compute via the sum of `cards.totalUses` after `loadCards()` (the just-
    recorded completion is included). Show only when `emailOptInPromptSeen === false`; fire once
    per crossing (ref guard). If the outcome prompt is currently showing, defer to the next
    eligible completion (no stacked prompts). Render at wallet level (WalletScreen or a
    `useEmailOptInPrompt` hook), NOT per-card, NOT in onboarding (Req 1.6). Set seen on either
    action (Req 1.4). Non-openers simply aren't prompted (Req 1.7, no workaround).
  - _Req: 1.3, 1.4, 1.6, 1.7_

## Task 4: Track A tests + verification (Req 1)

- [ ] 4.1 Unit + component tests
  - `settingsService`: `get/setEmailOptInPromptSeen` round-trips, default false. Milestone
    helper crosses at the 3rd completion. Gate: shown only when not-seen AND milestone crossed;
    never after Subscribe or dismiss. `EmailOptInPrompt`: Subscribe calls
    `openBrowserAsync(SUBSCRIBE_URL)` + marks seen; dismiss marks seen; both hide it.
  - _Req: 1.3, 1.4, 1.5_
- [ ] 4.2 Verify + checkpoint
  - `npm run typecheck` clean for touched files. MANUAL: Settings "Email updates" opens the
    subscribe page in-app and returns; complete 3 tools → prompt once; dismiss → gone forever
    (relaunch confirms persistence); Subscribe → opens page + gone forever; confirm it does NOT
    appear during onboarding.
  - _Req: 1.2, 1.3, 1.4, 1.6, 1.8_

## Task 5: Tip CTA upgrade — BLOCKED on `1.0.4-deep-linking` Req 3/4 (Req 2)

> Do NOT start until the `/app/...` Universal/App Links resolve. The web fallback page is now
> Task 6 in this spec (build it before 5.3's not-installed verification). Until Track B ships,
> the interim dual-store CTA stays.

- [ ] 5.1 Point each tip's `cta.url` at its Universal Link
  - Update `cta.url` (+ label copy to match, Req 2.4) in each `content/tips/*.md` per the
    mapping: welcome/come-back/reorder/archive-restore/outcome-capture → `/app/wallet`;
    emotion-based-session/feeling-anxious → `/app/how-i-feel` (the "Start from how I feel"
    session-launcher card); personal-kpi-check-in → `/app/checkin` (the seedling 🌱 KPI
    check-in card); discover-third-party-apps → `/app/add-tool?filter=apps` (library pre-focused
    on the Apps filter); add-your-own-app/add-your-own-tool → `/app/add-tool`; learn-more-evidence
    → `/app/learn-more-tour`. NOTE: `/app/how-i-feel` and `/app/checkin` are DISTINCT
    destinations (emotion session vs KPI card).
  - _Req: 2.1, 2.4_
- [ ] 5.2 Render a single real CTA + fallback
  - `website/build-content.js` `renderArticle()`: use `tip.cta.url` as the href (stop
    hardcoding `/#hero`); keep one button (revert the interim dual-store treatment). Update
    `website/app-cta.js`: drop the article-page store-rewrite (the Universal Link + the Task 6
    fallback page handle installed vs not-installed); the platform/store logic is reused by the
    fallback page.
  - _Req: 2.2, 2.3, 2.5_
- [ ] 5.3 Rebuild, verify, deploy
  - Rebuild content; verify each article renders ONE CTA whose href is the Universal Link;
    `index.json` still carries `cta`. MANUAL on device: installed → CTA opens the app to the
    mapped screen; not installed → the Task 6 `/app/*` fallback page + store. Deploy the website
    (page + content together). No worker change.
  - _Req: 2.2, 2.3, 2.5_

## Task 6: `/app/*` not-installed fallback page — Track B (Req 3)

> Ships with or just before Task 5 (so not-installed recipients of the new CTA URLs don't 404).
> Depends on the `/app/...` routes existing (deep-linking spec) only in the sense that the
> fallback should cover those paths; the page itself is plain static HTML and can be authored
> anytime. Resolve the Cloudflare routing unknown (6.2) first.

- [ ] 6.1 Build the single path-aware fallback page
  - New `website/app/index.html` matching the site chrome (reuse the same nav/footer/`styles.css`
    as the hand-written pages). Inline `<head>`/early script reads `location.pathname`,
    normalizes it (strip leading `/app`, trailing slash, ignore query), and looks it up in a
    small `ROUTE_COPY` map (headline + supporting line from the requirements' canonical-copy
    table). Unknown / bare `/app` → generic "Open your wallet" entry. Colocate a comment naming
    `docs/deployment/deep-links.md` as the canonical route list (Req 3.6). Write copy before
    paint (no flash). No PII, no forms (Req 3.5).
  - _Req: 3.1, 3.2, 3.5, 3.6, 3.7_
- [ ] 6.2 Wire `/app/*` routing + reuse the store CTA
  - Make any `/app/*` path serve `website/app/index.html` with HTTP 200. Preferred: a
    `website/_redirects` rewrite `/app/* /app/index.html 200`; confirm the static-assets Worker
    honors it. If not, use scoped `wrangler.toml` not-found handling or a tiny explicit `/app/*`
    Worker route. MUST NOT change `/.well-known/*` (association files stay `application/json`,
    unchanged) or swallow other pages' legit 404s. Reuse `app-cta.js` platform detection for the
    store button (iOS → App Store, Android → Play, desktop → both) (Req 3.3). Optionally attempt
    `mentalwallet://<route>` once on load, degrading cleanly (Req 3.4).
  - _Req: 3.1, 3.3, 3.4_
- [ ] 6.3 Verify + deploy
  - Serve locally / after deploy: `/app/checkin`, `/app/how-i-feel`, `/app/wallet`,
    `/app/learn-more-tour`, `/app/add-tool`, `/app/add-tool?filter=apps`, bare `/app`, and a
    trailing-slash variant all return 200 with the page; known routes show personalized copy,
    unknown shows generic. `/tips`, `/privacy.html`, and `/.well-known/*` unaffected. Store
    button resolves per platform. MANUAL on a real device: installed → Universal Link opens the
    app (page NOT shown); not installed → page shown with store CTA. Update
    `docs/deployment/deep-links.md` to note the single-page fallback. Deploy with Task 5.
  - _Req: 3.1, 3.3, 3.7_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "2.1"] },
    { "wave": 2, "tasks": ["1.2", "3.1"] },
    { "wave": 3, "tasks": ["3.2"] },
    { "wave": 4, "tasks": ["4.1", "4.2"] },
    { "wave": 5, "tasks": ["6.1", "6.2"] },
    { "wave": 6, "tasks": ["5.1", "5.2"] },
    { "wave": 7, "tasks": ["6.3", "5.3"] }
  ],
  "notes": "Track A (Req 1, waves 1-4) is self-contained and ships without any external dependency: constant + flag first, then the Settings row and prompt component, then the milestone wiring, then tests/verify. Track B (Req 2 + Req 3, waves 5-7) is website-only and is HARD-BLOCKED on 1.0.4-deep-linking Req 3/4 being live (Universal Links + /app routes). Within Track B the fallback page comes first: wave 5 builds it (6.1 page, 6.2 routing+store CTA; resolve the Cloudflare /app/* routing unknown at the start of 6.2), wave 6 does the CTA renderer + tip URL swap (5.1, 5.2), wave 7 verifies + deploys everything together (6.3 fallback checks + 5.3 article-CTA checks, one deploy). This ordering guarantees the /app/* fallback exists before the new CTA URLs go live, so no not-installed recipient hits a 404. Website prerequisite for Track A: the /subscribe page must be live before 1.2 ships."
}
```
