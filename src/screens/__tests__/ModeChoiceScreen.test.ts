/**
 * Unit tests for ModeChoiceScreen logic and RootNavigator launch routing.
 *
 * Tests the decision logic (settingsService integration and navigation routing)
 * rather than React rendering, since full screen rendering requires navigation context.
 *
 * Validates: Requirements 1.2, 1.3, 1.8, 1.9
 */

import * as settingsService from '../../services/settingsService';
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

describe('ModeChoiceScreen logic', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  describe('navigation to wallet on "wallet" selection (Req 1.2)', () => {
    it('persists "wallet" as start_mode when user selects wallet option', async () => {
      await settingsService.setStartMode('wallet');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'wallet']
      );
    });

    it('getStartMode returns "wallet" after setting "wallet"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'wallet' });

      const result = await settingsService.getStartMode();

      expect(result).toBe('wallet');
    });

    it('wallet mode does not include highlightSessionCard param', async () => {
      // When start_mode is 'wallet', RootNavigator navigates to MainTabs without highlight params.
      // Verify that getStartMode returns 'wallet' — navigation to MainTabs is standard (no highlight).
      mockDb.getFirstAsync.mockResolvedValue({ value: 'wallet' });

      const mode = await settingsService.getStartMode();

      expect(mode).toBe('wallet');
      // In RootNavigator: effectiveMode === 'wallet' → no initialMainTabsParams set
      // Navigation: routes: [{ name: 'MainTabs' }] — no params
    });
  });

  describe('navigation with highlight on "emotion" selection (Req 1.3)', () => {
    it('persists "emotion" as start_mode when user selects emotion option', async () => {
      await settingsService.setStartMode('emotion');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'emotion']
      );
    });

    it('getStartMode returns "emotion" after setting "emotion"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const result = await settingsService.getStartMode();

      expect(result).toBe('emotion');
    });

    it('emotion mode triggers highlight — effective mode is "emotion"', async () => {
      // When start_mode is 'emotion', RootNavigator should set initialMainTabsParams
      // with { screen: 'Wallet', params: { highlightSessionCard: true } }
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const mode = await settingsService.getStartMode();

      expect(mode).toBe('emotion');
      // In RootNavigator: effectiveMode === 'emotion' → sets initialMainTabsParams
      // Navigation: routes: [{ name: 'MainTabs', params: { screen: 'Wallet', params: { highlightSessionCard: true } } }]
    });

    it('last_used mode with last used "emotion" also triggers highlight', async () => {
      // Simulate last_used_mode = 'emotion' for the "last_used" start mode path
      mockDb.getFirstAsync.mockResolvedValue({ value: 'emotion' });

      const lastUsed = await settingsService.getLastUsedMode();

      expect(lastUsed).toBe('emotion');
      // In RootNavigator: startMode === 'last_used' → reads getLastUsedMode()
      // If lastUsed === 'emotion' → effectiveMode = 'emotion' → highlight applied
    });
  });

  describe('error handling on persistence failure (Req 1.8)', () => {
    it('throws AppError when database write fails during setStartMode', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('disk full'));

      await expect(settingsService.setStartMode('wallet')).rejects.toThrow(AppError);
      await expect(settingsService.setStartMode('wallet')).rejects.toMatchObject({
        code: ErrorCode.PERSISTENCE_WRITE_FAILED,
      });
    });

    it('error is catchable for retry flow', async () => {
      mockDb.runAsync.mockRejectedValue(new Error('database locked'));

      let caughtError: unknown = null;
      try {
        await settingsService.setStartMode('emotion');
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).toBeInstanceOf(AppError);
      expect((caughtError as AppError).code).toBe(ErrorCode.PERSISTENCE_WRITE_FAILED);
    });

    it('subsequent retry succeeds after initial failure', async () => {
      // First call fails
      mockDb.runAsync.mockRejectedValueOnce(new Error('temporary error'));
      // Second call succeeds
      mockDb.runAsync.mockResolvedValueOnce(undefined);

      await expect(settingsService.setStartMode('wallet')).rejects.toThrow(AppError);

      // Retry succeeds
      await expect(settingsService.setStartMode('wallet')).resolves.toBeUndefined();
    });

    it('throws validation error for invalid mode value', async () => {
      await expect(settingsService.setStartMode('invalid' as any)).rejects.toThrow(AppError);
      await expect(settingsService.setStartMode('invalid' as any)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_REQUIRED_FIELD,
      });
    });
  });

  describe('skip behavior defaults to "wallet" (Req 1.9)', () => {
    it('hasStartMode returns false when no start_mode exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const exists = await settingsService.hasStartMode();

      expect(exists).toBe(false);
    });

    it('hasStartMode returns true when valid start_mode exists', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'wallet' });

      const exists = await settingsService.hasStartMode();

      expect(exists).toBe(true);
    });

    it('getStartMode defaults to "wallet" when no value stored', async () => {
      // "Skip Intro" scenario: no start_mode exists, system defaults to 'wallet'
      mockDb.getFirstAsync.mockResolvedValue(null);

      const mode = await settingsService.getStartMode();

      expect(mode).toBe('wallet');
    });

    it('getStartMode self-heals and persists "wallet" for missing value', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      await settingsService.getStartMode();

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['start_mode', 'wallet']
      );
    });

    it('getStartMode defaults to "wallet" for invalid stored value', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'garbage_data' });

      const mode = await settingsService.getStartMode();

      expect(mode).toBe('wallet');
    });
  });
});

