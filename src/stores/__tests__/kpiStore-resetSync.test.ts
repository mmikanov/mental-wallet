/**
 * Bug Condition Exploration Test — resetAllRecords (Bug 1)
 *
 * This test verifies that resetAllRecords resets ALL related data:
 * - Deletes kpi_records (existing behavior)
 * - Resets card stats: total_uses = 0, current_streak = 0, last_used_at = null
 * - Deletes completions for the KPI card
 *
 * EXPECTED TO FAIL on unfixed code because resetAllRecords only deletes
 * kpi_records but doesn't touch the cards table or completions table.
 *
 * Validates: Requirements 1.1, 1.2, 2.1
 */

import { useKpiStore } from '../kpiStore';

// Mock dependencies
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-reset-test',
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));

jest.mock('@/stores/walletStore', () => ({
  useWalletStore: {
    getState: () => ({
      loadCards: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const { getDatabase } = require('@/data/database');

/**
 * Creates an in-memory database mock that tracks state.
 * Simulates a KPI card with existing stats and completion records.
 */
function createStatefulMockDb() {
  // In-memory state representing the database
  const state = {
    cards: [
      {
        id: 'card-kpi-123',
        source_library_id: 'lib-personal-kpi',
        total_uses: 5,
        current_streak: 3,
        last_used_at: '2024-06-10T14:30:00.000Z',
        updated_at: '2024-06-10T14:30:00.000Z',
      },
    ],
    completions: [
      { id: 'comp-1', card_id: 'card-kpi-123', completed_at: '2024-06-08T10:00:00.000Z' },
      { id: 'comp-2', card_id: 'card-kpi-123', completed_at: '2024-06-09T10:00:00.000Z' },
      { id: 'comp-3', card_id: 'card-kpi-123', completed_at: '2024-06-10T14:30:00.000Z' },
    ],
    control_values: [
      { id: 'cv-1', completion_id: 'comp-1', control_id: 'ctrl-1', value: '7' },
      { id: 'cv-2', completion_id: 'comp-2', control_id: 'ctrl-1', value: '6' },
      { id: 'cv-3', completion_id: 'comp-3', control_id: 'ctrl-1', value: '8' },
    ],
    kpi_records: [
      { id: 'rec-1', value: 7, note: null, kpi_label: 'Energy', recorded_at: '2024-06-08T10:00:00.000Z' },
      { id: 'rec-2', value: 6, note: 'tired', kpi_label: 'Energy', recorded_at: '2024-06-09T10:00:00.000Z' },
      { id: 'rec-3', value: 8, note: null, kpi_label: 'Energy', recorded_at: '2024-06-10T14:30:00.000Z' },
    ],
  };

  // Track SQL operations that were executed
  const executedOperations: string[] = [];

  const mockDb = {
    runAsync: jest.fn(async (sql: string, params?: unknown[]) => {
      executedOperations.push(sql);

      if (sql === 'DELETE FROM kpi_records') {
        state.kpi_records = [];
      }
      if (sql.includes('DELETE FROM completions')) {
        state.completions = state.completions.filter(c => c.card_id !== 'card-kpi-123');
      }
      if (sql.includes('DELETE FROM control_values')) {
        state.control_values = [];
      }
      if (sql.includes('UPDATE cards') && sql.includes('total_uses')) {
        const card = state.cards.find(c => c.id === 'card-kpi-123');
        if (card) {
          card.total_uses = 0;
          card.current_streak = 0;
          card.last_used_at = null as unknown as string;
        }
      }
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      executedOperations.push(sql);

      if (sql.includes('source_library_id')) {
        return state.cards.find(c => c.source_library_id === 'lib-personal-kpi') ?? null;
      }
      if (sql.includes('kpi_records ORDER BY recorded_at')) {
        if (state.kpi_records.length === 0) return null;
        return { recorded_at: state.kpi_records[state.kpi_records.length - 1].recorded_at };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      executedOperations.push(sql);

      if (sql.includes('completions')) {
        return state.completions;
      }
      return [];
    }),
  };

  return { mockDb, state, executedOperations };
}

describe('KpiStore — resetAllRecords Bug Condition Exploration (Bug 1)', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: '2024-06-10T14:30:00.000Z',
      lastCheckInLoaded: true,
      personalKpi: 'Energy',
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  it('should reset card stats (total_uses, current_streak, last_used_at) after resetAllRecords', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial state
    const cardBefore = state.cards.find(c => c.source_library_id === 'lib-personal-kpi');
    expect(cardBefore!.total_uses).toBe(5);
    expect(cardBefore!.current_streak).toBe(3);
    expect(cardBefore!.last_used_at).toBe('2024-06-10T14:30:00.000Z');

    // Act: Call the current resetAllRecords
    await useKpiStore.getState().resetAllRecords();

    // Assert: Card stats should be reset
    // BUG: The current implementation does NOT update cards table
    const cardAfter = state.cards.find(c => c.source_library_id === 'lib-personal-kpi');
    expect(cardAfter!.total_uses).toBe(0);
    expect(cardAfter!.current_streak).toBe(0);
    expect(cardAfter!.last_used_at).toBeNull();
  });

  it('should delete all completions for the KPI card after resetAllRecords', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial completions exist
    const completionsBefore = state.completions.filter(c => c.card_id === 'card-kpi-123');
    expect(completionsBefore.length).toBe(3);

    // Act: Call the current resetAllRecords
    await useKpiStore.getState().resetAllRecords();

    // Assert: Completions for the KPI card should be deleted
    // BUG: The current implementation does NOT delete from completions table
    const completionsAfter = state.completions.filter(c => c.card_id === 'card-kpi-123');
    expect(completionsAfter.length).toBe(0);
  });
});


describe('KpiStore — resetAllRecords Preservation Tests', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: '2024-06-10T14:30:00.000Z',
      lastCheckInLoaded: true,
      personalKpi: 'Energy',
      isLoading: false,
    });
    jest.clearAllMocks();
  });

  it('should delete all kpi_records after resetAllRecords (existing behavior preserved)', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial kpi_records exist
    expect(state.kpi_records.length).toBe(3);

    // Act
    await useKpiStore.getState().resetAllRecords();

    // Assert: kpi_records are deleted
    expect(state.kpi_records.length).toBe(0);
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM kpi_records');
  });

  it('should set store lastCheckInDate to null after resetAllRecords (existing behavior preserved)', async () => {
    const { mockDb } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial store state
    expect(useKpiStore.getState().lastCheckInDate).toBe('2024-06-10T14:30:00.000Z');

    // Act
    await useKpiStore.getState().resetAllRecords();

    // Assert: store state is nulled
    const storeState = useKpiStore.getState();
    expect(storeState.lastCheckInDate).toBeNull();
    expect(storeState.lastCheckInLoaded).toBe(true);
  });

  it('should be idempotent — calling resetAllRecords twice gives same result', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Act: call reset twice
    await useKpiStore.getState().resetAllRecords();
    await useKpiStore.getState().resetAllRecords();

    // Assert: same clean state after both calls
    expect(state.kpi_records.length).toBe(0);
    const storeState = useKpiStore.getState();
    expect(storeState.lastCheckInDate).toBeNull();
    expect(storeState.lastCheckInLoaded).toBe(true);
  });

  it('should show Alert on DB error (existing error handling preserved)', async () => {
    const { Alert } = require('react-native');
    getDatabase.mockRejectedValue(new Error('DB unavailable'));

    // Act
    await useKpiStore.getState().resetAllRecords();

    // Assert: Alert was shown with error message
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to reset KPI records');
  });
});
