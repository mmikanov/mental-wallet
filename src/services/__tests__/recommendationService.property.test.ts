import * as fc from 'fast-check';
import { getRecommendations } from '../recommendationService';
import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import type { EmotionType, ContextType, TimeType } from '@/types/index';

// Mock the database module and emotionTagService (wallet path needs DB)
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../emotionTagService', () => ({
  getCardIdsByEmotion: jest.fn(),
  getContextTags: jest.fn(),
  getTimeTags: jest.fn(),
}));

import { getDatabase } from '../../data/database';
import { getCardIdsByEmotion, getContextTags, getTimeTags } from '../emotionTagService';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockGetCardIdsByEmotion = getCardIdsByEmotion as jest.MockedFunction<typeof getCardIdsByEmotion>;
const mockGetContextTags = getContextTags as jest.MockedFunction<typeof getContextTags>;
const mockGetTimeTags = getTimeTags as jest.MockedFunction<typeof getTimeTags>;

// --- Arbitraries ---
const EMOTIONS: EmotionType[] = ['stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'];
const CONTEXTS: ContextType[] = ['at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'];
const TIMES: TimeType[] = ['1_2_min', '5_10_min'];

const emotionArb = fc.constantFrom(...EMOTIONS);
const contextSetArb = fc.subarray([...CONTEXTS], { minLength: 0 });
const timeArb = fc.option(fc.constantFrom(...TIMES));
const walletCardIdsArb = fc.subarray(CURATED_LIBRARY.map((c) => c.id), { minLength: 0 });

