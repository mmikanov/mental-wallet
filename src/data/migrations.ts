import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs all database migrations. Creates tables and indexes
 * if they don't already exist (idempotent).
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  await runEmotionMigration(db);
  await runKpiMigration(db);
  await runAnalyticsMigration(db);
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
  icon_type TEXT NOT NULL CHECK(icon_type IN ('library', 'emoji', 'custom_image')),
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
