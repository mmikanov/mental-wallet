/**
 * MoodSliderControl — Slider for mood rating 1–10 with emoji anchors.
 *
 * Displays 😞 at the left (1) and 😊 at the right (10).
 * Custom slider implementation using touchable steps for reliability in RN.
 *
 * Validates: Requirements 6.1, 6.3
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Control, MoodSliderConfig } from '@/types/index';

interface MoodSliderControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function MoodSliderControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: MoodSliderControlProps) {
  const config = control.config as MoodSliderConfig;
  const numericValue = parseInt(value, 10) || 0;
  const minLabel = config.minLabel || '😞';
  const maxLabel = config.maxLabel || '😊';

  const handleSelect = (num: number) => {
    if (!readOnly) {
      onChange(String(num));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      {/* Emoji anchors and slider dots */}
      <View style={styles.sliderWrapper}>
        <View style={styles.anchorRow}>
          <Text style={styles.anchor}>{minLabel}</Text>
          <Text style={styles.anchor}>{maxLabel}</Text>
        </View>
        <View style={styles.dotsContainer}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.dot,
                numericValue === num && styles.dotSelected,
                numericValue > 0 && num <= numericValue && styles.dotFilled,
              ]}
              onPress={() => handleSelect(num)}
              disabled={readOnly}
              accessibilityRole="button"
              accessibilityLabel={`Mood ${num} out of 10`}
              accessibilityState={{ selected: numericValue === num }}
              hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
            >
              <Text
                style={[
                  styles.dotText,
                  numericValue === num && styles.dotTextSelected,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Current value display */}
      {numericValue > 0 && (
        <Text style={styles.valueDisplay}>
          Selected: {numericValue}/10
        </Text>
      )}

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
    marginBottom: 10,
  },
  required: {
    color: '#EF4444',
  },
  sliderWrapper: {
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  anchor: {
    fontSize: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  dotFilled: {
    backgroundColor: '#E0E7FF',
    borderColor: '#A5B4FC',
  },
  dotText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  dotTextSelected: {
    color: '#FFFFFF',
  },
  valueDisplay: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
