/**
 * EmotionPicker — Renders selectable emotion chips for the session launcher.
 *
 * Displays a prompt and 12 emotion chips in a wrap layout. Supports single-select
 * behavior: tapping an unselected chip selects it; tapping the selected chip
 * deselects it. Includes an "I'm not sure how I feel" button that launches the
 * guided check-in flow.
 *
 * Uses non-clinical language only (no mood, affect, diagnose, disorder).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 5.5, 8.9
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { EmotionType } from '@/types/index';
import { EMOTION_OPTIONS } from '@/data/emotionConfig';

export interface EmotionPickerProps {
  selectedEmotion: EmotionType | null;
  preSelectedEmotion?: EmotionType | null;
  softLabel?: string | null;
  onSelectEmotion: (emotion: EmotionType) => void;
  onDeselectEmotion: () => void;
  onStartCheckin?: () => void;
}

export default function EmotionPicker({
  selectedEmotion,
  preSelectedEmotion,
  softLabel,
  onSelectEmotion,
  onDeselectEmotion,
  onStartCheckin,
}: EmotionPickerProps) {
  const handlePress = (emotion: EmotionType) => {
    if (selectedEmotion === emotion) {
      onDeselectEmotion();
    } else {
      onSelectEmotion(emotion);
    }
  };

  // Determine which chip to highlight: explicit selection takes priority,
  // then fall back to pre-selected (from guided check-in)
  const highlightedEmotion = selectedEmotion ?? preSelectedEmotion ?? null;

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>How are you feeling right now?</Text>

      {softLabel ? (
        <Text style={styles.softLabel}>{softLabel}</Text>
      ) : null}

      <View style={styles.chipRow}>
        {EMOTION_OPTIONS.map((option) => {
          const isSelected = highlightedEmotion === option.type;
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

      {onStartCheckin ? (
        <TouchableOpacity
          style={styles.notSureButton}
          onPress={onStartCheckin}
          accessibilityRole="button"
          accessibilityLabel="I'm not sure how I feel. Start guided check-in."
        >
          <Text style={styles.notSureButtonText}>
            I'm not sure how I feel
          </Text>
        </TouchableOpacity>
      ) : null}
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
  softLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
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
  notSureButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignSelf: 'stretch',
  },
  notSureButtonText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
