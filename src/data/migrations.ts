import type { SQLiteDatabase } from 'expo-sqlite';
import type { IconType } from '@/types/index';

/** Valid icon_type values for application-layer validation (SQLite CHECK cannot be altered in-place). */
const VALID_ICON_TYPES: IconType[] = ['library', 'emoji', 'custom_image', 'third_party'];

/**
 * Validates that an icon_type value is allowed.
 * Since SQLite cannot alter CHECK constraints in-place, we enforce 'third_party'
 * support at the application layer.
 */
export function validateIconType(iconType: string): iconType is IconType {
  return VALID_ICON_TYPES.includes(iconType as IconType);
}

/**
 * Runs all database migrations. Creates tables and indexes
 * if they don't already exist (idempotent).
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  await runEmotionMigration(db);
  await runKpiMigration(db);
  await runAnalyticsMigration(db);
  await runAdminMigration(db);
  await runIconTypeCheckMigration(db);
  await runRationaleMigration(db);
  await runGuidedCheckinMigration(db);
  await runEmotionTagsExpansionMigration(db);
  await runEmotionSessionsExpansionMigration(db);
  await runCrisisResourcesCanadaMigration(db);
}

/**
 * Adds the card_type column to the cards table if it doesn't already exist.
 * ALTER TABLE is not idempotent, so we check via PRAGMA table_info first.
 */
async function runEmotionMigration(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(cards)`
  );
  const hasCardType = columns.some((col) => col.name === 'card_type');

  if (!hasCardType) {
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN card_type TEXT NOT NULL DEFAULT 'standard'
         CHECK(card_type IN ('standard', 'session_launcher'))`
    );
  }

  // Add source_library_id column (nullable, stores the original library card ID)
  const hasSourceLibraryId = columns.some((col) => col.name === 'source_library_id');
  if (!hasSourceLibraryId) {
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN source_library_id TEXT`
    );
  }

  // Enable background customization for the session launcher card (upgrade path)
  await db.runAsync(
    `UPDATE cards SET allow_background_customization = 1 WHERE id = 'session-launcher' AND allow_background_customization = 0`
  );

  // Create emotion-related tables (idempotent via IF NOT EXISTS)
  await db.execAsync(EMOTION_SCHEMA_SQL);
}

const SCHEMA_SQL = `
-- Categories (seeded on first launch)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

-- Cards
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  description TEXT NOT NULL CHECK(length(trim(description)) > 0),
  icon_type TEXT NOT NULL CHECK(icon_type IN ('library', 'emoji', 'custom_image', 'third_party')),
  icon_value TEXT NOT NULL,
  background_type TEXT NOT NULL CHECK(background_type IN ('color', 'gradient', 'image')),
  background_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  origin_badge TEXT NOT NULL CHECK(origin_badge IN ('library', 'community', 'my_tool')),
  stack_position INTEGER NOT NULL DEFAULT 0,
  total_uses INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  previous_stack_position INTEGER,
  allow_background_customization INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_archived ON cards(is_archived);
CREATE INDEX IF NOT EXISTS idx_cards_stack_position ON cards(stack_position) WHERE is_archived = 0;
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category_id);

-- Controls (field types within cards)
CREATE TABLE IF NOT EXISTS controls (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN (
    'static_text', 'text_input', 'text_area', 'mood_slider',
    'choice_buttons', 'checkbox', 'counter', 'datetime_stamp',
    'image_attachment', 'link_button', 'display_media', 'upload_media'
  )),
  position INTEGER NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  is_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_controls_card ON controls(card_id);

-- Completions
CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_completions_card ON completions(card_id);
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(completed_at);

