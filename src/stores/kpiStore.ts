/**
 * KpiStore — Zustand store managing the user's Personal KPI state.
 *
 * Provides reactive access to the current KPI label and actions
 * for loading, setting, and changing the Personal KPI.
 *
 * Validates: Requirements 1.3, 4.3
 */

import { create } from 'zustand';
import { createKpiService } from '@/services/kpiService';
import type { KpiService } from '@/services/kpiService';

export interface KpiState {
  personalKpi: string | null;
  isLoading: boolean;

  // Actions
  loadKpi: () => Promise<void>;
  setKpi: (label: string) => Promise<void>;
  changeKpi: (newLabel: string) => Promise<void>;
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
}));
