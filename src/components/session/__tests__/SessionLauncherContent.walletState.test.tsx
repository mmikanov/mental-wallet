/**
 * Bug Condition Exploration Test — Added-to-Wallet State Lost on Component Remount
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**
 *
 * Property 1: Bug Condition — Added-to-Wallet State Persists Across Remounts
 *
 * For any session where one or more library tools have been added to the wallet
 * (IDs recorded), and the SessionLauncherContent component unmounts and remounts
 * while the session is still active, the component SHALL display "Added ✓" for
 * all previously-added tool IDs and SHALL have the addedToWalletMapping available.
 *
 * On UNFIXED code: this test MUST FAIL because addedToWalletIds and addedToWalletMapping
 * are stored in local useState. When the component unmounts, this state is destroyed.
 * On remount, fresh empty state is created (new Set() and new Map()).
 *
 * On FIXED code: this test will PASS (state persists via Zustand session store).
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';
import type { RecommendationResult } from '@/services/recommendationService';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

// --- Mock setup ---
jest.useFakeTimers();

const mockScrollTo = jest.fn();

// Mock ScrollView
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  const MockScrollView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      scrollTo: mockScrollTo,
      scrollToEnd: jest.fn(),
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

// --- Session store --- use REAL Zustand store so state updates trigger re-renders
// We only mock the async service dependencies, not the store itself.
jest.mock('@/services/emotionSessionService', () => ({
  create: jest.fn().mockResolvedValue({ id: 'mock-session-id', selectedEmotion: 'stressed', selectedContexts: [], selectedTime: null, toolCardIds: [], startedAt: new Date().toISOString(), endedAt: null }),
  endSession: jest.fn().mockResolvedValue(undefined),
  addToolUsed: jest.fn().mockResolvedValue(undefined),
  endUnterminatedSessions: jest.fn().mockResolvedValue(undefined),
  updateSelections: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/recommendationService', () => ({
  getRecommendations: jest.fn().mockResolvedValue({ walletTools: [], libraryTools: [], isFallback: false }),
}));

jest.mock('@/services/settingsService', () => ({
  setLastUsedMode: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/completionService', () => ({
  createCompletionService: jest.fn(() => ({ record: jest.fn().mockResolvedValue(undefined) })),
}));

let mockCurrentRecommendations: RecommendationResult | null = null;

// Track created wallet cards for mapping verification
let mockCreatedCardId = '';

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
    create: jest.fn().mockImplementation(() => {
      return Promise.resolve({ id: mockCreatedCardId, title: 'Test Card' });
    }),
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

// Dynamically controlled CURATED_LIBRARY
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
jest.mock('@/components/session/GuidedCheckinFlow', () => 'GuidedCheckinFlow');
jest.mock('@/components/session/LibraryToolPreview', () => 'LibraryToolPreview');

// Mock ToolPreviewCard to expose isAddedToWallet prop for assertion
jest.mock('@/components/session/ToolPreviewCard', () => {
  const React = require('react');
  return function MockToolPreviewCard(props: any) {
    return React.createElement('View', {
      testID: `tool-preview-card-${props.cardId}`,
      cardId: props.cardId,
      isAddedToWallet: props.isAddedToWallet,
      showAddToWallet: props.showAddToWallet,
      onAddToWallet: props.onAddToWallet,
      onPress: props.onPress,
    });
  };
});

import SessionLauncherContent from '../SessionLauncherContent';
import { useSessionStore } from '@/stores/sessionStore';

// --- fast-check arbitraries ---

/** Generate a valid library card ID (UUID-like) */
const arbLibraryCardId = fc.uuid();

/** Generate a wallet card ID (the ID returned when the card is created in wallet) */
const arbWalletCardId = fc.uuid();

/** Build a minimal CuratedCardDefinition from a given ID */
function buildCuratedCard(id: string): CuratedCardDefinition {
  return {
    id,
    title: `Tool ${id.slice(0, 8)}`,
    description: 'A test tool for property-based testing',
    iconType: 'emoji' as const,
    iconValue: '🧘',
    backgroundType: 'color' as const,
    backgroundValue: '#E8F4F8',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [
      {
        type: 'static_text' as any,
        position: 0,
        config: { label: 'Instructions', body: 'Follow these steps...', fontSize: 'medium' } as any,
        isRequired: false,
      },
    ],
    emotionTags: ['stressed'] as any,
    contextTags: ['at_work'] as any,
    timeTags: ['5_10_min'] as any,
  };
}

