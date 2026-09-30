/**
 * Library Card Sync (Phase 1), task 2.1 — persist-at-add-time test (TEST-FIRST / TDD).
 *
 * Purpose: pin the not-yet-wired behavior (task 2.2) that the curated card's
 * CURRENT version is snapshotted onto the wallet copy at add-time, in the
 * `cards.source_library_version` column.
 *
 * Two behaviors are asserted against a REAL in-memory SQLite engine (so the
 * persisted column value is genuinely exercised, matching the
 * `sourceLibraryVersionMigration.test.ts` / `durationRecordsCheck.*` pattern):
 *
 *   1. `cardService.create(shell, controls, originBadge, categoryId,
 *      sourceLibraryId, sourceLibraryVersion)` writes the given
 *      `sourceLibraryVersion` into `cards.source_library_version`, AND writes
 *      NULL when the trailing param is omitted.
 *   2. `kpiService.seedKpiCard` persists the check-in card's CURRENT curated
 *      version into `source_library_version`. As of Phase 1.1 (task 8.1) the
 *      check-in definition (`KPI_CARD_DEFINITION`) is versioned at 1, so the seed
 *      persists 1 (previously null while the definition was unversioned).
 *
 * We assert on the PERSISTED DB value (SELECT source_library_version ...) rather
 * than on call arguments, per the task's guidance to prefer the persisted value.
 *
 * The extra `create` arg is passed through a typed cast so the file compiles
 * before task 2.2 widens the signature (test-first), then remains correct after.
 *
 * Validates: Requirements 1.2
 */

import { DatabaseSync } from 'node:sqlite';

import { createCardService } from '../cardService';
import { createKpiService } from '../kpiService';
import { runMigrations } from '../../data/migrations';
import type { CardShell, Control } from '../../types/index';

// The card/kpi services obtain their DB via getDatabase(); we point that at a
// real in-memory SQLite instance created per test.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Deterministic-enough UUIDs for a real DB (must be unique per row).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'uuid-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
}));

// reminderService is lazily required by cardService.archive/restore; not used
// here, but stub it so nothing pulls in expo-notifications.
jest.mock('../reminderService', () => ({
  createReminderService: () => ({
    disableForCard: jest.fn(async () => undefined),
    reactivateForCard: jest.fn(async () => null),
  }),
}));

import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

/**
 * Wrap node:sqlite's synchronous DatabaseSync in the async surface the services
 * expect from expo-sqlite (execAsync/runAsync/getAllAsync/getFirstAsync).
 * We keep a spy-able runAsync so we can also observe what the seed INSERT wrote.
 */
interface RealDb {
  raw: DatabaseSync;
  execAsync: jest.Mock<Promise<void>, [sql: string]>;
  runAsync: jest.Mock<Promise<{ changes: number }>, [sql: string, params?: unknown[]]>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

function createRealSqliteDb(): RealDb {
  const db = new DatabaseSync(':memory:');
  return {
    raw: db,
    execAsync: jest.fn(async (sql: string): Promise<void> => {
      db.exec(sql);
    }),
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      const info = db.prepare(sql).run(...(params as never[]));
      return { changes: Number(info.changes) };
    }),
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

/** Categories referenced by the seed / create defaults (cards.category_id FK). */
async function seedCategories(db: RealDb): Promise<void> {
  const cats: [string, string][] = [
    ['grounding-calming', 'Grounding & Calming'],
    ['daily-checkin-journaling', 'Daily Check-In & Journaling'],
  ];
  for (const [id, name] of cats) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
      [id, name, '#000000', 0]
    );
  }
}

async function readVersion(db: RealDb, cardId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ source_library_version: number | null }>(
    `SELECT source_library_version FROM cards WHERE id = ?`,
    [cardId]
  );
  return row?.source_library_version ?? null;
}

const validShell: CardShell = {
  title: 'Box Breathing',
  description: 'A calming four-count breathing exercise.',
  iconType: 'emoji',
  iconValue: '🫁',
  backgroundType: 'color',
  backgroundValue: '#EDE7F6',
};

const singleControl: Omit<Control, 'id' | 'cardId'>[] = [
  {
    type: 'static_text',
    position: 0,
    config: { label: 'Breathe', body: 'In for four…' } as Control['config'],
    isRequired: false,
  },
];

describe('source_library_version persisted at add-time (task 2.1)', () => {
  let db: RealDb;

  beforeEach(async () => {
    db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    // Clear spy history from migrations/seeding so we only observe service calls
    // (e.g. runControlTypeCheckMigration issues a probe `INSERT INTO cards`).
    db.runAsync.mockClear();
    mockGetDatabase.mockResolvedValue(db as never);
  });

  describe('cardService.create', () => {
    it('writes the passed sourceLibraryVersion into cards.source_library_version', async () => {
      const service = createCardService();

      // TDD: the 6th param does not exist on the signature yet (task 2.2 adds it).
      // Cast the callable so this compiles now and stays correct afterward.
      // Keep it bound to `service` — `create` calls `this.getById(...)` internally.
      const createWithVersion = service.create.bind(service) as unknown as (
        shell: CardShell,
        controls: Omit<Control, 'id' | 'cardId'>[],
        originBadge: string,
        categoryId?: string,
        sourceLibraryId?: string,
        sourceLibraryVersion?: number | null
      ) => Promise<{ id: string }>;

      const card = await createWithVersion(
        validShell,
        singleControl,
        'library',
        'grounding-calming',
        'lib-box-breathing',
        3
      );

      // Expected AFTER task 2.2; FAILS now (column is written NULL).
      expect(await readVersion(db, card.id)).toBe(3);
    });

    it('writes NULL when sourceLibraryVersion is omitted', async () => {
      const service = createCardService();

      const card = await service.create(
        validShell,
        singleControl,
        'library',
        'grounding-calming',
        'lib-box-breathing'
      );

      expect(await readVersion(db, card.id)).toBeNull();
    });
  });

  describe('kpiService.seedKpiCard', () => {
    it('persists the check-in card current curated version into source_library_version', async () => {
      const service = createKpiService();

      await service.seedKpiCard('Feeling calmer');

      const kpiCard = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM cards WHERE source_library_id = ?`,
        ['lib-personal-kpi']
      );
      expect(kpiCard).not.toBeNull();

      // The version must be persisted DELIBERATELY (column present in the INSERT),
      // not merely defaulted.
      const insertCardCall = db.runAsync.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO cards')
      );
      expect(insertCardCall).toBeDefined();
      expect(insertCardCall![0] as string).toMatch(/source_library_version/);

      // As of Phase 1.1 (task 8.1) the check-in definition is VERSIONED at 1 (its
      // canonical definition, KPI_CARD_DEFINITION, carries version: 1 for the 1.0.5
      // text_input → text_area note-field change). seedKpiCard writes that current
      // version, so a freshly seeded card is at 1 (not null) and is not spuriously
      // flagged outdated.
      expect(await readVersion(db, kpiCard!.id)).toBe(1);
    });
  });
});
