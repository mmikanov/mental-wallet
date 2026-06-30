/**
 * Validation tests for curated library cards.
 * Ensures all cards follow the CuratedCardDefinition format with proper controls.
 *
 * Validates: Requirements 1.4
 */

import { CURATED_LIBRARY } from '@/data/curatedLibrary';
import { SEED_CATEGORIES } from '@/data/seeds';
import type { ControlType } from '@/types/index';

const VALID_CONTROL_TYPES: ControlType[] = [
  'static_text',
  'text_input',
  'text_area',
  'mood_slider',
  'choice_buttons',
  'checkbox',
  'counter',
  'datetime_stamp',
  'image_attachment',
  'link_button',
  'display_media',
  'upload_media',
];

const VALID_CATEGORY_IDS = SEED_CATEGORIES.map((c) => c.id);

describe('Curated Library Validation', () => {
  it('should have at least 18 curated cards', () => {
    expect(CURATED_LIBRARY.length).toBeGreaterThanOrEqual(18);
  });

  it('should have all unique IDs', () => {
    const ids = CURATED_LIBRARY.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should use only valid categoryIds from seeds', () => {
    for (const card of CURATED_LIBRARY) {
      expect(VALID_CATEGORY_IDS).toContain(card.categoryId);
    }
  });

  it('should use only valid ControlType values', () => {
    for (const card of CURATED_LIBRARY) {
      for (const control of card.controls) {
        expect(VALID_CONTROL_TYPES).toContain(control.type);
      }
    }
  });

  it('should have at least one control per card', () => {
    for (const card of CURATED_LIBRARY) {
      expect(card.controls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have all required CuratedCardDefinition fields', () => {
    for (const card of CURATED_LIBRARY) {
      expect(card.id).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.iconType).toBe('emoji');
      expect(card.iconValue).toBeTruthy();
      expect(card.backgroundType).toBe('color');
      expect(card.backgroundValue).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(card.categoryId).toBeTruthy();
      expect(typeof card.allowBackgroundCustomization).toBe('boolean');
      expect(Array.isArray(card.controls)).toBe(true);
    }
  });

  it('should have controls with sequential positions starting from 0', () => {
    for (const card of CURATED_LIBRARY) {
      const positions = card.controls.map((c) => c.position).sort((a, b) => a - b);
      positions.forEach((pos, index) => {
        expect(pos).toBe(index);
      });
    }
  });

  it('should cover all 6 categories', () => {
    const usedCategories = new Set(CURATED_LIBRARY.map((c) => c.categoryId));
    for (const catId of VALID_CATEGORY_IDS) {
      expect(usedCategories.has(catId)).toBe(true);
    }
  });
});
