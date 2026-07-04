import { useAnalyticsStore } from '../analyticsStore';

// --- Mocks ---

const mockRunAsync = jest.fn().mockResolvedValue(undefined);
const mockGetFirstAsync = jest.fn().mockResolvedValue(null);

jest.mock('../../data/database', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: unknown[]) => mockRunAsync(...args),
    getFirstAsync: (...args: unknown[]) => mockGetFirstAsync(...args),
  }),
}));

const mockResolveAnonymousUserId = jest
  .fn()
  .mockResolvedValue('aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');
const mockResetAnonymousUserId = jest
  .fn()
  .mockResolvedValue('11111111-2222-4333-9444-555555555555');

jest.mock('../../services/analyticsIdentity', () => ({
  resolveAnonymousUserId: (...args: unknown[]) =>
    mockResolveAnonymousUserId(...args),
  resetAnonymousUserId: (...args: unknown[]) =>
    mockResetAnonymousUserId(...args),
}));

const mockSetLoggerIdentity = jest.fn();
const mockSetLoggerOptIn = jest.fn();
const mockClearLoggerState = jest.fn();
const mockLogEvent = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/analyticsEventLogger', () => ({
  setLoggerIdentity: (...args: unknown[]) => mockSetLoggerIdentity(...args),
  setLoggerOptIn: (...args: unknown[]) => mockSetLoggerOptIn(...args),
  clearLoggerState: (...args: unknown[]) => mockClearLoggerState(...args),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

const mockStartNewSession = jest.fn().mockReturnValue({
  sessionId: 'sess-1234',
  sessionStartTime: '2025-01-01T00:00:00.000Z',
  backgroundEntryTime: null,
});
const mockClearSession = jest.fn();

jest.mock('../../services/analyticsSession', () => ({
  startNewSession: (...args: unknown[]) => mockStartNewSession(...args),
  clearSession: (...args: unknown[]) => mockClearSession(...args),
}));

const mockResetSendingToPending = jest.fn().mockResolvedValue(undefined);
const mockDeleteBehavioralPendingEvents = jest
  .fn()
  .mockResolvedValue(undefined);
const mockDeleteAllEvents = jest.fn().mockResolvedValue(undefined);

jest.mock('../../data/analyticsEventQueue', () => ({
  resetSendingToPending: (...args: unknown[]) =>
    mockResetSendingToPending(...args),
  deleteBehavioralPendingEvents: (...args: unknown[]) =>
    mockDeleteBehavioralPendingEvents(...args),
  deleteAllEvents: (...args: unknown[]) => mockDeleteAllEvents(...args),
}));

const mockStartTransmitter = jest.fn();
const mockStopTransmitter = jest.fn();

jest.mock('../../services/analyticsBatchTransmitter', () => ({
  startTransmitter: (...args: unknown[]) => mockStartTransmitter(...args),
  stopTransmitter: (...args: unknown[]) => mockStopTransmitter(...args),
}));

const mockDeleteItemAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: (...args: unknown[]) => mockDeleteItemAsync(...args),
}));

// --- Tests ---

