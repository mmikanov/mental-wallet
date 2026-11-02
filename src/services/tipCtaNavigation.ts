/**
 * tipCtaToNavigation — the in-app counterpart to linking.ts's getStateFromPath.
 *
 * A tip's `cta.url` is a Universal Link like
 * `https://mentalhealthwallet.productsforgood.co/app/create-tool` (or the custom-scheme form
 * `mentalwallet://create-tool`). When the reader is ALREADY inside the app (Bug 1: the tip is
 * now rendered natively in TipDetailScreen), we must turn that URL into an in-app
 * `navigation.navigate(...)` call — NOT feed it to `Linking.openURL`, which could bounce back
 * out to the /app/* not-installed fallback web page (the same dead-end class as Bug 2).
 *
 * This is a pure, side-effect-free mapper. It mirrors linking.ts's route resolution exactly:
 * - `create-tool`                 → { screen: 'CardCreator' }          (Bug 2's route)
 * - `add-tool` (+ `?filter=apps`) → { screen: 'LibraryBrowser', params: { initialFilter } }
 * - `wallet`                      → MainTabs/Wallet
 * - `how-i-feel`                  → MainTabs/Wallet { openHowIFeel: true }
 * - `checkin`                     → MainTabs/Wallet { openKpiCheckin: true }
 * - `learn-more-tour`             → MainTabs/Wallet { openTopCard: true }
 *
 * Anything external or unmapped returns `null`, and the caller falls back to
 * `Linking.openURL` (rare; keeps a sane default). Keep this in sync with linking.ts.
 */

import type { RootStackParamList } from '@/navigation/types';

export interface TipCtaNavigation {
  screen: keyof RootStackParamList;
  params?: object;
}

const CUSTOM_SCHEME_PREFIX = 'mentalwallet://';
const UNIVERSAL_LINK_PREFIX = 'https://mentalhealthwallet.productsforgood.co/app';

/**
 * Normalize a CTA URL to its bare `route` + query string, mirroring linking.ts:
 * strip the `mentalwallet://` scheme or the `.../app` Universal-Link prefix (and a leading
 * slash), then normalize a trailing slash (Android often appends one). Returns null when the
 * URL is not one of the app's own deep-link forms.
 */
function normalizeToRoute(url: string): { route: string; query: string } | null {
  if (!url) return null;
  let rest: string;
  if (url.startsWith(CUSTOM_SCHEME_PREFIX)) {
    rest = url.slice(CUSTOM_SCHEME_PREFIX.length);
  } else if (url.startsWith(UNIVERSAL_LINK_PREFIX)) {
    // `.../app/<route>` and `.../app` → strip the prefix; drop a leading slash.
    rest = url.slice(UNIVERSAL_LINK_PREFIX.length).replace(/^\//, '');
  } else {
    return null;
  }

  const [rawPath, query = ''] = rest.split('?');
  const route = rawPath.replace(/\/$/, ''); // normalize trailing slash
  return { route, query };
}

/**
 * Map a tip CTA URL to an in-app navigation destination, or null if it is external/unmapped.
 */
export function tipCtaToNavigation(url: string): TipCtaNavigation | null {
  const normalized = normalizeToRoute(url);
  if (!normalized) return null;
  const { route, query } = normalized;

  switch (route) {
    case 'create-tool':
      return { screen: 'CardCreator' };
    case 'add-tool': {
      const filter = new URLSearchParams(query).get('filter');
      return filter
        ? { screen: 'LibraryBrowser', params: { initialFilter: filter } }
        : { screen: 'LibraryBrowser' };
    }
    case 'wallet':
      return { screen: 'MainTabs', params: { screen: 'Wallet' } };
    case 'how-i-feel':
      return {
        screen: 'MainTabs',
        params: { screen: 'Wallet', params: { openHowIFeel: true } },
      };
    case 'checkin':
      return {
        screen: 'MainTabs',
        params: { screen: 'Wallet', params: { openKpiCheckin: true } },
      };
    case 'learn-more-tour':
      return {
        screen: 'MainTabs',
        params: { screen: 'Wallet', params: { openTopCard: true } },
      };
    default:
      return null;
  }
}
