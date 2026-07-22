/**
 * Accessibility utilities for Mental Health Wallet.
 *
 * Provides helper functions and constants for screen reader announcements,
 * accessibility labels, and state transition notifications.
 *
 * All interactive elements already have accessibilityRole and accessibilityLabel
 * props. This module adds programmatic announcements for state transitions
 * that screen readers cannot automatically detect.
 *
 * Validates: Requirements 17.3
 */

import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Announces a message to the screen reader (VoiceOver/TalkBack).
 * Uses AccessibilityInfo.announceForAccessibility on iOS and
 * AccessibilityInfo.announceForAccessibilityWithOptions on Android.
 *
 * @param message - The message to announce
 */
export function announce(message: string): void {
  if (!message) return;
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Announces a card state transition to the screen reader.
 * Provides context-appropriate messages for each transition type.
 */
export function announceCardTransition(
  transition: 'focused' | 'expanded' | 'collapsed' | 'completed' | 'archived' | 'restored',
  cardTitle?: string
): void {
  const messages: Record<string, string> = {
    focused: cardTitle ? `${cardTitle} focused` : 'Card focused',
    expanded: 'Card expanded, showing controls',
    collapsed: 'Card collapsed',
    completed: 'Completed successfully',
    archived: 'Card archived',
    restored: 'Card restored to wallet',
  };

  announce(messages[transition]);
}

/**
 * Common accessibility label constants for consistent labeling across the app.
 */
export const A11Y_LABELS = {
  // Wallet screen
  WALLET_HEADER: 'My Wallet',
  WALLET_MENU: 'Wallet menu',
  ADD_TOOL: 'Add tool to wallet',

  // Card interactions
  CARD_FOCUS_HINT: 'Double tap to view card details',
  CARD_REORDER_HINT: 'Long press to reorder',
  CARD_EXPAND: 'Expand card to see full content',
  CARD_COLLAPSE: 'Collapse card',
  CARD_DISMISS: 'Return to wallet',

  // Card menu
  CARD_MENU: 'Card menu',
  EDIT_CARD: 'Edit card',
  DUPLICATE_CARD: 'Duplicate tool',
  VIEW_HISTORY: 'View usage history',
  SET_REMINDER: 'Set reminder',
  ARCHIVE_CARD: 'Archive card',

  // Controls
  SAVE_ENTRY: 'Save entry',
  MARK_DONE: 'Mark as done',
  COMPLETE: 'Complete',

  // Navigation
  BACK: 'Go back',
  NEXT: 'Next step',
  DONE: 'Done',
  CANCEL: 'Cancel',
} as const;

/**
 * Minimum tap target dimensions (in points) per WCAG 2.1 AA.
 * Used as reference constants for component styling.
 */
export const MIN_TAP_TARGET = {
  width: 44,
  height: 44,
} as const;

/**
 * Checks if a screen reader is currently active.
 * Useful for conditionally showing/hiding visual cues.
 */
export async function isScreenReaderActive(): Promise<boolean> {
  return AccessibilityInfo.isScreenReaderEnabled();
}

/**
 * Converts a numeric Score_Delta into spoken words for screen readers.
 * Examples: 1.2 → "one point two", 0.5 → "zero point five", 2.0 → "two"
 *
 * Validates: Requirement 9.3 (correlation descriptors announced in full words)
 */
export function scoreDeltaToWords(delta: number): string {
  const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  const abs = Math.abs(delta);
  const rounded = Math.round(abs * 10) / 10;
  const str = rounded.toFixed(1);
  const [intPart, decPart] = str.split('.');

  const intWord = parseInt(intPart, 10) < 10
    ? DIGIT_WORDS[parseInt(intPart, 10)]
    : intPart;

  // If decimal is 0, just return the integer part
  if (decPart === '0') {
    return intWord;
  }

  const decWord = parseInt(decPart, 10) < 10
    ? DIGIT_WORDS[parseInt(decPart, 10)]
    : decPart;

  return `${intWord} point ${decWord}`;
}
