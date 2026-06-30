/**
 * IntentSelectionScreen — Second screen of the onboarding flow.
 * Displays job-to-be-done options as large tappable cards for intent-based card seeding.
 *
 * UX Flow:
 * 1. User sees 4 large cards
 * 2. User taps one → it becomes selected (highlighted)
 * 3. Encouraging micro-copy appears
 * 4. Brief delay for user to read micro-copy
 * 5. Seeds cards for selected intent and navigates to MainTabs
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.3, 9.4, 9.5
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { createOnboardingService } from '@/services/onboardingService';
import { INTENT_OPTIONS, type IntentId } from '@/data/onboardingConfig';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'IntentSelection'>;

export default function IntentSelectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const completeOnboardingScreens = useOnboardingStore(
    (state) => state.completeOnboardingScreens
  );

  const [selectedIntent, setSelectedIntent] = useState<IntentId | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSelect = async (intentId: IntentId) => {
    if (isTransitioning) return;

    setSelectedIntent(intentId);
    setIsTransitioning(true);

    // Brief pause for micro-copy to be visible
    await new Promise((resolve) => setTimeout(resolve, 600));

    const onboardingService = createOnboardingService();
    await onboardingService.seedStarterCards(intentId);
    await completeOnboardingScreens(intentId);

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      })
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityLabel="Go back to Welcome screen"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>

        <Text style={styles.heading} accessibilityRole="header">
          What brings you here?
        </Text>

        <View style={styles.cardsContainer}>
          {INTENT_OPTIONS.map((option) => {
            const isSelected = selectedIntent === option.intentId;

            return (
              <Pressable
                key={option.intentId}
                style={[
                  styles.card,
                  isSelected && styles.cardSelected,
                  isTransitioning && !isSelected && styles.cardDisabled,
                ]}
                onPress={() => handleSelect(option.intentId)}
                disabled={isTransitioning}
                accessibilityLabel={`${option.label}. ${option.description}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: isTransitioning }}
              >
                <Text
                  style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.cardDescription,
                    isSelected && styles.cardDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedIntent !== null && (
          <Text style={styles.microCopy} accessibilityLiveRegion="polite">
            Great choice — we'll set you up with tools for that.
          </Text>
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
  cardsContainer: {
    gap: 12,
  },
  card: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 20,
    minHeight: 80,
    justifyContent: 'center',
  },
  cardSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EBF4FF',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  cardLabelSelected: {
    color: '#1A5DAB',
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cardDescriptionSelected: {
    color: '#3B7DD8',
  },
  microCopy: {
    marginTop: 20,
    fontSize: 16,
    color: '#4A90D9',
    textAlign: 'center',
    fontWeight: '500',
  },
});
