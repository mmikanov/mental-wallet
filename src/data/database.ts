import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { runMigrations } from './migrations';
import { seedData } from './seeds';

const DB_NAME = 'mental_wallet.db';
const ENCRYPTION_KEY_ALIAS = 'mental_wallet_db_key';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Retrieves or generates the database encryption key.
 * On first launch, generates a 32-byte random key and stores it
 * in the platform keychain via expo-secure-store.
 */
async function getOrCreateEncryptionKey(): Promise<string> {
  const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
  if (existingKey) {
    return existingKey;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const hexKey = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, hexKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return hexKey;
}

/**
 * Opens the encrypted SQLite database, runs migrations, and seeds
 * initial data on first launch. Returns a singleton database instance.
 * Safe to call concurrently — only the first call triggers initialization.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  // Prevent concurrent initialization: reuse the in-flight promise
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = initializeDatabase();

  try {
    const db = await dbInitPromise;
    return db;
  } catch (error) {
    // Reset so next call can retry
    dbInitPromise = null;
    throw error;
  }
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const encryptionKey = await getOrCreateEncryptionKey();

  const db = await SQLite.openDatabaseAsync(DB_NAME, {
    useNewConnection: false,
  });

  // Enable SQLCipher encryption
  await db.execAsync(`PRAGMA key = '${encryptionKey}'`);

  // Enable WAL mode for better concurrent read performance
  await db.execAsync('PRAGMA journal_mode = WAL');

  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON');

  // Run table creation migrations
  await runMigrations(db);

  // Seed initial data on first launch
  await seedData(db);

  dbInstance = db;
  return db;
}

/**
 * Closes the database connection and clears the singleton.
 * Useful for testing and app shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    dbInitPromise = null;
  }
}
