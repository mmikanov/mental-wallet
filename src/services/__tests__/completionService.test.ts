/**
 * Unit tests for CompletionService.
 * Tests streak logic, record flow, and stale streak reset.
 */

import { createCompletionService, resetStaleStreaks } from '../completionService';

// --- Mocks ---

const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });
const mockExecAsync = jest.fn().mockResolvedValue(undefined);
const mockGetAllAsync = jest.fn().mockResolvedValue([]);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

const mockDb = {
  runAsync: mockRunAsync,
  execAsync: mockExecAsync,
  getAllAsync: mockGetAllAsync,
  getFirstAsync: mockGetFirstAsync,
};

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: any[]) => mockRunAsync(...args),
    execAsync: (...args: any[]) => mockExecAsync(...args),
    getAllAsync: (...args: any[]) => mockGetAllAsync(...args),
    getFirstAsync: (...args: any[]) => mockGetFirstAsync(...args),
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-123'),
}));

describe('CompletionService', () => {
  let service: ReturnType<typeof createCompletionService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = createCompletionService();
  });

  describe('updateStreak', () => {
    it('should set streak to 1 when no previous use exists', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 0,
        current_streak: 0,
        last_used_at: null,
      });

      await service.updateStreak('card-1');

      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
        expect.arrayContaining([1, 1, expect.any(String), expect.any(String), 'card-1'])
      );
    });

    it('should keep streak unchanged when last used today', async () => {
      const today = new Date();
      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 5,
        current_streak: 3,
        last_used_at: today.toISOString(),
      });

      await service.updateStreak('card-1');

      // Streak stays at 3, totalUses increments to 6
      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
        expect.arrayContaining([6, 3, expect.any(String), expect.any(String), 'card-1'])
      );
    });

    it('should increment streak when last used yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      // Set to midday yesterday to ensure it's clearly yesterday
      yesterday.setHours(12, 0, 0, 0);

      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 10,
        current_streak: 4,
        last_used_at: yesterday.toISOString(),
      });

      await service.updateStreak('card-1');

      // Streak goes from 4 to 5, totalUses increments to 11
      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
        expect.arrayContaining([11, 5, expect.any(String), expect.any(String), 'card-1'])
      );
    });

    it('should reset streak to 1 when gap is more than 1 day', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 20,
        current_streak: 7,
        last_used_at: threeDaysAgo.toISOString(),
      });

      await service.updateStreak('card-1');

      // Streak resets to 1, totalUses increments to 21
      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE cards SET total_uses = ?, current_streak = ?, last_used_at = ?, updated_at = ? WHERE id = ?',
        expect.arrayContaining([21, 1, expect.any(String), expect.any(String), 'card-1'])
      );
    });

    it('should throw when card is not found', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);

      await expect(service.updateStreak('nonexistent')).rejects.toThrow(
        'Card nonexistent not found'
      );
    });
  });

  describe('record', () => {
    it('should create completion with control values in a transaction', async () => {
      // Mock for the streak update's getFirstAsync call
      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 2,
        current_streak: 1,
        last_used_at: null,
      });

      const values = [
        { controlId: 'ctrl-1', controlType: 'text_input' as const, value: 'hello' },
        { controlId: 'ctrl-2', controlType: 'mood_slider' as const, value: '7' },
      ];

      const result = await service.record('card-1', values);

      // Should begin and commit transaction
      expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');

      // Should insert completion
      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)',
        expect.arrayContaining(['test-uuid-123', 'card-1'])
      );

      // Should insert control values (2 values)
      const insertCalls = mockRunAsync.mock.calls.filter((call: any[]) =>
        (call[0] as string).includes('INSERT INTO control_values')
      );
      expect(insertCalls).toHaveLength(2);

      // Result should be well-formed
      expect(result.id).toBe('test-uuid-123');
      expect(result.cardId).toBe('card-1');
      expect(result.values).toHaveLength(2);
      expect(result.values[0].controlId).toBe('ctrl-1');
      expect(result.values[1].controlId).toBe('ctrl-2');
    });

    it('should rollback transaction on error', async () => {
      mockRunAsync.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.record('card-1', [
          { controlId: 'ctrl-1', controlType: 'text_input' as const, value: 'x' },
        ])
      ).rejects.toThrow('Failed to record completion');

      expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getByCard', () => {
    it('should return paginated completions with values, newest first', async () => {
      mockGetAllAsync
        .mockResolvedValueOnce([
          { id: 'comp-1', card_id: 'card-1', completed_at: '2024-01-02T10:00:00.000Z' },
          { id: 'comp-2', card_id: 'card-1', completed_at: '2024-01-01T10:00:00.000Z' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'val-1',
            completion_id: 'comp-1',
            control_id: 'ctrl-1',
            control_type: 'text_input',
            value: 'hello',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'val-2',
            completion_id: 'comp-2',
            control_id: 'ctrl-1',
            control_type: 'text_input',
            value: 'world',
          },
        ]);

      const results = await service.getByCard('card-1', { page: 1, pageSize: 20 });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('comp-1');
      expect(results[0].values[0].value).toBe('hello');
      expect(results[1].id).toBe('comp-2');
      expect(results[1].values[0].value).toBe('world');
    });

    it('should use default pagination (page 1, pageSize 20) when not provided', async () => {
      mockGetAllAsync.mockResolvedValueOnce([]);

      await service.getByCard('card-1');

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        ['card-1', 20, 0]
      );
    });
  });

  describe('deleteEntry', () => {
    it('should delete control values and completion record', async () => {
      await service.deleteEntry('comp-1');

      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM control_values WHERE completion_id = ?',
        ['comp-1']
      );
      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM completions WHERE id = ?',
        ['comp-1']
      );
    });
  });

  describe('getStreakInfo', () => {
    it('should return streak info from cards table', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({
        total_uses: 15,
        current_streak: 3,
        last_used_at: '2024-01-15T10:00:00.000Z',
      });

      const info = await service.getStreakInfo('card-1');

      expect(info).toEqual({
        totalUses: 15,
        currentStreak: 3,
        lastUsedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should throw when card is not found', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);

      await expect(service.getStreakInfo('nonexistent')).rejects.toThrow(
        'Card nonexistent not found'
      );
    });
  });
});

describe('resetStaleStreaks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reset streaks for cards with gaps > 1 day', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    mockGetAllAsync.mockResolvedValueOnce([
      { id: 'card-stale', last_used_at: threeDaysAgo.toISOString() },
      { id: 'card-recent', last_used_at: yesterday.toISOString() },
    ]);

    await resetStaleStreaks();

    // Only the stale card (3 days gap) should be reset
    const updateCalls = mockRunAsync.mock.calls.filter((call: any[]) =>
      (call[0] as string).includes('UPDATE cards SET current_streak = 0')
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][1]).toEqual(
      expect.arrayContaining(['card-stale'])
    );
  });

  it('should not reset streaks for cards used today or yesterday', async () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    mockGetAllAsync.mockResolvedValueOnce([
      { id: 'card-today', last_used_at: today.toISOString() },
      { id: 'card-yesterday', last_used_at: yesterday.toISOString() },
    ]);

    await resetStaleStreaks();

    // Neither card should be reset (0 and 1 day gaps are fine)
    const updateCalls = mockRunAsync.mock.calls.filter((call: any[]) =>
      (call[0] as string).includes('UPDATE cards SET current_streak = 0')
    );
    expect(updateCalls).toHaveLength(0);
  });
});
