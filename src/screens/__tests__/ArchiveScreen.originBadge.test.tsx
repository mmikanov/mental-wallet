/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - Origin Badge Missing for All Archived Cards
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * This test encodes the EXPECTED (correct) behavior: when an archived card
 * with an originBadge value is rendered in the Archive screen, the corresponding
 * badge text ("Library", "My Tool", or "Community") should be visible.
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 */

import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import * as fc from 'fast-check';
import type { Card, OriginBadge } from '@/types/index';

// --- Mocks ---

jest.mock('../../services/cardService', () => ({
  createCardService: () => ({
    restore: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  }),
}));

let mockGetAllAsync: jest.Mock;

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      getAllAsync: (...args: unknown[]) => mockGetAllAsync(...args),
    })
  ),
}));

import ArchiveScreen from '../ArchiveScreen';

// --- Helpers ---

const mockNavigation = { goBack: jest.fn() } as any;
const mockRoute = { key: 'Archive-test', name: 'Archive' as const, params: undefined };

const ORIGIN_LABEL_MAP: Record<OriginBadge, string> = {
  library: 'Library',
  my_tool: 'My Tool',
  community: 'Community',
};

const CATEGORY_IDS = [
  'grounding-calming',
  'cognitive-reframing',
  'body-sensory',
  'daily-checkin-journaling',
  'self-compassion-reminders',
  'lightweight-connection',
];

/**
 * Convert a Card object to the raw DB row format returned by getAllAsync.
 */
function cardToDbRow(card: Card): Record<string, unknown> {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    icon_type: card.iconType,
    icon_value: card.iconValue,
    background_type: card.backgroundType,
    background_value: card.backgroundValue,
    category_id: card.categoryId,
    origin_badge: card.originBadge,
    stack_position: card.stackPosition,
    total_uses: card.totalUses,
    current_streak: card.currentStreak,
    last_used_at: card.lastUsedAt,
    is_archived: 1,
    archived_at: card.archivedAt,
    previous_stack_position: card.previousStackPosition,
    allow_background_customization: card.allowBackgroundCustomization ? 1 : 0,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

// --- Arbitraries ---

/**
 * Generates a valid archived Card with a random originBadge value.
 * Uses fc.record with all required Card fields.
 */
const arbArchivedCard: fc.Arbitrary<Card> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  iconType: fc.constant('emoji' as const),
  iconValue: fc.constantFrom('🧘', '💪', '🌿', '📝', '❤️', '🤝'),
  backgroundType: fc.constant('color' as const),
  backgroundValue: fc.constantFrom('#FFFFFF', '#F0F0F0', '#E8E8E8'),
  categoryId: fc.constantFrom(...CATEGORY_IDS),
  originBadge: fc.constantFrom('library' as OriginBadge, 'my_tool' as OriginBadge, 'community' as OriginBadge),
  stackPosition: fc.constant(-1),
  totalUses: fc.integer({ min: 0, max: 500 }),
  currentStreak: fc.integer({ min: 0, max: 100 }),
  lastUsedAt: fc.option(
    fc.date({ min: new Date('2023-01-01'), max: new Date('2025-01-01') }).map((d) => d.toISOString()),
    { nil: null }
  ),
  isArchived: fc.constant(true as const),
  archivedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-01-01') }).map((d) => d.toISOString()),
  previousStackPosition: fc.option(fc.integer({ min: 0, max: 20 }), { nil: null }),
  allowBackgroundCustomization: fc.boolean(),
  controls: fc.constant([] as Card['controls']),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-06-01T00:00:00Z'),
}) as fc.Arbitrary<Card>;

// --- Category label mapping (mirrors ArchiveScreen.getCategoryLabel) ---

const CATEGORY_LABEL_MAP: Record<string, string> = {
  'grounding-calming': 'Grounding & Calming',
  'cognitive-reframing': 'Cognitive Reframing',
  'body-sensory': 'Body & Sensory',
  'daily-checkin-journaling': 'Daily Check-In',
  'self-compassion-reminders': 'Self-Compassion',
  'lightweight-connection': 'Connection',
};

function getCategoryLabel(categoryId: string): string {
  return CATEGORY_LABEL_MAP[categoryId] || categoryId;
}

// --- Tests ---

