/**
 * WalletScreen deep-link consumer tests (1.0.4-deep-linking Req 2 + 4).
 *
 * Verifies the Wallet params delivered by a reminder tap or tip CTA focus + expand
 * the right card:
 * - focusCardId (Req 2): the specific card; missing/archived → no-op, no throw.
 * - openHowIFeel (Req 4.2): the session-launcher card.
 * - openKpiCheckin (Req 4.2): the KPI daily check-in card.
 * - openTopCard (Req 4.3): the top stack card, skipping the session-launcher.
 */

import React from 'react';
import { create, act } from 'react-test-renderer';

const mockFocusCard = jest.fn();
const mockExpandCard = jest.fn();
const mockLoadCards = jest.fn().mockResolvedValue(undefined);

jest.useFakeTimers();

const SESSION_LAUNCHER_CARD_ID = 'session-launcher';
const KPI_SOURCE_ID = 'lib-personal-kpi';

function card(over: Record<string, unknown>) {
  return {
    id: 'x',
    title: 'x',
    description: 'x',
    iconType: 'emoji',
    iconValue: '🧩',
    backgroundType: 'color',
    backgroundValue: '#EEE',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 0,
    totalUses: 0,
    currentStreak: 0,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: false,
    sourceLibraryId: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    ...over,
  };
}

// Regular tool on top of the stack, then session-launcher, then the KPI card.
const mockCards = [
  card({ id: 'card-top', title: 'Box Breathing' }),
  card({ id: SESSION_LAUNCHER_CARD_ID, title: 'Start from how I feel' }),
  card({ id: 'kpi-card', title: 'Daily check-in', sourceLibraryId: KPI_SOURCE_ID }),
];

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: jest.fn(() => ({
    cards: mockCards,
    loadCards: mockLoadCards,
    focusedCardId: null,
    isExpanded: false,
    isReorderMode: false,
    focusCard: mockFocusCard,
    expandCard: mockExpandCard,
    collapseCard: jest.fn(),
    returnToStack: jest.fn(),
    enterReorderMode: jest.fn(),
    commitReorder: jest.fn().mockResolvedValue(undefined),
    cancelReorder: jest.fn(),
  })),
}));

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: jest.fn((selector?: (s: any) => any) => {
    const state = { isSessionActive: false };
    return selector ? selector(state) : state;
  }),
}));

