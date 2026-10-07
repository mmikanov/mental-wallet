/**
 * Install Channel Storage for Anonymous Analytics (passive attribution).
 *
 * Stores the marketing channel an install came from (derived from the Play
 * Install Referrer on Android) write-once in the local SQLite `settings` table,
 * mirroring the first_open_date discipline in `analyticsRetention.ts`. The
 * channel is a non-personal label on anonymous analytics — it never touches any
 * PII store. iOS has no device-side referrer, so this is effectively a no-op
 * there (Requirement 5).
 *
 * Requirements: 4.1, 5.1, 8.1, 8.2
 */

import { getDatabase } from '@/data/database';
import {
  readInstallReferrer,
  parseChannelFromReferrer,
} from '@/services/installReferrer';

const SETTINGS_KEY_INSTALL_CHANNEL = 'install_channel';

/**
 * Returns the stored install channel, or null when none has been set.
 * Never throws — analytics must never crash the app.
 */
export async function getStoredChannel(): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [SETTINGS_KEY_INSTALL_CHANNEL]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Stores the install channel write-once. Blank/empty input is ignored, and an
 * already-stored value is never overwritten (INSERT OR IGNORE). Never throws.
 */
export async function setChannelOnce(channel: string): Promise<void> {
  const trimmed = (channel ?? '').trim();
  if (trimmed.length === 0) {
    return;
  }
  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [SETTINGS_KEY_INSTALL_CHANNEL, trimmed]
    );
  } catch {
    // Swallow — storage failure must never crash the app.
  }
}

/**
 * One-time Android install-channel resolution, called from app startup.
 *
 * If a channel is already stored, returns it without touching the native read.
 * Otherwise reads the install referrer (Android-only; null elsewhere), parses
 * `utm_source`, and stores it write-once. Returns the resolved channel, or null
 * when none is available. Never throws.
 */
export async function resolveInstallChannelOnce(): Promise<string | null> {
  try {
    const existing = await getStoredChannel();
    if (existing) {
      return existing;
    }

    const referrer = await readInstallReferrer();
    const channel = parseChannelFromReferrer(referrer);
    if (channel) {
      await setChannelOnce(channel);
      return channel;
    }
    return null;
  } catch {
    return null;
  }
}
