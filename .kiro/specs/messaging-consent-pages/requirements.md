# Requirements Document

## Introduction

Phase C, part 1 (C1) of the messaging & content plan (`docs/messaging-and-content-plan.md`):
the human-facing **consent pages** on the marketing website
(`mentalhealthwallet.productsforgood.co`) that let people subscribe, change their
preferences, and unsubscribe. These pages call the messaging worker endpoints already
built in the `messaging-foundation` spec.

This closes the consent loop on the web. Today the emails already include "Manage
preferences" and "Unsubscribe" links pointing at `SITE_ORIGIN/preferences?token=...` and
`SITE_ORIGIN/unsubscribe?token=...`, but the website has no such pages, so "Manage
preferences" currently 404s. (Unsubscribe is currently answered by a minimal page the
worker renders itself.) C1 makes both live and on-brand.

The marketing site is static HTML on Cloudflare (see `docs/deployment/marketing-website.md`),
no build step. C1 stays within that model: plain HTML/CSS/JS pages using the existing
`styles.css`, deployed via the existing `wrangler deploy`.

In scope: a subscribe page, a preferences page, an unsubscribe confirmation page, a small
worker read-endpoint for current preferences, and any CORS wiring needed. Out of scope:
content rendering / article pages / `index.json` (C2), and batch/campaign sending (C3).

## Requirements

### Requirement 1: Subscribe page

**User Story:** As a website visitor, I want to sign up for tips and/or reminders with my
email, so that I start receiving the updates I choose.

#### Acceptance Criteria

1. THE website SHALL provide a subscribe page with fields for email, optional first name,
   and independent opt-ins for `tips` and `reminders`.
2. THE page SHALL validate the email format client-side and show an inline error before
   submitting (a UX aid; the worker remains authoritative).
3. WHEN submitted, THE page SHALL POST to the worker `/subscribe` endpoint and show a clear
   success confirmation, or a friendly error on failure.
4. THE page SHALL make clear what each scope means and that they can unsubscribe anytime.
5. THE page SHALL be consistent with the site's existing look (nav, footer, `styles.css`)
   and accessibility conventions (skip link, labels, aria).

### Requirement 2: Preferences page

**User Story:** As a subscriber, I want to change which messages I receive from a link in
an email, so that I keep what I value and drop the rest without fully unsubscribing.

#### Acceptance Criteria

1. THE website SHALL provide a preferences page that reads an opaque `token` from the URL
   query string.
2. THE page SHALL display the subscriber's CURRENT scope states (checkboxes reflecting
   whether they're opted into `tips` and `reminders`).
3. WHEN saved, THE page SHALL POST the desired scope states plus the token to the worker
   `/preferences` endpoint and confirm the update.
4. IF the token is missing or invalid, THEN THE page SHALL show a friendly message (without
   revealing whether a token exists) and offer a path to re-subscribe.
5. THE page SHALL offer a clear "unsubscribe from everything" affordance.

### Requirement 3: Unsubscribe page

**User Story:** As a subscriber, I want a one-click unsubscribe that lands on a clear,
branded confirmation, so that opting out feels trustworthy and final.

#### Acceptance Criteria

1. THE website SHALL provide an unsubscribe page reachable from the email footer link and
   the `List-Unsubscribe` header target, using the `token` from the URL.
2. THE page SHALL disable all scopes for that token (via the worker) and confirm the user
   is unsubscribed.
3. THE unsubscribe action SHALL be idempotent and SHALL show a uniform confirmation whether
   or not the token was found.
4. THE page SHALL offer a way to re-subscribe or manage preferences if the user changes
   their mind.

### Requirement 4: Worker support for reading current preferences

**User Story:** As the preferences page, I need to read a subscriber's current scopes by
token, so that I can pre-fill the checkboxes correctly.

#### Acceptance Criteria

1. THE worker SHALL expose a public, token-based way to read the current scope states for a
   subscriber (e.g. `GET /preferences?token=...`), returning the `tips` and `reminders`
   booleans and optionally the first name.
2. IF the token is unknown, THEN THE response SHALL be a uniform not-found without leaking
   token validity details.
3. THE endpoint SHALL NOT require the admin secret (it is used by the public preferences
   page and gated only by the unguessable token).
4. CORS SHALL permit the marketing website origin for this endpoint and for the existing
   public endpoints used by these pages.

### Requirement 5: Consistency, privacy, and documentation

**User Story:** As the operator, I want the consent pages to be clear about data and
consistent with existing policy, so that trust and compliance hold.

#### Acceptance Criteria

1. THE subscribe page SHALL make explicit that email is collected only to send the chosen
   messages, distinguishing this opt-in marketing channel from the app's anonymous
   analytics described in the existing Privacy Policy (which states no email is collected
   by the app).
2. THE pages SHALL link to the Privacy Policy.
3. THE deployment/marketing-website documentation SHALL be updated to describe the new
   pages and how they talk to the worker.
4. No change SHALL be made to the app or its analytics as part of C1.

## Open Questions (design)

- Whether unsubscribe stays a distinct page or shares the preferences page in an
  "unsubscribe" mode. Leaning toward a dedicated, dead-simple unsubscribe page for the
  one-click case, with a link into preferences.
- Whether to keep the worker's built-in `/unsubscribe` HTML as a fallback or fully replace
  it with the website page (redirect vs. leave as-is).
