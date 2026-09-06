# Messaging & Content Plan — Mental Health Wallet

Companion to `docs/launch-plan.md`. Covers how we reach opted-in users with reminders
and tips, and how we turn that content into a durable, reusable asset (knowledge base,
newsletter, in-app help).

Status: **planning only** — nothing built yet. Open decisions are called out inline.

---

## The core idea: content library + delivery layer (two things, not one)

Everything here splits into two problems. Keeping them separate is what makes the effort
compound instead of producing throwaway one-off emails.

1. **Content library — the durable asset.** Each "tip" is a reusable content object:
   the problem it addresses (anxiety, stress, etc.), the feature it highlights, a short
   body, optional media, and a canonical URL. Author it once; reuse it as an email, a
   knowledge base article, a newsletter item, and in-app help.

2. **Delivery layer — the channel.** How a tip actually reaches a consenting user.
   The content is channel-agnostic; the delivery layer renders it per channel.

We author into the library first, then deliver. We never write "an email" — we write a
tip and send it *through* email.

---

## What a "tip" is

Reminders and tips are the same content type with different intent:

- **Come-back reminders** — nudges to return to the app.
- **Feature tips** — how to use a specific feature.
- **Problem-solving tips** — handling a specific feeling (anxiety, stress, low mood).

Each can carry a screenshot or short video when that helps the user consume it quickly.
Media renders fully in email and in-app; push carries only a short nudge that deep-links
into the app (see channel comparison).

We already have validated angles drafted in `docs/warm-launch-messages.md`
(emotion-based session, outcome capture, personal KPI check-in, "Learn more"/evidence,
discovering 3rd-party apps). These are the first content batch.

---

## Channel comparison

