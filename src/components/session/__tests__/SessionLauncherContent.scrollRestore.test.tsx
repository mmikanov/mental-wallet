/**
 * Bug Condition Exploration Test — Scroll Position Lost After Preview Close
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 *
 * Property 1: Bug Condition — Scroll Restores to Recommendations After Preview Close
 *
 * For any state where a library tool preview was open (previewingCard !== null),
 * recommendations exist, and the user closes the preview (setting previewingCard to null),
 * the SessionLauncherContent SHALL programmatically scroll the ScrollView to the
 * recommendations container Y offset within a short delay after remount.
 *
 * On UNFIXED code: this test MUST FAIL because scrollTo is never called after
 * preview close — the ScrollView remounts fresh at offset 0.
 *
 * On FIXED code: this test will PASS (confirming the scroll restoration fix works).
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';
import type { RecommendationResult } from '@/services/recommendationService';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

// --- Mock scroll methods ---
const mockScrollTo = jest.fn();
const mockScrollToEnd = jest.fn();

jest.useFakeTimers();

// Mock ScrollView to expose scroll spy methods via ref
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');

  const MockScrollView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollTo: mockScrollTo,
      scrollToEnd: mockScrollToEnd,
      getScrollResponder: jest.fn(),
      getScrollableNode: jest.fn(),
      flashScrollIndicators: jest.fn(),
    }));

    return React.createElement(
      'View',
      { style: props.style, testID: 'mock-scrollview' },
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
      cards: [],
      loadCards: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('@/stores/checkinStore', () => ({
  useCheckinStore: {
    getState: jest.fn(() => ({
      reset: jest.fn(),
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

jest.mock('@/services/checkinRecordService', () => ({
  saveCheckinRecord: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/analyticsEventLogger', () => ({
  logEvent: jest.fn(),
}));

// Mock CURATED_LIBRARY — will be dynamically set per test run
let mockCuratedLibrary: CuratedCardDefinition[] = [];

jest.mock('@/data/curatedLibrary', () => ({
  get CURATED_LIBRARY() {
    return mockCuratedLibrary;
  },
}));

// Mock child components to keep tests focused
jest.mock('@/components/session/EmotionPicker', () => 'EmotionPicker');
jest.mock('@/components/session/ContextChips', () => 'ContextChips');
jest.mock('@/components/session/TimeChips', () => 'TimeChips');
jest.mock('@/components/session/ToolPreviewCard', () => 'ToolPreviewCard');
jest.mock('@/components/session/LibraryToolPreview', () => {
  const React = require('react');
  return function MockLibraryToolPreview(props: any) {
    return React.createElement('View', {
      testID: 'library-tool-preview',
      onClose: props.onClose,
    });
  };
});
jest.mock('@/components/session/GuidedCheckinFlow', () => 'GuidedCheckinFlow');

import SessionLauncherContent from '../SessionLauncherContent';
import { useSessionStore } from '@/stores/sessionStore';

// --- fast-check arbitrary for CuratedCardDefinition ---
const arbCuratedCard: fc.Arbitrary<CuratedCardDefinition> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).map((s) => `lib-${s.replace(/[^a-z0-9-]/gi, 'x')}`),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  iconType: fc.constant('emoji' as const),
  iconValue: fc.constantFrom('🧘', '📦', '🌿', '🎯', '💆', '🌊'),
  backgroundType: fc.constant('color' as const),
  backgroundValue: fc.constantFrom('#E8F4F8', '#F3E8FF', '#FEF3C7', '#E8F5E9'),
  categoryId: fc.constantFrom('grounding-calming', 'cognitive', 'body-sensory', 'daily-checkin'),
  allowBackgroundCustomization: fc.boolean(),
  controls: fc.array(
    fc.record({
      type: fc.constantFrom('static_text', 'text_input', 'mood_slider') as fc.Arbitrary<any>,
      position: fc.nat({ max: 5 }),
      config: fc.constant({ label: 'Test', body: 'Test content', fontSize: 'medium' } as any),
      isRequired: fc.boolean(),
    }),
    { minLength: 0, maxLength: 3 }
  ),
  emotionTags: fc.constant(['stressed', 'anxious'] as any),
  contextTags: fc.constant(['at_work'] as any),
  timeTags: fc.constant(['5_10_min'] as any),
  rationale: fc.constant(undefined),
});

describe('Bug Condition: Scroll Restore After Preview Close', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRecommendations = null;
    mockCuratedLibrary = [];
    mockScrollTo.mockClear();
    mockScrollToEnd.mockClear();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
   *
   * Property: For any CuratedCardDefinition used as previewingCard, when the user
   * closes the preview (pressing "← Back to session") and recommendations exist,
   * the system SHALL call scrollTo with the recommendations container Y offset.
   *
   * On UNFIXED code this FAILS because:
   * - handleClosePreview sets previewingCard to null
   * - The ScrollView remounts fresh at offset 0
   * - The auto-scroll useEffect only triggers on [recommendations] change
   * - recommendations didn't change, so scrollTo is never called after preview close
   *
   * Counterexample: "After closing preview of any card X, scrollTo is not invoked;
   * ScrollView remounts at offset 0"
   */
  it('scrollTo is called with recoContainerY after closing a library tool preview', async () => {
    await fc.assert(
      fc.asyncProperty(arbCuratedCard, async (generatedCard) => {
        mockScrollTo.mockClear();

        // Build recommendations that include the generated card as a library tool
        const recommendations: RecommendationResult = {
          walletTools: [],
          libraryTools: [
            {
              cardId: generatedCard.id,
              title: generatedCard.title,
              description: generatedCard.description,
              iconValue: generatedCard.iconValue,
              source: 'library',
              contextRelevanceScore: 1,
            },
          ],
          isFallback: false,
        };

        mockCurrentRecommendations = recommendations;
        mockCuratedLibrary = [generatedCard];

        // Configure the session store to return recommendations
        (useSessionStore as unknown as jest.Mock).mockImplementation((selector?: any) => {
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
        });

        // Step 1: Render with recommendations visible (no preview)
        let tree: ReactTestRenderer;
        await act(async () => {
          tree = create(
            <SessionLauncherContent
              onDismiss={jest.fn()}
              onNavigateToTool={jest.fn()}
            />
          );
        });

        // Advance timers to let the initial auto-scroll fire (recommendations present)
        await act(async () => {
          jest.advanceTimersByTime(150);
        });

        // Clear scrollTo calls from initial render auto-scroll
        mockScrollTo.mockClear();

        // Step 2: Simulate opening the preview by calling handleOpenTool
        // on a library tool that exists in CURATED_LIBRARY.
        // This sets previewingCard internally via setPreviewingCard(libraryCard).
        const instance = tree!.root;
        // Find the ToolPreviewCard and trigger its onPress with the card ID
        const toolPreviewCards = instance.findAllByType('ToolPreviewCard' as any);
        if (toolPreviewCards.length > 0) {
          const onPress = toolPreviewCards[0].props.onPress;
          await act(async () => {
            onPress(generatedCard.id);
          });
        }

        // At this point, previewingCard should be set and LibraryToolPreview renders
        // Clear scroll calls again before the close
        mockScrollTo.mockClear();

        // Step 3: Simulate closing the preview (pressing "← Back to session")
        // Find the LibraryToolPreview mock and call its onClose prop
        const previewElements = instance.findAllByProps({ testID: 'library-tool-preview' });
        if (previewElements.length > 0) {
          const onClose = previewElements[0].props.onClose;
          await act(async () => {
            onClose();
          });
        }

        // Step 4: Advance timers to allow any scroll restoration effect to fire
        await act(async () => {
          jest.advanceTimersByTime(200);
        });

        // ASSERTION: scrollTo must have been called after preview close.
        // On UNFIXED code, this FAILS — scrollTo is never called because:
        // - The auto-scroll effect only depends on [recommendations]
        // - recommendations didn't change when preview was closed
        // - The fresh ScrollView mounts at offset 0 with no restoration
        expect(mockScrollTo).toHaveBeenCalled();

        // Clean up
        await act(async () => {
          tree!.unmount();
        });
      }),
      { numRuns: 20 }
    );
  });
});