describe('ArchiveScreen - Bug Condition Exploration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync = jest.fn();
  });

  describe('Property 1: Bug Condition - Origin Badge Missing for All Archived Cards', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     *
     * For any archived card with originBadge in ['library', 'my_tool', 'community'],
     * the rendered ArchiveScreen MUST display the corresponding badge label
     * ("Library", "My Tool", or "Community").
     *
     * EXPECTED TO FAIL on unfixed code — the badge text is never rendered.
     */
    it('for all archived cards with an originBadge, the correct badge label is rendered', async () => {
      await fc.assert(
        fc.asyncProperty(arbArchivedCard, async (card) => {
          mockGetAllAsync.mockResolvedValue([cardToDbRow(card)]);

          await render(
            <ArchiveScreen navigation={mockNavigation} route={mockRoute} />
          );

          // Wait for the card title to confirm data loaded
          await waitFor(() => {
            expect(screen.queryByText(card.title)).not.toBeNull();
          });

          const expectedLabel = ORIGIN_LABEL_MAP[card.originBadge];

          // ASSERT: The origin badge label is visible
          expect(screen.queryByText(expectedLabel)).not.toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 60000);

    /**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     *
     * For any archived card with an originBadge, an element with the correct
     * accessibilityLabel ("Origin: Library" / "Origin: My Tool" / "Origin: Community")
     * MUST exist in the rendered output.
     *
     * EXPECTED TO FAIL on unfixed code — no accessibility annotation exists.
     */
    it('for all archived cards, an accessibility label for the origin badge exists', async () => {
      await fc.assert(
        fc.asyncProperty(arbArchivedCard, async (card) => {
          mockGetAllAsync.mockResolvedValue([cardToDbRow(card)]);

          await render(
            <ArchiveScreen navigation={mockNavigation} route={mockRoute} />
          );

          // Wait for the card title to confirm data loaded
          await waitFor(() => {
            expect(screen.queryByText(card.title)).not.toBeNull();
          });

          const expectedLabel = ORIGIN_LABEL_MAP[card.originBadge];
          const expectedA11yLabel = `Origin: ${expectedLabel}`;

          // ASSERT: accessibility label exists for the badge
          expect(screen.queryByLabelText(expectedA11yLabel)).not.toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 60000);
  });
});

// --- Preservation Property Tests ---

describe('ArchiveScreen - Preservation Properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync = jest.fn();
  });

  describe('Property 2: Preservation - Existing Card Layout and Functionality Unchanged', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
     *
     * For any archived card, the rendered output MUST contain:
     * - The card's title text
     * - The category label from getCategoryLabel(card.categoryId)
     * - A "Restore to Wallet" button with correct accessibility label
     * - A "Delete" button with correct accessibility label
     *
     * These tests PASS on unfixed code — they confirm baseline behavior to preserve.
     */
    it('for all archived cards, the card title, category label, and action buttons are rendered', async () => {
      await fc.assert(
        fc.asyncProperty(arbArchivedCard, async (card) => {
          mockGetAllAsync.mockResolvedValue([cardToDbRow(card)]);

          render(
            <ArchiveScreen navigation={mockNavigation} route={mockRoute} />
          );

          // Wait for the card title to confirm data loaded
          await waitFor(() => {
            expect(screen.queryByText(card.title)).not.toBeNull();
          });

          // ASSERT: Card title is rendered
          expect(screen.queryByText(card.title)).not.toBeNull();

          // ASSERT: Category label is rendered
          const expectedCategoryLabel = getCategoryLabel(card.categoryId);
          expect(screen.queryByText(expectedCategoryLabel)).not.toBeNull();

          // ASSERT: "Restore to Wallet" button exists with correct accessibility label
          const restoreA11yLabel = `Restore ${card.title} to wallet`;
          expect(screen.queryByLabelText(restoreA11yLabel)).not.toBeNull();

          // ASSERT: "Delete" button exists with correct accessibility label
          const deleteA11yLabel = `Delete ${card.title} permanently`;
          expect(screen.queryByLabelText(deleteA11yLabel)).not.toBeNull();
        }),
        { numRuns: 20 }
      );
    }, 60000);

    /**
     * **Validates: Requirements 3.1**
     *
     * For any archived card with a lastUsedAt value, the last-used text is rendered.
     * For cards without lastUsedAt, "Never used" is shown.
     */
    it('for all archived cards, last-used text renders correctly based on lastUsedAt', async () => {
      await fc.assert(
        fc.asyncProperty(arbArchivedCard, async (card) => {
          mockGetAllAsync.mockResolvedValue([cardToDbRow(card)]);

          render(
            <ArchiveScreen navigation={mockNavigation} route={mockRoute} />
          );

          // Wait for the card title to confirm data loaded
          await waitFor(() => {
            expect(screen.queryByText(card.title)).not.toBeNull();
          });

          if (card.lastUsedAt === null) {
            // ASSERT: "Never used" text is rendered
            expect(screen.queryByText('Never used')).not.toBeNull();
          } else {
            // ASSERT: "Last used:" prefix is present
            const date = new Date(card.lastUsedAt);
            const formatted = `Last used: ${date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`;
            expect(screen.queryByText(formatted)).not.toBeNull();
          }
        }),
        { numRuns: 20 }
      );
    }, 60000);

    /**
     * **Validates: Requirements 3.4**
     *
     * When archivedCards is empty, the "No archived cards" message displays.
     */
    it('displays empty state message when no archived cards exist', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      render(
        <ArchiveScreen navigation={mockNavigation} route={mockRoute} />
      );

      await waitFor(() => {
        expect(screen.queryByText('No archived cards')).not.toBeNull();
      });

      // ASSERT: The empty state explanation is also shown
      expect(
        screen.queryByText(
          'Cards you archive from your wallet will appear here. You can restore them any time.'
        )
      ).not.toBeNull();
    }, 30000);
  });
});
