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

**Dependency:** Requirement 2 (CTA upgrade) requires the routes from `1.0.4-deep-linking`
Requirements 3 & 4 to be shipped first. Requirement 1 (email opt-in) is independent of the
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
4. THE CTA copy and destination SHALL match (e.g. "Start from how I feel" → seedling
   check-in; "why does this tool work?" → Learn more walkthrough).
5. THE change SHALL be limited to CTA URLs in `content/tips/*.md` plus the CTA rendering in
   `website/build-content.js`, plus a content rebuild and deploy; no email/worker change
   required.

## Mapping: tips → intended destinations (post-implementation)

| Tip | Intended destination |
|-----|----------------------|
| `welcome` | Wallet |
| `emotion-based-session` | Seedling "how I feel" check-in |
| `feeling-anxious` | Seedling "how I feel" check-in |
| `outcome-capture` | Wallet (use a tool → outcome check-in) |
| `personal-kpi-check-in` | Wallet (seedling daily check-in) |
| `discover-third-party-apps` | Add-tool / library |
| `learn-more-evidence` | Learn more guided walkthrough |
| `come-back-reset` | Wallet |
| `add-your-own-app` | Add-tool / Create Tool |
| `add-your-own-tool` | Create Tool |
| `reorder-tools` | Wallet |
| `archive-restore-tools` | Wallet / Archive |

## Out of Scope

- The deep-linking foundation itself (scheme fix, Universal/App Links, routes, notification
  focus, walkthrough) — see `1.0.4-deep-linking`.
- Any messaging-worker change (CTA upgrade is content + website build only).

## Open Questions (design)

- The exact value-milestone that triggers the in-app opt-in prompt (Req 1.3): 2nd vs 3rd
  tool completion, or first outcome check-in. Pick one during design based on where users
  reliably feel value without it being too early.
- Whether the Settings entry and the contextual prompt share one "opt-in" component/state or
  are separate.
