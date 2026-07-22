/**
 * SeedInsightsButton — Dev-only button to populate the database with mock
 * insights data (KPI records, completions, durations, outcome responses).
 * Shows an alert with counts on success.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { generateInsightsMockData } from '@/services/devInsightsMockData';

export function SeedInsightsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [daysInput, setDaysInput] = useState('');

  const handleSeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const parsedDays = daysInput.trim() === '' ? undefined : parseInt(daysInput, 10);
      
      if (parsedDays !== undefined && isNaN(parsedDays)) {
        Alert.alert('Invalid Input', 'Please enter a valid number or leave empty for random.');
        setIsLoading(false);
        return;
      }

      const summary = await generateInsightsMockData(parsedDays);
      
      if (summary.daysGenerated === 0) {
        Alert.alert(
          'Data Cleared',
          `Removed all mock insights data for ${summary.cardCount} cards.`
        );
      } else {
        Alert.alert(
          'Insights Data Seeded',
          `Created mock data for ${summary.cardCount} cards:\n\n` +
            `• ${summary.daysGenerated} days of data\n` +
            `• ${summary.kpiCount} KPI records\n` +
            `• ${summary.completionCount} completions\n` +
            `• ${summary.controlValueCount} control values\n` +
            `• ${summary.durationCount} duration records\n` +
            `• ${summary.outcomeCount} outcome responses`
        );
      }
    } catch (error) {
      Alert.alert(
        'Seeding Failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [daysInput]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🧪 Insights Mock Data</Text>
      <Text style={styles.label}>Days (empty = random 30–100, 0 = clear)</Text>
      <TextInput
        style={styles.input}
        value={daysInput}
        onChangeText={setDaysInput}
        placeholder="e.g. 60"
        placeholderTextColor="#AAA"
        keyboardType="numeric"
        returnKeyType="done"
        testID="seed-insights-days-input"
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleSeed}
        disabled={isLoading}
        accessibilityLabel="Seed insights mock data"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Seed Mock Data</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        Enter 0 to clear all data. Leave empty for random 30–100 days.
      </Text>
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
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#FFF',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#6B4EFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default SeedInsightsButton;
