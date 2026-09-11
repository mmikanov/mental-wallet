# Requirements Document — Deep Linking (1.0.4)

## Introduction

The app's deep linking (`src/navigation/linking.ts`) supports only the `mentalwallet://`
custom scheme with a few routes (`wallet`, `archive`, `settings`, and `wallet?focusCardId=`),
and there are **no Universal Links / App Links** (no `https://` URL that opens the app).
Tip CTAs currently point at the wallet as an interim.

This spec covers the **app-side deep-linking foundation and routes** so links (from tip
emails/pages, and from reminder notifications) land precisely and reliably:

1. **Fix the (currently dead) custom scheme** so any deep link works at all.
2. **Reminder notification → focus the specific tool, expanded** — the concrete 1.0.4 goal.
3. **Universal Links / App Links** — an `https://mentalhealthwallet.productsforgood.co/...`
   URL that opens the app when installed and falls back to the web page when not.
4. **New deep-link routes** so specific destinations ("Start from how I feel" emotion session,
   seedling KPI check-in, top-card "Learn more" landing, add-tool/library) can be targeted.

**Split note:** the *consumption* of these routes by external communication, namely
**upgrading tip CTAs** and the **in-app email opt-in**, lives in the sibling spec
`1.0.4-email-optin-and-cta-upgrade`, which depends on the routes defined here. Keep this
spec focused on the app-side linking foundation.

Requires an app release. Scope: the React Native app (`src/navigation/`, deep-link handling,
notification-tap handling, the new walkthrough UI, new routes) plus the platform
link-association files and native scheme registration. Out of scope: the messaging worker,
the website build, tip CTA content, and the email opt-in (see the sibling spec).

**Privacy stance:** this spec adds no PII collection. It only routes the app to screens.

### Root-cause finding: the `mentalwallet://` scheme is not registered

Investigation while wiring interim CTAs found that **`linking.ts`'s `mentalwallet://` prefix
does not match any registered native URL scheme**, so `mentalwallet://wallet` fails to open
the app ("The application couldn't be opened"):

- `app.json` has **no** `scheme`.
- iOS `Info.plist` registers `com.mentalwallet.app` and `exp+mental-health-wallet` only.
- Android `AndroidManifest.xml` registers `https` and `exp+mental-health-wallet` only.

So custom-scheme deep linking in `linking.ts` (including any notification-tap deep link) is
effectively dead via that prefix today. **This spec must fix scheme registration** (add a
consistent scheme across `app.json` + iOS + Android, or move fully to Universal/App Links)
as a prerequisite for any working deep link. Confirm whether notification taps currently
rely on this prefix or on expo-notifications' own tap handler.

## Requirements

### Requirement 1: Fix native scheme registration (prerequisite)

**User Story:** As a user, I want links into the app to actually open it, so that
notification taps and tip CTAs don't dead-end with "couldn't be opened".

#### Acceptance Criteria

1. THE app SHALL register a consistent custom URL scheme across `app.json`, iOS
   `Info.plist`, and Android `AndroidManifest.xml`, so the `linking.ts` prefix resolves.
2. THE existing routes (`wallet`, `archive`, `settings`, `wallet?focusCardId=`) SHALL open
   the app to the correct screen when invoked via the registered scheme.
3. THE fix SHALL confirm whether reminder-notification taps rely on this scheme or on
   expo-notifications' own handler, and SHALL ensure the tap path used by Requirement 2 works.

### Requirement 2: Reminder notification opens the app focused on that tool, expanded

**User Story:** As a user who set a reminder for a specific tool, I want tapping its push
notification to open the app directly on that tool, already expanded, so that I can start
using it immediately without hunting for it.

#### Acceptance Criteria

1. WHEN a per-card reminder notification fires and the user taps it, THE app SHALL open (or
   foreground) and navigate to the wallet with that specific card **focused and expanded**,
   ready to use.
2. THE notification SHALL carry the target card's identifier so the app can resolve which
   card to focus (reusing the existing `wallet?focusCardId=` route or an equivalent).
