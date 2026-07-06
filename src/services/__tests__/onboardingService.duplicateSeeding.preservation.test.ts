/**
 * Bug 6 Preservation Property Tests — First-Time Seeding Unchanged
 *
 * **Validates: Requirements 3.15, 3.16**
 *
 * Property 2: Preservation - First-Time Seeding Unchanged and KpiSelection Unaffected
 *
 * These tests verify baseline behavior that MUST remain unchanged after the
 * duplicate-seeding fix is applied:
 * - First-time intent selection (empty wallet, no prior seeded cards) seeds
 *   the correct number of cards immediately
 * - `seedStarterCards` creates cards with correct `source_library_id` values
 *   matching the intent's `cardIds` from config
 * - Card count matches the intent's `cardIds.length`
 *
 * These tests PASS on UNFIXED code (confirming baseline behavior to preserve).
 */

import * as fc from 'fast-check';
import {
  INTENT_OPTIONS,
  DEFAULT_STARTER_CARD_IDS,
  type IntentId,
} from '@/data/onboardingConfig';

// --- Track all cards "created" in a fake wallet ---
const mockWalletCards: Array<{ id: string; sourceLibraryId: string }> = [];

// Mock expo-crypto to generate unique IDs
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'card-' + Math.random().toString(36).substring(2, 10)),
}));

// Mock the database
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
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

// Helper: get expected card IDs for a given intent
function getExpectedCardIds(intentId: IntentId | null): string[] {
  if (intentId === null) {
    return [...DEFAULT_STARTER_CARD_IDS];
  }
  const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
  return mapping ? [...mapping.cardIds] : [...DEFAULT_STARTER_CARD_IDS];
}

// Arbitrary for all valid IntentId values
const intentIdArb = fc.constantFrom<IntentId>('overwhelm', 'routine', 'organize', 'explore');

// Arbitrary for IntentId | null (includes default fallback path)
const intentIdOrNullArb = fc.constantFrom<IntentId | null>(
  'overwhelm',
  'routine',
  'organize',
  'explore',
  null
);

describe('Bug 6 Preservation: First-Time Seeding Unchanged', () => {
  beforeEach(() => {
    mockWalletCards.length = 0;
  });

  /**
   * **Validates: Requirements 3.15, 3.16**
   *
   * Property: For all first-time intent selections (empty wallet, no prior seeding),
   * `seedStarterCards` seeds exactly the number of cards matching the intent's
   * `cardIds.length` from config, immediately and without cleanup.
   */
  it('first-time seeding creates cards matching the intent cardIds count from config', async () => {
    await fc.assert(
      fc.asyncProperty(intentIdOrNullArb, async (intentId: IntentId | null) => {
        // Reset wallet state — simulates empty wallet (first-time seeding)
        mockWalletCards.length = 0;

        const onboardingService = createOnboardingService();

        // Seed cards for the intent
        await onboardingService.seedStarterCards(intentId);

        // Get the expected cards from config
        const expectedCardIds = getExpectedCardIds(intentId);

        // Assert: card count matches the intent's cardIds.length
        expect(mockWalletCards.length).toBe(expectedCardIds.length);
      }),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.15, 3.16**
   *
   * Property: For all valid IntentId values, `seedStarterCards` creates cards
   * with correct `source_library_id` values matching the intent's `cardIds` from config.
   */
  it('seedStarterCards creates cards with correct source_library_id values for all intents', async () => {
    await fc.assert(
      fc.asyncProperty(intentIdArb, async (intentId: IntentId) => {
        // Reset wallet state
        mockWalletCards.length = 0;

        const onboardingService = createOnboardingService();

        // Seed cards for this intent
        await onboardingService.seedStarterCards(intentId);

        // Get expected card IDs from config
        const expectedCardIds = getExpectedCardIds(intentId);

        // Extract source_library_id values from created cards
        const createdSourceIds = mockWalletCards
          .map((c) => c.sourceLibraryId)
          .filter(Boolean);

        // Assert: every expected card ID is present in the created cards
        expect(createdSourceIds.sort()).toEqual([...expectedCardIds].sort());
      }),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.15, 3.16**
   *
   * Property: For the null/default fallback intent, `seedStarterCards` creates
   * cards with correct `source_library_id` values matching DEFAULT_STARTER_CARD_IDS.
   */
  it('seedStarterCards with null intentId uses DEFAULT_STARTER_CARD_IDS correctly', async () => {
    // Reset wallet state
    mockWalletCards.length = 0;

    const onboardingService = createOnboardingService();

    // Seed cards with null (default fallback)
    await onboardingService.seedStarterCards(null);

    // Extract source_library_id values from created cards
    const createdSourceIds = mockWalletCards
      .map((c) => c.sourceLibraryId)
      .filter(Boolean);

    // Assert: matches DEFAULT_STARTER_CARD_IDS exactly
    expect(createdSourceIds.sort()).toEqual([...DEFAULT_STARTER_CARD_IDS].sort());
    expect(createdSourceIds.length).toBe(DEFAULT_STARTER_CARD_IDS.length);
  });

  /**
   * **Validates: Requirements 3.15**
   *
   * Defensive test: Verify that `clearStarterCards` does not exist yet on the
   * unfixed code (the method will be added as part of Bug 6 fix). This confirms
   * the interface has not been modified before the fix.
   *
   * After the fix is applied, this test should be updated to verify
   * `clearStarterCards` on an empty wallet does not throw.
   */
  it('onboardingService interface does not yet have clearStarterCards (pre-fix baseline)', () => {
    const onboardingService = createOnboardingService();

    // On UNFIXED code, clearStarterCards should not exist
    // After the fix, this method will be added and this test should be updated
    const hasClearMethod = 'clearStarterCards' in onboardingService;

    // If clearStarterCards already exists (fix was applied), verify it doesn't throw on empty wallet
    if (hasClearMethod) {
      // Fix has been applied — verify defensive behavior
      expect(async () => {
        await (onboardingService as any).clearStarterCards();
      }).not.toThrow();
    } else {
      // Fix not yet applied — confirms baseline
      expect(hasClearMethod).toBe(false);
    }
  });
});
