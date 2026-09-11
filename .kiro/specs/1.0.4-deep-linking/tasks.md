# Tasks — Deep Linking (1.0.4)

Approach (from design): the concrete 1.0.4 win (reminder tap → tool focused + expanded) needs
just two fixes, register the `mentalwallet://` scheme, and consume the already-produced
`focusCardId` param. Those ship first and depend on nothing external. Universal/App Links
(Req 3) depend on website-served association files. The extra routes (Req 4) build on the
linking config. Order: scheme registration → consume focusCardId → new routes → Universal
Links → walkthrough UI → verify.

## Task 1: Register the `mentalwallet://` scheme (prerequisite, Req 1)

- [ ] 1.1 Add the scheme in `app.json`
  - Add `"scheme": "mentalwallet"` under `expo`. Bare workflow, so this is the source-of-truth
    field but the native files below must be edited directly too.
  - _Req: 1.1_
- [ ] 1.2 iOS: register the scheme in `ios/MentalWallet/Info.plist`
  - Add a `CFBundleURLTypes` entry with `CFBundleURLSchemes = ['mentalwallet']`, alongside the
    existing `com.mentalwallet.app` and `exp+mental-health-wallet` entries.
  - _Req: 1.1_
- [ ] 1.3 Android: register the scheme in `AndroidManifest.xml`
  - Add a VIEW/DEFAULT/BROWSABLE intent-filter with `<data android:scheme="mentalwallet"/>` on
    `.MainActivity`, alongside the existing `exp+mental-health-wallet` filter.
  - _Req: 1.1_
- [ ] 1.4 Verify existing routes resolve
  - Confirm `mentalwallet://wallet`, `://archive`, `://settings` open the correct screens.
    Confirm (Req 1.3) the reminder tap relies on this scheme (the `linking.ts` path), not
    expo-notifications' own handler. No `linking.ts` change in this task.
  - _Req: 1.2, 1.3_

## Task 2: Consume `focusCardId` — reminder tap focuses + expands the tool (Req 2, the goal)

- [ ] 2.1 Extend the `Wallet` route param (already typed) and add the consumer effect
  - `MainTabParamList.Wallet` already has `focusCardId?: string`. Add a `WalletScreen` effect
    (mirroring the `highlightSessionCard` effect) that, once `cards` are loaded, resolves
    `route.params?.focusCardId`; if the card exists and is not archived, call
    `focusCard(id)` then `expandCard()` (the exact `handleReturnToSession` pattern → same end
    state as a normal tap, Req 2.5).
  - _Req: 2.1, 2.2, 2.5_
- [ ] 2.2 Graceful degrade + consume-once guard
  - If the id is missing/archived, no-op (land on the wallet stack, no error); optional gentle
    non-blocking hint (defer unless trivial). Guard with a `lastHandledFocusCardId` ref (NOT a
    boolean) so a re-render doesn't re-focus but a second reminder for a DIFFERENT card still
    works; clear the param after handling (`navigation.setParams({ focusCardId: undefined })`).
  - _Req: 2.3_
- [ ] 2.3 Verify cold start / background / foreground
  - MANUAL: reminder tap focuses+expands from cold start (`getInitialURL`), background, and
    foreground (`subscribe`). Confirm the cards-load race is handled (focus fires once cards
    are present). Optional cleanup: remove the dead `handleNotificationTap` /
    `setNotificationNavigationHandler` path in `notificationService.ts`.
  - _Req: 2.4_

## Task 3: New deep-link routes (Req 4, custom scheme first)

- [ ] 3.1 add-tool / library route
  - Add `LibraryBrowser: 'add-tool'` to `linking.config.screens`; confirm
    `mentalwallet://add-tool` opens the (modal) Library browser. No new screen.
  - _Req: 4.1, 4.5_
- [ ] 3.2 "Start from how I feel" route (session-launcher card)
  - Add `Wallet` param `openHowIFeel?: boolean`, map `how-i-feel` → it in `linking.config`, and a
    `WalletScreen` effect that finds the `session-launcher` card and `focusCard(it.id);
    expandCard()` (exactly what `handleReturnToSession` already does). Degrade if missing. Use a
    param, not a literal `focusCardId`, because the card's id is per-install.
  - _Req: 4.1, 4.2_
- [ ] 3.3 Seedling KPI check-in route (KPI card — DISTINCT from 3.2)
  - The 🌱 seedling FAB focuses the KPI card (`lib-personal-kpi`), operator-confirmed; this is a
    DIFFERENT destination from the "Start from how I feel" session card in 3.2. Add `Wallet` param
    `openKpiCheckin?: boolean`, map `checkin` → it, and a `WalletScreen` effect that finds the card
    with `sourceLibraryId === 'lib-personal-kpi'` and `focusCard(it.id); expandCard()`. Degrade if
    the KPI card was removed. Param, not literal `focusCardId` (per-install id).
  - _Req: 4.1, 4.2_
