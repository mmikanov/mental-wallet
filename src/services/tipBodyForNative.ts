/**
 * tipBodyForNative — prepare a tip's markdown body for NATIVE rendering (Bug 1 follow-up, 1.0.6).
 *
 * Tip bodies are authored as markdown but embed raw HTML media blocks for the website —
 * `<figure class="tip-media">…</figure>`, `<figure class="come-back-anim">…</figure>`,
 * `<img>`, `<figcaption>`, `<div>`/`<span>` animation scaffolding, `<video>`. A browser renders
 * those; the native markdown renderer (`react-native-markdown-display`) does NOT — it passes
 * unknown raw HTML through as LITERAL TEXT, so those blocks show up as visible angle-bracket
 * code in the app (the bug reported on the 1.0.6 TestFlight/Internal build).
 *
 * Per the design's deliberate per-surface exception (Req 1.6), the native tip view shows prose
 * only and the top hero image carries the media. So before handing the body to the markdown
 * renderer we STRIP the embedded HTML: whole block elements (figure/div/video and their
 * contents) are removed, and any stray inline HTML tags are dropped while keeping their text.
 *
 * Pure and unit-tested (no RN imports) so the stripping logic is provable in isolation.
 */

/**
 * Block-level HTML elements whose ENTIRE subtree (open tag → close tag, inclusive) should be
 * removed from a native tip body. These are the media/animation wrappers; their content is not
 * prose and has no native rendering.
 */
const BLOCK_ELEMENTS = ['figure', 'div', 'video', 'picture', 'svg', 'iframe'];

/**
 * Remove embedded raw HTML from a tip's markdown body so only renderable markdown prose remains.
 *
 * - Removes each block element in BLOCK_ELEMENTS together with everything between its opening and
 *   closing tag (e.g. a whole `<figure>…</figure>`), including nested children.
 * - Removes any self-closing / void HTML tags left over (e.g. a bare `<img ... />`, `<br>`).
 * - Strips any remaining stray inline HTML tags (e.g. `<span>`, `<figcaption>`, `<a href>`) but
 *   KEEPS their inner text, so a stray inline tag never deletes prose.
 * - Collapses the blank-line gaps the removals leave behind so paragraph spacing stays clean.
 *
 * Markdown links/emphasis/headings/lists are untouched (they are markdown, not HTML tags).
 */
export function stripHtmlBlocks(body: string): string {
  if (!body) return '';

  let out = body;

  // 1) Remove whole block elements and their contents. Non-greedy, dot-matches-newline via [\s\S].
  //    Handles multiple occurrences and is case-insensitive. Nested same-name blocks are rare in
  //    these bodies (figures aren't nested), so a non-greedy pass per element is sufficient.
  for (const tag of BLOCK_ELEMENTS) {
    const blockRe = new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi');
    out = out.replace(blockRe, '');
  }

  // 2) Remove self-closing / void tags that may sit outside a block wrapper (img, br, hr, source).
  out = out.replace(/<(?:img|br|hr|source|input|meta|link)\b[^>]*\/?>/gi, '');

  // 3) Strip any remaining stray inline HTML tags (open or close) but keep their inner text.
  //    This catches leftover <figcaption>, <span>, <a ...>, </a>, etc. We only match things that
  //    look like real tags: '<', optional '/', an ASCII letter, then tag-ish chars up to '>'.
  out = out.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?>/g, '');

  // 4) Tidy whitespace left by removals: collapse 3+ newlines to a paragraph break, trim edges,
  //    and drop lines that are now empty-but-for-spaces.
  out = out
    .replace(/[ \t]+\n/g, '\n')      // trailing spaces on a line
    .replace(/\n{3,}/g, '\n\n')       // 3+ blank lines → one blank line
    .trim();

  return out;
}
