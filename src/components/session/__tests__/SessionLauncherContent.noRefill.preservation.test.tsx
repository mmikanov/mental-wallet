/**
 * Preservation Property Tests — No-Refill Bug (Bug 1)
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation — Initial Fetch, Selection-Change Re-fetch, Wallet Persistence
 *
 * These tests verify that behaviors we want to KEEP working still work on unfixed code.
 * They must PASS on the current (unfixed) code.
 *
 * Observation-first methodology:
 * - handleShowMeTools calls fetchRecommendations (initial fetch works)
 * - Changing emotion/context/time and re-tapping "Show me tools" triggers a fresh fetch
 * - handleAddToWallet persists card to wallet DB, copies tags, reloads wallet store
 * - Tapping an already-added library tool navigates to its wallet version via addedToWalletMapping
 */

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import * as fc from 'fast-check';
import type { RecommendationResult } from '@/services/recommendationService';

// --- Mocks ---

const mockFetchRecommendations = jest.fn().mockResolvedValue(undefined);
const mockSelectEmotion = jest.fn().mockResolvedValue(undefined);
const mockDeselectEmotion = jest.fn();
const mockToggleContext = jest.fn();
const mockSelectTime = jest.fn();
const mockOpenTool = jest.fn().mockResolvedValue(undefined);
const mockRecordToolAdded = jest.fn();
const mockEndSession = jest.fn().mockResolvedValue(undefined);
const mockDismissWithoutSession = jest.fn();

// Store state that can be mutated between renders
let mockStoreState = {
  selectedEmotion: 'stressed' as string | null,
  selectedContexts: ['at_work'] as string[],
  selectedTime: '5_10_min' as string | null,
  recommendations: null as RecommendationResult | null,
};

const mockRecommendations: RecommendationResult = {
  walletTools: [
    {
      cardId: 'wallet-card-1',
      title: 'Breathing Exercise',
      description: 'A calming breathing exercise',
      iconValue: '🫁',
      source: 'wallet',
      contextRelevanceScore: 2,
    },
  ],
  libraryTools: [
    {
      cardId: 'lib-box-breathing',
      title: 'Box Breathing',
      description: 'Breathe in a box pattern',
      iconValue: '📦',
      source: 'library',
      contextRelevanceScore: 3,
    },
    {
      cardId: 'lib-grounding-54321',
      title: 'Grounding 5-4-3-2-1',
      description: 'Use your senses to ground',
      iconValue: '🌳',
      source: 'library',
      contextRelevanceScore: 2,
    },
    {
      cardId: 'lib-name-it-tame-it',
      title: 'Name It Tame It',
      description: 'Name emotions to reduce intensity',
      iconValue: '🏷️',
      source: 'library',
      contextRelevanceScore: 1,
    },
  ],
  isFallback: false,
};

jest.mock('@/stores/sessionStore', () => ({
  useSessionStore: jest.fn(() => ({
    ...mockStoreState,
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

const mockLoadCards = jest.fn().mockResolvedValue(undefined);

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: jest.fn(() => ({
      cards: [],
      loadCards: mockLoadCards,
    })),
  },
}));

const mockCreate = jest.fn().mockResolvedValue({
  id: 'new-wallet-card-123',
  title: 'Box Breathing',
  description: 'Breathe in a box pattern',
});

jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(() => ({
    create: mockCreate,
  })),
}));

jest.mock('@/services/emotionTagService', () => ({
  setTagsForCard: jest.fn().mockResolvedValue(undefined),
  setContextTags: jest.fn().mockResolvedValue(undefined),
  setTimeTags: jest.fn().mockResolvedValue(undefined),
}));

// Import the mocked module to get references to the mock functions
import { setTagsForCard as mockSetTagsForCard, setContextTags as mockSetContextTags, setTimeTags as mockSetTimeTags } from '@/services/emotionTagService';

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
      emotionTags: ['stressed', 'anxious'],
      contextTags: ['at_work', 'alone_at_home'],
      timeTags: ['1_2_min'],
      controls: [{ type: 'timer', position: 0, config: { duration: 120 }, isRequired: false }],
    },
    {
      id: 'lib-grounding-54321',
      title: 'Grounding 5-4-3-2-1',
      description: 'Use your senses to ground',
      iconType: 'emoji',
      iconValue: '🌳',
      backgroundType: 'solid',
      backgroundValue: '#FFF3E0',
      categoryId: 'grounding',
      emotionTags: ['anxious', 'overwhelmed'],
      contextTags: ['alone_at_home'],
      timeTags: ['5_10_min'],
      controls: [{ type: 'text_input', position: 0, config: {}, isRequired: false }],
    },
    {
      id: 'lib-name-it-tame-it',
      title: 'Name It Tame It',
      description: 'Name emotions to reduce intensity',
      iconType: 'emoji',
      iconValue: '🏷️',
      backgroundType: 'solid',
      backgroundValue: '#E3F2FD',
      categoryId: 'cognitive',
      emotionTags: ['stressed', 'angry'],
      contextTags: ['at_work', 'with_family'],
      timeTags: ['1_2_min'],
      controls: [{ type: 'text_input', position: 0, config: {}, isRequired: false }],
    },
  ],
}));

