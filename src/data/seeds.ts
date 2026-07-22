import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Seeds initial data on first launch. Uses the 'initialized' key
 * in the settings table to ensure seeding only runs once.
 */
export async function seedData(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'initialized'`
  );

  if (result) {
    // Already seeded — skip initial seed but ensure session launcher exists (upgrade path)
    await seedSessionLauncherCard(db);
    return;
  }

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Seed categories
    for (const category of SEED_CATEGORIES) {
      await db.runAsync(
        `INSERT OR IGNORE INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
        [category.id, category.name, category.colorHex, category.displayOrder]
      );
    }

    // Seed crisis resources
    for (const resource of SEED_CRISIS_RESOURCES) {
      await db.runAsync(
        `INSERT OR IGNORE INTO crisis_resources (id, country_code, name, phone, url, is_default, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          resource.id,
          resource.countryCode,
          resource.name,
          resource.phone,
          resource.url,
          resource.isDefault ? 1 : 0,
          resource.displayOrder,
        ]
      );
    }

    // Seed Session Launcher Card
    await insertSessionLauncherCard(db);

    // Mark as initialized
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('initialized', 'true')`
    );

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Seeds the Session Launcher Card if it doesn't already exist.
 * Called both during initial seed and on subsequent launches (upgrade path).
 * Idempotent — checks for existence before inserting.
 */
async function seedSessionLauncherCard(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM cards WHERE id = ?`,
    [SESSION_LAUNCHER_CARD.id]
  );

  if (existing) {
    return;
  }

  await db.execAsync('BEGIN TRANSACTION');
  try {
    await insertSessionLauncherCard(db);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Inserts the Session Launcher Card and its controls into the database.
 * Must be called within an active transaction.
 */
async function insertSessionLauncherCard(db: SQLiteDatabase): Promise<void> {
  const card = SESSION_LAUNCHER_CARD;

  await db.runAsync(
    `INSERT INTO cards (
      id, title, description, icon_type, icon_value,
      background_type, background_value, category_id, origin_badge,
      stack_position, allow_background_customization, card_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.id,
      card.title,
      card.description,
      card.iconType,
      card.iconValue,
      card.backgroundType,
      card.backgroundValue,
      card.categoryId,
      'library',
      card.stackPosition,
      card.allowBackgroundCustomization ? 1 : 0,
      card.cardType,
    ]
  );

  // Seed controls for the Session Launcher Card
  for (const control of SESSION_LAUNCHER_CONTROLS) {
    await db.runAsync(
      `INSERT INTO controls (id, card_id, type, position, config, is_required) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        control.id,
        card.id,
        control.type,
        control.position,
        JSON.stringify(control.config),
        control.isRequired ? 1 : 0,
      ]
    );
  }
}

/**
 * The 6 card categories defined in the requirements.
 */
export const SEED_CATEGORIES = [
  {
    id: 'grounding-calming',
    name: 'Grounding & Calming',
    colorHex: '#6B9EC4',
    displayOrder: 1,
  },
  {
    id: 'cognitive-reframing',
    name: 'Cognitive Reframing',
    colorHex: '#8B7EC8',
    displayOrder: 2,
  },
  {
    id: 'body-sensory',
    name: 'Body & Sensory',
    colorHex: '#E88D67',
    displayOrder: 3,
  },
  {
    id: 'daily-checkin-journaling',
    name: 'Daily Check-In & Journaling',
    colorHex: '#5BA88B',
    displayOrder: 4,
  },
  {
    id: 'self-compassion-reminders',
    name: 'Self-Compassion & Reminders',
    colorHex: '#D4A5C9',
    displayOrder: 5,
  },
  {
    id: 'lightweight-connection',
    name: 'Lightweight Connection',
    colorHex: '#E6C84C',
    displayOrder: 6,
  },
] as const;

/**
 * Crisis resources seeded on first launch.
 * Includes 988 Suicide & Crisis Lifeline (US default) and
 * IASP international crisis centre directory.
 */
export const SEED_CRISIS_RESOURCES = [
  {
    id: 'us-988-lifeline',
    countryCode: 'US',
    name: '988 Suicide & Crisis Lifeline',
    phone: '988',
    url: 'https://988lifeline.org',
    isDefault: true,
    displayOrder: 1,
  },
  {
    id: 'iasp-directory',
    countryCode: 'INTL',
    name: 'International Association for Suicide Prevention - Crisis Centre Directory',
    phone: null,
    url: 'https://www.iasp.info/resources/Crisis_Centres/',
    isDefault: true,
    displayOrder: 2,
  },
] as const;

/**
 * Session Launcher Card definition.
 * This special card initiates the emotion-first session flow.
 * Positioned below Starter_Cards (stack_position = 99) so the
 * Micro_Tutorial points at a coping tool rather than the session launcher.
 *
 * Validates: Requirements 4.1, 4.2, 5.6
 */
export const SESSION_LAUNCHER_CARD = {
  id: 'session-launcher',
  title: 'Start from how I feel',
  description: 'Tell the app what you\'re dealing with to get suggested tools.',
  iconType: 'emoji',
  iconValue: '🫶',
  backgroundType: 'color',
  backgroundValue: '#F0E6FF',
  categoryId: 'grounding-calming',
  cardType: 'session_launcher',
  allowBackgroundCustomization: true,
  stackPosition: 99,
} as const;

/**
 * Controls for the Session Launcher Card.
 * These define the emotion picker, context chips, and time chips
 * as card control data (same pattern as other cards), allowing
 * future updates via the data layer without code changes.
 *
 * Validates: Requirements 5.6, 8.5, 8.6, 8.7
 */
export const SESSION_LAUNCHER_CONTROLS = [
  {
    id: 'ctrl-session-launcher-0',
    type: 'choice_buttons' as const,
    position: 0,
    config: {
      label: 'How are you feeling right now?',
      options: [
        { text: 'Stressed', icon: '😰' },
        { text: 'Overwhelmed', icon: '🌊' },
        { text: 'Anxious', icon: '😟' },
        { text: 'Sad/low', icon: '😢' },
        { text: 'Angry', icon: '😤' },
        { text: 'Numb', icon: '😶' },
      ],
    },
    isRequired: true,
  },
  {
    id: 'ctrl-session-launcher-1',
    type: 'choice_buttons' as const,
    position: 1,
    config: {
      label: 'Where are you right now?',
      options: [
        { text: 'At work/school' },
        { text: 'With family' },
        { text: 'With friends/social' },
        { text: 'Alone at home' },
        { text: "I'm not sure" },
      ],
    },
    isRequired: false,
  },
  {
    id: 'ctrl-session-launcher-2',
    type: 'choice_buttons' as const,
    position: 2,
    config: {
      label: 'How much time do you have?',
      options: [
        { text: 'I have ~1–2 minutes' },
        { text: 'I have ~5–10 minutes' },
      ],
    },
    isRequired: false,
  },
] as const;
