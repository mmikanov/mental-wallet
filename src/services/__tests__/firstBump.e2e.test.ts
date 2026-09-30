/**
 * Library Card Sync (Phase 1), task 7.2 — first content bump end-to-end.
 *
 * Purpose: prove that the REAL `version: 1` values set on the 1.0.5-changed
 * curated cards (in `src/data/curatedLibrary.ts`) make existing wallet copies
 * (stored at `source_library_version = null`, or an older number) detectable as
 * outdated, and that `cardService.updateFromLibrary` applies the shipped
 * text_input -> text_area change in place while preserving history and clearing
 * the "update available" pill.
 *
 * Unlike `updateFromLibrary.test.ts` / `librarySyncService.test.ts`, this file
 * DOES NOT mock `../../data/curatedLibrary` — it uses the REAL curated data so the
 * actual `version: 1` bumps from task 7.2 are exercised end to end. This is the
 * guard that catches a curated card being under-versioned (pill never appears) or
 * over-versioned (no-op update prompt).
 *
 * Harness: the real in-memory SQLite engine (node:sqlite DatabaseSync wrapped in
 * the async expo-sqlite surface) established by
 * `sourceLibraryVersionPersistence.test.ts` / `updateFromLibrary.test.ts`, so the
 * transactional reconciliation and row preservation are genuinely exercised.
 *
 * Scenarios:
 *   1. A wallet copy of `lib-daily-mood` (a REAL bumped card) at
 *      source_library_version = null, seeded with the OLD control shape
 *      (position-1 note field as `text_input` with maxLength 200):
 *        - evaluateOutdated(copy).isOutdated === true (null copy vs curated v1)
 *        - after updateFromLibrary: the note field is `text_area`, a seeded
 *          completion + control_value on the surviving note control is preserved,
 *          sourceLibraryVersion === 1, and evaluateOutdated is now false.
 *   2. The same card seeded at an OLDER numbered version (0) is also outdated and
 *      updates to 1.
 *   3. A NON-changed card (`lib-box-breathing`, still unversioned in the real
 *      curated data) at source_library_version = null is NOT detected outdated.
 *
 * Validates: Requirements 1.1, 1.5 (and exercises 3.x in-place update behavior).
 */

import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../data/migrations';
import { evaluateOutdated } from '../librarySyncService';
import { CURATED_LIBRARY } from '../../data/curatedLibrary';
import type { ControlConfig, ControlType } from '../../types/index';

// cardService obtains its DB via getDatabase(); point it at a real in-memory DB.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Unique-per-row UUIDs for a real DB (inserted controls need fresh ids).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'uuid-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
}));

// reminderService is lazily required by cardService; the scenarios below never
// change a title, so no reschedule work happens. Stub it so nothing pulls in
// expo-notifications.
jest.mock('../reminderService', () => ({
  createReminderService: () => ({
    disableForCard: jest.fn(async () => undefined),
    reactivateForCard: jest.fn(async () => null),
    scheduleNotification: jest.fn(async () => undefined),
    getReminder: jest.fn(async () => null),
    updateReminder: jest.fn(async () => undefined),
  }),
}));

// NOTE: `../../data/curatedLibrary` is intentionally NOT mocked — this test
// exercises the real curated definitions (and their real `version` values).

// eslint-disable-next-line import/first
import { createCardService } from '../cardService';
// eslint-disable-next-line import/first
import { getDatabase } from '../../data/database';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

// ---------------------------------------------------------------------------
// Real in-memory SQLite wrapper (async expo-sqlite surface over node:sqlite)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

/**
 * All categories referenced by the real curated cards under test, so the
 * cards.category_id FK is satisfied for a raw INSERT.
 */
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

interface ControlSpec {
  id: string;
  type: ControlType;
  position: number;
  config: ControlConfig;
  isRequired: boolean;
}

interface SeedCardSpec {
  cardId: string;
  sourceLibraryId: string;
  sourceLibraryVersion: number | null;
  categoryId: string;
  controls: ControlSpec[];
}

