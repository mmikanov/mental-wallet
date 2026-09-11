# Design Document

## Overview

A Node build script (`website/build-content.js`) reads `content/tips/*.md`, parses
frontmatter + markdown, and generates static output into `website/`:

- `website/tips/<slug>.html` — one article page per tip.
- `website/tips/index.html` — the responsive, searchable index page.
- `website/content/index.json` — machine-readable index (web index + future in-app feed).

Output is committed static files, deployed by the existing `wrangler deploy`. No framework,
no runtime rendering, no DB. Fully previewable locally in a browser.

## Tooling

- Runs under Node via the website's `package.json` as `npm run build:content`.
- Markdown: use a small, established library (**`marked`**) for body rendering, plus a
  tiny inline frontmatter parser (same simple, flat schema the `send-tip.ts` script already
  parses; reuse that approach rather than adding a YAML dep).
- HTML is assembled with template strings, matching the existing hand-written pages
  (`subscribe.html` etc.): same `<head>` conventions, nav, footer, `styles.css`.
- All dynamic values inserted into HTML are escaped; only the marked-rendered body is
  treated as HTML (marked output from our own authored content).

## Output structure & URLs

```
website/
├── tips/
│   ├── index.html            # /tips  (index page)
│   ├── welcome.html          # /tips/welcome
│   ├── emotion-based-session.html
│   └── ... (one per tip)
└── content/
    └── index.json            # /content/index.json
```

Cloudflare serves extensionless URLs (as seen with the consent pages), so the canonical
article URL is `/tips/<slug>` and the index is `/tips`. The `url` field in `index.json` is
the canonical `/tips/<slug>`. The tips' `cta.url` is currently the App Store URL (interim,
see "App CTA" below); the article page's rendered CTA is platform-aware via `app-cta.js`.

## Article page rendering

Per tip, generate an HTML doc that:

- `<head>`: title = tip title + " — Mental Health Wallet"; meta description = summary;
  Open Graph title/description/url (canonical `/tips/<slug>`); favicon + `styles.css`.
- Body: site nav; a `main.article-page` containing the title (`<h1>`), optional hero
  `<img>`, the marked-rendered markdown body, an **app CTA** (see below), and the site
  footer.
- A small "back to all tips" link to `/tips`.

New CSS: a lightweight `.article-page` / `.article-body` block appended to `styles.css`
(reusing existing tokens), for readable body typography and the hero image.

### App CTA (interim — platform-aware store link)

The CTA is a single `.btn-primary` button labelled with the tip's `cta.label` (its intent,
e.g. "Start from how I feel"). Because the app does not yet have working deep links (the
`mentalwallet://` scheme is unregistered — see `app-deep-linking` spec), the button:

- defaults its `href` to the site's download section (`/#hero`, both store badges), and
- is rewritten at runtime by **`website/app-cta.js`** to the correct store based on the
  visitor's platform: iOS → App Store, Android → Play Store, desktop/unknown → left at the
  both-stores default (never guesses wrong).

If the app is installed, the store listing shows "Open". The button label states the action
("open"), avoiding the "download" mismatch of raw store badges. `app-cta.js` is loaded only
on article pages (the index page has no CTA). The `cta.url` in tip frontmatter and
`index.json` is the App Store URL as an honest interim value.

**Reverts once real deep links ship** (`app-deep-linking` Req 5): the button becomes a
single real deep link, and the store link becomes the not-installed fallback.

## Index page rendering

- Server-side (at build time) render the list markup for no-JS baseline, AND include a
  small inline script that fetches `/content/index.json` to power search/sort/filter.
  (Baseline list ensures the page is useful even before JS; JS enhances it.)
- Controls: a search box, a `type` filter (all / feature / problem_solving / come_back),
  a topic filter (derived from the union of topics), and a sort control (newest, title).
- Each list item: title (link to `/tips/<slug>`), type + topics badges, summary.
- Reuses site nav/footer/styles; responsive via existing tokens; accessible controls
  (labelled inputs, list semantics).

## index.json shape

```json
[
  {
    "slug": "welcome",
    "title": "Welcome to Mental Health Wallet",
    "summary": "...",
    "type": "feature",
    "topics": ["welcome", "getting-started"],
    "heroImage": "",
    "cta": { "label": "Open the app and tap a card", "url": "https://apps.apple.com/app/mental-health-wallet/id6800036822" },
    "url": "/tips/welcome",
    "publishedAt": "2026-09-05"
  }
]
```

Sorted by `publishedAt` desc, then `title`. This is the single source for the web index
page's interactivity and the future in-app feed.

## Build flow

1. Read `content/tips/*.md`.
2. For each: parse frontmatter (validate title/summary/slug; clear error if missing),
   render body with marked.
3. Write `website/tips/<slug>.html`.
4. Build the `index.json` array (sorted) → write `website/content/index.json`.
5. Render `website/tips/index.html` (baseline list + enhancer script).
6. Print a summary (N tips built).

Re-running fully regenerates these outputs (idempotent). A tip removed from `content/tips/`
should not leave a stale page: the build cleans the generated `website/tips/*.html` (except
a hand-authored index if any) before writing, or writes a manifest, to avoid orphans.

## Source control & serving

- Generated files (`website/tips/*.html`, `website/content/index.json`) ARE committed, so
  the deployable site is always inspectable and `wrangler deploy` needs no build on the
  deploy host. The build is re-run locally before deploying content changes.
- `.assetsignore` already excludes tooling (`node_modules`, `package.json`, etc.); the new
  `build-content.js` and any dev deps must be excluded from served assets too. Add
  `build-content.js` to `.assetsignore`.
- `website/app-cta.js` (the platform-aware CTA rewriter) IS a served asset (like
  `messaging.js`), loaded by article pages; it is not in `.assetsignore`.

## Testing strategy

- Run `npm run build:content`; confirm it generates one page per tip, the index page, and
  `index.json`, and prints the count.
- Open `website/tips/<slug>.html` and `website/tips/index.html` directly in a browser
  (file:// or a simple static serve) — no DB/worker. Verify: article renders title/body/
  CTA/hero; index lists all tips; search/filter/sort work against `index.json`.
- Validate `index.json` is well-formed and sorted, with all required fields.
- Missing-frontmatter case: temporarily break a tip, confirm the build fails with a clear
  message; restore.
- Confirm no changes to existing pages, the worker, or D1.

## Documentation

- Update `docs/deployment/marketing-website.md`: document `npm run build:content`, what it
  generates and where, and that it must be run before deploying tip/content changes.
- Note the `/tips` index and `/tips/<slug>` article URLs.
