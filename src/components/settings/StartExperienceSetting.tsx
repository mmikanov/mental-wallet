/**
 * StartExperienceSetting — Radio-style setting control for Start_Mode preference.
 * Displays three mutually exclusive options and persists selection via settingsService.
 * Reverts to previous selection on persistence failure.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getStartMode, setStartMode } from '@/services/settingsService';
import type { StartMode } from '@/types/index';

interface StartOption {
  mode: StartMode;
  label: string;
  description: string;
}

const OPTIONS: StartOption[] = [
  { mode: 'wallet', label: 'Start in my wallet', description: 'Opens to your card collection' },
  { mode: 'emotion', label: 'Start from how I feel', description: 'Opens to the emotion picker' },
  { mode: 'last_used', label: 'Start where I left off', description: 'Opens to whichever you used last' },
];

export default function StartExperienceSetting() {
  const [selectedMode, setSelectedMode] = useState<StartMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCurrentMode();
  }, []);

  async function loadCurrentMode() {
    try {
      const mode = await getStartMode();
      setSelectedMode(mode);
    } catch {
      // Default to wallet if read fails
      setSelectedMode('wallet');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelect(newMode: StartMode) {
    if (newMode === selectedMode || isSaving) return;

    const previousMode = selectedMode;
    // Optimistically update UI
    setSelectedMode(newMode);
    setIsSaving(true);

    try {
      await setStartMode(newMode);
    } catch {
      // Revert to previous selection on failure
      setSelectedMode(previousMode);
      Alert.alert(
        'Could not save preference',
        'Your start experience preference was not saved. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start experience</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#7C3AED" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Start experience</Text>
      <View style={styles.container}>
        {OPTIONS.map((option, index) => {
          const isSelected = option.mode === selectedMode;
          const isLastItem = index === OPTIONS.length - 1;

          return (
            <TouchableOpacity
              key={option.mode}
              style={[styles.row, !isLastItem && styles.rowBorder]}
              onPress={() => handleSelect(option.mode)}
              disabled={isSaving}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${option.label}. ${option.description}`}
            >
              <View
                style={[
                  styles.radio,
                  isSelected ? styles.radioSelected : styles.radioUnselected,
                ]}
              />
              <View style={styles.textContainer}>
                <Text style={styles.label}>{option.label}</Text>
                <Text style={styles.description}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
  },
  radioSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#7C3AED',
  },
  radioUnselected: {
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
});
