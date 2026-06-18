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
    // Already seeded — skip
    return;
  }

  await db.execAsync('BEGIN TRANSACTION');

  try {
    // Seed categories
    for (const category of SEED_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories (id, name, color_hex, display_order) VALUES (?, ?, ?, ?)`,
        [category.id, category.name, category.colorHex, category.displayOrder]
      );
    }

    // Seed crisis resources
    for (const resource of SEED_CRISIS_RESOURCES) {
      await db.runAsync(
        `INSERT INTO crisis_resources (id, country_code, name, phone, url, is_default, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

    // Mark as initialized
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES ('initialized', 'true')`
    );

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
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
