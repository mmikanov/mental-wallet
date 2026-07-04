/**
 * Retention Metrics Helper for Anonymous Analytics.
 *
 * Ensures first_open_date is set and computes days_since_install
 * for app_opened events.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { getDatabase } from '@/data/database';

const SETTINGS_KEY_FIRST_OPEN = 'first_open_date';

/**
 * Returns the current UTC calendar date as YYYY-MM-DD.
 */
function getTodayUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes the number of UTC calendar days between two YYYY-MM-DD date strings.
 * Returns the difference (today - firstOpen) in whole days.
 */
function diffCalendarDays(firstOpen: string, today: string): number {
  const firstDate = new Date(`${firstOpen}T00:00:00Z`);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const diffMs = todayDate.getTime() - firstDate.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Ensures first_open_date is set and returns days_since_install.
 * Sets first_open_date on first call, never overwrites.
 * Clamps negative values to 0.
 */
export async function getDaysSinceInstall(): Promise<number> {
  const db = await getDatabase();

  // Try to set first_open_date if not already set (INSERT OR IGNORE ensures no overwrite)
  const today = getTodayUTC();
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    [SETTINGS_KEY_FIRST_OPEN, today]
  );

  // Read back the actual first_open_date (may be today or an earlier date)
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [SETTINGS_KEY_FIRST_OPEN]
  );

  const firstOpenDate = row?.value ?? today;
  const days = diffCalendarDays(firstOpenDate, today);

  // Clamp negative values to 0 (device clock set back)
  return Math.max(0, days);
}
