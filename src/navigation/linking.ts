/**
 * Deep link configuration.
 *
 * Handles:
 * - Reminder notification taps (`card_reminder`) → Wallet with the card focused + expanded.
 * - Tip CTA deep links (custom scheme `mentalwallet://` and, once associated, Universal/App
 *   Links under `https://mentalhealthwallet.productsforgood.co/app/...`).
 *
 * Routes (both `mentalwallet://<path>` and `.../app/<path>`):
 * - `wallet` (optionally `?focusCardId=<id>`) → Wallet (focus + expand a card)
 * - `how-i-feel` → Wallet, focus + expand the "Start from how I feel" session card
 * - `checkin` → Wallet, focus + expand the seedling KPI daily check-in card
 * - `learn-more-tour` → Wallet, focus + expand the top (non-session) stack card
 * - `add-tool` (optionally `?filter=apps`) → Library browser
 * - `archive`, `settings`
 *
 * Validates: 1.0.4-deep-linking Requirements 1–4.
 */

import type { LinkingOptions } from '@react-navigation/native';
import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import type { getStateFromPath } from '@react-navigation/native';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from './types';

const CUSTOM_SCHEME_PREFIX = 'mentalwallet://';
const UNIVERSAL_LINK_PREFIX = 'https://mentalhealthwallet.productsforgood.co/app';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [CUSTOM_SCHEME_PREFIX, UNIVERSAL_LINK_PREFIX],
  config: {
    screens: {
      MainTabs: {
        screens: {
          // Wallet base path. The deep-link "verbs" (how-i-feel, checkin,
          // learn-more-tour) are translated to Wallet params in getStateFromPath
          // below, since React Navigation can't set a static param from a bare path.
          Wallet: 'wallet',
        },
      },
      LibraryBrowser: 'add-tool',
      Archive: 'archive',
      Settings: 'settings',
    },
  },
  /**
   * Translate the app "verb" paths to Wallet params. A path like `how-i-feel`
   * resolves to the Wallet screen with `{ openHowIFeel: true }`, so the wallet's
   * consumer effects can focus + expand the right card. Falls back to the default
   * path parsing for everything else (wallet?focusCardId=, add-tool?filter=, etc.).
   */
  getStateFromPath(path, options) {
    // Strip a leading `/app` (Universal Link) or leading slash so both prefixes
    // yield the same bare path + query.
    const withoutApp = path.replace(/^\/app(\/|$)/, '/');
    const [rawPath, query] = withoutApp.replace(/^\//, '').split('?');

    const walletParam = (extra: Record<string, string | boolean>) => {
      const search = query ? `?${query}` : '';
      // Re-parse the base wallet path so any query (focusCardId) is preserved, then
      // merge the verb-derived param.
      const base = defaultGetStateFromPath(`wallet${search}`, options);
      if (!base) return base;
      // Inject the extra param into the deepest (Wallet) route.
      injectLeafParams(base, extra);
      return base;
    };

    switch (rawPath) {
      case 'how-i-feel':
        return walletParam({ openHowIFeel: true });
      case 'checkin':
        return walletParam({ openKpiCheckin: true });
      case 'learn-more-tour':
        return walletParam({ openTopCard: true });
      case 'add-tool': {
        // Map the friendly `?filter=apps` query to the LibraryBrowser
        // `initialFilter` param (React Navigation matches query keys to param
        // names, so we rename it explicitly here).
        const base = defaultGetStateFromPath('add-tool', options);
        if (base) {
          const filter = new URLSearchParams(query ?? '').get('filter');
          if (filter) injectLeafParams(base, { initialFilter: filter });
        }
        return base;
      }
      default:
        return defaultGetStateFromPath(withoutApp, options);
    }
  },
  /**
   * Cold-start deep link. Two sources, in priority order:
   * 1. A tapped `card_reminder` notification → Wallet with the card focused + expanded.
   * 2. The OS launch URL (a `mentalwallet://` or Universal-Link tap) — React Navigation
   *    parses it through the config + getStateFromPath above.
   *
   * We MUST fall through to Linking.getInitialURL(); returning null on a real URL
   * launch would drop the deep link and land on the default Wallet route.
   */
  async getInitialURL() {
    const response = await Notifications.getLastNotificationResponseAsync();
    const data = response?.notification.request.content.data;
    if (data?.type === 'card_reminder' && data?.cardId) {
      return `${CUSTOM_SCHEME_PREFIX}wallet?focusCardId=${data.cardId}`;
    }

    // Fall back to the actual URL the app was launched with (scheme or https).
    const url = await Linking.getInitialURL();
    return url ?? null;
  },
  /**
   * Running-app deep links. Listen to BOTH sources while the app is alive:
   * notification taps (card_reminder) and OS URL events (scheme / Universal Link).
   */
  subscribe(listener) {
    const notificationSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'card_reminder' && data?.cardId) {
          listener(`${CUSTOM_SCHEME_PREFIX}wallet?focusCardId=${data.cardId}`);
        }
      }
    );

    // Forward real URL opens (e.g. mentalwallet://how-i-feel) to the navigator.
    const urlSub = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });

    return () => {
      notificationSub.remove();
      urlSub.remove();
    };
  },
};

// The state shape returned by getStateFromPath (non-undefined).
type ParsedState = NonNullable<ReturnType<typeof getStateFromPath>>;

/**
 * Recursively find the innermost navigation route (the leaf screen, e.g. Wallet
 * or LibraryBrowser) in the parsed state and merge the given params into it.
 */
function injectLeafParams(
  state: ParsedState,
  extra: Record<string, string | boolean>
): void {
  const route = state.routes[state.routes.length - 1] as {
    name: string;
    state?: ParsedState;
    params?: Record<string, unknown>;
  };
  if (!route) return;
  if (route.state) {
    injectLeafParams(route.state, extra);
  } else {
    route.params = { ...(route.params ?? {}), ...extra };
  }
}
