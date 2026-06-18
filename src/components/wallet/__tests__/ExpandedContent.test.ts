/**
 * Unit tests for ExpandedContent's validateControls function.
 *
 * Validates: Requirements 3.6, 3.7, 5.3, 5.4, 5.5
 */

// Mock transitive dependencies that pull in native modules
jest.mock('@/services/completionService', () => ({
  createCompletionService: jest.fn(),
  resetStaleStreaks: jest.fn(),
}));
jest.mock('@/services/cardService', () => ({
  createCardService: jest.fn(),
}));

import { validateControls } from '../ExpandedContent';
import type { Control } from '@/types/index';

function makeControl(
  type: string,
  isRequired: boolean,
  id: string = `ctrl-${type}`
): Control {
  return {
    id,
    cardId: 'card-1',
    type: type as Control['type'],
    position: 0,
    config: { label: 'Test', body: 'test', fontSize: 'medium' } as any,
    isRequired,
  };
}

describe('validateControls', () => {
  describe('required text_input controls', () => {
    it('returns error when value is empty string', () => {
      const controls = [makeControl('text_input', true)];
      const errors = validateControls(controls, {});
      expect(errors['ctrl-text_input']).toBe('This field is required');
    });

    it('returns error when value is whitespace only', () => {
      const controls = [makeControl('text_input', true)];
      const errors = validateControls(controls, { 'ctrl-text_input': '   ' });
      expect(errors['ctrl-text_input']).toBe('This field is required');
    });

    it('passes when value has content', () => {
      const controls = [makeControl('text_input', true)];
      const errors = validateControls(controls, { 'ctrl-text_input': 'hello' });
      expect(errors).toEqual({});
    });
  });

  describe('required text_area controls', () => {
    it('returns error when empty', () => {
      const controls = [makeControl('text_area', true)];
      const errors = validateControls(controls, { 'ctrl-text_area': '' });
      expect(errors['ctrl-text_area']).toBe('This field is required');
    });

    it('passes when filled', () => {
      const controls = [makeControl('text_area', true)];
      const errors = validateControls(controls, { 'ctrl-text_area': 'My journal entry' });
      expect(errors).toEqual({});
    });
  });

  describe('required checkbox controls', () => {
    it('returns error when value is "false" (unchecked)', () => {
      const controls = [makeControl('checkbox', true)];
      const errors = validateControls(controls, { 'ctrl-checkbox': 'false' });
      expect(errors['ctrl-checkbox']).toBe('This field is required');
    });

    it('returns error when value is empty', () => {
      const controls = [makeControl('checkbox', true)];
      const errors = validateControls(controls, {});
      expect(errors['ctrl-checkbox']).toBe('This field is required');
    });

    it('passes when value is "true" (checked)', () => {
      const controls = [makeControl('checkbox', true)];
      const errors = validateControls(controls, { 'ctrl-checkbox': 'true' });
      expect(errors).toEqual({});
    });
  });

  describe('required mood_slider controls', () => {
    it('returns error when value is empty', () => {
      const controls = [makeControl('mood_slider', true)];
      const errors = validateControls(controls, {});
      expect(errors['ctrl-mood_slider']).toBe('This field is required');
    });

    it('returns error when value is "0" (not selected)', () => {
      const controls = [makeControl('mood_slider', true)];
      const errors = validateControls(controls, { 'ctrl-mood_slider': '0' });
      expect(errors['ctrl-mood_slider']).toBe('This field is required');
    });

    it('passes when value is valid selection (1-10)', () => {
      const controls = [makeControl('mood_slider', true)];
      const errors = validateControls(controls, { 'ctrl-mood_slider': '5' });
      expect(errors).toEqual({});
    });
  });

  describe('required counter controls', () => {
    it('returns error when value is empty (not touched)', () => {
      const controls = [makeControl('counter', true)];
      const errors = validateControls(controls, {});
      expect(errors['ctrl-counter']).toBe('This field is required');
    });

    it('passes when value is "0" (explicitly set)', () => {
      const controls = [makeControl('counter', true)];
      const errors = validateControls(controls, { 'ctrl-counter': '0' });
      expect(errors).toEqual({});
    });

    it('passes when value is any number', () => {
      const controls = [makeControl('counter', true)];
      const errors = validateControls(controls, { 'ctrl-counter': '3' });
      expect(errors).toEqual({});
    });
  });

  describe('required choice_buttons controls', () => {
    it('returns error when no option selected', () => {
      const controls = [makeControl('choice_buttons', true)];
      const errors = validateControls(controls, { 'ctrl-choice_buttons': '' });
      expect(errors['ctrl-choice_buttons']).toBe('This field is required');
    });

    it('passes when option selected', () => {
      const controls = [makeControl('choice_buttons', true)];
      const errors = validateControls(controls, { 'ctrl-choice_buttons': 'Option A' });
      expect(errors).toEqual({});
    });
  });

  describe('required image_attachment controls', () => {
    it('returns error when no image attached', () => {
      const controls = [makeControl('image_attachment', true)];
      const errors = validateControls(controls, {});
      expect(errors['ctrl-image_attachment']).toBe('This field is required');
    });

    it('passes when image URI set', () => {
      const controls = [makeControl('image_attachment', true)];
      const errors = validateControls(controls, { 'ctrl-image_attachment': 'file:///photo.jpg' });
      expect(errors).toEqual({});
    });
  });

  describe('non-required controls', () => {
    it('does not validate optional controls', () => {
      const controls = [
        makeControl('text_input', false),
        makeControl('mood_slider', false),
      ];
      const errors = validateControls(controls, {});
      expect(errors).toEqual({});
    });
  });

  describe('static controls (not user-input)', () => {
    it('skips static_text controls even if isRequired is true', () => {
      const controls = [makeControl('static_text', true)];
      const errors = validateControls(controls, {});
      expect(errors).toEqual({});
    });

    it('skips link_button controls even if isRequired is true', () => {
      const controls = [makeControl('link_button', true)];
      const errors = validateControls(controls, {});
      expect(errors).toEqual({});
    });
  });

  describe('multiple controls validation', () => {
    it('returns errors for all incomplete required controls', () => {
      const controls = [
        makeControl('text_input', true, 'ctrl-1'),
        makeControl('mood_slider', true, 'ctrl-2'),
        makeControl('checkbox', true, 'ctrl-3'),
        makeControl('text_area', false, 'ctrl-4'),
      ];
      const values = { 'ctrl-1': '', 'ctrl-2': '0', 'ctrl-3': 'false' };
      const errors = validateControls(controls, values);

      expect(Object.keys(errors)).toHaveLength(3);
      expect(errors['ctrl-1']).toBe('This field is required');
      expect(errors['ctrl-2']).toBe('This field is required');
      expect(errors['ctrl-3']).toBe('This field is required');
      expect(errors['ctrl-4']).toBeUndefined();
    });

    it('returns empty object when all required controls are filled', () => {
      const controls = [
        makeControl('text_input', true, 'ctrl-1'),
        makeControl('mood_slider', true, 'ctrl-2'),
        makeControl('checkbox', true, 'ctrl-3'),
      ];
      const values = { 'ctrl-1': 'Hello', 'ctrl-2': '7', 'ctrl-3': 'true' };
      const errors = validateControls(controls, values);
      expect(errors).toEqual({});
    });
  });
});