| Channel | Reaches user when app closed? | Rich media | Consent we have today | Build effort |
|---|---|---|---|---|
| **Email** (to opted-in subscribers) | Yes | Full (images + video links) | Partial — tracked ad hoc in a gitignored doc | Low |
| **In-app tips feed** | No (only when they open) | Full | Implicit (they're in the app) | Medium (new app surface) |
| **Remote push** (server-sent) | Yes | Limited (one small image, **no video**) | None — current notifications are local-only | High |

**Decision: lead with email + in-app now; defer remote push.**

- Email gives rich media and reach today.
- The in-app feed makes the same content useful to people who didn't opt into email.
- Remote push is the expensive one and only pays off at volume.

### How the channels differ technically

- **Local notifications (what the app has today).** `src/services/notificationService.ts`
  schedules on-device notifications via expo-notifications. The OS fires them even when
  the app is closed, but *we* have no involvement — we cannot send, target, or change
  them. This is per-card reminders the user sets for themselves. It is **not** a channel
  we can broadcast tips through.

- **Remote push (not built).** On permission grant, the OS issues a per-install push
  token (Expo push token, which relays to Apple APNs / Google FCM). The app sends that
  token to our server once; later our server tells Expo to push to that token, and
  Apple/Google wake the device — even with the app fully closed. Requires token storage,
  a device-registration call, and a send path. Note: OS notification permission is
  **separate** from marketing opt-in; a user can grant one and not the other.

- **Email.** Fully under our control, best for rich content, and the only channel where
  video renders well (as a linked thumbnail).

---

## Email provider: Resend (decided)

Chosen over Mailchimp and Kit for **data control** and **clean integration** with the
Cloudflare Worker we already run.

- Developer-first API, pairs naturally with Cloudflare Workers.
- React Email templates authored as components (fits the TypeScript/React stack).
- Generous free tier; comfortably covers a warm-launch list at zero recurring cost.
- Tradeoff accepted: we build subscription management ourselves rather than leaning on a
  hosted ESP UI. This is the intended cost of owning our consent data.

Setup requires verifying the sending domain (DNS records in Cloudflare) for
deliverability.

### Emails carry real content, not just a link

An email should stand on its own for a reader who won't click through:

- **Title, hero image (screenshot/thumbnail), and a meaningful excerpt / core takeaway** —
  enough to get value inside the inbox.
- **A "Read the full tip" / "Watch the video" link** to the web page for depth (video
  especially, since it can't play inline reliably in email).
- Required unsubscribe / preferences footer.

The template pulls title + `summary` + hero image from the **same content object** that
generates the web page and the JSON index. One authored tip → three renderings (full web
page, email with summary + image + link, app feed card with summary + thumbnail) with no
retyping. This means article frontmatter must include a short `summary` / `excerpt` field.

---

## Consent architecture

Scoped to users who have agreed to hear from us. For a health-adjacent app, consent must
be real and auditable — not a gitignored table.

### Where consent lives

- **Forms hosted on the marketing website** (`mentalhealthwallet.productsforgood.co`,
  static HTML/CSS/JS on Cloudflare Pages per `docs/deployment/marketing-website.md`):
  - a **subscribe** page (initial opt-in, choose scopes)
  - a **preferences / unsubscribe** page (linked from every email)
- **Authoritative consent record: our own store (Cloudflare Worker + D1).** For a mental
  health product we own the source of truth rather than locking it to a vendor. Resend is
  treated as a send tool we sync to, not the record of consent.
- **The app links out** to the same website preferences page rather than reimplementing
  consent UI, so there is one place users manage this.

### Privacy boundary: a SEPARATE worker + D1 (do not reuse analytics)

The existing `analytics-worker` is deliberately **anonymous** — no user IDs, no PII
(see `launch-plan.md`). Subscriber consent is the opposite: it stores email addresses.
Mixing PII into the anonymous analytics DB would break that clean separation.

**Recommendation:** a new `messaging-worker` with its own D1 database, following the same
migration/deploy conventions as `analytics-worker/` (see `migrations/*.sql`,
`wrangler.toml`). Keep analytics anonymous; keep PII isolated in the messaging store.

### Consent scopes (granular)

Opt-ins are per-scope, so a user can accept some and decline others:

- **Come-back reminders** (nudges to return)
- **Tips & newsletter** (educational/feature content)

Each subscriber record captures: email, per-scope opt-in flags, timestamps of each
change, and an unsubscribe token. One-tap unsubscribe in every email (legally required
and right for this audience).

### Sensitivity

Tips about feelings (anxiety, stress) are health-adjacent. Keep subject lines and any
push preview text discreet — mirror the existing `discreetNotifications` thinking in the
app. Never expose health-inferring content in a lock-screen preview.

---

## Content storage: repo-based markdown (decided)

- Each tip is a markdown file with frontmatter (title, feeling tags, feature highlighted,
  media refs, CTA, canonical URL, version).
- Versioned in git, doubles as the knowledge base source.
- A build step renders each markdown file into a **published web page** on
  `productsforgood.co`, each with a canonical URL.
- Best fit for a solo operator; no CMS overhead. Revisit a CMS only if non-technical
  authors need to publish.

## Website is the single content home (decided)

The website is the one place each article is rendered. Every surface points there:

- **Email** links to the article's web page.
- **In-app feed** links to the article's web page (see below).
- **Knowledge base** *is* these pages.

Benefits: one place to maintain, no duplicated rendering logic in the app, and content
updates ship via a website deploy with **no app release required**.

### In-app tips feed = thin index, not a content renderer

The app never renders article bodies. It renders a **searchable / sortable / filterable
list of article cards** (title, topic, type, optional thumbnail). Tapping one opens that
article's web page.

- **How the app gets the list (decided):** the build step emits article frontmatter as a
  small generated JSON index on the website (e.g.
  `productsforgood.co/content/index.json`). The app fetches it and does search/sort/filter
  locally. No backend endpoint needed at this scale. (A worker endpoint with server-side
  search is a later option only if the catalog grows large.)
- **Sorting/filtering/search all work client-side.** The index is an array of article
  metadata; once loaded, sort (date, title), filter (topic, type), and search (title,
  topics) are instant local array operations with no server round-trip. The index carries
  only the fields needed for this — the frontmatter we already author.

Example index entry:

```json
{
  "slug": "handling-anxiety",
  "title": "3 tools for anxiety",
  "summary": "A 60-second grounding sequence for when anxiety spikes.",
  "topics": ["anxiety"],
  "type": "problem-solving",
  "url": "https://productsforgood.co/articles/handling-anxiety",
  "thumbnail": "https://productsforgood.co/assets/anxiety.jpg",
  "publishedAt": "2026-09-04"
}
```
- **Opening an article:** use an **in-app browser** (`expo-web-browser`), not a kick-out
  to Safari/Chrome. Keeps the user in-app context with a clean back to the feed. Matches
  the existing external-link pattern used for 3rd-party app cards.
- **Connectivity caveat:** the feed and articles require a network connection. This is a
  deliberate difference from the rest of the app, which is local-first (SQLite). Fine for
  a tips/KB feature. The list can be cached after first load so it isn't blank offline;
  article bodies remain online-only.

This shrinks the in-app work: one screen that fetches a JSON index and renders a
filterable card list, plus in-app browser open on tap. No markdown rendering, no content
sync, no offline content store.

### Website index page + app feed: share data and design, render separately

The website also gets an **index page** (responsive) listing all articles. It and the app
feed should feel like the same product, but they are rendered in two different runtimes.

- **Shared (the real duplication to avoid):** the `index.json` data source, the article
  web pages themselves, and the visual design language.
- **Not shared:** the list-rendering code. The website index is a real responsive web
  page built at deploy time; the app feed is a **native** screen using the existing
  `@shopify/flash-list` stack.
- **Why not one "responsive page" embedded in the app (WebView):** a WebView feed feels
  non-native, loads slower, loses native scroll/search, and fights the app's navigation.
  The app already has fast native list infrastructure; rendering natively is *less* work
  than making a WebView feel right. (WebView remains a possible option if a single index
  codebase is ever a hard requirement — with those downsides accepted.)
- Article *bodies* (the expensive content) are never duplicated — they live once on the
  web and open in an in-app browser.

---

## Reuse — the payoff

The same content objects feed, in order of appearance:

1. **Email** reminders/tips (first)
2. **In-app tips feed** (same objects, rendered in-app)
3. **Knowledge base articles** (canonical URL per tip)
4. **Newsletter** (curated set of tips)
5. **In-app help** (contextual links to tips)

Author once, publish many places.

---

## Build size (honest estimate)

Modest — days, not weeks — because the hard infrastructure already exists (Worker + D1,
Cloudflare Pages site, validated content angles). Sequenced to deliver value (first email
out) well before the whole thing is "done."

| Piece | Size | Notes |
|---|---|---|
| Messaging worker + D1 (subscribers, endpoints) | Small (~1 day) | Follows existing analytics-worker groove |
| Consent forms on website | Small–Medium | Static HTML + `fetch()` to worker; drag-and-drop deploy |
| Content library (schema + first tips) | Small | Mostly authoring; half the angles already drafted |
| Resend sending (endpoint + templates + domain verify) | Small (~1–2 days) | React Email templates + DNS records |
| Website content rendering (markdown → article pages + index page + JSON index) | Small–Medium | Build step on the existing Pages site |
| In-app tips feed (thin index) | Small–Medium | Fetch JSON index, filterable card list, in-app browser open; deferrable |
| Remote push | Deferred | Not this phase |

Recurring cost ≈ $0 at warm-launch scale (Resend + Cloudflare free tiers).
The real ongoing investment is **writing good tips consistently** — that's what compounds
and what no build can shortcut.

---

## Phased rollout

**Phase A — Foundation**
- Define the tip content model (frontmatter schema).
- Stand up messaging worker + D1; migrate the mailing-list opt-ins currently tracked in
  `docs/warm-launch-messages.md` into it.
- Verify sending domain with Resend.

**Phase B — First content batch**
- Author 4–6 tips reusing validated angles from `warm-launch-messages.md`.
- Store as canonical content objects (Phase A schema).

**Phase C — Deliver**
- Build website subscribe + preferences pages against the worker.
- Send batch 1 by email to opt-ins; measure opens/clicks and tie into D7/D30 retention
  from `launch-plan.md`.

**Phase D — In-app feed**
- Build the thin in-app index: fetch the JSON index, render a filterable card list, open
  articles in an in-app browser.

**Phase E — Reuse**
- KB is already the published pages. Point newsletter and in-app help at the same pages.

**Deferred — Remote push**
- Revisit when install volume makes email-only reach insufficient.

---

## Resolved decisions

- **Email provider** — Resend (own the consent data, clean Worker integration).
- **Content storage** — repo-based markdown, rendered to web pages on the marketing site.
- **Website is the single content home** — email and the in-app feed both link to the
  same published pages.
- **In-app tips feed** — thin index (searchable/filterable card list) that fetches a
  generated JSON index and opens articles in an in-app browser. Not a content renderer.
- **Consent record ownership** — our own store (separate messaging Worker + D1), not the
  ESP; keeps PII out of the anonymous analytics DB.

## Remaining open items

1. **Migrate existing opt-ins** — port the mailing-list column from
   `warm-launch-messages.md` into the new store as the seed list.
2. **Where the in-app feed is reachable from** — a wallet menu entry, Settings, or a
   dedicated tab. (Minor; decide at Phase D.)
