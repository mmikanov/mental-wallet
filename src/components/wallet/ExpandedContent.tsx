/**
 * ExpandedContent — Renders card controls and the submit button when a card is expanded.
 *
 * - Shows a collapse button at the top to return to focused state (Req 3.4)
 * - Shows the ControlRenderer with all card controls
 * - Shows validation errors inline per control
 * - "Save"/"Complete" button triggers validation → submission
 * - On success: updates card stats, shows brief feedback, collapses back to focused state
 * - Auto-includes "Mark as done" for static-only cards (Req 5.4)
 * - Preserves inputs when collapsing or switching cards (Req 3.4, 3.5)
 *
 * Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.7, 5.3, 5.4, 5.5, 5.8
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import ControlRenderer from '@/components/controls/ControlRenderer';
import PrimaryActionButton from './PrimaryActionButton';
import { useCompletionStore } from '@/stores/completionStore';
import { useWalletStore } from '@/stores/walletStore';
import type { Card, Control } from '@/types/index';

interface ExpandedContentProps {
  card: Card;
}

/** Control types that accept user input (not static/display-only). */
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
 * Determines if a control value is considered "empty" for validation purposes.
 * - Text controls: empty or whitespace-only
 * - Checkbox: only 'true' counts as filled (unchecked = 'false' is empty)
 * - Counter: '0' is a valid value (user explicitly set it)
 * - MoodSlider: '0' or empty means not selected
 * - Others: empty string is empty
 */
function isControlValueEmpty(controlType: string, value: string): boolean {
  const trimmed = value.trim();

  switch (controlType) {
    case 'text_input':
    case 'text_area':
    case 'image_attachment':
      return trimmed === '';

    case 'checkbox':
      // Checkbox is "filled" only when checked (true)
      return value !== 'true';

    case 'mood_slider':
      // Mood slider needs a selection (1-10); 0 or empty means not selected
      return trimmed === '' || trimmed === '0';

    case 'counter':
      // Counter: any numeric value (including 0) is valid if explicitly set
      // Empty string means not touched
      return trimmed === '';

    case 'choice_buttons':
      return trimmed === '';

    case 'datetime_stamp':
      // Auto-stamps on mount, should always have a value
      return trimmed === '';

    default:
      return trimmed === '';
  }
}

/**
 * Validates that all required user-input controls have non-empty values.
 * Returns a map of controlId → error message for failing controls.
 */
export function validateControls(
  controls: Control[],
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const control of controls) {
    if (!control.isRequired) continue;
    // Only validate user-input controls
    if (!USER_INPUT_CONTROL_TYPES.has(control.type)) continue;

    const value = values[control.id] ?? '';
    if (isControlValueEmpty(control.type, value)) {
      errors[control.id] = 'This field is required';
    }
  }

  return errors;
}

export default function ExpandedContent({ card }: ExpandedContentProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Get stored input values for this card
  const currentInputValues = useCompletionStore((s) => s.currentInputValues);
  const setControlValue = useCompletionStore((s) => s.setControlValue);
  const submitCompletion = useCompletionStore((s) => s.submitCompletion);
  const loadCards = useWalletStore((s) => s.loadCards);
  const collapseCard = useWalletStore((s) => s.collapseCard);

  const cardValues = currentInputValues[card.id] ?? {};

  const handleChange = useCallback(
    (controlId: string, value: string) => {
      setControlValue(card.id, controlId, value);
      // Clear error for this control when user provides a value
      setErrors((prev) => {
        if (prev[controlId]) {
          const { [controlId]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    },
    [card.id, setControlValue]
  );

  const handleCollapse = useCallback(() => {
    // Preserve inputs — just collapse back to focused state
    collapseCard();
  }, [collapseCard]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    // Validate required controls
    const validationErrors = validateControls(card.controls, cardValues);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await submitCompletion(card.id, card.controls);
      // Reload cards to reflect updated stats (totalUses, streak, lastUsedAt)
      await loadCards();
      // Show brief success feedback then collapse back to focused state
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        collapseCard();
      }, 1200);
    } catch (err) {
      Alert.alert(
        'Submission failed',
        'Could not save your completion. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [card.id, card.controls, cardValues, isSubmitting, submitCompletion, loadCards, collapseCard]);

  return (
    <View style={styles.container}>
      {/* Collapse button — returns to focused state preserving inputs (Req 3.4) */}
      <TouchableOpacity
        style={styles.collapseButton}
        onPress={handleCollapse}
        accessibilityRole="button"
        accessibilityLabel="Collapse card"
        accessibilityHint="Returns to focused card view, preserving your inputs"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.collapseIcon}>▲</Text>
        <Text style={styles.collapseText}>Collapse</Text>
      </TouchableOpacity>

      {/* Controls */}
      <ControlRenderer
        controls={card.controls}
        values={cardValues}
        onChange={handleChange}
        errors={errors}
      />

      {/* Success feedback */}
      {showSuccess && (
        <View style={styles.successBanner} accessibilityRole="alert">
          <Text style={styles.successText}>✓ Completed!</Text>
        </View>
      )}

      {/* Primary action button */}
      <View style={styles.actionContainer}>
        <PrimaryActionButton
          controls={card.controls}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 6,
  },
  collapseText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  actionContainer: {
    marginTop: 16,
  },
  successBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    alignItems: 'center',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
});
