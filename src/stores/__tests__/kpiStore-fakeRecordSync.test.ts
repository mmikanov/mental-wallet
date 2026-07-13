/**
 * Bug Condition Exploration Test — createFakeRecord (Bug 2)
 *
 * This test verifies that createFakeRecord syncs ALL related data:
 * - Inserts into kpi_records (existing behavior)
 * - Updates card stats: last_used_at = fake timestamp, total_uses = completions count
 * - Creates a matching completion record with completed_at = fake timestamp
 *
 * EXPECTED TO FAIL on unfixed code because createFakeRecord only writes to
 * kpi_records but doesn't touch the cards table or completions table.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 2.2
 */

import { useKpiStore } from '../kpiStore';

// Mock dependencies
jest.mock('@/data/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'mock-uuid-fake-record-test',
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

// Fixed reference date for deterministic timestamp computation
const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

// computeFakeRecordTimestamp(5, FIXED_NOW) → 2024-06-10T12:00:00.000Z
const EXPECTED_FAKE_TIMESTAMP = '2024-06-10T12:00:00.000Z';

/**
 * Creates an in-memory database mock that tracks state.
 * Simulates a KPI card with existing stats and completion records.
 */
function createStatefulMockDb() {
  // In-memory state representing the database
  const state = {
    cards: [
      {
        id: 'card-kpi-456',
        source_library_id: 'lib-personal-kpi',
        total_uses: 3,
        current_streak: 2,
        last_used_at: '2024-06-10T14:30:00.000Z',
        updated_at: '2024-06-10T14:30:00.000Z',
      },
    ],
    completions: [
      { id: 'comp-1', card_id: 'card-kpi-456', completed_at: '2024-06-08T10:00:00.000Z' },
      { id: 'comp-2', card_id: 'card-kpi-456', completed_at: '2024-06-09T10:00:00.000Z' },
      { id: 'comp-3', card_id: 'card-kpi-456', completed_at: '2024-06-10T14:30:00.000Z' },
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
  const executedOperations: Array<{ sql: string; params?: unknown[] }> = [];

  const mockDb = {
    runAsync: jest.fn(async (sql: string, params?: unknown[]) => {
      executedOperations.push({ sql, params });

      // Existing behavior: INSERT INTO kpi_records
      if (sql.includes('INSERT INTO kpi_records')) {
        const [id, value, note, kpiLabel, recordedAt] = params as string[];
        state.kpi_records.push({
          id,
          value: Number(value),
          note,
          kpi_label: kpiLabel,
          recorded_at: recordedAt,
        });
      }

      // Existing behavior: DELETE newer kpi_records
      if (sql.includes('DELETE FROM kpi_records WHERE recorded_at >')) {
        const threshold = params?.[0] as string;
        const excludeId = params?.[1] as string;
        state.kpi_records = state.kpi_records.filter(
          r => r.recorded_at <= threshold || r.id === excludeId
        );
      }

      // New behavior (Bug 2 fix): DELETE control_values for newer completions
      if (sql.includes('DELETE FROM control_values') && sql.includes('completed_at >')) {
        const cardId = params?.[0] as string;
        const threshold = params?.[1] as string;
        const newerCompletionIds = state.completions
          .filter(c => c.card_id === cardId && c.completed_at > threshold)
          .map(c => c.id);
        state.control_values = state.control_values.filter(
          cv => !newerCompletionIds.includes(cv.completion_id)
        );
      }

      // New behavior (Bug 2 fix): DELETE completions newer than fake timestamp
      if (sql.includes('DELETE FROM completions') && sql.includes('completed_at >')) {
        const cardId = params?.[0] as string;
        const threshold = params?.[1] as string;
        state.completions = state.completions.filter(
          c => !(c.card_id === cardId && c.completed_at > threshold)
        );
      }

      // New behavior (Bug 2 fix): INSERT INTO completions
      if (sql.includes('INSERT INTO completions')) {
        const [id, cardId, completedAt] = params as string[];
        state.completions.push({ id, card_id: cardId, completed_at: completedAt });
      }

      // New behavior (Bug 2 fix): UPDATE cards SET last_used_at, total_uses, current_streak
      if (sql.includes('UPDATE cards') && sql.includes('last_used_at')) {
        const card = state.cards.find(c => c.id === 'card-kpi-456');
        if (card) {
          // Simulate: total_uses = COUNT of completions for this card
          card.total_uses = state.completions.filter(c => c.card_id === 'card-kpi-456').length;
          card.current_streak = 1;
          // last_used_at = first param (the fake timestamp)
          card.last_used_at = params?.[0] as string;
        }
      }
    }),
    getFirstAsync: jest.fn(async (sql: string) => {
      executedOperations.push({ sql });

      if (sql.includes('source_library_id')) {
        return state.cards.find(c => c.source_library_id === 'lib-personal-kpi') ?? null;
      }
      if (sql.includes('kpi_records ORDER BY recorded_at')) {
        if (state.kpi_records.length === 0) return null;
        // Return the latest record by recorded_at
        const sorted = [...state.kpi_records].sort(
          (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        return { recorded_at: sorted[0].recorded_at };
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      executedOperations.push({ sql });

      if (sql.includes('completions')) {
        return state.completions;
      }
      return [];
    }),
  };

  return { mockDb, state, executedOperations };
}

describe('KpiStore — createFakeRecord Bug Condition Exploration (Bug 2)', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: '2024-06-10T14:30:00.000Z',
      lastCheckInLoaded: true,
      personalKpi: 'Energy',
      isLoading: false,
    });
    jest.clearAllMocks();

    // Mock Date to return a fixed time so computeFakeRecordTimestamp(5) is deterministic
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should update card.last_used_at to match the fake record timestamp after createFakeRecord', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial state
    const cardBefore = state.cards.find(c => c.source_library_id === 'lib-personal-kpi');
    expect(cardBefore!.last_used_at).toBe('2024-06-10T14:30:00.000Z');

    // Act: Call createFakeRecord(5) — should create a record 5 days before FIXED_NOW
    await useKpiStore.getState().createFakeRecord(5);

    // Assert: Card's last_used_at should be updated to the fake timestamp
    // BUG: The current implementation does NOT update cards table
    const cardAfter = state.cards.find(c => c.source_library_id === 'lib-personal-kpi');
    expect(cardAfter!.last_used_at).toBe(EXPECTED_FAKE_TIMESTAMP);
  });

  it('should have card.total_uses equal the count of completions for that card after createFakeRecord', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial state: 3 completions, total_uses = 3
    expect(state.completions.filter(c => c.card_id === 'card-kpi-456').length).toBe(3);
    expect(state.cards[0].total_uses).toBe(3);

    // Act: Call createFakeRecord(5) — the fake is 5 days ago from FIXED_NOW (2024-06-10T12:00:00Z)
    // Since the fake timestamp (2024-06-10T12:00:00Z) is BEFORE some existing completions
    // (comp-3 at 2024-06-10T14:30:00Z), the fix should:
    //   - delete completions newer than the fake timestamp (comp-3)
    //   - add a new completion at the fake timestamp
    // So expected completions after fix: comp-1, comp-2, + new fake completion = 3
    // And card.total_uses should be updated to 3 (recounted from completions)
    await useKpiStore.getState().createFakeRecord(5);

    // Assert: card.total_uses should reflect the recount from completions table
    // The fix recounts completions and updates the card's total_uses.
    // BUG: The current implementation does NOT update total_uses at all.
    // The card's total_uses remains at its initial value (3) by coincidence of initial state,
    // but we verify that the UPDATE was actually issued by checking the mock was called
    // with an UPDATE statement that sets total_uses.
    const updateCardCalls = mockDb.runAsync.mock.calls.filter(
      ([sql]: [string]) => sql.includes('UPDATE cards') && sql.includes('total_uses')
    );
    expect(updateCardCalls.length).toBeGreaterThan(0);
  });

  it('should create a completion record with completed_at matching the fake timestamp after createFakeRecord', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial completions
    const completionsBefore = state.completions.filter(c => c.card_id === 'card-kpi-456');
    expect(completionsBefore.length).toBe(3);
    expect(completionsBefore.some(c => c.completed_at === EXPECTED_FAKE_TIMESTAMP)).toBe(false);

    // Act: Call createFakeRecord(5)
    await useKpiStore.getState().createFakeRecord(5);

    // Assert: A new completion record should exist with completed_at = fake timestamp
    // BUG: The current implementation does NOT create a completion record
    const completionsAfter = state.completions.filter(c => c.card_id === 'card-kpi-456');
    const fakeCompletion = completionsAfter.find(c => c.completed_at === EXPECTED_FAKE_TIMESTAMP);
    expect(fakeCompletion).toBeDefined();
  });
});


