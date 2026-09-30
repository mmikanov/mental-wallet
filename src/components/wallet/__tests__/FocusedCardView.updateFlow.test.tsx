/**
 * FocusedCardView — "Update available" flow (Tasks 5.3, 5.4, 5.5).
 *
 * **Validates: Requirements 2.3, 2.4, 3.7, 4.2**
 *
 * Covers the pill → sheet → Update / Not now flow that sits on top of the pill
 * visibility contract in FocusedCardView.updatePill.test.tsx:
 *
 *   - Tapping the pill opens the UpdateAvailableSheet (its copy is visible) — Req 2.3.
 *   - Update path: "Update" calls cardService.updateFromLibrary(card.id) then
 *     walletStore.loadCards(); after a successful reload with a caught-up card the
 *     pill is gone and the sheet closed — Req 3.7, 4.2.
 *   - Failure path: updateFromLibrary rejects → a non-blocking message appears,
 *     loadCards is NOT called, the card + pill remain, no crash — Req 3.7.
 *   - Not now: closes the sheet, pill still visible (no mutation) — Req 2.4.
 *
 * The CardService is injected by mocking `@/services/cardService`'s
 * `createCardService` (FocusedCardView's update flow builds a lazy singleton from
 * it). `walletStore.loadCards` is mocked so the reload is observable without a DB.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';
import type { Card } from '@/types/index';

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const mockReact = require('react');
  const mockAnimatedView = (props: any) =>
    mockReact.createElement('View', props, props.children);
  return {
    __esModule: true,
    default: { View: mockAnimatedView },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (val: any, _config?: any, cb?: any) => {
      if (cb) cb(true);
      return val;
    },
    runOnJS: (fn: any) => fn,
  };
});

// --- Mock react-native-gesture-handler ---
jest.mock('react-native-gesture-handler', () => {
  const mockReact = require('react');
  return {
    Gesture: {
      Pan: () => ({
        enabled: function () { return this; },
        activeOffsetY: function () { return this; },
        failOffsetY: function () { return this; },
        onUpdate: function () { return this; },
        onEnd: function () { return this; },
      }),
    },
    GestureDetector: ({ children }: any) =>
      mockReact.createElement('View', null, children),
    ScrollView: ({ children }: any) =>
      mockReact.createElement('View', null, children),
  };
});

// --- Mock @react-navigation/native ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// --- Mock ControlRenderer (pulled in via ExpandedContent) ---
jest.mock('@/components/controls/ControlRenderer', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', { testID: 'mock-control-renderer' }),
  };
});

// --- Mock cardColors ---
jest.mock('@/utils/cardColors', () => ({
  isLightBackground: () => true,
}));

// --- Mock renderCardIcon ---
jest.mock('@/utils/renderCardIcon', () => ({
  renderCardIcon: ({ iconValue }: { iconValue: string }) => {
    const mockReact = require('react');
    const { Text } = require('react-native');
    return mockReact.createElement(Text, null, iconValue || '📋');
  },
}));

// --- Mock RationaleSheet (avoid modal/PanResponder complexity) ---
jest.mock('@/components/rationale/RationaleSheet', () => ({
  RationaleSheet: () => null,
}));

// --- Mock useCardReminder ---
jest.mock('@/hooks/useCardReminder', () => ({
  useCardReminder: () => null,
}));

// --- Mock kpiStore ---
jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn(() => null),
}));

// --- Mock accessibility ---
jest.mock('@/utils/accessibility', () => ({
  announceCardTransition: jest.fn(),
}));

// --- Mock seeds ---
jest.mock('@/data/seeds', () => ({
  SEED_CATEGORIES: [
    { id: 'grounding-calming', name: 'Grounding & Calming', colorHex: '#4A90D9' },
  ],
}));

// --- Mock CURATED_LIBRARY behind a getter over a mutable fixture ---
const curatedFixture: CuratedCardDefinition[] = [];

jest.mock('@/data/curatedLibrary', () => {
  const actual = jest.requireActual('@/data/curatedLibrary');
  return {
    ...actual,
    get CURATED_LIBRARY() {
      return curatedFixture;
    },
  };
});

// --- Mock cardService.createCardService (inject the update service) ---
const mockUpdateFromLibrary = jest.fn();
jest.mock('@/services/cardService', () => {
  const actual = jest.requireActual('@/services/cardService');
  return {
    ...actual,
    createCardService: () => ({
      updateFromLibrary: mockUpdateFromLibrary,
    }),
  };
});

// --- Mock walletStore.loadCards (observe the reload) ---
const mockLoadCards = jest.fn();
jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: () => ({ loadCards: mockLoadCards }),
  },
}));

// eslint-disable-next-line import/first
import FocusedCardView from '@/components/wallet/FocusedCardView';
// eslint-disable-next-line import/first
import { UPDATE_SHEET_BODY } from '@/components/wallet/UpdateAvailableSheet';

// --- Fixtures / helpers ---

const SOURCE_ID = 'lib-fixture';
// Addendum 2: the pill was replaced by the prominent UpdateAvailableBanner. The
// flow is now banner → sheet → Update / Not now, so this test presses the
// banner (its a11y label) instead of the old "Update available" pill.
const BANNER_LABEL = 'Update available — see what changed';

function makeCurated(
  overrides: Partial<CuratedCardDefinition> = {}
): CuratedCardDefinition {
  return {
    id: SOURCE_ID,
    title: 'A tool',
    description: 'A helpful tool.',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [],
    ...overrides,
  };
}

function loadCurated(defs: CuratedCardDefinition[]): void {
  curatedFixture.length = 0;
  curatedFixture.push(...defs);
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    title: 'A tool',
    description: 'A helpful tool.',
    iconType: 'emoji',
    iconValue: '🌱',
    backgroundType: 'color',
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 0,
    totalUses: 3,
    currentStreak: 1,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: false,
    sourceLibraryId: SOURCE_ID,
    sourceLibraryVersion: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const baseProps = {
  categoryColor: '#4A90D9',
  categoryName: 'Grounding & Calming',
  onExpand: jest.fn(),
  onDismiss: jest.fn(),
  onPrimaryAction: jest.fn(),
  onMenuPress: jest.fn(),
};

describe('FocusedCardView — update flow (Req 2.3, 2.4, 3.7, 4.2)', () => {
  beforeEach(() => {
    curatedFixture.length = 0;
    jest.clearAllMocks();
  });

  it('opens the UpdateAvailableSheet when the banner is tapped (copy visible)', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    // Sheet copy not shown until the banner is tapped.
    expect(screen.queryByText(UPDATE_SHEET_BODY)).toBeNull();

    fireEvent.press(screen.getByLabelText(BANNER_LABEL));

    expect(await screen.findByText(UPDATE_SHEET_BODY)).toBeTruthy();
    // Both actions are present.
    expect(screen.getByLabelText('Update')).toBeTruthy();
    expect(screen.getByLabelText('Not now')).toBeTruthy();
  });

  it('Update path: calls updateFromLibrary(card.id) then loadCards, then closes; pill gone after caught-up reload', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });
    mockUpdateFromLibrary.mockResolvedValue(makeCard({ sourceLibraryVersion: 2 }));
    mockLoadCards.mockResolvedValue(undefined);

    const { rerender } = await render(
      <FocusedCardView {...baseProps} card={card} isExpanded={false} />
    );

    fireEvent.press(screen.getByLabelText(BANNER_LABEL));
    fireEvent.press(await screen.findByLabelText('Update'));

    await waitFor(() => {
      expect(mockUpdateFromLibrary).toHaveBeenCalledWith('card-1');
    });
    await waitFor(() => {
      expect(mockLoadCards).toHaveBeenCalledTimes(1);
    });

    // updateFromLibrary is called before loadCards.
    expect(mockUpdateFromLibrary.mock.invocationCallOrder[0]).toBeLessThan(
      mockLoadCards.mock.invocationCallOrder[0]
    );

    // The sheet closed on success (copy no longer shown).
    await waitFor(() => {
      expect(screen.queryByText(UPDATE_SHEET_BODY)).toBeNull();
    });

    // Simulate the reload replacing the card with the caught-up version: the
    // pill (which depends on evaluateOutdated) disappears.
    const caughtUp = makeCard({ sourceLibraryVersion: 2 });
    await rerender(<FocusedCardView {...baseProps} card={caughtUp} isExpanded={false} />);
    expect(screen.queryByLabelText(BANNER_LABEL)).toBeNull();
  });

  it('Failure path: updateFromLibrary rejects → non-blocking message, loadCards NOT called, pill remains', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });
    mockUpdateFromLibrary.mockRejectedValue(new Error('write failed'));

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    fireEvent.press(screen.getByLabelText(BANNER_LABEL));
    fireEvent.press(await screen.findByLabelText('Update'));

    await waitFor(() => {
      expect(mockUpdateFromLibrary).toHaveBeenCalledWith('card-1');
    });

    // A non-blocking message is shown, and the reload was NOT triggered.
    await waitFor(() => {
      expect(screen.getByText(/couldn't update this tool/i)).toBeTruthy();
    });
    expect(mockLoadCards).not.toHaveBeenCalled();

    // Card + banner remain (no mutation); sheet stays open so the user can retry.
    expect(screen.getByLabelText(BANNER_LABEL)).toBeTruthy();
    expect(screen.getByText(UPDATE_SHEET_BODY)).toBeTruthy();
  });

  it('Not now: closes the sheet without mutating; pill still visible', async () => {
    loadCurated([makeCurated({ version: 2 })]);
    const card = makeCard({ sourceLibraryVersion: null });

    await render(<FocusedCardView {...baseProps} card={card} isExpanded={false} />);

    fireEvent.press(screen.getByLabelText(BANNER_LABEL));
    expect(await screen.findByText(UPDATE_SHEET_BODY)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Not now'));

    // Sheet closed, no service calls, pill still there.
    await waitFor(() => {
      expect(screen.queryByText(UPDATE_SHEET_BODY)).toBeNull();
    });
    expect(mockUpdateFromLibrary).not.toHaveBeenCalled();
    expect(mockLoadCards).not.toHaveBeenCalled();
    expect(screen.getByLabelText(BANNER_LABEL)).toBeTruthy();
  });
});
