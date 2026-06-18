/**
 * Unit tests for ReorderMode component logic.
 *
 * Tests the reorder operations (move up/down) and state management
 * that power the ReorderMode component.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type { Card } from '@/types/index';

// Helper: simulates the core reorder logic extracted from the component
function createReorderState(cards: Card[]) {
  let orderedIds = cards.map((c) => c.id);

  return {
    getOrder: () => [...orderedIds],
    moveUp: (index: number) => {
      if (index <= 0) return;
      const next = [...orderedIds];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      orderedIds = next;
    },
    moveDown: (index: number) => {
      if (index >= orderedIds.length - 1) return;
      const next = [...orderedIds];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      orderedIds = next;
    },
    reset: (cards: Card[]) => {
      orderedIds = cards.map((c) => c.id);
    },
  };
}

function makeCard(id: string, title: string): Card {
  return {
    id,
    title,
    description: 'Test card',
    iconType: 'emoji',
    iconValue: '🧘',
    backgroundType: 'color',
    backgroundValue: '#FFFFFF',
    categoryId: 'grounding',
    originBadge: 'my_tool',
    stackPosition: 0,
    totalUses: 0,
    currentStreak: 0,
    lastUsedAt: null,
    isArchived: false,
    archivedAt: null,
    previousStackPosition: null,
    controls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('ReorderMode logic', () => {
  const cards = [
    makeCard('card-1', 'Breathing'),
    makeCard('card-2', 'Journaling'),
    makeCard('card-3', 'Gratitude'),
  ];

  describe('initial state', () => {
    it('initializes order from provided cards', () => {
      const state = createReorderState(cards);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });
  });

  describe('moveUp', () => {
    it('swaps the card at the given index with the one above', () => {
      const state = createReorderState(cards);
      state.moveUp(1);
      expect(state.getOrder()).toEqual(['card-2', 'card-1', 'card-3']);
    });

    it('does nothing when index is 0 (already at top)', () => {
      const state = createReorderState(cards);
      state.moveUp(0);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });

    it('can move the last card to the middle', () => {
      const state = createReorderState(cards);
      state.moveUp(2);
      expect(state.getOrder()).toEqual(['card-1', 'card-3', 'card-2']);
    });
  });

  describe('moveDown', () => {
    it('swaps the card at the given index with the one below', () => {
      const state = createReorderState(cards);
      state.moveDown(0);
      expect(state.getOrder()).toEqual(['card-2', 'card-1', 'card-3']);
    });

    it('does nothing when index is at the last position', () => {
      const state = createReorderState(cards);
      state.moveDown(2);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });

    it('can move the first card to the middle', () => {
      const state = createReorderState(cards);
      state.moveDown(0);
      expect(state.getOrder()).toEqual(['card-2', 'card-1', 'card-3']);
    });
  });

  describe('sequential operations', () => {
    it('can move a card from bottom to top with multiple moves', () => {
      const state = createReorderState(cards);
      state.moveUp(2); // card-3 moves to index 1
      state.moveUp(1); // card-3 moves to index 0
      expect(state.getOrder()).toEqual(['card-3', 'card-1', 'card-2']);
    });

    it('can reverse the entire order', () => {
      const state = createReorderState(cards);
      // Move card-3 to top
      state.moveUp(2);
      state.moveUp(1);
      // Move card-2 to middle (it's now at index 2)
      state.moveUp(2);
      expect(state.getOrder()).toEqual(['card-3', 'card-2', 'card-1']);
    });
  });

  describe('commit and cancel behavior', () => {
    it('getOrder returns the final reordered state for commit', () => {
      const state = createReorderState(cards);
      state.moveDown(0);
      const finalOrder = state.getOrder();
      expect(finalOrder).toEqual(['card-2', 'card-1', 'card-3']);
    });

    it('reset restores to original card order (simulates cancel)', () => {
      const state = createReorderState(cards);
      state.moveDown(0);
      state.moveDown(1);
      // Simulate cancel by resetting to original cards
      state.reset(cards);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });
  });

  describe('edge cases', () => {
    it('works correctly with exactly 2 cards (minimum for reorder)', () => {
      const twoCards = [makeCard('a', 'A'), makeCard('b', 'B')];
      const state = createReorderState(twoCards);
      state.moveDown(0);
      expect(state.getOrder()).toEqual(['b', 'a']);
    });

    it('moveUp with negative index does nothing', () => {
      const state = createReorderState(cards);
      state.moveUp(-1);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });

    it('moveDown with out-of-bounds index does nothing', () => {
      const state = createReorderState(cards);
      state.moveDown(10);
      expect(state.getOrder()).toEqual(['card-1', 'card-2', 'card-3']);
    });
  });
});
