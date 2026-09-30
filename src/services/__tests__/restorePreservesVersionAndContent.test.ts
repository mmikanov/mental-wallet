/**
 * Library Card Sync (Phase 1), task 5.7 — restore preserves version + content.
 *
 * Req 2.6: the Archive surfaces NO update affordance. An outdated archived card
 * only becomes updatable AFTER it is restored to the wallet, where FocusedCardView
 * renders the pill. Crucially, `cardService.restore` must NOT silently apply the
 * update: restoring only unarchives the card (flips is_archived / stack_position)
 * and must leave `source_library_version` AND the card's controls/content
 * untouched. The user still opts in from the wallet after restore.
 *
 * This test pins that guarantee against a REAL in-memory SQLite engine
 * (node:sqlite DatabaseSync wrapped in the async expo-sqlite surface), matching the
 * harness used by `sourceLibraryVersionPersistence.test.ts` and
 * `updateFromLibrary.test.ts`, so the actual persisted columns are exercised.
 *
 * Seed: an archived, OUTDATED card (older/null source_library_version) with
 * controls. Call restore. Assert:
 *   - source_library_version unchanged (no silent update),
 *   - controls (type/config/is_required/position/id) unchanged,
 *   - is_archived flipped to 0 (card is back in the active wallet).
 *
 * Validates: Requirements 2.6
 */

import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../data/migrations';

// cardService obtains its DB via getDatabase(); point it at a real in-memory DB.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Unique-per-row UUIDs for a real DB.
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'uuid-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
}));

// restore() lazily requires reminderService to re-arm reminders AFTER the txn.
// Stub it so nothing pulls in expo-notifications; reactivate is a no-op here.
jest.mock('../reminderService', () => ({
  createReminderService: () => ({
    disableForCard: jest.fn(async () => undefined),
    reactivateForCard: jest.fn(async () => null),
  }),
}));

// eslint-disable-next-line import/first
import { createCardService } from '../cardService';
// eslint-disable-next-line import/first
import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

interface RealDb {
  raw: DatabaseSync;
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<{ changes: number }>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

function createRealSqliteDb(): RealDb {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql);
    },
    runAsync: async (sql: string, params: unknown[] = []) => {
      const info = db.prepare(sql).run(...(params as never[]));
      return { changes: Number(info.changes) };
    },
    getAllAsync: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    getFirstAsync: async <T>(sql: string, params: unknown[] = []): Promise<T | null> => {
      return (db.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
    withTransactionAsync: async (fn: () => Promise<void>): Promise<void> => {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const CATEGORY_ID = 'grounding-calming';

async function seedCategories(db: RealDb): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
    [CATEGORY_ID, 'Grounding & Calming', '#000000', 0]
  );
}

async function seedArchivedCard(
  db: RealDb,
  cardId: string,
  sourceLibraryVersion: number | null
): Promise<void> {
  const now = '2024-01-01T00:00:00Z';
  // Archived, outdated (older/null version), library card with controls.
  await db.runAsync(
    `INSERT INTO cards (
       id, title, description, icon_type, icon_value, background_type, background_value,
       category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at,
       is_archived, archived_at, previous_stack_position, allow_background_customization,
       source_library_id, source_library_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'library', -1, 8, 3, ?, 1, ?, 1, 1, ?, ?, ?, ?)`,
    [
      cardId,
      'Box Breathing',
      'A calming four-count breathing exercise.',
      'emoji',
      '🫁',
      'color',
      '#EDE7F6',
      CATEGORY_ID,
      '2024-06-01T09:00:00Z',
      '2024-06-02T00:00:00Z', // archived_at
      'lib-box-breathing',
      sourceLibraryVersion,
      now,
      now,
    ]
  );

  const controls: [string, string, number, string, number][] = [
    ['ctrl-note', 'text_input', 0, JSON.stringify({ label: 'Note', maxLength: 200 }), 0],
    ['ctrl-mood', 'mood_slider', 1, JSON.stringify({ label: 'Mood', min: 1, max: 5 }), 1],
  ];
  for (const [id, type, position, config, isRequired] of controls) {
    await db.runAsync(
      `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, cardId, type, position, config, isRequired, now]
    );
  }
}

async function readCardRow(db: RealDb, cardId: string) {
  return db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM cards WHERE id = ?`,
    [cardId]
  );
}

async function readControlRows(db: RealDb, cardId: string) {
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT id, type, position, config, is_required FROM controls WHERE card_id = ? ORDER BY position ASC`,
    [cardId]
  );
}

describe('cardService.restore — preserves version + content (task 5.7, Req 2.6)', () => {
  let db: RealDb;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    mockGetDatabase.mockReset();
    mockGetDatabase.mockResolvedValue(db as never);
  });

  it('does not change source_library_version or controls; only unarchives the card', async () => {
    // Seed an archived, OUTDATED card (stored version 1, older than any curated bump).
    await seedArchivedCard(db, 'card-restore', 1);

    const controlsBefore = await readControlRows(db, 'card-restore');
    const cardBefore = await readCardRow(db, 'card-restore');
    expect(cardBefore!.is_archived).toBe(1);
    expect(cardBefore!.source_library_version).toBe(1);

    const service = createCardService();
    await service.restore('card-restore');

    const cardAfter = await readCardRow(db, 'card-restore');
    const controlsAfter = await readControlRows(db, 'card-restore');

    // No silent update: version untouched.
    expect(cardAfter!.source_library_version).toBe(1);

    // Content untouched: controls identical (id/type/config/is_required/position).
    expect(controlsAfter).toEqual(controlsBefore);

    // Restore did its one job: the card is back in the active wallet.
    expect(cardAfter!.is_archived).toBe(0);
    expect(cardAfter!.archived_at).toBeNull();
  });

  it('also preserves a NULL source_library_version across restore', async () => {
    // A copy that predates versioning (null) must stay null through restore.
    await seedArchivedCard(db, 'card-restore-null', null);

    const controlsBefore = await readControlRows(db, 'card-restore-null');

    const service = createCardService();
    await service.restore('card-restore-null');

    const cardAfter = await readCardRow(db, 'card-restore-null');
    const controlsAfter = await readControlRows(db, 'card-restore-null');

    expect(cardAfter!.source_library_version).toBeNull();
    expect(controlsAfter).toEqual(controlsBefore);
    expect(cardAfter!.is_archived).toBe(0);
  });
});
