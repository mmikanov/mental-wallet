/**
 * tipsService — fetches the published tips index from the marketing site and
 * caches it locally so the in-app feed still works offline after a first load.
 *
 * The app renders the list only; full articles open on the website (in-app browser).
 * No PII, no auth — a public JSON GET.
 */

import { File, Paths } from 'expo-file-system';
import { TIPS_INDEX_URL, SITE_ORIGIN } from '@/config/appInfo';
import type { Tip, TipType } from '@/types/tips';

const CACHE_FILENAME = 'tips-index.json';
const TIP_TYPES: TipType[] = ['feature', 'problem_solving', 'come_back'];

/** Max time to wait on the network before falling back to cache / error. */
const FETCH_TIMEOUT_MS = 10000;

function cacheFile(): File {
  return new File(Paths.cache, CACHE_FILENAME);
}

/** Validate + normalize one raw index entry into a Tip (or null if malformed). */
function parseTip(raw: unknown): Tip | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const slug = typeof r.slug === 'string' ? r.slug : '';
  const title = typeof r.title === 'string' ? r.title : '';
  const summary = typeof r.summary === 'string' ? r.summary : '';
  const url = typeof r.url === 'string' ? r.url : '';
  if (!slug || !title || !url) return null;

  const type: TipType = TIP_TYPES.includes(r.type as TipType) ? (r.type as TipType) : 'feature';
  const topics = Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === 'string') : [];
  const heroImage = typeof r.heroImage === 'string' ? r.heroImage : '';
  const publishedAt = typeof r.publishedAt === 'string' ? r.publishedAt : '';

  let cta: Tip['cta'] = null;
  if (r.cta && typeof r.cta === 'object') {
    const c = r.cta as Record<string, unknown>;
    if (typeof c.label === 'string' && typeof c.url === 'string') {
      cta = { label: c.label, url: c.url };
    }
  }

  return { slug, title, summary, type, topics, heroImage, cta, url, publishedAt };
}

function parseIndex(text: string): Tip[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Tips index is not an array');
  return data.map(parseTip).filter((t): t is Tip => t !== null);
}

/** Write the raw JSON to the cache file (best-effort; never throws). */
function writeCache(text: string): void {
  try {
    const file = cacheFile();
    if (file.exists) file.delete();
    file.create();
    file.write(text);
  } catch {
    // Caching is best-effort; a failure here must not break the feed.
  }
}

/** Read + parse the cached index, or null if absent/unreadable. */
async function readCache(): Promise<Tip[] | null> {
  try {
    const file = cacheFile();
    if (!file.exists) return null;
    const text = await file.text();
    return parseIndex(text);
  } catch {
    return null;
  }
}

/**
 * Get the tips. Tries the network first (and refreshes the cache); on failure
 * falls back to the cached copy. Throws only if the network fails AND there is
 * no cache to fall back to.
 */
export async function getTips(): Promise<{ tips: Tip[]; fromCache: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let text: string;
    try {
      const res = await fetch(TIPS_INDEX_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } finally {
      clearTimeout(timeout);
    }
    const tips = parseIndex(text);
    writeCache(text);
    return { tips, fromCache: false };
  } catch (err) {
    const cached = await readCache();
    if (cached) return { tips: cached, fromCache: true };
    throw err instanceof Error ? err : new Error('Failed to load tips');
  }
}

/**
 * Resolve a tip's site-relative article path to an absolute URL, tagged for in-app
 * viewing. The `embed=app` param tells the website to hide its web-only chrome (nav,
 * footer, "All tips" link, download CTA) so the in-app browser shows just the article —
 * the reader is already inside the app. Harmless if the site ignores it (degrades to the
 * normal page).
 */
export function resolveTipUrl(tip: Tip): string {
  const raw = /^https?:\/\//i.test(tip.url)
    ? tip.url
    : `${SITE_ORIGIN}${tip.url.startsWith('/') ? tip.url : `/${tip.url}`}`;
  const separator = raw.includes('?') ? '&' : '?';
  return `${raw}${separator}embed=app`;
}
