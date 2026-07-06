/**
 * Preservation Property Tests — Onboarding Race Condition
 *
 * **Validates: Requirements 3.7, 3.8, 3.9**
 *
 * Property 2: Preservation - Explicit User Tap Focus and Micro-Tutorial Flow
 *
 * These tests verify baseline behavior that must be preserved when the
 * race condition bug is fixed:
 *
 * 1. When `highlightSessionCard` param is NOT set (returning users),
 *    `focusCard` is never called by the highlight effect.
 * 2. When `tutorial.isActive=true`, the highlight effect's guard condition
 *    prevents it from firing even if `highlightSessionCard=true`.
 *
 * EXPECTED OUTCOME: Tests PASS on unfixed code (confirms baseline behavior).
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

// --- Navigation mocks (dynamically controlled) ---
let mockRouteParams: Record<string, any> = {};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({
      key: 'Wallet-test',
      name: 'Wallet',
      params: mockRouteParams,
    }),
    useFocusEffect: (cb: () => void) => {
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

describe('Preservation: Onboarding Race — highlight effect does not interfere with non-bug scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTutorialComplete = true;
    mockOnboardingScreensComplete = true;
    mockBannerDismissed = true;
    mockTutorialIsActive = false;
    mockRouteParams = {};
  });

  /**
   * **Validates: Requirements 3.7**
   *
   * Property: For all wallet render events where `highlightSessionCard` param
   * is absent or false, the highlight effect does NOT call `focusCard`.
   *
   * This confirms that returning users (no highlightSessionCard param) see the
   * normal collapsed wallet stack without automatic focusing.
   *
   * On UNFIXED code this PASSES because the guard condition `shouldHighlight`
   * prevents the effect body from executing.
   */
  it('focusCard is NOT called by highlight effect when highlightSessionCard is absent or false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // highlightSessionCard is either absent (undefined), null, or false
          highlightSessionCard: fc.oneof(
            fc.constant(undefined),
            fc.constant(null),
            fc.constant(false)
          ),
          // tutorialComplete can be true or false — doesn't matter since guard fails earlier
          tutorialComplete: fc.boolean(),
          // tutorial.isActive can be true or false
          tutorialIsActive: fc.boolean(),
        }),
        async ({ highlightSessionCard, tutorialComplete, tutorialIsActive }) => {
          jest.clearAllMocks();
          mockTutorialComplete = tutorialComplete;
          mockTutorialIsActive = tutorialIsActive;
          mockRouteParams = highlightSessionCard != null
            ? { highlightSessionCard }
            : {};

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(<WalletScreen />);
          });

          // Advance timers to let effects settle
          await act(async () => {
            jest.advanceTimersByTime(1100);
          });

          // ASSERTION: focusCard must NOT have been called with the session launcher card ID
          // because highlightSessionCard is falsy — the highlight effect guard prevents it.
          expect(mockFocusCard).not.toHaveBeenCalledWith(SESSION_LAUNCHER_CARD_ID);

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.9**
   *
   * Property: For all states where `tutorial.isActive=true`, the highlight
   * effect does NOT fire — `focusCard` is NOT called even if
   * `highlightSessionCard=true`.
   *
   * This confirms that the micro-tutorial tooltip flow works without
   * interference from the highlight effect.
   *
   * On UNFIXED code this PASSES because the guard condition `!tutorial.isActive`
   * prevents the effect body from executing when the tutorial is active.
   */
  it('focusCard is NOT called by highlight effect when tutorial.isActive=true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // highlightSessionCard is always true (worst case — should still not fire)
          highlightSessionCard: fc.constant(true),
          // tutorialComplete can be true or false
          tutorialComplete: fc.boolean(),
          // tutorial.isActive is always true (the guard condition under test)
          tutorialIsActive: fc.constant(true),
        }),
        async ({ highlightSessionCard, tutorialComplete, tutorialIsActive }) => {
          jest.clearAllMocks();
          mockTutorialComplete = tutorialComplete;
          mockTutorialIsActive = tutorialIsActive;
          mockRouteParams = { highlightSessionCard };

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(<WalletScreen />);
          });

          // Advance timers to let effects settle
          await act(async () => {
            jest.advanceTimersByTime(1100);
          });

          // ASSERTION: focusCard must NOT have been called with the session launcher card ID
          // because tutorial.isActive=true — the guard condition `!tutorial.isActive` fails.
          expect(mockFocusCard).not.toHaveBeenCalledWith(SESSION_LAUNCHER_CARD_ID);

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 20 }
    );
  });
});
