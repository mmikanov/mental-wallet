# Requirements Document — In-App Email Opt-In & Tip CTA Upgrade (1.0.4)

## Introduction

This spec covers two lighter, communication-facing pieces that both **depend on the
deep-linking foundation** in the sibling spec `1.0.4-deep-linking` (working scheme +
Universal/App Links + the new routes):

1. **In-app email opt-in** — a privacy-preserving way for installed users to subscribe to
   email tips/reminders themselves, so more people sign up without the operator approaching
   each one individually. The app collects **no PII**; it links out to the existing website
   subscribe page, which handles consent.
2. **Upgrade tip CTAs** — once the precise deep-link routes exist, point each tip's CTA at
   the right in-app destination (with the app store as the not-installed fallback), replacing
   the current interim (dual app-store buttons on the article pages).
3. **`/app/*` not-installed fallback page** — a single smart web page that catches every
   `/app/*` deep link when the app is not installed, shows a message personalized to the route,
   and offers the store. This is the "web fallback page" that Requirement 2 and the sibling
   deep-linking spec both depend on; it is owned here so it stops being an unowned prerequisite.

**Dependency:** Requirement 2 (CTA upgrade) requires the routes from `1.0.4-deep-linking`
Requirements 3 & 4 to be shipped first, AND Requirement 3 (the fallback page) to be live so
not-installed recipients don't hit a 404. Requirement 1 (email opt-in) is independent of the
routes but is grouped here as the other communication-growth item in 1.0.4.

**Privacy stance (important):** the app currently collects NO personal data (Privacy Policy:
anonymous analytics only, no email). The in-app opt-in preserves that: the app does NOT
collect or store an email; it links out to the website subscribe page, which handles consent.
This avoids changing the app's Privacy Policy or the App Store / Play Store data-disclosure
labels.

## Requirements

### Requirement 1: In-app email opt-in (privacy-preserving, link-out)

**User Story:** As an installed user who has found the app helpful, I want an easy way to opt
into email tips and reminders, so that I get more value without hunting for a link, and
without the app collecting my personal data.

#### Acceptance Criteria

1. THE app SHALL NOT collect or store an email address itself. The opt-in SHALL link out to
   the existing website subscribe page
   (`https://mentalhealthwallet.productsforgood.co/subscribe`), which handles consent and
   scopes. This preserves the app's no-PII privacy posture (no Privacy Policy or store
   data-label changes required).
2. THE app SHALL provide a permanent entry in **Settings** ("Email updates" or similar) that
   opens the subscribe page (and, for managing/opting out, the preferences page).
