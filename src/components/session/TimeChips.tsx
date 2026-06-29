/**
 * TimeChips — Single-select time duration chips for the emotion session flow.
 *
 * Displays optional time options ("I have ~1–2 minutes", "I have ~5–10 minutes").
 * Supports single-select with deselect: tapping the selected chip deselects it,
 * tapping an unselected chip selects it (and deselects any other).
 *
 * Validates: Requirements 6.1, 6.4, 6.5, 6.6
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { TimeType } from '@/types/index';

export interface TimeChipsProps {
  selectedTime: TimeType | null;
  onSelectTime: (time: TimeType | null) => void;
}

interface TimeOption {
  type: TimeType;
  label: string;
}

const TIME_OPTIONS: TimeOption[] = [
  { type: '1_2_min', label: 'I have ~1–2 minutes' },
  { type: '5_10_min', label: 'I have ~5–10 minutes' },
];

export default function TimeChips({ selectedTime, onSelectTime }: TimeChipsProps) {
  const handlePress = (time: TimeType) => {
    if (selectedTime === time) {
      // Deselect — tapping the already-selected chip clears it (Req 6.5)
      onSelectTime(null);
    } else {
      // Select new (also handles switching from one to another)
      onSelectTime(time);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>How much time do you have?</Text>
      <View style={styles.chipRow}>
        {TIME_OPTIONS.map((option) => {
          const isSelected = selectedTime === option.type;
          return (
            <TouchableOpacity
              key={option.type}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handlePress(option.type)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    minHeight: 38,
  },
  chipSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  chipLabel: {
    fontSize: 15,
    color: '#1C1C1E',
  },
  chipLabelSelected: {
    color: '#7C3AED',
    fontWeight: '600',
  },
});
