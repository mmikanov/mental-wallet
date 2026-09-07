# Message Release Plan — Tips & Reminders

Companion to `docs/messaging-and-content-plan.md` (the system) and `content/tips/` (the
content). This plan answers the *editorial* questions: what do we send, to whom, in what
order, and — most importantly — **why does each message make sense at that moment in the
user's journey.**

Status: planning. Cadence is **manual** for now (you decide when to send each message,
using the tooling in `docs/deployment/messaging-operations.md`). Automated lifecycle
sequencing (send X on day N after signup) is a future enhancement — see "Automation later".

---

## Guiding principle

A message should earn its place. Before sending anything, it should pass:

> "Why is this useful to *this* person, *right now*?"

Feature tips sent at random are noise. The same tips, sequenced to the user's journey, are
help. So we organize by **lifecycle stage**, not by feature.

## The two scopes (recap)

- **`tips`** — educational / feature / problem-solving content and the newsletter.
- **`reminders`** — come-back nudges.

Most people are opted into both. A message belongs to one scope; the plan notes which.

---

## Step 0: Acquisition — getting people onto the list

Nothing in this plan happens until someone opts in, so this is the true first step. We do
NOT add people silently; every subscriber must have given consent.

**How consent is obtained (current, manual):**

- **The channel where you first reached them.** You share the app news in the same place you
  first contacted the person (Slack, LinkedIn DM, email, etc.) and ask if they'd like tips
  and reminders. This is how Taras opted in, an explicit yes in a personal channel.
- **The website consent page** (once C1 is live and D1 is healthy):
  `https://mentalhealthwallet.productsforgood.co/subscribe`. Include this link in the
  outreach so people can opt in themselves and choose their scopes. This is the scalable path
  and the cleaner consent record (they pick their own preferences).

**What to include in the ask:**

- One line on what they'll get (occasional tips + optional reminders) and that they can
  change or stop anytime.
- The subscribe link.
- Keep it low-pressure — an invitation, not a sell.

**Recording consent:**

- Website sign-ups record themselves (source `website`).
- For a manual "yes" in a channel, subscribe them via the operator command (source
  `warm_launch` or `manual`) so the record reflects reality — see
  `docs/deployment/messaging-operations.md`. Note where/when they consented in case you ever
  need the audit trail.

**Compliance note:** only add people who actually said yes. A personal-channel "yes" is
valid consent; scraping contacts or assuming interest is not. The website page is the
preferred path because the opt-in and scope choices are self-evident.

### Canonical "invite to subscribe" copy

Personalize `[name]` per person. No em/en dashes (project preference). Sends people to the
website subscribe form so consent + scopes are self-serve and the app stays PII-free.

```
Hi [name],

I hope you had a chance to download Mental Health Wallet and take a look.

The real value tends to show up after using it a few times and finding the tools that fit
you. To help with that, I've put together a short series of tips and gentle reminders that
I'm sharing with early users.

If you'd like to get them, you can sign up here:
https://mentalhealthwallet.productsforgood.co/subscribe

A few things worth knowing:
- It's just an occasional email, and you can unsubscribe anytime.
- Signing up only shares your email with me, for these messages. It stays completely
  separate from the app, which collects no personal data, so I still have no view into how
  you personally use it.

No pressure at all. Only sign up if it feels useful. Either way, thanks for being one of
the first to try it.

[your name]
```

---

## The user journey (stages we send against)

1. **Welcome (just subscribed / just installed)** — set expectations, one clear first action.
2. **Activation (first few days)** — get them to the core "aha": use a tool, feel a result.
3. **Habit-building (first 2-3 weeks)** — features that make the app *stick* (tracking, personalization).
4. **Depth & trust (ongoing)** — why the tools work, making the toolkit their own.
5. **Re-engagement (gone quiet)** — a gentle, low-pressure reason to come back.

Each existing tip maps onto a stage below. Where a stage has no content, that's a **gap to write**.

---

## Sequence (manual cadence)

A suggested order and spacing. Spacing is a guide, not a rule — send when it feels right,
and never more than ~1 message/week to a person early on.

