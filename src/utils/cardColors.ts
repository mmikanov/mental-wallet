/**
 * Shared card background color palette and contrast utilities.
 *
 * Single source of truth for background colors used across:
 * - Card creator (Step1Shell)
 * - Background customizer sheet
 * - Any future color picker UI
 *
 * Includes both light pastels and bolder/darker options.
 * Use `getTextColorForBackground` to determine whether text should be
 * white or dark based on the chosen background.
 */

export const CARD_BACKGROUND_COLORS = [
  // Light pastels
  { hex: '#E8F4F8', name: 'Light Blue' },
  { hex: '#EDE7F6', name: 'Lavender' },
  { hex: '#E8F5E9', name: 'Mint' },
  { hex: '#FFF3E0', name: 'Peach' },
  { hex: '#FCE4EC', name: 'Blush' },
  { hex: '#FFFDE7', name: 'Cream' },
  { hex: '#E0F2F1', name: 'Seafoam' },
  { hex: '#F3E5F5', name: 'Light Purple' },
  { hex: '#FBE9E7', name: 'Salmon' },
  { hex: '#E3F2FD', name: 'Sky' },
  { hex: '#F1F8E9', name: 'Lime' },
  { hex: '#F5F5F5', name: 'Light Gray' },
  // Bold / dark
  { hex: '#4A90D9', name: 'Blue' },
  { hex: '#5BA88B', name: 'Green' },
  { hex: '#E88D67', name: 'Orange' },
  { hex: '#D4A5C9', name: 'Pink' },
  { hex: '#8B7EC8', name: 'Purple' },
  { hex: '#E6C84C', name: 'Yellow' },
  { hex: '#4ECDC4', name: 'Teal' },
  { hex: '#FF6B6B', name: 'Red' },
  { hex: '#2D3748', name: 'Dark' },
  { hex: '#1A1A2E', name: 'Navy' },
] as const;

/** Number of color swatches to show per row */
export const COLORS_PER_ROW = 6;

/**
 * Converts a single sRGB channel value (0–255) to linear RGB.
 */
function sRGBToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Determines whether a background color is light (returns true) or dark (returns false).
 * Uses WCAG 2.1 relative luminance with sRGB linearization to ensure that the
 * indicator color (dark on light, white on dark) always achieves ≥3:1 contrast.
 *
 * Threshold 0.179 guarantees ≥3.7:1 contrast for the dark indicator (#1C1C1E)
 * on light backgrounds and ≥4.5:1 for white (#FFFFFF) on dark backgrounds.
 */
export function isLightBackground(color: string): boolean {
  if (!color || color === '#FFFFFF' || color === '#ffffff') return true;
  const hex = color.replace('#', '');
  if (hex.length < 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // WCAG 2.1 relative luminance
  const luminance = 0.2126 * sRGBToLinear(r) + 0.7152 * sRGBToLinear(g) + 0.0722 * sRGBToLinear(b);
  return luminance > 0.179;
}

/**
 * Returns the appropriate text color (dark or white) for a given background.
 * Dark backgrounds get white text; light backgrounds get near-black text.
 */
export function getTextColorForBackground(bgColor: string): string {
  return isLightBackground(bgColor) ? '#1C1C1E' : '#FFFFFF';
}

/**
 * Returns a subtitle/secondary text color for a given background.
 */
export function getSubtitleColorForBackground(bgColor: string): string {
  return isLightBackground(bgColor) ? '#4B5563' : 'rgba(255,255,255,0.7)';
}
