/**
 * Library Card Sync (Phase 1), task 6.2 — developer re-arm unit test.
 *
 * Exercises `reArmLibrarySync()` (the extracted DB logic behind
 * `DevReArmSyncButton`) against a REAL in-memory SQLite engine (node:sqlite
 * DatabaseSync wrapped in the async expo-sqlite surface), matching the harness in
 * `sourceLibraryVersionPersistence.test.ts` / `updateFromLibrary.test.ts`.
 *
 * Asserts (Req 5.2, 5.5):
 *   - Re-arm sets source_library_version to NULL for ALL cards with a
 *     source_library_id (eligible cards), and leaves cards with a null
 *     source_library_id untouched.
 *   - Re-arm does NOT delete/alter controls (except the intentional targeted
 *     check-in note-field type downgrade), completions, control_values,
 *     reminders, or background_overlays, and does NOT change stats
 *     (total_uses / current_streak / last_used_at / stack_position).
 *   - After re-arm, evaluateOutdated(card) is true again for a card whose curated
 *     def is versioned (the nulled stored version is now behind the curated one).
 *   - The targeted downgrade flips the check-in note control (position 1) from
 *     text_area back to text_input on affected copies.
 *
 * Validates: Requirements 5.2, 5.5
 */

import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../../data/migrations';
import { evaluateOutdated } from '../librarySyncService';
import type { CuratedCardDefinition } from '../../data/curatedLibrary';

// reArmLibrarySync obtains its DB via getDatabase(); point it at a real in-memory DB.
jest.mock('../../data/database', () => ({
  getDatabase: jest.fn(),
}));

// Curated library: mutable fixture behind a getter (same seam as
// librarySyncService.test.ts / updateFromLibrary.test.ts) so evaluateOutdated
// reads a deterministic set of versioned defs.
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
import {
  reArmLibrarySync,
  CHECK_IN_SOURCE_LIBRARY_ID,
  WIDENED_CONTROLS,
} from '../devReArmLibrarySync';
// eslint-disable-next-line import/first
import { getDatabase } from '../../data/database';
// eslint-disable-next-line import/first
import { createCardService } from '../cardService';
// NOTE: intentionally NOT mocked — task 8.7 exercises the REAL versioned
// KPI_CARD_DEFINITION (version 1) + resolver so the check-in card is genuinely
// re-armed and detected outdated again through resolveCuratedDefinition.
// eslint-disable-next-line import/first
import { KPI_CARD_DEFINITION, formatKpiMoodLabel } from '../../data/kpiCardDefinition';

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

const CATEGORY_ID = 'grounding-calming';
const CATEGORY_ID_CHECKIN = 'daily-checkin-journaling';

async function seedCategories(db: RealDb): Promise<void> {
  const cats: [string, string][] = [
    [CATEGORY_ID, 'Grounding & Calming'],
    [CATEGORY_ID_CHECKIN, 'Daily Check-In & Journaling'],
  ];
  for (const [id, name] of cats) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
      [id, name, '#000000', 0]
    );
  }
}

interface SeedControl {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  isRequired?: boolean;
}

interface SeedCardSpec {
  cardId: string;
  sourceLibraryId: string | null;
  sourceLibraryVersion: number | null;
  categoryId?: string;
  controls?: SeedControl[];
  totalUses?: number;
  currentStreak?: number;
  lastUsedAt?: string | null;
  stackPosition?: number;
}