| # | When (guide) | Stage | Message | Scope | Status |
|---|--------------|-------|---------|-------|--------|
| 0 | Outreach / ongoing | Acquisition | **Invite to subscribe** (personal channel + subscribe link) | n/a (opt-in) | Process, not a sent message |
| 1 | On subscribe | Welcome | Welcome ([`welcome`](../content/tips/welcome.md)) | tips | ✅ exists |
| 2 | ~Day 2-3 | Activation | Start from how you feel ([`emotion-based-session`](../content/tips/emotion-based-session.md)) | tips | ✅ exists |
| 3 | ~Day 5-7 | Activation | See which tools help you ([`outcome-capture`](../content/tips/outcome-capture.md)) | tips | ✅ exists |
| 4 | ~Day 10-12 | Habit | Track what matters to you ([`personal-kpi-check-in`](../content/tips/personal-kpi-check-in.md)) | tips | ✅ exists |
| 5 | ~Day 14 | Habit | Keep the apps you already use ([`discover-third-party-apps`](../content/tips/discover-third-party-apps.md)) | tips | ✅ exists |
| 6 | ~Day 18-21 | Depth & trust | Why does this tool work? ([`learn-more-evidence`](../content/tips/learn-more-evidence.md)) | tips | ✅ exists |
| 7 | When quiet (~14+ days no open) | Re-engagement | Here whenever you need it ([`come-back-reset`](../content/tips/come-back-reset.md)) | reminders | ✅ exists |
| 8 | Situational / evergreen | Problem-solving | Feeling anxious right now? ([`feeling-anxious`](../content/tips/feeling-anxious.md)) | tips | ✅ exists |

### Why this order

- **Welcome first** because a subscribe with no follow-up feels like a dead end; the first
  message sets the relationship and gives one action.
- **Emotion-session before outcome-capture** because "how do I even use this?" comes before
  "how do I know it's working?" — you have to use a tool before the outcome check-in means
  anything.
- **Tracking/personalization in the habit window** because those features are what convert
  a curious user into a returning one; they land best once the user has felt a tool work.
- **"Learn more"/evidence later** because trust-deepening is for someone already engaged;
  sent too early it's abstract.
- **Re-engagement is triggered by behavior**, not day count — it belongs to the `reminders`
  scope and should feel like a kind nudge, not a guilt trip.
- **Problem-solving ("anxious right now?")** is evergreen/situational: useful any time, a
  natural entry for someone in distress, and a good candidate for the first *broadcast* to
  the whole list because it's immediately valuable regardless of tenure.

---

## Content: written and future

The three gaps from mapping the journey are now written (in `content/tips/`):

1. ✅ [**`welcome`**](../content/tips/welcome.md) — warm hello, what to expect + one first
   action. Makes the subscribe worth something immediately.
2. ✅ [**`come-back-reset`**](../content/tips/come-back-reset.md) (type `come_back`, scope
   `reminders`) — kind, low-pressure re-engagement for people who've gone quiet.
3. ✅ [**`feeling-anxious`**](../content/tips/feeling-anxious.md) (type `problem_solving`) —
   situational entry for when anxiety spikes; strong first-broadcast candidate.

Possible future additions (not now): problem-solving siblings (stress, low mood, trouble
sleeping, overwhelm); a periodic **"what's new"** update; a **milestone** message
(e.g. "you've used tools 10 times"); seasonal/topical sends.

---

## Reworking the existing 5 tips

The 5 tips are solid but were written as a flat set of feature explainers. Two light edits
to make them fit the sequence:

- **Give each a clear lifecycle role** (done above via the sequence table) so the send has a
  reason. No copy rewrite needed for that — it's about *when* we send, not the words.
- **Consider trimming for email.** The bodies are page-length (good for the web article via
  C2). In email we lead with the `summary` + CTA; the full body lives on the web page. So no
  change needed to the tips themselves — the email uses the summary, the web page uses the
  body. (This is exactly the "author once, render many" split.)

Optional polish: the CTA URLs all point at the site root. Once C2 ships article pages, some
CTAs could deep-link to the specific tip's page or an app deep link. Revisit after C2.

---

## First broadcast recommendation

When D1 is healthy and you're ready for the first *real* send to the list (Phase C3), send
**one** message, not a backlog dump. Best first broadcast: either the **Welcome** (to
everyone as a re-introduction) or **"Feeling anxious right now?"** (immediately useful to
anyone). Pick one, send to the `tips` scope, watch opens/clicks, then settle into the
cadence above.

---

## Automation later (not now)

Everything above is executable by hand today. A future phase could add lifecycle
automation: trigger message N a set time after subscribe, and fire the re-engagement nudge
from an inactivity signal (which would require the messaging system to know last-open —
data the app currently keeps anonymously in analytics, not tied to a subscriber). Noted so
we don't accidentally design for it prematurely; manual cadence is the right scope for the
current audience size.
