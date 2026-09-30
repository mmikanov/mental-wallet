/**
 * Library Card Sync (Phase 1.1), task 8.4 — check-in (KPI) card label
 * preservation on update (TEST-FIRST / TDD).
 *
 * Purpose: pin Correctness Property 10 for the check-in-specific label re-derive
 * step that task 8.5 will add to `cardService.updateFromLibrary`. These tests are
 * EXPECTED TO FAIL now: today `updateFromLibrary`'s generic control reconciliation
 * UPDATEs the mood_slider (position 0) config to whatever the curated definition
 * carries — for the check-in card that is `KPI_CARD_DEFINITION`'s TEMPLATE label
 * ('How are you doing with your goal?'), which CLOBBERS the user's personalized
 * label. Task 8.5 adds a check-in branch that re-derives the label from the
 * current personal-KPI setting instead.
 *
 * Everything runs against a REAL in-memory SQLite engine (node:sqlite
 * DatabaseSync wrapped in the async expo-sqlite surface), matching the harness in
 * `updateFromLibrary.test.ts` / `firstBump.e2e.test.ts` so the transactional
 * reconciliation, the settings read (8.5's design decision (A) reads the
 * `personal_kpi` settings row DIRECTLY), and row preservation are genuinely
 * exercised.
 *
 * IMPORTANT — no mock of `@/data/kpiCardDefinition`: we use the REAL, versioned
 * `KPI_CARD_DEFINITION` (version 1, note = text_area, mood_slider template label)
 * and the REAL `formatKpiMoodLabel`, so the resolver (task 8.3) genuinely resolves
 * `lib-personal-kpi` → `KPI_CARD_DEFINITION` and the re-derived label format is the
 * production one. `../../data/curatedLibrary` IS mocked to an empty fixture only so
 * the resolver's non-KPI branch (`CURATED_LIBRARY.find`) is deterministic; the
 * check-in card is resolved off `KPI_CARD_DEFINITION`, not the fixture.
 *
 * SEAM NOTE FOR THE 8.5 IMPLEMENTER — how the personal KPI is stored/read here:
 *   The personal KPI lives in the `settings` table under key `'personal_kpi'`
 *   (value = the trimmed goal text), exactly as `kpiService.getPersonalKpi` /
 *   `setPersonalKpi` read/write it. This test seeds it with a direct
 *   `INSERT OR REPLACE INTO settings (key, value) VALUES ('personal_kpi', ?)` on
 *   the SAME in-memory DB that `cardService` sees via the mocked `getDatabase`.
 *   Task 8.5 MUST read the same seam (`SELECT value FROM settings WHERE key =
 *   'personal_kpi'`) inside `updateFromLibrary` and format the label with
 *   `formatKpiMoodLabel(kpi)` (= `How are you doing with: {kpi.toLowerCase()}?`).
 *
 * Property encoded here:
 *   P10 (Req 6.3, 7.1, 7.2, 7.3, 7.4) update re-derives the personalized label
 *       from the CURRENT KPI setting (authoritative — not the template, not a
 *       stale carry-over) AND applies the structural note change (text_input →
 *       text_area) while preserving completions/control_values/stats and the
 *       personal-KPI setting/history.
 *
 * Validates: Requirements 6.3, 7.1, 7.2, 7.3, 7.4
 */

import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../data/migrations';
import { evaluateOutdated } from '../librarySyncService';
import { KPI_CARD_DEFINITION, formatKpiMoodLabel } from '../../data/kpiCardDefinition';
import type { CuratedCardDefinition } from '../../data/curatedLibrary';
import type { ControlConfig, ControlType } from '../../types/index';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// cardService (and the 8.5 settings read) obtain the DB via getDatabase(); point
// it at a real in-memory DB.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Unique-per-row UUIDs for a real DB (inserted controls need fresh ids).
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'uuid-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  ),
}));

// reminderService is lazily required by cardService; the check-in update never
// changes the title, so no reschedule work happens. Stub it so nothing pulls in
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

