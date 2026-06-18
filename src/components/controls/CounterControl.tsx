/**
 * CounterControl — Increment/decrement numeric input with optional min/max.
 *
 * Displays current value with +/- buttons. Stores value as a string number.
 *
 * Validates: Requirements 6.1
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Control, CounterConfig } from '@/types/index';

interface CounterControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function CounterControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: CounterControlProps) {
  const config = control.config as CounterConfig;
  const numericValue = parseInt(value, 10) || 0;
  const min = config.min ?? Number.MIN_SAFE_INTEGER;
  const max = config.max ?? Number.MAX_SAFE_INTEGER;

  const canDecrement = numericValue > min;
  const canIncrement = numericValue < max;

  const handleDecrement = () => {
    if (!readOnly && canDecrement) {
      onChange(String(numericValue - 1));
    }
  };

  const handleIncrement = () => {
    if (!readOnly && canIncrement) {
      onChange(String(numericValue + 1));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>

      <View style={[styles.counterRow, error ? styles.counterRowError : null]}>
        <TouchableOpacity
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
          onPress={handleDecrement}
          disabled={readOnly || !canDecrement}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${config.label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.buttonText, !canDecrement && styles.buttonTextDisabled]}>
            −
          </Text>
        </TouchableOpacity>

        <Text style={styles.value} accessibilityLabel={`${config.label}: ${numericValue}`}>
          {numericValue}
        </Text>

        <TouchableOpacity
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
          onPress={handleIncrement}
          disabled={readOnly || !canIncrement}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${config.label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.buttonText, !canIncrement && styles.buttonTextDisabled]}>
            +
          </Text>
        </TouchableOpacity>
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
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  counterRowError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4F46E5',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  value: {
    minWidth: 50,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
