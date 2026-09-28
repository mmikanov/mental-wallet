/**
 * Bug 2, Cycle B — Preservation test (task 2.7, area 3 of 3).
 *
 * Purpose: PIN the query that feeds the "Practice time" line of the Outcome
 * Trends dual-axis chart to `end_status = 'completed'`, so the Cycle B wiring
 * (which finally starts writing `duration_records` in normal use, including
 * `timed_out` rows once Cycle A widened the CHECK) cannot silently let
 * auto-ended sessions leak into practice time.
 *
 * FINDING (verified by reading `src/services/correlationEngine.ts`):
 *   `computeToolOutcomeTrend` is the source of `weeklyTotalDurationMin` — the
 *   array `PerToolOutcomeTrendsSection.tsx` passes to `<DualAxisChart>` as the
 *   Practice-time series. Its duration query (step 4) is:
 *
 *     SELECT active_duration_sec, started_at FROM duration_records
 *      WHERE card_id = ? AND end_status = 'completed'
 *
 *   i.e. it ALREADY filters to completed. The OTHER duration queries in the file
 *   (the correlation-computing branch that pulls all statuses, and the
 *   wallet-level query) do NOT feed this chart's Practice-time line, so they are
 *   out of scope for Req 5.4. This test proves the filter with a REAL SQL engine,
 *   because the existing property test (`toolOutcomeTrend.property.test.ts`,
 *   Property 7) mocks the DB and hands back pre-filtered rows — it cannot prove
 *   the SQL `WHERE end_status = 'completed'` clause actually excludes anything.
 *
 * Requirement 5.4: `timed_out` sessions are SAVED but SHALL NOT appear in the
 * Practice-time line for 1.0.5. Only `completed` sessions count.
 *
 * Setup: a real `node:sqlite` in-memory DB injected via the mocked `getDatabase`,
 * seeded with one `completed` (300s) and one `timed_out` (600s) duration record
 * for the same card, plus the completion + KPI rows the engine needs to emit a
 * result. The Practice-time value must reflect ONLY the 300s completed record.
 *
 * No production code is changed.
 *
 * Validates: Requirements 5.4
 */

import { DatabaseSync } from 'node:sqlite';

// Inject a real node:sqlite DB through the app's getDatabase seam.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// The engine reads the archived-tools setting for wallet-level queries; the
// per-tool trend path does not, but keep the mock inert to avoid real modules.
jest.mock('../settingsService', () => ({
  getIncludeArchivedTools: jest.fn().mockResolvedValue(false),
}));

import { getDatabase } from '../../data/database';
import { createCorrelationEngine } from '../correlationEngine';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

/**
 * Real-SQL-engine adapter exposing the subset of the expo-sqlite API the
 * correlation engine uses (`getAllAsync`). Backed by `node:sqlite` so the
 * `end_status = 'completed'` WHERE clause is genuinely enforced by SQLite.
 */
function createRealSqliteDb() {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    runAsync: async (sql: string, params: unknown[] = []): Promise<void> => {
      db.prepare(sql).run(...(params as never[]));
    },
    getAllAsync: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: unknown[] = []): Promise<T | null> => {
      return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
  };
}

type RealDb = ReturnType<typeof createRealSqliteDb>;

/** Minimal schema for the tables computeToolOutcomeTrend reads. */
const SCHEMA_SQL = `
CREATE TABLE completions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE TABLE kpi_records (
  id TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  kpi_label TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE duration_records (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  active_duration_sec INTEGER NOT NULL,
  end_status TEXT NOT NULL CHECK(end_status IN ('completed', 'collapsed', 'timed_out'))
);
`;

const CARD_ID = 'card-practice-time';

// Two ISO weeks so the engine emits >= 2 buckets and does not return null.
// Week 1: Mon 2024-03-04. Week 2: Mon 2024-03-11.
const WEEK1_DAY = '2024-03-04';
const WEEK2_DAY = '2024-03-11';

const COMPLETED_SEC = 300; // the ONLY record that should feed Practice time
const TIMED_OUT_SEC = 600; // must NOT feed Practice time (Req 5.4)

async function seed(db: RealDb) {
  await db.execAsync(SCHEMA_SQL);

  // A completion each week so both buckets qualify (KPI on Tool_Associated_Day).
  await db.runAsync(
    `INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)`,
    ['comp-1', CARD_ID, `${WEEK1_DAY}T10:00:00.000Z`]
  );
  await db.runAsync(
    `INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)`,
    ['comp-2', CARD_ID, `${WEEK2_DAY}T10:00:00.000Z`]
  );

  // A KPI score on each completion day (Tool_Associated_Day).
  await db.runAsync(
    `INSERT INTO kpi_records (id, value, kpi_label, recorded_at) VALUES (?, ?, ?, ?)`,
    ['kpi-1', 7, 'Mood', `${WEEK1_DAY}T09:00:00.000Z`]
  );
  await db.runAsync(
    `INSERT INTO kpi_records (id, value, kpi_label, recorded_at) VALUES (?, ?, ?, ?)`,
    ['kpi-2', 8, 'Mood', `${WEEK2_DAY}T09:00:00.000Z`]
  );

  // Both duration records land in WEEK 1 so, if the timed_out row leaked in, it
  // would inflate that single bucket — making a leak unmistakable.
  await db.runAsync(
    `INSERT INTO duration_records
       (id, card_id, started_at, ended_at, active_duration_sec, end_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['dur-completed', CARD_ID, `${WEEK1_DAY}T10:00:00.000Z`, `${WEEK1_DAY}T10:05:00.000Z`, COMPLETED_SEC, 'completed']
  );
  await db.runAsync(
    `INSERT INTO duration_records
       (id, card_id, started_at, ended_at, active_duration_sec, end_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['dur-timedout', CARD_ID, `${WEEK1_DAY}T11:00:00.000Z`, `${WEEK1_DAY}T11:10:00.000Z`, TIMED_OUT_SEC, 'timed_out']
  );
}

describe('Practice-time query filters to end_status = completed (preservation, Req 5.4)', () => {
  it('sanity: real SQL engine excludes timed_out at the WHERE clause', async () => {
    const db = createRealSqliteDb();
    await seed(db);

    const rows = await db.getAllAsync<{ active_duration_sec: number }>(
      `SELECT active_duration_sec FROM duration_records
        WHERE card_id = ? AND end_status = 'completed'`,
      [CARD_ID]
    );

    expect(rows).toEqual([{ active_duration_sec: COMPLETED_SEC }]);
  });

  it('weeklyTotalDurationMin reflects ONLY the completed record, never the timed_out one', async () => {
    const db = createRealSqliteDb();
    await seed(db);
    mockGetDatabase.mockResolvedValue(db as never);

    const engine = createCorrelationEngine();
    const result = await engine.computeToolOutcomeTrend(CARD_ID);

    expect(result).not.toBeNull();

    const totalMin = result!.weeklyTotalDurationMin.reduce((sum, v) => sum + v, 0);

    // Only the 300s completed record counts → 5 minutes.
    const expectedCompletedMin = COMPLETED_SEC / 60; // 5
    const timedOutMin = TIMED_OUT_SEC / 60; // 10 — must be excluded
    const bothMin = (COMPLETED_SEC + TIMED_OUT_SEC) / 60; // 15 — the leak value

    expect(totalMin).toBeCloseTo(expectedCompletedMin, 2);
    // Guard rails: the timed_out minutes are absent, and the total is NOT the
    // "both records included" value.
    expect(totalMin).not.toBeCloseTo(bothMin, 2);
    expect(totalMin).toBeLessThan(timedOutMin + expectedCompletedMin);
  });
});
