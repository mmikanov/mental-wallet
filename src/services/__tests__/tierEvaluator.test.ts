import {
  determineTier,
  createTierEvaluator,
  TIER_THRESHOLDS,
  InsightTier,
} from '../tierEvaluator';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock the settings service
jest.mock('../settingsService', () => ({
  getIncludeArchivedTools: jest.fn(),
}));

import { getDatabase } from '../../data/database';
import { getIncludeArchivedTools } from '../settingsService';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockGetIncludeArchivedTools = getIncludeArchivedTools as jest.MockedFunction<typeof getIncludeArchivedTools>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

describe('TierEvaluator', () => {
  // --- determineTier() boundary tests ---

  describe('determineTier() — threshold boundaries', () => {
    // Nascent threshold: checkIns >= 3, toolUses >= 3, distinctTools >= 1
    it('returns "nascent" at exactly nascent threshold (3, 3, 1)', () => {
      expect(determineTier(3, 3, 1)).toBe('nascent');
    });

    it('returns "below_nascent" one below nascent checkIns (2, 3, 1)', () => {
      expect(determineTier(2, 3, 1)).toBe('below_nascent');
    });

    it('returns "below_nascent" one below nascent toolUses (3, 2, 1)', () => {
      expect(determineTier(3, 2, 1)).toBe('below_nascent');
    });

    // Preliminary threshold: checkIns >= 7, toolUses >= 5, distinctTools >= 2
    it('returns "preliminary" at exactly preliminary threshold (7, 5, 2)', () => {
      expect(determineTier(7, 5, 2)).toBe('preliminary');
    });

    it('returns "nascent" one below preliminary checkIns (6, 5, 2)', () => {
      expect(determineTier(6, 5, 2)).toBe('nascent');
    });

    it('returns "nascent" one below preliminary toolUses (7, 4, 2)', () => {
      expect(determineTier(7, 4, 2)).toBe('nascent');
    });

    it('returns "nascent" one below preliminary distinctTools (7, 5, 1)', () => {
      expect(determineTier(7, 5, 1)).toBe('nascent');
    });

    // Confident threshold: checkIns >= 14, toolUses >= 10, distinctTools >= 2
    it('returns "confident" at exactly confident threshold (14, 10, 2)', () => {
      expect(determineTier(14, 10, 2)).toBe('confident');
    });

    it('returns "preliminary" one below confident checkIns (13, 10, 2)', () => {
      expect(determineTier(13, 10, 2)).toBe('preliminary');
    });

    it('returns "preliminary" one below confident toolUses (14, 9, 2)', () => {
      expect(determineTier(14, 9, 2)).toBe('preliminary');
    });

    it('returns "nascent" one below confident distinctTools (14, 10, 1) — falls back since preliminary also requires 2', () => {
      expect(determineTier(14, 10, 1)).toBe('nascent');
    });
  });

  // --- Zero and negative values ---

  describe('determineTier() — zero and negative values', () => {
    it('returns "below_nascent" for all zeros (0, 0, 0)', () => {
      expect(determineTier(0, 0, 0)).toBe('below_nascent');
    });

    it('returns "below_nascent" for negative values treated as 0 (-1, -1, -1)', () => {
      expect(determineTier(-1, -1, -1)).toBe('below_nascent');
    });
  });

  // --- createTierEvaluator().evaluate() with mocked database ---

  describe('createTierEvaluator().evaluate()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      mockGetIncludeArchivedTools.mockResolvedValue(false);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      mockGetIncludeArchivedTools.mockResolvedValue(false);
    });

    it('evaluates tier based on database counts', async () => {
      // Mock: 7 check-ins, 5 tool uses, 2 distinct tools → preliminary
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 7 })  // kpi_records count
        .mockResolvedValueOnce({ count: 5 })  // completions count
        .mockResolvedValueOnce({ count: 2 }); // distinct card count

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      expect(result.currentTier).toBe('preliminary');
      expect(result.checkInCount).toBe(7);
      expect(result.toolUseCount).toBe(5);
      expect(result.distinctToolCount).toBe(2);
    });

    it('returns below_nascent and defaults on database failure', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('db error'));

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      expect(result.currentTier).toBe('below_nascent');
      expect(result.checkInCount).toBe(0);
      expect(result.toolUseCount).toBe(0);
      expect(result.distinctToolCount).toBe(0);
      expect(result.nextTier).toBe('nascent');
      expect(result.checkInsNeeded).toBe(TIER_THRESHOLDS.nascent.checkIns);
      expect(result.toolUsesNeeded).toBe(TIER_THRESHOLDS.nascent.toolUses);
    });
  });

  // --- cardQualifiesForCorrelation ---

  describe('cardQualifiesForCorrelation()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns false for below_nascent tier', async () => {
      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'below_nascent', '30d');
      expect(result).toBe(false);
    });

    it('returns false for nascent tier', async () => {
      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'nascent', '30d');
      expect(result).toBe(false);
    });

    it('returns true for preliminary tier with >= 3 completions', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 3 });

      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'preliminary', '30d');
      expect(result).toBe(true);
    });

    it('returns false for preliminary tier with < 3 completions', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 2 });

      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'preliminary', '30d');
      expect(result).toBe(false);
    });

    it('returns true for confident tier with >= 5 completions', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 5 });

      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'confident', '30d');
      expect(result).toBe(true);
    });

    it('returns false for confident tier with < 5 completions', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 4 });

      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'confident', '30d');
      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('db error'));

      const evaluator = createTierEvaluator();
      const result = await evaluator.cardQualifiesForCorrelation('card-1', 'confident', '30d');
      expect(result).toBe(false);
    });
  });
});