/** Directly INSERT a wallet card copy with explicit control ids. */
async function seedWalletCard(db: RealDb, spec: SeedCardSpec): Promise<void> {
  const now = '2024-01-01T00:00:00Z';
  await db.runAsync(
    `INSERT INTO cards (
       id, title, description, icon_type, icon_value, background_type, background_value,
       category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at,
       is_archived, archived_at, previous_stack_position, allow_background_customization,
       source_library_id, source_library_version, created_at, updated_at)
     VALUES (?, 'Old Title', 'Old description.', 'emoji', '🌤️', 'color', '#EDE7F6',
             ?, 'library', 0, 5, 2, '2024-06-01T09:00:00Z', 0, NULL, NULL, 1, ?, ?, ?, ?)`,
    [spec.cardId, spec.categoryId, spec.sourceLibraryId, spec.sourceLibraryVersion, now, now]
  );

  for (const c of spec.controls) {
    await db.runAsync(
      `INSERT INTO controls (id, card_id, type, position, config, is_required, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.id, spec.cardId, c.type, c.position, JSON.stringify(c.config), c.isRequired ? 1 : 0, now]
    );
  }
}

/** Add a completion with per-control values tied to specific control ids. */
async function seedCompletion(
  db: RealDb,
  cardId: string,
  completionId: string,
  values: { controlId: string; controlType: string; value: string }[]
): Promise<void> {
  await db.runAsync(
    `INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)`,
    [completionId, cardId, '2024-06-01T09:00:00Z']
  );
  for (const v of values) {
    await db.runAsync(
      `INSERT INTO control_values (id, completion_id, control_id, control_type, value)
       VALUES (?, ?, ?, ?, ?)`,
      ['cv-' + completionId + '-' + v.controlId, completionId, v.controlId, v.controlType, v.value]
    );
  }
}

async function readControlValuesForControl(db: RealDb, controlId: string) {
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT id, completion_id, control_id, control_type, value FROM control_values WHERE control_id = ? ORDER BY id ASC`,
    [controlId]
  );
}

// The REAL curated cards this test relies on. Looked up (not hardcoded) so a
// future rename or removal fails loudly here rather than silently passing.
const DAILY_MOOD = CURATED_LIBRARY.find((c) => c.id === 'lib-daily-mood')!;
const BOX_BREATHING = CURATED_LIBRARY.find((c) => c.id === 'lib-box-breathing')!;