- [ ] 3.4 Learn-more guided walkthrough route + UI
  - Add `Wallet` param `startLearnMoreTour?: boolean`, map `learn-more-tour` → it. Add
    `src/hooks/useLearnMoreTour.ts` (steps `idle → point_at_learn_more → complete`, mirroring
    `useMicroTutorial`). On trigger: pick a wallet card that HAS a rationale/"Learn more" entry
    (e.g. Box Breathing), focus it, measure the Learn more control, render `TooltipOverlay`
    pointing at it (dismissible, non-blocking). If no qualifying card, skip silently.
  - _Req: 4.1, 4.3_

## Task 4: Universal Links / App Links (Req 3, website-dependent)

- [ ] 4.1 Add the https prefix + shared route config in `linking.ts`
  - Add `https://mentalhealthwallet.productsforgood.co` (scoped to `/app`) to
    `linking.prefixes`; map `/app/wallet`, `/app/wallet?focusCardId=`, `/app/how-i-feel`,
    `/app/checkin`, `/app/learn-more-tour`, `/app/add-tool` in `config.screens` so both prefixes
    resolve to the same routes. Keep `mentalwallet://` working (Req 3.5).
  - _Req: 3.1, 3.5, 4.4_
- [ ] 4.2 iOS associated domains
  - Add `applinks:mentalhealthwallet.productsforgood.co` to `app.json` `ios.associatedDomains`
    AND the native entitlements file (bare workflow). Needs the Team ID for the AASA content.
  - _Req: 3.1, 3.2_
- [ ] 4.3 Android App Links intent-filter
  - Add an `autoVerify="true"` VIEW/DEFAULT/BROWSABLE intent-filter for `scheme="https"`,
    `host="mentalhealthwallet.productsforgood.co"`, `pathPrefix="/app"` on `.MainActivity`.
  - _Req: 3.1, 3.2_
- [ ] 4.4 Define association-file content (website dependency)
  - Document the required `apple-app-site-association` (App ID `<TeamID>.com.mentalwallet.app`,
    `/app/*` paths) and `.well-known/assetlinks.json` (package `com.mentalwallet.app` + release
    signing SHA-256). These are served by the marketing site, NOT the app repo. Flag as an
    external dependency; UL/AL verification can't pass until they're live and real `/app/...`
    web fallback pages exist (Req 3.3).
  - _Req: 3.3, 3.4_

## Task 5: Tests + verification

- [ ] 5.1 Unit tests
  - `linking.ts`: `mentalwallet://wallet?focusCardId=X` and
    `https://.../app/wallet?focusCardId=X` both resolve to `Wallet` with the param; `add-tool`,
    `how-i-feel`, `checkin`, `learn-more-tour` resolve. `WalletScreen` effect (mocked store): existing card →
    `focusCard`+`expandCard`; missing/archived → neither + no throw (Req 2.3); consume-once and
    distinct-second-link behavior via `lastHandledFocusCardId`.
  - _Req: 1.2, 2.1, 2.3, 4.1, 4.4_
- [ ] 5.2 Component test — Learn-more tour
  - Renders `TooltipOverlay` when a qualifying card exists; no-ops (no overlay, no crash) when
    none does.
  - _Req: 4.3_
- [ ] 5.3 Verify + checkpoint
  - `npm run typecheck` clean for touched files. MANUAL, both platforms:
    - Req 1/2: reminder tap → card focused + expanded from cold/background/foreground;
      deleted/archived → wallet, no error.
    - Req 3: installed `/app/wallet` https link opens app; uninstalled opens web page; AASA +
      assetlinks fetched/verified.
    - Req 4: `/app/how-i-feel` (session-launcher card), `/app/checkin` (KPI card),
      `/app/learn-more-tour`, `/app/add-tool` land correctly via BOTH `mentalwallet://` and https.
  - _Req: 1.2, 2.4, 3.2, 3.3, 4.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1.1", "1.2", "1.3"] },
    { "wave": 2, "tasks": ["1.4"] },
    { "wave": 3, "tasks": ["2.1", "2.2"] },
    { "wave": 4, "tasks": ["2.3", "3.1", "3.2", "3.3", "3.4"] },
    { "wave": 5, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "wave": 6, "tasks": ["5.1", "5.2", "5.3"] }
  ],
  "notes": "Scheme registration (1.x) is the prerequisite for everything. 1.4 verifies it before building on top. Consuming focusCardId (2.1/2.2) delivers the concrete 1.0.4 goal and only depends on the scheme; 2.3 is its manual cross-state verification. New routes (3.x) extend the config once the scheme works: 3.2 = the 'Start from how I feel' session-launcher card, 3.3 = the DISTINCT seedling KPI check-in card (both operator-confirmed), 3.4 adds the walkthrough UI. Universal/App Links (4.x) layer https on top and carry the external website dependency (4.4), so they come after the custom-scheme routes and can ship in a later cut if the association files aren't ready. 5.x closes out automated + manual verification. Req 1+2 (waves 1-4 minus the https bits) form a shippable slice with no website dependency."
}
```
