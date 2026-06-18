/**
 * CheckboxControl — Toggle/checkbox control.
 *
 * Stores value as "true" or "false" string.
 * Renders a tappable row with a checkbox indicator and label.
 *
 * Validates: Requirements 6.1
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Control, CheckboxConfig } from '@/types/index';

interface CheckboxControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function CheckboxControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: CheckboxControlProps) {
  const config = control.config as CheckboxConfig;
  const isChecked = value === 'true';

  const handleToggle = () => {
    if (!readOnly) {
      onChange(isChecked ? 'false' : 'true');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.row, error ? styles.rowError : null]}
        onPress={handleToggle}
        disabled={readOnly}
        accessibilityRole="checkbox"
        accessibilityLabel={config.label}
        accessibilityState={{ checked: isChecked }}
      >
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.label}>
          {config.label}
          {control.isRequired && <Text style={styles.required}> *</Text>}
        </Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  rowError: {
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  label: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  required: {
    color: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    paddingLeft: 36,
  },
});
