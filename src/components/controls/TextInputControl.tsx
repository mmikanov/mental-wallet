/**
 * TextInputControl — Single-line text input, max 200 characters.
 *
 * Shows label, optional placeholder, character counter, and inline error.
 *
 * Validates: Requirements 6.1
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { Control, TextInputConfig } from '@/types/index';

interface TextInputControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function TextInputControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: TextInputControlProps) {
  const config = control.config as TextInputConfig;
  const maxLength = Math.min(config.maxLength || 200, 200);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {config.label}
        {control.isRequired && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChange}
        placeholder={config.placeholder}
        placeholderTextColor="#9CA3AF"
        maxLength={maxLength}
        editable={!readOnly}
        accessibilityLabel={config.label}
        accessibilityHint={config.placeholder}
      />
      <View style={styles.footer}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View />
        )}
        <Text style={styles.charCount}>
          {value.length}/{maxLength}
        </Text>
      </View>
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
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1C1C1E',
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
