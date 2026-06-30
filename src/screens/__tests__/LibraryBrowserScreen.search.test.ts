/**
 * Unit tests for Library Browser search functionality.
 *
 * Validates: Requirements 1.1
 * - Case-insensitive partial match against card title, description, or category name
 * - Triggers after 1 character is entered
 * - Search stacks with category filter
 */

import { SEED_CATEGORIES } from '@/data/seeds';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

// Extract the search logic for testability
function searchLibrary(
  cards: CuratedCardDefinition[],
  query: string,
  categoryMap: Record<string, { name: string; colorHex: string }>
): CuratedCardDefinition[] {
  if (query.length < 1) return cards;
  const q = query.toLowerCase();
  return cards.filter((c) => {
    const categoryName = categoryMap[c.categoryId]?.name ?? '';
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      categoryName.toLowerCase().includes(q)
    );
  });
}

// Build category map from seed data
const categoryMap: Record<string, { name: string; colorHex: string }> = {};
for (const cat of SEED_CATEGORIES) {
  categoryMap[cat.id] = { name: cat.name, colorHex: cat.colorHex };
}

// Test fixtures
const MOCK_CARDS: CuratedCardDefinition[] = [
  {
    id: 'test-1',
    title: 'Deep Breathing',
    description: 'A calming breathing exercise',
    iconType: 'emoji',
    iconValue: '🌬️',
    backgroundType: 'color',
    backgroundValue: '#6B9EC4',
    categoryId: 'grounding-calming',
    allowBackgroundCustomization: false,
    controls: [],
  },
  {
    id: 'test-2',
    title: 'Thought Record',
    description: 'Challenge negative thoughts with evidence',
    iconType: 'emoji',
    iconValue: '📝',
    backgroundType: 'color',
    backgroundValue: '#8B7EC8',
    categoryId: 'cognitive-reframing',
    allowBackgroundCustomization: false,
    controls: [],
  },
  {
    id: 'test-3',
    title: 'Body Scan',
    description: 'Progressive muscle relaxation technique',
    iconType: 'emoji',
    iconValue: '🧘',
    backgroundType: 'color',
    backgroundValue: '#E88D67',
    categoryId: 'body-sensory',
    allowBackgroundCustomization: false,
    controls: [],
  },
];

describe('Library Search', () => {
  describe('empty query returns all cards', () => {
    it('returns all cards when query is empty string', () => {
      const result = searchLibrary(MOCK_CARDS, '', categoryMap);
      expect(result).toHaveLength(MOCK_CARDS.length);
      expect(result).toEqual(MOCK_CARDS);
    });
  });

  describe('triggers after 1 character', () => {
    it('filters with a single character query', () => {
      // 'd' should match "Deep Breathing"
      const result = searchLibrary(MOCK_CARDS, 'd', categoryMap);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((c) => c.title === 'Deep Breathing')).toBe(true);
    });
  });

  describe('case-insensitive matching', () => {
    it('matches title regardless of case', () => {
      const lower = searchLibrary(MOCK_CARDS, 'deep breathing', categoryMap);
      const upper = searchLibrary(MOCK_CARDS, 'DEEP BREATHING', categoryMap);
      const mixed = searchLibrary(MOCK_CARDS, 'Deep Breathing', categoryMap);
      expect(lower).toEqual(upper);
      expect(upper).toEqual(mixed);
    });

    it('matches description regardless of case', () => {
      const result = searchLibrary(MOCK_CARDS, 'CALMING BREATHING', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-1');
    });
  });

  describe('partial matching', () => {
    it('matches partial title text', () => {
      const result = searchLibrary(MOCK_CARDS, 'breath', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Deep Breathing');
    });

    it('matches partial description text', () => {
      const result = searchLibrary(MOCK_CARDS, 'negative thoughts', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Thought Record');
    });
  });

  describe('matches against category name', () => {
    it('returns cards belonging to a matching category', () => {
      // Search for "Grounding" which is part of "Grounding & Calming" category
      const result = searchLibrary(MOCK_CARDS, 'grounding', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('grounding-calming');
    });

    it('matches partial category name', () => {
      // "Cognitive" is part of "Cognitive Reframing"
      const result = searchLibrary(MOCK_CARDS, 'cognitive', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('cognitive-reframing');
    });
  });

  describe('no results', () => {
    it('returns empty array when no cards match', () => {
      const result = searchLibrary(MOCK_CARDS, 'xyznonexistent', categoryMap);
      expect(result).toHaveLength(0);
    });
  });

  describe('search stacks with category filter', () => {
    it('searching within a filtered category returns only matching cards in that category', () => {
      // Simulate category filter: only grounding-calming cards
      const categoryFiltered = MOCK_CARDS.filter(
        (c) => c.categoryId === 'grounding-calming'
      );
      // Then apply search on top
      const result = searchLibrary(categoryFiltered, 'breath', categoryMap);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Deep Breathing');
    });

    it('searching within a filtered category returns empty if query does not match', () => {
      // Filter to body-sensory category
      const categoryFiltered = MOCK_CARDS.filter(
        (c) => c.categoryId === 'body-sensory'
      );
      // Search for something in a different category
      const result = searchLibrary(categoryFiltered, 'breathing', categoryMap);
      expect(result).toHaveLength(0);
    });
  });
});
