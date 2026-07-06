/**
 * Bug Condition Exploration Test — Onboarding Race Condition
 *
 * **Validates: Requirements 1.5, 1.6**
 *
 * Property 1: Bug Condition - focusCard Called from Highlight useEffect
 *
 * This test asserts that when `highlightSessionCard=true`, `tutorialComplete=true`,
 * and `tutorial.isActive=false`, the highlight useEffect does NOT call
 * `focusCard(SESSION_LAUNCHER_CARD_ID)`.
 *
 * On UNFIXED code: this test MUST FAIL because `focusCard` IS called
 * (confirming the race condition bug exists).
 *
 * On FIXED code: this test will PASS (confirming the bug is resolved).
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';

// --- Mock focusCard and other wallet store actions ---
const mockFocusCard = jest.fn();
const mockLoadCards = jest.fn().mockResolvedValue(undefined);
const mockExpandCard = jest.fn();
const mockCollapseCard = jest.fn();
const mockReturnToStack = jest.fn();
const mockEnterReorderMode = jest.fn();
const mockCommitReorder = jest.fn().mockResolvedValue(undefined);
const mockCancelReorder = jest.fn();

jest.useFakeTimers();

// --- Cards data (includes the session-launcher card) ---
const SESSION_LAUNCHER_CARD_ID = 'session-launcher';

const mockCards = [
  {
    id: SESSION_LAUNCHER_CARD_ID,
    title: 'Session Launcher',
    description: 'Start an emotion session',
    iconType: 'emoji',
    iconValue: '🎯',
    backgroundType: 'solid',
    backgroundValue: '#E3F2FD',
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
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'card-2',
    title: 'Box Breathing',
    description: 'Breathe in a box pattern',
    iconType: 'emoji',
    iconValue: '📦',
    backgroundType: 'solid',
    backgroundValue: '#E8F5E9',
    categoryId: 'grounding-calming',
    originBadge: 'library',
    stackPosition: 1,
    totalUses: 5,
    currentStreak: 2,
    lastUsedAt: '2024-06-01T00:00:00Z',
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    allowBackgroundCustomization: true,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
];

// --- Wallet store mock ---
jest.mock('@/stores/walletStore', () => ({
  useWalletStore: jest.fn(() => ({
    cards: mockCards,
    loadCards: mockLoadCards,
    focusedCardId: null,
    isExpanded: false,
    isReorderMode: false,
    focusCard: mockFocusCard,
    expandCard: mockExpandCard,
    collapseCard: mockCollapseCard,
    returnToStack: mockReturnToStack,
    enterReorderMode: mockEnterReorderMode,
    commitReorder: mockCommitReorder,
    cancelReorder: mockCancelReorder,
  })),
}));

// --- Session store mock ---
jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      isSessionActive: false,
    };
    if (selector) return selector(state);
    return state;
  }),
}));

// --- KPI store mock ---
const mockLoadKpi = jest.fn().mockResolvedValue(undefined);
jest.mock('@/stores/kpiStore', () => ({
  useKpiStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      personalKpi: null,
      loadKpi: mockLoadKpi,
    };
    if (selector) return selector(state);
    return state;
  }),
}));

// --- Onboarding store mock (dynamically controlled) ---
let mockTutorialComplete = true;
let mockOnboardingScreensComplete = true;
let mockBannerDismissed = true;

jest.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      onboardingScreensComplete: mockOnboardingScreensComplete,
      tutorialComplete: mockTutorialComplete,
      bannerDismissed: mockBannerDismissed,
      isChecklistVisible: false,
      isChecklistComplete: false,
      checklist: { openTool: true, tryExercise: true, addTool: true },
      checklistSessionCount: 0,
      markChecklistItem: jest.fn().mockResolvedValue(undefined),
      dismissBanner: jest.fn().mockResolvedValue(undefined),
      dismissChecklist: jest.fn().mockResolvedValue(undefined),
      incrementSessionCount: jest.fn().mockResolvedValue(undefined),
    };
    if (selector) return selector(state);
    return state;
  }),
}));

// --- Micro-tutorial hook mock (dynamically controlled) ---
let mockTutorialIsActive = false;

jest.mock('@/hooks/useMicroTutorial', () => ({
  useMicroTutorial: jest.fn(() => ({
    currentStep: 'idle',
    isActive: mockTutorialIsActive,
    tooltipText: '',
    targetRef: null,
    advance: jest.fn(),
    skip: jest.fn(),
    start: jest.fn(),
  })),
}));

// --- Navigation mocks ---
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({
      key: 'Wallet-test',
      name: 'Wallet',
      params: { highlightSessionCard: true },
    }),
    useFocusEffect: (cb: () => void) => {
      // Execute the callback immediately in tests
      const React = require('react');
      React.useEffect(() => {
        const cleanup = cb();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

// --- Mock child components to avoid rendering complexity ---
jest.mock('@/components/wallet/WalletHeader', () => 'WalletHeader');
jest.mock('@/components/wallet/StackedCardList', () => 'StackedCardList');
jest.mock('@/components/wallet/EmptyWalletState', () => 'EmptyWalletState');
jest.mock('@/components/wallet/FocusedCardView', () => 'FocusedCardView');
jest.mock('@/components/wallet/CollapsedStack', () => 'CollapsedStack');
jest.mock('@/components/wallet/ReorderMode', () => 'ReorderMode');
jest.mock('@/components/wallet/CardKebabMenu', () => 'CardKebabMenu');
jest.mock('@/components/wallet/BackgroundCustomizerSheet', () => 'BackgroundCustomizerSheet');
jest.mock('@/components/session/SessionLauncherContent', () => 'SessionLauncherContent');
jest.mock('@/components/session/SessionActiveBanner', () => 'SessionActiveBanner');
jest.mock('@/components/onboarding/OnboardingBanner', () => 'OnboardingBanner');
jest.mock('@/components/onboarding/TooltipOverlay', () => 'TooltipOverlay');
jest.mock('@/components/onboarding/FirstActionChecklist', () => 'FirstActionChecklist');

// --- Mock services ---
jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(() => ({
    create: jest.fn().mockResolvedValue({ id: 'new-card', title: 'Test' }),
    getAll: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@/services/backgroundOverlayService', () => ({
  upsertOverlay: jest.fn().mockResolvedValue(undefined),
  removeOverlay: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

// --- Mock react-native-reanimated ---
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (val: any) => val,
    default: {
      View: (props: any) => React.createElement('View', props, props.children),
    },
  };
});

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: (props: any) => React.createElement('View', props, props.children),
  };
});

import WalletScreen from '../WalletScreen';

describe('Bug Condition: Onboarding Race — focusCard must NOT be called from highlight useEffect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTutorialComplete = true;
    mockOnboardingScreensComplete = true;
    mockBannerDismissed = true;
    mockTutorialIsActive = false;
  });

  /**
   * **Validates: Requirements 1.5, 1.6**
   *
   * Property: For any WalletScreen render where highlightSessionCard=true,
   * tutorialComplete=true, and tutorial.isActive=false, and cards contain
   * the session-launcher card, the highlight useEffect SHALL NOT call
   * focusCard(SESSION_LAUNCHER_CARD_ID).
   *
   * On UNFIXED code this FAILS because focusCard IS called from the highlight effect.
   */
  it('highlight useEffect does NOT call focusCard when bug condition is met', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate various card counts (always including session-launcher)
          additionalCardCount: fc.integer({ min: 0, max: 5 }),
          // tutorialComplete is always true (part of the bug condition)
          tutorialComplete: fc.constant(true),
          // tutorial.isActive is always false (part of the bug condition)
          tutorialIsActive: fc.constant(false),
        }),
        async ({ additionalCardCount, tutorialComplete, tutorialIsActive }) => {
          jest.clearAllMocks();
          mockTutorialComplete = tutorialComplete;
          mockTutorialIsActive = tutorialIsActive;

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(<WalletScreen />);
          });

          // Advance timers to let effects settle (highlight effect + setTimeout)
          await act(async () => {
            jest.advanceTimersByTime(1100);
          });

          // ASSERTION: focusCard must NOT have been called with the session launcher card ID.
          // On UNFIXED code, focusCard IS called — this assertion FAILS (confirms bug).
          expect(mockFocusCard).not.toHaveBeenCalledWith(SESSION_LAUNCHER_CARD_ID);

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
