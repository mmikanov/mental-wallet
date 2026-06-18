/**
 * Unit tests for PrimaryActionButton's deriveActionLabel utility function.
 */

import { deriveActionLabel } from '../PrimaryActionButton';
import type { Control } from '@/types/index';

function makeControl(type: string, position = 0): Control {
  return {
    id: `ctrl-${position}`,
    cardId: 'card-1',
    type: type as Control['type'],
    position,
    config: { label: 'test' } as any,
    isRequired: false,
  };
}

describe('deriveActionLabel', () => {
  it('returns custom label when provided', () => {
    const controls = [makeControl('text_input')];
    expect(deriveActionLabel(controls, 'My Custom Action')).toBe('My Custom Action');
  });

  it('returns "Mark as done" for static-only controls', () => {
    const controls = [
      makeControl('static_text', 0),
      makeControl('link_button', 1),
    ];
    expect(deriveActionLabel(controls)).toBe('Mark as done');
  });

  it('returns "Save entry" for form-based cards with mostly input controls', () => {
    const controls = [
      makeControl('text_input', 0),
      makeControl('text_area', 1),
      makeControl('mood_slider', 2),
    ];
    expect(deriveActionLabel(controls)).toBe('Save entry');
  });

  it('returns "Complete" for instruction-based cards (more static than input)', () => {
    const controls = [
      makeControl('static_text', 0),
      makeControl('static_text', 1),
      makeControl('link_button', 2),
      makeControl('checkbox', 3),
    ];
    expect(deriveActionLabel(controls)).toBe('Complete');
  });

  it('returns "Save entry" for mixed cards with equal static and input controls', () => {
    const controls = [
      makeControl('static_text', 0),
      makeControl('text_input', 1),
    ];
    // 1 static, 1 input — not more static than input, so "Save entry"
    expect(deriveActionLabel(controls)).toBe('Save entry');
  });
});