// The OLD (pre-1.0.5) shape of lib-daily-mood: position-0 mood_slider unchanged,
// position-1 note field as single-line text_input with maxLength 200.
const OLD_DAILY_MOOD_CONTROLS: ControlSpec[] = [
  {
    id: 'ctrl-mood',
    type: 'mood_slider',
    position: 0,
    config: { label: 'How are you feeling?', minLabel: 'Low', maxLabel: 'Great' } as ControlConfig,
    isRequired: true,
  },
  {
    id: 'ctrl-note',
    type: 'text_input',
    position: 1,
    config: {
      label: "What's on your mind?",
      placeholder: 'A brief thought or word...',
      maxLength: 200,
    } as ControlConfig,
    isRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('library-card-sync task 7.2 — first content bump e2e (real CURATED_LIBRARY)', () => {
  async function freshDb(): Promise<RealDb> {
    const db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    mockGetDatabase.mockResolvedValue(db as never);
    return db;
  }

  beforeEach(() => {
    mockGetDatabase.mockReset();
  });

  it('sanity: the real curated data carries version 1 on the changed card and none on the unchanged one', () => {
    // Guards the task-7.2 bump itself: lib-daily-mood was changed in 1.0.5 → v1;
    // lib-box-breathing was NOT changed → still unversioned.
    expect(DAILY_MOOD.version).toBe(1);
    expect(BOX_BREATHING.version).toBeUndefined();
    // And the curated target for the note field is now multi-line.
    const note = DAILY_MOOD.controls.find((c) => c.position === 1)!;
    expect(note.type).toBe('text_area');
  });

  it('detects a null-version copy as outdated, applies the text_input→text_area change in place, preserves history, clears the pill', async () => {
    const db = await freshDb();
    await seedWalletCard(db, {
      cardId: 'card-daily-null',
      sourceLibraryId: 'lib-daily-mood',
      sourceLibraryVersion: null,
      categoryId: 'daily-checkin-journaling',
      controls: OLD_DAILY_MOOD_CONTROLS,
    });
    // History on the SURVIVING note control (position 1 persists across the update).
    await seedCompletion(db, 'card-daily-null', 'comp-1', [
      { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '4' },
      { controlId: 'ctrl-note', controlType: 'text_input', value: 'felt ok today' },
    ]);

    const service = createCardService();

    // Before: null copy vs curated v1 → outdated.
    const before = await service.getById('card-daily-null');
    expect(before).not.toBeNull();
    expect(before!.sourceLibraryVersion).toBeNull();
    expect(evaluateOutdated(before!).isOutdated).toBe(true);

    const noteValuesBefore = await readControlValuesForControl(db, 'ctrl-note');
    expect(noteValuesBefore).toHaveLength(1);

    // Apply the update.
    await service.updateFromLibrary('card-daily-null');

    const after = await service.getById('card-daily-null');
    expect(after).not.toBeNull();

    // The note field is now the multi-line text_area from the real curated def.
    const noteAfter = after!.controls.find((c) => c.position === 1)!;
    expect(noteAfter.type).toBe('text_area');
    // Surviving control kept its UUID (in-place UPDATE, not delete-and-reinsert).
    expect(noteAfter.id).toBe('ctrl-note');
    // maxLength was dropped in 1.0.5.
    expect((noteAfter.config as { maxLength?: number }).maxLength).toBeUndefined();

    // History preserved on the surviving control.
    const noteValuesAfter = await readControlValuesForControl(db, 'ctrl-note');
    expect(noteValuesAfter).toEqual(noteValuesBefore);

    // Version caught up to the real curated version (1) and the pill clears.
    expect(after!.sourceLibraryVersion).toBe(1);
    expect(evaluateOutdated(after!).isOutdated).toBe(false);
  });

  it('detects an older-numbered copy (0) as outdated and updates it to the curated version (1)', async () => {
    const db = await freshDb();
    await seedWalletCard(db, {
      cardId: 'card-daily-v0',
      sourceLibraryId: 'lib-daily-mood',
      sourceLibraryVersion: 0,
      categoryId: 'daily-checkin-journaling',
      controls: OLD_DAILY_MOOD_CONTROLS,
    });

    const service = createCardService();
    const before = await service.getById('card-daily-v0');
    expect(evaluateOutdated(before!).isOutdated).toBe(true);

    await service.updateFromLibrary('card-daily-v0');

    const after = await service.getById('card-daily-v0');
    expect(after!.sourceLibraryVersion).toBe(1);
    expect(after!.controls.find((c) => c.position === 1)!.type).toBe('text_area');
    expect(evaluateOutdated(after!).isOutdated).toBe(false);
  });

  it('does NOT flag a non-changed card (lib-box-breathing, still unversioned) as outdated even at null copy-version', async () => {
    const db = await freshDb();
    // Seed a wallet copy of the UNCHANGED card at null version.
    await seedWalletCard(db, {
      cardId: 'card-box-null',
      sourceLibraryId: 'lib-box-breathing',
      sourceLibraryVersion: null,
      categoryId: 'grounding-calming',
      controls: [
        {
          id: 'ctrl-static',
          type: 'static_text',
          position: 0,
          config: { title: 'Box Breathing Steps', body: 'Breathe.' } as ControlConfig,
          isRequired: false,
        },
      ],
    });

    const service = createCardService();
    const card = await service.getById('card-box-null');
    expect(card).not.toBeNull();
    // Unversioned curated def ⇒ nothing newer to offer ⇒ never outdated (Req 1.4b).
    expect(evaluateOutdated(card!).isOutdated).toBe(false);

    // And updateFromLibrary is a no-op (returns the card unchanged).
    const returned = await service.updateFromLibrary('card-box-null');
    expect(returned.sourceLibraryVersion).toBeNull();
    expect(returned.controls.find((c) => c.position === 0)!.type).toBe('static_text');
  });
});
