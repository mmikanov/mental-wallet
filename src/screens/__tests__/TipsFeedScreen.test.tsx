/**
 * TipsFeedScreen tap behavior (Bug 1, 1.0.6 — tip consistency).
 *
 * Exploration-first: on unfixed code a tapped tip calls WebBrowser.openBrowserAsync (opens the
 * website article in an in-app browser) and does NOT navigate — so the "navigates to TipDetail"
 * assertion FAILS. After the fix, tapping a tip navigates to the native TipDetail screen with
 * the whole Tip object, and the browser is never opened. The tip_opened analytics event is
 * preserved either way.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TipsFeedScreen from '@/screens/TipsFeedScreen';
import type { Tip } from '@/types/tips';

const FIXTURE_TIPS: Tip[] = [
  {
    slug: 'add-your-own-tool',
    title: 'Add your own tool',
    summary: 'Build a custom coping tool.',
    type: 'feature',
    topics: ['tools'],
    heroImage: '',
    cta: { label: 'Create your own tool', url: 'https://x.test/app/create-tool' },
    body: 'Body text.',
    url: '/tips/add-your-own-tool',
    publishedAt: '2026-01-02',
  },
];

// Service: return the fixture tips synchronously-resolved.
jest.mock('@/services/tipsService', () => ({
  getTips: jest.fn().mockResolvedValue({ tips: [], fromCache: false }),
  // resolveTipUrl is only referenced by unfixed code; provide it so the module loads.
  resolveTipUrl: jest.fn((t: { url: string }) => `https://x.test${t.url}?embed=app`),
}));

// Spy on the in-app browser so we can assert it is NOT used after the fix.
const mockOpenBrowser = jest.fn().mockResolvedValue({ type: 'dismiss' });
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowser(...args),
  WebBrowserPresentationStyle: { PAGE_SHEET: 'pageSheet' },
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const { getTips } = require('@/services/tipsService');
const { logEvent } = require('@/services/analyticsEventLogger');

function makeNavigation() {
  return { navigate: jest.fn(), goBack: jest.fn() };
}

async function renderFeed() {
  (getTips as jest.Mock).mockResolvedValue({ tips: FIXTURE_TIPS, fromCache: false });
  const navigation = makeNavigation();
  const utils = await render(
    // @ts-expect-error — minimal navigation prop for the unit test
    <TipsFeedScreen navigation={navigation} route={{ key: 'k', name: 'Tips' }} />
  );
  // Let the async getTips resolve and the list render.
  const card = await utils.findByText('Add your own tool');
  return { navigation, utils, card };
}

describe('TipsFeedScreen tap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('navigates to TipDetail with the tip (and does NOT open the in-app browser)', async () => {
    const { navigation, card } = await renderFeed();

    fireEvent.press(card);

    expect(navigation.navigate).toHaveBeenCalledWith('TipDetail', { tip: FIXTURE_TIPS[0] });
    expect(mockOpenBrowser).not.toHaveBeenCalled();
    // Analytics preserved.
    expect(logEvent).toHaveBeenCalledWith('tip_opened', { slug: 'add-your-own-tool' });
  });
});
