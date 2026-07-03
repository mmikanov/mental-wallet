/**
 * KpiChangeScreen — Allows the user to change their personal focus from Settings.
 *
 * Displays the same 7 options used during onboarding with the current selection
 * highlighted. Supports predefined and custom ("Other") selections.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 6.1, 6.2
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useKpiStore } from '@/stores/kpiStore';
import { validateKpiLabel } from '@/services/kpiService';

type Props = NativeStackScreenProps<RootStackParamList, 'KpiChange'>;

const KPI_OPTIONS = [
  'Feeling calmer',
  'Sleeping better',
  'Being more present',
  'Having more energy',
  'Feeling more connected',
  'Managing stress better',
  'Other (write your own)',
] as const;

const PREDEFINED_OPTIONS = KPI_OPTIONS.slice(0, 6);
const OTHER_OPTION = KPI_OPTIONS[6];

export default function KpiChangeScreen({ navigation }: Props) {
  const { personalKpi, changeKpi } = useKpiStore();
  const textInputRef = useRef<TextInput>(null);

  // Determine if the current KPI is a predefined option or custom
  const currentIsPredefined = PREDEFINED_OPTIONS.includes(personalKpi as typeof PREDEFINED_OPTIONS[number]);
  const currentIsOther = !currentIsPredefined && personalKpi !== null;

  const [selectedOption, setSelectedOption] = useState<string | null>(() => {
    if (currentIsPredefined) return personalKpi;
    if (currentIsOther) return OTHER_OPTION;
    return null;
  });

  const [customText, setCustomText] = useState(() => {
    // Pre-fill with existing custom text if the current KPI is custom
    return currentIsOther ? (personalKpi ?? '') : '';
  });

  const [validationError, setValidationError] = useState('');

  const isOtherSelected = selectedOption === OTHER_OPTION;
  const isCustomTextValid = validateKpiLabel(customText);

  function handleOptionPress(option: string) {
    if (option === OTHER_OPTION) {
      setSelectedOption(OTHER_OPTION);
      // Move focus to text input for accessibility
      setTimeout(() => {
        textInputRef.current?.focus();
        AccessibilityInfo.announceForAccessibility('Text input ready. Enter what matters most to you.');
      }, 100);
      return;
    }

    // Predefined option selected
    setSelectedOption(option);

    // If same as current → just go back (no change history record)
    if (option === personalKpi) {
      navigation.goBack();
      return;
    }

    // Different option → persist and go back
    changeKpi(option);
    navigation.goBack();
  }

  function handleSave() {
    const trimmed = customText.trim();

    if (!validateKpiLabel(trimmed)) {
      setValidationError('Please enter at least 2 characters');
      AccessibilityInfo.announceForAccessibility('Please enter at least 2 characters');
      return;
    }

    // If trimmed custom text is the same as current KPI → no-op
    if (trimmed === personalKpi) {
      navigation.goBack();
      return;
    }

    changeKpi(trimmed);
    navigation.goBack();
  }

  function handleCustomTextChange(text: string) {
    // Enforce max 50 characters
    const limited = text.slice(0, 50);
    setCustomText(limited);

    if (validationError && validateKpiLabel(limited)) {
      setValidationError('');
    }
  }

  function isOptionHighlighted(option: string): boolean {
    return selectedOption === option;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What I'm focusing on</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Choose what feeling better looks like for you right now.
        </Text>

        {KPI_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              isOptionHighlighted(option) && styles.optionButtonSelected,
            ]}
            onPress={() => handleOptionPress(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isOptionHighlighted(option) }}
            accessibilityLabel={option}
          >
            <Text
              style={[
                styles.optionText,
                isOptionHighlighted(option) && styles.optionTextSelected,
              ]}
            >
              {option}
            </Text>
            {isOptionHighlighted(option) && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}

        {isOtherSelected && (
          <View style={styles.customInputContainer}>
            <TextInput
              ref={textInputRef}
              style={styles.customInput}
              value={customText}
              onChangeText={handleCustomTextChange}
              placeholder="What matters most to you…"
              placeholderTextColor="#999999"
              maxLength={50}
              accessibilityLabel="Enter your personal focus"
              accessibilityHint="At least 2 characters required"
            />
            <Text style={styles.charCount}>{customText.length}/50</Text>
            {validationError !== '' && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {validationError}
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.saveButton,
                !isCustomTextValid && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!isCustomTextValid}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !isCustomTextValid }}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  !isCustomTextValid && styles.saveButtonTextDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 24,
    lineHeight: 22,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    minHeight: 52,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '700',
  },
  customInputContainer: {
    marginTop: 16,
  },
  customInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 52,
  },
  charCount: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    minHeight: 52,
  },
  saveButtonDisabled: {
    backgroundColor: '#C8E6C9',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#A5D6A7',
  },
});
