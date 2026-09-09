# Requirements Document

## Introduction

Today a tip email can show exactly one image, in one fixed place: the `heroImage`, rendered
immediately after the greeting and before the title. Two limitations in the messaging worker
(`messaging-worker/src/index.ts`) cause this:

1. The email template hardcodes the order `greeting → heroImage → title → summary → body → cta`,
   so media can only appear at the top.
2. The tip **body is rendered as escaped plain text** (`<p>${escapeHtml(tip.body)}</p>`), not
   parsed markdown/HTML. So authors cannot place an image (or any formatting) *within* the
   body — inline HTML in the markdown would appear as literal escaped text in the email.

Meanwhile the **website** already renders the same markdown body through `marked`
(`website/build-content.js`), so on the web an author *can* embed media mid-content (e.g. an
inline `<figure>`), and the media plan (`content/tips/MEDIA-PLAN.md`) anticipates
mid-content placement. This spec closes the gap so a single authored tip can place media
where it belongs and have it render correctly in **both** the website article and the email.

This is a **requirements-only** spec for future work. The current behavior (single top hero,
plain-text body in email) stays as-is until this is implemented.

### Key constraint to preserve (email reality)

Email clients do not run CSS animations, JavaScript, or (reliably) `<video>`. Motion in email
is only achievable via **animated GIF** (autoplays broadly; Outlook desktop shows the first
frame). So "media anywhere in the email" means **images/GIFs anywhere**, never CSS animation.
The website article remains the surface for full CSS animation.

### Out of scope

- Changing the website rendering (it already parses markdown and supports inline media).
- Producing the media assets themselves (covered by `content/tips/MEDIA-PLAN.md`).
- In-app feed media placement (the feed shows a single lead image by design).
- Video-in-email or interactive/AMP email.

## Requirements

### Requirement 1: Author media placement once, render in both surfaces

**User Story:** As a tip author, I want to place an image/GIF at a chosen point in a tip's
content, so that it appears in the right place in both the website article and the email
without maintaining two versions.

#### Acceptance Criteria

1. THE system SHALL let an author position media within a tip's content (not only at the top),
   from the single authored source in `content/tips/<slug>.md`.
2. THE website article and the tip email SHALL derive media placement from that same source,
   so authoring once yields consistent placement across both surfaces.
3. WHEN a tip specifies no in-body media, THE email SHALL behave exactly as today (optional top
   `heroImage`, then title/summary/body/cta), preserving backward compatibility for existing
   tips.
4. THE approach SHALL keep the "author once, render many" model already used for tips (email,
   website, and the in-app feed index).

### Requirement 2: Email renders body content richly (not escaped plain text)

**User Story:** As a subscriber, I want tip emails to show formatted content and inline images
where the author placed them, so the email reads like the article, not a wall of plain text.

#### Acceptance Criteria

1. THE email SHALL render the tip body as formatted HTML (paragraphs, links, emphasis, lists,
   and inline images), rather than as a single escaped plain-text block.
2. THE email SHALL support at least one inline image/GIF placed within the body flow, in
   addition to (or instead of) the top `heroImage`.
3. WHEN the body contains an image reference, THE email SHALL render it as a standard `<img>`
   with responsive sizing consistent with the current hero styling (e.g. `max-width:100%`,
   rounded corners) and required `alt` text.
4. THE plain-text email alternative (the `text` part) SHALL remain sensible when the body
   contains media (e.g. media is omitted or represented by its alt text), so text-only clients
   are unaffected.

### Requirement 3: Safe, email-robust HTML

**User Story:** As the operator, I want author-provided content rendered safely and reliably
across email clients, so a tip can't inject unsafe markup or break in Outlook/Gmail.

#### Acceptance Criteria

1. THE email renderer SHALL sanitize body HTML to an allowlist suitable for email (e.g.
   `p, a, strong, em, ul, ol, li, br, img, figure, figcaption, h2, h3`) and SHALL strip
   `script`, `style`, event handlers, and other disallowed/unsafe elements and attributes.
2. THE renderer SHALL NOT emit CSS animations, JavaScript, or `<video>` in email (they do not
   work); motion SHALL be limited to animated GIFs.
3. Inline styles SHALL be used for any styling (email clients ignore `<style>`/external CSS),
   and layout SHALL degrade gracefully where a client shows only a GIF's first frame
   (Outlook desktop).
4. THE image `src` for any email media SHALL be an absolute HTTPS URL (email cannot load
   relative or local paths), and the renderer SHALL validate/require this.

### Requirement 4: Consistency with the website and no regressions

**User Story:** As the operator, I want this change to fit the existing pipeline without
breaking current sends or the website build.

#### Acceptance Criteria

1. THE change SHALL be confined to the tip email rendering path in the messaging worker and any
   shared parsing/rendering helper; it SHALL NOT alter the website's existing article output
   for tips that don't use inline media.
2. Existing tips (with an empty or top-only `heroImage` and plain bodies) SHALL render
   equivalently to today after the change (no visible regression).
3. THE messaging worker change SHALL be deployable via the existing worker deploy process, and
   SHALL be covered by at least a rendering unit test (body-with-image → expected sanitized
   HTML; body-without-image → unchanged behavior).
4. THE media plan (`content/tips/MEDIA-PLAN.md`) and the tips authoring README
   (`content/tips/README.md`) SHALL be updated to document how to place inline media once this
   ships.

## Notes / Implementation anchors (for the future design phase)

- Email template + plain-text body: `messaging-worker/src/index.ts` (the tip email builder —
  `heroHtml`, `bodyHtml = <p>${escapeHtml(tip.body)}</p>`, and the `text` alternative).
- Website already parses the body with `marked`: `website/build-content.js` (`renderArticle`).
  A shared/mirrored markdown→sanitized-HTML step is the natural convergence point.
- Frontmatter schema + authoring rules: `content/tips/README.md`.
- Media strategy per tip (what asset, GIF specs, first-frame fallback): `content/tips/MEDIA-PLAN.md`.
- GIF production tooling: `website/tools/capture-tip-gif.js`.
