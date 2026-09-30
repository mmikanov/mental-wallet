import { diffControls } from '../librarySyncService';
import type { Control } from '../../types';
import type { CuratedControlDefinition } from '../../data/curatedLibrary';

/**
 * Example-based unit tests for `diffControls(current, target)` partitioning (Task 3.3).
 *
 * `diffControls` matches the card's current controls against the curated definition's
 * controls **by position** and partitions them into:
 *  - `toUpdate`  — a position present in both; the entry KEEPS the current control's id
 *                  (so historical `control_values` references stay valid) and carries the
 *                  target curated def in `.target`.
 *  - `toInsert`  — a target position with no matching current control (the CuratedControlDefinition).
 *  - `toDeleteIds` — a current position with no matching target (the current control's id).
 *
 * `diffControls` is a pure function with no dependency on `CURATED_LIBRARY`, so these
 * tests build the inputs directly and need no mocking.
 *
 * Validates: Requirements 3.1, 3.3
 */

// --- Fixture builders ------------------------------------------------------

function makeControl(overrides: Partial<Control> & { position: number }): Control {
  return {
    id: `ctrl-${overrides.position}`,
    cardId: 'card-1',
    type: 'text_input',
    config: { label: 'note', maxLength: 200 },
    isRequired: false,
    ...overrides,
  };
}

function makeTarget(
  overrides: Partial<CuratedControlDefinition> & { position: number }
): CuratedControlDefinition {
  return {
    type: 'text_input',
    config: { label: 'note', maxLength: 200 },
    isRequired: false,
    ...overrides,
  };
}

describe('librarySyncService.diffControls - partitioning (Task 3.3)', () => {
  describe('toUpdate: positions present in both current and target', () => {
    it('routes matched positions to toUpdate, keeps the current control id, and carries the target def', () => {
      const current = [
        makeControl({ id: 'ctrl-a', position: 0 }),
        makeControl({ id: 'ctrl-b', position: 1 }),
      ];
      const target = [
        // Same positions, but different (e.g. text_area conversion) — still matched by position.
        makeTarget({ position: 0, type: 'text_area' }),
        makeTarget({ position: 1, isRequired: true }),
      ];

      const result = diffControls(current, target);

      expect(result.toInsert).toEqual([]);
      expect(result.toDeleteIds).toEqual([]);
      expect(result.toUpdate).toHaveLength(2);

      // Entry KEEPS the current control's id (Req 3.3 — preserve UUID / control_values).
      expect(result.toUpdate[0].id).toBe('ctrl-a');
      expect(result.toUpdate[0].id).toBe(current[0].id);
      expect(result.toUpdate[1].id).toBe('ctrl-b');
      expect(result.toUpdate[1].id).toBe(current[1].id);

      // The target curated def is carried in `.target`.
      expect(result.toUpdate[0].target).toBe(target[0]);
      expect(result.toUpdate[0].target.type).toBe('text_area');
      expect(result.toUpdate[1].target).toBe(target[1]);
      expect(result.toUpdate[1].target.isRequired).toBe(true);
    });
  });

  describe('toInsert: target positions with no matching current control', () => {
    it('routes unmatched target positions to toInsert as the CuratedControlDefinition', () => {
      const current = [makeControl({ id: 'ctrl-a', position: 0 })];
      const target = [
        makeTarget({ position: 0 }),
        makeTarget({ position: 1, type: 'mood_slider' }),
      ];

      const result = diffControls(current, target);

      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe('ctrl-a');
      expect(result.toDeleteIds).toEqual([]);

      expect(result.toInsert).toHaveLength(1);
      expect(result.toInsert[0]).toBe(target[1]);
      expect(result.toInsert[0].position).toBe(1);
      expect(result.toInsert[0].type).toBe('mood_slider');
    });
  });

  describe('toDeleteIds: current positions with no matching target', () => {
    it('routes unmatched current positions to toDeleteIds as the current control id', () => {
      const current = [
        makeControl({ id: 'ctrl-a', position: 0 }),
        makeControl({ id: 'ctrl-b', position: 1 }),
      ];
      const target = [makeTarget({ position: 0 })];

      const result = diffControls(current, target);

      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe('ctrl-a');
      expect(result.toInsert).toEqual([]);

      expect(result.toDeleteIds).toEqual(['ctrl-b']);
    });
  });

  describe('mixed case: all three partitions in one call', () => {
    it('splits into update (shared position), insert (new position), delete (removed position)', () => {
      const current = [
        makeControl({ id: 'ctrl-keep', position: 0 }),
        makeControl({ id: 'ctrl-remove', position: 1 }),
      ];
      const target = [
        makeTarget({ position: 0, type: 'text_area' }), // matches ctrl-keep → update
        makeTarget({ position: 2, type: 'choice_buttons' }), // new position → insert
      ];

      const result = diffControls(current, target);

      // Update — matched by position 0, keeps id, carries target.
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].id).toBe('ctrl-keep');
      expect(result.toUpdate[0].target).toBe(target[0]);

      // Insert — target position 2 has no current control.
      expect(result.toInsert).toHaveLength(1);
      expect(result.toInsert[0]).toBe(target[1]);
      expect(result.toInsert[0].position).toBe(2);

      // Delete — current position 1 has no target.
      expect(result.toDeleteIds).toEqual(['ctrl-remove']);
    });
  });

  describe('edge cases: empty inputs', () => {
    it('empty current → every target goes to toInsert', () => {
      const current: Control[] = [];
      const target = [
        makeTarget({ position: 0 }),
        makeTarget({ position: 1, type: 'mood_slider' }),
      ];

      const result = diffControls(current, target);

      expect(result.toUpdate).toEqual([]);
      expect(result.toDeleteIds).toEqual([]);
      expect(result.toInsert).toEqual(target);
    });

    it('empty target → every current control id goes to toDeleteIds', () => {
      const current = [
        makeControl({ id: 'ctrl-a', position: 0 }),
        makeControl({ id: 'ctrl-b', position: 1 }),
      ];
      const target: CuratedControlDefinition[] = [];

      const result = diffControls(current, target);

      expect(result.toUpdate).toEqual([]);
      expect(result.toInsert).toEqual([]);
      expect(result.toDeleteIds).toEqual(['ctrl-a', 'ctrl-b']);
    });

    it('both empty → all partitions empty', () => {
      const result = diffControls([], []);
      expect(result.toUpdate).toEqual([]);
      expect(result.toInsert).toEqual([]);
      expect(result.toDeleteIds).toEqual([]);
    });
  });
});
