/**
 * Tip — a single entry from the website's published tips index
 * (https://mentalhealthwallet.productsforgood.co/content/index.json).
 *
 * The app renders a list of these (the feed) but never renders tip bodies;
 * the full article lives on the website and opens in an in-app browser.
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
  url: string; // site-relative article path, e.g. "/tips/welcome"
  publishedAt: string; // ISO date
}