// Curated library mocked to an EMPTY fixture: the resolver's non-KPI branch reads
// it, but the check-in card is resolved off the (real, un-mocked)
// KPI_CARD_DEFINITION. Keeping this empty guarantees the check-in behavior is
// driven only by KPI_CARD_DEFINITION.
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

const KPI_SOURCE_ID = 'lib-personal-kpi';
const CATEGORY_ID = 'daily-checkin-journaling';

async function seedCategories(db: RealDb): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
    [CATEGORY_ID, 'Daily Check-In & Journaling', '#000000', 0]
  );
}

/** Store the personal KPI exactly where kpiService keeps it (settings row). */
async function setPersonalKpiSetting(db: RealDb, kpi: string): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    ['personal_kpi', kpi]
  );
}

async function readPersonalKpiSetting(db: RealDb): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    ['personal_kpi']
  );
  return row?.value ?? null;
}

interface ControlSpec {
  id: string;
  type: ControlType;
  position: number;
  config: ControlConfig;
  isRequired: boolean;
}

interface SeedKpiCardSpec {
  cardId: string;
  sourceLibraryVersion: number | null;
  controls: ControlSpec[];
  totalUses?: number;
  currentStreak?: number;
  lastUsedAt?: string | null;
  stackPosition?: number;
  createdAt?: string;
}

/**
 * Directly INSERT an OUTDATED check-in wallet copy (source_library_id =
 * 'lib-personal-kpi') with explicit control ids so we can tie completions to
 * specific controls and assert history preservation precisely.
 */
