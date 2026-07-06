/**
 * Preservation Property Tests — Scroll Position Bug (BEFORE fix)
 *
 * **Validates: Requirements 3.5, 3.6**
 *
 * Property 2: Preservation - Manual Scrolling and Viewport-Fitting Content
 *
 * These tests verify baseline behaviors that MUST remain unchanged after the
 * scroll position bug fix:
 *
 * 1. When recommendations is null (no recommendations yet), NO scroll method is called.
 *    This covers the case where content fits within a single viewport — no auto-scroll
 *    should be triggered.
 *
 * 2. The auto-scroll useEffect only fires once when recommendations first appear
 *    (null → non-null transition). Subsequent re-renders with the same recommendations
 *    do NOT trigger additional scroll calls.
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
  useSessionStore: jest.fn(() => ({
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
  })),
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({
      cards: [],
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
jest.mock('@/components/session/ContextChips', () => 'ContextChips');
jest.mock('@/components/session/TimeChips', () => 'TimeChips');
jest.mock('@/components/session/ToolPreviewCard', () => 'ToolPreviewCard');
jest.mock('@/components/session/LibraryToolPreview', () => 'LibraryToolPreview');

import SessionLauncherContent from '../SessionLauncherContent';
import { useSessionStore } from '@/stores/sessionStore';

describe('Preservation: Scroll Position — Manual Scrolling and Viewport-Fitting Content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRecommendations = null;
    mockScrollToEnd.mockClear();
    mockScrollTo.mockClear();
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * Property: For all recommendation-appear events where content fits within
   * the viewport (contentHeight <= viewportHeight), no scroll method is called.
   *
   * Implementation: When recommendations is null, the useEffect guard
   * (`if (recommendations)`) prevents any scroll call. This is the baseline
   * for "content fits viewport" — the pickers alone don't overflow.
   *
   * On UNFIXED code: PASSES (no scroll is triggered when recommendations is null).
   */
  it('no scroll method is called when recommendations are null (content fits viewport)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary emotion/context/time selections — none should trigger scroll
        fc.record({
          emotion: fc.constantFrom('stressed', 'anxious', 'sad', 'angry', 'overwhelmed', null),
          contextCount: fc.integer({ min: 0, max: 3 }),
          time: fc.constantFrom('1_2_min', '5_10_min', '15_plus_min', null),
        }),
        async ({ emotion, contextCount, time }) => {
          mockScrollToEnd.mockClear();
          mockScrollTo.mockClear();

          // Ensure recommendations are null (viewport-fitting content)
          mockCurrentRecommendations = null;

          const contexts = ['at_work', 'at_home', 'outdoors'].slice(0, contextCount);

          (useSessionStore as unknown as jest.Mock).mockImplementation(() => ({
            selectedEmotion: emotion,
            selectedContexts: contexts,
            selectedTime: time,
            recommendations: null, // No recommendations — content fits viewport
            selectEmotion: mockSelectEmotion,
            deselectEmotion: mockDeselectEmotion,
            toggleContext: mockToggleContext,
            selectTime: mockSelectTime,
            fetchRecommendations: mockFetchRecommendations,
            openTool: mockOpenTool,
            recordToolAdded: mockRecordToolAdded,
            endSession: mockEndSession,
            dismissWithoutSession: mockDismissWithoutSession,
          }));

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Advance timers well past the 100ms auto-scroll delay
          await act(async () => {
            jest.advanceTimersByTime(200);
          });

          // ASSERTION: No scroll method should be called when recommendations are null
          expect(mockScrollToEnd).not.toHaveBeenCalled();
          expect(mockScrollTo).not.toHaveBeenCalled();

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
   * **Validates: Requirements 3.6**
   *
   * Property: For all scroll events initiated by user gesture (not auto-scroll),
   * no forced repositioning occurs. The ScrollView does not have snap-to behavior,
   * scrollEnabled=false, or any onScrollEndDrag handler that forces position.
   *
   * Implementation: The auto-scroll only fires ONCE on the null→non-null transition
   * of recommendations. After that initial scroll, re-renders with the SAME
   * recommendations reference do NOT trigger additional scroll calls — proving
   * that user manual scrolling remains unrestricted (no snap-back).
   *
   * On UNFIXED code: PASSES (the useEffect dependency is `[recommendations]` —
   * same reference doesn't re-fire the effect).
   */
  it('auto-scroll fires only once — subsequent re-renders do not force repositioning', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletToolCount: fc.integer({ min: 0, max: 3 }),
          libraryToolCount: fc.integer({ min: 1, max: 3 }),
          reRenderCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ walletToolCount, libraryToolCount, reRenderCount }) => {
          mockScrollToEnd.mockClear();
          mockScrollTo.mockClear();

          // Build a stable recommendation object
          const recommendations: RecommendationResult = {
            walletTools: Array.from({ length: walletToolCount }, (_, i) => ({
              cardId: `wallet-tool-${i}`,
              title: `Wallet Tool ${i}`,
              description: `Description ${i}`,
              iconValue: '🧘',
              source: 'wallet' as const,
              contextRelevanceScore: 3 - i,
            })),
            libraryTools: Array.from({ length: libraryToolCount }, (_, i) => ({
              cardId: `lib-tool-${i}`,
              title: `Library Tool ${i}`,
              description: `Description ${i}`,
              iconValue: '📦',
              source: 'library' as const,
              contextRelevanceScore: 3 - i,
            })),
            isFallback: false,
          };

          mockCurrentRecommendations = recommendations;

          // Configure mock with stable recommendations reference
          const storeState = {
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
          };

          (useSessionStore as unknown as jest.Mock).mockImplementation(() => storeState);

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Advance timers for initial auto-scroll
          await act(async () => {
            jest.advanceTimersByTime(150);
          });

          // Record how many scroll calls happened from initial render
          // (On unfixed code, scrollToEnd is called once)
          const initialScrollToEndCount = mockScrollToEnd.mock.calls.length;
          const initialScrollToCount = mockScrollTo.mock.calls.length;
          const initialTotalScrollCalls = initialScrollToEndCount + initialScrollToCount;

          // Now simulate multiple re-renders with the SAME recommendations reference
          // This simulates user interactions that cause re-renders (toggling context,
          // changing selections) but don't change recommendations
          for (let i = 0; i < reRenderCount; i++) {
            await act(async () => {
              tree!.update(
                <SessionLauncherContent
                  onDismiss={jest.fn()}
                  onNavigateToTool={jest.fn()}
                />
              );
            });

            // Advance timers again
            await act(async () => {
              jest.advanceTimersByTime(150);
            });
          }

          // ASSERTION: No ADDITIONAL scroll calls after re-renders with same recommendations
          // The total scroll calls should still equal the initial count
          const finalScrollToEndCount = mockScrollToEnd.mock.calls.length;
          const finalScrollToCount = mockScrollTo.mock.calls.length;
          const finalTotalScrollCalls = finalScrollToEndCount + finalScrollToCount;

          expect(finalTotalScrollCalls).toBe(initialTotalScrollCalls);

          // Clean up
          await act(async () => {
            tree!.unmount();
          });
        }
      ),
      { numRuns: 15 }
    );
  });
});