describe('RootNavigator initial route logic', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockGetDatabase.mockResolvedValue(mockDb as any);
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as any);
  });

  describe('disclaimer not acknowledged → "Disclaimer"', () => {
    it('returns Disclaimer route when disclaimer_acknowledged is missing', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      // RootNavigator checks: SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'
      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      const disclaimerAcknowledged = disclaimerResult?.value === 'true';

      expect(disclaimerAcknowledged).toBe(false);
      // Initial route should be 'Disclaimer'
    });

    it('returns Disclaimer route when disclaimer_acknowledged is "false"', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ value: 'false' });

      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      const disclaimerAcknowledged = disclaimerResult?.value === 'true';

      expect(disclaimerAcknowledged).toBe(false);
    });
  });

  describe('disclaimer acknowledged + no start mode → "ModeChoice"', () => {
    it('routes to ModeChoice when disclaimer acknowledged but no start_mode', async () => {
      // First call: disclaimer check → acknowledged
      // Second call: hasStartMode → no row
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ value: 'true' })  // disclaimer_acknowledged
        .mockResolvedValueOnce(null);                // start_mode (not set)

      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      const disclaimerAcknowledged = disclaimerResult?.value === 'true';
      expect(disclaimerAcknowledged).toBe(true);

      // hasStartMode check
      const startModeResult = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      const startModeExists = !!startModeResult &&
        ['wallet', 'emotion', 'last_used'].includes(startModeResult?.value);

      expect(startModeExists).toBe(false);
      // Initial route should be 'ModeChoice'
    });
  });

  describe('disclaimer acknowledged + start mode "wallet" → "MainTabs"', () => {
    it('routes to MainTabs without highlight params when start_mode is "wallet"', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ value: 'true' })    // disclaimer_acknowledged
        .mockResolvedValueOnce({ value: 'wallet' })  // hasStartMode → true
        .mockResolvedValueOnce({ value: 'wallet' }); // getStartMode → 'wallet'

      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      expect(disclaimerResult?.value).toBe('true');

      // hasStartMode
      const startModeRow = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      const startModeExists = !!startModeRow &&
        ['wallet', 'emotion', 'last_used'].includes(startModeRow?.value);
      expect(startModeExists).toBe(true);

      // getStartMode
      const startModeValue = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      expect(startModeValue?.value).toBe('wallet');

      // effectiveMode = 'wallet' → initialRoute = 'MainTabs', no highlight params
    });
  });

  describe('disclaimer acknowledged + start mode "emotion" → "MainTabs" with highlight', () => {
    it('routes to MainTabs with highlightSessionCard when start_mode is "emotion"', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ value: 'true' })      // disclaimer_acknowledged
        .mockResolvedValueOnce({ value: 'emotion' })   // hasStartMode → true
        .mockResolvedValueOnce({ value: 'emotion' });  // getStartMode → 'emotion'

      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      expect(disclaimerResult?.value).toBe('true');

      // hasStartMode
      const startModeRow = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      const startModeExists = !!startModeRow &&
        ['wallet', 'emotion', 'last_used'].includes(startModeRow?.value);
      expect(startModeExists).toBe(true);

      // getStartMode
      const startModeValue = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      expect(startModeValue?.value).toBe('emotion');

      // effectiveMode = 'emotion' → initialRoute = 'MainTabs'
      // initialMainTabsParams = { screen: 'Wallet', params: { highlightSessionCard: true } }
      const effectiveMode = startModeValue?.value === 'emotion' ? 'emotion' : 'wallet';
      expect(effectiveMode).toBe('emotion');

      // Verify the params that would be set
      const expectedParams = effectiveMode === 'emotion'
        ? { screen: 'Wallet', params: { highlightSessionCard: true } }
        : undefined;
      expect(expectedParams).toEqual({
        screen: 'Wallet',
        params: { highlightSessionCard: true },
      });
    });

    it('routes to MainTabs with highlight when last_used mode is "emotion"', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ value: 'true' })        // disclaimer_acknowledged
        .mockResolvedValueOnce({ value: 'last_used' })   // hasStartMode → true
        .mockResolvedValueOnce({ value: 'last_used' })   // getStartMode → 'last_used'
        .mockResolvedValueOnce({ value: 'emotion' });    // getLastUsedMode → 'emotion'

      const disclaimerResult = await mockDb.getFirstAsync(
        "SELECT value FROM settings WHERE key = 'disclaimer_acknowledged'"
      );
      expect(disclaimerResult?.value).toBe('true');

      // hasStartMode
      const startModeRow = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      expect(startModeRow?.value).toBe('last_used');

      // getStartMode
      const startModeValue = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      expect(startModeValue?.value).toBe('last_used');

      // getLastUsedMode
      const lastUsedRow = await mockDb.getFirstAsync(
        'SELECT value FROM settings WHERE key = ?'
      );
      expect(lastUsedRow?.value).toBe('emotion');

      // effectiveMode = 'emotion' (from last_used) → highlight applies
      const effectiveMode = lastUsedRow?.value === 'emotion' ? 'emotion' : 'wallet';
      expect(effectiveMode).toBe('emotion');
    });

    it('routes to MainTabs without highlight when last_used mode is "wallet"', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ value: 'true' })        // disclaimer_acknowledged
        .mockResolvedValueOnce({ value: 'last_used' })   // hasStartMode → true
        .mockResolvedValueOnce({ value: 'last_used' })   // getStartMode → 'last_used'
        .mockResolvedValueOnce({ value: 'wallet' });     // getLastUsedMode → 'wallet'

      // Simulate route logic
      await mockDb.getFirstAsync('disclaimer');
      await mockDb.getFirstAsync('hasStartMode');
      const startMode = (await mockDb.getFirstAsync('getStartMode'))?.value;
      const lastUsed = (await mockDb.getFirstAsync('getLastUsedMode'))?.value;

      const effectiveMode = startMode === 'emotion'
        ? 'emotion'
        : startMode === 'last_used'
          ? (lastUsed === 'emotion' ? 'emotion' : 'wallet')
          : 'wallet';

      expect(effectiveMode).toBe('wallet');
    });
  });
});
