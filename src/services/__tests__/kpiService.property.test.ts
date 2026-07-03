import * as fc from 'fast-check';
import { createKpiService } from '../kpiService';

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(7)),
}));

// Mock the database module
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('Feature: personal-kpi, Property 4: KPI record storage round-trip', () => {
  /**
   * **Validates: Requirements 3.1, 5.5**
   *
   * For any valid slider value (integer 1–10), any valid note (null or string ≤ 200 characters),
   * and any current Personal KPI label, recording a KPI entry and then reading it back SHALL
   * yield a record where value equals the input value, note equals the input note, and kpi_label
   * equals the Personal KPI label that was active at recording time.
   */
  it('write then read yields identical value, note, and kpi_label', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.oneof(
          fc.constant(null),
          fc.string({ minLength: 0, maxLength: 200 })
        ),
        fc.string({ minLength: 2, maxLength: 50 }).filter(
          (s) => s.replace(/\s/g, '').length >= 2
        ),
        async (value, note, kpiLabel) => {
          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
            getAllAsync: jest.fn().mockResolvedValue([]),
            execAsync: jest.fn().mockResolvedValue(undefined),
            withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Mock getPersonalKpi to return the generated kpiLabel
          mockDb.getFirstAsync.mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('settings') && params?.[0] === 'personal_kpi') {
              return { value: kpiLabel };
            }
            // For kpiCardExists check or card lookup
            if (sql.includes('cards') && sql.includes('source_library_id')) {
              return { id: 'mock-card-id', count: 1 };
            }
            return null;
          });

          // Mock getAllAsync for controls lookup during completion write
          mockDb.getAllAsync.mockResolvedValue([
            { id: 'ctrl-1', type: 'mood_slider' },
            { id: 'ctrl-2', type: 'text_input' },
          ]);

          const service = createKpiService();
          const record = await service.recordKpi(value, note);

          // Verify the returned record has matching value, note, and kpiLabel
          expect(record.value).toBe(value);
          expect(record.note).toBe(note);
          expect(record.kpiLabel).toBe(kpiLabel);
          expect(record.id).toBeDefined();
          expect(record.recordedAt).toBeDefined();

          // Verify the kpi_records INSERT was called with correct values
          const kpiInsertCall = mockDb.runAsync.mock.calls.find(
            (call: any[]) => call[0].includes('INSERT INTO kpi_records')
          );
          expect(kpiInsertCall).toBeDefined();
          const insertParams = kpiInsertCall![1] as any[];
          expect(insertParams[1]).toBe(value); // value
          expect(insertParams[2]).toBe(note); // note
          expect(insertParams[3]).toBe(kpiLabel); // kpi_label
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: personal-kpi, Property 5: KPI dual-write correctness', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any KPI card completion with a valid slider value and optional note, the system
   * SHALL write both a KPI_Record in kpi_records and a standard completion in the completions
   * table. Both writes SHALL succeed independently — failure of one SHALL NOT prevent the other.
   */
  it('both kpi_records and completions are written independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.oneof(
          fc.constant(null),
          fc.string({ minLength: 0, maxLength: 200 })
        ),
        async (value, note) => {
          let kpiRecordWritten = false;
          let completionWritten = false;

          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn().mockImplementation(async (sql: string) => {
              if (sql.includes('INSERT INTO kpi_records')) {
                kpiRecordWritten = true;
              }
              return { changes: 1 };
            }),
            getAllAsync: jest.fn().mockResolvedValue([
              { id: 'ctrl-1', type: 'mood_slider' },
              { id: 'ctrl-2', type: 'text_input' },
            ]),
            execAsync: jest.fn().mockResolvedValue(undefined),
            withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
              completionWritten = true;
              await fn();
            }),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          // Mock getPersonalKpi
          mockDb.getFirstAsync.mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('settings') && params?.[0] === 'personal_kpi') {
              return { value: 'Feeling calmer' };
            }
            if (sql.includes('cards') && sql.includes('source_library_id')) {
              return { id: 'mock-card-id', count: 1 };
            }
            if (sql.includes('total_uses')) {
              return { total_uses: 5, current_streak: 2, last_used_at: null };
            }
            return null;
          });

          const service = createKpiService();
          await service.recordKpi(value, note);

          // Both writes should have been attempted
          expect(kpiRecordWritten).toBe(true);
          expect(completionWritten).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if kpi_records write fails, completions write is still attempted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.oneof(
          fc.constant(null),
          fc.string({ minLength: 0, maxLength: 200 })
        ),
        async (value, note) => {
          let completionWritten = false;

          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn().mockImplementation(async (sql: string) => {
              if (sql.includes('INSERT INTO kpi_records')) {
                throw new Error('KPI record write failed');
              }
              return { changes: 1 };
            }),
            getAllAsync: jest.fn().mockResolvedValue([
              { id: 'ctrl-1', type: 'mood_slider' },
              { id: 'ctrl-2', type: 'text_input' },
            ]),
            execAsync: jest.fn().mockResolvedValue(undefined),
            withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
              completionWritten = true;
              await fn();
            }),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          mockDb.getFirstAsync.mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('settings') && params?.[0] === 'personal_kpi') {
              return { value: 'Feeling calmer' };
            }
            if (sql.includes('cards') && sql.includes('source_library_id')) {
              return { id: 'mock-card-id', count: 1 };
            }
            if (sql.includes('total_uses')) {
              return { total_uses: 5, current_streak: 2, last_used_at: null };
            }
            return null;
          });

          const service = createKpiService();
          // Should not throw — failure is logged silently
          await service.recordKpi(value, note);

          // Completion write should still be attempted
          expect(completionWritten).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if completions write fails, kpi_records write is not rolled back', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.oneof(
          fc.constant(null),
          fc.string({ minLength: 0, maxLength: 200 })
        ),
        async (value, note) => {
          let kpiRecordWritten = false;

          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn().mockImplementation(async (sql: string) => {
              if (sql.includes('INSERT INTO kpi_records')) {
                kpiRecordWritten = true;
              }
              return { changes: 1 };
            }),
            getAllAsync: jest.fn().mockResolvedValue([
              { id: 'ctrl-1', type: 'mood_slider' },
              { id: 'ctrl-2', type: 'text_input' },
            ]),
            execAsync: jest.fn().mockResolvedValue(undefined),
            withTransactionAsync: jest.fn(async () => {
              throw new Error('Completion write failed');
            }),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          mockDb.getFirstAsync.mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('settings') && params?.[0] === 'personal_kpi') {
              return { value: 'Sleeping better' };
            }
            if (sql.includes('cards') && sql.includes('source_library_id')) {
              return { id: 'mock-card-id', count: 1 };
            }
            return null;
          });

          const service = createKpiService();
          const record = await service.recordKpi(value, note);

          // KPI record should have been written successfully
          expect(kpiRecordWritten).toBe(true);
          // The function should still return a valid record
          expect(record.value).toBe(value);
          expect(record.note).toBe(note);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: personal-kpi, Property 6: KPI date range query correctness', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any set of KPI records and any date range (startDate, endDate), querying by that
   * range SHALL return only records where recorded_at falls within [startDate, endDate]
   * inclusive, ordered by recorded_at descending (newest first), with result count ≤ pageSize.
   */
  it('query returns only records in range, newest first, ≤ pageSize', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a list of records with various dates in 2024
        fc.array(
          fc.record({
            id: fc.uuid(),
            value: fc.integer({ min: 1, max: 10 }),
            note: fc.oneof(fc.constant(null), fc.string({ maxLength: 100 })),
            kpi_label: fc.string({ minLength: 2, maxLength: 50 }),
            recorded_at: fc.date({
              min: new Date('2024-01-01T00:00:00Z'),
              max: new Date('2024-12-31T23:59:59Z'),
            }).map((d) => d.toISOString()),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        // Generate start and end dates in 2024
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2024-12-31T23:59:59Z'),
        }).map((d) => d.toISOString()),
        fc.date({
          min: new Date('2024-01-01T00:00:00Z'),
          max: new Date('2024-12-31T23:59:59Z'),
        }).map((d) => d.toISOString()),
        fc.integer({ min: 1, max: 50 }),
        async (allRecords, dateA, dateB, pageSize) => {
          // Ensure startDate <= endDate
          const startDate = dateA <= dateB ? dateA : dateB;
          const endDate = dateA <= dateB ? dateB : dateA;

          // Compute expected results: filter to range, sort DESC, take pageSize
          const inRange = allRecords.filter(
            (r) => r.recorded_at >= startDate && r.recorded_at <= endDate
          );
          const sorted = [...inRange].sort(
            (a, b) => b.recorded_at.localeCompare(a.recorded_at)
          );
          const expected = sorted.slice(0, pageSize);

          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn(),
            getAllAsync: jest.fn().mockResolvedValue(expected),
            execAsync: jest.fn(),
            withTransactionAsync: jest.fn(),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createKpiService();
          const results = await service.getRecords({
            startDate,
            endDate,
            pageSize,
            page: 1,
          });

          // Verify: all results are within date range
          for (const record of results) {
            expect(record.recordedAt >= startDate).toBe(true);
            expect(record.recordedAt <= endDate).toBe(true);
          }

          // Verify: results are ordered DESC (newest first)
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].recordedAt >= results[i].recordedAt).toBe(true);
          }

          // Verify: count ≤ pageSize
          expect(results.length).toBeLessThanOrEqual(pageSize);

          // Verify: the SQL query has the correct WHERE, ORDER BY, and LIMIT clauses
          const getAllCall = mockDb.getAllAsync.mock.calls[0];
          const sql = getAllCall[0] as string;
          const params = getAllCall[1] as any[];

          expect(sql).toContain('recorded_at >= ?');
          expect(sql).toContain('recorded_at <= ?');
          expect(sql).toContain('ORDER BY recorded_at DESC');
          expect(sql).toContain('LIMIT ?');
          expect(params).toContain(startDate);
          expect(params).toContain(endDate);
          expect(params).toContain(pageSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('query without date range returns all records up to pageSize', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            value: fc.integer({ min: 1, max: 10 }),
            note: fc.constant(null),
            kpi_label: fc.constant('Feeling calmer'),
            recorded_at: fc.date({
              min: new Date('2024-01-01T00:00:00Z'),
              max: new Date('2024-12-31T23:59:59Z'),
            }).map((d) => d.toISOString()),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.integer({ min: 1, max: 50 }),
        async (allRecords, pageSize) => {
          const sorted = [...allRecords].sort(
            (a, b) => b.recorded_at.localeCompare(a.recorded_at)
          );
          const expected = sorted.slice(0, pageSize);

          const mockDb = {
            getFirstAsync: jest.fn(),
            runAsync: jest.fn(),
            getAllAsync: jest.fn().mockResolvedValue(expected),
            execAsync: jest.fn(),
            withTransactionAsync: jest.fn(),
          };

          mockGetDatabase.mockResolvedValue(mockDb as any);

          const service = createKpiService();
          const results = await service.getRecords({ pageSize, page: 1 });

          // Verify count ≤ pageSize
          expect(results.length).toBeLessThanOrEqual(pageSize);

          // Verify SQL does NOT have date range WHERE clauses
          const getAllCall = mockDb.getAllAsync.mock.calls[0];
          const sql = getAllCall[0] as string;

          expect(sql).not.toContain('recorded_at >= ?');
          expect(sql).not.toContain('recorded_at <= ?');
          expect(sql).toContain('ORDER BY recorded_at DESC');
          expect(sql).toContain('LIMIT ?');
        }
      ),
      { numRuns: 100 }
    );
  });
});
