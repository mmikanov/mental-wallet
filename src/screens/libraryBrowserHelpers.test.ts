import { sortNewestFirst } from './libraryBrowserHelpers';
import type { CuratedCardDefinition } from '@/data/curatedLibrary';

/**
 * Minimal card factory for testing sort logic.
 */
function makeCard(overrides: Partial<CuratedCardDefinition> & { id: string }): CuratedCardDefinition {
  return {
    title: overrides.title ?? `Card ${overrides.id}`,
    description: overrides.description ?? 'Test description',
    iconType: 'emoji',
    iconValue: '🧪',
    backgroundType: 'color',
    backgroundValue: '#FFFFFF',
    categoryId: overrides.categoryId ?? 'grounding-calming',
    allowBackgroundCustomization: true,
    controls: [],
    ...overrides,
  };
}

describe('sortNewestFirst', () => {
  it('returns cards in reverse array order (newest-to-oldest)', () => {
    const cards = [
      makeCard({ id: 'oldest' }),
      makeCard({ id: 'middle' }),
      makeCard({ id: 'newest' }),
    ];

    const sorted = sortNewestFirst(cards);

    expect(sorted.map((c) => c.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('does not mutate the original array', () => {
    const cards = [
      makeCard({ id: 'a' }),
      makeCard({ id: 'b' }),
    ];
    const originalOrder = cards.map((c) => c.id);

    sortNewestFirst(cards);

    expect(cards.map((c) => c.id)).toEqual(originalOrder);
  });

  it('returns an empty array when given an empty array', () => {
    const sorted = sortNewestFirst([]);
    expect(sorted).toEqual([]);
  });

  it('handles a single card', () => {
    const cards = [makeCard({ id: 'solo' })];
    const sorted = sortNewestFirst(cards);
    expect(sorted).toEqual(cards);
  });

  it('preserves all card data after sorting', () => {
    const cards = [
      makeCard({ id: 'first', title: 'Alpha', categoryId: 'body-sensory' }),
      makeCard({ id: 'second', title: 'Beta', categoryId: 'cognitive-reframing' }),
    ];

    const sorted = sortNewestFirst(cards);

    expect(sorted[0].id).toBe('second');
    expect(sorted[0].title).toBe('Beta');
    expect(sorted[0].categoryId).toBe('cognitive-reframing');
    expect(sorted[1].id).toBe('first');
    expect(sorted[1].title).toBe('Alpha');
    expect(sorted[1].categoryId).toBe('body-sensory');
  });

  it('works with the full curated library size (11+ cards)', () => {
    const cards = Array.from({ length: 11 }, (_, i) =>
      makeCard({ id: `card-${i}` })
    );

    const sorted = sortNewestFirst(cards);

    expect(sorted).toHaveLength(11);
    expect(sorted[0].id).toBe('card-10');
    expect(sorted[10].id).toBe('card-0');
  });
});
