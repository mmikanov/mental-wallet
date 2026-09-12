/**
 * Unit tests for deep-link route parsing (1.0.4-deep-linking).
 *
 * Verifies that both the custom-scheme and Universal-Link paths resolve to the
 * right screen + params: reminder focus (focusCardId), the verb routes
 * (how-i-feel / checkin / learn-more-tour → Wallet params), and add-tool
 * (+ ?filter=apps → LibraryBrowser initialFilter).
 *
 * Validates: Requirements 1.2, 2.1, 4.1, 4.4.
 */

// expo-notifications is only used by getInitialURL/subscribe;
// mock it so importing the linking module doesn't require native bindings.
jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

import { Linking } from 'react-native';
import { linking } from '../linking';

// Spy on the real RN Linking (jest-expo provides a working mock module); we drive
// getInitialURL / the url listener without replacing the whole react-native module.
const mockGetInitialURL = jest.spyOn(Linking, 'getInitialURL');
let urlListener: ((e: { url: string }) => void) | null = null;
jest.spyOn(Linking, 'addEventListener').mockImplementation(((_type: string, cb: any) => {
  urlListener = cb;
  return { remove: jest.fn() } as any;
}) as any);

const options = { screens: (linking.config as any).screens };

/** Walk to the innermost route (the leaf screen) of a parsed nav state. */
function leaf(state: any): { name: string; params?: Record<string, unknown> } {
  let route = state.routes[state.routes.length - 1];
  while (route.state) {
    route = route.state.routes[route.state.routes.length - 1];
  }
  return route;
}

function parse(path: string) {
  return (linking as any).getStateFromPath(path, options);
}

describe('deep-link route parsing', () => {
  it('registers both the custom scheme and the universal-link prefix', () => {
    expect(linking.prefixes).toContain('mentalwallet://');
    expect(linking.prefixes).toContain('https://mentalhealthwallet.productsforgood.co/app');
  });

  it('wallet?focusCardId=X resolves to Wallet with focusCardId', () => {
    const r = leaf(parse('wallet?focusCardId=card-123'));
    expect(r.name).toBe('Wallet');
    expect(r.params?.focusCardId).toBe('card-123');
  });

  it('how-i-feel resolves to Wallet with openHowIFeel', () => {
    const r = leaf(parse('how-i-feel'));
    expect(r.name).toBe('Wallet');
    expect(r.params?.openHowIFeel).toBe(true);
  });

  it('checkin resolves to Wallet with openKpiCheckin', () => {
    const r = leaf(parse('checkin'));
    expect(r.name).toBe('Wallet');
    expect(r.params?.openKpiCheckin).toBe(true);
  });

  it('learn-more-tour resolves to Wallet with openTopCard', () => {
    const r = leaf(parse('learn-more-tour'));
    expect(r.name).toBe('Wallet');
    expect(r.params?.openTopCard).toBe(true);
  });

  it('add-tool resolves to LibraryBrowser', () => {
    const r = leaf(parse('add-tool'));
    expect(r.name).toBe('LibraryBrowser');
  });

  it('add-tool?filter=apps resolves to LibraryBrowser with initialFilter=apps', () => {
    const r = leaf(parse('add-tool?filter=apps'));
    expect(r.name).toBe('LibraryBrowser');
    expect(r.params?.initialFilter).toBe('apps');
  });

  it('the /app universal-link prefix strips to the same routes', () => {
    const r = leaf(parse('/app/how-i-feel'));
    expect(r.name).toBe('Wallet');
    expect(r.params?.openHowIFeel).toBe(true);
  });

  it('archive and settings still resolve', () => {
    expect(leaf(parse('archive')).name).toBe('Archive');
    expect(leaf(parse('settings')).name).toBe('Settings');
  });
});

describe('deep-link URL delivery (getInitialURL / subscribe)', () => {
  beforeEach(() => {
    mockGetInitialURL.mockReset().mockResolvedValue(null);
    urlListener = null;
  });

  it('getInitialURL falls back to the OS launch URL (cold-start scheme link)', async () => {
    mockGetInitialURL.mockResolvedValue('mentalwallet://how-i-feel');
    const url = await (linking as any).getInitialURL();
    expect(url).toBe('mentalwallet://how-i-feel');
  });

  it('getInitialURL returns null when there is no notification and no launch URL', async () => {
    const url = await (linking as any).getInitialURL();
    expect(url).toBeNull();
  });

  it('subscribe forwards OS url events to the navigator listener', () => {
    const listener = jest.fn();
    const unsubscribe = (linking as any).subscribe(listener);
    expect(typeof urlListener).toBe('function');
    urlListener!({ url: 'mentalwallet://checkin' });
    expect(listener).toHaveBeenCalledWith('mentalwallet://checkin');
    unsubscribe();
  });
});
