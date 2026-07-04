/**
 * PrivacyNoticeScreen — Non-blocking privacy notice shown during onboarding.
 *
 * Displays a brief, plain-language explanation that anonymous usage data is
 * collected to improve the app, with no personal info, and that opt-out is
 * available in Settings. Advances unconditionally to IntentSelection on
 * "Continue" tap.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6, 8.7
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logEvent } from '@/services/analyticsEventLogger';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type PrivacyNoticeNavProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'PrivacyNotice'
>;

export default function PrivacyNoticeScreen() {
  const navigation = useNavigation<PrivacyNoticeNavProp>();

  useEffect(() => {
    try {
      void logEvent('onboarding_step_viewed', { step_name: 'privacy_notice' });
    } catch {
      // Analytics must never disrupt onboarding
    }
  }, []);

  const handleContinue = () => {
    navigation.navigate('IntentSelection');
  };

  const handleLearnMore = () => {
    navigation.navigate('PrivacyExplanation');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        {/* Heading */}
        <Text style={styles.heading} accessibilityRole="header">
          Your privacy matters
        </Text>

        {/* Privacy notice text (≤60 words, 8th-grade reading level) */}
        <Text style={styles.noticeText}>
          We collect anonymous usage data to make the app better. This data does
          not include your name, email, or anything personal. You can turn this
          off anytime in Settings.
        </Text>

        {/* Learn more link */}
        <TouchableOpacity
          style={styles.learnMoreButton}
          onPress={handleLearnMore}
          accessibilityLabel="Learn more about privacy and data collection"
          accessibilityRole="link"
          activeOpacity={0.7}
        >
          <Text style={styles.learnMoreText}>Learn more</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          accessibilityLabel="Continue to next onboarding step"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 16,
  },
  noticeText: {
    fontSize: 17,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  learnMoreButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  learnMoreText: {
    fontSize: 15,
    color: '#4A90D9',
    textDecorationLine: 'underline',
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 32,
  },
  continueButton: {
    backgroundColor: '#4A90D9',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 48,
    minWidth: 44,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
