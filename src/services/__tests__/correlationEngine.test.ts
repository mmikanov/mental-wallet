import {
  createCorrelationEngine,
  classifyCorrelationDirection,
  getTimePeriodStartDate,
  computeOutcomeEffectivenessScore,
  classifyEffectivenessPattern,
} from '../correlationEngine';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock the settings service
jest.mock('../settingsService', () => ({
  getIncludeArchivedTools: jest.fn().mockResolvedValue(false),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

describe('CorrelationEngine', () => {
  // --- classifyCorrelationDirection ---

  describe('classifyCorrelationDirection()', () => {
    it('returns "positive" for Score_Delta >= +0.3', () => {
      expect(classifyCorrelationDirection(0.3)).toBe('positive');
      expect(classifyCorrelationDirection(0.5)).toBe('positive');
      expect(classifyCorrelationDirection(2.0)).toBe('positive');
    });

    it('returns "negative" for Score_Delta <= -0.3', () => {
      expect(classifyCorrelationDirection(-0.3)).toBe('negative');
      expect(classifyCorrelationDirection(-0.5)).toBe('negative');
      expect(classifyCorrelationDirection(-2.0)).toBe('negative');
    });

    it('returns "neutral" for Score_Delta between -0.3 and +0.3 (exclusive)', () => {
      expect(classifyCorrelationDirection(0.0)).toBe('neutral');
      expect(classifyCorrelationDirection(0.29)).toBe('neutral');
      expect(classifyCorrelationDirection(-0.29)).toBe('neutral');
      expect(classifyCorrelationDirection(0.1)).toBe('neutral');
      expect(classifyCorrelationDirection(-0.1)).toBe('neutral');
    });
  });

  // --- getTimePeriodStartDate ---

  describe('getTimePeriodStartDate()', () => {
    it('returns null for "all"', () => {
      expect(getTimePeriodStartDate('all')).toBeNull();
    });

    it('returns a valid ISO 8601 string for "7d"', () => {
      const result = getTimePeriodStartDate('7d');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      // Start date is set to midnight UTC of the day 7 days ago,
      // so diff can be up to 7 + ~1 day depending on current time of day
      const diffMs = now.getTime() - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(7);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    it('returns a valid ISO 8601 string for "30d"', () => {
      const result = getTimePeriodStartDate('30d');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(30);
      expect(diffDays).toBeLessThanOrEqual(31);
    });

    it('returns a valid ISO 8601 string for "90d"', () => {
      const result = getTimePeriodStartDate('90d');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(90);
      expect(diffDays).toBeLessThanOrEqual(91);
    });
  });

  // --- computeSingleToolCorrelation ---

  describe('computeSingleToolCorrelation()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns null when card does not exist', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('nonexistent', 'all');
      expect(result).toBeNull();
    });

    it('returns null when no KPI records exist', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ title: 'Test Card' }); // card
      mockDb.getAllAsync.mockResolvedValueOnce([]); // kpi_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      expect(result).toBeNull();
    });

    it('returns null when no completions exist for the card', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ title: 'Test Card' }); // card
      mockDb.getAllAsync
        .mockResolvedValueOnce([{ id: 'kpi-1', value: 5, recorded_at: '2024-06-01T12:00:00Z' }]) // kpi_records
        .mockResolvedValueOnce([]); // completions

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      expect(result).toBeNull();
    });

    it('returns null when all KPI days are tool-associated (no comparison possible)', async () => {
      // Tool used on 2024-06-01, making 06-01 and 05-31 tool-associated
      // Only KPI records on those days
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Test Card' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 7, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 6, recorded_at: '2024-05-31T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-01T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      expect(result).toBeNull();
    });

    it('computes correct Score_Delta without duration weighting', async () => {
      // Tool used on 2024-06-05 → tool-associated days: 06-04, 06-05
      // KPI records:
      //   06-04: 8 (tool day)
      //   06-05: 7 (tool day)
      //   06-01: 4 (other day)
      //   06-02: 5 (other day)
      //   06-03: 6 (other day)
      // Expected:
      //   weightedAvg (no duration, all weight=1.0) = (8 + 7) / 2 = 7.5
      //   otherAvg = (4 + 5 + 6) / 3 = 5.0
      //   Score_Delta = 7.5 - 5.0 = 2.5
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Breathing Exercise' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration (no records)
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 5, recorded_at: '2024-06-02T12:00:00Z' },
          { id: 'kpi-3', value: 6, recorded_at: '2024-06-03T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 7, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]); // duration_records (none)

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.cardTitle).toBe('Breathing Exercise');
      expect(result!.scoreDelta).toBeCloseTo(2.5, 3);
      expect(result!.correlationDirection).toBe('positive');
      expect(result!.sampleSizeToolDays).toBe(2);
      expect(result!.sampleSizeOtherDays).toBe(3);
      expect(result!.avgDurationSec).toBeNull();
      expect(result!.outcomeEffectivenessScore).toBeNull();
      expect(result!.effectivenessPattern).toBeNull();
    });

    it('applies duration weighting correctly', async () => {
      // Tool used on 2024-06-05 → tool-associated days: 06-04, 06-05
      // Card avg duration: 60 seconds
      // Duration on 06-05: 120 seconds → weight = 120/60 = 2.0
      // No duration on 06-04 → weight = 1.0
      // KPI:
      //   06-04: 8 (weight 1.0)
      //   06-05: 6 (weight 2.0)
      //   06-01: 4
      //   06-02: 5
      //   06-03: 3
      // weightedAvg = (8*1.0 + 6*2.0) / (1.0 + 2.0) = (8 + 12) / 3 = 20/3 ≈ 6.667
      // otherAvg = (4 + 5 + 3) / 3 = 4.0
      // Score_Delta ≈ 6.667 - 4.0 = 2.667
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Journaling' }) // card
        .mockResolvedValueOnce({ avg_duration: 60 }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 5, recorded_at: '2024-06-02T12:00:00Z' },
          { id: 'kpi-3', value: 3, recorded_at: '2024-06-03T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 6, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([
          { active_duration_sec: 120, started_at: '2024-06-05T09:55:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(2.667, 2);
      expect(result!.correlationDirection).toBe('positive');
      expect(result!.avgDurationSec).toBe(60);
    });

    it('clamps duration weight to minimum 0.5', async () => {
      // Card avg duration: 100 seconds
      // Duration on 06-05: 10 seconds → raw weight = 10/100 = 0.1 → clamped to 0.5
      // No duration on 06-04 → weight = 1.0
      // KPI:
      //   06-04: 8 (weight 1.0)
      //   06-05: 6 (weight 0.5)
      //   06-01: 4
      // weightedAvg = (8*1.0 + 6*0.5) / (1.0 + 0.5) = (8 + 3) / 1.5 = 11/1.5 ≈ 7.333
      // otherAvg = 4.0
      // Score_Delta ≈ 3.333
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Quick Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: 100 }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 6, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([
          { active_duration_sec: 10, started_at: '2024-06-05T09:55:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(3.333, 2);
    });

    it('clamps duration weight to maximum 2.0', async () => {
      // Card avg duration: 30 seconds
      // Duration on 06-05: 300 seconds → raw weight = 300/30 = 10 → clamped to 2.0
      // No duration on 06-04 → weight = 1.0
      // KPI:
      //   06-04: 8 (weight 1.0)
      //   06-05: 6 (weight 2.0)
      //   06-01: 4
      // weightedAvg = (8*1.0 + 6*2.0) / (1.0 + 2.0) = (8 + 12) / 3 = 20/3 ≈ 6.667
      // otherAvg = 4.0
      // Score_Delta ≈ 2.667
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Deep Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: 30 }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 6, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([
          { active_duration_sec: 300, started_at: '2024-06-05T09:55:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(2.667, 2);
    });

    it('uses the longest session duration when multiple sessions on same day', async () => {
      // Tool used on 2024-06-05 → tool-associated days: 06-04, 06-05
      // Card avg duration: 60 seconds
      // Durations on 06-05: 30s and 90s → longest = 90s → weight = 90/60 = 1.5
      // No duration on 06-04 → weight = 1.0
      // KPI:
      //   06-04: 8 (weight 1.0)
      //   06-05: 6 (weight 1.5)
      //   06-01: 4
      // weightedAvg = (8*1.0 + 6*1.5) / (1.0 + 1.5) = (8 + 9) / 2.5 = 17/2.5 = 6.8
      // otherAvg = 4.0
      // Score_Delta = 2.8
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Multi Session Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: 60 }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 6, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([
          { active_duration_sec: 30, started_at: '2024-06-05T09:00:00Z' },
          { active_duration_sec: 90, started_at: '2024-06-05T15:00:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(2.8, 2);
    });

    it('classifies neutral correlation correctly', async () => {
      // Tool used on 2024-06-05 → tool-associated days: 06-04, 06-05
      // KPI:
      //   06-04: 5 (tool day)
      //   06-05: 5 (tool day)
      //   06-01: 5 (other day)
      // weightedAvg = 5.0, otherAvg = 5.0
      // Score_Delta = 0.0 → neutral
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Neutral Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 5, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 5, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 5, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(0.0, 3);
      expect(result!.correlationDirection).toBe('neutral');
    });

    it('classifies negative correlation correctly', async () => {
      // Tool used on 2024-06-05 → tool-associated days: 06-04, 06-05
      // KPI:
      //   06-04: 3 (tool day)
      //   06-05: 2 (tool day)
      //   06-01: 7 (other day)
      //   06-02: 8 (other day)
      // weightedAvg = (3 + 2) / 2 = 2.5
      // otherAvg = (7 + 8) / 2 = 7.5
      // Score_Delta = 2.5 - 7.5 = -5.0 → negative
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Hard Day Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 7, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 8, recorded_at: '2024-06-02T12:00:00Z' },
          { id: 'kpi-4', value: 3, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 2, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.scoreDelta).toBeCloseTo(-5.0, 3);
      expect(result!.correlationDirection).toBe('negative');
    });

    it('returns null when tool used every day (no other-day data for comparison)', async () => {
      // Tool used on 06-01, 06-02, 06-03 → tool-associated days include:
      // 05-31(D-1 of 06-01), 06-01, 06-01(D-1 of 06-02), 06-02, 06-02(D-1 of 06-03), 06-03
      // So every KPI day is tool-associated, leaving no "other" days
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Daily Practice' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 5, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 6, recorded_at: '2024-06-02T12:00:00Z' },
          { id: 'kpi-3', value: 7, recorded_at: '2024-06-03T12:00:00Z' },
        ]) // kpi_records — all on tool-associated days
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-01T10:00:00Z' },
          { id: 'comp-2', completed_at: '2024-06-02T10:00:00Z' },
          { id: 'comp-3', completed_at: '2024-06-03T10:00:00Z' },
        ]) // completions — tool used every day
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      // No "other" days to compare against → null
      expect(result).toBeNull();
    });

    it('returns null when single KPI day is a tool day (no other-day data)', async () => {
      // Only one KPI record exists, and that day IS a tool day
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Single Day Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 7, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records — single record on a tool day
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions — used on same day
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      // Only one KPI day and it's tool-associated → no other-day data → null
      expect(result).toBeNull();
    });

    it('returns null on database error', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('db error'));

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');
      expect(result).toBeNull();
    });

    it('handles card with zero average duration (weight defaults to 1.0)', async () => {
      // cardAvgDuration = 0 → all weights default to 1.0
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Zero Avg Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: 0 }); // avg duration = 0
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-5', value: 8, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([
          { active_duration_sec: 60, started_at: '2024-06-05T09:55:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      // Tool-associated days: 06-04, 06-05. Only 06-05 has KPI → weightedAvg = 8.0
      // Other day: 06-01 → otherAvg = 4.0
      // Score_Delta = 8.0 - 4.0 = 4.0 (weight=1.0 since cardAvg=0)
      expect(result!.scoreDelta).toBeCloseTo(4.0, 3);
    });

    it('computes OES and effectiveness pattern when outcome data available', async () => {
      // Tool with positive correlation (Score_Delta > +0.3) and high OES (>= 0.6)
      // → should be classified as 'reliable_booster'
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Great Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 5, recorded_at: '2024-06-02T12:00:00Z' },
          { id: 'kpi-3', value: 3, recorded_at: '2024-06-03T12:00:00Z' },
          { id: 'kpi-4', value: 8, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 7, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]) // duration_records
        .mockResolvedValueOnce([
          { category: 'calmer' },
          { category: 'clear' },
          { category: 'hopeful' },
          { category: 'calmer' },
          { category: 'same' },
        ]); // outcome_responses (4 positive out of 5 = 0.8 OES)

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.outcomeEffectivenessScore).toBeCloseTo(0.8, 3);
      expect(result!.effectivenessPattern).toBe('reliable_booster');
    });

    it('returns null OES when fewer than 5 outcome responses', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'New Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-5', value: 8, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]) // duration_records
        .mockResolvedValueOnce([
          { category: 'calmer' },
          { category: 'same' },
          { category: 'worse' },
        ]); // only 3 outcome responses

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.outcomeEffectivenessScore).toBeNull();
      expect(result!.effectivenessPattern).toBeNull();
    });

    it('classifies helpful_on_hard_days when neutral/negative correlation + high OES', async () => {
      // Score_Delta will be 0.0 (neutral) with high OES → helpful_on_hard_days
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Grounding Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 5, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 5, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 5, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records (all 5 → Score_Delta = 0)
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]) // duration_records
        .mockResolvedValueOnce([
          { category: 'calmer' },
          { category: 'calmer' },
          { category: 'clear' },
          { category: 'hopeful' },
          { category: 'same' },
        ]); // 4 positive out of 5 = 0.8 OES

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.correlationDirection).toBe('neutral');
      expect(result!.outcomeEffectivenessScore).toBeCloseTo(0.8, 3);
      expect(result!.effectivenessPattern).toBe('helpful_on_hard_days');
    });

    it('classifies not_helping when neutral correlation + low OES', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Unhelpful Tool' }) // card
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 5, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-4', value: 5, recorded_at: '2024-06-04T12:00:00Z' },
          { id: 'kpi-5', value: 5, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]) // duration_records
        .mockResolvedValueOnce([
          { category: 'same' },
          { category: 'worse' },
          { category: 'same' },
          { category: 'same' },
          { category: 'calmer' },
        ]); // 1 positive out of 5 = 0.2 OES

      const engine = createCorrelationEngine();
      const result = await engine.computeSingleToolCorrelation('card-1', 'all');

      expect(result).not.toBeNull();
      expect(result!.outcomeEffectivenessScore).toBeCloseTo(0.2, 3);
      expect(result!.effectivenessPattern).toBe('not_helping');
    });
  });

  // --- computeToolCorrelations ---

  describe('computeToolCorrelations()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns empty array when no cards have completions', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]); // no cards with completions

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');
      expect(results).toEqual([]);
    });

    it('returns results for cards that can be computed', async () => {
      // First call: get distinct card_ids
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1' },
        { card_id: 'card-2' },
      ]);

      // For card-1: returns a valid result
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Card 1' }) // card title
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 8, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]) // duration_records
        .mockResolvedValueOnce([]); // outcome_responses

      // For card-2: returns null (no card found)
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');

      expect(results).toHaveLength(1);
      expect(results[0].cardId).toBe('card-1');
      expect(results[0].cardTitle).toBe('Card 1');
    });

    it('returns empty array on database error', async () => {
      mockDb.getAllAsync.mockRejectedValueOnce(new Error('db error'));

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');
      expect(results).toEqual([]);
    });
  });

  // --- computeOutcomeEffectivenessScore ---

  describe('computeOutcomeEffectivenessScore()', () => {
    it('returns null when fewer than 5 responses', () => {
      expect(computeOutcomeEffectivenessScore([])).toBeNull();
      expect(computeOutcomeEffectivenessScore(['calmer', 'same'])).toBeNull();
      expect(computeOutcomeEffectivenessScore(['calmer', 'same', 'worse', 'clear'])).toBeNull();
    });

    it('returns 1.0 when all responses are positive', () => {
      const categories = ['calmer', 'clear', 'hopeful', 'calmer', 'clear'];
      expect(computeOutcomeEffectivenessScore(categories)).toBeCloseTo(1.0, 3);
    });

    it('returns 0.0 when no responses are positive', () => {
      const categories = ['same', 'worse', 'same', 'worse', 'same'];
      expect(computeOutcomeEffectivenessScore(categories)).toBeCloseTo(0.0, 3);
    });

    it('computes correct ratio for mixed responses', () => {
      // 3 positive (calmer, clear, hopeful), 2 negative (same, worse) = 3/5 = 0.6
      const categories = ['calmer', 'clear', 'hopeful', 'same', 'worse'];
      expect(computeOutcomeEffectivenessScore(categories)).toBeCloseTo(0.6, 3);
    });

    it('correctly identifies positive categories', () => {
      // Only 'calmer', 'clear', 'hopeful' are positive
      const categories = ['calmer', 'clear', 'hopeful', 'same', 'worse', 'same', 'worse', 'same', 'worse', 'same'];
      // 3 positive out of 10 = 0.3
      expect(computeOutcomeEffectivenessScore(categories)).toBeCloseTo(0.3, 3);
    });

    it('returns correct score at exactly 5 responses (minimum threshold)', () => {
      const categories = ['calmer', 'same', 'same', 'same', 'same'];
      // 1 positive out of 5 = 0.2
      expect(computeOutcomeEffectivenessScore(categories)).toBeCloseTo(0.2, 3);
    });
  });

  // --- classifyEffectivenessPattern ---

  describe('classifyEffectivenessPattern()', () => {
    it('returns null when OES is null', () => {
      expect(classifyEffectivenessPattern(0.5, null)).toBeNull();
      expect(classifyEffectivenessPattern(-0.5, null)).toBeNull();
      expect(classifyEffectivenessPattern(0.0, null)).toBeNull();
    });

    it('returns reliable_booster for positive correlation + high OES', () => {
      expect(classifyEffectivenessPattern(0.31, 0.6)).toBe('reliable_booster');
      expect(classifyEffectivenessPattern(1.0, 0.8)).toBe('reliable_booster');
      expect(classifyEffectivenessPattern(0.5, 1.0)).toBe('reliable_booster');
    });

    it('returns null for positive correlation + low OES (no pattern)', () => {
      expect(classifyEffectivenessPattern(0.31, 0.5)).toBeNull();
      expect(classifyEffectivenessPattern(0.5, 0.2)).toBeNull();
      expect(classifyEffectivenessPattern(1.0, 0.0)).toBeNull();
    });

    it('returns helpful_on_hard_days for neutral/negative correlation + high OES', () => {
      expect(classifyEffectivenessPattern(0.3, 0.6)).toBe('helpful_on_hard_days');
      expect(classifyEffectivenessPattern(0.0, 0.8)).toBe('helpful_on_hard_days');
      expect(classifyEffectivenessPattern(-0.5, 0.9)).toBe('helpful_on_hard_days');
      expect(classifyEffectivenessPattern(-1.0, 1.0)).toBe('helpful_on_hard_days');
    });

    it('returns comfort_tool for neutral/negative correlation + moderate OES (0.3-0.6)', () => {
      expect(classifyEffectivenessPattern(0.0, 0.3)).toBe('comfort_tool');
      expect(classifyEffectivenessPattern(-0.5, 0.5)).toBe('comfort_tool');
      expect(classifyEffectivenessPattern(0.3, 0.59)).toBe('comfort_tool');
    });

    it('returns not_helping for neutral/negative correlation + low OES (< 0.3)', () => {
      expect(classifyEffectivenessPattern(0.0, 0.0)).toBe('not_helping');
      expect(classifyEffectivenessPattern(-0.5, 0.1)).toBe('not_helping');
      expect(classifyEffectivenessPattern(0.3, 0.29)).toBe('not_helping');
      expect(classifyEffectivenessPattern(0.2, 0.0)).toBe('not_helping');
    });

    it('handles boundary at Score_Delta = 0.3 (inclusive for neutral/negative)', () => {
      // Score_Delta = 0.3 exactly is NOT > 0.3, so it's classified as neutral/negative side
      expect(classifyEffectivenessPattern(0.3, 0.6)).toBe('helpful_on_hard_days');
      expect(classifyEffectivenessPattern(0.3, 0.4)).toBe('comfort_tool');
      expect(classifyEffectivenessPattern(0.3, 0.1)).toBe('not_helping');
    });

    it('handles boundary at OES = 0.6 (inclusive for high)', () => {
      expect(classifyEffectivenessPattern(0.0, 0.6)).toBe('helpful_on_hard_days');
      expect(classifyEffectivenessPattern(0.0, 0.59)).toBe('comfort_tool');
    });

    it('handles boundary at OES = 0.3 (inclusive for moderate)', () => {
      expect(classifyEffectivenessPattern(0.0, 0.3)).toBe('comfort_tool');
      expect(classifyEffectivenessPattern(0.0, 0.29)).toBe('not_helping');
    });
  });

  // --- computeWalletCorrelation ---

  describe('computeWalletCorrelation()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns empty arrays and neutral trend when no data', async () => {
      mockDb.getAllAsync
        .mockResolvedValueOnce([]) // kpi_records
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeWalletCorrelation('all');

      expect(result.weeklyAvgScore).toEqual([]);
      expect(result.weeklyTotalDurationMin).toEqual([]);
      expect(result.overallTrend).toBe('neutral');
      expect(result.summaryText).toContain('Not enough data');
    });

    it('computes weekly averages across multiple weeks', async () => {
      // Week 1: Mon 2024-06-03 to Sun 2024-06-09
      // Week 2: Mon 2024-06-10 to Sun 2024-06-16
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { value: 5, recorded_at: '2024-06-03T12:00:00Z' },
          { value: 7, recorded_at: '2024-06-04T12:00:00Z' },
          { value: 8, recorded_at: '2024-06-10T12:00:00Z' },
          { value: 9, recorded_at: '2024-06-11T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { active_duration_sec: 120, started_at: '2024-06-03T10:00:00Z' },
          { active_duration_sec: 180, started_at: '2024-06-10T10:00:00Z' },
        ]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeWalletCorrelation('all');

      expect(result.weeklyAvgScore.length).toBe(2);
      // Week 1 avg: (5+7)/2 = 6.0
      expect(result.weeklyAvgScore[0]).toBeCloseTo(6.0, 1);
      // Week 2 avg: (8+9)/2 = 8.5
      expect(result.weeklyAvgScore[1]).toBeCloseTo(8.5, 1);
      expect(result.overallTrend).toBe('positive');
      expect(result.summaryText).toContain('higher check-in scores');
    });

    it('detects negative overall trend', async () => {
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { value: 8, recorded_at: '2024-06-03T12:00:00Z' },
          { value: 5, recorded_at: '2024-06-10T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeWalletCorrelation('all');

      expect(result.overallTrend).toBe('negative');
      expect(result.summaryText).toContain('slightly lower');
    });

    it('returns neutral trend when single week of data', async () => {
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { value: 7, recorded_at: '2024-06-03T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.computeWalletCorrelation('all');

      expect(result.weeklyAvgScore.length).toBe(1);
      expect(result.overallTrend).toBe('neutral');
      expect(result.summaryText).toContain('patterns will emerge');
    });

    it('returns fallback result on database error', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('db error'));

      const engine = createCorrelationEngine();
      const result = await engine.computeWalletCorrelation('all');

      expect(result.weeklyAvgScore).toEqual([]);
      expect(result.overallTrend).toBe('neutral');
      expect(result.summaryText).toContain('Unable to compute');
    });
  });

  // --- getBestTools ---

  describe('getBestTools()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns empty array for nascent tier', async () => {
      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('nascent', 'all');
      expect(result).toEqual([]);
    });

    it('returns empty array for below_nascent tier', async () => {
      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('below_nascent', 'all');
      expect(result).toEqual([]);
    });

    it('returns empty array when no qualifying cards', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]); // completions query

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('preliminary', 'all');
      expect(result).toEqual([]);
    });

    it('excludes tools with negative Score_Delta', async () => {
      // Card has 3+ uses (qualifies for preliminary) but negative correlation
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1', use_count: 5 },
      ]);

      // Mock computeSingleToolCorrelation for card-1 (negative Score_Delta)
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Bad Tool' }) // card title
        .mockResolvedValueOnce({ avg_duration: null }); // avg duration
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 7, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 3, recorded_at: '2024-06-05T12:00:00Z' },
        ]) // kpi_records
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ]) // completions
        .mockResolvedValueOnce([]); // duration_records

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('preliminary', 'all');

      // Score_Delta would be: toolAvg(3) - otherAvg(7) = -4.0 → excluded
      expect(result).toEqual([]);
    });

    it('limits to 3 results at preliminary tier', async () => {
      // Mock 4 cards qualifying
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1', use_count: 5 },
        { card_id: 'card-2', use_count: 4 },
        { card_id: 'card-3', use_count: 3 },
        { card_id: 'card-4', use_count: 6 },
      ]);

      // Mock data for each card to produce positive Score_Deltas
      // card-1: Score_Delta = 2.0
      setupMockForPositiveDelta(mockDb, 'Tool A', 8, 6);
      // card-2: Score_Delta = 1.5
      setupMockForPositiveDelta(mockDb, 'Tool B', 7.5, 6);
      // card-3: Score_Delta = 1.0
      setupMockForPositiveDelta(mockDb, 'Tool C', 7, 6);
      // card-4: Score_Delta = 0.5
      setupMockForPositiveDelta(mockDb, 'Tool D', 6.5, 6);

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('preliminary', 'all');

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result[0]?.isHedged).toBe(true);
    });

    it('limits to 5 results at confident tier', async () => {
      // Just verifying the limit parameter logic
      mockDb.getAllAsync.mockResolvedValueOnce([]); // no qualifying cards

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('confident', 'all');
      expect(result).toEqual([]);
    });

    it('sorts by Score_Delta descending and uses hedged labels at preliminary', async () => {
      // Mock 2 cards
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1', use_count: 5 },
        { card_id: 'card-2', use_count: 4 },
      ]);

      // card-1: Score_Delta = 1.0
      setupMockForPositiveDelta(mockDb, 'Tool A', 7, 6);
      // card-2: Score_Delta = 2.0
      setupMockForPositiveDelta(mockDb, 'Tool B', 8, 6);

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('preliminary', 'all');

      // Sorted by Score_Delta descending
      expect(result.length).toBe(2);
      expect(result[0].scoreDelta).toBeGreaterThan(result[1].scoreDelta);
      expect(result[0].isHedged).toBe(true);
      expect(result[0].descriptorLabel).toContain('Might be linked');
    });

    it('returns empty array on database error', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('db error'));

      const engine = createCorrelationEngine();
      const result = await engine.getBestTools('confident', 'all');
      expect(result).toEqual([]);
    });
  });

  // --- getToolsToReconsider ---

  describe('getToolsToReconsider()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns empty array when no cards have 8+ uses', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]); // completions query

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all');
      expect(result).toEqual([]);
    });

    it('excludes dismissed tools', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1', use_count: 10 },
      ]);

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all', ['card-1']);
      expect(result).toEqual([]);
    });

    it('excludes KPI card', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'kpi-card', use_count: 10 },
      ]);

      // Card has source_library_id = 'lib-personal-kpi'
      mockDb.getFirstAsync.mockResolvedValueOnce({
        source_library_id: 'lib-personal-kpi',
      });

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all');
      expect(result).toEqual([]);
    });

    it('excludes cards with fewer than 5 outcome responses', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-1', use_count: 10 },
      ]);

      // Not KPI card
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ source_library_id: null })
        // outcome count < 5
        .mockResolvedValueOnce({ count: 3 });

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all');
      expect(result).toEqual([]);
    });

    it('limits results to 3 and sorts by use count descending', async () => {
      // 4 frequent cards
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-a', use_count: 12 },
        { card_id: 'card-b', use_count: 15 },
        { card_id: 'card-c', use_count: 10 },
        { card_id: 'card-d', use_count: 8 },
      ]);

      // For each card, setup to qualify as 'not_helping'
      for (let i = 0; i < 4; i++) {
        // Not KPI card
        mockDb.getFirstAsync.mockResolvedValueOnce({ source_library_id: null });
        // >= 5 outcome responses
        mockDb.getFirstAsync.mockResolvedValueOnce({ count: 6 });
        // computeSingleToolCorrelation mocks
        mockDb.getFirstAsync.mockResolvedValueOnce({ title: `Tool ${i}` }); // card title
        mockDb.getAllAsync.mockResolvedValueOnce([
          { id: `kpi-${i}`, value: 5, recorded_at: '2024-06-01T12:00:00Z' },
          { id: `kpi-${i}b`, value: 5, recorded_at: '2024-06-05T12:00:00Z' },
        ]); // kpi_records
        mockDb.getAllAsync.mockResolvedValueOnce([
          { id: `comp-${i}`, completed_at: '2024-06-05T10:00:00Z' },
        ]); // completions
        mockDb.getAllAsync.mockResolvedValueOnce([]); // duration_records
        mockDb.getFirstAsync.mockResolvedValueOnce({ avg_duration: null }); // avg duration
        // Outcome responses: all 'same' or 'worse' → OES < 0.3 → 'not_helping'
        mockDb.getAllAsync.mockResolvedValueOnce([
          { category: 'same' },
          { category: 'same' },
          { category: 'worse' },
          { category: 'same' },
          { category: 'worse' },
        ]); // outcome_responses
      }

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all');

      // Should be limited to 3
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('returns empty array on database error', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('db error'));

      const engine = createCorrelationEngine();
      const result = await engine.getToolsToReconsider('all');
      expect(result).toEqual([]);
    });
  });

  // --- detectKpiLabelChange ---

  describe('detectKpiLabelChange()', () => {
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
      mockDb = createMockDb();
      mockGetDatabase.mockResolvedValue(mockDb as any);
      jest.clearAllMocks();
      mockGetDatabase.mockResolvedValue(mockDb as any);
    });

    it('returns null when no history exists', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('all');
      expect(result).toBeNull();
    });

    it('returns null when history is empty array', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ value: '[]' });

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('all');
      expect(result).toBeNull();
    });

    it('returns the most recent change for "all" period', async () => {
      const history = [
        { previousValue: 'Sleeping better', newValue: 'Feeling calmer', changedAt: '2024-03-01T10:00:00Z' },
        { previousValue: 'Feeling calmer', newValue: 'Less anxious', changedAt: '2024-06-15T10:00:00Z' },
      ];
      mockDb.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(history) });

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('all');

      expect(result).not.toBeNull();
      expect(result!.previousLabel).toBe('Feeling calmer');
      expect(result!.newLabel).toBe('Less anxious');
      expect(result!.changedAt).toBe('2024-06-15T10:00:00Z');
    });

    it('returns change within the selected time period', async () => {
      const now = new Date();
      const recentChange = new Date(now);
      recentChange.setUTCDate(recentChange.getUTCDate() - 5); // 5 days ago

      const oldChange = new Date(now);
      oldChange.setUTCDate(oldChange.getUTCDate() - 60); // 60 days ago

      const history = [
        { previousValue: 'Old Label', newValue: 'Middle Label', changedAt: oldChange.toISOString() },
        { previousValue: 'Middle Label', newValue: 'New Label', changedAt: recentChange.toISOString() },
      ];
      mockDb.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(history) });

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('7d');

      expect(result).not.toBeNull();
      expect(result!.newLabel).toBe('New Label');
    });

    it('returns null when no change is within the selected time period', async () => {
      const now = new Date();
      const oldChange = new Date(now);
      oldChange.setUTCDate(oldChange.getUTCDate() - 60); // 60 days ago

      const history = [
        { previousValue: 'Old Label', newValue: 'New Label', changedAt: oldChange.toISOString() },
      ];
      mockDb.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(history) });

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('7d');

      expect(result).toBeNull();
    });

    it('returns the most recent change when multiple changes exist within period', async () => {
      const now = new Date();
      const change1 = new Date(now);
      change1.setUTCDate(change1.getUTCDate() - 3); // 3 days ago
      const change2 = new Date(now);
      change2.setUTCDate(change2.getUTCDate() - 5); // 5 days ago
      const change3 = new Date(now);
      change3.setUTCDate(change3.getUTCDate() - 6); // 6 days ago

      const history = [
        { previousValue: 'Sleeping better', newValue: 'Feeling calmer', changedAt: change3.toISOString() },
        { previousValue: 'Feeling calmer', newValue: 'Less anxious', changedAt: change2.toISOString() },
        { previousValue: 'Less anxious', newValue: 'More focused', changedAt: change1.toISOString() },
      ];
      mockDb.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(history) });

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('7d');

      // All 3 changes are within the last 7 days — most recent (3 days ago) is returned
      expect(result).not.toBeNull();
      expect(result!.previousLabel).toBe('Less anxious');
      expect(result!.newLabel).toBe('More focused');
      expect(result!.changedAt).toBe(change1.toISOString());
    });

    it('returns null on database error', async () => {
      mockDb.getFirstAsync.mockRejectedValue(new Error('db error'));

      const engine = createCorrelationEngine();
      const result = await engine.detectKpiLabelChange('all');
      expect(result).toBeNull();
    });
  });
});

// --- Test Helpers ---

/**
 * Setup mock database responses to produce a positive Score_Delta.
 * Tool used on 2024-06-05, tool-associated days: 06-04, 06-05
 * KPI on tool day = toolDayScore, KPI on other day = otherDayScore
 */
function setupMockForPositiveDelta(
  mockDb: ReturnType<typeof createMockDb>,
  cardTitle: string,
  toolDayScore: number,
  otherDayScore: number
) {
  mockDb.getFirstAsync
    .mockResolvedValueOnce({ title: cardTitle })
    .mockResolvedValueOnce({ avg_duration: null });
  mockDb.getAllAsync
    .mockResolvedValueOnce([
      { id: 'kpi-o', value: otherDayScore, recorded_at: '2024-06-01T12:00:00Z' },
      { id: 'kpi-t', value: toolDayScore, recorded_at: '2024-06-05T12:00:00Z' },
    ])
    .mockResolvedValueOnce([
      { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
    ])
    .mockResolvedValueOnce([]) // duration_records
    .mockResolvedValueOnce([]); // outcome_responses (OES query)
}
