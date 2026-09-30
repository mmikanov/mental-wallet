/**
 * Library Card Sync (Phase 1), task 4.1 — history-preserving in-place update
 * property tests (TEST-FIRST / TDD).
 *
 * Purpose: pin Correctness Properties 2–8 for the not-yet-written
 * `cardService.updateFromLibrary(cardId): Promise<Card>` (task 4.2 implements it).
 * These tests are EXPECTED TO FAIL now because the method does not exist.
 *
 * Everything runs against a REAL in-memory SQLite engine (node:sqlite
 * DatabaseSync wrapped in the async expo-sqlite surface) so the transactional
 * reconciliation, ON DELETE CASCADE behavior, and row preservation are genuinely
 * exercised — matching the pattern established by
 * `sourceLibraryVersionPersistence.test.ts` and `sourceLibraryVersionMigration.test.ts`.
 *
 * Curated side is deterministic: `../../data/curatedLibrary` is mocked with a
 * getter-over-mutable-fixture (same seam as `librarySyncService.test.ts`) so we
 * can construct an "outdated" scenario — seed a wallet card copy at an older/null
 * `source_library_version`, and a curated def with a higher version and changed
 * controls. `evaluateOutdated` (real, from `../librarySyncService`) reads that
 * mocked `CURATED_LIBRARY`.
 *
 * P7 fault-injection seam (NOTE FOR THE 4.2 IMPLEMENTER):
 *   These tests inject a fault by wrapping the db so a chosen SQL statement (matched
 *   by substring) throws when `updateFromLibrary` runs it. For the rollback assertion
 *   to hold, `updateFromLibrary` MUST wrap all its mutations in a single
 *   `BEGIN TRANSACTION` ... `COMMIT` with `ROLLBACK` on error (the same shape as
 *   `cardService.create`). The fault is injected on a control `UPDATE`/`INSERT`
 *   statement so it fires AFTER the shell UPDATE has already run inside the txn —
 *   proving the ROLLBACK reverts the shell change too, not just the control change.
 *
 * Properties encoded here:
 *   P2 (Req 3.6) update clears outdated + sets version
 *   P3 (Req 3.8) idempotency / no-op when current
 *   P4 (Req 3.3) surviving controls' control_values preserved; removed-position ones gone
 *   P5 (Req 3.2) stats invariant
 *   P6 (Req 3.4) custom background_overlays row unchanged
 *   P7 (Req 3.7) injected fault ⇒ full rollback to prior state
 *   P8 (Req 3.1) post-update controls equal the curated definition by position/type/config/isRequired
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8
 */

import { DatabaseSync } from 'node:sqlite';
import * as fc from 'fast-check';

import { runMigrations } from '../../data/migrations';
import { evaluateOutdated } from '../librarySyncService';
import type { CuratedCardDefinition } from '../../data/curatedLibrary';
import type { ControlConfig, ControlType } from '../../types/index';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// reminderService is lazily required by cardService (archive/restore and,
// eventually, the updateFromLibrary title-change reschedule). Stub it so nothing
// pulls in expo-notifications and so reschedule is a no-op here.
// The reminder reschedule (task 4.3) calls getReminder + updateReminder on a
// title change. Expose shared mock fns so the reminder tests below can assert on
// them, while keeping getReminder defaulting to null so the property tests (which
// never change the title) do no reminder work.
const mockGetReminder = jest.fn(async (_cardId: string) => null as unknown);
const mockUpdateReminder = jest.fn(async () => undefined);
const mockScheduleNotification = jest.fn(async () => undefined);

jest.mock('../reminderService', () => ({
  createReminderService: () => ({
    disableForCard: jest.fn(async () => undefined),
    reactivateForCard: jest.fn(async () => null),
    scheduleNotification: mockScheduleNotification,
    getReminder: mockGetReminder,
    updateReminder: mockUpdateReminder,
  }),
}));

