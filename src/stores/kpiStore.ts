/**
 * KpiStore — Zustand store managing the user's Personal KPI state.
 *
 * Provides reactive access to the current KPI label and actions
 * for loading, setting, and changing the Personal KPI.
 *
 * Validates: Requirements 1.3, 4.3, 5.1, 5.2
 */

import { Alert } from 'react-native';
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { createKpiService } from '@/services/kpiService';
import type { KpiService } from '@/services/kpiService';
import { getDatabase } from '@/data/database';
import { computeFakeRecordTimestamp } from '@/utils/kpiBadgeUtils';
import { useWalletStore } from '@/stores/walletStore';

export interface KpiState {
  personalKpi: string | null;
  isLoading: boolean;
  lastCheckInDate: string | null;
  lastCheckInLoaded: boolean;

  // Actions
  loadKpi: () => Promise<void>;
  setKpi: (label: string) => Promise<void>;
  changeKpi: (newLabel: string) => Promise<void>;
  loadLastCheckIn: () => Promise<void>;
  refreshDaysElapsed: () => Promise<void>;
  recordKpi: (value: number, note: string | null) => Promise<void>;

  // Admin actions
  createFakeRecord: (daysAgo: number) => Promise<void>;
  resetAllRecords: () => Promise<void>;
}

let kpiService: KpiService | null = null;

function getKpiService(): KpiService {
  if (!kpiService) {
    kpiService = createKpiService();
  }
  return kpiService;
}

/**
 * Allows injection of a mock KpiService for testing.
 */
export function setKpiService(service: KpiService): void {
  kpiService = service;
}

export const useKpiStore = create<KpiState>((set, get) => ({
  personalKpi: null,
  isLoading: false,
  lastCheckInDate: null,
  lastCheckInLoaded: false,

  async loadKpi() {
    set({ isLoading: true });
    try {
      const service = getKpiService();
      const label = await service.getPersonalKpi();
      set({ personalKpi: label, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  async setKpi(label: string) {
    const service = getKpiService();
    await service.setPersonalKpi(label);
    set({ personalKpi: label.trim() });
  },

  async changeKpi(newLabel: string) {
    const service = getKpiService();
    await service.changePersonalKpi(newLabel);
    set({ personalKpi: newLabel.trim() });
  },

  async loadLastCheckIn() {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ recorded_at: string }>(
        'SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1'
      );
      set({ lastCheckInDate: row?.recorded_at ?? null, lastCheckInLoaded: true });
    } catch {
      set({ lastCheckInDate: null, lastCheckInLoaded: true });
    }
  },

  async refreshDaysElapsed() {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ recorded_at: string }>(
        'SELECT recorded_at FROM kpi_records ORDER BY recorded_at DESC LIMIT 1'
      );
      set({ lastCheckInDate: row?.recorded_at ?? null, lastCheckInLoaded: true });
    } catch {
      set({ lastCheckInDate: null, lastCheckInLoaded: true });
    }
  },

  async recordKpi(value: number, note: string | null) {
    const service = getKpiService();
    const record = await service.recordKpi(value, note);
    set({ lastCheckInDate: record.recordedAt });
  },

  async createFakeRecord(daysAgo: number) {
    try {
      const db = await getDatabase();
      const recordedAt = computeFakeRecordTimestamp(daysAgo);
      const id = Crypto.randomUUID();
      await db.runAsync(
        'INSERT INTO kpi_records (id, value, note, kpi_label, recorded_at) VALUES (?, ?, ?, ?, ?)',
        [id, 5, 'Fake dev record', 'dev-test', recordedAt]
      );
      // Delete any records newer than the fake one so the badge shows the correct count
      await db.runAsync(
        'DELETE FROM kpi_records WHERE recorded_at > ? AND id != ?',
        [recordedAt, id]
      );
      // Re-query to get the actual latest record (should be the fake one now)
      await get().loadLastCheckIn();

      // --- Sync card stats and completions ---
      const kpiCard = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi'"
      );

      if (kpiCard) {
        // Delete control_values for completions newer than the fake timestamp
        await db.runAsync(
          'DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ? AND completed_at > ?)',
          [kpiCard.id, recordedAt]
        );
        // Delete completions newer than the fake timestamp
        await db.runAsync(
          'DELETE FROM completions WHERE card_id = ? AND completed_at > ?',
          [kpiCard.id, recordedAt]
        );
        // Create a matching completion record
        const completionId = Crypto.randomUUID();
        await db.runAsync(
          'INSERT INTO completions (id, card_id, completed_at) VALUES (?, ?, ?)',
          [completionId, kpiCard.id, recordedAt]
        );
        // Update card stats: recount total_uses, set streak to 1, update last_used_at
        await db.runAsync(
          'UPDATE cards SET last_used_at = ?, total_uses = (SELECT COUNT(*) FROM completions WHERE card_id = ?), current_streak = 1, updated_at = ? WHERE id = ?',
          [recordedAt, kpiCard.id, new Date().toISOString(), kpiCard.id]
        );
      } else {
        console.warn('KPI card not found in DB, skipping card sync');
      }

      // Refresh wallet UI
      try {
        await useWalletStore.getState().loadCards();
      } catch {
        console.warn('Failed to refresh wallet cards after createFakeRecord');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create fake record');
    }
  },

  async resetAllRecords() {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM kpi_records');

      // Find the KPI card
      const kpiCard = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM cards WHERE source_library_id = 'lib-personal-kpi'"
      );

      if (kpiCard) {
        // Delete control_values for this card's completions
        await db.runAsync(
          'DELETE FROM control_values WHERE completion_id IN (SELECT id FROM completions WHERE card_id = ?)',
          [kpiCard.id]
        );
        // Delete completions for this card
        await db.runAsync('DELETE FROM completions WHERE card_id = ?', [kpiCard.id]);
        // Reset card stats
        await db.runAsync(
          'UPDATE cards SET total_uses = 0, current_streak = 0, last_used_at = NULL, updated_at = ? WHERE id = ?',
          [new Date().toISOString(), kpiCard.id]
        );
      } else {
        console.warn('KPI card not found in DB, skipping card sync');
      }

      set({ lastCheckInDate: null, lastCheckInLoaded: true });

      try {
        await useWalletStore.getState().loadCards();
      } catch {
        console.warn('Failed to refresh wallet cards after reset');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reset KPI records');
    }
  },
}));
