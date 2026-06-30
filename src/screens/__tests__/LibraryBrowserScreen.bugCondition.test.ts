/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - Archived Library Cards Show "Add to wallet"
 * Instead of "Restore from archive"
 *
 * **Validates: Requirements 1.1, 2.1, 2.2, 2.3**
 *
 * This test encodes the EXPECTED (correct) behavior: when an archived instance
 * of a library card exists, the Library Browser should show "Restore from archive"
 * and call cardService.restore() on the existing instance.
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 */

import * as fc from 'fast-check';
import { getLibraryCardButtonState } from '../libraryBrowserHelpers';
import type { Card } from '@/types/index';

/**
 * Helper: create a minimal Card object for testing purposes.
 */
function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id ?? 'card-default',
    title: overrides.title ?? 'Test Card',
    description: overrides.description ?? 'A test card',
    iconType: overrides.iconType ?? 'emoji',
    iconValue: overrides.iconValue ?? '🧘',
    backgroundType: overrides.backgroundType ?? 'color',
    backgroundValue: overrides.backgroundValue ?? '#FFFFFF',
    categoryId: overrides.categoryId ?? 'grounding-calming',
    originBadge: overrides.originBadge ?? 'library',
    stackPosition: overrides.stackPosition ?? 0,
    totalUses: overrides.totalUses ?? 5,
    currentStreak: overrides.currentStreak ?? 3,
    lastUsedAt: overrides.lastUsedAt ?? '2024-06-01T10:00:00Z',
    isArchived: overrides.isArchived ?? false,
    archivedAt: overrides.archivedAt ?? null,
    previousStackPosition: overrides.previousStackPosition ?? null,
    allowBackgroundCustomization: overrides.allowBackgroundCustomization ?? false,
    sourceLibraryId: overrides.sourceLibraryId ?? null,
    controls: overrides.controls ?? [],
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00Z',
  };
}

/**
 * Arbitrary: generates a valid library card ID (non-empty string simulating
 * curated library card IDs like "lib-grounding-54321").
 */
const arbLibraryCardId = fc.stringMatching(/^lib-[a-z]+-[0-9]{3,6}$/);

/**
 * Arbitrary: generates a card title (non-empty string, max 80 chars).
 */
const arbCardTitle = fc.string({ minLength: 1, maxLength: 80 });

/**
 * Arbitrary: generates an archived card instance ID.
 */
const arbArchivedInstanceId = fc.stringMatching(/^card-[a-z0-9]{4,12}$/);

/**
 * Arbitrary: generates usage statistics for an archived card.
 */
const arbUsageStats = fc.record({
  totalUses: fc.integer({ min: 0, max: 1000 }),
  currentStreak: fc.integer({ min: 0, max: 365 }),
  lastUsedAt: fc.option(
    fc.date({ min: new Date('2023-01-01'), max: new Date('2025-01-01') }).map((d) => d.toISOString()),
    { nil: null }
  ),
});

describe('LibraryBrowserScreen - Bug Condition Exploration', () => {
  describe('Property 1: Bug Condition - Archived Library Cards Show "Restore from archive"', () => {
    /**
     * **Validates: Requirements 1.1, 2.1, 2.2, 2.3**
     *
     * For any library card ID where an archived instance with matching
     * source_library_id exists in the database AND no active card exists
     * in the wallet for that library card, the button label MUST be
     * "Restore from archive" (not "Add to wallet").
     */
    it('for all archived library cards with no active instance, button shows "Restore from archive"', () => {
      fc.assert(
        fc.property(
          arbLibraryCardId,
          arbCardTitle,
          arbArchivedInstanceId,
          (libraryCardId, cardTitle, archivedInstanceId) => {
            // Setup: archived library card exists, no active card in wallet
            const activeCards: Card[] = []; // No active cards
            const archivedLibraryCards = new Map<string, string>([
              [libraryCardId, archivedInstanceId],
            ]);

            const result = getLibraryCardButtonState(
              libraryCardId,
              cardTitle,
              activeCards,
              archivedLibraryCards
            );

            // EXPECTED: button should show "Restore from archive"
            expect(result.label).toBe('Restore from archive');
            expect(result.disabled).toBe(false);
            expect(result.action).toBe('restore');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     *
     * For any archived library card, tapping "Restore from archive" should
     * invoke restore on the existing archived instance (not create a new card).
     * The button state must include the archived instance ID so the handler
     * knows which card to restore.
     */
    it('for all archived library cards, button state includes archivedInstanceId for restore', () => {
      fc.assert(
        fc.property(
          arbLibraryCardId,
          arbCardTitle,
          arbArchivedInstanceId,
          (libraryCardId, cardTitle, archivedInstanceId) => {
            const activeCards: Card[] = [];
            const archivedLibraryCards = new Map<string, string>([
              [libraryCardId, archivedInstanceId],
            ]);

            const result = getLibraryCardButtonState(
              libraryCardId,
              cardTitle,
              activeCards,
              archivedLibraryCards
            );

            // EXPECTED: result must include the archived instance ID
            // so the handler calls cardService.restore(archivedInstanceId)
            expect(result.archivedInstanceId).toBe(archivedInstanceId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 2.3**
     *
     * For any archived library card with usage history (totalUses, currentStreak,
     * lastUsedAt), the restore action preserves data by restoring the existing
     * card instance. The button state action must be 'restore' (not 'add').
     */
    it('for all archived library cards with usage history, action is restore (not add/create)', () => {
      fc.assert(
        fc.property(
          arbLibraryCardId,
          arbCardTitle,
          arbArchivedInstanceId,
          arbUsageStats,
          (libraryCardId, cardTitle, archivedInstanceId, _usageStats) => {
            // The card has usage history - restore must preserve it
            const activeCards: Card[] = [];
            const archivedLibraryCards = new Map<string, string>([
              [libraryCardId, archivedInstanceId],
            ]);

            const result = getLibraryCardButtonState(
              libraryCardId,
              cardTitle,
              activeCards,
              archivedLibraryCards
            );

            // EXPECTED: action is 'restore', not 'add'
            // 'add' would call cardService.create() which discards history
            // 'restore' calls cardService.restore() preserving history
            expect(result.action).not.toBe('add');
            expect(result.action).toBe('restore');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 1.1, 2.1**
     *
     * Even when other active cards exist in the wallet (but none match this
     * specific library card), an archived instance should still be detected
     * and "Restore from archive" shown.
     */
    it('archived card detected even with unrelated active cards in wallet', () => {
      fc.assert(
        fc.property(
          arbLibraryCardId,
          arbCardTitle,
          arbArchivedInstanceId,
          fc.array(arbCardTitle, { minLength: 1, maxLength: 5 }),
          (libraryCardId, cardTitle, archivedInstanceId, otherTitles) => {
            // Other active cards exist but none match this library card's title
            const filteredTitles = otherTitles.filter((t) => t !== cardTitle);
            const activeCards: Card[] = filteredTitles.map((title, i) =>
              makeCard({
                id: `other-card-${i}`,
                title,
                originBadge: 'library',
                sourceLibraryId: `lib-other-${i}`,
              })
            );

            const archivedLibraryCards = new Map<string, string>([
              [libraryCardId, archivedInstanceId],
            ]);

            const result = getLibraryCardButtonState(
              libraryCardId,
              cardTitle,
              activeCards,
              archivedLibraryCards
            );

            // EXPECTED: "Restore from archive" even with other cards present
            expect(result.label).toBe('Restore from archive');
            expect(result.action).toBe('restore');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
