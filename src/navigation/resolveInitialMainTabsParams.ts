import type { RootStackParamList } from './types';

/**
 * Decide the initial MainTabs params on cold start.
 *
 * When the effective start mode is 'emotion' we normally highlight the session
 * card (Req 2.2) via `{ screen: 'Wallet', params: { highlightSessionCard: true } }`.
 * BUT when the app was cold-launched from a deep link, React Navigation has
 * already built the nav state from the link (e.g. `openKpiCheckin`). Setting
 * these emotion-highlight initialParams would clobber that deep-link param, so
 * the specific card never opens (only the wallet). In that case we return
 * `undefined` and let the deep-link state win.
 *
 * This lives in its own module (rather than inline in RootNavigator) so it can
 * be unit-tested without importing the whole navigator + screen tree.
 *
 * @param effectiveMode resolved start mode ('wallet' | 'emotion')
 * @param launchUrl the URL the app was launched with, or null (Linking.getInitialURL)
 * @returns the MainTabs initialParams to apply, or `undefined` for none.
 */
export function resolveInitialMainTabsParams(
  effectiveMode: 'wallet' | 'emotion',
  launchUrl: string | null,
): RootStackParamList['MainTabs'] {
  if (effectiveMode === 'emotion' && !launchUrl) {
    return { screen: 'Wallet', params: { highlightSessionCard: true } };
  }
  return undefined;
}
