/**
 * Preservation Property Tests — Library Browser Button States
 *
 * These tests verify the NON-BUGGY behavior paths of the Library Browser's
 * button-state logic. They capture baseline behavior that MUST remain unchanged
 * after the fix is applied.
 *
 * OBSERVATION (UNFIXED CODE):
 * - For a library card never added to wallet → "Add to wallet" (enabled)
 * - For a library card currently active in wallet (matched by title + originBadge) → "In wallet" (disabled)
 * - Non-library cards (origin "my_tool" or "community") are never affected by library browser logic
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import * as fc from 'fast-check';
import { getLibraryCardButtonState } from '../libraryBrowserHelpers';

// --- Arbitraries / Generators ---

/** Generate a valid library card ID (non-empty string) */
const libraryCardIdArb = fc.stringMatching(/^lib-[a-z]+-[a-z0-9]+$/).filter(s => s.length >= 5);

/** Generate a library card title (non-empty alphanumeric string) */
const libraryCardTitleArb = fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0);

/** Generate an active wallet card that does NOT match a given library card */
function nonMatchingActiveCardArb(excludeTitle: string, excludeLibraryId: string) {
  return fc.record({
    title: fc.string({ minLength: 1, maxLength: 80 }).filter(
      t => t !== excludeTitle
    ),
    originBadge: fc.constantFrom('library', 'my_tool', 'community'),
    sourceLibraryId: fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.string({ minLength: 5, maxLength: 40 }).filter(s => s !== excludeLibraryId)
    ),
  });
}

/** Generate an active wallet card that MATCHES a given library card by title + originBadge */
function matchingActiveCardByTitleArb(matchTitle: string) {
  return fc.record({
    title: fc.constant(matchTitle),
    originBadge: fc.constant('library' as string),
    sourceLibraryId: fc.oneof(fc.constant(null), fc.constant(undefined)),
  });
}

/** Generate an active wallet card that MATCHES by sourceLibraryId */
function matchingActiveCardBySourceIdArb(libraryCardId: string) {
  return fc.record({
    title: fc.string({ minLength: 1, maxLength: 80 }),
    originBadge: fc.constant('library' as string),
    sourceLibraryId: fc.constant(libraryCardId),
  });
}

/** Generate non-library origin cards (my_tool or community) */
const nonLibraryCardArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
  originBadge: fc.constantFrom('my_tool', 'community'),
  sourceLibraryId: fc.oneof(fc.constant(null), fc.constant(undefined)),
});