describe('KpiStore — createFakeRecord Preservation Tests (Bug 2)', () => {
  beforeEach(() => {
    useKpiStore.setState({
      lastCheckInDate: '2024-06-10T14:30:00.000Z',
      lastCheckInLoaded: true,
      personalKpi: 'Energy',
      isLoading: false,
    });
    jest.clearAllMocks();

    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delete kpi_records newer than the fake timestamp (existing behavior)', async () => {
    const { mockDb, state } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Verify initial state: 3 kpi_records, one (rec-3) is newer than the fake timestamp
    // Fake timestamp = 2024-06-10T12:00:00.000Z
    // rec-3 recorded_at = 2024-06-10T14:30:00.000Z (newer than fake timestamp)
    expect(state.kpi_records.length).toBe(3);

    await useKpiStore.getState().createFakeRecord(5);

    // After createFakeRecord, records newer than 2024-06-10T12:00:00Z should be deleted
    // rec-3 (2024-06-10T14:30:00Z) is newer → should be deleted
    // rec-1 (2024-06-08T10:00:00Z) and rec-2 (2024-06-09T10:00:00Z) should remain
    // Plus the new fake record itself
    const newerRecords = state.kpi_records.filter(
      r => r.recorded_at > EXPECTED_FAKE_TIMESTAMP && r.id !== 'mock-uuid-fake-record-test'
    );
    expect(newerRecords.length).toBe(0);

    // Verify the DELETE statement was executed with the correct parameters
    const deleteCalls = mockDb.runAsync.mock.calls.filter(
      ([sql]: [string]) => sql.includes('DELETE FROM kpi_records WHERE recorded_at >'),
    );
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0][1]).toEqual([EXPECTED_FAKE_TIMESTAMP, 'mock-uuid-fake-record-test']);
  });

  it('should update store lastCheckInDate via loadLastCheckIn after creating fake record (existing behavior)', async () => {
    const { mockDb } = createStatefulMockDb();
    getDatabase.mockResolvedValue(mockDb);

    // Before: lastCheckInDate is the old value
    expect(useKpiStore.getState().lastCheckInDate).toBe('2024-06-10T14:30:00.000Z');

    await useKpiStore.getState().createFakeRecord(5);

    // After: loadLastCheckIn is called, which queries the latest record from kpi_records
    // The fake record (2024-06-10T12:00:00Z) should now be the latest since newer ones are deleted
    // loadLastCheckIn does: SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1
    const storeState = useKpiStore.getState();
    expect(storeState.lastCheckInDate).toBe(EXPECTED_FAKE_TIMESTAMP);
    expect(storeState.lastCheckInLoaded).toBe(true);
  });

  it('should show Alert on DB error (existing error handling preserved)', async () => {
    const { Alert } = require('react-native');
    const mockDb = {
      runAsync: jest.fn().mockRejectedValue(new Error('DB write failure')),
      getFirstAsync: jest.fn().mockRejectedValue(new Error('DB read failure')),
    };
    getDatabase.mockResolvedValue(mockDb);

    await useKpiStore.getState().createFakeRecord(5);

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to create fake record');
  });
});
