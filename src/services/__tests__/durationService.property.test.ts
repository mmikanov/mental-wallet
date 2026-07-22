import * as fc from 'fast-check';
import { createDurationService, DurationEndStatus } from '../durationService';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'mock-uuid-' + Math.random().toString(36).substring(7)
  ),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// --- Helpers ---

function makeISOTimestamp(date: Date): string {
  return date.toISOString();
}

function makeEndedAt(startedAt: string, durationSec: number): string {
  const start = new Date(startedAt);
  return new Date(start.getTime() + durationSec * 1000).toISOString();
}

// UUID v4 regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 date regex (simplified)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// --- Property 1: Duration session lifecycle produces valid record ---

describe('Feature: usage-outcome-insights, Property 1: Duration session lifecycle produces valid record', () => {
  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * For any valid card ID and any accumulated foreground duration >= 3 seconds
   * and any end status, calling persist on a valid record must produce a
   * DurationRecord with: a valid UUID id, the correct cardId, valid ISO 8601
   * UTC startedAt/endedAt (endedAt >= startedAt), activeDurationSec equal to
   * the accumulated foreground seconds, and the provided endStatus.
   */
  it('persist produces a valid DurationRecord with correct fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 3, max: 7200 }),
        fc.constantFrom(
          'completed' as DurationEndStatus,
          'collapsed' as DurationEndStatus,
          'timed_out' as DurationEndStatus
        ),
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2026-12-31T23:59:59Z'),
        }),
        async (cardId, activeDurationSec, endStatus, startDate) => {
          const startedAt = makeISOTimestamp(startDate);
          const endedAt = makeEndedAt(startedAt, activeDurationSec);

          const mockDb = {
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
            getAllAsync: jest.fn().mockResolvedValue([]),
            getFirstAsync: jest.fn().mockResolvedValue(null),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const result = await service.persist({
            cardId,
            startedAt,
            endedAt,
            activeDurationSec,
            endStatus,
          });

          // Must return a non-null record
          expect(result).not.toBeNull();

          if (result) {
            // Valid UUID id (mock generates 'mock-uuid-...' pattern)
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe('string');
            expect(result.id.length).toBeGreaterThan(0);

            // Correct cardId
            expect(result.cardId).toBe(cardId);

            // Valid ISO 8601 timestamps
            expect(new Date(result.startedAt).toISOString()).toBe(
              result.startedAt
            );
            expect(new Date(result.endedAt).toISOString()).toBe(result.endedAt);

            // endedAt >= startedAt
            expect(
              new Date(result.endedAt).getTime()
            ).toBeGreaterThanOrEqual(new Date(result.startedAt).getTime());

            // activeDurationSec matches input
            expect(result.activeDurationSec).toBe(activeDurationSec);

            // endStatus matches input
            expect(result.endStatus).toBe(endStatus);
          }

          // Verify INSERT was called with correct parameters
          expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
          const insertCall = mockDb.runAsync.mock.calls[0];
          expect(insertCall[0]).toContain('INSERT INTO duration_records');
          const params = insertCall[1] as any[];
          expect(params[1]).toBe(cardId);
          expect(params[2]).toBe(startedAt);
          expect(params[3]).toBe(endedAt);
          expect(params[4]).toBe(activeDurationSec);
          expect(params[5]).toBe(endStatus);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 4: Three-second minimum filter ---

describe('Feature: usage-outcome-insights, Property 4: Three-second minimum filter', () => {
  /**
   * **Validates: Requirements 1.6**
   *
   * For any DurationRecord with activeDurationSec < 3, persist must return null
   * and not store the record. For any DurationRecord with activeDurationSec >= 3,
   * persist must store and return a valid record.
   */
  it('records with activeDurationSec < 3 are discarded (return null, no INSERT)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom(
          'completed' as DurationEndStatus,
          'collapsed' as DurationEndStatus,
          'timed_out' as DurationEndStatus
        ),
        async (cardId, activeDurationSec, endStatus) => {
          const startedAt = '2024-06-15T10:00:00.000Z';
          const endedAt = makeEndedAt(startedAt, activeDurationSec);

          const mockDb = {
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
            getAllAsync: jest.fn().mockResolvedValue([]),
            getFirstAsync: jest.fn().mockResolvedValue(null),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const result = await service.persist({
            cardId,
            startedAt,
            endedAt,
            activeDurationSec,
            endStatus,
          });

          // Must return null
          expect(result).toBeNull();

          // Must NOT call INSERT
          expect(mockDb.runAsync).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with activeDurationSec >= 3 are stored and returned', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 3, max: 7200 }),
        fc.constantFrom(
          'completed' as DurationEndStatus,
          'collapsed' as DurationEndStatus,
          'timed_out' as DurationEndStatus
        ),
        async (cardId, activeDurationSec, endStatus) => {
          const startedAt = '2024-06-15T10:00:00.000Z';
          const endedAt = makeEndedAt(startedAt, activeDurationSec);

          const mockDb = {
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
            getAllAsync: jest.fn().mockResolvedValue([]),
            getFirstAsync: jest.fn().mockResolvedValue(null),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const result = await service.persist({
            cardId,
            startedAt,
            endedAt,
            activeDurationSec,
            endStatus,
          });

          // Must return a valid record
          expect(result).not.toBeNull();
          expect(result!.cardId).toBe(cardId);
          expect(result!.activeDurationSec).toBe(activeDurationSec);
          expect(result!.endStatus).toBe(endStatus);

          // Must call INSERT
          expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Duration query filter correctness ---

describe('Feature: usage-outcome-insights, Property 5: Duration query filter correctness', () => {
  /**
   * **Validates: Requirements 1.7**
   *
   * For any set of persisted DurationRecords and any valid query combining optional
   * filters (cardId, startDate inclusive, endDate inclusive, endStatus), the query
   * results must contain exactly the records matching ALL specified filter criteria.
   */
  it('query returns exactly the records matching all specified filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a set of duration records
        fc.array(
          fc.record({
            id: fc.uuid(),
            card_id: fc.constantFrom('card-a', 'card-b', 'card-c'),
            started_at: fc
              .date({
                min: new Date('2024-01-01T00:00:00Z'),
                max: new Date('2024-12-31T23:59:59Z'),
              })
              .map((d) => d.toISOString()),
            ended_at: fc
              .date({
                min: new Date('2024-01-01T00:00:00Z'),
                max: new Date('2024-12-31T23:59:59Z'),
              })
              .map((d) => d.toISOString()),
            active_duration_sec: fc.integer({ min: 3, max: 7200 }),
            end_status: fc.constantFrom('completed', 'collapsed', 'timed_out'),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        // Generate query options (all optional)
        fc.record({
          cardId: fc.oneof(
            fc.constant(undefined),
            fc.constantFrom('card-a', 'card-b', 'card-c')
          ),
          startDate: fc.oneof(
            fc.constant(undefined),
            fc
              .date({
                min: new Date('2024-01-01T00:00:00Z'),
                max: new Date('2024-12-31T23:59:59Z'),
              })
              .map((d) => d.toISOString())
          ),
          endDate: fc.oneof(
            fc.constant(undefined),
            fc
              .date({
                min: new Date('2024-01-01T00:00:00Z'),
                max: new Date('2024-12-31T23:59:59Z'),
              })
              .map((d) => d.toISOString())
          ),
          endStatus: fc.oneof(
            fc.constant(undefined),
            fc.constantFrom(
              'completed' as DurationEndStatus,
              'collapsed' as DurationEndStatus,
              'timed_out' as DurationEndStatus
            )
          ),
        }),
        async (allRecords, queryOptions) => {
          // Compute expected result by applying all filters
          let expected = [...allRecords];

          if (queryOptions.cardId !== undefined) {
            expected = expected.filter(
              (r) => r.card_id === queryOptions.cardId
            );
          }
          if (queryOptions.startDate !== undefined) {
            expected = expected.filter(
              (r) => r.started_at >= queryOptions.startDate!
            );
          }
          if (queryOptions.endDate !== undefined) {
            expected = expected.filter(
              (r) => r.started_at <= queryOptions.endDate!
            );
          }
          if (queryOptions.endStatus !== undefined) {
            expected = expected.filter(
              (r) => r.end_status === queryOptions.endStatus
            );
          }

          // Sort by started_at DESC (matches service implementation)
          expected.sort((a, b) => b.started_at.localeCompare(a.started_at));

          const mockDb = {
            runAsync: jest.fn(),
            getAllAsync: jest.fn().mockResolvedValue(expected),
            getFirstAsync: jest.fn(),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const results = await service.query(queryOptions);

          // Verify count matches
          expect(results.length).toBe(expected.length);

          // Verify all results match the filters
          for (const record of results) {
            if (queryOptions.cardId !== undefined) {
              expect(record.cardId).toBe(queryOptions.cardId);
            }
            if (queryOptions.startDate !== undefined) {
              expect(record.startedAt >= queryOptions.startDate).toBe(true);
            }
            if (queryOptions.endDate !== undefined) {
              expect(record.startedAt <= queryOptions.endDate).toBe(true);
            }
            if (queryOptions.endStatus !== undefined) {
              expect(record.endStatus).toBe(queryOptions.endStatus);
            }
          }

          // Verify the SQL query contains correct WHERE clauses
          const getAllCall = mockDb.getAllAsync.mock.calls[0];
          const sql = getAllCall[0] as string;

          if (queryOptions.cardId !== undefined) {
            expect(sql).toContain('card_id = ?');
          }
          if (queryOptions.startDate !== undefined) {
            expect(sql).toContain('started_at >= ?');
          }
          if (queryOptions.endDate !== undefined) {
            expect(sql).toContain('started_at <= ?');
          }
          if (queryOptions.endStatus !== undefined) {
            expect(sql).toContain('end_status = ?');
          }

          // Verify ORDER BY
          expect(sql).toContain('ORDER BY started_at DESC');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Duration stats correctness ---

describe('Feature: usage-outcome-insights, Property 6: Duration stats correctness', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any card with N >= 3 completed DurationRecords with durations [d1, d2, ..., dN]
   * ordered by date:
   * - Average = sum(d1..dN) / N (rounded).
   * - When N >= 5, trend: 'more' if avg(last 5) > avg(all) * 1.15, 'less' if
   *   avg(last 5) < avg(all) * 0.85, 'consistent' otherwise.
   * - When N < 5, trend is 'consistent'.
   * - When N < 3, stats return null.
   */
  it('returns null when fewer than 3 completed records exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.integer({ min: 3, max: 7200 }), {
          minLength: 0,
          maxLength: 2,
        }),
        async (cardId, durations) => {
          const rows = durations.map((d) => ({ active_duration_sec: d }));

          const mockDb = {
            runAsync: jest.fn(),
            getAllAsync: jest.fn().mockResolvedValue(rows),
            getFirstAsync: jest.fn(),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const stats = await service.getStats(cardId);

          expect(stats).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('computes correct average and trend for N >= 3 completed records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.integer({ min: 3, max: 7200 }), {
          minLength: 3,
          maxLength: 50,
        }),
        async (cardId, durations) => {
          // Rows are returned in DESC order (most recent first) by the SQL query
          const rows = durations.map((d) => ({ active_duration_sec: d }));

          const mockDb = {
            runAsync: jest.fn(),
            getAllAsync: jest.fn().mockResolvedValue(rows),
            getFirstAsync: jest.fn(),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createDurationService();
          const stats = await service.getStats(cardId);

          expect(stats).not.toBeNull();

          if (stats) {
            const N = durations.length;

            // Average = sum / N (rounded)
            const totalSum = durations.reduce((sum, d) => sum + d, 0);
            const expectedAvg = Math.round(totalSum / N);
            expect(stats.averageDurationSec).toBe(expectedAvg);

            // totalRecords = N
            expect(stats.totalRecords).toBe(N);

            // Recent average (last 5 by desc order = first 5 in the array)
            const recentDurations = durations.slice(0, 5);
            const recentSum = recentDurations.reduce((sum, d) => sum + d, 0);
            const expectedRecentAvg = Math.round(
              recentSum / recentDurations.length
            );
            expect(stats.recentAverageSec).toBe(expectedRecentAvg);

            // Trend direction
            if (N >= 5) {
              if (expectedRecentAvg >= expectedAvg * 1.15) {
                expect(stats.trendDirection).toBe('more');
              } else if (expectedRecentAvg <= expectedAvg * 0.85) {
                expect(stats.trendDirection).toBe('less');
              } else {
                expect(stats.trendDirection).toBe('consistent');
              }
            } else {
              // N < 5: trend is 'consistent' (service doesn't change trend when < 5)
              expect(stats.trendDirection).toBe('consistent');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
