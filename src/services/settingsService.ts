import { getDatabase } from '@/data/database';
import { AppError, ErrorCode } from '@/types/errors';
import type { StartMode } from '@/types/index';

const VALID_START_MODES: StartMode[] = ['wallet', 'emotion', 'last_used'];
const VALID_LAST_USED_MODES: Array<'wallet' | 'emotion'> = ['wallet', 'emotion'];
const DEFAULT_START_MODE: StartMode = 'wallet';
const DEFAULT_LAST_USED_MODE: 'wallet' | 'emotion' = 'wallet';

const SETTINGS_KEYS = {
  START_MODE: 'start_mode',
  LAST_USED_MODE: 'last_used_mode',
} as const;

/**
 * Reads the start_mode setting from the database.
 * Defaults to 'wallet' if the key is missing or the value is invalid.
 * Self-heals by persisting 'wallet' when an invalid value is found.
 */
export async function getStartMode(): Promise<StartMode> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEYS.START_MODE]
  );

  if (!row || !VALID_START_MODES.includes(row.value as StartMode)) {
    // Self-healing: persist the default value
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [SETTINGS_KEYS.START_MODE, DEFAULT_START_MODE]
    );
    return DEFAULT_START_MODE;
  }

  return row.value as StartMode;
}

/**
 * Persists the start_mode setting to the database.
 * Validates that the provided mode is a valid StartMode value.
 * Throws AppError if the value is invalid or if the write fails.
 */
export async function setStartMode(mode: StartMode): Promise<void> {
  if (!VALID_START_MODES.includes(mode)) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Invalid start mode: "${mode}". Must be one of: ${VALID_START_MODES.join(', ')}`
    );
  }

  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [SETTINGS_KEYS.START_MODE, mode]
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to persist start mode setting',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Reads the last_used_mode setting from the database.
 * Defaults to 'wallet' if the key is missing or the value is invalid.
 */
export async function getLastUsedMode(): Promise<'wallet' | 'emotion'> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEYS.LAST_USED_MODE]
  );

  if (!row || !VALID_LAST_USED_MODES.includes(row.value as 'wallet' | 'emotion')) {
    return DEFAULT_LAST_USED_MODE;
  }

  return row.value as 'wallet' | 'emotion';
}

/**
 * Persists the last_used_mode setting to the database.
 */
export async function setLastUsedMode(mode: 'wallet' | 'emotion'): Promise<void> {
  if (!VALID_LAST_USED_MODES.includes(mode)) {
    throw AppError.validation(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      `Invalid last used mode: "${mode}". Must be one of: ${VALID_LAST_USED_MODES.join(', ')}`
    );
  }

  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [SETTINGS_KEYS.LAST_USED_MODE, mode]
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.persistence(
      ErrorCode.PERSISTENCE_WRITE_FAILED,
      'Failed to persist last used mode setting',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Returns true if the 'start_mode' key exists in the settings table with a valid value.
 * Used by onboarding to decide whether to show the mode choice screen.
 */
export async function hasStartMode(): Promise<boolean> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTINGS_KEYS.START_MODE]
  );

  return !!row && VALID_START_MODES.includes(row.value as StartMode);
}

/**
 * Reads the "include archived tools in insights" setting.
 * Defaults to false (archived tools excluded) if not set.
 */
export async function getIncludeArchivedTools(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['insights_include_archived_tools']
    );
    return row?.value === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the "include archived tools in insights" setting.
 */
export async function setIncludeArchivedTools(include: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['insights_include_archived_tools', include ? 'true' : 'false']
  );
}

/**
 * Reads the outcome prompt enabled setting.
 * Defaults to true (prompts enabled) if not set.
 */
export async function getOutcomePromptEnabled(): Promise<boolean> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['outcome_prompt_enabled']
    );
    if (!row) return true; // Default: enabled
    return row.value !== 'false';
  } catch {
    return true;
  }
}

/**
 * Persists the outcome prompt enabled setting.
 */
export async function setOutcomePromptEnabled(enabled: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['outcome_prompt_enabled', enabled ? 'true' : 'false']
  );
}
