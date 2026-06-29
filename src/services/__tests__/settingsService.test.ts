import { getStartMode, setStartMode, getLastUsedMode, setLastUsedMode, hasStartMode } from '../settingsService';
import { AppError, ErrorCode } from '../../types/errors';

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };
}

describe('settingsService', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  describe('getStartMode', () => {
    it('returns "wallet" when no row exists in settings', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await getStartMode();

      expect(result).toBe('wallet');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'wallet']
      );
    });

    it('returns the stored value when it is a valid StartMode', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const result = await getStartMode();

      expect(result).toBe('emotion');
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('returns "last_used" when stored value is "last_used"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'last_used' });

      const result = await getStartMode();

      expect(result).toBe('last_used');
    });

    it('returns "wallet" and self-heals when stored value is invalid', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'invalid_mode' });

      const result = await getStartMode();

      expect(result).toBe('wallet');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'wallet']
      );
    });

    it('returns "wallet" and self-heals when stored value is empty string', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: '' });

      const result = await getStartMode();

      expect(result).toBe('wallet');
      expect(mockDb.runAsync).toHaveBeenCalled();
    });
  });

  describe('setStartMode', () => {
    it('persists a valid "wallet" mode', async () => {
      await setStartMode('wallet');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'wallet']
      );
    });

    it('persists a valid "emotion" mode', async () => {
      await setStartMode('emotion');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'emotion']
      );
    });

    it('persists a valid "last_used" mode', async () => {
      await setStartMode('last_used');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'last_used']
      );
    });

    it('throws AppError for invalid mode value', async () => {
      await expect(setStartMode('invalid' as any)).rejects.toThrow(AppError);
      await expect(setStartMode('invalid' as any)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_REQUIRED_FIELD,
      });
    });

    it('throws AppError with PERSISTENCE_WRITE_FAILED when db write fails', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('disk full'));

      await expect(setStartMode('wallet')).rejects.toThrow(AppError);
      await expect(setStartMode('wallet')).rejects.toMatchObject({
        code: ErrorCode.PERSISTENCE_WRITE_FAILED,
      });
    });
  });

  describe('getLastUsedMode', () => {
    it('returns "wallet" when no row exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await getLastUsedMode();

      expect(result).toBe('wallet');
    });

    it('returns "wallet" when stored value is valid', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'wallet' });

      const result = await getLastUsedMode();

      expect(result).toBe('wallet');
    });

    it('returns "emotion" when stored value is "emotion"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const result = await getLastUsedMode();

      expect(result).toBe('emotion');
    });

    it('returns "wallet" when stored value is invalid', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'last_used' });

      const result = await getLastUsedMode();

      expect(result).toBe('wallet');
    });

    it('returns "wallet" when stored value is arbitrary string', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'xyz' });

      const result = await getLastUsedMode();

      expect(result).toBe('wallet');
    });
  });

  describe('setLastUsedMode', () => {
    it('persists "wallet" mode', async () => {
      await setLastUsedMode('wallet');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['last_used_mode', 'wallet']
      );
    });

    it('persists "emotion" mode', async () => {
      await setLastUsedMode('emotion');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['last_used_mode', 'emotion']
      );
    });

    it('throws AppError for invalid mode value', async () => {
      await expect(setLastUsedMode('invalid' as any)).rejects.toThrow(AppError);
      await expect(setLastUsedMode('invalid' as any)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_REQUIRED_FIELD,
      });
    });

    it('throws AppError with PERSISTENCE_WRITE_FAILED when db write fails', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('db error'));

      await expect(setLastUsedMode('wallet')).rejects.toThrow(AppError);
      await expect(setLastUsedMode('wallet')).rejects.toMatchObject({
        code: ErrorCode.PERSISTENCE_WRITE_FAILED,
      });
    });
  });

  describe('hasStartMode', () => {
    it('returns false when no row exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await hasStartMode();

      expect(result).toBe(false);
    });

    it('returns true when a valid start mode is stored', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const result = await hasStartMode();

      expect(result).toBe(true);
    });

    it('returns true for "wallet" value', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'wallet' });

      const result = await hasStartMode();

      expect(result).toBe(true);
    });

    it('returns true for "last_used" value', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'last_used' });

      const result = await hasStartMode();

      expect(result).toBe(true);
    });

    it('returns false when stored value is invalid', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'some_garbage' });

      const result = await hasStartMode();

      expect(result).toBe(false);
    });
  });
});
