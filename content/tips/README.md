# Tips — content library

Each tip is a single markdown file with YAML frontmatter. This is the **single source of
truth**: one authored tip feeds email now, and (in Phase C) the website page, the
`index.json` for the in-app feed, and the knowledge base.

"Author once, render many." Write the tip here; don't retype it into emails.

## Frontmatter schema

```yaml
---
title: "3 tools for when anxiety spikes"      # subject line + page/card title
summary: "A 60-second grounding sequence ..."  # standalone excerpt (email + feed card)
slug: "handling-anxiety"                        # canonical id / url segment (kebab-case)
type: "problem_solving"                         # come_back | feature | problem_solving
topics: ["anxiety", "grounding"]                # feeling / feature tags (lowercase)
heroImage: ""                                    # optional path or URL; "" = none
cta:
  label: "Open your wallet"                      # button/link text
  url: "https://mentalhealthwallet.productsforgood.co/"
publishedAt: "2026-09-04"                        # ISO date
version: 1                                        # bump on meaningful edits
---

Full markdown body goes here. This is what the website page will render in Phase C.
The `summary` above is what shows in the email and the in-app feed card, so it must
make sense on its own.
```

## Field notes

- **title** — used as the email subject and the page/card heading. Keep it concrete and
  benefit-led. Avoid health-inferring specifics in a way that would be awkward as an inbox
  subject line (be discreet).
- **summary** — one or two sentences. Must stand alone: a reader who never clicks through
  should still get value. This is the most reused field.
- **slug** — kebab-case, stable. It becomes the web URL segment; don't change it after
  publishing (it's the canonical id).
- **type**:
  - `come_back` — a nudge to return to the app.
  - `feature` — how to use a specific feature.
  - `problem_solving` — handling a specific feeling/problem (anxiety, stress, ...).
- **topics** — lowercase tags for filtering/sorting later (feelings or features).
- **heroImage** — optional. A screenshot or image URL. Leave `""` if you don't have one
  yet; a placeholder path is fine. Missing media never blocks sending.
- **cta** — a single call to action (label + url). Usually deep-links into the app or the
  relevant web page.
- **publishedAt** / **version** — for ordering and change tracking.

## Authoring rules

- **Match shipped behavior.** Only describe features that are actually live. If something
  isn't shipped, don't claim it (same honesty standard as the warm-launch messages).
- **Keep the voice warm and plain.** No hype, no em/en dashes (project preference).
- **Body is for depth; summary is for the inbox.** The email leads with the summary and
  links to the full body on the web (Phase C).

## Current batch

| slug | type | topics |
|------|------|--------|
| welcome | feature | welcome, getting-started |
| emotion-based-session | feature | emotions, getting-started |
| outcome-capture | feature | tracking, reflection |
| personal-kpi-check-in | feature | tracking, goals |
| discover-third-party-apps | feature | discovery, apps |
| learn-more-evidence | feature | trust, evidence |
| feeling-anxious | problem_solving | anxiety, grounding, in-the-moment |
| come-back-reset | come_back | re-engagement, reminders |

Order above follows the lifecycle sequence in `docs/message-release-plan.md`
(`come-back-reset` and `feeling-anxious` are behavior-triggered / evergreen, not part of the
linear onboarding drip).