async function seedCard(db: RealDb, spec: SeedCardSpec): Promise<void> {
  const now = '2024-01-01T00:00:00Z';
  await db.runAsync(
    `INSERT INTO cards (
       id, title, description, icon_type, icon_value, background_type, background_value,
       category_id, origin_badge, stack_position, total_uses, current_streak, last_used_at,
       is_archived, archived_at, previous_stack_position, allow_background_customization,
       source_library_id, source_library_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?, ?, ?)`,
    [
      spec.cardId,
      'Card ' + spec.cardId,
      'desc',
      'emoji',
      '🫁',
      'color',
      '#EDE7F6',
      spec.categoryId ?? CATEGORY_ID,
      spec.sourceLibraryId == null ? 'my_tool' : 'library',
      spec.stackPosition ?? 0,
      spec.totalUses ?? 5,
      spec.currentStreak ?? 2,
      spec.lastUsedAt ?? '2024-06-01T09:00:00Z',
      spec.sourceLibraryId,
      spec.sourceLibraryVersion,
      now,
      now,
    ]
  );
  for (const c of spec.controls ?? []) {
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

async function seedReminder(db: RealDb, cardId: string, reminderId: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO reminders (id, card_id, type, time, frequency, is_active, notification_id, created_at)
     VALUES (?, ?, 'per_card', '09:00', ?, 1, ?, ?)`,
    [reminderId, cardId, JSON.stringify({ type: 'daily' }), '["notif-1"]', '2024-01-01T00:00:00Z']
  );
}

async function seedOverlay(db: RealDb, cardId: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO background_overlays (id, card_id, background_type, background_value, created_at, updated_at)
     VALUES (?, ?, 'color', '#123456', ?, ?)`,
    ['ovl-' + cardId, cardId, '2024-05-01T00:00:00Z', '2024-05-01T00:00:00Z']
  );
}

async function readVersion(db: RealDb, cardId: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ source_library_version: number | null }>(
    `SELECT source_library_version FROM cards WHERE id = ?`,
    [cardId]
  );
  return row?.source_library_version ?? null;
}

function setCurated(defs: CuratedCardDefinition[]): void {
  curatedFixture.length = 0;
  curatedFixture.push(...defs);
}

