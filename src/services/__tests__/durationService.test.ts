import { createDurationService, DurationService } from '../durationService';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234-5678-abcd-ef0123456789'),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

describe('DurationService', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: DurationService;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    service = createDurationService();
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  // --- persist() ---

  describe('persist()', () => {
    const validRecord = {
      cardId: 'card-abc',
      startedAt: '2024-06-01T10:00:00.000Z',
      endedAt: '2024-06-01T10:05:00.000Z',
      activeDurationSec: 300,
      endStatus: 'completed' as const,
    };

    it('accepts a record with activeDurationSec = 3 (exact boundary)', async () => {
      mockDb.runAsync.mockResolvedValue(undefined);

      const result = await service.persist({
        ...validRecord,
        activeDurationSec: 3,
      });

      expect(result).not.toBeNull();
      expect(result!.activeDurationSec).toBe(3);
      expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    });

    it('rejects a record with activeDurationSec = 2 (below boundary)', async () => {
      const result = await service.persist({
        ...validRecord,
        activeDurationSec: 2,
      });

      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('rejects a record with activeDurationSec = 0', async () => {
      const result = await service.persist({
        ...validRecord,
        activeDurationSec: 0,
      });

      expect(result).toBeNull();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('returns a valid record structure with correct fields', async () => {
      mockDb.runAsync.mockResolvedValue(undefined);

      const result = await service.persist(validRecord);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-uuid-1234-5678-abcd-ef0123456789');
      expect(result!.cardId).toBe(validRecord.cardId);
      expect(result!.startedAt).toBe(validRecord.startedAt);
      expect(result!.endedAt).toBe(validRecord.endedAt);
      expect(result!.activeDurationSec).toBe(validRecord.activeDurationSec);
      expect(result!.endStatus).toBe(validRecord.endStatus);
    });

    it('inserts the correct parameters into the database', async () => {
      mockDb.runAsync.mockResolvedValue(undefined);

      await service.persist(validRecord);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO duration_records'),
        [
          'test-uuid-1234-5678-abcd-ef0123456789',
          validRecord.cardId,
          validRecord.startedAt,
          validRecord.endedAt,
          validRecord.activeDurationSec,
          validRecord.endStatus,
        ]
      );
    });

    it('returns null when database insert fails', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('disk full'));

      const result = await service.persist(validRecord);

      expect(result).toBeNull();
    });
  });

  // --- query() ---

  describe('query()', () => {
    it('returns empty array when no records match', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await service.query({ cardId: 'nonexistent' });

      expect(result).toEqual([]);
    });

    it('applies cardId filter', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await service.query({ cardId: 'card-1' });

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('card_id = ?'),
        ['card-1']
      );
    });

    it('applies multiple filters combined', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await service.query({
        cardId: 'card-1',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z',
        endStatus: 'completed',
      });

      const call = mockDb.getAllAsync.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain('card_id = ?');
      expect(sql).toContain('started_at >= ?');
      expect(sql).toContain('started_at <= ?');
      expect(sql).toContain('end_status = ?');
      expect(call[1]).toEqual([
        'card-1',
        '2024-01-01T00:00:00.000Z',
        '2024-01-31T23:59:59.999Z',
        'completed',
      ]);
    });

    it('maps database rows to DurationRecord objects correctly', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        {
          id: 'rec-1',
          card_id: 'card-1',
          started_at: '2024-06-01T10:00:00.000Z',
          ended_at: '2024-06-01T10:05:00.000Z',
          active_duration_sec: 300,
          end_status: 'completed',
        },
      ]);

      const result = await service.query({});

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'rec-1',
        cardId: 'card-1',
        startedAt: '2024-06-01T10:00:00.000Z',
        endedAt: '2024-06-01T10:05:00.000Z',
        activeDurationSec: 300,
        endStatus: 'completed',
      });
    });

    it('returns empty array when query fails', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('db error'));

      const result = await service.query({ cardId: 'card-1' });

      expect(result).toEqual([]);
    });
  });

  // --- getStats() ---

  describe('getStats()', () => {
    it('returns null when fewer than 3 completed records exist', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 60 },
        { active_duration_sec: 90 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).toBeNull();
    });

    it('returns stats with exactly 3 completed records (trend = consistent, N < 5)', async () => {
      // 3 records: [120, 100, 80] (ordered DESC by started_at)
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 120 },
        { active_duration_sec: 100 },
        { active_duration_sec: 80 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(3);
      // average = (120 + 100 + 80) / 3 = 100
      expect(result!.averageDurationSec).toBe(100);
      // recent average = same as overall (all 3 used as recent since N < 5 → slice(0,5) = all)
      expect(result!.recentAverageSec).toBe(100);
      // With N < 5, trend is always 'consistent'
      expect(result!.trendDirection).toBe('consistent');
    });

    it('returns stats with exactly 4 records (no trend since N < 5)', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 200 },
        { active_duration_sec: 150 },
        { active_duration_sec: 100 },
        { active_duration_sec: 50 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(4);
      // average = (200 + 150 + 100 + 50) / 4 = 125
      expect(result!.averageDurationSec).toBe(125);
      // recent = all 4 since N < 5 → slice(0,5) = [200, 150, 100, 50]
      expect(result!.recentAverageSec).toBe(125);
      // N < 5 → trend is always 'consistent'
      expect(result!.trendDirection).toBe('consistent');
    });

    it('returns stats with exactly 5 records and trend calculated', async () => {
      // Arrange: 5 records where recent 5 average equals overall (no difference)
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 100 },
        { active_duration_sec: 100 },
        { active_duration_sec: 100 },
        { active_duration_sec: 100 },
        { active_duration_sec: 100 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(5);
      expect(result!.averageDurationSec).toBe(100);
      expect(result!.recentAverageSec).toBe(100);
      // recentAvg == overallAvg → 'consistent'
      expect(result!.trendDirection).toBe('consistent');
    });

    it('detects "more" trend at exact 15% boundary: recentAvg = overallAvg * 1.15', async () => {
      // We need: recentAvg >= overallAvg * 1.15
      // With 6 records: overall avg includes all, recent avg is last 5
      // Let's use: records = [115, 115, 115, 115, 115, 100] (oldest last since ORDER BY started_at DESC)
      // Wait - the query orders by started_at DESC, so first items are most recent.
      // Records from DB (desc): [230, 230, 230, 230, 230, 0]
      // Actually let's think carefully.
      // totalRecords = 6, allDurations = [230,230,230,230,230,0]
      // Overall avg = (230*5 + 0)/6 = 1150/6 ≈ 191.67 → rounds to 192
      // Recent 5 avg = (230*5)/5 = 230
      // 192 * 1.15 = 220.8 → 230 >= 220.8 → 'more'
      // 
      // Hmm, let's try simpler numbers. We need integer math.
      // Let overall avg = 100. Then we need recentAvg >= 115.
      // With 10 records: [115,115,115,115,115, 85,85,85,85,85]
      // overallAvg = (115*5 + 85*5)/10 = (575+425)/10 = 1000/10 = 100
      // recentAvg = (115*5)/5 = 115
      // 115 >= 100*1.15 = 115 → YES, exactly at boundary → 'more'
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(10);
      expect(result!.averageDurationSec).toBe(100);
      expect(result!.recentAverageSec).toBe(115);
      expect(result!.trendDirection).toBe('more');
    });

    it('detects "consistent" trend just below 15% boundary', async () => {
      // We need recentAvg < overallAvg * 1.15
      // With 10 records: [114,114,114,114,114, 86,86,86,86,86]
      // overallAvg = (114*5 + 86*5)/10 = (570+430)/10 = 1000/10 = 100
      // recentAvg = (114*5)/5 = 114
      // 114 >= 100*1.15 = 115? NO → not 'more'
      // 114 <= 100*0.85 = 85? NO → not 'less'
      // → 'consistent'
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 114 },
        { active_duration_sec: 114 },
        { active_duration_sec: 114 },
        { active_duration_sec: 114 },
        { active_duration_sec: 114 },
        { active_duration_sec: 86 },
        { active_duration_sec: 86 },
        { active_duration_sec: 86 },
        { active_duration_sec: 86 },
        { active_duration_sec: 86 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.totalRecords).toBe(10);
      expect(result!.averageDurationSec).toBe(100);
      expect(result!.recentAverageSec).toBe(114);
      expect(result!.trendDirection).toBe('consistent');
    });

    it('detects "less" trend when recent average is 85% or below overall', async () => {
      // overallAvg = 100, recentAvg = 85 → 85 <= 100*0.85 = 85 → 'less'
      mockDb.getAllAsync.mockResolvedValue([
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 85 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
        { active_duration_sec: 115 },
      ]);

      const result = await service.getStats('card-1');

      expect(result).not.toBeNull();
      expect(result!.averageDurationSec).toBe(100);
      expect(result!.recentAverageSec).toBe(85);
      expect(result!.trendDirection).toBe('less');
    });

    it('returns null when database query fails', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('db error'));

      const result = await service.getStats('card-1');

      expect(result).toBeNull();
    });
  });

  // --- getCardAverageDuration() ---

  describe('getCardAverageDuration()', () => {
    it('returns null when no records exist for the card', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ avg_duration: null });

      const result = await service.getCardAverageDuration('card-1');

      expect(result).toBeNull();
    });

    it('returns null when query returns null row', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await service.getCardAverageDuration('card-1');

      expect(result).toBeNull();
    });

    it('returns rounded average duration when records exist', async () => {
      // AVG of 100, 150, 200 = 150
      mockDb.getFirstAsync.mockResolvedValue({ avg_duration: 150.7 });

      const result = await service.getCardAverageDuration('card-1');

      expect(result).toBe(151); // Math.round(150.7) = 151
    });

    it('queries only completed records for the specified card', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ avg_duration: 100 });

      await service.getCardAverageDuration('card-xyz');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining("end_status = 'completed'"),
        ['card-xyz']
      );
    });

    it('returns null when database query fails', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('db error'));

      const result = await service.getCardAverageDuration('card-1');

      expect(result).toBeNull();
    });
  });

  // --- deleteAll() ---

  describe('deleteAll()', () => {
    it('executes DELETE FROM duration_records', async () => {
      mockDb.runAsync.mockResolvedValue(undefined);

      await service.deleteAll();

      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM duration_records');
    });

    it('does not throw when database operation fails', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('db error'));

      // Should not throw
      await expect(service.deleteAll()).resolves.toBeUndefined();
    });
  });
});
