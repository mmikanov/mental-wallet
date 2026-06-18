/**
 * Unit tests for CompletionStore.
 * Tests input preservation across cards (Req 3.5), submission flow (Req 3.6, 5.5),
 * and input clearing behavior.
 */

// Mock the completionService module to avoid transitive expo-sqlite imports
jest.mock('@/services/completionService', () => ({
  createCompletionService: jest.fn(),
}));

import { createCompletionStore } from '../completionStore';
import type { CompletionService } from '@/types/services';
import type { Control, Completion } from '@/types/index';
import type { StoreApi } from 'zustand';
import type { CompletionStore } from '../completionStore';

// --- Helpers ---

function createMockCompletionService(
  overrides: Partial<CompletionService> = {}
): CompletionService {
  return {
    record: jest.fn().mockResolvedValue({
      id: 'completion-1',
      cardId: 'card-1',
      completedAt: new Date().toISOString(),
      values: [],
    } satisfies Completion),
    getByCard: jest.fn().mockResolvedValue([]),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
    getStreakInfo: jest.fn().mockResolvedValue({
      totalUses: 0,
      currentStreak: 0,
      lastUsedAt: null,
    }),
    updateStreak: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createTestControls(cardId: string): Control[] {
  return [
    {
      id: 'ctrl-1',
      cardId,
      type: 'text_input',
      position: 0,
      config: { label: 'Thought', placeholder: '', maxLength: 200 },
      isRequired: true,
    },
    {
      id: 'ctrl-2',
      cardId,
      type: 'mood_slider',
      position: 1,
      config: { label: 'Mood', minLabel: 'Low', maxLabel: 'High' },
      isRequired: true,
    },
  ];
}

describe('CompletionStore', () => {
  let mockService: CompletionService;
  let store: StoreApi<CompletionStore>;

  beforeEach(() => {
    mockService = createMockCompletionService();
    store = createCompletionStore(mockService);
  });

  describe('setControlValue', () => {
    it('should store a value for a specific card and control', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Hello');

      expect(store.getState().currentInputValues).toEqual({
        'card-1': { 'ctrl-1': 'Hello' },
      });
    });

    it('should preserve values for other controls in the same card', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Hello');
      store.getState().setControlValue('card-1', 'ctrl-2', '7');

      expect(store.getState().currentInputValues).toEqual({
        'card-1': { 'ctrl-1': 'Hello', 'ctrl-2': '7' },
      });
    });

    it('should preserve inputs for other cards when setting a value (Req 3.5)', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Card 1 text');
      store.getState().setControlValue('card-2', 'ctrl-a', 'Card 2 text');

      expect(store.getState().currentInputValues).toEqual({
        'card-1': { 'ctrl-1': 'Card 1 text' },
        'card-2': { 'ctrl-a': 'Card 2 text' },
      });
    });

    it('should overwrite the previous value for the same control', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'First');
      store.getState().setControlValue('card-1', 'ctrl-1', 'Updated');

      expect(store.getState().currentInputValues['card-1']['ctrl-1']).toBe('Updated');
    });

    it('should allow setting an empty string value', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Something');
      store.getState().setControlValue('card-1', 'ctrl-1', '');

      expect(store.getState().currentInputValues['card-1']['ctrl-1']).toBe('');
    });
  });

  describe('submitCompletion', () => {
    it('should call completionService.record with correct control values', async () => {
      const controls = createTestControls('card-1');
      store.getState().setControlValue('card-1', 'ctrl-1', 'My thought');
      store.getState().setControlValue('card-1', 'ctrl-2', '8');

      await store.getState().submitCompletion('card-1', controls);

      expect(mockService.record).toHaveBeenCalledWith('card-1', [
        { controlId: 'ctrl-1', controlType: 'text_input', value: 'My thought' },
        { controlId: 'ctrl-2', controlType: 'mood_slider', value: '8' },
      ]);
    });

    it('should clear inputs for the card on success', async () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Text');
      store.getState().setControlValue('card-2', 'ctrl-a', 'Other card');

      const controls = createTestControls('card-1');
      await store.getState().submitCompletion('card-1', controls);

      // card-1 inputs cleared
      expect(store.getState().currentInputValues['card-1']).toBeUndefined();
      // card-2 inputs preserved
      expect(store.getState().currentInputValues['card-2']).toEqual({ 'ctrl-a': 'Other card' });
    });

    it('should use empty string for controls without stored values', async () => {
      const controls = createTestControls('card-1');
      // Only set one control value, leave the other empty
      store.getState().setControlValue('card-1', 'ctrl-1', 'Only this one');

      await store.getState().submitCompletion('card-1', controls);

      expect(mockService.record).toHaveBeenCalledWith('card-1', [
        { controlId: 'ctrl-1', controlType: 'text_input', value: 'Only this one' },
        { controlId: 'ctrl-2', controlType: 'mood_slider', value: '' },
      ]);
    });

    it('should handle submission with no stored values (all empty)', async () => {
      const controls = createTestControls('card-1');

      await store.getState().submitCompletion('card-1', controls);

      expect(mockService.record).toHaveBeenCalledWith('card-1', [
        { controlId: 'ctrl-1', controlType: 'text_input', value: '' },
        { controlId: 'ctrl-2', controlType: 'mood_slider', value: '' },
      ]);
    });

    it('should NOT clear inputs on error (preserve for retry)', async () => {
      const error = new Error('Database write failed');
      (mockService.record as jest.Mock).mockRejectedValueOnce(error);

      store.getState().setControlValue('card-1', 'ctrl-1', 'Important text');

      const controls = createTestControls('card-1');

      await expect(
        store.getState().submitCompletion('card-1', controls)
      ).rejects.toThrow('Database write failed');

      // Inputs should still be there
      expect(store.getState().currentInputValues['card-1']).toEqual({
        'ctrl-1': 'Important text',
      });
    });

    it('should propagate errors from the completion service', async () => {
      const error = new Error('Service unavailable');
      (mockService.record as jest.Mock).mockRejectedValueOnce(error);

      const controls = createTestControls('card-1');

      await expect(
        store.getState().submitCompletion('card-1', controls)
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('clearInputs', () => {
    it('should remove all input values for a specific card', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Text');
      store.getState().setControlValue('card-1', 'ctrl-2', '5');

      store.getState().clearInputs('card-1');

      expect(store.getState().currentInputValues['card-1']).toBeUndefined();
    });

    it('should preserve inputs for other cards', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Card 1');
      store.getState().setControlValue('card-2', 'ctrl-a', 'Card 2');

      store.getState().clearInputs('card-1');

      expect(store.getState().currentInputValues['card-1']).toBeUndefined();
      expect(store.getState().currentInputValues['card-2']).toEqual({ 'ctrl-a': 'Card 2' });
    });

    it('should be a no-op when card has no stored inputs', () => {
      store.getState().setControlValue('card-2', 'ctrl-a', 'Card 2');

      store.getState().clearInputs('card-1');

      expect(store.getState().currentInputValues).toEqual({
        'card-2': { 'ctrl-a': 'Card 2' },
      });
    });
  });

  describe('clearAllInputs', () => {
    it('should remove all input values for all cards', () => {
      store.getState().setControlValue('card-1', 'ctrl-1', 'Text 1');
      store.getState().setControlValue('card-2', 'ctrl-a', 'Text 2');
      store.getState().setControlValue('card-3', 'ctrl-x', 'Text 3');

      store.getState().clearAllInputs();

      expect(store.getState().currentInputValues).toEqual({});
    });

    it('should be a no-op when no inputs exist', () => {
      store.getState().clearAllInputs();
      expect(store.getState().currentInputValues).toEqual({});
    });
  });

  describe('input preservation across card switching (Req 3.5)', () => {
    it('should maintain inputs for multiple cards simultaneously', () => {
      // Simulate user interacting with card-1
      store.getState().setControlValue('card-1', 'ctrl-1', 'Gratitude entry');
      store.getState().setControlValue('card-1', 'ctrl-2', '8');

      // User switches to card-2 (inputs for card-1 should be preserved)
      store.getState().setControlValue('card-2', 'ctrl-a', 'Breathing exercise done');

      // User switches back to card-1 — values should still be there
      const card1Values = store.getState().currentInputValues['card-1'];
      expect(card1Values).toEqual({ 'ctrl-1': 'Gratitude entry', 'ctrl-2': '8' });

      // card-2 values should also be there
      const card2Values = store.getState().currentInputValues['card-2'];
      expect(card2Values).toEqual({ 'ctrl-a': 'Breathing exercise done' });
    });

    it('should only clear the completed card inputs, not others', async () => {
      // Set up inputs for two cards
      store.getState().setControlValue('card-1', 'ctrl-1', 'Done');
      store.getState().setControlValue('card-2', 'ctrl-a', 'In progress');

      // Complete card-1
      const controls = createTestControls('card-1');
      await store.getState().submitCompletion('card-1', controls);

      // card-1 cleared, card-2 preserved
      expect(store.getState().currentInputValues['card-1']).toBeUndefined();
      expect(store.getState().currentInputValues['card-2']).toEqual({ 'ctrl-a': 'In progress' });
    });
  });
});
