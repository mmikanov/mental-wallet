/**
 * Property-based test for ReminderIndicator contrast ratio.
 *
 * Feature: card-ux-enhancements, Property 3: Reminder indicator contrast ratio against any card background
 *
 * **Validates: Requirements 3.4**
 *
 * For any valid hex background color, the ReminderIndicator color chosen based on
 * the isLight classification SHALL achieve a contrast ratio of at least 3:1 (WCAG 2.1).
 */

import * as fc from 'fast-check';
import { isLightBackground } from '../cardColors';

/** Dark color used on light backgrounds (from ReminderIndicator) */
const DARK_COLOR = '#1C1C1E';
/** Light color used on dark backgrounds (from ReminderIndicator) */
const LIGHT_COLOR = '#FFFFFF';

/**
 * Converts a single sRGB channel value (0–255) to linear RGB.
 */
function sRGBToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Computes relative luminance per WCAG 2.1 definition.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const rLin = sRGBToLinear(r);
  const gLin = sRGBToLinear(g);
  const bLin = sRGBToLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Computes WCAG 2.1 contrast ratio between two colors.
 * Returns a value ≥ 1 (higher means more contrast).
 */
function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Converts an integer (0–0xFFFFFF) to a 6-digit hex color string.
 */
function intToHexColor(n: number): string {
  return '#' + n.toString(16).padStart(6, '0').toUpperCase();
}

describe('ReminderIndicator - Property 3: Contrast ratio against any card background', () => {
  it('indicator color achieves ≥3:1 contrast ratio against any background color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xFFFFFF }),
        (colorInt) => {
          const bgColor = intToHexColor(colorInt);
          const isLight = isLightBackground(bgColor);

          // ReminderIndicator uses dark color on light backgrounds, light on dark
          const indicatorColor = isLight ? DARK_COLOR : LIGHT_COLOR;

          const ratio = contrastRatio(bgColor, indicatorColor);

          // WCAG 2.1 requires at least 3:1 for non-text UI components
          expect(ratio).toBeGreaterThanOrEqual(3);
        }
      ),
      { numRuns: 200 }
    );
  });
});
