import * as fc from 'fast-check';
import {
  setTagsForCard,
  getTagsForCard,
  setContextTags,
  setTimeTags,
} from '../emotionTagService';
import type { EmotionType, ContextType, TimeType } from '../../types/index';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-' + Math.random().toString(36).substring(2, 10)),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const ALL_EMOTIONS: EmotionType[] = ['stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'];
const ALL_CONTEXTS: ContextType[] = ['at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'];
const ALL_TIMES: TimeType[] = ['1_2_min', '5_10_min'];

// --- Arbitraries ---

const emotionArb = fc.constantFrom<EmotionType>('stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb');

const validEmotionSetArb = fc.subarray(ALL_EMOTIONS, { minLength: 1, maxLength: 6 });

const invalidEmptySetArb = fc.constant([] as EmotionType[]);

const contextSetArb = fc.subarray(ALL_CONTEXTS, { maxLength: 4 });

const invalidContextSetArb = fc.constant([...ALL_CONTEXTS] as ContextType[]);

const validTimeSetArb = fc.subarray(ALL_TIMES, { maxLength: 1 });

const invalidTimeSetArb = fc.constant([...ALL_TIMES] as TimeType[]);

// --- In-memory store helpers ---

interface EmotionTagRow {
  id: string;
  card_id: string;
  emotion: string;
}

interface ContextTagRow {
  card_id: string;
  context: string;
}

interface TimeTagRow {
  card_id: string;
  time: string;
}

/**
 * Creates an in-memory store simulating the SQLite tables,
 * with a mock database that performs real inserts/deletes.
 */
function createMockDbWithStore() {
  const emotionTags: EmotionTagRow[] = [];
  const contextTags: ContextTagRow[] = [];
  const timeTags: TimeTagRow[] = [];

  const mockDb = {
    getAllAsync: jest.fn(async (sql: string, params: string[]) => {
      const cardId = params[0];
      if (sql.includes('emotion_tags')) {
        return emotionTags.filter((row) => row.card_id === cardId);
      }
      if (sql.includes('card_context_tags')) {
        return contextTags.filter((row) => row.card_id === cardId);
      }
      if (sql.includes('card_time_tags')) {
        return timeTags.filter((row) => row.card_id === cardId);
      }
      return [];
    }),
    runAsync: jest.fn(async (sql: string, params: string[]) => {
      if (sql.includes('DELETE FROM emotion_tags')) {
        const cardId = params[0];
        const indicesToRemove = emotionTags
          .map((row, i) => (row.card_id === cardId ? i : -1))
          .filter((i) => i >= 0)
          .reverse();
        for (const i of indicesToRemove) {
          emotionTags.splice(i, 1);
        }
      } else if (sql.includes('INSERT INTO emotion_tags')) {
        emotionTags.push({ id: params[0], card_id: params[1], emotion: params[2] });
      } else if (sql.includes('DELETE FROM card_context_tags')) {
        const cardId = params[0];
        const indicesToRemove = contextTags
          .map((row, i) => (row.card_id === cardId ? i : -1))
          .filter((i) => i >= 0)
          .reverse();
        for (const i of indicesToRemove) {
          contextTags.splice(i, 1);
        }
      } else if (sql.includes('INSERT INTO card_context_tags')) {
        contextTags.push({ card_id: params[0], context: params[1] });
      } else if (sql.includes('DELETE FROM card_time_tags')) {
        const cardId = params[0];
        const indicesToRemove = timeTags
          .map((row, i) => (row.card_id === cardId ? i : -1))
          .filter((i) => i >= 0)
          .reverse();
        for (const i of indicesToRemove) {
          timeTags.splice(i, 1);
        }
      } else if (sql.includes('INSERT INTO card_time_tags')) {
        timeTags.push({ card_id: params[0], time: params[1] });
      }
    }),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
  };

  return { emotionTags, contextTags, timeTags, mockDb };
}