describe('Bug Condition: Added-to-Wallet State Lost on Component Remount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRecommendations = null;
    mockCuratedLibrary = [];
    mockCreatedCardId = '';
    // Reset real store to initial state
    useSessionStore.setState({
      isSessionActive: false,
      selectedEmotion: null,
      selectedContexts: [],
      selectedTime: null,
      recommendations: null,
      currentSessionId: null,
      toolsUsedInSession: [],
      toolsAddedToWallet: [],
      addedToWalletIds: [],
      addedToWalletMapping: {},
    });
  });

  /**
   * **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**
   *
   * Property: For any library card ID added to wallet during a session, when the
   * component unmounts (simulating navigation away) and remounts (simulating
   * navigation back), the "Added ✓" indicator SHALL be displayed for the
   * previously-added tool ID, and addedToWalletMapping SHALL contain the
   * library-to-wallet ID mapping.
   *
   * On UNFIXED code this FAILS because:
   * - addedToWalletIds is stored in useState<Set<string>>(new Set())
   * - addedToWalletMapping is stored in useState<Map<string, string>>(new Map())
   * - When the component unmounts, these values are destroyed
   * - On remount, fresh empty state is created
   * - The ToolPreviewCard receives isAddedToWallet=false and shows "Add to wallet"
   *
   * Counterexample: "After adding card X, unmounting, and remounting,
   * addedToWalletIds is empty and mapping is lost"
   */
  it('Added ✓ indicator persists after unmount/remount cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbLibraryCardId,
        arbWalletCardId,
        async (libraryCardId, walletCardId) => {
          // Reset state for this iteration
          useSessionStore.setState({
            addedToWalletIds: [],
            addedToWalletMapping: {},
            toolsAddedToWallet: [],
          });

          // Set up the wallet card ID that will be returned on creation
          mockCreatedCardId = walletCardId;

          // Build recommendations that include the generated card as a library tool
          const curatedCard = buildCuratedCard(libraryCardId);
          const recommendations: RecommendationResult = {
            walletTools: [],
            libraryTools: [
              {
                cardId: libraryCardId,
                title: curatedCard.title,
                description: curatedCard.description,
                iconValue: curatedCard.iconValue,
                source: 'library',
                contextRelevanceScore: 1,
              },
            ],
            isFallback: false,
          };

          mockCurrentRecommendations = recommendations;
          mockCuratedLibrary = [curatedCard];

          // Set up store with active session and recommendations
          useSessionStore.setState({
            isSessionActive: true,
            selectedEmotion: 'stressed',
            selectedContexts: ['at_work'],
            selectedTime: '5_10_min',
            recommendations,
            currentSessionId: 'mock-session-id',
            toolsUsedInSession: [],
            toolsAddedToWallet: [],
            addedToWalletIds: [],
            addedToWalletMapping: {},
          });

          // Step 1: Render SessionLauncherContent with active session + recommendations
          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Let initial effects settle
          await act(async () => {
            jest.advanceTimersByTime(200);
          });

          // Step 2: Find the ToolPreviewCard and trigger handleAddToWallet
          const instance = tree!.root;
          const toolCards = instance.findAllByProps({ testID: `tool-preview-card-${libraryCardId}` });
          expect(toolCards.length).toBeGreaterThan(0);

          const toolCard = toolCards[0];
          const onAddToWallet = toolCard.props.onAddToWallet;

          // Trigger add to wallet
          await act(async () => {
            await onAddToWallet(libraryCardId);
          });

          // Let async operations complete
          await act(async () => {
            jest.advanceTimersByTime(100);
          });

          // Verify "Added ✓" is shown after adding (before unmount)
          const toolCardsAfterAdd = instance.findAllByProps({ testID: `tool-preview-card-${libraryCardId}` });
          expect(toolCardsAfterAdd[0].props.isAddedToWallet).toBe(true);

          // Step 3: UNMOUNT the component (simulating navigation away)
          await act(async () => {
            tree!.unmount();
          });

          // Step 4: REMOUNT the component (simulating navigation back)
          let tree2: ReactTestRenderer;
          await act(async () => {
            tree2 = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          // Let effects settle on remount
          await act(async () => {
            jest.advanceTimersByTime(200);
          });

          // Step 5: ASSERT "Added ✓" is displayed for the previously-added tool ID
          const instance2 = tree2!.root;
          const toolCardsRemounted = instance2.findAllByProps({ testID: `tool-preview-card-${libraryCardId}` });
          expect(toolCardsRemounted.length).toBeGreaterThan(0);

          // BUG CONDITION: On unfixed code, isAddedToWallet will be FALSE
          // because useState creates fresh empty Set() on remount.
          // The test expects TRUE — so it FAILS on unfixed code.
          expect(toolCardsRemounted[0].props.isAddedToWallet).toBe(true);

          // Step 6: ASSERT addedToWalletMapping contains the library-to-wallet ID mapping
          // On unfixed code, tapping the already-added tool should navigate to the wallet card.
          // We verify this by triggering onPress — if the mapping exists, onNavigateToTool
          // should be called with the walletCardId.
          const mockNavigateToTool = jest.fn();

          // Remount with trackable navigation callback
          await act(async () => {
            tree2!.unmount();
          });

          let tree3: ReactTestRenderer;
          await act(async () => {
            tree3 = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={mockNavigateToTool}
              />
            );
          });

          await act(async () => {
            jest.advanceTimersByTime(200);
          });

          const instance3 = tree3!.root;
          const toolCardsForNav = instance3.findAllByProps({ testID: `tool-preview-card-${libraryCardId}` });

          if (toolCardsForNav.length > 0) {
            const onPress = toolCardsForNav[0].props.onPress;
            await act(async () => {
              onPress(libraryCardId);
            });

            // If mapping exists, onNavigateToTool should be called with walletCardId
            // On unfixed code, mapping is lost → preview is shown instead of navigation
            // This provides additional evidence of the bug
            expect(mockNavigateToTool).toHaveBeenCalledWith(walletCardId);
          }

          // Cleanup
          await act(async () => {
            tree3!.unmount();
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
