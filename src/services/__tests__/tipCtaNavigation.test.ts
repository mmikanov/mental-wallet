/**
 * Bug 1 (1.0.6) — the in-app tip CTA must navigate NATIVELY, not open a URL in a browser.
 * `tipCtaToNavigation` is the pure, in-app counterpart to linking.ts's getStateFromPath:
 * it turns a tip's `cta.url` (a Universal Link like .../app/create-tool, or the
 * mentalwallet:// scheme form) into an in-app { screen, params } destination, mirroring the
 * exact route resolution of linking.ts. External / unmapped URLs return null so the caller
 * can fall back to Linking.openURL.
 *
 * This suite is written exploration-first: it fails until src/services/tipCtaNavigation.ts
 * exists (and keeps the mapping in sync with linking.ts + Bug 2's create-tool → CardCreator).
 */

import { tipCtaToNavigation } from '@/services/tipCtaNavigation';

const BASE = 'https://mentalhealthwallet.productsforgood.co/app';

describe('tipCtaToNavigation', () => {
  it('maps /app/create-tool → CardCreator (shared with Bug 2 route)', () => {
    expect(tipCtaToNavigation(`${BASE}/create-tool`)).toEqual({ screen: 'CardCreator' });
  });

  it('maps /app/add-tool → LibraryBrowser', () => {
    expect(tipCtaToNavigation(`${BASE}/add-tool`)).toEqual({ screen: 'LibraryBrowser' });
  });

  it('maps /app/add-tool?filter=apps → LibraryBrowser with initialFilter: apps', () => {
    expect(tipCtaToNavigation(`${BASE}/add-tool?filter=apps`)).toEqual({
      screen: 'LibraryBrowser',
      params: { initialFilter: 'apps' },
    });
  });

  it('maps /app/checkin → MainTabs/Wallet with openKpiCheckin', () => {
    expect(tipCtaToNavigation(`${BASE}/checkin`)).toEqual({
      screen: 'MainTabs',
      params: { screen: 'Wallet', params: { openKpiCheckin: true } },
    });
  });

  it('maps /app/how-i-feel → MainTabs/Wallet with openHowIFeel', () => {
    expect(tipCtaToNavigation(`${BASE}/how-i-feel`)).toEqual({
      screen: 'MainTabs',
      params: { screen: 'Wallet', params: { openHowIFeel: true } },
    });
  });

  it('maps /app/learn-more-tour → MainTabs/Wallet with openTopCard', () => {
    expect(tipCtaToNavigation(`${BASE}/learn-more-tour`)).toEqual({
      screen: 'MainTabs',
      params: { screen: 'Wallet', params: { openTopCard: true } },
    });
  });

  it('maps bare /app/wallet → MainTabs/Wallet', () => {
    expect(tipCtaToNavigation(`${BASE}/wallet`)).toEqual({
      screen: 'MainTabs',
      params: { screen: 'Wallet' },
    });
  });

  it('accepts the custom-scheme form (mentalwallet://create-tool)', () => {
    expect(tipCtaToNavigation('mentalwallet://create-tool')).toEqual({ screen: 'CardCreator' });
  });

  it('normalizes a trailing slash (Android), e.g. create-tool/', () => {
    expect(tipCtaToNavigation(`${BASE}/create-tool/`)).toEqual({ screen: 'CardCreator' });
  });

  it('returns null for an external / unmapped URL (caller falls back to Linking.openURL)', () => {
    expect(tipCtaToNavigation('https://example.com/some-article')).toBeNull();
    expect(tipCtaToNavigation(`${BASE}/unknown-route`)).toBeNull();
    expect(tipCtaToNavigation('')).toBeNull();
  });
});