describe('emotionTagService - Property Tests', () => {
  describe('Feature: emotion-first-onboarding, Property 10: Curated card emotion tag count constraint', () => {
    /**
     * **Validates: Requirements 8.1**
     *
     * For any tag set of length 1–6, persisting via setTagsForCard succeeds.
     * For length 0 or >6, it is rejected with a validation error.
     * Note: curated cards should be 1–4 (enforced at seed level), but
     * setTagsForCard allows user cards up to 6.
     */
    it('for any subset of 1–6 emotions, setTagsForCard succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(validEmotionSetArb, async (emotions) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Should not throw
          await expect(setTagsForCard('card-test', emotions)).resolves.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('for an empty emotion array, setTagsForCard throws validation error', async () => {
      await fc.assert(
        fc.asyncProperty(invalidEmptySetArb, async (emotions) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          await expect(setTagsForCard('card-test', emotions)).rejects.toThrow(
            /between 1 and 6 emotions/
          );
        }),
        { numRuns: 100 }
      );
    });

    it('for array with >6 entries (duplicates to exceed), setTagsForCard throws validation error', async () => {
      // Since there are only 6 unique emotions, we test the boundary by creating
      // an array of 7 items (with a duplicate).
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(validEmotionSetArb, emotionArb).map(([set, extra]) => [...ALL_EMOTIONS, extra]),
          async (emotions) => {
            const { mockDb } = createMockDbWithStore();
            mockGetDatabase.mockResolvedValue(mockDb as any);

            // Array length is 7, should reject
            expect(emotions.length).toBeGreaterThan(6);
            await expect(setTagsForCard('card-test', emotions)).rejects.toThrow(
              /between 1 and 6 emotions/
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 11: Card tag cardinality constraints', () => {
    /**
     * **Validates: Requirements 8.4**
     *
     * For any card, context tags ≤ 4 and time tags ≤ 1.
     * setContextTags succeeds for arrays of length 0–4 and rejects >4.
     * setTimeTags succeeds for arrays of length 0–1 and rejects >1.
     */
    it('for any context array with ≤4 entries, setContextTags succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(contextSetArb, async (contexts) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          await expect(setContextTags('card-test', contexts)).resolves.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('for context array with >4 entries, setContextTags throws validation error', async () => {
      await fc.assert(
        fc.asyncProperty(invalidContextSetArb, async (contexts) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          expect(contexts.length).toBeGreaterThan(4);
          await expect(setContextTags('card-test', contexts)).rejects.toThrow(
            /at most 4 contexts/
          );
        }),
        { numRuns: 100 }
      );
    });

    it('for any time array with ≤1 entry, setTimeTags succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(validTimeSetArb, async (times) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          await expect(setTimeTags('card-test', times)).resolves.toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('for time array with >1 entry, setTimeTags throws validation error', async () => {
      await fc.assert(
        fc.asyncProperty(invalidTimeSetArb, async (times) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          expect(times.length).toBeGreaterThan(1);
          await expect(setTimeTags('card-test', times)).rejects.toThrow(
            /at most 1 time value/
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Feature: emotion-first-onboarding, Property 13: Emotion tag save/edit round-trip', () => {
    /**
     * **Validates: Requirements 9.3, 9.4**
     *
     * For any valid subset of emotions (1–6), calling setTagsForCard(cardId, emotions)
     * then getTagsForCard(cardId) returns the same set of emotions.
     */
    it('for any valid subset of emotions, save then read returns exact same set', async () => {
      await fc.assert(
        fc.asyncProperty(validEmotionSetArb, async (emotions) => {
          const { mockDb } = createMockDbWithStore();
          mockGetDatabase.mockResolvedValue(mockDb as any);

          const cardId = 'card-roundtrip';

          // Save
          await setTagsForCard(cardId, emotions);

          // Read
          const tags = await getTagsForCard(cardId);

          // Extract just the emotion values and sort for comparison
          const readEmotions = tags.map((t) => t.emotion).sort();
          const expectedEmotions = [...emotions].sort();

          expect(readEmotions).toEqual(expectedEmotions);
        }),
        { numRuns: 100 }
      );
    });

    it('overwriting tags with a new set returns only the new set', async () => {
      await fc.assert(
        fc.asyncProperty(
          validEmotionSetArb,
          validEmotionSetArb,
          async (firstSet, secondSet) => {
            const { mockDb } = createMockDbWithStore();
            mockGetDatabase.mockResolvedValue(mockDb as any);

            const cardId = 'card-overwrite';

            // Save first set
            await setTagsForCard(cardId, firstSet);

            // Overwrite with second set
            await setTagsForCard(cardId, secondSet);

            // Read
            const tags = await getTagsForCard(cardId);
            const readEmotions = tags.map((t) => t.emotion).sort();
            const expectedEmotions = [...secondSet].sort();

            expect(readEmotions).toEqual(expectedEmotions);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
