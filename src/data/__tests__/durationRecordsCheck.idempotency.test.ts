/**
 * Bug 2, Cycle A — Idempotency + persistence test (task 2.4).
 *
 * Purpose: prove the CHECK-widening migration `runDurationEndStatusCheckMigration`
 * is safe to run repeatedly and that an auto-ended (`timed_out`) session persists
 * once the CHECK is widened.
 *
 * Invariants pinned here:
 *   1. Running the migration TWICE is a no-op the second time — the DDL guard
 *      (`SELECT sql FROM sqlite_master … WHERE name='duration_records'`, returns
 *      early when the DDL already lists 'timed_out') short-circuits, so no second
 *      rebuild happens and all rows are preserved (Requirement 5.3).
 *   2. After the migration, a `timed_out` row can be inserted and reads back —
 *      auto-ended sessions are no longer silently dropped (Requirement 5.1).
 *
 * Note on Requirement 5.4: auto-ended (`timed_out`) rows are SAVED here but are
 * deliberately EXCLUDED from the "Practice time" line — the graph query
 * (`computeToolOutcomeTrend` in `src/services/correlationEngine.ts`) filters to
 * `end_status = 'completed'`. That exclusion is a query-layer concern verified in
 * the correlation-engine tests; this test does NOT touch or assert any graph
 * query, it only proves the row is stored.
 *
 * Uses `node:sqlite` (`DatabaseSync`) as a REAL in-memory SQL engine so the
 * CHECK constraint, the DDL guard, and the row copy are genuinely enforced.
 *
 * Validates: Requirements 5.1, 5.3
 */

import { DatabaseSync } from 'node:sqlite';

import { runDurationEndStatusCheckMigration } from '../migrations';

function createRealSqliteDb() {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]): Promise<void> => {
      db.prepare(sql).run(...(params as never[]));
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
  };
}

type RealDb = ReturnType<typeof createRealSqliteDb>;

interface DurationRow {
  id: string;
  card_id: string;
  started_at: string;
  ended_at: string;
  active_duration_sec: number;
  end_status: string;
}

/** OLD two-value schema (pre task 2.3) so the first migration triggers the rebuild. */
const OLD_TWO_VALUE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS duration_records (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  active_duration_sec INTEGER NOT NULL,
  end_status TEXT NOT NULL CHECK(end_status IN ('completed', 'collapsed'))
);

CREATE INDEX IF NOT EXISTS idx_duration_records_card ON duration_records(card_id);
CREATE INDEX IF NOT EXISTS idx_duration_records_ended_at ON duration_records(ended_at);
`;

const insertRow = (db: RealDb, row: DurationRow) =>
  db.runAsync(
    `INSERT INTO duration_records
       (id, card_id, started_at, ended_at, active_duration_sec, end_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    row.id,
    row.card_id,
    row.started_at,
    row.ended_at,
    row.active_duration_sec,
    row.end_status
  );

const readAllRows = (db: RealDb) =>
  db.getAllAsync<DurationRow>(
    `SELECT id, card_id, started_at, ended_at, active_duration_sec, end_status
       FROM duration_records
      ORDER BY id`
  );

const readTableDdl = (db: RealDb) =>
  db
    .getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'duration_records'`
    )
    .then((row) => row?.sql ?? '');

const completedRow: DurationRow = {
  id: 'rec-completed',
  card_id: 'card-1',
  started_at: '2024-01-01T00:00:00.000Z',
  ended_at: '2024-01-01T00:05:00.000Z',
  active_duration_sec: 300,
  end_status: 'completed',
};

const collapsedRow: DurationRow = {
  id: 'rec-collapsed',
  card_id: 'card-2',
  started_at: '2024-01-02T00:00:00.000Z',
  ended_at: '2024-01-02T00:02:00.000Z',
  active_duration_sec: 120,
  end_status: 'collapsed',
};

describe('runDurationEndStatusCheckMigration — idempotency & timed_out persistence', () => {
  it('running the migration twice is a no-op the second time and preserves all rows', async () => {
    const db = createRealSqliteDb();
    await db.execAsync(OLD_TWO_VALUE_SCHEMA_SQL);

    await insertRow(db, completedRow);
    await insertRow(db, collapsedRow);

    // First run performs the real rebuild (old DDL lacks 'timed_out').
    await runMigrationExpectingWiden(db);
    const afterFirst = await readAllRows(db);
    expect(afterFirst).toEqual([collapsedRow, completedRow]);
    const ddlAfterFirst = await readTableDdl(db);
    expect(ddlAfterFirst).toContain('timed_out');

    // Second run: the DDL guard sees 'timed_out' already present and returns
    // early — no rebuild, rows and DDL unchanged.
    await runDurationEndStatusCheckMigration(db as never);
    const afterSecond = await readAllRows(db);
    expect(afterSecond).toEqual(afterFirst);
    expect(await readTableDdl(db)).toEqual(ddlAfterFirst);
  });

  it('persists a timed_out row after the migration (Requirement 5.1)', async () => {
    const db = createRealSqliteDb();
    await db.execAsync(OLD_TWO_VALUE_SCHEMA_SQL);

    await runDurationEndStatusCheckMigration(db as never);

    const timedOutRow: DurationRow = {
      id: 'rec-timed-out',
      card_id: 'card-3',
      started_at: '2024-01-03T00:00:00.000Z',
      ended_at: '2024-01-03T00:04:00.000Z',
      active_duration_sec: 240,
      end_status: 'timed_out',
    };

    // Req 5.1: the auto-ended status is now accepted and stored.
    await expect(insertRow(db, timedOutRow)).resolves.toBeUndefined();
    const rows = await readAllRows(db);
    expect(rows).toEqual([timedOutRow]);
    // NOTE (Req 5.4): this stored timed_out row is intentionally excluded from
    // the "Practice time" line by the graph query (end_status='completed' filter
    // in the correlation engine) — verified in the correlation-engine tests, not
    // here. This test only proves the row is saved, not that it's charted.
  });

  it('is a no-op on an already-widened (fresh install) schema', async () => {
    // A fresh install already has the three-value CHECK, so the guard should
    // short-circuit and leave everything untouched.
    const db = createRealSqliteDb();
    await db.execAsync(`
      CREATE TABLE duration_records (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        active_duration_sec INTEGER NOT NULL,
        end_status TEXT NOT NULL CHECK(end_status IN ('completed', 'collapsed', 'timed_out'))
      )
    `);
    const ddlBefore = await readTableDdl(db);

    await runDurationEndStatusCheckMigration(db as never);

    expect(await readTableDdl(db)).toEqual(ddlBefore);
  });
});

/** First-run helper: asserts the pre-run DDL lacked 'timed_out' (so a rebuild is warranted). */
async function runMigrationExpectingWiden(db: RealDb) {
  const before = await readTableDdl(db);
  expect(before).not.toContain('timed_out');
  await runDurationEndStatusCheckMigration(db as never);
}
