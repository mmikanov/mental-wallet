/**
 * OutcomePrompt — Shown after card completion to ask how the user feels.
 *
 * Displays a row of outcome options (calmer, clearer, hopeful, same, worse).
 * On selection, logs `outcome_response` analytics event and auto-dismisses.
 *
 * Validates: Requirements 3.9
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { logEvent } from '@/services/analyticsEventLogger';

type OutcomeValue = 'calmer' | 'clearer' | 'hopeful' | 'same' | 'worse';

interface OutcomeOption {
  value: OutcomeValue;
  emoji: string;
  label: string;
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  { value: 'calmer', emoji: '😌', label: 'Calmer' },
  { value: 'clearer', emoji: '💡', label: 'Clearer' },
  { value: 'hopeful', emoji: '🌱', label: 'Hopeful' },
  { value: 'same', emoji: '😐', label: 'Same' },
  { value: 'worse', emoji: '😞', label: 'Worse' },
];

interface OutcomePromptProps {
  /** Called after the user selects an outcome. */
  onDismiss: () => void;
}

export default function OutcomePrompt({ onDismiss }: OutcomePromptProps) {
  const [selected, setSelected] = useState<OutcomeValue | null>(null);

  const handleSelect = useCallback(
    (response: OutcomeValue) => {
      if (selected) return; // Prevent double-tap
      setSelected(response);

      // Fire-and-forget analytics logging
      void logEvent('outcome_response', { response });

      // Brief delay so the user sees their selection before dismissal
      setTimeout(() => {
        onDismiss();
      }, 400);
    },
    [selected, onDismiss]
  );

  return (
    <View style={styles.container} accessibilityRole="none">
      <Text style={styles.prompt}>How do you feel after this?</Text>
      <View style={styles.optionsRow}>
        {OUTCOME_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selected === option.value && styles.optionSelected,
            ]}
            onPress={() => handleSelect(option.value)}
            disabled={selected !== null}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: selected === option.value }}
          >
            <Text style={styles.optionEmoji}>{option.emoji}</Text>
            <Text
              style={[
                styles.optionLabel,
                selected === option.value && styles.optionLabelSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  prompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    minWidth: 56,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  optionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: '#059669',
    fontWeight: '600',
  },
});
