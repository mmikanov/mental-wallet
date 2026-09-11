# Requirements Document

## Introduction

Phase C, part 2 (C2) of the messaging & content plan (`docs/messaging-and-content-plan.md`):
render the authored tips (`content/tips/*.md`) into published web content on the marketing
site. This is the "website is the single content home" piece, everything else (email, the
future in-app feed, the knowledge base) points at these pages.

C2 introduces a lightweight **build step** the static site does not currently have: a Node
script reads the tip markdown + frontmatter and generates (a) one HTML article page per
tip, (b) a responsive index page listing all tips with search/sort/filter, and (c) a
generated `index.json` the in-app feed will later consume. Output is plain static files
committed/deployed with the existing `wrangler deploy`, no framework, no runtime rendering.

C2 touches **no database** and is fully verifiable locally in a browser, which is why it's
being built now while D1 is capped.

In scope: the build script, generated article pages, the index page, `index.json`, and
reusing the site's styling. Out of scope: batch sending (C3), the in-app feed itself
(Phase D), and any worker/D1 change.

## Requirements

### Requirement 1: Build step (markdown to static output)

**User Story:** As the operator, I want a repeatable build that turns tip markdown into web
pages, so that authoring stays in markdown and the site stays static.

#### Acceptance Criteria

1. THE build SHALL read every tip in `content/tips/*.md`, parse its frontmatter and
   markdown body, and generate static output into the `website/` tree.
2. THE build SHALL be runnable with a single command (e.g. `npm run build:content`).
3. THE build SHALL be deterministic and safe to re-run (regenerating overwrites prior
   output; it does not require manual cleanup).
4. THE build SHALL fail with a clear message if a tip is missing required frontmatter
   (title, summary, slug).
5. THE build SHALL NOT require any network or database access.

### Requirement 2: Article pages

**User Story:** As a reader arriving from an email or the app, I want a clean web page for a
tip, so that I can read the full content.

#### Acceptance Criteria

1. THE build SHALL generate one HTML page per tip at a stable, canonical URL derived from
   the slug (e.g. `/tips/<slug>`).
2. EACH page SHALL render the title, hero image (when set), the full markdown body, and the
   CTA (label linking to its url).
3. EACH page SHALL reuse the site's nav, footer, and `styles.css`, and follow its
   accessibility conventions (skip link, semantic headings, labelled/alt content).
4. EACH page SHALL include appropriate title and meta/Open Graph tags derived from the
   tip's title and summary.
5. Markdown in the body (paragraphs, bold, links, lists) SHALL render as HTML safely
   (no raw injection).

### Requirement 3: Index page

**User Story:** As a visitor, I want a browsable list of all tips that I can search and
filter, so that I can find something relevant.

#### Acceptance Criteria

1. THE build SHALL generate an index page listing all tips (title, summary, type, topics),
   each linking to its article page.
2. THE index SHALL support client-side search (title/summary/topics), and filtering by
   type and/or topic, and sorting (at least by date and title).
3. THE index SHALL be responsive and reuse the site's styling and accessibility
   conventions.
4. THE index's interactivity SHALL be driven by the generated `index.json` (see R4), so the
   same data source powers the web index and the future in-app feed.

### Requirement 4: Generated index.json

**User Story:** As the future in-app feed (Phase D), I need a machine-readable index of
tips, so that the app can render a list without a build step or DB.

#### Acceptance Criteria

1. THE build SHALL emit a JSON index (e.g. `/content/index.json`) containing, per tip:
   slug, title, summary, type, topics, heroImage, cta, url (canonical article URL),
   publishedAt.
2. THE JSON SHALL be sorted deterministically (e.g. by publishedAt desc then title).
3. THE JSON SHALL be the single data source consumed by both the web index page (R3) and
   the future in-app feed.

### Requirement 5: Local verification and documentation

**User Story:** As the operator, I want to preview the output locally and know how to
rebuild, so that I can trust it before deploying.

#### Acceptance Criteria

1. THE generated pages, index, and JSON SHALL be viewable locally in a browser with no DB
   or worker running.
2. THE build tooling and its output locations SHALL be documented (how to run, what it
   generates, where, and that it must be run before deploying content changes).
3. Generated files SHALL be handled sensibly with respect to source control and the site's
   asset-serving config (`.assetsignore`), so tooling files are not served and generated
   pages are.

## Open Questions (design)

- Whether generated article pages are committed to the repo or generated at deploy time
  only. Leaning toward committing them (simple, inspectable, matches the "static files"
  model) with the build re-run before deploy.
- Which minimal markdown library to use for body rendering (small, well-maintained), vs a
  hand-rolled subset. Leaning toward a small, established lib.
- Exact URL shape for article pages (`/tips/<slug>` via a `tips/` folder of HTML files) and
  how it interacts with Cloudflare's extensionless-URL behavior.
