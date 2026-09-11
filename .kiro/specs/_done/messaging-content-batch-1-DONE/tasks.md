# Tasks

## Task 1: Define the tip content format

- [x] Create `content/tips/` and `content/tips/README.md` documenting the frontmatter
      schema (title, summary, slug, type, topics, heroImage, cta, publishedAt, version)
      and authoring conventions
- [x] Verify: schema doc is complete and matches the design
- _Requirements: 1.1, 1.2, 1.3, 1.4, 4.2_

## Task 2: Author the 5 tips

- [x] Write `emotion-based-session.md`, `outcome-capture.md`, `personal-kpi-check-in.md`,
      `learn-more-evidence.md`, `discover-third-party-apps.md`, each conforming to the
      schema with a meaningful `summary` and media placeholders where useful
- [x] Verify: copy matches shipped app behavior (no unshipped-feature claims); all
      required frontmatter fields present
- _Requirements: 2.1, 2.2, 2.3, 2.4_

## Task 3: Add the tip send path to the messaging worker

- [x] Implement `POST /send-tip` (admin, consent-enforced) accepting structured tip fields
- [x] Implement `sendTipEmail` (greeting, optional hero image, summary/body, CTA link,
      existing unsubscribe headers + footer); shared Resend call extracted to
      `sendViaResend`; `/send-test` and `sendEmail` behavior unchanged
- [x] Verify (local): typecheck passes; consent gate returns 409 for non-opted-in; missing
      fields → 400; request shape reaches Resend
- _Requirements: 3.1, 3.2, 3.3, 4.3_

## Task 4: Add the local send-tip script

- [x] Implement `messaging-worker/scripts/send-tip.ts` (read tip by slug, parse
      frontmatter + body, POST to `/send-tip`)
- [x] Add an npm script for it (`send:tip`)
- [x] Verify (local dry-run/local worker): script reads a tip and posts the correct fields
- _Requirements: 3.4_

## Task 5: Document and end-to-end verify

- [x] Add a "Send a tip" section to `messaging-worker/README.md` (endpoint + script usage)
- [x] Operator end-to-end: send one batch tip to a subscribed address and confirm it
      renders correctly in the inbox (needs deploy + real send — your step)
- _Requirements: 3.5, 4.1_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5"] }
  ]
}
```
