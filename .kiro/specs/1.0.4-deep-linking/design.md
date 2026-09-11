# Design Document — Deep Linking (1.0.4)

## Overview

This spec makes the app's deep linking actually work and adds the routes tip CTAs and
reminder notifications need. The investigation surfaced two root causes that shape the whole
design:

1. **The `mentalwallet://` scheme is not registered natively** (not in `app.json`, iOS
   `Info.plist`, or Android `AndroidManifest.xml`). `linking.ts` uses it as its prefix, so
   every custom-scheme link, including the reminder-notification deep link, dead-ends today.
2. **The `focusCardId` param is produced but never consumed.** `linking.ts` (and
   `ToolInsightsScreen`) build `mentalwallet://wallet?focusCardId=<id>` / navigate with
   `{ focusCardId }`, React Navigation delivers it as the `Wallet` route param, but
   `WalletScreen` only ever reads `route.params?.highlightSessionCard`, never `focusCardId`.
   So even with the scheme fixed, a reminder tap would land on the Wallet tab without
   focusing or expanding anything.

So the two prerequisites (register the scheme, consume the param) are what actually deliver
Requirement 2, the concrete 1.0.4 goal. Universal/App Links (Req 3) and the extra routes
(Req 4) build on top.

## Current state (verified)

- **Linking config** (`src/navigation/linking.ts`): `prefixes: ['mentalwallet://']`; `config`
  maps only `MainTabs.Wallet → 'wallet'`, `Archive → 'archive'`, `Settings → 'settings'`.
  `getInitialURL()` (cold start) reads `Notifications.getLastNotificationResponseAsync()` and,
  for `data.type === 'card_reminder' && data.cardId`, returns
  `mentalwallet://wallet?focusCardId=<id>`. `subscribe()` (running) does the same via
  `addNotificationResponseReceivedListener`. Attached in `App.tsx` via
  `<NavigationContainer linking={linking}>`.
- **Notification payload already carries the card id.** `reminderService.buildNotificationConfigs`
  sets `data: { type: 'card_reminder', cardId }` on every scheduled notification. So Req 2.2 is
  already satisfied at the data layer, no scheduling change needed.
- **Focus/expand is store-driven.** `walletStore` owns `focusedCardId` + `isExpanded` with
  `focusCard(id)` (focus, collapsed) and `expandCard()` (expand). The canonical "open a card
  fully from code" pattern already exists: `handleReturnToSession` does
  `focusCard(SESSION_LAUNCHER_CARD_ID); expandCard();`. Reproducing a normal tap's end state
  (Req 2.5) = those two calls.
- **Dead code:** `notificationService.handleNotificationTap` +
  `setNotificationNavigationHandler`/`getNotificationNavigationHandler` are never called. The
  live tap path is `linking.ts`. We will not revive the dead path; optionally remove it.
- **Seedling button = KPI check-in card.** The 🌱 FAB (`handleKpiFabPress`) calls
  `focusCard(kpiCard.id)` (the `lib-personal-kpi` daily check-in card). This is DISTINCT from
  the emotion **session-launcher** guided check-in. See "Open decision" under Req 4.