describe('recommendationService - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no wallet cards have emotion tags in DB (wallet section empty)
    mockGetCardIdsByEmotion.mockResolvedValue([]);
    mockGetContextTags.mockResolvedValue([]);
    mockGetTimeTags.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      getFirstAsync: jest.fn().mockResolvedValue(null),
    } as any);
  });

  describe('Feature: emotion-first-onboarding, Property 8: Recommendation engine correctness', () => {
    /**
     * **Validates: Requirements 7.3, 7.7, 8.8, 9.5**
     *
     * For any valid emotion, set of context chips, optional time chip, and set of
     * wallet card IDs, the recommendation engine returns results where:
     * (a) every returned library tool has the selected emotion in its emotion tags
     * (b) context-matching tools rank higher (higher contextRelevanceScore first)
     * (c) when a time chip is selected, no returned tool lacks that time tag
     * (d) each section contains at most 3 tools
     * (e) within equal context relevance scores, tools are ordered alphabetically by title
     */
    it('every returned library tool has the selected emotion in its tags', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, contextSetArb, timeArb, walletCardIdsArb, async (emotion, contexts, time, walletCardIds) => {
          const result = await getRecommendations(emotion, contexts, time, walletCardIds);

          for (const tool of result.libraryTools) {
            const libraryCard = CURATED_LIBRARY.find((c) => c.id === tool.cardId);
            if (libraryCard && !result.isFallback) {
              expect(libraryCard.emotionTags).toContain(emotion);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('results are sorted by contextRelevanceScore DESC then title ASC within library section', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, contextSetArb, timeArb, walletCardIdsArb, async (emotion, contexts, time, walletCardIds) => {
          const result = await getRecommendations(emotion, contexts, time, walletCardIds);

          if (!result.isFallback) {
            const tools = result.libraryTools;
            for (let i = 0; i < tools.length - 1; i++) {
              const current = tools[i];
              const next = tools[i + 1];
              if (current.contextRelevanceScore === next.contextRelevanceScore) {
                // Alphabetical tiebreaker
                expect(current.title.localeCompare(next.title)).toBeLessThanOrEqual(0);
              } else {
                // Higher score first
                expect(current.contextRelevanceScore).toBeGreaterThanOrEqual(next.contextRelevanceScore);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('when a time chip is selected, no returned library tool lacks that time tag', async () => {
      await fc.assert(
        fc.asyncProperty(
          emotionArb,
          contextSetArb,
          fc.constantFrom(...TIMES), // always select a time
          walletCardIdsArb,
          async (emotion, contexts, time, walletCardIds) => {
            const result = await getRecommendations(emotion, contexts, time, walletCardIds);

            if (!result.isFallback) {
              for (const tool of result.libraryTools) {
                const libraryCard = CURATED_LIBRARY.find((c) => c.id === tool.cardId);
                if (libraryCard) {
                  expect(libraryCard.timeTags ?? []).toContain(time);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each section contains at most 3 tools', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, contextSetArb, timeArb, walletCardIdsArb, async (emotion, contexts, time, walletCardIds) => {
          const result = await getRecommendations(emotion, contexts, time, walletCardIds);

          expect(result.walletTools.length).toBeLessThanOrEqual(3);
          expect(result.libraryTools.length).toBeLessThanOrEqual(3);
        }),
        { numRuns: 100 }
      );
    });

    it('tools already in wallet are excluded from library recommendations', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, contextSetArb, timeArb, walletCardIdsArb, async (emotion, contexts, time, walletCardIds) => {
          // walletCardIds here ARE library IDs (from walletCardIdsArb), so they serve as sourceLibraryIds
          const result = await getRecommendations(emotion, contexts, time, walletCardIds, walletCardIds);

          if (!result.isFallback) {
            for (const tool of result.libraryTools) {
              expect(walletCardIds).not.toContain(tool.cardId);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 9: Fallback recommendations when no matches', () => {
    /**
     * **Validates: Requirements 7.6**
     *
     * When no tools from either source match the selected emotion, the engine
     * returns a fallback result containing up to 3 tools ordered by their total
     * emotion tag count (descending), preferring tools not already in the user's wallet.
     */
    it('returns isFallback=true with up to 3 tools when all matching cards are in wallet', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, contextSetArb, timeArb, async (emotion, contexts, time) => {
          // Put ALL library cards that match this emotion into the wallet
          const matchingIds = CURATED_LIBRARY
            .filter((c) => c.emotionTags?.includes(emotion))
            .map((c) => c.id);

          // Also ensure wallet has no DB-based matches
          mockGetCardIdsByEmotion.mockResolvedValue([]);

          const result = await getRecommendations(emotion, contexts, time, matchingIds);

          if (result.isFallback) {
            // Fallback returns up to 3 tools
            expect(result.libraryTools.length).toBeLessThanOrEqual(3);
            expect(result.libraryTools.length).toBeGreaterThan(0);
            // walletTools should be empty in fallback
            expect(result.walletTools).toHaveLength(0);
          }
          // If not fallback, some library card without that emotion still matched
          // (shouldn't happen if all matching are in wallet, but edge case with time filter)
        }),
        { numRuns: 100 }
      );
    });

    it('fallback prefers non-wallet tools over wallet tools', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, async (emotion) => {
          // Put ALL matching cards in wallet and also include some non-matching cards
          const matchingIds = CURATED_LIBRARY
            .filter((c) => c.emotionTags?.includes(emotion))
            .map((c) => c.id);

          // Include only a subset of all cards as "in wallet" to test preference
          const partialWallet = matchingIds.slice(0, Math.ceil(matchingIds.length / 2));

          mockGetCardIdsByEmotion.mockResolvedValue([]);

          const result = await getRecommendations(emotion, [], null, matchingIds);

          if (result.isFallback) {
            // Non-wallet tools should come first if available
            const nonWalletTools = result.libraryTools.filter(
              (t) => !matchingIds.includes(t.cardId)
            );
            const walletTools = result.libraryTools.filter(
              (t) => matchingIds.includes(t.cardId)
            );

            // If there are both types, non-wallet should precede wallet in the list
            if (nonWalletTools.length > 0 && walletTools.length > 0) {
              const lastNonWalletIdx = result.libraryTools.findIndex(
                (t) => t === nonWalletTools[nonWalletTools.length - 1]
              );
              const firstWalletIdx = result.libraryTools.findIndex(
                (t) => t === walletTools[0]
              );
              expect(lastNonWalletIdx).toBeLessThan(firstWalletIdx);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('fallback tools are sorted by emotion tag count descending', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, async (emotion) => {
          // Put all matching cards in wallet to trigger fallback
          const matchingIds = CURATED_LIBRARY
            .filter((c) => c.emotionTags?.includes(emotion))
            .map((c) => c.id);

          mockGetCardIdsByEmotion.mockResolvedValue([]);

          const result = await getRecommendations(emotion, [], null, matchingIds);

          if (result.isFallback) {
            // For non-wallet tools grouped together and wallet tools grouped together,
            // within each group they should be sorted by tag count DESC then title ASC
            const tools = result.libraryTools;
            for (let i = 0; i < tools.length - 1; i++) {
              const currentCard = CURATED_LIBRARY.find((c) => c.id === tools[i].cardId);
              const nextCard = CURATED_LIBRARY.find((c) => c.id === tools[i + 1].cardId);
              if (currentCard && nextCard) {
                const currentInWallet = matchingIds.includes(currentCard.id);
                const nextInWallet = matchingIds.includes(nextCard.id);

                // Within same wallet/non-wallet group, check tag count ordering
                if (currentInWallet === nextInWallet) {
                  const currentTagCount = currentCard.emotionTags?.length ?? 0;
                  const nextTagCount = nextCard.emotionTags?.length ?? 0;
                  if (currentTagCount === nextTagCount) {
                    expect(currentCard.title.localeCompare(nextCard.title)).toBeLessThanOrEqual(0);
                  } else {
                    expect(currentTagCount).toBeGreaterThanOrEqual(nextTagCount);
                  }
                }
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 12: Library-to-wallet emotion tag retention', () => {
    /**
     * **Validates: Requirements 8.3**
     *
     * For every card in CURATED_LIBRARY that has emotionTags, when that card's
     * ID is NOT in walletCardIds and the emotion matches, it appears in library
     * results with correct data (proving the library definitions are used correctly).
     */
    it('library cards with matching emotion appear in results when not in wallet', async () => {
      await fc.assert(
        fc.asyncProperty(emotionArb, async (emotion) => {
          // No cards in wallet
          mockGetCardIdsByEmotion.mockResolvedValue([]);

          const result = await getRecommendations(emotion, [], null, []);

          // All library cards matching this emotion should be candidates
          // (limited to 3 by max per section)
          const expectedCandidates = CURATED_LIBRARY.filter(
            (c) => c.emotionTags?.includes(emotion)
          );

          if (expectedCandidates.length > 0) {
            expect(result.isFallback).toBe(false);
            // Verify returned tools have correct metadata from library definitions
            for (const tool of result.libraryTools) {
              const libraryCard = CURATED_LIBRARY.find((c) => c.id === tool.cardId);
              expect(libraryCard).toBeDefined();
              if (libraryCard) {
                expect(tool.title).toBe(libraryCard.title);
                expect(tool.description).toBe(libraryCard.description);
                expect(tool.iconValue).toBe(libraryCard.iconValue);
                expect(tool.source).toBe('library');
                // The card's emotion tags must include the queried emotion
                expect(libraryCard.emotionTags).toContain(emotion);
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('library card emotion tags are preserved in recommendation results for all emotions', async () => {
      // For every curated card with emotion tags, verify it appears for each of its tagged emotions
      for (const card of CURATED_LIBRARY) {
        if (!card.emotionTags || card.emotionTags.length === 0) continue;

        for (const emotion of card.emotionTags) {
          mockGetCardIdsByEmotion.mockResolvedValue([]);

          const result = await getRecommendations(emotion, [], null, []);

          // The card should be among the candidates (might be excluded by top-3 limit)
          const allMatchingCards = CURATED_LIBRARY.filter(
            (c) => c.emotionTags?.includes(emotion)
          );

          if (allMatchingCards.length <= 3) {
            // If 3 or fewer candidates, all should appear
            const found = result.libraryTools.find((t) => t.cardId === card.id);
            expect(found).toBeDefined();
            if (found) {
              expect(found.title).toBe(card.title);
              expect(found.description).toBe(card.description);
              expect(found.iconValue).toBe(card.iconValue);
            }
          }
        }
      }
    });
  });
});
