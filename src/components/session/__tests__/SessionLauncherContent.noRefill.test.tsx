/**
 * Bug Condition Exploration Test — No-Refill Bug
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition - Recommendation Refill After Add-to-Wallet
 *
 * This test asserts that `handleAddToWallet` does NOT call `fetchRecommendations()`
 * after adding a library tool while recommendations are visible.
 *
 * On UNFIXED code: this test MUST FAIL because `fetchRecommendations` IS called
 * after add-to-wallet (confirming the bug exists).
 *
 * On FIXED code: this test will PASS (confirming the bug is resolved).
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
    selectedEmotion: 'stressed',
    selectedContexts: ['at_work'],
    selectedTime: '5_10_min',
    recommendations: mockRecommendations,
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

describe('Bug Condition: No-Refill — fetchRecommendations must NOT be called after add-to-wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Property: For any library card ID in the visible recommendation list,
   * calling handleAddToWallet SHALL NOT invoke fetchRecommendations().
   *
   * On UNFIXED code this FAILS because fetchRecommendations IS called.
   */
  it('handleAddToWallet does not call fetchRecommendations after successfully adding a library tool', async () => {
    const libraryCardIds = mockRecommendations.libraryTools.map((t) => t.cardId);

    // Use fast-check to pick an arbitrary library card from the recommendations
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...libraryCardIds),
        async (cardId) => {
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

          // Find the ToolPreviewCard for this library card and trigger onAddToWallet
          const root = tree!.root;
          const toolCards = root.findAllByType('ToolPreviewCard' as any);
          const targetCard = toolCards.find(
            (node) => node.props.cardId === cardId && node.props.source === 'library'
          );

          expect(targetCard).toBeDefined();
          expect(targetCard!.props.onAddToWallet).toBeDefined();

          // Trigger the add-to-wallet callback
          await act(async () => {
            await targetCard!.props.onAddToWallet(cardId);
          });

          // ASSERTION: fetchRecommendations must NOT have been called after add-to-wallet
          // On UNFIXED code, this will FAIL because fetchRecommendations IS called
          expect(mockFetchRecommendations).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 10 }
    );
  });
});