- **Native registration today:** iOS `CFBundleURLSchemes` = `com.mentalwallet.app`,
  `exp+mental-health-wallet`. Android intent-filters = `exp+mental-health-wallet` only. No
  `associatedDomains`/`applinks`, no `autoVerify`. Bare workflow (committed `ios/`+`android/`),
  so native files are edited directly AND `app.json` kept in sync (per the release checklist's
  4-file version rule; here it's the linking config).

## Requirement 1: Register the `mentalwallet://` scheme (prerequisite)

Add a single, consistent custom scheme so `linking.ts`'s prefix resolves on both platforms.

- **`app.json`:** add `"scheme": "mentalwallet"` under `expo`. (Single source of truth going
  forward; but because this is the bare workflow, we also edit the native files directly, they
  are not regenerated from `app.json` unless prebuilt.)
- **iOS `ios/MentalWallet/Info.plist`:** add a `mentalwallet` entry to `CFBundleURLTypes`
  (alongside the existing `com.mentalwallet.app` and `exp+mental-health-wallet` entries).
- **Android `android/app/src/main/AndroidManifest.xml`:** add a VIEW/DEFAULT/BROWSABLE
  intent-filter with `<data android:scheme="mentalwallet"/>` on `.MainActivity` (alongside the
  existing `exp+mental-health-wallet` filter).
- Keep `linking.prefixes` as `['mentalwallet://']` for now (Universal-link prefix added in
  Req 3). The existing routes (`wallet`, `archive`, `settings`, `wallet?focusCardId=`) then
  resolve.
- **Req 1.3:** confirmed, notification taps rely on the `linking.ts` path (the `mentalwallet://`
  prefix), NOT expo-notifications' own handler. Registering the scheme is what makes the tap
  path work.

## Requirement 2: Reminder notification focuses + expands the tool (the 1.0.4 goal)

With the scheme registered, the reminder tap URL (`mentalwallet://wallet?focusCardId=<id>`)
now opens the app on the Wallet tab. The missing piece is **consuming `focusCardId`**.

### Consume `focusCardId` in `WalletScreen`

Add an effect in `WalletScreen` (mirroring the existing `highlightSessionCard` effect) that:

1. Reads `route.params?.focusCardId`.
2. Waits until `cards` are loaded (the effect already depends on `cards`; the highlight effect
   uses the same guard).
3. Resolves the card: `cards.find(c => c.id === focusCardId)`.
   - **If found and not archived:** `focusCard(focusCardId)` then `expandCard()` (the exact
     `handleReturnToSession` pattern, satisfying Req 2.5, identical to a normal tap's end
     state).
   - **If missing or archived (Req 2.3):** do nothing beyond landing on the Wallet stack (no
     error). Optional: a gentle, non-blocking toast/hint ("That tool isn't in your wallet
     anymore"), deferred unless trivial.
4. **Consume-once guard:** use a ref (like `highlightHandled`) so re-renders don't re-focus,
   and clear the param after handling (`navigation.setParams({ focusCardId: undefined })`) so
   returning to the wallet later doesn't re-trigger. This matters because the same screen
   handles both cold-start (initialURL) and running (`subscribe`) deliveries.

### Cold start vs background vs foreground (Req 2.4)

- **Cold start:** `linking.getInitialURL()` already resolves the URL from the last
  notification response; React Navigation applies it as initial state → Wallet with
  `focusCardId`. Our effect runs once cards load. One nuance: on cold start the wallet cards
  load asynchronously, the effect's `cards`-length guard handles the race (focus fires once
  data is present), same as the highlight effect.
- **Background/foreground:** `linking.subscribe()` pushes the URL via the listener; React
  Navigation updates the `Wallet` params; the effect fires. The consume-once ref is reset when
  a NEW `focusCardId` arrives (compare against the last handled id, not a boolean, so a second
  reminder for a different card still works).

Refinement to the guard: track `lastHandledFocusCardId` (string | null) instead of a plain
boolean, so distinct consecutive deep links each focus their card, but a re-render with the
same param does not.

### Why not the dead `notificationService` handler

The `linking.ts` path already covers all three app states and is the one actually wired.
Reusing it (just consuming its output) is less code and less risk than reviving
`setNotificationNavigationHandler`. We will leave that dead path alone (or delete it as
cleanup).

## Requirement 3: Universal Links (iOS) / App Links (Android)

Add `https://mentalhealthwallet.productsforgood.co` association so tip CTAs open the app when
installed and fall back to the web page when not.

### URL path space

Use a dedicated `/app/...` path space so marketing/article pages are unaffected and each app
path has a natural web fallback:

| Deep link path | App route | Web fallback (not installed) |
|---|---|---|
| `/app/wallet` | Wallet | wallet marketing/explainer page |
| `/app/wallet?focusCardId=<id>` | Wallet, focus+expand card | wallet page |
| `/app/how-i-feel` | "Start from how I feel" session-launcher card (Req 4.2) | relevant tip/article |
| `/app/checkin` | seedling 🌱 KPI daily check-in card (Req 4.2) | relevant tip/article |
| `/app/learn-more-tour` | Wallet, top stack card focused+expanded (its Learn more link is visible; Req 4.3) | relevant tip/article |
| `/app/add-tool` | Library browser (Req 4) | library/tips page |
| `/app/add-tool?filter=apps` | Library browser, Apps filter pre-selected (Req 4) | library/tips page |

Add the `https://mentalhealthwallet.productsforgood.co` prefix (scoped to `/app`) to
`linking.prefixes`, and extend `linking.config.screens` so both the custom scheme and the
https path resolve to the same routes (React Navigation matches path suffixes across both
prefixes).

### Association files (Req 3.4) — served by the marketing site

- **iOS:** `https://mentalhealthwallet.productsforgood.co/.well-known/apple-app-site-association`
  (no extension, `Content-Type: application/json`), listing the App ID
  `<TeamID>.com.mentalwallet.app` and the `/app/*` paths.
- **Android:** `https://mentalhealthwallet.productsforgood.co/.well-known/assetlinks.json`
  listing the package `com.mentalwallet.app` and the release signing SHA-256 fingerprint.
- These are website deliverables (the app repo can't serve them). This spec DEFINES their
  required content; producing/deploying them is a website task, tracked here as an external
  dependency. App-side verification depends on them being live.

### Native association config (Req 3.1, 3.2)

- **iOS:** add the Associated Domains entitlement `applinks:mentalhealthwallet.productsforgood.co`
  (in `app.json` `ios.associatedDomains` AND the native entitlements file, bare workflow).
  Requires the Team ID for the AASA.
- **Android:** add an `autoVerify="true"` intent-filter on `.MainActivity` for
  `scheme="https"`, `host="mentalhealthwallet.productsforgood.co"`, `pathPrefix="/app"`.
- **Req 3.5:** the `mentalwallet://` scheme keeps working (notifications rely on it); we are
  adding https as an additional prefix, not replacing the custom scheme.
- **Req 3.3 (fallback):** inherent to Universal/App Links, if the app isn't installed the OS
  opens the URL in the browser, which serves the tip's web page. No app code needed; the
  fallback quality depends on the website having a real page at `/app/...`.

## Requirement 4: New routes for tip destinations

### 4.2 Two distinct "feel"-oriented destinations (RESOLVED)

There are TWO separate cards, and tip CTAs target different ones. Do not conflate them:

1. **"Start from how I feel" card** = the `session-launcher` card (title "Start from how I
   feel"; emotion picker → recommendations, renders `SessionLauncherContent` when focused +
   expanded). The `emotion-based-session` and `feeling-anxious` tips target THIS.
2. **Seedling 🌱 daily check-in** = the KPI card (`sourceLibraryId === 'lib-personal-kpi'`),
   what the 🌱 FAB (`handleKpiFabPress`) opens. The `personal-kpi-check-in` tip targets THIS.
   (Operator confirmed the seedling = KPI check-in card.)

Both are just "focus + expand a specific card," so both reuse the same mechanism as Req 2, but
each card's wallet-instance id is per-install (seeded per device), so a literal `focusCardId`
can't be hardcoded in a tip URL. Use dedicated boolean params the wallet resolves locally:

- **`/app/how-i-feel`** → `Wallet` param `openHowIFeel?: boolean`. Effect: find the
  `session-launcher` card, `focusCard(it.id); expandCard()` (this is exactly what the existing
  `handleReturnToSession` does). Degrade gracefully if the card is missing.
- **`/app/checkin`** → `Wallet` param `openKpiCheckin?: boolean`. Effect: find the card with
  `sourceLibraryId === 'lib-personal-kpi'`, `focusCard(it.id); expandCard()`. Degrade
  gracefully if the user removed the KPI card.

Both effects follow the same consume-once / cards-load-guard pattern as the `focusCardId`
consumer (Req 2). Neither needs to drive the session/checkin store directly, focusing +
expanding the card lands the user on the same entry point a tap would (the card's own UI takes
over from there).

### 4.3 "Learn more" destination — open the top stack card (SIMPLIFIED, no walkthrough)

**Decision (operator-confirmed):** the app has NO "Learn more" guided walkthrough today, and
building a new coach-mark tour is disproportionate for one tip in 1.0.4. Instead of a tour,
`/app/learn-more-tour` simply **opens the wallet's top stack card, focused + expanded**, so the
card's own "Learn more" (rationale/evidence) link is right there for the user to tap. No new
walkthrough UI. A richer guided tour is parked as a future enhancement.

- New `Wallet` param `openTopCard?: boolean` (set via `/app/learn-more-tour`). (Named for what
  it does, not "tour", since there is no tour.)
- On trigger: focus + expand the **top card of the stack**, i.e. the first entry of `stackCards`
  (index 0 is the top of the deck; `StackedCardList` reverses for rendering). Reuses the same
  `focusCard(id); expandCard()` + consume-once / cards-load guard as Req 2 and 4.2.
- **Skip the "Start from how I feel" session-launcher card:** pick the first `stackCards` entry
  whose id is NOT `session-launcher`. (The KPI card is already excluded from `stackCards`, it's
  FAB-only, so no extra guard needed for it.) These aren't regular tools and have no Learn more
  entry, so they're not a useful landing for this tip.
- **Graceful degrade:** if there is no qualifying card (empty stack, or the only stack card is
  the session-launcher), do nothing beyond landing on the wallet, no error.
- No `TooltipOverlay`, no `useLearnMoreTour` hook, no new UI. This makes the route a thin
  variant of the Req 2 / 4.2 focus-and-expand mechanism.

### 4 add-tool / library route (with optional Apps filter)

`/app/add-tool` (and `mentalwallet://add-tool`) → navigate to `LibraryBrowser` (a
RootStack screen presented modally). Add `LibraryBrowser: 'add-tool'` (or `'library'`) to
`linking.config.screens`. No new screen needed.

**Apps-filter deep link (for `discover-third-party-apps`):** the Library browser ALREADY
supports an "Apps" filter, an `APPS_FILTER = 'apps'` pill that filters
`libraryCards.filter(c => !!c.externalApp)`, but it's driven purely by internal
`selectedCategory` state today (`LibraryBrowser: undefined`, initializes to `ALL_FILTER`). To
open the library pre-focused on Apps:

- Add a param: `LibraryBrowser: { initialFilter?: string } | undefined`.
- Initialize `useState(route.params?.initialFilter ?? ALL_FILTER)` so the Apps pill is
  pre-selected when `initialFilter === 'apps'`. (Reuses the existing filter value; no filter
  logic change.)
- Route it as `/app/add-tool?filter=apps` (query param maps to `initialFilter`), so
  `discover-third-party-apps` lands on the Apps-filtered library while a bare `/app/add-tool`
  still opens the full library. Both `mentalwallet://add-tool?filter=apps` and the https form
  resolve identically.
- Degrade gracefully: an unknown/absent `filter` just falls back to `ALL_FILTER` (the existing
  default), so a stale link never breaks.

This is a small, low-risk addition since the Apps filter already exists and works; the deep
link only sets its initial value.

### 4.4 both transports

Every new route is registered under BOTH prefixes (custom scheme + https `/app`) by living in
the shared `linking.config.screens`, so it's reachable via `mentalwallet://...` and
`https://.../app/...` alike.

## Files touched (app side)

- `app.json` — `scheme`, `ios.associatedDomains`.
- `ios/MentalWallet/Info.plist` — `CFBundleURLTypes` (+`mentalwallet`); entitlements file for
  associated domains.
- `android/app/src/main/AndroidManifest.xml` — `mentalwallet` scheme filter + `autoVerify`
  https App Links filter.
- `src/navigation/linking.ts` — add https prefix, extend `config.screens` (add-tool,
  how-i-feel, checkin, learn-more-tour), keep the notification URL builder.
- `src/navigation/types.ts` — extend `MainTabParamList.Wallet` with `openHowIFeel?`,
  `openKpiCheckin?`, `openTopCard?` (and keep `focusCardId?`); extend `LibraryBrowser`
  with `{ initialFilter?: string }`.
- `src/screens/WalletScreen.tsx` — consume `focusCardId` (Req 2), `openHowIFeel` (4.2),
  `openKpiCheckin` (4.2), `openTopCard` (4.3, top non-session stack card).
- `src/screens/LibraryBrowserScreen.tsx` — initialize `selectedCategory` from
  `route.params?.initialFilter` (Apps filter deep link).
- (No new walkthrough component/hook, the Learn-more route reuses focus+expand.)
- Optional cleanup: remove dead `handleNotificationTap` / navigation-handler in
  `notificationService.ts`.

## External dependencies (not app code)

- Website must serve `apple-app-site-association` and `.well-known/assetlinks.json` with the
  correct App ID / package + signing fingerprint, and real pages at `/app/...` for the
  not-installed fallback. Tracked as a website task; app-side Universal/App Link verification
  can't pass until these are live. The custom scheme + notification focus (Req 1, 2) do NOT
  depend on the website and can ship first.

## Testing strategy

- **Unit:** `linking.ts` route parsing, `mentalwallet://wallet?focusCardId=X` and
  `https://.../app/wallet?focusCardId=X` both resolve to `Wallet` with the param; new routes
  (`add-tool`, `how-i-feel`, `checkin`, `learn-more-tour`) resolve. A `WalletScreen` effect test (with a
  mocked store) that `focusCardId` for an existing card calls `focusCard` then `expandCard`,
  and that a missing/archived id does neither and doesn't throw (Req 2.3). Consume-once /
  distinct-second-link behavior via the `lastHandledFocusCardId` ref.
- **`openTopCard` effect (mocked store):** focuses + expands the first non-`session-launcher`
  stack card; when the only stack card is the session-launcher (or the stack is empty) it does
  nothing and doesn't throw.
- **MANUAL, both platforms (the association layer can't be unit-tested):**
  - Req 1/2: schedule a reminder, tap the notification from cold start, background, and
    foreground → app opens with that card focused AND expanded; deleted/archived card → wallet,
    no error.
  - Req 3: with app installed, a `/app/wallet` https link opens the app; uninstalled, it opens
    the web page. Verify AASA/assetlinks are fetched (Apple's CDN cache + Android App Links
    verification).
  - Req 4: `/app/how-i-feel` (session-launcher card), `/app/checkin` (KPI card),
    `/app/learn-more-tour`, `/app/add-tool` land correctly via both the custom scheme and https.

## Requirements coverage

| Req | Addressed by |
|---|---|
| 1.1 consistent scheme | `app.json` + Info.plist + AndroidManifest `mentalwallet` |
| 1.2 existing routes open | scheme registered; config unchanged for those |
| 1.3 confirm tap path | confirmed: relies on `linking.ts` custom scheme |
| 2.1 focus+expand on tap | consume `focusCardId` → `focusCard`+`expandCard` |
| 2.2 payload has card id | already present in reminder `data` |
| 2.3 missing/archived graceful | resolve guard, no-op + optional hint |
| 2.4 cold/bg/fg | getInitialURL + subscribe + cards-load guard |
| 2.5 same state as tap | identical `focusCard`+`expandCard` pattern |
| 3.1–3.2 UL/AL registered | associatedDomains + autoVerify https filter |
| 3.3 web fallback | inherent to UL/AL; website page dependency |
| 3.4 association files | defined here; website serves them |
| 3.5 custom scheme still works | https added as an extra prefix |
| 4.1 routes for destinations | wallet, how-i-feel, checkin, learn-more-tour, add-tool |
| 4.2 feel-oriented destinations | `openHowIFeel` → session-launcher; `openKpiCheckin` → KPI card (both focus+expand) |
| 4.3 learn-more destination | `openTopCard` → focus+expand top non-session stack card (its Learn more link is visible); no walkthrough built |
| 4.4 both transports | shared `linking.config.screens` |
| 4.5 no-screen destinations | add-tool → existing LibraryBrowser (optional `?filter=apps` pre-selects the Apps pill) |