describe('LibraryBrowserScreen Preservation Properties', () => {
  describe('Property A: Library cards with no wallet instance → "Add to wallet"', () => {
    it('for all library cards with no matching active card, button state is "Add to wallet" (enabled)', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.array(nonLibraryCardArb, { minLength: 0, maxLength: 10 }),
          (libraryCardId, libraryCardTitle, unrelatedCards) => {
            // No archived cards exist (empty map — preservation scenario)
            const archivedLibraryCards = new Map<string, string>();

            // Active cards contain no match for this library card
            // (only non-library cards or cards with different titles/IDs)
            const activeCards = unrelatedCards;

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              activeCards,
              archivedLibraryCards
            );

            expect(result.label).toBe('Add to wallet');
            expect(result.disabled).toBe(false);
            expect(result.action).toBe('add');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('with some active library cards that have different titles, still shows "Add to wallet"', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 80 }),
              originBadge: fc.constantFrom('library', 'my_tool', 'community'),
              sourceLibraryId: fc.oneof(fc.constant(null), fc.constant(undefined), fc.string({ minLength: 5, maxLength: 40 })),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (libraryCardId, libraryCardTitle, activeCards) => {
            // Filter out any cards that would match
            const nonMatchingCards = activeCards.filter(
              c =>
                !(c.title === libraryCardTitle && c.originBadge === 'library') &&
                !(c.sourceLibraryId === libraryCardId)
            );

            const archivedLibraryCards = new Map<string, string>();

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              nonMatchingCards,
              archivedLibraryCards
            );

            expect(result.label).toBe('Add to wallet');
            expect(result.disabled).toBe(false);
            expect(result.action).toBe('add');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Property B: Library cards with active wallet instance → "In wallet" (disabled)', () => {
    it('for all library cards matched by title + originBadge "library", button is "In wallet" disabled', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.array(nonLibraryCardArb, { minLength: 0, maxLength: 5 }),
          (libraryCardId, libraryCardTitle, otherCards) => {
            // Create an active card that matches by title + originBadge
            const matchingCard = {
              title: libraryCardTitle,
              originBadge: 'library',
              sourceLibraryId: null as string | null | undefined,
            };

            const activeCards = [...otherCards, matchingCard];
            const archivedLibraryCards = new Map<string, string>();

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              activeCards,
              archivedLibraryCards
            );

            expect(result.label).toBe('In wallet');
            expect(result.disabled).toBe(true);
            expect(result.action).toBe('none');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('for all library cards matched by sourceLibraryId, button is "In wallet" disabled', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.string({ minLength: 1, maxLength: 80 }),
          fc.array(nonLibraryCardArb, { minLength: 0, maxLength: 5 }),
          (libraryCardId, libraryCardTitle, differentTitle, otherCards) => {
            // Create an active card that matches by sourceLibraryId
            // (even if title is different — simulating renamed card)
            const matchingCard = {
              title: differentTitle,
              originBadge: 'library',
              sourceLibraryId: libraryCardId,
            };

            const activeCards = [...otherCards, matchingCard];
            const archivedLibraryCards = new Map<string, string>();

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              activeCards,
              archivedLibraryCards
            );

            expect(result.label).toBe('In wallet');
            expect(result.disabled).toBe(true);
            expect(result.action).toBe('none');
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Property C: Non-library-origin cards are never affected by library browser logic', () => {
    it('library button state never references non-library cards for its decision', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.array(nonLibraryCardArb, { minLength: 1, maxLength: 15 }),
          (libraryCardId, libraryCardTitle, nonLibraryCards) => {
            // Wallet has ONLY non-library cards (my_tool and community)
            // Even if one has the same title as the library card, it shouldn't match
            // because originBadge is not 'library'
            const activeCards = nonLibraryCards.map(c => ({
              ...c,
              // Ensure none accidentally have originBadge 'library'
              originBadge: c.originBadge === 'library' ? 'my_tool' : c.originBadge,
            }));

            const archivedLibraryCards = new Map<string, string>();

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              activeCards,
              archivedLibraryCards
            );

            // Non-library cards should never cause "In wallet" state
            // The library card should show "Add to wallet" regardless of non-library cards
            expect(result.label).toBe('Add to wallet');
            expect(result.disabled).toBe(false);
            expect(result.action).toBe('add');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('non-library cards with matching titles but wrong originBadge do not trigger "In wallet"', () => {
      fc.assert(
        fc.property(
          libraryCardIdArb,
          libraryCardTitleArb,
          fc.constantFrom('my_tool' as const, 'community' as const),
          (libraryCardId, libraryCardTitle, nonLibraryOrigin) => {
            // A card exists with the SAME title but a non-library origin
            const activeCards = [
              {
                title: libraryCardTitle,
                originBadge: nonLibraryOrigin,
                sourceLibraryId: null as string | null | undefined,
              },
            ];

            const archivedLibraryCards = new Map<string, string>();

            const result = getLibraryCardButtonState(
              libraryCardId,
              libraryCardTitle,
              activeCards,
              archivedLibraryCards
            );

            // Should NOT show "In wallet" because the matching card is not a library card
            expect(result.label).toBe('Add to wallet');
            expect(result.disabled).toBe(false);
            expect(result.action).toBe('add');
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
