/**
 * Library Card Sync (Phase 1), task 1.2 — migration test (TEST-FIRST / TDD).
 *
 * Purpose: pin the behavior of the not-yet-written `runSourceLibraryVersionMigration`
 * (task 1.3). On a DB created before this column existed, running the migration must:
 *   1. Add a `source_library_version` column to `cards` that is a nullable INTEGER
 *      (verified via `PRAGMA table_info(cards)`), added exactly once.
 *   2. Preserve every existing row untouched.
 *   3. Be idempotent — running it a second time is a no-op (no error, no duplicate
 *      column, rows still preserved).
 *
 * This test is EXPECTED TO FAIL until task 1.3 adds `runSourceLibraryVersionMigration`
 * and registers it. That failure confirms the migration does not yet exist.
 *
 * Uses `node:sqlite` (`DatabaseSync`) as a REAL in-memory SQL engine so ALTER TABLE,
 * the PRAGMA guard, and row preservation are genuinely exercised — matching the
 * pattern established by the `durationRecordsCheck.*` migration tests in this dir.
 *
 * Validates: Requirements 1.2
 */

import { DatabaseSync } from 'node:sqlite';

// NOTE: this import will not resolve until task 1.3 adds the export. That is the
// expected test-first failure state for this task.
import { runSourceLibraryVersionMigration } from '../migrations';

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

interface TableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface CardRow {
  id: string;
  title: string;
  source_library_id: string | null;
  source_library_version: number | null;
}

/**
 * The `cards` table as it existed BEFORE the source_library_version column —
 * i.e. it already has `source_library_id` (added by the emotion migration) but
 * not the new version column. Simplified to the columns this test touches;
 * a real upgrade path has more columns, but ALTER TABLE ADD COLUMN and the
 * PRAGMA guard behave identically regardless of the other columns.
 */
const PRE_COLUMN_CARDS_SCHEMA_SQL = `
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_library_id TEXT
);
`;

const insertCard = (db: RealDb, id: string, title: string, sourceLibraryId: string | null) =>
  db.runAsync(
    `INSERT INTO cards (id, title, source_library_id) VALUES (?, ?, ?)`,
    id,
    title,
    sourceLibraryId
  );

const readTableInfo = (db: RealDb) =>
  db.getAllAsync<TableInfoRow>(`PRAGMA table_info(cards)`);

const readAllCards = (db: RealDb) =>
  db.getAllAsync<CardRow>(
    `SELECT id, title, source_library_id, source_library_version FROM cards ORDER BY id`
  );

describe('runSourceLibraryVersionMigration', () => {
  it('adds a nullable INTEGER source_library_version column exactly once and preserves existing rows', async () => {
    const db = createRealSqliteDb();
    await db.execAsync(PRE_COLUMN_CARDS_SCHEMA_SQL);

    await insertCard(db, 'card-1', 'Box Breathing', 'lib-box-breathing');
    await insertCard(db, 'card-2', 'My Custom Tool', null);

    // Sanity: the column does not exist before the migration.
    const before = await readTableInfo(db);
    expect(before.some((c) => c.name === 'source_library_version')).toBe(false);

    await runSourceLibraryVersionMigration(db as never);

    // Column added, exactly once, as a nullable INTEGER.
    const after = await readTableInfo(db);
    const versionCols = after.filter((c) => c.name === 'source_library_version');
    expect(versionCols).toHaveLength(1);
    expect(versionCols[0].type.toUpperCase()).toBe('INTEGER');
    expect(versionCols[0].notnull).toBe(0); // nullable

    // Existing rows preserved; new column defaults to null.
    const rows = await readAllCards(db);
    expect(rows).toEqual([
      {
        id: 'card-1',
        title: 'Box Breathing',
        source_library_id: 'lib-box-breathing',
        source_library_version: null,
      },
      {
        id: 'card-2',
        title: 'My Custom Tool',
        source_library_id: null,
        source_library_version: null,
      },
    ]);
  });

  it('is idempotent — running twice does not error, does not duplicate the column, and preserves rows', async () => {
    const db = createRealSqliteDb();
    await db.execAsync(PRE_COLUMN_CARDS_SCHEMA_SQL);
    await insertCard(db, 'card-1', 'Box Breathing', 'lib-box-breathing');

    await runSourceLibraryVersionMigration(db as never);
    const afterFirst = await readAllCards(db);

    // Second run must be a no-op (the PRAGMA guard short-circuits the ALTER).
    await expect(runSourceLibraryVersionMigration(db as never)).resolves.toBeUndefined();

    const info = await readTableInfo(db);
    expect(info.filter((c) => c.name === 'source_library_version')).toHaveLength(1);
    expect(await readAllCards(db)).toEqual(afterFirst);
  });
});