// Curated library: mutable fixture behind a getter (same seam as
// librarySyncService.test.ts). evaluateOutdated + updateFromLibrary both read this.
const curatedFixture: CuratedCardDefinition[] = [];

jest.mock('../../data/curatedLibrary', () => {
  const actual = jest.requireActual('../../data/curatedLibrary');
  return {
    ...actual,
    get CURATED_LIBRARY() {
      return curatedFixture;
    },
  };
});

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

/**
 * Fault injector used by P7. It is DISARMED during migrations + seeding and only
 * armed right before the method under test runs, so the counter only sees the
 * statements the SERVICE issues (never the seed INSERTs). Once armed, the
 * `nth`-th `runAsync` statement whose SQL contains `match` throws.
 *
 * `arm()`/`disarm()` are exposed on the returned db so the test can control timing.
 */
interface FaultSpec {
  match: string;
  nth: number;
}

interface RealDbWithFault extends RealDb {
  armFault: (fault: FaultSpec) => void;
  disarmFault: () => void;
}

function createRealSqliteDb(): RealDbWithFault {
  const db = new DatabaseSync(':memory:');
  let fault: FaultSpec | null = null;
  let faultCounter = 0;

  const maybeThrow = (sql: string): void => {
    if (fault && sql.includes(fault.match)) {
      faultCounter += 1;
      if (faultCounter === fault.nth) {
        throw new Error(`Injected fault on statement matching "${fault.match}"`);
      }
    }
  };

  return {
    raw: db,
    armFault: (f: FaultSpec) => {
      fault = f;
      faultCounter = 0;
    },
    disarmFault: () => {
      fault = null;
      faultCounter = 0;
    },
    execAsync: async (sql: string): Promise<void> => {
      // exec can carry BEGIN/COMMIT/ROLLBACK; don't fault those.
      db.exec(sql);
    },
    runAsync: async (sql: string, params: unknown[] = []) => {
      maybeThrow(sql);
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
// Fixtures / seeding helpers
// ---------------------------------------------------------------------------

const SOURCE_ID = 'lib-fixture-update';
const CATEGORY_ID = 'grounding-calming';
const CATEGORY_ID_ALT = 'daily-checkin-journaling';

async function seedCategories(db: RealDb): Promise<void> {
  const cats: [string, string][] = [
    [CATEGORY_ID, 'Grounding & Calming'],
    [CATEGORY_ID_ALT, 'Daily Check-In & Journaling'],
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
  sourceLibraryVersion: number | null;
  controls: ControlSpec[];
  totalUses?: number;
  currentStreak?: number;
  lastUsedAt?: string | null;
  stackPosition?: number;
  createdAt?: string;
  title?: string;
  categoryId?: string;
}

/**
 * Directly INSERT a wallet card copy with explicit control ids so we can tie
 * completions/control_values to specific controls and assert P4 precisely.
 */
async function seedWalletCard(db: RealDb, spec: SeedCardSpec): Promise<void> {
  const now = spec.createdAt ?? '2024-01-01T00:00:00Z';
  await db.runAsync(
    `INSERT INTO cards (
       id, title, description, icon_type, icon_value, background_type, background_value,
       category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at,
       is_archived, archived_at, previous_stack_position, allow_background_customization,
       source_library_id, source_library_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'library', ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?, ?, ?)`,
    [
      spec.cardId,
      spec.title ?? 'Box Breathing',
      'A calming four-count breathing exercise.',
      'emoji',
      '🫁',
      'color',
      '#EDE7F6',
      spec.categoryId ?? CATEGORY_ID,
      spec.stackPosition ?? 0,
      spec.totalUses ?? 7,
      spec.currentStreak ?? 3,
      spec.lastUsedAt ?? '2024-06-01T09:00:00Z',
      SOURCE_ID,
      spec.sourceLibraryVersion,
      now,
      now,
    ]
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

async function seedBackgroundOverlay(
  db: RealDb,
  cardId: string,
  type: string,
  value: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO background_overlays (id, card_id, background_type, background_value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['ovl-' + cardId, cardId, type, value, '2024-05-01T00:00:00Z', '2024-05-01T00:00:00Z']
  );
}

function setCurated(def: CuratedCardDefinition): void {
  curatedFixture.length = 0;
  curatedFixture.push(def);
}

/** A curated def with configurable version + controls, keyed to SOURCE_ID. */
function makeCurated(
  version: number,
  controls: { type: ControlType; position: number; config: ControlConfig; isRequired: boolean }[],
  overrides: Partial<CuratedCardDefinition> = {}
): CuratedCardDefinition {
  return {
    id: SOURCE_ID,
    title: 'Box Breathing',
    description: 'A calming four-count breathing exercise.',
    iconType: 'emoji',
    iconValue: '🫁',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: CATEGORY_ID,
    allowBackgroundCustomization: true,
    controls,
    version,
    ...overrides,
  } as CuratedCardDefinition;
}

// Raw row readers (bypass the service so we see exactly what's persisted).
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
async function readControlValuesForControl(db: RealDb, controlId: string) {
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT id, completion_id, control_id, control_type, value FROM control_values WHERE control_id = ? ORDER BY id ASC`,
    [controlId]
  );
}
async function readOverlay(db: RealDb, cardId: string) {
  return db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM background_overlays WHERE card_id = ?`,
    [cardId]
  );
}

/**
 * Load the card domain object via the service (so evaluateOutdated sees a real
 * Card). Cast the service to expose updateFromLibrary before task 4.2 widens the
 * CardService interface, so this file compiles now and stays correct afterward.
 */
type CardServiceWithUpdate = ReturnType<typeof createCardService> & {
  updateFromLibrary: (cardId: string) => Promise<import('../../types/index').Card>;
};

function makeService(): CardServiceWithUpdate {
  return createCardService() as CardServiceWithUpdate;
}

// A default "current" (outdated) set of controls for the seeded copy.
const OUTDATED_CONTROLS: ControlSpec[] = [
  {
    id: 'ctrl-note',
    type: 'text_input',
    position: 0,
    config: { label: 'Anything you want to note?', maxLength: 200 } as ControlConfig,
    isRequired: false,
  },
  {
    id: 'ctrl-mood',
    type: 'mood_slider',
    position: 1,
    config: { label: 'Mood', min: 1, max: 5 } as ControlConfig,
    isRequired: true,
  },
];

// The curated target: position 0 changed text_input -> text_area (the motivating
// 1.0.5 change), position 1 unchanged, position 2 is a brand-new control.
const TARGET_CONTROLS = [
  {
    type: 'text_area' as ControlType,
    position: 0,
    config: { label: 'Anything you want to note?', maxLength: 1000 } as ControlConfig,
    isRequired: false,
  },
  {
    type: 'mood_slider' as ControlType,
    position: 1,
    config: { label: 'Mood', min: 1, max: 5 } as ControlConfig,
    isRequired: true,
  },
  {
    type: 'static_text' as ControlType,
    position: 2,
    config: { label: 'Tip', body: 'Breathe slowly.' } as ControlConfig,
    isRequired: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cardService.updateFromLibrary — history-preserving in-place update (task 4.1)', () => {
  async function freshDb(): Promise<RealDbWithFault> {
    const db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    mockGetDatabase.mockResolvedValue(db as never);
    return db;
  }

  beforeEach(() => {
    curatedFixture.length = 0;
    mockGetDatabase.mockReset();
    mockGetReminder.mockReset();
    mockGetReminder.mockResolvedValue(null as unknown);
    mockUpdateReminder.mockReset();
    mockScheduleNotification.mockReset();
  });

  // -------- Property 2: Update clears outdated (Req 3.6) --------
  describe('Feature: library-card-sync, Property 2: Update clears outdated', () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * After updateFromLibrary succeeds on an outdated card,
     * evaluateOutdated(reloaded).isOutdated === false AND
     * reloaded.sourceLibraryVersion === curated.version.
     */
    it('clears outdated and sets sourceLibraryVersion to the curated version', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
          fc.integer({ min: 5, max: 12 }),
          async (copyVersion, curatedVersion) => {
            const db = await freshDb();
            setCurated(makeCurated(curatedVersion, TARGET_CONTROLS));
            await seedWalletCard(db, {
              cardId: 'card-p2',
              sourceLibraryVersion: copyVersion,
              controls: OUTDATED_CONTROLS,
            });

            const service = makeService();
            await service.updateFromLibrary('card-p2');

            const reloaded = await service.getById('card-p2');
            expect(reloaded).not.toBeNull();
            expect(reloaded!.sourceLibraryVersion).toBe(curatedVersion);
            expect(evaluateOutdated(reloaded!).isOutdated).toBe(false);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  // -------- Property 3: Idempotency (Req 3.8) --------
  describe('Feature: library-card-sync, Property 3: Idempotency', () => {
    /**
     * **Validates: Requirements 3.8**
     *
     * Running updateFromLibrary twice equals once (second call is a no-op);
     * running on an already-current card returns it unchanged.
     */
    it('is idempotent: twice equals once', async () => {
      const db = await freshDb();
      setCurated(makeCurated(5, TARGET_CONTROLS));
      await seedWalletCard(db, {
        cardId: 'card-p3',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
      });

      const service = makeService();
      await service.updateFromLibrary('card-p3');
      const afterOnce = await service.getById('card-p3');
      const controlsOnce = await readControlRows(db, 'card-p3');

      await service.updateFromLibrary('card-p3');
      const afterTwice = await service.getById('card-p3');
      const controlsTwice = await readControlRows(db, 'card-p3');

      expect(afterTwice!.sourceLibraryVersion).toBe(afterOnce!.sourceLibraryVersion);
      // Controls (by position/type/config/isRequired) identical after the 2nd run.
      expect(controlsTwice.map((r) => ({ ...r, id: undefined }))).toEqual(
        controlsOnce.map((r) => ({ ...r, id: undefined }))
      );
    });

    it('is a no-op on an already-current card (returns it unchanged)', async () => {
      const db = await freshDb();
      // Curated version equals the copy version → not outdated.
      setCurated(makeCurated(4, TARGET_CONTROLS));
      await seedWalletCard(db, {
        cardId: 'card-p3b',
        sourceLibraryVersion: 4,
        controls: OUTDATED_CONTROLS,
      });

      const service = makeService();
      const before = await service.getById('card-p3b');
      const controlsBefore = await readControlRows(db, 'card-p3b');

      const returned = await service.updateFromLibrary('card-p3b');
      const controlsAfter = await readControlRows(db, 'card-p3b');

      // Unchanged: version, controls (still the old text_input at position 0).
      expect(returned.sourceLibraryVersion).toBe(before!.sourceLibraryVersion);
      expect(controlsAfter).toEqual(controlsBefore);
      expect(controlsAfter.find((r) => r.position === 0)!.type).toBe('text_input');
    });
  });

  // -------- Property 4: History is never orphaned (Req 3.3) --------
  describe('Feature: library-card-sync, Property 4: History is never orphaned', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * For pre-existing completions/control_values on SURVIVING control positions,
     * the count + contents of control_values for those controls are identical
     * before and after the update; only control_values of controls whose position
     * was REMOVED disappear (never orphaned).
     */
    it('preserves control_values for surviving controls and drops only removed-position ones', async () => {
      const db = await freshDb();
      // Target REMOVES position 1 (mood) and keeps position 0; adds position 2.
      const targetDropMood = [
        {
          type: 'text_area' as ControlType,
          position: 0,
          config: { label: 'Anything you want to note?', maxLength: 1000 } as ControlConfig,
          isRequired: false,
        },
        {
          type: 'static_text' as ControlType,
          position: 2,
          config: { label: 'Tip', body: 'Breathe.' } as ControlConfig,
          isRequired: false,
        },
      ];
      setCurated(makeCurated(5, targetDropMood));
      await seedWalletCard(db, {
        cardId: 'card-p4',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS, // ctrl-note @0 (survives), ctrl-mood @1 (removed)
      });
      // Two completions, each with values for both controls.
      await seedCompletion(db, 'card-p4', 'comp-1', [
        { controlId: 'ctrl-note', controlType: 'text_input', value: 'felt ok' },
        { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '4' },
      ]);
      await seedCompletion(db, 'card-p4', 'comp-2', [
        { controlId: 'ctrl-note', controlType: 'text_input', value: 'better' },
        { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '5' },
      ]);

      const survivingBefore = await readControlValuesForControl(db, 'ctrl-note');

      const service = makeService();
      await service.updateFromLibrary('card-p4');

      // Surviving control (position 0) keeps its UUID and ALL its control_values.
      const survivingAfter = await readControlValuesForControl(db, 'ctrl-note');
      expect(survivingAfter).toEqual(survivingBefore);
      expect(survivingAfter).toHaveLength(2);

      // Removed control (position 1) is deleted; its control_values cascade away.
      const removedAfter = await readControlValuesForControl(db, 'ctrl-mood');
      expect(removedAfter).toHaveLength(0);

      // The completions themselves are untouched (still 2).
      const comps = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM completions WHERE card_id = ?`,
        ['card-p4']
      );
      expect(comps).toHaveLength(2);
    });
  });

  // -------- Property 5: Stats are invariant (Req 3.2) --------
  describe('Feature: library-card-sync, Property 5: Stats are invariant', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * total_uses, current_streak, last_used_at, stack_position, created_at are
     * unchanged across an update.
     */
    it('leaves total_uses, current_streak, last_used_at, stack_position, created_at unchanged', async () => {
      const db = await freshDb();
      setCurated(makeCurated(9, TARGET_CONTROLS));
      await seedWalletCard(db, {
        cardId: 'card-p5',
        sourceLibraryVersion: 2,
        controls: OUTDATED_CONTROLS,
        totalUses: 11,
        currentStreak: 4,
        lastUsedAt: '2024-06-15T08:30:00Z',
        stackPosition: 3,
        createdAt: '2024-02-02T02:02:02Z',
      });

      const before = await readCardRow(db, 'card-p5');

      const service = makeService();
      await service.updateFromLibrary('card-p5');

      const after = await readCardRow(db, 'card-p5');
      expect(after!.total_uses).toBe(before!.total_uses);
      expect(after!.current_streak).toBe(before!.current_streak);
      expect(after!.last_used_at).toBe(before!.last_used_at);
      expect(after!.stack_position).toBe(before!.stack_position);
      expect(after!.created_at).toBe(before!.created_at);
    });
  });

  // -------- Property 6: Custom background survives (Req 3.4) --------
  describe('Feature: library-card-sync, Property 6: Custom background survives', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * If a background_overlays row existed, it is identical after the update.
     */
    it('leaves the background_overlays row identical', async () => {
      const db = await freshDb();
      setCurated(makeCurated(6, TARGET_CONTROLS, { backgroundValue: '#00FF00' }));
      await seedWalletCard(db, {
        cardId: 'card-p6',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
      });
      await seedBackgroundOverlay(db, 'card-p6', 'color', '#123456');

      const before = await readOverlay(db, 'card-p6');

      const service = makeService();
      await service.updateFromLibrary('card-p6');

      const after = await readOverlay(db, 'card-p6');
      expect(after).toEqual(before);
      expect(after!.background_value).toBe('#123456');
    });
  });

  // -------- Property 7: Atomicity (Req 3.7) --------
  describe('Feature: library-card-sync, Property 7: Atomicity', () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * If any statement in the transaction fails (injected fault), the card, its
     * controls, and its control_values equal their pre-update state (full rollback).
     *
     * SEAM: the fault fires on a control-table statement (UPDATE/INSERT into
     * `controls`), which the implementer runs AFTER the shell `UPDATE cards`
     * inside the SAME transaction. A correct single BEGIN/COMMIT + ROLLBACK-on-error
     * therefore reverts BOTH the shell change and the (attempted) control change.
     * If this test fails with a PARTIAL write (shell changed but controls didn't,
     * or vice-versa), the implementer's transaction boundary is wrong.
     */
    it('rolls back fully when a control statement throws mid-transaction', async () => {
      const db = await freshDb();
      setCurated(makeCurated(7, TARGET_CONTROLS));
      await seedWalletCard(db, {
        cardId: 'card-p7',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
      });
      await seedCompletion(db, 'card-p7', 'comp-p7', [
        { controlId: 'ctrl-note', controlType: 'text_input', value: 'note' },
        { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '3' },
      ]);

      const cardBefore = await readCardRow(db, 'card-p7');
      const controlsBefore = await readControlRows(db, 'card-p7');
      const noteValuesBefore = await readControlValuesForControl(db, 'ctrl-note');
      const moodValuesBefore = await readControlValuesForControl(db, 'ctrl-mood');

      // Arm the fault ONLY now (after all seeding). The first statement the SERVICE
      // runs against the `controls` table (an UPDATE or INSERT) throws. Because the
      // implementer must run the shell `UPDATE cards` BEFORE touching controls,
      // inside a single BEGIN/COMMIT, a correct ROLLBACK reverts the shell too.
      db.armFault({ match: 'controls', nth: 1 });

      const service = makeService();
      await expect(service.updateFromLibrary('card-p7')).rejects.toBeDefined();

      db.disarmFault();

      // Full rollback: card, controls, and control_values equal pre-update state.
      expect(await readCardRow(db, 'card-p7')).toEqual(cardBefore);
      expect(await readControlRows(db, 'card-p7')).toEqual(controlsBefore);
      expect(await readControlValuesForControl(db, 'ctrl-note')).toEqual(noteValuesBefore);
      expect(await readControlValuesForControl(db, 'ctrl-mood')).toEqual(moodValuesBefore);
    });
  });

  // -------- Property 8: Control reconciliation matches the definition (Req 3.1) --------
  describe('Feature: library-card-sync, Property 8: Control reconciliation matches the definition', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * After update, the card's controls (by position, type, config, isRequired)
     * equal the curated definition's controls exactly.
     */
    it('makes the card controls equal the curated definition by position/type/config/isRequired', async () => {
      const db = await freshDb();
      setCurated(makeCurated(8, TARGET_CONTROLS));
      await seedWalletCard(db, {
        cardId: 'card-p8',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
      });

      const service = makeService();
      await service.updateFromLibrary('card-p8');

      const reloaded = await service.getById('card-p8');
      const got = [...reloaded!.controls].sort((a, b) => a.position - b.position);

      const expected = [...TARGET_CONTROLS].sort((a, b) => a.position - b.position);
      expect(got).toHaveLength(expected.length);
      got.forEach((c, i) => {
        expect(c.position).toBe(expected[i].position);
        expect(c.type).toBe(expected[i].type);
        expect(c.isRequired).toBe(expected[i].isRequired);
        expect(c.config).toEqual(expected[i].config);
      });

      // The surviving position-0 control kept its UUID (in-place UPDATE, not reinsert).
      expect(got.find((c) => c.position === 0)!.id).toBe('ctrl-note');
    });
  });

  // -------- Task 4.3: Reminder reschedule on title change (Req 3.5) --------
  describe('Feature: library-card-sync, task 4.3: Reminder reschedule on title change', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * When the update changes the card TITLE and the card has an ACTIVE reminder,
     * the reminder is rescheduled (via updateReminder — which cancels the old OS
     * notifications and reschedules from the now-updated title, avoiding orphaned
     * stale-title notifications). No reminder work when the title is unchanged, and
     * none when there is no active reminder.
     */
    it('reschedules the active reminder when the update changes the title', async () => {
      const db = await freshDb();
      // Curated title differs from the seeded copy's title → title change.
      setCurated(makeCurated(5, TARGET_CONTROLS, { title: 'Box Breathing (v2)' }));
      await seedWalletCard(db, {
        cardId: 'card-r1',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
        title: 'Box Breathing',
      });

      // The card has an active reminder.
      mockGetReminder.mockResolvedValue({
        id: 'rem-1',
        cardId: 'card-r1',
        type: 'per_card',
        time: '09:00',
        frequency: { type: 'daily' },
        isActive: true,
        notificationId: '["notif-old"]',
        createdAt: '2024-01-01T00:00:00Z',
      } as unknown);

      const service = makeService();
      await service.updateFromLibrary('card-r1');

      // Rescheduled via updateReminder (cancels old + reschedules with new title).
      expect(mockGetReminder).toHaveBeenCalledWith('card-r1');
      expect(mockUpdateReminder).toHaveBeenCalledTimes(1);
      expect(mockUpdateReminder).toHaveBeenCalledWith('rem-1', {
        time: '09:00',
        frequency: { type: 'daily' },
      });
      // scheduleNotification is NOT used directly (it would orphan old notifications).
      expect(mockScheduleNotification).not.toHaveBeenCalled();

      // Sanity: the DB title actually changed, so the reschedule reads the new title.
      const reloaded = await service.getById('card-r1');
      expect(reloaded!.title).toBe('Box Breathing (v2)');
    });

    it('does NOT touch reminders when the update leaves the title unchanged', async () => {
      const db = await freshDb();
      // Same title as the seeded copy → no title change (controls still change).
      setCurated(makeCurated(5, TARGET_CONTROLS, { title: 'Box Breathing' }));
      await seedWalletCard(db, {
        cardId: 'card-r2',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
        title: 'Box Breathing',
      });

      // Even if there were an active reminder, no reschedule should happen because
      // the title is unchanged — so getReminder must not even be consulted.
      mockGetReminder.mockResolvedValue({
        id: 'rem-2',
        cardId: 'card-r2',
        type: 'per_card',
        time: '09:00',
        frequency: { type: 'daily' },
        isActive: true,
        notificationId: '["notif-x"]',
        createdAt: '2024-01-01T00:00:00Z',
      } as unknown);

      const service = makeService();
      await service.updateFromLibrary('card-r2');

      expect(mockGetReminder).not.toHaveBeenCalled();
      expect(mockUpdateReminder).not.toHaveBeenCalled();
      expect(mockScheduleNotification).not.toHaveBeenCalled();
    });

    it('does NOT reschedule when the title changed but there is no active reminder', async () => {
      const db = await freshDb();
      setCurated(makeCurated(5, TARGET_CONTROLS, { title: 'Box Breathing (v2)' }));
      await seedWalletCard(db, {
        cardId: 'card-r3',
        sourceLibraryVersion: 1,
        controls: OUTDATED_CONTROLS,
        title: 'Box Breathing',
      });

      // No active reminder → getReminder returns null (default), no reschedule.
      mockGetReminder.mockResolvedValue(null as unknown);

      const service = makeService();
      await service.updateFromLibrary('card-r3');

      expect(mockGetReminder).toHaveBeenCalledWith('card-r3');
      expect(mockUpdateReminder).not.toHaveBeenCalled();
      expect(mockScheduleNotification).not.toHaveBeenCalled();
    });
  });
});
