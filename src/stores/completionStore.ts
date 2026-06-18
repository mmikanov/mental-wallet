/**
 * CompletionStore — Zustand store for managing card completion input state.
 *
 * Key behaviors:
 * - Preserves unsaved inputs per-card so switching between cards doesn't lose state (Req 3.5)
 * - Submits completions via CompletionService.record and clears inputs on success (Req 3.6, 5.5)
 * - On error, inputs are preserved so the user can retry
 *
 * Validates: Requirements 3.5, 3.6, 5.5
 */

import { create } from 'zustand';
import { createCompletionService } from '@/services/completionService';
import type { Control, ControlValue } from '@/types/index';
import type { CompletionService } from '@/types/services';

export interface CompletionStore {
  /** Maps cardId -> { controlId -> value } */
  currentInputValues: Record<string, Record<string, string>>;

  /** Update a single control's value for a specific card. */
  setControlValue: (cardId: string, controlId: string, value: string) => void;

  /** Submit a completion for a card: records via service and clears inputs on success. */
  submitCompletion: (cardId: string, controls: Control[]) => Promise<void>;

  /** Clear all inputs for a specific card. */
  clearInputs: (cardId: string) => void;

  /** Clear all stored inputs across all cards. */
  clearAllInputs: () => void;
}

export function createCompletionStore(
  completionService: CompletionService = createCompletionService()
) {
  return create<CompletionStore>((set, get) => ({
    currentInputValues: {},

    setControlValue: (cardId: string, controlId: string, value: string) => {
      set((state) => ({
        currentInputValues: {
          ...state.currentInputValues,
          [cardId]: {
            ...(state.currentInputValues[cardId] ?? {}),
            [controlId]: value,
          },
        },
      }));
    },

    submitCompletion: async (cardId: string, controls: Control[]) => {
      const { currentInputValues } = get();
      const cardValues = currentInputValues[cardId] ?? {};

      // Build ControlValue array from controls list and stored values
      const controlValues: Omit<ControlValue, 'id' | 'completionId'>[] = controls.map(
        (control) => ({
          controlId: control.id,
          controlType: control.type,
          value: cardValues[control.id] ?? '',
        })
      );

      // Call service — throws on error (inputs preserved)
      await completionService.record(cardId, controlValues);

      // On success, clear inputs for this card
      set((state) => {
        const { [cardId]: _, ...rest } = state.currentInputValues;
        return { currentInputValues: rest };
      });
    },

    clearInputs: (cardId: string) => {
      set((state) => {
        const { [cardId]: _, ...rest } = state.currentInputValues;
        return { currentInputValues: rest };
      });
    },

    clearAllInputs: () => {
      set({ currentInputValues: {} });
    },
  }));
}

/** Default store instance for the app. */
export const useCompletionStore = createCompletionStore();
