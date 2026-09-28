/**
 * Bug 2, Cycle A — Exploration test (task 2.1, FLIPPED at task 2.4).
 *
 * History: this test originally documented the LATENT BUG on the unfixed schema —
 * the `duration_records` CHECK constraint allowed only
 * `end_status IN ('completed', 'collapsed')`, so persisting the `'timed_out'`
 * status an auto-ended session records (Requirement 5.1) was REJECTED and that
 * session's practice time was silently lost.
 *
 * Task 2.3 fixed the bug two ways:
 *   1. `DURATION_RECORDS_SCHEMA_SQL` now creates the three-value CHECK directly,
 *      so fresh installs accept `'timed_out'` immediately.
 *   2. `runDurationEndStatusCheckMigration` rebuilds an existing two-value table
 *      to the widened CHECK for upgrading installs.
 *
 * This test is now FLIPPED to assert the FIXED behavior (task 2.4): after the
 * app's migrations run (mirroring `runMigrations`: `runDurationRecordsMigration`
 * then `runDurationEndStatusCheckMigration`), inserting a `'timed_out'` row
 * RESOLVES and reads back, while `'completed'`/`'collapsed'` keep working. The
 * schema-string sanity assertions now pin the new three-value CHECK.
 *
 * Note: this uses `node:sqlite` (available on the Node runtime) as a real SQL
 * engine so the CHECK constraint is genuinely enforced. The repo's other
 * migration tests mock expo-sqlite and only assert SQL strings, which cannot
 * prove constraint enforcement — hence a real engine here.
 *
 * Validates: Requirements 5.1
 */

import { DatabaseSync } from 'node:sqlite';

import {
  runDurationRecordsMigration,
  runDurationEndStatusCheckMigration,
  DURATION_RECORDS_SCHEMA_SQL,
} from '../migrations';

/**
 * Minimal adapter exposing the subset of the expo-sqlite `SQLiteDatabase` API
 * that the migrations and this test use, backed by a real `node:sqlite` DB so
 * CHECK constraints are actually enforced. `getFirstAsync` is needed by
 * `runDurationEndStatusCheckMigration`'s DDL idempotency guard.
 */
function createRealSqliteDb() {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    // Migrations call execAsync with the schema DDL / rebuild statements.
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    // Used by the test to attempt inserts.
    runAsync: async (sql: string, ...params: unknown[]): Promise<void> => {
      db.prepare(sql).run(...(params as never[]));
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    // The CHECK-widening migration reads the table DDL from sqlite_master.
    getFirstAsync: async <T>(sql: string, ...params: unknown[]): Promise<T | null> => {
      return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
  };
}

type RealDb = ReturnType<typeof createRealSqliteDb>;

/**
 * Run the app's duration-records migrations in the same order `runMigrations`
 * does: create the table, then widen the CHECK. On a fresh DB the widen is a
 * no-op (the schema already lists 'timed_out'); the ordering here mirrors
 * production so the test proves the real post-migration behavior.
 */
const runAppMigrations = async (db: RealDb) => {
  await runDurationRecordsMigration(db as never);
  await runDurationEndStatusCheckMigration(db as never);
};

const insertRow = (db: RealDb, endStatus: string) =>
  db.runAsync(
    `INSERT INTO duration_records
       (id, card_id, started_at, ended_at, active_duration_sec, end_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    'rec-1',
    'card-1',
    '2024-01-01T00:00:00.000Z',
    '2024-01-01T00:05:00.000Z',
    300,
    endStatus
  );

describe('duration_records end_status CHECK constraint (fixed schema)', () => {
  it('sanity: the schema now whitelists completed, collapsed, and timed_out', () => {
    // Guards the premise of this (flipped) test. The widened three-value CHECK
    // is the fix from task 2.3.
    expect(DURATION_RECORDS_SCHEMA_SQL).toContain(
      "CHECK(end_status IN ('completed', 'collapsed', 'timed_out'))"
    );
    expect(DURATION_RECORDS_SCHEMA_SQL).toContain('timed_out');
  });

  it('accepts an end_status of timed_out — confirms the bug is fixed', async () => {
    const db = createRealSqliteDb();
    await runAppMigrations(db);

    // The auto-end status the store persists (Requirement 5.1). On the fixed
    // schema this now RESOLVES and the row reads back — was the bug case.
    await expect(insertRow(db, 'timed_out')).resolves.toBeUndefined();

    const rows = await db.getAllAsync<{ end_status: string }>(
      `SELECT end_status FROM duration_records WHERE id = 'rec-1'`
    );
    expect(rows).toEqual([{ end_status: 'timed_out' }]);
  });

  it('still accepts completed and collapsed on the fixed schema (baseline sanity)', async () => {
    const db = createRealSqliteDb();
    await runAppMigrations(db);
    await expect(insertRow(db, 'completed')).resolves.toBeUndefined();

    // Fresh table for the second allowed value (reuses the same id otherwise).
    const db2 = createRealSqliteDb();
    await runAppMigrations(db2);
    await expect(insertRow(db2, 'collapsed')).resolves.toBeUndefined();
  });
});
