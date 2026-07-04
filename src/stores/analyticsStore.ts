/**
 * Analytics Store — Zustand store managing analytics initialization, opt-in state,
 * and data reset flow.
 *
 * Coordinates identity resolution, session management, event logging,
 * and batch transmission lifecycle.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.3, 6.4, 6.7, 6.8, 9.1, 9.2, 9.3
 */

import { create } from 'zustand';
import type { AnalyticsStoreState } from '@/types/analytics';
import { getDatabase } from '@/data/database';
import {
  resolveAnonymousUserId,
  resetAnonymousUserId,
} from '@/services/analyticsIdentity';
import {
  setLoggerIdentity,
  setLoggerOptIn,
  clearLoggerState,
  logEvent,
} from '@/services/analyticsEventLogger';
import { startNewSession, clearSession } from '@/services/analyticsSession';
import {
  resetSendingToPending,
  deleteBehavioralPendingEvents,
  deleteAllEvents,
} from '@/data/analyticsEventQueue';
import {
  startTransmitter,
  stopTransmitter,
} from '@/services/analyticsBatchTransmitter';
import { getDaysSinceInstall } from '@/services/analyticsRetention';
import { getTransmitterConfig, registerFlushIntervalChangeHandler } from '@/config/analytics';
import * as SecureStore from 'expo-secure-store';

// --- Constants ---

const SETTINGS_KEY_OPT_IN = 'analytics_opt_in';
const SETTINGS_KEY_FIRST_OPEN = 'first_open_date';
const SECURE_STORE_KEY_CONSENT = 'identity_link_consent';

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
  optIn: true,
  isIdentityReady: false,
  anonymousUserId: null,

  async initialize() {
    // 1. Resolve identity
    const userId = await resolveAnonymousUserId();
    set({ anonymousUserId: userId, isIdentityReady: true });

    // 2. Set logger identity
    setLoggerIdentity(userId);

    // 3. Start a new session
    startNewSession();

    // 4. Load opt-in preference from settings table (default 'true')
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ?`,
      [SETTINGS_KEY_OPT_IN]
    );
    const optIn = row ? row.value !== 'false' : true;
    set({ optIn });

    // 5. Set logger opt-in
    setLoggerOptIn(optIn);

    // 6. Reset any sending events to pending (crash recovery)
    await resetSendingToPending();

    // 7. Start the transmitter
    startTransmitter(getTransmitterConfig());

    // 8. Register handler to restart transmitter when flush interval changes (dev setting)
    registerFlushIntervalChangeHandler(() => {
      stopTransmitter();
      startTransmitter(getTransmitterConfig());
    });

    // 8. Log app_opened with days_since_install (retention metric)
    const daysSinceInstall = await getDaysSinceInstall();
    await logEvent('app_opened', { days_since_install: daysSinceInstall });
  },

  async setOptIn(value: boolean) {
    // 1. Update state
    set({ optIn: value });

    // 2. Persist to settings table
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [SETTINGS_KEY_OPT_IN, value ? 'true' : 'false']
    );

    // 3. Set logger opt-in
    setLoggerOptIn(value);

    // 4. Handle opt-out: delete behavioral pending events and stop transmitter
    if (!value) {
      await deleteBehavioralPendingEvents();
      stopTransmitter();
    }

    // 5. Handle opt-in: resume transmitter
    if (value) {
      startTransmitter(getTransmitterConfig());
    }
  },

  async resetData() {
    // 1. Stop transmitter
    stopTransmitter();

    // 2. Reset anonymous user ID (generates new one)
    const newUserId = await resetAnonymousUserId();

    // 3. Delete all events from queue
    await deleteAllEvents();

    // 4. Delete first_open_date from settings table
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM settings WHERE key = ?`, [
      SETTINGS_KEY_FIRST_OPEN,
    ]);

    // 5. Delete identity_link_consent from SecureStore
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY_CONSENT);
    } catch {
      // Proceed even if deletion fails
    }

    // 6. Clear session
    clearSession();

    // 7. Clear logger state
    clearLoggerState();

    // 8. Update store state with new userId
    set({ anonymousUserId: newUserId, isIdentityReady: true });

    // 9. Set logger identity with new ID
    setLoggerIdentity(newUserId);

    // 10. Start a new session
    startNewSession();

    // 11. Set logger opt-in (preserve current optIn)
    const { optIn } = get();
    setLoggerOptIn(optIn);

    // 12. Start transmitter again
    startTransmitter(getTransmitterConfig());

    // 13. Log app_opened with days_since_install: 0
    await logEvent('app_opened', { days_since_install: 0 });
  },
}));
