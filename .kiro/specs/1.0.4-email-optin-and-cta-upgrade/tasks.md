# Tasks — In-App Email Opt-In & Tip CTA Upgrade (1.0.4)

Two independent tracks. **Track A (email opt-in, Req 1)** is app-side, no external dependency,
ships anytime. **Track B (CTA upgrade, Req 2)** is website-only and is BLOCKED until
`1.0.4-deep-linking` Req 3/4 (Universal Links + `/app/...` routes + web fallback pages) are
live. Privacy posture: the app stores no email, only a local "prompt seen" boolean; opt-in is
a link-out to the website subscribe page.

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

> Do NOT start until the `/app/...` Universal/App Links resolve and the web fallback pages
> exist. Until then the interim dual-store CTA stays.

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
    `website/app-cta.js`: drop the store-rewrite (the Universal Link + web fallback page handle
    installed vs not-installed), or repurpose it to add the store only on the fallback page.
  - _Req: 2.2, 2.3, 2.5_
- [ ] 5.3 Rebuild, verify, deploy
  - Rebuild content; verify each article renders ONE CTA whose href is the Universal Link;
    `index.json` still carries `cta`. MANUAL on device: installed → CTA opens the app to the
    mapped screen; not installed → web fallback + store. Deploy the website. No worker change.
  - _Req: 2.2, 2.3, 2.5_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "2.1"] },
    { "wave": 2, "tasks": ["1.2", "3.1"] },
    { "wave": 3, "tasks": ["3.2"] },
    { "wave": 4, "tasks": ["4.1", "4.2"] },
    { "wave": 5, "tasks": ["5.1", "5.2"] },
    { "wave": 6, "tasks": ["5.3"] }
  ],
  "notes": "Track A (Req 1, waves 1-4) is self-contained and ships without any external dependency: constant + flag first, then the Settings row and prompt component, then the milestone wiring, then tests/verify. Track B (Req 2, waves 5-6) is website-only and is HARD-BLOCKED on 1.0.4-deep-linking Req 3/4 being live (Universal Links + /app routes + web fallback pages); it is sequenced last in the 1.0.4 train. 5.1 (tip URLs) + 5.2 (renderer) before 5.3 (rebuild/verify/deploy). Website prerequisite for Track A: the /subscribe page must be live before 1.2 ships."
}
```
