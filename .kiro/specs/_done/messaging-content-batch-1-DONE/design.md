# Design Document

## Overview

Phase B adds a reusable tip content format (markdown + frontmatter), authors 5 tips, and
extends the messaging worker with a tip-rendering send path so a real tip email can be
sent to a consenting address. Web-page rendering, `index.json`, and the in-app feed are
Phase C.

The core constraint: the messaging worker runs on Cloudflare Workers with **no
filesystem**, so it cannot read the markdown tips at runtime. Rather than build a full
content pipeline now, a small **local script** reads a tip's markdown, parses its
frontmatter + body, and POSTs the rendered fields to the worker. This keeps the markdown
as the single source of truth (Requirement 3.4) without a build step, and defers the
website rendering cleanly to Phase C.

## Content location and format

```
content/
└── tips/
    ├── README.md                     # frontmatter schema + authoring guide
    ├── emotion-based-session.md
    ├── outcome-capture.md
    ├── personal-kpi-check-in.md
    ├── learn-more-evidence.md
    └── discover-third-party-apps.md
```

A repo-root `content/tips/` directory is used (not `website/`) so authoring is decoupled
from website plumbing; Phase C's build step will consume this same directory.

> Note: this spec authored the original 5 tips. Three more (`welcome`, `come-back-reset`,
> `feeling-anxious`) were added later per `docs/message-release-plan.md`, for 8 total. Same
> format and directory.

### Frontmatter schema

```yaml
---
title: "3 tools for when anxiety spikes"
summary: "A 60-second grounding sequence you can reach for the moment anxiety hits."
slug: "handling-anxiety"          # canonical id / url segment
type: "problem_solving"           # come_back | feature | problem_solving
topics: ["anxiety", "grounding"]  # feeling / feature tags
heroImage: ""                     # optional path or URL; empty = none (placeholder ok)
cta:
  label: "Open your wallet"
  url: "https://mentalhealthwallet.productsforgood.co/"
publishedAt: "2026-09-04"
version: 1
---

Full markdown body here (used for the web page in Phase C).
```

The body holds the full content; `summary` is the standalone excerpt for email + feed
cards.

## Send-a-tip path

### Local script: `messaging-worker/scripts/send-tip.ts`

- Reads a tip by slug from `content/tips/<slug>.md`.
- Parses frontmatter (title, summary, heroImage, cta, ...) and the markdown body.
- POSTs the rendered tip fields + target email + admin secret to the worker's send-tip
  endpoint.
- Usage:
  ```
  MESSAGING_BASE_URL=https://mental-wallet-messaging.mentalwallet.workers.dev \
  ADMIN_SECRET=... \
  npx tsx scripts/send-tip.ts --slug handling-anxiety --to you@example.com
  ```
- A minimal frontmatter parser is sufficient (no heavy YAML dependency needed for these
  simple fields); may use a tiny parser inline.

### Worker endpoint: `POST /send-tip` (admin)

Mirrors `/send-test` (secret-auth, consent-enforced) but accepts structured tip fields:

```jsonc
{
  "email": "you@example.com",
  "scope": "tips",              // default 'tips'
  "tip": {
    "title": "3 tools for when anxiety spikes",
    "summary": "A 60-second grounding sequence ...",
    "body": "optional longer text/HTML-safe content",
    "heroImage": "https://.../anxiety.jpg",
    "cta": { "label": "Open your wallet", "url": "https://..." }
  }
}
```

- Validates email + tip.title + tip.summary.
- Reuses the existing consent check (opted into `scope`, else `409`).
- Renders via a new `sendTipEmail(env, recipient, tip)` helper.

### Email rendering: `sendTipEmail`

Extends the existing `sendEmail` pattern (keeps the same unsubscribe headers + footer):

- Subject = `tip.title`.
- Body HTML: personalized greeting → optional hero `<img>` (only when `heroImage` set) →
  `summary` (and `body` if provided) → a CTA button/link (`cta.label` → `cta.url`) →
  existing footer (`Manage preferences` / `Unsubscribe`).
- Plain-text alternative mirrors the HTML (greeting, summary/body, CTA url, footer links).
- Same `List-Unsubscribe` / `List-Unsubscribe-Post` headers as today.
- Same personalization + fallback greeting as `sendEmail`.

The existing `/send-test` behavior is unchanged; `sendTipEmail` is additive. Implementation
note: the shared Resend API call (headers + send) was factored into a `sendViaResend`
helper that both `sendEmail` and `sendTipEmail` use, so compliance headers and sender
identity stay consistent (documented in the `messaging-foundation` design).

## Testing strategy

- Typecheck the worker (`npm run typecheck`).
- Local worker (`npm run dev`) + local D1: subscribe a test address, `POST /send-tip` with
  a real key placeholder to confirm request shape, consent gate (`409` for non-opted-in),
  and validation (400 on missing fields).
- End-to-end (operator, production): run `send-tip.ts --slug <one of the 5> --to <own
  subscribed email>` and confirm the email renders (greeting, summary, CTA link, footer,
  hero if set).
- Confirm no changes to `/send-test`, `/subscribe`, or other existing behavior.

## Documentation

- `content/tips/README.md` — the frontmatter schema + authoring guide.
- `messaging-worker/README.md` — a "Send a tip" section (endpoint + `send-tip.ts` usage).
