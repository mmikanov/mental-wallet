import { useKpiStore, setKpiService } from '../kpiStore';
import type { KpiService } from '@/services/kpiService';

// Mock dependencies
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-123',
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));

const { getDatabase } = require('@/data/database');

function makeMockDb(overrides?: Record<string, jest.Mock>) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(null),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeMockKpiService(overrides?: Partial<KpiService>): KpiService {
  return {
    getPersonalKpi: jest.fn().mockResolvedValue('Feeling good'),
    setPersonalKpi: jest.fn().mockResolvedValue(undefined),
    changePersonalKpi: jest.fn().mockResolvedValue(undefined),
    getChangeHistory: jest.fn().mockResolvedValue([]),
    seedKpiCard: jest.fn().mockResolvedValue(undefined),
    updateKpiCardLabel: jest.fn().mockResolvedValue(undefined),
    recordKpi: jest.fn().mockResolvedValue({
      id: 'rec-1',
      value: 7,
      note: null,
      kpiLabel: 'Feeling good',
      recordedAt: '2024-06-15T10:00:00.000Z',
    }),
    getRecords: jest.fn().mockResolvedValue([]),
    kpiCardExists: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('KpiStore — Badge Extension', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: null,
      lastCheckInLoaded: false,
      personalKpi: null,
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  describe('loadLastCheckIn', () => {
    it('sets lastCheckInDate from most recent DB record', async () => {
      const mockDb = makeMockDb({
        getFirstAsync: jest.fn().mockResolvedValue({
          recorded_at: '2024-06-10T14:30:00.000Z',
        }),
      });
      getDatabase.mockResolvedValue(mockDb);

      await useKpiStore.getState().loadLastCheckIn();

      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBe('2024-06-10T14:30:00.000Z');
      expect(state.lastCheckInLoaded).toBe(true);
    });

    it('sets lastCheckInDate to null when no records exist', async () => {
      const mockDb = makeMockDb({
        getFirstAsync: jest.fn().mockResolvedValue(null),
      });
      getDatabase.mockResolvedValue(mockDb);

      await useKpiStore.getState().loadLastCheckIn();

      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBeNull();
      expect(state.lastCheckInLoaded).toBe(true);
    });

    it('sets lastCheckInDate to null on DB error', async () => {
      getDatabase.mockRejectedValue(new Error('DB unavailable'));

      await useKpiStore.getState().loadLastCheckIn();

      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBeNull();
      expect(state.lastCheckInLoaded).toBe(true);
    });
  });

  describe('recordKpi', () => {
    it('updates lastCheckInDate immediately after recording', async () => {
      const mockService = makeMockKpiService({
        recordKpi: jest.fn().mockResolvedValue({
          id: 'rec-new',
          value: 8,
          note: 'Feeling great',
          kpiLabel: 'Energy level',
          recordedAt: '2024-06-15T18:00:00.000Z',
        }),
      });
      setKpiService(mockService);

      await useKpiStore.getState().recordKpi(8, 'Feeling great');

      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBe('2024-06-15T18:00:00.000Z');
    });
  });

  describe('createFakeRecord', () => {
    it('inserts a fake row and refreshes cache via loadLastCheckIn', async () => {
      const mockDb = makeMockDb({
        runAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({
          recorded_at: '2024-06-12T18:00:00.000Z',
        }),
      });
      getDatabase.mockResolvedValue(mockDb);

      await useKpiStore.getState().createFakeRecord(3);

      // Verify the INSERT was called with correct params
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO kpi_records (id, value, note, kpi_label, recorded_at) VALUES (?, ?, ?, ?, ?)',
        expect.arrayContaining(['mock-uuid-123', 0, 'Fake admin record', 'admin-test'])
      );

      // Verify loadLastCheckIn was called (cache refreshed)
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1'
      );

      // Verify state was updated from the re-query
      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBe('2024-06-12T18:00:00.000Z');
      expect(state.lastCheckInLoaded).toBe(true);
    });
  });

  describe('resetAllRecords', () => {
    it('deletes all records and nulls state', async () => {
      // Start with an existing lastCheckInDate
      useKpiStore.setState({
        lastCheckInDate: '2024-06-10T14:30:00.000Z',
        lastCheckInLoaded: true,
      });

      const mockDb = makeMockDb({
        runAsync: jest.fn().mockResolvedValue(undefined),
      });
      getDatabase.mockResolvedValue(mockDb);

      await useKpiStore.getState().resetAllRecords();

      // Verify DELETE was called
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM kpi_records');

      // Verify state is cleared
      const state = useKpiStore.getState();
      expect(state.lastCheckInDate).toBeNull();
      expect(state.lastCheckInLoaded).toBe(true);
    });
  });
});
