/**
 * Preservation Property Tests — Auto-Scroll on Initial Recommendations (BEFORE fix)
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Property 2: Preservation — Auto-Scroll on Initial Recommendations Unchanged
 *
 * These tests verify baseline auto-scroll behaviors that MUST remain unchanged
 * after the scroll restoration fix is applied:
 *
 * 1. When recommendations transition from null to non-null (initial fetch),
 *    scrollTo is called with { y: recoContainerY.current, animated: true }.
 *    This confirms the existing auto-scroll fires on initial recommendations.
 *
 * 2. Manual scroll without preview does not trigger programmatic scroll override.
 *    No forced repositioning handlers exist on the ScrollView.
 *
 * 3. Opening a wallet tool (not library preview) navigates away via
 *    onNavigateToTool without affecting scroll state.
 *
 * On UNFIXED code: These tests PASS (confirming baseline behavior to preserve).
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';
import type { RecommendationResult } from '@/services/recommendationService';

// --- Mock scroll methods ---
const mockScrollToEnd = jest.fn();
const mockScrollTo = jest.fn();

// Use fake timers to control setTimeout in the auto-scroll useEffect
jest.useFakeTimers();

// Mock ScrollView to expose spy methods via ref
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');

  const MockScrollView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollToEnd: mockScrollToEnd,
      scrollTo: mockScrollTo,
      getScrollResponder: jest.fn(),
      getScrollableNode: jest.fn(),
      flashScrollIndicators: jest.fn(),
    }));

    return React.createElement(
      'View',
      {
        style: props.style,
        contentContainerStyle: props.contentContainerStyle,
        testID: props.testID,
      },
      props.children
    );
  });
  MockScrollView.displayName = 'ScrollView';
  MockScrollView.default = MockScrollView;
  return MockScrollView;
});

// --- Session store mock setup ---
const mockFetchRecommendations = jest.fn().mockResolvedValue(undefined);
const mockSelectEmotion = jest.fn().mockResolvedValue(undefined);
const mockDeselectEmotion = jest.fn();
const mockToggleContext = jest.fn();
const mockSelectTime = jest.fn();
const mockOpenTool = jest.fn().mockResolvedValue(undefined);
const mockRecordToolAdded = jest.fn();
const mockEndSession = jest.fn().mockResolvedValue(undefined);
const mockDismissWithoutSession = jest.fn();

// Dynamically controlled recommendations
let mockCurrentRecommendations: RecommendationResult | null = null;

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: jest.fn((selector?: any) => {
    const state = {
      selectedEmotion: 'stressed',
      selectedContexts: ['at_work'],
      selectedTime: '5_10_min',
      recommendations: mockCurrentRecommendations,
      selectEmotion: mockSelectEmotion,
      deselectEmotion: mockDeselectEmotion,
      toggleContext: mockToggleContext,
      selectTime: mockSelectTime,
      fetchRecommendations: mockFetchRecommendations,
      openTool: mockOpenTool,
      recordToolAdded: mockRecordToolAdded,
      endSession: mockEndSession,
      dismissWithoutSession: mockDismissWithoutSession,
      addedToWalletIds: [],
      addedToWalletMapping: {},
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({
      cards: [
        { id: 'wallet-card-1', title: 'My Breathing', sourceLibraryId: null },
        { id: 'wallet-card-2', title: 'Grounding', sourceLibraryId: null },
      ],
      loadCards: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(() => ({
    create: jest.fn().mockResolvedValue({ id: 'new-card-123', title: 'Test' }),
  })),
}));

jest.mock('@/services/emotionTagService', () => ({
  setTagsForCard: jest.fn().mockResolvedValue(undefined),
  setContextTags: jest.fn().mockResolvedValue(undefined),
  setTimeTags: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/data/curatedLibrary', () => ({
  CURATED_LIBRARY: [
    {
      id: 'lib-box-breathing',
      title: 'Box Breathing',
      description: 'Breathe in a box pattern',
      iconType: 'emoji',
      iconValue: '📦',
      backgroundType: 'solid',
      backgroundValue: '#E8F5E9',
      categoryId: 'grounding',
      emotionTags: ['stressed'],
      contextTags: ['at_work'],
      timeTags: ['1_2_min'],
      controls: [{ type: 'timer', position: 0, config: { duration: 120 }, isRequired: false }],
    },
  ],
}));

// Mock child components
jest.mock('@/components/session/EmotionPicker', () => 'EmotionPicker');
jest.mock('@/components/session/GuidedCheckinFlow', () => 'GuidedCheckinFlow');
jest.mock('@/components/session/ContextChips', () => 'ContextChips');
jest.mock('@/components/session/TimeChips', () => 'TimeChips');
jest.mock('@/components/session/ToolPreviewCard', () => 'ToolPreviewCard');
jest.mock('@/components/session/LibraryToolPreview', () => 'LibraryToolPreview');

jest.mock('@/stores/checkinStore', () => ({
  useCheckinStore: {
    getState: jest.fn(() => ({
      reset: jest.fn(),
      answers: {},
      topFeelings: [],
    })),
  },
}));

jest.mock('@/services/checkinRecordService', () => ({
  saveCheckinRecord: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

import SessionLauncherContent from '../SessionLauncherContent';
import { useSessionStore } from '@/stores/sessionStore';

// --- fast-check arbitraries for RecommendationResult ---

const toolRecommendationArb = (source: 'wallet' | 'library') =>
  fc.record({
    cardId: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `${source}-${s.replace(/[^a-zA-Z0-9-]/g, 'x')}`),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    iconValue: fc.constantFrom('🧘', '📦', '🌊', '💆', '🎯', '🌿'),
    source: fc.constant(source),
    contextRelevanceScore: fc.integer({ min: 0, max: 5 }),
  });

const recommendationResultArb: fc.Arbitrary<RecommendationResult> = fc.record({
  walletTools: fc.array(toolRecommendationArb('wallet'), { minLength: 0, maxLength: 3 }),
  libraryTools: fc.array(toolRecommendationArb('library'), { minLength: 0, maxLength: 3 }),
  isFallback: fc.boolean(),
});

describe('Preservation: Auto-Scroll on Initial Recommendations Unchanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRecommendations = null;
    mockScrollToEnd.mockClear();
    mockScrollTo.mockClear();
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * Property: For all valid RecommendationResult objects, when recommendations
   * transition from null to non-null (initial fetch), the existing auto-scroll
   * calls scrollTo with { y: recoContainerY.current, animated: true }.
   *
   * The recoContainerY ref is set via onLayout, defaulting to 0 when the layout
   * hasn't been measured yet. The auto-scroll fires after a 100ms delay.
   *
   * On UNFIXED code: PASSES (auto-scroll to recoContainerY.current is the
   * existing behavior for initial recommendations fetch).
   */
  it('initial recommendations fetch triggers scrollTo with recoContainerY (property-based)', async () => {
    await fc.assert(
      fc.asyncProperty(
        recommendationResultArb,
        async (recommendations) => {
          mockScrollTo.mockClear();
          mockScrollToEnd.mockClear();

          // Set recommendations in mock store (simulates null → non-null transition)
          mockCurrentRecommendations = recommendations;

          (useSessionStore as unknown as jest.Mock).mockImplementation((selector?: any) => {
            const state = {
              selectedEmotion: 'stressed',
              selectedContexts: ['at_work'],
              selectedTime: '5_10_min',
              recommendations,
              selectEmotion: mockSelectEmotion,
              deselectEmotion: mockDeselectEmotion,
              toggleContext: mockToggleContext,
              selectTime: mockSelectTime,
              fetchRecommendations: mockFetchRecommendations,
              openTool: mockOpenTool,
              recordToolAdded: mockRecordToolAdded,
              endSession: mockEndSession,
              dismissWithoutSession: mockDismissWithoutSession,
              addedToWalletIds: [],
              addedToWalletMapping: {},
            };
            return selector ? selector(state) : state;
          });

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Advance timers past the 100ms auto-scroll delay
          await act(async () => {
            jest.advanceTimersByTime(150);
          });

          // ASSERTION: scrollTo is called (auto-scroll fires on initial recommendations)
          // recoContainerY.current defaults to 0 since onLayout hasn't been triggered
          // in our test renderer, but the scrollTo call itself is what matters.
          expect(mockScrollTo).toHaveBeenCalledTimes(1);
          expect(mockScrollTo).toHaveBeenCalledWith({
            y: 0, // recoContainerY.current defaults to 0 without onLayout
            animated: true,
          });

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * Property: Manual scroll without preview does not trigger programmatic scroll
   * override. After the initial auto-scroll fires, no additional forced
   * repositioning occurs from the component's logic.
   *
   * This test renders with recommendations (triggering the initial auto-scroll),
   * then verifies no additional scrollTo/scrollToEnd calls occur after user
   * interaction re-renders — proving manual scroll isn't overridden.
   *
   * On UNFIXED code: PASSES (the useEffect depends on [recommendations] reference;
   * same reference across re-renders does not re-fire the effect).
   */
  it('manual scroll without preview does not trigger programmatic scroll override', async () => {
    await fc.assert(
      fc.asyncProperty(
        recommendationResultArb,
        fc.integer({ min: 1, max: 5 }),
        async (recommendations, reRenderCount) => {
          mockScrollTo.mockClear();
          mockScrollToEnd.mockClear();

          mockCurrentRecommendations = recommendations;

          const storeState = {
            selectedEmotion: 'stressed' as const,
            selectedContexts: ['at_work'],
            selectedTime: '5_10_min',
            recommendations,
            selectEmotion: mockSelectEmotion,
            deselectEmotion: mockDeselectEmotion,
            toggleContext: mockToggleContext,
            selectTime: mockSelectTime,
            fetchRecommendations: mockFetchRecommendations,
            openTool: mockOpenTool,
            recordToolAdded: mockRecordToolAdded,
            endSession: mockEndSession,
            dismissWithoutSession: mockDismissWithoutSession,
            addedToWalletIds: [],
            addedToWalletMapping: {},
          };

          (useSessionStore as unknown as jest.Mock).mockImplementation((selector?: any) => selector ? selector(storeState) : storeState);

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Let initial auto-scroll fire
          await act(async () => {
            jest.advanceTimersByTime(150);
          });

          // Record scroll calls after initial auto-scroll
          const scrollCallsAfterInit = mockScrollTo.mock.calls.length;

          // Simulate multiple re-renders (as if user interactions caused them)
          // This represents the user scrolling manually and the component re-rendering
          // due to unrelated state changes — no new scroll should be forced
          for (let i = 0; i < reRenderCount; i++) {
            await act(async () => {
              tree!.update(
                <SessionLauncherContent
                  onDismiss={jest.fn()}
                  onNavigateToTool={jest.fn()}
                />
              );
            });
            await act(async () => {
              jest.advanceTimersByTime(150);
            });
          }

          // ASSERTION: No additional scrollTo calls after the initial auto-scroll
          expect(mockScrollTo.mock.calls.length).toBe(scrollCallsAfterInit);
          // No scrollToEnd calls at all (that would be the bug condition behavior)
          // We just verify no ADDITIONAL forced scrolling occurred
          const totalScrollToEnd = mockScrollToEnd.mock.calls.length;
          expect(totalScrollToEnd).toBe(0);

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Test: Opening a wallet tool (not a library preview) calls onNavigateToTool
   * and does NOT trigger any scroll method. The navigation happens externally
   * (component no longer visible), so scroll state is irrelevant.
   *
   * On UNFIXED code: PASSES (wallet tools navigate away; only library tools
   * show inline preview which is the bug condition path).
   */
  it('opening a wallet tool navigates away without affecting scroll', async () => {
    const mockOnNavigateToTool = jest.fn();

    // Build recommendations with wallet tools
    const recommendations: RecommendationResult = {
      walletTools: [
        {
          cardId: 'wallet-card-1',
          title: 'My Breathing',
          description: 'A breathing tool',
          iconValue: '🧘',
          source: 'wallet',
          contextRelevanceScore: 3,
        },
      ],
      libraryTools: [],
      isFallback: false,
    };

    mockCurrentRecommendations = recommendations;

    (useSessionStore as unknown as jest.Mock).mockImplementation((selector?: any) => {
      const state = {
        selectedEmotion: 'stressed',
        selectedContexts: ['at_work'],
        selectedTime: '5_10_min',
        recommendations,
        selectEmotion: mockSelectEmotion,
        deselectEmotion: mockDeselectEmotion,
        toggleContext: mockToggleContext,
        selectTime: mockSelectTime,
        fetchRecommendations: mockFetchRecommendations,
        openTool: mockOpenTool,
        recordToolAdded: mockRecordToolAdded,
        endSession: mockEndSession,
        dismissWithoutSession: mockDismissWithoutSession,
        addedToWalletIds: [],
        addedToWalletMapping: {},
      };
      return selector ? selector(state) : state;
    });

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SessionLauncherContent
          onDismiss={jest.fn()}
          onNavigateToTool={mockOnNavigateToTool}
        />
      );
    });

    // Let initial auto-scroll fire and clear
    await act(async () => {
      jest.advanceTimersByTime(150);
    });

    // Clear scroll mocks after initial auto-scroll so we can assert cleanly
    mockScrollTo.mockClear();
    mockScrollToEnd.mockClear();

    // Find the ToolPreviewCard and simulate pressing a wallet tool
    const testInstance = tree!.root;
    const toolPreviewCards = testInstance.findAllByType('ToolPreviewCard' as any);

    // The ToolPreviewCard receives onPress={handleOpenTool}
    // Simulate pressing the wallet tool
    if (toolPreviewCards.length > 0) {
      const walletToolCard = toolPreviewCards.find(
        (card) => card.props.cardId === 'wallet-card-1'
      );

      if (walletToolCard && walletToolCard.props.onPress) {
        await act(async () => {
          walletToolCard.props.onPress('wallet-card-1');
        });
      }
    }

    // Advance timers to check no delayed scroll was triggered
    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    // ASSERTION: onNavigateToTool was called for the wallet tool
    expect(mockOnNavigateToTool).toHaveBeenCalledWith('wallet-card-1');

    // ASSERTION: No scroll methods called after pressing wallet tool
    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(mockScrollToEnd).not.toHaveBeenCalled();

    // Clean up
    await act(async () => {
      tree!.unmount();
    });
  });
});
