/**
 * AdminStore — Zustand store managing ephemeral admin mode state.
 *
 * Admin mode is entirely in-memory with no persistence. It resets when
 * the user navigates away (screen blur) and defaults to inactive on app launch.
 *
 * Validates: Requirements 1.1, 1.4, 1.5
 */

import { create } from 'zustand';

export interface AdminStore {
  isAdminMode: boolean;
  activateAdmin: () => void;
  deactivateAdmin: () => void;
  toggleAdmin: () => void;
  resetAdmin: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAdminMode: false,

  activateAdmin() {
    set({ isAdminMode: true });
  },

  deactivateAdmin() {
    set({ isAdminMode: false });
  },

  toggleAdmin() {
    set((state) => ({ isAdminMode: !state.isAdminMode }));
  },

  resetAdmin() {
    set({ isAdminMode: false });
  },
}));
