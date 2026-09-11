/**
 * WelcomeScreen — First screen of the onboarding flow.
 *
 * Displays headline, value proposition, embedded disclaimer,
 * micro-reassurance text, and navigation actions (Continue / Skip intro).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useKpiStore } from '@/stores/kpiStore';
import { createOnboardingService } from '@/services/onboardingService';
import { logEvent } from '@/services/analyticsEventLogger';
import { CONSENT_VERSION, CONSENT_LABEL } from '@/constants/consent';
import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from '@/config/appInfo';
import type { OnboardingStackParamList } from '@/navigation/OnboardingNavigator';

type WelcomeNavProp = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<WelcomeNavProp>();
  const acknowledgeDisclaimer = useOnboardingStore((s) => s.acknowledgeDisclaimer);
  const completeOnboardingScreens = useOnboardingStore((s) => s.completeOnboardingScreens);
  const onboardingService = useMemo(() => createOnboardingService(), []);

  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    try {
      void logEvent('onboarding_step_viewed', { step_name: 'welcome' });
    } catch {
      // Analytics must never disrupt onboarding
    }
  }, []);

  // Records the explicit acknowledgment with the accepted consent version.
  // Fail-open: a persistence error must never trap the user in onboarding.
  const recordConsent = async () => {
    try {
      await acknowledgeDisclaimer(CONSENT_VERSION);
    } catch (error) {
      console.warn('[WelcomeScreen] acknowledgeDisclaimer failed:', error);
    }
  };

  const handleOpenTerms = () => {
    void WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
  };

  const handleOpenPrivacy = () => {
    void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  const handleContinue = async () => {
    if (!consentChecked) return;
    await recordConsent();
    navigation.navigate('PrivacyNotice');
  };

  const handleSkip = async () => {
    if (!consentChecked) return;
    try {
      await recordConsent();
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

          {/* Explicit consent checkbox (gates entry) */}
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentChecked((c) => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentChecked }}
            accessibilityLabel={CONSENT_LABEL}
            activeOpacity={0.7}
          >
            <View
              style={[styles.checkbox, consentChecked && styles.checkboxChecked]}
            >
              {consentChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.consentLabel}>
              {CONSENT_LABEL}
            </Text>
          </TouchableOpacity>

          {/* Terms of Service / Privacy Policy links */}
          <View style={styles.legalLinksRow}>
            <Text
              style={styles.legalLink}
              onPress={handleOpenTerms}
              accessibilityRole="link"
              accessibilityLabel="View Terms of Service"
            >
              Terms of Service
            </Text>
            <Text style={styles.legalSeparator}>  ·  </Text>
            <Text
              style={styles.legalLink}
              onPress={handleOpenPrivacy}
              accessibilityRole="link"
              accessibilityLabel="View Privacy Policy"
            >
              Privacy Policy
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !consentChecked && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!consentChecked}
            accessibilityLabel="Continue to intent selection"
            accessibilityRole="button"
            accessibilityState={{ disabled: !consentChecked }}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.continueButtonText,
                !consentChecked && styles.continueButtonTextDisabled,
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={!consentChecked}
            accessibilityLabel="Skip intro and go to wallet"
            accessibilityRole="button"
            accessibilityState={{ disabled: !consentChecked }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.skipButtonText,
                !consentChecked && styles.skipButtonTextDisabled,
              ]}
            >
              Skip intro
            </Text>
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
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  consentLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  legalLink: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 14,
    color: '#9CA3AF',
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
  continueButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  continueButtonTextDisabled: {
    color: '#9CA3AF',
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
  skipButtonTextDisabled: {
    color: '#C4C9D1',
  },
});
