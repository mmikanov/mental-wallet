/**
 * OnboardingNavigator — Nested native-stack navigator for the onboarding flow.
 *
 * Contains the Welcome, IntentSelection, and KpiSelection screens.
 * - Headers are hidden for a full-screen, immersive onboarding experience.
 * - Back-swipe gesture is disabled on the Welcome screen (Req 1.6)
 *   to prevent users from navigating backward from the entry point.
 * - Determines initial route based on persisted progress (Req 8.3):
 *   If onboardingScreensComplete=true but kpiSelectionComplete=false → KpiSelection
 *   If disclaimerAcknowledged=true but onboardingScreensComplete=false → IntentSelection
 *   Otherwise → Welcome
 *
 * Validates: Requirements 1.6, 2.5, 8.3
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@/screens/onboarding/WelcomeScreen';
import IntentSelectionScreen from '@/screens/onboarding/IntentSelectionScreen';
import KpiSelectionScreen from '@/screens/onboarding/KpiSelectionScreen';
import { useOnboardingStore } from '@/stores/onboardingStore';

export type OnboardingStackParamList = {
  Welcome: undefined;
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
    // User acknowledged disclaimer but didn't finish Intent Selection
    return 'IntentSelection';
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
      <Stack.Screen name="IntentSelection" component={IntentSelectionScreen} />
      <Stack.Screen name="KpiSelection" component={KpiSelectionScreen} />
    </Stack.Navigator>
  );
}