-- Control Values (captured per completion)
CREATE TABLE IF NOT EXISTS control_values (
  id TEXT PRIMARY KEY,
  completion_id TEXT NOT NULL REFERENCES completions(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  control_type TEXT NOT NULL,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_control_values_completion ON control_values(completion_id);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('per_card')),
  time TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  notification_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_card ON reminders(card_id);
CREATE INDEX IF NOT EXISTS idx_reminders_active ON reminders(is_active) WHERE is_active = 1;

-- App Settings (key-value for preferences)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Crisis Resources (seeded, geolocation-aware)
CREATE TABLE IF NOT EXISTS crisis_resources (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  url TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL
);

-- Background Overlays (per-user personalization for Library/Community cards)
CREATE TABLE IF NOT EXISTS background_overlays (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  background_type TEXT NOT NULL CHECK(background_type IN ('color', 'gradient', 'image')),
  background_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(card_id)
);

CREATE INDEX IF NOT EXISTS idx_background_overlays_card ON background_overlays(card_id);
`;

const EMOTION_SCHEMA_SQL = `
-- Emotion tags for cards (both wallet and library-sourced)
CREATE TABLE IF NOT EXISTS emotion_tags (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL CHECK(emotion IN (
    'stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'
  )),
  UNIQUE(card_id, emotion)
);
CREATE INDEX IF NOT EXISTS idx_emotion_tags_card ON emotion_tags(card_id);
CREATE INDEX IF NOT EXISTS idx_emotion_tags_emotion ON emotion_tags(emotion);

-- Context associations for cards (ranking signal)
CREATE TABLE IF NOT EXISTS card_context_tags (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  context TEXT NOT NULL CHECK(context IN (
    'at_work', 'with_family', 'with_friends', 'alone_at_home', 'not_sure'
  )),
  PRIMARY KEY(card_id, context)
);

-- Time associations for cards (filter)
CREATE TABLE IF NOT EXISTS card_time_tags (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  time TEXT NOT NULL CHECK(time IN ('1_2_min', '5_10_min')),
  PRIMARY KEY(card_id, time)
);

-- Emotion sessions
CREATE TABLE IF NOT EXISTS emotion_sessions (
  id TEXT PRIMARY KEY,
  selected_emotion TEXT NOT NULL CHECK(selected_emotion IN (
    'stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb'
  )),
  selected_contexts TEXT NOT NULL DEFAULT '[]',
  selected_time TEXT,
  tool_card_ids TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_emotion_sessions_active ON emotion_sessions(ended_at)
  WHERE ended_at IS NULL;
`;


/**
 * Creates the kpi_records table for storing Personal KPI entries.
 * Uses CREATE TABLE/INDEX IF NOT EXISTS for idempotency.
 */
export async function runKpiMigration(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(KPI_SCHEMA_SQL);
}

const KPI_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kpi_records (
  id TEXT PRIMARY KEY,
  value INTEGER NOT NULL CHECK(value >= 1 AND value <= 10),
  note TEXT,
  kpi_label TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kpi_records_recorded_at ON kpi_records(recorded_at);
`;

/**
 * Creates the analytics_event_queue table for storing analytics events
 * before batch transmission. Uses CREATE TABLE/INDEX IF NOT EXISTS for idempotency.
 */
export async function runAnalyticsMigration(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(ANALYTICS_SCHEMA_SQL);
}

const ANALYTICS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS analytics_event_queue (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'sending', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_queue_status_created
  ON analytics_event_queue(status, created_at);
`;


/**
 * Creates the suppressed_library_cards table for storing IDs of static library
 * cards that the admin has chosen to hide. Uses CREATE TABLE IF NOT EXISTS
 * for idempotency.
 */
export async function runAdminMigration(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(ADMIN_SCHEMA_SQL);
}

const ADMIN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS suppressed_library_cards (
  id TEXT PRIMARY KEY,
  suppressed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Migrates the cards table CHECK constraint to include 'third_party' in icon_type.
 * SQLite cannot ALTER CHECK constraints, so we rebuild the table.
 * Idempotent: checks current constraint via a test INSERT + ROLLBACK.
 */
async function runIconTypeCheckMigration(db: SQLiteDatabase): Promise<void> {
  // Test if 'third_party' is already allowed by attempting an insert in a savepoint
  try {
    await db.execAsync('SAVEPOINT icon_check_test');
    await db.runAsync(
      `INSERT INTO cards (id, title, description, icon_type, icon_value, background_type, background_value, category_id, origin_badge, stack_position, allow_background_customization, created_at, updated_at)
       VALUES ('__icon_type_test__', 'test', 'test', 'third_party', 'test', 'color', '#FFF', 'grounding-calming', 'my_tool', -999, 0, datetime('now'), datetime('now'))`,
      []
    );
    // If we get here, the constraint already allows 'third_party'
    await db.execAsync('ROLLBACK TO icon_check_test');
    await db.execAsync('RELEASE icon_check_test');
    return; // No migration needed
  } catch {
    // The INSERT failed — constraint doesn't include 'third_party', need to rebuild
    try {
      await db.execAsync('ROLLBACK TO icon_check_test');
      await db.execAsync('RELEASE icon_check_test');
    } catch {
      // Savepoint may already be rolled back
    }
  }

  // Rebuild the cards table with the updated CHECK constraint
  // Disable foreign keys to prevent ON DELETE CASCADE from wiping controls/completions
  await db.execAsync('PRAGMA foreign_keys = OFF');
  await db.execAsync('BEGIN TRANSACTION');
  try {
    // 1. Create temp table with new constraint
    await db.execAsync(`
      CREATE TABLE cards_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0),
        description TEXT NOT NULL CHECK(length(trim(description)) > 0),
        icon_type TEXT NOT NULL CHECK(icon_type IN ('library', 'emoji', 'custom_image', 'third_party')),
        icon_value TEXT NOT NULL,
        background_type TEXT NOT NULL CHECK(background_type IN ('color', 'gradient', 'image')),
        background_value TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id),
        origin_badge TEXT NOT NULL CHECK(origin_badge IN ('library', 'community', 'my_tool')),
        stack_position INTEGER NOT NULL DEFAULT 0,
        total_uses INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        previous_stack_position INTEGER,
        allow_background_customization INTEGER NOT NULL DEFAULT 0,
        source_library_id TEXT,
        card_type TEXT NOT NULL DEFAULT 'standard' CHECK(card_type IN ('standard', 'session_launcher')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 2. Copy all data from old table
    await db.execAsync(`
      INSERT INTO cards_new
        SELECT id, title, description, icon_type, icon_value, background_type, background_value,
               category_id, origin_badge, stack_position, total_uses, current_streak,
               last_used_at, is_archived, archived_at, previous_stack_position,
               allow_background_customization, source_library_id, card_type, created_at, updated_at
        FROM cards
    `);

    // 3. Drop old table
    await db.execAsync('DROP TABLE cards');

    // 4. Rename new table
    await db.execAsync('ALTER TABLE cards_new RENAME TO cards');

    // 5. Recreate indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_cards_archived ON cards(is_archived);
      CREATE INDEX IF NOT EXISTS idx_cards_stack_position ON cards(stack_position) WHERE is_archived = 0;
      CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category_id);
    `);

    await db.execAsync('COMMIT');
    await db.execAsync('PRAGMA foreign_keys = ON');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    await db.execAsync('PRAGMA foreign_keys = ON');
    throw error;
  }
}


/**
 * Adds rationale metadata columns to the cards table for admin-created library cards.
 * All columns are nullable since user cards don't have rationale and admin cards
 * may be in-progress.
 * Uses PRAGMA table_info check for idempotency.
 */
export async function runRationaleMigration(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(cards)`
  );
  const hasRationaleApproach = columns.some(
    (col) => col.name === 'rationale_approach'
  );

  if (!hasRationaleApproach) {
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_approach TEXT`
    );
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_in_a_nutshell TEXT`
    );
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_how_it_works TEXT`
    );
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_evidence_level TEXT
         CHECK(rationale_evidence_level IS NULL OR rationale_evidence_level IN (
           'strong', 'moderate', 'emerging', 'not_specifically_studied'
         ))`
    );
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_research_summary TEXT`
    );
    await db.execAsync(
      `ALTER TABLE cards ADD COLUMN rationale_learn_more_links TEXT`
    );
  }
}


/**
 * Creates the guided_checkin_records table and adds the checkin_id column
 * to emotion_sessions. Uses CREATE TABLE IF NOT EXISTS and PRAGMA table_info
 * checks for idempotency.
 */
export async function runGuidedCheckinMigration(db: SQLiteDatabase): Promise<void> {
  // Task 4.1: Create guided_checkin_records table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS guided_checkin_records (
      id TEXT PRIMARY KEY,
      body_energy TEXT NOT NULL,
      pleasantness TEXT NOT NULL,
      thought_pattern TEXT NOT NULL,
      context TEXT NOT NULL,
      derived_feeling TEXT NOT NULL,
      was_changed INTEGER NOT NULL DEFAULT 0,
      final_emotion TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guided_checkin_recorded_at
      ON guided_checkin_records(recorded_at);
  `);

  // Task 4.2: Add checkin_id column to emotion_sessions
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(emotion_sessions)`
  );
  const hasCheckinId = columns.some((col) => col.name === 'checkin_id');

  if (!hasCheckinId) {
    await db.execAsync(
      `ALTER TABLE emotion_sessions ADD COLUMN checkin_id TEXT`
    );
  }
}

/**
 * Rebuilds the emotion_tags table with an expanded CHECK constraint
 * to include all 12 emotion values.
 * Uses savepoint test INSERT pattern for idempotency.
 */
async function runEmotionTagsExpansionMigration(db: SQLiteDatabase): Promise<void> {
  // Test if the new emotions are already allowed by attempting an insert in a savepoint
  try {
    await db.execAsync('SAVEPOINT emotion_tags_check_test');
    await db.runAsync(
      `INSERT INTO emotion_tags (id, card_id, emotion)
       VALUES ('__emotion_tags_test__', 'session-launcher', 'lonely')`,
      []
    );
    // If we get here, the constraint already allows the new emotions
    await db.execAsync('ROLLBACK TO emotion_tags_check_test');
    await db.execAsync('RELEASE emotion_tags_check_test');
    return; // No migration needed
  } catch {
    // The INSERT failed — constraint doesn't include new emotions, need to rebuild
    try {
      await db.execAsync('ROLLBACK TO emotion_tags_check_test');
      await db.execAsync('RELEASE emotion_tags_check_test');
    } catch {
      // Savepoint may already be rolled back
    }
  }

  // Rebuild the emotion_tags table with the expanded CHECK constraint
  await db.execAsync('PRAGMA foreign_keys = OFF');
  await db.execAsync('BEGIN TRANSACTION');
  try {
    // 1. Create new table with expanded CHECK
    await db.execAsync(`
      CREATE TABLE emotion_tags_new (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        emotion TEXT NOT NULL CHECK(emotion IN (
          'stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb',
          'lonely', 'ashamed', 'guilty', 'hopeless', 'calm', 'curious'
        )),
        UNIQUE(card_id, emotion)
      )
    `);

    // 2. Copy all data from old table
    await db.execAsync(
      `INSERT INTO emotion_tags_new SELECT * FROM emotion_tags`
    );

    // 3. Drop old table
    await db.execAsync('DROP TABLE emotion_tags');

    // 4. Rename new table
    await db.execAsync('ALTER TABLE emotion_tags_new RENAME TO emotion_tags');

    // 5. Recreate indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_emotion_tags_card ON emotion_tags(card_id);
      CREATE INDEX IF NOT EXISTS idx_emotion_tags_emotion ON emotion_tags(emotion);
    `);

    await db.execAsync('COMMIT');
    await db.execAsync('PRAGMA foreign_keys = ON');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    await db.execAsync('PRAGMA foreign_keys = ON');
    throw error;
  }
}