3. THE app SHALL show a **contextual opt-in prompt** once, triggered after a moment of
   delivered value (e.g. the user's 2nd–3rd tool completion, or first outcome check-in),
   NOT during onboarding.
4. THE contextual prompt SHALL be dismissible; if dismissed, THE app SHALL NOT show it again
   (Settings remains the always-available path). The dismissed/seen state SHALL persist
   across restarts (reuse the app's existing onboarding/settings persistence).
5. THE prompt SHALL frame the value plainly (occasional tips + optional reminders, change or
   stop anytime) and, on accept, open the website subscribe page.
6. THE opt-in SHALL NOT appear in onboarding, so as not to lengthen or complicate the
   activation path.
7. Because the prompt fires only when the app is opened, users who never return simply are
   not prompted; this is acceptable and SHALL NOT be worked around by pushing prompts to
   non-openers.
8. THE opt-in SHALL open the subscribe page in an in-app browser (`expo-web-browser`) to keep
   context, matching the tips-feed link-out pattern (final choice confirmed in design).

### Requirement 2: Upgrade tip CTAs to precise deep links (after routes ship)

**User Story:** As the operator, I want the tip CTAs to use the precise, install-aware links
once they exist, so that the current interim (dual app-store buttons) is replaced by the
right in-app destination, with the store as fallback.

#### Acceptance Criteria

1. AFTER the routes and Universal/App Links ship (sibling spec), THE tip CTA URLs SHALL be
   updated to the precise Universal/App Link for each tip's destination.
2. THE article-page CTA SHALL revert from the **current interim** (two store buttons: App
   Store + Google Play, rendered by `website/build-content.js`) back to a **single real CTA**
   that deep-links into the app.
3. THE app-store links SHALL remain as the **fallback** for when the app is not installed
   (what the Universal/App Link resolves to when it can't open the app), not the primary
   action.
4. THE CTA copy and destination SHALL match (e.g. "Start from how I feel" → the "Start from
   how I feel" card / emotion session; "why does this tool work?" → the top card opened so its
   "Learn more" link is visible).
5. THE change SHALL be limited to CTA URLs in `content/tips/*.md` plus the CTA rendering in
   `website/build-content.js`, plus a content rebuild and deploy; no email/worker change
   required.

### Requirement 3: `/app/*` not-installed fallback page (single smart page)

**User Story:** As a recipient who taps a tip's deep link but does NOT have the app installed,
I want the link to land on a helpful page that tells me what it was for and lets me get the
app, so that the link never dead-ends on a 404.

**Context / why this is here:** Requirement 2 points every tip CTA at a Universal/App Link
(`https://mentalhealthwallet.productsforgood.co/app/<route>`). When the app is installed the OS
intercepts the link and opens the app (the web server is never hit). When the app is NOT
installed, the browser actually loads `/app/<route>` from the marketing site, which today has
no page there and returns a 404. Both `1.0.4-deep-linking` (Req 3.3, design URL-path table) and
this spec (Req 2.3, Task 5) reference "the web fallback page" as a prerequisite, but no spec
OWNS building it. This requirement owns it. The chosen approach is a SINGLE shared page that
personalizes its message from the incoming path, rather than one page per route.

#### Acceptance Criteria

1. THE marketing site SHALL serve a real (HTTP 200) page for ANY `/app/*` path, including
   `/app`, every deep-link route (`/app/wallet`, `/app/how-i-feel`, `/app/checkin`,
   `/app/learn-more-tour`, `/app/add-tool`), and paths carrying a query string
   (e.g. `/app/wallet?focusCardId=...`, `/app/add-tool?filter=apps`) or a trailing slash.
2. THE fallback SHALL be a SINGLE page (not one page per route). It SHALL read the route from
   `location.pathname` at load time and show a personalized headline/message for known routes,
   degrading to a generic "Open Mental Health Wallet" message for unknown or bare `/app` paths.
3. EVERY variant of the page SHALL present a clear call to get the app, using the same
   platform-aware store hand-off pattern as the existing article CTA (iOS → App Store, Android →
   Play Store, desktop/unknown → both), so the store is the not-installed fallback (satisfies
   Req 2.3).
4. THE page MAY attempt the `mentalwallet://<route>` custom scheme once on load (in case an
   installed user somehow reaches the page) before presenting the store options; this attempt
   SHALL degrade cleanly (no error, no blocking) when the app is not installed.
5. THE page SHALL collect NO PII and SHALL NOT change the app's data-disclosure posture (static
   page, no forms; consistent with Requirement 1's privacy stance).
6. THE route→message map SHALL be small, colocated with the page, and SHALL name
   `docs/deployment/deep-links.md` as the canonical route list, so it degrades (generic message)
   rather than breaking if a route is missing. The route list in `deep-links.md` remains the
   single source of truth for which routes exist.
7. THE page SHALL match the site's existing look (shared nav/footer/styles) and the project
   voice (warm, plain, no em/en dashes).

#### Route → fallback message (canonical copy)

`.../` = `https://mentalhealthwallet.productsforgood.co`. Copy is intentionally short; the
button is the platform store hand-off.

| Path | Headline | Supporting line |
|------|----------|-----------------|
| `/app/wallet` (also bare `/app` and unknown) | Open your wallet | Get Mental Health Wallet to open your tools and pick up where you left off. |
| `/app/how-i-feel` | Start from how you feel | Get the app to check in with how you're feeling and get matching tools. |
| `/app/checkin` | Your daily check-in | Get the app to log today's check-in and track how you're doing. |
| `/app/learn-more-tour` | See why a tool works | Get the app to open a tool and read the evidence behind it. |
| `/app/add-tool` | Add a tool | Get the app to browse the library and add tools to your wallet. |
| `/app/add-tool?filter=apps` | Discover mental health apps | Get the app to browse companion apps you can add to your wallet. |

## Mapping: tips → intended destinations (post-implementation)

| Tip | Intended destination |
|-----|----------------------|
| `welcome` | Wallet |
| `emotion-based-session` | "Start from how I feel" card (emotion session) |
| `feeling-anxious` | "Start from how I feel" card (emotion session) |
| `outcome-capture` | Wallet (use a tool → outcome check-in) |
| `personal-kpi-check-in` | Seedling 🌱 daily check-in card (KPI card, focused + expanded) |
| `discover-third-party-apps` | Add-tool / library, Apps filter pre-selected |
| `learn-more-evidence` | Top stack card, focused + expanded (its "Learn more" link is visible) |
| `come-back-reset` | Wallet |
| `add-your-own-app` | Add-tool / Create Tool |
| `add-your-own-tool` | Create Tool |
| `reorder-tools` | Wallet |
| `archive-restore-tools` | Wallet / Archive |

## Out of Scope

- The deep-linking foundation itself (scheme fix, Universal/App Links, routes, notification
  focus) — see `1.0.4-deep-linking`.
- Any messaging-worker change (CTA upgrade + fallback page are content + website build only).
- A guided in-app "Learn more" walkthrough (parked; `/app/learn-more-tour` opens the top card).
- Per-route fallback pages / tailored article-page fallbacks. Requirement 3 deliberately uses
  ONE shared page that personalizes by path, not a page per route.

## Open Questions (design)

- The exact value-milestone that triggers the in-app opt-in prompt (Req 1.3): 2nd vs 3rd
  tool completion, or first outcome check-in. Pick one during design based on where users
  reliably feel value without it being too early.
- Whether the Settings entry and the contextual prompt share one "opt-in" component/state or
  are separate.