async function seedKpiWalletCard(db: RealDb, spec: SeedKpiCardSpec): Promise<void> {
  const now = spec.createdAt ?? '2024-01-01T00:00:00Z';
  await db.runAsync(
    `INSERT INTO cards (
       id, title, description, icon_type, icon_value, background_type, background_value,
       category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at,
       is_archived, archived_at, previous_stack_position, allow_background_customization,
       source_library_id, source_library_version, created_at, updated_at)
     VALUES (?, ?, ?, 'emoji', '🌱', 'color', '#E8F5E9', ?, 'library', ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?, ?, ?)`,
    [
      spec.cardId,
      KPI_CARD_DEFINITION.title,
      KPI_CARD_DEFINITION.description,
      CATEGORY_ID,
      spec.stackPosition ?? 1,
      spec.totalUses ?? 7,
      spec.currentStreak ?? 3,
      spec.lastUsedAt ?? '2024-06-01T09:00:00Z',
      KPI_SOURCE_ID,
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

async function readCardRow(db: RealDb, cardId: string) {
  return db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM cards WHERE id = ?`, [cardId]);
}
async function readControlValuesForControl(db: RealDb, controlId: string) {
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT id, completion_id, control_id, control_type, value FROM control_values WHERE control_id = ? ORDER BY id ASC`,
    [controlId]
  );
}

/**
 * Build the OLD (pre-1.0.5) control shape of the check-in copy:
 *   position 0: mood_slider carrying the user's PERSONALIZED label (what
 *               seedKpiCard would have applied), NOT the KPI_CARD_DEFINITION
 *               template.
 *   position 1: note field as single-line text_input (maxLength 200) — the shape
 *               that the 1.0.5 text_area change migrates.
 */
function oldKpiControls(personalizedLabel: string): ControlSpec[] {
  return [
    {
      id: 'ctrl-mood',
      type: 'mood_slider',
      position: 0,
      config: {
        label: personalizedLabel,
        minLabel: 'Struggling',
        maxLabel: 'Thriving',
      } as ControlConfig,
      isRequired: true,
    },
    {
      id: 'ctrl-note',
      type: 'text_input',
      position: 1,
      config: {
        label: 'Anything you want to note?',
        placeholder: 'A word or thought…',
        maxLength: 200,
      } as ControlConfig,
      isRequired: false,
    },
  ];
}

/** The template label that the naive reconciliation would (wrongly) write. */
const TEMPLATE_LABEL = (KPI_CARD_DEFINITION.controls.find((c) => c.position === 0)!
  .config as { label: string }).label;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cardService.updateFromLibrary — check-in label preservation (task 8.4, Property 10)', () => {
  async function freshDb(): Promise<RealDb> {
    const db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    mockGetDatabase.mockResolvedValue(db as never);
    return db;
  }

  beforeEach(() => {
    curatedFixture.length = 0;
    mockGetDatabase.mockReset();
  });

  it('sanity: KPI_CARD_DEFINITION is versioned, note is text_area, and the template label is the generic one', () => {
    // Guards the fixtures this test reasons about.
    expect(KPI_CARD_DEFINITION.version).toBe(1);
    const note = KPI_CARD_DEFINITION.controls.find((c) => c.position === 1)!;
    expect(note.type).toBe('text_area');
    expect(TEMPLATE_LABEL).toBe('How are you doing with your goal?');
  });

  describe('Feature: library-card-sync, Property 10: Update re-derives the label and applies the structural change while preserving history', () => {
    /**
     * **Validates: Requirements 6.3, 7.1, 7.2, 7.3, 7.4**
     *
     * Case A — the seeded personalized label already matches the current setting.
     * After updateFromLibrary on an outdated check-in copy:
     *   - the note control (position 1) is now text_area (structural change applied);
     *   - the mood_slider (position 0) label equals the label RE-DERIVED from the
     *     CURRENT personal-KPI setting (`formatKpiMoodLabel(setting)`) — and is NOT
     *     the KPI_CARD_DEFINITION template;
     *   - completions/control_values on surviving controls are preserved;
     *   - stats (streak/total_uses/last_used_at/stack_position/created_at) preserved;
     *   - the `personal_kpi` setting itself is unchanged;
     *   - source_library_version === 1 and evaluateOutdated is now false.
     */
    it('re-derives the mood label from the current KPI setting and applies the note text_area change, preserving history', async () => {
      const db = await freshDb();

      const goal = 'running 3x a week';
      await setPersonalKpiSetting(db, goal);

      // The seeded copy's label reflects the same goal (formatted the app's way).
      const seededLabel = formatKpiMoodLabel(goal);
      await seedKpiWalletCard(db, {
        cardId: 'card-kpi-a',
        sourceLibraryVersion: null,
        controls: oldKpiControls(seededLabel),
        totalUses: 9,
        currentStreak: 4,
        lastUsedAt: '2024-06-15T08:30:00Z',
        stackPosition: 2,
        createdAt: '2024-02-02T02:02:02Z',
      });
      await seedCompletion(db, 'card-kpi-a', 'comp-1', [
        { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '4' },
        { controlId: 'ctrl-note', controlType: 'text_input', value: 'felt ok' },
      ]);
      await seedCompletion(db, 'card-kpi-a', 'comp-2', [
        { controlId: 'ctrl-mood', controlType: 'mood_slider', value: '5' },
        { controlId: 'ctrl-note', controlType: 'text_input', value: 'better' },
      ]);

      const service = createCardService();

      // Precondition: null copy vs KPI v1 (resolved via the resolver) → outdated.
      const before = await service.getById('card-kpi-a');
      expect(before).not.toBeNull();
      expect(before!.sourceLibraryVersion).toBeNull();
      expect(evaluateOutdated(before!).isOutdated).toBe(true);

      const cardRowBefore = await readCardRow(db, 'card-kpi-a');
      const moodValuesBefore = await readControlValuesForControl(db, 'ctrl-mood');
      const noteValuesBefore = await readControlValuesForControl(db, 'ctrl-note');

      // Apply the update.
      await service.updateFromLibrary('card-kpi-a');

      const after = await service.getById('card-kpi-a');
      expect(after).not.toBeNull();

      // --- Structural change applied: note field is now text_area. ---
      const noteAfter = after!.controls.find((c) => c.position === 1)!;
      expect(noteAfter.type).toBe('text_area');
      // Surviving control kept its UUID (in-place UPDATE, not delete-and-reinsert).
      expect(noteAfter.id).toBe('ctrl-note');

      // --- LABEL RE-DERIVE (the assertions that MUST fail before task 8.5). ---
      const moodAfter = after!.controls.find((c) => c.position === 0)!;
      const reDerived = formatKpiMoodLabel(goal); // 'How are you doing with: running 3x a week?'
      expect((moodAfter.config as { label: string }).label).toBe(reDerived);
      // And explicitly NOT the generic template the naive reconciliation writes.
      expect((moodAfter.config as { label: string }).label).not.toBe(TEMPLATE_LABEL);
      // The mood control also kept its UUID.
      expect(moodAfter.id).toBe('ctrl-mood');

      // --- History preserved on surviving controls. ---
      expect(await readControlValuesForControl(db, 'ctrl-mood')).toEqual(moodValuesBefore);
      expect(await readControlValuesForControl(db, 'ctrl-note')).toEqual(noteValuesBefore);

      // --- Stats invariant. ---
      const cardRowAfter = await readCardRow(db, 'card-kpi-a');
      expect(cardRowAfter!.total_uses).toBe(cardRowBefore!.total_uses);
      expect(cardRowAfter!.current_streak).toBe(cardRowBefore!.current_streak);
      expect(cardRowAfter!.last_used_at).toBe(cardRowBefore!.last_used_at);
      expect(cardRowAfter!.stack_position).toBe(cardRowBefore!.stack_position);
      expect(cardRowAfter!.created_at).toBe(cardRowBefore!.created_at);

      // --- The personal_kpi setting itself is unchanged. ---
      expect(await readPersonalKpiSetting(db)).toBe(goal);

      // --- Version caught up; pill clears. ---
      expect(after!.sourceLibraryVersion).toBe(1);
      expect(evaluateOutdated(after!).isOutdated).toBe(false);
    });

    /**
     * **Validates: Requirements 7.2**
     *
     * Case B — re-derive is AUTHORITATIVE, not carry-over. The seeded copy's label
     * reflects an OLD goal, but the CURRENT `personal_kpi` setting is a DIFFERENT
     * (new) goal. After the update, the label must reflect the CURRENT setting —
     * proving the label is re-derived from the setting, not merely carried over
     * from the stale control config (and not replaced with the template).
     */
    it('re-derives from the CURRENT setting when it differs from the seeded label (authoritative, not carry-over)', async () => {
      const db = await freshDb();

      const oldGoal = 'meditating daily';
      const newGoal = 'reading before bed';

      // Seeded control label reflects the OLD goal…
      const staleLabel = formatKpiMoodLabel(oldGoal);
      // …but the current setting has since been changed to the NEW goal.
      await setPersonalKpiSetting(db, newGoal);

      await seedKpiWalletCard(db, {
        cardId: 'card-kpi-b',
        sourceLibraryVersion: null,
        controls: oldKpiControls(staleLabel),
      });

      const service = createCardService();
      expect(evaluateOutdated((await service.getById('card-kpi-b'))!).isOutdated).toBe(true);

      await service.updateFromLibrary('card-kpi-b');

      const after = await service.getById('card-kpi-b');
      const moodAfter = after!.controls.find((c) => c.position === 0)!;
      const label = (moodAfter.config as { label: string }).label;

      // Must reflect the CURRENT setting (new goal), not the stale seeded label…
      expect(label).toBe(formatKpiMoodLabel(newGoal));
      // …not the stale carry-over…
      expect(label).not.toBe(staleLabel);
      // …and not the generic template.
      expect(label).not.toBe(TEMPLATE_LABEL);

      // Structural change still applied.
      expect(after!.controls.find((c) => c.position === 1)!.type).toBe('text_area');
      // Setting untouched.
      expect(await readPersonalKpiSetting(db)).toBe(newGoal);
    });
  });
});