describe('AnalyticsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useAnalyticsStore.setState({
      optIn: true,
      isIdentityReady: false,
      anonymousUserId: null,
    });
  });

  describe('initialize', () => {
    it('resolves identity and sets up analytics pipeline', async () => {
      await useAnalyticsStore.getState().initialize();

      const state = useAnalyticsStore.getState();
      expect(state.anonymousUserId).toBe(
        'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee'
      );
      expect(state.isIdentityReady).toBe(true);
      expect(mockSetLoggerIdentity).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee'
      );
      expect(mockStartNewSession).toHaveBeenCalled();
      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(true);
      expect(mockResetSendingToPending).toHaveBeenCalled();
      expect(mockStartTransmitter).toHaveBeenCalledWith(
        expect.objectContaining({
          batchSize: 50,
          flushThreshold: 999,
          flushIntervalMs: 300_000,
          retryBaseMs: 120_000,
          retryCapMs: 900_000,
        })
      );
    });

    it('loads opt-in preference from settings', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ value: 'false' });

      await useAnalyticsStore.getState().initialize();

      const state = useAnalyticsStore.getState();
      expect(state.optIn).toBe(false);
      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(false);
    });

    it('defaults opt-in to true when no setting exists', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);

      await useAnalyticsStore.getState().initialize();

      const state = useAnalyticsStore.getState();
      expect(state.optIn).toBe(true);
    });
  });

  describe('setOptIn', () => {
    it('updates state and persists when opting in', async () => {
      useAnalyticsStore.setState({ optIn: false });

      await useAnalyticsStore.getState().setOptIn(true);

      const state = useAnalyticsStore.getState();
      expect(state.optIn).toBe(true);
      expect(mockRunAsync).toHaveBeenCalledWith(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        ['analytics_opt_in', 'true']
      );
      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(true);
      expect(mockStartTransmitter).toHaveBeenCalled();
    });

    it('deletes behavioral events and stops transmitter when opting out', async () => {
      await useAnalyticsStore.getState().setOptIn(false);

      const state = useAnalyticsStore.getState();
      expect(state.optIn).toBe(false);
      expect(mockRunAsync).toHaveBeenCalledWith(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        ['analytics_opt_in', 'false']
      );
      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(false);
      expect(mockDeleteBehavioralPendingEvents).toHaveBeenCalled();
      expect(mockStopTransmitter).toHaveBeenCalled();
    });
  });

  describe('resetData', () => {
    it('performs full reset sequence and logs app_opened', async () => {
      useAnalyticsStore.setState({
        optIn: true,
        isIdentityReady: true,
        anonymousUserId: 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      await useAnalyticsStore.getState().resetData();

      const state = useAnalyticsStore.getState();

      // Verify transmitter was stopped then restarted
      expect(mockStopTransmitter).toHaveBeenCalled();

      // Verify identity was reset
      expect(mockResetAnonymousUserId).toHaveBeenCalled();
      expect(state.anonymousUserId).toBe(
        '11111111-2222-4333-9444-555555555555'
      );
      expect(state.isIdentityReady).toBe(true);

      // Verify queue cleared
      expect(mockDeleteAllEvents).toHaveBeenCalled();

      // Verify first_open_date deleted
      expect(mockRunAsync).toHaveBeenCalledWith(
        `DELETE FROM settings WHERE key = ?`,
        ['first_open_date']
      );

      // Verify identity_link_consent deleted from SecureStore
      expect(mockDeleteItemAsync).toHaveBeenCalledWith(
        'identity_link_consent'
      );

      // Verify session cleared and restarted
      expect(mockClearSession).toHaveBeenCalled();
      expect(mockClearLoggerState).toHaveBeenCalled();
      expect(mockSetLoggerIdentity).toHaveBeenCalledWith(
        '11111111-2222-4333-9444-555555555555'
      );
      expect(mockStartNewSession).toHaveBeenCalled();
      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(true);
      expect(mockStartTransmitter).toHaveBeenCalled();

      // Verify app_opened logged
      expect(mockLogEvent).toHaveBeenCalledWith('app_opened', {
        days_since_install: 0,
      });
    });

    it('preserves opt-in preference during reset', async () => {
      useAnalyticsStore.setState({ optIn: false });

      await useAnalyticsStore.getState().resetData();

      expect(mockSetLoggerOptIn).toHaveBeenCalledWith(false);
    });

    it('handles SecureStore deletion failure gracefully', async () => {
      mockDeleteItemAsync.mockRejectedValueOnce(new Error('SecureStore error'));

      // Should not throw
      await useAnalyticsStore.getState().resetData();

      const state = useAnalyticsStore.getState();
      expect(state.anonymousUserId).toBe(
        '11111111-2222-4333-9444-555555555555'
      );
    });
  });
});
