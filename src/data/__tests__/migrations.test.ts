/**
 * Unit tests for guided check-in database migrations.
 * Validates: Requirements 9.1, 9.2, 9.6
 */

import { runGuidedCheckinMigration, runMigrations } from '../migrations';

// Mock expo-sqlite module
jest.mock('expo-sqlite', () => ({}));

// Create a mock db object
const createMockDb = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 0 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
});

describe('runGuidedCheckinMigration', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('creates guided_checkin_records table', async () => {
    // Mock getAllAsync to return columns WITHOUT checkin_id
    mockDb.getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'selected_emotion' },
      { name: 'selected_contexts' },
    ]);

    await runGuidedCheckinMigration(mockDb as any);

    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const createTableCall = execCalls.find((sql: string) =>
      sql.includes('CREATE TABLE IF NOT EXISTS guided_checkin_records')
    );
    expect(createTableCall).toBeDefined();
  });

  it('creates idx_guided_checkin_recorded_at index', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'selected_emotion' },
    ]);

    await runGuidedCheckinMigration(mockDb as any);

    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const indexCall = execCalls.find((sql: string) =>
      sql.includes('CREATE INDEX IF NOT EXISTS idx_guided_checkin_recorded_at')
    );
    expect(indexCall).toBeDefined();
  });

  it('adds checkin_id column when it does not exist', async () => {
    // Return column list WITHOUT checkin_id
    mockDb.getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'selected_emotion' },
      { name: 'selected_contexts' },
      { name: 'selected_time' },
      { name: 'tool_card_ids' },
      { name: 'started_at' },
      { name: 'ended_at' },
    ]);

    await runGuidedCheckinMigration(mockDb as any);

    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const alterCall = execCalls.find((sql: string) =>
      sql.includes('ALTER TABLE emotion_sessions ADD COLUMN checkin_id TEXT')
    );
    expect(alterCall).toBeDefined();
  });

  it('skips checkin_id column when it already exists', async () => {
    // Return column list WITH checkin_id
    mockDb.getAllAsync.mockResolvedValueOnce([
      { name: 'id' },
      { name: 'selected_emotion' },
      { name: 'selected_contexts' },
      { name: 'selected_time' },
      { name: 'tool_card_ids' },
      { name: 'started_at' },
      { name: 'ended_at' },
      { name: 'checkin_id' },
    ]);

    await runGuidedCheckinMigration(mockDb as any);

    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const alterCall = execCalls.find((sql: string) =>
      sql.includes('ALTER TABLE emotion_sessions ADD COLUMN checkin_id TEXT')
    );
    expect(alterCall).toBeUndefined();
  });
});

describe('runEmotionTagsExpansionMigration (via runMigrations)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    // Default: getAllAsync returns empty columns (no checkin_id, no rationale, no card_type, no source_library_id)
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('returns early without rebuilding when constraint already allows new emotions', async () => {
    // For runEmotionTagsExpansionMigration: the savepoint INSERT succeeds (constraint already updated)
    // For runEmotionSessionsExpansionMigration: same pattern
    // For runIconTypeCheckMigration: same pattern
    // The key behavior: when runAsync succeeds within the savepoint test, the migration returns early.

    // We need to set up the mock so that:
    // 1. The SCHEMA_SQL execAsync succeeds
    // 2. runEmotionMigration: getAllAsync returns columns (with card_type and source_library_id)
    // 3. runIconTypeCheckMigration: runAsync succeeds (constraint already allows third_party)
    // 4. runRationaleMigration: getAllAsync returns columns (with rationale_approach)
    // 5. runGuidedCheckinMigration: getAllAsync returns columns (with checkin_id)
    // 6. runEmotionTagsExpansionMigration: runAsync succeeds (constraint already allows 'lonely')
    // 7. runEmotionSessionsExpansionMigration: runAsync succeeds (constraint already allows 'lonely')

    // Setup getAllAsync responses for different PRAGMA table_info calls
    mockDb.getAllAsync
      .mockResolvedValueOnce([ // runEmotionMigration - cards table columns
        { name: 'id' }, { name: 'card_type' }, { name: 'source_library_id' },
      ])
      .mockResolvedValueOnce([ // runRationaleMigration - cards table columns
        { name: 'id' }, { name: 'rationale_approach' },
      ])
      .mockResolvedValueOnce([ // runGuidedCheckinMigration - emotion_sessions columns
        { name: 'id' }, { name: 'checkin_id' },
      ]);

    // runAsync succeeds for savepoint test INSERTs (constraint already allows new values)
    mockDb.runAsync.mockResolvedValue({ changes: 1 });

    await runMigrations(mockDb as any);

    // Verify that no table rebuild occurred for emotion_tags
    // (no DROP TABLE emotion_tags, no CREATE TABLE emotion_tags_new)
    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const dropEmotionTags = execCalls.find((sql: string) =>
      sql.includes('DROP TABLE emotion_tags')
    );
    expect(dropEmotionTags).toBeUndefined();
  });
});

describe('runEmotionSessionsExpansionMigration (via runMigrations)', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockDb.getAllAsync.mockResolvedValue([]);
  });

  it('returns early without rebuilding when constraint already allows new emotions', async () => {
    // Setup for all prior migrations to pass through
    mockDb.getAllAsync
      .mockResolvedValueOnce([ // runEmotionMigration - cards columns
        { name: 'id' }, { name: 'card_type' }, { name: 'source_library_id' },
      ])
      .mockResolvedValueOnce([ // runRationaleMigration - cards columns
        { name: 'id' }, { name: 'rationale_approach' },
      ])
      .mockResolvedValueOnce([ // runGuidedCheckinMigration - emotion_sessions columns
        { name: 'id' }, { name: 'checkin_id' },
      ]);

    // runAsync succeeds for all savepoint test INSERTs
    mockDb.runAsync.mockResolvedValue({ changes: 1 });

    await runMigrations(mockDb as any);

    // Verify that no table rebuild occurred for emotion_sessions
    const execCalls = mockDb.execAsync.mock.calls.map((c) => c[0]);
    const dropEmotionSessions = execCalls.find((sql: string) =>
      sql.includes('DROP TABLE emotion_sessions')
    );
    expect(dropEmotionSessions).toBeUndefined();
  });
});