// Mock child components to keep test focused
jest.mock('@/components/session/EmotionPicker', () => 'EmotionPicker');
jest.mock('@/components/session/ContextChips', () => 'ContextChips');
jest.mock('@/components/session/TimeChips', () => 'TimeChips');
jest.mock('@/components/session/ToolPreviewCard', () => 'ToolPreviewCard');
jest.mock('@/components/session/LibraryToolPreview', () => 'LibraryToolPreview');

import SessionLauncherContent from '../SessionLauncherContent';

describe('Preservation: No-Refill — Baseline behaviors that must remain unchanged', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      selectedEmotion: 'stressed',
      selectedContexts: ['at_work'],
      selectedTime: '5_10_min',
      recommendations: null,
    };
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * Property: handleShowMeTools calls fetchRecommendations (initial fetch works).
   * On UNFIXED code this PASSES — the initial fetch is not the buggy path.
   */
  it('handleShowMeTools calls fetchRecommendations for initial fetch', async () => {
    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SessionLauncherContent
          onDismiss={jest.fn()}
          onNavigateToTool={jest.fn()}
        />
      );
    });

    const root = tree!.root;

    // Find the "Show me tools" button and tap it
    const showMeToolsButton = root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Show me tools' &&
        node.props.accessibilityRole === 'button'
    );

    expect(showMeToolsButton.length).toBeGreaterThan(0);

    await act(async () => {
      showMeToolsButton[0].props.onPress();
    });

    // fetchRecommendations must have been called for the initial fetch
    expect(mockFetchRecommendations).toHaveBeenCalledTimes(1);
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * Property: For all non-add-to-wallet user actions (emotion select, context toggle,
   * time select, show-me-tools), fetchRecommendations is called ONLY on show-me-tools.
   *
   * This uses fast-check to generate arbitrary sequences of non-add-to-wallet actions
   * and verifies the invariant that fetchRecommendations fires exclusively on show-me-tools.
   */
  it('fetchRecommendations is called only on show-me-tools, not on selection actions', async () => {
    // Define the non-add-to-wallet action types
    const emotions = ['stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'] as const;
    const contexts = ['at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'] as const;
    const times = ['1_2_min', '5_10_min'] as const;

    type SessionAction =
      | { type: 'selectEmotion'; value: string }
      | { type: 'toggleContext'; value: string }
      | { type: 'selectTime'; value: string }
      | { type: 'showMeTools' };

    const actionArb: fc.Arbitrary<SessionAction> = fc.oneof(
      fc.constantFrom(...emotions).map((e) => ({ type: 'selectEmotion' as const, value: e })),
      fc.constantFrom(...contexts).map((c) => ({ type: 'toggleContext' as const, value: c })),
      fc.constantFrom(...times).map((t) => ({ type: 'selectTime' as const, value: t })),
      fc.constant({ type: 'showMeTools' as const })
    );

    await fc.assert(
      fc.asyncProperty(
        fc.array(actionArb, { minLength: 1, maxLength: 5 }),
        async (actions) => {
          jest.clearAllMocks();
          mockStoreState = {
            selectedEmotion: 'stressed',
            selectedContexts: ['at_work'],
            selectedTime: '5_10_min',
            recommendations: null,
          };

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          const root = tree!.root;
          let expectedFetchCount = 0;

          for (const action of actions) {
            switch (action.type) {
              case 'selectEmotion': {
                // EmotionPicker triggers onSelectEmotion
                const emotionPicker = root.findAllByType('EmotionPicker' as any);
                if (emotionPicker.length > 0) {
                  await act(async () => {
                    emotionPicker[0].props.onSelectEmotion(action.value);
                  });
                }
                break;
              }
              case 'toggleContext': {
                // ContextChips triggers onToggleContext
                const contextChips = root.findAllByType('ContextChips' as any);
                if (contextChips.length > 0) {
                  await act(async () => {
                    contextChips[0].props.onToggleContext(action.value);
                  });
                }
                break;
              }
              case 'selectTime': {
                // TimeChips triggers onSelectTime
                const timeChips = root.findAllByType('TimeChips' as any);
                if (timeChips.length > 0) {
                  await act(async () => {
                    timeChips[0].props.onSelectTime(action.value);
                  });
                }
                break;
              }
              case 'showMeTools': {
                const showMeBtn = root.findAll(
                  (node) =>
                    node.props.accessibilityLabel === 'Show me tools' &&
                    node.props.accessibilityRole === 'button'
                );
                if (showMeBtn.length > 0 && !showMeBtn[0].props.disabled) {
                  await act(async () => {
                    showMeBtn[0].props.onPress();
                  });
                  expectedFetchCount++;
                }
                break;
              }
            }
          }

          // fetchRecommendations must have been called exactly once per "showMeTools" action
          expect(mockFetchRecommendations).toHaveBeenCalledTimes(expectedFetchCount);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Property: handleAddToWallet persists card to wallet DB, copies tags, and reloads wallet store.
   * On UNFIXED code this PASSES — the add-to-wallet persistence logic is not the buggy path.
   */
  it('handleAddToWallet persists card to wallet DB, copies tags, and reloads wallet store', async () => {
    // Set recommendations so the tool cards are rendered
    mockStoreState.recommendations = mockRecommendations;

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SessionLauncherContent
          onDismiss={jest.fn()}
          onNavigateToTool={jest.fn()}
        />
      );
    });

    const root = tree!.root;

    // Find library tool preview cards with onAddToWallet
    const toolCards = root.findAllByType('ToolPreviewCard' as any);
    const libraryCards = toolCards.filter(
      (node) => node.props.source === 'library' && node.props.onAddToWallet
    );

    expect(libraryCards.length).toBeGreaterThan(0);

    // Trigger add-to-wallet for the first library card
    // Note: handleAddToWallet is async; we need act to handle the state updates
    await act(async () => {
      await libraryCards[0].props.onAddToWallet('lib-box-breathing');
    });

    // Verify card was created via cardService
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Box Breathing',
        description: 'Breathe in a box pattern',
      }),
      expect.any(Array), // controls
      'library',
      'grounding',
      'lib-box-breathing'
    );

    // Verify emotion tags were set
    expect(mockSetTagsForCard).toHaveBeenCalledWith('new-wallet-card-123', ['stressed', 'anxious']);

    // Verify context tags were set
    expect(mockSetContextTags).toHaveBeenCalledWith('new-wallet-card-123', ['at_work', 'alone_at_home']);

    // Verify time tags were set
    expect(mockSetTimeTags).toHaveBeenCalledWith('new-wallet-card-123', ['1_2_min']);

    // Verify wallet store was reloaded
    expect(mockLoadCards).toHaveBeenCalled();

    // Verify session history was recorded
    expect(mockRecordToolAdded).toHaveBeenCalledWith('Box Breathing');
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Property: Tapping an already-added library tool navigates to its wallet version
   * via addedToWalletMapping.
   */
  it('tapping an already-added library tool navigates to its wallet version', async () => {
    mockStoreState.recommendations = mockRecommendations;

    const mockNavigateToTool = jest.fn();

    let tree: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SessionLauncherContent
          onDismiss={jest.fn()}
          onNavigateToTool={mockNavigateToTool}
        />
      );
    });

    const root = tree!.root;

    // First, add a library tool to wallet
    const toolCards = root.findAllByType('ToolPreviewCard' as any);
    const libraryCard = toolCards.find(
      (node) => node.props.cardId === 'lib-box-breathing' && node.props.source === 'library'
    );
    expect(libraryCard).toBeDefined();

    await act(async () => {
      await libraryCard!.props.onAddToWallet('lib-box-breathing');
    });

    // Now tap the same library card (simulating onPress)
    // After adding, the component has addedToWalletMapping set
    await act(async () => {
      libraryCard!.props.onPress('lib-box-breathing');
    });

    // It should navigate to the wallet version using the mapped ID
    expect(mockNavigateToTool).toHaveBeenCalledWith('new-wallet-card-123');
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Property: For all library card IDs NOT in the current recommendation list,
   * handleAddToWallet rejects gracefully (returns without side effects).
   *
   * Uses fast-check to generate arbitrary card IDs that are NOT in the recommendation list.
   */
  it('handleAddToWallet rejects gracefully for card IDs not in library', async () => {
    mockStoreState.recommendations = mockRecommendations;

    const validLibraryIds = new Set(['lib-box-breathing', 'lib-grounding-54321', 'lib-name-it-tame-it']);

    // Generate IDs that are NOT in the library (CURATED_LIBRARY)
    const invalidIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
      (id) => !validLibraryIds.has(id)
    );

    await fc.assert(
      fc.asyncProperty(
        invalidIdArb,
        async (invalidCardId) => {
          jest.clearAllMocks();

          let tree: ReactTestRenderer;
          await act(async () => {
            tree = create(
              <SessionLauncherContent
                onDismiss={jest.fn()}
                onNavigateToTool={jest.fn()}
              />
            );
          });

          const root = tree!.root;

          // Find any library tool card and call onAddToWallet with the invalid ID
          const toolCards = root.findAllByType('ToolPreviewCard' as any);
          const libraryCards = toolCards.filter(
            (node) => node.props.source === 'library' && node.props.onAddToWallet
          );

          if (libraryCards.length > 0) {
            // Call handleAddToWallet with an ID not in CURATED_LIBRARY
            await act(async () => {
              await libraryCards[0].props.onAddToWallet(invalidCardId);
            });

            // Should NOT have created any card (graceful rejection)
            expect(mockCreate).not.toHaveBeenCalled();
            // Should NOT have set any tags
            expect(mockSetTagsForCard).not.toHaveBeenCalled();
            expect(mockSetContextTags).not.toHaveBeenCalled();
            expect(mockSetTimeTags).not.toHaveBeenCalled();
            // Should NOT have reloaded wallet
            expect(mockLoadCards).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
