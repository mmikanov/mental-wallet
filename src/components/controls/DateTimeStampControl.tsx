/**
 * DateTimeStampControl — Automatically stamps the current timestamp.
 *
 * When displayMode is 'visible', shows the formatted timestamp.
 * When displayMode is 'hidden', renders nothing visually but still captures the value.
 *
 * Auto-sets current timestamp on mount (when value is empty),
 * so it stamps when the card is expanded.
 *
 * Validates: Requirements 6.1
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Control, DateTimeStampConfig } from '@/types/index';

interface DateTimeStampControlProps {
  control: Control;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function DateTimeStampControl({
  control,
  value,
  onChange,
  readOnly = false,
}: DateTimeStampControlProps) {
  const config = control.config as DateTimeStampConfig;

  // Auto-stamp on mount if no value set
  useEffect(() => {
    if (!value && !readOnly) {
      onChange(new Date().toISOString());
    }
  }, [value, readOnly, onChange]);

  // Hidden mode: render nothing visible
  if (config.displayMode === 'hidden') {
    return null;
  }

  return (
    <View style={styles.container} accessibilityRole="text">
      <View style={styles.row}>
        <Text style={styles.icon}>🕐</Text>
        <Text style={styles.timestamp}>
          {value ? formatTimestamp(value) : '—'}
        </Text>
      </View>
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 14,
    color: '#6B7280',
  },
});
