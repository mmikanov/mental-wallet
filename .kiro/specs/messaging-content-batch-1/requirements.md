# Requirements Document

## Introduction

Phase B of the messaging & content plan (`docs/messaging-and-content-plan.md`): define the
reusable **tip content model** and author the first batch of tips, then make them testable
by sending a real tip email through the existing messaging worker.

The guiding principle from the plan is "author once, render many": each tip is a single
content object (markdown + frontmatter) that will later feed the website page, the
`index.json` for the in-app feed, the knowledge base, and email. In Phase B we prove the
**email** rendering path end to end (a real tip lands in an inbox), and defer web-page
rendering, `index.json` generation, and the in-app feed to Phase C.

Tips reuse angles already validated in `docs/warm-launch-messages.md`: emotion-based
session, outcome capture, personal KPI check-in, "Learn more"/evidence, and discovering
3rd-party apps.

In scope: the tip frontmatter schema, 5 authored tips as markdown (media placeholders
allowed), and a "send a tip" capability that emails a tip via the messaging worker.
Out of scope: website build/rendering, `index.json`, the in-app feed (all Phase C), and
batch/campaign sending to a whole list (still Phase C).

## Requirements

### Requirement 1: Tip content model

**User Story:** As the operator, I want a single structured format for a tip, so that one
authored file can feed email now and the website, KB, and in-app feed later.

#### Acceptance Criteria

1. THE tip format SHALL be a markdown file with frontmatter containing at least: `title`,
   `summary` (short excerpt for email/feed cards), `slug` (canonical id/url segment),
   `type` (`come_back` | `feature` | `problem_solving`), `topics` (list, e.g. anxiety,
   stress), `heroImage` (optional path/URL), `cta` (label + url), `publishedAt`, and
   `version`.
2. THE markdown body SHALL hold the full tip content (used later for the web page).
3. THE `summary` SHALL be suitable for standalone use in an email and a feed card without
   requiring the full body.
4. THE schema SHALL be documented so future tips can be authored consistently.

### Requirement 2: First batch of tips

**User Story:** As the operator, I want a starter set of tips reusing angles I know
resonate, so that I have real content to send and reuse.

#### Acceptance Criteria

1. THE batch SHALL include 5 tips covering: emotion-based session, outcome capture,
   personal KPI check-in, "Learn more"/evidence, and discovering 3rd-party apps.
2. EACH tip SHALL conform to the Requirement 1 schema and include a meaningful `summary`.
3. WHERE a screenshot or video would help, the tip MAY use a placeholder reference that an
   operator fills in later; missing media SHALL NOT block authoring or sending.
4. Tip copy SHALL match the app's actual shipped behavior (no claims about unshipped
   features), consistent with the honesty already applied in `warm-launch-messages.md`.

### Requirement 3: Send a tip by email (testable)

**User Story:** As the operator, I want to send a specific tip to an address as a real
email, so that I can judge how a tip reads in an inbox before building the rest.

#### Acceptance Criteria

1. THE messaging worker SHALL support sending a tip to a single consenting recipient,
   rendering `title` (subject), a personalized greeting, `summary` and/or body, the
   `heroImage` when present, and the `cta` link.
2. THE tip email SHALL retain the compliance features already built: `List-Unsubscribe`
   and `List-Unsubscribe-Post` headers plus a footer preferences/unsubscribe link.
3. THE send SHALL remain consent-enforced: only to an address opted into the relevant
   scope (`tips` by default), returning the existing `409` behavior otherwise.
4. THE tip content SHALL originate from the authored markdown (single source of truth),
   not be retyped into the send request.
5. Verification: an operator can send one of the batch tips to their own subscribed
   address and receive a correctly rendered email.

### Requirement 4: Consistency and documentation

**User Story:** As the operator, I want the new capability documented, so that I can send
tips again later without rediscovering how.

#### Acceptance Criteria

1. THE messaging worker README SHALL document how to send a tip (command + inputs).
2. THE tip authoring format SHALL be documented alongside the tips.
3. No user-facing analytics or app behavior SHALL change as part of Phase B.

## Open Questions (design)

- How the worker obtains tip content at send time given Workers have no filesystem: pass
  the rendered tip fields in the request (a local script reads the markdown and posts it)
  vs. embedding tips in the worker. Leaning toward a local script posting the parsed tip,
  to keep markdown as the single source without a build pipeline yet.
- Whether the tip email template is a distinct code path or an extension of the existing
  `sendEmail` helper.
