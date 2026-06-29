/**
 * EmotionPicker — Renders selectable emotion chips for the session launcher.
 *
 * Displays a prompt and a row of emotion chips. Supports single-select behavior:
 * tapping an unselected chip selects it; tapping the selected chip deselects it.
 * Uses non-clinical language only (no mood, affect, diagnose, disorder).
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 12.1
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { EmotionType } from '@/types/index';

export interface EmotionPickerProps {
  selectedEmotion: EmotionType | null;
  onSelectEmotion: (emotion: EmotionType) => void;
  onDeselectEmotion: () => void;
}

interface EmotionOption {
  type: EmotionType;
  label: string;
  icon: string;
}

const EMOTION_OPTIONS: EmotionOption[] = [
  { type: 'stressed', label: 'Stressed', icon: '😰' },
  { type: 'overwhelmed', label: 'Overwhelmed', icon: '🌊' },
  { type: 'anxious', label: 'Anxious', icon: '😟' },
  { type: 'sad', label: 'Sad/low', icon: '😢' },
  { type: 'angry', label: 'Angry', icon: '😤' },
  { type: 'numb', label: 'Numb', icon: '😶' },
];

export default function EmotionPicker({
  selectedEmotion,
  onSelectEmotion,
  onDeselectEmotion,
}: EmotionPickerProps) {
  const handlePress = (emotion: EmotionType) => {
    if (selectedEmotion === emotion) {
      onDeselectEmotion();
    } else {
      onSelectEmotion(emotion);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>How are you feeling right now?</Text>
      <View style={styles.chipRow}>
        {EMOTION_OPTIONS.map((option) => {
          const isSelected = selectedEmotion === option.type;
          return (
            <TouchableOpacity
              key={option.type}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handlePress(option.type)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={styles.chipIcon}>{option.icon}</Text>
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
    paddingVertical: 8,
  },
  prompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minHeight: 40,
  },
  chipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  chipLabel: {
    fontSize: 15,
    color: '#1C1C1E',
  },
  chipLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
