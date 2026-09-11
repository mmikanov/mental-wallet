# Tasks

## Task 1: Build script scaffold + frontmatter parsing

- [x] Add `marked` as a dev dependency to `website/package.json` and a `build:content`
      script
- [x] Create `website/build-content.js`: read `content/tips/*.md`, parse frontmatter
      (validate title/summary/slug with a clear error on missing) + body
- [x] Verify: running the script lists the tips it found and errors clearly on a broken tip
- _Requirements: 1.1, 1.2, 1.4, 1.5_

## Task 2: Generate article pages

- [x] Render one `website/tips/<slug>.html` per tip: head/meta/OG, nav, title, optional
      hero, marked-rendered body, CTA button, footer, "back to all tips" link; reuse
      `styles.css`
- [x] Append `.article-page` / `.article-body` styles to `styles.css` using existing tokens
- [x] Verify (browser): a page renders title/body/CTA/hero correctly; markdown formatting
      shows; no raw injection
- _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

## Task 3: Generate index.json

- [x] Emit `website/content/index.json` with per-tip slug, title, summary, type, topics,
      heroImage, cta, url (`/tips/<slug>`), publishedAt; sorted by publishedAt desc then title
- [x] Verify: JSON is well-formed, sorted, complete
- _Requirements: 4.1, 4.2, 4.3_

## Task 4: Generate the index page

- [x] Render `website/tips/index.html`: baseline list (no-JS) + enhancer script that fetches
      `index.json` for search / type+topic filter / sort; reuse nav/footer/styles; accessible
      controls
- [x] Verify (browser): all tips listed; search, filter, and sort work
- _Requirements: 3.1, 3.2, 3.3, 3.4_

## Task 5: Idempotency, serving config, and orphan handling

- [x] Ensure re-running fully regenerates output and does not leave orphaned pages for
      removed tips
- [x] Add `build-content.js` to `.assetsignore`; confirm generated pages/JSON are served and
      tooling is not
- [x] Verify: re-run is clean; removing a tip removes its page on rebuild
- _Requirements: 1.3, 5.3_

## Task 6: Document and final local verification

- [x] Update `docs/deployment/marketing-website.md`: `npm run build:content`, outputs,
      `/tips` + `/tips/<slug>` URLs, run-before-deploy note
- [x] Full local pass: build, open index + a couple of article pages in a browser, confirm
      everything renders and interacts; no DB/worker involved
- _Requirements: 5.1, 5.2_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5", "6"] }
  ]
}
```
