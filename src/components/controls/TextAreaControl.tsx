/**
 * TextAreaControl — Multi-line text input for journaling, notes, etc.
 *
 * Shows label, optional placeholder, and inline error.
 *
 * Validates: Requirements 6.1
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { Control, TextAreaConfig } from '@/types/index';

interface TextAreaControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

export default function TextAreaControl({
  control,
  value,
  onChange,
  error,
  readOnly = false,
}: TextAreaControlProps) {
  const config = control.config as TextAreaConfig;

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
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        editable={!readOnly}
        accessibilityLabel={config.label}
        accessibilityHint={config.placeholder}
      />
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
    minHeight: 100,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});
