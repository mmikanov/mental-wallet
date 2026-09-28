/**
 * Bug 2, Cycle A — Preservation test (task 2.2, re-pointed at task 2.4).
 *
 * Purpose: capture the BASELINE behavior that must remain true both BEFORE and
 * AFTER task 2.3 widened the `end_status` CHECK to include `'timed_out'`.
 *
 * Two invariants are pinned here:
 *   1. `completed` and `collapsed` rows can be inserted and read back — the
 *      already-allowed statuses must keep working (no regression).
 *   2. Rows that already exist in the table survive the CHECK-widening rebuild
 *      intact (Requirement 5.3: "Saving these sessions SHALL NOT disturb or lose
 *      any usage already recorded on a user's device."). Because SQLite can't
 *      ALTER a CHECK in place, `runDurationEndStatusCheckMigration` rebuilds the
 *      table (create new → INSERT…SELECT → drop → rename → recreate indexes); it
 *      must copy every existing row through unchanged and lose none.
 *
 * Task 2.4 re-pointed the `runMigration` seam (see the `TODO(2.4)` note now
 * resolved on the helper) at `runDurationEndStatusCheckMigration`, so the
 * "existing rows survive a migration" assertion now proves the REBUILD preserves
 * rows, not merely that an idempotent CREATE does.
 *
 * Uses `node:sqlite` (`DatabaseSync`) as a REAL in-memory SQL engine — same
 * approach as the exploration test (task 2.1) — so the CHECK constraint and the
 * row copy are genuinely enforced, not mocked.
 *
 * Validates: Requirements 5.3
 */

import { DatabaseSync } from 'node:sqlite';

import {
  runDurationRecordsMigration,
  runDurationEndStatusCheckMigration,
} from '../migrations';

/**
 * Minimal adapter exposing the subset of the expo-sqlite `SQLiteDatabase` API
 * that the migrations and this test use, backed by a real `node:sqlite` DB so
 * CHECK constraints and row copies are actually enforced. `getFirstAsync` is
 * needed by the CHECK-widening migration's DDL idempotency guard.
 */
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

/**
 * The OLD two-value schema, as it existed on devices before task 2.3. Seeding a
 * table in this shape and then running the CHECK-widening migration exercises
 * the real rebuild path (the fresh three-value schema would short-circuit the
 * migration's DDL guard, so we must start from the pre-fix DDL to prove the
 * rebuild preserves rows).
 */
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

const createOldSchema = (db: RealDb) => db.execAsync(OLD_TWO_VALUE_SCHEMA_SQL);

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

const readIndexNames = (db: RealDb) =>
  db
    .getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master
        WHERE type = 'index' AND tbl_name = 'duration_records'
          AND name LIKE 'idx_duration_records%'
        ORDER BY name`
    )
    .then((rows) => rows.map((r) => r.name));

/**
 * The migration whose row-preservation guarantee this test pins.
 *
 * TODO(2.4) — DONE: re-pointed from the idempotent `runDurationRecordsMigration`
 * at the CHECK-widening rebuild `runDurationEndStatusCheckMigration`. The
 * "existing rows survive a migration" test below now proves the REBUILD copies
 * every existing row through unchanged (Requirement 5.3), not just that an
 * idempotent CREATE preserves rows.
 */
const runMigration = (db: RealDb) => runDurationEndStatusCheckMigration(db as never);

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

describe('duration_records baseline (preservation — survives the CHECK-widening rebuild)', () => {
  it('inserts and reads back a completed row on the current schema', async () => {
    const db = createRealSqliteDb();
    await runDurationRecordsMigration(db as never);

    await insertRow(db, completedRow);

    const rows = await readAllRows(db);
    expect(rows).toEqual([completedRow]);
  });

  it('inserts and reads back a collapsed row on the current schema', async () => {
    const db = createRealSqliteDb();
    await runDurationRecordsMigration(db as never);

    await insertRow(db, collapsedRow);

    const rows = await readAllRows(db);
    expect(rows).toEqual([collapsedRow]);
  });

  it('preserves pre-existing completed and collapsed rows through the rebuild, indexes intact', async () => {
    const db = createRealSqliteDb();
    // Start from the OLD two-value schema so the rebuild path actually runs.
    await createOldSchema(db);

    // Seed rows that represent usage "already recorded on a user's device".
    await insertRow(db, completedRow);
    await insertRow(db, collapsedRow);

    const before = await readAllRows(db);
    expect(before).toEqual([collapsedRow, completedRow]); // ordered by id
    expect(await readIndexNames(db)).toEqual([
      'idx_duration_records_card',
      'idx_duration_records_ended_at',
    ]);

    // Run the CHECK-widening rebuild. Requirement 5.3 demands every existing row
    // survives unchanged and both indexes are recreated.
    await runMigration(db);

    const after = await readAllRows(db);
    expect(after).toEqual(before);
    expect(await readIndexNames(db)).toEqual([
      'idx_duration_records_card',
      'idx_duration_records_ended_at',
    ]);
  });
});
