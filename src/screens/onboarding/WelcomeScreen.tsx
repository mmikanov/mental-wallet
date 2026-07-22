/**
 * WelcomeScreen — First screen of the onboarding flow.
 *
 * Displays headline, value proposition, embedded disclaimer,
 * micro-reassurance text, and navigation actions (Continue / Skip intro).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useKpiStore } from '@/stores/kpiStore';
import { createOnboardingService } from '@/services/onboardingService';
import { logEvent } from '@/services/analyticsEventLogger';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type WelcomeNavProp = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeNavProp>();
  const acknowledgeDisclaimer = useOnboardingStore((s) => s.acknowledgeDisclaimer);
  const completeOnboardingScreens = useOnboardingStore((s) => s.completeOnboardingScreens);
  const onboardingService = useMemo(() => createOnboardingService(), []);

  useEffect(() => {
    try {
      void logEvent('onboarding_step_viewed', { step_name: 'welcome' });
    } catch {
      // Analytics must never disrupt onboarding
    }
  }, []);

  const handleContinue = async () => {
    try {
      await acknowledgeDisclaimer();
    } catch (error) {
      console.warn('[WelcomeScreen] acknowledgeDisclaimer failed:', error);
    }
    navigation.navigate('PrivacyNotice');
  };

  const handleSkip = async () => {
    try {
      await acknowledgeDisclaimer();
      await onboardingService.seedStarterCards(null);
      await useKpiStore.getState().setKpi('Feeling good overall');
      await onboardingService.seedKpiCard('Feeling good overall');
      await completeOnboardingScreens(null);
      await useOnboardingStore.getState().completeKpiSelection();
    } catch (error) {
      console.warn('[WelcomeScreen] skip intro failed:', error);
    }
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }),
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Headline */}
          <Text style={styles.headline} accessibilityRole="header">
            Your mental health toolkit
          </Text>

          {/* Value proposition */}
          <Text style={styles.valueProp}>
            Collect tools, build habits, and check in with yourself — all in one
            place.
          </Text>

          {/* Micro-reassurance */}
          <View style={styles.reassuranceContainer}>
            <Text style={styles.reassuranceItem}>
              • You stay in control
            </Text>
            <Text style={styles.reassuranceItem}>
              • All questions can be left blank
            </Text>
            <Text style={styles.reassuranceItem}>
              • Not a crisis service
            </Text>
          </View>

          {/* Embedded disclaimer */}
          <Text style={styles.disclaimer}>
            This app is a personal wellness tool. It is not a replacement for
            professional mental health care or a crisis service. If you are in
            crisis, please contact a crisis helpline or emergency services.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            accessibilityLabel="Continue to intent selection"
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            accessibilityLabel="Skip intro and go to wallet"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip intro</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 16,
  },
  valueProp: {
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  reassuranceContainer: {
    marginBottom: 24,
    alignSelf: 'center',
  },
  reassuranceItem: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
  },
  disclaimer: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  actions: {
    paddingTop: 32,
    paddingBottom: 16,
  },
  continueButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 48,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
