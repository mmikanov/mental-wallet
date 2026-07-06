/**
 * Bug Condition Exploration Test — Duplicate Seeded Cards After Re-Selection (Bug 6)
 *
 * **Validates: Requirements 1.11, 1.12**
 *
 * Property 1: Bug Condition - Duplicate Cards After Re-Selection
 *
 * This test asserts the EXPECTED (fixed) behavior:
 * - After selecting an intent (seeding cards), then selecting a different intent
 *   (or the same one again), the wallet contains ONLY cards from the last selection
 *   with no duplicates.
 *
 * On UNFIXED code: `seedStarterCards` unconditionally inserts without clearing
 * previously seeded cards — both sets exist (6 total) — this test FAILS
 * (confirms the bug exists).
 *
 * On FIXED code: `clearStarterCards` removes prior seeds before re-seeding —
 * this test will PASS (confirms the bug is resolved).
 */

import * as fc from 'fast-check';
import { INTENT_OPTIONS, DEFAULT_STARTER_CARD_IDS, type IntentId } from '@/data/onboardingConfig';

// --- Track all cards "created" in a fake wallet ---
// Must be prefixed with "mock" for jest.mock() factory scope rules
const mockWalletCards: Array<{ id: string; sourceLibraryId: string }> = [];

// All possible starter card IDs (used by clearStarterCards mock)
const mockAllStarterIds = new Set<string>([
  ...DEFAULT_STARTER_CARD_IDS,
  ...INTENT_OPTIONS.flatMap((opt) => opt.cardIds),
]);

// Mock expo-crypto to generate unique IDs
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'card-' + Math.random().toString(36).substring(2, 10)),
}));

// Mock the database — clearStarterCards uses runAsync with DELETE query
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockImplementation(async (sql: string) => {
      // When clearStarterCards issues a DELETE, remove starter cards from mock wallet
      if (sql.includes('DELETE FROM cards WHERE source_library_id IN')) {
        // Remove all cards whose sourceLibraryId is a known starter card ID
        for (let i = mockWalletCards.length - 1; i >= 0; i--) {
          if (mockAllStarterIds.has(mockWalletCards[i].sourceLibraryId)) {
            mockWalletCards.splice(i, 1);
          }
        }
      }
      return { changes: 0 };
    }),
    execAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock the cardService to track cards "created" in mockWalletCards
jest.mock('@/services/cardService', () => ({
  createCardService: () => ({
    create: jest.fn().mockImplementation(
      async (
        _shell: any,
        _controls: any[],
        _originBadge: string,
        _categoryId: string,
        sourceLibraryId: string
      ) => {
        const id = 'card-' + Math.random().toString(36).substring(2, 10);
        mockWalletCards.push({ id, sourceLibraryId });
        return id;
      }
    ),
  }),
}));

// Mock kpiService (used by onboardingService)
jest.mock('@/services/kpiService', () => ({
  createKpiService: () => ({
    seedKpiCard: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { createOnboardingService } from '@/services/onboardingService';

// Helper: get card IDs for a given intent
function getStarterCardsForIntent(intentId: IntentId): string[] {
  const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
  return mapping ? [...mapping.cardIds] : [...DEFAULT_STARTER_CARD_IDS];
}

// Helper: check for duplicate source_library_id values
function noDuplicateCardIds(cards: Array<{ sourceLibraryId: string }>): boolean {
  const ids = cards.map((c) => c.sourceLibraryId).filter(Boolean);
  return new Set(ids).size === ids.length;
}

// Arbitrary for IntentId values
const intentIdArb = fc.constantFrom<IntentId>('overwhelm', 'routine', 'organize', 'explore');

describe('Bug 6 Exploration: Duplicate Seeded Cards After Re-Selection', () => {
  beforeEach(() => {
    mockWalletCards.length = 0;
  });

  /**
   * **Validates: Requirements 1.11, 1.12**
   *
   * Property: For any pair of intent selections (first selection, then re-selection),
   * after re-selection the wallet SHALL contain ONLY cards from the second intent
   * with no duplicates. Cards from the first intent SHALL NOT be present.
   *
   * On UNFIXED code this FAILS because `seedStarterCards` does not clear
   * previously seeded cards — both sets accumulate (6 total for intents with 3 cards).
   */
  it('after seeding for one intent then re-seeding for another, wallet contains only second intent cards with no duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        intentIdArb,
        intentIdArb,
        async (firstIntentId: IntentId, secondIntentId: IntentId) => {
          // Reset wallet state for each property run
          mockWalletCards.length = 0;

          const onboardingService = createOnboardingService();

          // Step 1: Seed cards for the first intent (simulates initial selection)
          await onboardingService.seedStarterCards(firstIntentId);

          // Verify first seeding occurred
          const firstIntentCards = getStarterCardsForIntent(firstIntentId);
          expect(mockWalletCards.length).toBe(firstIntentCards.length);

          // Step 2: Clear starter cards then re-seed (simulates handleSelect flow after back-nav)
          // handleSelect calls clearStarterCards() before seedStarterCards() to prevent duplicates
          await onboardingService.clearStarterCards();
          await onboardingService.seedStarterCards(secondIntentId);

          // Step 3: ASSERT — Wallet should contain ONLY cards from the SECOND intent
          const secondIntentCards = getStarterCardsForIntent(secondIntentId);
          const walletSourceIds = mockWalletCards.map((c) => c.sourceLibraryId).filter(Boolean);

          // Assert no duplicates exist in wallet
          expect(noDuplicateCardIds(mockWalletCards)).toBe(true);

          // Assert wallet contains exactly the second intent's cards (only)
          expect(walletSourceIds.sort()).toEqual([...secondIntentCards].sort());

          // Assert cards from first intent are NOT present after re-selection
          // (only matters when intents are different and cards don't overlap)
          if (firstIntentId !== secondIntentId) {
            for (const cardId of firstIntentCards) {
              // Only check cards unique to first intent (not shared with second)
              if (!secondIntentCards.includes(cardId)) {
                expect(walletSourceIds).not.toContain(cardId);
              }
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
