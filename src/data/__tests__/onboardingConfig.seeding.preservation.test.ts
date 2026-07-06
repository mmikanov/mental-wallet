import * as fc from 'fast-check';
import { INTENT_OPTIONS, DEFAULT_STARTER_CARD_IDS } from '../onboardingConfig';
import { CURATED_LIBRARY } from '../curatedLibrary';

/**
 * Bug 4 Preservation: Other Intents Unchanged, Library Availability, Card Count
 *
 * **Validates: Requirements 3.10, 3.11, 3.12**
 *
 * These tests capture baseline behavior on UNFIXED code to ensure the Bug 4 fix
 * (replacing lib-daily-mood in routine/default) does not regress other intents.
 *
 * Observation-first methodology:
 * - "overwhelm", "organize", "explore" intents seed their existing card sets unchanged
 * - `lib-daily-mood` is available in CURATED_LIBRARY for manual addition
 * - Each intent seeds exactly the expected number of cards
 */

// --- Expected card sets for non-routine intents (these must NOT change) ---
const EXPECTED_CARD_SETS: Record<string, string[]> = {
  overwhelm: ['lib-grounding-54321', 'lib-box-breathing', 'lib-name-it-tame-it'],
  organize: ['lib-grounding-54321'],
  explore: ['lib-box-breathing', 'lib-thought-feeling-action', 'lib-win-of-day'],
};

const EXPECTED_CARD_COUNTS: Record<string, number> = {
  overwhelm: 3,
  organize: 1,
  explore: 3,
};

// --- Arbitraries ---
const nonRoutineIntentArb = fc.constantFrom('overwhelm', 'organize', 'explore');
const intentsWithThreeCardsArb = fc.constantFrom('overwhelm', 'explore');

describe('Bug 4 Preservation: Other Intents Unchanged, Library Availability, Card Count', () => {
  /**
   * **Validates: Requirements 3.10**
   *
   * For all intent IDs in ["overwhelm", "organize", "explore"],
   * card sets match current config exactly.
   */
  it('non-routine intents seed their expected card sets unchanged', () => {
    fc.assert(
      fc.property(nonRoutineIntentArb, (intentId) => {
        const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
        expect(mapping).toBeDefined();
        expect(mapping!.cardIds).toEqual(EXPECTED_CARD_SETS[intentId]);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.10**
   *
   * For all intent IDs in ["overwhelm", "organize", "explore"],
   * each set has the correct length.
   */
  it('non-routine intents have correct card count', () => {
    fc.assert(
      fc.property(nonRoutineIntentArb, (intentId) => {
        const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
        expect(mapping).toBeDefined();
        expect(mapping!.cardIds.length).toBe(EXPECTED_CARD_COUNTS[intentId]);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 3.11**
   *
   * Verify `lib-daily-mood` exists in CURATED_LIBRARY — it should remain
   * available for manual addition even after being removed from seed arrays.
   */
  it('lib-daily-mood exists in CURATED_LIBRARY for manual addition', () => {
    const dailyMoodCard = CURATED_LIBRARY.find((c) => c.id === 'lib-daily-mood');
    expect(dailyMoodCard).toBeDefined();
    expect(dailyMoodCard!.id).toBe('lib-daily-mood');
  });

  /**
   * **Validates: Requirements 3.12**
   *
   * For all intents that have 3 cards (overwhelm, explore), verify count remains 3.
   */
  it('intents with 3-card sets maintain exactly 3 cards', () => {
    fc.assert(
      fc.property(intentsWithThreeCardsArb, (intentId) => {
        const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intentId);
        expect(mapping).toBeDefined();
        expect(mapping!.cardIds).toHaveLength(3);
      }),
      { numRuns: 100 },
    );
  });
});
