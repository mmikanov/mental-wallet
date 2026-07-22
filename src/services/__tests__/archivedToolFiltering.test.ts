/**
 * Tests for archived tool filtering behavior across CorrelationEngine and TierEvaluator.
 *
 * Validates: Requirements 14.1, 14.3, 14.5, 14.8
 */

import { createCorrelationEngine } from '../correlationEngine';
import { createTierEvaluator } from '../tierEvaluator';

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
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

describe('Archived Tool Filtering', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  // --- CorrelationEngine: computeToolCorrelations ---

  describe('CorrelationEngine — computeToolCorrelations', () => {
    it('excludes archived card completions when setting is OFF', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(false);

      // Return only the non-archived card (the query itself filters via JOIN)
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-active' },
      ]);

      // Setup for card-active: valid correlation data
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Active Tool' }) // card title
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

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');

      // Only active card should appear (archived is filtered by SQL WHERE clause)
      expect(results).toHaveLength(1);
      expect(results[0].cardId).toBe('card-active');
      expect(results[0].cardTitle).toBe('Active Tool');

      // Verify the setting was checked
      expect(mockGetIncludeArchivedTools).toHaveBeenCalled();

      // Verify the SQL query included is_archived = 0 filter
      const firstQuery = mockDb.getAllAsync.mock.calls[0][0] as string;
      expect(firstQuery).toContain('is_archived = 0');
    });

    it('includes archived card completions when setting is ON', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(true);

      // Return both active and archived cards (no archived filter in query)
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-active' },
        { card_id: 'card-archived' },
      ]);

      // Setup for card-active
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Active Tool' })
        .mockResolvedValueOnce({ avg_duration: null });
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 8, recorded_at: '2024-06-05T12:00:00Z' },
        ])
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Setup for card-archived
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Archived Tool' })
        .mockResolvedValueOnce({ avg_duration: null });
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 7, recorded_at: '2024-06-05T12:00:00Z' },
        ])
        .mockResolvedValueOnce([
          { id: 'comp-2', completed_at: '2024-06-05T10:00:00Z' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');

      // Both cards should appear when setting is ON
      expect(results).toHaveLength(2);
      const cardIds = results.map((r) => r.cardId);
      expect(cardIds).toContain('card-active');
      expect(cardIds).toContain('card-archived');

      // Verify the SQL query does NOT contain is_archived = 0 filter
      const firstQuery = mockDb.getAllAsync.mock.calls[0][0] as string;
      expect(firstQuery).not.toContain('is_archived = 0');
    });
  });

  // --- TierEvaluator: evaluate ---

  describe('TierEvaluator — evaluate', () => {
    it('excludes archived card completions when setting is OFF', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(false);

      // Mock: 7 check-ins (unfiltered), 3 tool uses (filtered), 1 distinct tool (filtered)
      // With archived cards excluded, we'd have fewer completions
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 7 })  // kpi_records count (always unfiltered)
        .mockResolvedValueOnce({ count: 3 })  // completions count (filtered — only non-archived)
        .mockResolvedValueOnce({ count: 1 }); // distinct card count (filtered — only non-archived)

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      // With 7 check-ins, 3 tool uses, 1 distinct tool → nascent
      expect(result.currentTier).toBe('nascent');
      expect(result.toolUseCount).toBe(3);
      expect(result.distinctToolCount).toBe(1);

      // Verify completions query uses is_archived = 0 filter
      const completionsCall = mockDb.getFirstAsync.mock.calls[1];
      const completionsQuery = completionsCall[0] as string;
      expect(completionsQuery).toContain('is_archived = 0');

      // Verify distinct query uses is_archived = 0 filter
      const distinctCall = mockDb.getFirstAsync.mock.calls[2];
      const distinctQuery = distinctCall[0] as string;
      expect(distinctQuery).toContain('is_archived = 0');
    });

    it('includes archived card completions when setting is ON', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(true);

      // Mock: 7 check-ins, 8 tool uses (including archived), 3 distinct tools (including archived)
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 7 })  // kpi_records count (always unfiltered)
        .mockResolvedValueOnce({ count: 8 })  // completions count (unfiltered — includes archived)
        .mockResolvedValueOnce({ count: 3 }); // distinct card count (unfiltered — includes archived)

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      // With 7 check-ins, 8 tool uses, 3 distinct tools → preliminary
      expect(result.currentTier).toBe('preliminary');
      expect(result.toolUseCount).toBe(8);
      expect(result.distinctToolCount).toBe(3);

      // Verify completions query does NOT filter by is_archived
      const completionsCall = mockDb.getFirstAsync.mock.calls[1];
      const completionsQuery = completionsCall[0] as string;
      expect(completionsQuery).not.toContain('is_archived');
    });

    it('always includes KPI records regardless of setting', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(false);

      // KPI count should be queried without any archived filter
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 14 }) // kpi_records — full count
        .mockResolvedValueOnce({ count: 5 })  // completions (filtered)
        .mockResolvedValueOnce({ count: 2 }); // distinct tools (filtered)

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      expect(result.checkInCount).toBe(14);

      // Verify KPI query does NOT contain is_archived filter
      const kpiCall = mockDb.getFirstAsync.mock.calls[0];
      const kpiQuery = kpiCall[0] as string;
      expect(kpiQuery).not.toContain('is_archived');
      expect(kpiQuery).toContain('kpi_records');
    });
  });

  // --- Restored card (is_archived = 0) always included ---

  describe('Restored card (is_archived = 0) data inclusion', () => {
    it('restored card is included regardless of setting being OFF', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(false);

      // A restored card has is_archived = 0, so it passes the filter
      // The SQL JOIN with cards.is_archived = 0 will include it
      mockDb.getAllAsync.mockResolvedValueOnce([
        { card_id: 'card-restored' }, // This card was archived then restored (is_archived = 0)
      ]);

      // Setup correlation data for the restored card
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ title: 'Restored Breathing Tool' })
        .mockResolvedValueOnce({ avg_duration: null });
      mockDb.getAllAsync
        .mockResolvedValueOnce([
          { id: 'kpi-1', value: 4, recorded_at: '2024-06-01T12:00:00Z' },
          { id: 'kpi-2', value: 7, recorded_at: '2024-06-05T12:00:00Z' },
        ])
        .mockResolvedValueOnce([
          { id: 'comp-1', completed_at: '2024-06-05T10:00:00Z' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const engine = createCorrelationEngine();
      const results = await engine.computeToolCorrelations('all');

      // Restored card (is_archived = 0) should be included even with setting OFF
      expect(results).toHaveLength(1);
      expect(results[0].cardId).toBe('card-restored');
      expect(results[0].cardTitle).toBe('Restored Breathing Tool');
    });

    it('restored card counted in TierEvaluator even with setting OFF', async () => {
      mockGetIncludeArchivedTools.mockResolvedValue(false);

      // The restored card has is_archived = 0, so completions for it pass the filter
      // Mock DB returning counts that include the restored card's data
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 10 }) // kpi_records
        .mockResolvedValueOnce({ count: 6 })  // completions (includes restored card's completions since is_archived = 0)
        .mockResolvedValueOnce({ count: 2 }); // distinct tools (includes restored card)

      const evaluator = createTierEvaluator();
      const result = await evaluator.evaluate();

      // Restored card's data is counted: 10 check-ins, 6 tool uses, 2 distinct → preliminary
      expect(result.currentTier).toBe('preliminary');
      expect(result.toolUseCount).toBe(6);
      expect(result.distinctToolCount).toBe(2);
    });
  });
});
