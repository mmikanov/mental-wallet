/**
 * OnboardingNavigator — Nested native-stack navigator for the onboarding flow.
 *
 * Contains the Welcome, PrivacyNotice, IntentSelection, and KpiSelection screens.
 * - Headers are hidden for a full-screen, immersive onboarding experience.
 * - Back-swipe gesture is disabled on the Welcome screen (Req 1.6)
 *   to prevent users from navigating backward from the entry point.
 * - Determines initial route based on persisted progress (Req 8.3):
 *   If onboardingScreensComplete=true but kpiSelectionComplete=false → KpiSelection
 *   If disclaimerAcknowledged=true but onboardingScreensComplete=false → PrivacyNotice
 *   Otherwise → Welcome
 *
 * Flow: Welcome → PrivacyNotice → IntentSelection → KpiSelection
 * (Skip intro on Welcome bypasses PrivacyNotice per Req 8.6)
 *
 * Validates: Requirements 1.6, 2.5, 8.1, 8.2, 8.3, 8.6, 8.7
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import PrivacyNoticeScreen from '@/screens/onboarding/PrivacyNoticeScreen';
import PrivacyExplanationScreen from '@/screens/onboarding/PrivacyExplanationScreen';
import IntentSelectionScreen from '@/screens/onboarding/IntentSelectionScreen';
import KpiSelectionScreen from '@/screens/onboarding/KpiSelectionScreen';
import { useOnboardingStore } from '@/stores/onboardingStore';

export type OnboardingStackParamList = {
  Welcome: undefined;
  PrivacyNotice: undefined;
  PrivacyExplanation: undefined;
  IntentSelection: undefined;
  KpiSelection: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function getInitialRoute(): keyof OnboardingStackParamList {
  const { disclaimerAcknowledged, onboardingScreensComplete, kpiSelectionComplete } =
    useOnboardingStore.getState();

  if (onboardingScreensComplete && !kpiSelectionComplete) {
    // User completed Intent Selection but not KPI Selection — resume at KPI
    return 'KpiSelection';
  }
  if (disclaimerAcknowledged && !onboardingScreensComplete) {
    // User acknowledged disclaimer but didn't finish onboarding — resume at PrivacyNotice
    return 'PrivacyNotice';
  }
  return 'Welcome';
}

export default function OnboardingNavigator() {
  const initialRoute = getInitialRoute();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="PrivacyNotice" component={PrivacyNoticeScreen} />
      <Stack.Screen name="PrivacyExplanation" component={PrivacyExplanationScreen} />
      <Stack.Screen name="IntentSelection" component={IntentSelectionScreen} />
      <Stack.Screen name="KpiSelection" component={KpiSelectionScreen} />
    </Stack.Navigator>
  );
}
