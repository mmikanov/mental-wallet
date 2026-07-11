/**
 * AdminKpiBadgeTools — Developer testing panel for KPI Days-Since Badge.
 *
 * Provides controls to create fake KPI records (with a configurable days-ago value)
 * and reset all KPI records. Shows live badge state for verification.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useKpiStore } from '@/stores/kpiStore';
import { validateDaysAgoInput, computeDaysElapsed } from '@/utils/kpiBadgeUtils';

export function AdminKpiBadgeTools() {
  const [daysInput, setDaysInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { createFakeRecord, resetAllRecords, lastCheckInDate } = useKpiStore();

  const daysElapsed = computeDaysElapsed(lastCheckInDate, new Date());

  const handleCreate = useCallback(() => {
    const validationError = validateDaysAgoInput(daysInput);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const daysAgo = Number(daysInput.trim());
    createFakeRecord(daysAgo);
    setDaysInput('');
  }, [daysInput, createFakeRecord]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset All KPI Records',
      'This will delete all KPI records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetAllRecords() },
      ]
    );
  }, [resetAllRecords]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🧪 KPI Badge Testing</Text>

      {/* Live status */}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Badge state:</Text>
        <Text style={styles.statusValue}>
          {daysElapsed === null
            ? 'Hidden (no records)'
            : daysElapsed === 0
              ? 'Hidden (checked in today)'
              : `Showing "${daysElapsed}" day${daysElapsed === 1 ? '' : 's'}`}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Last check-in:</Text>
        <Text style={styles.statusValue}>
          {lastCheckInDate
            ? new Date(lastCheckInDate).toLocaleString()
            : 'None'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.createSection}>
        <TextInput
          style={styles.input}
          value={daysInput}
          onChangeText={(text) => { setDaysInput(text); setError(null); }}
          placeholder="Days ago"
          keyboardType="numeric"
          testID="days-ago-input"
        />
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          testID="create-record-button"
        >
          <Text style={styles.createButtonText}>Create Record</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText} testID="validation-error">{error}</Text>}

      <TouchableOpacity style={styles.resetButton} onPress={handleReset} testID="reset-button">
        <Text style={styles.resetButtonText}>Reset All KPI Records</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  header: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 13,
    color: '#666',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 12,
  },
  createSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 6,
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdminKpiBadgeTools;
