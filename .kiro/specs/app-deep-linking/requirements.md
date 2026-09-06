# Requirements Document

## Introduction

Tip emails and web pages (and, later, the in-app feed) end with a CTA meant to drive the
user into the app to *do the thing the tip is about*. Today the app's deep linking
(`src/navigation/linking.ts`) supports only the `mentalwallet://` custom scheme with a few
routes (`wallet`, `archive`, `settings`, and `wallet?focusCardId=`), and there are **no
Universal Links / App Links** (no `https://` URL that opens the app). As an interim, all tip
CTAs point at `mentalwallet://wallet` (opens the app to the wallet).

This spec captures the app-side work to make CTAs land precisely and reliably:

1. **Universal Links / App Links** — an `https://mentalhealthwallet.productsforgood.co/...`
   URL that opens the app when installed and falls back to the web page (or store) when
   not. This is the email-safe, robust pattern; custom-scheme links break or error when the
   app isn't installed.
2. **New deep-link routes** so specific tips land on the right screen, not just the wallet:
   - the **seedling "how I feel" check-in** (the emotion/guided check-in the wallet's
     seedling button opens), and
   - a **"Learn more" guided walkthrough** — an in-app tooltip/coach-mark tour that starts
     when the user arrives via the link and points out where the Learn more entry lives on
     the cards they already have.
3. **Upgrade the tip CTAs** to these precise, install-aware links once the routes exist.
4. **In-app email opt-in prompt** — since this release already touches the app, add a way
   for installed users to opt into email tips/reminders, without the app itself collecting
   any PII (it links out to the existing website subscribe page).

Requires an app release. Scope: the React Native app (`src/navigation/`, deep-link
handling, the new walkthrough UI, a Settings entry, and a contextual opt-in prompt) plus
the platform link-association files. Out of scope: the messaging worker, the website build,
and the content copy (only CTA URLs change, and only after routes ship).

**Privacy stance (important):** the app currently collects NO personal data (Privacy
Policy: anonymous analytics only, no email). The in-app opt-in (Requirement 6) is designed
to preserve that: the app does NOT collect or store an email; it links out to the website
subscribe page, which handles consent. This avoids changing the app's Privacy Policy or the
App Store / Play Store data-disclosure labels.

### Root-cause finding: the `mentalwallet://` scheme is not registered

Investigation while wiring the interim CTAs found that **`linking.ts`'s `mentalwallet://`
prefix does not match any registered native URL scheme**, so `mentalwallet://wallet` fails
to open the app ("The application couldn't be opened"):

- `app.json` has **no** `scheme`.
- iOS `Info.plist` registers `com.mentalwallet.app` and `exp+mental-health-wallet` only.
- Android `AndroidManifest.xml` registers `https` and `exp+mental-health-wallet` only.

So the custom-scheme deep linking in `linking.ts` (including the notification tap deep link)
is effectively dead via that prefix today. **This spec must fix the scheme registration**
(add a consistent scheme across `app.json` + iOS + Android, or move fully to Universal/App
Links) as a prerequisite for any working deep link. Confirm whether notification taps
currently rely on this prefix or on expo-notifications' own handler.

### Current interim (shipped in the content/website layer)

Because no working deep link exists yet, each tip article page renders **two app-store
buttons** (App Store + Google Play) instead of a single deep-link CTA. If the app is
installed, the store listing shows "Open"; if not, the user can install. This works on all
platforms and never errors. It is the temporary state this spec replaces (see Requirement
5): once real deep links ship, the page reverts to a single real CTA and these store links
become the not-installed fallback.

## Requirements

### Requirement 1: Universal Links / App Links

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

### Requirement 2: Seedling "how I feel" deep link

**User Story:** As a user arriving from the emotion-session or anxiety tip, I want to land
directly on the "how I feel" check-in, so that I can act immediately instead of hunting for
it.

#### Acceptance Criteria

