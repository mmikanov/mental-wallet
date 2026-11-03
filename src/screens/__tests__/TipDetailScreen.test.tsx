/**
 * TipDetailScreen render + CTA-navigation tests (Bug 1, 1.0.6 — tip consistency).
 *
 * Asserts the native tip detail renders title / hero / full body / CTA, and that tapping the
 * CTA for a `create-tool` tip navigates IN-APP to CardCreator (never opens a browser), via the
 * shared tipCtaToNavigation mapper.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TipDetailScreen from '@/screens/TipDetailScreen';
import type { Tip } from '@/types/tips';

// Mock the markdown renderer to a plain Text node so we can assert the body text is present
// without pulling the untransformed markdown-it package through jest. (The real component
// renders the same string as prose; this test only cares that the body reaches the renderer.)
jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

// Analytics is fire-and-forget; stub it so the test doesn't touch the queue/store.
jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

const { logEvent } = require('@/services/analyticsEventLogger');

// jest-expo's Image.getSize stub doesn't invoke the success callback, so mock it to report a
// realistic portrait GIF size (240x500) — this exercises the measured-aspect-ratio hero path.
import { Image } from 'react-native';
beforeAll(() => {
  jest
    .spyOn(Image, 'getSize')
    .mockImplementation((_uri: string, success?: (w: number, h: number) => void) => {
      success?.(240, 500);
    });
});

const FIXTURE_TIP: Tip = {
  slug: 'add-your-own-tool',
  title: 'Add your own tool',
  summary: 'Short summary line.',
  type: 'feature',
  topics: ['tools'],
  heroImage: 'https://example.test/assets/tips/add-your-own-tool.gif',
  cta: {
    label: 'Create your own tool',
    url: 'https://mentalhealthwallet.productsforgood.co/app/create-tool',
  },
  body: 'First paragraph of the full body.\n\nSecond paragraph with **bold** text.',
  url: '/tips/add-your-own-tool',
  publishedAt: '2026-01-01',
};

function makeNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };
}

async function renderScreen(tip: Tip = FIXTURE_TIP) {
  const navigation = makeNavigation();
  const utils = await render(
    // @ts-expect-error — minimal navigation/route props for the unit test
    <TipDetailScreen navigation={navigation} route={{ params: { tip }, key: 'k', name: 'TipDetail' }} />
  );
  return { navigation, utils };
}

describe('TipDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title, hero image, full body, and CTA button', async () => {
    const { utils } = await renderScreen();

    expect(utils.getByText('Add your own tool')).toBeTruthy();
    // Full body text (not just the summary) is present.
    expect(utils.getByText(/First paragraph of the full body/)).toBeTruthy();
    expect(utils.getByText(/Second paragraph with/)).toBeTruthy();
    // CTA button labeled from tip.cta.label.
    expect(utils.getByText('Create your own tool')).toBeTruthy();
    // Hero image rendered when heroImage is set.
    const hero = utils.getByTestId('tip-hero-image');
    expect(hero.props.source).toEqual({ uri: FIXTURE_TIP.heroImage });
  });

  it('tapping the CTA for a create-tool tip navigates in-app to CardCreator', async () => {
    const { navigation, utils } = await renderScreen();

    fireEvent.press(utils.getByText('Create your own tool'));

    expect(navigation.navigate).toHaveBeenCalledWith('CardCreator', undefined);
    expect(logEvent).toHaveBeenCalledWith('tip_opened', { slug: 'add-your-own-tool' });
  });

  it('falls back to the summary when the tip has no body', async () => {
    const noBody: Tip = { ...FIXTURE_TIP, body: undefined };
    const { utils } = await renderScreen(noBody);
    expect(utils.getByText('Short summary line.')).toBeTruthy();
  });

  it('does NOT render embedded raw HTML (figure/img/figcaption) from the body', async () => {
    // A realistic body with an embedded media figure — the case that leaked raw HTML as
    // literal text on the 1.0.6 build. The screen must strip it before markdown rendering.
    const withHtml: Tip = {
      ...FIXTURE_TIP,
      body: [
        'Keep the apps you already use, all in one place.',
        '',
        '<figure class="tip-media">',
        '  <img src="https://example.test/assets/tip-media/discover.gif" width="240" alt="Browsing the library." />',
        '  <figcaption>Add the apps you already use.</figcaption>',
        '</figure>',
        '',
        'You can have both.',
      ].join('\n'),
    };
    const { utils } = await renderScreen(withHtml);

    // Prose is present...
    expect(utils.getByText(/Keep the apps you already use/)).toBeTruthy();
    expect(utils.getByText(/You can have both\./)).toBeTruthy();
    // ...but no raw HTML angle-bracket markup leaked into any rendered text node.
    expect(utils.queryByText(/<figure/)).toBeNull();
    expect(utils.queryByText(/<img/)).toBeNull();
    expect(utils.queryByText(/<figcaption/)).toBeNull();
    expect(utils.queryByText(/tip-media/)).toBeNull();
  });

  it('renders without a hero when heroImage is empty', async () => {
    const noHero: Tip = { ...FIXTURE_TIP, heroImage: '' };
    const { utils } = await renderScreen(noHero);
    expect(utils.queryByTestId('tip-hero-image')).toBeNull();
  });
});
