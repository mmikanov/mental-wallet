import {
  getTagsForCard,
  getCardIdsByEmotion,
  setTagsForCard,
  getContextTags,
  getTimeTags,
  setContextTags,
  setTimeTags,
} from '../emotionTagService';
import { AppError } from '../../types/errors';
import type { EmotionType, ContextType, TimeType } from '../../types/index';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

describe('emotionTagService', () => {
  let mockDb: {
    getAllAsync: jest.Mock;
    runAsync: jest.Mock;
    withTransactionAsync: jest.Mock;
  };

  beforeEach(() => {
    mockDb = {
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue(undefined),
      withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
    };
    const { getDatabase } = require('../../data/database');
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTagsForCard', () => {
    it('returns emotion tags for a given card', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { id: 'tag-1', card_id: 'card-1', emotion: 'stressed' },
        { id: 'tag-2', card_id: 'card-1', emotion: 'anxious' },
      ]);

      const tags = await getTagsForCard('card-1');

      expect(tags).toEqual([
        { id: 'tag-1', cardId: 'card-1', emotion: 'stressed' },
        { id: 'tag-2', cardId: 'card-1', emotion: 'anxious' },
      ]);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE card_id = ?'),
        ['card-1']
      );
    });

    it('returns empty array when card has no emotion tags', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const tags = await getTagsForCard('card-no-tags');

      expect(tags).toEqual([]);
    });
  });

  describe('getCardIdsByEmotion', () => {
    it('returns unique card IDs for a given emotion', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { card_id: 'card-1' },
        { card_id: 'card-2' },
        { card_id: 'card-3' },
      ]);

      const cardIds = await getCardIdsByEmotion('stressed');

      expect(cardIds).toEqual(['card-1', 'card-2', 'card-3']);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE emotion = ?'),
        ['stressed']
      );
    });

    it('returns empty array when no cards match the emotion', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const cardIds = await getCardIdsByEmotion('numb');

      expect(cardIds).toEqual([]);
    });
  });

  describe('setTagsForCard', () => {
    it('validates minimum 1 emotion tag', async () => {
      await expect(setTagsForCard('card-1', [])).rejects.toThrow(AppError);
      await expect(setTagsForCard('card-1', [])).rejects.toThrow(
        /between 1 and 6 emotions/
      );
    });

    it('validates maximum 6 emotion tags', async () => {
      const tooMany: EmotionType[] = ['stressed', 'anxious', 'sad', 'angry', 'numb', 'overwhelmed', 'stressed' as EmotionType];
      await expect(setTagsForCard('card-1', tooMany)).rejects.toThrow(AppError);
      await expect(setTagsForCard('card-1', tooMany)).rejects.toThrow(
        /between 1 and 6 emotions/
      );
    });

    it('accepts 1 emotion tag', async () => {
      await setTagsForCard('card-1', ['stressed']);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM emotion_tags'),
        ['card-1']
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO emotion_tags'),
        expect.arrayContaining(['card-1', 'stressed'])
      );
    });

    it('accepts 4 emotion tags', async () => {
      const emotions: EmotionType[] = ['stressed', 'anxious', 'sad', 'angry'];
      await setTagsForCard('card-1', emotions);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      // 1 delete + 4 inserts
      expect(mockDb.runAsync).toHaveBeenCalledTimes(5);
    });

    it('deletes existing tags before inserting new ones', async () => {
      const callOrder: string[] = [];
      mockDb.runAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('DELETE')) callOrder.push('delete');
        if (sql.includes('INSERT')) callOrder.push('insert');
      });

      await setTagsForCard('card-1', ['stressed', 'anxious']);

      expect(callOrder).toEqual(['delete', 'insert', 'insert']);
    });
  });

  describe('getContextTags', () => {
    it('returns context tags for a given card', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { card_id: 'card-1', context: 'at_work' },
        { card_id: 'card-1', context: 'alone_at_home' },
      ]);

      const contexts = await getContextTags('card-1');

      expect(contexts).toEqual(['at_work', 'alone_at_home']);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('card_context_tags'),
        ['card-1']
      );
    });

    it('returns empty array when card has no context tags', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const contexts = await getContextTags('card-no-contexts');

      expect(contexts).toEqual([]);
    });
  });

  describe('getTimeTags', () => {
    it('returns time tags for a given card', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { card_id: 'card-1', time: '5_10_min' },
      ]);

      const times = await getTimeTags('card-1');

      expect(times).toEqual(['5_10_min']);
    });

    it('returns empty array when card has no time tags', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const times = await getTimeTags('card-no-times');

      expect(times).toEqual([]);
    });
  });

  describe('setContextTags', () => {
    it('validates maximum 4 context tags', async () => {
      const tooMany: ContextType[] = [
        'at_work',
        'with_family',
        'with_friends',
        'alone_at_home',
        'not_sure',
      ];
      await expect(setContextTags('card-1', tooMany)).rejects.toThrow(AppError);
      await expect(setContextTags('card-1', tooMany)).rejects.toThrow(
        /at most 4 contexts/
      );
    });

    it('accepts 0 context tags (clears all)', async () => {
      await setContextTags('card-1', []);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM card_context_tags'),
        ['card-1']
      );
      // Only 1 call (delete), no inserts
      expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    });

    it('accepts 4 context tags', async () => {
      const contexts: ContextType[] = ['at_work', 'with_family', 'with_friends', 'alone_at_home'];
      await setContextTags('card-1', contexts);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      // 1 delete + 4 inserts
      expect(mockDb.runAsync).toHaveBeenCalledTimes(5);
    });

    it('uses upsert logic (delete then insert)', async () => {
      const callOrder: string[] = [];
      mockDb.runAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('DELETE')) callOrder.push('delete');
        if (sql.includes('INSERT')) callOrder.push('insert');
      });

      await setContextTags('card-1', ['at_work', 'with_family']);

      expect(callOrder).toEqual(['delete', 'insert', 'insert']);
    });
  });

  describe('setTimeTags', () => {
    it('validates maximum 1 time tag', async () => {
      const tooMany: TimeType[] = ['1_2_min', '5_10_min'];
      await expect(setTimeTags('card-1', tooMany)).rejects.toThrow(AppError);
      await expect(setTimeTags('card-1', tooMany)).rejects.toThrow(
        /at most 1 time value/
      );
    });

    it('accepts 0 time tags (clears all)', async () => {
      await setTimeTags('card-1', []);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM card_time_tags'),
        ['card-1']
      );
      expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    });

    it('accepts 1 time tag', async () => {
      await setTimeTags('card-1', ['5_10_min']);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      // 1 delete + 1 insert
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    });

    it('uses upsert logic (delete then insert)', async () => {
      const callOrder: string[] = [];
      mockDb.runAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('DELETE')) callOrder.push('delete');
        if (sql.includes('INSERT')) callOrder.push('insert');
      });

      await setTimeTags('card-1', ['1_2_min']);

      expect(callOrder).toEqual(['delete', 'insert']);
    });
  });
});
