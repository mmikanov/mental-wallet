/**
 * Tip — a single entry from the website's published tips index
 * (https://mentalhealthwallet.productsforgood.co/content/index.json).
 *
 * The app renders a list of these (the feed) and, since 1.0.6 (Bug 1 — tip consistency),
 * renders the tip's full `body` natively in TipDetailScreen (via react-native-markdown-display)
 * with a native CTA, so the in-app tip matches the website article and the drip email.
 *
 * Mirrors the generated index.json shape (see content/tips + the website build).
 */

export type TipType = 'feature' | 'problem_solving' | 'come_back';

export interface TipCta {
  label: string;
  url: string;
}

export interface Tip {
  slug: string;
  title: string;
  summary: string;
  type: TipType;
  topics: string[];
  heroImage: string; // may be "" when the tip has no hero
  cta: TipCta | null;
  /**
   * Full raw-markdown body of the tip (Bug 1 — tip consistency). Optional: older/short tips
   * may have no body. Rendered natively in TipDetailScreen. Embedded raw-HTML figure blocks
   * (`<figure class="tip-media">`) are NOT rendered natively — the top hero carries that media
   * (the documented per-surface exception, Req 1.6).
   */
  body?: string;
  url: string; // site-relative article path, e.g. "/tips/welcome"
  publishedAt: string; // ISO date
}