function versionedCurated(id: string, version: number): CuratedCardDefinition {
  return {
    id,
    title: 'Card ' + id,
    description: 'desc',
    iconType: 'emoji',
    iconValue: '🫁',
    backgroundType: 'color',
    backgroundValue: '#EDE7F6',
    categoryId: CATEGORY_ID,
    allowBackgroundCustomization: true,
    controls: [],
    version,
  } as CuratedCardDefinition;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reArmLibrarySync — developer re-arm (task 6.2)', () => {
  let db: RealDb;

  beforeEach(async () => {
    curatedFixture.length = 0;
    mockGetDatabase.mockReset();
    db = createRealSqliteDb();
    await runMigrations(db as never);
    await seedCategories(db);
    mockGetDatabase.mockResolvedValue(db as never);
  });

  it('nulls source_library_version for eligible cards and leaves null-source cards alone', async () => {
    await seedCard(db, {
      cardId: 'lib-1',
      sourceLibraryId: 'lib-box-breathing',
      sourceLibraryVersion: 2,
    });
    await seedCard(db, {
      cardId: 'lib-2',
      sourceLibraryId: 'lib-grounding',
      sourceLibraryVersion: null,
    });
    // my_tool card — no source_library_id, must be untouched.
    await seedCard(db, {
      cardId: 'mine',
      sourceLibraryId: null,
      sourceLibraryVersion: 7, // contrived, but proves the WHERE clause excludes it
    });

    const result = await reArmLibrarySync();

    expect(await readVersion(db, 'lib-1')).toBeNull();
    expect(await readVersion(db, 'lib-2')).toBeNull();
    // Untouched — the my_tool card still carries its (contrived) version.
    expect(await readVersion(db, 'mine')).toBe(7);

    // Only the two eligible cards were reset (lib-2 was already null → 1 row for
    // lib-1 with a real change... SQLite counts a SET-to-same as a change too, so
    // assert on the two eligible cards being matched, not the exact changes count).
    expect(result.versionResetCount).toBeGreaterThanOrEqual(1);
  });

  it('after re-arm, evaluateOutdated is true again for a versioned curated card', async () => {
    setCurated([versionedCurated('lib-box-breathing', 3)]);
    await seedCard(db, {
      cardId: 'lib-1',
      sourceLibraryId: 'lib-box-breathing',
      sourceLibraryVersion: 3, // currently up-to-date → not outdated
    });

    const service = createCardService();
    const before = await service.getById('lib-1');
    expect(before).not.toBeNull();
    expect(evaluateOutdated(before!).isOutdated).toBe(false);

    await reArmLibrarySync();

    const after = await service.getById('lib-1');
    expect(after!.sourceLibraryVersion).toBeNull();
    // Curated def is versioned (3) and copy is now null → outdated again.
    expect(evaluateOutdated(after!).isOutdated).toBe(true);
  });

  it('genuinely re-arms the check-in (KPI) card: downgrades the note field, re-flags it outdated via the resolver, and preserves the personalized label + history (task 8.7)', async () => {
    // A CURRENT (caught-up) check-in copy: source_library_version = 1 equals the
    // real KPI_CARD_DEFINITION.version = 1, note field already text_area, and the
    // mood_slider (position 0) carrying the user's PERSONALIZED label (not the
    // KPI_CARD_DEFINITION template). This is what an installed, up-to-date copy
    // looks like before re-arm.
    const personalizedLabel = formatKpiMoodLabel('quitting smoking');
    await seedCard(db, {
      cardId: 'checkin-1',
      sourceLibraryId: CHECK_IN_SOURCE_LIBRARY_ID,
      sourceLibraryVersion: 1,
      categoryId: CATEGORY_ID_CHECKIN,
      totalUses: 9,
      currentStreak: 5,
      lastUsedAt: '2024-06-20T07:15:00Z',
      stackPosition: 2,
      controls: [
        {
          id: 'ci-mood',
          type: 'mood_slider',
          position: 0,
          config: { label: personalizedLabel, minLabel: 'Struggling', maxLabel: 'Thriving' },
          isRequired: true,
        },
        {
          id: 'ci-note',
          type: 'text_area',
          position: 1,
          config: { label: 'Anything you want to note?', placeholder: 'A word or thought…' },
        },
      ],
    });
    // Prove preservation: a logged completion (with control_values on both
    // controls), a reminder, and a custom background overlay.
    await seedCompletion(db, 'checkin-1', 'ci-comp-1', [
      { controlId: 'ci-mood', controlType: 'mood_slider', value: '4' },
      { controlId: 'ci-note', controlType: 'text_area', value: 'held strong today' },
    ]);
    await seedReminder(db, 'checkin-1', 'ci-rem-1');
    await seedOverlay(db, 'checkin-1');

    // A different library card whose text_area is an ALWAYS-multi-line field
    // (Decatastrophizing "Worst-case scenario", position 0 — never widened, so
    // absent from WIDENED_CONTROLS) — must NOT be downgraded.
    await seedCard(db, {
      cardId: 'other-lib',
      sourceLibraryId: 'lib-decatastrophizing',
      sourceLibraryVersion: 1,
      controls: [
        { id: 'o-note', type: 'text_area', position: 0, config: { label: 'Worst-case scenario' } },
      ],
    });

    const service = createCardService();

    // PRECONDITION: with the real KPI_CARD_DEFINITION (version 1) resolved via
    // resolveCuratedDefinition, a v1 copy is caught up → NOT outdated before re-arm.
    const before = await service.getById('checkin-1');
    expect(before).not.toBeNull();
    expect(before!.sourceLibraryVersion).toBe(KPI_CARD_DEFINITION.version); // 1 == 1
    expect(evaluateOutdated(before!).isOutdated).toBe(false);

    // Capture history/stats baselines for the preservation assertions.
    const cardBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT total_uses, current_streak, last_used_at, stack_position FROM cards WHERE id = ?`,
      ['checkin-1']
    );
    const cvBefore = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, control_id, value FROM control_values WHERE completion_id = ? ORDER BY id`,
      ['ci-comp-1']
    );
    const remBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM reminders WHERE card_id = ?`,
      ['checkin-1']
    );
    const ovlBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM background_overlays WHERE card_id = ?`,
      ['checkin-1']
    );

    const result = await reArmLibrarySync();

    // --- Note field downgraded (visible re-apply), scoped to the check-in card ---
    const ciNote = await db.getFirstAsync<{ type: string }>(
      `SELECT type FROM controls WHERE id = ?`,
      ['ci-note']
    );
    const otherNote = await db.getFirstAsync<{ type: string }>(
      `SELECT type FROM controls WHERE id = ?`,
      ['o-note']
    );
    expect(ciNote!.type).toBe('text_input'); // downgraded (visible re-apply)
    expect(otherNote!.type).toBe('text_area'); // untouched — always-multi-line field
    expect(result.downgradedControlCount).toBe(1);

    // The check-in note control keeps its UUID (in-place UPDATE, not reinsert),
    // so its historical control_values stay valid.
    const ciNoteId = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM controls WHERE card_id = ? AND position = 1`,
      ['checkin-1']
    );
    expect(ciNoteId!.id).toBe('ci-note');

    // --- Re-armed: version nulled → evaluateOutdated true again via the resolver ---
    const after = await service.getById('checkin-1');
    expect(after!.sourceLibraryVersion).toBeNull();
    // null copy version vs KPI_CARD_DEFINITION.version (1), resolved through
    // resolveCuratedDefinition for lib-personal-kpi → outdated again.
    expect(evaluateOutdated(after!).isOutdated).toBe(true);

    // --- Personalized mood_slider label (position 0) UNCHANGED by re-arm ---
    // Re-arm touches only source_library_version + the note control; it must
    // never overwrite the user's personalized label (Req 5.7 / 7.x). The
    // subsequent update re-derives it, but re-arm itself leaves it alone.
    const moodAfter = await db.getFirstAsync<{ config: string }>(
      `SELECT config FROM controls WHERE id = ?`,
      ['ci-mood']
    );
    const moodConfig = JSON.parse(moodAfter!.config) as { label: string };
    expect(moodConfig.label).toBe(personalizedLabel);
    // And it is NOT the KPI_CARD_DEFINITION template placeholder.
    const kpiTemplateLabel = (KPI_CARD_DEFINITION.controls[0].config as { label: string }).label;
    expect(moodConfig.label).not.toBe(kpiTemplateLabel);

    // --- History / stats preserved (Req 5.5 / 5.7) ---
    const cardAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT total_uses, current_streak, last_used_at, stack_position FROM cards WHERE id = ?`,
      ['checkin-1']
    );
    expect(cardAfter).toEqual(cardBefore);

    const comps = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM completions WHERE card_id = ?`,
      ['checkin-1']
    );
    expect(comps).toHaveLength(1);

    const cvAfter = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, control_id, value FROM control_values WHERE completion_id = ? ORDER BY id`,
      ['ci-comp-1']
    );
    expect(cvAfter).toEqual(cvBefore); // both control_values survive intact

    const remAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM reminders WHERE card_id = ?`,
      ['checkin-1']
    );
    expect(remAfter).toEqual(remBefore);

    const ovlAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM background_overlays WHERE card_id = ?`,
      ['checkin-1']
    );
    expect(ovlAfter).toEqual(ovlBefore);
  });

  it('downgrades a widened control on a NON-check-in card (Evidence For & Against "The belief"), re-arms it, and preserves history', async () => {
    // Real curated def is versioned (1). Point evaluateOutdated at a versioned
    // def for this card so the re-armed (nulled) copy reads outdated again.
    setCurated([versionedCurated('lib-evidence-for-against', 1)]);

    // A caught-up wallet copy of Evidence For & Against: version 1, with "The
    // belief" (position 0) already WIDENED to text_area (the 1.0.5 state), plus
    // the two always-multi-line evidence fields at positions 1 and 2.
    await seedCard(db, {
      cardId: 'ev-1',
      sourceLibraryId: 'lib-evidence-for-against',
      sourceLibraryVersion: 1,
      controls: [
        { id: 'ev-belief', type: 'text_area', position: 0, config: { label: 'The belief' } },
        { id: 'ev-for', type: 'text_area', position: 1, config: { label: 'Evidence FOR this belief' } },
        { id: 'ev-against', type: 'text_area', position: 2, config: { label: 'Evidence AGAINST this belief' } },
      ],
    });
    // History on the widened control — must survive the in-place downgrade.
    await seedCompletion(db, 'ev-1', 'ev-comp-1', [
      { controlId: 'ev-belief', controlType: 'text_area', value: 'I always fail at this' },
    ]);

    const service = createCardService();
    const before = await service.getById('ev-1');
    expect(evaluateOutdated(before!).isOutdated).toBe(false);

    const result = await reArmLibrarySync();

    // "The belief" (position 0) downgraded text_area -> text_input, in place.
    const belief = await db.getFirstAsync<{ id: string; type: string }>(
      `SELECT id, type FROM controls WHERE card_id = ? AND position = 0`,
      ['ev-1']
    );
    expect(belief!.type).toBe('text_input');
    expect(belief!.id).toBe('ev-belief'); // same UUID (in-place, history intact)

    // The two ALWAYS-multi-line evidence fields (positions 1, 2) are NOT in
    // WIDENED_CONTROLS → left as text_area (no false "made bigger" diff).
    const forField = await db.getFirstAsync<{ type: string }>(
      `SELECT type FROM controls WHERE id = ?`,
      ['ev-for']
    );
    const againstField = await db.getFirstAsync<{ type: string }>(
      `SELECT type FROM controls WHERE id = ?`,
      ['ev-against']
    );
    expect(forField!.type).toBe('text_area');
    expect(againstField!.type).toBe('text_area');

    expect(result.downgradedControlCount).toBe(1);

    // Re-armed: version nulled → outdated again.
    const after = await service.getById('ev-1');
    expect(after!.sourceLibraryVersion).toBeNull();
    expect(evaluateOutdated(after!).isOutdated).toBe(true);

    // History preserved on the downgraded control.
    const cv = await db.getAllAsync<{ control_id: string; value: string }>(
      `SELECT control_id, value FROM control_values WHERE completion_id = ?`,
      ['ev-comp-1']
    );
    expect(cv).toEqual([{ control_id: 'ev-belief', value: 'I always fail at this' }]);
  });

  it('does NOT downgrade an always-multi-line field (Win of the Day position 0), avoiding a false diff', async () => {
    // Win of the Day ("lib-win-of-day") position 0 was ALWAYS text_area — never
    // widened in 1.0.5 — so it is absent from WIDENED_CONTROLS and re-arm must
    // leave it text_area.
    expect(
      WIDENED_CONTROLS.some((w) => w.sourceLibraryId === 'lib-win-of-day')
    ).toBe(false);

    await seedCard(db, {
      cardId: 'win-1',
      sourceLibraryId: 'lib-win-of-day',
      sourceLibraryVersion: null,
      controls: [
        { id: 'win-note', type: 'text_area', position: 0, config: { label: "Today's win" } },
      ],
    });

    const result = await reArmLibrarySync();

    const win = await db.getFirstAsync<{ type: string }>(
      `SELECT type FROM controls WHERE id = ?`,
      ['win-note']
    );
    expect(win!.type).toBe('text_area'); // untouched — always multi-line
    expect(result.downgradedControlCount).toBe(0);
  });

  it('preserves controls, completions, control_values, reminders, background_overlays, and stats', async () => {
    await seedCard(db, {
      cardId: 'lib-h',
      sourceLibraryId: 'lib-box-breathing',
      sourceLibraryVersion: 2,
      totalUses: 11,
      currentStreak: 4,
      lastUsedAt: '2024-06-15T08:30:00Z',
      stackPosition: 3,
      controls: [
        { id: 'h-mood', type: 'mood_slider', position: 0, config: { label: 'Mood' }, isRequired: true },
        { id: 'h-note', type: 'text_input', position: 1, config: { label: 'Note' } },
      ],
    });
    await seedCompletion(db, 'lib-h', 'comp-1', [
      { controlId: 'h-mood', controlType: 'mood_slider', value: '4' },
      { controlId: 'h-note', controlType: 'text_input', value: 'felt ok' },
    ]);
    await seedReminder(db, 'lib-h', 'rem-1');
    await seedOverlay(db, 'lib-h');

    const cardBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT total_uses, current_streak, last_used_at, stack_position FROM cards WHERE id = ?`,
      ['lib-h']
    );
    const controlsBefore = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, type, position, config, is_required FROM controls WHERE card_id = ? ORDER BY position`,
      ['lib-h']
    );
    const cvBefore = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, control_id, value FROM control_values ORDER BY id`,
    );
    const remBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM reminders WHERE card_id = ?`,
      ['lib-h']
    );
    const ovlBefore = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM background_overlays WHERE card_id = ?`,
      ['lib-h']
    );

    await reArmLibrarySync();

    // Stats unchanged.
    const cardAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT total_uses, current_streak, last_used_at, stack_position FROM cards WHERE id = ?`,
      ['lib-h']
    );
    expect(cardAfter).toEqual(cardBefore);

    // Controls unchanged (this card is not the check-in tool, so no downgrade;
    // its note is text_input at position 1 anyway).
    const controlsAfter = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, type, position, config, is_required FROM controls WHERE card_id = ? ORDER BY position`,
      ['lib-h']
    );
    expect(controlsAfter).toEqual(controlsBefore);

    // Completions / control_values / reminder / overlay all survive intact.
    const comps = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM completions WHERE card_id = ?`,
      ['lib-h']
    );
    expect(comps).toHaveLength(1);

    const cvAfter = await db.getAllAsync<Record<string, unknown>>(
      `SELECT id, control_id, value FROM control_values ORDER BY id`,
    );
    expect(cvAfter).toEqual(cvBefore);

    const remAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM reminders WHERE card_id = ?`,
      ['lib-h']
    );
    expect(remAfter).toEqual(remBefore);

    const ovlAfter = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM background_overlays WHERE card_id = ?`,
      ['lib-h']
    );
    expect(ovlAfter).toEqual(ovlBefore);
  });
});