/**
 * Rebuilds the emotion_sessions table with an expanded CHECK constraint
 * on selected_emotion to include all 12 emotion values.
 * Uses savepoint test INSERT pattern for idempotency.
 * Must run AFTER runGuidedCheckinMigration so checkin_id column exists.
 */
async function runEmotionSessionsExpansionMigration(db: SQLiteDatabase): Promise<void> {
  // Test if the new emotions are already allowed by attempting an insert in a savepoint
  try {
    await db.execAsync('SAVEPOINT emotion_sessions_check_test');
    await db.runAsync(
      `INSERT INTO emotion_sessions (id, selected_emotion, selected_contexts, selected_time, tool_card_ids, started_at)
       VALUES ('__emotion_sessions_test__', 'lonely', '[]', NULL, '[]', datetime('now'))`,
      []
    );
    // If we get here, the constraint already allows the new emotions
    await db.execAsync('ROLLBACK TO emotion_sessions_check_test');
    await db.execAsync('RELEASE emotion_sessions_check_test');
    return; // No migration needed
  } catch {
    // The INSERT failed — constraint doesn't include new emotions, need to rebuild
    try {
      await db.execAsync('ROLLBACK TO emotion_sessions_check_test');
      await db.execAsync('RELEASE emotion_sessions_check_test');
    } catch {
      // Savepoint may already be rolled back
    }
  }

  // Rebuild the emotion_sessions table with the expanded CHECK constraint
  await db.execAsync('PRAGMA foreign_keys = OFF');
  await db.execAsync('BEGIN TRANSACTION');
  try {
    // 1. Create new table with expanded CHECK and checkin_id column
    await db.execAsync(`
      CREATE TABLE emotion_sessions_new (
        id TEXT PRIMARY KEY,
        selected_emotion TEXT NOT NULL CHECK(selected_emotion IN (
          'stressed', 'overwhelmed', 'anxious', 'sad', 'angry', 'numb',
          'lonely', 'ashamed', 'guilty', 'hopeless', 'calm', 'curious'
        )),
        selected_contexts TEXT NOT NULL DEFAULT '[]',
        selected_time TEXT,
        tool_card_ids TEXT NOT NULL DEFAULT '[]',
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        checkin_id TEXT
      )
    `);

    // 2. Copy all data from old table (including checkin_id added by prior migration)
    await db.execAsync(
      `INSERT INTO emotion_sessions_new
        SELECT id, selected_emotion, selected_contexts, selected_time,
               tool_card_ids, started_at, ended_at, checkin_id
        FROM emotion_sessions`
    );

    // 3. Drop old table
    await db.execAsync('DROP TABLE emotion_sessions');

    // 4. Rename new table
    await db.execAsync('ALTER TABLE emotion_sessions_new RENAME TO emotion_sessions');

    // 5. Recreate indexes
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_emotion_sessions_active ON emotion_sessions(ended_at)
        WHERE ended_at IS NULL;
    `);

    await db.execAsync('COMMIT');
    await db.execAsync('PRAGMA foreign_keys = ON');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    await db.execAsync('PRAGMA foreign_keys = ON');
    throw error;
  }
}


/**
 * Adds Canada 988 Suicide Crisis Helpline to crisis_resources and
 * reorders existing resources (Canada first, then US, then INTL).
 * Uses INSERT OR IGNORE for idempotency.
 */
async function runCrisisResourcesCanadaMigration(db: SQLiteDatabase): Promise<void> {
  // Insert Canada resource if it doesn't exist
  await db.runAsync(
    `INSERT OR IGNORE INTO crisis_resources (id, country_code, name, phone, url, is_default, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['ca-988-lifeline', 'CA', '988 Suicide Crisis Helpline', '988', 'https://988.ca', 1, 1]
  );

  // Update IASP URL to point directly to the helpline finder
  await db.runAsync(
    `UPDATE crisis_resources SET url = 'https://findahelpline.com/i/iasp' WHERE id = 'iasp-directory'`
  );

  // Reorder: Canada = 1, US = 2, INTL = 3
  await db.runAsync(
    `UPDATE crisis_resources SET display_order = 2 WHERE id = 'us-988-lifeline'`
  );
  await db.runAsync(
    `UPDATE crisis_resources SET display_order = 3 WHERE id = 'iasp-directory'`
  );
}
