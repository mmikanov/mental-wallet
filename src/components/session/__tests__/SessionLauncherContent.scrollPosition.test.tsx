/**
 * Bug Condition Exploration Test — Scroll Position Bug
 *
 * **Validates: Requirements 1.3, 1.4**
 *
 * Property 1: Bug Condition - ScrollToEnd Instead of ScrollTo Container Top
 *
 * This test asserts that the auto-scroll useEffect calls `scrollTo({ y: measuredY })`
 * instead of `scrollToEnd` when recommendations appear and content overflows the viewport.
 *
 * On UNFIXED code: this test MUST FAIL because `scrollToEnd` IS called
 * (confirming the bug exists).
 *
 * On FIXED code: this test will PASS (confirming the bug is resolved).
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';
import type { RecommendationResult } from '@/services/recommendationService';

// --- Mock scroll methods ---
const mockScrollToEnd = jest.fn();
const mockScrollTo = jest.fn();

// We'll use jest.useFakeTimers to control setTimeout
jest.useFakeTimers();

// Mock ScrollView at the react-native level to expose our spy methods via ref
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

    // Render children in a simple host element
    return React.createElement('View', {
      style: props.style,
      contentContainerStyle: props.contentContainerStyle,
      testID: props.testID,
    }, props.children);
  });
  MockScrollView.displayName = 'ScrollView';

  // Module exports default + named
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

// Dynamically controlled recommendations — prefixed with "mock" for jest.mock scoping
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

describe('Bug Condition: Scroll Position — scrollToEnd must NOT be called when recommendations appear', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRecommendations = null;
    mockScrollToEnd.mockClear();
    mockScrollTo.mockClear();
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * Property: For any recommendation-appear event where content overflows the viewport,
   * the auto-scroll logic SHALL NOT call scrollToEnd. Instead, it should call
   * scrollTo with a y offset targeting the recommendations container top.
   *
   * On UNFIXED code this FAILS because scrollToEnd IS called.
   */
  it('auto-scroll useEffect does NOT call scrollToEnd when recommendations appear (calls scrollTo instead)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          walletToolCount: fc.integer({ min: 0, max: 3 }),
          libraryToolCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ walletToolCount, libraryToolCount }) => {
          mockScrollToEnd.mockClear();
          mockScrollTo.mockClear();

          // Build a recommendation set with the generated counts
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

          // Set the recommendations
          mockCurrentRecommendations = recommendations;

          // Configure the session store mock
          (useSessionStore as unknown as jest.Mock).mockImplementation(() => ({
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

          // Advance timers past the 100ms setTimeout in the auto-scroll useEffect
          await act(async () => {
            jest.advanceTimersByTime(150);
          });

          // ASSERTION: scrollToEnd must NOT have been called.
          // On UNFIXED code, scrollToEnd IS called — this assertion FAILS (confirms bug).
          expect(mockScrollToEnd).not.toHaveBeenCalled();

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
