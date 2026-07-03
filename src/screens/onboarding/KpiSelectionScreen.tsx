/**
 * KpiSelectionScreen — Third screen of the onboarding flow.
 * Allows the user to choose what "getting better" means to them personally.
 *
 * Inserted after Intent Selection and before the Wallet screen.
 * Follows the same UI pattern as IntentSelectionScreen — choice buttons
 * with single-selection behavior.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8,
 *            6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.5
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useKpiStore } from '@/stores/kpiStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { createOnboardingService } from '@/services/onboardingService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'KpiSelection'>;

const KPI_OPTIONS = [
  'Feeling calmer',
  'Sleeping better',
  'Being more present',
  'Having more energy',
  'Feeling more connected',
  'Managing stress better',
  'Other (write your own)',
] as const;

const OTHER_INDEX = 6;
const DEFAULT_KPI = 'Feeling good overall';
const MAX_CUSTOM_LENGTH = 50;

export default function KpiSelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const setKpi = useKpiStore((state) => state.setKpi);
  const completeKpiSelection = useOnboardingStore((state) => state.completeKpiSelection);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [customText, setCustomText] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const textInputRef = useRef<TextInput>(null);

  const trimmedCustomText = customText.trim();
  const nonWhitespaceCount = trimmedCustomText.replace(/\s/g, '').length;
  const isCustomValid = nonWhitespaceCount >= 2;

  const navigateForward = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  }, [navigation]);

  const completeSelection = useCallback(async (label: string) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    try {
      await setKpi(label);
      const onboardingService = createOnboardingService();
      await onboardingService.seedKpiCard(label);
      await completeKpiSelection();
      navigateForward();
    } catch {
      // If seeding fails, still complete selection and navigate (Req error handling)
      try {
        await completeKpiSelection();
      } catch {
        // proceed anyway
      }
      navigateForward();
    }
  }, [isTransitioning, setKpi, completeKpiSelection, navigateForward]);

  const handleOptionPress = useCallback((index: number) => {
    if (isTransitioning) return;

    // Single-selection: tapping new option deselects previous
    setSelectedIndex(index);
    setValidationError('');

    if (index === OTHER_INDEX) {
      // Focus the text input when "Other" is selected
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    } else {
      // Predefined option: immediately persist and navigate
      const label = KPI_OPTIONS[index];
      completeSelection(label);
    }
  }, [isTransitioning, completeSelection]);

  const handleContinue = useCallback(() => {
    if (!isCustomValid) {
      setValidationError('Please enter at least 2 characters');
      return;
    }
    setValidationError('');
    completeSelection(trimmedCustomText);
  }, [isCustomValid, trimmedCustomText, completeSelection]);

  const handleSkip = useCallback(() => {
    completeSelection(DEFAULT_KPI);
  }, [completeSelection]);

  const handleBack = useCallback(() => {
    // Reset selection state on back navigation
    setSelectedIndex(null);
    setCustomText('');
    setValidationError('');
    navigation.goBack();
  }, [navigation]);

  const handleCustomTextChange = useCallback((text: string) => {
    setCustomText(text);
    if (validationError && text.trim().replace(/\s/g, '').length >= 2) {
      setValidationError('');
    }
  }, [validationError]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityLabel="Go back to previous screen"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        <Text style={styles.heading} accessibilityRole="header">
          What does feeling better look like for you?
        </Text>

        <View style={styles.optionsContainer}>
          {KPI_OPTIONS.map((option, index) => {
            const isSelected = selectedIndex === index;

            return (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected,
                  isTransitioning && !isSelected && styles.optionButtonDisabled,
                ]}
                onPress={() => handleOptionPress(index)}
                disabled={isTransitioning}
                accessibilityLabel={option}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isTransitioning }}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedIndex === OTHER_INDEX && (
          <View style={styles.customInputContainer}>
            <TextInput
              ref={textInputRef}
              style={styles.customInput}
              value={customText}
              onChangeText={handleCustomTextChange}
              placeholder="What matters most to you…"
              placeholderTextColor="#9CA3AF"
              maxLength={MAX_CUSTOM_LENGTH}
              autoFocus={false}
              accessibilityLabel="Enter what matters most to you"
              accessibilityHint={`Maximum ${MAX_CUSTOM_LENGTH} characters`}
            />
            <Text style={styles.charCount}>
              {customText.length}/{MAX_CUSTOM_LENGTH}
            </Text>

            {validationError !== '' && (
              <Text
                style={styles.validationError}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {validationError}
              </Text>
            )}

            <Pressable
              style={[
                styles.continueButton,
                !isCustomValid && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!isCustomValid || isTransitioning}
              accessibilityLabel="Continue"
              accessibilityRole="button"
              accessibilityState={{ disabled: !isCustomValid || isTransitioning }}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !isCustomValid && styles.continueButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
          disabled={isTransitioning}
          accessibilityLabel="I'll decide later"
          accessibilityRole="button"
        >
          <Text style={styles.skipButtonText}>I'll decide later</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 16,
  },
  backButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionButtonSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EBF4FF',
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  optionLabelSelected: {
    color: '#1A5DAB',
  },
  customInputContainer: {
    marginTop: 16,
    gap: 8,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1A1A2E',
    minHeight: 48,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  validationError: {
    fontSize: 14,
    color: '#DC2626',
    marginTop: 4,
  },
  continueButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
  },
  skipButton: {
    marginTop: 24,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
