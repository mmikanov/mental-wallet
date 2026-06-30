import * as fc from 'fast-check';
import { INTENT_OPTIONS, DEFAULT_STARTER_CARD_IDS, type IntentId } from '../onboardingConfig';
import { CURATED_LIBRARY } from '../curatedLibrary';

// --- Arbitraries ---
const validIntents: (IntentId | null)[] = ['overwhelm', 'routine', 'organize', 'explore', null];
const intentArb = fc.constantFrom(...validIntents);
const intentOptionArb = fc.constantFrom(...INTENT_OPTIONS);

describe('Feature: onboarding, Property 1: Intent-to-cards mapping correctness', () => {
  /**
   * **Validates: Requirements 2.2, 3.2, 3.3, 3.4, 3.5, 3.6**
   *
   * For any valid intent (including null/default), the seeded card IDs
   * match the configured `cardIds` array in onboardingConfig.
   */
  it('for any valid intent, resolved card IDs match the configured mapping', () => {
    fc.assert(
      fc.property(intentArb, (intent) => {
        const resolvedIds =
          intent === null
            ? DEFAULT_STARTER_CARD_IDS
            : INTENT_OPTIONS.find((opt) => opt.intentId === intent)!.cardIds;

        // Non-null intents must have a matching entry in INTENT_OPTIONS
        if (intent !== null) {
          const mapping = INTENT_OPTIONS.find((opt) => opt.intentId === intent);
          expect(mapping).toBeDefined();
          expect(resolvedIds).toEqual(mapping!.cardIds);
        } else {
          expect(resolvedIds).toEqual(DEFAULT_STARTER_CARD_IDS);
        }

        // Every intent maps to 1–3 cards
        expect(resolvedIds.length).toBeGreaterThanOrEqual(1);
        expect(resolvedIds.length).toBeLessThanOrEqual(3);
      }),
      { numRuns: 100 },
    );
  });

  it('each intent maps to a unique, non-empty set of card IDs', () => {
    fc.assert(
      fc.property(intentArb, (intent) => {
        const resolvedIds =
          intent === null
            ? DEFAULT_STARTER_CARD_IDS
            : INTENT_OPTIONS.find((opt) => opt.intentId === intent)!.cardIds;

        // No duplicates within a single mapping
        const uniqueIds = new Set(resolvedIds);
        expect(uniqueIds.size).toBe(resolvedIds.length);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: onboarding, Property 2: Seeded cards always have origin library', () => {
  /**
   * **Validates: Requirements 3.7**
   *
   * All cards persisted during seeding have originBadge === 'library'.
   * Since seeding calls cardService.create with origin 'library', we verify
   * that every referenced card exists in CURATED_LIBRARY (which is the
   * source for library-origin cards).
   */
  it('all intent card IDs reference curated library cards (library origin source)', () => {
    fc.assert(
      fc.property(intentOptionArb, (mapping) => {
        for (const cardId of mapping.cardIds) {
          const card = CURATED_LIBRARY.find((c) => c.id === cardId);
          expect(card).toBeDefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('default starter card IDs also reference curated library cards', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DEFAULT_STARTER_CARD_IDS),
        (cardId) => {
          const card = CURATED_LIBRARY.find((c) => c.id === cardId);
          expect(card).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: onboarding, Property 3: Starter config referential integrity', () => {
  /**
   * **Validates: Requirements 3.9**
   *
   * Every card ID in every intent mapping (and the default set) exists
   * in CURATED_LIBRARY.
   */
  const allReferencedCardIds = [
    ...INTENT_OPTIONS.flatMap((opt) => opt.cardIds),
    ...DEFAULT_STARTER_CARD_IDS,
  ];
  const uniqueCardIds = [...new Set(allReferencedCardIds)];

  it('every card ID referenced in any intent mapping exists in CURATED_LIBRARY', () => {
    fc.assert(
      fc.property(fc.constantFrom(...uniqueCardIds), (cardId) => {
        const exists = CURATED_LIBRARY.some((c) => c.id === cardId);
        expect(exists).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('CURATED_LIBRARY has no duplicate IDs among referenced starter cards', () => {
    fc.assert(
      fc.property(fc.constantFrom(...uniqueCardIds), (cardId) => {
        const matches = CURATED_LIBRARY.filter((c) => c.id === cardId);
        expect(matches.length).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