3. IF the target card no longer exists (deleted) or is archived, THE app SHALL degrade
   gracefully (open the wallet without error; optionally a gentle message).
4. THE behavior SHALL work from a cold start (app not running), from background, and from
   foreground.
5. THE focus/expand SHALL match the app's normal focused-card view (the same state a user
   gets by tapping the card), not a separate or partial state.

### Requirement 3: Universal Links / App Links

**User Story:** As a user tapping a tip CTA on my phone, I want it to open the app right to
the relevant place, and to still work (open the web) if I don't have the app, so that the
link never dead-ends.

#### Acceptance Criteria

1. THE app SHALL register Universal Links (iOS) and App Links (Android) for
   `https://mentalhealthwallet.productsforgood.co` paths used by tips (e.g. a `/app/...`
   or `/go/...` path space, TBD in design).
2. WHEN the app is installed and a registered `https://` link is opened, THE OS SHALL open
   the app to the mapped screen.
3. WHEN the app is NOT installed, THE same `https://` link SHALL open the corresponding web
   page (the tip's article page) as a graceful fallback.
4. THE required association files SHALL be served from the marketing site
   (`apple-app-site-association` and `.well-known/assetlinks.json`) with correct content
   and content type.
5. THE existing `mentalwallet://` scheme SHALL continue to work (notifications rely on it).

### Requirement 4: New deep-link routes for tip destinations

**User Story:** As the operator, I want each tip destination to map to a real, specific
in-app screen, so that a CTA can land precisely (consumed by the sibling CTA-upgrade spec).

#### Acceptance Criteria

1. THE app SHALL expose deep-link routes covering the current tip destinations:
   - wallet (exists), the **"Start from how I feel"** emotion-session card, the **seedling KPI
     daily check-in** card, a **"Learn more" destination** (opens the top stack card so its
     Learn more link is visible), and an **add-tool / library** route.
2. **"Start from how I feel" / seedling routes:** each opens (focuses + expands) its specific
   card, the `session-launcher` card for "Start from how I feel", and the KPI daily check-in
   card for the seedling, landing on that card's own entry, not merely the wallet.
3. **"Learn more" route (SIMPLIFIED):** the app has no "Learn more" guided walkthrough today,
   and building a coach-mark tour is out of scope for 1.0.4. Instead, this route SHALL open the
   wallet's **top stack card, focused + expanded**, so the card's own "Learn more"
   (rationale/evidence) link is visible for the user to tap. It SHALL skip the "Start from how I
   feel" session-launcher card (pick the first regular stack card) and degrade gracefully if
   there is no qualifying card (land on the wallet, no error). A richer guided tour is parked as
   a future enhancement.
4. EACH route SHALL be reachable via both the `mentalwallet://` scheme and a Universal/App
   Link path (per Requirement 3).
5. WHERE a tip destination has no dedicated screen, THE design SHALL either add one or
   document the closest acceptable target.

## Out of Scope (moved to sibling spec `1.0.4-email-optin-and-cta-upgrade`)

- Upgrading tip CTA URLs to the precise deep links (and reverting the interim dual store
  buttons). Depends on the routes here.
- The in-app, privacy-preserving email opt-in (link-out to the website subscribe page).

## Open Questions (design)

- URL path space for Universal/App Links (e.g. `/app/wallet`, `/app/checkin`,
  `/app/learn-more-tour`) and how those map to both web fallback pages and app routes.
- RESOLVED: the emotion-session ("Start from how I feel", `session-launcher`) and the seedling
  KPI check-in are DISTINCT cards; each has its own route (`/app/how-i-feel`, `/app/checkin`).
- RESOLVED: no "Learn more" walkthrough is built for 1.0.4; the route opens the top stack card
  (skipping the session-launcher) so its Learn more link is visible. A guided tour is deferred.
- iOS Universal Links require the associated-domains entitlement + AASA file; Android App
  Links require `assetlinks.json` + verified domain. Confirm signing/domain details.
- Notification payload shape for Requirement 2 (card id + an "expanded" flag) and whether
  the current reminder scheduling already includes the card id.
