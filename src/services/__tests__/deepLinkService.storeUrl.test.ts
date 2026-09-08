/**
 * Tests for platform-aware store URL resolution (Bug 2 — Android "Open app"
 * was opening the Apple App Store instead of Google Play).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6
 */

import type { ExternalAppConfig } from '@/types/externalApp';

// Platform.OS is read at call time inside getStoreUrl; mock it per-test.
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Linking: { canOpenURL: jest.fn(), openURL: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RN = require('react-native');
import { getStoreUrl, resolveStoreFallbackUrl } from '@/services/deepLinkService';

const wysa: ExternalAppConfig = {
  appName: 'Wysa',
  deepLinkUrl: 'wysa://open',
  webUrl: 'https://www.wysa.com',
  appStoreId: '1166585565',
  playStoreId: 'bot.touchkin',
  monogram: 'W',
};

function setPlatform(os: 'ios' | 'android') {
  RN.Platform.OS = os;
}

describe('getStoreUrl (platform-aware store URL)', () => {
  it('returns the Apple App Store URL on iOS', () => {
    setPlatform('ios');
    expect(getStoreUrl(wysa)).toBe('https://apps.apple.com/app/id1166585565');
  });

  it('returns the Google Play URL on Android (the bug fix)', () => {
    setPlatform('android');
    expect(getStoreUrl(wysa)).toBe(
      'https://play.google.com/store/apps/details?id=bot.touchkin'
    );
  });

  it('returns null when the platform-specific id is missing', () => {
    setPlatform('android');
    const noPlay: ExternalAppConfig = { ...wysa, playStoreId: undefined };
    expect(getStoreUrl(noPlay)).toBeNull();

    setPlatform('ios');
    const noApple: ExternalAppConfig = { ...wysa, appStoreId: undefined };
    expect(getStoreUrl(noApple)).toBeNull();
  });
});

describe('resolveStoreFallbackUrl (store → affiliate → web priority)', () => {
  it('prefers the platform store URL when available', () => {
    setPlatform('android');
    expect(resolveStoreFallbackUrl(wysa)).toBe(
      'https://play.google.com/store/apps/details?id=bot.touchkin'
    );
  });

  it('falls back to the affiliate URL when no store id for the platform', () => {
    setPlatform('android');
    const cfg: ExternalAppConfig = {
      ...wysa,
      playStoreId: undefined,
      affiliateUrl: 'https://aff.example/wysa',
    };
    expect(resolveStoreFallbackUrl(cfg)).toBe('https://aff.example/wysa');
  });

  it('falls back to the web URL when no store id and no affiliate URL', () => {
    setPlatform('android');
    const cfg: ExternalAppConfig = { ...wysa, playStoreId: undefined };
    expect(resolveStoreFallbackUrl(cfg)).toBe('https://www.wysa.com');
  });

  it('returns null when there is no usable URL at all', () => {
    setPlatform('android');
    const cfg: ExternalAppConfig = {
      appName: 'Nothing',
      webUrl: '',
      monogram: 'N',
    };
    expect(resolveStoreFallbackUrl(cfg)).toBeNull();
  });
});
