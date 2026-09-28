/**
 * Bug 2, Cycle B — Preservation test (task 2.7, area 1 of 3).
 *
 * Purpose: pin the BASELINE `< 3s discard rule` that must remain true both
 * BEFORE and AFTER the Cycle B wiring (tasks 2.8–2.11 connect the tracker into
 * the card lifecycle). Wiring the tracker means `persist()` starts being called
 * in normal use; this test guards that very-brief opens (an accidental tap) are
 * still dropped and never written to `duration_records`, so the graph isn't
 * cluttered with noise.
 *
 * Behavior pinned (Requirement 4.5): `createDurationService().persist()` returns
 * `null` and does NOT insert when `activeDurationSec < 3`; it inserts (returns a
 * record) at `activeDurationSec >= 3`.
 *
 * Boundary cases covered: 0 and 2 (dropped), 3 (exact boundary — kept) and 5
 * (kept). Mirrors the DB-mock setup used by the existing `durationService.test.ts`.
 *
 * NOTE: preservation — this test asserts CURRENT production behavior and must
 * keep passing after the Cycle B wiring. No production code is changed.
 *
 * Validates: Requirements 4.5
 */

import { createDurationService, type DurationService } from '../durationService';

// Mock the database module (same seam as durationService.test.ts)
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock expo-crypto for a deterministic id
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234-5678-abcd-ef0123456789'),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

function createMockDb() {
  return {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    execAsync: jest.fn(),
  };
}

describe('DurationService persist() — < 3s discard rule (preservation, Req 4.5)', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let service: DurationService;

  const baseRecord = {
    cardId: 'card-abc',
    startedAt: '2024-06-01T10:00:00.000Z',
    endedAt: '2024-06-01T10:00:05.000Z',
    endStatus: 'completed' as const,
  };

  beforeEach(() => {
    mockDb = createMockDb();
    mockDb.runAsync.mockResolvedValue(undefined);
    mockGetDatabase.mockResolvedValue(mockDb as never);
    service = createDurationService();
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(mockDb as never);
    mockDb.runAsync.mockResolvedValue(undefined);
  });

  // --- Dropped (below the 3s floor) ---

  it('drops a 0s session: returns null and does NOT insert', async () => {
    const result = await service.persist({ ...baseRecord, activeDurationSec: 0 });

    expect(result).toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('drops a 2s session: returns null and does NOT insert', async () => {
    const result = await service.persist({ ...baseRecord, activeDurationSec: 2 });

    expect(result).toBeNull();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  // --- Kept (at or above the 3s floor) ---

  it('keeps a 3s session (exact boundary): inserts and returns the record', async () => {
    const result = await service.persist({ ...baseRecord, activeDurationSec: 3 });

    expect(result).not.toBeNull();
    expect(result!.activeDurationSec).toBe(3);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO duration_records'),
      expect.arrayContaining([baseRecord.cardId, 3, baseRecord.endStatus])
    );
  });

  it('keeps a 5s session: inserts and returns the record', async () => {
    const result = await service.persist({ ...baseRecord, activeDurationSec: 5 });

    expect(result).not.toBeNull();
    expect(result!.activeDurationSec).toBe(5);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
  });
});
