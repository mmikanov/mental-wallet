import { getDaysSinceInstall } from '../analyticsRetention';

// --- Mocks ---

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

// --- Tests ---

describe('analyticsRetention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDaysSinceInstall', () => {
    it('sets first_open_date and returns 0 on first call', async () => {
      // No existing first_open_date — getFirstAsync returns the value we just inserted
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      mockGetFirstAsync.mockResolvedValueOnce({ value: today });

      const days = await getDaysSinceInstall();

      expect(days).toBe(0);
      // Verify INSERT OR IGNORE was called with today's date
      expect(mockRunAsync).toHaveBeenCalledWith(
        `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
        ['first_open_date', today]
      );
    });

    it('returns correct days when first_open_date is in the past', async () => {
      // Simulate first_open_date set 7 days ago
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const pastDate = sevenDaysAgo.toISOString().slice(0, 10);
      mockGetFirstAsync.mockResolvedValueOnce({ value: pastDate });

      const days = await getDaysSinceInstall();

      expect(days).toBe(7);
    });

    it('clamps negative values to 0 when device clock is set back', async () => {
      // Simulate first_open_date in the future (device clock was ahead when set)
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const futureDateStr = futureDate.toISOString().slice(0, 10);
      mockGetFirstAsync.mockResolvedValueOnce({ value: futureDateStr });

      const days = await getDaysSinceInstall();

      expect(days).toBe(0);
    });

    it('never overwrites first_open_date (uses INSERT OR IGNORE)', async () => {
      const existingDate = '2024-01-01';
      mockGetFirstAsync.mockResolvedValueOnce({ value: existingDate });

      await getDaysSinceInstall();

      // Only INSERT OR IGNORE is called (no UPDATE or REPLACE)
      expect(mockRunAsync).toHaveBeenCalledTimes(1);
      expect(mockRunAsync).toHaveBeenCalledWith(
        `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
        expect.arrayContaining(['first_open_date'])
      );
    });

    it('returns 0 when first_open_date row is missing after insert', async () => {
      // Edge case: getFirstAsync returns null (shouldn't happen normally)
      mockGetFirstAsync.mockResolvedValueOnce(null);

      const days = await getDaysSinceInstall();

      // Falls back to today, so days_since_install = 0
      expect(days).toBe(0);
    });
  });
});
