/**
 * ChoiceButtonsControl — Single-select button pills (max 8 options).
 *
 * Renders horizontally-wrapped button pills. Tapping selects one option
 * (deselects others). The stored value is the option text.
 *
 * Validates: Requirements 6.1
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Control, ChoiceButtonsConfig } from '@/types/index';

interface ChoiceButtonsControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function ChoiceButtonsControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: ChoiceButtonsControlProps) {
  const config = control.config as ChoiceButtonsConfig;
  const options = (config.options || []).slice(0, 8);

  const handleSelect = (optionText: string) => {
    if (readOnly) return;
    // Toggle: if already selected, deselect; otherwise select
    onChange(value === optionText ? '' : optionText);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      <View style={styles.optionsRow}>
        {options.map((option, idx) => {
          const isSelected = value === option.text;
          return (
            <TouchableOpacity
              key={`${option.text}-${idx}`}
              style={[styles.pill, isSelected && styles.pillSelected]}
              onPress={() => handleSelect(option.text)}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityLabel={option.text}
              accessibilityState={{ selected: isSelected }}
            >
              {option.icon ? (
                <Text style={styles.pillIcon}>{option.icon}</Text>
              ) : null}
              <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                {option.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  pillSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  pillIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  pillTextSelected: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
