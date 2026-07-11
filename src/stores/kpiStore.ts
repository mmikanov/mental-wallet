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
    } catch (error) {
      Alert.alert('Error', 'Failed to create fake record');
    }
  },

  async resetAllRecords() {
    try {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM kpi_records');
      set({ lastCheckInDate: null, lastCheckInLoaded: true });
    } catch (error) {
      Alert.alert('Error', 'Failed to reset KPI records');
    }
  },
}));