const mockLoadKpi = jest.fn().mockResolvedValue(undefined);
jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn((selector?: (s: any) => any) => {
    const state = { personalKpi: null, loadKpi: mockLoadKpi, lastCheckInDate: null,
      loadLastCheckIn: jest.fn(), refreshDaysElapsed: jest.fn() };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: jest.fn((selector?: (s: any) => any) => {
    const state = {
      onboardingScreensComplete: true,
      tutorialComplete: true,
      bannerDismissed: true,
      collapsedStackHintSeen: true,
      isChecklistVisible: false,
      isChecklistComplete: false,
      checklist: { openTool: true, tryExercise: true, addTool: true },
      checklistSessionCount: 0,
      markChecklistItem: jest.fn().mockResolvedValue(undefined),
      dismissBanner: jest.fn().mockResolvedValue(undefined),
      dismissChecklist: jest.fn().mockResolvedValue(undefined),
      incrementSessionCount: jest.fn().mockResolvedValue(undefined),
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/hooks/useMicroTutorial', () => ({
  useMicroTutorial: jest.fn(() => ({
    currentStep: 'idle', isActive: false, tooltipText: '', targetRef: null,
    advance: jest.fn(), skip: jest.fn(), start: jest.fn(),
  })),
}));

jest.mock('@/hooks/useReminderStatusMap', () => ({
  useReminderStatusMap: jest.fn(() => new Map()),
}));

// Configurable route params per test.
let mockRouteParams: Record<string, unknown> = {};
const mockSetParams = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(),
      setParams: mockSetParams, addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({ key: 'Wallet-test', name: 'Wallet', params: mockRouteParams }),
    useFocusEffect: (cb: () => void) => {
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('@/components/wallet/WalletHeader', () => 'WalletHeader');
jest.mock('@/components/wallet/StackedCardList', () => 'StackedCardList');
jest.mock('@/components/wallet/EmptyWalletState', () => 'EmptyWalletState');
jest.mock('@/components/wallet/FocusedCardView', () => 'FocusedCardView');
jest.mock('@/components/wallet/CollapsedStack', () => 'CollapsedStack');
jest.mock('@/components/wallet/ReorderMode', () => 'ReorderMode');
jest.mock('@/components/wallet/CardKebabMenu', () => 'CardKebabMenu');
jest.mock('@/components/wallet/BackgroundCustomizerSheet', () => 'BackgroundCustomizerSheet');
jest.mock('@/components/wallet/DaysSinceBadge', () => {
  const React = require('react');
  return { DaysSinceBadge: (p: any) => React.createElement('View', p) };
});
jest.mock('@/components/session/SessionLauncherContent', () => 'SessionLauncherContent');
jest.mock('@/components/session/SessionActiveBanner', () => 'SessionActiveBanner');
jest.mock('@/components/onboarding/OnboardingBanner', () => 'OnboardingBanner');
jest.mock('@/components/onboarding/TooltipOverlay', () => 'TooltipOverlay');
jest.mock('@/components/onboarding/FirstActionChecklist', () => 'FirstActionChecklist');

jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(() => ({
    create: jest.fn().mockResolvedValue({ id: 'new', title: 'x' }),
    getAll: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock('@/services/backgroundOverlayService', () => ({
  upsertOverlay: jest.fn().mockResolvedValue(undefined),
  removeOverlay: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/analyticsEventLogger', () => ({ logEvent: jest.fn() }));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const View = (p: any) => React.createElement('View', p, p.children);
  const Text = (p: any) => React.createElement('Text', p, p.children);
  return {
    __esModule: true,
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    default: { View, Text },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return { SafeAreaView: (p: any) => React.createElement('View', p, p.children) };
});

import WalletScreen from '../WalletScreen';

function renderWallet() {
  let tree: any;
  act(() => {
    tree = create(React.createElement(WalletScreen));
  });
  act(() => {
    jest.runOnlyPendingTimers();
  });
  return tree;
}

describe('WalletScreen deep-link consumers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('focusCardId focuses + expands that specific card', () => {
    mockRouteParams = { focusCardId: 'card-top' };
    renderWallet();
    expect(mockFocusCard).toHaveBeenCalledWith('card-top');
    expect(mockExpandCard).toHaveBeenCalled();
  });

  it('focusCardId for a missing card is a no-op (no focus, no throw)', () => {
    mockRouteParams = { focusCardId: 'does-not-exist' };
    renderWallet();
    expect(mockFocusCard).not.toHaveBeenCalled();
    expect(mockExpandCard).not.toHaveBeenCalled();
  });

  it('openHowIFeel focuses + expands the session-launcher card', () => {
    mockRouteParams = { openHowIFeel: true };
    renderWallet();
    expect(mockFocusCard).toHaveBeenCalledWith(SESSION_LAUNCHER_CARD_ID);
    expect(mockExpandCard).toHaveBeenCalled();
  });

  it('openKpiCheckin focuses + expands the KPI card', () => {
    mockRouteParams = { openKpiCheckin: true };
    renderWallet();
    expect(mockFocusCard).toHaveBeenCalledWith('kpi-card');
    expect(mockExpandCard).toHaveBeenCalled();
  });

  it('openTopCard focuses the top card, skipping the session-launcher', () => {
    mockRouteParams = { openTopCard: true };
    renderWallet();
    expect(mockFocusCard).toHaveBeenCalledWith('card-top');
    expect(mockFocusCard).not.toHaveBeenCalledWith(SESSION_LAUNCHER_CARD_ID);
    expect(mockExpandCard).toHaveBeenCalled();
  });

  it('clears the consumed params after handling', () => {
    mockRouteParams = { focusCardId: 'card-top' };
    renderWallet();
    expect(mockSetParams).toHaveBeenCalledWith(
      expect.objectContaining({ focusCardId: undefined })
    );
  });
});