1. THE app SHALL support a deep link that opens the seedling "how I feel" check-in flow
   (the same flow the wallet's seedling button starts).
2. THE link SHALL be reachable both via the `mentalwallet://` scheme and via a Universal/App
   Link path (per Requirement 1).
3. WHEN opened, THE app SHALL land on the check-in entry (emotion pick / guided check-in),
   not merely the wallet.

### Requirement 3: "Learn more" guided walkthrough deep link

**User Story:** As a user arriving from the "why does this tool work?" tip, I want the app
to show me where Learn more lives, so that I can find it on my own cards.

#### Acceptance Criteria

1. THE app SHALL provide an in-app guided walkthrough (tooltip / coach-mark tour) that
   points out the "Learn more" entry point on a card in the user's wallet.
2. THE app SHALL support a deep link that launches this walkthrough on arrival.
3. THE walkthrough SHALL use a card the user actually has (a real example), and SHALL
   degrade gracefully if the wallet has no card with a Learn more entry (e.g. explain where
   it appears, or guide adding a library card first).
4. THE walkthrough SHALL be dismissible and SHALL not block normal use.
5. THE link SHALL be reachable via both the `mentalwallet://` scheme and a Universal/App
   Link path.

### Requirement 4: Route coverage for tip destinations

**User Story:** As the operator, I want each tip's CTA to map to a real, specific
destination, so that the CTA copy matches where the user lands.

#### Acceptance Criteria

1. THE app SHALL expose deep-link routes covering the current tip destinations:
   - wallet (exists), seedling "how I feel" (Req 2), Learn more walkthrough (Req 3), and an
     **add-tool / library** route (for the "discover third-party apps" tip).
2. WHERE a tip destination has no dedicated screen, THE design SHALL either add one or
   document the closest acceptable target.

### Requirement 5: Upgrade tip CTAs (after routes ship) and revert the interim

**User Story:** As the operator, I want the tip CTAs to use the precise, install-aware
links once they exist, so that the current interim (dual app-store buttons) is replaced by
the right in-app destination, with the store as fallback.

#### Acceptance Criteria

1. AFTER the routes and Universal/App Links ship, THE tip CTA URLs SHALL be updated to the
   precise Universal/App Link for each tip's destination.
2. THE article-page CTA SHALL revert from the **current interim** (two store buttons: App
   Store + Google Play, rendered by `website/build-content.js`) back to a **single real
   CTA** that deep-links into the app.
3. THE app-store links SHALL remain as the **fallback** for when the app is not installed
   (this is what the Universal/App Link resolves to when it can't open the app), not the
   primary action.
4. THE CTA copy and destination SHALL match (e.g. "Start from how I feel" → seedling
   check-in; "why does this tool work?" → Learn more walkthrough).
5. THE change SHALL be limited to CTA URLs in `content/tips/*.md` plus the CTA rendering in
   `website/build-content.js`, plus a content rebuild and deploy; no email/worker change
   required.

### Requirement 6: In-app email opt-in (privacy-preserving, link-out)

**User Story:** As an installed user who has found the app helpful, I want an easy way to
opt into email tips and reminders, so that I get more value without hunting for a link, and
without the app collecting my personal data.

#### Acceptance Criteria

1. THE app SHALL NOT collect or store an email address itself. The opt-in SHALL link out to
   the existing website subscribe page
   (`https://mentalhealthwallet.productsforgood.co/subscribe`), which handles consent and
   scopes. This preserves the app's no-PII privacy posture (no Privacy Policy or store
   data-label changes required).
2. THE app SHALL provide a permanent entry in **Settings** ("Email updates" or similar)
   that opens the subscribe page (and, for managing/opting out, the preferences page).
3. THE app SHALL show a **contextual opt-in prompt** once, triggered after a moment of
   delivered value (e.g. the user's 2nd-3rd tool completion, or first outcome check-in),
   NOT during onboarding.
4. THE contextual prompt SHALL be dismissible; if dismissed, THE app SHALL NOT show it again
   (Settings remains the always-available path).
5. THE prompt SHALL frame the value plainly (occasional tips + optional reminders, change or
   stop anytime) and, on accept, open the website subscribe page.
6. THE opt-in SHALL NOT appear in onboarding, so as not to lengthen or complicate the
   activation path.
7. Because the prompt fires only when the app is opened, users who never return simply are
   not prompted; this is acceptable (an unengaged user is not a good opt-in target) and
   SHALL NOT be worked around by pushing prompts to non-openers.

## Mapping: tips → intended destinations (post-implementation)

| Tip | Intended destination |
|-----|----------------------|
| `welcome` | Wallet |
| `emotion-based-session` | Seedling "how I feel" check-in (Req 2) |
| `feeling-anxious` | Seedling "how I feel" check-in (Req 2) |
| `outcome-capture` | Wallet (use a tool → outcome check-in) |
| `personal-kpi-check-in` | Wallet (seedling daily check-in) |
| `discover-third-party-apps` | Add-tool / library (Req 4) |
| `learn-more-evidence` | Learn more guided walkthrough (Req 3) |
| `come-back-reset` | Wallet |

## Open Questions (design)

- URL path space for Universal/App Links (e.g. `/app/wallet`, `/app/checkin`,
  `/app/learn-more-tour`) and how those map to both the web fallback pages and the app
  routes.
- Whether the seedling check-in and the emotion-session are the same entry or distinct
  (confirm against the actual wallet UI) so Req 2 targets the right screen.
- Walkthrough implementation approach (existing tooltip/coach-mark lib vs. custom) and how
  it selects the example card.
- iOS Universal Links require the app's associated-domains entitlement + the AASA file;
  Android App Links require `assetlinks.json` + verified domain. Confirm signing/domain
  details during design.
- The exact value-milestone that triggers the in-app opt-in prompt (Req 6.3): 2nd vs 3rd
  tool completion, or first outcome check-in. Pick one during design based on where users
  reliably feel value without it being too early.
- Whether the opt-in prompt opens the subscribe page in an in-app browser
  (`expo-web-browser`) vs the system browser; in-app browser keeps context and is likely
  better, matching the tips-feed link-out pattern.
