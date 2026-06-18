/**
 * PrimaryActionButton — Dynamic action button for focused/expanded cards.
 *
 * Label is derived from card content:
 * - "Mark as done" for static-only cards (no user-input controls)
 * - "Save entry" for form-based cards (has user-input controls)
 * - "Complete" for instruction-based cards
 * - Or a custom label if provided
 *
 * Large, accessible button with minimum 48pt height.
 *
 * Validates: Requirements 5.3, 5.4, 5.8
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { Control } from '@/types/index';

interface PrimaryActionButtonProps {
  controls: Control[];
  customLabel?: string;
  onPress: () => void;
  disabled?: boolean;
}

// Control types that accept user input
const USER_INPUT_CONTROL_TYPES = new Set([
  'text_input',
  'text_area',
  'mood_slider',
  'choice_buttons',
  'checkbox',
  'counter',
  'image_attachment',
  'datetime_stamp',
]);

/**
 * Derives the primary action button label based on card controls.
 */
function deriveActionLabel(controls: Control[], customLabel?: string): string {
  if (customLabel) return customLabel;

  const hasUserInputControls = controls.some(
    (c) => USER_INPUT_CONTROL_TYPES.has(c.type)
  );

  if (!hasUserInputControls) {
    return 'Mark as done';
  }

  // Check if primarily instruction-based (has static text + some inputs)
  const staticCount = controls.filter((c) => c.type === 'static_text' || c.type === 'link_button').length;
  const inputCount = controls.filter((c) => USER_INPUT_CONTROL_TYPES.has(c.type)).length;

  if (staticCount > inputCount) {
    return 'Complete';
  }

  return 'Save entry';
}

export default function PrimaryActionButton({
  controls,
  customLabel,
  onPress,
  disabled = false,
}: PrimaryActionButtonProps) {
  const label = deriveActionLabel(controls, customLabel);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  labelDisabled: {
    color: '#9CA3AF',
  },
});

export { deriveActionLabel, USER_INPUT_CONTROL_TYPES };
